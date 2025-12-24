// ====== Update Requests Management ======

let requestsData = [];

// Map request types to Vietnamese labels
const REQUEST_TYPE_LABELS = {
  'profile': 'Cập nhật thông tin',
  'grades': 'Phúc khảo điểm',
  'other': 'Yêu cầu khác'
};

// Map grade types to Vietnamese labels
const GRADE_TYPE_LABELS = {
  'oral': 'Điểm miệng',
  'fifteen': 'Điểm 15 phút',
  'one_period': 'Điểm 1 tiết',
  'midterm': 'Điểm giữa kỳ',
  'semester': 'Điểm cuối kỳ',
  // Backup mappings for old values
  'quiz': 'Điểm 15 phút',
  'test': 'Điểm 1 tiết',
  'final': 'Điểm cuối kỳ'
};

async function loadRequests(status = '') {
  const tbody = document.getElementById('requestsTableBody');
  tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500"><div class="loader mx-auto mb-2"></div>Đang tải dữ liệu...</td></tr>`;

  let url = 'update-requests.php';
  if (status) url += `?status=${status}`;

  const result = await fetchAPI(url);

  // API trả về data.requests và data.counts
  const requests = result.data?.requests || [];
  const counts = result.data?.counts || {};

  // Cập nhật thống kê
  const pendingCount = document.getElementById('requestsPendingCount');
  const approvedCount = document.getElementById('requestsApprovedCount');
  const rejectedCount = document.getElementById('requestsRejectedCount');

  if (pendingCount) pendingCount.textContent = counts.pending || 0;
  if (approvedCount) approvedCount.textContent = counts.approved || 0;
  if (rejectedCount) rejectedCount.textContent = counts.rejected || 0;

  // Cập nhật badge trên sidebar nếu có
  const pendingBadge = document.getElementById('pendingRequestsBadge');
  if (pendingBadge && counts.pending !== undefined) {
    pendingBadge.textContent = counts.pending;
    pendingBadge.classList.toggle('hidden', counts.pending === 0);
  }

  if (result.success && requests.length > 0) {
    requestsData = requests;
    tbody.innerHTML = requests.map(r => {
      const statusClass = r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
        r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
      const statusText = r.status === 'pending' ? 'Chờ duyệt' :
        r.status === 'approved' ? 'Đã duyệt' : 'Từ chối';
      const requesterName = r.teacher_name || r.student_name || '-';
      const requestTypeLabel = REQUEST_TYPE_LABELS[r.request_type] || r.request_type || '-';
      return `<tr class="hover:bg-slate-100 transition">
        <td class="px-4 py-3 text-slate-600">${r.id}</td>
        <td class="px-4 py-3 text-slate-800">${requesterName}</td>
        <td class="px-4 py-3 text-slate-700">
          <span class="inline-flex items-center gap-1">
            ${r.request_type === 'grades' ? '<i data-lucide="file-check" class="w-4 h-4 text-blue-500"></i>' :
          r.request_type === 'profile' ? '<i data-lucide="user-cog" class="w-4 h-4 text-purple-500"></i>' :
            '<i data-lucide="message-square" class="w-4 h-4 text-slate-500"></i>'}
            ${requestTypeLabel}
          </span>
        </td>
        <td class="px-4 py-3 text-slate-700 max-w-xs truncate">${r.content || r.reason || '-'}</td>
        <td class="px-4 py-3"><span class="inline-flex items-center rounded-full ${statusClass} text-xs px-2 py-1">${statusText}</span></td>
        <td class="px-4 py-3 text-slate-500 text-sm">${formatDate(r.created_at)}</td>
        <td class="text-center px-4 py-3">
          <button onclick="viewRequestDetail(${r.id})" class="px-2 py-1 rounded text-xs border border-slate-300 hover:bg-slate-200 transition mr-1">Chi tiết</button>
          ${r.status === 'pending' ? `
            <button onclick="quickApproveRequest(${r.id})" class="px-2 py-1 rounded text-xs bg-emerald-500 text-white hover:bg-emerald-600 transition mr-1">Duyệt</button>
            <button onclick="quickRejectRequest(${r.id})" class="px-2 py-1 rounded text-xs bg-red-500 text-white hover:bg-red-600 transition">Từ chối</button>
          ` : ''}
        </td>
      </tr>`;
    }).join('');

    // Re-initialize lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } else {
    tbody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">Không có yêu cầu nào</td></tr>`;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

async function viewRequestDetail(id) {
  const modal = document.getElementById('requestDetailModal');
  const content = document.getElementById('requestDetailContent');

  content.innerHTML = '<div class="flex justify-center py-8"><div class="loader"></div></div>';
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const result = await fetchAPI(`update-requests.php?id=${id}`);

  console.log('[DEBUG] Request detail:', result.data);

  if (result.success && result.data) {
    const r = result.data;

    console.log('[DEBUG] request_type:', r.request_type);
    console.log('[DEBUG] additional_info:', r.additional_info);
    console.log('[DEBUG] available_reviewers:', r.available_reviewers);
    console.log('[DEBUG] status:', r.status);
    console.log('[DEBUG] grade_review:', r.grade_review);

    const statusClass = r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
      r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
    const statusText = r.status === 'pending' ? 'Chờ duyệt' :
      r.status === 'approved' ? 'Đã duyệt' : 'Từ chối';
    const requestTypeLabel = REQUEST_TYPE_LABELS[r.request_type] || r.request_type || '-';

    // Build grade review section if applicable
    let gradeReviewHtml = '';
    if (r.request_type === 'grades' && r.additional_info) {
      const info = r.additional_info;
      const gradeTypeLabel = GRADE_TYPE_LABELS[info.grade_type] || info.grade_type || '-';
      const semesterLabel = info.semester == 1 ? 'Học kỳ 1' : 'Học kỳ 2';

      gradeReviewHtml = `
        <div class="border-t pt-4">
          <p class="text-sm font-medium text-blue-600 mb-3 flex items-center gap-2">
            <i data-lucide="file-check" class="w-4 h-4"></i> Chi tiết phúc khảo
          </p>
          <div class="bg-blue-50 rounded-lg p-4 space-y-3">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <p class="text-xs text-slate-500">Môn học</p>
                <p class="font-medium text-slate-800">${r.subject_name || '-'}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">Học kỳ</p>
                <p class="font-medium text-slate-800">${semesterLabel}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">Loại điểm</p>
                <p class="font-medium text-slate-800">${gradeTypeLabel}</p>
              </div>
              <div>
                <p class="text-xs text-slate-500">Điểm hiện tại</p>
                <p class="font-bold text-lg text-amber-600">${info.current_grade ?? '-'}</p>
              </div>
            </div>
            
            ${r.original_teacher ? `
            <div class="border-t border-blue-200 pt-3 mt-3">
              <p class="text-xs text-slate-500 mb-1">Giáo viên chấm điểm ban đầu</p>
              <p class="font-medium text-slate-800 flex items-center gap-2">
                <i data-lucide="user" class="w-4 h-4 text-slate-500"></i>
                ${r.original_teacher.full_name} (${r.original_teacher.teacher_code})
              </p>
              ${r.original_teacher.department ? `<p class="text-xs text-slate-500 mt-1">Tổ bộ môn: ${r.original_teacher.department}</p>` : ''}
            </div>
            ` : ''}
            
            ${r.grade_review ? `
            <div class="border-t border-blue-200 pt-3 mt-3">
              <p class="text-xs text-slate-500 mb-1">Trạng thái phúc khảo</p>
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center rounded-full ${r.grade_review.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
            r.grade_review.status === 'assigned' ? 'bg-blue-100 text-blue-700' :
              r.grade_review.status === 'reviewing' ? 'bg-purple-100 text-purple-700' :
                'bg-amber-100 text-amber-700'
          } text-xs px-2 py-1">
                  ${r.grade_review.status === 'completed' ? 'Hoàn thành' :
            r.grade_review.status === 'assigned' ? 'Đã phân công' :
              r.grade_review.status === 'reviewing' ? 'Đang phúc khảo' : 'Chờ phân công'}
                </span>
                ${r.grade_review.reviewer_name ? `
                  <span class="text-sm text-slate-600">- ${r.grade_review.reviewer_name}</span>
                ` : ''}
              </div>
              ${r.grade_review.reviewed_grade !== null ? `
              <div class="mt-2">
                <p class="text-xs text-slate-500">Điểm sau phúc khảo</p>
                <p class="font-bold text-lg text-emerald-600">${r.grade_review.reviewed_grade}</p>
              </div>
              ` : ''}
            </div>
            ` : ''}
            
            ${r.available_reviewers && r.available_reviewers.length > 0 && r.status === 'pending' && (!r.grade_review || r.grade_review.status === 'pending') ? `
            <div class="border-t border-blue-200 pt-3 mt-3">
              <p class="text-xs text-slate-500 mb-2">Phân công giáo viên phúc khảo</p>
              <div class="flex gap-2">
                <select id="reviewerSelect" class="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">-- Chọn giáo viên --</option>
                  ${r.available_reviewers.map(t => `<option value="${t.id}">${t.full_name} (${t.teacher_code})</option>`).join('')}
                </select>
                <button onclick="assignReviewer(${r.id})" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                  Phân công
                </button>
              </div>
            </div>
            ` : ''}
            
            ${info.attachments && info.attachments.length > 0 ? `
            <div class="border-t border-blue-200 pt-3 mt-3">
              <p class="text-xs text-slate-500 mb-2">Tài liệu đính kèm</p>
              <div class="space-y-1">
                ${info.attachments.map(f => `
                  <a href="../${f.path}" target="_blank" class="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                    <i data-lucide="paperclip" class="w-4 h-4"></i>
                    ${f.name} <span class="text-xs text-slate-400">(${formatFileSize(f.size)})</span>
                  </a>
                `).join('')}
              </div>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    content.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-slate-500">Trạng thái:</span>
          <span class="inline-flex items-center rounded-full ${statusClass} px-3 py-1">${statusText}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-500">Loại yêu cầu:</span>
          <span class="inline-flex items-center gap-1 font-medium text-slate-800">
            ${r.request_type === 'grades' ? '<i data-lucide="file-check" class="w-4 h-4 text-blue-500"></i>' :
        r.request_type === 'profile' ? '<i data-lucide="user-cog" class="w-4 h-4 text-purple-500"></i>' :
          '<i data-lucide="message-square" class="w-4 h-4 text-slate-500"></i>'}
            ${requestTypeLabel}
          </span>
        </div>
        ${r.student_name ? `
        <div class="border-t pt-4">
          <p class="text-sm text-slate-500 mb-1">Học sinh yêu cầu</p>
          <p class="text-slate-800 font-medium">${r.student_name} ${r.student_code ? `(${r.student_code})` : ''}</p>
          ${r.class_name ? `<p class="text-xs text-slate-500">Lớp: ${r.class_name}</p>` : ''}
        </div>
        ` : ''}
        ${r.teacher_name ? `
        <div class="border-t pt-4">
          <p class="text-sm text-slate-500 mb-1">Giáo viên yêu cầu</p>
          <p class="text-slate-800 font-medium">${r.teacher_name} ${r.teacher_code ? `(${r.teacher_code})` : ''}</p>
        </div>
        ` : ''}
        
        ${gradeReviewHtml}
        
        ${r.content || r.reason ? `
        <div class="border-t pt-4">
          <p class="text-sm text-slate-500 mb-1">Nội dung / Lý do</p>
          <p class="text-slate-700 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">${r.content || r.reason}</p>
        </div>
        ` : ''}
        <div class="border-t pt-4">
          <p class="text-sm text-slate-500 mb-1">Thời gian tạo</p>
          <p class="text-slate-600">${formatDate(r.created_at)}</p>
        </div>
        ${r.status === 'pending' ? `
        <div class="border-t pt-4 flex gap-3">
          <button onclick="updateRequestStatus(${r.id}, 'approved')" 
            class="flex-1 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition font-medium">
            ✓ Phê duyệt
          </button>
          <button onclick="updateRequestStatus(${r.id}, 'rejected')" 
            class="flex-1 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium">
            ✗ Từ chối
          </button>
        </div>
        ` : ''}
      </div>
    `;

    // Re-initialize lucide icons in modal
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  } else {
    content.innerHTML = '<p class="text-center text-slate-500">Không tìm thấy yêu cầu</p>';
  }
}

// Format file size
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Assign reviewer for grade review
async function assignReviewer(requestId) {
  const select = document.getElementById('reviewerSelect');
  if (!select || !select.value) {
    showToast('Vui lòng chọn giáo viên phúc khảo', 'error');
    return;
  }

  const result = await fetchAPI('update-requests.php', {
    method: 'PUT',
    body: JSON.stringify({
      assign_reviewer: true,
      request_id: requestId,
      reviewer_id: parseInt(select.value)
    })
  });

  if (result.success) {
    showToast('Đã phân công giáo viên phúc khảo: ' + (result.data?.reviewer_name || ''), 'success');
    viewRequestDetail(requestId); // Refresh the detail view
    loadRequests(document.getElementById('filterRequestStatus')?.value || '');
  } else {
    showToast(result.message || 'Có lỗi xảy ra', 'error');
  }
}

function closeRequestDetailModal() {
  const modal = document.getElementById('requestDetailModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function updateRequestStatus(id, status) {
  const result = await fetchAPI('update-requests.php', {
    method: 'PUT',
    body: JSON.stringify({ id, status })
  });

  if (result.success) {
    showToast(status === 'approved' ? 'Đã phê duyệt yêu cầu!' : 'Đã từ chối yêu cầu!', 'success');
    closeRequestDetailModal();
    loadRequests(document.getElementById('filterRequestStatus')?.value || '');
  } else {
    showToast(result.message || 'Có lỗi xảy ra', 'error');
  }
}

async function quickApproveRequest(id) {
  UI.modal.confirm({
    title: 'Duyệt Yêu Cầu',
    message: 'Bạn có chắc muốn duyệt yêu cầu này?',
    type: 'success',
    onConfirm: () => updateRequestStatus(id, 'approved')
  });
}

async function quickRejectRequest(id) {
  UI.modal.confirm({
    title: 'Từ Chối Yêu Cầu',
    message: 'Bạn có chắc muốn từ chối yêu cầu này?',
    type: 'danger',
    onConfirm: () => updateRequestStatus(id, 'rejected')
  });
}

function initRequestsEvents() {
  const closeBtn = document.getElementById('closeRequestDetailModal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeRequestDetailModal);
  }

  const modal = document.getElementById('requestDetailModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'requestDetailModal') closeRequestDetailModal();
    });
  }

  const filterSelect = document.getElementById('filterRequestStatus');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => loadRequests(filterSelect.value));
  }

  const refreshBtn = document.getElementById('refreshRequestsBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadRequests(filterSelect?.value || ''));
  }
}
