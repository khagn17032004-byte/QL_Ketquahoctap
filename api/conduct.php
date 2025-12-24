<?php
/**
 * Conduct API
 * GET /api/conduct.php?student_id=1
 * GET /api/conduct.php?class_id=1&semester=1
 * POST /api/conduct.php - Save conduct ratings
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Helper: Convert semester number to DB format
function formatSemester($semester) {
    if ($semester === '1' || $semester === 1) return 'HK1';
    if ($semester === '2' || $semester === 2) return 'HK2';
    if ($semester === 'CN' || $semester === 'ca_nam') return 'CN';
    return $semester;
}

// Helper: Convert DB semester to number
function semesterToNumber($semester) {
    if ($semester === 'HK1') return 1;
    if ($semester === 'HK2') return 2;
    return $semester;
}

switch ($method) {
    case 'GET':
        $studentId = $_GET['student_id'] ?? null;
        $classId = $_GET['class_id'] ?? null;
        $semester = isset($_GET['semester']) ? formatSemester($_GET['semester']) : null;
        $academicYear = $_GET['academic_year'] ?? '2024-2025';
        
        try {
            $db = getDB();
            
            // Get conduct for a specific student
            if ($studentId) {
                $sql = "SELECT c.*, t.full_name as rated_by_name 
                        FROM conduct c 
                        LEFT JOIN teachers t ON c.rated_by = t.id 
                        WHERE c.student_id = ? AND c.academic_year = ?";
                $params = [$studentId, $academicYear];
                
                if ($semester) {
                    $sql .= " AND c.semester = ?";
                    $params[] = $semester;
                }
                
                $sql .= " ORDER BY c.semester";
                
                $stmt = $db->prepare($sql);
                $stmt->execute($params);
                $data = $stmt->fetchAll();
                
                // Convert semester format for frontend
                foreach ($data as &$row) {
                    $row['semester'] = semesterToNumber($row['semester']);
                }
                
                jsonResponse(true, $data);
            }
            
            // Get conduct for a class
            if ($classId) {
                $semester = $semester ?: 'HK1';
                
                $stmt = $db->prepare("
                    SELECT st.id as student_id, st.student_code, st.full_name,
                           c.id as conduct_id, c.rating, c.comment
                    FROM students st
                    LEFT JOIN conduct c ON st.id = c.student_id 
                        AND c.semester = ? 
                        AND c.academic_year = ?
                    WHERE st.class_id = ?
                    ORDER BY st.full_name
                ");
                $stmt->execute([$semester, $academicYear, $classId]);
                $data = $stmt->fetchAll();
                
                jsonResponse(true, $data);
            }
            
            jsonResponse(false, null, 'Thiếu tham số student_id hoặc class_id');
            
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Handle batch save from teacher dashboard
        if (isset($data['conduct']) && is_array($data['conduct'])) {
            try {
                $db = getDB();
                $academicYear = '2024-2025';
                $savedCount = 0;
                
                foreach ($data['conduct'] as $conductData) {
                    $studentId = $conductData['student_id'] ?? null;
                    $semester = isset($conductData['semester']) ? formatSemester($conductData['semester']) : 'HK1';
                    $rating = $conductData['rating'] ?? null;
                    $comment = $conductData['comment'] ?? '';
                    
                    if (!$studentId || !$rating) continue;
                    
                    // Validate rating (support both Vietnamese and ASCII)
                    $validRatings = ['Tốt', 'Khá', 'Trung bình', 'Yếu', 'Tot', 'Kha', 'TB', 'Yeu'];
                    if (!in_array($rating, $validRatings)) continue;
                    
                    // Check if exists
                    $stmt = $db->prepare("
                        SELECT id FROM conduct 
                        WHERE student_id = ? AND semester = ? AND academic_year = ?
                    ");
                    $stmt->execute([$studentId, $semester, $academicYear]);
                    $existing = $stmt->fetch();
                    
                    if ($existing) {
                        // Update
                        $stmt = $db->prepare("
                            UPDATE conduct SET rating = ?, comment = ?, updated_at = NOW()
                            WHERE id = ?
                        ");
                        $stmt->execute([$rating, $comment, $existing['id']]);
                    } else {
                        // Insert
                        $stmt = $db->prepare("
                            INSERT INTO conduct (student_id, academic_year, semester, rating, comment)
                            VALUES (?, ?, ?, ?, ?)
                        ");
                        $stmt->execute([$studentId, $academicYear, $semester, $rating, $comment]);
                    }
                    $savedCount++;
                }
                
                jsonResponse(true, ['saved' => $savedCount], "Đã lưu hạnh kiểm cho $savedCount học sinh");
                
            } catch (PDOException $e) {
                jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
            }
        } else {
            jsonResponse(false, null, 'Dữ liệu không hợp lệ');
        }
        break;
        
    default:
        jsonResponse(false, null, 'Method không được hỗ trợ');
}
