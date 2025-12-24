// ====== Scholarship Management ======

// Lưu trữ dữ liệu gốc (top 50 toàn trường)
let scholarshipAcademicData = [];
let scholarshipPolicyData = [];

async function loadScholarship() {
  const academicBody = document.getElementById('academicScholarshipBody');
  const policyBody = document.getElementById('policyScholarshipBody');
  const yearSelect = document.getElementById('scholarshipYear');
  const gradeSelect = document.getElementById('scholarshipGrade');

  const year = yearSelect?.value || '2024-2025';
  const grade = gradeSelect?.value || '';

  // Loading state
  if (academicBody) {
    academicBody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-500"><div class="loader mx-auto mb-2"></div>Đang tải dữ liệu...</td></tr>`;
  }
  if (policyBody) {
    policyBody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500"><div class="loader mx-auto mb-2"></div>Đang tải dữ liệu...</td></tr>`;
  }

  // Luôn lấy top 50 toàn trường (không filter grade_level ở API)
  // Điều kiện: ĐTB >= 8.5
  const url = `scholarship.php?academic_year=${encodeURIComponent(year)}&limit=50`;
  const result = await fetchAPI(url);

  if (result.success && result.data) {
    // Lưu dữ liệu gốc và lọc ĐTB >= 8.5
    scholarshipAcademicData = (result.data.academic || []).filter(s => parseFloat(s.avg_year) >= 8.5);
    scholarshipPolicyData = result.data.policy || [];

    // Hiển thị với filter khối nếu có
    displayScholarshipData(grade);
  } else {
    scholarshipAcademicData = [];
    scholarshipPolicyData = [];
    displayScholarshipData(grade);
  }
}

// Hàm hiển thị dữ liệu với filter khối (từ dữ liệu đã load)
function displayScholarshipData(grade) {
  const academicBody = document.getElementById('academicScholarshipBody');
  const policyBody = document.getElementById('policyScholarshipBody');

  // Filter theo khối nếu có chọn
  let filteredAcademic = scholarshipAcademicData;
  let filteredPolicy = scholarshipPolicyData;

  if (grade) {
    filteredAcademic = scholarshipAcademicData.filter(s => s.class_name && s.class_name.startsWith(grade));
    filteredPolicy = scholarshipPolicyData.filter(s => s.class_name && s.class_name.startsWith(grade));
  }

  // Academic scholarship
  if (filteredAcademic.length > 0 && academicBody) {
    const countEl = document.getElementById('scholarshipAcademicCount');
    if (countEl) countEl.textContent = filteredAcademic.length;

    academicBody.innerHTML = filteredAcademic.map((s, idx) => `
      <tr class="hover:bg-slate-100 transition">
        <td class="text-center px-3 py-3">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full ${s.rank <= 3 ? 'bg-amber-100 text-amber-600 font-bold' : 'bg-slate-100 text-slate-600'}">${s.rank || (idx + 1)}</span>
        </td>
        <td class="px-3 py-3 font-mono text-sm text-slate-700">${s.student_code}</td>
        <td class="px-3 py-3 text-slate-800 font-medium">${s.full_name}</td>
        <td class="text-center px-3 py-3"><span class="inline-flex items-center rounded-full bg-sky-100 text-sky-700 text-xs px-2 py-1">${s.class_name}</span></td>
        <td class="text-center px-3 py-3 text-slate-700">${s.avg_hk1 ? parseFloat(s.avg_hk1).toFixed(2) : '-'}</td>
        <td class="text-center px-3 py-3 text-slate-700">${s.avg_hk2 ? parseFloat(s.avg_hk2).toFixed(2) : '-'}</td>
        <td class="text-center px-3 py-3 font-bold text-emerald-600">${s.avg_year ? parseFloat(s.avg_year).toFixed(2) : '-'}</td>
        <td class="text-center px-3 py-3"><span class="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-1">${s.conduct_hk2 || s.conduct_hk1 || '-'}</span></td>
        <td class="text-center px-3 py-3">
          <button onclick="viewScholarshipDetail(${s.student_id})" class="px-2 py-1 rounded text-xs border border-slate-300 hover:bg-slate-200 transition">Xem</button>
        </td>
      </tr>
    `).join('');
  } else if (academicBody) {
    const countEl = document.getElementById('scholarshipAcademicCount');
    if (countEl) countEl.textContent = '0';
    const gradeText = grade ? ` khối ${grade}` : '';
    academicBody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-slate-500">Không có học sinh${gradeText} đủ điều kiện học bổng học tập (ĐTB >= 8.5)</td></tr>`;
  }

  // Policy scholarship  
  if (filteredPolicy.length > 0 && policyBody) {
    const countEl = document.getElementById('scholarshipPolicyCount');
    if (countEl) countEl.textContent = filteredPolicy.length;

    policyBody.innerHTML = filteredPolicy.map(s => `
      <tr class="hover:bg-slate-100 transition">
        <td class="px-4 py-3 font-mono text-sm text-slate-700">${s.student_code}</td>
        <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
        <td class="text-center px-4 py-3"><span class="inline-flex items-center rounded-full bg-sky-100 text-sky-700 text-xs px-2 py-1">${s.class_name}</span></td>
        <td class="px-4 py-3">${getPolicyBadge(s.policy_object)}</td>
        <td class="text-center px-4 py-3 font-semibold text-slate-700">${s.avg_year ? parseFloat(s.avg_year).toFixed(2) : '-'}</td>
        <td class="text-center px-4 py-3"><span class="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-1">${s.conduct || '-'}</span></td>
        <td class="text-center px-3 py-3">
          <button onclick="viewScholarshipDetail(${s.student_id})" class="px-2 py-1 rounded text-xs border border-slate-300 hover:bg-slate-200 transition">Xem</button>
        </td>
      </tr>
    `).join('');
  } else if (policyBody) {
    const countEl = document.getElementById('scholarshipPolicyCount');
    if (countEl) countEl.textContent = '0';
    policyBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">Không có dữ liệu học bổng chính sách</td></tr>`;
  }
}

// Filter theo khối (không cần gọi API lại)
function filterScholarshipByGrade() {
  const gradeSelect = document.getElementById('scholarshipGrade');
  const grade = gradeSelect?.value || '';
  displayScholarshipData(grade);
}

async function viewScholarshipDetail(studentId) {
  const modal = document.getElementById('studentGradesModal');
  const tableBody = document.getElementById('studentGradesTableBody');

  if (!modal || !tableBody) return;

  modal.classList.remove('hidden');
  modal.classList.add('flex');

  tableBody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-500">Đang tải...</td></tr>';

  try {
    // Lấy thông tin học sinh
    const studentResult = await fetchAPI(`students.php?id=${studentId}`);
    if (!studentResult.success || !studentResult.data) {
      throw new Error('Không tìm thấy học sinh');
    }

    const student = studentResult.data;
    const academicYear = document.getElementById('scholarshipYear')?.value || '2024-2025';

    // Hiển thị thông tin học sinh
    document.getElementById('gradesStudentName').textContent = student.full_name;
    document.getElementById('gradesStudentClass').textContent = student.class_name || '--';

    // Lấy điểm HK1 và HK2
    const [gradesHK1Result, gradesHK2Result] = await Promise.all([
      fetchAPI(`grades.php?student_id=${studentId}&semester=1&academic_year=${academicYear}`),
      fetchAPI(`grades.php?student_id=${studentId}&semester=2&academic_year=${academicYear}`)
    ]);

    const gradesHK1 = gradesHK1Result.success ? gradesHK1Result.data : [];
    const gradesHK2 = gradesHK2Result.success ? gradesHK2Result.data : [];

    // Tạo map môn học
    const subjectsMap = {};

    gradesHK1.forEach(g => {
      if (!subjectsMap[g.subject_id]) {
        subjectsMap[g.subject_id] = {
          name: g.subject_name,
          hk1: null,
          hk2: null
        };
      }
      subjectsMap[g.subject_id].hk1 = g.average_score;
    });

    gradesHK2.forEach(g => {
      if (!subjectsMap[g.subject_id]) {
        subjectsMap[g.subject_id] = {
          name: g.subject_name,
          hk1: null,
          hk2: null
        };
      }
      subjectsMap[g.subject_id].hk2 = g.average_score;
    });

    // Tính DTB tổng
    let sumHK1 = 0, countHK1 = 0;
    let sumHK2 = 0, countHK2 = 0;

    Object.values(subjectsMap).forEach(subject => {
      if (subject.hk1 !== null && subject.hk1 > 0) {
        sumHK1 += parseFloat(subject.hk1);
        countHK1++;
      }
      if (subject.hk2 !== null && subject.hk2 > 0) {
        sumHK2 += parseFloat(subject.hk2);
        countHK2++;
      }
    });

    const avgHK1 = countHK1 > 0 ? (sumHK1 / countHK1).toFixed(2) : '--';
    const avgHK2 = countHK2 > 0 ? (sumHK2 / countHK2).toFixed(2) : '--';

    document.getElementById('gradesAvgHK1').textContent = avgHK1;
    document.getElementById('gradesAvgHK2').textContent = avgHK2;

    // Render bảng điểm
    if (Object.keys(subjectsMap).length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-slate-500">Chưa có điểm</td></tr>';
      return;
    }

    tableBody.innerHTML = Object.values(subjectsMap).map(subject => {
      const hk1 = subject.hk1 !== null && subject.hk1 > 0 ? parseFloat(subject.hk1).toFixed(2) : '--';
      const hk2 = subject.hk2 !== null && subject.hk2 > 0 ? parseFloat(subject.hk2).toFixed(2) : '--';

      let avgYear = '--';
      let avgClass = 'text-slate-400';

      if (subject.hk1 > 0 && subject.hk2 > 0) {
        const avg = (parseFloat(subject.hk1) + parseFloat(subject.hk2) * 2) / 3;
        avgYear = avg.toFixed(2);
        avgClass = avg >= 8 ? 'text-green-600 font-bold' : avg >= 6.5 ? 'text-blue-600' : avg >= 5 ? 'text-yellow-600' : 'text-red-600';
      }

      const hk1Class = subject.hk1 >= 8 ? 'text-green-600' : subject.hk1 >= 6.5 ? 'text-blue-600' : subject.hk1 >= 5 ? 'text-yellow-600' : subject.hk1 > 0 ? 'text-red-600' : 'text-slate-400';
      const hk2Class = subject.hk2 >= 8 ? 'text-green-600' : subject.hk2 >= 6.5 ? 'text-blue-600' : subject.hk2 >= 5 ? 'text-yellow-600' : subject.hk2 > 0 ? 'text-red-600' : 'text-slate-400';

      return `
        <tr class="hover:bg-slate-50">
          <td class="px-4 py-3 text-slate-800 font-medium">${subject.name}</td>
          <td class="text-center px-4 py-3 ${hk1Class}">${hk1}</td>
          <td class="text-center px-4 py-3 ${hk2Class}">${hk2}</td>
          <td class="text-center px-4 py-3 ${avgClass}">${avgYear}</td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading student grades:', error);
    tableBody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-red-500">Lỗi tải dữ liệu</td></tr>';
  }
}

function exportScholarshipReport() {
  const year = document.getElementById('scholarshipYear')?.value || '2024-2025';
  const grade = document.getElementById('scholarshipGrade')?.value || '';

  // Lấy dữ liệu hiện tại để xuất
  const academicBody = document.getElementById('academicScholarshipBody');
  const policyBody = document.getElementById('policyScholarshipBody');

  if (!academicBody || academicBody.querySelector('td[colspan]')) {
    showToast('Không có dữ liệu để xuất. Vui lòng tải dữ liệu trước!', 'error');
    return;
  }

  // Tạo nội dung báo cáo
  const printWindow = window.open('', '_blank');
  const gradeTitle = grade ? `Khối ${grade}` : 'Tất cả khối';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Báo Cáo Học Bổng - ${year}</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1, h2 { text-align: center; color: #333; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
        th { background: #f5f5f5; font-weight: bold; }
        .section-title { background: #fef3c7; padding: 10px; margin: 20px 0 10px; font-weight: bold; }
        .footer { text-align: right; margin-top: 30px; font-size: 12px; color: #666; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>BÁO CÁO HỌC BỔNG</h1>
      <h2>Năm học: ${year} - ${gradeTitle}</h2>
      
      <div class="section-title">🏆 HỌC BỔNG HỌC TẬP</div>
      <table>
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Mã HS</th>
            <th>Họ và tên</th>
            <th>Lớp</th>
            <th>ĐTB HK1</th>
            <th>ĐTB HK2</th>
            <th>ĐTB Năm</th>
            <th>Hạnh kiểm</th>
          </tr>
        </thead>
        <tbody>
          ${academicBody.innerHTML}
        </tbody>
      </table>
      
      <div class="section-title">💜 HỌC BỔNG CHÍNH SÁCH</div>
      <table>
        <thead>
          <tr>
            <th>Mã HS</th>
            <th>Họ và tên</th>
            <th>Lớp</th>
            <th>Đối tượng</th>
            <th>ĐTB Năm</th>
            <th>Hạnh kiểm</th>
          </tr>
        </thead>
        <tbody>
          ${policyBody ? policyBody.innerHTML : '<tr><td colspan="6">Không có dữ liệu</td></tr>'}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}</p>
      </div>
      
      <script>window.print();</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function initScholarshipEvents() {
  const yearSelect = document.getElementById('scholarshipYear');
  const gradeSelect = document.getElementById('scholarshipGrade');
  const loadBtn = document.getElementById('loadScholarshipBtn');
  const exportBtn = document.getElementById('exportScholarshipBtn');

  // Khi thay đổi năm học -> load lại từ API
  if (yearSelect) {
    yearSelect.addEventListener('change', loadScholarship);
  }
  // Khi thay đổi khối -> chỉ filter từ dữ liệu đã load (không gọi API)
  if (gradeSelect) {
    gradeSelect.addEventListener('change', filterScholarshipByGrade);
  }
  if (loadBtn) {
    loadBtn.addEventListener('click', loadScholarship);
  }
  if (exportBtn) {
    exportBtn.addEventListener('click', exportScholarshipReport);
  }

  const sendNotiBtn = document.getElementById('sendScholarshipNotiBtn');
  if (sendNotiBtn) {
    sendNotiBtn.addEventListener('click', sendScholarshipNotifications);
  }

  // Load dữ liệu ban đầu
  loadScholarship();
}

async function sendScholarshipNotifications() {
  if (scholarshipAcademicData.length === 0 && scholarshipPolicyData.length === 0) {
    showToast('Không có dữ liệu học sinh để gửi thông báo', 'error');
    return;
  }

  UI.modal.confirm({
    title: 'Gửi Thông Báo Học Bổng',
    message: `Bạn có chắc chắn muốn gửi thông báo cho <b>${scholarshipAcademicData.length}</b> học sinh đạt học bổng và <b>${scholarshipPolicyData.length}</b> học sinh đối tượng chính sách?`,
    confirmText: 'Gửi Thông Báo',
    cancelText: 'Hủy',
    onConfirm: async () => {
      const year = document.getElementById('scholarshipYear')?.value || '2024-2025';
      try {
        const result = await fetchAPI('scholarship.php', {
          method: 'POST',
          body: JSON.stringify({
            action: 'send_notifications',
            academic_year: year,
            academic_students: scholarshipAcademicData.map(s => s.student_id),
            policy_students: scholarshipPolicyData.map(s => s.student_id)
          })
        });

        if (result.success) {
          UI.toast.success(result.message || 'Đã gửi thông báo thành công');
        } else {
          UI.toast.error(result.message || 'Lỗi khi gửi thông báo');
        }
      } catch (error) {
        console.error('Error sending notifications:', error);
        UI.toast.error('Lỗi kết nối máy chủ');
      }
    }
  });
}
