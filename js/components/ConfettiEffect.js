/* ========================================
   ConfettiEffect - Celebration animation
   Reusable across games
   ======================================== */

import { CONFETTI_COLORS } from '../utils/constants.js';

export class ConfettiEffect {
    /**
     * @param {Object} options
     * @param {number} options.count - Number of confetti pieces (default 50)
     * @param {number} options.duration - Duration in ms (default 4000)
     * @param {string[]} options.colors - Array of color strings
     */
    constructor({
        count = 50,
        duration = 4000,
        colors = CONFETTI_COLORS
    } = {}) {
        this.count = count;
        this.duration = duration;
        this.colors = colors;
    }

    fire() {
        for (let i = 0; i < this.count; i++) {
            setTimeout(() => {
                const piece = document.createElement('div');
                piece.className = 'confetti';
                piece.style.left = Math.random() * 100 + 'vw';
                piece.style.backgroundColor = this.colors[Math.floor(Math.random() * this.colors.length)];
                piece.style.animationDuration = (Math.random() * 2 + 2) + 's';

                // Random shapes
                const shapes = ['50%', '0', '3px'];
                piece.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)];
                piece.style.width = (Math.random() * 8 + 6) + 'px';
                piece.style.height = (Math.random() * 8 + 6) + 'px';

                document.body.appendChild(piece);
                setTimeout(() => piece.remove(), this.duration);
            }, i * 50);
        }
    }
}

export default ConfettiEffect;
