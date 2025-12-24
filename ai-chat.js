/**
 * AI Chat Widget Component
 * Hỗ trợ học sinh, giáo viên và admin
 * Giao diện đẹp với dark theme
 */

class AIChatWidget {
  constructor(options = {}) {
    this.role = options.role || 'student';
    this.userName = options.userName || 'Người dùng';
    this.userCode = options.userCode || '';
    this.userContext = options.context || {};
    this.isOpen = false;
    this.isLoading = false;
    this.messages = [];
    
    this.init();
  }

  init() {
    this.createStyles();
    this.createWidget();
    this.bindEvents();
    this.addWelcomeMessage();
  }

  createStyles() {
    if (document.getElementById('ai-chat-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'ai-chat-styles';
    styles.textContent = `
      .ai-chat-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .ai-chat-toggle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 20px rgba(14, 165, 233, 0.4);
        transition: all 0.3s ease;
        position: relative;
      }

      .ai-chat-widget.role-admin .ai-chat-toggle {
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
      }

      .ai-chat-widget.role-teacher .ai-chat-toggle {
        background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
      }

      .ai-chat-widget.role-student .ai-chat-toggle {
        background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
        box-shadow: 0 4px 20px rgba(14, 165, 233, 0.4);
      }

      .ai-chat-toggle:hover {
        transform: scale(1.1);
      }

      .ai-chat-toggle svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      .ai-chat-toggle .close-icon {
        display: none;
      }

      .ai-chat-widget.open .ai-chat-toggle .chat-icon {
        display: none;
      }

      .ai-chat-widget.open .ai-chat-toggle .close-icon {
        display: block;
      }

      .ai-chat-pulse {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: inherit;
        animation: pulse 2s ease-out infinite;
        z-index: -1;
      }

      @keyframes pulse {
        0% { transform: scale(1); opacity: 0.5; }
        100% { transform: scale(1.5); opacity: 0; }
      }

      .ai-chat-box {
        position: absolute;
        bottom: 75px;
        right: 0;
        width: 400px;
        max-width: calc(100vw - 48px);
        height: 560px;
        max-height: calc(100vh - 120px);
        background: #ffffff;
        border-radius: 20px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        opacity: 0;
        visibility: hidden;
        transform: translateY(20px) scale(0.95);
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .ai-chat-widget.open .ai-chat-box {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
      }

      .ai-chat-header {
        padding: 16px 20px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .ai-chat-avatar {
        width: 46px;
        height: 46px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }

      .ai-chat-widget.role-admin .ai-chat-avatar {
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
      }

      .ai-chat-widget.role-teacher .ai-chat-avatar {
        background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
      }

      .ai-chat-widget.role-student .ai-chat-avatar {
        background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
      }

      .ai-chat-info {
        flex: 1;
      }

      .ai-chat-info h3 {
        color: #1e293b;
        font-size: 16px;
        font-weight: 600;
        margin: 0;
      }

      .ai-chat-info p {
        color: #10b981;
        font-size: 13px;
        margin: 3px 0 0 0;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ai-chat-info p::before {
        content: '';
        width: 8px;
        height: 8px;
        background: #10b981;
        border-radius: 50%;
        animation: blink 1.5s infinite;
      }

      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      .ai-chat-close-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .ai-chat-close-btn:hover {
        background: #e2e8f0;
      }

      .ai-chat-close-btn svg {
        width: 16px;
        height: 16px;
        fill: #64748b;
      }

      .ai-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .ai-chat-messages::-webkit-scrollbar {
        width: 6px;
      }

      .ai-chat-messages::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 3px;
      }

      .ai-chat-messages::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }

      .ai-chat-message {
        display: flex;
        gap: 10px;
        animation: messageIn 0.3s ease;
      }

      @keyframes messageIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .ai-chat-message.user {
        flex-direction: row-reverse;
      }

      .ai-chat-message-avatar {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }

      .ai-chat-message.bot .ai-chat-message-avatar {
        background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%);
      }

      .ai-chat-message.user .ai-chat-message-avatar {
        background: #3b82f6;
      }

      .ai-chat-message-content {
        max-width: 78%;
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.6;
      }

      .ai-chat-message.bot .ai-chat-message-content {
        background: #f1f5f9;
        color: #475569;
        border-bottom-left-radius: 4px;
      }

      .ai-chat-message.user .ai-chat-message-content {
        background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
        color: white;
        border-bottom-right-radius: 4px;
      }

      .ai-chat-widget.role-admin .ai-chat-message.user .ai-chat-message-content {
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
      }

      .ai-chat-widget.role-teacher .ai-chat-message.user .ai-chat-message-content {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      }

      .ai-chat-message-content p {
        margin: 0 0 8px 0;
      }

      .ai-chat-message-content p:last-child {
        margin-bottom: 0;
      }

      .ai-chat-message-content strong {
        color: #0284c7;
        font-weight: 600;
      }

      .ai-chat-message-content ul,
      .ai-chat-message-content ol {
        margin: 8px 0;
        padding-left: 20px;
      }

      .ai-chat-message-content li {
        margin: 4px 0;
      }

      .ai-chat-typing {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 12px 16px;
      }

      .ai-chat-typing span {
        width: 8px;
        height: 8px;
        background: #64748b;
        border-radius: 50%;
        animation: typing 1.4s infinite;
      }

      .ai-chat-typing span:nth-child(2) { animation-delay: 0.2s; }
      .ai-chat-typing span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-8px); }
      }

      .ai-chat-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 16px 14px;
      }

      .ai-chat-suggestion {
        padding: 9px 16px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        border-radius: 20px;
        color: #64748b;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .ai-chat-suggestion:hover {
        background: #e2e8f0;
        color: #1e293b;
        border-color: #0ea5e9;
      }

      .ai-chat-widget.role-admin .ai-chat-suggestion:hover {
        border-color: #f59e0b;
      }

      .ai-chat-widget.role-teacher .ai-chat-suggestion:hover {
        border-color: #10b981;
      }

      .ai-chat-input-area {
        padding: 16px;
        border-top: 1px solid #e2e8f0;
        background: #ffffff;
      }

      .ai-chat-input-wrapper {
        display: flex;
        gap: 10px;
        background: #f1f5f9;
        border-radius: 14px;
        padding: 6px;
        border: 1px solid #cbd5e1;
        transition: border-color 0.2s;
      }

      .ai-chat-input-wrapper:focus-within {
        border-color: #0ea5e9;
      }

      .ai-chat-widget.role-admin .ai-chat-input-wrapper:focus-within {
        border-color: #f59e0b;
      }

      .ai-chat-widget.role-teacher .ai-chat-input-wrapper:focus-within {
        border-color: #10b981;
      }

      .ai-chat-input {
        flex: 1;
        background: transparent;
        border: none;
        padding: 10px 12px;
        color: #1e293b;
        font-size: 14px;
        outline: none;
        resize: none;
        max-height: 80px;
        line-height: 1.4;
      }

      .ai-chat-input::placeholder {
        color: #64748b;
      }

      .ai-chat-send {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .ai-chat-widget.role-admin .ai-chat-send {
        background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
      }

      .ai-chat-widget.role-teacher .ai-chat-send {
        background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
      }

      .ai-chat-send:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 4px 15px rgba(14, 165, 233, 0.4);
      }

      .ai-chat-send:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .ai-chat-send svg {
        width: 20px;
        height: 20px;
        fill: white;
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .ai-chat-box {
          width: calc(100vw - 32px);
          height: calc(100vh - 100px);
          bottom: 70px;
          right: -8px;
        }

        .ai-chat-widget {
          bottom: 16px;
          right: 16px;
        }

        .ai-chat-toggle {
          width: 56px;
          height: 56px;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  createWidget() {
    const roleConfig = this.getRoleConfig();
    
    this.widget = document.createElement('div');
    this.widget.className = `ai-chat-widget role-${this.role}`;
    this.widget.innerHTML = `
      <div class="ai-chat-box">
        <div class="ai-chat-header">
          <div class="ai-chat-avatar">${roleConfig.icon}</div>
          <div class="ai-chat-info">
            <h3>Trợ lý AI ${roleConfig.title}</h3>
            <p>Đang hoạt động</p>
          </div>
          <button class="ai-chat-close-btn" id="aiChatClose">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        
        <div class="ai-chat-messages" id="aiChatMessages"></div>
        
        <div class="ai-chat-suggestions" id="aiChatSuggestions">
          ${roleConfig.suggestions.map(s => `<button class="ai-chat-suggestion">${s}</button>`).join('')}
        </div>
        
        <div class="ai-chat-input-area">
          <div class="ai-chat-input-wrapper">
            <textarea 
              class="ai-chat-input" 
              id="aiChatInput" 
              placeholder="Nhập câu hỏi của bạn..." 
              rows="1"
            ></textarea>
            <button class="ai-chat-send" id="aiChatSend">
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      </div>
      
      <button class="ai-chat-toggle" id="aiChatToggle">
        <div class="ai-chat-pulse"></div>
        <svg class="chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
        <svg class="close-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    `;
    
    document.body.appendChild(this.widget);
    
    this.messagesContainer = this.widget.querySelector('#aiChatMessages');
    this.input = this.widget.querySelector('#aiChatInput');
    this.sendBtn = this.widget.querySelector('#aiChatSend');
    this.toggleBtn = this.widget.querySelector('#aiChatToggle');
    this.closeBtn = this.widget.querySelector('#aiChatClose');
    this.suggestionsContainer = this.widget.querySelector('#aiChatSuggestions');
  }

  getRoleConfig() {
    const configs = {
      student: {
        icon: '🎓',
        title: 'Học Sinh',
        suggestions: [
          '📊 Xem điểm của tôi',
          '📚 Cách học hiệu quả',
          '🎯 Cải thiện môn yếu',
          '💡 Xếp loại học lực'
        ]
      },
      teacher: {
        icon: '👨‍🏫',
        title: 'Giáo Viên',
        suggestions: [
          '📝 Hướng dẫn nhập điểm',
          '📊 Thống kê lớp học',
          '✍️ Công thức tính điểm',
          '📋 Yêu cầu cập nhật'
        ]
      },
      admin: {
        icon: '⚙️',
        title: 'Quản Trị',
        suggestions: [
          '📊 Thống kê tổng quan',
          '👥 Quản lý học sinh',
          '📋 Import Excel',
          '🏆 Học bổng'
        ]
      }
    };
    return configs[this.role] || configs.student;
  }

  bindEvents() {
    // Toggle chat
    this.toggleBtn.addEventListener('click', () => this.toggle());
    
    // Close button
    this.closeBtn.addEventListener('click', () => this.toggle());
    
    // Send message
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    
    // Enter to send
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Auto resize textarea
    this.input.addEventListener('input', () => {
      this.input.style.height = 'auto';
      this.input.style.height = Math.min(this.input.scrollHeight, 80) + 'px';
    });
    
    // Suggestions
    this.suggestionsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('ai-chat-suggestion')) {
        this.input.value = e.target.textContent;
        this.sendMessage();
      }
    });
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.widget.classList.toggle('open', this.isOpen);
    if (this.isOpen) {
      setTimeout(() => this.input.focus(), 300);
    }
  }

  addWelcomeMessage() {
    const roleGreetings = {
      student: `Xin chào ${this.userName}! 👋\n\nMình là trợ lý AI, sẵn sàng hỗ trợ bạn về:\n• 📊 Xem và giải thích điểm số\n• 📚 Tư vấn phương pháp học tập\n• 🎯 Định hướng cải thiện kết quả\n• 💡 Giải đáp mọi thắc mắc\n\nBạn cần giúp gì nào?`,
      teacher: `Xin chào Thầy/Cô ${this.userName}! 👋\n\nTôi là trợ lý AI, sẵn sàng hỗ trợ:\n• 📝 Hướng dẫn nhập điểm\n• ✍️ Thống kê kết quả học sinh\n• 📊 Phân tích lớp học\n• 📋 Hỗ trợ công tác giảng dạy\n\nThầy/Cô cần hỗ trợ gì ạ?`,
      admin: `Xin chào Admin ${this.userName}! 👋\n\nTôi là trợ lý AI quản trị, hỗ trợ:\n• 🔧 Quản lý hệ thống\n• 👥 Quản lý người dùng, học sinh\n• 📊 Báo cáo & thống kê\n• 📋 Import/Export dữ liệu\n• 🏆 Xét học bổng\n\nTôi có thể giúp gì cho bạn?`
    };
    
    this.addMessage('bot', roleGreetings[this.role] || roleGreetings.student);
  }

  addMessage(type, content) {
    const message = document.createElement('div');
    message.className = `ai-chat-message ${type}`;
    
    const avatar = type === 'bot' ? '🤖' : '👤';
    
    // Parse markdown-like formatting
    const formattedContent = this.formatMessage(content);
    
    message.innerHTML = `
      <div class="ai-chat-message-avatar">${avatar}</div>
      <div class="ai-chat-message-content">${formattedContent}</div>
    `;
    
    this.messagesContainer.appendChild(message);
    this.scrollToBottom();
    
    this.messages.push({ type, content });
  }

  formatMessage(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/• /g, '&bull; ');
  }

  showTyping() {
    const typing = document.createElement('div');
    typing.className = 'ai-chat-message bot';
    typing.id = 'aiTyping';
    typing.innerHTML = `
      <div class="ai-chat-message-avatar">🤖</div>
      <div class="ai-chat-message-content ai-chat-typing">
        <span></span><span></span><span></span>
      </div>
    `;
    this.messagesContainer.appendChild(typing);
    this.scrollToBottom();
  }

  hideTyping() {
    const typing = document.getElementById('aiTyping');
    if (typing) typing.remove();
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  async sendMessage() {
    const message = this.input.value.trim();
    if (!message || this.isLoading) return;
    
    // Add user message
    this.addMessage('user', message);
    this.input.value = '';
    this.input.style.height = 'auto';
    
    // Hide suggestions after first message
    this.suggestionsContainer.style.display = 'none';
    
    // Show typing indicator
    this.isLoading = true;
    this.sendBtn.disabled = true;
    this.showTyping();
    
    try {
      const response = await fetch('/quanlyketquahoctap/api/ai-chat.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          role: this.role,
          context: {
            userName: this.userName,
            userCode: this.userCode,
            ...this.userContext
          }
        })
      });
      
      const data = await response.json();
      
      this.hideTyping();
      
      if (data.success && data.data && data.data.reply) {
        this.addMessage('bot', data.data.reply);
      } else if (data.success && data.message) {
        this.addMessage('bot', data.message);
      } else {
        this.addMessage('bot', '❌ ' + (data.message || 'Có lỗi xảy ra. Vui lòng thử lại!'));
      }
    } catch (error) {
      console.error('AI Chat Error:', error);
      this.hideTyping();
      this.addMessage('bot', '❌ Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng!');
    } finally {
      this.isLoading = false;
      this.sendBtn.disabled = false;
      this.input.focus();
    }
  }
}

// Global init function for easy usage
function initAIChat(options = {}) {
  return new AIChatWidget(options);
}

// Export for use
window.AIChatWidget = AIChatWidget;
window.initAIChat = initAIChat;



