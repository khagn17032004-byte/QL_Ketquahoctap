/**
 * Student Exam Schedule - Lịch thi của học sinh
 */

// ====== Load Student Exam Schedule ======
async function loadStudentExamSchedule() {
    const container = document.getElementById('studentExamScheduleContent');
    if (!container) return;

    // Use currentUser from student-init.js (global variable)
    const studentId = currentUser?.student_id;
    if (!studentId) {
        container.innerHTML = '<p class="text-center text-slate-500 py-4">Không tìm thấy thông tin học sinh</p>';
        return;
    }

    try {
        container.innerHTML = '<p class="text-center text-slate-500 py-4">Đang tải lịch thi...</p>';
        
        const res = await fetch(`${API_URL}/exam-schedule.php?action=student_schedule&student_id=${studentId}`);
        const data = await res.json();
        
        if (!data.success) {
            throw new Error(data.error);
        }

        if (data.data.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <i class="lucide lucide-calendar-off text-4xl text-slate-300 mb-2" style="stroke-width:1;"></i>
                    <p class="text-slate-500">Chưa có lịch thi nào được công bố</p>
                </div>
            `;
            return;
        }

        // Group by period
        const byPeriod = {};
        data.data.forEach(exam => {
            const key = exam.period_name;
            if (!byPeriod[key]) {
                byPeriod[key] = [];
            }
            byPeriod[key].push(exam);
        });

        let html = '';
        Object.keys(byPeriod).forEach(periodName => {
            const exams = byPeriod[periodName];
            
            html += `
                <div class="mb-6">
                    <div class="flex items-center gap-2 mb-4">
                        <div class="w-2 h-8 rounded-full bg-gradient-to-b from-sky-500 to-emerald-500"></div>
                        <h3 class="font-semibold text-lg text-slate-900">${periodName}</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="bg-slate-50">
                                    <th class="px-4 py-3 text-left font-semibold text-slate-600">Môn thi</th>
                                    <th class="px-4 py-3 text-left font-semibold text-slate-600">Ngày thi</th>
                                    <th class="px-4 py-3 text-left font-semibold text-slate-600">Giờ thi</th>
                                    <th class="px-4 py-3 text-left font-semibold text-slate-600">Phòng thi</th>
                                    <th class="px-4 py-3 text-left font-semibold text-slate-600">Giám thị</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            exams.forEach(exam => {
                const examDate = new Date(exam.exam_date);
                const dayName = examDate.toLocaleDateString('vi-VN', { weekday: 'long' });
                const formattedDate = examDate.toLocaleDateString('vi-VN');
                
                // Check if exam is upcoming
                const isUpcoming = examDate >= new Date(new Date().setHours(0,0,0,0));
                const rowClass = isUpcoming ? '' : 'opacity-60';
                
                html += `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 ${rowClass}">
                        <td class="px-4 py-3">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center text-white text-xs font-bold">
                                    ${exam.subject_name.charAt(0)}
                                </div>
                                <span class="font-medium text-slate-900">${exam.subject_name}</span>
                            </div>
                        </td>
                        <td class="px-4 py-3">
                            <div>
                                <p class="font-medium text-slate-900">${dayName}</p>
                                <p class="text-xs text-slate-500">${formattedDate}</p>
                            </div>
                        </td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 rounded-lg bg-sky-100 text-sky-700 font-medium">
                                ${formatTime(exam.start_time)} - ${formatTime(exam.end_time)}
                            </span>
                        </td>
                        <td class="px-4 py-3">
                            ${exam.room_name ? `<span class="font-medium text-slate-700">${exam.room_name}</span>` : '<span class="text-slate-400">Chưa xếp</span>'}
                        </td>
                        <td class="px-4 py-3 text-slate-600">
                            ${exam.proctors || '<span class="text-slate-400">Chưa phân công</span>'}
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table></div></div>`;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading exam schedule:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="lucide lucide-alert-circle text-4xl mb-2" style="stroke-width:1;"></i>
                <p>Lỗi tải lịch thi</p>
            </div>
        `;
    }
}

// ====== Export Student Exam Schedule ======
function exportStudentExamSchedule() {
    const content = document.getElementById('studentExamScheduleContent');
    if (!content) return;

    // Create printable version
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Lịch Thi - ${studentProfile?.full_name || 'Học sinh'}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                th { background: #f5f5f5; }
            </style>
        </head>
        <body>
            <h1>LỊCH THI</h1>
            <p style="text-align: center;">Học sinh: <strong>${studentProfile?.full_name || ''}</strong> - Lớp: <strong>${studentProfile?.class_name || ''}</strong></p>
            ${content.innerHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ====== Format Time Helper ======
function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
}
