<?php
/**
 * API Lấy thông tin học sinh
 * GET /api/students.php?id=1
 * GET /api/students.php?class_id=1
 * GET /api/students.php (tất cả)
 * POST /api/students.php - Thêm học sinh mới
 * PUT /api/students.php - Cập nhật học sinh
 * DELETE /api/students.php - Xóa học sinh
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Handle POST - Add new student
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $studentCode = $data['student_code'] ?? null;
    $fullName = $data['full_name'] ?? null;
    $gender = $data['gender'] ?? 'Nam';
    $dob = $data['date_of_birth'] ?? null;
    $classId = $data['class_id'] ?? null;
    $hometown = $data['hometown'] ?? null;
    $address = $data['address'] ?? null;
    $ethnicity = $data['ethnicity'] ?? 'Kinh';
    $parentName = $data['parent_name'] ?? null;
    $parentPhone = $data['parent_phone'] ?? null;
    $policyObject = $data['policy_object'] ?? null;
    
    if (!$studentCode || !$fullName || !$classId) {
        jsonResponse(false, null, 'Thiếu thông tin bắt buộc (mã HS, họ tên, lớp)');
        exit;
    }
    
    try {
        $db = getDB();
        
        // Check if student code exists
        $stmt = $db->prepare("SELECT id FROM students WHERE student_code = ?");
        $stmt->execute([$studentCode]);
        if ($stmt->fetch()) {
            jsonResponse(false, null, 'Mã học sinh đã tồn tại');
            exit;
        }
        
        // Create user account first
        $username = $studentCode;
        $password = password_hash('password', PASSWORD_DEFAULT);
        
        $stmt = $db->prepare("
            INSERT INTO users (username, password, role, status) 
            VALUES (?, ?, 'student', 'active')
        ");
        $stmt->execute([$username, $password]);
        $userId = $db->lastInsertId();
        
        // Extract birth year from date
        $birthYear = $dob ? date('Y', strtotime($dob)) : null;
        
        // Create student record
        $stmt = $db->prepare("
            INSERT INTO students (user_id, student_code, full_name, gender, birth_date, birth_year, class_id, hometown, address, ethnicity, policy_object, parent_name, parent_phone) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $studentCode, $fullName, $gender, $dob, $birthYear, $classId, $hometown, $address, $ethnicity, $policyObject, $parentName, $parentPhone]);
        $studentId = $db->lastInsertId();
        
        jsonResponse(true, ['id' => $studentId, 'user_id' => $userId], 'Thêm học sinh thành công');
        
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
    }
    exit;
}

// Handle PUT - Update student
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $id = $data['id'] ?? null;
    if (!$id) {
        jsonResponse(false, null, 'Thiếu ID học sinh');
        exit;
    }
    
    try {
        $db = getDB();
        
        $updates = [];
        $params = [];
        
        if (isset($data['full_name'])) {
            $updates[] = "full_name = ?";
            $params[] = $data['full_name'];
        }
        if (isset($data['gender'])) {
            $updates[] = "gender = ?";
            $params[] = $data['gender'];
        }
        if (isset($data['date_of_birth'])) {
            $updates[] = "birth_date = ?";
            $params[] = $data['date_of_birth'];
            $updates[] = "birth_year = ?";
            $params[] = $data['date_of_birth'] ? date('Y', strtotime($data['date_of_birth'])) : null;
        }
        if (isset($data['class_id'])) {
            $updates[] = "class_id = ?";
            $params[] = $data['class_id'];
        }
        if (isset($data['hometown'])) {
            $updates[] = "hometown = ?";
            $params[] = $data['hometown'];
        }
        if (isset($data['address'])) {
            $updates[] = "address = ?";
            $params[] = $data['address'];
        }
        if (isset($data['ethnicity'])) {
            $updates[] = "ethnicity = ?";
            $params[] = $data['ethnicity'];
        }
        if (isset($data['parent_name'])) {
            $updates[] = "parent_name = ?";
            $params[] = $data['parent_name'];
        }
        if (isset($data['parent_phone'])) {
            $updates[] = "parent_phone = ?";
            $params[] = $data['parent_phone'];
        }
        if (array_key_exists('policy_object', $data)) {
            $updates[] = "policy_object = ?";
            $params[] = $data['policy_object'];
        }
        
        if (empty($updates)) {
            jsonResponse(false, null, 'Không có thông tin cần cập nhật');
            exit;
        }
        
        $params[] = $id;
        $stmt = $db->prepare("UPDATE students SET " . implode(', ', $updates) . " WHERE id = ?");
        $stmt->execute($params);
        
        jsonResponse(true, null, 'Cập nhật học sinh thành công');
        
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
    }
    exit;
}

// Handle DELETE - Delete student
if ($method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $id = $data['id'] ?? null;
    if (!$id) {
        jsonResponse(false, null, 'Thiếu ID học sinh');
        exit;
    }
    
    try {
        $db = getDB();
        
        // Get user_id first
        $stmt = $db->prepare("SELECT user_id FROM students WHERE id = ?");
        $stmt->execute([$id]);
        $student = $stmt->fetch();
        
        if (!$student) {
            jsonResponse(false, null, 'Không tìm thấy học sinh');
            exit;
        }
        
        // Delete related records first
        $db->prepare("DELETE FROM grades WHERE student_id = ?")->execute([$id]);
        $db->prepare("DELETE FROM conduct WHERE student_id = ?")->execute([$id]);
        $db->prepare("DELETE FROM annual_scores WHERE student_id = ?")->execute([$id]);
        
        // Delete student
        $db->prepare("DELETE FROM students WHERE id = ?")->execute([$id]);
        
        // Delete user account
        if ($student['user_id']) {
            $db->prepare("DELETE FROM users WHERE id = ?")->execute([$student['user_id']]);
        }
        
        jsonResponse(true, null, 'Xóa học sinh thành công');
        
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
    }
    exit;
}

// Only accept GET request for reading
if ($method !== 'GET') {
    jsonResponse(false, null, 'Method not allowed');
    exit;
}

try {
    $pdo = getConnection();
    
    // Lấy 1 học sinh theo ID
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        
        $stmt = $pdo->prepare("
            SELECT s.*, c.class_name, c.grade_level, u.email, u.phone, u.status
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.id = ?
        ");
        $stmt->execute([$id]);
        $student = $stmt->fetch();
        
        if (!$student) {
            jsonResponse([
                'success' => false,
                'message' => 'Không tìm thấy học sinh'
            ], 404);
        }
        
        jsonResponse([
            'success' => true,
            'data' => $student
        ]);
    }
    
    // Lấy học sinh theo user_id
    if (isset($_GET['user_id'])) {
        $userId = (int)$_GET['user_id'];
        
        $stmt = $pdo->prepare("
            SELECT s.*, c.class_name, c.grade_level, u.email, u.phone, u.status
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE s.user_id = ?
        ");
        $stmt->execute([$userId]);
        $student = $stmt->fetch();
        
        if (!$student) {
            jsonResponse([
                'success' => false,
                'message' => 'Không tìm thấy học sinh'
            ], 404);
        }
        
        jsonResponse([
            'success' => true,
            'data' => $student
        ]);
    }
    
    // Lấy học sinh theo lớp
    if (isset($_GET['class_id'])) {
        $classId = (int)$_GET['class_id'];
        
        $stmt = $pdo->prepare("
            SELECT 
                s.*, 
                c.class_name, 
                c.grade_level,
                ROUND(
                    (COALESCE(AVG(CASE WHEN g.semester = 'HK1' THEN g.average_score END), 0) 
                    + COALESCE(AVG(CASE WHEN g.semester = 'HK2' THEN g.average_score END), 0) * 2) / 3
                , 2) AS dtb
            FROM students s
            LEFT JOIN classes c ON s.class_id = c.id
            LEFT JOIN grades g ON s.id = g.student_id AND g.academic_year = c.academic_year
            WHERE s.class_id = ?
            GROUP BY s.id
            ORDER BY s.full_name ASC
        ");
        $stmt->execute([$classId]);
        $students = $stmt->fetchAll();
        
        jsonResponse([
            'success' => true,
            'data' => $students,
            'total' => count($students)
        ]);
    }
    
    // Lấy tất cả học sinh (có phân trang)
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $export = isset($_GET['export']) && $_GET['export'] === 'all';
    // Nếu export=all thì không giới hạn, còn lại max 200
    $limit = $export ? 10000 : (isset($_GET['limit']) ? min(200, max(1, (int)$_GET['limit'])) : 20);
    $offset = ($page - 1) * $limit;
    
    // Tìm kiếm theo tên hoặc mã
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $gradeLevel = isset($_GET['grade_level']) ? (int)$_GET['grade_level'] : null;
    $classId = isset($_GET['class_id']) ? (int)$_GET['class_id'] : null;
    
    $where = "1=1";
    $params = [];
    
    if ($search) {
        $where .= " AND (s.full_name LIKE ? OR s.student_code LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    
    // Lọc theo đối tượng chính sách
    $policyObject = isset($_GET['policy_object']) ? trim($_GET['policy_object']) : '';
    if ($policyObject) {
        $where .= " AND s.policy_object = ?";
        $params[] = $policyObject;
    }
    
    if ($gradeLevel) {
        $where .= " AND c.grade_level = ?";
        $params[] = $gradeLevel;
    }
    
    if ($classId) {
        $where .= " AND s.class_id = ?";
        $params[] = $classId;
    }
    
    // Đếm tổng số
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) as total 
        FROM students s 
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE $where
    ");
    $countStmt->execute($params);
    $total = $countStmt->fetch()['total'];
    
    // Lấy dữ liệu
    $params[] = $limit;
    $params[] = $offset;
    
    $stmt = $pdo->prepare("
        SELECT s.*, c.class_name, c.grade_level
        FROM students s
        LEFT JOIN classes c ON s.class_id = c.id
        WHERE $where
        ORDER BY c.class_name ASC, s.full_name ASC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($params);
    $students = $stmt->fetchAll();
    
    jsonResponse([
        'success' => true,
        'data' => $students,
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'total_pages' => ceil($total / $limit)
    ]);
    
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Lỗi hệ thống: ' . $e->getMessage()
    ], 500);
}
