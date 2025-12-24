/**
 * Student Profile - Thông tin cá nhân học sinh
 */

// ====== Load Student Profile ======
async function loadStudentProfile() {
  try {
    const studentId = currentUser.student_id;
    if (!studentId) {
      showToast('Không tìm thấy thông tin học sinh');
      return;
    }

    const response = await fetch(`${API_URL}/students.php?id=${studentId}`);
    const result = await response.json();

    if (result.success && result.data) {
      studentProfile = result.data;
      if (typeof State !== 'undefined') {
        State.studentProfile = result.data;
        State.currentStudentId = result.data.id;
      }
      renderProfile(studentProfile);
      loadConductInfo(studentId);
    } else {
      showToast('Không thể tải thông tin học sinh');
    }
  } catch (error) {
    console.error('Error loading profile:', error);
    showToast('Lỗi kết nối server');
  }
}

// ====== Load Conduct Info ======
async function loadConductInfo(studentId) {
  try {
    const response = await fetch(`${API_URL}/conduct.php?student_id=${studentId}`);
    const result = await response.json();

    if (result.success && result.data) {
      result.data.forEach(conduct => {
        const elementId = conduct.semester === 1 ? 'conductTerm1' : 'conductTerm2';
        const element = document.getElementById(elementId);
        if (element) {
          const rating = conduct.rating || 'Chưa có';
          const colorClass = rating === 'Tốt' ? 'bg-emerald-500 text-white'
            : rating === 'Khá' ? 'bg-sky-500 text-white'
              : rating === 'Trung bình' ? 'bg-amber-500 text-white'
                : 'bg-slate-200 text-slate-600';
          element.className = `inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${colorClass}`;
          element.textContent = rating;
        }
      });
    }
  } catch (error) {
    console.error('Error loading conduct:', error);
  }
}

// ====== Render Profile ======
function renderProfile(student) {
  // Get initials for avatar
  const nameParts = student.full_name ? student.full_name.split(' ') : ['?', '?'];
  const initials = nameParts.length >= 2
    ? nameParts[nameParts.length - 2][0] + nameParts[nameParts.length - 1][0]
    : nameParts[0][0] + (nameParts[0][1] || '');

  document.getElementById('profileAvatar').textContent = initials.toUpperCase();
  document.getElementById('profileName').textContent = student.full_name || 'N/A';
  document.getElementById('profileClass').textContent = student.class_name ? `Lớp ${student.class_name}` : '';
  document.getElementById('profileId').textContent = student.student_code || student.id;
  document.getElementById('profileGender').textContent = student.gender || 'N/A';
  document.getElementById('profileDob').textContent = formatDate(student.birth_date || student.date_of_birth);

  // Detail fields
  document.getElementById('detailCode').value = student.student_code || student.id;
  document.getElementById('detailName').value = student.full_name || 'N/A';
  document.getElementById('detailDob').value = formatDate(student.birth_date || student.date_of_birth);
  document.getElementById('detailGender').value = student.gender || 'N/A';
  document.getElementById('detailClass').value = student.class_name || 'N/A';
  document.getElementById('detailEthnicity').value = student.ethnicity || 'Kinh';
  document.getElementById('detailHometown').value = student.hometown || 'Chưa cập nhật';
  document.getElementById('detailAddress').value = student.address || 'Chưa cập nhật';

  // Parent info
  document.getElementById('detailParentName').value = student.parent_name || 'Chưa cập nhật';
  document.getElementById('detailParentPhone').value = student.parent_phone || 'Chưa cập nhật';
  document.getElementById('detailParentEmail').value = student.parent_email || 'Chưa cập nhật';
}

// ====== Submit Update Request ======
let selectedFiles = [];

async function submitUpdateRequest() {
  const requestType = document.getElementById('updateType').value;
  const content = document.getElementById('updateReason').value.trim();

  if (!content) {
    showToast('Vui lòng nhập nội dung yêu cầu');
    return;
  }

  // Nếu là phúc khảo điểm, validate thêm
  if (requestType === 'grades') {
    const subjectId = document.getElementById('reviewSubject').value;
    if (!subjectId) {
      showToast('Vui lòng chọn môn học cần phúc khảo');
      return;
    }
  }

  try {
    // Prepare form data for file upload
    const formData = new FormData();
    formData.append('student_id', currentUser.student_id);
    formData.append('request_type', requestType);
    formData.append('content', content);

    if (requestType === 'grades') {
      formData.append('subject_id', document.getElementById('reviewSubject').value);
      formData.append('semester', document.getElementById('reviewSemester').value);
      formData.append('grade_type', document.getElementById('reviewGradeType').value);
      const currentGrade = document.getElementById('reviewCurrentGrade').value;
      if (currentGrade) {
        formData.append('current_grade', currentGrade);
      }
    }

    // Add files
    selectedFiles.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });

    const response = await fetch(`${API_URL}/update-requests.php`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    if (result.success) {
      showToast('Yêu cầu đã được gửi thành công!');
      document.getElementById('updateModal').classList.add('hidden');
      resetUpdateForm();
    } else {
      showToast('Lỗi: ' + (result.message || 'Không thể gửi yêu cầu'));
    }
  } catch (error) {
    console.error('Error submitting request:', error);
    showToast('Lỗi kết nối server');
  }
}

function resetUpdateForm() {
  document.getElementById('updateReason').value = '';
  document.getElementById('updateType').value = 'profile';
  document.getElementById('gradeReviewFields').classList.add('hidden');
  document.getElementById('reviewSubject').value = '';
  document.getElementById('reviewSemester').value = '1';
  document.getElementById('reviewGradeType').value = 'oral';
  document.getElementById('reviewCurrentGrade').value = '';
  document.getElementById('currentGradeDisplay').classList.add('hidden');
  document.getElementById('filePreviewList').innerHTML = '';
  selectedFiles = [];
}

async function loadSubjectsForReview() {
  try {
    const response = await fetch(`${API_URL}/subjects.php`);
    const result = await response.json();

    if (result.success) {
      const select = document.getElementById('reviewSubject');
      select.innerHTML = '<option value="">-- Chọn môn học --</option>';
      result.data.forEach(subj => {
        select.innerHTML += `<option value="${subj.id}">${subj.subject_name}</option>`;
      });
    }
  } catch (error) {
    console.error('Error loading subjects:', error);
  }
}

async function fetchCurrentGrade() {
  const subjectId = document.getElementById('reviewSubject').value;
  const semester = document.getElementById('reviewSemester').value;
  const gradeType = document.getElementById('reviewGradeType').value;
  const gradeDisplay = document.getElementById('currentGradeDisplay');
  const gradeValue = document.getElementById('reviewCurrentGradeValue');
  const gradeNote = document.getElementById('currentGradeNote');
  const gradeInput = document.getElementById('reviewCurrentGrade');

  if (!subjectId) {
    gradeDisplay.classList.add('hidden');
    gradeInput.value = '';
    return;
  }

  // Lấy student_id từ currentUser hoặc State
  const studentId = currentUser?.student_id || State?.currentUser?.student_id;
  console.log('Fetching grade for student_id:', studentId, 'subject:', subjectId, 'semester:', semester);

  if (!studentId) {
    console.error('No student_id found');
    gradeDisplay.classList.add('hidden');
    return;
  }

  try {
    // API trả về mảng điểm tất cả môn của học sinh theo học kỳ
    const url = `${API_URL}/grades.php?student_id=${studentId}&semester=${semester}`;
    console.log('Fetching from:', url);
    const response = await fetch(url);
    const result = await response.json();
    console.log('Grade API result:', result);

    if (result.success && result.data && result.data.length > 0) {
      // Tìm điểm môn học được chọn
      const gradeData = result.data.find(g => g.subject_id == subjectId);

      // Map grade type to field
      const gradeTypeMap = {
        'oral': 'oral_score',
        'fifteen': 'fifteen_min_score',
        'one_period': 'one_period_score',
        'midterm': 'midterm_score',
        'semester': 'semester_score'
      };

      const gradeTypeLabels = {
        'oral': 'Điểm miệng',
        'fifteen': 'Điểm 15 phút',
        'one_period': 'Điểm 1 tiết',
        'midterm': 'Điểm giữa kỳ',
        'semester': 'Điểm cuối kỳ'
      };

      if (gradeData) {
        const fieldName = gradeTypeMap[gradeType];
        const score = gradeData[fieldName];

        if (score !== null && score !== undefined && score !== '') {
          gradeValue.textContent = parseFloat(score).toFixed(1);
          gradeValue.className = 'text-lg font-bold ' + (parseFloat(score) >= 5 ? 'text-emerald-600' : 'text-red-500');
          gradeNote.textContent = `${gradeTypeLabels[gradeType]} - Học kỳ ${semester} - ${gradeData.subject_name || 'Môn học'}`;
          gradeInput.value = score;
        } else {
          gradeValue.textContent = 'Chưa có điểm';
          gradeValue.className = 'text-lg font-bold text-slate-400';
          gradeNote.textContent = `${gradeTypeLabels[gradeType]} chưa được nhập`;
          gradeInput.value = '';
        }
      } else {
        gradeValue.textContent = 'Chưa có dữ liệu';
        gradeValue.className = 'text-lg font-bold text-slate-400';
        gradeNote.textContent = 'Chưa có điểm môn này trong học kỳ được chọn';
        gradeInput.value = '';
      }

      gradeDisplay.classList.remove('hidden');
    } else {
      gradeValue.textContent = 'Chưa có dữ liệu';
      gradeValue.className = 'text-lg font-bold text-slate-400';
      gradeNote.textContent = 'Chưa có điểm trong học kỳ này';
      gradeInput.value = '';
      gradeDisplay.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error fetching grade:', error);
    gradeDisplay.classList.add('hidden');
    gradeInput.value = '';
  }
}

function handleFileSelect(files) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

  Array.from(files).forEach(file => {
    if (file.size > maxSize) {
      showToast(`File ${file.name} vượt quá 5MB`);
      return;
    }
    if (!validTypes.includes(file.type)) {
      showToast(`File ${file.name} không được hỗ trợ`);
      return;
    }
    if (selectedFiles.length >= 5) {
      showToast('Tối đa 5 file');
      return;
    }
    selectedFiles.push(file);
  });

  renderFilePreview();
}

function renderFilePreview() {
  const container = document.getElementById('filePreviewList');
  container.innerHTML = selectedFiles.map((file, index) => `
    <div class="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2">
      <div class="flex items-center gap-2 min-w-0">
        <i class="lucide lucide-${file.type.startsWith('image') ? 'image' : 'file-text'} text-slate-400" style="stroke-width:1.5;"></i>
        <span class="text-sm text-slate-700 truncate">${file.name}</span>
        <span class="text-xs text-slate-400">(${(file.size / 1024).toFixed(1)} KB)</span>
      </div>
      <button type="button" onclick="removeFile(${index})" class="text-red-500 hover:text-red-700 p-1">
        <i class="lucide lucide-x" style="stroke-width:1.5;"></i>
      </button>
    </div>
  `).join('');
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFilePreview();
}

// ====== Init Profile Events ======
function initProfileEvents() {
  const updateModal = document.getElementById('updateModal');
  const requestUpdateBtn = document.getElementById('requestUpdateBtn');
  const submitUpdateBtn = document.getElementById('submitUpdateBtn');
  const updateTypeSelect = document.getElementById('updateType');
  const gradeReviewFields = document.getElementById('gradeReviewFields');
  const fileDropZone = document.getElementById('fileDropZone');
  const fileInput = document.getElementById('reviewAttachment');

  requestUpdateBtn.addEventListener('click', () => {
    updateModal.classList.remove('hidden');
    loadSubjectsForReview();
  });

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      updateModal.classList.add('hidden');
      resetUpdateForm();
    });
  });

  updateModal.addEventListener('click', (e) => {
    if (e.target === updateModal) {
      updateModal.classList.add('hidden');
      resetUpdateForm();
    }
  });

  submitUpdateBtn.addEventListener('click', submitUpdateRequest);

  // Toggle grade review fields
  updateTypeSelect.addEventListener('change', (e) => {
    if (e.target.value === 'grades') {
      gradeReviewFields.classList.remove('hidden');
    } else {
      gradeReviewFields.classList.add('hidden');
      document.getElementById('currentGradeDisplay').classList.add('hidden');
    }
  });

  // Auto-fetch grade when selections change
  const reviewSubject = document.getElementById('reviewSubject');
  const reviewSemester = document.getElementById('reviewSemester');
  const reviewGradeType = document.getElementById('reviewGradeType');

  reviewSubject.addEventListener('change', fetchCurrentGrade);
  reviewSemester.addEventListener('change', fetchCurrentGrade);
  reviewGradeType.addEventListener('change', fetchCurrentGrade);

  // File upload handling
  fileDropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files);
    e.target.value = ''; // Reset để có thể chọn lại cùng file
  });

  fileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropZone.classList.add('border-sky-400', 'bg-sky-50');
  });

  fileDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('border-sky-400', 'bg-sky-50');
  });

  fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('border-sky-400', 'bg-sky-50');
    handleFileSelect(e.dataTransfer.files);
  });
}
