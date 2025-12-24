/**
 * Teacher Exam Schedule - Lịch gác thi của giáo viên
 */

let currentTeacherScheduleData = [];

// ====== Load Teacher Exam Schedule ======
async function loadTeacherExamSchedule() {
    const container = document.getElementById('teacherExamScheduleContent');
    if (!container) return;

    // Use teacherInfo from teacher-init.js (global variable)
    if (!teacherInfo || !teacherInfo.id) {
        container.innerHTML = '<p class="text-center text-slate-500 py-4">Không tìm thấy thông tin giáo viên</p>';
        return;
    }

    try {
        container.innerHTML = '<p class="text-center text-slate-500 py-4">Đang tải lịch gác thi...</p>';

        const res = await fetch(`${API_URL}/exam-schedule.php?action=teacher_schedule&teacher_id=${teacherInfo.id}`);
        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        currentTeacherScheduleData = data.data;

        if (data.data.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="lucide lucide-calendar-off text-4xl text-slate-300 mb-2" style="stroke-width:1;"></i>
                    <p class="text-slate-500">Chưa có lịch gác thi nào được phân công</p>
                </div>
            `;
            return;
        }

        // Group by date
        const byDate = {};
        data.data.forEach(exam => {
            const dateKey = exam.exam_date;
            if (!byDate[dateKey]) {
                byDate[dateKey] = [];
            }
            byDate[dateKey].push(exam);
        });

        let html = '';
        Object.keys(byDate).sort().forEach(date => {
            const exams = byDate[date];
            const dateObj = new Date(date);
            const dayName = dateObj.toLocaleDateString('vi-VN', { weekday: 'long' });
            const formattedDate = dateObj.toLocaleDateString('vi-VN');

            html += `
                <div class="mb-6">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white font-bold">
                            ${dateObj.getDate()}
                        </div>
                        <div>
                            <p class="font-semibold text-slate-900">${dayName}</p>
                            <p class="text-sm text-slate-500">${formattedDate}</p>
                        </div>
                    </div>
                    <div class="space-y-2 ml-4 pl-4 border-l-2 border-purple-200">
            `;

            exams.forEach(exam => {
                const roleLabel = exam.proctor_role === 'main' ? 'Gác chính' : 'Gác phụ';
                const roleColor = exam.proctor_role === 'main' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600';

                html += `
                    <div class="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition">
                        <div class="flex items-start justify-between">
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="font-semibold text-slate-900">${exam.subject_name}</span>
                                    <span class="px-2 py-0.5 rounded-full text-xs font-medium ${roleColor}">${roleLabel}</span>
                                </div>
                                <p class="text-sm text-slate-500">${exam.period_name}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-lg font-bold text-purple-600">${formatTime(exam.start_time)} - ${formatTime(exam.end_time)}</p>
                            </div>
                        </div>
                        <div class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-sm">
                            <span class="flex items-center gap-1 text-slate-600">
                                <i class="lucide lucide-map-pin w-4 h-4" style="stroke-width:1.5;"></i>
                                ${exam.room_name}
                            </span>
                            <span class="flex items-center gap-1 text-slate-600">
                                <i class="lucide lucide-users w-4 h-4" style="stroke-width:1.5;"></i>
                                ${exam.class_name}
                            </span>
                            <span class="flex items-center gap-1 text-slate-600">
                                <i class="lucide lucide-graduation-cap w-4 h-4" style="stroke-width:1.5;"></i>
                                Khối ${exam.grade_level}
                            </span>
                        </div>
                    </div>
                `;
            });

            html += `</div></div>`;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading exam schedule:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="lucide lucide-alert-circle text-4xl mb-2" style="stroke-width:1;"></i>
                <p>Lỗi tải lịch gác thi</p>
            </div>
        `;
    }
}

// ====== Export Teacher Exam Schedule ======
function exportTeacherExamSchedule() {
    if (!currentTeacherScheduleData || currentTeacherScheduleData.length === 0) {
        showToast('Không có dữ liệu lịch gác thi để in', 'warning');
        return;
    }

    const printWindow = window.open('', '_blank');

    // Sort data by date and time
    const sortedData = [...currentTeacherScheduleData].sort((a, b) => {
        const dateA = new Date(`${a.exam_date} ${a.start_time}`);
        const dateB = new Date(`${b.exam_date} ${b.start_time}`);
        return dateA - dateB;
    });

    let tableRows = sortedData.map((exam, index) => {
        const dateObj = new Date(exam.exam_date);
        const formattedDate = dateObj.toLocaleDateString('vi-VN');
        const roleLabel = exam.proctor_role === 'main' ? 'Gác chính' : 'Gác phụ';

        return `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td style="text-align: center;">${formattedDate}</td>
                <td style="text-align: center; font-weight: bold;">${formatTime(exam.start_time)} - ${formatTime(exam.end_time)}</td>
                <td>${exam.subject_name}</td>
                <td style="text-align: center;">${exam.class_name} (Khối ${exam.grade_level})</td>
                <td style="text-align: center; font-weight: bold;">${exam.room_name}</td>
                <td style="text-align: center;">${roleLabel}</td>
            </tr>
        `;
    }).join('');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <title>Lịch Gác Thi - ${teacherInfo?.full_name || 'Giáo viên'}</title>
            <style>
                body { font-family: "Times New Roman", Times, serif; padding: 40px; color: #333; line-height: 1.6; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 24pt; text-transform: uppercase; }
                .header p { margin: 5px 0; font-size: 14pt; }
                
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid black; padding: 10px; font-size: 12pt; }
                th { background-color: #f2f2f2; text-transform: uppercase; font-weight: bold; }
                
                .footer { margin-top: 40px; display: flex; justify-content: flex-end; }
                .signature { text-align: center; width: 250px; }
                .signature p { margin: 5px 0; }
                
                @media print {
                    @page { margin: 1cm; }
                    body { padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>LỊCH GÁC THI</h1>
                <p>Giáo viên: <strong>${teacherInfo?.full_name || ''}</strong></p>
                <p>Mã GV: <strong>${teacherInfo?.teacher_code || ''}</strong></p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">STT</th>
                        <th style="width: 15%;">Ngày thi</th>
                        <th style="width: 20%;">Giờ thi</th>
                        <th style="width: 25%;">Môn thi</th>
                        <th style="width: 15%;">Lớp/Khối</th>
                        <th style="width: 10%;">Phòng</th>
                        <th style="width: 10%;">Vai trò</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div class="footer">
                <div class="signature">
                    <p>Ngày ...... tháng ...... năm 20...</p>
                    <p><strong>Người in lịch</strong></p>
                    <div style="height: 80px;"></div>
                    <p><strong>${teacherInfo?.full_name || ''}</strong></p>
                </div>
            </div>

            <script>
                window.onload = () => {
                    setTimeout(() => {
                        window.print();
                        // window.close(); // Uncomment if you want window to auto-close after print
                    }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ====== Format Time Helper ======
function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
}

// ====== Init Exam Schedule Events ======
function initTeacherExamScheduleEvents() {
    // Nothing special needed
}
