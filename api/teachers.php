<?php
/**
 * API Lấy thông tin giáo viên
 * GET /api/teachers.php?id=1
 * GET /api/teachers.php (tất cả)
 * GET /api/teachers.php?search=name
 * GET /api/teachers.php?subject_id=1
 * POST /api/teachers.php - Thêm giáo viên mới
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Helper function: Get subjects for a teacher
function getTeacherSubjects($pdo, $teacherId) {
    $stmt = $pdo->prepare("
        SELECT s.subject_name 
        FROM teacher_subjects ts
        JOIN subjects s ON ts.subject_id = s.id
        WHERE ts.teacher_id = ?
    ");
    $stmt->execute([$teacherId]);
    $subjects = $stmt->fetchAll(PDO::FETCH_COLUMN);
    return implode(', ', $subjects);
}

// Helper function: Get homeroom class for a teacher
function getHomeroomClass($pdo, $teacherId) {
    $stmt = $pdo->prepare("
        SELECT class_name FROM classes WHERE homeroom_teacher_id = ?
    ");
    $stmt->execute([$teacherId]);
    $result = $stmt->fetch();
    return $result ? $result['class_name'] : null;
}

// Helper function: Get homeroom class ID for a teacher
function getHomeroomClassId($pdo, $teacherId) {
    $stmt = $pdo->prepare("
        SELECT id FROM classes WHERE homeroom_teacher_id = ?
    ");
    $stmt->execute([$teacherId]);
    $result = $stmt->fetch();
    return $result ? $result['id'] : null;
}

// Helper function: Get subject IDs for a teacher
function getTeacherSubjectIds($pdo, $teacherId) {
    $stmt = $pdo->prepare("
        SELECT subject_id FROM teacher_subjects WHERE teacher_id = ?
    ");
    $stmt->execute([$teacherId]);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}

// Handle POST - Add new teacher
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $teacherCode = $data['teacher_code'] ?? null;
    $fullName = $data['full_name'] ?? null;
    $gender = $data['gender'] ?? 'Nam';
    $subjectIds = $data['subject_ids'] ?? []; // Array of subject IDs
    $phone = $data['phone'] ?? null;
    $email = $data['email'] ?? null;
    $birthDate = $data['birth_date'] ?? null;
    $department = $data['department'] ?? null;
    $address = $data['address'] ?? null;
    
    if (!$teacherCode || !$fullName) {
        jsonResponse(false, null, 'Thiếu thông tin bắt buộc (mã GV, họ tên)');
        exit;
    }
    
    try {
        $db = getDB();
        
        // Check if teacher code exists
        $stmt = $db->prepare("SELECT id FROM teachers WHERE teacher_code = ?");
        $stmt->execute([$teacherCode]);
        if ($stmt->fetch()) {
            jsonResponse(false, null, 'Mã giáo viên đã tồn tại');
            exit;
        }
        
        // Create user account first (with phone and email)
        $username = $teacherCode;
        $password = password_hash('password', PASSWORD_DEFAULT);
        
        $stmt = $db->prepare("
            INSERT INTO users (username, password, role, phone, email, status) 
            VALUES (?, ?, 'teacher', ?, ?, 'active')
        ");
        $stmt->execute([$username, $password, $phone, $email]);
        $userId = $db->lastInsertId();
        
        // Create teacher record
        $stmt = $db->prepare("
            INSERT INTO teachers (user_id, teacher_code, full_name, gender, birth_date, department, address) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$userId, $teacherCode, $fullName, $gender, $birthDate, $department, $address]);
        $teacherId = $db->lastInsertId();
        
        // Add teacher subjects
        if (!empty($subjectIds)) {
            $stmtSubject = $db->prepare("INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)");
            foreach ($subjectIds as $subjectId) {
                $stmtSubject->execute([$teacherId, $subjectId]);
            }
        }
        
        jsonResponse(true, ['id' => $teacherId, 'user_id' => $userId], 'Thêm giáo viên thành công');
        
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
    }
    exit;
}

// Handle PUT - Update teacher
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $id = $data['id'] ?? null;
    $fullName = $data['full_name'] ?? null;
    $gender = $data['gender'] ?? null;
    $birthDate = $data['birth_date'] ?? null;
    $address = $data['address'] ?? null;
    $department = $data['department'] ?? null;
    $phone = $data['phone'] ?? null;
    $email = $data['email'] ?? null;
    $subjectIds = $data['subject_ids'] ?? null; // Array of subject IDs
    $homeroomClassId = $data['homeroom_class_id'] ?? null; // ID của lớp chủ nhiệm
    
    if (!$id) {
        jsonResponse(false, null, 'Thiếu ID giáo viên');
        exit;
    }
    
    try {
        $db = getDB();
        
        // Check if teacher exists
        $stmt = $db->prepare("SELECT id, user_id FROM teachers WHERE id = ?");
        $stmt->execute([$id]);
        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$teacher) {
            jsonResponse(false, null, 'Không tìm thấy giáo viên');
            exit;
        }
        
        // Update user phone and email if provided
        if ($phone !== null || $email !== null) {
            $userUpdates = [];
            $userParams = [];
            if ($phone !== null) {
                $userUpdates[] = "phone = ?";
                $userParams[] = $phone ?: null;
            }
            if ($email !== null) {
                $userUpdates[] = "email = ?";
                $userParams[] = $email ?: null;
            }
            if (!empty($userUpdates) && $teacher['user_id']) {
                $userParams[] = $teacher['user_id'];
                $sql = "UPDATE users SET " . implode(", ", $userUpdates) . " WHERE id = ?";
                $stmt = $db->prepare($sql);
                $stmt->execute($userParams);
            }
        }
        
        // Build update query dynamically
        $updates = [];
        $params = [];
        
        if ($fullName !== null) {
            $updates[] = "full_name = ?";
            $params[] = $fullName;
        }
        if ($gender !== null) {
            $updates[] = "gender = ?";
            $params[] = $gender;
        }
        if ($birthDate !== null) {
            $updates[] = "birth_date = ?";
            $params[] = $birthDate ?: null;
        }
        if ($address !== null) {
            $updates[] = "address = ?";
            $params[] = $address;
        }
        if ($department !== null) {
            $updates[] = "department = ?";
            $params[] = $department;
        }
        
        if (!empty($updates)) {
            $params[] = $id;
            $sql = "UPDATE teachers SET " . implode(", ", $updates) . " WHERE id = ?";
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
        }
        
        // Update teacher subjects if provided
        if ($subjectIds !== null) {
            // Delete old subjects
            $stmt = $db->prepare("DELETE FROM teacher_subjects WHERE teacher_id = ?");
            $stmt->execute([$id]);
            
            // Add new subjects
            if (!empty($subjectIds)) {
                $stmtSubject = $db->prepare("INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES (?, ?)");
                foreach ($subjectIds as $subjectId) {
                    $stmtSubject->execute([$id, $subjectId]);
                }
            }
        }
        
        // Update homeroom class if provided
        if ($homeroomClassId !== null) {
            // Remove old homeroom assignment
            $stmt = $db->prepare("UPDATE classes SET homeroom_teacher_id = NULL WHERE homeroom_teacher_id = ?");
            $stmt->execute([$id]);
            
            // Set new homeroom class
            if ($homeroomClassId) {
                $stmt = $db->prepare("UPDATE classes SET homeroom_teacher_id = ? WHERE id = ?");
                $stmt->execute([$id, $homeroomClassId]);
            }
        }
        
        jsonResponse(true, null, 'Cập nhật giáo viên thành công');
        
    } catch (PDOException $e) {
        jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
    }
    exit;
}

// Handle DELETE - Delete teacher
if ($method === 'DELETE') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? null;
    
    if (!$id) {
        jsonResponse(false, null, 'Thiếu ID giáo viên');
        exit;
    }
    
    try {
        $db = getDB();
        
        // Get teacher info
        $stmt = $db->prepare("SELECT user_id FROM teachers WHERE id = ?");
        $stmt->execute([$id]);
        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$teacher) {
            jsonResponse(false, null, 'Không tìm thấy giáo viên');
            exit;
        }
        
        // Remove homeroom assignment
        $stmt = $db->prepare("UPDATE classes SET homeroom_teacher_id = NULL WHERE homeroom_teacher_id = ?");
        $stmt->execute([$id]);
        
        // Delete teacher subjects
        $stmt = $db->prepare("DELETE FROM teacher_subjects WHERE teacher_id = ?");
        $stmt->execute([$id]);
        
        // Delete grades by this teacher
        $stmt = $db->prepare("UPDATE grades SET graded_by = NULL WHERE graded_by = ?");
        $stmt->execute([$id]);
        
        // Delete teacher record
        $stmt = $db->prepare("DELETE FROM teachers WHERE id = ?");
        $stmt->execute([$id]);
        
        // Delete user account
        if ($teacher['user_id']) {
            $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$teacher['user_id']]);
        }
        
        jsonResponse(true, null, 'Xóa giáo viên thành công');
        
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
    
    // Lấy 1 giáo viên theo ID
    if (isset($_GET['id'])) {
        $id = (int)$_GET['id'];
        
        $stmt = $pdo->prepare("
            SELECT t.*, u.email, u.phone, u.status
            FROM teachers t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.id = ?
        ");
        $stmt->execute([$id]);
        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$teacher) {
            jsonResponse([
                'success' => false,
                'message' => 'Không tìm thấy giáo viên'
            ], 404);
        }
        
        // Get subjects and homeroom
        $teacher['subjects'] = getTeacherSubjects($pdo, $id);
        $teacher['subject_ids'] = getTeacherSubjectIds($pdo, $id);
        $teacher['homeroom_class'] = getHomeroomClass($pdo, $id);
        $teacher['homeroom_class_id'] = getHomeroomClassId($pdo, $id);
        
        jsonResponse([
            'success' => true,
            'data' => $teacher
        ]);
    }
    
    // Lấy giáo viên theo user_id
    if (isset($_GET['user_id'])) {
        $userId = (int)$_GET['user_id'];
        
        $stmt = $pdo->prepare("
            SELECT t.*, u.email, u.phone, u.status
            FROM teachers t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.user_id = ?
        ");
        $stmt->execute([$userId]);
        $teacher = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$teacher) {
            jsonResponse([
                'success' => false,
                'message' => 'Không tìm thấy giáo viên'
            ], 404);
        }
        
        // Get subjects and homeroom
        $teacher['subjects'] = getTeacherSubjects($pdo, $teacher['id']);
        $teacher['homeroom_class'] = getHomeroomClass($pdo, $teacher['id']);
        
        jsonResponse([
            'success' => true,
            'data' => $teacher
        ]);
    }
    
    // Lấy tất cả giáo viên
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $subjectId = isset($_GET['subject_id']) ? (int)$_GET['subject_id'] : null;
    
    $where = "1=1";
    $params = [];
    
    if ($search) {
        $where .= " AND (t.full_name LIKE ? OR t.teacher_code LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    
    // If filtering by subject, need to join teacher_subjects
    if ($subjectId) {
        $where .= " AND EXISTS (SELECT 1 FROM teacher_subjects ts WHERE ts.teacher_id = t.id AND ts.subject_id = ?)";
        $params[] = $subjectId;
    }
    
    // Đếm tổng số
    $countStmt = $pdo->prepare("SELECT COUNT(*) as total FROM teachers t WHERE $where");
    $countStmt->execute($params);
    $total = $countStmt->fetch()['total'];
    
    // Lấy dữ liệu
    $stmt = $pdo->prepare("
        SELECT t.*, u.email, u.phone
        FROM teachers t
        LEFT JOIN users u ON t.user_id = u.id
        WHERE $where
        ORDER BY t.full_name ASC
    ");
    $stmt->execute($params);
    $teachers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Add subjects and homeroom for each teacher
    foreach ($teachers as &$teacher) {
        $teacher['subjects'] = getTeacherSubjects($pdo, $teacher['id']);
        $teacher['homeroom_class'] = getHomeroomClass($pdo, $teacher['id']);
    }
    
    jsonResponse([
        'success' => true,
        'data' => $teachers,
        'total' => $total
    ]);
    
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Lỗi hệ thống: ' . $e->getMessage()
    ], 500);
}
