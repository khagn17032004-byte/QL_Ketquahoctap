/**
 * UI Utilities - Toast and Modal System
 * Provides modern, Tailwind-styled components to replace alert() and confirm()
 */

const UI = {
    /**
     * Toast notification system
     */
    toast: {
        timeout: null,

        show(message, type = 'info', duration = 3000) {
            let toastContainer = document.getElementById('custom-toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'custom-toast-container';
                toastContainer.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none';
                document.body.appendChild(toastContainer);
            }

            const toast = document.createElement('div');
            const bgClass = {
                'success': 'bg-emerald-500',
                'error': 'bg-rose-500',
                'warning': 'bg-amber-500',
                'info': 'bg-sky-500'
            }[type] || 'bg-slate-800';

            toast.className = `${bgClass} text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] animate-slide-up pointer-events-auto cursor-pointer transition-all hover:scale-105`;

            const icon = {
                'success': 'check-circle',
                'error': 'alert-circle',
                'warning': 'alert-triangle',
                'info': 'info'
            }[type] || 'bell';

            toast.innerHTML = `
                <i data-lucide="${icon}" class="w-5 h-5"></i>
                <span class="font-medium">${message}</span>
            `;

            toastContainer.appendChild(toast);

            if (typeof lucide !== 'undefined') {
                lucide.createIcons({ props: { "stroke-width": 2 }, node: toast });
            }

            toast.onclick = () => this.remove(toast);

            setTimeout(() => this.remove(toast), duration);
        },

        remove(toast) {
            toast.classList.add('opacity-0', '-translate-y-4');
            setTimeout(() => toast.remove(), 300);
        },

        success(msg) { this.show(msg, 'success'); },
        error(msg) { this.show(msg, 'error', 4000); },
        warning(msg) { this.show(msg, 'warning'); },
        info(msg) { this.show(msg, 'info'); }
    },

    /**
     * Modal system (Replace confirm/alert)
     */
    modal: {
        activeModal: null,

        confirm({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', onConfirm, onCancel, type = 'primary' }) {
            const modalId = 'custom-confirm-modal';
            this.remove(modalId);

            const overlay = document.createElement('div');
            overlay.id = modalId;
            overlay.className = 'fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in';

            const accentColor = {
                'primary': 'bg-sky-600 hover:bg-sky-700',
                'danger': 'bg-rose-500 hover:bg-rose-600',
                'success': 'bg-emerald-500 hover:bg-emerald-600'
            }[type] || 'bg-sky-600';

            overlay.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                    <div class="p-6 text-center">
                        <div class="w-16 h-16 ${type === 'danger' ? 'bg-rose-100 text-rose-500' : 'bg-sky-100 text-sky-500'} rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <i data-lucide="${type === 'danger' ? 'alert-triangle' : 'help-circle'}" class="w-8 h-8"></i>
                        </div>
                        <h3 class="text-xl font-bold text-slate-900 mb-2">${title}</h3>
                        <div class="text-slate-600 whitespace-pre-line">${message}</div>
                    </div>
                    <div class="p-4 bg-slate-50 flex gap-3">
                        <button id="modal-cancel" class="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-white transition-all">${cancelText}</button>
                        <button id="modal-confirm" class="flex-1 px-4 py-3 rounded-xl ${accentColor} text-white font-medium shadow-lg transition-all">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            if (typeof lucide !== 'undefined') lucide.createIcons({ node: overlay });

            overlay.querySelector('#modal-confirm').onclick = () => {
                this.remove(modalId);
                if (onConfirm) onConfirm();
            };

            overlay.querySelector('#modal-cancel').onclick = () => {
                this.remove(modalId);
                if (onCancel) onCancel();
            };
        },

        alert({ title, message, btnText = 'Đóng', type = 'info', onOk }) {
            this.confirm({
                title,
                message,
                confirmText: btnText,
                cancelText: '',
                type,
                onConfirm: onOk
            });
            // Hide cancel button
            const cancelBtn = document.getElementById('modal-cancel');
            if (cancelBtn) cancelBtn.style.display = 'none';
        },

        remove(id) {
            const el = document.getElementById(id);
            if (el) el.remove();
        }
    }
};

// Add required animations to head
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slide-up {
        from { opacity: 0; transform: translateY(1rem); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes scale-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
    .animate-slide-up { animation: slide-up 0.3s ease-out; }
    .animate-fade-in { animation: fade-in 0.2s ease-out; }
    .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
`;
document.head.appendChild(style);

window.UI = UI;
window.showToast = (msg, type) => UI.toast.show(msg, type);
