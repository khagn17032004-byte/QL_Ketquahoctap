<?php
/**
 * API Lịch Thi (Exam Schedule)
 * Quản lý kỳ thi, lịch thi theo khối, phân công giáo viên gác thi
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

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            $action = $_GET['action'] ?? 'list';
            
            switch ($action) {
                case 'periods':
                    // Lấy danh sách kỳ thi
                    $stmt = $pdo->query("
                        SELECT ep.*, 
                            (SELECT COUNT(*) FROM exam_schedules WHERE exam_period_id = ep.id) as schedule_count
                        FROM exam_periods ep 
                        ORDER BY ep.start_date DESC
                    ");
                    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
                    break;
                    
                case 'schedules':
                    // Lấy lịch thi theo kỳ thi
                    $periodId = $_GET['period_id'] ?? null;
                    $gradeLevel = $_GET['grade_level'] ?? null;
                    
                    $sql = "
                        SELECT es.*, s.subject_name, ep.name as period_name
                        FROM exam_schedules es
                        JOIN subjects s ON es.subject_id = s.id
                        JOIN exam_periods ep ON es.exam_period_id = ep.id
                        WHERE 1=1
                    ";
                    $params = [];
                    
                    if ($periodId) {
                        $sql .= " AND es.exam_period_id = ?";
                        $params[] = $periodId;
                    }
                    if ($gradeLevel) {
                        $sql .= " AND es.grade_level = ?";
                        $params[] = $gradeLevel;
                    }
                    
                    $sql .= " ORDER BY es.exam_date, es.start_time";
                    
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
                    break;
                    
                case 'rooms':
                    // Lấy phòng thi và giáo viên gác thi
                    $scheduleId = $_GET['schedule_id'] ?? null;
                    
                    $sql = "
                        SELECT er.*, c.class_name,
                            GROUP_CONCAT(
                                CONCAT(t.full_name, ' (', ep.role, ')')
                                ORDER BY ep.role DESC
                                SEPARATOR ', '
                            ) as proctors
                        FROM exam_rooms er
                        JOIN classes c ON er.class_id = c.id
                        LEFT JOIN exam_proctors ep ON er.id = ep.exam_room_id
                        LEFT JOIN teachers t ON ep.teacher_id = t.id
                        WHERE er.exam_schedule_id = ?
                        GROUP BY er.id
                        ORDER BY er.room_name
                    ";
                    
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([$scheduleId]);
                    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
                    break;
                    
                case 'teacher_schedule':
                    // Lịch gác thi của giáo viên
                    $teacherId = $_GET['teacher_id'] ?? null;
                    if (!$teacherId) {
                        throw new Exception('Thiếu teacher_id');
                    }
                    
                    $stmt = $pdo->prepare("
                        SELECT es.exam_date, es.start_time, es.end_time, es.grade_level,
                            s.subject_name, ep.name as period_name,
                            er.room_name, c.class_name,
                            epr.role as proctor_role
                        FROM exam_proctors epr
                        JOIN exam_rooms er ON epr.exam_room_id = er.id
                        JOIN exam_schedules es ON er.exam_schedule_id = es.id
                        JOIN exam_periods ep ON es.exam_period_id = ep.id
                        JOIN subjects s ON es.subject_id = s.id
                        JOIN classes c ON er.class_id = c.id
                        WHERE epr.teacher_id = ?
                        ORDER BY es.exam_date, es.start_time
                    ");
                    $stmt->execute([$teacherId]);
                    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
                    break;
                    
                case 'student_schedule':
                    // Lịch thi của học sinh (theo lớp)
                    $studentId = $_GET['student_id'] ?? null;
                    if (!$studentId) {
                        throw new Exception('Thiếu student_id');
                    }
                    
                    // Lấy thông tin lớp của học sinh
                    $stmt = $pdo->prepare("SELECT class_id FROM students WHERE id = ?");
                    $stmt->execute([$studentId]);
                    $student = $stmt->fetch();
                    
                    if (!$student) {
                        throw new Exception('Không tìm thấy học sinh');
                    }
                    
                    // Lấy grade_level từ class
                    $stmt = $pdo->prepare("SELECT grade_level FROM classes WHERE id = ?");
                    $stmt->execute([$student['class_id']]);
                    $class = $stmt->fetch();
                    
                    // Lấy lịch thi theo khối của học sinh
                    $stmt = $pdo->prepare("
                        SELECT es.exam_date, es.start_time, es.end_time,
                            s.subject_name, ep.name as period_name, ep.status,
                            er.room_name,
                            GROUP_CONCAT(t.full_name SEPARATOR ', ') as proctors
                        FROM exam_schedules es
                        JOIN exam_periods ep ON es.exam_period_id = ep.id
                        JOIN subjects s ON es.subject_id = s.id
                        LEFT JOIN exam_rooms er ON er.exam_schedule_id = es.id AND er.class_id = ?
                        LEFT JOIN exam_proctors epr ON epr.exam_room_id = er.id
                        LEFT JOIN teachers t ON epr.teacher_id = t.id
                        WHERE es.grade_level = ? AND ep.status IN ('published', 'completed')
                        GROUP BY es.id, er.id
                        ORDER BY es.exam_date, es.start_time
                    ");
                    $stmt->execute([$student['class_id'], $class['grade_level']]);
                    echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);
                    break;
                    
                case 'check_conflict':
                    // Kiểm tra trùng lịch thi giữa các khối
                    $periodId = $_GET['period_id'] ?? null;
                    $examDate = $_GET['exam_date'] ?? null;
                    $startTime = $_GET['start_time'] ?? null;
                    $gradeLevel = $_GET['grade_level'] ?? null;
                    $excludeId = $_GET['exclude_id'] ?? null;
                    
                    $sql = "
                        SELECT es.*, s.subject_name
                        FROM exam_schedules es
                        JOIN subjects s ON es.subject_id = s.id
                        WHERE es.exam_period_id = ? 
                        AND es.exam_date = ? 
                        AND es.start_time = ?
                        AND es.grade_level != ?
                    ";
                    $params = [$periodId, $examDate, $startTime, $gradeLevel];
                    
                    if ($excludeId) {
                        $sql .= " AND es.id != ?";
                        $params[] = $excludeId;
                    }
                    
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $conflicts = $stmt->fetchAll();
                    
                    echo json_encode([
                        'success' => true, 
                        'has_conflict' => count($conflicts) > 0,
                        'conflicts' => $conflicts
                    ]);
                    break;
                    
                default:
                    throw new Exception('Action không hợp lệ');
            }
            break;
            
        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            $action = $data['action'] ?? 'create';
            
            switch ($action) {
                case 'create_period':
                    // Tạo kỳ thi mới
                    $stmt = $pdo->prepare("
                        INSERT INTO exam_periods (name, semester, school_year, start_date, end_date, status)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    $stmt->execute([
                        $data['name'],
                        $data['semester'],
                        $data['school_year'],
                        $data['start_date'],
                        $data['end_date'],
                        $data['status'] ?? 'draft'
                    ]);
                    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId(), 'message' => 'Đã tạo kỳ thi']);
                    break;
                    
                case 'create_schedule':
                    // Tạo lịch thi cho môn học
                    $stmt = $pdo->prepare("
                        INSERT INTO exam_schedules (exam_period_id, grade_level, subject_id, exam_date, start_time, end_time, exam_type, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    $stmt->execute([
                        $data['exam_period_id'],
                        $data['grade_level'],
                        $data['subject_id'],
                        $data['exam_date'],
                        $data['start_time'],
                        $data['end_time'],
                        $data['exam_type'] ?? 'written',
                        $data['notes'] ?? null
                    ]);
                    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId(), 'message' => 'Đã tạo lịch thi']);
                    break;
                    
                case 'create_room':
                    // Tạo phòng thi
                    $stmt = $pdo->prepare("
                        INSERT INTO exam_rooms (exam_schedule_id, class_id, room_name, seat_count)
                        VALUES (?, ?, ?, ?)
                    ");
                    $stmt->execute([
                        $data['exam_schedule_id'],
                        $data['class_id'],
                        $data['room_name'],
                        $data['seat_count'] ?? 30
                    ]);
                    $roomId = $pdo->lastInsertId();
                    
                    // Phân công 2 giáo viên gác thi
                    if (!empty($data['main_proctor_id'])) {
                        $stmt = $pdo->prepare("INSERT INTO exam_proctors (exam_room_id, teacher_id, role) VALUES (?, ?, 'main')");
                        $stmt->execute([$roomId, $data['main_proctor_id']]);
                    }
                    if (!empty($data['assistant_proctor_id'])) {
                        $stmt = $pdo->prepare("INSERT INTO exam_proctors (exam_room_id, teacher_id, role) VALUES (?, ?, 'assistant')");
                        $stmt->execute([$roomId, $data['assistant_proctor_id']]);
                    }
                    
                    echo json_encode(['success' => true, 'id' => $roomId, 'message' => 'Đã tạo phòng thi']);
                    break;
                    
                case 'auto_assign_rooms':
                    // Tự động tạo phòng thi và phân công giáo viên cho tất cả lớp trong khối
                    $scheduleId = $data['schedule_id'];
                    $gradeLevel = $data['grade_level'];
                    
                    // Lấy tất cả lớp trong khối
                    $stmt = $pdo->prepare("SELECT id, class_name FROM classes WHERE grade_level = ? ORDER BY class_name");
                    $stmt->execute([$gradeLevel]);
                    $classes = $stmt->fetchAll();
                    
                    // Lấy danh sách giáo viên có thể gác thi
                    $stmt = $pdo->query("SELECT id, full_name FROM teachers ORDER BY full_name");
                    $teachers = $stmt->fetchAll();
                    
                    $roomNumber = 101;
                    $teacherIndex = 0;
                    $teacherCount = count($teachers);
                    
                    foreach ($classes as $class) {
                        // Tạo phòng thi
                        $stmt = $pdo->prepare("
                            INSERT INTO exam_rooms (exam_schedule_id, class_id, room_name, seat_count)
                            VALUES (?, ?, ?, 35)
                        ");
                        $stmt->execute([$scheduleId, $class['id'], 'P.' . $roomNumber]);
                        $roomId = $pdo->lastInsertId();
                        
                        // Phân công 2 giáo viên
                        if ($teacherCount >= 2) {
                            $mainTeacher = $teachers[$teacherIndex % $teacherCount];
                            $assistantTeacher = $teachers[($teacherIndex + 1) % $teacherCount];
                            
                            $stmt = $pdo->prepare("INSERT INTO exam_proctors (exam_room_id, teacher_id, role) VALUES (?, ?, 'main')");
                            $stmt->execute([$roomId, $mainTeacher['id']]);
                            
                            $stmt = $pdo->prepare("INSERT INTO exam_proctors (exam_room_id, teacher_id, role) VALUES (?, ?, 'assistant')");
                            $stmt->execute([$roomId, $assistantTeacher['id']]);
                            
                            $teacherIndex += 2;
                        }
                        
                        $roomNumber++;
                    }
                    
                    echo json_encode(['success' => true, 'message' => 'Đã tự động phân công ' . count($classes) . ' phòng thi']);
                    break;
                    
                case 'update_period_status':
                    // Cập nhật trạng thái kỳ thi
                    $stmt = $pdo->prepare("UPDATE exam_periods SET status = ? WHERE id = ?");
                    $stmt->execute([$data['status'], $data['period_id']]);
                    echo json_encode(['success' => true, 'message' => 'Đã cập nhật trạng thái']);
                    break;
                    
                default:
                    throw new Exception('Action không hợp lệ');
            }
            break;
            
        case 'PUT':
            $data = json_decode(file_get_contents('php://input'), true);
            $action = $data['action'] ?? 'update';
            
            switch ($action) {
                case 'update_schedule':
                    $stmt = $pdo->prepare("
                        UPDATE exam_schedules 
                        SET exam_date = ?, start_time = ?, end_time = ?, exam_type = ?, notes = ?
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $data['exam_date'],
                        $data['start_time'],
                        $data['end_time'],
                        $data['exam_type'],
                        $data['notes'],
                        $data['id']
                    ]);
                    echo json_encode(['success' => true, 'message' => 'Đã cập nhật lịch thi']);
                    break;
                    
                case 'update_proctors':
                    // Cập nhật giáo viên gác thi
                    $roomId = $data['room_id'];
                    
                    // Xóa phân công cũ
                    $stmt = $pdo->prepare("DELETE FROM exam_proctors WHERE exam_room_id = ?");
                    $stmt->execute([$roomId]);
                    
                    // Thêm phân công mới
                    if (!empty($data['main_proctor_id'])) {
                        $stmt = $pdo->prepare("INSERT INTO exam_proctors (exam_room_id, teacher_id, role) VALUES (?, ?, 'main')");
                        $stmt->execute([$roomId, $data['main_proctor_id']]);
                    }
                    if (!empty($data['assistant_proctor_id'])) {
                        $stmt = $pdo->prepare("INSERT INTO exam_proctors (exam_room_id, teacher_id, role) VALUES (?, ?, 'assistant')");
                        $stmt->execute([$roomId, $data['assistant_proctor_id']]);
                    }
                    
                    echo json_encode(['success' => true, 'message' => 'Đã cập nhật giáo viên gác thi']);
                    break;
                    
                default:
                    throw new Exception('Action không hợp lệ');
            }
            break;
            
        case 'DELETE':
            $id = $_GET['id'] ?? null;
            $type = $_GET['type'] ?? 'schedule';
            
            switch ($type) {
                case 'period':
                    $stmt = $pdo->prepare("DELETE FROM exam_periods WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true, 'message' => 'Đã xóa kỳ thi']);
                    break;
                    
                case 'schedule':
                    $stmt = $pdo->prepare("DELETE FROM exam_schedules WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true, 'message' => 'Đã xóa lịch thi']);
                    break;
                    
                case 'room':
                    $stmt = $pdo->prepare("DELETE FROM exam_rooms WHERE id = ?");
                    $stmt->execute([$id]);
                    echo json_encode(['success' => true, 'message' => 'Đã xóa phòng thi']);
                    break;
                    
                default:
                    throw new Exception('Type không hợp lệ');
            }
            break;
            
        default:
            throw new Exception('Method không hỗ trợ');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
