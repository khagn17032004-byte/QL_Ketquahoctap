/**
 * Teacher Quiz Module - Tạo câu hỏi trắc nghiệm bằng AI
 */

const TeacherQuiz = {
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    showingAnswers: false,
    
    /**
     * Tạo câu hỏi trắc nghiệm
     */
    async generateQuiz() {
        const subject = document.getElementById('quizSubject')?.value;
        const topic = document.getElementById('quizTopic')?.value?.trim();
        const gradeLevel = document.getElementById('quizGradeLevel')?.value || 10;
        const numQuestions = document.getElementById('quizNumQuestions')?.value || 5;
        const difficulty = document.getElementById('quizDifficulty')?.value || 'medium';
        
        if (!subject) {
            this.showError('Vui lòng chọn môn học');
            return;
        }
        
        // Hiển thị loading
        this.showLoading(true);
        
        try {
            const response = await fetch('../api/ai-quiz.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject,
                    topic,
                    grade_level: gradeLevel,
                    num_questions: numQuestions,
                    difficulty
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.data?.questions) {
                this.questions = result.data.questions;
                this.currentQuestionIndex = 0;
                this.userAnswers = {};
                this.showingAnswers = false;
                this.renderQuiz();
                
                if (result.source === 'sample') {
                    this.showInfo('Đang sử dụng câu hỏi mẫu. Cấu hình API để có câu hỏi từ AI.');
                }
            } else {
                this.showError(result.message || 'Không thể tạo câu hỏi');
            }
        } catch (error) {
            console.error('Error generating quiz:', error);
            this.showError('Không thể kết nối đến server');
        } finally {
            this.showLoading(false);
        }
    },
    
    /**
     * Hiển thị loading
     */
    showLoading(show) {
        const btn = document.getElementById('generateQuizBtn');
        const loader = document.getElementById('quizLoading');
        
        if (btn) {
            btn.disabled = show;
            btn.innerHTML = show 
                ? '<i class="fas fa-spinner fa-spin mr-2"></i>Đang tạo...' 
                : '<i class="fas fa-magic mr-2"></i>Tạo câu hỏi';
        }
        
        if (loader) {
            loader.classList.toggle('hidden', !show);
        }
    },
    
    /**
     * Render quiz
     */
    renderQuiz() {
        const container = document.getElementById('quizContainer');
        if (!container || this.questions.length === 0) return;
        
        let html = `
            <div class="mb-4 flex items-center justify-between">
                <h3 class="text-lg font-bold text-gray-800">
                    <i class="fas fa-question-circle text-purple-500 mr-2"></i>
                    Bộ ${this.questions.length} câu hỏi trắc nghiệm
                </h3>
                <div class="flex gap-2">
                    <button onclick="TeacherQuiz.showAllAnswers()" 
                        class="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition">
                        <i class="fas fa-eye mr-1"></i>Xem đáp án
                    </button>
                    <button onclick="TeacherQuiz.printQuiz()" 
                        class="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition">
                        <i class="fas fa-print mr-1"></i>In
                    </button>
                </div>
            </div>
        `;
        
        this.questions.forEach((q, idx) => {
            const userAnswer = this.userAnswers[q.id];
            const isCorrect = userAnswer === q.correct;
            
            html += `
                <div class="bg-white border rounded-lg p-4 mb-4 question-card" data-question-id="${q.id}">
                    <div class="flex items-start gap-3 mb-3">
                        <span class="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold">
                            ${idx + 1}
                        </span>
                        <p class="text-gray-800 font-medium flex-1">${q.question}</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 ml-11">
            `;
            
            ['A', 'B', 'C', 'D'].forEach(opt => {
                const isSelected = userAnswer === opt;
                const isCorrectAnswer = q.correct === opt;
                let optClass = 'border-gray-200 hover:border-blue-300 hover:bg-blue-50';
                
                if (this.showingAnswers) {
                    if (isCorrectAnswer) {
                        optClass = 'border-green-500 bg-green-50';
                    } else if (isSelected && !isCorrect) {
                        optClass = 'border-red-500 bg-red-50';
                    }
                } else if (isSelected) {
                    optClass = 'border-blue-500 bg-blue-50';
                }
                
                html += `
                    <label class="flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition ${optClass} option-label"
                        onclick="TeacherQuiz.selectAnswer(${q.id}, '${opt}')">
                        <span class="w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-medium
                            ${isSelected ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-400 text-gray-600'}">
                            ${opt}
                        </span>
                        <span class="flex-1">${q.options[opt]}</span>
                        ${this.showingAnswers && isCorrectAnswer ? '<i class="fas fa-check text-green-500"></i>' : ''}
                    </label>
                `;
            });
            
            html += '</div>';
            
            // Hiển thị giải thích nếu đang xem đáp án
            if (this.showingAnswers && q.explanation) {
                html += `
                    <div class="mt-3 ml-11 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p class="text-sm text-yellow-800">
                            <i class="fas fa-lightbulb mr-1"></i>
                            <strong>Giải thích:</strong> ${q.explanation}
                        </p>
                    </div>
                `;
            }
            
            html += '</div>';
        });
        
        // Nút kiểm tra kết quả
        if (!this.showingAnswers) {
            html += `
                <div class="flex justify-center mt-6">
                    <button onclick="TeacherQuiz.checkAnswers()" 
                        class="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition shadow-lg">
                        <i class="fas fa-check-circle mr-2"></i>Kiểm tra kết quả
                    </button>
                </div>
            `;
        } else {
            const correctCount = this.getCorrectCount();
            html += `
                <div class="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-4 mt-6">
                    <div class="text-center">
                        <div class="text-4xl font-bold mb-2">${correctCount}/${this.questions.length}</div>
                        <p>Số câu trả lời đúng</p>
                    </div>
                </div>
                <div class="flex justify-center mt-4">
                    <button onclick="TeacherQuiz.resetQuiz()" 
                        class="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition">
                        <i class="fas fa-redo mr-2"></i>Làm lại
                    </button>
                </div>
            `;
        }
        
        container.innerHTML = html;
    },
    
    /**
     * Chọn đáp án
     */
    selectAnswer(questionId, answer) {
        if (this.showingAnswers) return;
        this.userAnswers[questionId] = answer;
        this.renderQuiz();
    },
    
    /**
     * Kiểm tra kết quả
     */
    checkAnswers() {
        if (Object.keys(this.userAnswers).length === 0) {
            this.showError('Vui lòng trả lời ít nhất 1 câu hỏi');
            return;
        }
        this.showingAnswers = true;
        this.renderQuiz();
    },
    
    /**
     * Xem tất cả đáp án
     */
    showAllAnswers() {
        this.showingAnswers = true;
        this.renderQuiz();
    },
    
    /**
     * Đếm số câu đúng
     */
    getCorrectCount() {
        let count = 0;
        this.questions.forEach(q => {
            if (this.userAnswers[q.id] === q.correct) {
                count++;
            }
        });
        return count;
    },
    
    /**
     * Làm lại quiz
     */
    resetQuiz() {
        this.userAnswers = {};
        this.showingAnswers = false;
        this.renderQuiz();
    },
    
    /**
     * In quiz
     */
    printQuiz() {
        const printContent = this.generatePrintContent();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    },
    
    /**
     * Tạo nội dung in
     */
    generatePrintContent() {
        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Đề trắc nghiệm</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; }
                    .question { margin-bottom: 20px; }
                    .question-text { font-weight: bold; margin-bottom: 10px; }
                    .options { margin-left: 20px; }
                    .option { margin: 5px 0; }
                    .answer-key { page-break-before: always; }
                    .answer-key h2 { text-align: center; }
                    .answer { display: inline-block; width: 100px; margin: 5px; }
                </style>
            </head>
            <body>
                <h1>ĐỀ KIỂM TRA TRẮC NGHIỆM</h1>
                <p style="text-align: center;">Thời gian: ... phút</p>
                <hr>
        `;
        
        this.questions.forEach((q, idx) => {
            html += `
                <div class="question">
                    <p class="question-text">Câu ${idx + 1}: ${q.question}</p>
                    <div class="options">
                        <p class="option">A. ${q.options.A}</p>
                        <p class="option">B. ${q.options.B}</p>
                        <p class="option">C. ${q.options.C}</p>
                        <p class="option">D. ${q.options.D}</p>
                    </div>
                </div>
            `;
        });
        
        html += `
                <div class="answer-key">
                    <h2>ĐÁP ÁN</h2>
                    <div style="text-align: center;">
        `;
        
        this.questions.forEach((q, idx) => {
            html += `<span class="answer">Câu ${idx + 1}: <strong>${q.correct}</strong></span>`;
        });
        
        html += `
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return html;
    },
    
    /**
     * Hiển thị thông báo lỗi
     */
    showError(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert(message);
        }
    },
    
    /**
     * Hiển thị thông báo info
     */
    showInfo(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'info');
        } else {
            console.info(message);
        }
    },
    
    /**
     * Khởi tạo module
     */
    init() {
        // Bind generate button
        const generateBtn = document.getElementById('generateQuizBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateQuiz());
        }
    }
};

// Export
window.TeacherQuiz = TeacherQuiz;
