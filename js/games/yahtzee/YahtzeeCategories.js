/* ========================================
   YahtzeeCategories
   Category definitions for Yahtzee
   ======================================== */

import {
    countDice, threeOfAKind, fourOfAKind,
    fullHouse, smallStraight, largeStraight,
    yahtzeeCheck, chance
} from './YahtzeeScoring.js';

export const categories = [
    { id: 'ones',          name: 'Uno (1)',          type: 'upper', calc: (d) => countDice(d, 1) },
    { id: 'twos',          name: 'Due (2)',          type: 'upper', calc: (d) => countDice(d, 2) },
    { id: 'threes',        name: 'Tre (3)',          type: 'upper', calc: (d) => countDice(d, 3) },
    { id: 'fours',         name: 'Quattro (4)',      type: 'upper', calc: (d) => countDice(d, 4) },
    { id: 'fives',         name: 'Cinque (5)',       type: 'upper', calc: (d) => countDice(d, 5) },
    { id: 'sixes',         name: 'Sei (6)',          type: 'upper', calc: (d) => countDice(d, 6) },
    { id: 'bonus',         name: 'Bonus',            type: 'bonus', calc: () => 0 },
    { id: 'threeKind',     name: 'Tre Uguali',       type: 'lower', calc: (d) => threeOfAKind(d) },
    { id: 'fourKind',      name: 'Quattro Uguali',   type: 'lower', calc: (d) => fourOfAKind(d) },
    { id: 'fullHouse',     name: 'Full House',        type: 'lower', calc: (d) => fullHouse(d) },
    { id: 'smallStraight', name: 'Scala Piccola',     type: 'lower', calc: (d) => smallStraight(d) },
    { id: 'largeStraight', name: 'Scala Grande',      type: 'lower', calc: (d) => largeStraight(d) },
    { id: 'yahtzee',       name: 'Yatzee',            type: 'lower', calc: (d) => yahtzeeCheck(d) },
    { id: 'chance',        name: 'Chance',             type: 'lower', calc: (d) => chance(d) }
];

export default categories;
