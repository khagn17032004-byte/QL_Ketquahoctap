/**
 * Teacher Annual - Điểm cả năm
 */

// ====== Populate Annual Selects ======
function populateAnnualSelects() {
  // Class select - same as student list
  const classSelect = document.getElementById('annualClassSelect');
  classSelect.innerHTML = '<option value="">-- Chọn lớp --</option>';
  allClasses.forEach(cls => {
    classSelect.innerHTML += `<option value="${cls.id}">${cls.class_name}</option>`;
  });

  // Subject - only teacher's subject(s)
  const subjectSelect = document.getElementById('annualSubjectSelect');
  subjectSelect.innerHTML = '';
  if (teacherSubjects.length > 0) {
    teacherSubjects.forEach(s => {
      subjectSelect.innerHTML += `<option value="${s.id}">${s.subject_name}</option>`;
    });
    subjectSelect.disabled = false;
  }
}

// ====== Load Annual Scores ======
async function loadAnnualScores() {
  const classId = document.getElementById('annualClassSelect').value;
  const subjectId = document.getElementById('annualSubjectSelect').value;

  if (!classId) {
    showToast('Vui lòng chọn lớp');
    return;
  }

  const tbody = document.getElementById('annualScoresTable');
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center px-4 py-8 text-slate-500">
        <div class="flex items-center justify-center gap-2">
          <div class="spinner"></div>
          <span>Đang tải...</span>
        </div>
      </td>
    </tr>
  `;

  try {
    const response = await fetch(`${API_URL}/annual-scores.php?class_id=${classId}&subject_id=${subjectId}`);
    const result = await response.json();

    if (result.success) {
      renderAnnualScores(result.data);
    } else {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center px-4 py-8 text-red-400">${result.message}</td></tr>`;
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center px-4 py-8 text-red-400">Lỗi tải dữ liệu</td></tr>`;
  }
}

// ====== Render Annual Scores ======
function renderAnnualScores(students) {
  const tbody = document.getElementById('annualScoresTable');

  if (!students || students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center px-4 py-8 text-slate-500">Không có dữ liệu</td></tr>`;
    document.getElementById('annualSummary').textContent = '--';
    return;
  }

  let countGioi = 0, countKha = 0, countTB = 0, countYeu = 0;

  tbody.innerHTML = students.map(s => {
    const hk1 = s.hk1_score !== null ? parseFloat(s.hk1_score).toFixed(2) : '-';
    const hk2 = s.hk2_score !== null ? parseFloat(s.hk2_score).toFixed(2) : '-';
    const annual = s.annual_score !== null ? parseFloat(s.annual_score).toFixed(2) : '-';
    const rank = getGradeRank(s.annual_score);

    if (s.annual_score !== null) {
      if (s.annual_score >= 8.5) countGioi++;
      else if (s.annual_score >= 6.5) countKha++;
      else if (s.annual_score >= 5.0) countTB++;
      else countYeu++;
    }

    return `
      <tr class="hover:bg-slate-200/80 transition">
        <td class="px-4 py-3 text-slate-800 font-mono">${s.student_code}</td>
        <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
        <td class="text-center px-4 py-3 text-slate-700">${hk1}</td>
        <td class="text-center px-4 py-3 text-slate-700">${hk2}</td>
        <td class="text-center px-4 py-3 font-bold text-purple-600">${annual}</td>
        <td class="text-center px-4 py-3 font-medium ${rank.class}">${rank.text}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('annualSummary').textContent = 
    `Giỏi: ${countGioi} | Khá: ${countKha} | TB: ${countTB} | Yếu: ${countYeu}`;
}

// ====== Calculate and Save Annual ======
async function calculateAndSaveAnnual() {
  const classId = document.getElementById('annualClassSelect').value;
  const subjectId = document.getElementById('annualSubjectSelect').value;

  if (!classId || !subjectId) {
    showToast('Vui lòng chọn lớp và môn học');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/annual-scores.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId, subject_id: subjectId })
    });

    const result = await response.json();
    if (result.success) {
      showToast(result.message || 'Đã tính và lưu điểm cả năm!');
      loadAnnualScores(); // Reload table
    } else {
      showToast('Lỗi: ' + (result.message || 'Không thể lưu'));
    }
  } catch (error) {
    showToast('Lỗi kết nối server');
  }
}

// ====== Init Events ======
function initAnnualEvents() {
  document.getElementById('loadAnnualBtn').addEventListener('click', loadAnnualScores);
  document.getElementById('calcAnnualBtn').addEventListener('click', calculateAndSaveAnnual);
}
