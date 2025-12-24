/**
 * Teacher Conduct - Đánh giá hạnh kiểm
 */

// ====== Load Conduct (Homeroom only) ======
async function loadConduct(semester) {
  if (!homeroomClass) return;

  const tbody = document.getElementById('conductTable');
  tbody.innerHTML = `
    <tr>
      <td colspan="4" class="text-center px-4 py-8 text-slate-500">
        <div class="flex items-center justify-center gap-2">
          <div class="spinner"></div>
          <span>Đang tải...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await fetch(`${API_URL}/conduct.php?class_id=${homeroomClass.id}&semester=${semester}`);
    const result = await response.json();
    
    if (result.success) {
      renderConduct(result.data);
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center px-4 py-8 text-red-400">Lỗi tải dữ liệu</td></tr>`;
  }
}

function renderConduct(students) {
  const tbody = document.getElementById('conductTable');
  
  if (!students || students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center px-4 py-8 text-slate-500">Không có học sinh</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    // Normalize rating for display
    const rating = s.rating || 'Tot';
    const ratingMap = { 'Tot': 'Tốt', 'Kha': 'Khá', 'TB': 'Trung bình', 'Yeu': 'Yếu', 
                       'Tốt': 'Tốt', 'Khá': 'Khá', 'Trung bình': 'Trung bình', 'Yếu': 'Yếu' };
    return `
    <tr class="hover:bg-slate-200/80 transition" data-student-id="${s.student_id}">
      <td class="px-4 py-3 text-slate-800 font-mono">${s.student_code}</td>
      <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
      <td class="text-center px-4 py-3">
        <select class="conduct-rating bg-slate-50 border border-slate-300/50 rounded px-2 py-1 text-slate-800 text-sm">
          <option value="Tot" ${rating === 'Tot' || rating === 'Tốt' ? 'selected' : ''}>Tốt</option>
          <option value="Kha" ${rating === 'Kha' || rating === 'Khá' ? 'selected' : ''}>Khá</option>
          <option value="TB" ${rating === 'TB' || rating === 'Trung bình' ? 'selected' : ''}>Trung bình</option>
          <option value="Yeu" ${rating === 'Yeu' || rating === 'Yếu' ? 'selected' : ''}>Yếu</option>
        </select>
      </td>
      <td class="px-4 py-3">
        <input type="text" value="${s.comment || ''}" placeholder="Nhận xét..." 
               class="conduct-comment w-full bg-slate-50 border border-slate-300/50 rounded px-2 py-1 text-slate-800 text-sm">
      </td>
    </tr>
  `}).join('');
}

// ====== Save Conduct ======
async function saveConduct() {
  if (!homeroomClass) return;
  
  const semester = document.getElementById('conductTermSelect').value;
  const rows = document.querySelectorAll('#conductTable tr[data-student-id]');
  const conductData = [];

  rows.forEach(row => {
    conductData.push({
      student_id: row.dataset.studentId,
      semester: semester,
      rating: row.querySelector('.conduct-rating').value,
      comment: row.querySelector('.conduct-comment').value
    });
  });

  try {
    const response = await fetch(`${API_URL}/conduct.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conduct: conductData })
    });
    
    const result = await response.json();
    if (result.success) {
      showToast('Đã lưu hạnh kiểm thành công!');
    } else {
      showToast('Lỗi: ' + (result.message || 'Không thể lưu'));
    }
  } catch (error) {
    showToast('Lỗi kết nối server');
  }
}

// ====== Init Events ======
function initConductEvents() {
  document.getElementById('loadConductBtn').addEventListener('click', () => {
    const semester = document.getElementById('conductTermSelect').value;
    loadConduct(semester);
  });

  document.getElementById('saveConductBtn').addEventListener('click', saveConduct);
}
