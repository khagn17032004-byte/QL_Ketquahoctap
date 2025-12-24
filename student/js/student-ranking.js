// ========================================
// Student Class Ranking Module
// ========================================

// Load class ranking
async function loadClassRanking() {
    const studentId = State.currentUser.student_id;
    if (!studentId) return;
    
    const container = document.getElementById('rankingContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="p-8 text-center text-slate-500">
            <div class="flex items-center justify-center gap-2">
                <div class="spinner"></div>
                <span>Đang tải xếp hạng...</span>
            </div>
        </div>
    `;
    
    try {
        const response = await fetch(`${API_URL}/class-ranking.php?student_id=${studentId}`);
        const result = await response.json();
        
        if (result.success) {
            renderClassRanking(result.data);
        } else {
            container.innerHTML = `<div class="p-8 text-center text-red-400">${result.message}</div>`;
        }
    } catch (error) {
        console.error('Error loading ranking:', error);
        container.innerHTML = `<div class="p-8 text-center text-red-400">Lỗi tải dữ liệu</div>`;
    }
}

// Render class ranking
function renderClassRanking(data) {
    const container = document.getElementById('rankingContent');
    if (!container) return;
    
    const { student, total_students, rankings, class_rankings } = data;
    
    // Determine medal color for ranking
    const getMedalClass = (rank) => {
        if (rank === 1) return 'bg-amber-400 text-amber-900';
        if (rank === 2) return 'bg-slate-300 text-slate-700';
        if (rank === 3) return 'bg-orange-400 text-orange-900';
        if (rank <= 10) return 'bg-sky-400 text-sky-900';
        return 'bg-slate-200 text-slate-600';
    };
    
    container.innerHTML = `
        <!-- Student Ranking Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <!-- HK1 Ranking -->
            <div class="rounded-xl border border-slate-200 bg-white/80 p-5 text-center">
                <div class="text-slate-500 text-sm mb-2">Xếp hạng HK1</div>
                <div class="flex items-center justify-center gap-2 mb-2">
                    <span class="inline-flex items-center justify-center h-12 w-12 rounded-full ${getMedalClass(rankings.hk1.rank)} text-xl font-bold">
                        ${rankings.hk1.rank || '-'}
                    </span>
                    <span class="text-slate-400">/ ${total_students}</span>
                </div>
                <div class="text-sm text-slate-600">
                    ĐTB: <span class="font-semibold text-sky-600">${rankings.hk1.avg_score || '-'}</span>
                </div>
            </div>
            
            <!-- HK2 Ranking -->
            <div class="rounded-xl border border-slate-200 bg-white/80 p-5 text-center">
                <div class="text-slate-500 text-sm mb-2">Xếp hạng HK2</div>
                <div class="flex items-center justify-center gap-2 mb-2">
                    <span class="inline-flex items-center justify-center h-12 w-12 rounded-full ${getMedalClass(rankings.hk2.rank)} text-xl font-bold">
                        ${rankings.hk2.rank || '-'}
                    </span>
                    <span class="text-slate-400">/ ${total_students}</span>
                </div>
                <div class="text-sm text-slate-600">
                    ĐTB: <span class="font-semibold text-sky-600">${rankings.hk2.avg_score || '-'}</span>
                </div>
            </div>
            
            <!-- Annual Ranking -->
            <div class="rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-white p-5 text-center">
                <div class="text-amber-600 text-sm font-medium mb-2">Xếp hạng Cả Năm</div>
                <div class="flex items-center justify-center gap-2 mb-2">
                    <span class="inline-flex items-center justify-center h-14 w-14 rounded-full ${getMedalClass(rankings.annual.rank)} text-2xl font-bold shadow-lg">
                        ${rankings.annual.rank || '-'}
                    </span>
                    <span class="text-slate-400">/ ${total_students}</span>
                </div>
                <div class="text-sm text-slate-600">
                    ĐTB: <span class="font-bold text-amber-600 text-lg">${rankings.annual.avg_score || '-'}</span>
                </div>
            </div>
        </div>
        
        <!-- Top 10 Rankings Tabs -->
        <div class="rounded-2xl border border-slate-200 bg-white/80 overflow-hidden">
            <div class="flex border-b border-slate-200">
                <button class="ranking-tab-btn active flex-1 px-4 py-3 text-sm font-medium text-sky-600 border-b-2 border-sky-500 bg-sky-50" data-period="hk1">
                    Top 10 - HK1
                </button>
                <button class="ranking-tab-btn flex-1 px-4 py-3 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-700" data-period="hk2">
                    Top 10 - HK2
                </button>
                <button class="ranking-tab-btn flex-1 px-4 py-3 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-700" data-period="annual">
                    Top 10 - Cả Năm
                </button>
            </div>
            
            <div id="rankingTableContainer">
                ${renderRankingTable(class_rankings.hk1, student.id)}
            </div>
        </div>
    `;
    
    // Store data for tab switching
    State.classRankings = class_rankings;
    State.currentStudentId = student.id;
    
    // Init tab events
    document.querySelectorAll('.ranking-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ranking-tab-btn').forEach(b => {
                b.classList.remove('active', 'text-sky-600', 'border-sky-500', 'bg-sky-50');
                b.classList.add('text-slate-500', 'border-transparent');
            });
            btn.classList.add('active', 'text-sky-600', 'border-sky-500', 'bg-sky-50');
            btn.classList.remove('text-slate-500', 'border-transparent');
            
            const period = btn.dataset.period;
            document.getElementById('rankingTableContainer').innerHTML = 
                renderRankingTable(State.classRankings[period], State.currentStudentId);
        });
    });
}

// Render ranking table
function renderRankingTable(rankings, currentStudentId) {
    if (!rankings || rankings.length === 0) {
        return `<div class="p-8 text-center text-slate-500">Chưa có dữ liệu xếp hạng</div>`;
    }
    
    return `
        <table class="w-full">
            <thead class="bg-slate-50/80">
                <tr>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-16">Hạng</th>
                    <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Họ tên</th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Mã HS</th>
                    <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">ĐTB</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
                ${rankings.map((r, idx) => {
                    const rank = idx + 1;
                    const isMe = r.student_id == currentStudentId;
                    const medalIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
                    
                    return `
                        <tr class="${isMe ? 'bg-sky-50 font-semibold' : 'hover:bg-slate-50'} transition">
                            <td class="text-center px-4 py-3 text-lg">${medalIcon}</td>
                            <td class="px-4 py-3 ${isMe ? 'text-sky-600' : 'text-slate-800'}">
                                ${r.full_name}
                                ${isMe ? '<span class="ml-2 text-xs bg-sky-500 text-white px-2 py-0.5 rounded-full">Bạn</span>' : ''}
                            </td>
                            <td class="text-center px-4 py-3 text-slate-500 font-mono text-sm">${r.student_code || '-'}</td>
                            <td class="text-center px-4 py-3">
                                <span class="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold ${
                                    parseFloat(r.avg_score) >= 8 ? 'bg-emerald-100 text-emerald-700' :
                                    parseFloat(r.avg_score) >= 6.5 ? 'bg-sky-100 text-sky-700' :
                                    parseFloat(r.avg_score) >= 5 ? 'bg-amber-100 text-amber-700' :
                                    'bg-red-100 text-red-700'
                                }">
                                    ${parseFloat(r.avg_score).toFixed(2)}
                                </span>
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function initRankingEvents() {
    document.getElementById('loadRankingBtn')?.addEventListener('click', loadClassRanking);
}
