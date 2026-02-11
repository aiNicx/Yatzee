/* ========================================
   YahtzeeGame - Game Controller
   State machine managing turns, scoring, game flow.
   ======================================== */

import { DiceEngine } from '../../components/dice/DiceEngine.js';
import { DiceRenderer } from '../../components/dice/DiceRenderer.js';
import { categories } from './YahtzeeCategories.js';
import { calculateUpperSum, calculateTotal } from './YahtzeeScoring.js';
import { YahtzeeUI } from './YahtzeeUI.js';
import { gameHistory } from '../../services/GameHistoryService.js';
import { ConfettiEffect } from '../../components/ConfettiEffect.js';
import { Modal } from '../../components/Modal.js';
import { Menu } from '../../components/Menu.js';

export class YahtzeeGame {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - Root container element
     * @param {Array} options.players - Player objects [{name, color}]
     * @param {Function} options.onExit - Callback to return to home
     * @param {Object} [options.savedState] - Optional saved state to resume
     */
    constructor({ container, players, onExit, savedState = null }) {
        this.container = container;
        this.onExit = onExit;
        this.gameStartTime = Date.now();

        // Game ID for multi-game save support
        this.gameId = savedState?.gameId || this._generateGameId();

        // Init players
        this.players = players.map((p, i) => ({
            id: i,
            name: p.name,
            color: p.color,
            scores: {},
            yahtzees: 0
        }));

        this.currentPlayerIndex = 0;
        this.categories = categories;
        this.confetti = new ConfettiEffect();

        // Dice engine
        this.diceEngine = new DiceEngine({ count: 5, sides: 6, maxRolls: 3 });

        // Build UI
        this._buildUI();

        // Dice renderer
        this.diceRenderer = new DiceRenderer({
            container: this.ui.diceContainer,
            engine: this.diceEngine,
            size: 60,
            animationDuration: 900
        });

        // Wire up engine events
        this.diceEngine.on('roll-start', () => this._onRollStart());
        this.diceEngine.on('roll-end', () => this._onRollEnd());
        this.diceEngine.on('hold-changed', (data) => this._onHoldChanged(data));

        // Restore or start fresh
        if (savedState) {
            this._restoreState(savedState);
        } else {
            this._startTurn();
        }
    }

    // ---- Build UI ----

    _buildUI() {
        this.container.innerHTML = '';

        // App shell
        const wrapper = document.createElement('div');
        wrapper.className = 'container';

        // Header
        wrapper.innerHTML = `
            <header>
                <h1>🎲 YATZEE</h1>
                <button class="menu-btn" id="menuBtn">☰</button>
            </header>
        `;

        // Game screen
        const gameScreen = document.createElement('div');
        gameScreen.className = 'game-screen';
        gameScreen.style.display = 'block';

        gameScreen.innerHTML = `
            <div class="game-layout">
                <div class="players-bar" id="playersBar"></div>
                <div class="top-bar">
                    <div class="current-player" id="currentPlayer">-</div>
                    <div class="rolls-indicator">
                        <span>Lanci rimasti:</span>
                        <div class="roll-dots" id="rollDots">
                            <div class="roll-dot"></div>
                            <div class="roll-dot"></div>
                            <div class="roll-dot"></div>
                        </div>
                    </div>
                </div>
                <div class="dice-area">
                    <div id="diceContainer"></div>
                    <div class="dice-hint" id="diceHint">Tocca "Lancia Dadi" per iniziare</div>
                </div>
                <div class="scoreboard-section">
                    <div class="scoreboard-title">📊 Tabellone</div>
                    <div class="score-list" id="scoreList"></div>
                </div>
            </div>
            <div class="fixed-action">
                <button class="btn btn-action" id="rollBtn">🎲 LANCIA DADI</button>
            </div>
        `;

        wrapper.appendChild(gameScreen);
        this.container.appendChild(wrapper);

        // Menu
        this.menu = new Menu({
            items: [
                { id: 'rules', label: '📜 Regole' },
                { id: 'history', label: '📊 Storico Partite' },
                { id: 'newGame', label: '🔄 Nuova Partita' },
                { id: 'home', label: '⚠️ Torna alla Home', danger: true }
            ],
            onItemClick: (id) => this._handleMenuAction(id)
        });
        this.menu.render(this.container);

        // Rules Modal
        this.rulesModal = new Modal({ id: 'rulesModal' });
        this.rulesModal.render(this.container);

        // History Modal
        this.historyModal = new Modal({ id: 'historyModal' });
        this.historyModal.render(this.container);
        this.rulesModal.setContent(`
            <div class="winner-title" style="font-size: 1.5rem;">📜 Regole Complete</div>
            <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; margin: 20px 0;">
                <strong style="color: var(--primary);">PARTE ALTA:</strong><br>
                Somma dei dadi del numero corrispondente.<br>
                Totale ≥ 63 = <strong>+35 punti bonus</strong><br><br>
                <strong style="color: var(--primary);">PARTE BASSA:</strong><br>
                • <strong>Tre Uguali:</strong> Somma tutti i dadi<br>
                • <strong>Quattro Uguali:</strong> Somma tutti i dadi<br>
                • <strong>Full House:</strong> 25 punti<br>
                • <strong>Scala Piccola:</strong> 30 punti<br>
                • <strong>Scala Grande:</strong> 40 punti<br>
                • <strong>Yatzee:</strong> 50 punti (5 uguali)<br>
                • <strong>Chance:</strong> Somma tutti i dadi<br><br>
                <strong style="color: var(--primary);">BONUS YATZEE:</strong><br>
                Ogni Yatzee aggiuntivo = <strong>100 punti</strong>!
            </div>
            <button class="btn btn-primary" id="closeRulesBtn">Ho capito!</button>
        `);

        // Winner Modal
        this.winnerModal = new Modal({ id: 'winnerModal', closeOnOverlayClick: false });
        this.winnerModal.render(this.container);

        // Cache UI refs
        this.ui = {
            diceContainer: gameScreen.querySelector('#diceContainer'),
            diceHint: gameScreen.querySelector('#diceHint'),
            rollBtn: gameScreen.querySelector('#rollBtn'),
            currentPlayer: gameScreen.querySelector('#currentPlayer'),
            rollDots: gameScreen.querySelector('#rollDots'),
            playersBar: gameScreen.querySelector('#playersBar'),
            scoreList: gameScreen.querySelector('#scoreList')
        };

        // Event listeners
        wrapper.querySelector('#menuBtn').addEventListener('click', () => this.menu.toggle());
        this.ui.rollBtn.addEventListener('click', () => this._rollDice());

        // Close rules btn (delegated since modal content is set)
        this.rulesModal.contentEl.addEventListener('click', (e) => {
            if (e.target.id === 'closeRulesBtn') this.rulesModal.hide();
        });

        // Scoreboard click delegation for category selection
        this.ui.scoreList.addEventListener('click', (e) => {
            const target = e.target.closest('[data-cat-id]');
            if (target) {
                this._selectCategory(target.dataset.catId);
            }
        });
    }

    // ---- Game Flow ----

    _startTurn() {
        this.diceEngine.reset();

        // Skip finished players
        if (this._isPlayerFinished(this.players[this.currentPlayerIndex])) {
            this._nextPlayer();
            return;
        }

        this._updateUI();

        this.ui.diceHint.textContent = 'Tocca "Lancia Dadi" per iniziare';
        this.ui.diceHint.style.color = '#666';
        this.ui.diceHint.style.fontWeight = '';
    }

    _rollDice() {
        if (!this.diceEngine.canRoll()) return;

        this.diceEngine.roll();
    }

    _onRollStart() {
        this.ui.rollBtn.disabled = true;
        this.ui.diceHint.textContent = 'Lanciando...';
        this.ui.diceHint.style.color = 'var(--primary)';
        this.ui.diceHint.style.fontWeight = '';
    }

    _onRollEnd() {
        this.ui.rollBtn.disabled = false;
        this._updateUI();
        this._autoSave();

        if (this.diceEngine.rollsLeft > 0) {
            this.ui.diceHint.textContent = 'Tocca i dadi per tenerli o lancia di nuovo';
            this.ui.diceHint.style.color = '#666';
        } else {
            this.ui.diceHint.textContent = '⬇️ Scegli una categoria qui sotto';
            this.ui.diceHint.style.color = 'var(--success)';
            this.ui.diceHint.style.fontWeight = '700';
        }
    }

    _onHoldChanged({ index, isHeld }) {
        if (isHeld) {
            this.ui.diceHint.textContent = `✅ Dado ${index + 1} tenuto!`;
            this.ui.diceHint.style.color = 'var(--success)';
        } else {
            this.ui.diceHint.textContent = `❌ Dado ${index + 1} rilasciato`;
            this.ui.diceHint.style.color = 'var(--danger)';
        }
        setTimeout(() => {
            if (this.diceEngine.rollsLeft > 0 && this.diceEngine.hasRolled) {
                this.ui.diceHint.textContent = 'Tocca i dadi per tenerli o lancia di nuovo';
                this.ui.diceHint.style.color = '#666';
            }
        }, 1000);
        this._autoSave();
    }

    _selectCategory(catId) {
        if (!this.diceEngine.hasRolled || this.diceEngine.isRolling) return;

        const p = this.players[this.currentPlayerIndex];
        const cat = this.categories.find(c => c.id === catId);

        if (!cat || p.scores[catId] !== undefined) return;

        let score = cat.calc(this.diceEngine.getValues());

        // Yahtzee bonus
        if (catId === 'yahtzee' && score === 50) {
            p.yahtzees++;
            if (p.yahtzees > 1) {
                score = 100;
            }
        }

        p.scores[catId] = score;

        if (this.players.every(pl => this._isPlayerFinished(pl))) {
            this._endGame();
        } else {
            this._nextPlayer();
        }
    }

    _nextPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        this._startTurn();
        this._autoSave();
    }

    _isPlayerFinished(p) {
        return this.categories.filter(c => c.type !== 'bonus').every(c => p.scores[c.id] !== undefined);
    }

    _endGame() {
        let maxScore = -1;
        let winners = [];

        this.players.forEach(p => {
            const t = calculateTotal(p, this.categories);
            if (t > maxScore) {
                maxScore = t;
                winners = [p];
            } else if (t === maxScore) {
                winners.push(p);
            }
        });

        // Save to history
        const duration = Math.round((Date.now() - this.gameStartTime) / 1000);
        gameHistory.addMatchToHistory({
            gameType: 'yahtzee',
            players: this.players.map(p => ({
                name: p.name,
                finalScore: calculateTotal(p, this.categories),
                isWinner: winners.includes(p)
            })),
            duration
        });

        // Update player profiles
        this.players.forEach(p => {
            gameHistory.updatePlayerProfile(p.name, p.color, {
                score: calculateTotal(p, this.categories),
                isWinner: winners.includes(p),
                yahtzeeCount: p.yahtzees
            });
        });

        // Remove this game from active games
        gameHistory.removeActiveGame(this.gameId);

        // Show winner modal
        const winnerName = winners.length > 1 ? 'Pareggio!' : winners[0].name;
        const winnerColor = winners.length === 1 ? winners[0].color : 'var(--primary)';

        this.winnerModal.setContent(`
            <div class="winner-title">🏆 Vincitore!</div>
            <div class="winner-name" style="color: ${winnerColor}">${winnerName}</div>
            <div class="winner-score">${maxScore}</div>
            <button class="btn btn-primary" id="playAgainBtn">Gioca Ancora</button>
            <button class="btn btn-secondary" id="goHomeBtn" style="margin-top:8px;">Torna alla Home</button>
        `);
        this.winnerModal.show();

        this.winnerModal.contentEl.querySelector('#playAgainBtn').addEventListener('click', () => {
            this.winnerModal.hide();
            this._restartGame();
        });
        this.winnerModal.contentEl.querySelector('#goHomeBtn').addEventListener('click', () => {
            this.winnerModal.hide();
            this.destroy();
            this.onExit();
        });

        this.confetti.fire();
    }

    _restartGame() {
        this.gameId = this._generateGameId(); // New ID for the new game
        this.players.forEach(p => {
            p.scores = {};
            p.yahtzees = 0;
        });
        this.currentPlayerIndex = 0;
        this.gameStartTime = Date.now();
        this._startTurn();
    }

    // ---- UI Updates ----

    _updateUI() {
        this._updateCurrentPlayer();
        this._updatePlayersBar();
        this._updateRollsIndicator();
        this._updateRollButton();
        this._renderScoreboard();
    }

    _updateCurrentPlayer() {
        const p = this.players[this.currentPlayerIndex];
        this.ui.currentPlayer.textContent = p.name;
        this.ui.currentPlayer.style.background = p.color;
    }

    _updatePlayersBar() {
        this.ui.playersBar.innerHTML = this.players.map((p, i) => `
            <div class="player-chip ${i === this.currentPlayerIndex ? 'active' : ''}" style="border-left-color: ${p.color}">
                ${p.name}
                <span class="score">${calculateTotal(p, this.categories)}</span>
                ${p.yahtzees > 0 ? `<span class="yahtzee-badge">x${p.yahtzees}</span>` : ''}
            </div>
        `).join('');
    }

    _updateRollsIndicator() {
        const dots = this.ui.rollDots.querySelectorAll('.roll-dot');
        const used = 3 - this.diceEngine.rollsLeft;
        dots.forEach((dot, i) => {
            dot.className = 'roll-dot';
            if (i < used) dot.classList.add('used');
            else dot.classList.add('active');
        });
    }

    _updateRollButton() {
        const btn = this.ui.rollBtn;
        if (this.diceEngine.rollsLeft === 0) {
            btn.textContent = '↓ SCEGLI CATEGORIA';
            btn.classList.add('waiting');
            btn.disabled = true;
        } else {
            btn.textContent = `🎲 LANCIA (${this.diceEngine.rollsLeft})`;
            btn.classList.remove('waiting');
            btn.disabled = false;
        }
    }

    _renderScoreboard() {
        YahtzeeUI.renderScoreboard({
            scoreList: this.ui.scoreList,
            players: this.players,
            currentPlayerIndex: this.currentPlayerIndex,
            categories: this.categories,
            diceValues: this.diceEngine.getValues(),
            canSelect: this.diceEngine.hasRolled && !this.diceEngine.isRolling
        });
    }

    // ---- Menu Actions ----

    _handleMenuAction(id) {
        switch (id) {
            case 'rules':
                this.rulesModal.show();
                break;
            case 'history':
                this._showHistory();
                break;
            case 'newGame':
                if (confirm('Nuova partita con gli stessi giocatori?')) {
                    gameHistory.removeActiveGame(this.gameId);
                    this._restartGame();
                }
                break;
            case 'home':
                if (confirm('Tornare alla schermata iniziale? La partita verrà salvata.')) {
                    this._autoSave(); // Save before exiting
                    this.destroy();
                    this.onExit();
                }
                break;
        }
    }

    // ---- History ----

    _showHistory() {
        const matches = gameHistory.getMatchHistory().filter(m => m.gameType === 'yahtzee');
        let html;
        if (matches.length === 0) {
            html = '<div style="text-align:center;color:#999;padding:20px;">Nessuna partita completata ancora.</div>';
        } else {
            html = '<div style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow-y:auto;">';
            matches.slice(0, 20).forEach(match => {
                const winner = match.players.find(p => p.isWinner);
                const dateStr = gameHistory.formatDate(match.date);
                html += `
                    <div style="background:#f8f9fa;border-radius:10px;padding:12px 15px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-size:0.75rem;color:#999;">${dateStr}</div>
                            <div style="font-size:0.8rem;color:#666;">${match.players.map(p => p.name).join(', ')}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:700;font-size:0.9rem;color:var(--success);">${winner ? '🏆 ' + winner.name : 'Pareggio'}</div>
                            <div style="font-size:0.75rem;color:#999;">${winner ? winner.finalScore + ' pts' : ''}</div>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        }

        this.historyModal.setContent(`
            <div class="winner-title" style="font-size: 1.5rem;">📊 Storico Partite</div>
            <div style="margin: 15px 0;">${html}</div>
            <button class="btn btn-primary" id="closeHistoryBtn">Chiudi</button>
        `);
        this.historyModal.show();
        this.historyModal.contentEl.querySelector('#closeHistoryBtn')
            .addEventListener('click', () => this.historyModal.hide());
    }

    // ---- Save/Restore ----

    _autoSave() {
        gameHistory.saveActiveGame({
            gameId: this.gameId,
            gameType: 'yahtzee',
            players: this.players.map(p => ({
                name: p.name,
                color: p.color,
                scores: { ...p.scores },
                yahtzees: p.yahtzees
            })),
            currentPlayerIndex: this.currentPlayerIndex,
            dice: this.diceEngine.getState(),
            gameStartTime: this.gameStartTime
        });
    }

    _generateGameId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    _restoreState(state) {
        // Restore players
        this.players = state.players.map((p, i) => ({
            id: i,
            name: p.name,
            color: p.color,
            scores: { ...p.scores },
            yahtzees: p.yahtzees || 0
        }));
        this.currentPlayerIndex = state.currentPlayerIndex;
        this.gameStartTime = state.gameStartTime || Date.now();

        // Restore dice
        if (state.dice) {
            this.diceEngine.restoreState(state.dice);
        }

        this._updateUI();

        if (this.diceEngine.hasRolled) {
            if (this.diceEngine.rollsLeft > 0) {
                this.ui.diceHint.textContent = 'Tocca i dadi per tenerli o lancia di nuovo';
            } else {
                this.ui.diceHint.textContent = '⬇️ Scegli una categoria qui sotto';
                this.ui.diceHint.style.color = 'var(--success)';
                this.ui.diceHint.style.fontWeight = '700';
            }
        } else {
            this.ui.diceHint.textContent = 'Tocca "Lancia Dadi" per iniziare';
        }
    }

    // ---- Cleanup ----

    destroy() {
        if (this.diceRenderer) this.diceRenderer.destroy();
        if (this.menu) this.menu.destroy();
        if (this.rulesModal) this.rulesModal.destroy();
        if (this.historyModal) this.historyModal.destroy();
        if (this.winnerModal) this.winnerModal.destroy();
        this.container.innerHTML = '';
    }
}

export default YahtzeeGame;
