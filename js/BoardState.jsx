var _ = require('underscore');
var getNextPlayer = require('./getNextPlayer.jsx');

var c = function(row, col) {
  return {row: row, col: col};
};

// enumerate all possible cell combinations such that if all cells contain
// the same player's mark, that player wins.
var WIN_AXES = [
  // across
  [c(0, 0), c(0, 1), c(0, 2)],
  [c(1, 0), c(1, 1), c(1, 2)],
  [c(2, 0), c(2, 1), c(2, 2)],

  // down
  [c(0, 0), c(1, 0), c(2, 0)],
  [c(0, 1), c(1, 1), c(2, 1)],
  [c(0, 2), c(1, 2), c(2, 2)],

  // diagonal
  [c(0, 0), c(1, 1), c(2, 2)],
  [c(2, 0), c(1, 1), c(0, 2)]
];

var PLAYERS = ['x', 'o'];

// board key -> {x: num, o: num}
var WIN_LOSS_COUNTS = null;

var numStatesComputed = 0;

var INITIAL_CELLS = [
  ['', '', ''],
  ['', '', ''],
  ['', '', ''],
];

if (false) {  // debug; faster loading
  INITIAL_CELLS = [
    ['', 'o', ''],
    ['', 'o', ''],
    ['', '', 'x'],
  ];
}

// nextMove = {row, col}
// call one of three ways:
// 1. new BoardState()                    // initial state
// 2. new BoardState(previousState, move) // make a move
// 3. new BoardState(null, null, boardStatePOJO)  // load from POJO
var BoardState = window.BoardState = function(previousState, move, boardStatePOJO) {
  var self = this;

  // cells: nested list (outer=row, inner=col) of {empty string|player ID}
  // player: player ID who made the move that changed the previous state into
  // this state, or null if initial state.
  if (previousState) {
    self.player = getNextPlayer(previousState.player)
    // deep copy cells nested array
    self.cells = previousState.cells.map(function(cellValues, rowIndex) {
      return cellValues.map(function(colValue) {
        return colValue;
      });
    });

    // apply move
    self.cells[move.row][move.col] = self.player;
  } else if (boardStatePOJO) {
    self.player = boardStatePOJO.player;
    self.cells = boardStatePOJO.cells;
  } else {
    self.player = null; // next player is 'x'
    self.cells = INITIAL_CELLS;
  }

  self.move = move;
  self.hashKey = self.cells.map(function(row) {
    return row.map(function(c) { return c.length ? c : '-'; }).join('')
  }).join('')

  self.getCell = function(row, col) {
    return self.cells[row][col];
  };
  self.setCell = function(row, col) {
    return new BoardState(self, {row: row, col: col})
  }

  // returns all moves you can make from here as [[row, col], ...]
  // (i.e. all empty cells)
  self.getPossibleMoves = function() {
    if (self.getIsGameOver()) { return []; }
    var results = [];
    for (var row=0; row<3; row++) {
      for (var col=0; col<3; col++) {
        if (self.getCell(row, col) == '') {
          results.push({row: row, col: col});
        }
      }
    }
    return results;
  }

  // returns a 'winner' data structure if either player has one. otherwise
  // returns null.
  // -> {player, cells: [[row, col], [row, col], [row, col]]} or null
  self.getWinner = function() {
    var winningCells = _.find(WIN_AXES, function(cells) {
      var winningPlayer = self.getCell(cells[0].row, cells[0].col);
      if (!winningPlayer) return false;
      for (var i=1; i<=2; i++) {
        if (self.getCell(cells[i].row, cells[i].col) != winningPlayer) {
          return false;
        }
      }
      return true;
    });
    if (winningCells) {
      return {
        player: self.getCell(winningCells[0].row, winningCells[0].col),
        cells: winningCells
      }
    } else {
      return null;
    }
  }
  self.getIsGameOver = function() {
    var isAnyCellEmpty = false;
    for (var row=0; row<3; row++) {
      for (var col=0; col<3; col++) {
        if (self.getCell(row, col) == '') {
          isAnyCellEmpty = true;
        }
      }
    }
    return (!isAnyCellEmpty) || self.getWinner();
  }

  self.toString = function() {
    return self.cells.map(function(row) {return row.join(',')}).join('\n');
  }
};


module.exports = BoardState;