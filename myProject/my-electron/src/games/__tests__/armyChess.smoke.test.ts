let armyChess: any = {};
let gomoku: any = {};
try {
  armyChess = require('../armyChess');
  console.log('armyChess Module keys:', Object.keys(armyChess));
} catch (e) {
  console.error('armyChess Module load error:', e);
}
try {
  gomoku = require('../gomoku');
  console.log('gomoku Module keys:', Object.keys(gomoku));
} catch (e) {
  console.error('gomoku Module load error:', e);
}

test('armyChess module exports are defined', () => {
  console.log('resolveCombat type:', typeof armyChess.resolveCombat);
  console.log('PIECE_RANK type:', typeof armyChess.PIECE_RANK);
  console.log('TERRAIN type:', typeof armyChess.TERRAIN);
  console.log('TERRAIN length:', armyChess.TERRAIN?.length);
  console.log('getValidMoves type:', typeof armyChess.getValidMoves);
  
  expect(typeof armyChess.resolveCombat).toBe('function');
  expect(typeof armyChess.PIECE_RANK).toBe('object');
  expect(typeof armyChess.TERRAIN).toBe('object');
  expect(armyChess.TERRAIN?.length).toBe(12);
});

test('resolveCombat basic cases', () => {
  console.log('bomb vs commander:', armyChess.resolveCombat('bomb', 'commander'));
  console.log('commander vs commander:', armyChess.resolveCombat('commander', 'commander'));
  console.log('commander vs lt_general:', armyChess.resolveCombat('commander', 'lt_general'));
  
  expect(armyChess.resolveCombat('bomb', 'commander')).toBe('both_eliminated');
  expect(armyChess.resolveCombat('commander', 'commander')).toBe('both_eliminated');
  expect(armyChess.resolveCombat('commander', 'lt_general')).toBe('attacker_wins');
});
