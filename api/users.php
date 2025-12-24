<?php
/**
 * API Quản lý người dùng
 * GET /api/users.php - Lấy tất cả users
 * GET /api/users.php?role=student - Lấy theo vai trò
 * POST /api/users.php - Thêm user mới
 */

require_once 'config.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST', 'PUT', 'DELETE'])) {
    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
}

try {
    $pdo = getConnection();
    
    // ========== GET ==========
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        
        // Lấy 1 user theo ID
        if (isset($_GET['id'])) {
            $id = (int)$_GET['id'];
            $stmt = $pdo->prepare("
                SELECT u.id, u.username, u.role, u.email, u.phone, u.status, u.created_at,
                       CASE 
                           WHEN u.role = 'student' THEN s.full_name
                           WHEN u.role = 'teacher' THEN t.full_name
                           ELSE 'Administrator'
                       END as full_name,
                       CASE 
                           WHEN u.role = 'student' THEN s.student_code
                           WHEN u.role = 'teacher' THEN t.teacher_code
                           ELSE 'ADMIN'
                       END as user_code,
                       s.class_id,
                       s.gender as student_gender,
                       s.birth_date as student_birth_date,
                       t.gender as teacher_gender,
                       t.department as teacher_department
                FROM users u
                LEFT JOIN students s ON u.id = s.user_id AND u.role = 'student'
                LEFT JOIN teachers t ON u.id = t.user_id AND u.role = 'teacher'
                WHERE u.id = ?
            ");
            $stmt->execute([$id]);
            $user = $stmt->fetch();
            
            if (!$user) {
                jsonResponse(['success' => false, 'message' => 'Không tìm thấy người dùng'], 404);
            }
            
            jsonResponse(['success' => true, 'data' => $user]);
        }
        
        // Lọc theo vai trò
        $role = isset($_GET['role']) ? $_GET['role'] : null;
        $status = isset($_GET['status']) ? $_GET['status'] : null;
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
        $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 20;
        $offset = ($page - 1) * $limit;
        
        $where = "1=1";
        $params = [];
        
        if ($role) {
            $where .= " AND u.role = ?";
            $params[] = $role;
        }
        
        if ($status) {
            $where .= " AND u.status = ?";
            $params[] = $status;
        }
        
        if ($search) {
            $where .= " AND (u.username LIKE ? OR u.email LIKE ? OR s.full_name LIKE ? OR t.full_name LIKE ? OR s.student_code LIKE ? OR t.teacher_code LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        
        // Count total
        $countStmt = $pdo->prepare("
            SELECT COUNT(*) as total 
            FROM users u
            LEFT JOIN students s ON u.id = s.user_id AND u.role = 'student'
            LEFT JOIN teachers t ON u.id = t.user_id AND u.role = 'teacher'
            WHERE $where
        ");
        $countStmt->execute($params);
        $total = $countStmt->fetch()['total'];
        
        // Add limit/offset to params
        $params[] = $limit;
        $params[] = $offset;
        
        $stmt = $pdo->prepare("
            SELECT u.id, u.username, u.role, u.email, u.phone, u.status, u.created_at,
                   CASE 
                       WHEN u.role = 'student' THEN s.full_name
                       WHEN u.role = 'teacher' THEN t.full_name
                       ELSE 'Administrator'
                   END as full_name,
                   CASE 
                       WHEN u.role = 'student' THEN s.student_code
                       WHEN u.role = 'teacher' THEN t.teacher_code
                       ELSE 'ADMIN'
                   END as user_code
            FROM users u
            LEFT JOIN students s ON u.id = s.user_id AND u.role = 'student'
            LEFT JOIN teachers t ON u.id = t.user_id AND u.role = 'teacher'
            WHERE $where
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute($params);
        $users = $stmt->fetchAll();
        
        jsonResponse([
            'success' => true,
            'data' => $users,
            'total' => $total,
            'page' => $page,
            'limit' => $limit,
            'total_pages' => ceil($total / $limit)
        ]);
    }
    
    // ========== POST: Thêm user mới ==========
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = getJsonInput();
        
        $missing = validateRequired($input, ['username', 'password', 'role']);
        if (!empty($missing)) {
            jsonResponse([
                'success' => false,
                'message' => 'Thiếu thông tin bắt buộc',
                'missing_fields' => $missing
            ], 400);
        }
        
        // Kiểm tra username đã tồn tại chưa
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$input['username']]);
        if ($stmt->fetch()) {
            jsonResponse([
                'success' => false,
                'message' => 'Tài khoản đã tồn tại'
            ], 400);
        }
        
        // Thêm user
        $stmt = $pdo->prepare("
            INSERT INTO users (username, password, role, email, phone, status)
            VALUES (?, ?, ?, ?, ?, 'active')
        ");
        $stmt->execute([
            $input['username'],
            hashPassword($input['password']),
            $input['role'],
            $input['email'] ?? null,
            $input['phone'] ?? null
        ]);
        
        $userId = $pdo->lastInsertId();
        
        // Nếu là học sinh hoặc giáo viên, thêm thông tin chi tiết
        if ($input['role'] === 'student' && isset($input['full_name'])) {
            $stmt = $pdo->prepare("
                INSERT INTO students (user_id, student_code, full_name, gender, birth_year, class_id)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $userId,
                $input['student_code'] ?? $input['username'],
                $input['full_name'],
                $input['gender'] ?? 'Nam',
                $input['birth_year'] ?? null,
                $input['class_id'] ?? null
            ]);
        } elseif ($input['role'] === 'teacher' && isset($input['full_name'])) {
            $stmt = $pdo->prepare("
                INSERT INTO teachers (user_id, teacher_code, full_name, gender, department)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $userId,
                $input['teacher_code'] ?? $input['username'],
                $input['full_name'],
                $input['gender'] ?? 'Nam',
                $input['department'] ?? null
            ]);
        }
        
        jsonResponse([
            'success' => true,
            'message' => 'Thêm người dùng thành công',
            'data' => ['id' => $userId]
        ]);
    }
    
    // ========== PUT: Cập nhật user ==========
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $input = getJsonInput();
        
        if (!isset($input['id'])) {
            jsonResponse(['success' => false, 'message' => 'Thiếu ID'], 400);
        }
        
        $updates = [];
        $params = [];
        
        if (isset($input['email'])) {
            $updates[] = "email = ?";
            $params[] = $input['email'];
        }
        if (isset($input['phone'])) {
            $updates[] = "phone = ?";
            $params[] = $input['phone'];
        }
        if (isset($input['status'])) {
            $updates[] = "status = ?";
            $params[] = $input['status'];
        }
        if (isset($input['password']) && !empty($input['password'])) {
            $updates[] = "password = ?";
            $params[] = hashPassword($input['password']);
        }
        
        if (empty($updates)) {
            jsonResponse(['success' => false, 'message' => 'Không có gì để cập nhật'], 400);
        }
        
        $params[] = $input['id'];
        $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?");
        $stmt->execute($params);
        
        jsonResponse([
            'success' => true,
            'message' => 'Cập nhật thành công'
        ]);
    }
    
    // ========== DELETE ==========
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $input = getJsonInput();
        
        if (!isset($input['id'])) {
            jsonResponse(['success' => false, 'message' => 'Thiếu ID'], 400);
        }
        
        $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
        $stmt->execute([$input['id']]);
        
        jsonResponse([
            'success' => true,
            'message' => 'Xóa người dùng thành công'
        ]);
    }
    
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Lỗi hệ thống: ' . $e->getMessage()
    ], 500);
}
