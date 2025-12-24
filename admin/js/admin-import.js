// ====== Import Students ======

function initImportStudentsEvents() {
  const dropArea = document.getElementById('dropZone');
  const fileInput = document.getElementById('excelFileInput');
  
  if (!dropArea || !fileInput) return;
  
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.add('border-emerald-500', 'bg-emerald-50'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => dropArea.classList.remove('border-emerald-500', 'bg-emerald-50'), false);
  });

  dropArea.addEventListener('drop', handleDrop, false);
  dropArea.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFiles);
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles({ target: { files } });
}

function handleFiles(e) {
  const files = e.target.files;
  if (files.length > 0) {
    const file = files[0];
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const isValid = validTypes.some(type => file.name.toLowerCase().endsWith(type));

    if (!isValid) {
      showToast('Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV', 'error');
      return;
    }
    document.getElementById('selectedFileName').textContent = `Đã chọn: ${file.name}`;
    document.getElementById('uploadBtn').disabled = false;
  }
}

async function uploadStudentExcel() {
  const fileInput = document.getElementById('excelFileInput');
  const progressBar = document.getElementById('importProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const resultDiv = document.getElementById('importResult');

  if (!fileInput.files.length) {
    showToast('Vui lòng chọn file', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  progressBar.classList.remove('hidden');
  resultDiv.innerHTML = '';
  progressFill.style.width = '0%';
  progressText.textContent = '0%';

  try {
    const token = localStorage.getItem('token');
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = percent + '%';
        progressText.textContent = percent + '%';
      }
    });

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          if (result.success) {
            showToast(`Import thành công ${result.imported || 0} học sinh!`, 'success');
            resultDiv.innerHTML = `<div class="p-4 bg-emerald-100 rounded-lg text-emerald-700">
              ✓ Đã import ${result.imported || 0} học sinh thành công!
              ${result.errors && result.errors.length > 0 ? `<br><span class="text-amber-600">⚠ ${result.errors.length} dòng lỗi</span>` : ''}
            </div>`;
            loadStudents();
            loadDashboardStats();
          } else {
            showToast(result.message || 'Có lỗi khi import', 'error');
            resultDiv.innerHTML = `<div class="p-4 bg-red-100 rounded-lg text-red-700">✗ ${result.message || 'Có lỗi xảy ra'}</div>`;
          }
        } else {
          showToast('Lỗi upload file', 'error');
        }
      }
    };

    xhr.open('POST', '../api/import-students.php', true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.send(formData);
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  }
}

// ====== Import Excel Users ======

function initImportExcelEvents() {
  const userDropArea = document.getElementById('userDropArea');
  const userFileInput = document.getElementById('userExcelFile');
  
  if (!userDropArea || !userFileInput) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    userDropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    userDropArea.addEventListener(eventName, () => userDropArea.classList.add('border-emerald-500', 'bg-emerald-50'), false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    userDropArea.addEventListener(eventName, () => userDropArea.classList.remove('border-emerald-500', 'bg-emerald-50'), false);
  });

  userDropArea.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    handleUserFiles({ target: { files } });
  }, false);

  userDropArea.addEventListener('click', () => userFileInput.click());
  userFileInput.addEventListener('change', handleUserFiles);
}

function handleUserFiles(e) {
  const files = e.target.files;
  if (files.length > 0) {
    const file = files[0];
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const isValid = validTypes.some(type => file.name.toLowerCase().endsWith(type));

    if (!isValid) {
      showToast('Vui lòng chọn file Excel (.xlsx, .xls) hoặc CSV', 'error');
      return;
    }
    document.getElementById('userSelectedFileName').textContent = `Đã chọn: ${file.name}`;
    document.getElementById('uploadUserBtn').disabled = false;
  }
}

async function uploadUserExcel() {
  const fileInput = document.getElementById('userExcelFile');
  const progressBar = document.getElementById('userImportProgress');
  const progressFill = document.getElementById('userProgressFill');
  const progressText = document.getElementById('userProgressText');
  const resultDiv = document.getElementById('userImportResult');

  if (!fileInput.files.length) {
    showToast('Vui lòng chọn file', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  progressBar.classList.remove('hidden');
  resultDiv.innerHTML = '';
  progressFill.style.width = '0%';
  progressText.textContent = '0%';

  try {
    const token = localStorage.getItem('token');
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressFill.style.width = percent + '%';
        progressText.textContent = percent + '%';
      }
    });

    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4) {
        progressFill.style.width = '100%';
        progressText.textContent = '100%';
        
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText);
          if (result.success) {
            showToast(`Import thành công ${result.imported || 0} tài khoản!`, 'success');
            resultDiv.innerHTML = `<div class="p-4 bg-emerald-100 rounded-lg text-emerald-700">
              ✓ Đã import ${result.imported || 0} tài khoản thành công!
              ${result.errors && result.errors.length > 0 ? `<br><span class="text-amber-600">⚠ ${result.errors.length} dòng lỗi</span>` : ''}
            </div>`;
            loadUsers();
            loadDashboardStats();
          } else {
            showToast(result.message || 'Có lỗi khi import', 'error');
            resultDiv.innerHTML = `<div class="p-4 bg-red-100 rounded-lg text-red-700">✗ ${result.message || 'Có lỗi xảy ra'}</div>`;
          }
        } else {
          showToast('Lỗi upload file', 'error');
        }
      }
    };

    xhr.open('POST', '../api/users.php?action=import', true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    xhr.send(formData);
  } catch (error) {
    showToast('Lỗi: ' + error.message, 'error');
  }
}
