/* ========================================
   GameRegistry
   Central registry for all available games.
   Add new games by calling register().
   ======================================== */

class GameRegistry {
    constructor() {
        this._games = new Map();
    }

    /**
     * Register a game.
     * @param {string} id - Unique game identifier (e.g. 'yahtzee')
     * @param {Object} config
     * @param {string} config.name - Display name
     * @param {string} config.icon - Emoji or icon
     * @param {string} config.description - Short description
     * @param {number} config.minPlayers
     * @param {number} config.maxPlayers
     * @param {Function} config.createGame - Factory: (app, players) => GameController
     */
    register(id, config) {
        this._games.set(id, { id, ...config });
    }

    get(id) {
        return this._games.get(id) || null;
    }

    getAll() {
        return Array.from(this._games.values());
    }

    has(id) {
        return this._games.has(id);
    }
}

export const gameRegistry = new GameRegistry();
export default GameRegistry;
