<?php
/**
 * API Phúc khảo điểm
 * GET: Lấy danh sách yêu cầu phúc khảo
 * POST: Tạo yêu cầu phúc khảo / Phân công GV phúc khảo
 * PUT: Cập nhật kết quả phúc khảo
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'GET') {
        $status = isset($_GET['status']) ? $_GET['status'] : '';
        $reviewerId = isset($_GET['reviewer_id']) ? intval($_GET['reviewer_id']) : 0;
        $teacherId = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : 0;
        
        // teacher_id is alias for reviewer_id
        if ($teacherId && !$reviewerId) {
            $reviewerId = $teacherId;
        }
        
        $where = [];
        $params = [];
        
        if ($status) {
            $where[] = "gr.status = ?";
            $params[] = $status;
        }
        
        if ($reviewerId) {
            $where[] = "gr.reviewer_teacher_id = ?";
            $params[] = $reviewerId;
        }
        
        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
        
        $sql = "
            SELECT gr.*,
                   s.full_name as student_name, s.student_code,
                   c.class_name,
                   sub.subject_name,
                   t1.full_name as original_teacher_name,
                   t2.full_name as reviewer_teacher_name,
                   ur.reason, ur.content
            FROM grade_reviews gr
            JOIN students s ON gr.student_id = s.id
            JOIN classes c ON s.class_id = c.id
            JOIN subjects sub ON gr.subject_id = sub.id
            LEFT JOIN teachers t1 ON gr.original_teacher_id = t1.id
            LEFT JOIN teachers t2 ON gr.reviewer_teacher_id = t2.id
            LEFT JOIN update_requests ur ON gr.request_id = ur.id
            $whereClause
            ORDER BY 
                CASE gr.status 
                    WHEN 'pending' THEN 1 
                    WHEN 'assigned' THEN 2 
                    WHEN 'reviewing' THEN 3 
                    ELSE 4 
                END,
                gr.created_at DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $reviews = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Lấy danh sách GV có thể phúc khảo (không phải GV chấm điểm ban đầu)
        $teachers = $pdo->query("
            SELECT id, full_name, teacher_code, department 
            FROM teachers 
            ORDER BY full_name
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        // Thống kê
        $stats = [
            'pending' => 0,
            'assigned' => 0,
            'reviewing' => 0,
            'completed' => 0,
            'rejected' => 0
        ];
        
        foreach ($reviews as $r) {
            $stats[$r['status']]++;
        }
        
        echo json_encode([
            'success' => true,
            'data' => $reviews,
            'teachers' => $teachers,
            'stats' => $stats
        ]);
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $action = isset($input['action']) ? $input['action'] : 'create';
        
        if ($action === 'assign') {
            // Phân công GV phúc khảo
            $reviewId = isset($input['review_id']) ? intval($input['review_id']) : 0;
            $reviewerTeacherId = isset($input['reviewer_teacher_id']) ? intval($input['reviewer_teacher_id']) : 0;
            $adminNote = isset($input['admin_note']) ? trim($input['admin_note']) : '';
            
            if (!$reviewId || !$reviewerTeacherId) {
                echo json_encode(['success' => false, 'message' => 'Thiếu thông tin']);
                exit;
            }
            
            // Kiểm tra GV phúc khảo không phải GV ban đầu
            $stmt = $pdo->prepare("SELECT original_teacher_id FROM grade_reviews WHERE id = ?");
            $stmt->execute([$reviewId]);
            $review = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($review && $review['original_teacher_id'] == $reviewerTeacherId) {
                echo json_encode([
                    'success' => false, 
                    'message' => 'Không thể phân công GV đã chấm điểm ban đầu làm phúc khảo'
                ]);
                exit;
            }
            
            $stmt = $pdo->prepare("
                UPDATE grade_reviews SET 
                    reviewer_teacher_id = ?,
                    status = 'assigned',
                    admin_note = ?,
                    assigned_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$reviewerTeacherId, $adminNote, $reviewId]);
            
            // Tạo thông báo cho GV được phân công
            $stmt = $pdo->prepare("
                SELECT gr.*, s.full_name as student_name, sub.subject_name
                FROM grade_reviews gr
                JOIN students s ON gr.student_id = s.id
                JOIN subjects sub ON gr.subject_id = sub.id
                WHERE gr.id = ?
            ");
            $stmt->execute([$reviewId]);
            $reviewData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Gửi thông báo cho GV (nếu có bảng notifications)
            try {
                $stmt = $pdo->prepare("
                    INSERT INTO notifications (title, content, type, target_type, target_id, created_at)
                    VALUES (?, ?, 'info', 'teacher', ?, NOW())
                ");
                $title = 'Phân công phúc khảo điểm';
                $content = "Bạn được phân công phúc khảo điểm môn {$reviewData['subject_name']} cho học sinh {$reviewData['student_name']}";
                $stmt->execute([$title, $content, $reviewerTeacherId]);
            } catch (Exception $e) {
                // Bỏ qua nếu bảng không tồn tại
            }
            
            echo json_encode(['success' => true, 'message' => 'Đã phân công GV phúc khảo']);
            
        } elseif ($action === 'create') {
            // Tạo yêu cầu phúc khảo mới (từ update_requests)
            $requestId = isset($input['request_id']) ? intval($input['request_id']) : 0;
            $studentId = isset($input['student_id']) ? intval($input['student_id']) : 0;
            $subjectId = isset($input['subject_id']) ? intval($input['subject_id']) : 0;
            $originalTeacherId = isset($input['original_teacher_id']) ? intval($input['original_teacher_id']) : 0;
            $originalGrade = isset($input['original_grade']) ? floatval($input['original_grade']) : null;
            $gradeType = isset($input['grade_type']) ? $input['grade_type'] : '';
            $semester = isset($input['semester']) ? intval($input['semester']) : 1;
            
            if (!$studentId || !$subjectId || !$originalTeacherId) {
                echo json_encode(['success' => false, 'message' => 'Thiếu thông tin']);
                exit;
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO grade_reviews 
                (request_id, student_id, subject_id, original_teacher_id, original_grade, grade_type, semester, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
            ");
            $stmt->execute([
                $requestId ?: null, $studentId, $subjectId, 
                $originalTeacherId, $originalGrade, $gradeType, $semester
            ]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Đã tạo yêu cầu phúc khảo',
                'id' => $pdo->lastInsertId()
            ]);
        }
        
    } elseif ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $reviewId = isset($input['review_id']) ? intval($input['review_id']) : (isset($input['id']) ? intval($input['id']) : 0);
        $status = isset($input['status']) ? $input['status'] : '';
        $reviewedGrade = isset($input['reviewed_grade']) ? floatval($input['reviewed_grade']) : null;
        $reviewNote = isset($input['review_note']) ? trim($input['review_note']) : '';
        $reviewerId = isset($input['reviewer_id']) ? intval($input['reviewer_id']) : 0;
        
        if (!$reviewId) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID']);
            exit;
        }
        
        $updates = [];
        $params = [];
        
        if ($status) {
            $updates[] = "status = ?";
            $params[] = $status;
            
            if ($status === 'completed' || $status === 'rejected') {
                $updates[] = "completed_at = NOW()";
            }
        }
        
        if ($reviewedGrade !== null) {
            $updates[] = "reviewed_grade = ?";
            $params[] = $reviewedGrade;
        }
        
        if ($reviewNote) {
            $updates[] = "review_note = ?";
            $params[] = $reviewNote;
        }
        
        if (empty($updates)) {
            echo json_encode(['success' => false, 'message' => 'Không có dữ liệu cập nhật']);
            exit;
        }
        
        $params[] = $reviewId;
        $sql = "UPDATE grade_reviews SET " . implode(", ", $updates) . " WHERE id = ?";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        // Get review details for notifications
        $stmt = $pdo->prepare("
            SELECT gr.*, s.full_name as student_name, sub.subject_name, t.full_name as reviewer_name
            FROM grade_reviews gr
            JOIN students s ON gr.student_id = s.id
            JOIN subjects sub ON gr.subject_id = sub.id
            LEFT JOIN teachers t ON gr.reviewer_teacher_id = t.id
            WHERE gr.id = ?
        ");
        $stmt->execute([$reviewId]);
        $review = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Nếu hoàn thành phúc khảo
        if ($status === 'completed' && $review) {
            // Cập nhật điểm trong bảng grades nếu điểm thay đổi
            if ($reviewedGrade !== null && $reviewedGrade != $review['original_grade']) {
                // Map grade_type to column name in grades table
                $gradeTypeMap = [
                    // Điểm miệng
                    'oral' => 'oral_score',
                    'oral_score' => 'oral_score',
                    'mieng' => 'oral_score',
                    
                    // Điểm 15 phút
                    '15min' => 'score_15min',
                    'score_15min' => 'score_15min',
                    'quiz' => 'score_15min',
                    '15_phut' => 'score_15min',
                    
                    // Điểm 1 tiết
                    '1hour' => 'score_1hour',
                    'score_1hour' => 'score_1hour',
                    'test' => 'score_1hour',
                    'one_period' => 'score_1hour',
                    '1_tiet' => 'score_1hour',
                    
                    // Điểm giữa kỳ
                    'midterm' => 'midterm_score',
                    'midterm_score' => 'midterm_score',
                    'giua_ky' => 'midterm_score',
                    
                    // Điểm cuối kỳ
                    'final' => 'final_score',
                    'final_score' => 'final_score',
                    'cuoi_ky' => 'final_score',
                    'semester' => 'final_score',
                    
                    // Điểm trung bình
                    'average' => 'average_score',
                    'average_score' => 'average_score'
                ];
                
                $gradeType = strtolower(trim($review['grade_type'] ?? ''));
                $gradeColumn = isset($gradeTypeMap[$gradeType]) 
                    ? $gradeTypeMap[$gradeType] 
                    : null;
                
                // Nếu không tìm được mapping, skip update
                if (!$gradeColumn) {
                    error_log("Grade type not found in mapping: " . $gradeType);
                } else {
                    // Convert semester number to enum value
                    $semesterValue = $review['semester'];
                    if (is_numeric($semesterValue)) {
                        $semesterValue = ($semesterValue == 1) ? 'HK1' : 'HK2';
                    }
                    
                    try {
                        // Also include academic_year in the WHERE clause for accuracy
                        $academicYear = $review['academic_year'] ?? '2024-2025';
                    
                        $stmt = $pdo->prepare("
                            UPDATE grades SET $gradeColumn = ?
                            WHERE student_id = ? AND subject_id = ? AND semester = ? AND academic_year = ?
                        ");
                        $result = $stmt->execute([
                            $reviewedGrade,
                            $review['student_id'],
                            $review['subject_id'],
                            $semesterValue,
                            $academicYear
                        ]);
                        
                        // Log for debugging
                        error_log("Grade updated: student={$review['student_id']}, subject={$review['subject_id']}, semester=$semesterValue, column=$gradeColumn, new_grade=$reviewedGrade, rows_affected=" . $stmt->rowCount());
                        
                    } catch (Exception $e) {
                        error_log("Error updating grade: " . $e->getMessage());
                    }
                }
            }
            
            // Cập nhật status của update_request gốc
            if ($review['request_id']) {
                $stmt = $pdo->prepare("UPDATE update_requests SET status = 'approved' WHERE id = ?");
                $stmt->execute([$review['request_id']]);
            }
            
            // Tạo thông báo cho học sinh
            try {
                $resultText = $reviewedGrade !== null ? "Điểm sau phúc khảo: $reviewedGrade điểm" : "Đã xử lý";
                $oldGrade = $review['original_grade'] !== null ? $review['original_grade'] : 'N/A';
                
                // Lấy user_id của học sinh
                $stmt = $pdo->prepare("SELECT user_id FROM students WHERE id = ?");
                $stmt->execute([$review['student_id']]);
                $studentUser = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($studentUser) {
                    $stmt = $pdo->prepare("
                        INSERT INTO notifications (title, content, type, target_type, target_id, created_at)
                        VALUES (?, ?, 'success', 'student', ?, NOW())
                    ");
                    $title = '✅ Kết quả phúc khảo điểm';
                    $content = "Yêu cầu phúc khảo môn {$review['subject_name']} của bạn đã được xử lý.\n\n";
                    $content .= "• Điểm ban đầu: {$oldGrade}\n";
                    $content .= "• {$resultText}\n";
                    $content .= "• Giáo viên phúc khảo: {$review['reviewer_name']}\n";
                    if ($reviewNote) {
                        $content .= "• Ghi chú: {$reviewNote}";
                    }
                    $stmt->execute([$title, $content, $studentUser['user_id']]);
                }
            } catch (Exception $e) {
                error_log("Error creating student notification: " . $e->getMessage());
            }
        }
        
        // Nếu từ chối phúc khảo
        if ($status === 'rejected' && $review) {
            // Cập nhật status của update_request gốc
            if ($review['request_id']) {
                $stmt = $pdo->prepare("UPDATE update_requests SET status = 'rejected', admin_note = ? WHERE id = ?");
                $stmt->execute(["GV phúc khảo từ chối: " . $reviewNote, $review['request_id']]);
            }
            
            // Tạo thông báo cho học sinh về việc từ chối
            try {
                // Lấy user_id của học sinh
                $stmt = $pdo->prepare("SELECT user_id FROM students WHERE id = ?");
                $stmt->execute([$review['student_id']]);
                $studentUser = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($studentUser) {
                    $stmt = $pdo->prepare("
                        INSERT INTO notifications (title, content, type, target_type, target_id, created_at)
                        VALUES (?, ?, 'warning', 'student', ?, NOW())
                    ");
                    $title = '❌ Phúc khảo điểm không được chấp nhận';
                    $content = "Yêu cầu phúc khảo môn {$review['subject_name']} của bạn không được chấp nhận.\n\n";
                    $content .= "• Điểm hiện tại: {$review['original_grade']}\n";
                    $content .= "• Giáo viên phúc khảo: {$review['reviewer_name']}\n";
                    if ($reviewNote) {
                        $content .= "• Lý do: {$reviewNote}";
                    }
                    $stmt->execute([$title, $content, $studentUser['user_id']]);
                }
            } catch (Exception $e) {
                // Ignore
            }
        }
        
        echo json_encode(['success' => true, 'message' => 'Đã cập nhật phúc khảo']);
        
    } else {
        echo json_encode(['success' => false, 'message' => 'Method không hợp lệ']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
