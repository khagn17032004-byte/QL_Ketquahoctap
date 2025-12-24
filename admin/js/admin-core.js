// ====== API Base URL & Core Functions ======
const API_URL = '/quanlyketquahoctap/api';

// Check Authentication - returns user or null
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
  if (!user.username || user.role !== 'admin') {
    return null;
  }
  return user;
}

// API Fetch Helper
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}/${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, message: 'Lỗi kết nối server' };
  }
}

// Load Dashboard Stats
async function loadDashboardStats() {
  const result = await fetchAPI('dashboard.php?role=admin');
  if (result.success) {
    const el = (id) => document.getElementById(id);
    if (el('statStudents')) el('statStudents').textContent = result.data.total_students || 0;
    if (el('statTeachers')) el('statTeachers').textContent = result.data.total_teachers || 0;
    if (el('statClasses')) el('statClasses').textContent = result.data.total_classes || 0;
    if (el('statRequests')) el('statRequests').textContent = result.data.pending_requests || 0;

    // Update requests badge
    const badge = el('requestsBadge');
    if (badge) {
      const pending = result.data.pending_requests || 0;
      if (pending > 0) {
        badge.textContent = pending;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }
}

// Update User Info in Nav
function updateUserInfo(user) {
  const currentUser = user || checkAuth();
  if (currentUser) {
    const nameEl = document.getElementById('userNameSidebar');
    const idEl = document.getElementById('userIdSidebar');
    const welcomeEl = document.getElementById('welcomeName');

    if (nameEl) nameEl.textContent = currentUser.full_name || 'Administrator';
    if (idEl) idEl.textContent = currentUser.username || 'ADMIN';
    if (welcomeEl) welcomeEl.textContent = currentUser.full_name || 'Admin';
  }
}

// Notification System for Header
async function loadHeaderNotifications() {
  const user = checkAuth();
  if (!user) return;

  const notiList = document.getElementById('notiList');
  const badge = document.getElementById('headerNotiBadge');
  if (!notiList) return;

  try {
    const result = await fetchAPI(`notifications.php?teacher_id=${user.teacher_id || 1}`);
    if (result.success && result.data.notifications) {
      const notifications = result.data.notifications;
      const unreadCount = result.data.unread_count;

      if (unreadCount > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }

      if (notifications.length === 0) {
        notiList.innerHTML = `
          <div class="p-8 text-center text-slate-400">
            <i data-lucide="bell-off" class="w-8 h-8 mx-auto mb-2 opacity-20"></i>
            <p class="text-sm">Không có thông báo mới</p>
          </div>`;
      } else {
        notiList.innerHTML = notifications.map(n => `
          <div class="p-4 border-b border-slate-50 hover:bg-slate-50 transition cursor-pointer ${!n.is_read ? 'bg-sky-50/30' : ''}" onclick="markAsRead(${n.id})">
            <div class="flex gap-3">
              <div class="w-10 h-10 rounded-xl ${n.type === 'urgent' ? 'bg-rose-100 text-rose-500' : 'bg-sky-100 text-sky-500'} flex-shrink-0 flex items-center justify-center">
                <i data-lucide="${n.type === 'urgent' ? 'alert-circle' : 'bell'}" class="w-5 h-5"></i>
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold text-slate-800 truncate">${n.title}</h4>
                <p class="text-xs text-slate-500 line-clamp-2 mt-0.5">${n.content}</p>
                <span class="text-[10px] text-slate-400 mt-1 block">${n.created_at}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
      if (typeof lucide !== 'undefined') lucide.createIcons({ node: notiList });
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
  }
}

async function markAsRead(id) {
  const result = await fetchAPI('notifications.php', {
    method: 'POST',
    body: JSON.stringify({ teacher_id: 1, notification_id: id })
  });
  if (result.success) {
    loadHeaderNotifications();
  }
}

async function markAllAsRead() {
  const result = await fetchAPI('notifications.php', {
    method: 'POST',
    body: JSON.stringify({ teacher_id: 1, mark_all: true })
  });
  if (result.success) {
    UI.toast.success('Đã đánh dấu tất cả là đã đọc');
    loadHeaderNotifications();
  }
}

function initNotificationBell() {
  const bellBtn = document.getElementById('notiBellBtn');
  const dropdown = document.getElementById('notiDropdown');

  if (bellBtn && dropdown) {
    bellBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      if (!dropdown.classList.contains('hidden')) {
        loadHeaderNotifications();
      }
    };

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }
}

// Helper display functions
const policyObjectLabels = {
  'con_thuong_binh_liet_si': { label: 'Thương binh/LS', color: 'bg-rose-100 text-rose-600 border-rose-500' },
  'ho_ngheo': { label: 'Hộ nghèo', color: 'bg-amber-500 text-white border-amber-500/30' },
  'ho_can_ngheo': { label: 'Cận nghèo', color: 'bg-yellow-100 text-yellow-600 border-yellow-500/30' },
  'dan_toc_thieu_so': { label: 'Dân tộc TS', color: 'bg-purple-100 text-purple-600 border-purple-500/30' },
  'dan_toc_vung_kho': { label: 'Dân tộc vùng khó', color: 'bg-purple-100 text-purple-600 border-purple-500/30' },
  'khuyet_tat': { label: 'Khuyết tật', color: 'bg-blue-100 text-blue-600 border-blue-500/30' }
};

function getPolicyBadge(policyObject) {
  if (!policyObject) return '<span class="text-slate-500">-</span>';
  const policy = policyObjectLabels[policyObject];
  if (!policy) return '<span class="text-slate-500">-</span>';
  return `<span class="inline-flex items-center rounded-full ${policy.color} text-xs px-2 py-0.5 border">${policy.label}</span>`;
}

const ELITE_CLASSES = ['10A1', '11A1', '12A1'];
