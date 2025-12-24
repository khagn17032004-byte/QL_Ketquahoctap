// ====== Main Initialization ======
console.log('[DEBUG] admin-init.js loaded');

// Track which tabs have been loaded
const loadedTabs = {};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[DEBUG] DOMContentLoaded fired');

  // Check authentication
  const user = checkAuth();
  console.log('[DEBUG] User check:', user);

  if (!user) {
    console.log('[DEBUG] No user, redirecting to login');
    window.location.href = '../login.html';
    return;
  }

  if (user.role !== 'admin') {
    console.log('[DEBUG] User is not admin:', user.role);
    showToast('Bạn không có quyền truy cập trang này', 'error');
    setTimeout(() => window.location.href = '../login.html', 1500);
    return;
  }

  console.log('[DEBUG] Admin user verified, initializing...');

  // Update user info in header
  updateUserInfo(user);

  // Load dashboard data
  await loadDashboardStats();

  // Initialize all modules
  console.log('[DEBUG] Initializing event handlers...');
  try {
    initUsersEvents();
    console.log('[DEBUG] initUsersEvents OK');
  } catch (e) { console.error('[DEBUG] initUsersEvents ERROR:', e); }

  try {
    initStudentsEvents();
    console.log('[DEBUG] initStudentsEvents OK');
  } catch (e) { console.error('[DEBUG] initStudentsEvents ERROR:', e); }

  try {
    initTeachersEvents();
    console.log('[DEBUG] initTeachersEvents OK');
  } catch (e) { console.error('[DEBUG] initTeachersEvents ERROR:', e); }

  try {
    initClassesEvents();
    console.log('[DEBUG] initClassesEvents OK');
  } catch (e) { console.error('[DEBUG] initClassesEvents ERROR:', e); }

  try {
    initImportStudentsEvents();
    console.log('[DEBUG] initImportStudentsEvents OK');
  } catch (e) { console.error('[DEBUG] initImportStudentsEvents ERROR:', e); }

  try {
    initImportExcelEvents();
    console.log('[DEBUG] initImportExcelEvents OK');
  } catch (e) { console.error('[DEBUG] initImportExcelEvents ERROR:', e); }

  try {
    initScholarshipEvents();
    console.log('[DEBUG] initScholarshipEvents OK');
  } catch (e) { console.error('[DEBUG] initScholarshipEvents ERROR:', e); }

  try {
    initRequestsEvents();
    console.log('[DEBUG] initRequestsEvents OK');
  } catch (e) { console.error('[DEBUG] initRequestsEvents ERROR:', e); }

  try {
    initReportsEvents();
    console.log('[DEBUG] initReportsEvents OK');
  } catch (e) { console.error('[DEBUG] initReportsEvents ERROR:', e); }

  // Initialize new modules
  try {
    if (typeof AdminSchedule !== 'undefined') {
      AdminSchedule.init();
      console.log('[DEBUG] AdminSchedule.init OK');
    }
  } catch (e) { console.error('[DEBUG] AdminSchedule.init ERROR:', e); }

  try {
    if (typeof AdminGradeReviews !== 'undefined') {
      AdminGradeReviews.init();
      console.log('[DEBUG] AdminGradeReviews.init OK');
    }
  } catch (e) { console.error('[DEBUG] AdminGradeReviews.init ERROR:', e); }

  try {
    if (typeof AdminClassStats !== 'undefined') {
      AdminClassStats.init();
      console.log('[DEBUG] AdminClassStats.init OK');
    }
  } catch (e) { console.error('[DEBUG] AdminClassStats.init ERROR:', e); }

  // Initialize notification bell
  try {
    initNotificationBell();
    loadHeaderNotifications();
    console.log('[DEBUG] initNotificationBell OK');
  } catch (e) { console.error('[DEBUG] initNotificationBell ERROR:', e); }

  // Setup tab switching
  console.log('[DEBUG] Setting up tab switching...');
  setupTabSwitching();

  // Setup logout
  setupLogout();

  // Load initial data for first tab (users)
  loadUsers();
  loadedTabs['users'] = true;

  // Initialize nav indicator position
  setTimeout(() => {
    updateNavIndicator();
  }, 100);

  // Update indicator on window resize
  window.addEventListener('resize', () => {
    updateNavIndicator();
  });

  console.log('[DEBUG] Initialization complete!');
});

function updateNavIndicator() {
  const activeBtn = document.querySelector('.tab-btn.active');
  const indicator = document.getElementById('nav-indicator');
  if (activeBtn && indicator) {
    indicator.style.top = `${activeBtn.offsetTop}px`;
    indicator.style.height = `${activeBtn.offsetHeight}px`;
  }
}

function setupTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
  const tabPanels = document.querySelectorAll('[id$="-tab"]');

  // Desktop tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      // Update button states - use bg styling for sidebar
      tabButtons.forEach(b => {
        b.classList.remove('active', 'text-white');
        b.classList.add('text-white/70', 'hover:bg-white/10', 'hover:text-white');
      });
      btn.classList.add('active', 'text-white');
      btn.classList.remove('text-white/70', 'hover:bg-white/10', 'hover:text-white');

      // Update indicator position
      updateNavIndicator();

      // Update panel visibility
      tabPanels.forEach(panel => {
        panel.classList.add('hidden');
        panel.classList.remove('fade-in-up');
      });
      const targetPanel = document.getElementById(`${tabId}-tab`);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
        // Force reflow to restart animation
        void targetPanel.offsetWidth;
        targetPanel.classList.add('fade-in-up');
      }

      // Load data for the tab if not already loaded
      loadTabData(tabId);
    });
  });

  // Mobile tabs
  const mobileTabBtns = document.querySelectorAll('.tab-btn-mobile');
  const mobileSidebar = document.getElementById('mobileSidebar');
  const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');

  mobileTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      // Hide mobile menu
      if (mobileSidebar) mobileSidebar.classList.add('-translate-x-full');
      if (mobileSidebarOverlay) mobileSidebarOverlay.classList.add('hidden');

      // Sync desktop tabs
      tabButtons.forEach(b => {
        b.classList.remove('active', 'text-white');
        b.classList.add('text-white/70', 'hover:bg-white/10', 'hover:text-white');
        if (b.dataset.tab === tabId) {
          b.classList.add('active', 'text-white');
          b.classList.remove('text-white/70', 'hover:bg-white/10', 'hover:text-white');
        }
      });

      // Update indicator position
      updateNavIndicator();

      // Update panel visibility
      tabPanels.forEach(panel => {
        panel.classList.add('hidden');
        panel.classList.remove('fade-in-up');
      });
      const targetPanel = document.getElementById(`${tabId}-tab`);
      if (targetPanel) {
        targetPanel.classList.remove('hidden');
        void targetPanel.offsetWidth;
        targetPanel.classList.add('fade-in-up');
      }

      // Load data for the tab
      loadTabData(tabId);
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

function loadTabData(tabId) {
  // Load data based on tab - only load once per session or if forced
  if (loadedTabs[tabId]) return;

  switch (tabId) {
    case 'users':
      loadUsers();
      break;
    case 'students':
      loadStudents();
      loadStudentClassOptions();
      break;
    case 'teachers':
      loadTeachers();
      break;
    case 'classes':
      loadClassesGrid();
      break;
    case 'scholarship':
      loadScholarship();
      break;
    case 'requests':
      loadRequests();
      break;
    case 'reports':
      // Reports don't need auto-loading
      break;
    case 'schedule':
      if (typeof AdminSchedule !== 'undefined') {
        AdminSchedule.loadData();
      }
      break;
    case 'reviews':
      if (typeof AdminGradeReviews !== 'undefined') {
        AdminGradeReviews.loadReviews();
      }
      break;
    case 'classstats':
      if (typeof AdminClassStats !== 'undefined') {
        AdminClassStats.loadStatistics();
      }
      break;
    case 'examschedule':
      if (typeof loadExamPeriods !== 'undefined') {
        loadExamPeriods();
        initExamScheduleEvents();
      }
      break;
  }
  loadedTabs[tabId] = true;
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      window.location.href = '../login.html';
    });
  }
}
