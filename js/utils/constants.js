/* ========================================
   Shared Constants
   ======================================== */

export const PLAYER_COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', 
    '#f39c12', '#9b59b6', '#1abc9c'
];

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 1;

export const STORAGE_KEYS = {
    ACTIVE_GAME: 'diceGames_activeGame',       // legacy single-game key
    ACTIVE_GAMES: 'diceGames_activeGames',     // new multi-game key
    MATCH_HISTORY: 'diceGames_matchHistory',
    PLAYER_PROFILES: 'diceGames_playerProfiles'
};

export const CONFETTI_COLORS = [
    '#e74c3c', '#3498db', '#2ecc71', 
    '#f39c12', '#9b59b6', '#1abc9c',
    '#fd79a8', '#fdcb6e', '#6c5ce7'
];
