/**
 * Student Init - Khởi tạo và quản lý chung
 */

// ====== State ======
const State = {
  currentUser: null,
  studentProfile: null,
  studentGrades: [],
  notifications: [],
  unreadCount: 0,
  classRankings: null,
  currentStudentId: null
};

function updateNavIndicator() {
  const activeBtn = document.querySelector('.tab-btn.active');
  const indicator = document.getElementById('nav-indicator');
  if (activeBtn && indicator) {
    indicator.style.top = `${activeBtn.offsetTop}px`;
    indicator.style.height = `${activeBtn.offsetHeight}px`;
  }
}

// Backward compatibility
let currentUser = null;
let studentProfile = null;
let studentGrades = [];

// ====== DOM Elements ======
let userNameNav, userIdNav, logoutBtn, tabBtns, tabContents;

// ====== Update User Info in Nav ======
function updateUserInfo() {
  const name = State.currentUser.name || State.currentUser.username;
  const code = State.currentUser.student_code || State.currentUser.username;

  if (userNameNav) userNameNav.textContent = name;
  if (userIdNav) userIdNav.textContent = code;

  // Update new UI elements
  const userNameSidebar = document.getElementById('userNameSidebar');
  const userIdSidebar = document.getElementById('userIdSidebar');
  const welcomeName = document.getElementById('welcomeName');

  if (userNameSidebar) userNameSidebar.textContent = name;
  if (userIdSidebar) userIdSidebar.textContent = code;
  if (welcomeName) welcomeName.textContent = name;
}

// ====== Init Tab Events ======
function initTabEvents() {
  // Desktop tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
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

      // Load data based on tab
      if (btn.dataset.tab === 'grades') {
        loadGrades();
      } else if (btn.dataset.tab === 'annual') {
        loadAnnualScores();
      } else if (btn.dataset.tab === 'ranking') {
        loadClassRanking();
      } else if (btn.dataset.tab === 'teachers') {
        loadClassTeachers();
      } else if (btn.dataset.tab === 'schedule') {
        loadSchedule();
      } else if (btn.dataset.tab === 'examschedule') {
        if (typeof loadStudentExamSchedule === 'function') {
          loadStudentExamSchedule();
        }
      }
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

      // Load data based on tab
      if (tabName === 'grades') {
        loadGrades();
      } else if (tabName === 'annual') {
        loadAnnualScores();
      } else if (tabName === 'ranking') {
        loadClassRanking();
      } else if (tabName === 'teachers') {
        loadClassTeachers();
      } else if (tabName === 'schedule') {
        loadSchedule();
      } else if (tabName === 'examschedule') {
        if (typeof loadStudentExamSchedule === 'function') {
          loadStudentExamSchedule();
        }
      }
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

  // Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('authToken');
    window.location.replace('../index.html?t=' + Date.now());
  });

  // Init module events
  initProfileEvents();
  initGradesEvents();
  initAnnualEvents();
  initAIAnalysisEvents();
  initNotificationEvents();
  initRankingEvents();
  initTeachersEvents();
  initScheduleEvents();

  // Notification button (support both old and new ID)
  document.getElementById('notificationBell')?.addEventListener('click', toggleNotificationDropdown);
  document.getElementById('notificationBtn')?.addEventListener('click', toggleNotificationDropdown);
  document.getElementById('markAllReadBtn')?.addEventListener('click', markAllNotificationsRead);
}

// ====== Initialize ======
async function init() {
  updateUserInfo();
  await loadStudentProfile();
  await loadNotifications(); // Load notifications on init

  // Initialize nav indicator
  setTimeout(() => {
    updateNavIndicator();
  }, 100);

  // Handle resize
  window.addEventListener('resize', updateNavIndicator);
}

function initStudentDashboard() {
  State.currentUser = checkAuth();
  if (!State.currentUser) throw new Error('Unauthorized');

  // Backward compatibility
  currentUser = State.currentUser;

  initAllEvents();
  init();

  // Render icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// Run on DOM ready
document.addEventListener('DOMContentLoaded', initStudentDashboard);

