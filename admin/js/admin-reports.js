// ====== Reports Management ======

async function generateGVCNReport() {
  const printContent = document.getElementById('reportPreviewContent');
  const printArea = document.getElementById('reportPreviewArea');
  const yearSelect = document.getElementById('reportGVCNYear');
  const gradeSelect = document.getElementById('reportGVCNGrade');
  const schoolYear = yearSelect?.value || '2024-2025';
  const grade = gradeSelect?.value || '';
  
  printContent.innerHTML = '<div class="flex justify-center py-10"><div class="loader"></div></div>';
  printArea.classList.remove('hidden');
  
  // Lấy danh sách lớp và giáo viên
  const [classesResult, teachersResult] = await Promise.all([
    fetchAPI('classes.php'),
    fetchAPI('teachers.php')
  ]);
  
  if (classesResult.success && classesResult.data && teachersResult.success && teachersResult.data) {
    // Lọc lớp theo khối nếu có
    let filteredClasses = classesResult.data;
    if (grade) {
      filteredClasses = classesResult.data.filter(c => c.class_name && c.class_name.startsWith(grade));
    }
    
    // Sắp xếp theo tên lớp
    filteredClasses.sort((a, b) => (a.class_name || '').localeCompare(b.class_name || ''));
    
    // Tạo map giáo viên theo ID
    const teacherMap = {};
    teachersResult.data.forEach(t => {
      teacherMap[t.id] = t;
    });
    
    // Tạo danh sách GVCN với thông tin chi tiết
    const gvcnList = filteredClasses.map(c => {
      const teacher = c.homeroom_teacher_id ? teacherMap[c.homeroom_teacher_id] : null;
      return {
        class_name: c.class_name,
        student_count: c.student_count || 0,
        teacher_name: c.homeroom_teacher_name || '-',
        teacher_phone: teacher?.phone || '-',
        teacher_email: teacher?.email || '-'
      };
    });
    
    const gradeTitle = grade ? `KHỐI ${grade}` : 'TẤT CẢ CÁC KHỐI';
    
    printContent.innerHTML = `
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-slate-800">DANH SÁCH GIÁO VIÊN CHỦ NHIỆM ${gradeTitle}</h2>
        <p class="text-slate-500 text-sm">Năm học: ${schoolYear}</p>
      </div>
      <table class="w-full border-collapse border border-slate-300 text-sm">
        <thead>
          <tr class="bg-slate-100">
            <th class="border border-slate-300 px-3 py-2 text-center">STT</th>
            <th class="border border-slate-300 px-3 py-2 text-center">Lớp</th>
            <th class="border border-slate-300 px-3 py-2 text-center">Sĩ số</th>
            <th class="border border-slate-300 px-3 py-2 text-left">Giáo viên chủ nhiệm</th>
            <th class="border border-slate-300 px-3 py-2 text-center">Số điện thoại</th>
            <th class="border border-slate-300 px-3 py-2 text-left">Email</th>
          </tr>
        </thead>
        <tbody>
          ${gvcnList.map((item, idx) => `
            <tr>
              <td class="border border-slate-300 px-3 py-2 text-center">${idx + 1}</td>
              <td class="border border-slate-300 px-3 py-2 text-center font-semibold">${item.class_name}</td>
              <td class="border border-slate-300 px-3 py-2 text-center">${item.student_count}</td>
              <td class="border border-slate-300 px-3 py-2">${item.teacher_name}</td>
              <td class="border border-slate-300 px-3 py-2 text-center">${item.teacher_phone}</td>
              <td class="border border-slate-300 px-3 py-2">${item.teacher_email}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="mt-6 text-right text-sm text-slate-500">
        <p>Tổng số: ${gvcnList.length} lớp</p>
        <p class="mt-4">Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p>
      </div>
    `;
  } else {
    printContent.innerHTML = '<p class="text-center text-slate-500 py-10">Không có dữ liệu</p>';
  }
}

async function generateStudentListReport() {
  const printContent = document.getElementById('reportPreviewContent');
  const printArea = document.getElementById('reportPreviewArea');
  const classSelect = document.getElementById('reportStudentClass');
  const yearSelect = document.getElementById('reportStudentYear');
  const typeSelect = document.getElementById('reportStudentType');
  const classId = classSelect?.value;
  const schoolYear = yearSelect?.value || '2024-2025';
  const reportType = typeSelect?.value || 'attendance';
  
  if (!classId) {
    showToast('Vui lòng chọn lớp', 'error');
    return;
  }
  
  const className = classSelect.options[classSelect.selectedIndex].text;
  
  printContent.innerHTML = '<div class="flex justify-center py-10"><div class="loader"></div></div>';
  printArea.classList.remove('hidden');
  
  const result = await fetchAPI(`students.php?class_id=${classId}`);
  
  if (result.success && result.data && result.data.length > 0) {
    const title = reportType === 'attendance' ? 'ĐIỂM DANH' : 'GHI ĐIỂM';
    const tableHeaders = reportType === 'attendance' 
      ? `<th class="border border-slate-300 px-3 py-2 text-center w-20">Có mặt</th>
         <th class="border border-slate-300 px-3 py-2 text-center w-20">Vắng</th>
         <th class="border border-slate-300 px-3 py-2 text-left w-32">Ghi chú</th>`
      : `<th class="border border-slate-300 px-3 py-2 text-center w-16">Miệng</th>
         <th class="border border-slate-300 px-3 py-2 text-center w-16">15p</th>
         <th class="border border-slate-300 px-3 py-2 text-center w-16">1 tiết</th>
         <th class="border border-slate-300 px-3 py-2 text-center w-16">Giữa kỳ</th>
         <th class="border border-slate-300 px-3 py-2 text-center w-16">Cuối kỳ</th>
         <th class="border border-slate-300 px-3 py-2 text-center w-20">TBM</th>`;
    
    const tableRows = reportType === 'attendance'
      ? result.data.map((s, idx) => `
          <tr>
            <td class="border border-slate-300 px-3 py-2 text-center">${idx + 1}</td>
            <td class="border border-slate-300 px-3 py-2 font-mono">${s.student_code}</td>
            <td class="border border-slate-300 px-3 py-2">${s.full_name}</td>
            <td class="border border-slate-300 px-3 py-2 text-center">${s.gender}</td>
            <td class="border border-slate-300 px-3 py-2 text-center">${s.birth_date || '-'}</td>
            <td class="border border-slate-300 px-3 py-2 text-center"></td>
            <td class="border border-slate-300 px-3 py-2 text-center"></td>
            <td class="border border-slate-300 px-3 py-2"></td>
          </tr>
        `).join('')
      : result.data.map((s, idx) => `
          <tr>
            <td class="border border-slate-300 px-3 py-2 text-center">${idx + 1}</td>
            <td class="border border-slate-300 px-3 py-2 font-mono">${s.student_code}</td>
            <td class="border border-slate-300 px-3 py-2">${s.full_name}</td>
            <td class="border border-slate-300 px-3 py-2 text-center">${s.gender}</td>
            <td class="border border-slate-300 px-3 py-2 text-center">${s.birth_date || '-'}</td>
            <td class="border border-slate-300 px-3 py-2 text-center"></td>
            <td class="border border-slate-300 px-3 py-2 text-center"></td>
            <td class="border border-slate-300 px-3 py-2 text-center"></td>
            <td class="border border-slate-300 px-3 py-2 text-center"></td>
            <td class="border border-slate-300 px-3 py-2 text-center"></td>
            <td class="border border-slate-300 px-3 py-2 text-center"></td>
          </tr>
        `).join('');
    
    printContent.innerHTML = `
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-slate-800">DANH SÁCH ${title} - LỚP ${className.toUpperCase()}</h2>
        <p class="text-slate-500 text-sm">Năm học: ${schoolYear}</p>
      </div>
      <table class="w-full border-collapse border border-slate-300 text-sm">
        <thead>
          <tr class="bg-slate-100">
            <th class="border border-slate-300 px-3 py-2 text-center w-12">STT</th>
            <th class="border border-slate-300 px-3 py-2 text-left w-24">Mã HS</th>
            <th class="border border-slate-300 px-3 py-2 text-left">Họ và tên</th>
            <th class="border border-slate-300 px-3 py-2 text-center w-20">GT</th>
            <th class="border border-slate-300 px-3 py-2 text-center w-24">Ngày sinh</th>
            ${tableHeaders}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div class="mt-6 text-right text-sm text-slate-500">
        <p>Tổng số: ${result.data.length} học sinh</p>
        <p class="mt-4">Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p>
        ${reportType === 'grades' ? '<p class="mt-2 text-left text-slate-600">Môn: ___________________ &nbsp;&nbsp; Học kỳ: _____ &nbsp;&nbsp; Giáo viên: ___________________</p>' : ''}
        ${reportType === 'attendance' ? '<p class="mt-2 text-left text-slate-600">Ngày: ___/___/_______ &nbsp;&nbsp; Tiết: _____ &nbsp;&nbsp; Giáo viên điểm danh: ___________________</p>' : ''}
      </div>
    `;
  } else {
    printContent.innerHTML = '<p class="text-center text-slate-500 py-10">Không có dữ liệu học sinh trong lớp này</p>';
  }
}

async function exportStudentListToExcel(classId, className, schoolYear, reportType) {
  const result = await fetchAPI(`students.php?class_id=${classId}`);
  
  if (!result.success || !result.data || result.data.length === 0) {
    showToast('Không có dữ liệu để xuất', 'error');
    return;
  }
  
  const title = reportType === 'attendance' ? 'ĐIỂM DANH' : 'GHI ĐIỂM';
  
  let csvContent = '\uFEFF'; // UTF-8 BOM
  csvContent += `DANH SÁCH ${title} - LỚP ${className.toUpperCase()}\n`;
  csvContent += `Năm học: ${schoolYear}\n\n`;
  
  if (reportType === 'attendance') {
    csvContent += 'STT,Mã HS,Họ và tên,Giới tính,Ngày sinh,Có mặt,Vắng,Ghi chú\n';
    result.data.forEach((s, idx) => {
      csvContent += `${idx + 1},${s.student_code},"${s.full_name}",${s.gender},${s.birth_date || ''},,,,\n`;
    });
  } else {
    csvContent += 'STT,Mã HS,Họ và tên,Giới tính,Ngày sinh,Miệng,15 phút,1 tiết,Giữa kỳ,Cuối kỳ,TBM\n';
    result.data.forEach((s, idx) => {
      csvContent += `${idx + 1},${s.student_code},"${s.full_name}",${s.gender},${s.birth_date || ''},,,,,,\n`;
    });
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${className}_${reportType === 'attendance' ? 'DiemDanh' : 'GhiDiem'}_${new Date().getTime()}.csv`;
  link.click();
  
  showToast('Đã xuất file Excel thành công!', 'success');
}

async function generateTeacherBySubjectReport() {
  const printContent = document.getElementById('reportPreviewContent');
  const printArea = document.getElementById('reportPreviewArea');
  const subjectSelect = document.getElementById('reportTeacherSubject');
  const selectedSubjectId = subjectSelect?.value || '';
  const selectedSubjectName = subjectSelect?.options[subjectSelect.selectedIndex]?.text || 'Tất cả môn';
  
  printContent.innerHTML = '<div class="flex justify-center py-10"><div class="loader"></div></div>';
  printArea.classList.remove('hidden');
  
  const result = await fetchAPI('teachers.php');
  
  if (result.success && result.data && result.data.length > 0) {
    let filteredTeachers = result.data;
    
    // Lọc theo môn nếu có chọn
    if (selectedSubjectId) {
      filteredTeachers = result.data.filter(t => {
        // Check if teacher's subjects contain the selected subject name
        return t.subjects && t.subjects.includes(selectedSubjectName);
      });
    }
    
    // Group teachers by subject
    const teachersBySubject = {};
    filteredTeachers.forEach(t => {
      const subject = t.subjects || 'Chưa phân công';
      if (!teachersBySubject[subject]) {
        teachersBySubject[subject] = [];
      }
      teachersBySubject[subject].push(t);
    });
    
    const title = selectedSubjectId ? `MÔN ${selectedSubjectName.toUpperCase()}` : 'THEO MÔN';
    
    let html = `
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-slate-800">DANH SÁCH GIÁO VIÊN ${title}</h2>
        <p class="text-slate-500">Tổng số: ${filteredTeachers.length} giáo viên</p>
      </div>
    `;
    
    // Sort subjects alphabetically
    const sortedSubjects = Object.keys(teachersBySubject).sort();
    
    for (const subject of sortedSubjects) {
      const teachers = teachersBySubject[subject];
      html += `
        <div class="mb-6">
          <h3 class="font-bold text-slate-700 mb-2 bg-slate-100 p-2 rounded">${subject} (${teachers.length} GV)</h3>
          <table class="w-full border-collapse border border-slate-300 text-sm">
            <thead>
              <tr class="bg-slate-50">
                <th class="border border-slate-300 px-2 py-1">STT</th>
                <th class="border border-slate-300 px-2 py-1">Mã GV</th>
                <th class="border border-slate-300 px-2 py-1">Họ và tên</th>
                <th class="border border-slate-300 px-2 py-1">Chủ nhiệm</th>
              </tr>
            </thead>
            <tbody>
              ${teachers.map((t, idx) => `
                <tr>
                  <td class="border border-slate-300 px-2 py-1 text-center">${idx + 1}</td>
                  <td class="border border-slate-300 px-2 py-1 font-mono">${t.teacher_code}</td>
                  <td class="border border-slate-300 px-2 py-1">${t.full_name}</td>
                  <td class="border border-slate-300 px-2 py-1 text-center">${t.homeroom_class || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    html += `<div class="mt-4 text-right text-sm text-slate-500">Ngày in: ${new Date().toLocaleDateString('vi-VN')}</div>`;
    printContent.innerHTML = html;
  } else {
    printContent.innerHTML = '<p class="text-center text-slate-500 py-10">Không có dữ liệu</p>';
  }
}

function printReport() {
  const printContent = document.getElementById('reportPreviewContent').innerHTML;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>In báo cáo</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px; }
        th { background: #f5f5f5; }
        h2, h3 { margin: 0; padding: 10px 0; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>${printContent}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function closeReportPreview() {
  document.getElementById('reportPreviewArea').classList.add('hidden');
}

async function exportReportExcel() {
  const classSelect = document.getElementById('reportStudentClass');
  const yearSelect = document.getElementById('reportStudentYear');
  const typeSelect = document.getElementById('reportStudentType');
  const classId = classSelect?.value;
  const schoolYear = yearSelect?.value || '2024-2025';
  const reportType = typeSelect?.value || 'attendance';
  
  if (!classId) {
    showToast('Vui lòng chọn lớp trước', 'error');
    return;
  }
  
  const className = classSelect.options[classSelect.selectedIndex].text;
  await exportStudentListToExcel(classId, className, schoolYear, reportType);
}

async function loadReportClassOptions() {
  const select = document.getElementById('reportStudentClass');
  if (!select) return;
  
  const result = await fetchAPI('classes.php');
  if (result.success && result.data) {
    select.innerHTML = '<option value="">-- Chọn lớp --</option>' + 
      result.data.map(c => `<option value="${c.id}">${c.class_name}</option>`).join('');
  }
}

function initReportsEvents() {
  loadReportClassOptions();
  loadReportSubjectOptions();
}

async function loadReportSubjectOptions() {
  const select = document.getElementById('reportTeacherSubject');
  if (!select) return;
  
  const result = await fetchAPI('subjects.php');
  if (result.success && result.data) {
    select.innerHTML = '<option value="">Tất cả môn</option>' + 
      result.data.map(s => `<option value="${s.id}">${s.subject_name}</option>`).join('');
  }
}

// Expose functions to global scope
window.generateGVCNReport = generateGVCNReport;
window.generateStudentListReport = generateStudentListReport;
window.generateTeacherBySubjectReport = generateTeacherBySubjectReport;
window.printReport = printReport;
window.closeReportPreview = closeReportPreview;
window.exportReportExcel = exportReportExcel;
