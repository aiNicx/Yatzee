/* ========================================
   YahtzeeScoring
   Pure scoring functions for Yahtzee
   ======================================== */

export function countDice(dice, val) {
    return dice.filter(d => d === val).reduce((a, b) => a + b, 0);
}

export function threeOfAKind(d) {
    const counts = {};
    d.forEach(v => counts[v] = (counts[v] || 0) + 1);
    return Object.values(counts).some(c => c >= 3) ? d.reduce((a, b) => a + b, 0) : 0;
}

export function fourOfAKind(d) {
    const counts = {};
    d.forEach(v => counts[v] = (counts[v] || 0) + 1);
    return Object.values(counts).some(c => c >= 4) ? d.reduce((a, b) => a + b, 0) : 0;
}

export function fullHouse(d) {
    const counts = {};
    d.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const vals = Object.values(counts);
    return vals.includes(3) && vals.includes(2) ? 25 : 0;
}

export function smallStraight(d) {
    const unique = [...new Set(d)].sort();
    const str = unique.join('');
    return ['1234', '2345', '3456'].some(s => str.includes(s)) ? 30 : 0;
}

export function largeStraight(d) {
    const sorted = [...d].sort().join('');
    return sorted === '12345' || sorted === '23456' ? 40 : 0;
}

export function yahtzeeCheck(d) {
    return d.every(v => v === d[0]) ? 50 : 0;
}

export function chance(d) {
    return d.reduce((a, b) => a + b, 0);
}

export function calculateUpperSum(player) {
    return ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes']
        .reduce((sum, id) => sum + (player.scores[id] || 0), 0);
}

export function calculateTotal(player, categories) {
    let total = calculateUpperSum(player);
    if (total >= 63) total += 35;

    categories.filter(c => c.type === 'lower').forEach(c => {
        total += player.scores[c.id] || 0;
    });

    if (player.yahtzees > 1) {
        total += (player.yahtzees - 1) * 100;
    }

    return total;
}
