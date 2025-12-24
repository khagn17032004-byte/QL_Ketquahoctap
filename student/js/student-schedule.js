// ========================================
// Student Schedule Module
// ========================================

// Load schedule
async function loadSchedule() {
    const studentId = State.currentUser.student_id;
    if (!studentId) return;
    
    const container = document.getElementById('scheduleContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="p-8 text-center text-slate-500">
            <div class="flex items-center justify-center gap-2">
                <div class="spinner"></div>
                <span>Đang tải thời khóa biểu...</span>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/schedule.php?student_id=${studentId}`);
        const result = await response.json();
        
        if (result.success) {
            renderSchedule(result.data);
        } else {
            container.innerHTML = `<div class="p-8 text-center text-red-400">${result.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading schedule:', error);
        container.innerHTML = `<div class="p-8 text-center text-red-400">Lỗi tải dữ liệu</div>`;
    }
}

// Render schedule
function renderSchedule(data) {
    const container = document.getElementById('scheduleContent');
    if (!container) return;
    
    const { class: classInfo, schedule, periods } = data;
    
    const days = [
        { id: 2, name: 'Thứ 2' },
        { id: 3, name: 'Thứ 3' },
        { id: 4, name: 'Thứ 4' },
        { id: 5, name: 'Thứ 5' },
        { id: 6, name: 'Thứ 6' },
        { id: 7, name: 'Thứ 7' }
    ];
    
    // Get current day for highlighting
    const today = new Date().getDay();
    const todayId = today === 0 ? 8 : today + 1; // Convert JS day to our format
    
    // Subject colors
    const subjectColors = {
        'Toán': 'bg-blue-100 text-blue-700 border-blue-200',
        'Ngữ văn': 'bg-rose-100 text-rose-700 border-rose-200',
        'Tiếng Anh': 'bg-purple-100 text-purple-700 border-purple-200',
        'Vật lý': 'bg-amber-100 text-amber-700 border-amber-200',
        'Hóa học': 'bg-emerald-100 text-emerald-700 border-emerald-200',
        'Sinh học': 'bg-green-100 text-green-700 border-green-200',
        'Lịch sử': 'bg-orange-100 text-orange-700 border-orange-200',
        'Địa lý': 'bg-cyan-100 text-cyan-700 border-cyan-200',
        'GDCD': 'bg-pink-100 text-pink-700 border-pink-200',
        'Tin học': 'bg-indigo-100 text-indigo-700 border-indigo-200',
        'Thể dục': 'bg-lime-100 text-lime-700 border-lime-200',
        'Công nghệ': 'bg-slate-100 text-slate-700 border-slate-200',
        'Quốc phòng': 'bg-red-100 text-red-700 border-red-200'
    };
    
    const getSubjectColor = (subjectName) => {
        return subjectColors[subjectName] || 'bg-slate-100 text-slate-600 border-slate-200';
    };
    
    container.innerHTML = `
        <!-- Class Header -->
        <div class="rounded-xl border border-slate-200 bg-white/80 p-4 mb-6">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                        <i class="lucide lucide-calendar text-white text-xl" style="stroke-width:1.5;"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-slate-900">Thời Khóa Biểu - Lớp ${classInfo.name}</h3>
                        <p class="text-sm text-slate-500">Học kỳ 1 • Năm học 2024-2025</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="exportScheduleExcel()" class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm transition">
                        <i class="lucide lucide-file-spreadsheet" style="stroke-width:1.5;"></i>
                        Xuất Excel
                    </button>
                    <button onclick="printSchedule()" class="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm transition">
                        <i class="lucide lucide-printer" style="stroke-width:1.5;"></i>
                        In TKB
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Schedule Table -->
        <div class="rounded-2xl border border-slate-200 bg-white/80 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full min-w-[800px]">
                    <thead class="bg-slate-50/80">
                        <tr>
                            <th class="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-20">Tiết</th>
                            <th class="text-center px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-16">Giờ</th>
                            ${days.map(d => `
                                <th class="text-center px-3 py-3 text-xs font-semibold uppercase ${d.id === todayId ? 'text-sky-600 bg-sky-50' : 'text-slate-500'}">
                                    ${d.name}
                                    ${d.id === todayId ? '<span class="block text-[10px] text-sky-400">(Hôm nay)</span>' : ''}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200">
                        ${renderPeriodRows(schedule, periods, days, todayId, getSubjectColor)}
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Legend -->
        <div class="mt-6 rounded-xl border border-slate-200 bg-white/80 p-4">
            <h4 class="text-sm font-medium text-slate-700 mb-3">Chú thích màu môn học:</h4>
            <div class="flex flex-wrap gap-2">
                ${Object.entries(subjectColors).map(([subject, color]) => `
                    <span class="inline-flex items-center px-2 py-1 rounded text-xs ${color} border">${subject}</span>
                `).join('')}
            </div>
        </div>
    `;
}

// Render period rows
function renderPeriodRows(schedule, periods, days, todayId, getSubjectColor) {
    let html = '';
    
    // Morning periods (1-5)
    for (let period = 1; period <= 5; period++) {
        const periodInfo = periods[period] || {};
        html += `
            <tr class="hover:bg-slate-50 transition">
                <td class="text-center px-3 py-3 font-medium text-slate-700">${period}</td>
                <td class="text-center px-3 py-2 text-xs text-slate-500">
                    ${periodInfo.start || ''}<br>${periodInfo.end || ''}
                </td>
                ${days.map(d => {
                    const cell = schedule[d.id]?.[period];
                    const isToday = d.id === todayId;
                    
                    if (cell && cell.subject) {
                        return `
                            <td class="text-center px-2 py-2 ${isToday ? 'bg-sky-50/50' : ''}">
                                <div class="inline-block px-3 py-2 rounded-lg border ${getSubjectColor(cell.subject)} text-sm font-medium min-w-[80px]">
                                    ${cell.subject}
                                    ${cell.room ? `<div class="text-[10px] opacity-70">P.${cell.room}</div>` : ''}
                                </div>
                            </td>
                        `;
                    }
                    return `<td class="text-center px-2 py-2 text-slate-400 ${isToday ? 'bg-sky-50/50' : ''}">-</td>`;
                }).join('')}
            </tr>
        `;
        
        // Add break after period 2
        if (period === 2) {
            html += `
                <tr class="bg-slate-100">
                    <td colspan="8" class="text-center py-1 text-xs text-slate-500 italic">Ra chơi (15 phút)</td>
                </tr>
            `;
        }
    }
    
    // Lunch break
    html += `
        <tr class="bg-amber-50">
            <td colspan="8" class="text-center py-2 text-sm text-amber-600 font-medium">
                <i class="lucide lucide-utensils inline mr-1" style="stroke-width:1.5;"></i>
                Nghỉ trưa (11:15 - 13:30)
            </td>
        </tr>
    `;
    
    // Afternoon periods (6-10) - if exists
    const hasAfternoon = Object.values(schedule).some(day => 
        Object.keys(day || {}).some(p => parseInt(p) >= 6)
    );
    
    if (hasAfternoon) {
        for (let period = 6; period <= 10; period++) {
            const periodInfo = periods[period] || {};
            html += `
                <tr class="hover:bg-slate-50 transition">
                    <td class="text-center px-3 py-3 font-medium text-slate-700">${period}</td>
                    <td class="text-center px-3 py-2 text-xs text-slate-500">
                        ${periodInfo.start || ''}<br>${periodInfo.end || ''}
                    </td>
                    ${days.map(d => {
                        const cell = schedule[d.id]?.[period];
                        const isToday = d.id === todayId;
                        
                        if (cell && cell.subject) {
                            return `
                                <td class="text-center px-2 py-2 ${isToday ? 'bg-sky-50/50' : ''}">
                                    <div class="inline-block px-3 py-2 rounded-lg border ${getSubjectColor(cell.subject)} text-sm font-medium min-w-[80px]">
                                        ${cell.subject}
                                    </div>
                                </td>
                            `;
                        }
                        return `<td class="text-center px-2 py-2 text-slate-400 ${isToday ? 'bg-sky-50/50' : ''}">-</td>`;
                    }).join('')}
                </tr>
            `;
        }
    }
    
    return html;
}

// Print schedule
function printSchedule() {
    window.print();
}

// Export schedule to Excel
function exportScheduleExcel() {
    const studentId = State.currentUser.student_id;
    if (!studentId) {
        showToast('Không tìm thấy thông tin học sinh', 'error');
        return;
    }
    
    // Get schedule table data
    const table = document.querySelector('#scheduleContent table');
    if (!table) {
        showToast('Không tìm thấy thời khóa biểu', 'error');
        return;
    }
    
    // Create workbook content
    let csv = '\uFEFF'; // BOM for UTF-8
    const className = document.querySelector('#scheduleContent h3')?.textContent || 'Thời Khóa Biểu';
    csv += className + '\n\n';
    
    // Header row
    const headers = ['Tiết', 'Giờ', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    csv += headers.join(',') + '\n';
    
    // Data rows
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 8) {
            const rowData = [];
            cells.forEach((cell, idx) => {
                let text = cell.textContent.trim().replace(/\s+/g, ' ');
                // Escape quotes and wrap in quotes if contains comma
                if (text.includes(',') || text.includes('"')) {
                    text = '"' + text.replace(/"/g, '""') + '"';
                }
                rowData.push(text);
            });
            csv += rowData.join(',') + '\n';
        } else if (cells.length === 1) {
            // Break row
            csv += cells[0].textContent.trim() + '\n';
        }
    });
    
    // Download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ThoiKhoaBieu_${State.studentInfo?.class_name || 'Lop'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Đã xuất thời khóa biểu!', 'success');
}

function initScheduleEvents() {
    document.getElementById('loadScheduleBtn')?.addEventListener('click', loadSchedule);
}
