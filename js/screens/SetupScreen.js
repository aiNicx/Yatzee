/* ========================================
   SetupScreen - Player Configuration
   Reusable player setup for any game.
   ======================================== */

import { PLAYER_COLORS, MAX_PLAYERS, MIN_PLAYERS } from '../utils/constants.js';
import { gameHistory } from '../services/GameHistoryService.js';
import { gameRegistry } from '../games/GameRegistry.js';

export class SetupScreen {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {string} options.gameId - Which game is being set up
     * @param {Function} options.onStart - callback(players[])
     * @param {Function} options.onBack - callback to go back to home
     */
    constructor({ container, gameId, onStart, onBack }) {
        this.container = container;
        this.gameId = gameId;
        this.onStart = onStart;
        this.onBack = onBack;

        const gameConfig = gameRegistry.get(gameId);
        this.minPlayers = gameConfig ? gameConfig.minPlayers : MIN_PLAYERS;
        this.maxPlayers = gameConfig ? gameConfig.maxPlayers : MAX_PLAYERS;
        this.gameName = gameConfig ? gameConfig.name : gameId;

        this.players = [];
        this.knownNames = gameHistory.getKnownPlayerNames();
    }

    render() {
        this.container.innerHTML = '';

        // Start with 2 players
        this.players = [];
        this._addPlayer();
        this._addPlayer();

        this._renderSetup();
    }

    _addPlayer() {
        if (this.players.length >= this.maxPlayers) return;

        // Try to get saved profile color
        const profile = gameHistory.getPlayerProfiles()[this.players.length];
        const defaultColor = PLAYER_COLORS[this.players.length % PLAYER_COLORS.length];

        this.players.push({
            name: `Giocatore ${this.players.length + 1}`,
            color: profile ? profile.color : defaultColor
        });
    }

    _removePlayer(idx) {
        if (this.players.length <= this.minPlayers) return;
        this.players.splice(idx, 1);
        this._renderSetup();
    }

    _renderSetup() {
        this.container.innerHTML = '';

        const screen = document.createElement('div');
        screen.className = 'setup-screen';

        // Header with back button
        let headerHTML = `
            <button class="setup-back-btn" id="setupBackBtn">← Indietro</button>
            <h2 class="setup-title">👥 ${this.gameName} - Giocatori</h2>
        `;

        // Players list
        let playersHTML = this.players.map((p, i) => `
            <div class="player-input" data-index="${i}">
                <div class="player-input-wrapper">
                    <input type="text" class="player-name-input" value="${p.name}" 
                           data-index="${i}" placeholder="Nome giocatore">
                </div>
                <input type="color" class="player-color" value="${p.color}" data-index="${i}">
                ${this.players.length > this.minPlayers
                    ? `<button class="btn btn-danger player-remove-btn" data-index="${i}">✕</button>`
                    : ''}
            </div>
        `).join('');

        // Buttons
        const canAdd = this.players.length < this.maxPlayers;
        let buttonsHTML = '';
        if (canAdd) {
            buttonsHTML += `<button class="btn add-player-btn" id="addPlayerBtn">+ Aggiungi Giocatore</button>`;
        }
        buttonsHTML += `<button class="btn btn-primary" id="startGameBtn">🎮 Inizia Partita</button>`;

        // Rules box
        const rulesHTML = `
            <div class="rules-box">
                <strong>Come giocare:</strong><br>
                • 3 lanci per turno<br>
                • Tocca i dadi per tenerli<br>
                • Puoi scegliere una categoria dopo ogni lancio<br>
                • Bonus 35 punti se somma alta ≥ 63
            </div>
        `;

        screen.innerHTML = headerHTML + playersHTML + buttonsHTML + rulesHTML;
        this.container.appendChild(screen);

        // Event listeners
        screen.querySelector('#setupBackBtn').addEventListener('click', () => this.onBack());

        if (canAdd) {
            screen.querySelector('#addPlayerBtn').addEventListener('click', () => {
                this._addPlayer();
                this._renderSetup();
            });
        }

        screen.querySelector('#startGameBtn').addEventListener('click', () => {
            // Read current names from inputs before starting
            this._syncPlayerNames();
            if (this.players.length < this.minPlayers) {
                alert(`Servono almeno ${this.minPlayers} giocatori!`);
                return;
            }
            this.onStart([...this.players]);
        });

        // Name inputs
        screen.querySelectorAll('.player-name-input').forEach(input => {
            const idx = parseInt(input.dataset.index);
            input.addEventListener('change', () => {
                this.players[idx].name = input.value || `Giocatore ${idx + 1}`;
            });

            // Auto-suggest from known players
            input.addEventListener('focus', () => this._showSuggestions(input, idx));
            input.addEventListener('blur', () => {
                setTimeout(() => this._hideSuggestions(input), 200);
            });
        });

        // Color inputs
        screen.querySelectorAll('.player-color').forEach(input => {
            const idx = parseInt(input.dataset.index);
            input.addEventListener('change', () => {
                this.players[idx].color = input.value;
            });
        });

        // Remove buttons
        screen.querySelectorAll('.player-remove-btn').forEach(btn => {
            const idx = parseInt(btn.dataset.index);
            btn.addEventListener('click', () => this._removePlayer(idx));
        });
    }

    _syncPlayerNames() {
        const inputs = this.container.querySelectorAll('.player-name-input');
        inputs.forEach((input, i) => {
            if (i < this.players.length) {
                this.players[i].name = input.value || `Giocatore ${i + 1}`;
            }
        });
    }

    _showSuggestions(input, playerIndex) {
        const wrapper = input.closest('.player-input-wrapper');
        if (!wrapper) return;

        // Remove existing suggestions
        const existing = wrapper.querySelector('.player-suggestions');
        if (existing) existing.remove();

        if (this.knownNames.length === 0) return;

        const usedNames = this.players.map(p => p.name.toLowerCase());
        const suggestions = this.knownNames.filter(
            name => !usedNames.includes(name.toLowerCase()) || name.toLowerCase() === this.players[playerIndex].name.toLowerCase()
        );

        if (suggestions.length === 0) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'player-suggestions visible';

        suggestions.forEach(name => {
            const item = document.createElement('div');
            item.className = 'player-suggestion-item';
            item.textContent = name;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = name;
                this.players[playerIndex].name = name;

                // Also set the profile color
                const profile = gameHistory.getPlayerProfile(name);
                if (profile) {
                    this.players[playerIndex].color = profile.color;
                    const colorInput = wrapper.parentElement.querySelector('.player-color');
                    if (colorInput) colorInput.value = profile.color;
                }
                this._hideSuggestions(input);
            });
            dropdown.appendChild(item);
        });

        wrapper.appendChild(dropdown);
    }

    _hideSuggestions(input) {
        const wrapper = input.closest('.player-input-wrapper');
        if (!wrapper) return;
        const dropdown = wrapper.querySelector('.player-suggestions');
        if (dropdown) dropdown.remove();
    }

    destroy() {
        this.container.innerHTML = '';
    }
}

export default SetupScreen;
