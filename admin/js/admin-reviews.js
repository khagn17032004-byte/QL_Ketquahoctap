/**
 * Admin Grade Reviews Module - Quản lý Phúc khảo điểm
 */

const AdminGradeReviews = {
    reviews: [],
    teachers: [],
    currentFilter: { status: '' },
    
    /**
     * Load danh sách phúc khảo
     */
    async loadReviews() {
        try {
            let url = '../api/grade-reviews.php?';
            if (this.currentFilter.status) url += `status=${this.currentFilter.status}`;
            
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                this.reviews = result.data || [];
                this.teachers = result.teachers || [];
                this.renderReviewsList();
                this.renderStats(result.stats);
            }
        } catch (error) {
            console.error('Error loading reviews:', error);
        }
    },
    
    /**
     * Render thống kê
     */
    renderStats(stats) {
        const container = document.getElementById('reviewsStats');
        if (!container || !stats) return;
        
        container.innerHTML = `
            <div class="grid grid-cols-5 gap-3">
                <div class="bg-yellow-100 rounded-lg p-3 text-center cursor-pointer hover:bg-yellow-200 transition"
                    onclick="AdminGradeReviews.filterByStatus('pending')">
                    <div class="text-2xl font-bold text-yellow-700">${stats.pending}</div>
                    <div class="text-xs text-yellow-600">Chờ xử lý</div>
                </div>
                <div class="bg-blue-100 rounded-lg p-3 text-center cursor-pointer hover:bg-blue-200 transition"
                    onclick="AdminGradeReviews.filterByStatus('assigned')">
                    <div class="text-2xl font-bold text-blue-700">${stats.assigned}</div>
                    <div class="text-xs text-blue-600">Đã phân công</div>
                </div>
                <div class="bg-purple-100 rounded-lg p-3 text-center cursor-pointer hover:bg-purple-200 transition"
                    onclick="AdminGradeReviews.filterByStatus('reviewing')">
                    <div class="text-2xl font-bold text-purple-700">${stats.reviewing}</div>
                    <div class="text-xs text-purple-600">Đang phúc khảo</div>
                </div>
                <div class="bg-green-100 rounded-lg p-3 text-center cursor-pointer hover:bg-green-200 transition"
                    onclick="AdminGradeReviews.filterByStatus('completed')">
                    <div class="text-2xl font-bold text-green-700">${stats.completed}</div>
                    <div class="text-xs text-green-600">Hoàn thành</div>
                </div>
                <div class="bg-red-100 rounded-lg p-3 text-center cursor-pointer hover:bg-red-200 transition"
                    onclick="AdminGradeReviews.filterByStatus('rejected')">
                    <div class="text-2xl font-bold text-red-700">${stats.rejected}</div>
                    <div class="text-xs text-red-600">Từ chối</div>
                </div>
            </div>
            <button onclick="AdminGradeReviews.filterByStatus('')" class="mt-2 text-sm text-gray-500 hover:text-gray-700">
                Xem tất cả
            </button>
        `;
    },
    
    /**
     * Render danh sách phúc khảo
     */
    renderReviewsList() {
        const container = document.getElementById('reviewsTableBody');
        if (!container) return;
        
        // Hiển thị tất cả reviews
        const reviewsToShow = this.reviews;

        if (reviewsToShow.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-8 text-gray-500">
                        Không có yêu cầu phúc khảo nào
                    </td>
                </tr>
            `;
            return;
        }
        
        const statusLabels = {
            'pending': { text: 'Chờ xử lý', class: 'bg-yellow-100 text-yellow-700' },
            'assigned': { text: 'Đã phân công', class: 'bg-blue-100 text-blue-700' },
            'reviewing': { text: 'Đang phúc khảo', class: 'bg-purple-100 text-purple-700' },
            'completed': { text: 'Hoàn thành', class: 'bg-green-100 text-green-700' },
            'rejected': { text: 'Từ chối', class: 'bg-red-100 text-red-700' }
        };
        
        const gradeTypeLabels = {
            'oral': 'Miệng',
            'quiz': '15 phút',
            '15min': '15 phút',
            'fifteen': '15 phút',
            'test': '1 tiết',
            'one_period': '1 tiết',
            '1tiet': '1 tiết',
            'midterm': 'Giữa kỳ',
            'final': 'Cuối kỳ',
            'semester': 'Cuối kỳ'
        };
        
        container.innerHTML = reviewsToShow.map((r, idx) => {
            const statusInfo = statusLabels[r.status] || { text: r.status, class: 'bg-gray-100' };
            const gradeChanged = r.reviewed_grade !== null && r.reviewed_grade != r.original_grade;
            
            return `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="px-4 py-3">${idx + 1}</td>
                    <td class="px-4 py-3">
                        <p class="font-medium">${r.student_name}</p>
                        <p class="text-xs text-gray-500">${r.student_code} - ${r.class_name}</p>
                    </td>
                    <td class="px-4 py-3">${r.subject_name}</td>
                    <td class="px-4 py-3 text-sm">
                        ${gradeTypeLabels[r.grade_type] || r.grade_type}<br>
                        <span class="text-gray-500">HK${r.semester}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                        <span class="text-lg font-bold ${r.original_grade < 5 ? 'text-red-600' : 'text-gray-700'}">${r.original_grade || '-'}</span>
                        ${gradeChanged ? `
                            <span class="mx-1">→</span>
                            <span class="text-lg font-bold text-green-600">${r.reviewed_grade}</span>
                        ` : ''}
                    </td>
                    <td class="px-4 py-3 text-sm">
                        <p class="text-gray-700">${r.original_teacher_name}</p>
                        ${r.reviewer_teacher_name ? `
                            <p class="text-xs text-blue-600">→ ${r.reviewer_teacher_name}</p>
                        ` : ''}
                    </td>
                    <td class="px-4 py-3">
                        <span class="px-2 py-1 rounded-full text-xs font-medium ${statusInfo.class}">
                            ${statusInfo.text}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        ${r.status === 'pending' ? `
                            <button onclick="AdminGradeReviews.openAssignModal(${r.id})" 
                                class="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">
                                <i class="fas fa-user-plus mr-1"></i>Phân công
                            </button>
                        ` : ''}
                        ${r.status === 'assigned' || r.status === 'reviewing' ? `
                            <button onclick="AdminGradeReviews.viewDetail(${r.id})" 
                                class="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200">
                                <i class="fas fa-eye mr-1"></i>Xem
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    /**
     * Mở modal phân công GV phúc khảo
     */
    openAssignModal(reviewId) {
        const review = this.reviews.find(r => r.id === reviewId);
        if (!review) return;
        
        // Lọc GV không phải GV ban đầu
        const availableTeachers = this.teachers.filter(t => t.id !== review.original_teacher_id);
        
        const teacherOptions = availableTeachers.map(t => 
            `<option value="${t.id}">${t.full_name} (${t.teacher_code})</option>`
        ).join('');
        
        document.getElementById('assignReviewId').value = reviewId;
        document.getElementById('assignReviewerSelect').innerHTML = 
            '<option value="">-- Chọn GV phúc khảo --</option>' + teacherOptions;
        document.getElementById('assignAdminNote').value = '';
        
        // Hiển thị thông tin yêu cầu
        document.getElementById('assignStudentInfo').textContent = 
            `${review.student_name} (${review.student_code}) - ${review.subject_name}`;
        document.getElementById('assignOriginalTeacher').textContent = review.original_teacher_name;
        document.getElementById('assignOriginalGrade').textContent = review.original_grade || '-';
        
        document.getElementById('assignModal').classList.remove('hidden');
    },
    
    /**
     * Đóng modal
     */
    closeAssignModal() {
        document.getElementById('assignModal').classList.add('hidden');
    },
    
    /**
     * Lưu phân công
     */
    async saveAssignment() {
        const reviewId = document.getElementById('assignReviewId').value;
        const reviewerTeacherId = document.getElementById('assignReviewerSelect').value;
        const adminNote = document.getElementById('assignAdminNote').value;
        
        if (!reviewerTeacherId) {
            this.showError('Vui lòng chọn GV phúc khảo');
            return;
        }
        
        try {
            const response = await fetch('../api/grade-reviews.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'assign',
                    review_id: reviewId,
                    reviewer_teacher_id: reviewerTeacherId,
                    admin_note: adminNote
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSuccess('Đã phân công GV phúc khảo');
                this.closeAssignModal();
                this.loadReviews();
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            this.showError('Không thể phân công');
        }
    },
    
    /**
     * Xem chi tiết
     */
    viewDetail(reviewId) {
        const review = this.reviews.find(r => r.id === reviewId);
        if (!review) return;
        
        alert(`Chi tiết phúc khảo:\n\nHọc sinh: ${review.student_name}\nMôn: ${review.subject_name}\nĐiểm gốc: ${review.original_grade}\nĐiểm phúc khảo: ${review.reviewed_grade || 'Chưa có'}\nGhi chú: ${review.review_note || 'Không có'}`);
    },
    
    /**
     * Lọc theo trạng thái
     */
    filterByStatus(status) {
        this.currentFilter.status = status;
        this.loadReviews();
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
        this.loadReviews();
    }
};

window.AdminGradeReviews = AdminGradeReviews;
