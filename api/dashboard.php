<?php
/**
 * API Thống kê Dashboard
 * GET /api/dashboard.php?role=admin
 * GET /api/dashboard.php?role=teacher&teacher_id=1
 */

require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['success' => false, 'message' => 'Method not allowed'], 405);
}

try {
    $pdo = getConnection();
    $role = isset($_GET['role']) ? $_GET['role'] : 'admin';
    
    // ========== Admin Dashboard ==========
    if ($role === 'admin') {
        // Tổng số học sinh
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM students");
        $totalStudents = $stmt->fetch()['total'];
        
        // Tổng số giáo viên
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM teachers");
        $totalTeachers = $stmt->fetch()['total'];
        
        // Tổng số lớp
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM classes WHERE academic_year = '2024-2025'");
        $totalClasses = $stmt->fetch()['total'];
        
        // Yêu cầu cập nhật đang chờ
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM update_requests WHERE status = 'pending'");
        $pendingRequests = $stmt->fetch()['total'];
        
        // Tài khoản active/inactive
        $stmt = $pdo->query("
            SELECT status, COUNT(*) as count 
            FROM users 
            GROUP BY status
        ");
        $userStats = $stmt->fetchAll();
        
        // Thống kê theo khối
        $stmt = $pdo->query("
            SELECT c.grade_level, COUNT(s.id) as student_count
            FROM classes c
            LEFT JOIN students s ON s.class_id = c.id
            WHERE c.academic_year = '2024-2025'
            GROUP BY c.grade_level
            ORDER BY c.grade_level DESC
        ");
        $studentsByGrade = $stmt->fetchAll();
        
        jsonResponse([
            'success' => true,
            'data' => [
                'total_students' => $totalStudents,
                'total_teachers' => $totalTeachers,
                'total_classes' => $totalClasses,
                'pending_requests' => $pendingRequests,
                'user_stats' => $userStats,
                'students_by_grade' => $studentsByGrade
            ]
        ]);
    }
    
    // ========== Teacher Dashboard ==========
    if ($role === 'teacher') {
        $teacherId = isset($_GET['teacher_id']) ? (int)$_GET['teacher_id'] : 0;
        
        if (!$teacherId) {
            jsonResponse(['success' => false, 'message' => 'Thiếu teacher_id'], 400);
        }
        
        // Số lớp đang dạy
        $stmt = $pdo->prepare("
            SELECT COUNT(DISTINCT class_id) as total 
            FROM teacher_classes 
            WHERE teacher_id = ? AND academic_year = '2024-2025'
        ");
        $stmt->execute([$teacherId]);
        $totalClasses = $stmt->fetch()['total'];
        
        // Tổng số học sinh đang dạy
        $stmt = $pdo->prepare("
            SELECT COUNT(DISTINCT s.id) as total
            FROM teacher_classes tc
            JOIN students s ON s.class_id = tc.class_id
            WHERE tc.teacher_id = ? AND tc.academic_year = '2024-2025'
        ");
        $stmt->execute([$teacherId]);
        $totalStudents = $stmt->fetch()['total'];
        
        // Số môn đang dạy
        $stmt = $pdo->prepare("
            SELECT COUNT(DISTINCT subject_id) as total 
            FROM teacher_subjects 
            WHERE teacher_id = ?
        ");
        $stmt->execute([$teacherId]);
        $totalSubjects = $stmt->fetch()['total'];
        
        // Điểm đã nhập
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as total FROM grades WHERE graded_by = ?
        ");
        $stmt->execute([$teacherId]);
        $totalGrades = $stmt->fetch()['total'];
        
        jsonResponse([
            'success' => true,
            'data' => [
                'total_classes' => $totalClasses,
                'total_students' => $totalStudents,
                'total_subjects' => $totalSubjects,
                'total_grades_entered' => $totalGrades
            ]
        ]);
    }
    
    jsonResponse(['success' => false, 'message' => 'Role không hợp lệ'], 400);
    
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Lỗi hệ thống: ' . $e->getMessage()
    ], 500);
}
