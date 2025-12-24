/**
 * Admin Class Statistics Module - Thống kê lớp yếu, hỗ trợ phụ đạo
 */

const AdminClassStats = {
    classes: [],
    weakStudents: [],
    weakSubjects: {},
    summary: {},
    currentFilter: { gradeLevel: 0, onlyWeak: false },

    /**
     * Load thống kê
     */
    async loadStatistics() {
        try {
            let url = '../api/class-statistics.php?';
            if (this.currentFilter.gradeLevel) url += `grade_level=${this.currentFilter.gradeLevel}&`;
            if (this.currentFilter.onlyWeak) url += 'only_weak=1&';
            url += 'semester=1';

            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                this.classes = result.data.classes || [];
                this.weakStudents = result.data.weak_students || [];
                this.weakSubjects = result.data.weak_subjects || {};
                this.summary = result.summary || {};

                this.renderSummary();
                this.renderClassesTable();
                this.renderWeakStudents();
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    },

    /**
     * Render tổng quan
     */
    renderSummary() {
        const container = document.getElementById('classStatsSummary');
        if (!container) return;

        const s = this.summary;

        container.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
                    <div class="text-3xl font-bold">${s.total_classes || 0}</div>
                    <div class="text-blue-100 text-sm">Tổng số lớp</div>
                </div>
                <div class="bg-gradient-to-br from-red-500 to-pink-600 rounded-xl p-4 text-white">
                    <div class="text-3xl font-bold">${s.weak_classes || 0}</div>
                    <div class="text-red-100 text-sm">Lớp cần hỗ trợ</div>
                </div>
                <div class="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-4 text-white">
                    <div class="text-3xl font-bold">${s.grade12_weak || 0}</div>
                    <div class="text-orange-100 text-sm">Lớp 12 yếu</div>
                    <div class="text-orange-200 text-[10px] font-medium">(ưu tiên cao)</div>
                </div>
                <div class="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl p-4 text-white">
                    <div class="text-3xl font-bold">${s.total_weak_students || 0}</div>
                    <div class="text-purple-100 text-sm">HS yếu kém</div>
                </div>
            </div>
        `;
    },

    /**
     * Render bảng thống kê các lớp
     */
    renderClassesTable() {
        const container = document.getElementById('classStatsTableBody');
        if (!container) return;

        if (this.classes.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-8 text-gray-500">
                        Không có dữ liệu thống kê
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = this.classes.map((c, idx) => {
            const priorityBadge = c.priority === 'high'
                ? '<span class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium ml-1">Ưu tiên</span>'
                : '';

            const grade12Badge = c.grade_level == 12
                ? '<span class="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium ml-1">Lớp 12</span>'
                : '';

            const weakSubjectsForClass = this.weakSubjects[c.class_id] || [];
            const weakSubjectsText = weakSubjectsForClass.map(s =>
                `${s.subject_name}: ${s.avg_score}`
            ).join(', ') || '-';
            const shortWeakSubjects = weakSubjectsForClass.length > 0
                ? weakSubjectsForClass.slice(0, 2).map(s => `${s.subject_name}: ${s.avg_score}`).join(', ')
                + (weakSubjectsForClass.length > 2 ? '...' : '')
                : '-';

            return `
                <tr class="hover:bg-gray-50 border-b ${c.needs_support ? 'bg-red-50' : ''}">
                    <td class="px-4 py-3">${idx + 1}</td>
                    <td class="px-4 py-3">
                        <span class="font-medium">${c.class_name}</span>
                        ${grade12Badge}${priorityBadge}
                    </td>
                    <td class="px-4 py-3 text-center">${c.total_students}</td>
                    <td class="px-4 py-3 text-center">
                        <span class="text-lg font-bold ${c.avg_final_score < 5 ? 'text-red-600' : c.avg_final_score < 6.5 ? 'text-yellow-600' : 'text-green-600'}">
                            ${c.avg_final_score || '-'}
                        </span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">${c.weak_count}</span>
                        <span class="text-gray-400 text-xs">(${c.weak_percent}%)</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">${c.medium_count}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded">${c.good_count}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="px-2 py-1 bg-green-100 text-green-700 rounded">${c.excellent_count}</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600 max-w-[200px]" title="${weakSubjectsText}">
                        <div class="truncate">${shortWeakSubjects}</div>
                    </td>
                    <td class="px-4 py-3">
                        ${c.needs_support ? `
                            <button onclick="AdminClassStats.openSupportModal(${c.class_id})" 
                                class="px-2 py-1.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 whitespace-nowrap" 
                                title="Gửi yêu cầu phụ đạo">
                                Phụ đạo
                            </button>
                        ` : `
                            <span class="text-green-600 text-sm font-medium">OK</span>
                        `}
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Render danh sách HS yếu
     */
    renderWeakStudents() {
        const container = document.getElementById('weakStudentsList');
        if (!container) return;

        if (this.weakStudents.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Không có học sinh yếu kém</p>';
            return;
        }

        // Ưu tiên lớp 12 lên đầu
        const sorted = [...this.weakStudents].sort((a, b) => {
            if (a.grade_level === 12 && b.grade_level !== 12) return -1;
            if (b.grade_level === 12 && a.grade_level !== 12) return 1;
            return a.avg_score - b.avg_score;
        });

        container.innerHTML = `
            <div class="max-h-96 overflow-y-auto">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 sticky top-0">
                        <tr>
                            <th class="px-3 py-2 text-left">Học sinh</th>
                            <th class="px-3 py-2 text-left">Lớp</th>
                            <th class="px-3 py-2 text-center">TB</th>
                            <th class="px-3 py-2 text-left">Môn yếu</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${sorted.slice(0, 30).map(s => `
                            <tr class="hover:bg-gray-50 ${s.grade_level == 12 ? 'bg-orange-50' : ''}">
                                <td class="px-3 py-2">
                                    <p class="font-medium">${s.full_name}</p>
                                    <p class="text-xs text-gray-500">${s.student_code}</p>
                                </td>
                                <td class="px-3 py-2">
                                    ${s.class_name}
                                    ${s.grade_level == 12 ? '<span class="text-xs text-orange-600 ml-1">(12)</span>' : ''}
                                </td>
                                <td class="px-3 py-2 text-center">
                                    <span class="text-red-600 font-bold">${s.avg_score}</span>
                                </td>
                                <td class="px-3 py-2 text-xs text-gray-600">${s.weak_subjects || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Mở modal hỗ trợ phụ đạo - Gửi thông báo đến GVCN
     */
    async openSupportModal(classId) {
        const classInfo = this.classes.find(c => c.class_id === classId);
        if (!classInfo) return;

        const weakSubjectsForClass = this.weakSubjects[classId] || [];
        const weakSubjectsList = weakSubjectsForClass.map(s => `${s.subject_name}: ${s.avg_score}`).join(', ') || 'Chưa xác định';

        const message = `Kính gửi thầy/cô ${classInfo.homeroom_teacher || 'GVCN'},\n\nTheo thống kê học kỳ hiện tại, lớp ${classInfo.class_name} cần được hỗ trợ phụ đạo:\n\n📊 THỐNG KÊ HỌC LỰC:\n- Sĩ số: ${classInfo.total_students} học sinh\n- Điểm TB lớp: ${classInfo.avg_final_score || 'Chưa có'}\n- HS Yếu: ${classInfo.weak_count} (${classInfo.weak_percent}%)\n\n📚 Môn cần cải thiện: ${weakSubjectsList}\n\nĐề nghị thầy/cô lập kế hoạch phụ đạo và báo cáo về Ban Giám hiệu.`;

        UI.modal.confirm({
            title: 'Gửi Thông Báo Phụ Đạo',
            message: `
                <div class="text-left space-y-4">
                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div class="text-sm font-semibold text-slate-900">Người nhận:</div>
                        <div class="text-slate-600">${classInfo.homeroom_teacher || 'GVCN'} (Lớp ${classInfo.class_name})</div>
                    </div>
                    <div>
                        <label class="text-sm font-semibold text-slate-900 block mb-1">Nội dung thông báo:</label>
                        <textarea id="notif-content-preview" class="w-full h-48 border border-slate-200 rounded-xl p-3 text-sm text-slate-600 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all">${message}</textarea>
                    </div>
                </div>
            `,
            confirmText: 'Gửi Ngay',
            cancelText: 'Hủy',
            onConfirm: async () => {
                const editedContent = document.getElementById('notif-content-preview').value;
                await this.sendSupportNotification(classId, classInfo, editedContent);
            }
        });
    },

    /**
     * Gửi thông báo đến GVCN
     */
    async sendSupportNotification(classId, classInfo, message) {
        try {
            const response = await fetch('../api/class-statistics.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send_support_notification',
                    class_id: classId,
                    title: `[Phụ đạo] Yêu cầu hỗ trợ lớp ${classInfo.class_name}`,
                    content: message
                })
            });

            const result = await response.json();

            if (result.success) {
                UI.toast.success(`Đã gửi thông báo thành công đến GVCN lớp ${classInfo.class_name}!`);
                const btn = document.querySelector(`button[onclick*="openSupportModal(${classId})"]`);
                if (btn) {
                    btn.innerHTML = '<i class="fas fa-check mr-1"></i>Đã gửi';
                    btn.className = "px-2 py-1.5 bg-emerald-500 text-white text-xs rounded cursor-default whitespace-nowrap";
                    btn.disabled = true;
                    btn.onclick = null;
                }
            } else {
                UI.toast.error(`Lỗi: ${result.message}`);
            }
        } catch (error) {
            console.error('Error sending notification:', error);
            UI.toast.error('Có lỗi xảy ra khi gửi thông báo!');
        }
    },

    /**
     * Lọc theo khối
     */
    filterByGrade(gradeLevel) {
        this.currentFilter.gradeLevel = gradeLevel;
        this.loadStatistics();
    },

    /**
     * Toggle chỉ xem lớp yếu
     */
    toggleOnlyWeak() {
        this.currentFilter.onlyWeak = !this.currentFilter.onlyWeak;
        this.loadStatistics();
    },

    /**
     * Xuất báo cáo
     */
    exportReport() {
        // Tạo nội dung báo cáo
        let content = 'BÁO CÁO THỐNG KÊ LỚP YẾU\n';
        content += '='.repeat(50) + '\n\n';

        content += `Tổng số lớp cần hỗ trợ: ${this.summary.weak_classes}\n`;
        content += `Số lớp 12 yếu (ưu tiên cao): ${this.summary.grade12_weak}\n`;
        content += `Tổng HS yếu kém: ${this.summary.total_weak_students}\n\n`;

        content += 'DANH SÁCH LỚP CẦN HỖ TRỢ:\n';
        content += '-'.repeat(50) + '\n';

        this.classes.filter(c => c.needs_support).forEach(c => {
            content += `${c.class_name}: TB ${c.avg_final_score}, ${c.weak_count} HS yếu (${c.weak_percent}%)\n`;
        });

        // Tải file
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bao_cao_lop_yeu_${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
    },

    init() {
        this.loadStatistics();

        // Bind filter buttons
        document.querySelectorAll('[data-grade-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.filterByGrade(btn.dataset.gradeFilter);
            });
        });
    }
};

window.AdminClassStats = AdminClassStats;
