// Teacher Reports Module
let teacherReportClasses = [];
let currentTeacherReportData = null;

// Load teacher's classes for report
async function loadTeacherReportClasses() {
  try {
    const teacherId = teacherInfo?.id;
    if (!teacherId) {
      console.error('Teacher ID not found, teacherInfo:', teacherInfo);
      return;
    }

    console.log('Loading classes for teacher ID:', teacherId);
    const response = await fetch(`../api/classes.php?teacher_id=${teacherId}`);
    const result = await response.json();
    console.log('Classes API response:', result);

    if (result.success && result.data) {
      // Remove duplicates by class_id
      const uniqueClasses = [];
      const seenIds = new Set();
      
      result.data.forEach(cls => {
        console.log('Class:', cls.class_name, 'Grade:', cls.grade_level, 'ID:', cls.id);
        if (!seenIds.has(cls.id)) {
          seenIds.add(cls.id);
          uniqueClasses.push({
            class_id: cls.id,
            class_name: cls.class_name,
            grade_level: cls.grade_level
          });
        }
      });
      
      teacherReportClasses = uniqueClasses;
      console.log('Unique classes loaded:', uniqueClasses);
      populateTeacherReportClassDropdown();
    } else {
      console.error('Failed to load classes, result:', result);
    }
  } catch (error) {
    console.error('Error loading teacher classes for report:', error);
  }
}

// Populate class dropdown
function populateTeacherReportClassDropdown() {
  const classSelect = document.getElementById('teacherReportClass');
  if (!classSelect) return;

  classSelect.innerHTML = '<option value="">-- Chọn lớp --</option>';
  
  teacherReportClasses.forEach(cls => {
    const option = document.createElement('option');
    option.value = cls.class_id;
    option.textContent = cls.class_name;
    classSelect.appendChild(option);
  });
}

// Generate teacher report
async function generateTeacherReport() {
  const year = document.getElementById('teacherReportYear')?.value;
  const classId = document.getElementById('teacherReportClass')?.value;
  const reportType = document.getElementById('teacherReportType')?.value;

  if (!classId) {
    showToast('Vui lòng chọn lớp');
    return;
  }

  console.log('Generating report for class:', classId, 'type:', reportType);

  try {
    // Fetch students in class
    const response = await fetch(`../api/students.php?class_id=${classId}`);
    const data = await response.json();
    
    console.log('Students API response:', data);

    if (data.success && data.data) {
      currentTeacherReportData = {
        year,
        classId,
        reportType,
        students: data.data,
        className: teacherReportClasses.find(c => c.class_id == classId)?.class_name || ''
      };
      
      console.log('Report data prepared:', currentTeacherReportData);
      displayTeacherReportPreview();
    } else {
      console.error('Failed to load students:', data);
      showToast('Không thể tải danh sách học sinh');
    }
  } catch (error) {
    console.error('Error generating teacher report:', error);
    showToast('Có lỗi khi tạo báo cáo');
  }
}

// Display report preview
function displayTeacherReportPreview() {
  if (!currentTeacherReportData) return;

  const { year, reportType, students, className } = currentTeacherReportData;
  const previewArea = document.getElementById('teacherReportPreviewArea');
  const previewContent = document.getElementById('teacherReportPreviewContent');

  if (!previewArea || !previewContent) return;

  const reportTitle = reportType === 'attendance' ? 'ĐIỂM DANH HỌC SINH' : 'BẢNG ĐIỂM';
  const listType = reportType === 'attendance' ? 'điểm danh' : 'ghi điểm';

  let tableHeaders = '<th class="border border-slate-300 px-3 py-2">STT</th>';
  tableHeaders += '<th class="border border-slate-300 px-3 py-2">Mã HS</th>';
  tableHeaders += '<th class="border border-slate-300 px-3 py-2">Họ và Tên</th>';
  tableHeaders += '<th class="border border-slate-300 px-3 py-2">Ngày Sinh</th>';
  tableHeaders += '<th class="border border-slate-300 px-3 py-2">Giới Tính</th>';

  if (reportType === 'attendance') {
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">Có mặt</th>';
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">Vắng</th>';
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">Ghi chú</th>';
  } else {
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">Miệng</th>';
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">15p</th>';
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">1 Tiết</th>';
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">Giữa Kỳ</th>';
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">Cuối Kỳ</th>';
    tableHeaders += '<th class="border border-slate-300 px-3 py-2">TBM</th>';
  }

  let tableRows = '';
  students.forEach((student, index) => {
    const gender = student.gender === 'male' ? 'Nam' : 'Nữ';
    const dob = student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('vi-VN') : '';
    
    tableRows += `<tr>`;
    tableRows += `<td class="border border-slate-300 px-3 py-2 text-center">${index + 1}</td>`;
    tableRows += `<td class="border border-slate-300 px-3 py-2">${student.student_id}</td>`;
    tableRows += `<td class="border border-slate-300 px-3 py-2">${student.full_name}</td>`;
    tableRows += `<td class="border border-slate-300 px-3 py-2 text-center">${dob}</td>`;
    tableRows += `<td class="border border-slate-300 px-3 py-2 text-center">${gender}</td>`;

    if (reportType === 'attendance') {
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
    } else {
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
      tableRows += `<td class="border border-slate-300 px-3 py-2"></td>`;
    }

    tableRows += `</tr>`;
  });

  const html = `
    <div class="print-content">
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-slate-900">TRƯỜNG THPT XYZ</h2>
        <h3 class="text-lg font-semibold text-slate-700 mt-2">${reportTitle}</h3>
        <p class="text-sm text-slate-600 mt-2">Năm học: ${year}</p>
        <p class="text-sm text-slate-600">Lớp: ${className}</p>
      </div>
      
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="bg-slate-100">
            ${tableHeaders}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      <div class="mt-8 grid grid-cols-2 gap-8 text-sm">
        <div class="text-center">
          <p class="font-semibold">GIÁO VIÊN</p>
          <p class="text-slate-500 mt-1">(Ký và ghi rõ họ tên)</p>
          <div class="mt-16"></div>
        </div>
        <div class="text-center">
          <p class="font-semibold">HIỆU TRƯỞNG</p>
          <p class="text-slate-500 mt-1">(Ký và ghi rõ họ tên)</p>
          <div class="mt-16"></div>
        </div>
      </div>
    </div>
  `;

  previewContent.innerHTML = html;
  previewArea.classList.remove('hidden');
}

// Print teacher report
function printTeacherReport() {
  const content = document.getElementById('teacherReportPreviewContent');
  if (!content) return;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>In Báo Cáo</title>
      <style>
        @media print {
          @page { size: A4 landscape; margin: 1cm; }
        }
        body { font-family: 'Times New Roman', serif; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #000; padding: 8px; }
        th { background-color: #f0f0f0; font-weight: bold; }
        .text-center { text-align: center; }
        h2, h3 { margin: 5px 0; }
      </style>
    </head>
    <body>
      ${content.innerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// Export to Excel (CSV)
function exportTeacherReportExcel() {
  if (!currentTeacherReportData) return;

  const { year, reportType, students, className } = currentTeacherReportData;

  let csvContent = '\uFEFF'; // UTF-8 BOM
  const reportTitle = reportType === 'attendance' ? 'ĐIỂM DANH HỌC SINH' : 'BẢNG ĐIỂM';
  
  csvContent += `${reportTitle}\n`;
  csvContent += `Năm học: ${year}\n`;
  csvContent += `Lớp: ${className}\n\n`;

  // Headers
  let headers = ['STT', 'Mã HS', 'Họ và Tên', 'Ngày Sinh', 'Giới Tính'];
  
  if (reportType === 'attendance') {
    headers.push('Có mặt', 'Vắng', 'Ghi chú');
  } else {
    headers.push('Miệng', '15p', '1 Tiết', 'Giữa Kỳ', 'Cuối Kỳ', 'TBM');
  }
  
  csvContent += headers.join(',') + '\n';

  // Data rows
  students.forEach((student, index) => {
    const gender = student.gender === 'male' ? 'Nam' : 'Nữ';
    const dob = student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('vi-VN') : '';
    
    let row = [
      index + 1,
      student.student_id,
      `"${student.full_name}"`,
      dob,
      gender
    ];

    if (reportType === 'attendance') {
      row.push('', '', '');
    } else {
      row.push('', '', '', '', '', '');
    }

    csvContent += row.join(',') + '\n';
  });

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${className}_${reportType}_${year}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Close preview
function closeTeacherReportPreview() {
  const previewArea = document.getElementById('teacherReportPreviewArea');
  if (previewArea) {
    previewArea.classList.add('hidden');
  }
}

// Expose functions to window
window.generateTeacherReport = generateTeacherReport;
window.printTeacherReport = printTeacherReport;
window.exportTeacherReportExcel = exportTeacherReportExcel;
window.closeTeacherReportPreview = closeTeacherReportPreview;
