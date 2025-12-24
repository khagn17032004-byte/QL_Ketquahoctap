// ====== Classes Management ======
console.log('[DEBUG] admin-classes.js loaded');

let classesData = [];
let allClassesData = []; // Lưu trữ tất cả lớp để filter

async function loadClasses() {
  const result = await fetchAPI('classes.php');
  if (result.success && result.data) {
    classesData = result.data;
    allClassesData = result.data;
  }
  return classesData;
}

async function loadClassesGrid() {
  const grid = document.getElementById('classesGrid');
  grid.innerHTML = `<div class="col-span-full flex items-center justify-center p-10"><div class="loader"></div></div>`;

  const result = await fetchAPI('classes.php?with_counts=1');

  if (result.success && result.data && result.data.length > 0) {
    classesData = result.data;
    allClassesData = result.data;
    displayClassesGrid(result.data);
  } else {
    grid.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10">Không có lớp nào</div>`;
  }
}

function displayClassesGrid(data) {
  const grid = document.getElementById('classesGrid');
  if (data.length > 0) {
    grid.innerHTML = data.map(c => {
      const isElite = c.is_advanced == 1 || ELITE_CLASSES.includes(c.class_name);
      const eliteIcon = isElite ? '<span class="text-amber-500 text-lg">⭐</span>' : '';
      return `
      <div onclick="openClassDetail(${c.id})" 
        class="p-5 rounded-2xl bg-white/90 backdrop-blur border ${isElite ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'} shadow-lg cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-200 group">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            ${eliteIcon}
            <span class="text-xl font-bold ${isElite ? 'text-amber-600' : 'text-emerald-600'}">${c.class_name}</span>
          </div>
          <span class="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">${c.academic_year || '2024-2025'}</span>
        </div>
        <div class="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <i class="lucide lucide-users" style="stroke-width:1.5;font-size:16px;"></i>
          <span>${c.student_count || 0} học sinh</span>
        </div>
        <div class="flex items-center gap-2 text-sm text-slate-600">
          <i class="lucide lucide-user" style="stroke-width:1.5;font-size:16px;"></i>
          <span>GVCN: ${c.homeroom_teacher_name || '<span class="text-slate-400">Chưa phân công</span>'}</span>
        </div>
      </div>
    `}).join('');
  } else {
    grid.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10">Không tìm thấy lớp nào</div>`;
  }
}

// Lọc lớp theo khối và tìm kiếm
function filterClasses() {
  const searchInput = document.getElementById('searchClassInput');
  const gradeFilter = document.getElementById('filterClassGrade');

  const searchText = (searchInput?.value || '').toLowerCase().trim();
  const grade = gradeFilter?.value || '';

  let filtered = allClassesData;

  // Lọc theo khối
  if (grade) {
    filtered = filtered.filter(c => c.class_name && c.class_name.startsWith(grade));
  }

  // Lọc theo tìm kiếm
  if (searchText) {
    filtered = filtered.filter(c =>
      (c.class_name && c.class_name.toLowerCase().includes(searchText)) ||
      (c.homeroom_teacher_name && c.homeroom_teacher_name.toLowerCase().includes(searchText))
    );
  }

  displayClassesGrid(filtered);
}

// Mở modal thêm lớp
async function openAddClassModal() {
  // Tạo modal nếu chưa có
  let modal = document.getElementById('addClassModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'addClassModal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/50 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div class="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
          <h3 class="text-xl font-semibold text-white">Thêm Lớp Mới</h3>
        </div>
        <form id="addClassForm" class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Tên lớp <span class="text-red-500">*</span></label>
            <input type="text" id="newClassName" required placeholder="VD: 10A1, 11B2..." class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Khối <span class="text-red-500">*</span></label>
            <select id="newClassGrade" required class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
              <option value="">-- Chọn khối --</option>
              <option value="10">Khối 10</option>
              <option value="11">Khối 11</option>
              <option value="12">Khối 12</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Năm học</label>
            <select id="newClassYear" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
              <option value="2024-2025">2024-2025</option>
              <option value="2023-2024">2023-2024</option>
              <option value="2025-2026">2025-2026</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Giáo viên chủ nhiệm</label>
            <select id="newClassTeacher" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
              <option value="">-- Chưa phân công --</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" id="newClassIsAdvanced" class="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500">
            <label for="newClassIsAdvanced" class="text-sm text-slate-700">Lớp chọn <span class="text-slate-400">(lớp chất lượng cao)</span></label>
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" onclick="closeAddClassModal()" class="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition">Hủy</button>
            <button type="submit" class="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition">Thêm lớp</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    // Event đóng modal khi click bên ngoài
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAddClassModal();
    });

    // Event submit form
    document.getElementById('addClassForm').addEventListener('submit', handleAddClass);
  }

  // Load danh sách giáo viên
  const teacherSelect = document.getElementById('newClassTeacher');
  const teachersResult = await fetchAPI('teachers.php');
  if (teachersResult.success && teachersResult.data) {
    teacherSelect.innerHTML = '<option value="">-- Chưa phân công --</option>' +
      teachersResult.data.map(t => `<option value="${t.id}">${t.full_name}</option>`).join('');
  }

  // Reset form
  document.getElementById('addClassForm').reset();

  // Hiển thị modal
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeAddClassModal() {
  const modal = document.getElementById('addClassModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleAddClass(e) {
  e.preventDefault();

  const className = document.getElementById('newClassName').value.trim();
  const gradeLevel = document.getElementById('newClassGrade').value;
  const academicYear = document.getElementById('newClassYear').value;
  const teacherId = document.getElementById('newClassTeacher').value;
  const isAdvanced = document.getElementById('newClassIsAdvanced')?.checked || false;

  if (!className || !gradeLevel) {
    showToast('Vui lòng nhập tên lớp và chọn khối', 'error');
    return;
  }

  const result = await fetchAPI('classes.php', {
    method: 'POST',
    body: JSON.stringify({
      class_name: className,
      grade_level: parseInt(gradeLevel),
      academic_year: academicYear,
      homeroom_teacher_id: teacherId || null,
      is_advanced: isAdvanced
    })
  });

  if (result.success) {
    UI.toast.success('Thêm lớp thành công!');
    closeAddClassModal();
    loadClassesGrid(); // Reload danh sách
  } else {
    UI.toast.error(result.message || 'Thêm lớp thất bại');
  }
}

async function openClassDetail(classId) {
  const modal = document.getElementById('classDetailModal');
  const studentListBody = document.getElementById('classDetailStudents');

  if (!studentListBody) return;

  studentListBody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500"><div class="loader mx-auto mb-2"></div>Đang tải...</td></tr>`;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const classResult = await fetchAPI(`classes.php?id=${classId}`);
  const studentsResult = await fetchAPI(`students.php?class_id=${classId}`);

  if (classResult.success && classResult.data) {
    document.getElementById('classDetailName').textContent = classResult.data.class_name;
    document.getElementById('classDetailTeacher').textContent = classResult.data.homeroom_teacher_name || 'Chưa phân công';
    document.getElementById('classDetailYear').textContent = classResult.data.academic_year || '2024-2025';
  }

  if (studentsResult.success && studentsResult.data && studentsResult.data.length > 0) {
    document.getElementById('classDetailCount').textContent = studentsResult.data.length;
    studentListBody.innerHTML = studentsResult.data.map((s, i) => {
      const dtb = s.dtb && s.dtb > 0 ? parseFloat(s.dtb).toFixed(2) : '-';
      const dtbClass = s.dtb >= 8 ? 'text-green-600 font-bold' : s.dtb >= 6.5 ? 'text-blue-600' : s.dtb >= 5 ? 'text-yellow-600' : s.dtb > 0 ? 'text-red-600' : 'text-slate-400';

      return `
      <tr class="hover:bg-slate-100 transition">
        <td class="px-4 py-3 text-slate-600">${i + 1}</td>
        <td class="px-4 py-3 font-mono text-sm text-slate-700">${s.student_code}</td>
        <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
        <td class="text-center px-4 py-3 text-slate-600">${s.gender}</td>
        <td class="px-4 py-3 text-slate-600">${s.birth_date || '-'}</td>
        <td class="text-center px-4 py-3 ${dtbClass}">${dtb}</td>
        <td class="text-center px-4 py-3">
          <button onclick="viewStudentDetail(${s.id})" class="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition">
            Chi tiết
          </button>
        </td>
      </tr>
    `}).join('');
  } else {
    document.getElementById('classDetailCount').textContent = '0';
    studentListBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">Lớp chưa có học sinh</td></tr>`;
  }
}

function closeClassDetailModal() {
  const modal = document.getElementById('classDetailModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function loadClassOptions() {
  const filterSelect = document.getElementById('filterClass');
  const result = await fetchAPI('classes.php');
  if (result.success && result.data) {
    filterSelect.innerHTML = '<option value="">Tất cả lớp</option>' +
      result.data.map(c => `<option value="${c.id}">${c.class_name}</option>`).join('');
  }
}

function initClassesEvents() {
  // Modal chi tiết lớp
  const closeBtn = document.getElementById('closeClassDetailModal');
  if (closeBtn) closeBtn.addEventListener('click', closeClassDetailModal);

  const closeBtn2 = document.getElementById('closeClassDetailBtn');
  if (closeBtn2) closeBtn2.addEventListener('click', closeClassDetailModal);

  const modal = document.getElementById('classDetailModal');
  if (modal) modal.addEventListener('click', (e) => {
    if (e.target.id === 'classDetailModal') closeClassDetailModal();
  });

  // Lọc và tìm kiếm
  const searchInput = document.getElementById('searchClassInput');
  const gradeFilter = document.getElementById('filterClassGrade');
  const searchBtn = document.getElementById('searchClassBtn');

  if (searchInput) {
    searchInput.addEventListener('input', filterClasses);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') filterClasses();
    });
  }
  if (gradeFilter) gradeFilter.addEventListener('change', filterClasses);
  if (searchBtn) searchBtn.addEventListener('click', filterClasses);

  // Nút thêm lớp
  const addBtn = document.getElementById('addClassBtn');
  if (addBtn) addBtn.addEventListener('click', openAddClassModal);
}

// Xem chi tiết học sinh
function viewStudentDetail(studentId) {
  // Đóng modal lớp học
  closeClassDetailModal();

  // Chuyển sang tab Học Sinh và mở modal chi tiết
  setTimeout(() => {
    const studentsTab = document.querySelector('[data-section="students"]');
    if (studentsTab) {
      studentsTab.click();
    }

    // Gọi hàm viewStudent từ admin-students.js
    setTimeout(() => {
      if (typeof viewStudent === 'function') {
        viewStudent(studentId);
      }
    }, 100);
  }, 100);
}
