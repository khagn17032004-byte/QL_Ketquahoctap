<?php
/**
 * API Lớp học
 * GET /api/classes.php - Lấy tất cả lớp
 * GET /api/classes.php?id=1 - Lấy 1 lớp
 * GET /api/classes.php?grade_level=12 - Lấy theo khối
 * GET /api/classes.php?teacher_id=1 - Lấy lớp của giáo viên
 * POST /api/classes.php - Thêm lớp mới
 * PUT /api/classes.php - Cập nhật lớp
 * DELETE /api/classes.php - Xóa lớp
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Handle POST - Add new class
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $className = $data['class_name'] ?? null;
    $gradeLevel = $data['grade_level'] ?? null;
    $academicYear = $data['academic_year'] ?? '2024-2025';
    $homeroomTeacherId = $data['homeroom_teacher_id'] ?? null;
    $isAdvanced = isset($data['is_advanced']) ? ($data['is_advanced'] ? 1 : 0) : 0;
    
    if (!$className || !$gradeLevel) {
        jsonResponse(false, null, 'Thiếu thông tin bắt buộc (tên lớp, khối)');
        exit;
    }
    
    try {
        $db = getDB();
        
        // Check if class name exists in same academic year
        $stmt = $db->prepare("SELECT id FROM classes WHERE class_name = ? AND academic_year = ?");
        $stmt->execute([$className, $academicYear]);
        if ($stmt->fetch()) {
            jsonResponse(false, null, 'Tên lớp đã tồn tại trong năm học này');
            exit;
        }
        
        // Insert new class
        $stmt = $db->prepare("
            INSERT INTO classes (class_name, grade_level, academic_year, homeroom_teacher_id, is_advanced) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$className, $gradeLevel, $academicYear, $homeroomTeacherId ?: null, $isAdvanced]);
        $classId = $db->lastInsertId();
        
        jsonResponse(true, ['id' => $classId], 'Thêm lớp thành công');
        
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
    }
    exit;
}

// Handle PUT - Update class
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $id = $data['id'] ?? null;
    $className = $data['class_name'] ?? null;
    $gradeLevel = $data['grade_level'] ?? null;
    $homeroomTeacherId = $data['homeroom_teacher_id'] ?? null;
    
    if (!$id) {
        jsonResponse(false, null, 'Thiếu ID lớp');
        exit;
    }
    
    try {
        $db = getDB();
        
        // Check if class exists
        $stmt = $db->prepare("SELECT id, academic_year FROM classes WHERE id = ?");
        $stmt->execute([$id]);
        $class = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$class) {
            jsonResponse(false, null, 'Không tìm thấy lớp');
            exit;
        }
        
        // Check if new class name already exists (if changing name)
        if ($className) {
            $stmt = $db->prepare("SELECT id FROM classes WHERE class_name = ? AND academic_year = ? AND id != ?");
            $stmt->execute([$className, $class['academic_year'], $id]);
            if ($stmt->fetch()) {
                jsonResponse(false, null, 'Tên lớp đã tồn tại');
                exit;
            }
        }
        
        // Build update query
        $updates = [];
        $params = [];
        
        if ($className !== null) {
            $updates[] = "class_name = ?";
            $params[] = $className;
        }
        if ($gradeLevel !== null) {
            $updates[] = "grade_level = ?";
            $params[] = $gradeLevel;
        }
        if (array_key_exists('homeroom_teacher_id', $data)) {
            $updates[] = "homeroom_teacher_id = ?";
            $params[] = $homeroomTeacherId ?: null;
        }
        
        if (!empty($updates)) {
            $params[] = $id;
            $sql = "UPDATE classes SET " . implode(", ", $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }
        
        jsonResponse(true, null, 'Cập nhật lớp thành công');
        
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
    }
    exit;
}

// Handle DELETE - Delete class
if ($method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? null;
    
    if (!$id) {
        jsonResponse(false, null, 'Thiếu ID lớp');
        exit;
    }
    
    try {
        $db = getDB();
        
        // Check if class has students
        $stmt = $db->prepare("SELECT COUNT(*) as count FROM students WHERE class_id = ?");
        $stmt->execute([$id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result['count'] > 0) {
            jsonResponse(false, null, 'Không thể xóa lớp có học sinh. Vui lòng chuyển học sinh sang lớp khác trước.');
            exit;
        }
        
        // Delete class
        $stmt = $db->prepare("DELETE FROM classes WHERE id = ?");
        $stmt->execute([$id]);
        
        jsonResponse(true, null, 'Xóa lớp thành công');
        
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
    }
    exit;
}

if ($method !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
}

try {
    $pdo = getConnection();
    
    // Lấy 1 lớp theo ID
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        
        $stmt = $pdo->prepare("
            SELECT c.*, t.full_name as homeroom_teacher_name,
                   (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count
            FROM classes c
            LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id
            WHERE c.id = ?
        ");
        $stmt->execute([$id]);
        $class = $stmt->fetch();
        
        if (!$class) {
            jsonResponse(['success' => false, 'message' => 'Không tìm thấy lớp'], 404);
        }
        
        jsonResponse(['success' => true, 'data' => $class]);
    }
    
    // Lấy lớp mà giáo viên dạy
    if (isset($_GET['teacher_id'])) {
        $teacherId = (int)$_GET['teacher_id'];
        $academicYear = isset($_GET['academic_year']) ? $_GET['academic_year'] : '2024-2025';
        
        // Lấy cả lớp dạy, lớp chủ nhiệm, và lớp trong lịch dạy
        $stmt = $pdo->prepare("
            SELECT DISTINCT c.id, c.class_name, c.grade_level, c.academic_year, c.homeroom_teacher_id,
                   (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count
            FROM classes c
            WHERE c.academic_year = ? AND (
                c.homeroom_teacher_id = ? OR
                EXISTS (
                    SELECT 1 FROM teacher_classes tc 
                    WHERE tc.class_id = c.id AND tc.teacher_id = ? AND tc.academic_year = ?
                ) OR
                EXISTS (
                    SELECT 1 FROM schedules sc
                    WHERE sc.class_id = c.id AND sc.teacher_id = ?
                )
            )
            ORDER BY c.grade_level DESC, c.class_name ASC
        ");
        $stmt->execute([$academicYear, $teacherId, $teacherId, $academicYear, $teacherId]);
        $classes = $stmt->fetchAll();
        
        jsonResponse([
            'success' => true,
            'data' => $classes,
            'total' => count($classes)
        ]);
    }
    
    // Lọc theo khối
    $gradeLevel = isset($_GET['grade_level']) ? (int)$_GET['grade_level'] : null;
    $academicYear = isset($_GET['academic_year']) ? $_GET['academic_year'] : '2024-2025';
    
    $where = "c.academic_year = ?";
    $params = [$academicYear];
    
    if ($gradeLevel) {
        $where .= " AND c.grade_level = ?";
        $params[] = $gradeLevel;
    }
    
    $stmt = $pdo->prepare("
        SELECT c.*, t.full_name as homeroom_teacher_name,
               (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count
        FROM classes c
        LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id
        WHERE $where
        ORDER BY c.grade_level DESC, c.class_name ASC
    ");
    $stmt->execute($params);
    $classes = $stmt->fetchAll();
    
    jsonResponse([
        'success' => true,
        'data' => $classes,
        'total' => count($classes)
    ]);
    
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Lỗi hệ thống: ' . $e->getMessage()
    ], 500);
}
