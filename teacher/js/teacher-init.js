/**
 * Teacher Init - Khởi tạo, load thông tin giáo viên
 */

// ====== State ======
let currentUser = null;
let teacherInfo = null;
let teacherSubjects = [];
let homeroomClass = null;
let allClasses = [];

function updateNavIndicator() {
  const activeBtn = document.querySelector('.tab-btn.active');
  const indicator = document.getElementById('nav-indicator');
  if (activeBtn && indicator) {
    indicator.style.top = `${activeBtn.offsetTop}px`;
    indicator.style.height = `${activeBtn.offsetHeight}px`;
  }
}

// ====== DOM Elements ======
let userNameNav, userIdNav, logoutBtn, tabBtns, tabContents;

// ====== Load Teacher Info ======
async function loadTeacherInfo() {
  try {
    const response = await fetch(`${API_URL}/teacher-info.php?user_id=${currentUser.id}`);
    const result = await response.json();

    if (result.success) {
      teacherInfo = result.data.teacher;
      teacherSubjects = result.data.subjects || [];
      homeroomClass = result.data.homeroom_class;

      // Update UI - check elements exist
      const teacherNameEl = document.getElementById('teacherName');
      const teacherDeptEl = document.getElementById('teacherDept');
      const teacherNameDisplayEl = document.getElementById('teacherNameDisplay');
      const teacherDeptDisplayEl = document.getElementById('teacherDeptDisplay');

      if (teacherNameEl) teacherNameEl.textContent = teacherInfo.full_name;
      if (teacherDeptEl) teacherDeptEl.textContent = teacherInfo.department || 'Giáo viên';
      if (teacherNameDisplayEl) teacherNameDisplayEl.textContent = teacherInfo.full_name;
      if (teacherDeptDisplayEl) teacherDeptDisplayEl.textContent = teacherInfo.department || 'Giáo viên';

      // Update new UI elements
      const userNameSidebar = document.getElementById('userNameSidebar');
      const userIdSidebar = document.getElementById('userIdSidebar');
      const welcomeName = document.getElementById('welcomeName');

      if (userNameSidebar) userNameSidebar.textContent = teacherInfo.full_name;
      if (userIdSidebar) userIdSidebar.textContent = teacherInfo.teacher_code;
      if (welcomeName) welcomeName.textContent = teacherInfo.full_name;

      if (userNameNav) userNameNav.textContent = teacherInfo.full_name;
      if (userIdNav) userIdNav.textContent = teacherInfo.teacher_code;

      // Subject badge
      if (teacherSubjects.length > 0) {
        const subjectNames = teacherSubjects.map(s => s.subject_name).join(', ');
        const teachingSubjectEl = document.getElementById('teachingSubject');
        const teachingSubjectDisplayEl = document.getElementById('teachingSubjectDisplay');
        const gradeSubjectNameEl = document.getElementById('gradeSubjectName');
        const subjectNoteEl = document.getElementById('subjectNote');

        // New sidebar subject
        const subjectSidebar = document.getElementById('subjectSidebar');
        const teachingSubjectSidebar = document.getElementById('teachingSubjectSidebar');
        if (subjectSidebar) subjectSidebar.classList.remove('hidden');
        if (teachingSubjectSidebar) teachingSubjectSidebar.textContent = subjectNames;

        if (teachingSubjectEl) teachingSubjectEl.textContent = subjectNames;
        if (teachingSubjectDisplayEl) teachingSubjectDisplayEl.textContent = subjectNames;
        if (gradeSubjectNameEl) gradeSubjectNameEl.textContent = subjectNames;
        if (subjectNoteEl) subjectNoteEl.textContent = subjectNames;
      }

      // Homeroom badge
      if (homeroomClass) {
        const homeroomBadgeEl = document.getElementById('homeroomBadge');
        const homeroomClassNameEl = document.getElementById('homeroomClassName');
        const homeroomBadgeDisplayEl = document.getElementById('homeroomBadgeDisplay');
        const homeroomClassDisplayEl = document.getElementById('homeroomClassDisplay');
        const viewHomeroomClassEl = document.getElementById('viewHomeroomClass');
        const conductClassNameEl = document.getElementById('conductClassName');

        // New sidebar homeroom
        const homeroomSidebar = document.getElementById('homeroomSidebar');
        const homeroomClassNameSidebar = document.getElementById('homeroomClassNameSidebar');
        if (homeroomSidebar) homeroomSidebar.classList.remove('hidden');
        if (homeroomClassNameSidebar) homeroomClassNameSidebar.textContent = homeroomClass.class_name;

        if (homeroomBadgeEl) homeroomBadgeEl.classList.remove('hidden');
        if (homeroomClassNameEl) homeroomClassNameEl.textContent = homeroomClass.class_name;
        if (homeroomBadgeDisplayEl) homeroomBadgeDisplayEl.classList.remove('hidden');
        if (homeroomClassDisplayEl) homeroomClassDisplayEl.textContent = homeroomClass.class_name;
        if (viewHomeroomClassEl) viewHomeroomClassEl.textContent = homeroomClass.class_name;
        if (conductClassNameEl) conductClassNameEl.textContent = homeroomClass.class_name;
      } else {
        // Hide homeroom-only features
        const noHomeroomMsgEl = document.getElementById('noHomeroomMsg');
        const viewGradesContentEl = document.getElementById('viewGradesContent');
        const noConductPermissionEl = document.getElementById('noConductPermission');
        const conductContentEl = document.getElementById('conductContent');
        if (noHomeroomMsgEl) noHomeroomMsgEl.classList.remove('hidden');
        if (viewGradesContentEl) viewGradesContentEl.classList.add('hidden');
        if (noConductPermissionEl) noConductPermissionEl.classList.remove('hidden');
        if (conductContentEl) conductContentEl.classList.add('hidden');
      }

      // Load classes
      await loadClasses();
      await loadAllSubjects();

      // Populate subject dropdown after loading teacher subjects
      if (typeof populateSubjectDropdown === 'function') {
        populateSubjectDropdown();
      }

      // Initialize nav indicator
      setTimeout(() => {
        updateNavIndicator();
      }, 100);

      // Handle resize
      window.addEventListener('resize', updateNavIndicator);
    }
  } catch (error) {
    console.error('Error loading teacher info:', error);
    showToast('Lỗi tải thông tin giáo viên');
  }
}

// ====== Load Classes ======
async function loadClasses() {
  try {
    const response = await fetch(`${API_URL}/classes.php`);
    const result = await response.json();

    if (result.success) {
      allClasses = result.data;
      populateClassSelects();
    }
  } catch (error) {
    console.error('Error loading classes:', error);
  }
}

function populateClassSelects() {
  // Student list - all classes
  const studentSelect = document.getElementById('studentClassSelect');
  studentSelect.innerHTML = '<option value="">-- Chọn lớp --</option>';
  allClasses.forEach(cls => {
    studentSelect.innerHTML += `<option value="${cls.id}">${cls.class_name} (${cls.student_count} HS)</option>`;
  });

  // Grade input - all classes (but only teacher's subject)
  const gradeSelect = document.getElementById('gradeClassSelect');
  gradeSelect.innerHTML = '<option value="">-- Chọn lớp --</option>';
  allClasses.forEach(cls => {
    gradeSelect.innerHTML += `<option value="${cls.id}">${cls.class_name}</option>`;
  });

  // Auto-select homeroom class and load students
  if (homeroomClass) {
    studentSelect.value = homeroomClass.id;
    loadStudents(homeroomClass.id);
    gradeSelect.value = homeroomClass.id;
  }
}

// ====== Load All Subjects (for viewing grades) ======
async function loadAllSubjects() {
  try {
    const response = await fetch(`${API_URL}/subjects.php`);
    const result = await response.json();

    if (result.success) {
      const viewSelect = document.getElementById('viewSubjectSelect');
      viewSelect.innerHTML = '<option value="">-- Chọn môn --</option>';
      result.data.forEach(subj => {
        viewSelect.innerHTML += `<option value="${subj.id}">${subj.subject_name}</option>`;
      });
    }
  } catch (error) {
    console.error('Error loading subjects:', error);
  }
}

// ====== Init Tab Events ======
function initTabEvents() {
  // Desktop tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Reset all desktop tabs
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.classList.add('text-white/70', 'hover:bg-white/10', 'hover:text-white');
      });
      tabContents.forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('fade-in-up');
      });

      btn.classList.add('active');
      btn.classList.remove('text-white/70', 'hover:bg-white/10', 'hover:text-white');

      // Update indicator
      updateNavIndicator();

      const targetPanel = document.getElementById(btn.dataset.tab + '-tab');
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
        void targetPanel.offsetWidth;
        targetPanel.classList.add('fade-in-up');
      }

      // Load data for specific tabs
      loadTabData(btn.dataset.tab);
    });
  });

  // Mobile tabs
  const mobileTabBtns = document.querySelectorAll('.tab-btn-mobile');
  const mobileSidebar = document.getElementById('mobileSidebar');
  const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');

  mobileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      // Hide mobile menu
      if (mobileSidebar) mobileSidebar.classList.add('-translate-x-full');
      if (mobileSidebarOverlay) mobileSidebarOverlay.classList.add('hidden');

      // Sync desktop tabs
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.classList.add('text-white/70', 'hover:bg-white/10', 'hover:text-white');
        if (b.dataset.tab === tabName) {
          b.classList.add('active');
          b.classList.remove('text-white/70', 'hover:bg-white/10', 'hover:text-white');
        }
      });

      // Update indicator
      updateNavIndicator();

      tabContents.forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('fade-in-up');
      });
      const targetPanel = document.getElementById(tabName + '-tab');
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
        void targetPanel.offsetWidth;
        targetPanel.classList.add('fade-in-up');
      }

      // Load data for specific tabs
      loadTabData(tabName);
    });
  });

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeMobileMenu = document.getElementById('closeMobileMenu');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      if (mobileSidebar) mobileSidebar.classList.remove('-translate-x-full');
      if (mobileSidebarOverlay) mobileSidebarOverlay.classList.remove('hidden');
    });
  }

  if (closeMobileMenu) {
    closeMobileMenu.addEventListener('click', () => {
      if (mobileSidebar) mobileSidebar.classList.add('-translate-x-full');
      if (mobileSidebarOverlay) mobileSidebarOverlay.classList.add('hidden');
    });
  }

  if (mobileSidebarOverlay) {
    mobileSidebarOverlay.addEventListener('click', () => {
      if (mobileSidebar) mobileSidebar.classList.add('-translate-x-full');
      mobileSidebarOverlay.classList.add('hidden');
    });
  }
}

// ====== Teacher Notifications ======
let teacherNotifications = [];

async function loadTeacherNotifications() {
  if (!teacherInfo) {
    console.log('loadTeacherNotifications: teacherInfo is null');
    return;
  }

  console.log('Loading notifications for teacher ID:', teacherInfo.id);

  try {
    const response = await fetch(`${API_URL}/notifications.php?teacher_id=${teacherInfo.id}`);
    const result = await response.json();

    console.log('Notifications API response:', result);

    if (result.success) {
      teacherNotifications = result.data.notifications || [];
      const unreadCount = result.data.unread_count || 0;

      console.log('Notifications count:', teacherNotifications.length, 'Unread:', unreadCount);

      // Update badge
      const badge = document.getElementById('notificationBadge');
      if (badge) {
        badge.textContent = unreadCount;
        if (unreadCount > 0) {
          badge.classList.remove('hidden');
          badge.classList.add('flex');
        } else {
          badge.classList.add('hidden');
          badge.classList.remove('flex');
        }
      }

      // Render notifications
      renderNotifications();
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

function renderNotifications() {
  const list = document.getElementById('notificationList');
  if (!list) return;

  if (teacherNotifications.length === 0) {
    list.innerHTML = `
      <div class="p-8 text-center text-slate-500">
        <i data-lucide="bell-off" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        <p class="text-sm">Không có thông báo mới</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }

  list.innerHTML = teacherNotifications.map(n => {
    const isRead = n.is_read == 1;
    const typeIcon = n.type === 'warning' ? 'alert-triangle' :
      n.type === 'success' ? 'check-circle' :
        n.type === 'urgent' ? 'alert-circle' : 'info';
    const typeColor = n.type === 'warning' ? 'text-amber-500' :
      n.type === 'success' ? 'text-emerald-500' :
        n.type === 'urgent' ? 'text-red-500' : 'text-blue-500';
    const bgClass = isRead ? 'bg-white' : 'bg-blue-50';

    // Check notification type for click handler
    const isGradeReview = n.title && n.title.includes('phúc khảo');
    const isSupportRequest = n.title && n.title.includes('Phụ đạo');

    let clickHandler = `viewNotificationDetail(${n.id})`;
    if (isGradeReview) {
      clickHandler = `openGradeReviewDetail(${n.id})`;
    }

    const actionHint = isGradeReview && !isRead ? '<span class="inline-block mt-2 text-xs text-blue-600 font-medium">Bấm để xử lý →</span>' :
      isSupportRequest && !isRead ? '<span class="inline-block mt-2 text-xs text-red-600 font-medium">Bấm để xem chi tiết →</span>' :
        !isRead ? '<span class="inline-block mt-2 text-xs text-slate-500">Bấm để xem →</span>' : '';

    return `
      <div class="notification-item ${bgClass} p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition" 
           data-id="${n.id}" onclick="${clickHandler}">
        <div class="flex items-start gap-3">
          <i data-lucide="${typeIcon}" class="w-5 h-5 ${typeColor} flex-shrink-0 mt-0.5"></i>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-slate-800 text-sm ${isRead ? '' : 'font-semibold'}">${n.title}</p>
            <p class="text-slate-600 text-xs mt-1 line-clamp-2">${n.content}</p>
            <p class="text-slate-400 text-xs mt-2">${formatNotificationTime(n.created_at)}</p>
            ${actionHint}
          </div>
          ${!isRead ? '<span class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"></span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function formatNotificationTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays < 7) return `${diffDays} ngày trước`;
  return date.toLocaleDateString('vi-VN');
}

async function markNotificationRead(notificationId) {
  if (!teacherInfo) return;

  try {
    await fetch(`${API_URL}/notifications.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacher_id: teacherInfo.id,
        notification_id: notificationId
      })
    });

    // Reload notifications
    await loadTeacherNotifications();
  } catch (error) {
    console.error('Error marking notification read:', error);
  }
}

/**
 * Xem chi tiết thông báo
 */
async function viewNotificationDetail(notificationId) {
  const notification = teacherNotifications.find(n => n.id == notificationId);
  if (!notification) return;

  // Đánh dấu đã đọc
  await markNotificationRead(notificationId);

  // Hiển thị modal chi tiết
  const typeLabel = notification.type === 'urgent' ? 'KHẨN CẤP' :
    notification.type === 'warning' ? 'CẢNH BÁO' :
      notification.type === 'success' ? 'THÀNH CÔNG' : 'THÔNG TIN';
  const typeColor = notification.type === 'urgent' ? 'bg-red-500' :
    notification.type === 'warning' ? 'bg-amber-500' :
      notification.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500';

  // Format content với line breaks
  const formattedContent = notification.content.replace(/\n/g, '<br>');

  // Tạo modal
  const modalHtml = `
    <div id="notificationDetailModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick="closeNotificationDetailModal(event)">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden" onclick="event.stopPropagation()">
        <div class="p-6 border-b border-slate-200">
          <div class="flex items-start justify-between">
            <div>
              <span class="${typeColor} text-white text-xs font-bold px-2 py-1 rounded">${typeLabel}</span>
              <h3 class="text-lg font-bold text-slate-800 mt-2">${notification.title}</h3>
              <p class="text-sm text-slate-500 mt-1">${formatNotificationTime(notification.created_at)}</p>
            </div>
            <button onclick="closeNotificationDetailModal()" class="text-slate-400 hover:text-slate-600">
              <i data-lucide="x" class="w-6 h-6"></i>
            </button>
          </div>
        </div>
        <div class="p-6 max-h-96 overflow-y-auto">
          <div class="text-slate-700 text-sm leading-relaxed whitespace-pre-line">${formattedContent}</div>
        </div>
        <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button onclick="closeNotificationDetailModal()" class="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700">
            Đóng
          </button>
        </div>
      </div>
    </div>
  `;

  // Thêm modal vào body
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeNotificationDetailModal(event) {
  if (event && event.target !== event.currentTarget) return;
  const modal = document.getElementById('notificationDetailModal');
  if (modal) modal.remove();
}

async function markAllNotificationsRead() {
  if (!teacherInfo) return;

  try {
    await fetch(`${API_URL}/notifications.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teacher_id: teacherInfo.id,
        mark_all: true
      })
    });

    showToast('Đã đánh dấu tất cả đã đọc', 'success');
    await loadTeacherNotifications();
  } catch (error) {
    console.error('Error marking all read:', error);
  }
}

function initNotificationEvents() {
  const bell = document.getElementById('notificationBell');
  const dropdown = document.getElementById('notificationDropdown');
  const markAllBtn = document.getElementById('markAllReadBtn');

  if (bell && dropdown) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      if (!dropdown.classList.contains('hidden')) {
        loadTeacherNotifications();
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  if (markAllBtn) {
    markAllBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllNotificationsRead();
    });
  }

  // Grade Review Modal Events
  initGradeReviewModalEvents();
}

// ====== Grade Review Modal Functions ======
let currentGradeReviewId = null;

function initGradeReviewModalEvents() {
  const modal = document.getElementById('gradeReviewModal');
  const closeBtn = document.getElementById('closeGradeReviewModal');
  const submitBtn = document.getElementById('submitReviewBtn');
  const rejectBtn = document.getElementById('rejectReviewBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeGradeReviewModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'gradeReviewModal') closeGradeReviewModal();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', submitGradeReview);
  }

  if (rejectBtn) {
    rejectBtn.addEventListener('click', rejectGradeReview);
  }
}

function closeGradeReviewModal() {
  const modal = document.getElementById('gradeReviewModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  currentGradeReviewId = null;
}

async function openGradeReviewDetail(notificationId) {
  const modal = document.getElementById('gradeReviewModal');
  const content = document.getElementById('gradeReviewContent');
  const actions = document.getElementById('gradeReviewActions');

  if (!modal || !content) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  content.innerHTML = '<div class="text-center py-8 text-slate-500">Đang tải...</div>';
  actions.classList.add('hidden');

  // Find the notification
  const notification = teacherNotifications.find(n => n.id == notificationId);
  if (!notification) {
    content.innerHTML = '<div class="text-center py-8 text-red-500">Không tìm thấy thông tin</div>';
    return;
  }

  // Mark as read
  await markNotificationRead(notificationId);

  // Fetch grade review details for this teacher
  try {
    const response = await fetch(`${API_URL}/grade-reviews.php?teacher_id=${teacherInfo.id}&status=assigned`);
    const result = await response.json();

    console.log('[DEBUG] Grade reviews:', result);

    if (result.success && result.data && result.data.length > 0) {
      // Find matching review (most recent assigned)
      const review = result.data[0];
      currentGradeReviewId = review.id;

      content.innerHTML = `
        <div class="space-y-4">
          <div class="bg-blue-50 rounded-xl p-4">
            <h4 class="font-semibold text-slate-800 mb-3">Thông tin yêu cầu phúc khảo</h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p class="text-slate-500">Học sinh</p>
                <p class="font-medium text-slate-800">${review.student_name || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">Lớp</p>
                <p class="font-medium text-slate-800">${review.class_name || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">Môn học</p>
                <p class="font-medium text-slate-800">${review.subject_name || '-'}</p>
              </div>
              <div>
                <p class="text-slate-500">Loại điểm</p>
                <p class="font-medium text-slate-800">${getGradeTypeLabel(review.grade_type)}</p>
              </div>
              <div>
                <p class="text-slate-500">Học kỳ</p>
                <p class="font-medium text-slate-800">HK${review.semester || 1}</p>
              </div>
              <div>
                <p class="text-slate-500">Điểm hiện tại</p>
                <p class="font-bold text-xl text-amber-600">${review.original_grade ?? '-'}</p>
              </div>
            </div>
          </div>
          
          ${review.reason ? `
          <div class="bg-amber-50 rounded-xl p-4">
            <p class="text-sm text-slate-500 mb-1">Lý do yêu cầu phúc khảo:</p>
            <p class="text-slate-700">${review.reason}</p>
          </div>
          ` : ''}
          
          <div class="bg-slate-50 rounded-xl p-4">
            <p class="text-sm text-slate-500 mb-1">Giáo viên chấm ban đầu:</p>
            <p class="font-medium text-slate-800">${review.original_teacher_name || 'Không xác định'}</p>
          </div>
        </div>
      `;

      // Show action buttons
      actions.classList.remove('hidden');
      document.getElementById('reviewedGradeInput').value = '';
      document.getElementById('reviewNoteInput').value = '';

    } else {
      content.innerHTML = `
        <div class="text-center py-8">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <p class="text-slate-600 font-medium">Không có yêu cầu phúc khảo nào đang chờ</p>
          <p class="text-sm text-slate-400 mt-1">Yêu cầu có thể đã được xử lý hoặc chưa được phân công</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading grade review:', error);
    content.innerHTML = '<div class="text-center py-8 text-red-500">Lỗi tải thông tin</div>';
  }
}

function getGradeTypeLabel(type) {
  const labels = {
    'oral': 'Điểm miệng',
    'fifteen': 'Điểm 15 phút',
    'one_period': 'Điểm 1 tiết',
    'midterm': 'Điểm giữa kỳ',
    'semester': 'Điểm cuối kỳ',
    'quiz': 'Điểm 15 phút',
    'test': 'Điểm 1 tiết',
    'final': 'Điểm cuối kỳ'
  };
  return labels[type] || type || '-';
}

async function submitGradeReview() {
  if (!currentGradeReviewId) return;

  const gradeInput = document.getElementById('reviewedGradeInput');
  const noteInput = document.getElementById('reviewNoteInput');

  const grade = parseFloat(gradeInput.value);
  if (isNaN(grade) || grade < 0 || grade > 10) {
    showToast('Vui lòng nhập điểm hợp lệ (0-10)', 'error');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/grade-reviews.php`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentGradeReviewId,
        reviewed_grade: grade,
        review_note: noteInput.value || '',
        status: 'completed',
        reviewer_id: teacherInfo.id
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast('Đã gửi kết quả phúc khảo!', 'success');
      closeGradeReviewModal();
      loadTeacherNotifications();
    } else {
      showToast(result.message || 'Có lỗi xảy ra', 'error');
    }
  } catch (error) {
    console.error('Error submitting review:', error);
    showToast('Lỗi gửi kết quả', 'error');
  }
}

async function rejectGradeReview() {
  if (!currentGradeReviewId) return;

  const noteInput = document.getElementById('reviewNoteInput');

  if (!noteInput.value.trim()) {
    showToast('Vui lòng nhập lý do từ chối', 'error');
    noteInput.focus();
    return;
  }

  if (!confirm('Bạn có chắc muốn từ chối yêu cầu phúc khảo này?')) return;

  try {
    const response = await fetch(`${API_URL}/grade-reviews.php`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentGradeReviewId,
        review_note: noteInput.value,
        status: 'rejected',
        reviewer_id: teacherInfo.id
      })
    });

    const result = await response.json();

    if (result.success) {
      showToast('Đã từ chối yêu cầu phúc khảo', 'success');
      closeGradeReviewModal();
      loadTeacherNotifications();
    } else {
      showToast(result.message || 'Có lỗi xảy ra', 'error');
    }
  } catch (error) {
    console.error('Error rejecting review:', error);
    showToast('Lỗi xử lý', 'error');
  }
}

// ====== Init All Events ======
function initAllEvents() {
  // Get DOM elements
  userNameNav = document.getElementById('userNameNav');
  userIdNav = document.getElementById('userIdNav');
  logoutBtn = document.getElementById('logoutBtn');
  tabBtns = document.querySelectorAll('.tab-btn');
  tabContents = document.querySelectorAll('.tab-content');

  // Init tab events
  initTabEvents();

  // Init notification events
  initNotificationEvents();

  // Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    window.location.replace('../index.html?t=' + Date.now());
  });

  // Init module events
  initStudentsEvents();
  initGradesEvents();
  initViewGradesEvents();
  initConductEvents();
  initAnnualEvents();

  // Init new modules
  if (typeof TeacherAttendance !== 'undefined') {
    TeacherAttendance.init();
  }
  if (typeof TeacherParents !== 'undefined') {
    TeacherParents.init();
  }
  if (typeof TeacherSchedule !== 'undefined') {
    TeacherSchedule.init();
  }
  if (typeof TeacherQuiz !== 'undefined') {
    TeacherQuiz.init();
  }

  // Render icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ====== Load Tab Data (lazy loading) ======
const loadedTabs = {};
function loadTabData(tabName) {
  if (loadedTabs[tabName]) return; // Already loaded

  switch (tabName) {
    case 'schedule':
      if (typeof TeacherSchedule !== 'undefined') {
        TeacherSchedule.loadSchedule();
      }
      break;
    case 'examschedule':
      if (typeof loadTeacherExamSchedule === 'function') {
        loadTeacherExamSchedule();
      }
      break;
    case 'reports':
      if (typeof loadTeacherReportClasses === 'function') {
        loadTeacherReportClasses();
      }
      break;
  }

  loadedTabs[tabName] = true;
}

// ====== Initialize ======
function initTeacherDashboard() {
  currentUser = checkAuth();
  if (!currentUser) throw new Error('Unauthorized');

  initAllEvents();

  loadTeacherInfo().then(() => {
    // Populate annual selects after teacher info loaded
    setTimeout(populateAnnualSelects, 500);
    // Load notifications
    loadTeacherNotifications();

    // Now that teacherInfo is loaded, initialize modules that need it
    if (typeof TeacherAttendance !== 'undefined') {
      TeacherAttendance.loadTeachingClasses();
    }
    if (typeof TeacherSchedule !== 'undefined') {
      TeacherSchedule.loadSchedule();
    }
  });
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', initTeacherDashboard);
