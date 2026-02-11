/* ========================================
   DiceRenderer - 3D CSS Dice with Realistic Animations (REUSABLE)
   Renders dice into a container, listens to DiceEngine events.
   ======================================== */

export class DiceRenderer {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - DOM element to render into
     * @param {import('./DiceEngine.js').DiceEngine} options.engine - Dice engine instance
     * @param {number} options.size - Dice size in pixels (default 60)
     * @param {number} options.animationDuration - Roll animation duration ms (default 900)
     */
    constructor({ container, engine, size = 60, animationDuration = 900 }) {
        this.container = container;
        this.engine = engine;
        this.size = size;
        this.animationDuration = animationDuration;
        this.scenes = [];

        // Rotation map: value -> CSS rotation
        this.rotationMap = {
            1: 'rotateX(0deg) rotateY(0deg)',
            2: 'rotateX(0deg) rotateY(-90deg)',
            3: 'rotateX(0deg) rotateY(-180deg)',
            4: 'rotateX(0deg) rotateY(90deg)',
            5: 'rotateX(-90deg) rotateY(0deg)',
            6: 'rotateX(90deg) rotateY(0deg)'
        };

        this._buildDice();
        this._bindEvents();
    }

    // ---- Build DOM ----

    _buildDice() {
        this.container.innerHTML = '';
        this.container.classList.add('dice-container');
        this.container.style.setProperty('--dice-size', `${this.size}px`);
        this.scenes = [];

        for (let i = 0; i < this.engine.count; i++) {
            const scene = document.createElement('div');
            scene.className = 'dice-scene';
            scene.dataset.index = i;
            scene.style.width = `${this.size}px`;
            scene.style.height = `${this.size}px`;

            const cube = document.createElement('div');
            cube.className = 'dice-cube';

            // Create 6 faces
            for (let f = 1; f <= this.engine.sides && f <= 6; f++) {
                const face = document.createElement('div');
                face.className = `dice-face dice-face--${f}`;

                const dotContainer = document.createElement('div');
                dotContainer.className = `dice-dot-container dice-dots-${f}`;

                for (let d = 0; d < 9; d++) {
                    const dot = document.createElement('div');
                    dot.className = 'dice-dot';
                    dotContainer.appendChild(dot);
                }

                face.appendChild(dotContainer);
                cube.appendChild(face);
            }

            const shadow = document.createElement('div');
            shadow.className = 'dice-shadow';

            const holdLabel = document.createElement('div');
            holdLabel.className = 'dice-hold-label';
            holdLabel.textContent = 'TENUTO';

            scene.appendChild(cube);
            scene.appendChild(shadow);
            scene.appendChild(holdLabel);
            this.container.appendChild(scene);

            this.scenes.push({ scene, cube, shadow, holdLabel });

            // Click to hold
            scene.addEventListener('click', () => {
                this.engine.toggleHold(i);
            });
        }

        this._updateVisuals();
    }

    // ---- Bind Engine Events ----

    _bindEvents() {
        this.engine.on('roll-start', (data) => this._animateRoll(data));
        this.engine.on('hold-changed', () => this._updateHoldVisuals());
        this.engine.on('reset', () => this._updateVisuals());
        this.engine.on('restored', () => this._updateVisuals());
    }

    // ---- Animation ----

    _animateRoll({ rolledIndices }) {
        const duration = this.animationDuration;
        const values = this.engine.getValues();

        // Phase 1: Launch - each die lifts with random delay
        rolledIndices.forEach((idx, i) => {
            const { scene, cube, shadow } = this.scenes[idx];
            const delay = Math.random() * 120; // 0-120ms stagger

            setTimeout(() => {
                scene.classList.add('rolling');
                cube.classList.add('rolling');
                cube.classList.remove('settling', 'wobble');

                // Random intermediate rotations
                const randX = (Math.random() * 720 + 360);
                const randY = (Math.random() * 720 + 360);
                const randZ = (Math.random() * 360);
                const signX = Math.random() > 0.5 ? 1 : -1;
                const signY = Math.random() > 0.5 ? 1 : -1;

                // Phase 1+2: Launch + Air (fast spinning, lifting)
                cube.style.transform = `rotateX(${signX * randX}deg) rotateY(${signY * randY}deg) rotateZ(${randZ}deg)`;

                // Lift up
                scene.style.transition = `transform ${duration * 0.3}ms cubic-bezier(0.0, 0.7, 0.3, 1)`;
                scene.style.transform = `translateY(${-30 - Math.random() * 30}px)`;

                // Shadow shrinks when airborne
                shadow.style.transition = `all ${duration * 0.3}ms ease`;
                shadow.style.width = '40%';
                shadow.style.opacity = '0.15';

            }, delay);
        });

        // Phase 3: Landing - dice come back down
        setTimeout(() => {
            rolledIndices.forEach((idx) => {
                const { scene, cube, shadow } = this.scenes[idx];
                const finalRotation = this.rotationMap[values[idx]];

                // Stop free rotation, enable transition for settling
                cube.classList.remove('rolling');
                cube.classList.add('settling');
                cube.style.transform = finalRotation;
                cube.style.setProperty('--final-rotation', finalRotation);

                // Drop down with bounce
                scene.style.transition = `transform ${duration * 0.35}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
                scene.style.transform = 'translateY(0)';

                // Shadow returns
                shadow.style.transition = `all ${duration * 0.3}ms ease`;
                shadow.style.width = '80%';
                shadow.style.opacity = '1';
            });
        }, duration * 0.55);

        // Phase 4: Settle - wobble + cleanup
        setTimeout(() => {
            rolledIndices.forEach((idx) => {
                const { scene, cube } = this.scenes[idx];

                scene.classList.remove('rolling');
                scene.classList.add('bouncing');
                cube.classList.remove('settling');
                cube.classList.add('wobble');

                // Cleanup after wobble
                setTimeout(() => {
                    scene.classList.remove('bouncing');
                    cube.classList.remove('wobble');
                    scene.style.transition = '';
                    scene.style.transform = '';
                }, 350);
            });

            // Tell engine animation is done
            this.engine.finishRoll();

        }, duration * 0.85);
    }

    // ---- Visual Updates ----

    _updateVisuals() {
        const values = this.engine.getValues();
        const held = this.engine.getHeld();

        this.scenes.forEach(({ scene, cube, shadow }, i) => {
            cube.style.transform = this.rotationMap[values[i]];
            cube.classList.remove('rolling', 'settling', 'wobble');
            scene.classList.remove('rolling', 'bouncing', 'airborne');
            scene.style.transition = '';
            scene.style.transform = '';

            // Shadow reset
            shadow.style.transition = '';
            shadow.style.width = '80%';
            shadow.style.opacity = '1';

            // Hold state
            if (held[i]) {
                scene.classList.add('held');
            } else {
                scene.classList.remove('held');
            }
        });
    }

    _updateHoldVisuals() {
        const held = this.engine.getHeld();
        this.scenes.forEach(({ scene }, i) => {
            if (held[i]) {
                scene.classList.add('held');
            } else {
                scene.classList.remove('held');
            }
        });
    }

    // ---- Cleanup ----

    destroy() {
        this.container.innerHTML = '';
        this.scenes = [];
    }
}

export default DiceRenderer;
