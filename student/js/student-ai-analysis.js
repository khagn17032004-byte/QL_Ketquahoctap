/**
 * Student AI Analysis - Phân tích điểm số bằng AI
 */

// ====== Analyze Performance ======
async function analyzePerformance() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const analysisResult = document.getElementById('analysisResult');

  // Show loading
  analyzeBtn.disabled = true;
  analyzeBtn.innerHTML = `
    <div class="spinner"></div>
    <span>Đang phân tích...</span>
  `;

  analysisResult.innerHTML = `
    <div class="p-8 text-center">
      <div class="flex items-center justify-center gap-3 text-purple-600">
        <div class="spinner"></div>
        <span>AI đang phân tích kết quả học tập của bạn...</span>
      </div>
      <p class="text-xs text-slate-500 mt-3">Quá trình này có thể mất vài giây</p>
    </div>
  `;

  try {
    // Lấy điểm cả năm từ API annual-scores
    const studentId = currentUser.student_id;
    const annualResponse = await fetch(`${API_URL}/annual-scores.php?student_id=${studentId}`);
    const annualResult = await annualResponse.json();

    if (!annualResult.success || !annualResult.data?.subjects || annualResult.data.subjects.length === 0) {
      analysisResult.innerHTML = `
        <div class="p-8 text-center text-amber-400">
          <i class="lucide lucide-alert-circle text-4xl mb-4" style="stroke-width:1;"></i>
          <p class="font-medium">Chưa có dữ liệu điểm cả năm</p>
          <p class="text-sm text-slate-500 mt-2">Vui lòng xem điểm trước khi phân tích</p>
        </div>
      `;
      resetAnalyzeButton();
      return;
    }

    const subjects = annualResult.data.subjects;

    // Lọc các môn có điểm cả năm
    const validSubjects = subjects.filter(s => s.annual_score !== null);

    if (validSubjects.length === 0) {
      analysisResult.innerHTML = `
        <div class="p-8 text-center text-amber-400">
          <i class="lucide lucide-alert-circle text-4xl mb-4" style="stroke-width:1;"></i>
          <p class="font-medium">Chưa có điểm cả năm</p>
          <p class="text-sm text-slate-500 mt-2">Cần có điểm cả 2 học kỳ để phân tích</p>
        </div>
      `;
      resetAnalyzeButton();
      return;
    }

    // Tính ĐTB chung
    const totalAnnual = validSubjects.reduce((sum, s) => sum + parseFloat(s.annual_score), 0);
    const overallAvg = (totalAnnual / 12).toFixed(2);

    // Sắp xếp để tìm môn tốt nhất và cần cải thiện
    const sortedSubjects = [...validSubjects].sort((a, b) => parseFloat(b.annual_score) - parseFloat(a.annual_score));
    const bestSubject = sortedSubjects[0];
    const worstSubject = sortedSubjects[sortedSubjects.length - 1];

    // Tạo gradeList cho AI
    const gradeList = sortedSubjects.map(s => {
      let detail = `ĐTB cả năm: ${s.annual_score}`;
      if (s.hk1_score !== null && s.hk2_score !== null) {
        detail += ` (HK1: ${s.hk1_score}, HK2: ${s.hk2_score})`;
      }
      return `- ${s.subject_name}: ${detail}`;
    }).join('\n');

    // Build analysis prompt
    const studentName = studentProfile?.full_name || currentUser.fullName || 'Học sinh';
    const className = studentProfile?.class_name || '';

    const message = `
Hãy phân tích kết quả học tập của học sinh sau và đưa ra nhận xét:

Họ tên: ${studentName}
Lớp: ${className}
ĐTB chung cả năm: ${overallAvg}

Điểm số chi tiết (ĐTB cả năm = (HK1 + HK2×2) / 3):
${gradeList}

Môn tốt nhất: ${bestSubject.subject_name} (${bestSubject.annual_score} điểm)
Môn cần cải thiện: ${worstSubject.subject_name} (${worstSubject.annual_score} điểm)

Yêu cầu phân tích:
1. Điểm mạnh (các môn học tốt)
2. Điểm yếu (các môn cần cải thiện)  
3. Lời khuyên cụ thể để cải thiện trong thời gian tới

Hãy viết ngắn gọn khoảng 150 từ, thân thiện, xưng "thầy/cô" hoặc "AI NTK".
    `;

    // Call AI API
    const response = await fetch(`${API_URL}/ai-chat.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message,
        role: 'student',
        context: {
          type: 'analysis',
          studentId: studentId,
          studentName: studentName,
          className: className
        }
      })
    });

    const result = await response.json();

    if (result.success && result.data?.reply) {
      displayAnalysisResult(result.data.reply, studentName, overallAvg, validSubjects, bestSubject, worstSubject);
    } else {
      throw new Error(result.error || 'Không thể phân tích');
    }

  } catch (error) {
    console.error('Analysis error:', error);
    analysisResult.innerHTML = `
      <div class="p-8 text-center text-red-400">
        <i class="lucide lucide-alert-triangle text-4xl mb-4" style="stroke-width:1;"></i>
        <p class="font-medium">Có lỗi xảy ra khi phân tích</p>
        <p class="text-sm text-slate-500 mt-2">${error.message || 'Vui lòng thử lại sau'}</p>
      </div>
    `;
  }

  resetAnalyzeButton();
}

// ====== Reset Analyze Button ======
function resetAnalyzeButton() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.disabled = false;
  analyzeBtn.innerHTML = `
    <i class="lucide lucide-wand-2" style="stroke-width:1.5;"></i>
    Phân Tích Lại
  `;
}

// ====== Display Analysis Result ======
function displayAnalysisResult(analysis, studentName, overallAvg, subjects, bestSubject, worstSubject) {
  const bestSubjectText = bestSubject ? `${bestSubject.subject_name} (${bestSubject.annual_score})` : 'N/A';
  const worstSubjectText = worstSubject ? `${worstSubject.subject_name} (${worstSubject.annual_score})` : 'N/A';

  // Get classification
  const avgNum = parseFloat(overallAvg);
  let rankClass = 'text-slate-500';
  let rank = 'Chưa xếp loại';
  if (avgNum >= 8.0) { rank = 'Giỏi'; rankClass = 'text-emerald-400'; }
  else if (avgNum >= 6.5) { rank = 'Khá'; rankClass = 'text-sky-400'; }
  else if (avgNum >= 5.0) { rank = 'Trung bình'; rankClass = 'text-amber-400'; }
  else if (avgNum >= 3.5) { rank = 'Yếu'; rankClass = 'text-orange-400'; }
  else if (!isNaN(avgNum)) { rank = 'Kém'; rankClass = 'text-red-400'; }

  // Format analysis text
  const formattedAnalysis = analysis
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-800">$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/^(\d+\.)/gm, '<span class="text-purple-400 font-semibold">$1</span>');

  document.getElementById('analysisResult').innerHTML = `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <div class="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <i class="lucide lucide-sparkles text-white" style="stroke-width:1.5;"></i>
        </div>
        <div>
          <h4 class="text-lg font-semibold text-slate-900">Kết Quả Phân Tích</h4>
          <p class="text-sm text-slate-500">AI NTK • ${new Date().toLocaleDateString('vi-VN')}</p>
        </div>
      </div>
      
      <!-- Stats Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-slate-100/80 rounded-xl p-4 text-center">
          <p class="text-xs text-slate-500 uppercase mb-1">ĐTB Chung</p>
          <p class="text-2xl font-bold text-amber-400">${overallAvg}</p>
        </div>
        <div class="bg-slate-100/80 rounded-xl p-4 text-center">
          <p class="text-xs text-slate-500 uppercase mb-1">Xếp Loại</p>
          <p class="text-lg font-semibold ${rankClass}">${rank}</p>
        </div>
        <div class="bg-slate-100/80 rounded-xl p-4 text-center">
          <p class="text-xs text-slate-500 uppercase mb-1">Môn Tốt Nhất</p>
          <p class="text-sm font-medium text-emerald-400 truncate" title="${bestSubjectText}">${bestSubjectText}</p>
        </div>
        <div class="bg-slate-100/80 rounded-xl p-4 text-center">
          <p class="text-xs text-slate-500 uppercase mb-1">Cần Cải Thiện</p>
          <p class="text-sm font-medium text-orange-400 truncate" title="${worstSubjectText}">${worstSubjectText}</p>
        </div>
      </div>
      
      <!-- AI Analysis Content -->
      <div class="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border border-purple-500/20 rounded-xl p-5">
        <div class="flex items-start gap-3">
          <div class="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0 mt-1">
            <i class="lucide lucide-bot text-purple-600 text-sm" style="stroke-width:1.5;"></i>
          </div>
          <div class="text-slate-500 text-sm leading-relaxed">
            ${formattedAnalysis}
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="mt-4 text-center">
        <p class="text-xs text-slate-500">
          <i class="lucide lucide-info inline mr-1" style="stroke-width:1.5;"></i>
          Phân tích được tạo bởi AI dựa trên dữ liệu điểm số của bạn
        </p>
      </div>
    </div>
  `;
}

// ====== Init AI Analysis Events ======
function initAIAnalysisEvents() {
  document.getElementById('analyzeBtn').addEventListener('click', analyzePerformance);
}
