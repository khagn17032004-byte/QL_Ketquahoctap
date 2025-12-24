<?php
/**
 * Teacher Info API
 * GET /api/teacher-info.php?user_id=X - Get teacher info with classes and subjects
 */

require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(false, null, 'Method not allowed');
    exit;
}

$userId = $_GET['user_id'] ?? null;
$teacherId = $_GET['teacher_id'] ?? null;

if (!$userId && !$teacherId) {
    jsonResponse(false, null, 'Thiếu user_id hoặc teacher_id');
    exit;
}

try {
    $db = getDB();
    
    // Get teacher info
    if ($userId) {
        $stmt = $db->prepare("SELECT * FROM teachers WHERE user_id = ?");
        $stmt->execute([$userId]);
    } else {
        $stmt = $db->prepare("SELECT * FROM teachers WHERE id = ?");
        $stmt->execute([$teacherId]);
    }
    
    $teacher = $stmt->fetch();
    
    if (!$teacher) {
        jsonResponse(false, null, 'Không tìm thấy giáo viên');
        exit;
    }
    
    // Get subjects this teacher teaches
    $stmt = $db->prepare("
        SELECT DISTINCT s.id, s.subject_code, s.subject_name
        FROM teacher_subjects ts
        JOIN subjects s ON ts.subject_id = s.id
        WHERE ts.teacher_id = ?
        ORDER BY s.subject_name
    ");
    $stmt->execute([$teacher['id']]);
    $subjects = $stmt->fetchAll();
    
    // Get homeroom class (lớp chủ nhiệm)
    $stmt = $db->prepare("
        SELECT c.id, c.class_name, c.grade_level, c.academic_year
        FROM classes c
        WHERE c.homeroom_teacher_id = ?
    ");
    $stmt->execute([$teacher['id']]);
    $homeroomClass = $stmt->fetch();
    
    // Get all classes this teacher teaches
    $stmt = $db->prepare("
        SELECT DISTINCT c.id, c.class_name, c.grade_level, c.academic_year,
               CASE WHEN c.homeroom_teacher_id = ? THEN 1 ELSE 0 END as is_homeroom
        FROM teacher_classes tc
        JOIN classes c ON tc.class_id = c.id
        WHERE tc.teacher_id = ?
        ORDER BY c.grade_level DESC, c.class_name
    ");
    $stmt->execute([$teacher['id'], $teacher['id']]);
    $teachingClasses = $stmt->fetchAll();
    
    // If teacher has homeroom class but not in teaching list, add it
    if ($homeroomClass) {
        $found = false;
        foreach ($teachingClasses as $tc) {
            if ($tc['id'] == $homeroomClass['id']) {
                $found = true;
                break;
            }
        }
        if (!$found) {
            $homeroomClass['is_homeroom'] = 1;
            array_unshift($teachingClasses, $homeroomClass);
        }
    }
    
    jsonResponse(true, [
        'teacher' => $teacher,
        'subjects' => $subjects,
        'homeroom_class' => $homeroomClass,
        'teaching_classes' => $teachingClasses
    ]);
    
} catch (PDOException $e) {
    jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
}
