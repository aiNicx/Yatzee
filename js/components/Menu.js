/* ========================================
   Menu Component - Side Menu
   Reusable slide-in menu
   ======================================== */

export class Menu {
    /**
     * @param {Object} options
     * @param {Array<{id: string, label: string, danger?: boolean}>} options.items
     * @param {Function} options.onItemClick - callback(itemId)
     */
    constructor({ items = [], onItemClick = () => {} }) {
        this.items = items;
        this.onItemClick = onItemClick;
        this.isOpen = false;
        this.el = null;
        this.overlay = null;
    }

    render(container) {
        // Overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'menu-overlay';
        this.overlay.addEventListener('click', () => this.close());

        // Menu panel
        this.el = document.createElement('div');
        this.el.className = 'side-menu';

        this.el.innerHTML = `
            <div class="menu-header">
                <span class="menu-title">Menu</span>
                <button class="close-menu">✕</button>
            </div>
            ${this.items.map(item => `
                <div class="menu-item ${item.danger ? 'danger' : ''}" data-id="${item.id}">
                    ${item.label}
                </div>
            `).join('')}
        `;

        // Events
        this.el.querySelector('.close-menu').addEventListener('click', () => this.close());
        this.el.querySelectorAll('.menu-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                this.close();
                this.onItemClick(id);
            });
        });

        container.appendChild(this.overlay);
        container.appendChild(this.el);
    }

    open() {
        if (!this.el) return;
        this.isOpen = true;
        this.el.classList.add('open');
        this.overlay.classList.add('show');
    }

    close() {
        if (!this.el) return;
        this.isOpen = false;
        this.el.classList.remove('open');
        this.overlay.classList.remove('show');
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    destroy() {
        if (this.overlay) this.overlay.remove();
        if (this.el) this.el.remove();
    }
}

export default Menu;
