/**
 * Teacher Parents Module - Mời phụ huynh học sinh
 */

const TeacherParents = {
    selectedStudents: [],
    homeroomClass: null,
    students: [],

    /**
     * Load thông tin lớp chủ nhiệm và danh sách học sinh
     */
    async loadHomeroomClass() {
        try {
            const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const teacherId = user.id;

            // Lấy lớp chủ nhiệm từ API
            const response = await fetch(`../api/classes.php?homeroom_teacher_id=${teacherId}`);
            const result = await response.json();

            if (result.success && result.data && result.data.length > 0) {
                this.homeroomClass = result.data[0];
                this.renderHomeroomInfo();
                await this.loadStudents();
            } else {
                this.renderNoHomeroom();
            }
        } catch (error) {
            console.error('Error loading homeroom class:', error);
            this.renderNoHomeroom();
        }
    },

    /**
     * Load danh sách học sinh trong lớp chủ nhiệm
     */
    async loadStudents() {
        if (!this.homeroomClass) return;

        try {
            const response = await fetch(`../api/students.php?class_id=${this.homeroomClass.id}`);
            const result = await response.json();

            if (result.success) {
                this.students = result.data || [];
                this.renderStudentList();
            }
        } catch (error) {
            console.error('Error loading students:', error);
        }
    },

    /**
     * Render thông tin lớp chủ nhiệm
     */
    renderHomeroomInfo() {
        const container = document.getElementById('homeroomInfo');
        if (!container || !this.homeroomClass) return;

        // Tên lớp có thể là class_name hoặc name tùy API
        const className = this.homeroomClass.class_name || this.homeroomClass.name || 'Không xác định';
        const gradeLevel = this.homeroomClass.grade_level || '';

        container.innerHTML = `
            <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 mb-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <i data-lucide="school" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg">Lớp chủ nhiệm: ${className}</h3>
                        <p class="text-blue-100 text-sm">
                            ${gradeLevel ? 'Khối ' + gradeLevel + ' • ' : ''}${this.students.length} học sinh
                        </p>
                    </div>
                </div>
            </div>
        `;

        // Render icon
        if (typeof lucide !== 'undefined') lucide.createIcons();
    },

    /**
     * Render thông báo không có lớp chủ nhiệm
     */
    renderNoHomeroom() {
        const container = document.getElementById('parentInvitationContent');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-info-circle text-5xl mb-4 text-gray-300"></i>
                <h3 class="text-lg font-medium mb-2">Bạn không phải là giáo viên chủ nhiệm</h3>
                <p class="text-sm">Chức năng này chỉ dành cho giáo viên chủ nhiệm lớp</p>
            </div>
        `;
    },

    /**
     * Render danh sách học sinh để chọn
     */
    renderStudentList() {
        const container = document.getElementById('studentSelectList');
        if (!container) return;

        if (this.students.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Không có học sinh trong lớp</p>';
            return;
        }

        let html = `
            <div class="mb-3 flex items-center justify-between">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" id="selectAllStudents" class="w-4 h-4 text-blue-600 rounded">
                    <span class="text-sm font-medium text-gray-700">Chọn tất cả</span>
                </label>
                <span class="text-sm text-gray-500">Đã chọn: <strong id="selectedCount">0</strong>/${this.students.length}</span>
            </div>
            <div class="max-h-60 overflow-y-auto border rounded-lg divide-y">
        `;

        this.students.forEach(s => {
            html += `
                <label class="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer student-row">
                    <input type="checkbox" class="student-checkbox w-4 h-4 text-blue-600 rounded" 
                        value="${s.id}" data-name="${s.full_name}">
                    <div class="flex-1">
                        <p class="font-medium text-gray-800">${s.full_name}</p>
                        <p class="text-xs text-gray-500">Mã HS: ${s.student_code}</p>
                    </div>
                </label>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

        // Bind events
        this.bindStudentSelectEvents();
    },

    /**
     * Bind sự kiện chọn học sinh
     */
    bindStudentSelectEvents() {
        const selectAll = document.getElementById('selectAllStudents');
        const checkboxes = document.querySelectorAll('.student-checkbox');

        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                checkboxes.forEach(cb => cb.checked = e.target.checked);
                this.updateSelectedCount();
            });
        }

        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                this.updateSelectedCount();
            });
        });
    },

    /**
     * Cập nhật số lượng đã chọn
     */
    updateSelectedCount() {
        const checkboxes = document.querySelectorAll('.student-checkbox:checked');
        const countEl = document.getElementById('selectedCount');
        if (countEl) {
            countEl.textContent = checkboxes.length;
        }
        this.selectedStudents = Array.from(checkboxes).map(cb => parseInt(cb.value));
    },

    /**
     * Gửi thư mời phụ huynh
     */
    async sendInvitation() {
        const sendToAll = document.getElementById('sendToAllCheckbox')?.checked;

        if (!sendToAll && this.selectedStudents.length === 0) {
            this.showError('Vui lòng chọn ít nhất 1 học sinh');
            return;
        }

        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const teacherId = user.id;
        const title = document.getElementById('invitationTitle')?.value.trim() || 'Thư mời phụ huynh họp lớp';
        const content = document.getElementById('invitationContent')?.value.trim();
        const meetingDate = document.getElementById('meetingDate')?.value;
        const meetingTime = document.getElementById('meetingTime')?.value;
        const reason = document.getElementById('meetingReason')?.value.trim();

        try {
            const response = await fetch('../api/parent-invitation.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_id: teacherId,
                    class_id: this.homeroomClass?.id,
                    student_ids: this.selectedStudents,
                    send_to_all: sendToAll,
                    title: title,
                    content: content,
                    meeting_date: meetingDate,
                    meeting_time: meetingTime,
                    reason: reason
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(result.message);
                this.resetForm();
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error sending invitation:', error);
            this.showError('Không thể gửi thư mời');
        }
    },

    /**
     * Reset form
     */
    resetForm() {
        const form = document.getElementById('invitationForm');
        if (form) form.reset();

        document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('selectAllStudents').checked = false;
        this.selectedStudents = [];
        this.updateSelectedCount();
    },

    /**
     * Toggle nội dung tùy chỉnh
     */
    toggleCustomContent() {
        const customContent = document.getElementById('customContentSection');
        if (customContent) {
            customContent.classList.toggle('hidden');
        }
    },

    /**
     * In giấy mời phụ huynh
     */
    printInvitation() {
        const title = document.getElementById('invitationTitle')?.value.trim() || 'THƯ MỜI PHỤ HUYNH';
        const date = document.getElementById('meetingDate')?.value;
        const time = document.getElementById('meetingTime')?.value;
        const reason = document.getElementById('meetingReason')?.value.trim();
        const customContent = document.getElementById('invitationContent')?.value.trim();

        // Lấy danh sách học sinh được chọn
        const selectedNames = Array.from(document.querySelectorAll('.student-checkbox:checked'))
            .map(cb => cb.dataset.name);

        const sendToAll = document.getElementById('sendToAllCheckbox')?.checked;
        const className = this.homeroomClass?.class_name || '';

        let targetText = "Phụ huynh học sinh";
        if (!sendToAll && selectedNames.length > 0) {
            if (selectedNames.length === 1) {
                targetText = `Phụ huynh em: <strong>${selectedNames[0]}</strong>`;
            } else if (selectedNames.length <= 3) {
                targetText = `Phụ huynh các em: <strong>${selectedNames.join(', ')}</strong>`;
            } else {
                targetText = `Quý Phụ huynh học sinh lớp ${className}`;
            }
        } else {
            targetText = `Quý Phụ huynh học sinh lớp ${className}`;
        }

        let dateTimeText = "...............................................";
        if (date) {
            const dateObj = new Date(date);
            dateTimeText = `${time || '08:00'} ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`;
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <title>In Giấy Mời Phụ Huynh</title>
                <style>
                    body { font-family: "Times New Roman", Times, serif; padding: 1cm; line-height: 1.6; color: #000; }
                    .letter-container { max-width: 18cm; margin: 0 auto; border: 1px solid #eee; padding: 2cm; background: white; }
                    .header-top { display: flex; justify-content: space-between; margin-bottom: 30px; }
                    .header-left { text-align: center; width: 45%; }
                    .header-right { text-align: center; width: 50%; }
                    .header-right p { margin: 0; font-weight: bold; }
                    .line { width: 100px; height: 1px; background: black; margin: 5px auto; }
                    
                    .title { text-align: center; margin-top: 40px; margin-bottom: 30px; }
                    .title h1 { font-size: 18pt; margin: 0; text-transform: uppercase; }
                    
                    .content { font-size: 13pt; text-align: justify; }
                    .content p { margin-bottom: 15px; text-indent: 1.5cm; }
                    .content .no-indent { text-indent: 0; }
                    
                    .info-block { margin-left: 1.5cm; margin-bottom: 20px; }
                    .info-item { margin-bottom: 8px; }
                    
                    .footer { margin-top: 50px; display: flex; justify-content: space-between; }
                    .footer-left { width: 40%; text-align: center; }
                    .footer-right { width: 50%; text-align: center; }
                    
                    @media print {
                        body { padding: 0; background: none; }
                        .letter-container { border: none; padding: 0; width: 100%; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="letter-container">
                    <div class="header-top">
                        <div class="header-left">
                            <p style="margin:0; font-size: 12pt;">BỘ GIÁO DỤC VÀ ĐÀO TẠO</p>
                            <p style="margin:0; font-weight:bold; font-size: 12pt;">TRƯỜNG THPT CHUYÊN</p>
                            <div class="line"></div>
                        </div>
                        <div class="header-right">
                            <p style="font-size: 12pt;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                            <p style="font-size: 12pt;">Độc lập - Tự do - Hạnh phúc</p>
                            <div class="line"></div>
                        </div>
                    </div>

                    <div class="title">
                        <h1>${title}</h1>
                    </div>

                    <div class="content">
                        <p class="no-indent">Kính gửi: ${targetText}</p>
                        <p>Thay mặt Ban giám hiệu nhà trường và với tư cách là Giáo viên chủ nhiệm lớp ${className}, tôi trân trọng kính mời Quý Phụ huynh tới tham dự buổi họp:</p>
                        
                        <div class="info-block">
                            <div class="info-item">- <strong>Thời gian:</strong> ${dateTimeText}</div>
                            <div class="info-item">- <strong>Địa điểm:</strong> Phòng học lớp ${className}, Trường THPT</div>
                            <div class="info-item">- <strong>Nội dung:</strong> ${reason || 'Trao đổi về tình hình học tập và rèn luyện của học sinh.'}</div>
                        </div>

                        ${customContent ? `<p>${customContent}</p>` : ''}

                        <p>Rất mong Quý Phụ huynh sắp xếp thời gian đến tham dự đầy đủ và đúng giờ để cùng phối hợp với nhà trường trong việc giáo dục các em.</p>
                        <p>Trân trọng cảm ơn!</p>
                    </div>

                    <div class="footer">
                        <div class="footer-left">
                        </div>
                        <div class="footer-right">
                            <p style="font-style: italic; margin-bottom: 5px;">Hà Nội, ngày ...... tháng ...... năm 20...</p>
                            <p style="font-weight: bold; margin-bottom: 60px;">GIÁO VIÊN CHỦ NHIỆM</p>
                            <p style="font-weight: bold; font-size: 14pt;">${teacherInfo?.full_name || ''}</p>
                        </div>
                    </div>
                </div>

                <script>
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    /**
     * Cập nhật preview thư mời theo thời gian thực
     */
    updatePreview() {
        // Cập nhật tiêu đề
        const title = document.getElementById('invitationTitle')?.value.trim();
        const previewTitle = document.getElementById('previewTitle');
        if (previewTitle) {
            previewTitle.textContent = title || 'THƯ MỜI PHỤ HUYNH';
        }

        // Cập nhật ngày giờ
        const date = document.getElementById('meetingDate')?.value;
        const time = document.getElementById('meetingTime')?.value;
        const previewDateTime = document.getElementById('previewDateTime');
        if (previewDateTime) {
            if (date && time) {
                const dateObj = new Date(date + 'T' + time);
                const formattedDate = dateObj.toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const formattedTime = dateObj.toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                previewDateTime.textContent = `${formattedTime}, ${formattedDate}`;
            } else if (date) {
                const dateObj = new Date(date);
                previewDateTime.textContent = dateObj.toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } else if (time) {
                previewDateTime.textContent = time;
            } else {
                previewDateTime.textContent = 'Chưa chọn ngày giờ';
            }
        }

        // Cập nhật nội dung/lý do
        const reason = document.getElementById('meetingReason')?.value.trim();
        const previewReason = document.getElementById('previewReason');
        if (previewReason) {
            previewReason.textContent = reason || 'Chưa nhập nội dung';
        }

        // Cập nhật nội dung tùy chỉnh
        const customContent = document.getElementById('invitationContent')?.value.trim();
        const previewCustomContent = document.getElementById('previewCustomContent');
        const previewCustomText = document.getElementById('previewCustomText');
        if (previewCustomContent && previewCustomText) {
            if (customContent) {
                previewCustomContent.classList.remove('hidden');
                previewCustomText.textContent = customContent;
            } else {
                previewCustomContent.classList.add('hidden');
            }
        }
    },

    /**
     * Bind sự kiện cập nhật preview
     */
    bindPreviewEvents() {
        const fields = ['invitationTitle', 'meetingDate', 'meetingTime', 'meetingReason', 'invitationContent'];

        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => this.updatePreview());
                field.addEventListener('change', () => this.updatePreview());
            }
        });

        // Cập nhật preview ban đầu
        this.updatePreview();
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
        this.loadHomeroomClass();

        // Bind events
        const sendBtn = document.getElementById('sendInvitationBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendInvitation());
        }

        const sendToAllCheckbox = document.getElementById('sendToAllCheckbox');
        if (sendToAllCheckbox) {
            sendToAllCheckbox.addEventListener('change', (e) => {
                const studentSelect = document.getElementById('studentSelectList');
                if (studentSelect) {
                    studentSelect.style.opacity = e.target.checked ? '0.5' : '1';
                    studentSelect.style.pointerEvents = e.target.checked ? 'none' : 'auto';
                }
            });
        }

        const toggleCustomBtn = document.getElementById('toggleCustomContent');
        if (toggleCustomBtn) {
            toggleCustomBtn.addEventListener('click', () => this.toggleCustomContent());
        }

        const printBtn = document.getElementById('printInvitationBtn');
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printInvitation());
        }

        // Bind preview events để cập nhật xem trước theo thời gian thực
        this.bindPreviewEvents();
    }
};

// Export
window.TeacherParents = TeacherParents;
