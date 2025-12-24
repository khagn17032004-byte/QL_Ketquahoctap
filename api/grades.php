<?php
/**
 * Grades API
 * GET /api/grades.php?student_id=1&semester=1
 * GET /api/grades.php?class_id=1&subject_id=1&semester=1
 * POST /api/grades.php - Save grades
 */

require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Helper: Convert semester number to DB format
function formatSemester($semester) {
    if ($semester === '1' || $semester === 1) return 'HK1';
    if ($semester === '2' || $semester === 2) return 'HK2';
    return $semester; // Already in correct format
}

switch ($method) {
    case 'GET':
        $studentId = $_GET['student_id'] ?? null;
        $classId = $_GET['class_id'] ?? null;
        $subjectId = $_GET['subject_id'] ?? null;
        $semester = isset($_GET['semester']) ? formatSemester($_GET['semester']) : 'HK1';
        $academicYear = $_GET['academic_year'] ?? '2024-2025';
        
        try {
            $db = getDB();
            
            // Get grades for a specific student (for student dashboard)
            if ($studentId && !$classId) {
                $stmt = $db->prepare("
                    SELECT 
                        g.id,
                        g.student_id,
                        g.subject_id,
                        s.subject_name,
                        g.oral_score,
                        g.score_15min as fifteen_min_score,
                        g.score_1hour as one_period_score,
                        g.midterm_score,
                        g.final_score as semester_score,
                        g.average_score,
                        g.semester
                    FROM grades g
                    JOIN subjects s ON g.subject_id = s.id
                    WHERE g.student_id = ? AND g.semester = ? AND g.academic_year = ?
                    ORDER BY s.subject_name
                ");
                $stmt->execute([$studentId, $semester, $academicYear]);
                $grades = $stmt->fetchAll();
                
                jsonResponse(true, $grades);
            }
            
            // Get grades for a class + subject (for teacher dashboard)
            if ($classId && $subjectId) {
                $stmt = $db->prepare("
                    SELECT 
                        g.id as grade_id,
                        st.id as student_id,
                        st.student_code,
                        st.full_name,
                        g.oral_score,
                        g.score_15min as fifteen_min_score,
                        g.score_1hour as one_period_score,
                        g.midterm_score,
                        g.final_score as semester_score,
                        g.average_score
                    FROM students st
                    LEFT JOIN grades g ON st.id = g.student_id 
                        AND g.subject_id = ? 
                        AND g.semester = ?
                        AND g.academic_year = ?
                    WHERE st.class_id = ?
                    ORDER BY st.full_name
                ");
                $stmt->execute([$subjectId, $semester, $academicYear, $classId]);
                $data = $stmt->fetchAll();
                
                jsonResponse(true, $data);
            }
            
            jsonResponse(false, null, 'Thiếu tham số student_id hoặc class_id + subject_id');
            
        } catch (PDOException $e) {
            jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
        }
        break;
        
    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Handle batch save from teacher dashboard
        if (isset($data['grades']) && is_array($data['grades'])) {
            try {
                $db = getDB();
                $academicYear = '2024-2025';
                $savedCount = 0;
                
                foreach ($data['grades'] as $gradeData) {
                    $studentId = $gradeData['student_id'] ?? null;
                    $subjectId = $gradeData['subject_id'] ?? null;
                    $semester = isset($gradeData['semester']) ? formatSemester($gradeData['semester']) : 'HK1';
                    
                    if (!$studentId || !$subjectId) continue;
                    
                    $oralScore = $gradeData['oral_score'] ?? null;
                    $fifteenMin = $gradeData['fifteen_min_score'] ?? null;
                    $onePeriod = $gradeData['one_period_score'] ?? null;
                    $midtermScore = $gradeData['midterm_score'] ?? null;
                    $semesterScore = $gradeData['semester_score'] ?? null;
                    
                    // Calculate average using new formula:
                    // ĐTBmhk = (TĐĐGtx + 2 × ĐĐGgk + 3 × ĐĐGck) / (Số ĐĐGtx + 5)
                    $avgScore = null;
                    $sumTx = 0; // Tổng điểm thường xuyên
                    $countTx = 0; // Số điểm thường xuyên
                    
                    // Điểm thường xuyên (hệ số 1)
                    if ($oralScore !== null) { $sumTx += $oralScore; $countTx++; }
                    if ($fifteenMin !== null) { $sumTx += $fifteenMin; $countTx++; }
                    if ($onePeriod !== null) { $sumTx += $onePeriod; $countTx++; }
                    
                    // Điểm giữa kỳ (hệ số 2) và cuối kỳ (hệ số 3)
                    $midtermPart = ($midtermScore !== null) ? ($midtermScore * 2) : 0;
                    $finalPart = ($semesterScore !== null) ? ($semesterScore * 3) : 0;
                    
                    // Chỉ tính nếu có ít nhất điểm cuối kỳ
                    if ($semesterScore !== null && $countTx > 0) {
                        $divisor = $countTx + 5; // Số ĐĐGtx + 5 (2 cho giữa kỳ + 3 cho cuối kỳ)
                        $avgScore = round(($sumTx + $midtermPart + $finalPart) / $divisor, 2);
                    }
                    
                    // Check if grade exists
                    $stmt = $db->prepare("
                        SELECT id FROM grades 
                        WHERE student_id = ? AND subject_id = ? AND semester = ? AND academic_year = ?
                    ");
                    $stmt->execute([$studentId, $subjectId, $semester, $academicYear]);
                    $existing = $stmt->fetch();
                    
                    if ($existing) {
                        // Update
                        $stmt = $db->prepare("
                            UPDATE grades SET 
                                oral_score = ?, 
                                score_15min = ?, 
                                score_1hour = ?, 
                                midterm_score = ?,
                                final_score = ?,
                                average_score = ?,
                                updated_at = NOW()
                            WHERE id = ?
                        ");
                        $stmt->execute([$oralScore, $fifteenMin, $onePeriod, $midtermScore, $semesterScore, $avgScore, $existing['id']]);
                    } else {
                        // Insert
                        $stmt = $db->prepare("
                            INSERT INTO grades (student_id, subject_id, academic_year, semester, 
                                oral_score, score_15min, score_1hour, midterm_score, final_score, average_score)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");
                        $stmt->execute([$studentId, $subjectId, $academicYear, $semester, 
                            $oralScore, $fifteenMin, $onePeriod, $midtermScore, $semesterScore, $avgScore]);
                    }
                    $savedCount++;
                }
                
                jsonResponse(true, ['saved' => $savedCount], "Đã lưu điểm cho $savedCount học sinh");
                
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
