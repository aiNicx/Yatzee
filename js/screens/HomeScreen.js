/* ========================================
   HomeScreen - Game Selection & History
   First screen users see. Scalable for multiple games.
   ======================================== */

import { gameRegistry } from '../games/GameRegistry.js';
import { gameHistory } from '../services/GameHistoryService.js';

export class HomeScreen {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {Function} options.onSelectGame - callback(gameId)
     * @param {Function} options.onResumeGame - callback(savedState)
     */
    constructor({ container, onSelectGame, onResumeGame }) {
        this.container = container;
        this.onSelectGame = onSelectGame;
        this.onResumeGame = onResumeGame;
    }

    render() {
        this.container.innerHTML = '';

        const screen = document.createElement('div');
        screen.className = 'home-screen';

        const activeGames = gameHistory.getActiveGames();
        const recentMatches = gameHistory.getRecentMatches(5);
        const games = gameRegistry.getAll();

        // Logo
        screen.innerHTML = `
            <div class="home-logo">
                <h2>🎲 Dice Games</h2>
                <p>Scegli un gioco e divertiti!</p>
            </div>
        `;

        // Resume banners (one per suspended game)
        if (activeGames.length > 0) {
            const resumeSection = document.createElement('div');
            resumeSection.className = 'resume-section';

            const resumeTitle = document.createElement('div');
            resumeTitle.className = 'games-section-title';
            resumeTitle.textContent = activeGames.length === 1 ? 'Partita in sospeso' : 'Partite in sospeso';
            resumeSection.appendChild(resumeTitle);

            activeGames.forEach(savedGame => {
                const resumeEl = document.createElement('div');
                resumeEl.className = 'resume-banner';
                const gameConfig = gameRegistry.get(savedGame.gameType);
                const gameName = gameConfig ? gameConfig.name : savedGame.gameType;
                const playerNames = savedGame.players.map(p => p.name).join(', ');
                const savedDate = savedGame.savedAt
                    ? gameHistory.formatDate(savedGame.savedAt)
                    : '';

                resumeEl.innerHTML = `
                    <div class="resume-banner-icon">▶️</div>
                    <div class="resume-banner-text">
                        <h3>Continua partita - ${gameName}</h3>
                        <p>${playerNames}${savedDate ? ' • ' + savedDate : ''}</p>
                    </div>
                    <div class="resume-banner-actions">
                        <button class="resume-btn" data-action="resume">Riprendi</button>
                        <button class="resume-btn discard" data-action="discard">✕</button>
                    </div>
                `;

                resumeEl.querySelector('[data-action="resume"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onResumeGame(savedGame);
                });

                resumeEl.querySelector('[data-action="discard"]').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Sei sicuro di voler eliminare questa partita salvata?')) {
                        gameHistory.removeActiveGame(savedGame.gameId);
                        this.render();
                    }
                });

                resumeSection.appendChild(resumeEl);
            });

            screen.appendChild(resumeSection);
        }

        // Games section
        const gamesTitle = document.createElement('div');
        gamesTitle.className = 'games-section-title';
        gamesTitle.textContent = 'Giochi disponibili';
        screen.appendChild(gamesTitle);

        const gamesGrid = document.createElement('div');
        gamesGrid.className = 'games-grid';

        games.forEach(game => {
            const card = document.createElement('button');
            card.className = 'game-card';
            card.innerHTML = `
                <div class="game-card-icon">${game.icon}</div>
                <div class="game-card-name">${game.name}</div>
                <div class="game-card-desc">${game.description}</div>
            `;
            card.addEventListener('click', () => this.onSelectGame(game.id));
            gamesGrid.appendChild(card);
        });

        // "Coming soon" placeholder card
        const comingSoon = document.createElement('div');
        comingSoon.className = 'game-card coming-soon';
        comingSoon.innerHTML = `
            <div class="game-card-icon">🎯</div>
            <div class="game-card-name">Prossimamente</div>
            <div class="game-card-desc">Altri giochi in arrivo...</div>
            <div class="game-card-badge">Soon</div>
        `;
        gamesGrid.appendChild(comingSoon);

        screen.appendChild(gamesGrid);

        // Match history
        if (recentMatches.length > 0) {
            const historySection = document.createElement('div');
            historySection.className = 'history-section';

            const historyTitle = document.createElement('div');
            historyTitle.className = 'history-section-title';
            historyTitle.textContent = 'Ultime partite';
            historySection.appendChild(historyTitle);

            const historyList = document.createElement('div');
            historyList.className = 'history-list';

            recentMatches.forEach(match => {
                const winner = match.players.find(p => p.isWinner);
                const item = document.createElement('div');
                item.className = 'history-item';
                item.innerHTML = `
                    <div class="history-item-info">
                        <div class="history-item-game">${this._getGameName(match.gameType)}</div>
                        <div class="history-item-date">${gameHistory.formatDate(match.date)}</div>
                        <div class="history-item-players">${match.players.map(p => p.name).join(', ')}</div>
                    </div>
                    <div class="history-item-winner">
                        <div class="history-item-winner-name">${winner ? '🏆 ' + winner.name : 'Pareggio'}</div>
                        <div class="history-item-winner-score">${winner ? winner.finalScore + ' punti' : ''}</div>
                    </div>
                `;
                historyList.appendChild(item);
            });

            historySection.appendChild(historyList);
            screen.appendChild(historySection);
        } else {
            const noHistory = document.createElement('div');
            noHistory.className = 'no-history';
            noHistory.textContent = 'Nessuna partita ancora giocata. Inizia subito!';
            screen.appendChild(noHistory);
        }

        this.container.appendChild(screen);
    }

    _getGameName(gameType) {
        const config = gameRegistry.get(gameType);
        return config ? config.name : gameType;
    }

    destroy() {
        this.container.innerHTML = '';
    }
}

export default HomeScreen;
