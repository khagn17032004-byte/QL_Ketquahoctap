<?php
/**
 * API Đăng nhập
 * POST /api/login.php
 */

require_once 'config.php';

// Chỉ chấp nhận POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
}

// Lấy dữ liệu từ request
$input = getJsonInput();

// Validate input
$missing = validateRequired($input, ['username', 'password']);
if (!empty($missing)) {
    jsonResponse([
        'success' => false,
        'message' => 'Vui lòng nhập đầy đủ thông tin',
        'missing_fields' => $missing
    ], 400);
}

$username = trim($input['username']);
$password = $input['password'];

try {
    $pdo = getConnection();
    
    // Tìm user theo username
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND status = 'active'");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if (!$user) {
        jsonResponse([
            'success' => false,
            'message' => 'Tài khoản không tồn tại hoặc đã bị khóa'
        ], 401);
    }
    
    // Kiểm tra mật khẩu
    if (!verifyPassword($password, $user['password'])) {
        jsonResponse([
            'success' => false,
            'message' => 'Mật khẩu không chính xác'
        ], 401);
    }
    
    // Lấy thông tin chi tiết dựa trên role
    $userInfo = [
        'id' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'email' => $user['email']
    ];
    
    if ($user['role'] === 'student') {
        $stmt = $pdo->prepare("
            SELECT s.*, c.class_name 
            FROM students s 
            LEFT JOIN classes c ON s.class_id = c.id 
            WHERE s.user_id = ?
        ");
        $stmt->execute([$user['id']]);
        $student = $stmt->fetch();
        
        if ($student) {
            $userInfo['student_id'] = $student['id'];
            $userInfo['student_code'] = $student['student_code'];
            $userInfo['full_name'] = $student['full_name'];
            $userInfo['class_name'] = $student['class_name'];
            $userInfo['class_id'] = $student['class_id'];
        }
        
    } elseif ($user['role'] === 'teacher') {
        $stmt = $pdo->prepare("SELECT * FROM teachers WHERE user_id = ?");
        $stmt->execute([$user['id']]);
        $teacher = $stmt->fetch();
        
        if ($teacher) {
            $userInfo['teacher_id'] = $teacher['id'];
            $userInfo['teacher_code'] = $teacher['teacher_code'];
            $userInfo['full_name'] = $teacher['full_name'];
            $userInfo['department'] = $teacher['department'];
        }
        
    } elseif ($user['role'] === 'admin') {
        $userInfo['full_name'] = 'Administrator';
    }
    
    // Tạo token (đơn giản, có thể dùng JWT sau)
    $token = generateToken();
    
    jsonResponse([
        'success' => true,
        'message' => 'Đăng nhập thành công',
        'data' => [
            'user' => $userInfo,
            'token' => $token,
            'loginTime' => date('Y-m-d H:i:s')
        ]
    ]);
    
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Lỗi hệ thống: ' . $e->getMessage()
    ], 500);
}
