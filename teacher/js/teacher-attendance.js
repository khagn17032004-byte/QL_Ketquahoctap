/**
 * Teacher Attendance Module - Điểm danh học sinh
 */

const TeacherAttendance = {
    currentClass: null,
    currentDate: new Date().toISOString().split('T')[0],
    attendanceData: [],
    
    /**
     * Load danh sách lớp giáo viên dạy
     */
    async loadTeachingClasses() {
        try {
            const teacherId = teacherInfo?.id;
            if (!teacherId) {
                this.showError('Không tìm thấy thông tin giáo viên');
                return;
            }
            const response = await fetch(`${API_URL}/teacher-schedule.php?teacher_id=${teacherId}`);
            const result = await response.json();
            
            if (result.success && result.data.teaching_classes) {
                this.renderClassSelect(result.data.teaching_classes);
            }
        } catch (error) {
            console.error('Error loading teaching classes:', error);
        }
    },
    
    /**
     * Render dropdown chọn lớp
     */
    renderClassSelect(classes) {
        const select = document.getElementById('attendanceClassSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Chọn lớp --</option>';
        classes.forEach(c => {
            const homeroom = c.is_homeroom ? ' (Chủ nhiệm)' : '';
            select.innerHTML += `<option value="${c.id}">${c.name}${homeroom}</option>`;
        });
    },
    
    /**
     * Load điểm danh theo lớp và ngày
     */
    async loadAttendance(classId, date) {
        if (!classId) return;
        
        try {
            const teacherId = teacherInfo?.id;
            if (!teacherId) {
                this.showError('Không tìm thấy thông tin giáo viên');
                return;
            }
            const response = await fetch(`${API_URL}/attendance.php?class_id=${classId}&date=${date}&teacher_id=${teacherId}`);
            const result = await response.json();
            
            if (result.success) {
                this.attendanceData = result.data.students;
                this.renderAttendanceTable(result.data);
                this.renderStats(result.data.stats);
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error loading attendance:', error);
            this.showError('Không thể tải dữ liệu điểm danh');
        }
    },
    
    /**
     * Render bảng điểm danh
     */
    renderAttendanceTable(data) {
        const container = document.getElementById('attendanceTableContainer');
        if (!container) return;
        
        if (!data.students || data.students.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-users text-4xl mb-3"></i>
                    <p>Không có học sinh trong lớp này</p>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="mb-4 flex items-center justify-between">
                <h4 class="font-semibold text-gray-700">
                    <i class="fas fa-calendar-day text-blue-500 mr-2"></i>
                    Điểm danh lớp ${data.class_name} - Ngày ${this.formatDate(data.date)}
                </h4>
                <button onclick="TeacherAttendance.markAllPresent()" 
                    class="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition">
                    <i class="fas fa-check-double mr-1"></i>Đánh dấu tất cả có mặt
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full border-collapse">
                    <thead>
                        <tr class="bg-gray-50">
                            <th class="border p-2 text-left w-12">STT</th>
                            <th class="border p-2 text-left">Mã HS</th>
                            <th class="border p-2 text-left">Họ và tên</th>
                            <th class="border p-2 text-center">Có mặt</th>
                            <th class="border p-2 text-center">Vắng</th>
                            <th class="border p-2 text-center">Trễ</th>
                            <th class="border p-2 text-center">Có phép</th>
                            <th class="border p-2 text-left">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.students.forEach((s, idx) => {
            const status = s.status || '';
            html += `
                <tr class="hover:bg-gray-50" data-student-id="${s.id}">
                    <td class="border p-2 text-center">${idx + 1}</td>
                    <td class="border p-2">${s.student_code}</td>
                    <td class="border p-2 font-medium">${s.full_name}</td>
                    <td class="border p-2 text-center">
                        <input type="radio" name="status_${s.id}" value="present" 
                            ${status === 'present' ? 'checked' : ''} 
                            class="w-4 h-4 text-green-600 attendance-radio">
                    </td>
                    <td class="border p-2 text-center">
                        <input type="radio" name="status_${s.id}" value="absent" 
                            ${status === 'absent' ? 'checked' : ''} 
                            class="w-4 h-4 text-red-600 attendance-radio">
                    </td>
                    <td class="border p-2 text-center">
                        <input type="radio" name="status_${s.id}" value="late" 
                            ${status === 'late' ? 'checked' : ''} 
                            class="w-4 h-4 text-yellow-600 attendance-radio">
                    </td>
                    <td class="border p-2 text-center">
                        <input type="radio" name="status_${s.id}" value="excused" 
                            ${status === 'excused' ? 'checked' : ''} 
                            class="w-4 h-4 text-blue-600 attendance-radio">
                    </td>
                    <td class="border p-2">
                        <input type="text" class="w-full border-0 bg-transparent focus:ring-0 text-sm attendance-note"
                            data-student-id="${s.id}" value="${s.note || ''}" placeholder="Ghi chú...">
                    </td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="mt-4 flex justify-end">
                <button onclick="TeacherAttendance.saveAttendance()" 
                    class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                    <i class="fas fa-save"></i>Lưu điểm danh
                </button>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    /**
     * Render thống kê
     */
    renderStats(stats) {
        const container = document.getElementById('attendanceStats');
        if (!container || !stats) return;
        
        container.innerHTML = `
            <div class="grid grid-cols-5 gap-3">
                <div class="bg-gray-100 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-gray-700">${stats.total}</div>
                    <div class="text-xs text-gray-500">Tổng số</div>
                </div>
                <div class="bg-green-100 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-green-600">${stats.present}</div>
                    <div class="text-xs text-green-600">Có mặt</div>
                </div>
                <div class="bg-red-100 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-red-600">${stats.absent}</div>
                    <div class="text-xs text-red-600">Vắng</div>
                </div>
                <div class="bg-yellow-100 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-yellow-600">${stats.late}</div>
                    <div class="text-xs text-yellow-600">Trễ</div>
                </div>
                <div class="bg-blue-100 rounded-lg p-3 text-center">
                    <div class="text-2xl font-bold text-blue-600">${stats.excused}</div>
                    <div class="text-xs text-blue-600">Có phép</div>
                </div>
            </div>
        `;
    },
    
    /**
     * Đánh dấu tất cả có mặt
     */
    markAllPresent() {
        document.querySelectorAll('input[value="present"].attendance-radio').forEach(radio => {
            radio.checked = true;
        });
    },
    
    /**
     * Lưu điểm danh
     */
    async saveAttendance() {
        const classId = document.getElementById('attendanceClassSelect')?.value;
        const teacherId = teacherInfo?.id;
        
        if (!classId) {
            this.showError('Vui lòng chọn lớp');
            return;
        }
        
        if (!teacherId) {
            this.showError('Không tìm thấy thông tin giáo viên');
            return;
        }
        
        const attendance = [];
        document.querySelectorAll('#attendanceTableContainer tbody tr').forEach(row => {
            const studentId = row.dataset.studentId;
            const checkedRadio = row.querySelector('input[type="radio"]:checked');
            const noteInput = row.querySelector('.attendance-note');
            
            if (studentId && checkedRadio) {
                attendance.push({
                    student_id: parseInt(studentId),
                    status: checkedRadio.value,
                    note: noteInput?.value || ''
                });
            }
        });
        
        if (attendance.length === 0) {
            this.showError('Vui lòng điểm danh ít nhất 1 học sinh');
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/attendance.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_id: classId,
                    teacher_id: teacherId,
                    date: this.currentDate,
                    attendance: attendance
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess(result.message);
                // Reload để cập nhật thống kê
                this.loadAttendance(classId, this.currentDate);
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error saving attendance:', error);
            this.showError('Không thể lưu điểm danh');
        }
    },
    
    /**
     * Format ngày
     */
    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    },
    
    /**
     * Hiển thị thông báo lỗi
     */
    showError(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert(message);
        }
    },
    
    /**
     * Hiển thị thông báo thành công
     */
    showSuccess(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'success');
        } else {
            alert(message);
        }
    },
    
    /**
     * Khởi tạo module
     */
    init() {
        // Note: loadTeachingClasses will be called from teacher-init.js after teacherInfo is loaded
        
        // Bind events
        const classSelect = document.getElementById('attendanceClassSelect');
        if (classSelect) {
            classSelect.addEventListener('change', (e) => {
                this.currentClass = e.target.value;
                if (this.currentClass) {
                    this.loadAttendance(this.currentClass, this.currentDate);
                }
            });
        }
        
        const dateInput = document.getElementById('attendanceDateInput');
        if (dateInput) {
            dateInput.value = this.currentDate;
            dateInput.addEventListener('change', (e) => {
                this.currentDate = e.target.value;
                if (this.currentClass) {
                    this.loadAttendance(this.currentClass, this.currentDate);
                }
            });
        }
    }
};

// Export
window.TeacherAttendance = TeacherAttendance;
