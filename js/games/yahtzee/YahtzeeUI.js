/* ========================================
   YahtzeeUI - Scoreboard Rendering
   Static helper class for Yahtzee-specific UI rendering
   ======================================== */

import { calculateUpperSum, calculateTotal } from './YahtzeeScoring.js';

export class YahtzeeUI {
    /**
     * Render the scoreboard
     * @param {Object} opts
     * @param {HTMLElement} opts.scoreList - Container element
     * @param {Array} opts.players
     * @param {number} opts.currentPlayerIndex
     * @param {Array} opts.categories
     * @param {number[]} opts.diceValues
     * @param {boolean} opts.canSelect
     */
    static renderScoreboard({ scoreList, players, currentPlayerIndex, categories, diceValues, canSelect }) {
        let html = '';
        let lastType = '';

        // Header
        html += `<div class="score-item header">
            <div class="cat-name">Categoria</div>
            <div class="scores-row">
                ${players.map(p => `<div class="player-score" style="color: ${p.color}">${p.name.substring(0, 3)}</div>`).join('')}
            </div>
        </div>`;

        categories.forEach(cat => {
            // Section dividers
            if (cat.type !== lastType && cat.type !== 'bonus') {
                html += `<div class="score-item section">${cat.type === 'upper' ? 'Parte Alta' : 'Parte Bassa'}</div>`;
                lastType = cat.type;
            }

            if (cat.id === 'bonus') {
                html += `<div class="score-item section">Bonus</div>`;
            }

            html += `<div class="score-item">
                <div class="cat-name">${cat.name}</div>
                <div class="scores-row">`;

            players.forEach((p, idx) => {
                const isCurrent = idx === currentPlayerIndex;
                const hasScore = p.scores[cat.id] !== undefined;

                if (cat.type === 'bonus') {
                    const sum = calculateUpperSum(p);
                    const hasBonus = sum >= 63;
                    html += `<div class="player-score ${hasBonus ? 'bonus-yes' : 'bonus-no'}">
                        ${hasBonus ? '35 ✓' : sum + '/63'}
                    </div>`;
                } else if (hasScore) {
                    html += `<div class="player-score filled">${p.scores[cat.id]}</div>`;
                } else if (isCurrent && canSelect) {
                    const val = cat.calc(diceValues);
                    html += `<div class="player-score potential" data-cat-id="${cat.id}">${val}</div>`;
                } else {
                    html += `<div class="player-score empty">-</div>`;
                }
            });

            html += `</div></div>`;

            // Upper section total
            if (cat.id === 'sixes') {
                html += `<div class="score-item" style="background: #e9ecef;">
                    <div class="cat-name">Totale Alto</div>
                    <div class="scores-row">
                        ${players.map(p => `<div class="player-score">${calculateUpperSum(p)}</div>`).join('')}
                    </div>
                </div>`;
            }
        });

        // Grand Total
        html += `<div class="score-item total">
            <div class="cat-name">TOTALE FINALE</div>
            <div class="scores-row">
                ${players.map(p => `<div class="player-score" style="background: rgba(255,255,255,0.2);">${calculateTotal(p, categories)}</div>`).join('')}
            </div>
        </div>`;

        scoreList.innerHTML = html;
    }
}

export default YahtzeeUI;
