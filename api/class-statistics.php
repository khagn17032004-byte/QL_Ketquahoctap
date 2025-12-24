<?php
/**
 * API Thống kê lớp yếu - Hỗ trợ phụ đạo
 * GET: Lấy thống kê các lớp yếu
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'GET') {
        $gradeLevel = isset($_GET['grade_level']) ? intval($_GET['grade_level']) : 0;
        $semesterNum = isset($_GET['semester']) ? intval($_GET['semester']) : 1;
        $semester = $semesterNum == 2 ? 'HK2' : 'HK1'; // Convert số sang enum
        $year = isset($_GET['year']) ? $_GET['year'] : '2024-2025';
        $onlyWeak = isset($_GET['only_weak']) && $_GET['only_weak'] === '1';
        
        // Lấy thống kê điểm của các lớp
        $where = [];
        $params = [];
        
        if ($gradeLevel) {
            $where[] = "c.grade_level = ?";
            $params[] = $gradeLevel;
        }
        
        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
        
        // Query thống kê chi tiết từng lớp - tính điểm TB của học sinh rồi phân loại
        $sql = "
            SELECT 
                c.id as class_id,
                c.class_name,
                c.grade_level,
                t.full_name as homeroom_teacher,
                COUNT(DISTINCT s.id) as total_students,
                ROUND(AVG(student_avg.avg_score), 2) as avg_final_score,
                SUM(CASE WHEN student_avg.avg_score < 5 THEN 1 ELSE 0 END) as weak_count,
                SUM(CASE WHEN student_avg.avg_score >= 5 AND student_avg.avg_score < 6.5 THEN 1 ELSE 0 END) as medium_count,
                SUM(CASE WHEN student_avg.avg_score >= 6.5 AND student_avg.avg_score < 8 THEN 1 ELSE 0 END) as good_count,
                SUM(CASE WHEN student_avg.avg_score >= 8 THEN 1 ELSE 0 END) as excellent_count
            FROM classes c
            LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id
            LEFT JOIN students s ON s.class_id = c.id
            LEFT JOIN (
                SELECT student_id, ROUND(AVG(final_score), 2) as avg_score
                FROM grades 
                WHERE semester = ?
                GROUP BY student_id
            ) student_avg ON student_avg.student_id = s.id
            $whereClause
            GROUP BY c.id
            ORDER BY c.grade_level DESC, avg_final_score ASC
        ";
        
        array_unshift($params, $semester);
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $classStats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Tính toán phần trăm và xác định lớp cần hỗ trợ
        $results = [];
        foreach ($classStats as &$cs) {
            $total = $cs['total_students'] ?: 1;
            $cs['weak_percent'] = round(($cs['weak_count'] / $total) * 100, 1);
            $cs['medium_percent'] = round(($cs['medium_count'] / $total) * 100, 1);
            
            // Lớp cần hỗ trợ:
            // - Lớp 12: ưu tiên cao, chỉ cần >= 2 học sinh trung bình là cần hỗ trợ
            // - Lớp khác: có học sinh yếu >= 20%, hoặc hơn 50% học sinh trung bình
            if ($cs['grade_level'] == 12) {
                $cs['needs_support'] = $cs['weak_count'] >= 1 || $cs['medium_count'] >= 2;
            } else {
                $hasWeakStudents = $cs['weak_percent'] >= 20;
                $hasManyMediumStudents = $cs['medium_percent'] > 50;
                $cs['needs_support'] = $hasWeakStudents || $hasManyMediumStudents;
            }
            
            // Ưu tiên cao: lớp 12
            $cs['priority'] = $cs['grade_level'] == 12 ? 'high' : 'normal';
            
            if (!$onlyWeak || $cs['needs_support']) {
                $results[] = $cs;
            }
        }
        
        // Thống kê môn yếu nhất theo từng lớp
        $weakSubjects = [];
        foreach ($results as $class) {
            $stmt = $pdo->prepare("
                SELECT 
                    sub.subject_name,
                    ROUND(AVG(g.final_score), 2) as avg_score,
                    COUNT(CASE WHEN g.final_score < 5 THEN 1 END) as weak_count
                FROM grades g
                JOIN students s ON g.student_id = s.id
                JOIN subjects sub ON g.subject_id = sub.id
                WHERE s.class_id = ? AND g.semester = ?
                GROUP BY g.subject_id
                HAVING avg_score < 6
                ORDER BY avg_score ASC
                LIMIT 3
            ");
            $stmt->execute([$class['class_id'], $semester]);
            $weakSubjects[$class['class_id']] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        // Thống kê tổng quan
        $totalClasses = count($results);
        $weakClasses = count(array_filter($results, fn($c) => $c['needs_support']));
        $grade12Weak = count(array_filter($results, fn($c) => $c['grade_level'] == 12 && $c['needs_support']));
        
        // Danh sách học sinh yếu nhất (ưu tiên lớp 12)
        $stmt = $pdo->prepare("
            SELECT 
                s.id, s.student_code, s.full_name,
                c.class_name, c.grade_level,
                ROUND(AVG(g.final_score), 2) as avg_score,
                GROUP_CONCAT(DISTINCT CASE WHEN g.final_score < 5 THEN sub.subject_name END) as weak_subjects
            FROM students s
            JOIN classes c ON s.class_id = c.id
            JOIN grades g ON g.student_id = s.id AND g.semester = ?
            JOIN subjects sub ON g.subject_id = sub.id
            GROUP BY s.id
            HAVING avg_score < 5
            ORDER BY c.grade_level DESC, avg_score ASC
            LIMIT 50
        ");
        $stmt->execute([$semester]);
        $weakStudents = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'classes' => $results,
                'weak_subjects' => $weakSubjects,
                'weak_students' => $weakStudents
            ],
            'summary' => [
                'total_classes' => $totalClasses,
                'weak_classes' => $weakClasses,
                'grade12_weak' => $grade12Weak,
                'total_weak_students' => count($weakStudents)
            ]
        ]);
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $action = isset($input['action']) ? $input['action'] : '';
        
        // Gửi thông báo hỗ trợ phụ đạo đến GVCN
        if ($action === 'send_support_notification') {
            $classId = isset($input['class_id']) ? intval($input['class_id']) : 0;
            $title = isset($input['title']) ? trim($input['title']) : '';
            $content = isset($input['content']) ? trim($input['content']) : '';
            
            if (!$classId || !$title) {
                echo json_encode(['success' => false, 'message' => 'Thiếu thông tin']);
                exit;
            }
            
            // Lấy thông tin GVCN của lớp
            $stmt = $pdo->prepare("
                SELECT c.id, c.class_name, c.homeroom_teacher_id, t.full_name as teacher_name, t.id as teacher_id
                FROM classes c
                LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id
                WHERE c.id = ?
            ");
            $stmt->execute([$classId]);
            $classInfo = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$classInfo) {
                echo json_encode(['success' => false, 'message' => 'Không tìm thấy lớp']);
                exit;
            }
            
            if (!$classInfo['homeroom_teacher_id']) {
                echo json_encode(['success' => false, 'message' => 'Lớp chưa có giáo viên chủ nhiệm']);
                exit;
            }
            
            // Tạo thông báo cho giáo viên
            $stmt = $pdo->prepare("
                INSERT INTO notifications (title, content, type, target_type, target_id, created_by, created_at)
                VALUES (?, ?, 'urgent', 'teacher', ?, 1, NOW())
            ");
            $stmt->execute([$title, $content, $classInfo['teacher_id']]);
            $notificationId = $pdo->lastInsertId();
            
            // Liên kết thông báo với giáo viên (để đánh dấu đã đọc sau này)
            $stmt = $pdo->prepare("
                INSERT INTO teacher_notification_reads (teacher_id, notification_id, read_at)
                VALUES (?, ?, NULL)
                ON DUPLICATE KEY UPDATE read_at = NULL
            ");
            $stmt->execute([$classInfo['teacher_id'], $notificationId]);
            
            echo json_encode([
                'success' => true, 
                'message' => 'Đã gửi thông báo đến GVCN ' . $classInfo['teacher_name'],
                'notification_id' => $notificationId
            ]);
            exit;
        }
        
        // Đánh dấu lớp cần hỗ trợ và ghi chú (logic cũ)
        $classId = isset($input['class_id']) ? intval($input['class_id']) : 0;
        $needsSupport = isset($input['needs_support']) ? $input['needs_support'] : 0;
        $supportNote = isset($input['support_note']) ? trim($input['support_note']) : '';
        $semester = isset($input['semester']) ? intval($input['semester']) : 1;
        $year = isset($input['year']) ? $input['year'] : '2024-2025';
        
        if (!$classId) {
            echo json_encode(['success' => false, 'message' => 'Thiếu class_id']);
            exit;
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO class_statistics (class_id, academic_year, semester, needs_support, support_note)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                needs_support = VALUES(needs_support),
                support_note = VALUES(support_note),
                last_updated = NOW()
        ");
        $stmt->execute([$classId, $year, $semester, $needsSupport ? 1 : 0, $supportNote]);
        
        echo json_encode(['success' => true, 'message' => 'Đã cập nhật']);
        
    } else {
        echo json_encode(['success' => false, 'message' => 'Method không hợp lệ']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
