<?php
/**
 * API Xếp hạng học lực trong lớp
 * GET: Lấy xếp hạng của học sinh trong lớp (HK1, HK2, cả năm)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

try {
    $studentId = isset($_GET['student_id']) ? intval($_GET['student_id']) : 0;
    
    if (!$studentId) {
        echo json_encode(['success' => false, 'message' => 'Thiếu student_id']);
        exit;
    }
    
    // Lấy thông tin học sinh và lớp
    $stmt = $pdo->prepare("SELECT s.*, c.class_name FROM students s JOIN classes c ON s.class_id = c.id WHERE s.id = ?");
    $stmt->execute([$studentId]);
    $student = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$student) {
        echo json_encode(['success' => false, 'message' => 'Không tìm thấy học sinh']);
        exit;
    }
    
    $classId = $student['class_id'];
    
    // Tính điểm trung bình HK1 cho tất cả học sinh trong lớp
    $stmt = $pdo->prepare("
        SELECT 
            s.id as student_id,
            s.full_name,
            s.student_code,
            AVG(g.oral_score * 1 + g.score_15min * 1 + g.score_1hour * 1 + g.midterm_score * 2 + g.final_score * 3) / 
            (CASE WHEN g.oral_score IS NOT NULL THEN 1 ELSE 0 END + 
             CASE WHEN g.score_15min IS NOT NULL THEN 1 ELSE 0 END + 
             CASE WHEN g.score_1hour IS NOT NULL THEN 1 ELSE 0 END + 5) as avg_score
        FROM students s
        LEFT JOIN grades g ON s.id = g.student_id AND g.semester = 'HK1'
        WHERE s.class_id = ?
        GROUP BY s.id
        HAVING avg_score IS NOT NULL
        ORDER BY avg_score DESC
    ");
    $stmt->execute([$classId]);
    $hk1Rankings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Tính điểm trung bình HK2
    $stmt = $pdo->prepare("
        SELECT 
            s.id as student_id,
            s.full_name,
            s.student_code,
            AVG(g.oral_score * 1 + g.score_15min * 1 + g.score_1hour * 1 + g.midterm_score * 2 + g.final_score * 3) / 
            (CASE WHEN g.oral_score IS NOT NULL THEN 1 ELSE 0 END + 
             CASE WHEN g.score_15min IS NOT NULL THEN 1 ELSE 0 END + 
             CASE WHEN g.score_1hour IS NOT NULL THEN 1 ELSE 0 END + 5) as avg_score
        FROM students s
        LEFT JOIN grades g ON s.id = g.student_id AND g.semester = 'HK2'
        WHERE s.class_id = ?
        GROUP BY s.id
        HAVING avg_score IS NOT NULL
        ORDER BY avg_score DESC
    ");
    $stmt->execute([$classId]);
    $hk2Rankings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Tính điểm cả năm (TBM HK1 + TBM HK2 * 2) / 3
    $stmt = $pdo->prepare("
        SELECT 
            s.id as student_id,
            s.full_name,
            s.student_code,
            (
                COALESCE((SELECT AVG((g1.oral_score + g1.score_15min + g1.score_1hour + g1.midterm_score * 2 + g1.final_score * 3) / 
                    (CASE WHEN g1.oral_score IS NOT NULL THEN 1 ELSE 0 END + 
                     CASE WHEN g1.score_15min IS NOT NULL THEN 1 ELSE 0 END + 
                     CASE WHEN g1.score_1hour IS NOT NULL THEN 1 ELSE 0 END + 5))
                FROM grades g1 WHERE g1.student_id = s.id AND g1.semester = 'HK1'), 0) +
                COALESCE((SELECT AVG((g2.oral_score + g2.score_15min + g2.score_1hour + g2.midterm_score * 2 + g2.final_score * 3) / 
                    (CASE WHEN g2.oral_score IS NOT NULL THEN 1 ELSE 0 END + 
                     CASE WHEN g2.score_15min IS NOT NULL THEN 1 ELSE 0 END + 
                     CASE WHEN g2.score_1hour IS NOT NULL THEN 1 ELSE 0 END + 5))
                FROM grades g2 WHERE g2.student_id = s.id AND g2.semester = 'HK2'), 0) * 2
            ) / 3 as avg_score
        FROM students s
        WHERE s.class_id = ?
        ORDER BY avg_score DESC
    ");
    $stmt->execute([$classId]);
    $annualRankings = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Tìm vị trí của học sinh hiện tại
    $totalStudents = count($hk1Rankings);
    
    $findRank = function($rankings, $targetId) {
        foreach ($rankings as $index => $r) {
            if ($r['student_id'] == $targetId) {
                return [
                    'rank' => $index + 1,
                    'avg_score' => round($r['avg_score'], 2)
                ];
            }
        }
        return ['rank' => null, 'avg_score' => null];
    };
    
    $hk1Rank = $findRank($hk1Rankings, $studentId);
    $hk2Rank = $findRank($hk2Rankings, $studentId);
    $annualRank = $findRank($annualRankings, $studentId);
    
    echo json_encode([
        'success' => true,
        'data' => [
            'student' => [
                'id' => $student['id'],
                'name' => $student['full_name'],
                'student_code' => $student['student_code'],
                'class_name' => $student['class_name']
            ],
            'total_students' => $totalStudents,
            'rankings' => [
                'hk1' => $hk1Rank,
                'hk2' => $hk2Rank,
                'annual' => $annualRank
            ],
            'class_rankings' => [
                'hk1' => array_slice($hk1Rankings, 0, 10),
                'hk2' => array_slice($hk2Rankings, 0, 10),
                'annual' => array_slice($annualRankings, 0, 10)
            ]
        ]
    ]);
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}
