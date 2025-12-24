<?php
/**
 * API Quản lý Thời Khóa Biểu
 * GET: Lấy TKB theo lớp/giáo viên
 * POST: Tạo/cập nhật TKB
 * DELETE: Xóa tiết học
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'GET') {
        $classId = isset($_GET['class_id']) ? intval($_GET['class_id']) : 0;
        $teacherId = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : 0;
        $weekNumber = isset($_GET['week']) ? intval($_GET['week']) : 0;
        $getAll = isset($_GET['all']) && $_GET['all'] === '1';
        
        if ($getAll) {
            // Lấy tất cả TKB để quản lý
            $stmt = $pdo->query("
                SELECT s.*, 
                       c.class_name, c.grade_level,
                       t.full_name as teacher_name, t.teacher_code,
                       sub.subject_name
                FROM schedules s
                JOIN classes c ON s.class_id = c.id
                LEFT JOIN teachers t ON s.teacher_id = t.id
                LEFT JOIN subjects sub ON s.subject_id = sub.id
                ORDER BY c.grade_level, c.class_name, s.day_of_week, s.period
            ");
            $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(['success' => true, 'data' => $schedules]);
            exit;
        }
        
        $where = [];
        $params = [];
        
        if ($classId) {
            $where[] = "s.class_id = ?";
            $params[] = $classId;
        }
        
        if ($teacherId) {
            $where[] = "s.teacher_id = ?";
            $params[] = $teacherId;
        }
        
        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
        
        $sql = "
            SELECT s.*, 
                   c.class_name,
                   t.full_name as teacher_name,
                   sub.subject_name
            FROM schedules s
            JOIN classes c ON s.class_id = c.id
            LEFT JOIN teachers t ON s.teacher_id = t.id
            LEFT JOIN subjects sub ON s.subject_id = sub.id
            $whereClause
            ORDER BY s.day_of_week, s.period
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format theo ngày và tiết
        $formatted = [];
        foreach ($schedules as $s) {
            $formatted[$s['day_of_week']][$s['period']] = $s;
        }
        
        echo json_encode([
            'success' => true,
            'data' => [
                'raw' => $schedules,
                'formatted' => $formatted
            ]
        ]);
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $action = isset($input['action']) ? $input['action'] : 'add';
        
        if ($action === 'bulk_update') {
            // Cập nhật hàng loạt TKB cho một lớp
            $classId = isset($input['class_id']) ? intval($input['class_id']) : 0;
            $scheduleData = isset($input['schedules']) ? $input['schedules'] : [];
            
            if (!$classId) {
                echo json_encode(['success' => false, 'message' => 'Thiếu class_id']);
                exit;
            }
            
            $pdo->beginTransaction();
            
            try {
                // Xóa TKB cũ của lớp
                $stmt = $pdo->prepare("DELETE FROM schedules WHERE class_id = ?");
                $stmt->execute([$classId]);
                
                // Thêm TKB mới
                $stmt = $pdo->prepare("
                    INSERT INTO schedules (class_id, subject_id, teacher_id, day_of_week, period, room, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                ");
                
                foreach ($scheduleData as $s) {
                    if (!empty($s['subject_id']) && !empty($s['teacher_id'])) {
                        $stmt->execute([
                            $classId,
                            $s['subject_id'],
                            $s['teacher_id'],
                            $s['day_of_week'],
                            $s['period'],
                            $s['room'] ?? null
                        ]);
                    }
                }
                
                $pdo->commit();
                echo json_encode(['success' => true, 'message' => 'Đã cập nhật thời khóa biểu']);
                
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            
        } else {
            // Thêm/sửa một tiết học
            $id = isset($input['id']) ? intval($input['id']) : 0;
            $classId = isset($input['class_id']) ? intval($input['class_id']) : 0;
            $subjectId = isset($input['subject_id']) ? intval($input['subject_id']) : 0;
            $teacherId = isset($input['teacher_id']) ? intval($input['teacher_id']) : 0;
            $dayOfWeek = isset($input['day_of_week']) ? intval($input['day_of_week']) : 0;
            $period = isset($input['period']) ? intval($input['period']) : 0;
            $room = isset($input['room']) ? trim($input['room']) : null;
            
            if (!$classId || !$subjectId || !$dayOfWeek || !$period) {
                echo json_encode(['success' => false, 'message' => 'Thiếu thông tin bắt buộc']);
                exit;
            }
            
            if ($id > 0) {
                // Cập nhật
                $stmt = $pdo->prepare("
                    UPDATE schedules SET 
                        class_id = ?, subject_id = ?, teacher_id = ?,
                        day_of_week = ?, period = ?, room = ?
                    WHERE id = ?
                ");
                $stmt->execute([$classId, $subjectId, $teacherId, $dayOfWeek, $period, $room, $id]);
                $message = 'Đã cập nhật tiết học';
            } else {
                // Thêm mới hoặc thay thế
                $stmt = $pdo->prepare("
                    INSERT INTO schedules (class_id, subject_id, teacher_id, day_of_week, period, room)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        subject_id = VALUES(subject_id),
                        teacher_id = VALUES(teacher_id),
                        room = VALUES(room)
                ");
                $stmt->execute([$classId, $subjectId, $teacherId, $dayOfWeek, $period, $room]);
                $message = 'Đã thêm tiết học';
            }
            
            echo json_encode(['success' => true, 'message' => $message]);
        }
        
    } elseif ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID']);
            exit;
        }
        
        $stmt = $pdo->prepare("DELETE FROM schedules WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode(['success' => true, 'message' => 'Đã xóa tiết học']);
        
    } else {
        echo json_encode(['success' => false, 'message' => 'Method không hợp lệ']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
