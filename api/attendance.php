<?php
/**
 * API Điểm danh học sinh
 * GET: Lấy danh sách điểm danh theo lớp và ngày
 * POST: Lưu điểm danh
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
        $classId = isset($_GET['class_id']) ? intval($_GET['class_id']) : 0;
        $date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');
        $teacherId = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : 0;
        
        if (!$classId) {
            echo json_encode(['success' => false, 'message' => 'Thiếu class_id']);
            exit;
        }
        
        // Lấy danh sách học sinh của lớp
        $stmt = $pdo->prepare("
            SELECT s.id, s.student_code, s.full_name, s.gender,
                   a.status, a.note, a.id as attendance_id
            FROM students s
            LEFT JOIN attendance a ON s.id = a.student_id 
                AND a.class_id = ? AND a.attendance_date = ?
            WHERE s.class_id = ?
            ORDER BY s.full_name
        ");
        $stmt->execute([$classId, $date, $classId]);
        $students = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Lấy thống kê
        $stats = [
            'total' => count($students),
            'present' => 0,
            'absent' => 0,
            'late' => 0,
            'excused' => 0,
            'not_marked' => 0
        ];
        
        foreach ($students as $s) {
            if ($s['status'] === null) {
                $stats['not_marked']++;
            } else {
                $stats[$s['status']]++;
            }
        }
        
        // Lấy thông tin lớp
        $stmt = $pdo->prepare("SELECT class_name FROM classes WHERE id = ?");
        $stmt->execute([$classId]);
        $classInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'class_name' => $classInfo['class_name'] ?? '',
                'date' => $date,
                'students' => $students,
                'stats' => $stats
            ]
        ]);
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $classId = isset($input['class_id']) ? intval($input['class_id']) : 0;
        $teacherId = isset($input['teacher_id']) ? intval($input['teacher_id']) : 0;
        $date = isset($input['date']) ? $input['date'] : date('Y-m-d');
        $attendanceData = isset($input['attendance']) ? $input['attendance'] : [];
        
        if (!$classId || !$teacherId || empty($attendanceData)) {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin điểm danh']);
            exit;
        }
        
        $pdo->beginTransaction();
        
        try {
            $stmt = $pdo->prepare("
                INSERT INTO attendance (student_id, class_id, teacher_id, attendance_date, status, note)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), teacher_id = VALUES(teacher_id)
            ");
            
            foreach ($attendanceData as $record) {
                $stmt->execute([
                    $record['student_id'],
                    $classId,
                    $teacherId,
                    $date,
                    $record['status'],
                    $record['note'] ?? null
                ]);
            }
            
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => 'Đã lưu điểm danh thành công']);
            
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
