<?php
/**
 * API Lịch giảng dạy của giáo viên
 * GET: Lấy lịch dạy theo tuần
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

try {
    $teacherId = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : 0;
    
    if (!$teacherId) {
        echo json_encode(['success' => false, 'message' => 'Thiếu teacher_id']);
        exit;
    }
    
    // Lấy thông tin giáo viên
    $stmt = $pdo->prepare("
        SELECT t.*, s.subject_name, s.id as subject_id
        FROM teachers t
        LEFT JOIN teacher_subjects ts ON t.id = ts.teacher_id
        LEFT JOIN subjects s ON ts.subject_id = s.id
        WHERE t.id = ?
        LIMIT 1
    ");
    $stmt->execute([$teacherId]);
    $teacher = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$teacher) {
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy giáo viên']);
        exit;
    }
    
    // Lấy lịch dạy từ bảng schedules (nếu có)
    $schedule = [];
    
    // Kiểm tra bảng schedules có tồn tại không
    try {
        $stmt = $pdo->prepare("
            SELECT sc.day_of_week, sc.period, sc.room,
                   c.class_name, c.id as class_id,
                   s.subject_name
            FROM schedules sc
            JOIN classes c ON sc.class_id = c.id
            JOIN subjects s ON sc.subject_id = s.id
            WHERE sc.teacher_id = ?
            ORDER BY sc.day_of_week, sc.period
        ");
        $stmt->execute([$teacherId]);
        $scheduleData = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($scheduleData as $s) {
            $schedule[$s['day_of_week']][$s['period']] = [
                'class_name' => $s['class_name'],
                'class_id' => $s['class_id'],
                'subject' => $s['subject_name'],
                'room' => $s['room']
            ];
        }
    } catch (Exception $e) {
        // Bảng không tồn tại, dùng teacher_class_assignments
    }
    
    // Nếu không có lịch từ schedules, lấy từ teacher_class_assignments
    if (empty($schedule)) {
        $stmt = $pdo->prepare("
            SELECT tca.class_id, c.class_name, s.subject_name
            FROM teacher_class_assignments tca
            JOIN classes c ON tca.class_id = c.id
            JOIN subjects s ON tca.subject_id = s.id
            WHERE tca.teacher_id = ?
        ");
        $stmt->execute([$teacherId]);
        $assignments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Tạo lịch mẫu từ phân công
        if (!empty($assignments)) {
            $days = [2, 3, 4, 5, 6];
            $periodIdx = 1;
            
            foreach ($assignments as $idx => $a) {
                $day = $days[$idx % 5];
                $period = ($periodIdx % 5) + 1;
                
                $schedule[$day][$period] = [
                    'class_name' => $a['class_name'],
                    'class_id' => $a['class_id'],
                    'subject' => $a['subject_name'],
                    'room' => null
                ];
                
                $periodIdx++;
            }
        }
    }
    
    // Lấy danh sách lớp giáo viên được phân công dạy
    $stmt = $pdo->prepare("
        SELECT DISTINCT c.id, c.class_name as name, c.grade_level,
               CASE WHEN c.homeroom_teacher_id = ? THEN 1 ELSE 0 END as is_homeroom
        FROM teacher_class_assignments tca
        JOIN classes c ON tca.class_id = c.id
        WHERE tca.teacher_id = ?
        UNION
        SELECT c.id, c.class_name as name, c.grade_level, 1 as is_homeroom
        FROM classes c
        WHERE c.homeroom_teacher_id = ?
        ORDER BY is_homeroom DESC, name ASC
    ");
    $stmt->execute([$teacherId, $teacherId, $teacherId]);
    $teachingClasses = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'data' => [
            'teacher' => [
                'id' => $teacher['id'],
                'name' => $teacher['full_name'],
                'subject' => $teacher['subject_name']
            ],
            'schedule' => $schedule,
            'teaching_classes' => $teachingClasses,
            'periods' => [
                1 => ['start' => '07:00', 'end' => '07:45'],
                2 => ['start' => '07:50', 'end' => '08:35'],
                3 => ['start' => '08:50', 'end' => '09:35'],
                4 => ['start' => '09:40', 'end' => '10:25'],
                5 => ['start' => '10:30', 'end' => '11:15'],
                6 => ['start' => '13:30', 'end' => '14:15'],
                7 => ['start' => '14:20', 'end' => '15:05'],
                8 => ['start' => '15:20', 'end' => '16:05'],
                9 => ['start' => '16:10', 'end' => '16:55'],
                10 => ['start' => '17:00', 'end' => '17:45']
            ]
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
