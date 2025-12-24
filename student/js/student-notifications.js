// ========================================
// Student Notifications Module
// ========================================

// Load notifications
async function loadNotifications() {
    const studentId = State.currentUser.student_id;
    if (!studentId) return;
    
    try {
        const response = await fetch(`${API_URL}/notifications.php?student_id=${studentId}`);
        const result = await response.json();
        
        if (result.success) {
            State.notifications = result.data.notifications || [];
            State.unreadCount = result.data.unread_count || 0;
            updateNotificationBadge();
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (State.unreadCount > 0) {
            badge.textContent = State.unreadCount > 9 ? '9+' : State.unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Toggle notification dropdown
function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) {
            renderNotifications();
        }
    }
}

// Render notifications in dropdown
function renderNotifications() {
    const container = document.getElementById('notificationList');
    if (!container) return;
    
    if (!State.notifications || State.notifications.length === 0) {
        container.innerHTML = `
            <div class="p-4 text-center text-slate-500">
                <i class="lucide lucide-bell-off text-2xl mb-2 opacity-50" style="stroke-width:1;"></i>
                <p class="text-sm">Không có thông báo mới</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = State.notifications.map(n => {
        const typeColors = {
            'urgent': 'bg-red-500',
            'warning': 'bg-amber-500',
            'success': 'bg-emerald-500',
            'info': 'bg-sky-500'
        };
        const typeIcons = {
            'urgent': 'alert-triangle',
            'warning': 'alert-circle',
            'success': 'check-circle',
            'info': 'info'
        };
        
        const isRead = n.is_read == 1;
        const timeAgo = getTimeAgo(n.created_at);
        
        return `
            <div class="notification-item p-3 border-b border-slate-200 hover:bg-slate-50 cursor-pointer ${isRead ? 'opacity-60' : ''}" 
                 onclick="markNotificationRead(${n.id})">
                <div class="flex items-start gap-3">
                    <div class="h-8 w-8 rounded-full ${typeColors[n.type] || 'bg-sky-500'} flex items-center justify-center flex-shrink-0">
                        <i class="lucide lucide-${typeIcons[n.type] || 'info'} text-white text-sm" style="stroke-width:1.5;"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-slate-900 ${isRead ? '' : 'font-semibold'}">${n.title}</p>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-2">${n.content}</p>
                        <p class="text-xs text-slate-400 mt-1">${timeAgo}</p>
                    </div>
                    ${!isRead ? '<div class="h-2 w-2 rounded-full bg-sky-500 flex-shrink-0"></div>' : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Get time ago string
function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
}

// Mark notification as read
async function markNotificationRead(notificationId) {
    const studentId = State.currentUser.student_id;
    if (!studentId) return;
    
    try {
        await fetch(`${API_URL}/notifications.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: studentId,
                notification_id: notificationId
            })
        });
        
        // Update local state
        const notification = State.notifications.find(n => n.id === notificationId);
        if (notification && !notification.is_read) {
            notification.is_read = 1;
            State.unreadCount = Math.max(0, State.unreadCount - 1);
            updateNotificationBadge();
            renderNotifications();
        }
        
        // Show notification detail
        showNotificationDetail(notification);
        
    } catch (error) {
        console.error('Error marking notification read:', error);
    }
}

// Mark all as read
async function markAllNotificationsRead() {
    const studentId = State.currentUser.student_id;
    if (!studentId) return;
    
    try {
        await fetch(`${API_URL}/notifications.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: studentId,
                mark_all: true
            })
        });
        
        // Update local state
        State.notifications.forEach(n => n.is_read = 1);
        State.unreadCount = 0;
        updateNotificationBadge();
        renderNotifications();
        showToast('Đã đánh dấu tất cả đã đọc');
        
    } catch (error) {
        console.error('Error marking all read:', error);
    }
}

// Show notification detail modal
function showNotificationDetail(notification) {
    if (!notification) return;
    
    const modal = document.getElementById('notificationModal');
    if (!modal) return;
    
    const typeColors = {
        'urgent': 'text-red-500',
        'warning': 'text-amber-500',
        'success': 'text-emerald-500',
        'info': 'text-sky-500'
    };
    
    document.getElementById('notificationModalTitle').textContent = notification.title;
    document.getElementById('notificationModalTitle').className = `text-lg font-semibold ${typeColors[notification.type] || 'text-slate-900'}`;
    document.getElementById('notificationModalContent').innerHTML = notification.content.replace(/\n/g, '<br>');
    document.getElementById('notificationModalTime').textContent = new Date(notification.created_at).toLocaleString('vi-VN');
    
    modal.classList.remove('hidden');
    document.getElementById('notificationDropdown')?.classList.add('hidden');
}

// Close notification dropdown when clicking outside
function initNotificationEvents() {
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('notificationDropdown');
        const btnBell = document.getElementById('notificationBell');
        const btnOld = document.getElementById('notificationBtn');
        
        if (dropdown && !dropdown.contains(e.target) && 
            !btnBell?.contains(e.target) && !btnOld?.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });
    
    // Close modal events
    document.querySelectorAll('.close-notification-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('notificationModal')?.classList.add('hidden');
        });
    });
    
    document.getElementById('notificationModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'notificationModal') {
            e.target.classList.add('hidden');
        }
    });
}
