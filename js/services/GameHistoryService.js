/* ========================================
   GameHistoryService
   Manages active game save/resume, match history, player profiles
   ======================================== */

import { storage } from './StorageService.js';
import { STORAGE_KEYS } from '../utils/constants.js';

class GameHistoryService {

    // ---- Active Games (save/resume - supports multiple) ----

    /**
     * Get all active (suspended) games.
     * Handles migration from old single-game format.
     * @returns {Array} Array of saved game states
     */
    getActiveGames() {
        const games = storage.get(STORAGE_KEYS.ACTIVE_GAMES, null);
        if (games !== null) return games;

        // Migrate from old single-game format if present
        const oldGame = storage.get(STORAGE_KEYS.ACTIVE_GAME, null);
        if (oldGame) {
            if (!oldGame.gameId) oldGame.gameId = this._generateId();
            const migrated = [oldGame];
            storage.set(STORAGE_KEYS.ACTIVE_GAMES, migrated);
            storage.remove(STORAGE_KEYS.ACTIVE_GAME);
            return migrated;
        }

        return [];
    }

    /**
     * Save or update an active game by its gameId.
     * @param {Object} gameState - Must include gameId
     */
    saveActiveGame(gameState) {
        if (!gameState.gameId) {
            gameState.gameId = this._generateId();
        }
        const games = this.getActiveGames();
        const data = {
            ...gameState,
            savedAt: new Date().toISOString()
        };
        const idx = games.findIndex(g => g.gameId === data.gameId);
        if (idx >= 0) {
            games[idx] = data;
        } else {
            games.push(data);
        }
        return storage.set(STORAGE_KEYS.ACTIVE_GAMES, games);
    }

    /**
     * Remove a specific active game by its gameId.
     * @param {string} gameId
     */
    removeActiveGame(gameId) {
        const games = this.getActiveGames();
        const filtered = games.filter(g => g.gameId !== gameId);
        storage.set(STORAGE_KEYS.ACTIVE_GAMES, filtered);
    }

    /**
     * Legacy: get the first active game (backward compat).
     */
    getActiveGame() {
        const games = this.getActiveGames();
        return games.length > 0 ? games[0] : null;
    }

    /**
     * Legacy: clear all active games.
     */
    clearActiveGame() {
        storage.set(STORAGE_KEYS.ACTIVE_GAMES, []);
        storage.remove(STORAGE_KEYS.ACTIVE_GAME); // also clean old key
    }

    hasActiveGames() {
        return this.getActiveGames().length > 0;
    }

    // ---- Match History ----

    getMatchHistory() {
        return storage.get(STORAGE_KEYS.MATCH_HISTORY, []);
    }

    addMatchToHistory(match) {
        const history = this.getMatchHistory();
        const entry = {
            id: this._generateId(),
            date: new Date().toISOString(),
            ...match
        };
        history.unshift(entry); // newest first
        // Keep max 50 matches
        if (history.length > 50) history.length = 50;
        storage.set(STORAGE_KEYS.MATCH_HISTORY, history);
        return entry;
    }

    getRecentMatches(count = 5) {
        return this.getMatchHistory().slice(0, count);
    }

    clearHistory() {
        storage.set(STORAGE_KEYS.MATCH_HISTORY, []);
    }

    // ---- Player Profiles ----

    getPlayerProfiles() {
        return storage.get(STORAGE_KEYS.PLAYER_PROFILES, []);
    }

    getPlayerProfile(name) {
        const profiles = this.getPlayerProfiles();
        return profiles.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
    }

    updatePlayerProfile(name, color, gameResult) {
        const profiles = this.getPlayerProfiles();
        let profile = profiles.find(p => p.name.toLowerCase() === name.toLowerCase());

        if (!profile) {
            profile = {
                name,
                color,
                stats: {
                    gamesPlayed: 0,
                    wins: 0,
                    avgScore: 0,
                    bestScore: 0,
                    totalScore: 0,
                    yahtzeeCount: 0
                }
            };
            profiles.push(profile);
        }

        // Update color to latest
        profile.color = color;

        if (gameResult) {
            const s = profile.stats;
            s.gamesPlayed++;
            if (gameResult.isWinner) s.wins++;
            s.totalScore += gameResult.score;
            s.avgScore = Math.round(s.totalScore / s.gamesPlayed);
            if (gameResult.score > s.bestScore) s.bestScore = gameResult.score;
            if (gameResult.yahtzeeCount) s.yahtzeeCount += gameResult.yahtzeeCount;
        }

        storage.set(STORAGE_KEYS.PLAYER_PROFILES, profiles);
        return profile;
    }

    getKnownPlayerNames() {
        return this.getPlayerProfiles().map(p => p.name);
    }

    // ---- Utilities ----

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }

    formatDate(isoString) {
        const d = new Date(isoString);
        return d.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

export const gameHistory = new GameHistoryService();
export default GameHistoryService;
