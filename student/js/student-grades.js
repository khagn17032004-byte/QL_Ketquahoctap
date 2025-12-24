/**
 * Student Grades - Xem điểm theo học kỳ
 */

// ====== Load Grades ======
async function loadGrades() {
  const semester = document.getElementById('gradeTermSelect').value;
  const studentId = currentUser.student_id;
  const gradesTableBody = document.getElementById('gradesTableBody');
  const semesterAvg = document.getElementById('semesterAvg');

  if (!studentId) {
    showToast('Không tìm thấy thông tin học sinh');
    return;
  }

  gradesTableBody.innerHTML = `
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
    const response = await fetch(`${API_URL}/grades.php?student_id=${studentId}&semester=${semester}`);
    const result = await response.json();
    
    if (result.success) {
      studentGrades = result.data || [];
      renderGrades(studentGrades);
    } else {
      gradesTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center px-4 py-8 text-slate-500">Chưa có điểm cho học kỳ này</td>
        </tr>
      `;
      semesterAvg.textContent = '-';
    }
  } catch (error) {
    console.error('Error loading grades:', error);
    gradesTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center px-4 py-8 text-red-400">Lỗi tải dữ liệu</td>
      </tr>
    `;
  }
}

// ====== Render Grades ======
function renderGrades(grades) {
  const gradesTableBody = document.getElementById('gradesTableBody');
  const semesterAvg = document.getElementById('semesterAvg');
  
  if (!grades || grades.length === 0) {
    gradesTableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center px-4 py-8 text-slate-500">Chưa có điểm cho học kỳ này</td>
      </tr>
    `;
    semesterAvg.textContent = '-';
    return;
  }

  gradesTableBody.innerHTML = '';
  let totalAvg = 0;
  let countWithAvg = 0;

  grades.forEach(grade => {
    const avg = calculateAverage(grade);
    const classification = getClassification(avg);
    const avgValue = parseFloat(avg);
    
    if (!isNaN(avgValue)) {
      totalAvg += avgValue;
      countWithAvg++;
    }
    
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-200/80 transition';
    row.innerHTML = `
      <td class="px-4 py-3 text-slate-800">${grade.subject_name || 'N/A'}</td>
      <td class="text-center px-4 py-3 text-slate-700">${grade.oral_score || '-'}</td>
      <td class="text-center px-4 py-3 text-slate-700">${grade.fifteen_min_score || '-'}</td>
      <td class="text-center px-4 py-3 text-slate-700">${grade.one_period_score || '-'}</td>
      <td class="text-center px-4 py-3 text-slate-700">${grade.midterm_score || '-'}</td>
      <td class="text-center px-4 py-3 text-slate-700">${grade.semester_score || '-'}</td>
      <td class="text-center px-4 py-3">
        <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
          avgValue >= 8 ? 'bg-emerald-500 text-white' : 
          avgValue >= 6.5 ? 'bg-sky-500 text-white' : 
          avgValue >= 5 ? 'bg-amber-500 text-white' : 
          'bg-red-100 text-red-600'
        }">
          ${avg}
        </span>
      </td>
      <td class="text-center px-4 py-3 text-sm font-medium ${
        avgValue >= 8 ? 'text-emerald-600' : 
        avgValue >= 6.5 ? 'text-sky-600' : 
        avgValue >= 5 ? 'text-amber-600' : 
        'text-red-600'
      }">${classification}</td>
    `;
    gradesTableBody.appendChild(row);
  });

  if (countWithAvg > 0) {
    semesterAvg.textContent = (totalAvg / countWithAvg).toFixed(2);
  } else {
    semesterAvg.textContent = '-';
  }
}

// ====== Export Grades to Excel ======
function exportGradesToExcel() {
  if (!studentGrades || studentGrades.length === 0) {
    showToast('Chưa có dữ liệu để xuất');
    return;
  }

  const semester = document.getElementById('gradeTermSelect').value;
  const year = document.getElementById('gradeYearSelect').value;
  const studentName = studentProfile?.full_name || currentUser?.full_name || 'HocSinh';
  const className = studentProfile?.class_name || currentUser?.class_name || '';

  // Prepare data for Excel
  const excelData = studentGrades.map((grade, index) => {
    const avg = calculateAverage(grade);
    const classification = getClassification(avg);
    return {
      'STT': index + 1,
      'Môn Học': grade.subject_name || 'N/A',
      'Điểm Miệng': grade.oral_score || '',
      'Điểm 15 Phút': grade.fifteen_min_score || '',
      'Điểm 1 Tiết': grade.one_period_score || '',
      'Điểm Giữa Kỳ': grade.midterm_score || '',
      'Điểm Cuối Kỳ': grade.semester_score || '',
      'Điểm TB': avg,
      'Xếp Loại': classification
    };
  });

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // STT
    { wch: 20 },  // Môn Học
    { wch: 12 },  // Miệng
    { wch: 12 },  // 15 Phút
    { wch: 12 },  // 1 Tiết
    { wch: 12 },  // Giữa Kỳ
    { wch: 12 },  // Cuối Kỳ
    { wch: 10 },  // TB
    { wch: 12 }   // Xếp Loại
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `HK${semester}`);

  // Generate filename
  const fileName = `BangDiem_${studentName.replace(/\s+/g, '')}_${className}_HK${semester}_${year}.xlsx`;

  // Download
  XLSX.writeFile(wb, fileName);
  showToast('Đã xuất file Excel thành công!');
}

// ====== Init Grades Events ======
function initGradesEvents() {
  document.getElementById('viewGradesBtn').addEventListener('click', loadGrades);
  document.getElementById('exportGradesBtn').addEventListener('click', exportGradesToExcel);
}
