<?php
/**
 * API Gửi thư mời phụ huynh
 * POST: Tạo thông báo mời họp phụ huynh
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
        // Lấy danh sách thư mời đã gửi
        $teacherId = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : 0;
        $classId = isset($_GET['class_id']) ? intval($_GET['class_id']) : 0;
        
        $sql = "SELECT n.*, s.full_name as student_name, s.student_code
                FROM notifications n
                LEFT JOIN students s ON n.target_id = s.id AND n.target_type = 'student'
                WHERE n.created_by = ?";
        $params = [$teacherId];
        
        if ($classId) {
            $sql .= " AND n.class_id = ?";
            $params[] = $classId;
        }
        
        $sql .= " ORDER BY n.created_at DESC LIMIT 50";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $invitations = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'data' => $invitations]);
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $teacherId = isset($input['teacher_id']) ? intval($input['teacher_id']) : 0;
        $classId = isset($input['class_id']) ? intval($input['class_id']) : 0;
        $studentIds = isset($input['student_ids']) ? $input['student_ids'] : [];
        $sendToAll = isset($input['send_to_all']) ? $input['send_to_all'] : false;
        $title = isset($input['title']) ? trim($input['title']) : '';
        $content = isset($input['content']) ? trim($input['content']) : '';
        $meetingDate = isset($input['meeting_date']) ? $input['meeting_date'] : '';
        $meetingTime = isset($input['meeting_time']) ? $input['meeting_time'] : '';
        $reason = isset($input['reason']) ? trim($input['reason']) : '';
        
        if (!$teacherId || !$classId) {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin giáo viên hoặc lớp']);
            exit;
        }
        
        if (empty($title)) {
            $title = 'Thư mời phụ huynh họp lớp';
        }
        
        if (empty($content)) {
            // Tạo nội dung mặc định
            $content = "Kính gửi Quý Phụ huynh,\n\n";
            $content .= "Nhà trường và Giáo viên chủ nhiệm trân trọng kính mời Quý Phụ huynh tham dự buổi họp";
            if ($meetingDate) {
                $content .= " vào ngày " . date('d/m/Y', strtotime($meetingDate));
            }
            if ($meetingTime) {
                $content .= " lúc " . $meetingTime;
            }
            $content .= ".\n\n";
            if ($reason) {
                $content .= "Nội dung: " . $reason . "\n\n";
            }
            $content .= "Rất mong Quý Phụ huynh sắp xếp thời gian tham dự.\n\nTrân trọng!";
        }
        
        $pdo->beginTransaction();
        
        try {
            if ($sendToAll) {
                // Gửi cho cả lớp
                $stmt = $pdo->prepare("
                    INSERT INTO notifications (title, content, type, target_type, class_id, created_by, created_at)
                    VALUES (?, ?, 'warning', 'class', ?, ?, NOW())
                ");
                $stmt->execute([$title, $content, $classId, $teacherId]);
                $count = 1;
            } else {
                // Gửi cho từng học sinh được chọn
                $stmt = $pdo->prepare("
                    INSERT INTO notifications (title, content, type, target_type, target_id, class_id, created_by, created_at)
                    VALUES (?, ?, 'warning', 'student', ?, ?, ?, NOW())
                ");
                
                $count = 0;
                foreach ($studentIds as $studentId) {
                    $stmt->execute([$title, $content, $studentId, $classId, $teacherId]);
                    $count++;
                }
            }
            
            $pdo->commit();
            echo json_encode([
                'success' => true, 
                'message' => "Đã gửi thư mời thành công" . ($sendToAll ? " cho cả lớp" : " cho $count học sinh")
            ]);
            
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
        
    } else {
        echo json_encode(['success' => false, 'message' => 'Method không hợp lệ']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
