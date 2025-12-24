/**
 * Teacher Grades - Nhập điểm
 */

// ====== Load Grades for Input ======
async function loadGradesForInput(classId, semester) {
  if (teacherSubjects.length === 0) {
    showToast('Bạn chưa được phân công môn dạy');
    return;
  }
  
  const subjectSelect = document.getElementById('gradeSubjectSelect');
  const subjectId = subjectSelect.value;
  
  if (!subjectId) {
    showToast('Vui lòng chọn môn học');
    return;
  }
  
  const tbody = document.getElementById('gradesInputTable');
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
    const response = await fetch(`${API_URL}/grades.php?class_id=${classId}&subject_id=${subjectId}&semester=${semester}`);
    const result = await response.json();
    
    if (result.success) {
      renderGradesInput(result.data, subjectId);
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center px-4 py-8 text-red-400">Lỗi tải dữ liệu</td></tr>`;
  }
}

function renderGradesInput(students, subjectId) {
  const tbody = document.getElementById('gradesInputTable');
  
  if (!students || students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center px-4 py-8 text-slate-500">Không có học sinh</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => {
    const avg = calculateAverage(s);
    return `
      <tr class="hover:bg-slate-200/80 transition" data-student-id="${s.student_id}" data-subject-id="${subjectId}">
        <td class="px-4 py-3 text-slate-800 font-mono">${s.student_code}</td>
        <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
        <td class="text-center px-4 py-3">
          <input type="number" min="0" max="10" step="0.5" value="${s.oral_score || ''}" 
                 data-type="oral" placeholder="-" 
                 class="grade-input w-16 bg-slate-50 border border-slate-300/50 rounded px-2 py-1 text-slate-800 text-center text-sm">
        </td>
        <td class="text-center px-4 py-3">
          <input type="number" min="0" max="10" step="0.5" value="${s.fifteen_min_score || ''}" 
                 data-type="fifteen" placeholder="-" 
                 class="grade-input w-16 bg-slate-50 border border-slate-300/50 rounded px-2 py-1 text-slate-800 text-center text-sm">
        </td>
        <td class="text-center px-4 py-3">
          <input type="number" min="0" max="10" step="0.5" value="${s.one_period_score || ''}" 
                 data-type="one_period" placeholder="-" 
                 class="grade-input w-16 bg-slate-50 border border-slate-300/50 rounded px-2 py-1 text-slate-800 text-center text-sm">
        </td>
        <td class="text-center px-4 py-3">
          <input type="number" min="0" max="10" step="0.5" value="${s.midterm_score || ''}" 
                 data-type="midterm" placeholder="-" 
                 class="grade-input w-16 bg-slate-50 border border-slate-300/50 rounded px-2 py-1 text-slate-800 text-center text-sm">
        </td>
        <td class="text-center px-4 py-3">
          <input type="number" min="0" max="10" step="0.5" value="${s.semester_score || ''}" 
                 data-type="semester" placeholder="-" 
                 class="grade-input w-16 bg-slate-50 border border-slate-300/50 rounded px-2 py-1 text-slate-800 text-center text-sm">
        </td>
        <td class="text-center px-4 py-3 text-slate-700 average-cell font-semibold">${avg}</td>
      </tr>
    `;
  }).join('');

  // Add event listeners for auto-calculate
  document.querySelectorAll('.grade-input').forEach(input => {
    input.addEventListener('input', function() {
      const row = this.closest('tr');
      const inputs = row.querySelectorAll('.grade-input');
      const values = {};
      inputs.forEach(inp => {
        if (inp.value) values[inp.dataset.type] = parseFloat(inp.value);
      });
      row.querySelector('.average-cell').textContent = calculateAverage(values);
    });
  });
}

// ====== Save Grades ======
async function saveGrades() {
  const classId = document.getElementById('gradeClassSelect').value;
  const semester = document.getElementById('gradeTermSelect').value;
  
  if (!classId) {
    showToast('Vui lòng chọn lớp');
    return;
  }

  const rows = document.querySelectorAll('#gradesInputTable tr[data-student-id]');
  const gradesData = [];

  rows.forEach(row => {
    const studentId = row.dataset.studentId;
    const subjectId = row.dataset.subjectId;
    const inputs = row.querySelectorAll('.grade-input');
    const grades = { student_id: studentId, subject_id: subjectId, semester: semester };
    
    inputs.forEach(input => {
      if (input.value) {
        const type = input.dataset.type;
        if (type === 'oral') grades.oral_score = parseFloat(input.value);
        if (type === 'fifteen') grades.fifteen_min_score = parseFloat(input.value);
        if (type === 'one_period') grades.one_period_score = parseFloat(input.value);
        if (type === 'midterm') grades.midterm_score = parseFloat(input.value);
        if (type === 'semester') grades.semester_score = parseFloat(input.value);
      }
    });

    gradesData.push(grades);
  });

  try {
    const response = await fetch(`${API_URL}/grades.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grades: gradesData })
    });
    
    const result = await response.json();
    if (result.success) {
      showToast('Đã lưu điểm thành công!');
    } else {
      showToast('Lỗi: ' + (result.message || 'Không thể lưu'));
    }
  } catch (error) {
    showToast('Lỗi kết nối server');
  }
}

// ====== Download Template ======
function downloadGradeTemplate() {
  const subjectSelect = document.getElementById('gradeSubjectSelect');
  const subjectId = subjectSelect.value;
  const classId = document.getElementById('gradeClassSelect').value;
  
  if (!subjectId) {
    showToast('Vui lòng chọn môn học');
    return;
  }
  
  if (!classId) {
    showToast('Vui lòng chọn lớp trước');
    return;
  }
  
  const selectedSubject = teacherSubjects.find(s => s.id == subjectId);
  const subjectName = selectedSubject ? selectedSubject.subject_name : 'Mon';
  const className = document.getElementById('gradeClassSelect').options[document.getElementById('gradeClassSelect').selectedIndex].text;
  const semester = document.getElementById('gradeTermSelect').value;
  
  // Get current data from table
  const rows = document.querySelectorAll('#gradesInputTable tr[data-student-id]');
  if (rows.length === 0) {
    showToast('Vui lòng tải điểm trước khi tải mẫu');
    return;
  }
  
  // Create CSV template with student info but empty grades
  let csv = 'Ma_HS,Ho_Ten,Diem_Mieng,Diem_15Phut,Diem_1Tiet,Diem_GiuaKy,Diem_ThiHK\n';
  
  rows.forEach(row => {
    const studentCode = row.cells[0].textContent;
    const fullName = row.cells[1].textContent;
    // Leave grade columns empty for template
    csv += `${studentCode},"${fullName}",,,,\n`;
  });
  
  // Download file
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Mau_Diem_${subjectName}_${className}_HK${semester}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Đã tải file mẫu!');
}

// ====== Handle File Import ======
function handleGradeFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const classId = document.getElementById('gradeClassSelect').value;
  if (!classId) {
    showToast('Vui lòng chọn lớp và tải điểm trước');
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      parseAndFillGrades(content);
      showToast('Đã import điểm thành công! Nhấn "Lưu Điểm" để lưu.');
    } catch (error) {
      console.error('Import error:', error);
      showToast('Lỗi đọc file: ' + error.message);
    }
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
}

// ====== Parse CSV and Fill Grades ======
function parseAndFillGrades(csvContent) {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('File không có dữ liệu');
  }
  
  // Skip header row
  const dataLines = lines.slice(1);
  let filledCount = 0;
  
  dataLines.forEach(line => {
    // Parse CSV line (handle quoted fields)
    const parts = line.split(',');
    if (parts.length < 7) return;
    
    const studentCode = parts[0].trim().replace(/"/g, '');
    const oral = parseFloat(parts[2]) || '';
    const fifteen = parseFloat(parts[3]) || '';
    const onePeriod = parseFloat(parts[4]) || '';
    const midterm = parseFloat(parts[5]) || '';
    const final = parseFloat(parts[6]) || '';
    
    // Find row by student code
    const rows = document.querySelectorAll('#gradesInputTable tr[data-student-id]');
    rows.forEach(row => {
      if (row.cells[0].textContent.trim() === studentCode) {
        const inputs = row.querySelectorAll('.grade-input');
        if (inputs[0] && oral !== '') inputs[0].value = oral;
        if (inputs[1] && fifteen !== '') inputs[1].value = fifteen;
        if (inputs[2] && onePeriod !== '') inputs[2].value = onePeriod;
        if (inputs[3] && midterm !== '') inputs[3].value = midterm;
        if (inputs[4] && final !== '') inputs[4].value = final;
        
        // Recalculate average
        const values = {
          oral: inputs[0]?.value ? parseFloat(inputs[0].value) : 0,
          fifteen: inputs[1]?.value ? parseFloat(inputs[1].value) : 0,
          one_period: inputs[2]?.value ? parseFloat(inputs[2].value) : 0,
          midterm: inputs[3]?.value ? parseFloat(inputs[3].value) : 0,
          semester: inputs[4]?.value ? parseFloat(inputs[4].value) : 0
        };
        row.querySelector('.average-cell').textContent = calculateAverage(values);
        filledCount++;
      }
    });
  });
  
  if (filledCount === 0) {
    throw new Error('Không tìm thấy học sinh phù hợp. Kiểm tra mã học sinh.');
  }
}

// ====== Export Grades to Excel ======
function exportGradesToExcel() {
  const rows = document.querySelectorAll('#gradesInputTable tr[data-student-id]');
  if (rows.length === 0) {
    showToast('Không có dữ liệu để xuất');
    return;
  }
  
  const subjectSelect = document.getElementById('gradeSubjectSelect');
  const subjectId = subjectSelect.value;
  const selectedSubject = teacherSubjects.find(s => s.id == subjectId);
  const subjectName = selectedSubject ? selectedSubject.subject_name : 'Mon';
  const classSelect = document.getElementById('gradeClassSelect');
  const className = classSelect.options[classSelect.selectedIndex]?.text || 'Lop';
  const semester = document.getElementById('gradeTermSelect').value;
  
  let csv = 'STT,Ma_HS,Ho_Ten,Diem_Mieng,Diem_15Phut,Diem_1Tiet,Diem_GiuaKy,Diem_ThiHK,TBM\n';
  
  let stt = 1;
  rows.forEach(row => {
    const studentCode = row.cells[0].textContent;
    const fullName = row.cells[1].textContent;
    const inputs = row.querySelectorAll('.grade-input');
    const oral = inputs[0]?.value || '';
    const fifteen = inputs[1]?.value || '';
    const onePeriod = inputs[2]?.value || '';
    const midterm = inputs[3]?.value || '';
    const final = inputs[4]?.value || '';
    const avg = row.querySelector('.average-cell')?.textContent || '';
    
    csv += `${stt},"${studentCode}","${fullName}",${oral},${fifteen},${onePeriod},${midterm},${final},${avg}\n`;
    stt++;
  });
  
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `BangDiem_${subjectName}_${className}_HK${semester}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Đã xuất file Excel!');
}

// ====== Init Events ======
function initGradesEvents() {
  // Populate subject dropdown
  populateSubjectDropdown();
  
  // Subject change event
  document.getElementById('gradeSubjectSelect').addEventListener('change', () => {
    const subjectSelect = document.getElementById('gradeSubjectSelect');
    const selectedSubject = teacherSubjects.find(s => s.id == subjectSelect.value);
    const subjectNameEl = document.getElementById('gradeSubjectName');
    if (selectedSubject && subjectNameEl) {
      subjectNameEl.textContent = selectedSubject.subject_name;
    }
    // Clear table when subject changes
    document.getElementById('gradesInputTable').innerHTML = '<tr><td colspan="8" class="text-center px-4 py-8 text-slate-500">Chọn lớp để xem danh sách</td></tr>';
  });
  
  // Load grades button
  document.getElementById('loadGradesBtn').addEventListener('click', () => {
    const classId = document.getElementById('gradeClassSelect').value;
    const semester = document.getElementById('gradeTermSelect').value;
    if (classId) {
      loadGradesForInput(classId, semester);
    } else {
      showToast('Vui lòng chọn lớp');
    }
  });

  document.getElementById('saveGradesBtn').addEventListener('click', saveGrades);

  // Import/Export Excel for grades
  document.getElementById('downloadGradeTemplateBtn').addEventListener('click', downloadGradeTemplate);
  document.getElementById('importGradeExcelBtn').addEventListener('click', () => {
    document.getElementById('gradeFileInput').click();
  });
  document.getElementById('gradeFileInput').addEventListener('change', handleGradeFileImport);
  document.getElementById('exportGradesBtn').addEventListener('click', exportGradesToExcel);
}

// ====== Populate Subject Dropdown ======
function populateSubjectDropdown() {
  const subjectSelect = document.getElementById('gradeSubjectSelect');
  if (!subjectSelect) return;
  
  subjectSelect.innerHTML = '<option value="">-- Chọn môn --</option>';
  
  teacherSubjects.forEach(subject => {
    const option = document.createElement('option');
    option.value = subject.id;
    option.textContent = subject.subject_name;
    subjectSelect.appendChild(option);
  });
  
  // Auto-select first subject if only one
  if (teacherSubjects.length === 1) {
    subjectSelect.value = teacherSubjects[0].id;
    const subjectNameEl = document.getElementById('gradeSubjectName');
    if (subjectNameEl) subjectNameEl.textContent = teacherSubjects[0].subject_name;
  }
}
