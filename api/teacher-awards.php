<?php
/**
 * API Khen thưởng, Thi đua Giáo viên
 * GET: Lấy danh sách khen thưởng
 * POST: Thêm khen thưởng mới
 * PUT: Cập nhật
 * DELETE: Xóa
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

try {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'GET') {
        $teacherId = isset($_GET['teacher_id']) ? intval($_GET['teacher_id']) : 0;
        $awardType = isset($_GET['type']) ? $_GET['type'] : '';
        $year = isset($_GET['year']) ? $_GET['year'] : '';
        
        $where = [];
        $params = [];
        
        if ($teacherId) {
            $where[] = "ta.teacher_id = ?";
            $params[] = $teacherId;
        }
        
        if ($awardType) {
            $where[] = "ta.award_type = ?";
            $params[] = $awardType;
        }
        
        if ($year) {
            $where[] = "ta.academic_year = ?";
            $params[] = $year;
        }
        
        $whereClause = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";
        
        $sql = "
            SELECT ta.*, 
                   t.full_name as teacher_name, 
                   t.teacher_code,
                   t.department
            FROM teacher_awards ta
            JOIN teachers t ON ta.teacher_id = t.id
            $whereClause
            ORDER BY ta.award_date DESC, ta.created_at DESC
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $awards = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Thống kê
        $stats = [
            'total' => count($awards),
            'khen_thuong' => 0,
            'thi_dua' => 0,
            'ky_luat' => 0
        ];
        
        foreach ($awards as $a) {
            $stats[$a['award_type']]++;
        }
        
        echo json_encode([
            'success' => true,
            'data' => $awards,
            'stats' => $stats
        ]);
        
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $teacherId = isset($input['teacher_id']) ? intval($input['teacher_id']) : 0;
        $awardType = isset($input['award_type']) ? $input['award_type'] : 'khen_thuong';
        $title = isset($input['title']) ? trim($input['title']) : '';
        $description = isset($input['description']) ? trim($input['description']) : '';
        $awardDate = isset($input['award_date']) ? $input['award_date'] : date('Y-m-d');
        $academicYear = isset($input['academic_year']) ? $input['academic_year'] : '2024-2025';
        $semester = isset($input['semester']) ? intval($input['semester']) : 1;
        $level = isset($input['level']) ? $input['level'] : 'truong';
        $certificateNumber = isset($input['certificate_number']) ? trim($input['certificate_number']) : null;
        $createdBy = isset($input['created_by']) ? intval($input['created_by']) : null;
        
        if (!$teacherId || !$title) {
            echo json_encode(['success' => false, 'message' => 'Thiếu thông tin bắt buộc']);
            exit;
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO teacher_awards 
            (teacher_id, award_type, title, description, award_date, academic_year, semester, level, certificate_number, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $teacherId, $awardType, $title, $description, $awardDate,
            $academicYear, $semester, $level, $certificateNumber, $createdBy
        ]);
        
        $newId = $pdo->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'message' => 'Đã thêm khen thưởng/thi đua',
            'id' => $newId
        ]);
        
    } elseif ($method === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $id = isset($input['id']) ? intval($input['id']) : 0;
        
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID']);
            exit;
        }
        
        $updates = [];
        $params = [];
        
        $allowedFields = ['teacher_id', 'award_type', 'title', 'description', 'award_date', 
                          'academic_year', 'semester', 'level', 'certificate_number'];
        
        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                $updates[] = "$field = ?";
                $params[] = $input[$field];
            }
        }
        
        if (empty($updates)) {
            echo json_encode(['success' => false, 'message' => 'Không có dữ liệu cập nhật']);
            exit;
        }
        
        $params[] = $id;
        $sql = "UPDATE teacher_awards SET " . implode(", ", $updates) . " WHERE id = ?";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        echo json_encode(['success' => true, 'message' => 'Đã cập nhật']);
        
    } elseif ($method === 'DELETE') {
        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        
        if (!$id) {
            echo json_encode(['success' => false, 'message' => 'Thiếu ID']);
            exit;
        }
        
        $stmt = $pdo->prepare("DELETE FROM teacher_awards WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode(['success' => true, 'message' => 'Đã xóa']);
        
    } else {
        echo json_encode(['success' => false, 'message' => 'Method không hợp lệ']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
