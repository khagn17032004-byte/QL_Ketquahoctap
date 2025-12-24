// ====== Teachers Management ======
console.log('[DEBUG] admin-teachers.js loaded');

let teachersData = [];

async function loadTeachers(search = '', subjectId = '') {
  const tbody = document.getElementById('teachersTableBody');
  tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500"><div class="loader mx-auto mb-2"></div>Đang tải dữ liệu...</td></tr>`;

  let url = 'teachers.php?';
  if (search) url += `search=${encodeURIComponent(search)}&`;
  if (subjectId) url += `subject_id=${subjectId}&`;

  const result = await fetchAPI(url);

  if (result.success && result.data && result.data.length > 0) {
    teachersData = result.data;
    tbody.innerHTML = result.data.map(t => {
      return `<tr class="hover:bg-slate-200/80 transition">
        <td class="px-4 py-3 text-slate-800 font-mono text-sm">${t.teacher_code || '-'}</td>
        <td class="px-4 py-3 text-slate-800">${t.full_name}</td>
        <td class="text-center px-4 py-3 text-slate-700">${t.gender || '-'}</td>
        <td class="px-4 py-3"><span class="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-1">${t.subjects || '-'}</span></td>
        <td class="px-4 py-3 text-slate-700">${t.homeroom_class || '<span class="text-slate-400">-</span>'}</td>
        <td class="text-center px-4 py-3">
          <button onclick="editTeacher(${t.id})" class="px-2 py-1 rounded text-xs border border-slate-300 hover:bg-slate-200 transition mr-1">Sửa</button>
          <button onclick="deleteTeacher(${t.id})" class="px-2 py-1 rounded text-xs border border-red-700 text-red-600 hover:bg-red-900/30 transition">Xóa</button>
        </td>
      </tr>`;
    }).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Không có dữ liệu</td></tr>`;
  }
}

async function loadSubjectOptions() {
  const result = await fetchAPI('subjects.php');
  if (result.success) {
    const filterSelect = document.getElementById('filterTeacherSubject');
    filterSelect.innerHTML = '<option value="">Tất cả</option>' + result.data.map(s => `<option value="${s.id}">${s.subject_name}</option>`).join('');
  }
}

async function editTeacher(id) {
  const result = await fetchAPI(`teachers.php?id=${id}`);
  if (result.success && result.data) {
    const t = result.data;
    document.getElementById('teacherModalTitle').innerHTML = '<i class="lucide lucide-edit text-emerald-400" style="stroke-width:1.5;"></i> Sửa Giáo Viên';
    document.getElementById('teacherFormId').value = t.id;
    document.getElementById('teacherFormCode').value = t.teacher_code || '';
    document.getElementById('teacherFormName').value = t.full_name || '';
    document.getElementById('teacherFormGender').value = t.gender || 'Nam';
    document.getElementById('teacherFormDOB').value = t.birth_date || '';
    document.getElementById('teacherFormDepartment').value = t.department || '';
    document.getElementById('teacherFormAddress').value = t.address || '';

    await loadTeacherHomeroomOptions(t.homeroom_class_id);
    await loadTeacherSubjectCheckboxes(t.subject_ids || []);

    const modal = document.getElementById('teacherModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

async function loadTeacherHomeroomOptions(selectedId = null) {
  const result = await fetchAPI('classes.php');
  if (result.success) {
    const select = document.getElementById('teacherFormHomeroom');
    select.innerHTML = '<option value="">Không chủ nhiệm</option>' +
      result.data.map(c => `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${c.class_name}</option>`).join('');
  }
}

async function loadTeacherSubjectCheckboxes(selectedIds = []) {
  const result = await fetchAPI('subjects.php');
  if (result.success) {
    const container = document.getElementById('teacherSubjectsCheckboxes');
    container.innerHTML = result.data.map(s => `
      <label class="flex items-center gap-2 p-2 rounded border border-slate-300/50 hover:bg-slate-100 cursor-pointer">
        <input type="checkbox" name="teacherSubjects" value="${s.id}" ${selectedIds.includes(s.id) ? 'checked' : ''} class="text-emerald-500">
        <span class="text-sm text-slate-700">${s.subject_name}</span>
      </label>
    `).join('');
  }
}

async function deleteTeacher(id) {
  UI.modal.confirm({
    title: 'Xóa Giáo Viên',
    message: 'Bạn có chắc chắn muốn xóa giáo viên này? Thông tin tài khoản liên quan cũng có thể bị ảnh hưởng.',
    type: 'danger',
    confirmText: 'Xóa Giáo Viên',
    onConfirm: async () => {
      const result = await fetchAPI('teachers.php', { method: 'DELETE', body: JSON.stringify({ id }) });
      if (result.success) {
        UI.toast.success('Xóa thành công!');
        loadTeachers();
        loadDashboardStats();
      } else {
        UI.toast.error(result.message || 'Không thể xóa');
      }
    }
  });
}

function openAddTeacherModal() {
  document.getElementById('teacherModalTitle').innerHTML = '<i class="lucide lucide-user-plus text-emerald-400" style="stroke-width:1.5;"></i> Thêm Giáo Viên';
  document.getElementById('teacherForm').reset();
  document.getElementById('teacherFormId').value = '';
  loadTeacherHomeroomOptions();
  loadTeacherSubjectCheckboxes();

  const modal = document.getElementById('teacherModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeTeacherModal() {
  const modal = document.getElementById('teacherModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function initTeachersEvents() {
  loadSubjectOptions();

  document.getElementById('teacherForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEdit = !!document.getElementById('teacherFormId').value;
    const subjectCheckboxes = document.querySelectorAll('input[name="teacherSubjects"]:checked');

    const data = {
      id: document.getElementById('teacherFormId').value || undefined,
      teacher_code: document.getElementById('teacherFormCode').value,
      full_name: document.getElementById('teacherFormName').value,
      gender: document.getElementById('teacherFormGender').value,
      birth_date: document.getElementById('teacherFormDOB').value || null,
      department: document.getElementById('teacherFormDepartment').value,
      address: document.getElementById('teacherFormAddress').value,
      phone: document.getElementById('teacherFormPhone').value || null,
      email: document.getElementById('teacherFormEmail').value || null,
      homeroom_class_id: document.getElementById('teacherFormHomeroom').value || null,
      subject_ids: Array.from(subjectCheckboxes).map(cb => cb.value)
    };

    const result = await fetchAPI('teachers.php', { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(data) });
    if (result.success) {
      showToast(isEdit ? 'Cập nhật thành công!' : 'Thêm giáo viên thành công!', 'success');
      closeTeacherModal();
      loadTeachers();
      loadDashboardStats();
    } else {
      showToast(result.message || 'Có lỗi xảy ra', 'error');
    }
  });

  document.getElementById('closeTeacherModal').addEventListener('click', closeTeacherModal);
  document.getElementById('cancelTeacherBtn').addEventListener('click', closeTeacherModal);
  document.getElementById('addTeacherBtn').addEventListener('click', openAddTeacherModal);
  document.getElementById('teacherModal').addEventListener('click', (e) => { if (e.target.id === 'teacherModal') closeTeacherModal(); });

  document.getElementById('searchTeacherBtn').addEventListener('click', () => {
    loadTeachers(document.getElementById('searchTeacherInput').value, document.getElementById('filterTeacherSubject').value);
  });
}
