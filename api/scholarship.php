<?php
/**
 * API Học bổng - Lấy danh sách học sinh đủ điều kiện nhận học bổng
 * GET /api/scholarship.php - Lấy danh sách ứng viên học bổng
 * GET /api/scholarship.php?type=academic - Học bổng học tập (theo ĐTB)
 * GET /api/scholarship.php?type=policy - Học bổng đối tượng chính sách
 * GET /api/scholarship.php?academic_year=2024-2025 - Theo năm học
 */

require_once 'config.php';

// Handle POST request for sending notifications
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = getJsonInput();
    $action = $input['action'] ?? '';

    if ($action === 'send_notifications') {
        $academicYear = $input['academic_year'] ?? '2024-2025';
        $academicStudents = $input['academic_students'] ?? [];
        $policyStudents = $input['policy_students'] ?? [];

        if (empty($academicStudents) && empty($policyStudents)) {
            jsonResponse(false, null, 'Không có danh sách học sinh để gửi thông báo');
        }

        try {
            $db = getDB();
            $db->beginTransaction();

            // Gửi thông báo cho học sinh đạt học bổng học tập
            if (!empty($academicStudents)) {
                $stmt = $db->prepare("INSERT INTO notifications (title, content, type, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
                foreach ($academicStudents as $studentId) {
                    $stmt->execute([
                        'Chúc mừng! Bạn đạt học bổng học tập',
                        "Chúc mừng bạn đã đạt học bổng học tập năm học $academicYear với thành tích xuất sắc. Vui lòng liên hệ văn phòng nhà trường để nhận hướng dẫn.",
                        'info',
                        'student',
                        $studentId
                    ]);
                }
            }

            // Gửi thông báo cho học sinh đối tượng chính sách
            if (!empty($policyStudents)) {
                $stmt = $db->prepare("INSERT INTO notifications (title, content, type, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
                foreach ($policyStudents as $studentId) {
                    $stmt->execute([
                        'Thông báo học bổng chính sách',
                        "Nhà trường thông báo về việc xét duyệt học bổng đối tượng chính sách năm học $academicYear. Vui lòng kiểm tra thông tin và liên hệ văn phòng.",
                        'info',
                        'student',
                        $studentId
                    ]);
                }
            }

            $db->commit();
            jsonResponse(true, null, 'Đã gửi thông báo thành công cho ' . (count($academicStudents) + count($policyStudents)) . ' học sinh');
        } catch (Exception $e) {
            if (isset($db)) $db->rollBack();
            jsonResponse(false, null, 'Lỗi khi gửi thông báo: ' . $e->getMessage());
        }
    }
    
    jsonResponse(false, null, 'Hành động không hợp lệ');
}

// Only accept GET for the rest
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, null, 'Method not allowed');
    exit;
}

try {
    $db = getDB();
    
    $academicYear = isset($_GET['academic_year']) ? $_GET['academic_year'] : '2024-2025';
    $type = isset($_GET['type']) ? $_GET['type'] : 'all';
    $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 50;
    $gradeLevel = isset($_GET['grade_level']) ? (int)$_GET['grade_level'] : null;
    
    $result = [
        'academic' => [],
        'policy' => [],
        'summary' => [
            'total_academic' => 0,
            'total_policy' => 0,
            'academic_year' => $academicYear
        ]
    ];
    
    // ============================================
    // HỌC BỔNG HỌC TẬP - Theo điểm trung bình cả năm
    // Điều kiện: Hạnh kiểm cả năm "Tốt" + ĐTB cao nhất
    // ============================================
    if ($type === 'all' || $type === 'academic') {
        
        // Tính điểm trung bình cả năm của mỗi học sinh
        // ĐTB cả năm = (ĐTB HK1 + ĐTB HK2 * 2) / 3
        $sql = "
            SELECT 
                s.id AS student_id,
                s.student_code,
                s.full_name,
                s.gender,
                s.birth_date,
                s.policy_object,
                c.class_name,
                c.grade_level,
                
                -- Điểm TB từng học kỳ (tính từ điểm các môn)
                ROUND(AVG(CASE WHEN g.semester = 'HK1' THEN g.average_score END), 2) AS avg_hk1,
                ROUND(AVG(CASE WHEN g.semester = 'HK2' THEN g.average_score END), 2) AS avg_hk2,
                
                -- Điểm TB cả năm = (HK1 + HK2*2) / 3
                ROUND(
                    (COALESCE(AVG(CASE WHEN g.semester = 'HK1' THEN g.average_score END), 0) 
                    + COALESCE(AVG(CASE WHEN g.semester = 'HK2' THEN g.average_score END), 0) * 2) / 3
                , 2) AS avg_year,
                
                -- Lấy hạnh kiểm HK2 (coi như cả năm)
                (SELECT rating FROM conduct WHERE student_id = s.id AND academic_year = ? AND semester = 'HK2' LIMIT 1) AS conduct_hk2,
                (SELECT rating FROM conduct WHERE student_id = s.id AND academic_year = ? AND semester = 'HK1' LIMIT 1) AS conduct_hk1,
                
                -- Số môn có điểm
                COUNT(DISTINCT g.subject_id) AS subject_count
                
            FROM students s
            INNER JOIN classes c ON s.class_id = c.id
            LEFT JOIN grades g ON s.id = g.student_id AND g.academic_year = ?
            WHERE g.average_score IS NOT NULL
        ";
        
        $params = [$academicYear, $academicYear, $academicYear];
        
        if ($gradeLevel) {
            $sql .= " AND c.grade_level = ?";
            $params[] = $gradeLevel;
        }
        
        $sql .= "
            GROUP BY s.id
            HAVING avg_year IS NOT NULL AND avg_year > 0
            ORDER BY avg_year DESC, avg_hk2 DESC, avg_hk1 DESC, s.full_name ASC
        ";
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $candidates = $stmt->fetchAll();
        
        // Lọc những học sinh có hạnh kiểm Tốt cả năm (HK1 và HK2 đều Tốt)
        $academicScholarship = [];
        $rank = 0;
        $lastAvg = null;
        $actualRank = 0;
        
        foreach ($candidates as $student) {
            // Kiểm tra hạnh kiểm cả năm phải Tốt
            $conductOk = ($student['conduct_hk1'] === 'Tốt' || $student['conduct_hk1'] === null) 
                      && ($student['conduct_hk2'] === 'Tốt' || $student['conduct_hk2'] === null);
            
            // Hoặc chỉ cần 1 trong 2 là Tốt (nếu chưa có đủ dữ liệu)
            if (!$conductOk) {
                $conductOk = $student['conduct_hk1'] === 'Tốt' || $student['conduct_hk2'] === 'Tốt';
            }
            
            if (!$conductOk) continue;
            
            $actualRank++;
            
            // Xếp hạng (cùng điểm thì cùng hạng)
            if ($lastAvg !== $student['avg_year']) {
                $rank = $actualRank;
                $lastAvg = $student['avg_year'];
            }
            
            // Lấy điểm chi tiết từng môn để so sánh khi điểm bằng nhau
            $stmtSubjects = $db->prepare("
                SELECT 
                    sub.subject_name,
                    ROUND(AVG(g.average_score), 2) AS subject_avg
                FROM grades g
                INNER JOIN subjects sub ON g.subject_id = sub.id
                WHERE g.student_id = ? AND g.academic_year = ?
                GROUP BY g.subject_id
                ORDER BY subject_avg DESC
            ");
            $stmtSubjects->execute([$student['student_id'], $academicYear]);
            $subjectScores = $stmtSubjects->fetchAll();
            
            $academicScholarship[] = [
                'rank' => $rank,
                'student_id' => $student['student_id'],
                'student_code' => $student['student_code'],
                'full_name' => $student['full_name'],
                'gender' => $student['gender'],
                'birth_date' => $student['birth_date'],
                'class_name' => $student['class_name'],
                'grade_level' => $student['grade_level'],
                'avg_hk1' => $student['avg_hk1'],
                'avg_hk2' => $student['avg_hk2'],
                'avg_year' => $student['avg_year'],
                'conduct_hk1' => $student['conduct_hk1'],
                'conduct_hk2' => $student['conduct_hk2'],
                'subject_count' => $student['subject_count'],
                'subject_scores' => $subjectScores,
                'policy_object' => $student['policy_object'],
                'scholarship_type' => 'academic'
            ];
            
            if (count($academicScholarship) >= $limit) break;
        }
        
        $result['academic'] = $academicScholarship;
        $result['summary']['total_academic'] = count($academicScholarship);
    }
    
    // ============================================
    // HỌC BỔNG ĐỐI TƯỢNG CHÍNH SÁCH
    // ============================================
    if ($type === 'all' || $type === 'policy') {
        
        $sql = "
            SELECT 
                s.id AS student_id,
                s.student_code,
                s.full_name,
                s.gender,
                s.birth_date,
                s.policy_object,
                s.ethnicity,
                c.class_name,
                c.grade_level,
                
                -- Điểm TB cả năm
                ROUND(
                    (COALESCE(AVG(CASE WHEN g.semester = 'HK1' THEN g.average_score END), 0) 
                    + COALESCE(AVG(CASE WHEN g.semester = 'HK2' THEN g.average_score END), 0) * 2) / 3
                , 2) AS avg_year,
                
                -- Hạnh kiểm
                (SELECT rating FROM conduct WHERE student_id = s.id AND academic_year = ? AND semester = 'HK2' LIMIT 1) AS conduct_hk2
                
            FROM students s
            INNER JOIN classes c ON s.class_id = c.id
            LEFT JOIN grades g ON s.id = g.student_id AND g.academic_year = ?
            WHERE s.policy_object IS NOT NULL AND s.policy_object != ''
        ";
        
        $params = [$academicYear, $academicYear];
        
        if ($gradeLevel) {
            $sql .= " AND c.grade_level = ?";
            $params[] = $gradeLevel;
        }
        
        $sql .= "
            GROUP BY s.id
            ORDER BY 
                CASE s.policy_object
                    WHEN 'con_thuong_binh_liet_si' THEN 1
                    WHEN 'ho_ngheo' THEN 2
                    WHEN 'khuyet_tat' THEN 3
                    WHEN 'dan_toc_vung_kho' THEN 4
                    WHEN 'ho_can_ngheo' THEN 5
                    ELSE 6
                END,
                avg_year DESC,
                s.full_name ASC
            LIMIT ?
        ";
        $params[] = $limit;
        
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $policyStudents = $stmt->fetchAll();
        
        $policyLabels = [
            'con_thuong_binh_liet_si' => 'Con thương binh, liệt sĩ',
            'ho_ngheo' => 'Hộ nghèo',
            'ho_can_ngheo' => 'Hộ cận nghèo',
            'dan_toc_vung_kho' => 'Dân tộc thiểu số vùng khó khăn',
            'khuyet_tat' => 'Học sinh khuyết tật'
        ];
        
        $policyScholarship = [];
        foreach ($policyStudents as $student) {
            $policyScholarship[] = [
                'student_id' => $student['student_id'],
                'student_code' => $student['student_code'],
                'full_name' => $student['full_name'],
                'gender' => $student['gender'],
                'birth_date' => $student['birth_date'],
                'class_name' => $student['class_name'],
                'grade_level' => $student['grade_level'],
                'policy_object' => $student['policy_object'],
                'policy_label' => $policyLabels[$student['policy_object']] ?? $student['policy_object'],
                'ethnicity' => $student['ethnicity'],
                'avg_year' => $student['avg_year'],
                'conduct' => $student['conduct_hk2'],
                'scholarship_type' => 'policy'
            ];
        }
        
        $result['policy'] = $policyScholarship;
        $result['summary']['total_policy'] = count($policyScholarship);
    }
    
    jsonResponse(true, $result, 'Lấy danh sách học bổng thành công');
    
} catch (PDOException $e) {
    jsonResponse(false, null, 'Lỗi database: ' . $e->getMessage());
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
}
