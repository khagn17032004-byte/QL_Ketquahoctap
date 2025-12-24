<?php
/**
 * API Môn học
 * GET /api/subjects.php - Lấy tất cả môn học
 * GET /api/subjects.php?teacher_id=1 - Lấy môn của giáo viên
 */

require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
}

try {
    $pdo = getConnection();
    
    // Lấy môn học của giáo viên
    if (isset($_GET['teacher_id'])) {
        $teacherId = (int)$_GET['teacher_id'];
        
        $stmt = $pdo->prepare("
            SELECT s.*
            FROM teacher_subjects ts
            JOIN subjects s ON ts.subject_id = s.id
            WHERE ts.teacher_id = ?
            ORDER BY s.subject_name ASC
        ");
        $stmt->execute([$teacherId]);
        $subjects = $stmt->fetchAll();
        
        jsonResponse([
            'success' => true,
            'data' => $subjects
        ]);
    }
    
    // Lấy tất cả môn học
    $stmt = $pdo->query("SELECT * FROM subjects ORDER BY subject_name ASC");
    $subjects = $stmt->fetchAll();
    
    jsonResponse([
        'success' => true,
        'data' => $subjects
    ]);
    
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Lỗi hệ thống: ' . $e->getMessage()
    ], 500);
}
