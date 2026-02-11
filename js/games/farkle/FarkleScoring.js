/* ========================================
   FarkleScoring - Pure Scoring Logic
   No DOM dependencies. All functions are pure.
   ======================================== */

/**
 * Scoring constants for Farkle.
 * Three-of-a-kind base values: 1s = 1000, others = value * 100.
 * Multiples scale: 4-of-a-kind = 2x, 5-of-a-kind = 4x, 6-of-a-kind = 8x.
 */
const TRIPLE_BASE = { 1: 1000, 2: 200, 3: 300, 4: 400, 5: 500, 6: 600 };
const SINGLE_SCORES = { 1: 100, 5: 50 };
const STRAIGHT_SCORE = 1000;
const THREE_PAIRS_SCORE = 1500;
const TWO_TRIPLETS_SCORE = 2500;

// ---- Utility ----

/**
 * Count frequency of each die value (1-6).
 * @param {number[]} dice - Array of die values
 * @returns {Object} e.g. { 1: 2, 3: 1, 5: 3 }
 */
function countFrequency(dice) {
    const freq = {};
    for (const v of dice) {
        freq[v] = (freq[v] || 0) + 1;
    }
    return freq;
}

// ---- Scoring ----

/**
 * Score a selection of dice. Returns the total score,
 * or null if the selection contains dice that don't
 * contribute to any valid combination.
 *
 * @param {number[]} selectedDice - Die values selected by player
 * @returns {number|null} Total score, or null if invalid
 */
export function scoreSelection(selectedDice) {
    if (!selectedDice || selectedDice.length === 0) return null;

    const freq = countFrequency(selectedDice);
    let score = 0;
    const remaining = { ...freq };

    // --- Check special 6-dice combos first ---
    if (selectedDice.length === 6) {
        // Straight: exactly one of each 1-6
        if ([1, 2, 3, 4, 5, 6].every(v => remaining[v] === 1)) {
            return STRAIGHT_SCORE;
        }

        // Three pairs: exactly 3 different values each appearing twice
        const pairs = Object.values(remaining).filter(c => c === 2);
        if (pairs.length === 3) {
            return THREE_PAIRS_SCORE;
        }

        // Two triplets: exactly 2 different values each appearing three times
        const triplets = Object.values(remaining).filter(c => c === 3);
        if (triplets.length === 2) {
            return TWO_TRIPLETS_SCORE;
        }
    }

    // --- Extract multiples (6, 5, 4, 3 of a kind) ---
    for (let val = 1; val <= 6; val++) {
        const count = remaining[val] || 0;
        if (count >= 6) {
            score += TRIPLE_BASE[val] * 8;
            remaining[val] -= 6;
        } else if (count >= 5) {
            score += TRIPLE_BASE[val] * 4;
            remaining[val] -= 5;
        } else if (count >= 4) {
            score += TRIPLE_BASE[val] * 2;
            remaining[val] -= 4;
        } else if (count >= 3) {
            score += TRIPLE_BASE[val];
            remaining[val] -= 3;
        }
    }

    // --- Remaining dice: only 1s and 5s are valid ---
    for (let val = 1; val <= 6; val++) {
        const count = remaining[val] || 0;
        if (count > 0) {
            if (SINGLE_SCORES[val]) {
                score += SINGLE_SCORES[val] * count;
                remaining[val] = 0;
            } else {
                // Invalid: non-scoring dice remain
                return null;
            }
        }
    }

    return score > 0 ? score : null;
}

/**
 * Check if a roll is a Farkle (no valid scoring combination exists).
 * @param {number[]} dice - Die values from the roll
 * @returns {boolean} true if Farkle
 */
export function isFarkle(dice) {
    if (!dice || dice.length === 0) return true;

    // Any 1 or 5 present → not a Farkle
    if (dice.includes(1) || dice.includes(5)) return false;

    const freq = countFrequency(dice);

    // Any three-of-a-kind → not a Farkle
    for (const count of Object.values(freq)) {
        if (count >= 3) return false;
    }

    // Straight (only possible with 6 dice)
    if (dice.length === 6 && [1, 2, 3, 4, 5, 6].every(v => freq[v] === 1)) {
        return false;
    }

    // Three pairs (only possible with 6 dice)
    if (dice.length === 6) {
        const pairs = Object.values(freq).filter(c => c === 2);
        if (pairs.length === 3) return false;
    }

    return true;
}

/**
 * Find which individual dice indices CAN be part of a valid scoring combo.
 * Used to highlight selectable dice after a roll.
 *
 * @param {number[]} dice - All dice values from the current roll (only available dice)
 * @param {number[]} indices - The original indices of these dice (mapping to 0-5)
 * @returns {Set<number>} Set of original indices that can score
 */
export function findScorableDiceIndices(dice, indices) {
    const scorable = new Set();
    const freq = countFrequency(dice);

    // Singles: 1s and 5s are always scorable
    for (let i = 0; i < dice.length; i++) {
        if (dice[i] === 1 || dice[i] === 5) {
            scorable.add(indices[i]);
        }
    }

    // Multiples: any value with 3+ occurrences → all dice of that value are scorable
    for (let val = 1; val <= 6; val++) {
        if ((freq[val] || 0) >= 3) {
            for (let i = 0; i < dice.length; i++) {
                if (dice[i] === val) scorable.add(indices[i]);
            }
        }
    }

    // Special 6-dice combos
    if (dice.length === 6) {
        // Straight
        if ([1, 2, 3, 4, 5, 6].every(v => freq[v] === 1)) {
            indices.forEach(idx => scorable.add(idx));
        }
        // Three pairs
        const pairs = Object.values(freq).filter(c => c === 2);
        if (pairs.length === 3) {
            indices.forEach(idx => scorable.add(idx));
        }
        // Two triplets
        const triplets = Object.values(freq).filter(c => c === 3);
        if (triplets.length === 2) {
            indices.forEach(idx => scorable.add(idx));
        }
    }

    return scorable;
}

/**
 * Describe the scoring breakdown of a valid selection for display.
 * @param {number[]} selectedDice - Die values
 * @returns {Array<{name: string, score: number}>} Breakdown, or empty if invalid
 */
export function describeSelection(selectedDice) {
    if (!selectedDice || selectedDice.length === 0) return [];

    const freq = countFrequency(selectedDice);
    const breakdown = [];
    const remaining = { ...freq };

    // Special 6-dice combos
    if (selectedDice.length === 6) {
        if ([1, 2, 3, 4, 5, 6].every(v => remaining[v] === 1)) {
            return [{ name: 'Scala 1-2-3-4-5-6', score: STRAIGHT_SCORE }];
        }
        const pairs = Object.values(remaining).filter(c => c === 2);
        if (pairs.length === 3) {
            return [{ name: 'Tre coppie', score: THREE_PAIRS_SCORE }];
        }
        const triplets = Object.values(remaining).filter(c => c === 3);
        if (triplets.length === 2) {
            const vals = Object.keys(remaining).filter(v => remaining[v] === 3);
            return [{ name: `Due tris (${vals.join(' e ')})`, score: TWO_TRIPLETS_SCORE }];
        }
    }

    // Multiples
    for (let val = 1; val <= 6; val++) {
        const count = remaining[val] || 0;
        if (count >= 6) {
            breakdown.push({ name: `Sei ${val}`, score: TRIPLE_BASE[val] * 8 });
            remaining[val] -= 6;
        } else if (count >= 5) {
            breakdown.push({ name: `Cinque ${val}`, score: TRIPLE_BASE[val] * 4 });
            remaining[val] -= 5;
        } else if (count >= 4) {
            breakdown.push({ name: `Quattro ${val}`, score: TRIPLE_BASE[val] * 2 });
            remaining[val] -= 4;
        } else if (count >= 3) {
            breakdown.push({ name: `Tris di ${val}`, score: TRIPLE_BASE[val] });
            remaining[val] -= 3;
        }
    }

    // Singles
    for (let val = 1; val <= 6; val++) {
        const count = remaining[val] || 0;
        if (count > 0) {
            if (SINGLE_SCORES[val]) {
                for (let i = 0; i < count; i++) {
                    breakdown.push({
                        name: val === 1 ? 'Singolo 1' : 'Singolo 5',
                        score: SINGLE_SCORES[val]
                    });
                }
                remaining[val] = 0;
            }
        }
    }

    return breakdown;
}

/**
 * Detect if a 5/6 straight attempt is possible.
 * Requires exactly 6 dice with 5 unique values out of 1-6.
 *
 * @param {number[]} dice - All 6 dice values
 * @returns {{ possible: boolean, missingValue: number|null }}
 */
export function detectStraightAttempt(dice) {
    if (dice.length !== 6) return { possible: false, missingValue: null };

    const freq = countFrequency(dice);
    const uniqueVals = Object.keys(freq).map(Number);

    // Need exactly 5 unique values from 1-6
    if (uniqueVals.length !== 5) return { possible: false, missingValue: null };

    // All 5 must be in range 1-6 and one value from 1-6 is missing
    const allInRange = uniqueVals.every(v => v >= 1 && v <= 6);
    if (!allInRange) return { possible: false, missingValue: null };

    const missing = [1, 2, 3, 4, 5, 6].find(v => !freq[v]);
    // Exactly one of the 5 values must appear twice (the duplicate)
    const hasDuplicate = Object.values(freq).some(c => c === 2);

    if (missing !== undefined && hasDuplicate) {
        return { possible: true, missingValue: missing };
    }

    return { possible: false, missingValue: null };
}

/**
 * Get all available scoring combinations for display hints.
 * @param {number[]} dice - Available dice values
 * @returns {Array<{name: string, score: number, diceCount: number}>}
 */
export function getAvailableCombinations(dice) {
    if (!dice || dice.length === 0) return [];

    const freq = countFrequency(dice);
    const combos = [];

    // Special 6-dice combos
    if (dice.length === 6) {
        if ([1, 2, 3, 4, 5, 6].every(v => freq[v] === 1)) {
            combos.push({ name: 'Scala 1-2-3-4-5-6', score: STRAIGHT_SCORE, diceCount: 6 });
        }
        const pairs = Object.values(freq).filter(c => c === 2);
        if (pairs.length === 3) {
            combos.push({ name: 'Tre coppie', score: THREE_PAIRS_SCORE, diceCount: 6 });
        }
        const triplets = Object.values(freq).filter(c => c === 3);
        if (triplets.length === 2) {
            combos.push({ name: 'Due tris', score: TWO_TRIPLETS_SCORE, diceCount: 6 });
        }
    }

    // Multiples
    for (let val = 1; val <= 6; val++) {
        const count = freq[val] || 0;
        if (count >= 6) {
            combos.push({ name: `Sei ${val}`, score: TRIPLE_BASE[val] * 8, diceCount: 6 });
        }
        if (count >= 5) {
            combos.push({ name: `Cinque ${val}`, score: TRIPLE_BASE[val] * 4, diceCount: 5 });
        }
        if (count >= 4) {
            combos.push({ name: `Quattro ${val}`, score: TRIPLE_BASE[val] * 2, diceCount: 4 });
        }
        if (count >= 3) {
            combos.push({ name: `Tris di ${val}`, score: TRIPLE_BASE[val], diceCount: 3 });
        }
    }

    // Singles
    if (freq[1]) combos.push({ name: 'Singolo 1', score: 100, diceCount: 1 });
    if (freq[5]) combos.push({ name: 'Singolo 5', score: 50, diceCount: 1 });

    return combos;
}

export default {
    scoreSelection,
    isFarkle,
    findScorableDiceIndices,
    describeSelection,
    detectStraightAttempt,
    getAvailableCombinations
};
