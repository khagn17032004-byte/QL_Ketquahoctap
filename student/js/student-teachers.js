// ========================================
// Student Class Teachers Module
// ========================================

// Load class teachers
async function loadClassTeachers() {
    const studentId = State.currentUser.student_id;
    if (!studentId) return;
    
    const container = document.getElementById('teachersContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="p-8 text-center text-slate-500">
            <div class="flex items-center justify-center gap-2">
                <div class="spinner"></div>
                <span>Đang tải danh sách giáo viên...</span>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/class-teachers.php?student_id=${studentId}`);
        const result = await response.json();
        
        if (result.success) {
            renderClassTeachers(result.data);
        } else {
            container.innerHTML = `<div class="p-8 text-center text-red-400">${result.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading teachers:', error);
        container.innerHTML = `<div class="p-8 text-center text-red-400">Lỗi tải dữ liệu</div>`;
    }
}

// Render class teachers
function renderClassTeachers(data) {
    const container = document.getElementById('teachersContent');
    if (!container) return;
    
    const { class: classInfo, teachers } = data;
    
    // Separate homeroom teacher from subject teachers
    const homeroomTeacher = teachers.find(t => t.is_homeroom == 1);
    const subjectTeachers = teachers.filter(t => t.is_homeroom != 1);
    
    container.innerHTML = `
        <!-- Class Info Header -->
        <div class="rounded-xl border border-slate-200 bg-white/80 p-4 mb-6">
            <div class="flex items-center gap-4">
                <div class="h-12 w-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                    <i class="lucide lucide-school text-white text-xl" style="stroke-width:1.5;"></i>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-slate-900">Lớp ${classInfo.name}</h3>
                    <p class="text-sm text-slate-500">Khối ${classInfo.grade_level} • Năm học 2024-2025</p>
                </div>
            </div>
        </div>
        
        <!-- Homeroom Teacher Card -->
        ${homeroomTeacher ? `
        <div class="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-white p-6 mb-6">
            <div class="flex items-center gap-2 text-emerald-600 mb-4">
                <i class="lucide lucide-star" style="stroke-width:1.5;"></i>
                <span class="font-semibold">Giáo Viên Chủ Nhiệm</span>
            </div>
            <div class="flex items-center gap-4">
                <div class="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold">
                    ${getInitials(homeroomTeacher.full_name)}
                </div>
                <div class="flex-1">
                    <h4 class="text-xl font-semibold text-slate-900">${homeroomTeacher.full_name}</h4>
                    <div class="mt-2 space-y-1 text-sm">
                        ${homeroomTeacher.phone && homeroomTeacher.phone !== '-' ? `
                        <div class="flex items-center gap-2 text-slate-600">
                            <i class="lucide lucide-phone text-sm" style="stroke-width:1.5;"></i>
                            <span>${homeroomTeacher.phone}</span>
                        </div>
                        ` : ''}
                        ${homeroomTeacher.email && homeroomTeacher.email !== '-' ? `
                        <div class="flex items-center gap-2 text-slate-600">
                            <i class="lucide lucide-mail text-sm" style="stroke-width:1.5;"></i>
                            <span>${homeroomTeacher.email}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- Subject Teachers Grid -->
        <h3 class="text-lg font-semibold text-slate-900 mb-4">
            <i class="lucide lucide-users inline mr-2 text-sky-400" style="stroke-width:1.5;"></i>
            Giáo Viên Bộ Môn
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${subjectTeachers.map(teacher => `
                <div class="rounded-xl border border-slate-200 bg-white/80 p-4 hover:shadow-md transition">
                    <div class="flex items-start gap-3">
                        <div class="h-10 w-10 rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                            ${getInitials(teacher.full_name)}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-medium text-slate-900 truncate">${teacher.full_name}</p>
                            <p class="text-sm text-sky-600">${teacher.subject_name}</p>
                            ${teacher.phone && teacher.phone !== '-' ? `
                            <p class="text-xs text-slate-500 mt-1">
                                <i class="lucide lucide-phone inline text-xs" style="stroke-width:1.5;"></i>
                                ${teacher.phone}
                            </p>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        ${subjectTeachers.length === 0 ? `
        <div class="text-center py-8 text-slate-500">
            <i class="lucide lucide-users text-4xl mb-2 opacity-50" style="stroke-width:1;"></i>
            <p>Chưa có thông tin giáo viên bộ môn</p>
        </div>
        ` : ''}
    `;
}

// Get initials from name
function getInitials(name) {
    if (!name || name === 'Chưa cập nhật') return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
}

function initTeachersEvents() {
    document.getElementById('loadTeachersBtn')?.addEventListener('click', loadClassTeachers);
}
