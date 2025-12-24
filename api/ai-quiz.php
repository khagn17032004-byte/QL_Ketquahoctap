<?php
/**
 * API Tạo câu hỏi trắc nghiệm bằng AI
 * POST: Yêu cầu AI tạo câu hỏi trắc nghiệm
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['success' => false, 'message' => 'Method không hợp lệ']);
        exit;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $subject = isset($input['subject']) ? trim($input['subject']) : '';
    $topic = isset($input['topic']) ? trim($input['topic']) : '';
    $gradeLevel = isset($input['grade_level']) ? intval($input['grade_level']) : 10;
    $numQuestions = isset($input['num_questions']) ? intval($input['num_questions']) : 5;
    $difficulty = isset($input['difficulty']) ? $input['difficulty'] : 'medium';
    
    if (empty($subject)) {
        echo json_encode(['success' => false, 'message' => 'Vui lòng chọn môn học']);
        exit;
    }
    
    // Giới hạn số câu hỏi
    $numQuestions = min(max($numQuestions, 1), 20);
    
    $difficultyMap = [
        'easy' => 'dễ, cơ bản',
        'medium' => 'trung bình',
        'hard' => 'khó, nâng cao'
    ];
    $difficultyText = $difficultyMap[$difficulty] ?? 'trung bình';
    
    // Tạo prompt cho AI
    $prompt = "Hãy tạo {$numQuestions} câu hỏi trắc nghiệm môn {$subject} cho học sinh lớp {$gradeLevel}.\n\n";
    
    if (!empty($topic)) {
        $prompt .= "Chủ đề: {$topic}\n";
    }
    
    $prompt .= "Độ khó: {$difficultyText}\n\n";
    
    $prompt .= "Yêu cầu format:
Mỗi câu hỏi có 4 đáp án A, B, C, D với 1 đáp án đúng.
Trả về dưới dạng JSON với cấu trúc:
{
  \"questions\": [
    {
      \"id\": 1,
      \"question\": \"Nội dung câu hỏi\",
      \"options\": {
        \"A\": \"Đáp án A\",
        \"B\": \"Đáp án B\",
        \"C\": \"Đáp án C\",
        \"D\": \"Đáp án D\"
      },
      \"correct\": \"A\",
      \"explanation\": \"Giải thích ngắn gọn tại sao đáp án đúng\"
    }
  ]
}

CHỈ trả về JSON, không có text khác.";
    
    // Gọi AI API (sử dụng cùng cấu hình với ai-chat.php)
    $apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : getenv('GEMINI_API_KEY');
    
    if (!$apiKey) {
        // Trả về câu hỏi mẫu nếu không có API key
        $sampleQuestions = generateSampleQuestions($subject, $gradeLevel, $numQuestions);
        echo json_encode(['success' => true, 'data' => $sampleQuestions]);
        exit;
    }
    
    $apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" . $apiKey;
    
    $requestData = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.7,
            'maxOutputTokens' => 4096
        ]
    ];
    
    $ch = curl_init($apiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        // Fallback to sample questions
        $sampleQuestions = generateSampleQuestions($subject, $gradeLevel, $numQuestions);
        echo json_encode(['success' => true, 'data' => $sampleQuestions, 'source' => 'sample']);
        exit;
    }
    
    $result = json_decode($response, true);
    
    if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
        $aiText = $result['candidates'][0]['content']['parts'][0]['text'];
        
        // Trích xuất JSON từ response
        preg_match('/\{[\s\S]*\}/', $aiText, $matches);
        
        if (!empty($matches[0])) {
            $questionsData = json_decode($matches[0], true);
            
            if ($questionsData && isset($questionsData['questions'])) {
                echo json_encode([
                    'success' => true,
                    'data' => $questionsData,
                    'source' => 'ai'
                ]);
                exit;
            }
        }
    }
    
    // Fallback
    $sampleQuestions = generateSampleQuestions($subject, $gradeLevel, $numQuestions);
    echo json_encode(['success' => true, 'data' => $sampleQuestions, 'source' => 'sample']);
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: ' . $e->getMessage()]);
}

function generateSampleQuestions($subject, $gradeLevel, $numQuestions) {
    $questions = [];
    
    $sampleBank = [
        'Toán' => [
            [
                'question' => 'Giải phương trình: 2x + 5 = 11',
                'options' => ['A' => 'x = 2', 'B' => 'x = 3', 'C' => 'x = 4', 'D' => 'x = 5'],
                'correct' => 'B',
                'explanation' => '2x = 11 - 5 = 6, suy ra x = 3'
            ],
            [
                'question' => 'Tính đạo hàm của hàm số y = x² + 3x',
                'options' => ['A' => 'y\' = 2x', 'B' => 'y\' = 2x + 3', 'C' => 'y\' = x + 3', 'D' => 'y\' = 2x + 1'],
                'correct' => 'B',
                'explanation' => 'Áp dụng công thức đạo hàm: (x^n)\' = nx^(n-1)'
            ],
            [
                'question' => 'Số nghiệm của phương trình x² - 4 = 0 là:',
                'options' => ['A' => '0', 'B' => '1', 'C' => '2', 'D' => 'Vô số'],
                'correct' => 'C',
                'explanation' => 'x² = 4, suy ra x = ±2, có 2 nghiệm'
            ]
        ],
        'Vật lý' => [
            [
                'question' => 'Đơn vị đo cường độ dòng điện trong hệ SI là:',
                'options' => ['A' => 'Vôn (V)', 'B' => 'Ampe (A)', 'C' => 'Ôm (Ω)', 'D' => 'Oát (W)'],
                'correct' => 'B',
                'explanation' => 'Ampe (A) là đơn vị đo cường độ dòng điện trong hệ SI'
            ],
            [
                'question' => 'Công thức tính vận tốc trong chuyển động đều là:',
                'options' => ['A' => 'v = s/t', 'B' => 'v = s.t', 'C' => 'v = t/s', 'D' => 'v = s + t'],
                'correct' => 'A',
                'explanation' => 'Vận tốc = Quãng đường / Thời gian'
            ]
        ],
        'Hóa học' => [
            [
                'question' => 'Nguyên tố nào có ký hiệu hóa học là Fe?',
                'options' => ['A' => 'Flo', 'B' => 'Sắt', 'C' => 'Franxi', 'D' => 'Fermi'],
                'correct' => 'B',
                'explanation' => 'Fe là ký hiệu hóa học của nguyên tố Sắt (Iron)'
            ],
            [
                'question' => 'Số hiệu nguyên tử của nguyên tố Oxi là:',
                'options' => ['A' => '6', 'B' => '7', 'C' => '8', 'D' => '9'],
                'correct' => 'C',
                'explanation' => 'Oxi có số hiệu nguyên tử là 8 (8 proton trong hạt nhân)'
            ]
        ]
    ];
    
    // Lấy câu hỏi mẫu theo môn
    $subjectQuestions = $sampleBank[$subject] ?? $sampleBank['Toán'];
    
    for ($i = 0; $i < min($numQuestions, count($subjectQuestions)); $i++) {
        $q = $subjectQuestions[$i];
        $q['id'] = $i + 1;
        $questions[] = $q;
    }
    
    // Nếu cần thêm câu hỏi, lặp lại
    while (count($questions) < $numQuestions) {
        $idx = count($questions) % count($subjectQuestions);
        $q = $subjectQuestions[$idx];
        $q['id'] = count($questions) + 1;
        $q['question'] = "Câu " . $q['id'] . ": " . $q['question'];
        $questions[] = $q;
    }
    
    return ['questions' => $questions];
}
