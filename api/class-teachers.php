<?php
/**
 * API Danh sách giáo viên giảng dạy lớp
 * GET: Lấy danh sách giáo viên dạy các môn của lớp
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
    $stmt = $pdo->prepare("
        SELECT c.*, t.full_name as homeroom_teacher_name, t.department as homeroom_teacher_department
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
    
    // Lấy danh sách giáo viên dạy lớp này (từ bảng class_subjects hoặc teacher_classes)
    // Giả sử có bảng teacher_subjects liên kết giáo viên với môn học
    $stmt = $pdo->prepare("
        SELECT DISTINCT 
            t.id,
            t.teacher_code,
            t.full_name,
            t.department,
            s.subject_name,
            CASE WHEN t.id = ? THEN 1 ELSE 0 END as is_homeroom
        FROM teachers t
        JOIN teacher_subjects ts ON t.id = ts.teacher_id
        JOIN subjects s ON ts.subject_id = s.id
        WHERE EXISTS (
            SELECT 1 FROM grades g 
            JOIN students st ON g.student_id = st.id 
            WHERE st.class_id = ? AND g.subject_id = ts.subject_id
        )
        ORDER BY is_homeroom DESC, s.subject_name ASC
    ");
    $stmt->execute([$classInfo['homeroom_teacher_id'], $classId]);
    $teachers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Nếu không có dữ liệu từ teacher_subjects, trả về GVCN và dữ liệu mẫu
    if (empty($teachers)) {
        // Lấy danh sách môn học có điểm trong lớp
        $stmt = $pdo->prepare("
            SELECT DISTINCT s.id, s.name
            FROM grades g
            JOIN students st ON g.student_id = st.id
            JOIN subjects s ON g.subject_id = s.id
            WHERE st.class_id = ?
            ORDER BY s.name
        ");
        $stmt->execute([$classId]);
        $subjects = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Tạo danh sách với GVCN
        $teachers = [];
        if ($classInfo['homeroom_teacher_name']) {
            $teachers[] = [
                'id' => $classInfo['homeroom_teacher_id'],
                'teacher_code' => 'GVCN',
                'full_name' => $classInfo['homeroom_teacher_name'],
                'phone' => $classInfo['homeroom_teacher_phone'],
                'email' => $classInfo['homeroom_teacher_email'],
                'subject_name' => 'Giáo viên chủ nhiệm',
                'is_homeroom' => 1
            ];
        }
        
        // Thêm các môn học (chưa có thông tin giáo viên cụ thể)
        foreach ($subjects as $subject) {
            $teachers[] = [
                'id' => null,
                'teacher_code' => '-',
                'full_name' => 'Chưa cập nhật',
                'phone' => '-',
                'email' => '-',
                'subject_name' => $subject['name'],
                'is_homeroom' => 0
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'class' => [
                'id' => $classInfo['id'],
                'name' => $classInfo['name'],
                'grade_level' => $classInfo['grade_level'],
                'homeroom_teacher' => $classInfo['homeroom_teacher_name']
            ],
            'teachers' => $teachers
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
