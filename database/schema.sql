-- ============================================
-- HỆ THỐNG QUẢN LÝ KẾT QUẢ HỌC TẬP THPT
-- Database: ql_ketquahoctap
-- ============================================

-- Sử dụng database
USE ql_ketquahoctap;

-- ============================================
-- BẢNG USERS (Tài khoản đăng nhập)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('student', 'teacher', 'admin') NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG CLASSES (Lớp học)
-- ============================================
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_name VARCHAR(20) NOT NULL,
    grade_level INT NOT NULL COMMENT 'Khối: 10, 11, 12',
    academic_year VARCHAR(20) NOT NULL COMMENT 'Năm học: 2024-2025',
    homeroom_teacher_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG SUBJECTS (Môn học)
-- ============================================
CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_code VARCHAR(20) NOT NULL UNIQUE,
    subject_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG TEACHERS (Giáo viên)
-- ============================================
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    teacher_code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    gender ENUM('Nam', 'Nữ') NOT NULL,
    birth_date DATE,
    address TEXT,
    department VARCHAR(100) COMMENT 'Tổ bộ môn',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG STUDENTS (Học sinh)
-- ============================================
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    student_code VARCHAR(20) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    gender ENUM('Nam', 'Nữ') NOT NULL,
    birth_date DATE,
    birth_year INT,
    hometown VARCHAR(100) COMMENT 'Quê quán',
    address TEXT,
    ethnicity VARCHAR(50) DEFAULT 'Kinh' COMMENT 'Dân tộc',
    policy_object VARCHAR(100) DEFAULT NULL COMMENT 'Đối tượng chính sách: con_thuong_binh_liet_si, ho_ngheo, ho_can_ngheo, dan_toc_thieu_so, khuyet_tat',
    religion VARCHAR(50) DEFAULT 'Không' COMMENT 'Tôn giáo',
    class_id INT,
    parent_name VARCHAR(100),
    parent_phone VARCHAR(20),
    parent_email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG TEACHER_SUBJECTS (GV dạy môn nào)
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    subject_id INT NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_teacher_subject (teacher_id, subject_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG TEACHER_CLASSES (GV dạy lớp nào)
-- ============================================
CREATE TABLE IF NOT EXISTS teacher_classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    class_id INT NOT NULL,
    subject_id INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_teacher_class_subject (teacher_id, class_id, subject_id, academic_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG GRADES (Điểm số)
-- ============================================
CREATE TABLE IF NOT EXISTS grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    semester ENUM('HK1', 'HK2') NOT NULL,
    
    -- Điểm thường xuyên (ĐĐGtx) - hệ số 1
    oral_score DECIMAL(4,2) DEFAULT NULL COMMENT 'Điểm miệng',
    score_15min DECIMAL(4,2) DEFAULT NULL COMMENT 'Điểm 15 phút',
    score_1hour DECIMAL(4,2) DEFAULT NULL COMMENT 'Điểm 1 tiết',
    
    -- Điểm giữa kỳ (ĐĐGgk) - hệ số 2
    midterm_score DECIMAL(4,2) DEFAULT NULL,
    
    -- Điểm cuối kỳ (ĐĐGck) - hệ số 3
    final_score DECIMAL(4,2) DEFAULT NULL,
    
    -- Điểm trung bình môn học kỳ (ĐTBmhk)
    -- Công thức: ĐTBmhk = (TĐĐGtx + 2 × ĐĐGgk + 3 × ĐĐGck) / (Số ĐĐGtx + 5)
    average_score DECIMAL(4,2) DEFAULT NULL,
    
    -- Nhận xét của giáo viên
    teacher_comment TEXT,
    
    -- GV nhập điểm
    graded_by INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES teachers(id) ON DELETE SET NULL,
    UNIQUE KEY unique_student_subject_semester (student_id, subject_id, academic_year, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG CONDUCT (Hạnh kiểm)
-- ============================================
CREATE TABLE IF NOT EXISTS conduct (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    semester ENUM('HK1', 'HK2') NOT NULL,
    rating ENUM('Tốt', 'Khá', 'Trung bình', 'Yếu') NOT NULL,
    comment TEXT,
    rated_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (rated_by) REFERENCES teachers(id) ON DELETE SET NULL,
    UNIQUE KEY unique_student_conduct (student_id, academic_year, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG UPDATE_REQUESTS (Yêu cầu cập nhật thông tin)
-- ============================================
CREATE TABLE IF NOT EXISTS update_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NULL COMMENT 'ID học sinh (NULL nếu yêu cầu từ giáo viên)',
    teacher_id INT NULL COMMENT 'ID giáo viên (NULL nếu yêu cầu từ học sinh)',
    request_type VARCHAR(50) NOT NULL DEFAULT 'other' COMMENT 'Loại yêu cầu: profile, grades, other',
    content TEXT NOT NULL COMMENT 'Nội dung yêu cầu',
    old_value TEXT COMMENT 'Giá trị cũ (tùy chọn)',
    new_value TEXT COMMENT 'Giá trị mới đề xuất (tùy chọn)',
    reason TEXT COMMENT 'Lý do yêu cầu (tùy chọn)',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    admin_note TEXT COMMENT 'Ghi chú của admin',
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL COMMENT 'Thời gian xử lý yêu cầu',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Đảm bảo chỉ có student_id HOẶC teacher_id, không cả hai
    CHECK (
        (student_id IS NOT NULL AND teacher_id IS NULL) OR 
        (student_id IS NULL AND teacher_id IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- BẢNG NOTIFICATIONS (Thông báo)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DỮ LIỆU MẪU
-- ============================================

-- Thêm môn học
INSERT INTO subjects (subject_code, subject_name) VALUES
('TOAN', 'Toán'),
('VAN', 'Ngữ văn'),
('ANH', 'Tiếng Anh'),
('LY', 'Vật lý'),
('HOA', 'Hóa học'),
('SINH', 'Sinh học'),
('SU', 'Lịch sử'),
('DIA', 'Địa lý'),
('GDCD', 'GDCD'),
('TIN', 'Tin học'),
('CN', 'Công nghệ'),
('TD', 'Thể dục');

-- Thêm lớp học
INSERT INTO classes (class_name, grade_level, academic_year) VALUES
('12A1', 12, '2024-2025'),
('12A2', 12, '2024-2025'),
('12A3', 12, '2024-2025'),
('11A1', 11, '2024-2025'),
('11A2', 11, '2024-2025'),
('10A1', 10, '2024-2025'),
('10A2', 10, '2024-2025');

-- Thêm tài khoản admin
INSERT INTO users (username, password, role, email, status) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'admin@school.edu.vn', 'active');
-- Mật khẩu: password (đã hash bằng bcrypt)

-- Thêm tài khoản giáo viên mẫu
INSERT INTO users (username, password, role, email, status) VALUES
('GV001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher', 'nguyenan@school.edu.vn', 'active'),
('GV002', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'teacher', 'tranbinh@school.edu.vn', 'active');

-- Thêm thông tin giáo viên
INSERT INTO teachers (user_id, teacher_code, full_name, gender, department) VALUES
(2, 'GV001', 'Nguyễn An', 'Nam', 'Tổ Toán'),
(3, 'GV002', 'Trần Bình', 'Nam', 'Tổ Văn');

-- Cập nhật giáo viên chủ nhiệm cho lớp
UPDATE classes SET homeroom_teacher_id = 1 WHERE class_name = '12A1';
UPDATE classes SET homeroom_teacher_id = 2 WHERE class_name = '12A2';

-- Thêm tài khoản học sinh mẫu
INSERT INTO users (username, password, role, email, status) VALUES
('HS001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'nguyenminhanh@gmail.com', 'active'),
('HS002', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'tranthib@gmail.com', 'active'),
('HS003', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'levanhung@gmail.com', 'active'),
('HS004', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'student', 'phamthid@gmail.com', 'active');

-- Thêm thông tin học sinh
INSERT INTO students (user_id, student_code, full_name, gender, birth_year, hometown, address, class_id, parent_name, parent_phone, parent_email) VALUES
(4, '12A1001', 'Nguyễn Minh Anh', 'Nam', 2007, 'Hà Nội', '123 Đường Láng, Đống Đa, Hà Nội', 1, 'Nguyễn Văn Hùng', '0912345678', 'nguyenvanhung@gmail.com'),
(5, '12A1002', 'Trần Thị B', 'Nữ', 2007, 'Hà Nội', '456 Kim Mã, Ba Đình, Hà Nội', 1, 'Trần Văn C', '0923456789', 'tranvanc@gmail.com'),
(6, '12A1003', 'Lê Văn Hùng', 'Nam', 2007, 'Hải Phòng', '789 Lê Lợi, Ngô Quyền, Hải Phòng', 1, 'Lê Thị M', '0934567890', 'lethim@gmail.com'),
(7, '12A1004', 'Phạm Thị D', 'Nữ', 2007, 'Hà Nội', '321 Nguyễn Trãi, Thanh Xuân, Hà Nội', 1, 'Phạm Văn E', '0945678901', 'phamvane@gmail.com');

-- Thêm điểm mẫu cho học sinh 1 (Nguyễn Minh Anh) - HK1
INSERT INTO grades (student_id, subject_id, academic_year, semester, oral_score, score_15min, score_1hour, midterm_score, final_score, average_score, graded_by) VALUES
(1, 1, '2024-2025', 'HK1', 8.0, 7.5, 8.0, 8.5, 8.0, 8.0, 1),  -- Toán
(1, 2, '2024-2025', 'HK1', 7.0, 7.0, 7.5, 8.0, 7.5, 7.4, 2),  -- Văn
(1, 3, '2024-2025', 'HK1', 8.5, 8.0, 8.5, 9.0, 8.5, 8.5, 1),  -- Anh
(1, 4, '2024-2025', 'HK1', 7.5, 7.0, 7.5, 8.0, 7.0, 7.4, 1),  -- Lý
(1, 5, '2024-2025', 'HK1', 8.0, 7.5, 8.0, 8.0, 8.5, 8.0, 1),  -- Hóa
(1, 6, '2024-2025', 'HK1', 7.0, 7.5, 7.0, 7.5, 7.5, 7.3, 1),  -- Sinh
(1, 7, '2024-2025', 'HK1', 8.0, 8.0, 8.5, 8.0, 8.0, 8.1, 1),  -- Sử
(1, 8, '2024-2025', 'HK1', 7.5, 7.5, 8.0, 7.5, 8.0, 7.7, 1);  -- Địa

-- Thêm điểm mẫu cho học sinh 2 - HK1
INSERT INTO grades (student_id, subject_id, academic_year, semester, oral_score, score_15min, score_1hour, midterm_score, final_score, average_score, graded_by) VALUES
(2, 1, '2024-2025', 'HK1', 9.0, 8.5, 9.0, 9.0, 9.5, 9.1, 1),
(2, 2, '2024-2025', 'HK1', 8.5, 8.0, 8.5, 8.5, 9.0, 8.5, 2),
(2, 3, '2024-2025', 'HK1', 7.5, 7.0, 7.5, 8.0, 7.5, 7.5, 1);

-- Thêm điểm mẫu cho học sinh 3 - HK1
INSERT INTO grades (student_id, subject_id, academic_year, semester, oral_score, score_15min, score_1hour, midterm_score, final_score, average_score, graded_by) VALUES
(3, 1, '2024-2025', 'HK1', 6.0, 5.5, 6.0, 6.5, 6.0, 6.0, 1),
(3, 2, '2024-2025', 'HK1', 5.5, 5.0, 5.5, 6.0, 5.5, 5.5, 2);

-- Thêm hạnh kiểm mẫu
INSERT INTO conduct (student_id, academic_year, semester, rating, comment, rated_by) VALUES
(1, '2024-2025', 'HK1', 'Tốt', 'Học sinh chăm ngoan, tích cực tham gia hoạt động lớp.', 1),
(2, '2024-2025', 'HK1', 'Tốt', 'Học sinh xuất sắc, là lớp trưởng gương mẫu.', 1),
(3, '2024-2025', 'HK1', 'Khá', 'Cần cố gắng hơn trong học tập.', 1),
(4, '2024-2025', 'HK1', 'Tốt', 'Học sinh ngoan, có ý thức kỷ luật tốt.', 1);

-- Thêm giáo viên dạy môn
INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES
(1, 1),  -- GV001 dạy Toán
(1, 4),  -- GV001 dạy Lý
(2, 2);  -- GV002 dạy Văn

-- Thêm giáo viên dạy lớp
INSERT INTO teacher_classes (teacher_id, class_id, subject_id, academic_year) VALUES
(1, 1, 1, '2024-2025'),  -- GV001 dạy Toán lớp 12A1
(1, 2, 1, '2024-2025'),  -- GV001 dạy Toán lớp 12A2
(2, 1, 2, '2024-2025'),  -- GV002 dạy Văn lớp 12A1
(2, 2, 2, '2024-2025');  -- GV002 dạy Văn lớp 12A2

-- ============================================
-- LƯU Ý: Mật khẩu mặc định cho tất cả tài khoản là: password
-- Hash: $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
-- ============================================
