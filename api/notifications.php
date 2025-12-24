<?php
/**
 * API Thông báo cho học sinh và giáo viên
 * Endpoints:
 * - GET: Lấy danh sách thông báo của học sinh hoặc giáo viên
 * - POST: Đánh dấu đã đọc
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
        $studentId = isset($_GET['student_id']) ? intval($_GET['student_id']) : 0;
        $teacherId = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : 0;
        
        // Handle teacher notifications
        if ($teacherId) {
            $stmt = $pdo->prepare("
                SELECT n.id, n.title, n.content, n.type, n.created_at,
                       CASE WHEN tr.id IS NOT NULL THEN 1 ELSE 0 END as is_read
                FROM notifications n
                LEFT JOIN teacher_notification_reads tr ON n.id = tr.notification_id AND tr.teacher_id = ?
                WHERE n.target_type = 'teacher' AND n.target_id = ?
                ORDER BY n.created_at DESC
                LIMIT 20
            ");
            $stmt->execute([$teacherId, $teacherId]);
            $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Count unread
            $unreadCount = 0;
            foreach ($notifications as $n) {
                if (!$n['is_read']) $unreadCount++;
            }
            
            echo json_encode([
                'success' => true,
                'data' => [
                    'notifications' => $notifications,
                    'unread_count' => $unreadCount
                ]
            ]);
            exit;
        }
        
        // Handle student notifications
        if (!$studentId) {
            echo json_encode(['success' => false, 'message' => 'Thiếu student_id hoặc teacher_id']);
            exit;
        }
        
        // Lấy thông báo từ bảng notifications
        // Lấy user_id của học sinh để check thông báo cá nhân
        $stmt = $pdo->prepare("SELECT user_id FROM students WHERE id = ?");
        $stmt->execute([$studentId]);
        $studentUser = $stmt->fetch(PDO::FETCH_ASSOC);
        $userId = $studentUser ? $studentUser['user_id'] : 0;
        
        $stmt = $pdo->prepare("
            SELECT n.*, 
                   CASE WHEN nr.id IS NOT NULL THEN 1 ELSE 0 END as is_read
            FROM notifications n
            LEFT JOIN notification_reads nr ON n.id = nr.notification_id AND nr.student_id = ?
            WHERE n.target_type IN ('all', 'student')
               AND (n.target_id IS NULL OR n.target_id = ? OR n.target_id = ?)
               AND (n.class_id IS NULL OR n.class_id = (SELECT class_id FROM students WHERE id = ?))
            ORDER BY n.created_at DESC
            LIMIT 20
        ");
        $stmt->execute([$studentId, $studentId, $userId, $studentId]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Đếm số chưa đọc
        $unreadCount = 0;
        foreach ($notifications as $n) {
            if (!$n['is_read']) $unreadCount++;
        }
        
        echo json_encode([
            'success' => true,
            'data' => [
                'notifications' => $notifications,
                'unread_count' => $unreadCount
            ]
        ]);
        
    } elseif ($method === 'POST') {
        // Đánh dấu đã đọc
        $input = json_decode(file_get_contents('php://input'), true);
        $studentId = isset($input['student_id']) ? intval($input['student_id']) : 0;
        $teacherId = isset($input['teacher_id']) ? intval($input['teacher_id']) : 0;
        $notificationId = isset($input['notification_id']) ? intval($input['notification_id']) : 0;
        $markAll = isset($input['mark_all']) ? $input['mark_all'] : false;
        
        // Handle teacher notification reads
        if ($teacherId) {
            if ($markAll) {
                $stmt = $pdo->prepare("
                    INSERT IGNORE INTO teacher_notification_reads (notification_id, teacher_id, read_at)
                    SELECT n.id, ?, NOW()
                    FROM notifications n
                    WHERE n.target_type = 'teacher' AND n.target_id = ?
                ");
                $stmt->execute([$teacherId, $teacherId]);
            } else if ($notificationId) {
                $stmt = $pdo->prepare("
                    INSERT IGNORE INTO teacher_notification_reads (notification_id, teacher_id, read_at)
                    VALUES (?, ?, NOW())
                ");
                $stmt->execute([$notificationId, $teacherId]);
            }
            echo json_encode(['success' => true, 'message' => 'Đã cập nhật']);
            exit;
        }
        
        // Handle student notification reads
        if (!$studentId) {
            echo json_encode(['success' => false, 'message' => 'Thiếu student_id hoặc teacher_id']);
            exit;
        }
        
        if ($markAll) {
            // Đánh dấu tất cả đã đọc
            $stmt = $pdo->prepare("
                INSERT IGNORE INTO notification_reads (notification_id, student_id, read_at)
                SELECT n.id, ?, NOW()
                FROM notifications n
                WHERE n.target_type IN ('all', 'student')
                  AND (n.target_id IS NULL OR n.target_id = ?)
                  AND (n.class_id IS NULL OR n.class_id = (SELECT class_id FROM students WHERE id = ?))
            ");
            $stmt->execute([$studentId, $studentId, $studentId]);
        } else if ($notificationId) {
            // Đánh dấu 1 thông báo đã đọc
            $stmt = $pdo->prepare("
                INSERT IGNORE INTO notification_reads (notification_id, student_id, read_at)
                VALUES (?, ?, NOW())
            ");
            $stmt->execute([$notificationId, $studentId]);
        }
        
        echo json_encode(['success' => true, 'message' => 'Đã cập nhật']);
        
    } else {
        echo json_encode(['success' => false, 'message' => 'Method không hợp lệ']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
