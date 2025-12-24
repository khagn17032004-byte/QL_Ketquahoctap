/**
 * Teacher Core - Cấu hình và hàm tiện ích
 */

const API_URL = '/quanlyketquahoctap/api';

// ====== Check Authentication ======
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
  if (!user.username || user.role !== 'teacher') {
    window.location.href = '../index.html';
    return null;
  }
  return user;
}

// ====== Toast ======
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  toastMessage.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

// ====== Format Date (YYYY-MM-DD -> DD/MM/YYYY) ======
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// ====== Calculate Average ======
function calculateAverage(data) {
  const oral = parseFloat(data.oral_score || data.oral) || 0;
  const fifteen = parseFloat(data.fifteen_min_score || data.fifteen) || 0;
  const onePeriod = parseFloat(data.one_period_score || data.one_period) || 0;
  const midterm = parseFloat(data.midterm_score || data.midterm) || 0;
  const final = parseFloat(data.semester_score || data.semester || data.final) || 0;
  
  // Công thức: ĐTBmhk = (TĐĐGtx + 2 × ĐĐGgk + 3 × ĐĐGck) / (Số ĐĐGtx + 5)
  // Điểm thường xuyên: oral, fifteen, onePeriod
  let sumTx = 0;
  let countTx = 0;
  if (oral) { sumTx += oral; countTx++; }
  if (fifteen) { sumTx += fifteen; countTx++; }
  if (onePeriod) { sumTx += onePeriod; countTx++; }
  
  // Điểm giữa kỳ (hệ số 2) và cuối kỳ (hệ số 3)
  const midtermPart = midterm * 2;
  const finalPart = final * 3;
  
  // Chỉ tính nếu có điểm cuối kỳ và ít nhất 1 điểm thường xuyên
  if (!final || countTx === 0) return '-';
  
  const divisor = countTx + 5; // Số ĐĐGtx + 5 (2 cho giữa kỳ + 3 cho cuối kỳ)
  return ((sumTx + midtermPart + finalPart) / divisor).toFixed(2);
}

// ====== Grade Rank ======
function getGradeRank(score) {
  if (score === null || score === undefined) return { text: '-', class: 'text-slate-500' };
  if (score >= 8.5) return { text: 'Giỏi', class: 'text-emerald-400' };
  if (score >= 6.5) return { text: 'Khá', class: 'text-sky-400' };
  if (score >= 5.0) return { text: 'TB', class: 'text-amber-400' };
  return { text: 'Yếu', class: 'text-red-400' };
}
