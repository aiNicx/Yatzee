/* ========================================
   FarkleUI - Static Rendering Methods
   Generates HTML for Farkle game components.
   ======================================== */

import { gameHistory } from '../../services/GameHistoryService.js';

export class FarkleUI {

    /**
     * Render the players bar showing all players and scores.
     */
    static renderPlayersBar(container, players, currentPlayerIndex, finalRound) {
        container.innerHTML = players.map((p, i) => `
            <div class="player-chip ${i === currentPlayerIndex ? 'active' : ''}" style="border-left-color: ${p.color}">
                ${p.name}
                <span class="score">${p.totalScore}</span>
                ${finalRound && i === currentPlayerIndex ? '<span class="farkle-final-badge">ULTIMO</span>' : ''}
            </div>
        `).join('');
    }

    /**
     * Render turn info area (turn score, roll count).
     */
    static renderTurnInfo(container, { turnScore, rollCount, turnState, currentPlayer }) {
        const stateLabels = {
            rolling: 'Lancia i dadi!',
            selecting: 'Seleziona i dadi che vuoi tenere',
            confirmed: 'Banca o rilancia!',
            farkle: 'FARKLE! Nessun punto!',
            bank: 'Punti aggiunti al totale!',
            straightAttempt: 'Tentativo di scala...'
        };

        container.innerHTML = `
            <div class="farkle-turn-header">
                <div class="farkle-current-player" style="background: ${currentPlayer.color}">
                    ${currentPlayer.name}
                </div>
                <div class="farkle-roll-count">
                    Lancio #${rollCount}
                </div>
            </div>
            <div class="farkle-turn-score-area">
                <div class="farkle-turn-score ${turnScore > 0 ? 'has-points' : ''}">
                    ${turnScore}
                </div>
                <div class="farkle-turn-label">punti nel turno</div>
            </div>
            <div class="farkle-turn-state">${stateLabels[turnState] || ''}</div>
        `;
    }

    /**
     * Render scoring hints (available combos).
     */
    static renderScoringHints(container, combos, selectionScore) {
        if (!combos || combos.length === 0) {
            container.innerHTML = '';
            return;
        }

        let html = '<div class="farkle-hints-title">Combinazioni disponibili:</div><div class="farkle-hints-list">';
        for (const c of combos) {
            html += `<span class="farkle-hint-chip">${c.name} <strong>${c.score}</strong></span>`;
        }
        html += '</div>';

        if (selectionScore !== null && selectionScore > 0) {
            html += `<div class="farkle-selection-score">Selezione: <strong>+${selectionScore}</strong></div>`;
        }

        container.innerHTML = html;
    }

    /**
     * Render match history filtered by game type.
     */
    static renderMatchHistory(gameType) {
        const matches = gameHistory.getMatchHistory().filter(m => m.gameType === gameType);

        if (matches.length === 0) {
            return `
                <div class="farkle-history-empty">
                    Nessuna partita completata ancora.
                </div>
            `;
        }

        let html = '<div class="farkle-history-list">';
        matches.slice(0, 20).forEach(match => {
            const winner = match.players.find(p => p.isWinner);
            const dateStr = gameHistory.formatDate(match.date);
            html += `
                <div class="farkle-history-item">
                    <div class="farkle-history-info">
                        <div class="farkle-history-date">${dateStr}</div>
                        <div class="farkle-history-players">${match.players.map(p => p.name).join(', ')}</div>
                    </div>
                    <div class="farkle-history-result">
                        <div class="farkle-history-winner">${winner ? '🏆 ' + winner.name : 'Pareggio'}</div>
                        <div class="farkle-history-score">${winner ? winner.finalScore + ' pts' : ''}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }
}

export default FarkleUI;
