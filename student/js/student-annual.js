/**
 * Student Annual - Điểm cả năm
 */

// ====== Load Annual Scores ======
async function loadAnnualScores() {
  const studentId = currentUser.student_id;
  if (!studentId) return;

  const tbody = document.getElementById('annualScoresTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center px-4 py-8 text-slate-500">
        <div class="flex items-center justify-center gap-2">
          <div class="spinner"></div>
          <span>Đang tải...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await fetch(`${API_URL}/annual-scores.php?student_id=${studentId}`);
    const result = await response.json();

    if (result.success) {
      const subjects = result.data.subjects || result.data;
      const conduct = result.data.conduct || {};
      renderAnnualScores(subjects, conduct);
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center px-4 py-8 text-red-400">${result.message}</td></tr>`;
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center px-4 py-8 text-red-400">Lỗi tải dữ liệu</td></tr>`;
  }
}

// Store annual data for export
let annualScoresData = [];
let annualConductData = {};

// ====== Render Annual Scores ======
function renderAnnualScores(subjects, conduct = {}) {
  const tbody = document.getElementById('annualScoresTableBody');
  
  // Store for export
  annualScoresData = subjects || [];
  annualConductData = conduct;

  if (!subjects || subjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center px-4 py-8 text-slate-500">Chưa có dữ liệu điểm cả năm</td></tr>`;
    return;
  }

  let totalAnnual = 0;
  let countAnnual = 0;

  tbody.innerHTML = subjects.map(s => {
    const hk1 = s.hk1_score !== null ? parseFloat(s.hk1_score).toFixed(2) : '-';
    const hk2 = s.hk2_score !== null ? parseFloat(s.hk2_score).toFixed(2) : '-';
    const annual = s.annual_score !== null ? parseFloat(s.annual_score).toFixed(2) : '-';
    const rank = getGradeRank(s.annual_score);

    if (s.annual_score !== null) {
      totalAnnual += parseFloat(s.annual_score);
      countAnnual++;
    }

    return `
      <tr class="hover:bg-slate-200/80 transition">
        <td class="px-4 py-3 text-slate-800 font-medium">${s.subject_name}</td>
        <td class="text-center px-4 py-3 text-slate-700">${hk1}</td>
        <td class="text-center px-4 py-3 text-slate-700">${hk2}</td>
        <td class="text-center px-4 py-3 font-bold text-amber-600">${annual}</td>
        <td class="text-center px-4 py-3 font-medium ${rank.class}">${rank.text}</td>
      </tr>
    `;
  }).join('');

  // Update summary
  if (countAnnual > 0) {
    const avg = totalAnnual / countAnnual;
    document.getElementById('annualAvg').textContent = avg.toFixed(2);
    
    const avgRank = getGradeRank(avg);
    document.getElementById('annualRank').textContent = avgRank.text;
    document.getElementById('annualRank').className = `text-lg font-semibold ${avgRank.class}`;

    // Determine title based on rank
    let title = '-';
    if (avg >= 8.5) title = 'Học sinh Giỏi';
    else if (avg >= 8.0) title = 'Học sinh Tiên tiến';
    else if (avg >= 6.5) title = 'Học sinh Khá';
    document.getElementById('annualTitle').textContent = title;
  }
  
  // Display annual conduct
  if (conduct.annual) {
    const conductMap = {
      'Tot': 'Tốt', 'Kha': 'Khá', 'TB': 'Trung bình', 'Yeu': 'Yếu',
      'Tốt': 'Tốt', 'Khá': 'Khá', 'Trung bình': 'Trung bình', 'Yếu': 'Yếu'
    };
    const conductText = conductMap[conduct.annual] || conduct.annual;
    document.getElementById('annualConduct').textContent = conductText;
    
    // Color based on conduct
    const conductColors = {
      'Tot': 'text-emerald-400', 'Tốt': 'text-emerald-400',
      'Kha': 'text-sky-400', 'Khá': 'text-sky-400',
      'TB': 'text-amber-400', 'Trung bình': 'text-amber-400',
      'Yeu': 'text-red-400', 'Yếu': 'text-red-400'
    };
    document.getElementById('annualConduct').className = `text-lg font-semibold ${conductColors[conduct.annual] || 'text-sky-400'}`;
  } else {
    document.getElementById('annualConduct').textContent = '-';
  }
}

// ====== Export Annual Scores to Excel ======
function exportAnnualToExcel() {
  if (!annualScoresData || annualScoresData.length === 0) {
    showToast('Chưa có dữ liệu để xuất');
    return;
  }

  const studentName = studentProfile?.full_name || currentUser?.full_name || 'HocSinh';
  const className = studentProfile?.class_name || currentUser?.class_name || '';
  const year = document.getElementById('gradeYearSelect')?.value || '2024-2025';

  // Prepare data for Excel
  const excelData = annualScoresData.map((s, index) => {
    const hk1 = s.hk1_score !== null ? parseFloat(s.hk1_score).toFixed(2) : '';
    const hk2 = s.hk2_score !== null ? parseFloat(s.hk2_score).toFixed(2) : '';
    const annual = s.annual_score !== null ? parseFloat(s.annual_score).toFixed(2) : '';
    const rank = getGradeRank(s.annual_score);
    
    return {
      'STT': index + 1,
      'Môn Học': s.subject_name,
      'TBM HK1': hk1,
      'TBM HK2': hk2,
      'TBM Cả Năm': annual,
      'Xếp Loại': rank.text
    };
  });

  // Add summary row
  const totalAnnual = annualScoresData.reduce((sum, s) => sum + (s.annual_score ? parseFloat(s.annual_score) : 0), 0);
  const countAnnual = annualScoresData.filter(s => s.annual_score !== null).length;
  const avgAnnual = countAnnual > 0 ? (totalAnnual / countAnnual).toFixed(2) : '';
  
  excelData.push({});
  excelData.push({
    'STT': '',
    'Môn Học': 'TỔNG KẾT',
    'TBM HK1': '',
    'TBM HK2': '',
    'TBM Cả Năm': avgAnnual,
    'Xếp Loại': getGradeRank(parseFloat(avgAnnual)).text
  });

  // Add conduct info if available
  if (annualConductData.annual) {
    excelData.push({
      'STT': '',
      'Môn Học': 'Hạnh Kiểm Cả Năm',
      'TBM HK1': '',
      'TBM HK2': '',
      'TBM Cả Năm': annualConductData.annual,
      'Xếp Loại': ''
    });
  }

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },   // STT
    { wch: 20 },  // Môn Học
    { wch: 12 },  // HK1
    { wch: 12 },  // HK2
    { wch: 15 },  // Cả Năm
    { wch: 12 }   // Xếp Loại
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DiemCaNam');

  // Generate filename
  const fileName = `DiemCaNam_${studentName.replace(/\s+/g, '')}_${className}_${year}.xlsx`;

  // Download
  XLSX.writeFile(wb, fileName);
  showToast('Đã xuất file Excel thành công!');
}

// ====== Init Annual Events ======
function initAnnualEvents() {
  document.getElementById('loadAnnualBtn').addEventListener('click', loadAnnualScores);
  document.getElementById('exportAnnualBtn').addEventListener('click', exportAnnualToExcel);
}
