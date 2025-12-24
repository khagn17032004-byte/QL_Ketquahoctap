<?php
/**
 * Database Configuration
 * Kết nối đến MySQL database
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'ql_ketquahoctap');
define('DB_USER', 'root');
define('DB_PASS', ''); // XAMPP mặc định không có password

// Timezone
date_default_timezone_set('Asia/Ho_Chi_Minh');

// Error reporting (tắt khi deploy production)
error_reporting(E_ALL);
ini_set('display_errors', 0); // Tắt display errors để không ảnh hưởng JSON output

/**
 * Tạo kết nối PDO
 */
function getConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Lỗi kết nối database: ' . $e->getMessage()
        ]);
        exit;
    }
}

// Tự động tạo biến $pdo global để các API cũ sử dụng
$pdo = getConnection();

/**
 * Alias for getConnection - used by newer APIs
 */
function getDB() {
    return getConnection();
}

/**
 * Helper function: Trả về JSON response
 * Hỗ trợ 2 cách gọi:
 * - jsonResponse($success, $data, $message) - 3 tham số
 * - jsonResponse($data, $statusCode) - 2 tham số (legacy)
 */
function jsonResponse($successOrData, $dataOrStatus = null, $message = null) {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    
    // New style: jsonResponse(true/false, $data, $message)
    if (is_bool($successOrData)) {
        $response = [
            'success' => $successOrData,
            'data' => $dataOrStatus,
            'message' => $message
        ];
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Legacy style: jsonResponse($data, $statusCode)
    if (is_int($dataOrStatus)) {
        http_response_code($dataOrStatus);
    }
    echo json_encode($successOrData, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Helper function: Lấy dữ liệu JSON từ request body
 */
function getJsonInput() {
    $json = file_get_contents('php://input');
    return json_decode($json, true);
}

/**
 * Helper function: Validate required fields
 */
function validateRequired($data, $fields) {
    $missing = [];
    foreach ($fields as $field) {
        if (!isset($data[$field]) || trim($data[$field]) === '') {
            $missing[] = $field;
        }
    }
    return $missing;
}

/**
 * Helper function: Hash password
 */
function hashPassword($password) {
    return password_hash($password, PASSWORD_DEFAULT);
}

/**
 * Helper function: Verify password
 */
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

/**
 * Helper function: Generate session token
 */
function generateToken() {
    return bin2hex(random_bytes(32));
}
