/* ========================================
   DiceEngine - Pure Logic (REUSABLE)
   No DOM dependencies. Configurable count/sides.
   Event-driven for decoupled rendering.
   ======================================== */

export class DiceEngine {
    /**
     * @param {Object} options
     * @param {number} options.count - Number of dice (default 5)
     * @param {number} options.sides - Sides per die (default 6)
     * @param {number} options.maxRolls - Max rolls per turn (default 3)
     */
    constructor({ count = 5, sides = 6, maxRolls = 3 } = {}) {
        this.count = count;
        this.sides = sides;
        this.maxRolls = maxRolls;

        this.values = new Array(count).fill(1);
        this.held = new Array(count).fill(false);
        this.rollsLeft = maxRolls;
        this.hasRolled = false;
        this.isRolling = false;

        this._listeners = {};
    }

    // ---- Event Emitter ----

    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
        return this; // chainable
    }

    off(event, callback) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        if (!this._listeners[event]) return;
        this._listeners[event].forEach(cb => cb(data));
    }

    // ---- Core Logic ----

    roll() {
        if (this.rollsLeft <= 0 || this.isRolling) return false;

        this.isRolling = true;
        this.hasRolled = true;
        this.rollsLeft--;

        // Determine which dice to roll
        const rolledIndices = [];
        for (let i = 0; i < this.count; i++) {
            if (!this.held[i]) {
                this.values[i] = Math.floor(Math.random() * this.sides) + 1;
                rolledIndices.push(i);
            }
        }

        this.emit('roll-start', {
            rolledIndices,
            values: [...this.values],
            rollsLeft: this.rollsLeft
        });

        return true;
    }

    /**
     * Called by the renderer when animation finishes.
     */
    finishRoll() {
        this.isRolling = false;
        this.emit('roll-end', {
            values: [...this.values],
            rollsLeft: this.rollsLeft
        });
    }

    toggleHold(index) {
        if (!this.hasRolled || this.isRolling || this.rollsLeft === 0) return false;
        if (index < 0 || index >= this.count) return false;

        this.held[index] = !this.held[index];
        this.emit('hold-changed', {
            index,
            isHeld: this.held[index],
            held: [...this.held]
        });
        return true;
    }

    reset() {
        this.values = new Array(this.count).fill(1);
        this.held = new Array(this.count).fill(false);
        this.rollsLeft = this.maxRolls;
        this.hasRolled = false;
        this.isRolling = false;
        this.emit('reset', {});
    }

    // ---- Getters ----

    getValues() { return [...this.values]; }
    getHeld() { return [...this.held]; }
    canRoll() { return this.rollsLeft > 0 && !this.isRolling; }
    canHold() { return this.hasRolled && !this.isRolling && this.rollsLeft > 0; }

    // ---- Serialization (for save/restore) ----

    getState() {
        return {
            values: [...this.values],
            held: [...this.held],
            rollsLeft: this.rollsLeft,
            hasRolled: this.hasRolled
        };
    }

    restoreState(state) {
        if (!state) return;
        this.values = [...state.values];
        this.held = [...state.held];
        this.rollsLeft = state.rollsLeft;
        this.hasRolled = state.hasRolled;
        this.isRolling = false;
        this.emit('restored', this.getState());
    }
}

export default DiceEngine;
