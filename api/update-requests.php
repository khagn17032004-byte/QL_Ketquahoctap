<?php
/**
 * Update Requests API
 * Handles update requests from students and teachers
 * 
 * GET /api/update-requests.php - Get all requests
 * GET /api/update-requests.php?status=pending - Filter by status
 * GET /api/update-requests.php?count_pending=1 - Count pending requests
 * POST /api/update-requests.php - Create new request
 * PUT /api/update-requests.php - Update request status (admin)
 * DELETE /api/update-requests.php?id=1 - Delete request
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Count pending requests only
        if (isset($_GET['count_pending'])) {
            try {
                $db = getDB();
                $stmt = $db->query("SELECT COUNT(*) as count FROM update_requests WHERE status = 'pending'");
                $count = $stmt->fetch()['count'];
                jsonResponse(true, ['pending_count' => (int)$count]);
            } catch (PDOException $e) {
                jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
            }
            break;
        }
        
        // Get single request by ID with full details
        if (isset($_GET['id'])) {
            $requestId = (int)$_GET['id'];
            try {
                $db = getDB();
                
                $stmt = $db->prepare("
                    SELECT ur.*, 
                        s.full_name as student_name, 
                        s.student_code,
                        s.class_id,
                        t.full_name as teacher_name,
                        t.teacher_code,
                        u.username as reviewer_username,
                        c.class_name
                    FROM update_requests ur 
                    LEFT JOIN students s ON ur.student_id = s.id 
                    LEFT JOIN teachers t ON ur.teacher_id = t.id
                    LEFT JOIN users u ON ur.reviewed_by = u.id
                    LEFT JOIN classes c ON s.class_id = c.id
                    WHERE ur.id = ?
                ");
                $stmt->execute([$requestId]);
                $request = $stmt->fetch();
                
                if (!$request) {
                    jsonResponse(false, null, 'Không tìm thấy yêu cầu');
                    break;
                }
                
                // Parse additional_info JSON if exists
                if ($request['additional_info']) {
                    $request['additional_info'] = json_decode($request['additional_info'], true);
                }
                
                // For grade review requests, get subject and original teacher info
                if ($request['request_type'] === 'grades' && $request['additional_info']) {
                    $subjectId = $request['additional_info']['subject_id'] ?? null;
                    
                    if ($subjectId) {
                        // Get subject name
                        $subStmt = $db->prepare("SELECT id, subject_name FROM subjects WHERE id = ?");
                        $subStmt->execute([$subjectId]);
                        $subject = $subStmt->fetch();
                        if ($subject) {
                            $request['subject_name'] = $subject['subject_name'];
                        }
                        
                        // Get original teacher who teaches this subject for this class
                        if ($request['class_id']) {
                            $teacherStmt = $db->prepare("
                                SELECT t.id, t.full_name, t.teacher_code, t.department
                                FROM teacher_classes tc
                                JOIN teachers t ON tc.teacher_id = t.id
                                WHERE tc.class_id = ? AND tc.subject_id = ?
                                LIMIT 1
                            ");
                            $teacherStmt->execute([$request['class_id'], $subjectId]);
                            $originalTeacher = $teacherStmt->fetch();
                            if ($originalTeacher) {
                                $request['original_teacher'] = [
                                    'id' => $originalTeacher['id'],
                                    'full_name' => $originalTeacher['full_name'],
                                    'teacher_code' => $originalTeacher['teacher_code'],
                                    'department' => $originalTeacher['department']
                                ];
                                
                                // Get other teachers from same department who can review
                                $reviewersStmt = $db->prepare("
                                    SELECT DISTINCT t.id, t.full_name, t.teacher_code
                                    FROM teachers t
                                    JOIN teacher_subjects ts ON t.id = ts.teacher_id
                                    WHERE ts.subject_id = ? AND t.id != ?
                                    ORDER BY t.full_name
                                ");
                                $reviewersStmt->execute([$subjectId, $originalTeacher['id']]);
                                $request['available_reviewers'] = $reviewersStmt->fetchAll();
                            }
                        }
                    }
                    
                    // Check if grade_review record exists
                    $grStmt = $db->prepare("SELECT * FROM grade_reviews WHERE request_id = ?");
                    $grStmt->execute([$requestId]);
                    $gradeReview = $grStmt->fetch();
                    if ($gradeReview) {
                        $request['grade_review'] = $gradeReview;
                        
                        // Get reviewer name if assigned
                        if ($gradeReview['reviewer_teacher_id']) {
                            $revStmt = $db->prepare("SELECT full_name FROM teachers WHERE id = ?");
                            $revStmt->execute([$gradeReview['reviewer_teacher_id']]);
                            $reviewer = $revStmt->fetch();
                            if ($reviewer) {
                                $request['grade_review']['reviewer_name'] = $reviewer['full_name'];
                            }
                        }
                    }
                }
                
                jsonResponse(true, $request);
            } catch (PDOException $e) {
                jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
            }
            break;
        }
        
        // Get update requests - for admin or specific user
        $studentId = $_GET['student_id'] ?? null;
        $teacherId = $_GET['teacher_id'] ?? null;
        $status = $_GET['status'] ?? null;
        $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 50;
        
        try {
            $db = getDB();
            
            $sql = "SELECT ur.*, 
                    s.full_name as student_name, 
                    s.student_code,
                    t.full_name as teacher_name,
                    t.teacher_code,
                    u.username as reviewer_username
                    FROM update_requests ur 
                    LEFT JOIN students s ON ur.student_id = s.id 
                    LEFT JOIN teachers t ON ur.teacher_id = t.id
                    LEFT JOIN users u ON ur.reviewed_by = u.id
                    WHERE 1=1";
            $params = [];
            
            if ($studentId) {
                $sql .= " AND ur.student_id = ?";
                $params[] = $studentId;
            }
            
            if ($teacherId) {
                $sql .= " AND ur.teacher_id = ?";
                $params[] = $teacherId;
            }
            
            if ($status) {
                $sql .= " AND ur.status = ?";
                $params[] = $status;
            }
            
            $sql .= " ORDER BY 
                CASE ur.status 
                    WHEN 'pending' THEN 1 
                    WHEN 'approved' THEN 2 
                    WHEN 'rejected' THEN 3 
                END,
                ur.created_at DESC
                LIMIT ?";
            $params[] = $limit;
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $requests = $stmt->fetchAll();
            
            // Count by status
            $countStmt = $db->query("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
                FROM update_requests
            ");
            $counts = $countStmt->fetch();
            
            jsonResponse(true, [
                'requests' => $requests,
                'counts' => [
                    'total' => (int)$counts['total'],
                    'pending' => (int)$counts['pending'],
                    'approved' => (int)$counts['approved'],
                    'rejected' => (int)$counts['rejected']
                ]
            ]);
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
        }
        break;
        
    case 'POST':
        // Create new update request - supports both JSON and FormData
        $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
        
        if (strpos($contentType, 'multipart/form-data') !== false) {
            // Handle FormData (with file upload)
            $studentId = $_POST['student_id'] ?? null;
            $teacherId = $_POST['teacher_id'] ?? null;
            $requestType = $_POST['request_type'] ?? 'other';
            $content = $_POST['content'] ?? '';
            $oldValue = $_POST['old_value'] ?? null;
            $newValue = $_POST['new_value'] ?? null;
            $reason = $_POST['reason'] ?? null;
            
            // Grade review specific fields
            $subjectId = $_POST['subject_id'] ?? null;
            $semester = $_POST['semester'] ?? null;
            $gradeType = $_POST['grade_type'] ?? null;
            $currentGrade = $_POST['current_grade'] ?? null;
        } else {
            // Handle JSON
            $data = json_decode(file_get_contents('php://input'), true);
            
            $studentId = $data['student_id'] ?? null;
            $teacherId = $data['teacher_id'] ?? null;
            $requestType = $data['request_type'] ?? 'other';
            $content = $data['content'] ?? '';
            $oldValue = $data['old_value'] ?? null;
            $newValue = $data['new_value'] ?? null;
            $reason = $data['reason'] ?? null;
            
            // Grade review specific fields
            $subjectId = $data['subject_id'] ?? null;
            $semester = $data['semester'] ?? null;
            $gradeType = $data['grade_type'] ?? null;
            $currentGrade = $data['current_grade'] ?? null;
        }
        
        // Must have either student_id or teacher_id
        if (!$studentId && !$teacherId) {
            jsonResponse(false, null, 'Thiếu thông tin người gửi yêu cầu');
            break;
        }
        
        if (!$content && !$reason) {
            jsonResponse(false, null, 'Vui lòng nhập nội dung yêu cầu');
            break;
        }
        
        // Handle file uploads
        $attachments = [];
        if (!empty($_FILES['attachments'])) {
            $uploadDir = __DIR__ . '/../uploads/requests/';
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            foreach ($_FILES['attachments']['name'] as $key => $name) {
                if ($_FILES['attachments']['error'][$key] === UPLOAD_ERR_OK) {
                    $tmpName = $_FILES['attachments']['tmp_name'][$key];
                    $size = $_FILES['attachments']['size'][$key];
                    
                    // Max 5MB
                    if ($size > 5 * 1024 * 1024) continue;
                    
                    // Generate unique filename
                    $ext = pathinfo($name, PATHINFO_EXTENSION);
                    $newName = uniqid('attach_') . '.' . $ext;
                    $targetPath = $uploadDir . $newName;
                    
                    if (move_uploaded_file($tmpName, $targetPath)) {
                        $attachments[] = [
                            'name' => $name,
                            'path' => 'uploads/requests/' . $newName,
                            'size' => $size
                        ];
                    }
                }
            }
        }
        
        try {
            $db = getDB();
            
            // Build additional info for grade review
            $additionalInfo = null;
            if ($requestType === 'grades' && $subjectId) {
                $additionalInfo = json_encode([
                    'subject_id' => $subjectId,
                    'semester' => $semester,
                    'grade_type' => $gradeType,
                    'current_grade' => $currentGrade,
                    'attachments' => $attachments
                ], JSON_UNESCAPED_UNICODE);
            } elseif (!empty($attachments)) {
                $additionalInfo = json_encode([
                    'attachments' => $attachments
                ], JSON_UNESCAPED_UNICODE);
            }
            
            $stmt = $db->prepare("
                INSERT INTO update_requests (student_id, teacher_id, request_type, old_value, new_value, reason, content, additional_info, status, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
            ");
            $stmt->execute([$studentId, $teacherId, $requestType, $oldValue, $newValue, $reason, $content ?: $reason, $additionalInfo]);
            
            jsonResponse(true, ['id' => $db->lastInsertId()], 'Yêu cầu đã được gửi thành công');
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
        }
        break;
        
    case 'PUT':
        // Update request status (approve/reject) - for admin
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Handle reviewer assignment for grade reviews
        if (isset($data['assign_reviewer'])) {
            $requestId = $data['request_id'] ?? null;
            $reviewerId = $data['reviewer_id'] ?? null;
            
            if (!$requestId || !$reviewerId) {
                jsonResponse(false, null, 'Thiếu thông tin bắt buộc');
                break;
            }
            
            try {
                $db = getDB();
                
                // Get request details
                $reqStmt = $db->prepare("
                    SELECT ur.*, s.class_id
                    FROM update_requests ur
                    LEFT JOIN students s ON ur.student_id = s.id
                    WHERE ur.id = ?
                ");
                $reqStmt->execute([$requestId]);
                $request = $reqStmt->fetch();
                
                if (!$request || $request['request_type'] !== 'grades') {
                    jsonResponse(false, null, 'Yêu cầu không hợp lệ hoặc không phải phúc khảo điểm');
                    break;
                }
                
                $additionalInfo = json_decode($request['additional_info'], true);
                $subjectId = $additionalInfo['subject_id'] ?? null;
                $semester = $additionalInfo['semester'] ?? 1;
                $gradeType = $additionalInfo['grade_type'] ?? 'quiz';
                $currentGrade = $additionalInfo['current_grade'] ?? null;
                
                if (!$subjectId) {
                    jsonResponse(false, null, 'Không tìm thấy thông tin môn học');
                    break;
                }
                
                // Get original teacher
                $origStmt = $db->prepare("
                    SELECT teacher_id FROM teacher_classes 
                    WHERE class_id = ? AND subject_id = ?
                    LIMIT 1
                ");
                $origStmt->execute([$request['class_id'], $subjectId]);
                $origTeacher = $origStmt->fetch();
                $originalTeacherId = $origTeacher ? $origTeacher['teacher_id'] : null;
                
                // Check if grade_review exists
                $grStmt = $db->prepare("SELECT id FROM grade_reviews WHERE request_id = ?");
                $grStmt->execute([$requestId]);
                $existingReview = $grStmt->fetch();
                
                if ($existingReview) {
                    // Update existing grade_review
                    $updateStmt = $db->prepare("
                        UPDATE grade_reviews 
                        SET reviewer_teacher_id = ?, status = 'assigned', assigned_at = NOW()
                        WHERE request_id = ?
                    ");
                    $updateStmt->execute([$reviewerId, $requestId]);
                } else {
                    // Create new grade_review record
                    $insertStmt = $db->prepare("
                        INSERT INTO grade_reviews 
                        (request_id, student_id, subject_id, original_teacher_id, reviewer_teacher_id, 
                         original_grade, grade_type, semester, academic_year, status, assigned_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '2024-2025', 'assigned', NOW())
                    ");
                    $insertStmt->execute([
                        $requestId,
                        $request['student_id'],
                        $subjectId,
                        $originalTeacherId,
                        $reviewerId,
                        $currentGrade,
                        $gradeType,
                        $semester
                    ]);
                }
                
                // Get reviewer name and user_id
                $revStmt = $db->prepare("SELECT id, full_name, user_id FROM teachers WHERE id = ?");
                $revStmt->execute([$reviewerId]);
                $reviewer = $revStmt->fetch();
                
                // Get subject name for notification
                $subStmt = $db->prepare("SELECT subject_name FROM subjects WHERE id = ?");
                $subStmt->execute([$subjectId]);
                $subject = $subStmt->fetch();
                $subjectName = $subject ? $subject['subject_name'] : 'Không xác định';
                
                // Get student name
                $stuStmt = $db->prepare("SELECT full_name FROM students WHERE id = ?");
                $stuStmt->execute([$request['student_id']]);
                $student = $stuStmt->fetch();
                $studentName = $student ? $student['full_name'] : 'Không xác định';
                
                // Create notification for the reviewer teacher
                if ($reviewer && $reviewer['id']) {
                    $notifStmt = $db->prepare("
                        INSERT INTO notifications (title, content, type, target_type, target_id, created_at)
                        VALUES (?, ?, 'info', 'teacher', ?, NOW())
                    ");
                    $notifTitle = 'Phân công phúc khảo điểm';
                    $notifContent = "Bạn được phân công phúc khảo điểm môn {$subjectName} cho học sinh {$studentName}. Vui lòng kiểm tra và xử lý yêu cầu.";
                    $notifStmt->execute([$notifTitle, $notifContent, $reviewer['id']]);
                }
                
                jsonResponse(true, [
                    'message' => 'Đã phân công giáo viên phúc khảo',
                    'reviewer_name' => $reviewer['full_name'] ?? ''
                ]);
            } catch (PDOException $e) {
                jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
            }
            break;
        }
        
        $requestId = $data['id'] ?? null;
        $status = $data['status'] ?? null; // 'approved' or 'rejected'
        $adminNote = $data['admin_note'] ?? '';
        $reviewedBy = $data['reviewed_by'] ?? null;
        
        if (!$requestId || !$status) {
            jsonResponse(false, null, 'Thiếu thông tin bắt buộc');
            break;
        }
        
        if (!in_array($status, ['approved', 'rejected', 'pending'])) {
            jsonResponse(false, null, 'Trạng thái không hợp lệ');
            break;
        }
        
        try {
            $db = getDB();
            
            $stmt = $db->prepare("
                UPDATE update_requests 
                SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$status, $adminNote, $reviewedBy, $requestId]);
            
            if ($stmt->rowCount() > 0) {
                $statusText = $status === 'approved' ? 'Đã duyệt' : ($status === 'rejected' ? 'Đã từ chối' : 'Đang chờ');
                jsonResponse(true, null, "Cập nhật trạng thái: $statusText");
            } else {
                jsonResponse(false, null, 'Không tìm thấy yêu cầu');
            }
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
        }
        break;
        
    case 'DELETE':
        // Delete request
        $data = json_decode(file_get_contents('php://input'), true);
        $requestId = $data['id'] ?? $_GET['id'] ?? null;
        
        if (!$requestId) {
            jsonResponse(false, null, 'Thiếu ID yêu cầu');
            break;
        }
        
        try {
            $db = getDB();
            
            $stmt = $db->prepare("DELETE FROM update_requests WHERE id = ?");
            $stmt->execute([$requestId]);
            
            if ($stmt->rowCount() > 0) {
                jsonResponse(true, null, 'Đã xóa yêu cầu');
            } else {
                jsonResponse(false, null, 'Không tìm thấy yêu cầu');
            }
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
        }
        break;
        
    default:
        jsonResponse(false, null, 'Method không được hỗ trợ');
}
