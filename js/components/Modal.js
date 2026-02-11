/* ========================================
   Modal Component - Reusable overlay modal
   ======================================== */

export class Modal {
    /**
     * @param {Object} options
     * @param {string} options.id - Unique modal id
     * @param {boolean} options.closeOnOverlayClick - Close when clicking overlay (default true)
     */
    constructor({ id = 'modal', closeOnOverlayClick = true } = {}) {
        this.id = id;
        this.closeOnOverlayClick = closeOnOverlayClick;
        this.el = null;
        this.contentEl = null;
        this._onClose = null;
    }

    render(container) {
        this.el = document.createElement('div');
        this.el.className = 'modal-overlay';
        this.el.id = this.id;

        this.contentEl = document.createElement('div');
        this.contentEl.className = 'modal-content';

        this.el.appendChild(this.contentEl);
        container.appendChild(this.el);

        if (this.closeOnOverlayClick) {
            this.el.addEventListener('click', (e) => {
                if (e.target === this.el) this.hide();
            });
        }
    }

    setContent(html) {
        if (this.contentEl) {
            this.contentEl.innerHTML = html;
        }
    }

    show(onClose) {
        if (!this.el) return;
        this._onClose = onClose || null;
        this.el.style.display = 'flex';
    }

    hide() {
        if (!this.el) return;
        this.el.style.display = 'none';
        if (this._onClose) {
            this._onClose();
            this._onClose = null;
        }
    }

    isVisible() {
        return this.el && this.el.style.display === 'flex';
    }

    destroy() {
        if (this.el) this.el.remove();
    }
}

export default Modal;
