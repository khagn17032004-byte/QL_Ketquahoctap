/**
 * Admin Schedule Module - Quản lý Thời Khóa Biểu
 */

const AdminSchedule = {
    classes: [],
    teachers: [],
    subjects: [],
    currentClassId: null,
    scheduleData: {},
    
    // Mapping môn học với tổ bộ môn
    subjectDepartmentMap: {
        'TOAN': ['Tổ Toán', 'Tổ Toán - Tin'],
        'TIN': ['Tổ Toán', 'Tổ Toán - Tin', 'Tổ Tin học'],
        'VAN': ['Tổ Ngữ văn', 'Tổ Văn'],
        'ANH': ['Tổ Ngoại ngữ', 'Tổ Tiếng Anh', 'Tổ Anh văn'],
        'LY': ['Tổ Vật lý', 'Tổ Vật lý - Công nghệ', 'Tổ Lý - Hóa'],
        'HOA': ['Tổ Hóa học', 'Tổ Hóa - Sinh', 'Tổ Lý - Hóa'],
        'SINH': ['Tổ Sinh học', 'Tổ Hóa - Sinh', 'Tổ Sinh - Địa'],
        'SU': ['Tổ Lịch sử', 'Tổ Sử - Địa', 'Tổ Xã hội'],
        'DIA': ['Tổ Địa lý', 'Tổ Sử - Địa', 'Tổ Sinh - Địa', 'Tổ Xã hội'],
        'GDCD': ['Tổ GDCD', 'Tổ Xã hội', 'Tổ Sử - Địa'],
        'CN': ['Tổ Công nghệ', 'Tổ Vật lý - Công nghệ'],
        'TD': ['Tổ Thể dục', 'Tổ Thể chất'],
        'QUOCPHONG': ['Tổ Quốc phòng', 'Tổ Thể dục', 'Tổ Thể chất'],
        'NHAC': ['Tổ Âm nhạc', 'Tổ Nghệ thuật'],
        'MT': ['Tổ Mỹ thuật', 'Tổ Nghệ thuật']
    },
    
    /**
     * Load dữ liệu cần thiết
     */
    async loadData() {
        try {
            // Load classes, teachers, subjects song song
            const [classRes, teacherRes, subjectRes] = await Promise.all([
                fetch('../api/classes.php'),
                fetch('../api/teachers.php'),
                fetch('../api/subjects.php')
            ]);
            
            const [classData, teacherData, subjectData] = await Promise.all([
                classRes.json(),
                teacherRes.json(),
                subjectRes.json()
            ]);
            
            if (classData.success) this.classes = classData.data || [];
            if (teacherData.success) this.teachers = teacherData.data || [];
            if (subjectData.success) this.subjects = subjectData.data || [];
            
            this.renderClassSelect();
            this.renderFilters();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    },
    
    /**
     * Render dropdown chọn lớp
     */
    renderClassSelect() {
        const select = document.getElementById('scheduleClassSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">-- Chọn lớp --</option>';
        
        // Nhóm theo khối
        const grouped = { 10: [], 11: [], 12: [] };
        this.classes.forEach(c => {
            if (grouped[c.grade_level]) {
                grouped[c.grade_level].push(c);
            }
        });
        
        [12, 11, 10].forEach(grade => {
            if (grouped[grade].length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = `Khối ${grade}`;
                grouped[grade].forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.class_name;
                    optgroup.appendChild(opt);
                });
                select.appendChild(optgroup);
            }
        });
    },
    
    /**
     * Render filters cho teacher và subject
     */
    renderFilters() {
        const teacherSelect = document.getElementById('scheduleTeacherFilter');
        const subjectSelect = document.getElementById('scheduleSubjectFilter');
        
        if (teacherSelect) {
            teacherSelect.innerHTML = '<option value="">Tất cả GV</option>';
            this.teachers.forEach(t => {
                teacherSelect.innerHTML += `<option value="${t.id}">${t.full_name} (${t.teacher_code})</option>`;
            });
        }
        
        if (subjectSelect) {
            subjectSelect.innerHTML = '<option value="">Tất cả môn</option>';
            this.subjects.forEach(s => {
                subjectSelect.innerHTML += `<option value="${s.id}">${s.subject_name}</option>`;
            });
        }
    },
    
    /**
     * Load TKB của một lớp
     */
    async loadClassSchedule(classId) {
        if (!classId) {
            this.renderEmptySchedule();
            return;
        }
        
        this.currentClassId = classId;
        
        try {
            const response = await fetch(`../api/schedule-manage.php?class_id=${classId}`);
            const result = await response.json();
            
            if (result.success) {
                this.scheduleData = result.data.formatted || {};
                this.renderScheduleEditor();
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    },
    
    /**
     * Render bảng TKB có thể edit
     */
    renderScheduleEditor() {
        const container = document.getElementById('scheduleEditorContainer');
        if (!container) return;
        
        const days = [
            { id: 2, name: 'Thứ 2' },
            { id: 3, name: 'Thứ 3' },
            { id: 4, name: 'Thứ 4' },
            { id: 5, name: 'Thứ 5' },
            { id: 6, name: 'Thứ 6' },
            { id: 7, name: 'Thứ 7' }
        ];
        
        const periods = [
            { id: 1, time: '07:00-07:45' },
            { id: 2, time: '07:50-08:35' },
            { id: 3, time: '08:50-09:35' },
            { id: 4, time: '09:40-10:25' },
            { id: 5, time: '10:30-11:15' },
            { id: 6, time: '13:30-14:15' },
            { id: 7, time: '14:20-15:05' },
            { id: 8, time: '15:20-16:05' },
            { id: 9, time: '16:10-16:55' },
            { id: 10, time: '17:00-17:45' }
        ];
        
        let html = `
            <div class="overflow-x-auto">
                <table class="w-full border-collapse text-sm">
                    <thead>
                        <tr class="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                            <th class="border border-indigo-400 p-2 w-20">Tiết</th>
                            <th class="border border-indigo-400 p-2 w-24">Giờ</th>
                            ${days.map(d => `<th class="border border-indigo-400 p-2">${d.name}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Buổi sáng
        html += `<tr class="bg-yellow-50"><td colspan="8" class="text-center font-semibold text-yellow-700 py-1">Buổi sáng</td></tr>`;
        
        for (let p = 1; p <= 5; p++) {
            html += this.renderPeriodRow(p, periods[p-1], days);
        }
        
        // Buổi chiều
        html += `<tr class="bg-orange-50"><td colspan="8" class="text-center font-semibold text-orange-700 py-1">Buổi chiều</td></tr>`;
        
        for (let p = 6; p <= 10; p++) {
            html += this.renderPeriodRow(p, periods[p-1], days);
        }
        
        html += `
                    </tbody>
                </table>
            </div>
            <div class="mt-4 flex gap-3">
                <button onclick="AdminSchedule.saveSchedule()" 
                    class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                    <i class="fas fa-save mr-2"></i>Lưu Thời Khóa Biểu
                </button>
                <button onclick="AdminSchedule.copyFromClass()" 
                    class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                    <i class="fas fa-copy mr-2"></i>Sao chép từ lớp khác
                </button>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    /**
     * Render một hàng tiết học
     */
    renderPeriodRow(period, periodInfo, days) {
        let html = `
            <tr class="hover:bg-gray-50">
                <td class="border p-2 text-center font-medium bg-gray-50">Tiết ${period}</td>
                <td class="border p-2 text-center text-xs text-gray-500">${periodInfo.time}</td>
        `;
        
        days.forEach(day => {
            const cell = this.scheduleData[day.id]?.[period];
            const subjectId = cell?.subject_id || '';
            const teacherId = cell?.teacher_id || '';
            
            // Lấy danh sách GV phù hợp với môn học đã chọn
            const filteredTeachers = subjectId ? this.getTeachersForSubject(subjectId) : this.teachers;
            
            html += `
                <td class="border p-1">
                    <select class="w-full text-xs border rounded p-1 mb-1 schedule-subject" 
                        data-day="${day.id}" data-period="${period}"
                        onchange="AdminSchedule.onSubjectChange(this)">
                        <option value="">-- Môn --</option>
                        ${this.subjects.map(s => 
                            `<option value="${s.id}" data-code="${s.subject_code}" ${s.id == subjectId ? 'selected' : ''}>${s.subject_name}</option>`
                        ).join('')}
                    </select>
                    <select class="w-full text-xs border rounded p-1 schedule-teacher" 
                        data-day="${day.id}" data-period="${period}">
                        <option value="">-- GV --</option>
                        ${filteredTeachers.map(t => 
                            `<option value="${t.id}" ${t.id == teacherId ? 'selected' : ''}>${t.full_name}</option>`
                        ).join('')}
                    </select>
                </td>
            `;
        });
        
        html += '</tr>';
        return html;
    },
    
    /**
     * Lấy danh sách GV có thể dạy môn học dựa trên tổ bộ môn
     */
    getTeachersForSubject(subjectId) {
        // Tìm subject code
        const subject = this.subjects.find(s => s.id == subjectId);
        if (!subject) return this.teachers;
        
        const subjectCode = subject.subject_code;
        const allowedDepartments = this.subjectDepartmentMap[subjectCode] || [];
        
        if (allowedDepartments.length === 0) {
            // Nếu không có mapping, cho phép tất cả GV
            return this.teachers;
        }
        
        // Lọc GV theo tổ bộ môn
        const filtered = this.teachers.filter(t => {
            if (!t.department) return false;
            const teacherDept = t.department.toLowerCase();
            return allowedDepartments.some(dept => 
                teacherDept.includes(dept.toLowerCase()) || 
                dept.toLowerCase().includes(teacherDept)
            );
        });
        
        // Nếu không tìm thấy GV nào, trả về tất cả (fallback)
        return filtered.length > 0 ? filtered : this.teachers;
    },
    
    /**
     * Render TKB trống
     */
    renderEmptySchedule() {
        const container = document.getElementById('scheduleEditorContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-calendar-alt text-5xl mb-4 text-gray-300"></i>
                <p>Chọn lớp để xem và chỉnh sửa thời khóa biểu</p>
            </div>
        `;
    },
    
    /**
     * Khi chọn môn, lọc danh sách GV theo tổ bộ môn
     */
    onSubjectChange(select) {
        const subjectId = select.value;
        const day = select.dataset.day;
        const period = select.dataset.period;
        
        // Tìm select GV tương ứng
        const teacherSelect = document.querySelector(
            `.schedule-teacher[data-day="${day}"][data-period="${period}"]`
        );
        
        if (!teacherSelect) return;
        
        // Lấy giá trị GV hiện tại
        const currentTeacherId = teacherSelect.value;
        
        // Lấy danh sách GV phù hợp
        const filteredTeachers = subjectId ? this.getTeachersForSubject(subjectId) : this.teachers;
        
        // Cập nhật dropdown GV
        teacherSelect.innerHTML = '<option value="">-- GV --</option>';
        filteredTeachers.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = t.full_name;
            // Giữ lại GV đã chọn nếu vẫn trong danh sách
            if (t.id == currentTeacherId) {
                option.selected = true;
            }
            teacherSelect.appendChild(option);
        });
        
        // Nếu GV hiện tại không còn phù hợp, reset về rỗng
        if (currentTeacherId && !filteredTeachers.find(t => t.id == currentTeacherId)) {
            teacherSelect.value = '';
        }
    },
    
    /**
     * Lưu TKB
     */
    async saveSchedule() {
        if (!this.currentClassId) {
            this.showError('Vui lòng chọn lớp');
            return;
        }
        
        const schedules = [];
        
        document.querySelectorAll('.schedule-subject').forEach(subjectSelect => {
            const day = parseInt(subjectSelect.dataset.day);
            const period = parseInt(subjectSelect.dataset.period);
            const subjectId = subjectSelect.value;
            
            const teacherSelect = document.querySelector(
                `.schedule-teacher[data-day="${day}"][data-period="${period}"]`
            );
            const teacherId = teacherSelect?.value || null;
            
            if (subjectId) {
                schedules.push({
                    day_of_week: day,
                    period: period,
                    subject_id: parseInt(subjectId),
                    teacher_id: teacherId ? parseInt(teacherId) : null
                });
            }
        });
        
        try {
            const response = await fetch('../api/schedule-manage.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'bulk_update',
                    class_id: this.currentClassId,
                    schedules: schedules
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('Đã lưu thời khóa biểu');
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error saving schedule:', error);
            this.showError('Không thể lưu thời khóa biểu');
        }
    },
    
    /**
     * Sao chép TKB từ lớp khác
     */
    async copyFromClass() {
        const sourceClass = prompt('Nhập ID lớp nguồn để sao chép TKB:');
        if (!sourceClass || !this.currentClassId) return;
        
        try {
            const response = await fetch(`../api/schedule-manage.php?class_id=${sourceClass}`);
            const result = await response.json();
            
            if (result.success) {
                this.scheduleData = result.data.formatted || {};
                this.renderScheduleEditor();
                this.showSuccess('Đã sao chép TKB. Nhấn Lưu để áp dụng.');
            }
        } catch (error) {
            this.showError('Không thể sao chép');
        }
    },
    
    showError(msg) {
        if (typeof showToast === 'function') showToast(msg, 'error');
        else alert(msg);
    },
    
    showSuccess(msg) {
        if (typeof showToast === 'function') showToast(msg, 'success');
        else alert(msg);
    },
    
    init() {
        this.loadData();
        
        const classSelect = document.getElementById('scheduleClassSelect');
        if (classSelect) {
            classSelect.addEventListener('change', (e) => {
                this.loadClassSchedule(e.target.value);
            });
        }
        
        this.renderEmptySchedule();
    }
};

window.AdminSchedule = AdminSchedule;
