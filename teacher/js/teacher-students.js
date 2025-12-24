/**
 * Teacher Students - Quản lý danh sách học sinh
 */

// ====== Load Students ======
async function loadStudents(classId) {
  const tbody = document.getElementById('studentsTableBody');
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
    const response = await fetch(`${API_URL}/students.php?class_id=${classId}`);
    const result = await response.json();
    
    if (result.success && result.data.length > 0) {
      const students = result.data;
      document.getElementById('totalStudents').textContent = students.length;
      
      // Count gender
      const males = students.filter(s => s.gender === 'Nam').length;
      const females = students.length - males;
      document.getElementById('genderRatio').textContent = `${males} / ${females}`;
      
      // Store students data for modal
      window.studentsData = students;
      
      tbody.innerHTML = students.map((s, i) => `
        <tr class="hover:bg-slate-200/80 transition cursor-pointer" onclick="showStudentInfo(${s.id})">
          <td class="px-4 py-3 text-slate-500">${i + 1}</td>
          <td class="px-4 py-3 text-slate-800 font-mono">${s.student_code}</td>
          <td class="px-4 py-3 text-slate-800">${s.full_name}</td>
          <td class="text-center px-4 py-3 text-slate-700">${s.gender || '-'}</td>
          <td class="text-center px-4 py-3 text-slate-700">${s.birth_date ? formatDate(s.birth_date) : '-'}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center px-4 py-8 text-slate-500">Không có học sinh</td></tr>`;
      document.getElementById('totalStudents').textContent = '0';
      document.getElementById('genderRatio').textContent = '-- / --';
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center px-4 py-8 text-red-400">Lỗi tải dữ liệu</td></tr>`;
  }
}

// ====== Show Student Info Modal ======
async function showStudentInfo(studentId) {
  const modal = document.getElementById('studentInfoModal');
  
  // Try to find student in cached data first
  let student = window.studentsData?.find(s => s.id == studentId);
  
  // If not found or need full details, fetch from API
  try {
    const response = await fetch(`${API_URL}/students.php?id=${studentId}`);
    const result = await response.json();
    if (result.success && result.data) {
      student = result.data;
    }
  } catch (error) {
    console.error('Error fetching student:', error);
  }
  
  if (!student) {
    showToast('Không tìm thấy thông tin học sinh');
    return;
  }
  
  // Generate initials
  const nameParts = student.full_name?.split(' ') || ['?'];
  const initials = nameParts.length > 1 
    ? nameParts[nameParts.length - 2][0] + nameParts[nameParts.length - 1][0]
    : nameParts[0][0] + (nameParts[0][1] || '');
  
  // Fill modal data
  document.getElementById('modalAvatar').textContent = initials.toUpperCase();
  document.getElementById('modalFullName').textContent = student.full_name || '--';
  document.getElementById('modalStudentCode').textContent = student.student_code || '--';
  document.getElementById('modalClassName').textContent = student.class_name ? `Lớp ${student.class_name}` : '--';
  
  document.getElementById('modalCode').textContent = student.student_code || '--';
  document.getElementById('modalName').textContent = student.full_name || '--';
  document.getElementById('modalDob').textContent = formatDate(student.birth_date) || '--';
  document.getElementById('modalGender').textContent = student.gender || '--';
  document.getElementById('modalClass').textContent = student.class_name || '--';
  document.getElementById('modalEthnicity').textContent = student.ethnicity || 'Kinh';
  document.getElementById('modalHometown').textContent = student.hometown || 'Chưa cập nhật';
  document.getElementById('modalAddress').textContent = student.address || 'Chưa cập nhật';
  
  document.getElementById('modalParentName').textContent = student.parent_name || 'Chưa cập nhật';
  document.getElementById('modalParentPhone').textContent = student.parent_phone || 'Chưa cập nhật';
  document.getElementById('modalParentEmail').textContent = student.parent_email || 'Chưa cập nhật';
  
  // Show modal
  modal.classList.remove('hidden');
}

// ====== Close Student Modal ======
function closeStudentModal() {
  document.getElementById('studentInfoModal').classList.add('hidden');
}

// ====== Print Students List ======
function printStudentsList() {
  const className = document.getElementById('studentClassSelect').selectedOptions[0]?.text || 'Lớp';
  const tbody = document.getElementById('studentsTableBody');
  const rows = tbody.querySelectorAll('tr');
  
  if (rows.length === 0 || (rows.length === 1 && rows[0].querySelector('td[colspan]'))) {
    showToast('Vui lòng tải danh sách học sinh trước');
    return;
  }
  
  let tableRows = '';
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 5) {
      tableRows += `
        <tr>
          <td style="border: 1px solid #333; padding: 8px; text-align: center;">${cells[0].textContent}</td>
          <td style="border: 1px solid #333; padding: 8px;">${cells[1].textContent}</td>
          <td style="border: 1px solid #333; padding: 8px;">${cells[2].textContent}</td>
          <td style="border: 1px solid #333; padding: 8px; text-align: center;">${cells[3].textContent}</td>
          <td style="border: 1px solid #333; padding: 8px; text-align: center;">${cells[4].textContent}</td>
          <td style="border: 1px solid #333; padding: 8px; width: 100px;"></td>
        </tr>
      `;
    }
  });
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Danh Sách Học Sinh ${className}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h2, h3 { text-align: center; margin: 5px 0; }
        h2 { font-size: 18px; }
        h3 { font-size: 16px; }
        p.date { text-align: center; font-size: 12px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background-color: #f0f0f0; border: 1px solid #333; padding: 8px; text-align: left; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; }
        .signature { text-align: right; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h2>TRƯỜNG THPT XYZ</h2>
      <h3>DANH SÁCH HỌC SINH ${className.toUpperCase()}</h3>
      <p class="date">Năm học: 2024-2025 | Ngày in: ${new Date().toLocaleDateString('vi-VN')}</p>
      
      <table>
        <thead>
          <tr>
            <th style="width: 50px; text-align: center;">STT</th>
            <th style="width: 100px;">Mã HS</th>
            <th>Họ và Tên</th>
            <th style="width: 80px; text-align: center;">Giới Tính</th>
            <th style="width: 100px; text-align: center;">Năm Sinh</th>
            <th style="width: 100px; text-align: center;">Ghi Chú</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      <div class="footer">
        <div>Tổng số: <strong>${rows.length}</strong> học sinh</div>
        <div class="signature">
          <p>Ngày ........ tháng ........ năm ........</p>
          <p style="margin-top: 5px;"><strong>GVCN ký tên</strong></p>
        </div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ====== Init Events ======
function initStudentsEvents() {
  // Student Info Modal close buttons
  document.getElementById('closeStudentModal').addEventListener('click', closeStudentModal);
  document.getElementById('closeStudentModalBtn').addEventListener('click', closeStudentModal);
  document.getElementById('studentInfoModal').addEventListener('click', (e) => {
    if (e.target.id === 'studentInfoModal') closeStudentModal();
  });
  
  // Load students button
  document.getElementById('loadStudentsBtn').addEventListener('click', () => {
    const classId = document.getElementById('studentClassSelect').value;
    if (classId) {
      loadStudents(classId);
    } else {
      showToast('Vui lòng chọn lớp');
    }
  });

  // Print students list
  document.getElementById('printStudentsBtn').addEventListener('click', () => {
    const classId = document.getElementById('studentClassSelect').value;
    if (!classId) {
      showToast('Vui lòng chọn lớp trước');
      return;
    }
    printStudentsList();
  });
}
