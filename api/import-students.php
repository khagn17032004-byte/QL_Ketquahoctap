<?php
/**
 * Import Students from Excel API
 * POST /api/import-students.php - Upload Excel file to import students
 * Supports auto-assignment to elite classes based on average score
 */

require_once 'config.php';

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(false, null, 'Method not allowed');
    exit;
}

// Check if file was uploaded - support both 'file' and 'excel_file' keys
$fileKey = isset($_FILES['file']) ? 'file' : (isset($_FILES['excel_file']) ? 'excel_file' : null);

if (!$fileKey || $_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'File quá lớn (vượt quá giới hạn PHP)',
        UPLOAD_ERR_FORM_SIZE => 'File quá lớn (vượt quá giới hạn form)',
        UPLOAD_ERR_PARTIAL => 'File chỉ được upload một phần',
        UPLOAD_ERR_NO_FILE => 'Không có file nào được upload',
        UPLOAD_ERR_NO_TMP_DIR => 'Thiếu thư mục tạm',
        UPLOAD_ERR_CANT_WRITE => 'Không thể ghi file',
    ];
    $error = $fileKey ? $_FILES[$fileKey]['error'] : UPLOAD_ERR_NO_FILE;
    $message = $errorMessages[$error] ?? 'Lỗi upload file';
    jsonResponse(false, null, $message);
    exit;
}

$file = $_FILES[$fileKey];
$fileName = $file['name'];
$fileTmpPath = $file['tmp_name'];

// Get parameters
$gradeLevel = isset($_POST['grade_level']) ? (int)$_POST['grade_level'] : 10;
$eliteClassName = $_POST['elite_class'] ?? ($gradeLevel . 'A1'); // e.g., 10A1, 11A1, 12A1
$minEliteScore = isset($_POST['min_elite_score']) ? (float)$_POST['min_elite_score'] : 8.0;

// Validate file extension
$fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
if (!in_array($fileExt, ['xlsx', 'xls', 'csv'])) {
    jsonResponse(false, null, 'Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)');
    exit;
}

try {
    $db = getDB();
    
    // Get classes for this grade level
    $stmt = $db->prepare("SELECT id, class_name FROM classes WHERE grade_level = ?");
    $stmt->execute([$gradeLevel]);
    $classes = $stmt->fetchAll();
    
    if (empty($classes)) {
        jsonResponse(false, null, "Không tìm thấy lớp nào cho khối $gradeLevel");
        exit;
    }
    
    // Find elite class and normal classes
    $eliteClass = null;
    $normalClasses = [];
    foreach ($classes as $cls) {
        if ($cls['class_name'] === $eliteClassName) {
            $eliteClass = $cls;
        } else {
            $normalClasses[] = $cls;
        }
    }
    
    if (!$eliteClass) {
        // If no specific elite class, use first class
        $eliteClass = $classes[0];
        $normalClasses = array_slice($classes, 1);
    }
    
    // Parse file based on type
    $students = [];
    
    if ($fileExt === 'csv') {
        $students = parseCSV($fileTmpPath);
    } else {
        $students = parseExcel($fileTmpPath, $fileExt);
    }
    
    if (empty($students)) {
        jsonResponse(false, null, 'Không tìm thấy dữ liệu học sinh trong file');
        exit;
    }
    
    // Import students
    $imported = 0;
    $eliteCount = 0;
    $skipped = 0;
    $errors = [];
    $normalClassIndex = 0; // For round-robin distribution to normal classes
    
    foreach ($students as $index => $student) {
        $rowNum = $index + 2;
        
        // Validate required fields
        if (empty($student['student_code']) || empty($student['full_name'])) {
            $errors[] = "Dòng $rowNum: Thiếu mã HS hoặc họ tên";
            $skipped++;
            continue;
        }
        
        // Check if student code already exists
        $stmt = $db->prepare("SELECT id FROM students WHERE student_code = ?");
        $stmt->execute([$student['student_code']]);
        if ($stmt->fetch()) {
            $errors[] = "Dòng $rowNum: Mã HS '{$student['student_code']}' đã tồn tại";
            $skipped++;
            continue;
        }
        
        // Check if username already exists
        $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$student['student_code']]);
        if ($stmt->fetch()) {
            $errors[] = "Dòng $rowNum: Username '{$student['student_code']}' đã tồn tại";
            $skipped++;
            continue;
        }
        
        // Determine class based on average score
        $avgScore = isset($student['avg_score']) ? (float)$student['avg_score'] : 0;
        $assignedClass = null;
        
        if ($avgScore >= $minEliteScore) {
            // Elite class
            $assignedClass = $eliteClass;
            $eliteCount++;
        } else {
            // Normal class - distribute evenly
            if (!empty($normalClasses)) {
                $assignedClass = $normalClasses[$normalClassIndex % count($normalClasses)];
                $normalClassIndex++;
            } else {
                $assignedClass = $eliteClass; // Fallback if no normal classes
            }
        }
        
        // Create user account
        $password = password_hash('password', PASSWORD_DEFAULT);
        $stmt = $db->prepare("
            INSERT INTO users (username, password, role, status) 
            VALUES (?, ?, 'student', 'active')
        ");
        $stmt->execute([$student['student_code'], $password]);
        $userId = $db->lastInsertId();
        
        // Parse date of birth
        $dob = null;
        $birthYear = null;
        if (!empty($student['date_of_birth'])) {
            $dob = parseDate($student['date_of_birth']);
            if ($dob) {
                $birthYear = date('Y', strtotime($dob));
            }
        }
        
        // Create student record
        $stmt = $db->prepare("
            INSERT INTO students (user_id, student_code, full_name, gender, birth_date, birth_year, class_id, hometown, address, ethnicity, policy_object, parent_name, parent_phone) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        // Validate policy object value
        $validPolicies = ['con_thuong_binh_liet_si', 'ho_ngheo', 'ho_can_ngheo', 'dan_toc_vung_kho', 'khuyet_tat'];
        $policyObject = isset($student['policy_object']) && in_array($student['policy_object'], $validPolicies) ? $student['policy_object'] : null;
        
        $stmt->execute([
            $userId,
            $student['student_code'],
            $student['full_name'],
            $student['gender'] ?? 'Nam',
            $dob,
            $birthYear,
            $assignedClass['id'],
            $student['hometown'] ?? null,
            $student['address'] ?? null,
            $student['ethnicity'] ?? 'Kinh',
            $policyObject,
            $student['parent_name'] ?? null,
            $student['parent_phone'] ?? null
        ]);
        
        $imported++;
    }
    
    $message = "Đã import thành công $imported học sinh";
    if ($eliteCount > 0) {
        $message .= " ($eliteCount vào lớp chọn)";
    }
    if ($skipped > 0) {
        $message .= ", bỏ qua $skipped dòng";
    }
    
    jsonResponse(true, [
        'imported' => $imported,
        'elite_count' => $eliteCount,
        'skipped' => $skipped,
        'errors' => array_slice($errors, 0, 10)
    ], $message);
    
} catch (PDOException $e) {
    jsonResponse(false, null, 'Lỗi database: ' . $e->getMessage());
} catch (Exception $e) {
    jsonResponse(false, null, 'Lỗi: ' . $e->getMessage());
}

/**
 * Parse CSV file
 */
function parseCSV($filePath) {
    $students = [];
    $handle = fopen($filePath, 'r');
    
    if (!$handle) {
        throw new Exception('Không thể đọc file CSV');
    }
    
    // Read header row
    $header = fgetcsv($handle);
    if (!$header) {
        fclose($handle);
        throw new Exception('File CSV rỗng');
    }
    
    // Normalize header names
    $headerMap = normalizeHeaders($header);
    
    // Read data rows
    while (($row = fgetcsv($handle)) !== false) {
        if (empty(array_filter($row))) continue; // Skip empty rows
        
        $student = [];
        foreach ($headerMap as $key => $index) {
            $student[$key] = isset($row[$index]) ? trim($row[$index]) : '';
        }
        $students[] = $student;
    }
    
    fclose($handle);
    return $students;
}

/**
 * Parse Excel file (XLSX/XLS)
 * Using simple XML parsing for XLSX
 */
function parseExcel($filePath, $ext) {
    if ($ext === 'xlsx') {
        // Check if ZipArchive is available
        if (!class_exists('ZipArchive')) {
            throw new Exception('Server không hỗ trợ đọc file .xlsx. Vui lòng sử dụng file .csv thay thế.');
        }
        return parseXLSX($filePath);
    }
    
    // For XLS, convert to CSV first or use a library
    throw new Exception('File .xls không được hỗ trợ. Vui lòng lưu lại dưới dạng .xlsx hoặc .csv');
}

/**
 * Parse XLSX file using ZIP and XML
 */
function parseXLSX($filePath) {
    $zip = new ZipArchive();
    if ($zip->open($filePath) !== true) {
        throw new Exception('Không thể mở file Excel');
    }
    
    // Read shared strings
    $sharedStrings = [];
    $sharedStringsXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($sharedStringsXml) {
        $xml = simplexml_load_string($sharedStringsXml);
        foreach ($xml->si as $si) {
            if (isset($si->t)) {
                $sharedStrings[] = (string)$si->t;
            } elseif (isset($si->r)) {
                $text = '';
                foreach ($si->r as $r) {
                    $text .= (string)$r->t;
                }
                $sharedStrings[] = $text;
            }
        }
    }
    
    // Read sheet1
    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    if (!$sheetXml) {
        $zip->close();
        throw new Exception('Không tìm thấy sheet trong file Excel');
    }
    
    $xml = simplexml_load_string($sheetXml);
    $rows = [];
    
    foreach ($xml->sheetData->row as $row) {
        $rowData = [];
        $maxCol = 0;
        
        foreach ($row->c as $cell) {
            $cellRef = (string)$cell['r'];
            $colLetter = preg_replace('/[0-9]/', '', $cellRef);
            $colIndex = columnToIndex($colLetter);
            $maxCol = max($maxCol, $colIndex);
            
            $value = '';
            if (isset($cell['t']) && (string)$cell['t'] === 's') {
                // Shared string
                $stringIndex = (int)$cell->v;
                $value = $sharedStrings[$stringIndex] ?? '';
            } else {
                $value = (string)$cell->v;
            }
            
            $rowData[$colIndex] = $value;
        }
        
        // Fill empty cells
        $filledRow = [];
        for ($i = 0; $i <= $maxCol; $i++) {
            $filledRow[] = $rowData[$i] ?? '';
        }
        
        if (!empty(array_filter($filledRow))) {
            $rows[] = $filledRow;
        }
    }
    
    $zip->close();
    
    if (empty($rows)) {
        throw new Exception('File Excel rỗng');
    }
    
    // First row is header
    $header = array_shift($rows);
    $headerMap = normalizeHeaders($header);
    
    // Convert to associative array
    $students = [];
    foreach ($rows as $row) {
        $student = [];
        foreach ($headerMap as $key => $index) {
            $student[$key] = isset($row[$index]) ? trim($row[$index]) : '';
        }
        $students[] = $student;
    }
    
    return $students;
}

/**
 * Convert column letter to index (A=0, B=1, ...)
 */
function columnToIndex($col) {
    $col = strtoupper($col);
    $length = strlen($col);
    $index = 0;
    
    for ($i = 0; $i < $length; $i++) {
        $index = $index * 26 + (ord($col[$i]) - ord('A') + 1);
    }
    
    return $index - 1;
}

/**
 * Normalize header names to standard keys
 */
function normalizeHeaders($headers) {
    $map = [];
    $standardKeys = [
        'student_code' => ['mã hs', 'ma hs', 'mã học sinh', 'ma hoc sinh', 'student_code', 'mahs', 'mã'],
        'full_name' => ['họ tên', 'ho ten', 'họ và tên', 'ho va ten', 'full_name', 'tên', 'ten', 'hoten'],
        'gender' => ['giới tính', 'gioi tinh', 'gender', 'gt'],
        'date_of_birth' => ['ngày sinh', 'ngay sinh', 'date_of_birth', 'dob', 'sinh ngày', 'sinh ngay', 'ns'],
        'class_name' => ['lớp', 'lop', 'class', 'class_name', 'tên lớp', 'ten lop'],
        'avg_score' => ['đtb', 'dtb', 'điểm tb', 'diem tb', 'điểm trung bình', 'diem trung binh', 'avg_score', 'điểm', 'diem'],
        'hometown' => ['quê quán', 'que quan', 'hometown', 'quê', 'que'],
        'address' => ['địa chỉ', 'dia chi', 'address', 'đc'],
        'ethnicity' => ['dân tộc', 'dan toc', 'ethnicity', 'dt'],
        'parent_name' => ['phụ huynh', 'phu huynh', 'tên phụ huynh', 'ten phu huynh', 'parent_name', 'cha/mẹ', 'tên ph'],
        'parent_phone' => ['sđt phụ huynh', 'sdt phu huynh', 'phone', 'điện thoại', 'dien thoai', 'parent_phone', 'sđt', 'sdt ph'],
        'policy_object' => ['đối tượng cs', 'doi tuong cs', 'đối tượng chính sách', 'doi tuong chinh sach', 'policy_object', 'chính sách', 'chinh sach', 'đối tượng', 'doi tuong']
    ];
    
    foreach ($headers as $index => $header) {
        $headerLower = mb_strtolower(trim($header), 'UTF-8');
        
        foreach ($standardKeys as $key => $aliases) {
            foreach ($aliases as $alias) {
                if ($headerLower === $alias || strpos($headerLower, $alias) !== false) {
                    $map[$key] = $index;
                    break 2;
                }
            }
        }
    }
    
    return $map;
}

/**
 * Parse date in various formats
 */
function parseDate($dateStr) {
    if (empty($dateStr)) return null;
    
    // Try common formats
    $formats = [
        'd/m/Y', 'd-m-Y', 'Y-m-d', 'Y/m/d',
        'd/m/y', 'd-m-y', 'j/n/Y', 'j-n-Y'
    ];
    
    foreach ($formats as $format) {
        $date = DateTime::createFromFormat($format, $dateStr);
        if ($date) {
            return $date->format('Y-m-d');
        }
    }
    
    // Try strtotime
    $timestamp = strtotime($dateStr);
    if ($timestamp) {
        return date('Y-m-d', $timestamp);
    }
    
    // Excel serial date number
    if (is_numeric($dateStr)) {
        $unix = ($dateStr - 25569) * 86400;
        if ($unix > 0) {
            return date('Y-m-d', $unix);
        }
    }
    
    return null;
}
