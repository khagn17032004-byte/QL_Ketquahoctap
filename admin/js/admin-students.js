// ====== Students Management ======
console.log('[DEBUG] admin-students.js loaded');

let studentsCurrentPage = 1;
const studentsPerPage = 20;
let studentsSearchParams = { search: '', classId: '', policyObject: '' };
let studentClassOptions = [];

async function loadStudents(search = '', classId = '', page = 1, policyObject = '') {
  studentsSearchParams = { search, classId, policyObject };
  studentsCurrentPage = page;

  const tbody = document.getElementById('studentsTableBody');
  tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500"><div class="loader mx-auto mb-2"></div>Đang tải dữ liệu...</td></tr>`;

  let url = `students.php?page=${page}&limit=${studentsPerPage}&`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (classId) url += `class_id=${classId}&`;
  if (policyObject) url += `policy_object=${encodeURIComponent(policyObject)}&`;

  const result = await fetchAPI(url);

  if (result.success && result.data && result.data.length > 0) {
    const total = result.total || result.data.length;
    const totalPages = result.total_pages || Math.ceil(total / studentsPerPage);
    const from = (page - 1) * studentsPerPage + 1;
    const to = Math.min(page * studentsPerPage, total);

    tbody.innerHTML = result.data.map(s => {
      const dob = s.birth_date ? new Date(s.birth_date).toLocaleDateString('vi-VN') : '-';
      return `<tr class="hover:bg-slate-200/80 transition cursor-pointer" onclick="viewStudent(${s.id})">
        <td class="px-4 py-3 text-slate-800 font-mono text-sm">${s.student_code}</td>
        <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
        <td class="text-center px-4 py-3 text-slate-700">${s.gender || '-'}</td>
        <td class="text-center px-4 py-3 text-slate-700">${dob}</td>
        <td class="text-center px-4 py-3"><span class="inline-flex items-center rounded-full bg-sky-100 text-sky-700 text-xs px-2 py-1">${s.class_name || '-'}</span></td>
        <td class="text-center px-4 py-3">${getPolicyBadge(s.policy_object)}</td>
        <td class="text-center px-4 py-3">
          <button onclick="event.stopPropagation(); editStudent(${s.id})" class="px-2 py-1 rounded text-xs border border-slate-300 hover:bg-slate-200 transition mr-1">Sửa</button>
          <button onclick="event.stopPropagation(); deleteStudent(${s.id})" class="px-2 py-1 rounded text-xs border border-red-700 text-red-600 hover:bg-red-900/30 transition">Xóa</button>
        </td>
      </tr>`;
    }).join('');

    document.getElementById('studentsShowingFrom').textContent = from;
    document.getElementById('studentsShowingTo').textContent = to;
    document.getElementById('studentsTotalCount').textContent = total;
    renderStudentsPagination(totalPages);
  } else {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">Không có dữ liệu. Chọn lớp hoặc tìm kiếm.</td></tr>`;
    document.getElementById('studentsShowingFrom').textContent = 0;
    document.getElementById('studentsShowingTo').textContent = 0;
    document.getElementById('studentsTotalCount').textContent = 0;
  }
}

function renderStudentsPagination(totalPages) {
  const container = document.getElementById('studentsPageNumbers');
  container.innerHTML = '';
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    const btn = document.createElement('button');
    btn.className = `px-3 py-1 rounded border text-sm ${i === studentsCurrentPage ? 'bg-sky-500 text-white border-sky-500' : 'border-slate-300 text-slate-500 hover:bg-slate-200'}`;
    btn.textContent = i;
    btn.onclick = () => goToStudentsPage(i);
    container.appendChild(btn);
  }
  document.getElementById('studentsPrevBtn').disabled = studentsCurrentPage <= 1;
  document.getElementById('studentsNextBtn').disabled = studentsCurrentPage >= totalPages;
}

function goToStudentsPage(page) {
  loadStudents(studentsSearchParams.search, studentsSearchParams.classId, page, studentsSearchParams.policyObject);
}

async function loadStudentClassOptions() {
  const result = await fetchAPI('classes.php');
  if (result.success) {
    studentClassOptions = result.data;
    const filterSelect = document.getElementById('filterStudentClass');
    const formSelect = document.getElementById('studentFormClass');

    const options = '<option value="">Tất cả lớp</option>' + result.data.map(c => `<option value="${c.id}">${c.class_name}</option>`).join('');
    if (filterSelect) filterSelect.innerHTML = options;
    if (formSelect) formSelect.innerHTML = '<option value="">Chọn lớp</option>' + result.data.map(c => `<option value="${c.id}">${c.class_name}</option>`).join('');
  }
}

function viewStudent(id) {
  editStudent(id);
}

async function editStudent(id) {
  const result = await fetchAPI(`students.php?id=${id}`);
  if (result.success && result.data) {
    const s = result.data;
    document.getElementById('studentModalTitle').innerHTML = '<i class="lucide lucide-edit text-sky-400" style="stroke-width:1.5;"></i> Sửa Học Sinh';
    document.getElementById('studentFormId').value = s.id;
    document.getElementById('studentFormCode').value = s.student_code || '';
    document.getElementById('studentFormName').value = s.full_name || '';
    document.getElementById('studentFormGender').value = s.gender || 'Nam';
    document.getElementById('studentFormDOB').value = s.birth_date || '';
    document.getElementById('studentFormClass').value = s.class_id || '';
    document.getElementById('studentFormAvgScore').value = s.avg_score || '';
    document.getElementById('studentFormHometown').value = s.hometown || '';
    document.getElementById('studentFormAddress').value = s.address || '';
    document.getElementById('studentFormEthnicity').value = s.ethnicity || 'Kinh';
    document.getElementById('studentFormParentName').value = s.parent_name || '';
    document.getElementById('studentFormParentPhone').value = s.parent_phone || '';

    const radios = document.querySelectorAll('input[name="policyObject"]');
    radios.forEach(r => r.checked = r.value === (s.policy_object || ''));

    const modal = document.getElementById('studentModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

async function deleteStudent(id) {
  UI.modal.confirm({
    title: 'Xóa Học Sinh',
    message: 'Bạn có chắc chắn muốn xóa học sinh này? Toàn bộ dữ liệu điểm và học bổng liên quan sẽ bị xóa.',
    type: 'danger',
    confirmText: 'Xóa Học Sinh',
    onConfirm: async () => {
      const result = await fetchAPI('students.php', { method: 'DELETE', body: JSON.stringify({ id }) });
      if (result.success) {
        UI.toast.success('Xóa thành công!');
        loadStudents(studentsSearchParams.search, studentsSearchParams.classId, studentsCurrentPage, studentsSearchParams.policyObject);
        loadDashboardStats();
      } else {
        UI.toast.error(result.message || 'Không thể xóa');
      }
    }
  });
}

function openAddStudentModal() {
  document.getElementById('studentModalTitle').innerHTML = '<i class="lucide lucide-user-plus text-sky-400" style="stroke-width:1.5;"></i> Thêm Học Sinh';
  document.getElementById('studentForm').reset();
  document.getElementById('studentFormId').value = '';
  document.querySelectorAll('input[name="policyObject"]').forEach(r => r.checked = r.value === '');

  const modal = document.getElementById('studentModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeStudentModal() {
  const modal = document.getElementById('studentModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function exportStudentsToExcel() {
  const search = document.getElementById('searchStudentInput').value;
  const classId = document.getElementById('filterStudentClass').value;
  const policy = document.getElementById('filterPolicyObject').value;

  showToast('Đang tải dữ liệu...', 'info');

  // Gọi API lấy TẤT CẢ dữ liệu với export=all
  let url = `students.php?export=all&`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (classId) url += `class_id=${classId}&`;
  if (policy) url += `policy_object=${encodeURIComponent(policy)}&`;

  const result = await fetchAPI(url);

  if (!result.success || !result.data || result.data.length === 0) {
    showToast('Không có dữ liệu để xuất', 'error');
    return;
  }

  // Tạo nội dung CSV
  let csv = '\uFEFF'; // BOM for UTF-8
  csv += 'Mã HS,Họ và tên,Giới tính,Ngày sinh,Lớp,Dân tộc,Quê quán,Địa chỉ,Đối tượng chính sách,Phụ huynh,SĐT Phụ huynh\n';

  result.data.forEach(s => {
    const dob = s.birth_date ? new Date(s.birth_date).toLocaleDateString('vi-VN') : '';
    const policyLabel = getPolicyLabel(s.policy_object);
    csv += `"${s.student_code || ''}","${s.full_name || ''}","${s.gender || ''}","${dob}","${s.class_name || ''}","${s.ethnicity || ''}","${s.hometown || ''}","${s.address || ''}","${policyLabel}","${s.parent_name || ''}","${s.parent_phone || ''}"\n`;
  });

  // Download file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);

  // Tên file theo điều kiện lọc
  let fileName = 'danh_sach_hoc_sinh';
  if (classId) {
    const classSelect = document.getElementById('filterStudentClass');
    const className = classSelect.options[classSelect.selectedIndex].text;
    fileName += `_${className}`;
  }
  fileName += `_${new Date().toISOString().split('T')[0]}.csv`;

  link.download = fileName;
  link.click();
  showToast(`Xuất thành công ${result.data.length} học sinh!`, 'success');
}

// Helper function để lấy label của policy object
function getPolicyLabel(policyObject) {
  if (!policyObject) return '';
  const labels = {
    'con_thuong_binh_liet_si': 'Con thương binh/liệt sĩ',
    'ho_ngheo': 'Hộ nghèo',
    'ho_can_ngheo': 'Hộ cận nghèo',
    'dan_toc_thieu_so': 'Dân tộc thiểu số',
    'khuyet_tat': 'Khuyết tật'
  };
  return labels[policyObject] || policyObject;
}

function openImportStudentModal() {
  // Tạo modal import nếu chưa có
  let modal = document.getElementById('importStudentModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'importStudentModal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/50 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div class="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
          <h3 class="text-xl font-semibold text-white">Import Danh Sách Học Sinh</h3>
        </div>
        <div class="p-6 space-y-4">
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <p class="font-semibold mb-2">📋 Hướng dẫn:</p>
            <ul class="list-disc list-inside space-y-1">
              <li>File Excel (.xlsx) hoặc CSV (.csv)</li>
              <li>Cột bắt buộc: <strong>Mã HS, Họ tên, Giới tính</strong></li>
              <li>Cột tùy chọn: Ngày sinh, Lớp, Địa chỉ, Dân tộc, Đối tượng CS</li>
            </ul>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Chọn lớp để import</label>
            <select id="importStudentClass" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
              <option value="">-- Chọn lớp --</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Chọn file</label>
            <input type="file" id="importStudentFile" accept=".xlsx,.xls,.csv" class="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2">
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" onclick="closeImportStudentModal()" class="flex-1 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition">Hủy</button>
            <button type="button" onclick="processImportStudent()" class="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition">Import</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeImportStudentModal(); });
  }

  // Load danh sách lớp
  const classSelect = document.getElementById('importStudentClass');
  classSelect.innerHTML = '<option value="">-- Chọn lớp --</option>' +
    studentClassOptions.map(c => `<option value="${c.id}">${c.class_name}</option>`).join('');

  // Reset file input
  document.getElementById('importStudentFile').value = '';

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeImportStudentModal() {
  const modal = document.getElementById('importStudentModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function processImportStudent() {
  const classId = document.getElementById('importStudentClass').value;
  const fileInput = document.getElementById('importStudentFile');
  const file = fileInput.files[0];

  if (!classId) {
    showToast('Vui lòng chọn lớp', 'error');
    return;
  }

  if (!file) {
    showToast('Vui lòng chọn file', 'error');
    return;
  }

  // Đọc file CSV
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        showToast('File không có dữ liệu', 'error');
        return;
      }

      // Parse header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const codeIdx = header.findIndex(h => h.includes('mã') || h.includes('code'));
      const nameIdx = header.findIndex(h => h.includes('tên') || h.includes('name'));
      const genderIdx = header.findIndex(h => h.includes('giới') || h.includes('gender'));
      const dobIdx = header.findIndex(h => h.includes('sinh') || h.includes('birth') || h.includes('dob'));

      if (codeIdx === -1 || nameIdx === -1) {
        showToast('File thiếu cột Mã HS hoặc Họ tên', 'error');
        return;
      }

      // Parse data rows
      const students = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values[codeIdx] && values[nameIdx]) {
          students.push({
            student_code: values[codeIdx],
            full_name: values[nameIdx],
            gender: genderIdx !== -1 ? values[genderIdx] : 'Nam',
            birth_date: dobIdx !== -1 ? values[dobIdx] : null,
            class_id: classId
          });
        }
      }

      if (students.length === 0) {
        showToast('Không có dữ liệu hợp lệ trong file', 'error');
        return;
      }

      // Gọi API import
      const result = await fetchAPI('import-students.php', {
        method: 'POST',
        body: JSON.stringify({ students, class_id: classId })
      });

      if (result.success) {
        showToast(`Import thành công ${result.data?.imported || students.length} học sinh!`, 'success');
        closeImportStudentModal();
        loadStudents('', classId, 1);
        loadDashboardStats();
      } else {
        showToast(result.message || 'Import thất bại', 'error');
      }
    } catch (err) {
      console.error('Import error:', err);
      showToast('Lỗi đọc file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function initStudentsEvents() {
  loadStudentClassOptions();

  document.getElementById('studentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = !!document.getElementById('studentFormId').value;
    const policyRadio = document.querySelector('input[name="policyObject"]:checked');

    const data = {
      id: document.getElementById('studentFormId').value || undefined,
      student_code: document.getElementById('studentFormCode').value,
      full_name: document.getElementById('studentFormName').value,
      gender: document.getElementById('studentFormGender').value,
      birth_date: document.getElementById('studentFormDOB').value || null,
      class_id: document.getElementById('studentFormClass').value || null,
      avg_score: document.getElementById('studentFormAvgScore').value || null,
      hometown: document.getElementById('studentFormHometown').value,
      address: document.getElementById('studentFormAddress').value,
      ethnicity: document.getElementById('studentFormEthnicity').value,
      parent_name: document.getElementById('studentFormParentName').value,
      parent_phone: document.getElementById('studentFormParentPhone').value,
      policy_object: policyRadio ? policyRadio.value : null
    };

    const result = await fetchAPI('students.php', { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(data) });
    if (result.success) {
      showToast(isEdit ? 'Cập nhật thành công!' : 'Thêm học sinh thành công!', 'success');
      closeStudentModal();
      loadStudents(studentsSearchParams.search, studentsSearchParams.classId, studentsCurrentPage, studentsSearchParams.policyObject);
      loadDashboardStats();
    } else {
      showToast(result.message || 'Có lỗi xảy ra', 'error');
    }
  });

  document.getElementById('closeStudentModal').addEventListener('click', closeStudentModal);
  document.getElementById('cancelStudentBtn').addEventListener('click', closeStudentModal);
  document.getElementById('addStudentBtn').addEventListener('click', openAddStudentModal);
  document.getElementById('studentModal').addEventListener('click', (e) => { if (e.target.id === 'studentModal') closeStudentModal(); });

  // Tìm kiếm khi click nút hoặc nhấn Enter
  document.getElementById('searchStudentBtn').addEventListener('click', () => {
    loadStudents(document.getElementById('searchStudentInput').value, document.getElementById('filterStudentClass').value, 1, document.getElementById('filterPolicyObject').value);
  });

  document.getElementById('searchStudentInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadStudents(document.getElementById('searchStudentInput').value, document.getElementById('filterStudentClass').value, 1, document.getElementById('filterPolicyObject').value);
    }
  });

  // Tự động lọc khi thay đổi dropdown
  document.getElementById('filterStudentClass').addEventListener('change', () => {
    loadStudents(document.getElementById('searchStudentInput').value, document.getElementById('filterStudentClass').value, 1, document.getElementById('filterPolicyObject').value);
  });

  document.getElementById('filterPolicyObject').addEventListener('change', () => {
    loadStudents(document.getElementById('searchStudentInput').value, document.getElementById('filterStudentClass').value, 1, document.getElementById('filterPolicyObject').value);
  });

  document.getElementById('exportStudentBtn').addEventListener('click', exportStudentsToExcel);
  document.getElementById('importStudentBtn').addEventListener('click', openImportStudentModal);

  document.getElementById('studentsPrevBtn').addEventListener('click', () => { if (studentsCurrentPage > 1) goToStudentsPage(studentsCurrentPage - 1); });
  document.getElementById('studentsNextBtn').addEventListener('click', () => goToStudentsPage(studentsCurrentPage + 1));

  // Check elite class warning
  document.getElementById('studentFormClass').addEventListener('change', function () {
    const selectedOption = this.options[this.selectedIndex];
    const className = selectedOption ? selectedOption.text : '';
    const warning = document.getElementById('classWarning');
    if (ELITE_CLASSES.includes(className)) {
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
    }
  });
}
