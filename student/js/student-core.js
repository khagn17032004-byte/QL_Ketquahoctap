/**
 * Student Core - Cấu hình và hàm tiện ích
 */

const API_URL = '/quanlyketquahoctap/api';

// ====== Check Authentication ======
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
  if (!user.username || user.role !== 'student') {
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

// ====== Format Date ======
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN');
}

// ====== Calculate Average ======
function calculateAverage(grade) {
  const oral = parseFloat(grade.oral_score) || 0;
  const fifteen = parseFloat(grade.fifteen_min_score) || 0;
  const onePeriod = parseFloat(grade.one_period_score) || 0;
  const midterm = parseFloat(grade.midterm_score) || 0;
  const final = parseFloat(grade.semester_score) || 0;
  
  // Công thức: ĐTBmhk = (TĐĐGtx + 2 × ĐĐGgk + 3 × ĐĐGck) / (Số ĐĐGtx + 5)
  let sumTx = 0;
  let countTx = 0;
  if (oral) { sumTx += oral; countTx++; }
  if (fifteen) { sumTx += fifteen; countTx++; }
  if (onePeriod) { sumTx += onePeriod; countTx++; }
  
  const midtermPart = midterm * 2;
  const finalPart = final * 3;
  
  if (!final || countTx === 0) return '-';
  
  const divisor = countTx + 5;
  return ((sumTx + midtermPart + finalPart) / divisor).toFixed(2);
}

// ====== Get Classification ======
function getClassification(avg) {
  const value = parseFloat(avg);
  if (isNaN(value)) return '-';
  if (value >= 8) return 'Giỏi';
  if (value >= 6.5) return 'Khá';
  if (value >= 5) return 'Trung bình';
  return 'Yếu';
}

// ====== Get Grade Rank ======
function getGradeRank(score) {
  if (score === null || score === undefined || isNaN(score)) return { text: '-', class: 'text-slate-500' };
  if (score >= 8.5) return { text: 'Giỏi', class: 'text-emerald-400' };
  if (score >= 6.5) return { text: 'Khá', class: 'text-sky-400' };
  if (score >= 5.0) return { text: 'TB', class: 'text-amber-400' };
  return { text: 'Yếu', class: 'text-red-400' };
}
