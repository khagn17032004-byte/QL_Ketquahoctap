/**
 * Teacher View Grades - Xem điểm lớp chủ nhiệm
 */

// ====== View Grades (Homeroom only - read only) ======
async function viewGrades() {
  if (!homeroomClass) return;
  
  const subjectId = document.getElementById('viewSubjectSelect').value;
  const semester = document.getElementById('viewTermSelect').value;
  
  if (!subjectId) {
    showToast('Vui lòng chọn môn học');
    return;
  }

  const tbody = document.getElementById('viewGradesTable');
  const thead = document.getElementById('viewGradesHeader');
  
  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="text-center px-4 py-8 text-slate-500">
        <div class="flex items-center justify-center gap-2">
          <div class="spinner"></div>
          <span>Đang tải...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    // Nếu xem điểm cả năm
    if (semester === 'year') {
      thead.innerHTML = `
        <tr>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mã HS</th>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Học Sinh</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">TBM HK1</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">TBM HK2</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-amber-400 uppercase">TBM Cả Năm</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Xếp Loại</th>
        </tr>
      `;
      
      const response = await fetch(`${API_URL}/annual-scores.php?class_id=${homeroomClass.id}&subject_id=${subjectId}`);
      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        tbody.innerHTML = result.data.map(s => {
          const hk1 = s.hk1_score !== null ? parseFloat(s.hk1_score).toFixed(2) : '-';
          const hk2 = s.hk2_score !== null ? parseFloat(s.hk2_score).toFixed(2) : '-';
          const annual = s.annual_score !== null ? parseFloat(s.annual_score).toFixed(2) : '-';
          const rank = getGradeRank(s.annual_score);
          return `
            <tr class="hover:bg-slate-200/80 transition">
              <td class="px-4 py-3 text-slate-800 font-mono">${s.student_code}</td>
              <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
              <td class="text-center px-4 py-3 text-slate-700">${hk1}</td>
              <td class="text-center px-4 py-3 text-slate-700">${hk2}</td>
              <td class="text-center px-4 py-3 font-bold text-amber-600">${annual}</td>
              <td class="text-center px-4 py-3 font-medium ${rank.class}">${rank.text}</td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center px-4 py-8 text-slate-500">Chưa có điểm</td></tr>`;
      }
    } else {
      // Xem điểm theo học kỳ
      thead.innerHTML = `
        <tr>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mã HS</th>
          <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Học Sinh</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Miệng</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">15 Phút</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">1 Tiết</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Giữa Kỳ</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Cuối Kỳ</th>
          <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">TB Môn</th>
        </tr>
      `;
      
      const response = await fetch(`${API_URL}/grades.php?class_id=${homeroomClass.id}&subject_id=${subjectId}&semester=${semester}`);
      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        tbody.innerHTML = result.data.map(s => {
          const avg = calculateAverage(s);
          return `
            <tr class="hover:bg-slate-200/80 transition">
              <td class="px-4 py-3 text-slate-800 font-mono">${s.student_code}</td>
              <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
              <td class="text-center px-4 py-3 text-slate-700">${s.oral_score || '-'}</td>
              <td class="text-center px-4 py-3 text-slate-700">${s.fifteen_min_score || '-'}</td>
              <td class="text-center px-4 py-3 text-slate-700">${s.one_period_score || '-'}</td>
              <td class="text-center px-4 py-3 text-slate-700">${s.midterm_score || '-'}</td>
              <td class="text-center px-4 py-3 text-slate-700">${s.semester_score || '-'}</td>
              <td class="text-center px-4 py-3 font-semibold ${parseFloat(avg) >= 5 ? 'text-emerald-400' : 'text-rose-400'}">${avg}</td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center px-4 py-8 text-slate-500">Chưa có điểm</td></tr>`;
      }
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center px-4 py-8 text-red-400">Lỗi tải dữ liệu</td></tr>`;
  }
}

// ====== Init Events ======
function initViewGradesEvents() {
  document.getElementById('viewGradesBtn').addEventListener('click', viewGrades);
}
