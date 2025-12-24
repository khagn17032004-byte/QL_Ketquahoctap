/**
 * Teacher Schedule Module - Xem lịch giảng dạy
 */

const TeacherSchedule = {
    scheduleData: null,
    teachingClasses: [],
    
    /**
     * Load lịch giảng dạy
     */
    async loadSchedule() {
        try {
            const teacherId = teacherInfo?.id;
            if (!teacherId) {
                console.error('Teacher ID not found');
                return;
            }
            const response = await fetch(`${API_URL}/teacher-schedule.php?teacher_id=${teacherId}`);
            const result = await response.json();
            
            if (result.success) {
                this.scheduleData = result.data.schedule;
                this.teachingClasses = result.data.teaching_classes;
                this.renderScheduleTable(result.data);
                this.renderTeachingClasses();
                this.renderStats();
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.showError('Không thể tải lịch giảng dạy');
        }
    },
    
    /**
     * Render bảng thời khóa biểu
     */
    renderScheduleTable(data) {
        const container = document.getElementById('teacherScheduleTable');
        if (!container) return;
        
        const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        const periods = data.periods;
        const schedule = data.schedule;
        
        let html = `
            <div class="overflow-x-auto">
                <table class="w-full border-collapse bg-white rounded-lg overflow-hidden shadow">
                    <thead>
                        <tr class="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                            <th class="border border-blue-400 p-3 w-24">Tiết</th>
                            <th class="border border-blue-400 p-3 w-20">Giờ</th>
        `;
        
        days.forEach(day => {
            html += `<th class="border border-blue-400 p-3">${day}</th>`;
        });
        
        html += '</tr></thead><tbody>';
        
        // Buổi sáng
        html += `<tr class="bg-yellow-50"><td colspan="8" class="text-center font-semibold text-yellow-700 py-2">
            <i class="fas fa-sun mr-2"></i>Buổi sáng
        </td></tr>`;
        
        for (let p = 1; p <= 5; p++) {
            const period = periods[p];
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="border p-2 text-center font-medium bg-gray-50">Tiết ${p}</td>
                    <td class="border p-2 text-center text-xs text-gray-500">${period.start}<br>${period.end}</td>
            `;
            
            for (let d = 2; d <= 7; d++) {
                const cell = schedule[d]?.[p];
                if (cell) {
                    html += `
                        <td class="border p-2 text-center bg-blue-50">
                            <div class="font-medium text-blue-700">${cell.class_name}</div>
                            <div class="text-xs text-gray-500">${cell.subject}</div>
                            ${cell.room ? `<div class="text-xs text-gray-400">Phòng: ${cell.room}</div>` : ''}
                        </td>
                    `;
                } else {
                    html += '<td class="border p-2 text-center text-gray-300">-</td>';
                }
            }
            
            html += '</tr>';
        }
        
        // Buổi chiều
        html += `<tr class="bg-orange-50"><td colspan="8" class="text-center font-semibold text-orange-700 py-2">
            <i class="fas fa-cloud-sun mr-2"></i>Buổi chiều
        </td></tr>`;
        
        for (let p = 6; p <= 10; p++) {
            const period = periods[p];
            html += `
                <tr class="hover:bg-gray-50">
                    <td class="border p-2 text-center font-medium bg-gray-50">Tiết ${p}</td>
                    <td class="border p-2 text-center text-xs text-gray-500">${period.start}<br>${period.end}</td>
            `;
            
            for (let d = 2; d <= 7; d++) {
                const cell = schedule[d]?.[p];
                if (cell) {
                    html += `
                        <td class="border p-2 text-center bg-green-50">
                            <div class="font-medium text-green-700">${cell.class_name}</div>
                            <div class="text-xs text-gray-500">${cell.subject}</div>
                            ${cell.room ? `<div class="text-xs text-gray-400">Phòng: ${cell.room}</div>` : ''}
                        </td>
                    `;
                } else {
                    html += '<td class="border p-2 text-center text-gray-300">-</td>';
                }
            }
            
            html += '</tr>';
        }
        
        html += '</tbody></table></div>';
        
        container.innerHTML = html;
    },
    
    /**
     * Render danh sách lớp đang dạy
     */
    renderTeachingClasses() {
        const container = document.getElementById('teachingClassesList');
        if (!container) return;
        
        if (this.teachingClasses.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Chưa có lớp được phân công</p>';
            return;
        }
        
        let html = '<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">';
        
        this.teachingClasses.forEach(c => {
            const isHomeroom = c.is_homeroom === 1 || c.is_homeroom === '1';
            html += `
                <div class="p-3 rounded-lg border ${isHomeroom ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center ${isHomeroom ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'}">
                            <i class="fas ${isHomeroom ? 'fa-star' : 'fa-users'} text-xs"></i>
                        </div>
                        <div>
                            <p class="font-semibold text-gray-800">${c.name}</p>
                            <p class="text-xs ${isHomeroom ? 'text-blue-600' : 'text-gray-500'}">
                                ${isHomeroom ? 'Chủ nhiệm' : 'Giảng dạy'}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    /**
     * Thống kê số tiết dạy
     */
    getScheduleStats() {
        if (!this.scheduleData) return { total: 0, morning: 0, afternoon: 0 };
        
        let total = 0, morning = 0, afternoon = 0;
        
        for (const day in this.scheduleData) {
            for (const period in this.scheduleData[day]) {
                if (this.scheduleData[day][period]) {
                    total++;
                    if (parseInt(period) <= 5) {
                        morning++;
                    } else {
                        afternoon++;
                    }
                }
            }
        }
        
        return { total, morning, afternoon };
    },
    
    /**
     * Render thống kê
     */
    renderStats() {
        const container = document.getElementById('scheduleStats');
        if (!container) return;
        
        const stats = this.getScheduleStats();
        
        container.innerHTML = `
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                    <div class="text-3xl font-bold">${stats.total}</div>
                    <div class="text-blue-100 text-sm">Tổng số tiết/tuần</div>
                </div>
                <div class="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg p-4 text-white">
                    <div class="text-3xl font-bold">${stats.morning}</div>
                    <div class="text-yellow-100 text-sm">Tiết buổi sáng</div>
                </div>
                <div class="bg-gradient-to-br from-green-500 to-teal-500 rounded-lg p-4 text-white">
                    <div class="text-3xl font-bold">${stats.afternoon}</div>
                    <div class="text-green-100 text-sm">Tiết buổi chiều</div>
                </div>
            </div>
        `;
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
     * Khởi tạo module
     */
    init() {
        // Note: loadSchedule will be called from teacher-init.js after teacherInfo is loaded
        // Just setup any event listeners here if needed
    }
};

// Export
window.TeacherSchedule = TeacherSchedule;
