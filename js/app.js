/* ========================================
   App.js - Main Entry Point & Screen Router
   Manages navigation: home -> setup -> game
   ======================================== */

import { gameRegistry } from './games/GameRegistry.js';
import { YahtzeeGame } from './games/yahtzee/YahtzeeGame.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { SetupScreen } from './screens/SetupScreen.js';
import { gameHistory } from './services/GameHistoryService.js';

// ---- Register Games ----
gameRegistry.register('yahtzee', {
    name: 'Yatzee',
    icon: '🎲',
    description: 'Il classico gioco di dadi!',
    minPlayers: 1,
    maxPlayers: 6,
    createGame: (container, players, onExit, savedState) => {
        return new YahtzeeGame({ container, players, onExit, savedState });
    }
});

// ---- App Controller ----
class App {
    constructor() {
        this.container = document.getElementById('app');
        this.currentScreen = null;
        this.currentGame = null;
    }

    init() {
        this.showHome();
    }

    // ---- Navigation ----

    showHome() {
        this._cleanup();

        this.container.innerHTML = `
            <div class="container">
                <div id="screenContent"></div>
            </div>
        `;

        const content = this.container.querySelector('#screenContent');

        this.currentScreen = new HomeScreen({
            container: content,
            onSelectGame: (gameId) => this.showSetup(gameId),
            onResumeGame: (savedState) => this.resumeGame(savedState)
        });

        this.currentScreen.render();
    }

    showSetup(gameId) {
        this._cleanup();

        this.container.innerHTML = `
            <div class="container">
                <header>
                    <h1>🎲 Dice Games</h1>
                </header>
                <div id="screenContent"></div>
            </div>
        `;

        const content = this.container.querySelector('#screenContent');

        this.currentScreen = new SetupScreen({
            container: content,
            gameId,
            onStart: (players) => this.startGame(gameId, players),
            onBack: () => this.showHome()
        });

        this.currentScreen.render();
    }

    startGame(gameId, players) {
        this._cleanup();

        const gameConfig = gameRegistry.get(gameId);
        if (!gameConfig) {
            alert('Gioco non trovato!');
            this.showHome();
            return;
        }

        this.currentGame = gameConfig.createGame(
            this.container,
            players,
            () => this.showHome(),
            null // no saved state
        );
    }

    resumeGame(savedState) {
        this._cleanup();

        const gameConfig = gameRegistry.get(savedState.gameType);
        if (!gameConfig) {
            alert('Gioco non trovato!');
            this.showHome();
            return;
        }

        // Remove from active games list (game will re-save itself via autoSave)
        gameHistory.removeActiveGame(savedState.gameId);

        this.currentGame = gameConfig.createGame(
            this.container,
            savedState.players,
            () => this.showHome(),
            savedState
        );
    }

    // ---- Cleanup ----

    _cleanup() {
        if (this.currentScreen && this.currentScreen.destroy) {
            this.currentScreen.destroy();
        }
        if (this.currentGame && this.currentGame.destroy) {
            this.currentGame.destroy();
        }
        this.currentScreen = null;
        this.currentGame = null;
    }
}

// ---- Bootstrap ----
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
