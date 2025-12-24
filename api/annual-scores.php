<?php
/**
 * Annual Scores API
 * GET /api/annual-scores.php?class_id=1&subject_id=1 - Get annual scores for a class/subject
 * GET /api/annual-scores.php?student_id=1 - Get all annual scores for a student
 * POST /api/annual-scores.php - Calculate and save annual scores
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Formula: TBM cả năm = (TBM HK1 + TBM HK2 * 2) / 3
function calculateAnnualScore($hk1, $hk2) {
    if ($hk1 === null && $hk2 === null) return null;
    if ($hk1 === null) return $hk2;
    if ($hk2 === null) return $hk1;
    return round(($hk1 + $hk2 * 2) / 3, 2);
}

switch ($method) {
    case 'GET':
        $classId = $_GET['class_id'] ?? null;
        $subjectId = $_GET['subject_id'] ?? null;
        $studentId = $_GET['student_id'] ?? null;
        $academicYear = $_GET['academic_year'] ?? '2024-2025';
        
        try {
            $db = getDB();
            
            // Get annual scores for a student (student dashboard)
            if ($studentId) {
                $stmt = $db->prepare("
                    SELECT 
                        s.id as subject_id,
                        s.subject_name,
                        g1.average_score as hk1_score,
                        g2.average_score as hk2_score,
                        a.annual_score
                    FROM subjects s
                    LEFT JOIN grades g1 ON g1.student_id = ? AND g1.subject_id = s.id 
                        AND g1.semester = 'HK1' AND g1.academic_year = ?
                    LEFT JOIN grades g2 ON g2.student_id = ? AND g2.subject_id = s.id 
                        AND g2.semester = 'HK2' AND g2.academic_year = ?
                    LEFT JOIN annual_scores a ON a.student_id = ? AND a.subject_id = s.id 
                        AND a.academic_year = ?
                    WHERE g1.id IS NOT NULL OR g2.id IS NOT NULL
                    ORDER BY s.subject_name
                ");
                $stmt->execute([$studentId, $academicYear, $studentId, $academicYear, $studentId, $academicYear]);
                $data = $stmt->fetchAll();
                
                // Calculate annual if not saved
                foreach ($data as &$row) {
                    if ($row['annual_score'] === null) {
                        $row['annual_score'] = calculateAnnualScore($row['hk1_score'], $row['hk2_score']);
                    }
                }
                
                // Get conduct for both semesters and annual
                $stmtConduct = $db->prepare("
                    SELECT semester, rating FROM conduct 
                    WHERE student_id = ? AND academic_year = ?
                ");
                $stmtConduct->execute([$studentId, $academicYear]);
                $conductData = $stmtConduct->fetchAll(PDO::FETCH_KEY_PAIR);
                
                // Calculate annual conduct if not exists
                $conductHK1 = $conductData['HK1'] ?? null;
                $conductHK2 = $conductData['HK2'] ?? null;
                $conductCN = $conductData['CN'] ?? null;
                
                // Auto calculate annual conduct based on HK1 and HK2
                if (!$conductCN && $conductHK1 && $conductHK2) {
                    $conductRank = ['Tot' => 4, 'Kha' => 3, 'TB' => 2, 'Yeu' => 1];
                    $conductNames = [4 => 'Tot', 3 => 'Kha', 2 => 'TB', 1 => 'Yeu'];
                    $rank1 = $conductRank[$conductHK1] ?? 2;
                    $rank2 = $conductRank[$conductHK2] ?? 2;
                    $avgRank = round(($rank1 + $rank2 * 2) / 3);
                    $conductCN = $conductNames[$avgRank] ?? 'TB';
                }
                
                jsonResponse(true, [
                    'subjects' => $data,
                    'conduct' => [
                        'hk1' => $conductHK1,
                        'hk2' => $conductHK2,
                        'annual' => $conductCN
                    ]
                ]);
            }
            
            // Get annual scores for a class + subject (teacher dashboard)
            if ($classId && $subjectId) {
                $stmt = $db->prepare("
                    SELECT 
                        st.id as student_id,
                        st.student_code,
                        st.full_name,
                        g1.average_score as hk1_score,
                        g2.average_score as hk2_score,
                        a.annual_score
                    FROM students st
                    LEFT JOIN grades g1 ON st.id = g1.student_id AND g1.subject_id = ? 
                        AND g1.semester = 'HK1' AND g1.academic_year = ?
                    LEFT JOIN grades g2 ON st.id = g2.student_id AND g2.subject_id = ? 
                        AND g2.semester = 'HK2' AND g2.academic_year = ?
                    LEFT JOIN annual_scores a ON st.id = a.student_id AND a.subject_id = ? 
                        AND a.academic_year = ?
                    WHERE st.class_id = ?
                    ORDER BY st.full_name
                ");
                $stmt->execute([$subjectId, $academicYear, $subjectId, $academicYear, $subjectId, $academicYear, $classId]);
                $data = $stmt->fetchAll();
                
                // Calculate annual if not saved
                foreach ($data as &$row) {
                    if ($row['annual_score'] === null && ($row['hk1_score'] !== null || $row['hk2_score'] !== null)) {
                        $row['annual_score'] = calculateAnnualScore($row['hk1_score'], $row['hk2_score']);
                    }
                }
                
                jsonResponse(true, $data);
            }
            
            jsonResponse(false, null, 'Thiếu tham số class_id + subject_id hoặc student_id');
            
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        
        $classId = $data['class_id'] ?? null;
        $subjectId = $data['subject_id'] ?? null;
        $academicYear = $data['academic_year'] ?? '2024-2025';
        
        if (!$classId || !$subjectId) {
            jsonResponse(false, null, 'Thiếu class_id hoặc subject_id');
            break;
        }
        
        try {
            $db = getDB();
            
            // Get all students in class with their HK1 and HK2 scores
            $stmt = $db->prepare("
                SELECT 
                    st.id as student_id,
                    g1.average_score as hk1_score,
                    g2.average_score as hk2_score
                FROM students st
                LEFT JOIN grades g1 ON st.id = g1.student_id AND g1.subject_id = ? 
                    AND g1.semester = 'HK1' AND g1.academic_year = ?
                LEFT JOIN grades g2 ON st.id = g2.student_id AND g2.subject_id = ? 
                    AND g2.semester = 'HK2' AND g2.academic_year = ?
                WHERE st.class_id = ?
            ");
            $stmt->execute([$subjectId, $academicYear, $subjectId, $academicYear, $classId]);
            $students = $stmt->fetchAll();
            
            $savedCount = 0;
            
            foreach ($students as $student) {
                $hk1 = $student['hk1_score'];
                $hk2 = $student['hk2_score'];
                $annual = calculateAnnualScore($hk1, $hk2);
                
                if ($annual === null) continue;
                
                // Upsert annual score
                $stmt = $db->prepare("
                    INSERT INTO annual_scores (student_id, subject_id, academic_year, hk1_score, hk2_score, annual_score)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        hk1_score = VALUES(hk1_score),
                        hk2_score = VALUES(hk2_score),
                        annual_score = VALUES(annual_score),
                        updated_at = NOW()
                ");
                $stmt->execute([$student['student_id'], $subjectId, $academicYear, $hk1, $hk2, $annual]);
                $savedCount++;
            }
            
            jsonResponse(true, ['saved' => $savedCount], "Đã tính và lưu điểm cả năm cho $savedCount học sinh");
            
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
        }
        break;
        
    default:
        jsonResponse(false, null, 'Method không hợp lệ');
}
