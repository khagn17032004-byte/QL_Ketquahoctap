/**
 * Admin Awards Module - Khen thưởng, Thi đua Giáo viên
 */

const AdminAwards = {
    awards: [],
    teachers: [],
    currentFilter: { type: '', year: '' },

    /**
     * Load danh sách khen thưởng
     */
    async loadAwards() {
        try {
            let url = '../api/teacher-awards.php?';
            if (this.currentFilter.type) url += `type=${this.currentFilter.type}&`;
            if (this.currentFilter.year) url += `year=${this.currentFilter.year}`;

            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                this.awards = result.data || [];
                this.renderAwardsList();
                this.renderStats(result.stats);
            }
        } catch (error) {
            console.error('Error loading awards:', error);
        }
    },

    /**
     * Load danh sách giáo viên
     */
    async loadTeachers() {
        try {
            const response = await fetch('../api/teachers.php');
            const result = await response.json();

            if (result.success) {
                this.teachers = result.data || [];
                this.renderTeacherSelect();
            }
        } catch (error) {
            console.error('Error loading teachers:', error);
        }
    },

    /**
     * Render dropdown chọn GV
     */
    renderTeacherSelect() {
        const select = document.getElementById('awardTeacherId');
        if (!select) return;

        select.innerHTML = '<option value="">-- Chọn giáo viên --</option>';
        this.teachers.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.full_name} (${t.teacher_code}) - ${t.department || ''}</option>`;
        });
    },

    /**
     * Render thống kê
     */
    renderStats(stats) {
        const container = document.getElementById('awardsStats');
        if (!container || !stats) return;

        container.innerHTML = `
            <div class="grid grid-cols-4 gap-4">
                <div class="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
                    <div class="text-3xl font-bold">${stats.total}</div>
                    <div class="text-blue-100 text-sm">Tổng số</div>
                </div>
                <div class="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                    <div class="text-3xl font-bold">${stats.khen_thuong}</div>
                    <div class="text-green-100 text-sm">Khen thưởng</div>
                </div>
                <div class="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-4 text-white">
                    <div class="text-3xl font-bold">${stats.thi_dua}</div>
                    <div class="text-yellow-100 text-sm">Thi đua</div>
                </div>
                <div class="bg-gradient-to-br from-red-500 to-pink-600 rounded-xl p-4 text-white">
                    <div class="text-3xl font-bold">${stats.ky_luat}</div>
                    <div class="text-red-100 text-sm">Kỷ luật</div>
                </div>
            </div>
        `;
    },

    /**
     * Render danh sách khen thưởng
     */
    renderAwardsList() {
        const container = document.getElementById('awardsTableBody');
        if (!container) return;

        if (this.awards.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-8 text-gray-500">
                        Chưa có dữ liệu khen thưởng/thi đua
                    </td>
                </tr>
            `;
            return;
        }

        const typeLabels = {
            'khen_thuong': { text: 'Khen thưởng', class: 'bg-green-100 text-green-700' },
            'thi_dua': { text: 'Thi đua', class: 'bg-yellow-100 text-yellow-700' },
            'ky_luat': { text: 'Kỷ luật', class: 'bg-red-100 text-red-700' }
        };

        const levelLabels = {
            'truong': 'Cấp trường',
            'quan': 'Cấp quận/huyện',
            'thanh_pho': 'Cấp thành phố',
            'quoc_gia': 'Cấp quốc gia'
        };

        container.innerHTML = this.awards.map((a, idx) => {
            const typeInfo = typeLabels[a.award_type] || { text: a.award_type, class: 'bg-gray-100' };

            return `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="px-4 py-3">${idx + 1}</td>
                    <td class="px-4 py-3">
                        <p class="font-medium">${a.teacher_name}</p>
                        <p class="text-xs text-gray-500">${a.teacher_code}</p>
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${typeInfo.class}">
                            ${typeInfo.text}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <p class="font-medium">${a.title}</p>
                        ${a.description ? `<p class="text-xs text-gray-500 truncate max-w-xs">${a.description}</p>` : ''}
                    </td>
                    <td class="px-4 py-3 text-sm">${levelLabels[a.level] || a.level}</td>
                    <td class="px-4 py-3 text-sm">${this.formatDate(a.award_date)}</td>
                    <td class="px-4 py-3">
                        <div class="flex gap-2">
                            <button onclick="AdminAwards.editAward(${a.id})" 
                                class="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="AdminAwards.deleteAward(${a.id})" 
                                class="p-1 text-red-600 hover:bg-red-50 rounded">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Mở modal thêm khen thưởng
     */
    openAddModal() {
        document.getElementById('awardModalTitle').textContent = 'Thêm Khen Thưởng / Thi Đua';
        document.getElementById('awardForm').reset();
        document.getElementById('awardId').value = '';
        document.getElementById('awardDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('awardModal').classList.remove('hidden');
    },

    /**
     * Đóng modal
     */
    closeModal() {
        document.getElementById('awardModal').classList.add('hidden');
    },

    /**
     * Sửa khen thưởng
     */
    editAward(id) {
        const award = this.awards.find(a => a.id === id);
        if (!award) return;

        document.getElementById('awardModalTitle').textContent = 'Sửa Khen Thưởng / Thi Đua';
        document.getElementById('awardId').value = award.id;
        document.getElementById('awardTeacherId').value = award.teacher_id;
        document.getElementById('awardType').value = award.award_type;
        document.getElementById('awardTitle').value = award.title;
        document.getElementById('awardNotes').value = award.description || '';
        document.getElementById('awardDate').value = award.award_date;
        document.getElementById('awardLevel').value = award.level;
        document.getElementById('awardCertificateNumber').value = award.certificate_number || '';

        document.getElementById('awardModal').classList.remove('hidden');
    },

    /**
     * Lưu khen thưởng
     */
    async saveAward() {
        const id = document.getElementById('awardId').value;
        const data = {
            teacher_id: document.getElementById('awardTeacherId').value,
            award_type: document.getElementById('awardType').value,
            title: document.getElementById('awardTitle').value,
            description: document.getElementById('awardNotes').value,
            award_date: document.getElementById('awardDate').value,
            level: document.getElementById('awardLevel').value,
            certificate_number: document.getElementById('awardCertificateNumber').value
        };

        if (!data.teacher_id || !data.title) {
            this.showError('Vui lòng điền đầy đủ thông tin');
            return;
        }

        try {
            let response;
            if (id) {
                data.id = id;
                response = await fetch('../api/teacher-awards.php', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            } else {
                response = await fetch('../api/teacher-awards.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
            }

            const result = await response.json();

            if (result.success) {
                UI.toast.success(result.message);
                this.closeModal();
                this.loadAwards();
            } else {
                UI.toast.error(result.message);
            }
        } catch (error) {
            UI.toast.error('Không thể lưu');
        }
    },

    /**
     * Xóa khen thưởng
     */
    async deleteAward(id) {
        UI.modal.confirm({
            title: 'Xóa Khen Thưởng',
            message: 'Bạn có chắc chắn muốn xóa bản ghi này?',
            type: 'danger',
            onConfirm: async () => {
                try {
                    const response = await fetch(`../api/teacher-awards.php?id=${id}`, {
                        method: 'DELETE'
                    });
                    const result = await response.json();
                    if (result.success) {
                        UI.toast.success('Đã xóa thành công');
                        this.loadAwards();
                    } else {
                        UI.toast.error(result.message);
                    }
                } catch (error) {
                    UI.toast.error('Không thể xóa');
                }
            }
        });
    },

    /**
     * Lọc theo loại
     */
    filterByType(type) {
        this.currentFilter.type = type;
        this.loadAwards();
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('vi-VN');
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
        this.loadTeachers();
        this.loadAwards();
    }
};

window.AdminAwards = AdminAwards;
