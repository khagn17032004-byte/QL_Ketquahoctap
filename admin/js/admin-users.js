// ====== Users Management ======

let usersCurrentPage = 1;
const usersPerPage = 20;
let usersSearchParams = { search: '', role: '', status: '' };

// Load Users
async function loadUsers(search = '', role = '', status = '', page = 1) {
  usersSearchParams = { search, role, status };
  usersCurrentPage = page;

  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500"><div class="loader mx-auto mb-2"></div>Đang tải dữ liệu...</td></tr>`;

  let url = `users.php?page=${page}&limit=${usersPerPage}&`;
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (role) url += `role=${role}&`;
  if (status) url += `status=${status}&`;

  const result = await fetchAPI(url);

  if (result.success && result.data && result.data.length > 0) {
    const total = result.total || result.data.length;
    const totalPages = Math.ceil(total / usersPerPage);
    const from = (page - 1) * usersPerPage + 1;
    const to = Math.min(page * usersPerPage, total);

    tbody.innerHTML = result.data.map(user => {
      const roleLabel = user.role === 'student' ? 'Học sinh' : user.role === 'teacher' ? 'Giáo viên' : 'Quản trị';
      const roleColor = user.role === 'student' ? 'sky' : user.role === 'teacher' ? 'emerald' : 'amber';
      const statusLabel = user.status === 'active' ? 'Hoạt động' : 'Khóa';
      const statusColor = user.status === 'active' ? 'emerald' : 'rose';
      const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '-';

      return `<tr class="hover:bg-slate-200/80 transition">
        <td class="px-4 py-3 text-slate-800 font-mono text-sm">${user.username}</td>
        <td class="px-4 py-3 text-slate-800">${user.full_name || '-'}</td>
        <td class="text-center px-4 py-3"><span class="inline-flex items-center rounded-full bg-${roleColor}-100 text-${roleColor}-600 text-xs px-2 py-1">${roleLabel}</span></td>
        <td class="text-center px-4 py-3"><span class="inline-flex items-center rounded-full bg-${statusColor}-100 text-${statusColor}-600 text-xs px-2 py-1">${statusLabel}</span></td>
        <td class="text-center px-4 py-3 text-slate-500 text-sm">${createdDate}</td>
        <td class="text-center px-4 py-3">
          <button onclick="editUser(${user.id})" class="px-2 py-1 rounded text-xs border border-slate-300 hover:bg-slate-200 transition mr-1">Sửa</button>
          <button onclick="deleteUser(${user.id})" class="px-2 py-1 rounded text-xs border border-red-700 text-red-600 hover:bg-red-900/30 transition">Xóa</button>
        </td>
      </tr>`;
    }).join('');

    document.getElementById('usersShowingFrom').textContent = from;
    document.getElementById('usersShowingTo').textContent = to;
    document.getElementById('usersTotalCount').textContent = total;
    renderUsersPagination(totalPages);
  } else {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Không có dữ liệu</td></tr>`;
    document.getElementById('usersShowingFrom').textContent = 0;
    document.getElementById('usersShowingTo').textContent = 0;
    document.getElementById('usersTotalCount').textContent = 0;
  }
}

function renderUsersPagination(totalPages) {
  const container = document.getElementById('usersPageNumbers');
  container.innerHTML = '';
  for (let i = 1; i <= Math.min(totalPages, 5); i++) {
    const btn = document.createElement('button');
    btn.className = `px-3 py-1 rounded border text-sm ${i === usersCurrentPage ? 'bg-sky-500 text-white border-sky-500' : 'border-slate-300 text-slate-500 hover:bg-slate-200'}`;
    btn.textContent = i;
    btn.onclick = () => goToUsersPage(i);
    container.appendChild(btn);
  }
  document.getElementById('usersPrevBtn').disabled = usersCurrentPage <= 1;
  document.getElementById('usersNextBtn').disabled = usersCurrentPage >= totalPages;
}

function goToUsersPage(page) {
  loadUsers(usersSearchParams.search, usersSearchParams.role, usersSearchParams.status, page);
}

async function editUser(id) {
  const result = await fetchAPI(`users.php?id=${id}`);
  if (result.success && result.data) {
    const user = result.data;
    document.getElementById('userModalTitle').innerHTML = '<i class="lucide lucide-edit text-sky-400" style="stroke-width:1.5;"></i> Sửa Người Dùng';
    document.getElementById('userFormId').value = user.id;
    document.getElementById('userFormUsername').value = user.username;
    document.getElementById('userFormUsername').readOnly = true;
    document.getElementById('userFormPassword').value = '';
    document.getElementById('userFormRole').value = user.role;
    document.getElementById('userFormFullName').value = user.full_name || '';
    document.getElementById('userFormEmail').value = user.email || '';
    document.getElementById('userFormPhone').value = user.phone || '';
    document.getElementById('userFormStatus').value = user.status || 'active';
    document.getElementById('passwordRequired').classList.add('hidden');
    document.getElementById('passwordHint').classList.remove('hidden');
    document.getElementById('statusGroup').classList.remove('hidden');
    
    // Handle role-specific fields
    await handleRoleChangeForEdit(user);

    const modal = document.getElementById('userModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

async function deleteUser(id) {
  UI.modal.confirm({
    title: 'Xóa Người Dùng',
    message: 'Bạn có chắc chắn muốn xóa người dùng này? Hành động này không thể hoàn tác.',
    type: 'danger',
    confirmText: 'Xóa Vĩnh Viễn',
    onConfirm: async () => {
      const result = await fetchAPI('users.php', { method: 'DELETE', body: JSON.stringify({ id }) });
      if (result.success) {
        UI.toast.success('Xóa thành công!');
        loadUsers();
        loadDashboardStats();
      } else {
        UI.toast.error(result.message || 'Không thể xóa');
      }
    }
  });
}

function openAddUserModal() {
  document.getElementById('userModalTitle').innerHTML = '<i class="lucide lucide-user-plus text-sky-400" style="stroke-width:1.5;"></i> Thêm Người Dùng';
  document.getElementById('userForm').reset();
  document.getElementById('userFormId').value = '';
  document.getElementById('userFormUsername').readOnly = false;
  document.getElementById('passwordRequired').classList.remove('hidden');
  document.getElementById('passwordHint').classList.add('hidden');
  document.getElementById('statusGroup').classList.add('hidden');
  document.getElementById('studentFields').classList.add('hidden');
  document.getElementById('teacherFields').classList.add('hidden');

  const modal = document.getElementById('userModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function handleRoleChange(role) {
  document.getElementById('studentFields').classList.add('hidden');
  document.getElementById('teacherFields').classList.add('hidden');
  if (role === 'student') {
    document.getElementById('studentFields').classList.remove('hidden');
    loadUserClassOptions();
  } else if (role === 'teacher') {
    document.getElementById('teacherFields').classList.remove('hidden');
  }
}

// Handle role change when editing - loads options then sets values
async function handleRoleChangeForEdit(user) {
  document.getElementById('studentFields').classList.add('hidden');
  document.getElementById('teacherFields').classList.add('hidden');
  
  if (user.role === 'student') {
    document.getElementById('studentFields').classList.remove('hidden');
    await loadUserClassOptions();
    // Set the class value after options are loaded
    if (user.class_id) {
      document.getElementById('userFormClassId').value = user.class_id;
    }
    // Set gender if available
    if (user.student_gender) {
      const genderSelect = document.getElementById('userFormStudentGender');
      if (genderSelect) genderSelect.value = user.student_gender;
    }
  } else if (user.role === 'teacher') {
    document.getElementById('teacherFields').classList.remove('hidden');
    // Set teacher-specific fields if available
    if (user.teacher_gender) {
      const genderSelect = document.getElementById('userFormTeacherGender');
      if (genderSelect) genderSelect.value = user.teacher_gender;
    }
    if (user.teacher_department) {
      const deptInput = document.getElementById('userFormDepartment');
      if (deptInput) deptInput.value = user.teacher_department;
    }
  }
}

async function loadUserClassOptions() {
  const result = await fetchAPI('classes.php');
  if (result.success) {
    const select = document.getElementById('userFormClassId');
    select.innerHTML = '<option value="">Chọn lớp</option>' +
      result.data.map(c => `<option value="${c.id}">${c.class_name}</option>`).join('');
  }
}

function initUsersEvents() {
  document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = !!document.getElementById('userFormId').value;
    const data = {
      id: document.getElementById('userFormId').value || undefined,
      username: document.getElementById('userFormUsername').value,
      password: document.getElementById('userFormPassword').value || undefined,
      role: document.getElementById('userFormRole').value,
      full_name: document.getElementById('userFormFullName').value,
      email: document.getElementById('userFormEmail').value,
      phone: document.getElementById('userFormPhone').value
    };

    if (isEdit) {
      data.status = document.getElementById('userFormStatus').value;
    }

    const result = await fetchAPI('users.php', { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(data) });
    if (result.success) {
      showToast(isEdit ? 'Cập nhật thành công!' : 'Thêm người dùng thành công!', 'success');
      closeUserModal();
      loadUsers();
      loadDashboardStats();
    } else {
      showToast(result.message || 'Có lỗi xảy ra', 'error');
    }
  });

  document.getElementById('userFormRole').addEventListener('change', (e) => handleRoleChange(e.target.value));
  document.getElementById('closeUserModal').addEventListener('click', closeUserModal);
  document.getElementById('cancelUserBtn').addEventListener('click', closeUserModal);
  document.getElementById('addUserBtn').addEventListener('click', openAddUserModal);
  document.getElementById('userModal').addEventListener('click', (e) => { if (e.target.id === 'userModal') closeUserModal(); });

  document.getElementById('searchUserBtn').addEventListener('click', () => {
    loadUsers(document.getElementById('searchUserInput').value, document.getElementById('filterRole').value, document.getElementById('filterStatus').value, 1);
  });

  document.getElementById('reloadUsersBtn').addEventListener('click', () => {
    document.getElementById('searchUserInput').value = '';
    document.getElementById('filterRole').value = '';
    document.getElementById('filterStatus').value = '';
    loadUsers('', '', '', 1);
  });

  document.getElementById('searchUserInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadUsers(document.getElementById('searchUserInput').value, document.getElementById('filterRole').value, document.getElementById('filterStatus').value);
  });

  document.getElementById('usersPrevBtn').addEventListener('click', () => { if (usersCurrentPage > 1) goToUsersPage(usersCurrentPage - 1); });
  document.getElementById('usersNextBtn').addEventListener('click', () => goToUsersPage(usersCurrentPage + 1));

  // Import button
  document.getElementById('importExcelBtn').addEventListener('click', openImportUserModal);
}

// ========== IMPORT USERS ==========
function openImportUserModal() {
  // Tạo modal import nếu chưa có
  let modal = document.getElementById('importUserModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'importUserModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden items-center justify-center';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b border-slate-200">
          <h3 class="text-xl font-semibold text-slate-900">
            <i class="lucide lucide-file-spreadsheet text-emerald-500 mr-2" style="stroke-width:1.5;"></i>
            Import Người Dùng từ Excel/CSV
          </h3>
        </div>
        <div class="p-6 space-y-4">
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 class="font-medium text-amber-800 mb-2">
              <i class="lucide lucide-info mr-1" style="stroke-width:1.5;"></i> Hướng dẫn
            </h4>
            <ul class="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>File CSV phải có các cột: <strong>username, password, role, full_name</strong></li>
              <li>Cột tùy chọn: <strong>email, phone</strong></li>
              <li>Giá trị role: <strong>student</strong>, <strong>teacher</strong>, <strong>admin</strong></li>
              <li>Dòng đầu tiên là tiêu đề cột</li>
            </ul>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Chọn file CSV</label>
            <input type="file" id="importUserFile" accept=".csv,.txt" class="w-full border border-slate-300 rounded-lg p-2 text-slate-700">
          </div>
          
          <div id="importUserPreview" class="hidden">
            <label class="block text-sm font-medium text-slate-700 mb-2">Xem trước dữ liệu</label>
            <div class="max-h-60 overflow-auto border border-slate-200 rounded-lg">
              <table class="w-full text-sm">
                <thead class="bg-slate-50 sticky top-0">
                  <tr id="importUserPreviewHeader"></tr>
                </thead>
                <tbody id="importUserPreviewBody" class="divide-y divide-slate-200"></tbody>
              </table>
            </div>
            <p class="text-sm text-slate-500 mt-2">
              Tìm thấy <span id="importUserCount" class="font-semibold text-emerald-600">0</span> người dùng
            </p>
          </div>
          
          <div id="importUserProgress" class="hidden">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm text-slate-600">Đang import...</span>
              <span id="importUserProgressText" class="text-sm font-medium text-emerald-600">0%</span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-2">
              <div id="importUserProgressBar" class="bg-emerald-500 h-2 rounded-full transition-all" style="width: 0%"></div>
            </div>
          </div>
          
          <div id="importUserResult" class="hidden bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 class="font-medium text-slate-800 mb-2">Kết quả Import</h4>
            <div id="importUserResultContent" class="text-sm space-y-1"></div>
          </div>
        </div>
        <div class="p-6 border-t border-slate-200 flex gap-3 justify-end">
          <button id="closeImportUserModal" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition">
            Đóng
          </button>
          <button id="processImportUserBtn" class="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled>
            <i class="lucide lucide-upload mr-1" style="stroke-width:1.5;"></i> Import
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Event listeners cho modal
    document.getElementById('closeImportUserModal').addEventListener('click', closeImportUserModal);
    document.getElementById('importUserFile').addEventListener('change', previewImportUserFile);
    document.getElementById('processImportUserBtn').addEventListener('click', processImportUser);
    modal.addEventListener('click', (e) => { if (e.target.id === 'importUserModal') closeImportUserModal(); });
  }

  // Reset modal
  document.getElementById('importUserFile').value = '';
  document.getElementById('importUserPreview').classList.add('hidden');
  document.getElementById('importUserProgress').classList.add('hidden');
  document.getElementById('importUserResult').classList.add('hidden');
  document.getElementById('processImportUserBtn').disabled = true;
  importUserData = [];

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeImportUserModal() {
  const modal = document.getElementById('importUserModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

let importUserData = [];

function previewImportUserFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    const text = event.target.result;
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
      showToast('File không có dữ liệu', 'error');
      return;
    }

    // Parse header
    const headers = parseCSVLine(lines[0]);
    const requiredCols = ['username', 'password', 'role', 'full_name'];
    const missingCols = requiredCols.filter(col => !headers.map(h => h.toLowerCase().trim()).includes(col));

    if (missingCols.length > 0) {
      showToast(`Thiếu cột: ${missingCols.join(', ')}`, 'error');
      return;
    }

    // Parse data rows
    importUserData = [];
    const headerMap = {};
    headers.forEach((h, i) => headerMap[h.toLowerCase().trim()] = i);

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= requiredCols.length) {
        importUserData.push({
          username: values[headerMap['username']]?.trim() || '',
          password: values[headerMap['password']]?.trim() || '',
          role: values[headerMap['role']]?.trim().toLowerCase() || 'student',
          full_name: values[headerMap['full_name']]?.trim() || '',
          email: values[headerMap['email']]?.trim() || '',
          phone: values[headerMap['phone']]?.trim() || ''
        });
      }
    }

    // Validate data
    importUserData = importUserData.filter(u => u.username && u.password && u.role && u.full_name);

    if (importUserData.length === 0) {
      showToast('Không có dữ liệu hợp lệ', 'error');
      return;
    }

    // Show preview
    document.getElementById('importUserPreviewHeader').innerHTML =
      '<th class="px-3 py-2 text-left">Username</th>' +
      '<th class="px-3 py-2 text-left">Vai trò</th>' +
      '<th class="px-3 py-2 text-left">Họ tên</th>' +
      '<th class="px-3 py-2 text-left">Email</th>';

    document.getElementById('importUserPreviewBody').innerHTML = importUserData.slice(0, 10).map(u => `
      <tr>
        <td class="px-3 py-2">${u.username}</td>
        <td class="px-3 py-2">${getRoleLabel(u.role)}</td>
        <td class="px-3 py-2">${u.full_name}</td>
        <td class="px-3 py-2">${u.email || '-'}</td>
      </tr>
    `).join('') + (importUserData.length > 10 ? `<tr><td colspan="4" class="px-3 py-2 text-center text-slate-500">... và ${importUserData.length - 10} người dùng khác</td></tr>` : '');

    document.getElementById('importUserCount').textContent = importUserData.length;
    document.getElementById('importUserPreview').classList.remove('hidden');
    document.getElementById('processImportUserBtn').disabled = false;
  };

  reader.readAsText(file);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

function getRoleLabel(role) {
  const labels = {
    'student': 'Học sinh',
    'teacher': 'Giáo viên',
    'admin': 'Quản trị'
  };
  return labels[role] || role;
}

async function processImportUser() {
  if (importUserData.length === 0) {
    showToast('Không có dữ liệu để import', 'error');
    return;
  }

  document.getElementById('processImportUserBtn').disabled = true;
  document.getElementById('importUserProgress').classList.remove('hidden');

  let success = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < importUserData.length; i++) {
    const user = importUserData[i];

    try {
      const result = await fetchAPI('users.php', {
        method: 'POST',
        body: JSON.stringify(user)
      });

      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(`${user.username}: ${result.message || 'Lỗi không xác định'}`);
      }
    } catch (err) {
      failed++;
      errors.push(`${user.username}: Lỗi kết nối`);
    }

    // Update progress
    const progress = Math.round(((i + 1) / importUserData.length) * 100);
    document.getElementById('importUserProgressText').textContent = `${progress}%`;
    document.getElementById('importUserProgressBar').style.width = `${progress}%`;
  }

  // Show result
  document.getElementById('importUserResultContent').innerHTML = `
    <p class="text-emerald-600"><i class="lucide lucide-check-circle mr-1" style="stroke-width:1.5;"></i> Thành công: ${success}</p>
    <p class="text-red-600"><i class="lucide lucide-x-circle mr-1" style="stroke-width:1.5;"></i> Thất bại: ${failed}</p>
    ${errors.length > 0 ? `<div class="mt-2 max-h-32 overflow-auto text-red-600 text-xs">${errors.slice(0, 10).join('<br>')}${errors.length > 10 ? '<br>...' : ''}</div>` : ''}
  `;
  document.getElementById('importUserResult').classList.remove('hidden');

  if (success > 0) {
    showToast(`Import thành công ${success} người dùng`, 'success');
    loadUsers();
    loadDashboardStats();
  }

  document.getElementById('processImportUserBtn').disabled = false;
}
