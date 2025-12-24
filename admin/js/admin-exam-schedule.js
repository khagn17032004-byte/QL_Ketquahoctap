/**
 * Admin Exam Schedule - Quản lý lịch thi
 */

// ====== State ======
let examPeriods = [];
let examSchedules = [];
let examRooms = [];
let selectedPeriod = null;
let selectedSchedule = null;

// ====== Load Exam Periods ======
async function loadExamPeriods() {
    try {
        const res = await fetch(`${API_URL}/exam-schedule.php?action=periods`);
        const data = await res.json();
        if (data.success) {
            examPeriods = data.data;
            renderExamPeriods();
        }
    } catch (error) {
        console.error('Error loading exam periods:', error);
        showToast('Lỗi tải danh sách kỳ thi', 'error');
    }
}

// ====== Render Exam Periods ======
function renderExamPeriods() {
    const container = document.getElementById('examPeriodsList');
    if (!container) return;

    if (examPeriods.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-500">
                <i class="lucide lucide-calendar-x text-4xl mb-2 opacity-50" style="stroke-width:1;"></i>
                <p>Chưa có kỳ thi nào</p>
            </div>
        `;
        return;
    }

    const statusColors = {
        'draft': 'bg-slate-100 text-slate-600',
        'published': 'bg-emerald-100 text-emerald-600',
        'completed': 'bg-sky-100 text-sky-600'
    };
    const statusLabels = {
        'draft': 'Nháp',
        'published': 'Đã công bố',
        'completed': 'Hoàn thành'
    };

    container.innerHTML = examPeriods.map(period => `
        <div class="border border-slate-200 rounded-xl p-4 hover:shadow-md transition cursor-pointer ${selectedPeriod?.id === period.id ? 'ring-2 ring-sky-500 bg-sky-50' : 'bg-white'}"
             onclick="selectExamPeriod(${period.id})">
            <div class="flex items-start justify-between mb-2">
                <h3 class="font-semibold text-slate-900">${period.name}</h3>
                <span class="px-2 py-1 rounded-full text-xs font-medium ${statusColors[period.status]}">${statusLabels[period.status]}</span>
            </div>
            <div class="text-sm text-slate-500 space-y-1">
                <p><i class="lucide lucide-calendar inline w-4 h-4 mr-1" style="stroke-width:1.5;"></i>${formatDate(period.start_date)} - ${formatDate(period.end_date)}</p>
                <p><i class="lucide lucide-book-open inline w-4 h-4 mr-1" style="stroke-width:1.5;"></i>${period.schedule_count || 0} môn thi</p>
                <p><i class="lucide lucide-graduation-cap inline w-4 h-4 mr-1" style="stroke-width:1.5;"></i>Năm học: ${period.school_year}</p>
            </div>
            <div class="mt-3 flex gap-2">
                <button onclick="event.stopPropagation(); editExamPeriod(${period.id})" class="text-xs px-2 py-1 bg-sky-100 text-sky-600 rounded hover:bg-sky-200">Sửa</button>
                <button onclick="event.stopPropagation(); deleteExamPeriod(${period.id})" class="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200">Xóa</button>
                ${period.status === 'draft' ? `<button onclick="event.stopPropagation(); publishPeriod(${period.id})" class="text-xs px-2 py-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200">Công bố</button>` : ''}
                ${period.status === 'published' ? `<button onclick="event.stopPropagation(); completePeriod(${period.id})" class="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200">Hoàn thành</button>` : ''}
            </div>
        </div>
    `).join('');
}

// ====== Select Exam Period ======
async function selectExamPeriod(periodId) {
    selectedPeriod = examPeriods.find(p => p.id === periodId);
    renderExamPeriods();
    await loadExamSchedules(periodId);
    document.getElementById('examScheduleSection').classList.remove('hidden');
}

// ====== Load Exam Schedules ======
async function loadExamSchedules(periodId) {
    try {
        const res = await fetch(`${API_URL}/exam-schedule.php?action=schedules&period_id=${periodId}`);
        const data = await res.json();
        if (data.success) {
            examSchedules = data.data;
            renderExamSchedules();
        }
    } catch (error) {
        console.error('Error loading exam schedules:', error);
    }
}

// ====== Render Exam Schedules ======
function renderExamSchedules() {
    const container = document.getElementById('examSchedulesList');
    if (!container) return;

    // Group by grade level
    const byGrade = { 10: [], 11: [], 12: [] };
    examSchedules.forEach(s => {
        if (byGrade[s.grade_level]) {
            byGrade[s.grade_level].push(s);
        }
    });

    let html = `
        <div class="flex items-center justify-between mb-4">
            <h3 class="font-semibold text-slate-900">Lịch thi: ${selectedPeriod?.name || ''}</h3>
            <button onclick="showAddScheduleModal()" class="px-3 py-1.5 bg-sky-500 text-white rounded-lg text-sm hover:bg-sky-600 flex items-center gap-1">
                <i class="lucide lucide-plus w-4 h-4" style="stroke-width:2;"></i> Thêm môn thi
            </button>
        </div>
    `;

    [10, 11, 12].forEach(grade => {
        const schedules = byGrade[grade];
        html += `
            <div class="mb-6">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-medium text-slate-700 flex items-center gap-2">
                        <span class="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-emerald-400 text-white text-sm flex items-center justify-center font-bold">${grade}</span>
                        Khối ${grade}
                    </h4>
                </div>
        `;

        if (schedules.length === 0) {
            html += `<p class="text-sm text-slate-400 italic ml-10">Chưa có lịch thi</p>`;
        } else {
            html += `
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-slate-50">
                                <th class="px-3 py-2 text-left font-medium text-slate-600">Môn thi</th>
                                <th class="px-3 py-2 text-left font-medium text-slate-600">Ngày thi</th>
                                <th class="px-3 py-2 text-left font-medium text-slate-600">Giờ thi</th>
                                <th class="px-3 py-2 text-left font-medium text-slate-600">Loại</th>
                                <th class="px-3 py-2 text-center font-medium text-slate-600">Phòng thi</th>
                                <th class="px-3 py-2 text-center font-medium text-slate-600">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            schedules.forEach(s => {
                const examTypes = { 'tu_luan': 'Tự luận', 'trac_nghiem': 'Trắc nghiệm', 'ket_hop': 'Kết hợp' };
                html += `
                    <tr class="border-b border-slate-100 hover:bg-slate-50">
                        <td class="px-3 py-2 font-medium">${s.subject_name}</td>
                        <td class="px-3 py-2">${formatDate(s.exam_date)}</td>
                        <td class="px-3 py-2">${formatTime(s.start_time)} - ${formatTime(s.end_time)}</td>
                        <td class="px-3 py-2">${examTypes[s.exam_type] || s.exam_type}</td>
                        <td class="px-3 py-2 text-center">
                            <button onclick="showExamRooms(${s.id}, ${grade})" class="text-sky-600 hover:text-sky-700 underline">Xem/Phân công</button>
                        </td>
                        <td class="px-3 py-2 text-center">
                            <button onclick="editExamSchedule(${s.id})" class="text-sky-500 hover:text-sky-700 mr-2"><i class="lucide lucide-edit w-4 h-4" style="stroke-width:1.5;"></i></button>
                            <button onclick="deleteExamSchedule(${s.id})" class="text-red-500 hover:text-red-700"><i class="lucide lucide-trash-2 w-4 h-4" style="stroke-width:1.5;"></i></button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table></div>`;
        }

        html += `</div>`;
    });

    container.innerHTML = html;
}

// ====== Show Add Period Modal ======
function showAddPeriodModal() {
    const modal = document.getElementById('examPeriodModal');
    document.getElementById('examPeriodModalTitle').textContent = 'Thêm Kỳ Thi Mới';
    document.getElementById('periodForm').reset();
    document.getElementById('periodId').value = '';
    modal.classList.remove('hidden');
}

// ====== Save Exam Period ======
async function saveExamPeriod() {
    const periodId = document.getElementById('periodId').value;
    const data = {
        action: periodId ? 'update_period' : 'create_period',
        id: periodId || undefined,
        name: document.getElementById('periodName').value,
        semester: document.getElementById('periodSemester').value,
        school_year: document.getElementById('periodSchoolYear').value,
        start_date: document.getElementById('periodStartDate').value,
        end_date: document.getElementById('periodEndDate').value,
        status: document.getElementById('periodStatus').value
    };

    try {
        const res = await fetch(`${API_URL}/exam-schedule.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            showToast(result.message, 'success');
            closeModal('examPeriodModal');
            loadExamPeriods();
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Lỗi lưu kỳ thi', 'error');
    }
}

// ====== Show Add Schedule Modal ======
async function showAddScheduleModal() {
    if (!selectedPeriod) {
        showToast('Vui lòng chọn kỳ thi trước', 'warning');
        return;
    }

    const modal = document.getElementById('examScheduleModal');
    document.getElementById('examScheduleModalTitle').textContent = 'Thêm Môn Thi';
    document.getElementById('scheduleForm').reset();
    document.getElementById('scheduleId').value = '';
    document.getElementById('schedulePeriodId').value = selectedPeriod.id;

    // Load subjects
    await loadSubjectsForExam();

    modal.classList.remove('hidden');
}

// ====== Load Subjects for Exam ======
async function loadSubjectsForExam() {
    try {
        const res = await fetch(`${API_URL}/subjects.php`);
        const data = await res.json();
        if (data.success) {
            const select = document.getElementById('scheduleSubject');
            select.innerHTML = '<option value="">-- Chọn môn --</option>' +
                data.data.map(s => `<option value="${s.id}">${s.subject_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
    }
}

// ====== Check Exam Conflict ======
async function checkExamConflict() {
    const periodId = document.getElementById('schedulePeriodId').value;
    const examDate = document.getElementById('scheduleDate').value;
    const startTime = document.getElementById('scheduleStartTime').value;
    const gradeLevel = document.getElementById('scheduleGrade').value;
    const scheduleId = document.getElementById('scheduleId').value;

    if (!periodId || !examDate || !startTime || !gradeLevel) return;

    try {
        let url = `${API_URL}/exam-schedule.php?action=check_conflict&period_id=${periodId}&exam_date=${examDate}&start_time=${startTime}&grade_level=${gradeLevel}`;
        if (scheduleId) url += `&exclude_id=${scheduleId}`;

        const res = await fetch(url);
        const data = await res.json();

        const warning = document.getElementById('conflictWarning');
        if (data.has_conflict) {
            const conflictInfo = data.conflicts.map(c => `Khối ${c.grade_level}: ${c.subject_name}`).join(', ');
            warning.textContent = `⚠️ Trùng giờ với: ${conflictInfo}`;
            warning.classList.remove('hidden');
        } else {
            warning.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error checking conflict:', error);
    }
}

// ====== Save Exam Schedule ======
async function saveExamSchedule() {
    const scheduleId = document.getElementById('scheduleId').value;
    const data = {
        action: scheduleId ? 'update_schedule' : 'create_schedule',
        id: scheduleId || undefined,
        exam_period_id: document.getElementById('schedulePeriodId').value,
        grade_level: document.getElementById('scheduleGrade').value,
        subject_id: document.getElementById('scheduleSubject').value,
        exam_date: document.getElementById('scheduleDate').value,
        start_time: document.getElementById('scheduleStartTime').value,
        end_time: document.getElementById('scheduleEndTime').value,
        exam_type: document.getElementById('scheduleType').value,
        notes: document.getElementById('scheduleNotes').value
    };

    try {
        const res = await fetch(`${API_URL}/exam-schedule.php`, {
            method: scheduleId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            showToast(result.message, 'success');
            closeModal('examScheduleModal');
            loadExamSchedules(selectedPeriod.id);
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Lỗi lưu lịch thi', 'error');
    }
}

// ====== Show Exam Rooms ======
async function showExamRooms(scheduleId, gradeLevel) {
    selectedSchedule = examSchedules.find(s => s.id === scheduleId);

    try {
        const res = await fetch(`${API_URL}/exam-schedule.php?action=rooms&schedule_id=${scheduleId}`);
        const data = await res.json();

        const modal = document.getElementById('examRoomsModal');
        document.getElementById('examRoomsModalTitle').textContent = `Phòng thi: ${selectedSchedule?.subject_name || ''} - Khối ${gradeLevel}`;

        const container = document.getElementById('examRoomsList');

        if (data.data.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6">
                    <p class="text-slate-500 mb-4">Chưa có phòng thi nào được phân công</p>
                    <button onclick="autoAssignRooms(${scheduleId}, ${gradeLevel})" class="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                        <i class="lucide lucide-wand-2 w-4 h-4 inline mr-1" style="stroke-width:1.5;"></i>
                        Tự động phân công
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="mb-4 flex justify-end">
                    <button onclick="autoAssignRooms(${scheduleId}, ${gradeLevel})" class="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600">
                        <i class="lucide lucide-refresh-cw w-4 h-4 inline mr-1" style="stroke-width:1.5;"></i>
                        Phân công lại
                    </button>
                </div>
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-slate-50">
                            <th class="px-3 py-2 text-left">Phòng</th>
                            <th class="px-3 py-2 text-left">Lớp</th>
                            <th class="px-3 py-2 text-left">Giáo viên gác thi</th>
                            <th class="px-3 py-2 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.data.map(room => `
                            <tr class="border-b border-slate-100">
                                <td class="px-3 py-2 font-medium">${room.room_name}</td>
                                <td class="px-3 py-2">${room.class_name}</td>
                                <td class="px-3 py-2">${room.proctors || '<span class="text-red-500">Chưa phân công</span>'}</td>
                                <td class="px-3 py-2 text-center">
                                    <button onclick="editRoomProctors(${room.id})" class="text-sky-500 hover:text-sky-700">
                                        <i class="lucide lucide-users w-4 h-4" style="stroke-width:1.5;"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        modal.classList.remove('hidden');
    } catch (error) {
        showToast('Lỗi tải danh sách phòng thi', 'error');
    }
}

// ====== Auto Assign Rooms ======
async function autoAssignRooms(scheduleId, gradeLevel) {
    UI.modal.confirm({
        title: 'Tự Động Phân Công',
        message: 'Hệ thống sẽ tự động phân công phòng thi và giáo viên gác thi cho tất cả lớp trong khối. Tiếp tục?',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API_URL}/exam-schedule.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'auto_assign_rooms',
                        schedule_id: scheduleId,
                        grade_level: gradeLevel
                    })
                });
                const data = await res.json();
                if (data.success) {
                    UI.toast.success(data.message);
                    showExamRooms(scheduleId, gradeLevel);
                } else {
                    UI.toast.error(data.error);
                }
            } catch (error) {
                UI.toast.error('Lỗi phân công tự động');
            }
        }
    });
}

// ====== Publish Period ======
async function publishPeriod(periodId) {
    UI.modal.confirm({
        title: 'Công Bố Lịch Thi',
        message: 'Bạn có chắc muốn công bố kỳ thi này? Học sinh và giáo viên sẽ có thể xem lịch thi ngay lập tức.',
        confirmText: 'Công Bố Ngay',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API_URL}/exam-schedule.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update_period_status',
                        period_id: periodId,
                        status: 'published'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    UI.toast.success('Đã công bố lịch thi');
                    loadExamPeriods();
                }
            } catch (error) {
                UI.toast.error('Lỗi công bố lịch thi');
            }
        }
    });
}

// ====== Complete Period ======
async function completePeriod(periodId) {
    UI.modal.confirm({
        title: 'Hoàn Thành Kỳ Thi',
        message: 'Xác nhận kỳ thi này đã hoàn thành? Trạng thái sẽ được đánh dấu là đã kết thúc.',
        confirmText: 'Xác Nhận Hoàn Thành',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API_URL}/exam-schedule.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'update_period_status',
                        period_id: periodId,
                        status: 'completed'
                    })
                });
                const data = await res.json();
                if (data.success) {
                    UI.toast.success('Kỳ thi đã được đánh dấu hoàn thành');
                    loadExamPeriods();
                }
            } catch (error) {
                UI.toast.error('Lỗi cập nhật trạng thái');
            }
        }
    });
}

// ====== Delete Exam Period ======
async function deleteExamPeriod(periodId) {
    UI.modal.confirm({
        title: 'Xóa Kỳ Thi',
        message: 'Xóa kỳ thi này? Tất cả lịch thi và phân công liên quan sẽ bị xóa vĩnh viễn.',
        type: 'danger',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API_URL}/exam-schedule.php?type=period&id=${periodId}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.success) {
                    UI.toast.success(data.message);
                    loadExamPeriods();
                    document.getElementById('examScheduleSection').classList.add('hidden');
                }
            } catch (error) {
                UI.toast.error('Lỗi xóa kỳ thi');
            }
        }
    });
}

// ====== Delete Exam Schedule ======
async function deleteExamSchedule(scheduleId) {
    UI.modal.confirm({
        title: 'Xóa Môn Thi',
        message: 'Bạn có chắc chắn muốn xóa môn thi này khỏi lịch thi?',
        type: 'danger',
        onConfirm: async () => {
            try {
                const res = await fetch(`${API_URL}/exam-schedule.php?type=schedule&id=${scheduleId}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (data.success) {
                    UI.toast.success(data.message);
                    loadExamSchedules(selectedPeriod.id);
                }
            } catch (error) {
                UI.toast.error('Lỗi xóa lịch thi');
            }
        }
    });
}

// ====== Helper Functions ======
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.add('hidden');
}

// ====== Init Exam Schedule Events ======
function initExamScheduleEvents() {
    // Check conflict when date/time/grade changes
    document.getElementById('scheduleDate')?.addEventListener('change', checkExamConflict);
    document.getElementById('scheduleStartTime')?.addEventListener('change', checkExamConflict);
    document.getElementById('scheduleGrade')?.addEventListener('change', checkExamConflict);
}
