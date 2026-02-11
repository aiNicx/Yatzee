/* ========================================
   FarkleGame - Game Controller
   State machine managing turns, scoring, game flow.
   Target: 10,000 points.
   ======================================== */

import { DiceEngine } from '../../components/dice/DiceEngine.js';
import { DiceRenderer } from '../../components/dice/DiceRenderer.js';
import {
    scoreSelection, isFarkle, findScorableDiceIndices,
    detectStraightAttempt, getAvailableCombinations
} from './FarkleScoring.js';
import { FarkleUI } from './FarkleUI.js';
import { gameHistory } from '../../services/GameHistoryService.js';
import { ConfettiEffect } from '../../components/ConfettiEffect.js';
import { Modal } from '../../components/Modal.js';
import { Menu } from '../../components/Menu.js';

const TARGET_SCORE = 10000;
const MIN_SCORE_3RD_ROLL = 350;
const STRAIGHT_SCORE = 1000;

export class FarkleGame {
    constructor({ container, players, onExit, savedState = null }) {
        this.container = container;
        this.onExit = onExit;
        this.gameStartTime = Date.now();
        this.gameId = savedState?.gameId || this._generateGameId();
        this.confetti = new ConfettiEffect();

        // Players
        this.players = players.map((p, i) => ({
            id: i,
            name: p.name,
            color: p.color,
            totalScore: p.totalScore || 0
        }));

        this.currentPlayerIndex = 0;

        // Turn state
        this.turnScore = 0;
        this.rollCount = 0;
        this.setAsideDice = new Set();   // indices 0-5 permanently set aside this turn
        this.selectedDice = new Set();   // indices temporarily selected
        this.turnState = 'idle';         // idle | rolling | selecting | confirmed | farkle | straightAttempt
        this.straightAttemptData = null; // { missingValue }

        // Final round
        this.finalRound = false;
        this.finalRoundTriggerPlayer = -1;
        this.playersHadFinalTurn = new Set();

        // Dice engine (6 dice, high maxRolls for unlimited rolling)
        this.diceEngine = new DiceEngine({ count: 6, sides: 6, maxRolls: 999 });

        // Build UI
        this._buildUI();

        // Dice renderer
        this.diceRenderer = new DiceRenderer({
            container: this.ui.diceContainer,
            engine: this.diceEngine,
            size: 55,
            animationDuration: 900
        });

        // Wire engine events
        this.diceEngine.on('roll-start', () => this._onRollStart());
        this.diceEngine.on('roll-end', () => this._onRollEnd());

        // Override dice clicks for Farkle selection mode
        this._bindDiceClicks();

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

        const wrapper = document.createElement('div');
        wrapper.className = 'container';

        wrapper.innerHTML = `
            <header>
                <h1>🎯 FARKLE</h1>
                <button class="menu-btn" id="menuBtn">☰</button>
            </header>
        `;

        const gameScreen = document.createElement('div');
        gameScreen.className = 'farkle-screen';

        gameScreen.innerHTML = `
            <div class="farkle-layout">
                <div class="players-bar" id="playersBar"></div>
                <div class="farkle-turn-info" id="turnInfo"></div>
                <div class="farkle-dice-area">
                    <div id="diceContainer"></div>
                    <div class="farkle-dice-hint" id="diceHint">Tocca "Lancia Dadi" per iniziare</div>
                </div>
                <div class="farkle-scoring-hints" id="scoringHints"></div>
            </div>
            <div class="fixed-action farkle-actions" id="actionBar">
                <button class="btn btn-action btn-roll" id="rollBtn">🎲 LANCIA DADI</button>
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
        this.rulesModal.setContent(`
            <div class="winner-title" style="font-size: 1.5rem;">📜 Regole Farkle</div>
            <div style="text-align: left; font-size: 0.85rem; line-height: 1.6; margin: 20px 0; max-height: 55vh; overflow-y: auto;">
                <strong style="color: var(--primary);">OBIETTIVO:</strong><br>
                Raggiungere <strong>10.000 punti</strong> prima degli altri!<br><br>
                <strong style="color: var(--primary);">TURNO:</strong><br>
                1. Lancia tutti i dadi disponibili<br>
                2. Seleziona almeno una combinazione valida<br>
                3. Scegli: <strong>BANCA</strong> (tieni i punti) o <strong>RILANCIA</strong> (rischia!)<br><br>
                <strong style="color: var(--primary);">FARKLE:</strong><br>
                Se non ci sono combinazioni valide, perdi tutti i punti del turno!<br><br>
                <strong style="color: var(--primary);">HOT DICE:</strong><br>
                Se usi tutti e 6 i dadi, li rilanci tutti mantenendo i punti!<br><br>
                <strong style="color: var(--primary);">REGOLA DEL 350:</strong><br>
                Dopo il 3° lancio, se hai meno di 350 punti nel turno, perdi tutto!<br><br>
                <strong style="color: var(--primary);">PUNTEGGI:</strong><br>
                • Singolo 1 = 100 • Singolo 5 = 50<br>
                • Tris di 1 = 1000 • Tris di X = X×100<br>
                • Poker = 2× tris • Cinque uguali = 4× tris<br>
                • Sei uguali = 8× tris<br>
                • Scala 1-2-3-4-5-6 = 1000<br>
                • Tre coppie = 1500 • Due tris = 2500<br><br>
                <strong style="color: var(--primary);">SCALA PARZIALE (5/6):</strong><br>
                Se hai 5 valori su 6 per la scala, puoi tentare lanciando 1 dado!<br><br>
                <strong style="color: var(--primary);">FINE PARTITA:</strong><br>
                Chi raggiunge 10.000, gli altri hanno un ultimo turno. Vince il punteggio più alto!
            </div>
            <button class="btn btn-primary" id="closeRulesBtn">Ho capito!</button>
        `);

        // History Modal
        this.historyModal = new Modal({ id: 'historyModal' });
        this.historyModal.render(this.container);

        // Winner Modal
        this.winnerModal = new Modal({ id: 'winnerModal', closeOnOverlayClick: false });
        this.winnerModal.render(this.container);

        // Cache UI refs
        this.ui = {
            diceContainer: gameScreen.querySelector('#diceContainer'),
            diceHint: gameScreen.querySelector('#diceHint'),
            rollBtn: gameScreen.querySelector('#rollBtn'),
            actionBar: gameScreen.querySelector('#actionBar'),
            playersBar: gameScreen.querySelector('#playersBar'),
            turnInfo: gameScreen.querySelector('#turnInfo'),
            scoringHints: gameScreen.querySelector('#scoringHints')
        };

        // Button event
        wrapper.querySelector('#menuBtn').addEventListener('click', () => this.menu.toggle());
        this.ui.actionBar.addEventListener('click', (e) => this._handleActionClick(e));

        // Rules close
        this.rulesModal.contentEl.addEventListener('click', (e) => {
            if (e.target.id === 'closeRulesBtn') this.rulesModal.hide();
        });
    }

    // ---- Dice Click Override ----

    _bindDiceClicks() {
        // DiceRenderer already added click handlers that call engine.toggleHold(i).
        // Since we set engine.rollsLeft = 0 after each roll, toggleHold will be blocked.
        // We add our own capturing handlers for Farkle selection.
        this.diceRenderer.scenes.forEach(({ scene }, i) => {
            scene.addEventListener('click', (e) => {
                e.stopImmediatePropagation();
                this._onDiceClick(i);
            }, true); // capturing phase to fire before DiceRenderer's handler
        });
    }

    _onDiceClick(index) {
        if (this.turnState !== 'selecting') return;
        if (this.setAsideDice.has(index)) return;

        // Toggle selection
        if (this.selectedDice.has(index)) {
            this.selectedDice.delete(index);
        } else {
            this.selectedDice.add(index);
        }

        this._updateDiceVisuals();
        this._updateSelectionScore();
        this._updateActionButtons();
    }

    // ---- Game Flow ----

    _startTurn() {
        this.turnScore = 0;
        this.rollCount = 0;
        this.setAsideDice = new Set();
        this.selectedDice = new Set();
        this.turnState = 'idle';
        this.straightAttemptData = null;

        // Reset dice engine
        this.diceEngine.values = new Array(6).fill(1);
        this.diceEngine.held = new Array(6).fill(false);
        this.diceEngine.rollsLeft = 1;
        this.diceEngine.hasRolled = false;
        this.diceEngine.isRolling = false;
        this.diceEngine.emit('reset', {});

        this._updateUI();
        this._setHint('Tocca "Lancia Dadi" per iniziare');
    }

    _rollDice() {
        if (this.diceEngine.isRolling) return;
        if (this.turnState !== 'idle' && this.turnState !== 'confirmed') return;

        // Prepare engine for roll
        this.diceEngine.rollsLeft = 1;
        // Mark set-aside dice as held so they don't roll
        for (let i = 0; i < 6; i++) {
            this.diceEngine.held[i] = this.setAsideDice.has(i);
        }

        this.selectedDice = new Set();
        this.rollCount++;
        this.turnState = 'rolling';

        this.diceEngine.roll();
    }

    _onRollStart() {
        this._updateActionButtons();
        this._setHint('Lanciando...');
    }

    _onRollEnd() {
        // Block toggleHold from DiceRenderer
        this.diceEngine.rollsLeft = 0;

        // Get available (non-set-aside) dice values
        const availableDice = [];
        const availableIndices = [];
        for (let i = 0; i < 6; i++) {
            if (!this.setAsideDice.has(i)) {
                availableDice.push(this.diceEngine.values[i]);
                availableIndices.push(i);
            }
        }

        // Check Farkle
        if (isFarkle(availableDice)) {
            this._handleFarkle();
            return;
        }

        // Check straight attempt possibility (only when all 6 dice are available)
        if (availableDice.length === 6) {
            const sa = detectStraightAttempt(availableDice);
            if (sa.possible) {
                this.straightAttemptData = sa;
            } else {
                this.straightAttemptData = null;
            }
        } else {
            this.straightAttemptData = null;
        }

        // Enter selecting mode
        this.turnState = 'selecting';
        this._updateUI();
        this._setHint('Seleziona i dadi che vuoi tenere');
        this._autoSave();
    }

    _handleFarkle() {
        this.turnState = 'farkle';
        this.turnScore = 0;

        // Show Farkle overlay
        const overlay = document.createElement('div');
        overlay.className = 'farkle-overlay';
        overlay.innerHTML = `
            <div class="farkle-overlay-text">FARKLE!</div>
            <div class="farkle-overlay-sub">Nessuna combinazione valida - 0 punti!</div>
        `;
        this.container.appendChild(overlay);

        setTimeout(() => {
            overlay.remove();
            this._nextPlayer();
        }, 2000);
    }

    _handleForcedFarkle() {
        this.turnState = 'farkle';
        this.turnScore = 0;

        const overlay = document.createElement('div');
        overlay.className = 'farkle-overlay';
        overlay.innerHTML = `
            <div class="farkle-overlay-text">FARKLE!</div>
            <div class="farkle-overlay-sub">3° lancio con meno di 350 punti!</div>
        `;
        this.container.appendChild(overlay);

        setTimeout(() => {
            overlay.remove();
            this._nextPlayer();
        }, 2000);
    }

    _confirmSelection() {
        if (this.turnState !== 'selecting') return;
        if (this.selectedDice.size === 0) return;

        // Get selected dice values
        const selectedValues = [];
        for (const idx of this.selectedDice) {
            selectedValues.push(this.diceEngine.values[idx]);
        }

        const score = scoreSelection(selectedValues);
        if (score === null) return; // Invalid selection

        // Add to turn score
        this.turnScore += score;

        // Move selected to set-aside
        for (const idx of this.selectedDice) {
            this.setAsideDice.add(idx);
        }
        this.selectedDice = new Set();

        // Check Hot Dice
        if (this.setAsideDice.size >= 6) {
            this._handleHotDice();
            return;
        }

        // Check 350 rule: after 3rd roll, if turn score < 350, forced Farkle
        if (this.rollCount >= 3 && this.turnScore < MIN_SCORE_3RD_ROLL) {
            this._handleForcedFarkle();
            return;
        }

        this.turnState = 'confirmed';
        this._updateUI();
        this._setHint('Banca o rilancia!');
        this._autoSave();
    }

    _handleHotDice() {
        // Show Hot Dice overlay
        const overlay = document.createElement('div');
        overlay.className = 'farkle-hotdice-overlay';
        overlay.innerHTML = `
            <div class="farkle-hotdice-text">🔥 HOT DICE! 🔥</div>
            <div class="farkle-hotdice-sub">Tutti i dadi usati! Rilancia tutti e 6!</div>
        `;
        this.container.appendChild(overlay);

        // Reset dice for new round
        this.setAsideDice = new Set();

        setTimeout(() => {
            overlay.remove();
            // Reset engine for fresh roll of all 6
            this.diceEngine.values = new Array(6).fill(1);
            this.diceEngine.held = new Array(6).fill(false);
            this.diceEngine.rollsLeft = 1;
            this.diceEngine.hasRolled = false;
            this.diceEngine.emit('reset', {});

            this.turnState = 'confirmed';
            this._updateUI();
            this._setHint('🔥 Hot Dice! Rilancia tutti e 6 i dadi!');
            this._autoSave();
        }, 1800);
    }

    _bank() {
        if (this.turnState !== 'confirmed') return;

        const p = this.players[this.currentPlayerIndex];
        p.totalScore += this.turnScore;

        // Check if player reached target
        if (p.totalScore >= TARGET_SCORE && !this.finalRound) {
            this.finalRound = true;
            this.finalRoundTriggerPlayer = this.currentPlayerIndex;
        }

        this._autoSave();
        this._nextPlayer();
    }

    _attemptStraight() {
        if (!this.straightAttemptData || this.turnState !== 'selecting') return;

        this.turnState = 'straightAttempt';

        // Set aside 5 dice (all except the duplicate value's second occurrence)
        const missingVal = this.straightAttemptData.missingValue;
        const values = this.diceEngine.getValues();

        // Find the duplicate value
        const freq = {};
        for (const v of values) freq[v] = (freq[v] || 0) + 1;
        const dupVal = Object.keys(freq).map(Number).find(v => freq[v] === 2);

        // Set aside all dice except one of the duplicates
        let keptDupIdx = -1;
        for (let i = 0; i < 6; i++) {
            if (values[i] === dupVal && keptDupIdx === -1) {
                keptDupIdx = i; // This die will be rerolled
            } else {
                this.setAsideDice.add(i);
            }
        }

        this.selectedDice = new Set();
        this._updateDiceVisuals();

        // Roll the single remaining die
        this.diceEngine.held = new Array(6).fill(false);
        for (let i = 0; i < 6; i++) {
            this.diceEngine.held[i] = this.setAsideDice.has(i);
        }
        this.diceEngine.rollsLeft = 1;
        this.rollCount++;

        // Override roll-end to check straight completion
        const straightHandler = () => {
            this.diceEngine.off('roll-end', straightHandler);
            this.diceEngine.rollsLeft = 0;

            const newVal = this.diceEngine.values[keptDupIdx];
            if (newVal === missingVal) {
                // Straight completed!
                this.turnScore += STRAIGHT_SCORE;
                this.setAsideDice = new Set([0, 1, 2, 3, 4, 5]); // all used
                this.straightAttemptData = null;

                // Hot Dice since all 6 are used
                this._handleHotDice();
            } else {
                // Failed - Farkle
                this.straightAttemptData = null;
                this._handleFarkle();
            }
        };

        this.diceEngine.on('roll-end', straightHandler);
        this.diceEngine.roll();

        this._setHint(`Tentativo di scala... serve un ${missingVal}!`);
    }

    _nextPlayer() {
        // Check if game is over
        if (this.finalRound) {
            this.playersHadFinalTurn.add(this.currentPlayerIndex);

            // Check if all other players (except trigger) have had their final turn
            const allDone = this.players.every((_, i) =>
                i === this.finalRoundTriggerPlayer || this.playersHadFinalTurn.has(i)
            );

            if (allDone) {
                this._endGame();
                return;
            }
        }

        // Advance to next player
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

        // Skip the trigger player in the final round (they already banked)
        if (this.finalRound && this.currentPlayerIndex === this.finalRoundTriggerPlayer) {
            this.playersHadFinalTurn.add(this.currentPlayerIndex);
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;

            // Double-check if all done
            const allDone = this.players.every((_, i) =>
                i === this.finalRoundTriggerPlayer || this.playersHadFinalTurn.has(i)
            );
            if (allDone) {
                this._endGame();
                return;
            }
        }

        this._startTurn();
        this._autoSave();
    }

    _endGame() {
        let maxScore = -1;
        let winners = [];

        this.players.forEach(p => {
            if (p.totalScore > maxScore) {
                maxScore = p.totalScore;
                winners = [p];
            } else if (p.totalScore === maxScore) {
                winners.push(p);
            }
        });

        // Save to history
        const duration = Math.round((Date.now() - this.gameStartTime) / 1000);
        gameHistory.addMatchToHistory({
            gameType: 'farkle',
            players: this.players.map(p => ({
                name: p.name,
                finalScore: p.totalScore,
                isWinner: winners.includes(p)
            })),
            duration
        });

        // Update profiles
        this.players.forEach(p => {
            gameHistory.updatePlayerProfile(p.name, p.color, {
                score: p.totalScore,
                isWinner: winners.includes(p)
            });
        });

        // Remove from active games
        gameHistory.removeActiveGame(this.gameId);

        // Show winner
        const winnerName = winners.length > 1 ? 'Pareggio!' : winners[0].name;
        const winnerColor = winners.length === 1 ? winners[0].color : 'var(--primary)';

        this.winnerModal.setContent(`
            <div class="winner-title">🏆 Vincitore!</div>
            <div class="winner-name" style="color: ${winnerColor}">${winnerName}</div>
            <div class="winner-score">${maxScore}</div>
            <div style="font-size: 0.85rem; color: #888; margin-bottom: 15px;">punti</div>
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
        this.gameId = this._generateGameId();
        this.players.forEach(p => { p.totalScore = 0; });
        this.currentPlayerIndex = 0;
        this.gameStartTime = Date.now();
        this.finalRound = false;
        this.finalRoundTriggerPlayer = -1;
        this.playersHadFinalTurn = new Set();
        this._startTurn();
    }

    // ---- UI Updates ----

    _updateUI() {
        this._updatePlayersBar();
        this._updateTurnInfo();
        this._updateDiceVisuals();
        this._updateScoringHints();
        this._updateActionButtons();
    }

    _updatePlayersBar() {
        FarkleUI.renderPlayersBar(
            this.ui.playersBar,
            this.players,
            this.currentPlayerIndex,
            this.finalRound
        );
    }

    _updateTurnInfo() {
        FarkleUI.renderTurnInfo(this.ui.turnInfo, {
            turnScore: this.turnScore,
            rollCount: this.rollCount,
            turnState: this.turnState,
            currentPlayer: this.players[this.currentPlayerIndex]
        });
    }

    _updateDiceVisuals() {
        this.diceRenderer.scenes.forEach(({ scene }, i) => {
            // Clear all farkle classes
            scene.classList.remove('farkle-selected', 'farkle-aside', 'farkle-scorable', 'farkle-not-scorable');

            if (this.setAsideDice.has(i)) {
                scene.classList.add('farkle-aside');
            } else if (this.selectedDice.has(i)) {
                scene.classList.add('farkle-selected');
            } else if (this.turnState === 'selecting') {
                // Determine if this die is scorable
                const availableDice = [];
                const availableIndices = [];
                for (let j = 0; j < 6; j++) {
                    if (!this.setAsideDice.has(j)) {
                        availableDice.push(this.diceEngine.values[j]);
                        availableIndices.push(j);
                    }
                }
                const scorable = findScorableDiceIndices(availableDice, availableIndices);
                if (scorable.has(i)) {
                    scene.classList.add('farkle-scorable');
                } else {
                    scene.classList.add('farkle-not-scorable');
                }
            }
        });
    }

    _updateScoringHints() {
        if (this.turnState !== 'selecting') {
            this.ui.scoringHints.innerHTML = '';

            // Show 350 warning if approaching 3rd roll
            if (this.turnState === 'confirmed' && this.rollCount >= 2 && this.turnScore < MIN_SCORE_3RD_ROLL) {
                this.ui.scoringHints.innerHTML = `
                    <div class="farkle-warning-350">
                        ⚠️ Attenzione: al 3° lancio servono almeno 350 punti nel turno!
                        (Attuale: ${this.turnScore})
                    </div>
                `;
            }
            return;
        }

        // Get available dice
        const availableDice = [];
        for (let i = 0; i < 6; i++) {
            if (!this.setAsideDice.has(i)) {
                availableDice.push(this.diceEngine.values[i]);
            }
        }

        const combos = getAvailableCombinations(availableDice);
        const selScore = this._getSelectionScore();

        FarkleUI.renderScoringHints(this.ui.scoringHints, combos, selScore);
    }

    _updateSelectionScore() {
        // Real-time update of selection score in hints
        this._updateScoringHints();
    }

    _getSelectionScore() {
        if (this.selectedDice.size === 0) return null;
        const selectedValues = [];
        for (const idx of this.selectedDice) {
            selectedValues.push(this.diceEngine.values[idx]);
        }
        return scoreSelection(selectedValues);
    }

    _updateActionButtons() {
        const bar = this.ui.actionBar;

        switch (this.turnState) {
            case 'idle':
                bar.innerHTML = `<button class="btn btn-action btn-roll" data-action="roll">🎲 LANCIA DADI</button>`;
                break;

            case 'rolling':
            case 'straightAttempt':
                bar.innerHTML = `<button class="btn btn-action btn-roll" disabled>🎲 LANCIANDO...</button>`;
                break;

            case 'selecting': {
                const selScore = this._getSelectionScore();
                const isValid = selScore !== null && selScore > 0;
                let html = `<button class="btn btn-confirm" data-action="confirm" ${isValid ? '' : 'disabled'}>
                    ✅ CONFERMA${selScore ? ' (+' + selScore + ')' : ''}
                </button>`;

                // Straight attempt button
                if (this.straightAttemptData) {
                    html += `<button class="btn farkle-straight-btn" data-action="straight">
                        🎯 Tenta Scala (serve ${this.straightAttemptData.missingValue})
                    </button>`;
                }
                bar.innerHTML = html;
                break;
            }

            case 'confirmed': {
                const remaining = 6 - this.setAsideDice.size;
                bar.innerHTML = `
                    <button class="btn btn-bank" data-action="bank">🏦 BANCA (${this.turnScore})</button>
                    <button class="btn btn-roll" data-action="roll">🎲 RILANCIA (${remaining})</button>
                `;
                break;
            }

            case 'farkle':
                bar.innerHTML = `<button class="btn btn-action" disabled>💀 FARKLE</button>`;
                break;

            default:
                bar.innerHTML = '';
        }
    }

    _setHint(text) {
        if (this.ui.diceHint) {
            this.ui.diceHint.textContent = text;
        }
    }

    _handleActionClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;

        const action = btn.dataset.action;
        switch (action) {
            case 'roll': this._rollDice(); break;
            case 'confirm': this._confirmSelection(); break;
            case 'bank': this._bank(); break;
            case 'straight': this._attemptStraight(); break;
        }
    }

    // ---- Menu Actions ----

    _handleMenuAction(id) {
        switch (id) {
            case 'rules':
                this.rulesModal.show();
                break;
            case 'history':
                this.historyModal.setContent(`
                    <div class="winner-title" style="font-size: 1.5rem;">📊 Storico Partite</div>
                    <div style="margin: 15px 0;">
                        ${FarkleUI.renderMatchHistory('farkle')}
                    </div>
                    <button class="btn btn-primary" id="closeHistoryBtn">Chiudi</button>
                `);
                this.historyModal.show();
                this.historyModal.contentEl.querySelector('#closeHistoryBtn')
                    .addEventListener('click', () => this.historyModal.hide());
                break;
            case 'newGame':
                if (confirm('Nuova partita con gli stessi giocatori?')) {
                    gameHistory.removeActiveGame(this.gameId);
                    this._restartGame();
                }
                break;
            case 'home':
                if (confirm('Tornare alla schermata iniziale? La partita verrà salvata.')) {
                    this._autoSave();
                    this.destroy();
                    this.onExit();
                }
                break;
        }
    }

    // ---- Save/Restore ----

    _autoSave() {
        gameHistory.saveActiveGame({
            gameId: this.gameId,
            gameType: 'farkle',
            players: this.players.map(p => ({
                name: p.name,
                color: p.color,
                totalScore: p.totalScore
            })),
            currentPlayerIndex: this.currentPlayerIndex,
            turnScore: this.turnScore,
            rollCount: this.rollCount,
            setAsideDice: [...this.setAsideDice],
            selectedDice: [...this.selectedDice],
            turnState: this.turnState,
            finalRound: this.finalRound,
            finalRoundTriggerPlayer: this.finalRoundTriggerPlayer,
            playersHadFinalTurn: [...this.playersHadFinalTurn],
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
            totalScore: p.totalScore || 0
        }));
        this.currentPlayerIndex = state.currentPlayerIndex;
        this.gameStartTime = state.gameStartTime || Date.now();

        // Restore turn state
        this.turnScore = state.turnScore || 0;
        this.rollCount = state.rollCount || 0;
        this.setAsideDice = new Set(state.setAsideDice || []);
        this.selectedDice = new Set(state.selectedDice || []);
        this.turnState = state.turnState || 'idle';

        // Restore final round
        this.finalRound = state.finalRound || false;
        this.finalRoundTriggerPlayer = state.finalRoundTriggerPlayer ?? -1;
        this.playersHadFinalTurn = new Set(state.playersHadFinalTurn || []);

        // Restore dice
        if (state.dice) {
            this.diceEngine.restoreState(state.dice);
        }
        // Block toggleHold
        this.diceEngine.rollsLeft = 0;

        this._updateUI();

        // Restore hint
        const hints = {
            idle: 'Tocca "Lancia Dadi" per iniziare',
            selecting: 'Seleziona i dadi che vuoi tenere',
            confirmed: 'Banca o rilancia!',
            farkle: 'FARKLE!'
        };
        this._setHint(hints[this.turnState] || '');

        // If restoring to idle, allow rolling
        if (this.turnState === 'idle' || this.turnState === 'confirmed') {
            // Ready for next action
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

export default FarkleGame;
