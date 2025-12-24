<?php
/**
 * API Thời khóa biểu lớp học
 * GET: Lấy thời khóa biểu của lớp
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
    $classId = isset($_GET['class_id']) ? intval($_GET['class_id']) : 0;
    $studentId = isset($_GET['student_id']) ? intval($_GET['student_id']) : 0;
    
    // Nếu có student_id, lấy class_id từ student
    if ($studentId && !$classId) {
        $stmt = $pdo->prepare("SELECT class_id FROM students WHERE id = ?");
        $stmt->execute([$studentId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($result) {
            $classId = $result['class_id'];
        }
    }
    
    if (!$classId) {
        echo json_encode(['success' => false, 'message' => 'Thiếu class_id hoặc student_id']);
        exit;
    }
    
    // Lấy thông tin lớp
    $stmt = $pdo->prepare("SELECT * FROM classes WHERE id = ?");
    $stmt->execute([$classId]);
    $classInfo = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$classInfo) {
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy lớp']);
        exit;
    }
    
    // Kiểm tra xem có bảng schedules không
    $tableExists = false;
    try {
        $stmt = $pdo->query("SELECT 1 FROM schedules LIMIT 1");
        $tableExists = true;
    } catch (Exception $e) {
        $tableExists = false;
    }
    
    if ($tableExists) {
        // Lấy thời khóa biểu từ database
        $stmt = $pdo->prepare("
            SELECT 
                sc.day_of_week,
                sc.period,
                s.subject_name,
                t.full_name as teacher_name,
                sc.room
            FROM schedules sc
            JOIN subjects s ON sc.subject_id = s.id
            LEFT JOIN teachers t ON sc.teacher_id = t.id
            WHERE sc.class_id = ?
            ORDER BY sc.day_of_week, sc.period
        ");
        $stmt->execute([$classId]);
        $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Chuyển thành dạng ma trận
        $schedule = [];
        foreach ($schedules as $s) {
            $schedule[$s['day_of_week']][$s['period']] = [
                'subject' => $s['subject_name'],
                'teacher' => $s['teacher_name'],
                'room' => $s['room']
            ];
        }
    } else {
        // Trả về thời khóa biểu mẫu
        $schedule = generateSampleSchedule($classInfo['grade_level']);
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'class' => [
                'id' => $classInfo['id'],
                'name' => $classInfo['class_name'],
                'grade_level' => $classInfo['grade_level']
            ],
            'schedule' => $schedule,
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

function generateSampleSchedule($gradeLevel) {
    $subjects = [
        'Toán', 'Ngữ văn', 'Tiếng Anh', 'Vật lý', 'Hóa học', 
        'Sinh học', 'Lịch sử', 'Địa lý', 'GDCD', 'Tin học',
        'Thể dục', 'Công nghệ', 'Quốc phòng'
    ];
    
    $schedule = [];
    $days = [2, 3, 4, 5, 6, 7]; // Thứ 2 đến Thứ 7
    
    foreach ($days as $day) {
        $schedule[$day] = [];
        // Buổi sáng: tiết 1-5
        for ($period = 1; $period <= 5; $period++) {
            $subjectIndex = ($day * 5 + $period) % count($subjects);
            $schedule[$day][$period] = [
                'subject' => $subjects[$subjectIndex],
                'teacher' => null,
                'room' => null
            ];
        }
    }
    
    return $schedule;
}
