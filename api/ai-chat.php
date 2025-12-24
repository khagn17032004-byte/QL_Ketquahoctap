<?php
/**
 * API AI Chat với Google Gemini (MIỄN PHÍ)
 * POST /api/ai-chat.php
 * 
 * Body: { "message": "...", "role": "student|teacher|admin", "context": {...} }
 * 
 * Lấy API key miễn phí tại: https://aistudio.google.com/app/apikey
 */

require_once 'config.php';

// ============ CẤU HÌNH GEMINI API ============
define('GEMINI_API_KEY', 'AIzaSyCuK2AFEUjahvwHyAnhoHhKx-wIVEzRl6M');
define('GEMINI_API_URL', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');

// ============ CẤU HÌNH RATE LIMITING ============
define('RATE_LIMIT_FILE', sys_get_temp_dir() . '/gemini_rate_limit.json');
define('MAX_REQUESTS_PER_MINUTE', 10);  // Tối đa 10 requests/phút
define('MAX_REQUESTS_PER_DAY', 100);    // Tối đa 100 requests/ngày
define('COOLDOWN_SECONDS', 60);          // Chờ 60 giây khi bị rate limit

// Chỉ chấp nhận POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
    exit;
}

// Kiểm tra rate limit trước khi xử lý
$rateLimitCheck = checkRateLimit();
if (!$rateLimitCheck['allowed']) {
    // Nếu bị rate limit, trả về fallback response thay vì lỗi
    $input = json_decode(file_get_contents('php://input'), true);
    $userMessage = trim($input['message'] ?? '');
    $role = $input['role'] ?? 'student';
    $context = $input['context'] ?? [];

    // Kết nối database để lấy dữ liệu thực cho fallback
    $pdo = getConnection();
    $databaseStats = getDatabaseStats($pdo);

    // Lấy ngữ cảnh động cho fallback
    $dynamicContext = getDynamicContext($pdo, $userMessage, $role, $context);

    $fallbackResponse = getSmartFallbackResponse($userMessage, $role, $databaseStats, $context, $pdo, $dynamicContext);
    jsonResponse(true, ['reply' => $fallbackResponse['reply'], 'cached' => true]);
    exit;
}

// Lấy dữ liệu từ request
$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['message'])) {
    jsonResponse(false, null, 'Vui lòng nhập tin nhắn');
    exit;
}

$userMessage = trim($input['message']);
$role = $input['role'] ?? 'student';
$context = $input['context'] ?? [];

// Kết nối database để lấy dữ liệu thực
$pdo = getConnection();

// 62. Lấy dữ liệu thực từ database
$databaseStats = getDatabaseStats($pdo);

// 63. Lấy ngữ cảnh động dựa trên tin nhắn (Tìm học sinh, lớp, môn cụ thể)
$dynamicContext = getDynamicContext($pdo, $userMessage, $role, $context);

// 64. Tạo system prompt dựa trên role + dữ liệu thực + ngữ cảnh động
$systemPrompt = getSystemPrompt($role, $context, $databaseStats, $dynamicContext);

// 65. Gọi Gemini API (với rate limit tracking)
$response = callGeminiAPI($systemPrompt, $userMessage, $role, $databaseStats, $context, $pdo, $dynamicContext);

// Cập nhật rate limit sau khi gọi API thành công
if ($response['success'] && empty($response['is_fallback'])) {
    updateRateLimit();
}

if ($response['success']) {
    jsonResponse(true, ['reply' => $response['reply']]);
} else {
    jsonResponse(false, null, $response['error']);
}
/**
 * Lấy ngữ cảnh động dựa trên từ khóa trong tin nhắn
 * Hỗ trợ tìm: Tên HS, Mã HS, Tên Lớp, Tên Môn
 */
function getDynamicContext($pdo, $message, $role, $userContext = [])
{
    $dynamicData = [];
    $messageLower = mb_strtolower($message, 'UTF-8');

    try {
        // 1. Tìm theo Mã Học Sinh (Dạng HSxxx hoặc 12A1xxx)
        if (preg_match('/[A-Z0-9]{4,10}/i', $message, $matches)) {
            $code = strtoupper($matches[0]);
            $stmt = $pdo->prepare("SELECT s.*, c.class_name FROM students s LEFT JOIN classes c ON s.class_id = c.id WHERE s.student_code = ?");
            $stmt->execute([$code]);
            $student = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($student) {
                $dynamicData['found_student'] = $student;
                // Lấy điểm của học sinh này (Chi tiết)
                $stmtGrades = $pdo->prepare("
                    SELECT sub.subject_name, g.semester, 
                           g.oral_score, g.score_15min, g.score_1hour, g.midterm_score, g.final_score, g.average_score 
                    FROM grades g 
                    JOIN subjects sub ON g.subject_id = sub.id 
                    WHERE g.student_id = ? 
                    ORDER BY g.semester ASC, sub.subject_name ASC
                ");
                $stmtGrades->execute([$student['id']]);
                $dynamicData['student_grades'] = $stmtGrades->fetchAll(PDO::FETCH_ASSOC);

                // Lấy hạnh kiểm
                $stmtConduct = $pdo->prepare("SELECT semester, rating FROM conduct WHERE student_id = ?");
                $stmtConduct->execute([$student['id']]);
                $dynamicData['student_conduct'] = $stmtConduct->fetchAll(PDO::FETCH_ASSOC);
            }
        }

        // 2. Tìm theo Tên Học Sinh (Dạng "Nguyễn Minh Anh")
        if (empty($dynamicData['found_student']) && mb_strlen($message) > 3) {
            // Danh sách từ dừng (Stop words)
            $stopWords = ['điểm', 'của', 'là', 'bao nhiêu', 'xem', 'tìm', 'hộ', 'ai', 'hỏi', 'học sinh', 'hs', 'thế nào', 'về', 'cho', 'biết', 'với', 'kết quả'];
            $cleanMsg = $message;
            foreach ($stopWords as $word) {
                // Sử dụng ranh giới từ hoặc spaces để thay thế chính xác
                $cleanMsg = preg_replace('/(^|\s)(' . preg_quote($word, '/') . ')(\s|$)/ui', ' ', $cleanMsg);
            }

            // Loại bỏ dấu câu và ký tự đặc biệt còn lại
            $cleanMsg = preg_replace('/[^\p{L}\p{N}\s]/u', '', $cleanMsg);
            $cleanMsg = trim(preg_replace('/\s+/', ' ', $cleanMsg));

            if (mb_strlen($cleanMsg) > 2) {
                $searchTerm = '%' . $cleanMsg . '%';
                $stmt = $pdo->prepare("
                    SELECT s.*, c.class_name, u.username 
                    FROM students s 
                    LEFT JOIN classes c ON s.class_id = c.id 
                    LEFT JOIN users u ON s.user_id = u.id
                    WHERE s.full_name LIKE ? 
                       OR s.student_code LIKE ? 
                       OR u.username LIKE ?
                    LIMIT 1
                ");
                $stmt->execute([$searchTerm, $searchTerm, $searchTerm]);
                $student = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($student) {
                    $dynamicData['found_student'] = $student;

                    $stmtGrades = $pdo->prepare("
                        SELECT sub.subject_name, g.semester, 
                               g.oral_score, g.score_15min, g.score_1hour, g.midterm_score, g.final_score, g.average_score 
                        FROM grades g 
                        JOIN subjects sub ON g.subject_id = sub.id 
                        WHERE g.student_id = ? 
                        ORDER BY g.semester ASC, sub.subject_name ASC
                    ");
                    $stmtGrades->execute([$student['id']]);
                    $dynamicData['student_grades'] = $stmtGrades->fetchAll(PDO::FETCH_ASSOC);

                    $stmtConduct = $pdo->prepare("SELECT semester, rating FROM conduct WHERE student_id = ? ORDER BY semester ASC");
                    $stmtConduct->execute([$student['id']]);
                    $dynamicData['student_conduct'] = $stmtConduct->fetchAll(PDO::FETCH_ASSOC);
                }
            }
        }

        // 3. Tìm theo Lớp (Dạng "12A1", "lớp 10A2")
        if (preg_match('/(10|11|12)[A-Z][0-9]*/i', $message, $matches)) {
            $className = strtoupper($matches[0]);
            $stmt = $pdo->prepare("SELECT c.*, t.full_name as head_teacher FROM classes c LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id WHERE c.class_name = ?");
            $stmt->execute([$className]);
            $class = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($class) {
                $dynamicData['found_class'] = $class;
                $stmtStudents = $pdo->prepare("SELECT full_name, student_code FROM students WHERE class_id = ? LIMIT 10");
                $stmtStudents->execute([$class['id']]);
                $dynamicData['class_students'] = $stmtStudents->fetchAll(PDO::FETCH_ASSOC);
            }
        }

        // 4. Tìm kiếm Lịch dạy & Lịch gác thi (Cho Giáo viên)
        $isScheduleQuery = preg_match('/lịch dạy|thời khóa biểu|lịch học|tiết dạy|dạy lớp nào/ui', $message);
        $isExamQuery = preg_match('/gác thi|lịch thi|phòng thi|coi thi/ui', $message);

        if ($isScheduleQuery || $isExamQuery) {
            $teacherId = null;

            // Nếu là giáo viên đang đăng nhập (Ưu tiên)
            if ($role === 'teacher' && !empty($userContext['teacherId'])) {
                $teacherId = $userContext['teacherId'];
            }
            // Hoặc tìm theo tên giáo viên trong tin nhắn
            else {
                $cleanMsg = preg_replace('/lịch dạy|thời khóa biểu|gác thi|lịch thi|coi thi|của|giáo viên|thầy|cô/ui', '', $message);
                $cleanMsg = trim($cleanMsg);
                if (mb_strlen($cleanMsg) > 2) {
                    $stmt = $pdo->prepare("SELECT id, full_name FROM teachers WHERE full_name LIKE ? LIMIT 1");
                    $stmt->execute(['%' . $cleanMsg . '%']);
                    $teacher = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($teacher) {
                        $teacherId = $teacher['id'];
                        $dynamicData['found_teacher'] = $teacher;
                    }
                }
            }

            if ($teacherId) {
                // Lấy lịch dạy (Thời khóa biểu)
                if ($isScheduleQuery) {
                    $stmt = $pdo->prepare("
                        SELECT sc.day_of_week, sc.period, sc.room, c.class_name, s.subject_name
                        FROM schedules sc
                        JOIN classes c ON sc.class_id = c.id
                        JOIN subjects s ON sc.subject_id = s.id
                        WHERE sc.teacher_id = ?
                        ORDER BY sc.day_of_week, sc.period
                    ");
                    $stmt->execute([$teacherId]);
                    $dynamicData['teacher_schedule'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }

                // Lấy lịch gác thi
                if ($isExamQuery) {
                    $stmt = $pdo->prepare("
                        SELECT es.exam_date, es.start_time, es.end_time, s.subject_name, 
                               ep.name as period_name, er.room_name, c.class_name, epr.role as proctor_role
                        FROM exam_proctors epr
                        JOIN exam_rooms er ON epr.exam_room_id = er.id
                        JOIN exam_schedules es ON er.exam_schedule_id = es.id
                        JOIN exam_periods ep ON es.exam_period_id = ep.id
                        JOIN subjects s ON es.subject_id = s.id
                        JOIN classes c ON er.class_id = c.id
                        WHERE epr.teacher_id = ?
                        ORDER BY es.exam_date, es.start_time
                    ");
                    $stmt->execute([$teacherId]);
                    $dynamicData['teacher_exam_schedule'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }
            }
        }

        // 5. Tìm kiếm cho HỌC SINH (Điểm, Xếp hạng, Lịch thi, TKB)
        $isGradesQuery = preg_match('/điểm|kết quả|bảng điểm|học lực|học tập|miệng|15p|15 phút|1 tiết|giữa kỳ|cuối kỳ|tbm|học kỳ|điểm thi/ui', $message);
        $isRankingQuery = preg_match('/xếp hạng|hạng mấy|thứ mấy|vị trí|đứng thứ|rank/ui', $message);
        $isStudentScheduleQuery = preg_match('/thời khóa biểu|lịch học|tiết học|hôm nay học gì|tkb/ui', $message);
        $isStudentExamQuery = preg_match('/lịch thi|phòng thi|thi môn gì|thi lúc nào|khi nào thi/ui', $message);

        if ($role === 'student' && ($isGradesQuery || $isRankingQuery || $isStudentScheduleQuery || $isStudentExamQuery)) {
            $studentId = $userContext['studentId'] ?? $userContext['student_id'] ?? null;
            $classId = $userContext['classId'] ?? $userContext['class_id'] ?? null;

            if ($studentId) {
                // Lấy điểm (nếu chưa lấy chi tiết)
                if ($isGradesQuery) {
                    $stmtGrades = $pdo->prepare("
                        SELECT sub.subject_name, g.semester, 
                               g.oral_score, g.score_15min, g.score_1hour, g.midterm_score, g.final_score, g.average_score 
                        FROM grades g 
                        JOIN subjects sub ON g.subject_id = sub.id 
                        WHERE g.student_id = ? 
                        ORDER BY g.semester ASC, sub.subject_name ASC
                    ");
                    $stmtGrades->execute([$studentId]);
                    $grades = $stmtGrades->fetchAll(PDO::FETCH_ASSOC);
                    if (!empty($grades)) {
                        $dynamicData['student_grades'] = $grades;
                    }
                }

                // Lấy Xếp hạng (Tính ĐTB HK1 hoặc HK2 gần nhất)
                if ($isRankingQuery) {
                    // Xác định kỳ gần nhất có điểm
                    $stmtSemester = $pdo->prepare("SELECT semester FROM grades WHERE student_id = ? ORDER BY academic_year DESC, semester DESC LIMIT 1");
                    $stmtSemester->execute([$studentId]);
                    $latestSemester = $stmtSemester->fetchColumn() ?: 'HK1';

                    $stmtRank = $pdo->prepare("
                        SELECT avg_score, 
                               (SELECT COUNT(*) + 1 FROM (
                                   SELECT s2.id, AVG(g2.average_score) as a_score
                                   FROM students s2
                                   JOIN grades g2 ON s2.id = g2.student_id
                                   WHERE s2.class_id = (SELECT class_id FROM students WHERE id = ?)
                                   AND g2.semester = ?
                                   GROUP BY s2.id
                               ) as ranking_table WHERE a_score > current_student.avg_score) as rank_pos,
                               ? as semester_name
                        FROM (
                            SELECT AVG(average_score) as avg_score
                            FROM grades
                            WHERE student_id = ? AND semester = ?
                        ) as current_student
                    ");
                    $stmtRank->execute([$studentId, $latestSemester, $latestSemester, $studentId, $latestSemester]);
                    $rankingData = $stmtRank->fetch(PDO::FETCH_ASSOC);

                    if ($rankingData && $rankingData['avg_score'] !== null) {
                        $dynamicData['student_ranking'] = [
                            'rank' => $rankingData['rank_pos'],
                            'avg_score' => round($rankingData['avg_score'], 2),
                            'semester' => $rankingData['semester_name']
                        ];
                    }
                }

                // Lịch thi
                if ($isStudentExamQuery) {
                    $stmt = $pdo->prepare("
                        SELECT es.exam_date, es.start_time, es.end_time,
                               s.subject_name, ep.name as period_name,
                               er.room_name
                        FROM exam_schedules es
                        JOIN exam_periods ep ON es.exam_period_id = ep.id
                        JOIN subjects s ON es.subject_id = s.id
                        LEFT JOIN exam_rooms er ON er.exam_schedule_id = es.id AND er.class_id = ?
                        WHERE es.grade_level = (SELECT grade_level FROM classes WHERE id = ?)
                        AND ep.status IN ('published', 'completed')
                        ORDER BY es.exam_date, es.start_time
                    ");
                    $stmt->execute([$classId, $classId]);
                    $dynamicData['student_exam_schedule'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }

                // Thời khóa biểu
                if ($isStudentScheduleQuery) {
                    $stmt = $pdo->prepare("
                        SELECT sc.day_of_week, sc.period, sc.room, s.subject_name, t.full_name as teacher_name
                        FROM schedules sc
                        JOIN subjects s ON sc.subject_id = s.id
                        LEFT JOIN teachers t ON sc.teacher_id = t.id
                        WHERE sc.class_id = ?
                        ORDER BY sc.day_of_week, sc.period
                    ");
                    $stmt->execute([$classId]);
                    $dynamicData['student_timetable'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
                }
            }
        }

    } catch (Exception $e) {
        error_log("Dynamic Context Error: " . $e->getMessage());
    }

    return $dynamicData;
}
/**
 * Kiểm tra rate limit
 */
function checkRateLimit()
{
    $data = getRateLimitData();
    $now = time();
    $currentMinute = floor($now / 60);
    $currentDay = date('Y-m-d');

    // Reset minute counter nếu phút mới
    if (($data['last_minute'] ?? 0) !== $currentMinute) {
        $data['minute_count'] = 0;
        $data['last_minute'] = $currentMinute;
    }

    // Reset day counter nếu ngày mới
    if (($data['last_day'] ?? '') !== $currentDay) {
        $data['day_count'] = 0;
        $data['last_day'] = $currentDay;
    }

    // Kiểm tra cooldown
    if (isset($data['cooldown_until']) && $now < $data['cooldown_until']) {
        $waitTime = $data['cooldown_until'] - $now;
        return ['allowed' => false, 'reason' => "Vui lòng chờ {$waitTime} giây"];
    }

    // Kiểm tra giới hạn phút
    if (($data['minute_count'] ?? 0) >= MAX_REQUESTS_PER_MINUTE) {
        return ['allowed' => false, 'reason' => 'Đã vượt giới hạn requests/phút'];
    }

    // Kiểm tra giới hạn ngày
    if (($data['day_count'] ?? 0) >= MAX_REQUESTS_PER_DAY) {
        return ['allowed' => false, 'reason' => 'Đã vượt giới hạn requests/ngày'];
    }

    saveRateLimitData($data);
    return ['allowed' => true];
}

/**
 * Cập nhật rate limit sau khi gọi API
 */
function updateRateLimit()
{
    $data = getRateLimitData();
    $now = time();
    $currentMinute = floor($now / 60);
    $currentDay = date('Y-m-d');

    // Reset nếu cần
    if (($data['last_minute'] ?? 0) !== $currentMinute) {
        $data['minute_count'] = 0;
        $data['last_minute'] = $currentMinute;
    }
    if (($data['last_day'] ?? '') !== $currentDay) {
        $data['day_count'] = 0;
        $data['last_day'] = $currentDay;
    }

    $data['minute_count'] = ($data['minute_count'] ?? 0) + 1;
    $data['day_count'] = ($data['day_count'] ?? 0) + 1;
    $data['last_request'] = $now;

    saveRateLimitData($data);
}

/**
 * Đặt cooldown khi bị 429
 */
function setCooldown()
{
    $data = getRateLimitData();
    $data['cooldown_until'] = time() + COOLDOWN_SECONDS;
    saveRateLimitData($data);
}

/**
 * Đọc dữ liệu rate limit từ file
 */
function getRateLimitData()
{
    if (file_exists(RATE_LIMIT_FILE)) {
        $content = file_get_contents(RATE_LIMIT_FILE);
        return json_decode($content, true) ?: [];
    }
    return [];
}

/**
 * Lưu dữ liệu rate limit vào file
 */
function saveRateLimitData($data)
{
    file_put_contents(RATE_LIMIT_FILE, json_encode($data));
}

/**
 * Lấy thống kê lớp chủ nhiệm cho giáo viên
 */
function getHomeroomClassStats($pdo, $classId)
{
    if (!$classId)
        return null;

    $stats = [];

    try {
        // Thông tin lớp
        $stmt = $pdo->prepare("SELECT c.*, t.full_name as teacher_name 
                               FROM classes c 
                               LEFT JOIN teachers t ON c.homeroom_teacher_id = t.id 
                               WHERE c.id = ?");
        $stmt->execute([$classId]);
        $stats['class_info'] = $stmt->fetch(PDO::FETCH_ASSOC);

        // Tổng số học sinh trong lớp
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM students WHERE class_id = ?");
        $stmt->execute([$classId]);
        $stats['total_students'] = (int) $stmt->fetchColumn();

        // Học sinh theo giới tính
        $stmt = $pdo->prepare("SELECT gender, COUNT(*) as count FROM students WHERE class_id = ? GROUP BY gender");
        $stmt->execute([$classId]);
        $genderStats = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $stats['students_by_gender'] = [];
        foreach ($genderStats as $g) {
            $stats['students_by_gender'][$g['gender']] = $g['count'];
        }

        // Điểm trung bình của lớp
        $stmt = $pdo->prepare("
            SELECT AVG(g.average_score) as class_avg
            FROM grades g
            JOIN students s ON g.student_id = s.id
            WHERE s.class_id = ? AND g.average_score IS NOT NULL
        ");
        $stmt->execute([$classId]);
        $avgResult = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['class_average'] = $avgResult['class_avg'] ? round($avgResult['class_avg'], 2) : null;

        // Xếp loại học lực
        $stmt = $pdo->prepare("
            SELECT 
                CASE 
                    WHEN AVG(g.average_score) >= 8.0 THEN 'Giỏi'
                    WHEN AVG(g.average_score) >= 6.5 THEN 'Khá'
                    WHEN AVG(g.average_score) >= 5.0 THEN 'Trung bình'
                    WHEN AVG(g.average_score) >= 3.5 THEN 'Yếu'
                    ELSE 'Kém'
                END as academic_level,
                COUNT(*) as count
            FROM (
                SELECT s.id, AVG(g.average_score) as avg_score
                FROM students s
                LEFT JOIN grades g ON s.id = g.student_id
                WHERE s.class_id = ?
                GROUP BY s.id
                HAVING avg_score IS NOT NULL
            ) as student_avgs
            GROUP BY academic_level
        ");
        $stmt->execute([$classId]);
        $stats['academic_levels'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Hạnh kiểm
        $stmt = $pdo->prepare("
            SELECT 
                COALESCE(c.conduct_hk1, 'Chưa đánh giá') as conduct,
                COUNT(*) as count
            FROM students s
            LEFT JOIN conduct c ON s.id = c.student_id
            WHERE s.class_id = ?
            GROUP BY conduct
        ");
        $stmt->execute([$classId]);
        $stats['conduct'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Top 5 học sinh điểm cao nhất
        $stmt = $pdo->prepare("
            SELECT s.full_name, s.student_code, ROUND(AVG(g.average_score), 2) as avg_score
            FROM students s
            JOIN grades g ON s.id = g.student_id
            WHERE s.class_id = ?
            GROUP BY s.id
            HAVING avg_score IS NOT NULL
            ORDER BY avg_score DESC
            LIMIT 5
        ");
        $stmt->execute([$classId]);
        $stats['top_students'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Học sinh cần quan tâm (điểm < 5.0)
        $stmt = $pdo->prepare("
            SELECT s.full_name, s.student_code, ROUND(AVG(g.average_score), 2) as avg_score
            FROM students s
            JOIN grades g ON s.id = g.student_id
            WHERE s.class_id = ?
            GROUP BY s.id
            HAVING avg_score < 5.0
            ORDER BY avg_score ASC
            LIMIT 5
        ");
        $stmt->execute([$classId]);
        $stats['weak_students'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    } catch (Exception $e) {
        error_log("Error getting homeroom stats: " . $e->getMessage());
    }

    return $stats;
}

/**
 * Smart Fallback Response với dữ liệu database - PHÂN QUYỀN THEO ROLE
 * - Student: Chỉ xem thông tin cá nhân (điểm, lớp của mình)
 * - Teacher: Xem thông tin lớp dạy, học sinh trong lớp
 * - Admin: Xem toàn bộ thống kê hệ thống
 */
function getSmartFallbackResponse($message, $role, $databaseStats, $context = [], $pdo = null, $dynamicContext = [])
{
    $message = mb_strtolower($message, 'UTF-8');

    // ƯU TIÊN 0: TRƯỜNG HỢP PHÂN TÍCH AI (Từ button "Phân tích AI")
    if ($role === 'student' && !empty($context['type']) && $context['type'] === 'analysis') {
        return getStudentResponse($message, $databaseStats, $context, $dynamicContext);
    }

    // ƯU TIÊN TUYỆT ĐỐI: Truy vấn điểm số cụ thể cho học sinh
    if ($role === 'student' && preg_match('/miệng|mieng|15p|15 phút|15 phut|1 tiết|1 tiet|giữa kỳ|giua ky|cuối kỳ|cuoi ky|tbm|cả năm|ca nam|suốt năm|suot nam|hệ số|he so|học kỳ|hoc ky|điểm thi|diem thi/ui', $message)) {
        return getStudentGradesResponse($dynamicContext, $message);
    }

    // ƯU TIÊN 1: Nếu tìm thấy thực thể cụ thể (Học sinh/Lớp/Lịch) từ tin nhắn
    if (!empty($dynamicContext)) {
        if (!empty($dynamicContext['found_student'])) {
            return getStudentDetailResponse($dynamicContext);
        }
        if (!empty($dynamicContext['found_class'])) {
            return getClassDetailResponse($dynamicContext);
        }
        if (!empty($dynamicContext['teacher_schedule'])) {
            return getTeacherScheduleResponse($dynamicContext);
        }
        if (!empty($dynamicContext['teacher_exam_schedule'])) {
            return getTeacherExamResponse($dynamicContext);
        }

        if (!empty($dynamicContext['student_ranking'])) {
            return getStudentRankingResponse($dynamicContext);
        }
        if (!empty($dynamicContext['student_exam_schedule'])) {
            return getStudentExamResponse($dynamicContext);
        }
        if (!empty($dynamicContext['student_timetable'])) {
            return getStudentTimetableResponse($dynamicContext);
        }
        if ($role === 'student' && !empty($dynamicContext['student_grades'])) {
            // Đã xử lý ở trên qua regex, phần này là fallback cho trường hợp student_grades có sẵn
            if (empty($dynamicContext['found_student'])) {
                // Nếu chỉ hỏi "điểm" chung chung, let common logic handle or show summary
            }
        }
    }

    // =============== STUDENT - CHỈ XEM THÔNG TIN CÁ NHÂN ===============
    if ($role === 'student') {
        return getStudentResponse($message, $databaseStats, $context, $dynamicContext);
    }

    // =============== TEACHER - XEM THÔNG TIN LỚP CHỦ NHIỆM ===============
    if ($role === 'teacher') {
        $homeroomStats = null;
        if ($pdo && !empty($context['homeroomClassId'])) {
            $homeroomStats = getHomeroomClassStats($pdo, $context['homeroomClassId']);
        }
        return getTeacherResponse($message, $databaseStats, $context, $homeroomStats);
    }

    // =============== ADMIN - TOÀN QUYỀN ===============
    return getAdminResponse($message, $databaseStats);
}

/**
 * Trả về chi tiết học sinh từ dynamic context
 */
function getStudentDetailResponse($dynamicContext)
{
    if (empty($dynamicContext['found_student']))
        return ['success' => false, 'reply' => 'Không tìm thấy học sinh.'];

    $s = $dynamicContext['found_student'];
    $reply = "👤 **Thông tin học sinh:**\n\n";
    $reply .= "• **Họ tên:** {$s['full_name']}\n";
    $reply .= "• **Mã học sinh:** `{$s['student_code']}`\n";
    $reply .= "• **Lớp:** " . ($s['class_name'] ?: 'Chưa phân lớp') . "\n";

    if (!empty($dynamicContext['student_grades'])) {
        $reply .= "\n📊 **Bảng điểm (ĐTB môn):**\n";
        foreach ($dynamicContext['student_grades'] as $g) {
            $reply .= "• {$g['subject_name']} ({$g['semester']}): **{$g['average_score']}**\n";
        }
    } else {
        $reply .= "\n❌ Hệ thống chưa ghi nhận điểm của học sinh này.";
    }

    if (!empty($dynamicContext['student_conduct'])) {
        $reply .= "\n📋 **Hạnh kiểm:**\n";
        foreach ($dynamicContext['student_conduct'] as $c) {
            $reply .= "• {$c['semester']}: **{$c['rating']}**\n";
        }
    }

    $reply .= "\n💡 Thầy/Cô có thể xem chi tiết bảng điểm trong hồ sơ học sinh.";

    return ['success' => true, 'reply' => $reply];
}

/**
 * Trả về chi tiết các loại điểm của học sinh (Miệng, 15p, 1 tiết, ...)
 */
function getStudentGradesResponse($dynamicContext, $message)
{
    if (empty($dynamicContext['student_grades'])) {
        return ['success' => true, 'reply' => 'Hiện tại mình chưa thấy dữ liệu điểm của bạn trên hệ thống. Bạn vui lòng kiểm tra lại hoặc liên hệ quản trị viên nhé!'];
    }

    $grades = $dynamicContext['student_grades'];
    $type = 'average_score'; // Default
    $typeName = 'Điểm trung bình môn';

    if (preg_match('/miệng|mieng/ui', $message)) {
        $type = 'oral_score';
        $typeName = 'Điểm Miệng';
    } elseif (preg_match('/15p|15 phút|15 phut/ui', $message)) {
        $type = 'score_15min';
        $typeName = 'Điểm 15 phút';
    } elseif (preg_match('/1 tiết|1 tiet|1t|hệ số 2|he so 2/ui', $message)) {
        $type = 'score_1hour';
        $typeName = 'Điểm 1 tiết (Hệ số 2)';
    } elseif (preg_match('/giữa kỳ|giua ky/ui', $message)) {
        $type = 'midterm_score';
        $typeName = 'Điểm Giữa kỳ';
    } elseif (preg_match('/cuối kỳ|cuoi ky|học kỳ|hoc ky|điểm thi|diem thi|thi/ui', $message)) {
        $type = 'final_score';
        $typeName = 'Điểm Thi Học kỳ';
    } elseif (preg_match('/tbm|trung bình|trung binh/ui', $message)) {
        $type = 'average_score';
        $typeName = 'Điểm Trung bình môn';
    }

    $reply = "";
    $hasData = false;
    $isYearly = preg_match('/cả năm|ca nam|suốt năm|suot nam|tbm cn/ui', $message);
    if ($isYearly) {
        $typeName = 'Điểm Trung bình môn Cả năm';
        $reply = "📊 **Kết quả {$typeName} của bạn:**\n\n";

        // Group by subject to calculate average
        $bySubject = [];
        foreach ($grades as $g) {
            $bySubject[$g['subject_name']][$g['semester']] = $g['average_score'];
        }

        foreach ($bySubject as $sub => $semData) {
            $hk1 = isset($semData['HK1']) ? floatval($semData['HK1']) : null;
            $hk2 = isset($semData['HK2']) ? floatval($semData['HK2']) : null;

            if ($hk1 !== null && $hk2 !== null) {
                $cn = round(($hk1 + $hk2 * 2) / 3, 2);
                $reply .= "• {$sub}: **{$cn}** (HK1: {$hk1}, HK2: {$hk2})\n";
                $hasData = true;
            } elseif ($hk1 !== null || $hk2 !== null) {
                $status = ($hk1 === null) ? "Thiếu HK1" : "Thiếu HK2";
                $reply .= "• {$sub}: (Chưa tính được - {$status})\n";
            }
        }
    } else {
        $reply = "📊 **Kết quả {$typeName} của bạn:**\n\n";
        // Phân nhóm theo học kỳ
        $bySemester = [];
        foreach ($grades as $g) {
            $sem = $g['semester'] === 'HK1' ? 'Học kỳ 1' : ($g['semester'] === 'HK2' ? 'Học kỳ 2' : 'Khác');
            $bySemester[$sem][] = $g;
        }

        foreach ($bySemester as $sem => $semGrades) {
            $reply .= "📅 **{$sem}:**\n";
            $semHasData = false;
            foreach ($semGrades as $g) {
                $score = $g[$type];
                if ($score !== null && $score !== '') {
                    $reply .= "• {$g['subject_name']}: **{$score}**\n";
                    $semHasData = true;
                    $hasData = true;
                }
            }
            if (!$semHasData) {
                $reply .= "• (Chưa có dữ liệu)\n";
            }
            $reply .= "\n";
        }
    }

    if (!$hasData) {
        return ['success' => true, 'reply' => "Hiện tại mình chưa thấy dữ liệu cho **{$typeName}**. Bạn vui lòng kiểm tra lại hoặc đợi giáo viên cập nhật nhé!"];
    }

    $reply .= "💡 **Ghi chú:** Bạn có thể hỏi các loại điểm khác như \"điểm miệng\", \"điểm giữa kỳ\"... hoặc xem bảng điểm đầy đủ ở trang chính.";
    return ['success' => true, 'reply' => $reply];
}

/**
 * Trả về kết quả xếp hạng của học sinh
 */
function getStudentRankingResponse($dynamicContext)
{
    if (empty($dynamicContext['student_ranking']))
        return ['success' => false, 'reply' => 'Chưa có thông tin xếp hạng. Hệ thống cần dữ liệu điểm để tính toán thứ hạng cho bạn.'];

    $r = $dynamicContext['student_ranking'];
    $semesterLabel = ($r['semester'] ?? '') === 'HK1' ? 'Học kỳ 1' : (($r['semester'] ?? '') === 'HK2' ? 'Học kỳ 2' : 'hiện tại');

    $reply = "🏆 **Kết quả xếp hạng của bạn ({$semesterLabel}):**\n\n";
    $reply .= "• Vị trí hiện tại: **Hạng {$r['rank']}** trong lớp\n";
    $reply .= "• Điểm trung bình môn: **{$r['avg_score']}**\n\n";
    $reply .= "💡 Xếp hạng dựa trên điểm trung bình của các môn học trong kỳ cộng lại.";

    return ['success' => true, 'reply' => $reply];
}

/**
 * Trả về lịch thi cho học sinh
 */
function getStudentExamResponse($dynamicContext)
{
    if (empty($dynamicContext['student_exam_schedule']))
        return ['success' => true, 'reply' => '📅 Hệ thống chưa công bố lịch thi mới nhất cho bạn.'];

    $reply = "📝 **Lịch thi của bạn:**\n\n";
    foreach ($dynamicContext['student_exam_schedule'] as $ex) {
        $reply .= "🔹 **Ngày " . date('d/m/Y', strtotime($ex['exam_date'])) . ":**\n";
        $reply .= "• Ca thi: {$ex['start_time']} - {$ex['end_time']} ({$ex['period_name']})\n";
        $reply .= "• Môn: **{$ex['subject_name']}**\n";
        $reply .= "• Phòng thi: **" . ($ex['room_name'] ?: 'Chưa gán') . "**\n\n";
    }

    return ['success' => true, 'reply' => $reply];
}

/**
 * Trả về thời khóa biểu cho học sinh
 */
function getStudentTimetableResponse($dynamicContext)
{
    if (empty($dynamicContext['student_timetable']))
        return ['success' => false, 'reply' => 'Chưa có thông tin thời khóa biểu cho lớp của bạn.'];

    $reply = "📅 **Thời khóa biểu tuần này:**\n\n";

    $days = [2 => 'Thứ 2', 3 => 'Thứ 3', 4 => 'Thứ 4', 5 => 'Thứ 5', 6 => 'Thứ 6', 7 => 'Thứ 7'];
    $byDay = [];
    foreach ($dynamicContext['student_timetable'] as $t) {
        $byDay[$t['day_of_week']][] = $t;
    }

    foreach ($days as $num => $label) {
        if (!empty($byDay[$num])) {
            $reply .= "🔹 **{$label}:**\n";
            foreach ($byDay[$num] as $t) {
                $reply .= "• Tiết {$t['period']}: {$t['subject_name']} (Phòng: " . ($t['room'] ?: '-') . ")\n";
            }
            $reply .= "\n";
        }
    }

    return ['success' => true, 'reply' => $reply];
}

/**
 * Trả về chi tiết lớp học từ dynamic context
 */
function getClassDetailResponse($dynamicContext)
{
    if (empty($dynamicContext['found_class']))
        return ['success' => false, 'reply' => 'Không tìm thấy lớp học.'];

    $c = $dynamicContext['found_class'];
    $reply = "🏫 **Thông tin lớp học: {$c['class_name']}**\n\n";
    $reply .= "• **Khối:** {$c['grade_level']}\n";
    $reply .= "• **GV Chủ nhiệm:** " . ($c['head_teacher'] ?: 'Chưa gán') . "\n";

    if (!empty($dynamicContext['class_students'])) {
        $reply .= "\n👥 **Danh sách học sinh (5 học sinh tiêu biểu):**\n";
        foreach ($dynamicContext['class_students'] as $st) {
            $reply .= "• {$st['full_name']} (`{$st['student_code']}`)\n";
        }
    }

    return ['success' => true, 'reply' => $reply];
}

/**
 * Trả về lịch giảng dạy của giáo viên từ dynamic context
 */
function getTeacherScheduleResponse($dynamicContext)
{
    if (empty($dynamicContext['teacher_schedule']))
        return ['success' => false, 'reply' => 'Không tìm thấy lịch dạy.'];

    $teacherName = $dynamicContext['found_teacher']['full_name'] ?? 'Giáo viên';
    $reply = "📅 **Lịch giảng dạy của {$teacherName}:**\n\n";

    $days = [
        2 => 'Thứ 2',
        3 => 'Thứ 3',
        4 => 'Thứ 4',
        5 => 'Thứ 5',
        6 => 'Thứ 6',
        7 => 'Thứ 7'
    ];

    $scheduleByDay = [];
    foreach ($dynamicContext['teacher_schedule'] as $s) {
        $scheduleByDay[$s['day_of_week']][] = $s;
    }

    foreach ($days as $dayNum => $dayName) {
        if (!empty($scheduleByDay[$dayNum])) {
            $reply .= "🔹 **{$dayName}:**\n";
            foreach ($scheduleByDay[$dayNum] as $s) {
                $reply .= "• Tiết {$s['period']}: Lớp {$s['class_name']} - {$s['subject_name']}" . ($s['room'] ? " (Phòng {$s['room']})" : "") . "\n";
            }
            $reply .= "\n";
        }
    }

    return ['success' => true, 'reply' => $reply];
}

/**
 * Trả về lịch gác thi của giáo viên từ dynamic context
 */
function getTeacherExamResponse($dynamicContext)
{
    if (empty($dynamicContext['teacher_exam_schedule']))
        return ['success' => false, 'reply' => 'Không tìm thấy lịch gác thi.'];

    $teacherName = $dynamicContext['found_teacher']['full_name'] ?? 'Giáo viên';
    $reply = "📝 **Lịch gác thi của {$teacherName}:**\n\n";

    foreach ($dynamicContext['teacher_exam_schedule'] as $ex) {
        $role = $ex['proctor_role'] === 'main' ? 'Gác chính' : 'Gác phụ';
        $reply .= "🔹 **Ngày " . date('d/m/Y', strtotime($ex['exam_date'])) . ":**\n";
        $reply .= "• Ca thi: {$ex['start_time']} - {$ex['end_time']}\n";
        $reply .= "• Môn: {$ex['subject_name']}\n";
        $reply .= "• Lớp: {$ex['class_name']} - Phòng: {$ex['room_name']}\n";
        $reply .= "• Vai trò: **{$role}**\n\n";
    }

    return ['success' => true, 'reply' => $reply];
}

/**
 * Response cho HỌC SINH - Chỉ thông tin cá nhân
 */
function getStudentResponse($message, $databaseStats, $context = [], $dynamicContext = [])
{

    // ============ XỬ LÝ PHÂN TÍCH AI ============
    if (!empty($context['type']) && $context['type'] === 'analysis') {
        // Nếu đây là yêu cầu phân tích, trả về phân tích mặc định khi không có Gemini
        $studentName = $context['studentName'] ?? 'Bạn';

        // Lấy ĐTB chung cả năm từ message
        $overallAvg = 0;
        if (preg_match('/ĐTB chung(?: cả năm)?:\s*([\d.]+)/ui', $message, $overallMatch)) {
            $overallAvg = floatval($overallMatch[1]);
        }

        // Parse từng môn học - format mới: "- Tên môn: ĐTB cả năm: 8.5 (HK1: 8.0, HK2: 8.75)"
        // Hoặc format cũ: "- Tên môn: ĐTB 8.5 (HK1)"
        preg_match_all('/[-•]\s*([^:]+):\s*(?:ĐTB cả năm:\s*)?([\d.]+)/ui', $message, $matches);

        $reply = "🎓 **Nhận xét từ AI NTK:**\n\n";
        $reply .= "Xin chào **{$studentName}**! 👋\n\n";

        if (!empty($matches[1])) {
            // Phân tích dựa trên điểm được gửi
            $subjects = [];
            for ($i = 0; $i < count($matches[1]); $i++) {
                $subjectName = trim($matches[1][$i]);
                $score = floatval($matches[2][$i]);
                $subjects[$subjectName] = $score;
            }

            // Sắp xếp để tìm môn cao nhất và thấp nhất
            arsort($subjects);
            $subjectKeys = array_keys($subjects);
            $best = $subjectKeys[0] ?? null;
            $bestScore = $subjects[$best] ?? 0;

            asort($subjects);
            $subjectKeys = array_keys($subjects);
            $worst = $subjectKeys[0] ?? null;
            $worstScore = $subjects[$worst] ?? 0;

            // Sử dụng ĐTB chung từ message, nếu không có thì tính từ các môn
            $avg = $overallAvg > 0 ? $overallAvg : (count($subjects) > 0 ? array_sum($subjects) / count($subjects) : 0);

            $reply .= "📊 **Tổng quan:**\n";
            $reply .= "• ĐTB cả năm: **" . number_format($avg, 2) . "**\n\n";

            $reply .= "✅ **Điểm mạnh:**\n";
            if ($best) {
                $reply .= "• Môn **{$best}** là thế mạnh của em (" . number_format($bestScore, 2) . " điểm)\n";
            }
            $reply .= "• Em đang có nền tảng tốt, hãy phát huy!\n\n";

            $reply .= "⚠️ **Cần cải thiện:**\n";
            if ($worst && $worst !== $best) {
                $reply .= "• Môn **{$worst}** cần chú ý hơn (" . number_format($worstScore, 2) . " điểm)\n";
                $reply .= "• Dành thêm thời gian ôn tập môn **{$worst}**\n\n";
            } else {
                $reply .= "• Các môn học đang khá đồng đều\n";
                $reply .= "• Tiếp tục duy trì phong độ học tập!\n\n";
            }

            $reply .= "💡 **Lời khuyên:**\n";
            if ($avg >= 8.0) {
                $reply .= "• Xuất sắc! Tiếp tục duy trì phong độ\n";
                $reply .= "• Thử thách bản thân với bài tập nâng cao\n";
            } elseif ($avg >= 6.5) {
                $reply .= "• Kết quả khá tốt! Còn tiềm năng phát triển\n";
                if ($worst && $worstScore < 7.0) {
                    $reply .= "• Tập trung cải thiện môn **{$worst}** (hiện " . number_format($worstScore, 2) . " điểm)\n";
                } else {
                    $reply .= "• Tập trung cải thiện các môn dưới 7.0\n";
                }
            } else {
                $reply .= "• Cần nỗ lực hơn trong thời gian tới\n";
                $reply .= "• Lập thời gian biểu học tập hợp lý\n";
                $reply .= "• Đừng ngại hỏi thầy cô khi gặp khó khăn\n";
            }

            $reply .= "\n🌟 Chúc em học tập tiến bộ! - AI NTK";
        } else {
            $reply .= "Để phân tích chi tiết, thầy/cô cần xem điểm của em trước.\n";
            $reply .= "Vui lòng vào tab **\"Xem Điểm\"** để tải điểm, sau đó quay lại phân tích.\n\n";
            $reply .= "💡 **Mẹo học tập:**\n";
            $reply .= "• Lập thời gian biểu học tập đều đặn\n";
            $reply .= "• Ôn tập ngay sau mỗi buổi học\n";
            $reply .= "• Hỏi thầy cô khi không hiểu bài";
        }

        return ['success' => true, 'reply' => $reply];
    }

    // Hỏi về điểm số của mình (Cụ thể loại điểm)
    if (preg_match('/miệng|mieng|15p|15 phút|15 phut|1 tiết|1 tiet|giữa kỳ|giua ky|cuối kỳ|cuoi ky|tbm|cả năm|ca nam|suốt năm|suot nam|hệ số|he so|học kỳ|hoc ky|điểm thi|diem thi/ui', $message)) {
        return getStudentGradesResponse($dynamicContext, $message);
    }

    // Hỏi về điểm số của mình (Chung chung)
    if (preg_match('/điểm.*của.*tôi|điểm.*của.*em|điểm.*tôi|xem điểm|diem.*toi|điểm số|kết quả|ket qua/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "Chào bạn! Bạn muốn xem loại điểm gì thế? 😊\n\n" .
                "• **Điểm các môn**: Kết quả trung bình tất cả môn học\n" .
                "• **Điểm thành phần**: Miệng, 15p, 1 tiết (Hệ số 1, 2)\n" .
                "• **Điểm thi học kỳ**: Điểm thi Cuối kỳ 1 và 2\n" .
                "• **Điểm định kỳ**: Điểm Giữa kỳ\n" .
                "• **Điểm trung bình môn**: TBM HK1, HK2 hoặc cả năm\n\n" .
                "Bạn hãy nhắn cho mình tên loại điểm bạn cần xem nhé! (VD: \"Điểm miệng\", \"Điểm thi học kỳ\")"
        ];
    }

    // Hỏi về phúc khảo
    if (preg_match('/phúc khảo|phuc khao|sai điểm|điểm sai|khiếu nại|khieu nai|yêu cầu.*cập nhật/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "📝 **Yêu cầu phúc khảo điểm:**\n\n" .
                "Nếu bạn thấy điểm không đúng, hãy:\n" .
                "1️⃣ Vào mục **\"Yêu cầu cập nhật\"** trên menu\n" .
                "2️⃣ Chọn loại: **\"Phúc khảo điểm\"**\n" .
                "3️⃣ Ghi rõ: Môn học, loại điểm, lý do\n" .
                "4️⃣ Nhấn **\"Gửi yêu cầu\"**\n\n" .
                "⏳ Admin sẽ xem xét và phản hồi trong 1-3 ngày làm việc.\n\n" .
                "💡 Mẹo: Ghi càng chi tiết, yêu cầu càng được xử lý nhanh!"
        ];
    }

    // Hỏi về xếp loại học lực
    if (preg_match('/xếp loại|xep loai|học lực|hoc luc|giỏi|khá|trung bình|yếu|kém/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "🎓 **Tiêu chuẩn xếp loại học lực:**\n\n" .
                "🥇 **Giỏi:** ĐTB ≥ 8.0\n" .
                "🥈 **Khá:** ĐTB từ 6.5 đến 7.9\n" .
                "📗 **Trung bình:** ĐTB từ 5.0 đến 6.4\n" .
                "📙 **Yếu:** ĐTB từ 3.5 đến 4.9\n" .
                "📕 **Kém:** ĐTB dưới 3.5\n\n" .
                "📌 **Công thức ĐTB cả năm:**\n" .
                "ĐTB = (ĐTB HK1 + ĐTB HK2 × 2) / 3\n\n" .
                "💪 Cố gắng lên bạn nhé!"
        ];
    }

    // Hỏi về học bổng
    if (preg_match('/học bổng|hoc bong|scholarship/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "🏆 **Điều kiện xét học bổng:**\n\n" .
                "**📚 Học bổng học lực:**\n" .
                "• ĐTB cả năm ≥ 8.0\n" .
                "• Hạnh kiểm: Tốt cả 2 học kỳ\n" .
                "• Không vi phạm kỷ luật\n\n" .
                "**🎯 Học bổng chính sách:**\n" .
                "• Dành cho: Con thương binh, hộ nghèo, dân tộc thiểu số...\n" .
                "• Cần có giấy tờ chứng minh\n\n" .
                "💡 Liên hệ GVCN để biết thêm chi tiết về hồ sơ xét học bổng!"
        ];
    }

    // Hỏi về cách học
    if (preg_match('/cách học|học.*hiệu quả|học.*tốt|tips|mẹo.*học|cải thiện|nâng cao/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "📚 **Mẹo học tập hiệu quả:**\n\n" .
                "1️⃣ **Lập thời gian biểu** - Học đều đặn mỗi ngày\n" .
                "2️⃣ **Ghi chép cẩn thận** - Tóm tắt bài sau mỗi tiết\n" .
                "3️⃣ **Ôn tập thường xuyên** - Đừng để dồn trước thi\n" .
                "4️⃣ **Hỏi ngay khi không hiểu** - Đừng ngại hỏi thầy cô\n" .
                "5️⃣ **Nghỉ ngơi hợp lý** - Ngủ đủ 7-8 tiếng\n\n" .
                "🎯 **Với môn yếu:**\n" .
                "• Dành thêm thời gian ôn tập\n" .
                "• Nhờ bạn giỏi môn đó giúp đỡ\n" .
                "• Hỏi thầy cô sau giờ học\n\n" .
                "💪 Bạn làm được mà! Cố lên nhé!"
        ];
    }

    // Hỏi về lớp của mình
    if (preg_match('/lớp.*tôi|lớp.*của.*tôi|lop.*toi|thông tin lớp/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "🏫 **Thông tin lớp học của bạn:**\n\n" .
                "Bạn có thể xem thông tin lớp trên trang chính, bao gồm:\n" .
                "• Tên lớp và sĩ số\n" .
                "• Danh sách các bạn cùng lớp\n" .
                "• Thông tin giáo viên chủ nhiệm\n\n" .
                "📌 Nếu thông tin sai, hãy báo với GVCN hoặc gửi yêu cầu cập nhật!"
        ];
    }

    // Chào hỏi
    if (preg_match('/xin chào|hello|hi |chào|hey|alo/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "Xin chào bạn! 👋\n\n" .
                "Mình là trợ lý học tập AI, sẵn sàng hỗ trợ bạn về:\n" .
                "• 📊 **Điểm số & Học lực** - Tra cứu chi tiết điểm\n" .
                "• 🏆 **Xếp hạng** - Xem vị trí của bạn trong lớp\n" .
                "• � Thời khóa biểu & Lịch thi\n" .
                "• 📚 **Tư vấn học tập** - Mẹo học tốt các môn\n\n" .
                "Đừng ngại đặt câu hỏi nhé, ví dụ: \"Điểm miệng của mình thế nào?\" 😊"
        ];
    }

    // Cảm ơn
    if (preg_match('/cảm ơn|cam on|thanks|thank you/ui', $message)) {
        return ['success' => true, 'reply' => "Không có gì bạn nhé! 😊 Nếu cần hỏi thêm gì cứ nói mình nhé! Chúc bạn học tốt! 💪"];
    }

    // Mặc định cho student
    return [
        'success' => true,
        'reply' =>
            "Mình là trợ lý AI dành cho học sinh! 🎓\n\n" .
            "Mình có thể giúp bạn về:\n" .
            "• 📊 **\"Điểm của tôi\"** - Xem chi tiết các loại điểm\n" .
            "• 🏆 **\"Xếp hạng\"** - Xem hạng trong lớp\n" .
            "• 📅 **\"Thời khóa biểu\"** - Lịch học hôm nay\n" .
            "• 📝 **\"Lịch thi\"** - Các kỳ thi sắp tới\n" .
            "• 🎯 **\"Xếp loại học lực\"** - Tiêu chuẩn đánh giá\n" .
            "• 📚 **\"Cách học hiệu quả\"** - Tips học tập\n\n" .
            "Bạn thử hỏi một trong những chủ đề trên nhé! 😊"
    ];
}

/**
 * Response cho GIÁO VIÊN - Thông tin lớp chủ nhiệm và nghiệp vụ
 */
function getTeacherResponse($message, $databaseStats, $context = [], $homeroomStats = null)
{

    $homeroomClassName = $context['homeroomClassName'] ?? null;
    $hasHomeroom = !empty($homeroomStats);

    // ============ HỎI VỀ LỚP CHỦ NHIỆM ============
    if (preg_match('/lớp.*chủ nhiệm|lớp.*tôi|lớp của tôi|lop.*chu nhiem|lớp mình|chủ nhiệm/ui', $message)) {
        if (!$hasHomeroom) {
            return [
                'success' => true,
                'reply' =>
                    "📌 **Thông tin lớp chủ nhiệm:**\n\n" .
                    "Thầy/Cô hiện không được phân công chủ nhiệm lớp nào.\n\n" .
                    "💡 Liên hệ Admin nếu cần cập nhật thông tin phân công."
            ];
        }

        $className = $homeroomStats['class_info']['class_name'] ?? $homeroomClassName;
        $totalStudents = $homeroomStats['total_students'] ?? 0;
        $maleCount = $homeroomStats['students_by_gender']['Nam'] ?? 0;
        $femaleCount = $homeroomStats['students_by_gender']['Nữ'] ?? 0;

        $reply = "🏫 **Lớp chủ nhiệm: {$className}**\n\n";
        $reply .= "👥 **Sĩ số:** {$totalStudents} học sinh\n";
        $reply .= "• Nam: {$maleCount} | Nữ: {$femaleCount}\n\n";

        if ($homeroomStats['class_average']) {
            $reply .= "📊 **ĐTB lớp:** {$homeroomStats['class_average']}\n\n";
        }

        $reply .= "💡 Thầy/Cô có thể hỏi thêm:\n";
        $reply .= "• \"Điểm lớp tôi\"\n";
        $reply .= "• \"Hạnh kiểm lớp\"\n";
        $reply .= "• \"Học sinh giỏi\"\n";
        $reply .= "• \"Học sinh yếu\"";

        return ['success' => true, 'reply' => $reply];
    }

    // ============ HỎI VỀ ĐIỂM LỚP CHỦ NHIỆM ============
    if (preg_match('/điểm.*lớp|diem.*lop|kết quả.*lớp|học lực|xếp loại.*lớp/ui', $message)) {
        if (!$hasHomeroom) {
            return [
                'success' => true,
                'reply' =>
                    "📊 Thầy/Cô chưa được phân công chủ nhiệm lớp nào.\n\n" .
                    "Để xem điểm các lớp khác, vào tab **\"Thống kê\"**."
            ];
        }

        $className = $homeroomStats['class_info']['class_name'] ?? $homeroomClassName;
        $reply = "📊 **Kết quả học tập lớp {$className}:**\n\n";

        if ($homeroomStats['class_average']) {
            $reply .= "📈 **ĐTB lớp:** {$homeroomStats['class_average']}\n\n";
        }

        if (!empty($homeroomStats['academic_levels'])) {
            $reply .= "🎓 **Xếp loại học lực:**\n";
            foreach ($homeroomStats['academic_levels'] as $level) {
                $emoji = match ($level['academic_level']) {
                    'Giỏi' => '🥇',
                    'Khá' => '🥈',
                    'Trung bình' => '📗',
                    'Yếu' => '📙',
                    default => '📕'
                };
                $reply .= "{$emoji} {$level['academic_level']}: {$level['count']} HS\n";
            }
        }

        return ['success' => true, 'reply' => $reply];
    }

    // ============ HỎI VỀ HỌC SINH GIỎI ============
    if (preg_match('/học sinh.*giỏi|hs.*giỏi|top.*điểm|điểm cao|gioi nhat|xuất sắc/ui', $message)) {
        if (!$hasHomeroom) {
            return ['success' => true, 'reply' => "Thầy/Cô chưa được phân công chủ nhiệm lớp nào."];
        }

        $className = $homeroomStats['class_info']['class_name'] ?? $homeroomClassName;
        $reply = "🌟 **Top học sinh điểm cao lớp {$className}:**\n\n";

        if (!empty($homeroomStats['top_students'])) {
            $i = 1;
            foreach ($homeroomStats['top_students'] as $student) {
                $medal = match ($i) { 1 => '🥇', 2 => '🥈', 3 => '🥉', default => "{$i}."};
                $reply .= "{$medal} **{$student['full_name']}** - ĐTB: {$student['avg_score']}\n";
                $i++;
            }
        } else {
            $reply .= "Chưa có dữ liệu điểm.\n";
        }

        return ['success' => true, 'reply' => $reply];
    }

    // ============ HỎI VỀ HỌC SINH YẾU ============
    if (preg_match('/học sinh.*yếu|hs.*yếu|điểm thấp|cần quan tâm|yeu kem|kém/ui', $message)) {
        if (!$hasHomeroom) {
            return ['success' => true, 'reply' => "Thầy/Cô chưa được phân công chủ nhiệm lớp nào."];
        }

        $className = $homeroomStats['class_info']['class_name'] ?? $homeroomClassName;
        $reply = "⚠️ **Học sinh cần quan tâm lớp {$className}:**\n\n";

        if (!empty($homeroomStats['weak_students'])) {
            foreach ($homeroomStats['weak_students'] as $student) {
                $reply .= "• **{$student['full_name']}** - ĐTB: {$student['avg_score']}\n";
            }
            $reply .= "\n💡 Nên trao đổi với phụ huynh và có kế hoạch hỗ trợ.";
        } else {
            $reply .= "🎉 Tuyệt vời! Không có học sinh nào dưới trung bình.\n";
        }

        return ['success' => true, 'reply' => $reply];
    }

    // ============ HỎI VỀ HẠNH KIỂM ============
    if (preg_match('/hạnh kiểm|hanh kiem|đạo đức|conduct/ui', $message)) {
        if (!$hasHomeroom) {
            return [
                'success' => true,
                'reply' =>
                    "📌 Thầy/Cô cần được phân công chủ nhiệm để đánh giá hạnh kiểm.\n\n" .
                    "Liên hệ Admin nếu cần cập nhật."
            ];
        }

        $className = $homeroomStats['class_info']['class_name'] ?? $homeroomClassName;
        $reply = "📋 **Hạnh kiểm lớp {$className}:**\n\n";

        if (!empty($homeroomStats['conduct'])) {
            foreach ($homeroomStats['conduct'] as $c) {
                $emoji = match ($c['conduct']) {
                    'Tốt' => '🌟',
                    'Khá' => '✨',
                    'Trung bình' => '📗',
                    'Yếu' => '⚠️',
                    default => '❓'
                };
                $reply .= "{$emoji} {$c['conduct']}: {$c['count']} HS\n";
            }
        } else {
            $reply .= "Chưa có dữ liệu hạnh kiểm.\n";
        }

        $reply .= "\n💡 Vào tab **\"Hạnh kiểm\"** để đánh giá HS.";

        return ['success' => true, 'reply' => $reply];
    }

    // ============ HỎI VỀ SỐ LƯỢNG HỌC SINH ============
    if (preg_match('/bao nhiêu.*học sinh|sĩ số|số lượng.*hs|tổng.*học sinh/ui', $message)) {
        if (!$hasHomeroom) {
            return [
                'success' => true,
                'reply' =>
                    "Thầy/Cô chưa được phân công chủ nhiệm lớp nào.\n\n" .
                    "Vào tab **\"Danh sách HS\"** để xem các lớp."
            ];
        }

        $className = $homeroomStats['class_info']['class_name'] ?? $homeroomClassName;
        $totalStudents = $homeroomStats['total_students'] ?? 0;
        $maleCount = $homeroomStats['students_by_gender']['Nam'] ?? 0;
        $femaleCount = $homeroomStats['students_by_gender']['Nữ'] ?? 0;

        $reply = "👥 **Sĩ số lớp {$className}:**\n\n";
        $reply .= "• Tổng: **{$totalStudents}** học sinh\n";
        $reply .= "• Nam: {$maleCount} | Nữ: {$femaleCount}";

        return ['success' => true, 'reply' => $reply];
    }

    // ============ HỎI VỀ NHẬP ĐIỂM ============
    if (preg_match('/nhập điểm|nhap diem|nhập.*điểm|cách.*nhập|huong dan.*nhap/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "📝 **Hướng dẫn nhập điểm:**\n\n" .
                "1️⃣ Vào tab **\"Nhập điểm\"**\n" .
                "2️⃣ Chọn: **Lớp → Môn → Học kỳ**\n" .
                "3️⃣ Nhập điểm vào các cột:\n" .
                "   • Miệng (hệ số 1)\n" .
                "   • 15 phút (hệ số 2)\n" .
                "   • 1 tiết (hệ số 3)\n" .
                "   • Cuối kỳ (hệ số 4)\n" .
                "4️⃣ Nhấn **\"Lưu điểm\"**\n\n" .
                "📌 **Công thức ĐTB:**\n" .
                "ĐTB = (Miệng + 15p×2 + 1tiết×3 + CK×4) / 10\n\n" .
                "💡 Điểm sẽ tự động tính ĐTB sau khi lưu!"
        ];
    }

    // ============ HỎI VỀ CÔNG THỨC TÍNH ĐIỂM ============
    if (preg_match('/công thức|cong thuc|cách tính|tính điểm|hệ số|he so/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "📐 **Công thức tính điểm:**\n\n" .
                "**ĐTB môn học:**\n" .
                "ĐTB = (Miệng×1 + 15p×2 + 1tiết×3 + CK×4) / 10\n\n" .
                "**Hệ số điểm:**\n" .
                "• Miệng: hệ số 1\n" .
                "• 15 phút: hệ số 2\n" .
                "• 1 tiết: hệ số 3\n" .
                "• Cuối kỳ: hệ số 4\n\n" .
                "**ĐTB cả năm:**\n" .
                "ĐTB năm = (ĐTB HK1 + ĐTB HK2 × 2) / 3\n\n" .
                "📌 Học kỳ 2 có hệ số 2 vì tổng hợp kiến thức cả năm."
        ];
    }

    // ============ CHÀO HỎI ============
    if (preg_match('/xin chào|hello|hi |chào|hey/ui', $message)) {
        $greeting = "Xin chào Thầy/Cô! 👋\n\n";

        if ($hasHomeroom) {
            $className = $homeroomStats['class_info']['class_name'] ?? $homeroomClassName;
            $totalStudents = $homeroomStats['total_students'] ?? 0;
            $greeting .= "📚 **Lớp chủ nhiệm:** {$className} ({$totalStudents} HS)\n\n";
        }

        $greeting .= "Tôi là trợ lý AI, sẵn sàng hỗ trợ về:\n";
        $greeting .= "• 🏫 Thông tin lớp chủ nhiệm\n";
        $greeting .= "• 📊 Điểm số và hạnh kiểm\n";
        $greeting .= "• 📝 Hướng dẫn nhập điểm\n";
        $greeting .= "• 📐 Công thức tính điểm\n\n";
        $greeting .= "Thầy/Cô cần hỗ trợ gì ạ? 😊";

        return ['success' => true, 'reply' => $greeting];
    }

    // ============ CẢM ƠN ============
    if (preg_match('/cảm ơn|cam on|thanks/ui', $message)) {
        return ['success' => true, 'reply' => "Dạ không có gì ạ! 😊 Nếu Thầy/Cô cần hỗ trợ thêm, cứ hỏi tôi nhé!"];
    }

    // ============ MẶC ĐỊNH ============
    $defaultReply = "Xin chào Thầy/Cô! 👨‍🏫\n\n";

    if ($hasHomeroom) {
        $className = $homeroomStats['class_info']['class_name'] ?? $homeroomClassName;
        $defaultReply .= "📚 **Lớp chủ nhiệm:** {$className}\n\n";
        $defaultReply .= "Tôi có thể hỗ trợ về:\n";
        $defaultReply .= "• 🏫 **\"Lớp chủ nhiệm\"** - Thông tin lớp\n";
        $defaultReply .= "• 📊 **\"Điểm lớp\"** - Kết quả học tập\n";
        $defaultReply .= "• 📋 **\"Hạnh kiểm\"** - Xếp loại đạo đức\n";
        $defaultReply .= "• 🌟 **\"Học sinh giỏi\"** - Top điểm cao\n";
        $defaultReply .= "• ⚠️ **\"Học sinh yếu\"** - Cần quan tâm\n";
    } else {
        $defaultReply .= "Tôi có thể hỗ trợ về:\n";
        $defaultReply .= "• 📝 **\"Nhập điểm\"** - Hướng dẫn nhập điểm\n";
        $defaultReply .= "• 📐 **\"Công thức\"** - Cách tính ĐTB\n";
    }

    $defaultReply .= "\nThầy/Cô thử hỏi một chủ đề trên nhé! 😊";

    return ['success' => true, 'reply' => $defaultReply];
}

/**
 * Response cho ADMIN - Toàn quyền xem thống kê hệ thống
 */
function getAdminResponse($message, $databaseStats)
{

    // ============ CÂU HỎI VỀ HỌC BỔNG ============
    if (preg_match('/học bổng|hoc bong|scholarship|nhận.*bổng|xét.*bổng/ui', $message)) {
        $academicCount = $databaseStats['scholarship_academic'] ?? 0;
        $policyCount = $databaseStats['scholarship_policy'] ?? 0;

        $reply = "🏆 **THỐNG KÊ HỌC BỔNG**\n\n";
        $reply .= "📚 **Học bổng Học lực (ĐTB ≥ 8.0):**\n";
        $reply .= "• Số HS đủ điều kiện: **{$academicCount}** học sinh\n";

        if (!empty($databaseStats['top_scholarship_candidates'])) {
            $reply .= "\n🌟 **Top học sinh điểm cao:**\n";
            $i = 1;
            foreach ($databaseStats['top_scholarship_candidates'] as $student) {
                $reply .= "{$i}. {$student['full_name']} ({$student['class_name']}) - ĐTB: {$student['avg_score']}\n";
                $i++;
                if ($i > 5)
                    break;
            }
        }

        $reply .= "\n🎯 **Học bổng Chính sách:**\n";
        $reply .= "• Tổng số HS được hưởng: **{$policyCount}** học sinh\n";

        if (!empty($databaseStats['scholarship_by_policy'])) {
            $reply .= "\n📋 **Chi tiết theo đối tượng:**\n";
            foreach ($databaseStats['scholarship_by_policy'] as $policy) {
                $reply .= "• {$policy['policy_object']}: {$policy['count']} HS\n";
            }
        }

        return ['success' => true, 'reply' => $reply];
    }

    // ============ CÂU HỎI VỀ HỌC SINH ============
    if (preg_match('/bao nhiêu.*(học sinh|hs)|số lượng.*(học sinh|hs)|(học sinh|hs).*bao nhiêu|tổng.*học sinh/ui', $message)) {
        $total = $databaseStats['total_students'] ?? 0;
        $reply = "📊 **Thống kê học sinh:**\n\n";
        $reply .= "• Tổng số học sinh: **{$total}** học sinh\n";

        if (!empty($databaseStats['students_by_gender'])) {
            $reply .= "\n👥 **Theo giới tính:**\n";
            foreach ($databaseStats['students_by_gender'] as $gender => $count) {
                $reply .= "• {$gender}: {$count} học sinh\n";
            }
        }

        if (!empty($databaseStats['students_by_grade'])) {
            $reply .= "\n🏫 **Theo khối:**\n";
            foreach ($databaseStats['students_by_grade'] as $grade) {
                $reply .= "• Khối {$grade['grade_level']}: {$grade['count']} học sinh\n";
            }
        }

        return ['success' => true, 'reply' => $reply];
    }

    // ============ CÂU HỎI VỀ LỚP HỌC ============
    if (preg_match('/bao nhiêu.*lớp|số lượng.*lớp|lớp.*bao nhiêu|tổng.*lớp|danh sách.*lớp|các lớp|lớp học/ui', $message)) {
        $total = $databaseStats['total_classes'] ?? 0;
        $reply = "🏫 **Thống kê lớp học:**\n\n";
        $reply .= "• Tổng số lớp: **{$total}** lớp\n";

        if (!empty($databaseStats['classes'])) {
            $reply .= "\n📋 **Danh sách lớp:**\n";
            foreach ($databaseStats['classes'] as $class) {
                $reply .= "• {$class['name']} (Khối {$class['grade_level']}): {$class['student_count']} HS\n";
            }
        }

        return ['success' => true, 'reply' => $reply];
    }

    // ============ CÂU HỎI VỀ GIÁO VIÊN ============
    if (preg_match('/bao nhiêu.*(giáo viên|gv)|số lượng.*(giáo viên|gv)|(giáo viên|gv).*bao nhiêu|tổng.*giáo viên/ui', $message)) {
        $total = $databaseStats['total_teachers'] ?? 0;
        return ['success' => true, 'reply' => "👨‍🏫 Hệ thống hiện có **{$total}** giáo viên."];
    }

    // ============ CÂU HỎI VỀ MÔN HỌC ============
    if (preg_match('/bao nhiêu.*môn|số lượng.*môn|môn.*bao nhiêu|danh sách môn|các môn/ui', $message)) {
        $total = $databaseStats['total_subjects'] ?? 0;
        $reply = "📚 **Môn học trong hệ thống:**\n\n";
        $reply .= "• Tổng số: **{$total}** môn\n";

        if (!empty($databaseStats['subjects'])) {
            $subjectNames = array_column($databaseStats['subjects'], 'name');
            $reply .= "\n📋 **Danh sách:** " . implode(", ", $subjectNames);
        }

        return ['success' => true, 'reply' => $reply];
    }

    // ============ THỐNG KÊ TỔNG QUAN ============
    if (preg_match('/thống kê|thong ke|tổng quan|tong quan|báo cáo|bao cao|overview/ui', $message)) {
        $reply = "📊 **THỐNG KÊ TỔNG QUAN HỆ THỐNG**\n\n";
        $reply .= "👨‍🎓 Học sinh: **" . ($databaseStats['total_students'] ?? 0) . "**\n";
        $reply .= "🏫 Lớp học: **" . ($databaseStats['total_classes'] ?? 0) . "**\n";
        $reply .= "👨‍🏫 Giáo viên: **" . ($databaseStats['total_teachers'] ?? 0) . "**\n";
        $reply .= "📚 Môn học: **" . ($databaseStats['total_subjects'] ?? 0) . "**\n";

        if (!empty($databaseStats['update_requests'])) {
            $pending = $databaseStats['update_requests']['pending'] ?? 0;
            $reply .= "📝 Yêu cầu chờ duyệt: **{$pending}**\n";
        }

        return ['success' => true, 'reply' => $reply];
    }

    // ============ ĐỐI TƯỢNG CHÍNH SÁCH ============
    if (preg_match('/chính sách|chinh sach|policy|đối tượng|doi tuong/ui', $message)) {
        if (!empty($databaseStats['students_by_policy'])) {
            $reply = "🎯 **Học sinh theo đối tượng chính sách:**\n\n";
            foreach ($databaseStats['students_by_policy'] as $policy) {
                $reply .= "• {$policy['policy_object']}: {$policy['count']} học sinh\n";
            }
            return ['success' => true, 'reply' => $reply];
        }
        return ['success' => true, 'reply' => "Hiện chưa có học sinh nào thuộc đối tượng chính sách."];
    }

    // ============ HƯỚNG DẪN IMPORT ============
    if (preg_match('/import|nhập.*excel|nhập.*file|excel/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "📥 **Hướng dẫn Import Excel:**\n\n" .
                "1️⃣ Vào tab **\"Học sinh\"**\n" .
                "2️⃣ Nhấn nút **\"Import Excel\"**\n" .
                "3️⃣ Tải file mẫu về và điền dữ liệu\n" .
                "4️⃣ Upload file → Xem trước → Import\n\n" .
                "⚠️ **Lưu ý:**\n" .
                "• Định dạng: .xlsx, .xls, .csv\n" .
                "• Dung lượng tối đa: 5MB\n" .
                "• Mã HS không được trùng"
        ];
    }

    // ============ CHÀO HỎI ============
    if (preg_match('/xin chào|hello|hi |chào|hey/ui', $message)) {
        return [
            'success' => true,
            'reply' =>
                "Xin chào Admin! 👋\n\n" .
                "Tôi là trợ lý AI quản trị, có thể hỗ trợ bạn:\n" .
                "• 📊 Thống kê hệ thống\n" .
                "• 👥 Quản lý học sinh, giáo viên\n" .
                "• 🏆 Thông tin học bổng\n" .
                "• 📥 Hướng dẫn import/export\n\n" .
                "Bạn cần hỗ trợ gì? 😊"
        ];
    }

    // ============ CẢM ƠN ============
    if (preg_match('/cảm ơn|cam on|thanks/ui', $message)) {
        return ['success' => true, 'reply' => "Không có gì! 😊 Cần hỗ trợ thêm cứ hỏi nhé!"];
    }

    // ============ MẶC ĐỊNH ADMIN ============
    return [
        'success' => true,
        'reply' =>
            "Xin chào Admin! ⚙️\n\n" .
            "Tôi có thể hỗ trợ bạn về:\n" .
            "• 📊 **\"Thống kê tổng quan\"** - Số liệu hệ thống\n" .
            "• 👥 **\"Bao nhiêu học sinh\"** - Thống kê HS\n" .
            "• 🏫 **\"Danh sách lớp\"** - Thông tin lớp học\n" .
            "• 👨‍🏫 **\"Bao nhiêu giáo viên\"** - Số lượng GV\n" .
            "• 🏆 **\"Học bổng\"** - Thống kê học bổng\n" .
            "• 📥 **\"Import Excel\"** - Hướng dẫn nhập liệu\n\n" .
            "Bạn thử hỏi một chủ đề trên nhé! 😊"
    ];
}

/**
 * Lấy thống kê dữ liệu thực từ database
 */
function getDatabaseStats($pdo)
{
    $stats = [];

    // Đếm tổng số học sinh
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM students");
        $stats['total_students'] = $stmt->fetch()['total'];
    } catch (Exception $e) {
        $stats['total_students'] = 0;
    }

    // Đếm theo giới tính
    try {
        $stmt = $pdo->query("SELECT gender, COUNT(*) as count FROM students GROUP BY gender");
        $genderStats = $stmt->fetchAll();
        $stats['students_by_gender'] = [];
        foreach ($genderStats as $row) {
            $stats['students_by_gender'][$row['gender']] = $row['count'];
        }
    } catch (Exception $e) {
        $stats['students_by_gender'] = [];
    }

    // Đếm theo đối tượng chính sách
    try {
        $stmt = $pdo->query("SELECT policy_object, COUNT(*) as count FROM students WHERE policy_object IS NOT NULL AND policy_object != '' GROUP BY policy_object");
        $stats['students_by_policy'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $stats['students_by_policy'] = [];
    }

    // Đếm tổng số lớp
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM classes");
        $stats['total_classes'] = $stmt->fetch()['total'];
    } catch (Exception $e) {
        $stats['total_classes'] = 0;
    }

    // Danh sách lớp
    try {
        $stmt = $pdo->query("SELECT c.id, c.class_name, c.grade_level, 
            (SELECT COUNT(*) FROM students WHERE class_id = c.id) as student_count 
            FROM classes c ORDER BY c.grade_level, c.class_name");
        $stats['classes'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $stats['classes'] = [];
    }

    // Đếm số học sinh mỗi khối
    try {
        $stmt = $pdo->query("
            SELECT c.grade_level, COUNT(s.id) as count 
            FROM classes c 
            LEFT JOIN students s ON s.class_id = c.id 
            GROUP BY c.grade_level 
            ORDER BY c.grade_level
        ");
        $stats['students_by_grade'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $stats['students_by_grade'] = [];
    }

    // Đếm tổng số giáo viên
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM teachers");
        $stats['total_teachers'] = $stmt->fetch()['total'];
    } catch (Exception $e) {
        $stats['total_teachers'] = 0;
    }

    // Đếm số môn học
    try {
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM subjects");
        $stats['total_subjects'] = $stmt->fetch()['total'];
    } catch (Exception $e) {
        $stats['total_subjects'] = 0;
    }

    // Danh sách môn học
    try {
        $stmt = $pdo->query("SELECT id, name, code FROM subjects ORDER BY name");
        $stats['subjects'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $stats['subjects'] = [];
    }

    // Đếm số yêu cầu cập nhật
    try {
        $stmt = $pdo->query("SELECT status, COUNT(*) as count FROM update_requests GROUP BY status");
        $requestStats = $stmt->fetchAll();
        $stats['update_requests'] = [];
        foreach ($requestStats as $row) {
            $stats['update_requests'][$row['status']] = $row['count'];
        }
    } catch (Exception $e) {
        $stats['update_requests'] = [];
    }

    // Thống kê điểm trung bình theo môn (học kỳ gần nhất)
    try {
        $stmt = $pdo->query("
            SELECT sub.name as subject_name, 
                   ROUND(AVG(g.final_score), 2) as avg_score,
                   COUNT(g.id) as total_grades
            FROM grades g
            JOIN subjects sub ON g.subject_id = sub.id
            WHERE g.semester = 1 AND g.academic_year = '2024-2025'
            GROUP BY g.subject_id
            ORDER BY avg_score DESC
        ");
        $stats['avg_scores_by_subject'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $stats['avg_scores_by_subject'] = [];
    }

    // Thống kê xếp loại học lực
    try {
        $stmt = $pdo->query("
            SELECT 
                SUM(CASE WHEN final_score >= 8.0 THEN 1 ELSE 0 END) as gioi,
                SUM(CASE WHEN final_score >= 6.5 AND final_score < 8.0 THEN 1 ELSE 0 END) as kha,
                SUM(CASE WHEN final_score >= 5.0 AND final_score < 6.5 THEN 1 ELSE 0 END) as trungbinh,
                SUM(CASE WHEN final_score >= 3.5 AND final_score < 5.0 THEN 1 ELSE 0 END) as yeu,
                SUM(CASE WHEN final_score < 3.5 THEN 1 ELSE 0 END) as kem
            FROM grades
            WHERE semester = 1 AND academic_year = '2024-2025'
        ");
        $stats['grade_distribution'] = $stmt->fetch();
    } catch (Exception $e) {
        $stats['grade_distribution'] = [];
    }

    // ============ THỐNG KÊ HỌC BỔNG ============

    // Học bổng học lực (HS có ĐTB >= 8.0)
    try {
        $stmt = $pdo->query("
            SELECT COUNT(DISTINCT s.id) as count
            FROM students s
            JOIN grades g ON g.student_id = s.id
            WHERE g.final_score >= 8.0
            AND g.academic_year = '2024-2025'
        ");
        $stats['scholarship_academic'] = $stmt->fetch()['count'] ?? 0;
    } catch (Exception $e) {
        $stats['scholarship_academic'] = 0;
    }

    // Học bổng chính sách (HS có đối tượng chính sách)
    try {
        $stmt = $pdo->query("
            SELECT COUNT(*) as count 
            FROM students 
            WHERE policy_object IS NOT NULL AND policy_object != ''
        ");
        $stats['scholarship_policy'] = $stmt->fetch()['count'] ?? 0;
    } catch (Exception $e) {
        $stats['scholarship_policy'] = 0;
    }

    // Chi tiết học bổng theo đối tượng chính sách
    try {
        $stmt = $pdo->query("
            SELECT policy_object, COUNT(*) as count 
            FROM students 
            WHERE policy_object IS NOT NULL AND policy_object != ''
            GROUP BY policy_object
            ORDER BY count DESC
        ");
        $stats['scholarship_by_policy'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $stats['scholarship_by_policy'] = [];
    }

    // Top 10 học sinh điểm cao nhất (ứng viên học bổng học lực)
    try {
        $stmt = $pdo->query("
            SELECT s.full_name, s.student_code, c.class_name,
                   ROUND(AVG(g.final_score), 2) as avg_score
            FROM students s
            JOIN grades g ON g.student_id = s.id
            JOIN classes c ON s.class_id = c.id
            WHERE g.academic_year = '2024-2025'
            GROUP BY s.id
            HAVING avg_score >= 8.0
            ORDER BY avg_score DESC
            LIMIT 10
        ");
        $stats['top_scholarship_candidates'] = $stmt->fetchAll();
    } catch (Exception $e) {
        $stats['top_scholarship_candidates'] = [];
    }

    return $stats;
}

/**
 * Tạo system prompt tùy theo role + Context động
 */
function getSystemPrompt($role, $context, $databaseStats = [], $dynamicContext = [])
{
    $basePrompt = "Bạn là trợ lý AI thông minh của Hệ thống Quản lý Kết quả Học tập THPT. ";
    $basePrompt .= "Hãy trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. ";
    $basePrompt .= "Sử dụng emoji phù hợp để tạo sự thân thiện. ";
    $basePrompt .= "Trả lời ngắn gọn, dễ hiểu, có cấu trúc rõ ràng. ";

    // Thêm ngữ cảnh động (Dữ liệu cụ thể về thực thể đang được hỏi)
    if (!empty($dynamicContext)) {
        $basePrompt .= "\n\n=== NGỮ CẢNH CỤ THỂ ĐANG ĐƯỢC HỎI ===";

        if (!empty($dynamicContext['found_student'])) {
            $s = $dynamicContext['found_student'];
            $basePrompt .= "\n👤 HỌC SINH: {$s['full_name']} ({$s['student_code']})";
            $basePrompt .= "\n- Lớp: {$s['class_name']}";

            if (!empty($dynamicContext['student_grades'])) {
                $basePrompt .= "\n- BẢNG ĐIỂM CHI TIẾT:";
                foreach ($dynamicContext['student_grades'] as $g) {
                    $basePrompt .= "\n  + {$g['subject_name']} ({$g['semester']}): Miệng: {$g['oral_score']}, 15p: {$g['score_15min']}, 1t: {$g['score_1hour']}, Giữa kỳ: {$g['midterm_score']}, Cuối kỳ: {$g['final_score']} -> ĐTB: {$g['average_score']}";
                }
            }

            if (!empty($dynamicContext['student_conduct'])) {
                $basePrompt .= "\n- HẠNH KIỂM:";
                foreach ($dynamicContext['student_conduct'] as $c) {
                    $basePrompt .= "\n  + {$c['semester']}: {$c['rating']}";
                }
            }
        }

        if (!empty($dynamicContext['found_class'])) {
            $c = $dynamicContext['found_class'];
            $basePrompt .= "\n🏫 LỚP HỌC: {$c['class_name']}";
            $basePrompt .= "\n- Khối: {$c['grade_level']}";
            $basePrompt .= "\n- GV Chủ nhiệm: " . ($c['head_teacher'] ?: 'Chưa gán');

            if (!empty($dynamicContext['class_students'])) {
                $basePrompt .= "\n- MỘT SỐ HỌC SINH:";
                foreach ($dynamicContext['class_students'] as $st) {
                    $basePrompt .= "\n  + {$st['full_name']} ({$st['student_code']})";
                }
            }
        }

        if (!empty($dynamicContext['teacher_schedule'])) {
            $basePrompt .= "\n📅 LỊCH GIẢNG DẠY (TKB):";
            foreach ($dynamicContext['teacher_schedule'] as $s) {
                $basePrompt .= "\n  + Thứ {$s['day_of_week']}, Tiết {$s['period']}: Lớp {$s['class_name']} - Môn {$s['subject_name']}" . ($s['room'] ? " (Phòng {$s['room']})" : "");
            }
            $basePrompt .= "\n(Hãy trình bày dưới dạng bảng hoặc danh sách đẹp mắt cho giáo viên)";
        }

        if (!empty($dynamicContext['teacher_exam_schedule'])) {
            $basePrompt .= "\n📝 LỊCH GÁC THI:";
            foreach ($dynamicContext['teacher_exam_schedule'] as $ex) {
                $basePrompt .= "\n  + Ngày " . date('d/m/Y', strtotime($ex['exam_date'])) . " ({$ex['start_time']}-{$ex['end_time']}): {$ex['subject_name']} - Lớp {$ex['class_name']} - Phòng {$ex['room_name']} - Vai trò: " . ($ex['proctor_role'] === 'main' ? 'Gác chính' : 'Gác phụ');
            }
        }

        if (!empty($dynamicContext['student_ranking'])) {
            $r = $dynamicContext['student_ranking'];
            $semesterLabel = ($r['semester'] ?? '') === 'HK1' ? 'Học kỳ 1' : (($r['semester'] ?? '') === 'HK2' ? 'Học kỳ 2' : '');
            $basePrompt .= "\n🏆 XẾP HẠNG TRONG LỚP " . ($semesterLabel ? "($semesterLabel)" : "") . ": Hạng {$r['rank']} (ĐTB: {$r['avg_score']})";
        }

        if (!empty($dynamicContext['student_exam_schedule'])) {
            $basePrompt .= "\n📝 LỊCH THI CỦA BẠN:";
            foreach ($dynamicContext['student_exam_schedule'] as $ex) {
                $basePrompt .= "\n  + Ngày " . date('d/m/Y', strtotime($ex['exam_date'])) . " ({$ex['start_time']}-{$ex['end_time']}): {$ex['subject_name']} - Kỳ thi: {$ex['period_name']} - Phòng: " . ($ex['room_name'] ?: 'Chưa gán');
            }
        }

        if (!empty($dynamicContext['student_timetable'])) {
            $basePrompt .= "\n📅 THỜI KHÓA BIỂU CỦA BẠN:";
            foreach ($dynamicContext['student_timetable'] as $t) {
                $basePrompt .= "\n  + Thứ {$t['day_of_week']}, Tiết {$t['period']}: Môn {$t['subject_name']} - GV: {$t['teacher_name']} (Phòng: " . ($t['room'] ?: '-') . ")";
            }
            $basePrompt .= "\n(Hãy trình bày dạng bảng TKB 6 ngày trong tuần cho học sinh)";
        }
        // Trường hợp học sinh tự xem điểm của mình
        if ($role === 'student' && !empty($dynamicContext['student_grades']) && empty($dynamicContext['found_student'])) {
            $basePrompt .= "\n📊 BẢNG ĐIỂM CỦA BẠN (ĐANG ĐĂNG NHẬP):";
            foreach ($dynamicContext['student_grades'] as $g) {
                $basePrompt .= "\n  + {$g['subject_name']} ({$g['semester']}): Miệng: {$g['oral_score']}, 15p: {$g['score_15min']}, 1t: {$g['score_1hour']}, Giữa kỳ: {$g['midterm_score']}, Cuối kỳ: {$g['final_score']} -> ĐTB: {$g['average_score']}";
            }
        }
        $basePrompt .= "\n=== KẾT THÚC NGỮ CẢNH CỤ THỂ ===";
    }

    // Thêm dữ liệu thực từ database
    $basePrompt .= "\n\n=== DỮ LIỆU THỰC TỪ HỆ THỐNG ===";
    $basePrompt .= "\n📊 THỐNG KÊ TỔNG QUAN:";
    $basePrompt .= "\n- Tổng số học sinh: " . ($databaseStats['total_students'] ?? 0) . " học sinh";
    $basePrompt .= "\n- Tổng số lớp: " . ($databaseStats['total_classes'] ?? 0) . " lớp";
    $basePrompt .= "\n- Tổng số giáo viên: " . ($databaseStats['total_teachers'] ?? 0) . " giáo viên";
    $basePrompt .= "\n- Số môn học: " . ($databaseStats['total_subjects'] ?? 0) . " môn";

    // Thống kê theo giới tính
    if (!empty($databaseStats['students_by_gender'])) {
        $basePrompt .= "\n\n👥 PHÂN BỐ GIỚI TÍNH:";
        foreach ($databaseStats['students_by_gender'] as $gender => $count) {
            $genderText = $gender === 'Nam' ? 'Nam' : ($gender === 'Nữ' ? 'Nữ' : $gender);
            $basePrompt .= "\n- {$genderText}: {$count} học sinh";
        }
    }

    // Thống kê theo khối
    if (!empty($databaseStats['students_by_grade'])) {
        $basePrompt .= "\n\n🏫 SỐ HỌC SINH THEO KHỐI:";
        foreach ($databaseStats['students_by_grade'] as $grade) {
            $basePrompt .= "\n- Khối {$grade['grade_level']}: {$grade['count']} học sinh";
        }
    }

    // Danh sách lớp
    if (!empty($databaseStats['classes'])) {
        $basePrompt .= "\n\n📋 DANH SÁCH LỚP:";
        foreach ($databaseStats['classes'] as $class) {
            $basePrompt .= "\n- {$class['name']} (Khối {$class['grade_level']}): {$class['student_count']} học sinh";
        }
    }

    // Danh sách môn học
    if (!empty($databaseStats['subjects'])) {
        $basePrompt .= "\n\n📚 DANH SÁCH MÔN HỌC:";
        $subjectNames = array_column($databaseStats['subjects'], 'name');
        $basePrompt .= "\n" . implode(", ", $subjectNames);
    }

    // Thống kê đối tượng chính sách
    if (!empty($databaseStats['students_by_policy'])) {
        $basePrompt .= "\n\n🎯 ĐỐI TƯỢNG CHÍNH SÁCH:";
        foreach ($databaseStats['students_by_policy'] as $policy) {
            $basePrompt .= "\n- {$policy['policy_object']}: {$policy['count']} học sinh";
        }
    }

    // Thống kê yêu cầu cập nhật
    if (!empty($databaseStats['update_requests'])) {
        $basePrompt .= "\n\n📝 YÊU CẦU CẬP NHẬT:";
        $statusLabels = ['pending' => 'Chờ duyệt', 'approved' => 'Đã duyệt', 'rejected' => 'Đã từ chối'];
        foreach ($databaseStats['update_requests'] as $status => $count) {
            $label = $statusLabels[$status] ?? $status;
            $basePrompt .= "\n- {$label}: {$count} yêu cầu";
        }
    }

    // Điểm trung bình theo môn
    if (!empty($databaseStats['avg_scores_by_subject'])) {
        $basePrompt .= "\n\n📈 ĐIỂM TRUNG BÌNH THEO MÔN (HK1 2024-2025):";
        foreach ($databaseStats['avg_scores_by_subject'] as $subject) {
            $basePrompt .= "\n- {$subject['subject_name']}: {$subject['avg_score']} ({$subject['total_grades']} bài)";
        }
    }

    // Xếp loại học lực
    if (!empty($databaseStats['grade_distribution'])) {
        $dist = $databaseStats['grade_distribution'];
        $basePrompt .= "\n\n🏆 XẾP LOẠI HỌC LỰC (HK1 2024-2025):";
        $basePrompt .= "\n- Giỏi (≥8.0): " . ($dist['gioi'] ?? 0) . " lượt";
        $basePrompt .= "\n- Khá (6.5-7.9): " . ($dist['kha'] ?? 0) . " lượt";
        $basePrompt .= "\n- Trung bình (5.0-6.4): " . ($dist['trungbinh'] ?? 0) . " lượt";
        $basePrompt .= "\n- Yếu (3.5-4.9): " . ($dist['yeu'] ?? 0) . " lượt";
        $basePrompt .= "\n- Kém (<3.5): " . ($dist['kem'] ?? 0) . " lượt";
    }

    $basePrompt .= "\n\n=== KẾT THÚC DỮ LIỆU ===\n";
    $basePrompt .= "\nHãy sử dụng dữ liệu thực ở trên để trả lời câu hỏi của người dùng một cách chính xác.";
    $basePrompt .= "\nNếu người dùng hỏi về số lượng, thống kê, hãy trả lời dựa trên dữ liệu thực.";

    switch ($role) {
        case 'student':
            $studentName = $context['userName'] ?? 'Học sinh';
            $prompt = $basePrompt;
            $prompt .= "\n\nBạn đang hỗ trợ học sinh: {$studentName}.";
            $prompt .= "\n\nVai trò của bạn với HỌC SINH:";
            $prompt .= "\n- 📚 Tư vấn phương pháp học tập hiệu quả";
            $prompt .= "\n- 📊 Giải thích về điểm số, cách tính điểm trung bình";
            $prompt .= "\n- 💡 Gợi ý cách cải thiện kết quả học tập";
            $prompt .= "\n- 🎯 Định hướng nghề nghiệp và chọn ngành";
            $prompt .= "\n- 😊 Hỗ trợ tâm lý, động viên khi gặp khó khăn";
            $prompt .= "\n- ❓ Trả lời thắc mắc về quy chế, quy định học tập";
            $prompt .= "\n\nCông thức tính điểm:";
            $prompt .= "\n- ĐTB môn = (Miệng + 15p×2 + 1tiết×3 + Cuối kỳ×4) / 10";
            $prompt .= "\n- ĐTB cả năm = (ĐTB HK1 + ĐTB HK2×2) / 3";
            $prompt .= "\n- Xếp loại: Giỏi (≥8.0), Khá (≥6.5), TB (≥5.0), Yếu (≥3.5), Kém (<3.5)";
            $prompt .= "\n\nHướng dẫn phúc khảo: Vào mục 'Yêu cầu cập nhật' → Chọn 'Phúc khảo điểm' → Ghi rõ môn, lý do";
            return $prompt;

        case 'teacher':
            $teacherName = $context['userName'] ?? 'Giáo viên';
            $prompt = $basePrompt;
            $prompt .= "\n\nBạn đang hỗ trợ giáo viên: {$teacherName}.";
            $prompt .= "\n\nVai trò của bạn với GIÁO VIÊN:";
            $prompt .= "\n- 📝 Hỗ trợ nhập điểm, quản lý điểm số";
            $prompt .= "\n- 📊 Phân tích thống kê kết quả học sinh";
            $prompt .= "\n- 💼 Tư vấn về phương pháp giảng dạy";
            $prompt .= "\n- 📋 Hướng dẫn viết nhận xét, đánh giá học sinh";
            $prompt .= "\n- 🏫 Hỗ trợ công tác chủ nhiệm";
            $prompt .= "\n- ❓ Giải đáp thắc mắc về quy chế, nghiệp vụ";
            $prompt .= "\n\nHướng dẫn nhập điểm:";
            $prompt .= "\n1. Vào tab 'Nhập điểm'";
            $prompt .= "\n2. Chọn Lớp → Môn → Học kỳ";
            $prompt .= "\n3. Nhập điểm các cột: Miệng, 15 phút, 1 tiết, Cuối kỳ";
            $prompt .= "\n4. Nhấn 'Lưu điểm'";
            $prompt .= "\n\nCông thức: ĐTB = (Miệng + 15p×2 + 1tiết×3 + CK×4) / 10";
            return $prompt;

        case 'admin':
            $prompt = $basePrompt;
            $prompt .= "\n\nBạn đang hỗ trợ QUẢN TRỊ VIÊN hệ thống.";
            $prompt .= "\n\nVai trò của bạn với ADMIN:";
            $prompt .= "\n- 🔧 Hướng dẫn quản lý hệ thống";
            $prompt .= "\n- 👥 Hỗ trợ quản lý tài khoản người dùng";
            $prompt .= "\n- 📊 Phân tích báo cáo, thống kê toàn trường";
            $prompt .= "\n- 🛡️ Tư vấn về bảo mật và phân quyền";
            $prompt .= "\n- 📋 Hỗ trợ import/export dữ liệu";
            $prompt .= "\n- 🔍 Giải đáp vấn đề kỹ thuật";
            $prompt .= "\n- 📝 Hướng dẫn cấu hình hệ thống";
            $prompt .= "\n\nCác tab chức năng:";
            $prompt .= "\n- Tab 'Người dùng': Quản lý tài khoản, reset mật khẩu, phân quyền";
            $prompt .= "\n- Tab 'Lớp học': Thêm/sửa/xóa lớp, gán GVCN";
            $prompt .= "\n- Tab 'Học sinh': Quản lý hồ sơ, import Excel, lọc đối tượng chính sách";
            $prompt .= "\n- Tab 'Giáo viên': Quản lý thông tin, phân công môn học";
            $prompt .= "\n- Tab 'Học bổng': Xem xếp hạng học lực, học bổng chính sách";
            $prompt .= "\n- Tab 'Yêu cầu': Duyệt/từ chối yêu cầu cập nhật từ HS/GV";
            return $prompt;

        default:
            return $basePrompt . "\nHãy hỗ trợ người dùng một cách tốt nhất.";
    }
}

/**
 * Gọi Google Gemini API
 */
function callGeminiAPI($systemPrompt, $userMessage, $role, $databaseStats = [], $context = [], $pdo = null, $dynamicContext = [])
{
    // Kiểm tra API key
    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE' || empty(GEMINI_API_KEY)) {
        $response = getSmartFallbackResponse($userMessage, $role, $databaseStats, $context, $pdo, $dynamicContext);
        $response['is_fallback'] = true;
        return $response;
    }

    $url = GEMINI_API_URL . '?key=' . GEMINI_API_KEY;

    $data = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $systemPrompt . "\n\nNgười dùng hỏi: " . $userMessage]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.7,
            'topK' => 40,
            'topP' => 0.95,
            'maxOutputTokens' => 1024,
        ],
        'safetySettings' => [
            ['category' => 'HARM_CATEGORY_HARASSMENT', 'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'],
            ['category' => 'HARM_CATEGORY_HATE_SPEECH', 'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'],
            ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'],
            ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'],
        ]
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($data),
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => false
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        // Fallback khi lỗi kết nối
        $fallback = getSmartFallbackResponse($userMessage, $role, $databaseStats, $context, $pdo, $dynamicContext);
        $fallback['is_fallback'] = true;
        return $fallback;
    }

    // Xử lý lỗi 429 - Rate Limit
    if ($httpCode === 429) {
        error_log("Gemini API Rate Limited (429) - Setting cooldown");
        setCooldown(); // Đặt cooldown để tránh gọi tiếp
        $fallback = getSmartFallbackResponse($userMessage, $role, $databaseStats, $context, $pdo, $dynamicContext);
        $fallback['is_fallback'] = true;
        return $fallback;
    }

    if ($httpCode !== 200) {
        $errorData = json_decode($response, true);
        $errorMsg = $errorData['error']['message'] ?? 'Lỗi không xác định';
        error_log("Gemini API Error ($httpCode): $errorMsg");
        $fallback = getSmartFallbackResponse($userMessage, $role, $databaseStats, $context, $pdo, $dynamicContext);
        $fallback['is_fallback'] = true;
        return $fallback;
    }

    $result = json_decode($response, true);

    if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
        return [
            'success' => true,
            'reply' => $result['candidates'][0]['content']['parts'][0]['text'],
            'is_fallback' => false
        ];
    }

    $fallback = getSmartFallbackResponse($userMessage, $role, $databaseStats, $context, $pdo, $dynamicContext);
    $fallback['is_fallback'] = true;
    return $fallback;
}

/**
 * Fallback response khi API không khả dụng
 */
function getFallbackResponse($message, $role)
{
    $message = mb_strtolower($message, 'UTF-8');

    // Common responses
    if (preg_match('/xin chào|hello|hi |chào|hey/u', $message)) {
        $greeting = $role === 'admin' ? 'Admin' : ($role === 'teacher' ? 'Thầy/Cô' : 'bạn');
        return ['success' => true, 'reply' => "Xin chào $greeting! 👋 Tôi là trợ lý AI của hệ thống quản lý học tập. Tôi có thể giúp gì cho bạn hôm nay?"];
    }

    if (preg_match('/cảm ơn|thanks|thank/u', $message)) {
        return ['success' => true, 'reply' => "Không có gì ạ! 😊 Rất vui được hỗ trợ. Nếu cần gì thêm, đừng ngại hỏi nhé!"];
    }

    // Admin responses
    if ($role === 'admin') {
        if (preg_match('/thêm học sinh|tạo học sinh|them hoc sinh/u', $message)) {
            return ['success' => true, 'reply' => "📝 **Để thêm học sinh mới:**\n\n1️⃣ Vào tab **\"Học sinh\"**\n2️⃣ Nhấn nút **\"+ Thêm học sinh\"**\n3️⃣ Điền thông tin: Mã HS, họ tên, ngày sinh, giới tính, lớp\n4️⃣ Chọn đối tượng chính sách (nếu có)\n5️⃣ Nhấn **\"Lưu\"**\n\n💡 Mẹo: Import nhiều HS từ Excel để tiết kiệm thời gian!"];
        }
        if (preg_match('/import|excel|nhập file/u', $message)) {
            return ['success' => true, 'reply' => "📥 **Import học sinh từ Excel:**\n\n1️⃣ Tab \"Học sinh\" → Nút **\"Import Excel\"**\n2️⃣ Tải file mẫu về\n3️⃣ Điền dữ liệu vào file mẫu\n4️⃣ Upload file → Xem trước → Import\n\n⚠️ Lưu ý:\n• File: .xlsx, .xls, .csv\n• Max 5MB\n• Mã HS không trùng"];
        }
        if (preg_match('/yêu cầu|request|duyệt|duyet/u', $message)) {
            return ['success' => true, 'reply' => "📋 **Quản lý yêu cầu cập nhật:**\n\n• Tab **\"Yêu cầu\"** hiển thị tất cả yêu cầu từ HS/GV\n• 🔔 Badge đỏ = số yêu cầu đang chờ\n• Các thao tác: Xem chi tiết → Duyệt/Từ chối\n• Có thể thêm ghi chú phản hồi\n\nHệ thống tự cập nhật mỗi 30 giây!"];
        }
        if (preg_match('/học bổng|scholarship|hoc bong/u', $message)) {
            return ['success' => true, 'reply' => "🏆 **Tiêu chí học bổng:**\n\n**Học bổng học lực:**\n• Xếp hạng theo ĐTB cả năm\n• Công thức: (ĐTB HK1 + ĐTB HK2×2) / 3\n• Yêu cầu: Hạnh kiểm \"Tốt\" cả 2 kỳ\n\n**Học bổng chính sách:**\n• Dành cho: Con thương binh, hộ nghèo, dân tộc...\n• Xếp hạng theo ĐTB trong từng nhóm"];
        }
    }

    // Teacher responses
    if ($role === 'teacher') {
        if (preg_match('/nhập điểm|nhap diem|điểm số|diem so/u', $message)) {
            return ['success' => true, 'reply' => "📊 **Hướng dẫn nhập điểm:**\n\n1️⃣ Vào tab **\"Nhập điểm\"**\n2️⃣ Chọn: Lớp → Môn → Học kỳ\n3️⃣ Nhập điểm các cột: Miệng, 15 phút, 1 tiết, Cuối kỳ\n4️⃣ Nhấn **\"Lưu điểm\"**\n\n📌 Công thức ĐTB môn:\n(Miệng + 15p×2 + 1tiết×3 + CK×4) / 10"];
        }
        if (preg_match('/xem học sinh|danh sách|danh sach/u', $message)) {
            return ['success' => true, 'reply' => "👨‍🎓 **Xem danh sách học sinh:**\n\n• Tab **\"Danh sách HS\"** hiển thị HS các lớp bạn dạy\n• Có thể lọc theo lớp\n• Xem chi tiết điểm từng HS\n• Xem thống kê điểm theo lớp"];
        }
        if (preg_match('/cập nhật|thay đổi|sửa thông tin|cap nhat/u', $message)) {
            return ['success' => true, 'reply' => "✏️ **Cập nhật thông tin cá nhân:**\n\nĐể thay đổi thông tin (SĐT, địa chỉ...), Thầy/Cô cần:\n1️⃣ Gửi yêu cầu qua mục **\"Yêu cầu cập nhật\"**\n2️⃣ Chờ Admin xét duyệt\n3️⃣ Hệ thống sẽ thông báo kết quả"];
        }
    }

    // Student responses
    if ($role === 'student') {
        if (preg_match('/điểm|xem điểm|kết quả|diem|ket qua/u', $message)) {
            return ['success' => true, 'reply' => "📊 **Xem điểm của bạn:**\n\nĐiểm số hiển thị ngay trên trang chính, bao gồm:\n• Điểm từng môn (Miệng, 15p, 1 tiết, Cuối kỳ)\n• ĐTB môn = (Miệng + 15p×2 + 1tiết×3 + CK×4) / 10\n• ĐTB học kỳ\n• Xếp loại học lực\n\n🔄 Điểm được cập nhật khi giáo viên nhập mới."];
        }
        if (preg_match('/phúc khảo|sai điểm|điểm sai|khiếu nại|phuc khao/u', $message)) {
            return ['success' => true, 'reply' => "📝 **Yêu cầu phúc khảo điểm:**\n\n1️⃣ Vào mục **\"Yêu cầu cập nhật\"**\n2️⃣ Chọn loại: \"Phúc khảo điểm\"\n3️⃣ Ghi rõ: Môn học, loại điểm, lý do\n4️⃣ Gửi yêu cầu\n\n⏳ Admin sẽ xem xét và phản hồi."];
        }
        if (preg_match('/xếp loại|học lực|giỏi|khá|xep loai|hoc luc/u', $message)) {
            return ['success' => true, 'reply' => "🎓 **Tiêu chuẩn xếp loại học lực:**\n\n🥇 Giỏi: ĐTB ≥ 8.0\n🥈 Khá: ĐTB ≥ 6.5\n📗 Trung bình: ĐTB ≥ 5.0\n📙 Yếu: ĐTB ≥ 3.5\n📕 Kém: ĐTB < 3.5\n\n📌 ĐTB cả năm = (ĐTB HK1 + ĐTB HK2×2) / 3"];
        }
        if (preg_match('/học bổng|scholarship|hoc bong/u', $message)) {
            return ['success' => true, 'reply' => "🏆 **Điều kiện xét học bổng:**\n\n• Xếp hạng theo ĐTB cả năm\n• Yêu cầu: Hạnh kiểm \"Tốt\" cả 2 học kỳ\n• Ưu tiên HS có đối tượng chính sách\n\nLiên hệ GVCN để biết thêm chi tiết!"];
        }
        if (preg_match('/học|hoc|tips|mẹo/u', $message)) {
            return ['success' => true, 'reply' => "📚 **Tips học tập hiệu quả:**\n\n1. 📅 Lập thời gian biểu học tập\n2. 🎯 Đặt mục tiêu cụ thể cho từng môn\n3. ✍️ Ghi chép và tóm tắt bài học\n4. 🔄 Ôn tập thường xuyên\n5. 💪 Nghỉ ngơi hợp lý\n\nBạn đang gặp khó khăn môn nào?"];
        }
    }

    // Default response
    return ['success' => true, 'reply' => "Cảm ơn bạn đã hỏi! 🤔\n\nTôi có thể hỗ trợ bạn về:\n• Hướng dẫn sử dụng hệ thống\n• Giải thích cách tính điểm\n• Quy trình yêu cầu cập nhật\n• Tiêu chí xếp loại, học bổng\n\nBạn có thể hỏi cụ thể hơn để tôi hỗ trợ tốt hơn nhé! 😊"];
}
