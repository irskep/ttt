(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var _ = require('underscore');
var BoardState = require('./BoardState.jsx');
var getNextPlayer = require('./getNextPlayer.jsx');

// board key -> n
// more positive = X advantage, more negative = Y advantage
window.STATE_KEY_TO_SCORE = null;

// cheating! I captured the output to avoid long load time.
STATE_KEY_TO_SCORE = require('./boardStateHashKeyToScore.jsx');
// set to true if you want to see how long it takes
var FORCE_COMPUTE = false;

var getScore = function(boardState) {
  return STATE_KEY_TO_SCORE[boardState.hashKey];
}

var MAXIMIZING_PLAYER = 'x';
// can't JSONify Infinity, can't trust MAX_VALUE to be negatable
var BASICALLY_INFINITY = Number.MAX_SAFE_INTEGER

var _computeScore = function(boardState) {
  if (STATE_KEY_TO_SCORE[boardState.hashKey]) {
    return STATE_KEY_TO_SCORE[boardState.hashKey];
  }

  var score = 0;
  if (boardState.getIsGameOver()) {
    var winner = boardState.getWinner();
    if (winner) {
      if (winner.player == MAXIMIZING_PLAYER) {
        score = BASICALLY_INFINITY;
      } else {
        score = -BASICALLY_INFINITY;
      }
    } else {
      score = 0;
    }
  } else {
    var possibleMoves = boardState.getPossibleMoves();
    var nextPlayer = getNextPlayer(boardState.player);
    if (nextPlayer == MAXIMIZING_PLAYER) {
      score = -BASICALLY_INFINITY;
      _.each(possibleMoves, function(move) {
        score = Math.max(score, _computeScore(new BoardState(boardState, move)));
      });
    } else {
      score = BASICALLY_INFINITY;
      _.each(possibleMoves, function(move) {
        score = Math.min(score, _computeScore(new BoardState(boardState, move)));
      });
    }
  }
  if (isNaN(score)) throw "NO";
  STATE_KEY_TO_SCORE[boardState.hashKey] = score;
  return score;
}

var initialize = function() {
  if (STATE_KEY_TO_SCORE && !FORCE_COMPUTE) {
    console.log("Using precomputed AI table");
    return;
  }
  if (localStorage.scoreCache && !FORCE_COMPUTE) {
    // This isn't really used anymore, but was before I just captured the
    // whole table in the source JS.
    console.log('Loading AI table from local storage');
    STATE_KEY_TO_SCORE = JSON.parse(localStorage.scoreCache);
  } else {
    console.log('Computing AI table and saving to local storage');
    STATE_KEY_TO_SCORE = {};
    _computeScore(new BoardState(), 10, 0);
    localStorage.scoreCache = JSON.stringify(STATE_KEY_TO_SCORE);
  }
};


var getBestMove = function(boardState) {
  var player = getNextPlayer(boardState.player);
  var isMaximizing = player == MAXIMIZING_PLAYER;
  var possibleMoves = boardState.getPossibleMoves();
  var bestMove = possibleMoves[0];
  if (isMaximizing) {
    var bestScore = -BASICALLY_INFINITY;
    _.each(possibleMoves, function(move) {
      var score = getScore(new BoardState(boardState, move));
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    });
  } else {
    var bestScore = BASICALLY_INFINITY;
    _.each(possibleMoves, function(move) {
      var score = getScore(new BoardState(boardState, move));
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    });
  }
  return bestMove;
}


module.exports = window.AI = {
  initialize: initialize,
  getScore: getScore,
  getBestMove: getBestMove,
  _computeScore: _computeScore
}

},{"./BoardState.jsx":2,"./boardStateHashKeyToScore.jsx":4,"./getNextPlayer.jsx":5,"underscore":8}],2:[function(require,module,exports){
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

},{"./getNextPlayer.jsx":5,"underscore":8}],3:[function(require,module,exports){
var _ = require('underscore');
var AI = require('./AI.jsx');
var React = require('./react.js');
var BoardState = require('./BoardState.jsx');
var getNextPlayer = require('./getNextPlayer.jsx');


// synced with style.css
var BOARD_SIZE = 300;
var IS_AI_ENABLED = true;


var TicTacToeBoard = React.createClass({
  displayName: 'TicTacToeBoard',

  getInitialState: function() {
    return {
      boardState: this.props.initialBoardState,
      aiPlayer: 'o'
    };
  },

  getDefaultProps: function() {
    return {
      initialBoardState: new BoardState(),
      onNewBoardState: function() { }
    };
  },

  componentDidMount: function() {
    this.scheduleAIIfNecessary();
  },

  componentDidUpdate: function(prevProps, prevState) {
    this.scheduleAIIfNecessary();
  },

  scheduleAIIfNecessary: function() {
    var self = this;
    var boardState = self.state.boardState;
    // move AI in 300ms if human player just went & game isn't over
    if (IS_AI_ENABLED &&
        getNextPlayer(boardState.player) == self.state.aiPlayer &&
        !boardState.getIsGameOver()) {
      _.delay(function(){
        self.setNewBoardState(new BoardState(
          boardState, AI.getBestMove(boardState)));
      }, 300);
    }
  },

  setNewBoardState: function(newBoardState) {
    this.setState({boardState: newBoardState});
    this.props.onNewBoardState(newBoardState);
  },

  render: function() {
    var self = this;
    var boardState = this.state.boardState;
    var currentPlayer = getNextPlayer(boardState.player);
    var isGameOver = boardState.getIsGameOver();
    var winner = boardState.getWinner();

    var cellScores = boardState.getPossibleMoves().map(function(cell) {
      return AI.getScore(new BoardState(boardState, cell));
    });
    var maxCellScore = Math.max.apply(this, cellScores);
    var minCellScore = Math.min.apply(this, cellScores);

    var canHumanPlayerMove = (
      !isGameOver && (currentPlayer != self.state.aiPlayer || !IS_AI_ENABLED));

    return React.createElement("div", {className: "tic-tac-toe-game"}, 
      React.createElement("div", {className: "tic-tac-toe-container"}, 
        React.createElement("table", {className: "tic-tac-toe-board"}, 
          React.createElement("tbody", null, 
            _.range(0, 3).map(function(row) {
              return React.createElement("tr", {key: row}, 
                _.range(0, 3).map(function(col) {
                  var value = boardState.getCell(row, col);
                  if (value == '' && canHumanPlayerMove) {
                    return React.createElement("td", {
                      className: "clickable", 
                      key: col, 
                      currentPlayer: currentPlayer, 
                      onClick: function() {
                        self.setNewBoardState(boardState.setCell(row, col));
                      }})
                  } else {
                    return React.createElement("td", {key: col}, 
                      value == 'x' && React.createElement("div", null, "×"), 
                      value == 'o' && React.createElement("div", null, "○")
                    );
                  }
                })
              )
            })
          )
        ), 
        winner && React.createElement(WinnerDisplay, {cells: winner.cells})
      ), 
      React.createElement("div", {className: "controls"}, 
        React.createElement(PlayerTurnIndicator, {
          currentPlayer: currentPlayer, 
          winner: boardState.getWinner(), 
          isGameOver: boardState.getIsGameOver()}), 
        React.createElement("button", {onClick: function() {self.setNewBoardState(new BoardState());}}, 
          "New game"
        ), 
        React.createElement("button", {onClick: function() {
              self.setState({aiPlayer: getNextPlayer(self.state.aiPlayer)})
              self.setNewBoardState(new BoardState());
            }}, 
          "Play as ", self.state.aiPlayer
        )
      )
    );
  }
});

var WinnerDisplay = React.createClass({
  displayName: 'WinnerDisplay',
  render: function() {
    var CELL_SIZE = BOARD_SIZE / 3;
    // add fudge factors for typography
    var x1 = this.props.cells[0].col * CELL_SIZE + CELL_SIZE / 2 - 1 + '';
    var y1 = this.props.cells[0].row * CELL_SIZE + CELL_SIZE / 2 + 5 + '';
    var x2 = this.props.cells[2].col * CELL_SIZE + CELL_SIZE / 2 - 1 + '';
    var y2 = this.props.cells[2].row * CELL_SIZE + CELL_SIZE / 2 + 5 + '';
    return React.createElement("svg", {className: "tic-tac-toe-win-display", 
      width: BOARD_SIZE, height: BOARD_SIZE, 
      viewBox: "0 0 " + BOARD_SIZE + " " + BOARD_SIZE}, 
       React.createElement("line", {x1: x1, y1: y1, x2: x2, y2: y2, 
        strokeLinecap: "round", strokeWidth: "20", stroke: "#f00"})
    )
  }
});

var PlayerTurnIndicator = React.createClass({
  displayName: 'PlayerTurnIndicator',
  render: function() {
    var winner = this.props.winner;
    return React.createElement("p", null, 
      !this.props.isGameOver && React.createElement("span", null, 
        "Current player: ", this.props.currentPlayer
      ), 
      this.props.isGameOver && winner && React.createElement("span", null, 
        "Winner: ", this.props.winner.player
      ), 
      this.props.isGameOver && !winner && React.createElement("span", null, 
        "It’s a tie!"
      )
    )
  }
});

module.exports = TicTacToeBoard;

},{"./AI.jsx":1,"./BoardState.jsx":2,"./getNextPlayer.jsx":5,"./react.js":6,"underscore":8}],4:[function(require,module,exports){
// module.exports = JSON.parse("large dict as JSON") uses MUCH less memory than
// simply using module.exports = large dict, and load much faster too
module.exports = JSON.parse("{\"xoxoxox--\":9007199254740991,\"xoxoxooxx\":9007199254740991,\"xoxoxoox-\":9007199254740991,\"xoxoxoxxo\":9007199254740991,\"xoxoxo-xo\":9007199254740991,\"xoxoxo-x-\":9007199254740991,\"xoxoxo--x\":9007199254740991,\"xoxoxo---\":9007199254740991,\"xoxoxxoox\":9007199254740991,\"xoxoxxoo-\":9007199254740991,\"xoxoxxoxo\":0,\"xoxoxxo-o\":0,\"xoxoxxo--\":0,\"xoxox-oxo\":0,\"xoxox-ox-\":0,\"xoxox-o-x\":9007199254740991,\"xoxox-o--\":9007199254740991,\"xoxoxxxoo\":9007199254740991,\"xoxoxx-oo\":9007199254740991,\"xoxoxx-o-\":9007199254740991,\"xoxox-xo-\":9007199254740991,\"xoxox--ox\":9007199254740991,\"xoxox--o-\":9007199254740991,\"xoxoxx--o\":0,\"xoxox-x-o\":9007199254740991,\"xoxox--xo\":0,\"xoxox---o\":9007199254740991,\"xoxox----\":9007199254740991,\"xoxooxxo-\":-9007199254740991,\"xoxooxxxo\":0,\"xoxooxx-o\":0,\"xoxooxx--\":-9007199254740991,\"xoxooxoxx\":9007199254740991,\"xoxooxox-\":9007199254740991,\"xoxoox-xo\":0,\"xoxoox-x-\":0,\"xoxoox--x\":9007199254740991,\"xoxoox---\":9007199254740991,\"xoxo-xoxo\":0,\"xoxo-xox-\":0,\"xoxo-xo-x\":9007199254740991,\"xoxo-xo--\":9007199254740991,\"xoxo-xxoo\":9007199254740991,\"xoxo-xxo-\":-9007199254740991,\"xoxo-x-ox\":9007199254740991,\"xoxo-x-o-\":9007199254740991,\"xoxo-xx-o\":0,\"xoxo-x-xo\":0,\"xoxo-x--o\":0,\"xoxo-x---\":0,\"xoxoooxx-\":-9007199254740991,\"xoxoo-xxo\":0,\"xoxoo-xx-\":-9007199254740991,\"xoxooox-x\":-9007199254740991,\"xoxoo-xox\":-9007199254740991,\"xoxoo-x-x\":-9007199254740991,\"xoxoo-x--\":-9007199254740991,\"xoxo-oxxo\":9007199254740991,\"xoxo-oxx-\":-9007199254740991,\"xoxoxoxox\":9007199254740991,\"xoxo-oxox\":9007199254740991,\"xoxo-ox-x\":-9007199254740991,\"xoxo-ox--\":9007199254740991,\"xoxo--xox\":-9007199254740991,\"xoxo--xo-\":9007199254740991,\"xoxo--xxo\":0,\"xoxo--x-o\":9007199254740991,\"xoxo--x--\":-9007199254740991,\"xoxooo-xx\":-9007199254740991,\"xoxoo-oxx\":9007199254740991,\"xoxoo--xx\":-9007199254740991,\"xoxoo--x-\":0,\"xoxo-ooxx\":9007199254740991,\"xoxo-o-xx\":-9007199254740991,\"xoxo-o-x-\":9007199254740991,\"xoxo--oxx\":9007199254740991,\"xoxo--ox-\":9007199254740991,\"xoxo---xo\":0,\"xoxo---x-\":0,\"xoxoo---x\":9007199254740991,\"xoxo-o--x\":9007199254740991,\"xoxo--o-x\":9007199254740991,\"xoxo---ox\":9007199254740991,\"xoxo----x\":9007199254740991,\"xoxo-----\":9007199254740991,\"xoxxoox--\":9007199254740991,\"xoxxoooxx\":0,\"xoxxooox-\":0,\"xoxxooxxo\":9007199254740991,\"xoxxoo-xo\":9007199254740991,\"xoxxoo-x-\":0,\"xoxxooo-x\":0,\"xoxxoo-ox\":-9007199254740991,\"xoxxoo--x\":-9007199254740991,\"xoxxoo---\":9007199254740991,\"xoxxoxoo-\":-9007199254740991,\"xoxxoxoxo\":0,\"xoxxoxo-o\":0,\"xoxxoxo--\":-9007199254740991,\"xoxxo-oxo\":0,\"xoxxo-ox-\":0,\"xoxxo-oox\":-9007199254740991,\"xoxxo-o-x\":-9007199254740991,\"xoxxo-o--\":0,\"xoxxo--o-\":-9007199254740991,\"xoxxox-oo\":-9007199254740991,\"xoxxox--o\":-9007199254740991,\"xoxxo-x-o\":9007199254740991,\"xoxxo--xo\":0,\"xoxxo---o\":9007199254740991,\"xoxxo----\":-9007199254740991,\"xox-oxoxo\":0,\"xox-oxox-\":0,\"xox-oxo-x\":9007199254740991,\"xox-oxo--\":9007199254740991,\"xox-ox-o-\":-9007199254740991,\"xox-oxxoo\":-9007199254740991,\"xox-oxx-o\":-9007199254740991,\"xox-ox-xo\":0,\"xox-ox--o\":0,\"xox-ox---\":-9007199254740991,\"xox-ooxxo\":9007199254740991,\"xox-ooxx-\":-9007199254740991,\"xox-ooxox\":-9007199254740991,\"xox-oox-x\":-9007199254740991,\"xox-oox--\":9007199254740991,\"xox-o-xo-\":-9007199254740991,\"xox-o-xxo\":0,\"xox-o-x-o\":9007199254740991,\"xox-o-x--\":-9007199254740991,\"xox-oooxx\":0,\"xox-oo-xx\":-9007199254740991,\"xox-oo-x-\":0,\"xox-o-oxx\":0,\"xox-o-ox-\":0,\"xox-o--xo\":0,\"xox-o--x-\":0,\"xox-oo--x\":-9007199254740991,\"xox-o-o-x\":9007199254740991,\"xox-o--ox\":-9007199254740991,\"xox-o---x\":-9007199254740991,\"xox-o----\":0,\"xoxxxooox\":9007199254740991,\"xoxxxooo-\":9007199254740991,\"xoxxxooxo\":0,\"xoxxxoo-o\":0,\"xoxxxoo--\":0,\"xoxx-ooxo\":0,\"xoxx-oox-\":0,\"xoxx-ooox\":9007199254740991,\"xoxx-oo-x\":0,\"xoxx-oo--\":0,\"xoxxxoxoo\":9007199254740991,\"xoxxxo-oo\":9007199254740991,\"xoxxxo-o-\":9007199254740991,\"xoxx-oxo-\":9007199254740991,\"xoxx-o-ox\":-9007199254740991,\"xoxx-o-o-\":9007199254740991,\"xoxxxo--o\":0,\"xoxx-ox-o\":9007199254740991,\"xoxx-o-xo\":0,\"xoxx-o--o\":9007199254740991,\"xoxx-o---\":0,\"xox-xooxo\":0,\"xox-xoox-\":0,\"xox-xoo-x\":9007199254740991,\"xox-xoo--\":9007199254740991,\"xox-xoxo-\":9007199254740991,\"xox-xo-ox\":9007199254740991,\"xox-xo-o-\":9007199254740991,\"xox-xox-o\":9007199254740991,\"xox-xo-xo\":0,\"xox-xo--o\":9007199254740991,\"xox-xo---\":9007199254740991,\"xox--oxox\":-9007199254740991,\"xox--oxo-\":9007199254740991,\"xox--oxxo\":9007199254740991,\"xox--ox-o\":9007199254740991,\"xox--ox--\":9007199254740991,\"xox--ooxx\":0,\"xox--oox-\":0,\"xox--o-xo\":9007199254740991,\"xox--o-x-\":0,\"xox--oo-x\":9007199254740991,\"xox--o-ox\":9007199254740991,\"xox--o--x\":-9007199254740991,\"xox--o---\":9007199254740991,\"xoxxx-ooo\":-9007199254740991,\"xoxxx-oo-\":-9007199254740991,\"xoxx-xooo\":-9007199254740991,\"xoxx-xoo-\":-9007199254740991,\"xoxx--oox\":-9007199254740991,\"xoxx--oo-\":-9007199254740991,\"xoxxx-o-o\":-9007199254740991,\"xoxx-xo-o\":-9007199254740991,\"xoxx--oxo\":0,\"xoxx--o-o\":0,\"xoxx--o--\":-9007199254740991,\"xox-xxooo\":-9007199254740991,\"xox-xxoo-\":-9007199254740991,\"xox-x-oox\":9007199254740991,\"xox-x-oo-\":9007199254740991,\"xox-xxo-o\":-9007199254740991,\"xox-x-oxo\":0,\"xox-x-o-o\":0,\"xox-x-o--\":0,\"xox--xoox\":9007199254740991,\"xox--xoo-\":9007199254740991,\"xox--xoxo\":0,\"xox--xo-o\":0,\"xox--xo--\":0,\"xox---oxo\":0,\"xox---ox-\":0,\"xox---oox\":9007199254740991,\"xox---o-x\":9007199254740991,\"xox---o--\":9007199254740991,\"xoxxx--oo\":-9007199254740991,\"xoxx-x-oo\":-9007199254740991,\"xoxx--xoo\":9007199254740991,\"xoxx---oo\":9007199254740991,\"xoxx---o-\":-9007199254740991,\"xox-xx-oo\":-9007199254740991,\"xox-x-xoo\":9007199254740991,\"xox-x--oo\":9007199254740991,\"xox-x--o-\":9007199254740991,\"xox--xxoo\":-9007199254740991,\"xox--x-oo\":-9007199254740991,\"xox--x-o-\":-9007199254740991,\"xox---xoo\":9007199254740991,\"xox---xo-\":-9007199254740991,\"xox----ox\":-9007199254740991,\"xox----o-\":9007199254740991,\"xoxx----o\":0,\"xox-x---o\":0,\"xox--x--o\":-9007199254740991,\"xox---x-o\":9007199254740991,\"xox----xo\":0,\"xox-----o\":9007199254740991,\"xox------\":0,\"xooxxox--\":9007199254740991,\"xooxxooxx\":9007199254740991,\"xooxxoox-\":9007199254740991,\"xooxxo-xo\":-9007199254740991,\"xooxxo-x-\":-9007199254740991,\"xooxxo--x\":9007199254740991,\"xooxxo---\":9007199254740991,\"xooxxxo--\":9007199254740991,\"xooxxxoxo\":9007199254740991,\"xooxx-oxo\":9007199254740991,\"xooxx-ox-\":9007199254740991,\"xooxx-o-x\":9007199254740991,\"xooxx-o--\":9007199254740991,\"xooxxx-o-\":9007199254740991,\"xooxx-xo-\":9007199254740991,\"xooxx--ox\":9007199254740991,\"xooxx--o-\":9007199254740991,\"xooxxx--o\":9007199254740991,\"xooxx-x-o\":9007199254740991,\"xooxx--xo\":-9007199254740991,\"xooxx---o\":9007199254740991,\"xooxx----\":9007199254740991,\"xooxoxx--\":9007199254740991,\"xooxoxox-\":-9007199254740991,\"xooxoxxxo\":9007199254740991,\"xooxox-xo\":9007199254740991,\"xooxox-x-\":-9007199254740991,\"xooxoxo-x\":-9007199254740991,\"xooxox-ox\":-9007199254740991,\"xooxox--x\":-9007199254740991,\"xooxox---\":9007199254740991,\"xoox-xoxo\":9007199254740991,\"xoox-xox-\":-9007199254740991,\"xooxxxoox\":9007199254740991,\"xoox-xoox\":9007199254740991,\"xoox-xo-x\":-9007199254740991,\"xoox-xo--\":9007199254740991,\"xoox-xxo-\":9007199254740991,\"xoox-x-ox\":-9007199254740991,\"xoox-x-o-\":9007199254740991,\"xoox-xx-o\":9007199254740991,\"xoox-x-xo\":9007199254740991,\"xoox-x--o\":9007199254740991,\"xoox-x---\":9007199254740991,\"xoox--x--\":9007199254740991,\"xooxo-xx-\":9007199254740991,\"xooxooxxx\":9007199254740991,\"xooxoo-xx\":9007199254740991,\"xooxo-oxx\":-9007199254740991,\"xooxo--xx\":-9007199254740991,\"xooxo--x-\":9007199254740991,\"xoox-oxx-\":9007199254740991,\"xoox-ooxx\":9007199254740991,\"xoox-o-xx\":9007199254740991,\"xoox-o-x-\":9007199254740991,\"xoox--oxx\":-9007199254740991,\"xoox--ox-\":9007199254740991,\"xoox--xxo\":9007199254740991,\"xoox---xo\":9007199254740991,\"xoox---x-\":9007199254740991,\"xooxo-x-x\":9007199254740991,\"xooxo---x\":9007199254740991,\"xoox-ox-x\":9007199254740991,\"xoox-o--x\":9007199254740991,\"xoox--o-x\":9007199254740991,\"xoox--xox\":9007199254740991,\"xoox---ox\":9007199254740991,\"xoox----x\":9007199254740991,\"xoox-----\":9007199254740991,\"xo-xoxoxo\":0,\"xo-xoxox-\":-9007199254740991,\"xo-xoxoox\":-9007199254740991,\"xo-xoxo-x\":-9007199254740991,\"xo-xoxo--\":-9007199254740991,\"xo-xox-o-\":-9007199254740991,\"xo-xoxx-o\":9007199254740991,\"xo-xox-xo\":0,\"xo-xox--o\":9007199254740991,\"xo-xox---\":-9007199254740991,\"xo-xo-x--\":9007199254740991,\"xo-xooxx-\":9007199254740991,\"xo-xoooxx\":0,\"xo-xoo-xx\":0,\"xo-xoo-x-\":9007199254740991,\"xo-xo-oxx\":-9007199254740991,\"xo-xo-ox-\":0,\"xo-xo-xxo\":9007199254740991,\"xo-xo--xo\":9007199254740991,\"xo-xo--x-\":0,\"xo-xoox-x\":9007199254740991,\"xo-xoo--x\":9007199254740991,\"xo-xo-o-x\":-9007199254740991,\"xo-xo--ox\":-9007199254740991,\"xo-xo---x\":-9007199254740991,\"xo-xo----\":9007199254740991,\"xo-xxooxo\":0,\"xo-xxoox-\":0,\"xo-xxoo-x\":9007199254740991,\"xo-xxoo--\":9007199254740991,\"xo-xxoxo-\":9007199254740991,\"xo-xxo-ox\":9007199254740991,\"xo-xxo-o-\":9007199254740991,\"xo-xxox-o\":9007199254740991,\"xo-xxo-xo\":-9007199254740991,\"xo-xxo--o\":9007199254740991,\"xo-xxo---\":9007199254740991,\"xo-x-ox--\":9007199254740991,\"xo-x-ooxx\":0,\"xo-x-oox-\":0,\"xo-x-oxxo\":9007199254740991,\"xo-x-o-xo\":9007199254740991,\"xo-x-o-x-\":0,\"xo-x-oo-x\":9007199254740991,\"xo-x-oxox\":9007199254740991,\"xo-x-o-ox\":9007199254740991,\"xo-x-o--x\":9007199254740991,\"xo-x-o---\":9007199254740991,\"xo-xxxoo-\":9007199254740991,\"xo-xx-oox\":9007199254740991,\"xo-xx-oo-\":9007199254740991,\"xo-xxxo-o\":9007199254740991,\"xo-xx-oxo\":0,\"xo-xx-o-o\":9007199254740991,\"xo-xx-o--\":9007199254740991,\"xo-x-xoox\":-9007199254740991,\"xo-x-xoo-\":9007199254740991,\"xo-x-xoxo\":0,\"xo-x-xo-o\":9007199254740991,\"xo-x-xo--\":-9007199254740991,\"xo-x--oxo\":0,\"xo-x--ox-\":0,\"xo-x--oox\":9007199254740991,\"xo-x--o-x\":-9007199254740991,\"xo-x--o--\":9007199254740991,\"xo-xxx-oo\":9007199254740991,\"xo-xx-xoo\":9007199254740991,\"xo-xx--oo\":9007199254740991,\"xo-xx--o-\":9007199254740991,\"xo-x-xxoo\":9007199254740991,\"xo-x-x-oo\":9007199254740991,\"xo-x-x-o-\":-9007199254740991,\"xo-x--xo-\":9007199254740991,\"xo-x---ox\":-9007199254740991,\"xo-x---o-\":9007199254740991,\"xo-xx---o\":9007199254740991,\"xo-x-x--o\":9007199254740991,\"xo-x--x-o\":9007199254740991,\"xo-x---xo\":0,\"xo-x----o\":9007199254740991,\"xo-x-----\":9007199254740991,\"xoooxxxox\":9007199254740991,\"xoooxxxo-\":9007199254740991,\"xoooxxxxo\":0,\"xoooxxx-o\":0,\"xoooxxx--\":0,\"xoooxxoxx\":9007199254740991,\"xoooxxox-\":9007199254740991,\"xoooxx-xo\":0,\"xoooxx-x-\":0,\"xoooxx--x\":9007199254740991,\"xoooxx---\":9007199254740991,\"xoo-xxoxo\":9007199254740991,\"xoo-xxox-\":9007199254740991,\"xoo-xxo-x\":9007199254740991,\"xoo-xxo--\":9007199254740991,\"xooxxxxoo\":9007199254740991,\"xoo-xxxoo\":9007199254740991,\"xoo-xxxo-\":9007199254740991,\"xoo-xx-ox\":9007199254740991,\"xoo-xx-o-\":9007199254740991,\"xoo-xxx-o\":0,\"xoo-xx-xo\":0,\"xoo-xx--o\":9007199254740991,\"xoo-xx---\":9007199254740991,\"xoooxoxxx\":9007199254740991,\"xoooxoxx-\":9007199254740991,\"xooox-xxo\":0,\"xooox-xx-\":0,\"xooox-x-x\":9007199254740991,\"xooox-x--\":9007199254740991,\"xoo-xoxxo\":-9007199254740991,\"xoo-xoxx-\":-9007199254740991,\"xoo-xox-x\":9007199254740991,\"xoo-xox--\":9007199254740991,\"xoo-x-xox\":9007199254740991,\"xoo-x-xo-\":9007199254740991,\"xoo-x-xxo\":-9007199254740991,\"xoo-x-x-o\":9007199254740991,\"xoo-x-x--\":9007199254740991,\"xooox--xx\":9007199254740991,\"xooox--x-\":9007199254740991,\"xoo-xo-xx\":9007199254740991,\"xoo-xo-x-\":9007199254740991,\"xoo-x-oxx\":9007199254740991,\"xoo-x-ox-\":9007199254740991,\"xoo-x--xo\":0,\"xoo-x--x-\":0,\"xoo-x---x\":9007199254740991,\"xoo-x----\":9007199254740991,\"xo-oxxoxo\":0,\"xo-oxxox-\":0,\"xo-oxxo-x\":9007199254740991,\"xo-oxxo--\":9007199254740991,\"xo-oxxxoo\":9007199254740991,\"xo-oxxxo-\":9007199254740991,\"xo-oxx-ox\":9007199254740991,\"xo-oxx-o-\":9007199254740991,\"xo-oxxx-o\":0,\"xo-oxx-xo\":0,\"xo-oxx--o\":0,\"xo-oxx---\":0,\"xo-oxoxxo\":9007199254740991,\"xo-oxoxx-\":9007199254740991,\"xo-oxox-x\":9007199254740991,\"xo-oxox--\":9007199254740991,\"xo-ox-xox\":9007199254740991,\"xo-ox-xo-\":9007199254740991,\"xo-ox-xxo\":0,\"xo-ox-x-o\":9007199254740991,\"xo-ox-x--\":9007199254740991,\"xo-oxo-xx\":9007199254740991,\"xo-oxo-x-\":9007199254740991,\"xo-ox-oxx\":9007199254740991,\"xo-ox-ox-\":9007199254740991,\"xo-ox--xo\":0,\"xo-ox--x-\":0,\"xo-ox---x\":9007199254740991,\"xo-ox----\":9007199254740991,\"xo--xoxox\":9007199254740991,\"xo--xoxo-\":9007199254740991,\"xo--xoxxo\":-9007199254740991,\"xo--xox-o\":9007199254740991,\"xo--xox--\":9007199254740991,\"xo--xooxx\":9007199254740991,\"xo--xoox-\":9007199254740991,\"xo--xo-xo\":0,\"xo--xo-x-\":0,\"xo--xo--x\":9007199254740991,\"xo--xo---\":9007199254740991,\"xo--xxoox\":9007199254740991,\"xo--xxoo-\":9007199254740991,\"xo--xxoxo\":0,\"xo--xxo-o\":9007199254740991,\"xo--xxo--\":9007199254740991,\"xo--x-oxo\":0,\"xo--x-ox-\":0,\"xo--x-o-x\":9007199254740991,\"xo--x-o--\":9007199254740991,\"xo--xxxoo\":9007199254740991,\"xo--xx-oo\":9007199254740991,\"xo--xx-o-\":9007199254740991,\"xo--x-xoo\":9007199254740991,\"xo--x-xo-\":9007199254740991,\"xo--x--ox\":9007199254740991,\"xo--x--o-\":9007199254740991,\"xo--xx--o\":0,\"xo--x-x-o\":9007199254740991,\"xo--x--xo\":0,\"xo--x---o\":9007199254740991,\"xo--x----\":9007199254740991,\"xooooxxxx\":9007199254740991,\"xooooxxx-\":9007199254740991,\"xooo-xxxo\":0,\"xooo-xxx-\":0,\"xooooxx-x\":9007199254740991,\"xooo-xxox\":9007199254740991,\"xooo-xx-x\":9007199254740991,\"xooo-xx--\":9007199254740991,\"xoo-oxxxo\":9007199254740991,\"xoo-oxxx-\":9007199254740991,\"xoo-oxxox\":-9007199254740991,\"xoo-oxx-x\":-9007199254740991,\"xoo-oxx--\":9007199254740991,\"xoo--xxox\":-9007199254740991,\"xoo--xxo-\":9007199254740991,\"xoo--xxxo\":0,\"xoo--xx-o\":9007199254740991,\"xoo--xx--\":9007199254740991,\"xoooox-xx\":9007199254740991,\"xooo-xoxx\":9007199254740991,\"xooo-x-xx\":9007199254740991,\"xooo-x-x-\":9007199254740991,\"xoo-oxoxx\":-9007199254740991,\"xoo-ox-xx\":-9007199254740991,\"xoo-ox-x-\":9007199254740991,\"xoo--xoxx\":-9007199254740991,\"xoo--xox-\":9007199254740991,\"xoo--x-xo\":9007199254740991,\"xoo--x-x-\":9007199254740991,\"xooo-x--x\":9007199254740991,\"xoo-ox--x\":-9007199254740991,\"xoo--xo-x\":9007199254740991,\"xoo--x-ox\":9007199254740991,\"xoo--x--x\":-9007199254740991,\"xoo--x---\":9007199254740991,\"xo-ooxxxo\":0,\"xo-ooxxx-\":0,\"xo-ooxxox\":-9007199254740991,\"xo-ooxx-x\":-9007199254740991,\"xo-ooxx--\":0,\"xo-o-xxox\":-9007199254740991,\"xo-o-xxo-\":9007199254740991,\"xo-o-xxxo\":0,\"xo-o-xx-o\":0,\"xo-o-xx--\":0,\"xo-ooxoxx\":9007199254740991,\"xo-oox-xx\":9007199254740991,\"xo-oox-x-\":9007199254740991,\"xo-o-xoxx\":9007199254740991,\"xo-o-xox-\":9007199254740991,\"xo-o-x-xo\":0,\"xo-o-x-x-\":0,\"xo-oox--x\":9007199254740991,\"xo-o-xo-x\":9007199254740991,\"xo-o-x-ox\":9007199254740991,\"xo-o-x--x\":9007199254740991,\"xo-o-x---\":9007199254740991,\"xo--oxxo-\":-9007199254740991,\"xo--oxxxo\":0,\"xo--oxx-o\":9007199254740991,\"xo--oxx--\":-9007199254740991,\"xo--oxoxx\":-9007199254740991,\"xo--oxox-\":0,\"xo--ox-xo\":0,\"xo--ox-x-\":0,\"xo--oxo-x\":9007199254740991,\"xo--ox-ox\":-9007199254740991,\"xo--ox--x\":-9007199254740991,\"xo--ox---\":0,\"xo---xoxo\":0,\"xo---xox-\":0,\"xo---xoox\":9007199254740991,\"xo---xo-x\":9007199254740991,\"xo---xo--\":9007199254740991,\"xo---xxoo\":9007199254740991,\"xo---xxo-\":-9007199254740991,\"xo---x-ox\":-9007199254740991,\"xo---x-o-\":9007199254740991,\"xo---xx-o\":0,\"xo---x-xo\":0,\"xo---x--o\":9007199254740991,\"xo---x---\":0,\"xooo--xxx\":9007199254740991,\"xooo--xx-\":9007199254740991,\"xoo-o-xxx\":9007199254740991,\"xoo-o-xx-\":9007199254740991,\"xoo--oxxx\":9007199254740991,\"xoo--oxx-\":9007199254740991,\"xoo---xxo\":9007199254740991,\"xoo---xx-\":9007199254740991,\"xooo--x-x\":9007199254740991,\"xoo-o-x-x\":9007199254740991,\"xoo--ox-x\":9007199254740991,\"xoo---xox\":9007199254740991,\"xoo---x-x\":9007199254740991,\"xoo---x--\":9007199254740991,\"xo-oo-xxx\":9007199254740991,\"xo-oo-xx-\":9007199254740991,\"xo-o-oxxx\":9007199254740991,\"xo-o-oxx-\":9007199254740991,\"xo-o--xxo\":0,\"xo-o--xx-\":0,\"xo-oo-x-x\":9007199254740991,\"xo-o-ox-x\":9007199254740991,\"xo-o--xox\":9007199254740991,\"xo-o--x-x\":9007199254740991,\"xo-o--x--\":9007199254740991,\"xo--ooxxx\":9007199254740991,\"xo--ooxx-\":9007199254740991,\"xo--o-xxo\":9007199254740991,\"xo--o-xx-\":9007199254740991,\"xo--oox-x\":9007199254740991,\"xo--o-xox\":-9007199254740991,\"xo--o-x-x\":-9007199254740991,\"xo--o-x--\":9007199254740991,\"xo---oxxo\":9007199254740991,\"xo---oxx-\":9007199254740991,\"xo---oxox\":9007199254740991,\"xo---ox-x\":9007199254740991,\"xo---ox--\":9007199254740991,\"xo----xox\":-9007199254740991,\"xo----xo-\":9007199254740991,\"xo----xxo\":0,\"xo----x-o\":9007199254740991,\"xo----x--\":9007199254740991,\"xooo---xx\":9007199254740991,\"xoo-o--xx\":9007199254740991,\"xoo--o-xx\":9007199254740991,\"xoo---oxx\":9007199254740991,\"xoo----xx\":9007199254740991,\"xoo----x-\":9007199254740991,\"xo-oo--xx\":9007199254740991,\"xo-o-o-xx\":9007199254740991,\"xo-o--oxx\":9007199254740991,\"xo-o---xx\":9007199254740991,\"xo-o---x-\":9007199254740991,\"xo--oo-xx\":9007199254740991,\"xo--o-oxx\":0,\"xo--o--xx\":0,\"xo--o--x-\":9007199254740991,\"xo---ooxx\":9007199254740991,\"xo---o-xx\":9007199254740991,\"xo---o-x-\":9007199254740991,\"xo----oxx\":0,\"xo----ox-\":0,\"xo-----xo\":0,\"xo-----x-\":0,\"xoo-----x\":9007199254740991,\"xo-o----x\":9007199254740991,\"xo--o---x\":0,\"xo---o--x\":9007199254740991,\"xo----o-x\":9007199254740991,\"xo-----ox\":9007199254740991,\"xo------x\":0,\"xo-------\":9007199254740991,\"xxooxoxox\":9007199254740991,\"xxooxoxo-\":9007199254740991,\"xxooxox-o\":-9007199254740991,\"xxooxox--\":-9007199254740991,\"xxooxo-x-\":9007199254740991,\"xxooxo--x\":9007199254740991,\"xxooxo---\":9007199254740991,\"xxooxxoox\":9007199254740991,\"xxooxxoo-\":9007199254740991,\"xxooxxoxo\":9007199254740991,\"xxooxxo-o\":9007199254740991,\"xxooxxo--\":9007199254740991,\"xxoox-ox-\":9007199254740991,\"xxoox-o-x\":9007199254740991,\"xxoox-o--\":9007199254740991,\"xxooxxxoo\":0,\"xxooxx-oo\":0,\"xxooxx-o-\":0,\"xxoox-xoo\":0,\"xxoox-xo-\":0,\"xxoox--ox\":9007199254740991,\"xxoox--o-\":9007199254740991,\"xxooxx--o\":0,\"xxoox-x-o\":-9007199254740991,\"xxoox--xo\":9007199254740991,\"xxoox---o\":9007199254740991,\"xxoox----\":9007199254740991,\"xxoooxxox\":0,\"xxoooxxo-\":0,\"xxoooxxxo\":0,\"xxoooxx-o\":0,\"xxoooxx--\":0,\"xxoooxox-\":-9007199254740991,\"xxooox-xo\":0,\"xxooox-x-\":-9007199254740991,\"xxoooxo-x\":-9007199254740991,\"xxooox-ox\":0,\"xxooox--x\":-9007199254740991,\"xxooox---\":0,\"xxoo-xoxo\":9007199254740991,\"xxoo-xox-\":-9007199254740991,\"xxoo-xoox\":9007199254740991,\"xxoo-xo-x\":-9007199254740991,\"xxoo-xo--\":9007199254740991,\"xxoo-xxoo\":0,\"xxoo-xxo-\":0,\"xxoo-x-ox\":0,\"xxoo-x-o-\":0,\"xxoo-xx-o\":0,\"xxoo-x-xo\":0,\"xxoo-x--o\":0,\"xxoo-x---\":0,\"xxooooxx-\":-9007199254740991,\"xxooo-xxo\":0,\"xxooo-xx-\":-9007199254740991,\"xxoooox-x\":-9007199254740991,\"xxooo-xox\":0,\"xxooo-x-x\":-9007199254740991,\"xxooo-x--\":0,\"xxoo-oxxo\":-9007199254740991,\"xxoo-oxx-\":-9007199254740991,\"xxoo-oxox\":9007199254740991,\"xxoo-ox-x\":-9007199254740991,\"xxoo-ox--\":-9007199254740991,\"xxoo--xox\":0,\"xxoo--xo-\":0,\"xxoo--xxo\":-9007199254740991,\"xxoo--x-o\":0,\"xxoo--x--\":-9007199254740991,\"xxoooo-xx\":-9007199254740991,\"xxooo-oxx\":-9007199254740991,\"xxooo--xx\":-9007199254740991,\"xxooo--x-\":-9007199254740991,\"xxooxooxx\":9007199254740991,\"xxoo-ooxx\":9007199254740991,\"xxoo-o-xx\":-9007199254740991,\"xxoo-o-x-\":9007199254740991,\"xxoo--oxx\":-9007199254740991,\"xxoo--ox-\":9007199254740991,\"xxoo---xo\":9007199254740991,\"xxoo---x-\":-9007199254740991,\"xxooo---x\":-9007199254740991,\"xxoo-o--x\":9007199254740991,\"xxoo--o-x\":9007199254740991,\"xxoo---ox\":9007199254740991,\"xxoo----x\":-9007199254740991,\"xxoo-----\":9007199254740991,\"xxoxoox--\":9007199254740991,\"xxoxooox-\":-9007199254740991,\"xxoxoo-xo\":-9007199254740991,\"xxoxoo-x-\":-9007199254740991,\"xxoxooo-x\":-9007199254740991,\"xxoxooxox\":9007199254740991,\"xxoxoo-ox\":9007199254740991,\"xxoxoo--x\":-9007199254740991,\"xxoxoo---\":9007199254740991,\"xxoxo-o--\":-9007199254740991,\"xxoxoxoo-\":-9007199254740991,\"xxoxoxxoo\":9007199254740991,\"xxoxox-oo\":9007199254740991,\"xxoxox-o-\":-9007199254740991,\"xxoxo-xo-\":9007199254740991,\"xxoxo-oox\":-9007199254740991,\"xxoxo--ox\":-9007199254740991,\"xxoxo--o-\":9007199254740991,\"xxoxoxo-o\":-9007199254740991,\"xxoxox--o\":-9007199254740991,\"xxoxo-x-o\":9007199254740991,\"xxoxo-oxo\":-9007199254740991,\"xxoxo--xo\":-9007199254740991,\"xxoxo---o\":9007199254740991,\"xxoxo----\":-9007199254740991,\"xxo-oxo--\":-9007199254740991,\"xxo-oxxoo\":9007199254740991,\"xxo-oxxo-\":0,\"xxo-oxoox\":-9007199254740991,\"xxo-ox-ox\":-9007199254740991,\"xxo-ox-o-\":0,\"xxo-oxx-o\":0,\"xxo-oxoxo\":-9007199254740991,\"xxo-ox-xo\":-9007199254740991,\"xxo-ox--o\":0,\"xxo-ox---\":-9007199254740991,\"xxo-ooxxo\":-9007199254740991,\"xxo-ooxx-\":-9007199254740991,\"xxo-ooxox\":9007199254740991,\"xxo-oox-x\":-9007199254740991,\"xxo-oox--\":9007199254740991,\"xxo-o-xox\":0,\"xxo-o-xo-\":9007199254740991,\"xxo-o-xxo\":-9007199254740991,\"xxo-o-x-o\":9007199254740991,\"xxo-o-x--\":0,\"xxo-oooxx\":-9007199254740991,\"xxo-oo-xx\":-9007199254740991,\"xxo-oo-x-\":-9007199254740991,\"xxo-o-ox-\":-9007199254740991,\"xxo-o--xo\":-9007199254740991,\"xxo-o--x-\":-9007199254740991,\"xxo-oo--x\":-9007199254740991,\"xxo-o-o-x\":-9007199254740991,\"xxo-o--ox\":0,\"xxo-o---x\":-9007199254740991,\"xxo-o----\":0,\"xxoxxooox\":9007199254740991,\"xxoxxooo-\":9007199254740991,\"xxoxxoo-o\":-9007199254740991,\"xxoxxoo--\":-9007199254740991,\"xxox-ooxo\":-9007199254740991,\"xxox-oox-\":-9007199254740991,\"xxox-ooox\":9007199254740991,\"xxox-oo-x\":-9007199254740991,\"xxox-oo--\":-9007199254740991,\"xxoxxo-oo\":-9007199254740991,\"xxoxxo-o-\":-9007199254740991,\"xxox-oxo-\":9007199254740991,\"xxox-o-ox\":9007199254740991,\"xxox-o-o-\":9007199254740991,\"xxox-o--o\":-9007199254740991,\"xxox-o---\":-9007199254740991,\"xxo-xoox-\":9007199254740991,\"xxo-xoo-x\":9007199254740991,\"xxo-xoo--\":9007199254740991,\"xxo-xoxoo\":-9007199254740991,\"xxo-xoxo-\":-9007199254740991,\"xxo-xo-ox\":9007199254740991,\"xxo-xo-o-\":9007199254740991,\"xxo-xo--o\":-9007199254740991,\"xxo-xo---\":-9007199254740991,\"xxo--oxox\":9007199254740991,\"xxo--oxo-\":9007199254740991,\"xxo--ox-o\":-9007199254740991,\"xxo--ox--\":-9007199254740991,\"xxo--ooxx\":-9007199254740991,\"xxo--oox-\":9007199254740991,\"xxo--o-xo\":-9007199254740991,\"xxo--o-x-\":-9007199254740991,\"xxo--oo-x\":9007199254740991,\"xxo--o-ox\":9007199254740991,\"xxo--o--x\":-9007199254740991,\"xxo--o---\":-9007199254740991,\"xxoxx-ooo\":-9007199254740991,\"xxoxx-oo-\":-9007199254740991,\"xxox-xooo\":-9007199254740991,\"xxox-xoo-\":-9007199254740991,\"xxox--oox\":-9007199254740991,\"xxox--oo-\":-9007199254740991,\"xxoxx-o-o\":-9007199254740991,\"xxox-xo-o\":-9007199254740991,\"xxox--oxo\":-9007199254740991,\"xxox--o-o\":-9007199254740991,\"xxox--o--\":-9007199254740991,\"xxo-xxooo\":-9007199254740991,\"xxo-xxoo-\":-9007199254740991,\"xxo-x-oox\":9007199254740991,\"xxo-x-oo-\":9007199254740991,\"xxo-xxo-o\":-9007199254740991,\"xxo-x-oxo\":9007199254740991,\"xxo-x-o-o\":9007199254740991,\"xxo-x-o--\":9007199254740991,\"xxo--xoox\":-9007199254740991,\"xxo--xoo-\":-9007199254740991,\"xxo--xoxo\":-9007199254740991,\"xxo--xo-o\":-9007199254740991,\"xxo--xo--\":-9007199254740991,\"xxo---oxo\":9007199254740991,\"xxo---ox-\":-9007199254740991,\"xxo---oox\":9007199254740991,\"xxo---o-x\":-9007199254740991,\"xxo---o--\":9007199254740991,\"xxoxx--oo\":-9007199254740991,\"xxox-x-oo\":-9007199254740991,\"xxox--xoo\":9007199254740991,\"xxox---oo\":9007199254740991,\"xxox---o-\":-9007199254740991,\"xxo-xx-oo\":-9007199254740991,\"xxo-x-xoo\":-9007199254740991,\"xxo-x--oo\":-9007199254740991,\"xxo-x--o-\":-9007199254740991,\"xxo--xxoo\":0,\"xxo--x-oo\":0,\"xxo--x-o-\":-9007199254740991,\"xxo---xoo\":9007199254740991,\"xxo---xo-\":0,\"xxo----ox\":0,\"xxo----o-\":0,\"xxox----o\":-9007199254740991,\"xxo-x---o\":-9007199254740991,\"xxo--x--o\":-9007199254740991,\"xxo---x-o\":-9007199254740991,\"xxo----xo\":-9007199254740991,\"xxo-----o\":-9007199254740991,\"xxo------\":-9007199254740991,\"x-oxoxo--\":-9007199254740991,\"x-oxoxxo-\":9007199254740991,\"x-oxoxoox\":-9007199254740991,\"x-oxox-ox\":-9007199254740991,\"x-oxox-o-\":9007199254740991,\"x-oxoxx-o\":9007199254740991,\"x-oxoxoxo\":-9007199254740991,\"x-oxox-xo\":-9007199254740991,\"x-oxox--o\":9007199254740991,\"x-oxox---\":-9007199254740991,\"x-oxo-x--\":9007199254740991,\"x-oxooxx-\":9007199254740991,\"x-oxoooxx\":-9007199254740991,\"x-oxoo-xx\":-9007199254740991,\"x-oxoo-x-\":9007199254740991,\"x-oxo-ox-\":-9007199254740991,\"x-oxo-xxo\":9007199254740991,\"x-oxo--xo\":9007199254740991,\"x-oxo--x-\":-9007199254740991,\"x-oxoox-x\":9007199254740991,\"x-oxoo--x\":9007199254740991,\"x-oxo-o-x\":-9007199254740991,\"x-oxo-xox\":9007199254740991,\"x-oxo--ox\":9007199254740991,\"x-oxo---x\":-9007199254740991,\"x-oxo----\":9007199254740991,\"x-oxxooxo\":-9007199254740991,\"x-oxxoox-\":-9007199254740991,\"x-oxxoo-x\":9007199254740991,\"x-oxxoo--\":9007199254740991,\"x-oxxoxo-\":9007199254740991,\"x-oxxo-ox\":9007199254740991,\"x-oxxo-o-\":9007199254740991,\"x-oxxo--o\":-9007199254740991,\"x-oxxo---\":-9007199254740991,\"x-ox-ox--\":9007199254740991,\"x-ox-ooxx\":-9007199254740991,\"x-ox-oox-\":-9007199254740991,\"x-ox-o-xo\":-9007199254740991,\"x-ox-o-x-\":-9007199254740991,\"x-ox-oo-x\":9007199254740991,\"x-ox-oxox\":9007199254740991,\"x-ox-o-ox\":9007199254740991,\"x-ox-o--x\":9007199254740991,\"x-ox-o---\":9007199254740991,\"x-oxxxoo-\":9007199254740991,\"x-oxx-oox\":9007199254740991,\"x-oxx-oo-\":9007199254740991,\"x-oxxxo-o\":9007199254740991,\"x-oxx-oxo\":-9007199254740991,\"x-oxx-o-o\":9007199254740991,\"x-oxx-o--\":9007199254740991,\"x-ox-xoox\":-9007199254740991,\"x-ox-xoo-\":9007199254740991,\"x-ox-xoxo\":-9007199254740991,\"x-ox-xo-o\":9007199254740991,\"x-ox-xo--\":-9007199254740991,\"x-ox--oxo\":-9007199254740991,\"x-ox--ox-\":-9007199254740991,\"x-ox--oox\":9007199254740991,\"x-ox--o-x\":-9007199254740991,\"x-ox--o--\":9007199254740991,\"x-oxxx-oo\":9007199254740991,\"x-oxx-xoo\":9007199254740991,\"x-oxx--oo\":9007199254740991,\"x-oxx--o-\":9007199254740991,\"x-ox-xxoo\":9007199254740991,\"x-ox-x-oo\":9007199254740991,\"x-ox-x-o-\":9007199254740991,\"x-ox--xo-\":9007199254740991,\"x-ox---ox\":9007199254740991,\"x-ox---o-\":9007199254740991,\"x-oxx---o\":-9007199254740991,\"x-ox-x--o\":9007199254740991,\"x-ox--x-o\":9007199254740991,\"x-ox---xo\":-9007199254740991,\"x-ox----o\":9007199254740991,\"x-ox-----\":9007199254740991,\"x-ooxxoxo\":9007199254740991,\"x-ooxxox-\":9007199254740991,\"x-ooxxo-x\":9007199254740991,\"x-ooxxo--\":9007199254740991,\"x-ooxxxoo\":0,\"x-ooxxxo-\":0,\"x-ooxx-ox\":9007199254740991,\"x-ooxx-o-\":9007199254740991,\"x-ooxxx-o\":0,\"x-ooxx-xo\":0,\"x-ooxx--o\":0,\"x-ooxx---\":0,\"x-ooxoxxo\":-9007199254740991,\"x-ooxoxx-\":-9007199254740991,\"x-ooxox-x\":9007199254740991,\"x-ooxox--\":9007199254740991,\"x-oox-xox\":9007199254740991,\"x-oox-xo-\":9007199254740991,\"x-oox-xxo\":-9007199254740991,\"x-oox-x-o\":0,\"x-oox-x--\":0,\"x-ooxo-xx\":9007199254740991,\"x-ooxo-x-\":9007199254740991,\"x-oox-oxx\":9007199254740991,\"x-oox-ox-\":9007199254740991,\"x-oox--xo\":9007199254740991,\"x-oox--x-\":9007199254740991,\"x-oox---x\":9007199254740991,\"x-oox----\":9007199254740991,\"x-o-xoxox\":9007199254740991,\"x-o-xoxo-\":9007199254740991,\"x-o-xox-o\":-9007199254740991,\"x-o-xox--\":-9007199254740991,\"x-o-xooxx\":9007199254740991,\"x-o-xoox-\":9007199254740991,\"x-o-xo-xo\":-9007199254740991,\"x-o-xo-x-\":-9007199254740991,\"x-o-xo--x\":9007199254740991,\"x-o-xo---\":9007199254740991,\"x-o-xxoox\":9007199254740991,\"x-o-xxoo-\":9007199254740991,\"x-o-xxoxo\":9007199254740991,\"x-o-xxo-o\":9007199254740991,\"x-o-xxo--\":9007199254740991,\"x-o-x-oxo\":9007199254740991,\"x-o-x-ox-\":9007199254740991,\"x-o-x-o-x\":9007199254740991,\"x-o-x-o--\":9007199254740991,\"x-o-xxxoo\":0,\"x-o-xx-oo\":9007199254740991,\"x-o-xx-o-\":9007199254740991,\"x-o-x-xoo\":9007199254740991,\"x-o-x-xo-\":9007199254740991,\"x-o-x--ox\":9007199254740991,\"x-o-x--o-\":9007199254740991,\"x-o-xx--o\":0,\"x-o-x-x-o\":-9007199254740991,\"x-o-x--xo\":-9007199254740991,\"x-o-x---o\":0,\"x-o-x----\":0,\"x-oooxxxo\":0,\"x-oooxxx-\":0,\"x-oooxxox\":0,\"x-oooxx-x\":0,\"x-oooxx--\":0,\"x-oo-xxox\":0,\"x-oo-xxo-\":0,\"x-oo-xxxo\":0,\"x-oo-xx-o\":0,\"x-oo-xx--\":0,\"x-oooxoxx\":-9007199254740991,\"x-ooox-xx\":-9007199254740991,\"x-ooox-x-\":0,\"x-oo-xoxx\":-9007199254740991,\"x-oo-xox-\":9007199254740991,\"x-oo-x-xo\":0,\"x-oo-x-x-\":0,\"x-ooox--x\":0,\"x-oo-xo-x\":9007199254740991,\"x-oo-x-ox\":9007199254740991,\"x-oo-x--x\":0,\"x-oo-x---\":0,\"x-o-oxxox\":-9007199254740991,\"x-o-oxxo-\":9007199254740991,\"x-o-oxxxo\":0,\"x-o-oxx-o\":9007199254740991,\"x-o-oxx--\":0,\"x-o-oxox-\":-9007199254740991,\"x-o-ox-xo\":0,\"x-o-ox-x-\":-9007199254740991,\"x-o-oxo-x\":-9007199254740991,\"x-o-ox-ox\":-9007199254740991,\"x-o-ox--x\":-9007199254740991,\"x-o-ox---\":0,\"x-o--xoxo\":9007199254740991,\"x-o--xox-\":-9007199254740991,\"x-o--xoox\":9007199254740991,\"x-o--xo-x\":-9007199254740991,\"x-o--xo--\":9007199254740991,\"x-o--xxoo\":9007199254740991,\"x-o--xxo-\":0,\"x-o--x-ox\":-9007199254740991,\"x-o--x-o-\":9007199254740991,\"x-o--xx-o\":0,\"x-o--x-xo\":0,\"x-o--x--o\":9007199254740991,\"x-o--x---\":0,\"x-ooo-xxx\":9007199254740991,\"x-ooo-xx-\":9007199254740991,\"x-oo-oxxx\":9007199254740991,\"x-oo-oxx-\":9007199254740991,\"x-oo--xxo\":0,\"x-oo--xx-\":0,\"x-ooo-x-x\":9007199254740991,\"x-oo-ox-x\":9007199254740991,\"x-oo--xox\":9007199254740991,\"x-oo--x-x\":9007199254740991,\"x-oo--x--\":9007199254740991,\"x-o-ooxxx\":9007199254740991,\"x-o-ooxx-\":9007199254740991,\"x-o-o-xxo\":9007199254740991,\"x-o-o-xx-\":9007199254740991,\"x-o-oox-x\":9007199254740991,\"x-o-o-xox\":9007199254740991,\"x-o-o-x-x\":9007199254740991,\"x-o-o-x--\":9007199254740991,\"x-o--oxxo\":-9007199254740991,\"x-o--oxx-\":-9007199254740991,\"x-o--oxox\":9007199254740991,\"x-o--ox-x\":9007199254740991,\"x-o--ox--\":9007199254740991,\"x-o---xox\":9007199254740991,\"x-o---xo-\":9007199254740991,\"x-o---xxo\":-9007199254740991,\"x-o---x-o\":9007199254740991,\"x-o---x--\":9007199254740991,\"x-ooo--xx\":9007199254740991,\"x-oo-o-xx\":9007199254740991,\"x-oo--oxx\":9007199254740991,\"x-oo---xx\":9007199254740991,\"x-oo---x-\":9007199254740991,\"x-o-oo-xx\":9007199254740991,\"x-o-o-oxx\":-9007199254740991,\"x-o-o--xx\":-9007199254740991,\"x-o-o--x-\":9007199254740991,\"x-o--ooxx\":9007199254740991,\"x-o--o-xx\":9007199254740991,\"x-o--o-x-\":9007199254740991,\"x-o---oxx\":-9007199254740991,\"x-o---ox-\":9007199254740991,\"x-o----xo\":0,\"x-o----x-\":0,\"x-oo----x\":9007199254740991,\"x-o-o---x\":9007199254740991,\"x-o--o--x\":9007199254740991,\"x-o---o-x\":9007199254740991,\"x-o----ox\":9007199254740991,\"x-o-----x\":9007199254740991,\"x-o------\":9007199254740991,\"xxxoo----\":9007199254740991,\"xxxooxo--\":9007199254740991,\"xxxooxoxo\":9007199254740991,\"xx-ooxoxo\":9007199254740991,\"xx-ooxox-\":-9007199254740991,\"xxxooxoox\":9007199254740991,\"xx-ooxoox\":9007199254740991,\"xx-ooxo-x\":-9007199254740991,\"xx-ooxo--\":9007199254740991,\"xxxoox-o-\":9007199254740991,\"xxxooxxoo\":9007199254740991,\"xx-ooxxoo\":9007199254740991,\"xx-ooxxo-\":0,\"xx-oox-ox\":0,\"xx-oox-o-\":9007199254740991,\"xxxoox--o\":9007199254740991,\"xx-ooxx-o\":0,\"xx-oox-xo\":0,\"xx-oox--o\":9007199254740991,\"xx-oox---\":0,\"xx-ooox--\":-9007199254740991,\"xxxoo-xo-\":9007199254740991,\"xx-oooxox\":-9007199254740991,\"xx-oo-xox\":-9007199254740991,\"xx-oo-xo-\":9007199254740991,\"xxxoo-x-o\":9007199254740991,\"xx-oooxxo\":-9007199254740991,\"xx-oo-xxo\":-9007199254740991,\"xx-oo-x-o\":9007199254740991,\"xx-oo-x--\":-9007199254740991,\"xx-ooo-x-\":-9007199254740991,\"xxxoo-ox-\":9007199254740991,\"xx-ooooxx\":-9007199254740991,\"xx-oo-oxx\":-9007199254740991,\"xx-oo-ox-\":9007199254740991,\"xxxoo--xo\":9007199254740991,\"xx-oo--xo\":9007199254740991,\"xx-oo--x-\":-9007199254740991,\"xx-ooo--x\":-9007199254740991,\"xxxoo-o-x\":9007199254740991,\"xx-oo-o-x\":9007199254740991,\"xxxoo--ox\":9007199254740991,\"xx-oo--ox\":9007199254740991,\"xx-oo---x\":-9007199254740991,\"xx-oo----\":9007199254740991,\"xxxo-o---\":9007199254740991,\"xxxoxoo--\":9007199254740991,\"xx-oxoox-\":9007199254740991,\"xx-oxoo-x\":9007199254740991,\"xx-oxoo--\":9007199254740991,\"xxxoxo-o-\":9007199254740991,\"xxxoxoxoo\":9007199254740991,\"xx-oxoxoo\":9007199254740991,\"xx-oxoxo-\":9007199254740991,\"xx-oxo-ox\":9007199254740991,\"xx-oxo-o-\":9007199254740991,\"xxxoxo--o\":9007199254740991,\"xx-oxox-o\":-9007199254740991,\"xx-oxo-xo\":9007199254740991,\"xx-oxo--o\":9007199254740991,\"xx-oxo---\":9007199254740991,\"xxxo-oxo-\":9007199254740991,\"xx-o-oxox\":-9007199254740991,\"xx-o-oxo-\":9007199254740991,\"xxxo-ox-o\":9007199254740991,\"xx-o-oxxo\":-9007199254740991,\"xx-o-ox-o\":9007199254740991,\"xx-o-ox--\":-9007199254740991,\"xxxo-oox-\":9007199254740991,\"xx-o-ooxx\":-9007199254740991,\"xx-o-oox-\":9007199254740991,\"xxxo-o-xo\":9007199254740991,\"xx-o-o-xo\":9007199254740991,\"xx-o-o-x-\":-9007199254740991,\"xxxo-oo-x\":9007199254740991,\"xx-o-oo-x\":9007199254740991,\"xxxo-o-ox\":9007199254740991,\"xx-o-o-ox\":9007199254740991,\"xx-o-o--x\":-9007199254740991,\"xx-o-o---\":9007199254740991,\"xxxo--o--\":9007199254740991,\"xxxox-oo-\":9007199254740991,\"xx-oxxooo\":-9007199254740991,\"xx-oxxoo-\":-9007199254740991,\"xx-ox-oox\":9007199254740991,\"xx-ox-oo-\":9007199254740991,\"xxxox-o-o\":9007199254740991,\"xx-oxxo-o\":-9007199254740991,\"xx-ox-oxo\":9007199254740991,\"xx-ox-o-o\":9007199254740991,\"xx-ox-o--\":9007199254740991,\"xxxo-xoo-\":9007199254740991,\"xx-o-xoox\":9007199254740991,\"xx-o-xoo-\":9007199254740991,\"xxxo-xo-o\":9007199254740991,\"xx-o-xoxo\":9007199254740991,\"xx-o-xo-o\":9007199254740991,\"xx-o-xo--\":9007199254740991,\"xxxo--oxo\":9007199254740991,\"xx-o--oxo\":9007199254740991,\"xx-o--ox-\":9007199254740991,\"xxxo--oox\":9007199254740991,\"xx-o--oox\":9007199254740991,\"xx-o--o-x\":9007199254740991,\"xx-o--o--\":9007199254740991,\"xxxo---o-\":9007199254740991,\"xxxox--oo\":9007199254740991,\"xx-oxx-oo\":-9007199254740991,\"xx-ox-xoo\":0,\"xx-ox--oo\":9007199254740991,\"xx-ox--o-\":9007199254740991,\"xxxo-x-oo\":9007199254740991,\"xx-o-xxoo\":0,\"xx-o-x-oo\":9007199254740991,\"xx-o-x-o-\":0,\"xxxo--xoo\":9007199254740991,\"xx-o--xoo\":9007199254740991,\"xx-o--xo-\":0,\"xx-o---ox\":9007199254740991,\"xx-o---o-\":9007199254740991,\"xxxo----o\":9007199254740991,\"xx-ox---o\":9007199254740991,\"xx-o-x--o\":0,\"xx-o--x-o\":0,\"xx-o---xo\":9007199254740991,\"xx-o----o\":9007199254740991,\"xx-o-----\":9007199254740991,\"x-xooxoxo\":9007199254740991,\"x-xooxox-\":9007199254740991,\"x-xooxo-x\":9007199254740991,\"x-xooxo--\":9007199254740991,\"x-xooxxoo\":9007199254740991,\"x-xooxxo-\":-9007199254740991,\"x-xoox-ox\":9007199254740991,\"x-xoox-o-\":9007199254740991,\"x-xooxx-o\":0,\"x-xoox-xo\":0,\"x-xoox--o\":9007199254740991,\"x-xoox---\":9007199254740991,\"x-xooox--\":-9007199254740991,\"x-xoooxox\":-9007199254740991,\"x-xoo-xox\":-9007199254740991,\"x-xoo-xo-\":9007199254740991,\"x-xoooxxo\":-9007199254740991,\"x-xoo-xxo\":-9007199254740991,\"x-xoo-x-o\":9007199254740991,\"x-xoo-x--\":-9007199254740991,\"x-xooo-x-\":-9007199254740991,\"x-xooooxx\":-9007199254740991,\"x-xoo-oxx\":-9007199254740991,\"x-xoo-ox-\":9007199254740991,\"x-xoo--xo\":9007199254740991,\"x-xoo--x-\":-9007199254740991,\"x-xooo--x\":-9007199254740991,\"x-xoo-o-x\":9007199254740991,\"x-xoo--ox\":9007199254740991,\"x-xoo---x\":-9007199254740991,\"x-xoo----\":9007199254740991,\"xxxoxooxo\":9007199254740991,\"x-xoxooxo\":9007199254740991,\"x-xoxoox-\":9007199254740991,\"x-xoxoo-x\":9007199254740991,\"x-xoxoo--\":9007199254740991,\"x-xoxoxo-\":9007199254740991,\"x-xoxo-ox\":9007199254740991,\"x-xoxo-o-\":9007199254740991,\"x-xoxox-o\":9007199254740991,\"x-xoxo-xo\":9007199254740991,\"x-xoxo--o\":9007199254740991,\"x-xoxo---\":9007199254740991,\"x-xo-oxox\":-9007199254740991,\"x-xo-oxo-\":9007199254740991,\"x-xo-oxxo\":-9007199254740991,\"x-xo-ox-o\":9007199254740991,\"x-xo-ox--\":-9007199254740991,\"x-xo-ooxx\":-9007199254740991,\"x-xo-oox-\":9007199254740991,\"x-xo-o-xo\":9007199254740991,\"x-xo-o-x-\":-9007199254740991,\"x-xo-oo-x\":9007199254740991,\"x-xo-o-ox\":9007199254740991,\"x-xo-o--x\":-9007199254740991,\"x-xo-o---\":9007199254740991,\"x-xoxxooo\":-9007199254740991,\"x-xoxxoo-\":-9007199254740991,\"x-xox-oox\":9007199254740991,\"x-xox-oo-\":9007199254740991,\"x-xoxxo-o\":-9007199254740991,\"x-xox-oxo\":0,\"x-xox-o-o\":9007199254740991,\"x-xox-o--\":9007199254740991,\"x-xo-xoox\":9007199254740991,\"x-xo-xoo-\":9007199254740991,\"x-xo-xoxo\":0,\"x-xo-xo-o\":9007199254740991,\"x-xo-xo--\":9007199254740991,\"x-xo--oxo\":9007199254740991,\"x-xo--ox-\":9007199254740991,\"x-xo--oox\":9007199254740991,\"x-xo--o-x\":9007199254740991,\"x-xo--o--\":9007199254740991,\"x-xoxx-oo\":-9007199254740991,\"x-xox-xoo\":9007199254740991,\"x-xox--oo\":9007199254740991,\"x-xox--o-\":9007199254740991,\"x-xo-xxoo\":9007199254740991,\"x-xo-x-oo\":9007199254740991,\"x-xo-x-o-\":9007199254740991,\"x-xo--xoo\":9007199254740991,\"x-xo--xo-\":9007199254740991,\"x-xo---ox\":9007199254740991,\"x-xo---o-\":9007199254740991,\"x-xox---o\":9007199254740991,\"x-xo-x--o\":0,\"x-xo--x-o\":9007199254740991,\"x-xo---xo\":0,\"x-xo----o\":9007199254740991,\"x-xo-----\":9007199254740991,\"x--oxoxox\":9007199254740991,\"x--oxoxo-\":9007199254740991,\"x--oxoxxo\":-9007199254740991,\"x--oxox-o\":9007199254740991,\"x--oxox--\":9007199254740991,\"x--oxooxx\":9007199254740991,\"x--oxoox-\":9007199254740991,\"x--oxo-xo\":9007199254740991,\"x--oxo-x-\":9007199254740991,\"x--oxo--x\":9007199254740991,\"x--oxo---\":9007199254740991,\"x--oxxoox\":9007199254740991,\"x--oxxoo-\":9007199254740991,\"x--oxxoxo\":0,\"x--oxxo-o\":0,\"x--oxxo--\":0,\"x--ox-oxo\":9007199254740991,\"x--ox-ox-\":9007199254740991,\"x--ox-o-x\":9007199254740991,\"x--ox-o--\":9007199254740991,\"x--oxxxoo\":0,\"x--oxx-oo\":0,\"x--oxx-o-\":0,\"x--ox-xoo\":9007199254740991,\"x--ox-xo-\":9007199254740991,\"x--ox--ox\":9007199254740991,\"x--ox--o-\":9007199254740991,\"x--oxx--o\":0,\"x--ox-x-o\":0,\"x--ox--xo\":0,\"x--ox---o\":9007199254740991,\"x--ox----\":9007199254740991,\"x--ooxxox\":-9007199254740991,\"x--ooxxo-\":0,\"x--ooxxxo\":0,\"x--ooxx-o\":0,\"x--ooxx--\":0,\"x--ooxoxx\":-9007199254740991,\"x--ooxox-\":9007199254740991,\"x--oox-xo\":0,\"x--oox-x-\":0,\"x--ooxo-x\":9007199254740991,\"x--oox-ox\":9007199254740991,\"x--oox--x\":0,\"x--oox---\":9007199254740991,\"x--o-xoxo\":9007199254740991,\"x--o-xox-\":9007199254740991,\"x--o-xoox\":9007199254740991,\"x--o-xo-x\":9007199254740991,\"x--o-xo--\":9007199254740991,\"x--o-xxoo\":9007199254740991,\"x--o-xxo-\":0,\"x--o-x-ox\":9007199254740991,\"x--o-x-o-\":9007199254740991,\"x--o-xx-o\":0,\"x--o-x-xo\":0,\"x--o-x--o\":0,\"x--o-x---\":0,\"x--oooxx-\":-9007199254740991,\"x--oo-xxo\":0,\"x--oo-xx-\":-9007199254740991,\"x--ooox-x\":-9007199254740991,\"x--oo-xox\":-9007199254740991,\"x--oo-x-x\":-9007199254740991,\"x--oo-x--\":0,\"x--o-oxxo\":-9007199254740991,\"x--o-oxx-\":-9007199254740991,\"x--o-oxox\":9007199254740991,\"x--o-ox-x\":-9007199254740991,\"x--o-ox--\":9007199254740991,\"x--o--xox\":-9007199254740991,\"x--o--xo-\":9007199254740991,\"x--o--xxo\":-9007199254740991,\"x--o--x-o\":9007199254740991,\"x--o--x--\":0,\"x--ooo-xx\":-9007199254740991,\"x--oo-oxx\":-9007199254740991,\"x--oo--xx\":-9007199254740991,\"x--oo--x-\":0,\"x--o-ooxx\":9007199254740991,\"x--o-o-xx\":-9007199254740991,\"x--o-o-x-\":9007199254740991,\"x--o--oxx\":-9007199254740991,\"x--o--ox-\":9007199254740991,\"x--o---xo\":9007199254740991,\"x--o---x-\":0,\"x--oo---x\":0,\"x--o-o--x\":9007199254740991,\"x--o--o-x\":9007199254740991,\"x--o---ox\":9007199254740991,\"x--o----x\":0,\"x--o-----\":9007199254740991,\"xxx-oo---\":9007199254740991,\"xxxxooo--\":9007199254740991,\"xxxxoooxo\":9007199254740991,\"xx-xoooxo\":9007199254740991,\"xx-xooox-\":-9007199254740991,\"xxxxoooox\":9007199254740991,\"xx-xoooox\":9007199254740991,\"xx-xooo-x\":-9007199254740991,\"xx-xooo--\":9007199254740991,\"xxxxoo-o-\":9007199254740991,\"xx-xooxo-\":9007199254740991,\"xx-xoo-ox\":9007199254740991,\"xx-xoo-o-\":9007199254740991,\"xxxxoo--o\":9007199254740991,\"xx-xoox-o\":9007199254740991,\"xx-xoo-xo\":-9007199254740991,\"xx-xoo--o\":9007199254740991,\"xx-xoo---\":9007199254740991,\"xxx-ooxo-\":9007199254740991,\"xx--ooxox\":-9007199254740991,\"xx--ooxo-\":9007199254740991,\"xxx-oox-o\":9007199254740991,\"xx--ooxxo\":-9007199254740991,\"xx--oox-o\":9007199254740991,\"xx--oox--\":-9007199254740991,\"xxx-ooox-\":9007199254740991,\"xx--oooxx\":-9007199254740991,\"xx--ooox-\":9007199254740991,\"xxx-oo-xo\":9007199254740991,\"xx--oo-xo\":9007199254740991,\"xx--oo-x-\":-9007199254740991,\"xxx-ooo-x\":9007199254740991,\"xx--ooo-x\":9007199254740991,\"xxx-oo-ox\":9007199254740991,\"xx--oo-ox\":9007199254740991,\"xx--oo--x\":-9007199254740991,\"xx--oo---\":9007199254740991,\"xxx-o-o--\":9007199254740991,\"xxxxo-oo-\":9007199254740991,\"xx-xoxooo\":-9007199254740991,\"xx-xoxoo-\":-9007199254740991,\"xx-xo-oox\":-9007199254740991,\"xx-xo-oo-\":9007199254740991,\"xxxxo-o-o\":9007199254740991,\"xx-xoxo-o\":-9007199254740991,\"xx-xo-oxo\":-9007199254740991,\"xx-xo-o-o\":9007199254740991,\"xx-xo-o--\":-9007199254740991,\"xxx-oxoo-\":9007199254740991,\"xx--oxoox\":-9007199254740991,\"xx--oxoo-\":9007199254740991,\"xxx-oxo-o\":9007199254740991,\"xx--oxoxo\":-9007199254740991,\"xx--oxo-o\":9007199254740991,\"xx--oxo--\":-9007199254740991,\"xxx-o-oxo\":9007199254740991,\"xx--o-oxo\":9007199254740991,\"xx--o-ox-\":-9007199254740991,\"xxx-o-oox\":9007199254740991,\"xx--o-oox\":9007199254740991,\"xx--o-o-x\":-9007199254740991,\"xx--o-o--\":9007199254740991,\"xxx-o--o-\":9007199254740991,\"xxxxo--oo\":9007199254740991,\"xx-xox-oo\":-9007199254740991,\"xx-xo-xoo\":9007199254740991,\"xx-xo--oo\":9007199254740991,\"xx-xo--o-\":9007199254740991,\"xxx-ox-oo\":9007199254740991,\"xx--oxxoo\":9007199254740991,\"xx--ox-oo\":9007199254740991,\"xx--ox-o-\":0,\"xxx-o-xoo\":9007199254740991,\"xx--o-xoo\":9007199254740991,\"xx--o-xo-\":9007199254740991,\"xx--o--ox\":0,\"xx--o--o-\":9007199254740991,\"xxx-o---o\":9007199254740991,\"xx-xo---o\":9007199254740991,\"xx--ox--o\":0,\"xx--o-x-o\":9007199254740991,\"xx--o--xo\":-9007199254740991,\"xx--o---o\":9007199254740991,\"xx--o----\":0,\"x-xxoooxo\":9007199254740991,\"x-xxooox-\":0,\"x-xxoooox\":9007199254740991,\"x-xxooo-x\":0,\"x-xxooo--\":9007199254740991,\"x-xxooxo-\":9007199254740991,\"x-xxoo-ox\":-9007199254740991,\"x-xxoo-o-\":9007199254740991,\"x-xxoox-o\":9007199254740991,\"x-xxoo-xo\":9007199254740991,\"x-xxoo--o\":9007199254740991,\"x-xxoo---\":9007199254740991,\"x-x-ooxox\":-9007199254740991,\"x-x-ooxo-\":9007199254740991,\"x-x-ooxxo\":-9007199254740991,\"x-x-oox-o\":9007199254740991,\"x-x-oox--\":-9007199254740991,\"x-x-oooxx\":-9007199254740991,\"x-x-ooox-\":9007199254740991,\"x-x-oo-xo\":9007199254740991,\"x-x-oo-x-\":-9007199254740991,\"x-x-ooo-x\":9007199254740991,\"x-x-oo-ox\":9007199254740991,\"x-x-oo--x\":-9007199254740991,\"x-x-oo---\":9007199254740991,\"x-xxoxooo\":-9007199254740991,\"x-xxoxoo-\":-9007199254740991,\"x-xxo-oox\":-9007199254740991,\"x-xxo-oo-\":9007199254740991,\"x-xxoxo-o\":-9007199254740991,\"x-xxo-oxo\":0,\"x-xxo-o-o\":9007199254740991,\"x-xxo-o--\":0,\"x-x-oxoox\":9007199254740991,\"x-x-oxoo-\":9007199254740991,\"x-x-oxoxo\":0,\"x-x-oxo-o\":9007199254740991,\"x-x-oxo--\":9007199254740991,\"x-x-o-oxo\":9007199254740991,\"x-x-o-ox-\":0,\"x-x-o-oox\":9007199254740991,\"x-x-o-o-x\":9007199254740991,\"x-x-o-o--\":9007199254740991,\"x-xxox-oo\":-9007199254740991,\"x-xxo-xoo\":9007199254740991,\"x-xxo--oo\":9007199254740991,\"x-xxo--o-\":-9007199254740991,\"x-x-oxxoo\":-9007199254740991,\"x-x-ox-oo\":9007199254740991,\"x-x-ox-o-\":-9007199254740991,\"x-x-o-xoo\":9007199254740991,\"x-x-o-xo-\":-9007199254740991,\"x-x-o--ox\":-9007199254740991,\"x-x-o--o-\":9007199254740991,\"x-xxo---o\":9007199254740991,\"x-x-ox--o\":0,\"x-x-o-x-o\":9007199254740991,\"x-x-o--xo\":0,\"x-x-o---o\":9007199254740991,\"x-x-o----\":0,\"x--xoox--\":9007199254740991,\"x--xoooxx\":-9007199254740991,\"x--xooox-\":0,\"x--xooxxo\":9007199254740991,\"x--xoo-xo\":9007199254740991,\"x--xoo-x-\":0,\"x--xooo-x\":0,\"x--xooxox\":9007199254740991,\"x--xoo-ox\":9007199254740991,\"x--xoo--x\":0,\"x--xoo---\":9007199254740991,\"x--xoxoox\":-9007199254740991,\"x--xoxoo-\":-9007199254740991,\"x--xoxoxo\":-9007199254740991,\"x--xoxo-o\":-9007199254740991,\"x--xoxo--\":-9007199254740991,\"x--xo-oxo\":0,\"x--xo-ox-\":-9007199254740991,\"x--xo-oox\":-9007199254740991,\"x--xo-o-x\":-9007199254740991,\"x--xo-o--\":0,\"x--xoxxoo\":9007199254740991,\"x--xox-oo\":9007199254740991,\"x--xox-o-\":-9007199254740991,\"x--xo-xo-\":9007199254740991,\"x--xo--ox\":-9007199254740991,\"x--xo--o-\":9007199254740991,\"x--xox--o\":-9007199254740991,\"x--xo-x-o\":9007199254740991,\"x--xo--xo\":0,\"x--xo---o\":9007199254740991,\"x--xo----\":0,\"x---oxoxo\":0,\"x---oxox-\":-9007199254740991,\"x---oxoox\":9007199254740991,\"x---oxo-x\":-9007199254740991,\"x---oxo--\":9007199254740991,\"x---oxxoo\":9007199254740991,\"x---oxxo-\":-9007199254740991,\"x---ox-ox\":-9007199254740991,\"x---ox-o-\":0,\"x---oxx-o\":0,\"x---ox-xo\":0,\"x---ox--o\":0,\"x---ox---\":0,\"x---ooxxo\":9007199254740991,\"x---ooxx-\":-9007199254740991,\"x---ooxox\":9007199254740991,\"x---oox-x\":-9007199254740991,\"x---oox--\":9007199254740991,\"x---o-xox\":-9007199254740991,\"x---o-xo-\":9007199254740991,\"x---o-xxo\":0,\"x---o-x-o\":9007199254740991,\"x---o-x--\":0,\"x---oooxx\":-9007199254740991,\"x---oo-xx\":-9007199254740991,\"x---oo-x-\":0,\"x---o-oxx\":-9007199254740991,\"x---o-ox-\":0,\"x---o--xo\":0,\"x---o--x-\":0,\"x---oo--x\":0,\"x---o-o-x\":9007199254740991,\"x---o--ox\":0,\"x---o---x\":0,\"x---o----\":0,\"xxx--oo--\":9007199254740991,\"xxxx-ooo-\":9007199254740991,\"xx-xxoooo\":-9007199254740991,\"xx-xxooo-\":-9007199254740991,\"xx-x-ooox\":9007199254740991,\"xx-x-ooo-\":9007199254740991,\"xxxx-oo-o\":9007199254740991,\"xx-xxoo-o\":-9007199254740991,\"xx-x-ooxo\":-9007199254740991,\"xx-x-oo-o\":9007199254740991,\"xx-x-oo--\":-9007199254740991,\"xxx-xooo-\":9007199254740991,\"xx--xooox\":9007199254740991,\"xx--xooo-\":9007199254740991,\"xxx-xoo-o\":9007199254740991,\"xx--xooxo\":9007199254740991,\"xx--xoo-o\":9007199254740991,\"xx--xoo--\":9007199254740991,\"xxx--ooxo\":9007199254740991,\"xx---ooxo\":9007199254740991,\"xx---oox-\":9007199254740991,\"xxx--ooox\":9007199254740991,\"xx---ooox\":9007199254740991,\"xx---oo-x\":9007199254740991,\"xx---oo--\":9007199254740991,\"xxx--o-o-\":9007199254740991,\"xxxx-o-oo\":9007199254740991,\"xx-xxo-oo\":-9007199254740991,\"xx-x-oxoo\":9007199254740991,\"xx-x-o-oo\":9007199254740991,\"xx-x-o-o-\":9007199254740991,\"xxx-xo-oo\":9007199254740991,\"xx--xoxoo\":-9007199254740991,\"xx--xo-oo\":9007199254740991,\"xx--xo-o-\":9007199254740991,\"xxx--oxoo\":9007199254740991,\"xx---oxoo\":9007199254740991,\"xx---oxo-\":9007199254740991,\"xx---o-ox\":9007199254740991,\"xx---o-o-\":9007199254740991,\"xxx--o--o\":9007199254740991,\"xx-x-o--o\":-9007199254740991,\"xx--xo--o\":-9007199254740991,\"xx---ox-o\":-9007199254740991,\"xx---o-xo\":-9007199254740991,\"xx---o--o\":9007199254740991,\"xx---o---\":-9007199254740991,\"x-xxxoooo\":-9007199254740991,\"x-xxxooo-\":-9007199254740991,\"x-xx-ooox\":9007199254740991,\"x-xx-ooo-\":9007199254740991,\"x-xxxoo-o\":-9007199254740991,\"x-xx-ooxo\":0,\"x-xx-oo-o\":9007199254740991,\"x-xx-oo--\":0,\"x-x-xooox\":9007199254740991,\"x-x-xooo-\":9007199254740991,\"x-x-xooxo\":0,\"x-x-xoo-o\":9007199254740991,\"x-x-xoo--\":9007199254740991,\"x-x--ooxo\":9007199254740991,\"x-x--oox-\":0,\"x-x--ooox\":9007199254740991,\"x-x--oo-x\":9007199254740991,\"x-x--oo--\":9007199254740991,\"x-xxxo-oo\":-9007199254740991,\"x-xx-oxoo\":9007199254740991,\"x-xx-o-oo\":9007199254740991,\"x-xx-o-o-\":9007199254740991,\"x-x-xoxoo\":9007199254740991,\"x-x-xo-oo\":9007199254740991,\"x-x-xo-o-\":9007199254740991,\"x-x--oxoo\":9007199254740991,\"x-x--oxo-\":9007199254740991,\"x-x--o-ox\":9007199254740991,\"x-x--o-o-\":9007199254740991,\"x-xx-o--o\":9007199254740991,\"x-x-xo--o\":9007199254740991,\"x-x--ox-o\":9007199254740991,\"x-x--o-xo\":9007199254740991,\"x-x--o--o\":9007199254740991,\"x-x--o---\":9007199254740991,\"x--xxooox\":9007199254740991,\"x--xxooo-\":9007199254740991,\"x--xxooxo\":-9007199254740991,\"x--xxoo-o\":-9007199254740991,\"x--xxoo--\":-9007199254740991,\"x--x-ooxo\":0,\"x--x-oox-\":-9007199254740991,\"x--x-ooox\":9007199254740991,\"x--x-oo-x\":0,\"x--x-oo--\":0,\"x--xxoxoo\":9007199254740991,\"x--xxo-oo\":9007199254740991,\"x--xxo-o-\":9007199254740991,\"x--x-oxo-\":9007199254740991,\"x--x-o-ox\":9007199254740991,\"x--x-o-o-\":9007199254740991,\"x--xxo--o\":-9007199254740991,\"x--x-ox-o\":9007199254740991,\"x--x-o-xo\":-9007199254740991,\"x--x-o--o\":9007199254740991,\"x--x-o---\":0,\"x---xooxo\":9007199254740991,\"x---xoox-\":9007199254740991,\"x---xoo-x\":9007199254740991,\"x---xoo--\":9007199254740991,\"x---xoxoo\":9007199254740991,\"x---xoxo-\":9007199254740991,\"x---xo-ox\":9007199254740991,\"x---xo-o-\":9007199254740991,\"x---xox-o\":-9007199254740991,\"x---xo-xo\":-9007199254740991,\"x---xo--o\":9007199254740991,\"x---xo---\":9007199254740991,\"x----oxox\":9007199254740991,\"x----oxo-\":9007199254740991,\"x----oxxo\":-9007199254740991,\"x----ox-o\":9007199254740991,\"x----ox--\":9007199254740991,\"x----ooxx\":-9007199254740991,\"x----oox-\":9007199254740991,\"x----o-xo\":9007199254740991,\"x----o-x-\":0,\"x----oo-x\":9007199254740991,\"x----o-ox\":9007199254740991,\"x----o--x\":0,\"x----o---\":9007199254740991,\"xxx---oo-\":9007199254740991,\"xx-x--ooo\":-9007199254740991,\"xx-x--oo-\":-9007199254740991,\"xx--x-ooo\":-9007199254740991,\"xx--x-oo-\":-9007199254740991,\"xx---xooo\":-9007199254740991,\"xx---xoo-\":-9007199254740991,\"xx----oox\":9007199254740991,\"xx----oo-\":9007199254740991,\"xxx---o-o\":9007199254740991,\"xx-x--o-o\":-9007199254740991,\"xx--x-o-o\":-9007199254740991,\"xx---xo-o\":-9007199254740991,\"xx----oxo\":9007199254740991,\"xx----o-o\":9007199254740991,\"xx----o--\":9007199254740991,\"x-xx--ooo\":-9007199254740991,\"x-xx--oo-\":-9007199254740991,\"x-x-x-ooo\":-9007199254740991,\"x-x-x-oo-\":-9007199254740991,\"x-x--xooo\":-9007199254740991,\"x-x--xoo-\":-9007199254740991,\"x-x---oox\":9007199254740991,\"x-x---oo-\":9007199254740991,\"x-xx--o-o\":-9007199254740991,\"x-x-x-o-o\":-9007199254740991,\"x-x--xo-o\":-9007199254740991,\"x-x---oxo\":0,\"x-x---o-o\":9007199254740991,\"x-x---o--\":9007199254740991,\"x--xx-ooo\":-9007199254740991,\"x--xx-oo-\":-9007199254740991,\"x--x-xooo\":-9007199254740991,\"x--x-xoo-\":-9007199254740991,\"x--x--oox\":-9007199254740991,\"x--x--oo-\":-9007199254740991,\"x--xx-o-o\":-9007199254740991,\"x--x-xo-o\":-9007199254740991,\"x--x--oxo\":-9007199254740991,\"x--x--o-o\":-9007199254740991,\"x--x--o--\":-9007199254740991,\"x---xxooo\":-9007199254740991,\"x---xxoo-\":-9007199254740991,\"x---x-oox\":9007199254740991,\"x---x-oo-\":9007199254740991,\"x---xxo-o\":-9007199254740991,\"x---x-oxo\":0,\"x---x-o-o\":0,\"x---x-o--\":0,\"x----xoox\":9007199254740991,\"x----xoo-\":9007199254740991,\"x----xoxo\":0,\"x----xo-o\":0,\"x----xo--\":0,\"x-----oxo\":9007199254740991,\"x-----ox-\":0,\"x-----oox\":9007199254740991,\"x-----o-x\":9007199254740991,\"x-----o--\":9007199254740991,\"xxx----oo\":9007199254740991,\"xx-x---oo\":-9007199254740991,\"xx--x--oo\":-9007199254740991,\"xx---x-oo\":-9007199254740991,\"xx----xoo\":9007199254740991,\"xx-----oo\":9007199254740991,\"xx-----o-\":0,\"x-xx---oo\":-9007199254740991,\"x-x-x--oo\":-9007199254740991,\"x-x--x-oo\":-9007199254740991,\"x-x---xoo\":9007199254740991,\"x-x----oo\":9007199254740991,\"x-x----o-\":9007199254740991,\"x--xx--oo\":-9007199254740991,\"x--x-x-oo\":-9007199254740991,\"x--x--xoo\":9007199254740991,\"x--x---oo\":9007199254740991,\"x--x---o-\":-9007199254740991,\"x---xx-oo\":-9007199254740991,\"x---x-xoo\":9007199254740991,\"x---x--oo\":9007199254740991,\"x---x--o-\":9007199254740991,\"x----xxoo\":9007199254740991,\"x----x-oo\":9007199254740991,\"x----x-o-\":0,\"x-----xoo\":9007199254740991,\"x-----xo-\":9007199254740991,\"x------ox\":0,\"x------o-\":9007199254740991,\"xx------o\":-9007199254740991,\"x-x-----o\":9007199254740991,\"x--x----o\":-9007199254740991,\"x---x---o\":0,\"x----x--o\":0,\"x-----x-o\":9007199254740991,\"x------xo\":0,\"x-------o\":9007199254740991,\"x--------\":0,\"oxxoxox--\":9007199254740991,\"oxxoxo-x-\":9007199254740991,\"oxxoxoo-x\":-9007199254740991,\"oxxoxoxox\":9007199254740991,\"oxxoxo-ox\":9007199254740991,\"oxxoxo--x\":-9007199254740991,\"oxxoxo---\":9007199254740991,\"oxxox-o--\":-9007199254740991,\"oxxoxxoo-\":-9007199254740991,\"oxxoxxxoo\":9007199254740991,\"oxxoxx-oo\":9007199254740991,\"oxxoxx-o-\":-9007199254740991,\"oxxox-xo-\":9007199254740991,\"oxxox-oox\":-9007199254740991,\"oxxox--ox\":-9007199254740991,\"oxxox--o-\":9007199254740991,\"oxxoxxo-o\":-9007199254740991,\"oxxoxx--o\":-9007199254740991,\"oxxox-x-o\":9007199254740991,\"oxxox--xo\":9007199254740991,\"oxxox---o\":9007199254740991,\"oxxox----\":-9007199254740991,\"oxxooxxox\":9007199254740991,\"oxxooxxo-\":9007199254740991,\"oxxooxx-o\":-9007199254740991,\"oxxooxx--\":-9007199254740991,\"oxxooxox-\":-9007199254740991,\"oxxoox-xo\":-9007199254740991,\"oxxoox-x-\":-9007199254740991,\"oxxoox--x\":9007199254740991,\"oxxoox---\":9007199254740991,\"oxxo-xo--\":-9007199254740991,\"oxxo-xxoo\":9007199254740991,\"oxxo-xxo-\":9007199254740991,\"oxxo-x-ox\":9007199254740991,\"oxxo-x-o-\":9007199254740991,\"oxxo-xx-o\":-9007199254740991,\"oxxo-xoxo\":-9007199254740991,\"oxxo-x-xo\":-9007199254740991,\"oxxo-x--o\":-9007199254740991,\"oxxo-x---\":-9007199254740991,\"oxxoooxx-\":-9007199254740991,\"oxxoo-xxo\":-9007199254740991,\"oxxoo-xx-\":-9007199254740991,\"oxxooox-x\":-9007199254740991,\"oxxoo-xox\":9007199254740991,\"oxxoo-x-x\":-9007199254740991,\"oxxoo-x--\":-9007199254740991,\"oxxoxoxxo\":9007199254740991,\"oxxo-oxxo\":9007199254740991,\"oxxo-oxx-\":-9007199254740991,\"oxxo-oxox\":9007199254740991,\"oxxo-ox-x\":-9007199254740991,\"oxxo-ox--\":9007199254740991,\"oxxo--xox\":9007199254740991,\"oxxo--xo-\":9007199254740991,\"oxxo--xxo\":-9007199254740991,\"oxxo--x-o\":9007199254740991,\"oxxo--x--\":-9007199254740991,\"oxxooo-xx\":-9007199254740991,\"oxxoo-oxx\":-9007199254740991,\"oxxoo--xx\":-9007199254740991,\"oxxoo--x-\":-9007199254740991,\"oxxo-ooxx\":-9007199254740991,\"oxxo-o-xx\":-9007199254740991,\"oxxo-o-x-\":9007199254740991,\"oxxo--ox-\":-9007199254740991,\"oxxo---xo\":9007199254740991,\"oxxo---x-\":-9007199254740991,\"oxxoo---x\":9007199254740991,\"oxxo-o--x\":-9007199254740991,\"oxxo--o-x\":-9007199254740991,\"oxxo---ox\":9007199254740991,\"oxxo----x\":-9007199254740991,\"oxxo-----\":-9007199254740991,\"oxxxooxox\":0,\"oxxxooxo-\":0,\"oxxxoox-o\":-9007199254740991,\"oxxxoox--\":-9007199254740991,\"oxxxoooxx\":0,\"oxxxooox-\":0,\"oxxxoo-xo\":-9007199254740991,\"oxxxoo-x-\":-9007199254740991,\"oxxxooo-x\":0,\"oxxxoo-ox\":0,\"oxxxoo--x\":0,\"oxxxoo---\":0,\"oxxxoxoox\":9007199254740991,\"oxxxoxoo-\":9007199254740991,\"oxxxoxo-o\":-9007199254740991,\"oxxxoxo--\":-9007199254740991,\"oxxxo-oxo\":-9007199254740991,\"oxxxo-ox-\":-9007199254740991,\"oxxxo-oox\":9007199254740991,\"oxxxo-o-x\":0,\"oxxxo-o--\":0,\"oxxxox-oo\":-9007199254740991,\"oxxxox-o-\":-9007199254740991,\"oxxxo-xoo\":-9007199254740991,\"oxxxo-xo-\":-9007199254740991,\"oxxxo--ox\":0,\"oxxxo--o-\":0,\"oxxxo---o\":-9007199254740991,\"oxxxo----\":-9007199254740991,\"oxx-oxoxo\":-9007199254740991,\"oxx-oxox-\":-9007199254740991,\"oxx-oxo-x\":9007199254740991,\"oxx-oxo--\":9007199254740991,\"oxx-oxxoo\":-9007199254740991,\"oxx-oxxo-\":-9007199254740991,\"oxx-ox-ox\":9007199254740991,\"oxx-ox-o-\":9007199254740991,\"oxx-ox--o\":-9007199254740991,\"oxx-ox---\":-9007199254740991,\"oxx-ooxxo\":-9007199254740991,\"oxx-ooxx-\":-9007199254740991,\"oxx-ooxox\":0,\"oxx-oox-x\":-9007199254740991,\"oxx-oox--\":-9007199254740991,\"oxx-o-xox\":0,\"oxx-o-xo-\":0,\"oxx-o-x-o\":-9007199254740991,\"oxx-o-x--\":-9007199254740991,\"oxx-oooxx\":0,\"oxx-oo-xx\":-9007199254740991,\"oxx-oo-x-\":-9007199254740991,\"oxx-o-oxx\":-9007199254740991,\"oxx-o-ox-\":-9007199254740991,\"oxx-o--xo\":-9007199254740991,\"oxx-o--x-\":-9007199254740991,\"oxx-oo--x\":0,\"oxx-o-o-x\":9007199254740991,\"oxx-o--ox\":9007199254740991,\"oxx-o---x\":0,\"oxx-o----\":0,\"oxxxxooox\":0,\"oxxxxooo-\":0,\"oxxxxooxo\":9007199254740991,\"oxxxxoo-o\":9007199254740991,\"oxxxxoo--\":0,\"oxxx-ooxo\":9007199254740991,\"oxxx-oox-\":0,\"oxxx-ooox\":0,\"oxxx-oo-x\":0,\"oxxx-oo--\":0,\"oxxxxoxoo\":9007199254740991,\"oxxxxo-oo\":9007199254740991,\"oxxxxo-o-\":0,\"oxxx-oxoo\":9007199254740991,\"oxxx-oxo-\":0,\"oxxx-o-ox\":0,\"oxxx-o-o-\":0,\"oxxxxo--o\":9007199254740991,\"oxxx-ox-o\":-9007199254740991,\"oxxx-o-xo\":-9007199254740991,\"oxxx-o--o\":9007199254740991,\"oxxx-o---\":0,\"oxx-xoox-\":9007199254740991,\"oxx-xooox\":0,\"oxx-xoo-x\":-9007199254740991,\"oxx-xoo--\":9007199254740991,\"oxx-xoxo-\":9007199254740991,\"oxx-xo-ox\":0,\"oxx-xo-o-\":9007199254740991,\"oxx-xox-o\":9007199254740991,\"oxx-xo-xo\":9007199254740991,\"oxx-xo--o\":9007199254740991,\"oxx-xo---\":9007199254740991,\"oxx--oxox\":0,\"oxx--oxo-\":9007199254740991,\"oxx--oxxo\":-9007199254740991,\"oxx--ox-o\":9007199254740991,\"oxx--ox--\":-9007199254740991,\"oxx--ooxx\":-9007199254740991,\"oxx--oox-\":9007199254740991,\"oxx--o-xo\":9007199254740991,\"oxx--o-x-\":-9007199254740991,\"oxx--oo-x\":0,\"oxx--o-ox\":0,\"oxx--o--x\":-9007199254740991,\"oxx--o---\":9007199254740991,\"oxxxx-ooo\":-9007199254740991,\"oxxxx-oo-\":-9007199254740991,\"oxxx-xooo\":-9007199254740991,\"oxxx-xoo-\":-9007199254740991,\"oxxx--oox\":0,\"oxxx--oo-\":0,\"oxxxx-o-o\":-9007199254740991,\"oxxx-xo-o\":-9007199254740991,\"oxxx--oxo\":-9007199254740991,\"oxxx--o-o\":-9007199254740991,\"oxxx--o--\":-9007199254740991,\"oxx-xxooo\":-9007199254740991,\"oxx-xxoo-\":-9007199254740991,\"oxx-x-oox\":-9007199254740991,\"oxx-x-oo-\":-9007199254740991,\"oxx-xxo-o\":-9007199254740991,\"oxx-x-oxo\":9007199254740991,\"oxx-x-o-o\":9007199254740991,\"oxx-x-o--\":-9007199254740991,\"oxx--xoox\":9007199254740991,\"oxx--xoo-\":9007199254740991,\"oxx--xoxo\":-9007199254740991,\"oxx--xo-o\":-9007199254740991,\"oxx--xo--\":-9007199254740991,\"oxx---oxo\":9007199254740991,\"oxx---ox-\":-9007199254740991,\"oxx---oox\":9007199254740991,\"oxx---o-x\":-9007199254740991,\"oxx---o--\":-9007199254740991,\"oxxxx--oo\":-9007199254740991,\"oxxx-x-oo\":-9007199254740991,\"oxxx--xoo\":-9007199254740991,\"oxxx---oo\":-9007199254740991,\"oxxx---o-\":-9007199254740991,\"oxx-xx-oo\":-9007199254740991,\"oxx-x-xoo\":9007199254740991,\"oxx-x--oo\":9007199254740991,\"oxx-x--o-\":-9007199254740991,\"oxx--xxoo\":-9007199254740991,\"oxx--x-oo\":-9007199254740991,\"oxx--x-o-\":-9007199254740991,\"oxx---xoo\":9007199254740991,\"oxx---xo-\":0,\"oxx----ox\":0,\"oxx----o-\":0,\"oxxx----o\":-9007199254740991,\"oxx-x---o\":9007199254740991,\"oxx--x--o\":-9007199254740991,\"oxx---x-o\":-9007199254740991,\"oxx----xo\":-9007199254740991,\"oxx-----o\":9007199254740991,\"oxx------\":-9007199254740991,\"oxoxxoxox\":0,\"oxoxxoxo-\":0,\"oxoxxox-o\":-9007199254740991,\"oxoxxox--\":-9007199254740991,\"oxoxxo-x-\":9007199254740991,\"oxoxxooxx\":9007199254740991,\"oxoxxoo-x\":9007199254740991,\"oxoxxo-ox\":0,\"oxoxxo--x\":0,\"oxoxxo---\":9007199254740991,\"oxoxxxo--\":9007199254740991,\"oxoxx-ox-\":9007199254740991,\"oxoxxxoox\":9007199254740991,\"oxoxx-oox\":9007199254740991,\"oxoxx-o-x\":9007199254740991,\"oxoxx-o--\":9007199254740991,\"oxoxxx-o-\":9007199254740991,\"oxoxxxxoo\":9007199254740991,\"oxoxx-xoo\":9007199254740991,\"oxoxx-xo-\":0,\"oxoxx--ox\":0,\"oxoxx--o-\":9007199254740991,\"oxoxxx--o\":9007199254740991,\"oxoxx-x-o\":-9007199254740991,\"oxoxx--xo\":9007199254740991,\"oxoxx---o\":9007199254740991,\"oxoxx----\":9007199254740991,\"oxoxoxxox\":0,\"oxoxoxxo-\":0,\"oxoxoxx-o\":-9007199254740991,\"oxoxoxx--\":-9007199254740991,\"oxoxoxox-\":-9007199254740991,\"oxoxox-xo\":-9007199254740991,\"oxoxox-x-\":-9007199254740991,\"oxoxoxo-x\":-9007199254740991,\"oxoxox-ox\":0,\"oxoxox--x\":-9007199254740991,\"oxoxox---\":-9007199254740991,\"oxoxxxoxo\":9007199254740991,\"oxox-xoxo\":9007199254740991,\"oxox-xox-\":-9007199254740991,\"oxox-xoox\":9007199254740991,\"oxox-xo-x\":-9007199254740991,\"oxox-xo--\":9007199254740991,\"oxox-xxoo\":9007199254740991,\"oxox-xxo-\":0,\"oxox-x-ox\":0,\"oxox-x-o-\":9007199254740991,\"oxox-xx-o\":-9007199254740991,\"oxox-x-xo\":-9007199254740991,\"oxox-x--o\":9007199254740991,\"oxox-x---\":-9007199254740991,\"oxoxooxxx\":9007199254740991,\"oxoxooxx-\":9007199254740991,\"oxoxo-xxo\":-9007199254740991,\"oxoxo-xx-\":-9007199254740991,\"oxoxoox-x\":9007199254740991,\"oxoxo-xox\":0,\"oxoxo-x-x\":0,\"oxoxo-x--\":0,\"oxox-oxxo\":-9007199254740991,\"oxox-oxx-\":-9007199254740991,\"oxox-oxox\":0,\"oxox-ox-x\":0,\"oxox-ox--\":0,\"oxox--xox\":0,\"oxox--xo-\":0,\"oxox--xxo\":-9007199254740991,\"oxox--x-o\":-9007199254740991,\"oxox--x--\":-9007199254740991,\"oxoxoo-xx\":9007199254740991,\"oxoxo-oxx\":-9007199254740991,\"oxoxo--xx\":-9007199254740991,\"oxoxo--x-\":-9007199254740991,\"oxox-ooxx\":9007199254740991,\"oxox-o-xx\":9007199254740991,\"oxox-o-x-\":9007199254740991,\"oxox--oxx\":-9007199254740991,\"oxox--ox-\":9007199254740991,\"oxox---xo\":9007199254740991,\"oxox---x-\":-9007199254740991,\"oxoxo---x\":0,\"oxox-o--x\":9007199254740991,\"oxox--o-x\":9007199254740991,\"oxox---ox\":0,\"oxox----x\":0,\"oxox-----\":9007199254740991,\"ox-xoxoxo\":-9007199254740991,\"ox-xoxox-\":-9007199254740991,\"ox-xoxoox\":9007199254740991,\"ox-xoxo-x\":-9007199254740991,\"ox-xoxo--\":-9007199254740991,\"ox-xoxxoo\":-9007199254740991,\"ox-xoxxo-\":-9007199254740991,\"ox-xox-ox\":0,\"ox-xox-o-\":0,\"ox-xox--o\":-9007199254740991,\"ox-xox---\":-9007199254740991,\"ox-xooxxo\":-9007199254740991,\"ox-xooxx-\":-9007199254740991,\"ox-xooxox\":0,\"ox-xoox-x\":0,\"ox-xoox--\":0,\"ox-xo-xox\":0,\"ox-xo-xo-\":0,\"ox-xo-x-o\":-9007199254740991,\"ox-xo-x--\":-9007199254740991,\"ox-xoooxx\":0,\"ox-xoo-xx\":0,\"ox-xoo-x-\":0,\"ox-xo-oxx\":-9007199254740991,\"ox-xo-ox-\":-9007199254740991,\"ox-xo--xo\":-9007199254740991,\"ox-xo--x-\":-9007199254740991,\"ox-xoo--x\":0,\"ox-xo-o-x\":0,\"ox-xo--ox\":0,\"ox-xo---x\":0,\"ox-xo----\":0,\"ox-xxoox-\":9007199254740991,\"ox-xxooox\":0,\"ox-xxoo-x\":0,\"ox-xxoo--\":9007199254740991,\"ox-xxoxoo\":9007199254740991,\"ox-xxoxo-\":0,\"ox-xxo-ox\":0,\"ox-xxo-o-\":0,\"ox-xxox-o\":-9007199254740991,\"ox-xxo-xo\":9007199254740991,\"ox-xxo--o\":9007199254740991,\"ox-xxo---\":0,\"ox-x-oxox\":0,\"ox-x-oxo-\":0,\"ox-x-oxxo\":-9007199254740991,\"ox-x-ox-o\":-9007199254740991,\"ox-x-ox--\":-9007199254740991,\"ox-x-ooxx\":0,\"ox-x-oox-\":9007199254740991,\"ox-x-o-xo\":9007199254740991,\"ox-x-o-x-\":0,\"ox-x-oo-x\":0,\"ox-x-o-ox\":0,\"ox-x-o--x\":0,\"ox-x-o---\":0,\"ox-xxxoo-\":9007199254740991,\"ox-xx-oox\":0,\"ox-xx-oo-\":9007199254740991,\"ox-xxxo-o\":9007199254740991,\"ox-xx-oxo\":9007199254740991,\"ox-xx-o-o\":9007199254740991,\"ox-xx-o--\":9007199254740991,\"ox-x-xoox\":9007199254740991,\"ox-x-xoo-\":9007199254740991,\"ox-x-xoxo\":-9007199254740991,\"ox-x-xo-o\":9007199254740991,\"ox-x-xo--\":-9007199254740991,\"ox-x--oxo\":9007199254740991,\"ox-x--ox-\":-9007199254740991,\"ox-x--oox\":9007199254740991,\"ox-x--o-x\":0,\"ox-x--o--\":9007199254740991,\"ox-xxx-oo\":9007199254740991,\"ox-xx-xoo\":9007199254740991,\"ox-xx--oo\":9007199254740991,\"ox-xx--o-\":0,\"ox-x-xxoo\":-9007199254740991,\"ox-x-x-oo\":9007199254740991,\"ox-x-x-o-\":0,\"ox-x--xoo\":9007199254740991,\"ox-x--xo-\":0,\"ox-x---ox\":0,\"ox-x---o-\":0,\"ox-xx---o\":9007199254740991,\"ox-x-x--o\":-9007199254740991,\"ox-x--x-o\":-9007199254740991,\"ox-x---xo\":-9007199254740991,\"ox-x----o\":9007199254740991,\"ox-x-----\":0,\"oxooxxxox\":0,\"oxooxxxo-\":0,\"oxooxxxxo\":9007199254740991,\"oxooxxx-o\":9007199254740991,\"oxooxxx--\":0,\"oxooxx-x-\":9007199254740991,\"oxooxxo-x\":-9007199254740991,\"oxooxx-ox\":0,\"oxooxx--x\":-9007199254740991,\"oxooxx---\":9007199254740991,\"oxo-xxox-\":9007199254740991,\"oxo-xxoox\":9007199254740991,\"oxo-xxo-x\":-9007199254740991,\"oxo-xxo--\":9007199254740991,\"oxo-xxxoo\":9007199254740991,\"oxo-xxxo-\":0,\"oxo-xx-ox\":0,\"oxo-xx-o-\":9007199254740991,\"oxo-xxx-o\":9007199254740991,\"oxo-xx-xo\":9007199254740991,\"oxo-xx--o\":9007199254740991,\"oxo-xx---\":9007199254740991,\"oxoox-xx-\":9007199254740991,\"oxooxoxxx\":9007199254740991,\"oxooxox-x\":9007199254740991,\"oxoox-xox\":0,\"oxoox-x-x\":0,\"oxoox-x--\":9007199254740991,\"oxo-xoxx-\":9007199254740991,\"oxo-xoxox\":0,\"oxo-xox-x\":0,\"oxo-xox--\":9007199254740991,\"oxo-x-xox\":0,\"oxo-x-xo-\":0,\"oxo-x-xxo\":9007199254740991,\"oxo-x-x-o\":9007199254740991,\"oxo-x-x--\":0,\"oxo-x--x-\":9007199254740991,\"oxoox--xx\":9007199254740991,\"oxoox---x\":9007199254740991,\"oxo-xo-xx\":9007199254740991,\"oxo-xo--x\":9007199254740991,\"oxo-x-oxx\":9007199254740991,\"oxo-x-o-x\":9007199254740991,\"oxo-x--ox\":0,\"oxo-x---x\":0,\"oxo-x----\":9007199254740991,\"ox-oxxo--\":-9007199254740991,\"ox-oxxxoo\":9007199254740991,\"ox-oxxxo-\":0,\"ox-oxxoox\":-9007199254740991,\"ox-oxx-ox\":-9007199254740991,\"ox-oxx-o-\":0,\"ox-oxxx-o\":9007199254740991,\"ox-oxx-xo\":9007199254740991,\"ox-oxx--o\":9007199254740991,\"ox-oxx---\":-9007199254740991,\"ox-oxoxx-\":9007199254740991,\"ox-oxoxox\":9007199254740991,\"ox-oxox-x\":9007199254740991,\"ox-oxox--\":9007199254740991,\"ox-ox-xox\":0,\"ox-ox-xo-\":9007199254740991,\"ox-ox-xxo\":9007199254740991,\"ox-ox-x-o\":9007199254740991,\"ox-ox-x--\":9007199254740991,\"ox-ox--x-\":9007199254740991,\"ox-oxo-xx\":9007199254740991,\"ox-oxo--x\":9007199254740991,\"ox-ox-o-x\":-9007199254740991,\"ox-ox--ox\":0,\"ox-ox---x\":-9007199254740991,\"ox-ox----\":9007199254740991,\"ox--xoxox\":0,\"ox--xoxo-\":9007199254740991,\"ox--xoxxo\":9007199254740991,\"ox--xox-o\":9007199254740991,\"ox--xox--\":9007199254740991,\"ox--xo-x-\":9007199254740991,\"ox--xooxx\":9007199254740991,\"ox--xoo-x\":9007199254740991,\"ox--xo-ox\":0,\"ox--xo--x\":0,\"ox--xo---\":9007199254740991,\"ox--xxoox\":-9007199254740991,\"ox--xxoo-\":9007199254740991,\"ox--xxoxo\":9007199254740991,\"ox--xxo-o\":9007199254740991,\"ox--xxo--\":-9007199254740991,\"ox--x-ox-\":9007199254740991,\"ox--x-oox\":0,\"ox--x-o-x\":-9007199254740991,\"ox--x-o--\":9007199254740991,\"ox--xxxoo\":9007199254740991,\"ox--xx-oo\":9007199254740991,\"ox--xx-o-\":0,\"ox--x-xoo\":9007199254740991,\"ox--x-xo-\":0,\"ox--x--ox\":0,\"ox--x--o-\":0,\"ox--xx--o\":9007199254740991,\"ox--x-x-o\":9007199254740991,\"ox--x--xo\":9007199254740991,\"ox--x---o\":9007199254740991,\"ox--x----\":0,\"oxoooxxxx\":9007199254740991,\"oxoooxxx-\":9007199254740991,\"oxoo-xxxo\":9007199254740991,\"oxoo-xxx-\":9007199254740991,\"oxoooxx-x\":9007199254740991,\"oxoo-xxox\":0,\"oxoo-xx-x\":0,\"oxoo-xx--\":9007199254740991,\"oxo-oxxxo\":-9007199254740991,\"oxo-oxxx-\":-9007199254740991,\"oxo-oxxox\":0,\"oxo-oxx-x\":0,\"oxo-oxx--\":0,\"oxo--xxox\":0,\"oxo--xxo-\":0,\"oxo--xxxo\":-9007199254740991,\"oxo--xx-o\":9007199254740991,\"oxo--xx--\":0,\"oxooox-xx\":9007199254740991,\"oxoo-xoxx\":-9007199254740991,\"oxoo-x-xx\":-9007199254740991,\"oxoo-x-x-\":9007199254740991,\"oxo-oxoxx\":-9007199254740991,\"oxo-ox-xx\":-9007199254740991,\"oxo-ox-x-\":-9007199254740991,\"oxo--xoxx\":-9007199254740991,\"oxo--xox-\":9007199254740991,\"oxo--x-xo\":9007199254740991,\"oxo--x-x-\":-9007199254740991,\"oxoo-x--x\":0,\"oxo-ox--x\":0,\"oxo--xo-x\":-9007199254740991,\"oxo--x-ox\":0,\"oxo--x--x\":-9007199254740991,\"oxo--x---\":9007199254740991,\"ox-ooxxxo\":-9007199254740991,\"ox-ooxxx-\":-9007199254740991,\"ox-ooxxox\":9007199254740991,\"ox-ooxx-x\":9007199254740991,\"ox-ooxx--\":9007199254740991,\"ox-o-xxox\":0,\"ox-o-xxo-\":9007199254740991,\"ox-o-xxxo\":-9007199254740991,\"ox-o-xx-o\":9007199254740991,\"ox-o-xx--\":9007199254740991,\"ox-ooxoxx\":-9007199254740991,\"ox-oox-xx\":-9007199254740991,\"ox-oox-x-\":-9007199254740991,\"ox-o-xox-\":-9007199254740991,\"ox-o-x-xo\":9007199254740991,\"ox-o-x-x-\":-9007199254740991,\"ox-oox--x\":9007199254740991,\"ox-o-xo-x\":-9007199254740991,\"ox-o-x-ox\":9007199254740991,\"ox-o-x--x\":-9007199254740991,\"ox-o-x---\":9007199254740991,\"ox--oxxox\":0,\"ox--oxxo-\":0,\"ox--oxx-o\":-9007199254740991,\"ox--oxx--\":-9007199254740991,\"ox--oxoxx\":-9007199254740991,\"ox--oxox-\":-9007199254740991,\"ox--ox-xo\":-9007199254740991,\"ox--ox-x-\":-9007199254740991,\"ox--oxo-x\":9007199254740991,\"ox--ox-ox\":9007199254740991,\"ox--ox--x\":0,\"ox--ox---\":0,\"ox---xoxo\":9007199254740991,\"ox---xox-\":-9007199254740991,\"ox---xoox\":9007199254740991,\"ox---xo-x\":-9007199254740991,\"ox---xo--\":-9007199254740991,\"ox---xxoo\":9007199254740991,\"ox---xxo-\":0,\"ox---x-ox\":0,\"ox---x-o-\":0,\"ox---xx-o\":-9007199254740991,\"ox---x-xo\":-9007199254740991,\"ox---x--o\":9007199254740991,\"ox---x---\":-9007199254740991,\"oxoo--xxx\":9007199254740991,\"oxoo--xx-\":9007199254740991,\"oxo-o-xxx\":9007199254740991,\"oxo-o-xx-\":9007199254740991,\"oxo--oxxx\":9007199254740991,\"oxo--oxx-\":9007199254740991,\"oxo---xxo\":9007199254740991,\"oxo---xx-\":9007199254740991,\"oxoo--x-x\":9007199254740991,\"oxo-o-x-x\":9007199254740991,\"oxo--ox-x\":9007199254740991,\"oxo---xox\":0,\"oxo---x-x\":0,\"oxo---x--\":9007199254740991,\"ox-oo-xxx\":9007199254740991,\"ox-oo-xx-\":9007199254740991,\"ox-o-oxxx\":9007199254740991,\"ox-o-oxx-\":9007199254740991,\"ox-o--xxo\":9007199254740991,\"ox-o--xx-\":9007199254740991,\"ox-oo-x-x\":9007199254740991,\"ox-o-ox-x\":9007199254740991,\"ox-o--xox\":9007199254740991,\"ox-o--x-x\":9007199254740991,\"ox-o--x--\":9007199254740991,\"ox--ooxxx\":9007199254740991,\"ox--ooxx-\":9007199254740991,\"ox--o-xxo\":-9007199254740991,\"ox--o-xx-\":-9007199254740991,\"ox--oox-x\":9007199254740991,\"ox--o-xox\":0,\"ox--o-x-x\":0,\"ox--o-x--\":0,\"ox---oxxo\":9007199254740991,\"ox---oxx-\":9007199254740991,\"ox---oxox\":0,\"ox---ox-x\":0,\"ox---ox--\":9007199254740991,\"ox----xox\":0,\"ox----xo-\":0,\"ox----xxo\":-9007199254740991,\"ox----x-o\":9007199254740991,\"ox----x--\":0,\"oxoo---xx\":9007199254740991,\"oxo-o--xx\":9007199254740991,\"oxo--o-xx\":9007199254740991,\"oxo---oxx\":9007199254740991,\"oxo----xx\":9007199254740991,\"oxo----x-\":9007199254740991,\"ox-oo--xx\":9007199254740991,\"ox-o-o-xx\":9007199254740991,\"ox-o--oxx\":-9007199254740991,\"ox-o---xx\":-9007199254740991,\"ox-o---x-\":9007199254740991,\"ox--oo-xx\":9007199254740991,\"ox--o-oxx\":-9007199254740991,\"ox--o--xx\":-9007199254740991,\"ox--o--x-\":-9007199254740991,\"ox---ooxx\":9007199254740991,\"ox---o-xx\":9007199254740991,\"ox---o-x-\":9007199254740991,\"ox----oxx\":-9007199254740991,\"ox----ox-\":9007199254740991,\"ox-----xo\":9007199254740991,\"ox-----x-\":-9007199254740991,\"oxo-----x\":9007199254740991,\"ox-o----x\":9007199254740991,\"ox--o---x\":0,\"ox---o--x\":9007199254740991,\"ox----o-x\":0,\"ox-----ox\":0,\"ox------x\":0,\"ox-------\":0,\"-xoxoxo--\":-9007199254740991,\"-xoxoxxoo\":9007199254740991,\"-xoxoxxo-\":0,\"-xoxoxoox\":-9007199254740991,\"-xoxox-ox\":-9007199254740991,\"-xoxox-o-\":0,\"-xoxoxx-o\":-9007199254740991,\"-xoxoxoxo\":-9007199254740991,\"-xoxox-xo\":-9007199254740991,\"-xoxox--o\":-9007199254740991,\"-xoxox---\":-9007199254740991,\"-xoxooxxo\":-9007199254740991,\"-xoxooxx-\":-9007199254740991,\"-xoxooxox\":9007199254740991,\"-xoxoox-x\":9007199254740991,\"-xoxoox--\":9007199254740991,\"-xoxo-xox\":0,\"-xoxo-xo-\":9007199254740991,\"-xoxo-xxo\":-9007199254740991,\"-xoxo-x-o\":9007199254740991,\"-xoxo-x--\":0,\"-xoxoooxx\":-9007199254740991,\"-xoxoo-xx\":-9007199254740991,\"-xoxoo-x-\":-9007199254740991,\"-xoxo-ox-\":-9007199254740991,\"-xoxo--xo\":-9007199254740991,\"-xoxo--x-\":-9007199254740991,\"-xoxoo--x\":9007199254740991,\"-xoxo-o-x\":-9007199254740991,\"-xoxo--ox\":0,\"-xoxo---x\":-9007199254740991,\"-xoxo----\":0,\"-xoxxoox-\":9007199254740991,\"-xoxxooox\":9007199254740991,\"-xoxxoo-x\":9007199254740991,\"-xoxxoo--\":9007199254740991,\"-xoxxoxoo\":-9007199254740991,\"-xoxxoxo-\":-9007199254740991,\"-xoxxo-ox\":0,\"-xoxxo-o-\":0,\"-xoxxo--o\":-9007199254740991,\"-xoxxo---\":-9007199254740991,\"-xox-oxox\":0,\"-xox-oxo-\":9007199254740991,\"-xox-ox-o\":-9007199254740991,\"-xox-ox--\":-9007199254740991,\"-xox-ooxx\":-9007199254740991,\"-xox-oox-\":9007199254740991,\"-xox-o-xo\":-9007199254740991,\"-xox-o-x-\":-9007199254740991,\"-xox-oo-x\":9007199254740991,\"-xox-o-ox\":9007199254740991,\"-xox-o--x\":9007199254740991,\"-xox-o---\":9007199254740991,\"-xoxxxoo-\":9007199254740991,\"-xoxx-oox\":9007199254740991,\"-xoxx-oo-\":9007199254740991,\"-xoxxxo-o\":9007199254740991,\"-xoxx-oxo\":9007199254740991,\"-xoxx-o-o\":9007199254740991,\"-xoxx-o--\":9007199254740991,\"-xox-xoox\":-9007199254740991,\"-xox-xoo-\":9007199254740991,\"-xox-xoxo\":-9007199254740991,\"-xox-xo-o\":9007199254740991,\"-xox-xo--\":-9007199254740991,\"-xox--oxo\":9007199254740991,\"-xox--ox-\":-9007199254740991,\"-xox--oox\":9007199254740991,\"-xox--o-x\":-9007199254740991,\"-xox--o--\":9007199254740991,\"-xoxxx-oo\":9007199254740991,\"-xoxx-xoo\":-9007199254740991,\"-xoxx--oo\":9007199254740991,\"-xoxx--o-\":0,\"-xox-xxoo\":9007199254740991,\"-xox-x-oo\":9007199254740991,\"-xox-x-o-\":0,\"-xox--xoo\":9007199254740991,\"-xox--xo-\":0,\"-xox---ox\":0,\"-xox---o-\":0,\"-xoxx---o\":-9007199254740991,\"-xox-x--o\":-9007199254740991,\"-xox--x-o\":-9007199254740991,\"-xox---xo\":-9007199254740991,\"-xox----o\":-9007199254740991,\"-xox-----\":-9007199254740991,\"-xooxxox-\":9007199254740991,\"-xooxxoox\":9007199254740991,\"-xooxxo-x\":-9007199254740991,\"-xooxxo--\":9007199254740991,\"-xooxxxoo\":0,\"-xooxxxo-\":0,\"-xooxx-ox\":0,\"-xooxx-o-\":0,\"-xooxxx-o\":0,\"-xooxx-xo\":9007199254740991,\"-xooxx--o\":9007199254740991,\"-xooxx---\":0,\"-xooxoxx-\":9007199254740991,\"-xooxoxox\":9007199254740991,\"-xooxox-x\":9007199254740991,\"-xooxox--\":9007199254740991,\"-xoox-xox\":0,\"-xoox-xo-\":0,\"-xoox-xxo\":9007199254740991,\"-xoox-x-o\":9007199254740991,\"-xoox-x--\":0,\"-xoox--x-\":9007199254740991,\"-xooxo-xx\":9007199254740991,\"-xooxo--x\":9007199254740991,\"-xoox-oxx\":9007199254740991,\"-xoox-o-x\":9007199254740991,\"-xoox--ox\":9007199254740991,\"-xoox---x\":9007199254740991,\"-xoox----\":9007199254740991,\"-xo-xoxox\":0,\"-xo-xoxo-\":0,\"-xo-xox-o\":-9007199254740991,\"-xo-xox--\":-9007199254740991,\"-xo-xo-x-\":9007199254740991,\"-xo-xooxx\":9007199254740991,\"-xo-xoo-x\":9007199254740991,\"-xo-xo-ox\":9007199254740991,\"-xo-xo--x\":9007199254740991,\"-xo-xo---\":9007199254740991,\"-xo-xxoox\":9007199254740991,\"-xo-xxoo-\":9007199254740991,\"-xo-xxoxo\":9007199254740991,\"-xo-xxo-o\":9007199254740991,\"-xo-xxo--\":9007199254740991,\"-xo-x-ox-\":9007199254740991,\"-xo-x-oox\":9007199254740991,\"-xo-x-o-x\":9007199254740991,\"-xo-x-o--\":9007199254740991,\"-xo-xxxoo\":0,\"-xo-xx-oo\":9007199254740991,\"-xo-xx-o-\":0,\"-xo-x-xoo\":0,\"-xo-x-xo-\":0,\"-xo-x--ox\":0,\"-xo-x--o-\":0,\"-xo-xx--o\":9007199254740991,\"-xo-x-x-o\":-9007199254740991,\"-xo-x--xo\":9007199254740991,\"-xo-x---o\":9007199254740991,\"-xo-x----\":0,\"-xoooxxxo\":0,\"-xoooxxx-\":0,\"-xoooxxox\":0,\"-xoooxx-x\":0,\"-xoooxx--\":0,\"-xoo-xxox\":0,\"-xoo-xxo-\":0,\"-xoo-xxxo\":0,\"-xoo-xx-o\":0,\"-xoo-xx--\":0,\"-xoooxoxx\":-9007199254740991,\"-xooox-xx\":-9007199254740991,\"-xooox-x-\":0,\"-xoo-xoxx\":-9007199254740991,\"-xoo-xox-\":9007199254740991,\"-xoo-x-xo\":9007199254740991,\"-xoo-x-x-\":0,\"-xooox--x\":0,\"-xoo-xo-x\":-9007199254740991,\"-xoo-x-ox\":0,\"-xoo-x--x\":-9007199254740991,\"-xoo-x---\":0,\"-xo-oxxox\":0,\"-xo-oxxo-\":0,\"-xo-oxxxo\":-9007199254740991,\"-xo-oxx-o\":0,\"-xo-oxx--\":0,\"-xo-oxox-\":-9007199254740991,\"-xo-ox-xo\":-9007199254740991,\"-xo-ox-x-\":-9007199254740991,\"-xo-oxo-x\":-9007199254740991,\"-xo-ox-ox\":0,\"-xo-ox--x\":-9007199254740991,\"-xo-ox---\":0,\"-xo--xoxo\":9007199254740991,\"-xo--xox-\":-9007199254740991,\"-xo--xoox\":9007199254740991,\"-xo--xo-x\":-9007199254740991,\"-xo--xo--\":9007199254740991,\"-xo--xxoo\":9007199254740991,\"-xo--xxo-\":0,\"-xo--x-ox\":0,\"-xo--x-o-\":0,\"-xo--xx-o\":0,\"-xo--x-xo\":-9007199254740991,\"-xo--x--o\":9007199254740991,\"-xo--x---\":0,\"-xooo-xxx\":9007199254740991,\"-xooo-xx-\":9007199254740991,\"-xoo-oxxx\":9007199254740991,\"-xoo-oxx-\":9007199254740991,\"-xoo--xxo\":9007199254740991,\"-xoo--xx-\":9007199254740991,\"-xooo-x-x\":9007199254740991,\"-xoo-ox-x\":9007199254740991,\"-xoo--xox\":0,\"-xoo--x-x\":0,\"-xoo--x--\":9007199254740991,\"-xo-ooxxx\":9007199254740991,\"-xo-ooxx-\":9007199254740991,\"-xo-o-xxo\":-9007199254740991,\"-xo-o-xx-\":-9007199254740991,\"-xo-oox-x\":9007199254740991,\"-xo-o-xox\":0,\"-xo-o-x-x\":0,\"-xo-o-x--\":0,\"-xo--oxxo\":-9007199254740991,\"-xo--oxx-\":-9007199254740991,\"-xo--oxox\":9007199254740991,\"-xo--ox-x\":9007199254740991,\"-xo--ox--\":9007199254740991,\"-xo---xox\":0,\"-xo---xo-\":0,\"-xo---xxo\":-9007199254740991,\"-xo---x-o\":0,\"-xo---x--\":0,\"-xooo--xx\":9007199254740991,\"-xoo-o-xx\":9007199254740991,\"-xoo--oxx\":9007199254740991,\"-xoo---xx\":9007199254740991,\"-xoo---x-\":9007199254740991,\"-xo-oo-xx\":9007199254740991,\"-xo-o-oxx\":-9007199254740991,\"-xo-o--xx\":-9007199254740991,\"-xo-o--x-\":-9007199254740991,\"-xo--ooxx\":9007199254740991,\"-xo--o-xx\":9007199254740991,\"-xo--o-x-\":9007199254740991,\"-xo---oxx\":-9007199254740991,\"-xo---ox-\":9007199254740991,\"-xo----xo\":9007199254740991,\"-xo----x-\":-9007199254740991,\"-xoo----x\":9007199254740991,\"-xo-o---x\":0,\"-xo--o--x\":9007199254740991,\"-xo---o-x\":9007199254740991,\"-xo----ox\":0,\"-xo-----x\":0,\"-xo------\":0,\"-xxooxoxo\":9007199254740991,\"-xxooxox-\":-9007199254740991,\"-xxooxo-x\":9007199254740991,\"-xxooxo--\":9007199254740991,\"-xxooxxoo\":9007199254740991,\"-xxooxxo-\":9007199254740991,\"-xxoox-ox\":9007199254740991,\"-xxoox-o-\":9007199254740991,\"-xxooxx-o\":-9007199254740991,\"-xxoox-xo\":-9007199254740991,\"-xxoox--o\":9007199254740991,\"-xxoox---\":9007199254740991,\"-xxooox--\":-9007199254740991,\"-xxoooxox\":-9007199254740991,\"-xxoo-xox\":-9007199254740991,\"-xxoo-xo-\":9007199254740991,\"-xxoooxxo\":-9007199254740991,\"-xxoo-xxo\":-9007199254740991,\"-xxoo-x-o\":9007199254740991,\"-xxoo-x--\":-9007199254740991,\"-xxooo-x-\":-9007199254740991,\"-xxooooxx\":-9007199254740991,\"-xxoo-oxx\":-9007199254740991,\"-xxoo-ox-\":9007199254740991,\"-xxoo--xo\":9007199254740991,\"-xxoo--x-\":-9007199254740991,\"-xxooo--x\":-9007199254740991,\"-xxoo-o-x\":9007199254740991,\"-xxoo--ox\":9007199254740991,\"-xxoo---x\":-9007199254740991,\"-xxoo----\":9007199254740991,\"-xxoxoox-\":9007199254740991,\"xxxoxooox\":9007199254740991,\"-xxoxooox\":9007199254740991,\"-xxoxoo-x\":-9007199254740991,\"-xxoxoo--\":9007199254740991,\"-xxoxoxo-\":9007199254740991,\"-xxoxo-ox\":9007199254740991,\"-xxoxo-o-\":9007199254740991,\"-xxoxox-o\":9007199254740991,\"-xxoxo-xo\":9007199254740991,\"-xxoxo--o\":9007199254740991,\"-xxoxo---\":9007199254740991,\"-xxo-oxox\":-9007199254740991,\"-xxo-oxo-\":9007199254740991,\"-xxo-oxxo\":-9007199254740991,\"-xxo-ox-o\":9007199254740991,\"-xxo-ox--\":-9007199254740991,\"-xxo-ooxx\":-9007199254740991,\"-xxo-oox-\":9007199254740991,\"-xxo-o-xo\":9007199254740991,\"-xxo-o-x-\":-9007199254740991,\"-xxo-oo-x\":9007199254740991,\"-xxo-o-ox\":9007199254740991,\"-xxo-o--x\":-9007199254740991,\"-xxo-o---\":9007199254740991,\"-xxoxxooo\":-9007199254740991,\"-xxoxxoo-\":-9007199254740991,\"-xxox-oox\":-9007199254740991,\"-xxox-oo-\":9007199254740991,\"-xxoxxo-o\":-9007199254740991,\"-xxox-oxo\":9007199254740991,\"-xxox-o-o\":9007199254740991,\"-xxox-o--\":-9007199254740991,\"-xxo-xoox\":9007199254740991,\"-xxo-xoo-\":9007199254740991,\"-xxo-xoxo\":-9007199254740991,\"-xxo-xo-o\":9007199254740991,\"-xxo-xo--\":-9007199254740991,\"-xxo--oxo\":9007199254740991,\"-xxo--ox-\":-9007199254740991,\"-xxo--oox\":9007199254740991,\"-xxo--o-x\":-9007199254740991,\"-xxo--o--\":9007199254740991,\"-xxoxx-oo\":-9007199254740991,\"-xxox-xoo\":9007199254740991,\"-xxox--oo\":9007199254740991,\"-xxox--o-\":9007199254740991,\"-xxo-xxoo\":9007199254740991,\"-xxo-x-oo\":9007199254740991,\"-xxo-x-o-\":9007199254740991,\"-xxo--xoo\":9007199254740991,\"-xxo--xo-\":9007199254740991,\"-xxo---ox\":9007199254740991,\"-xxo---o-\":9007199254740991,\"-xxox---o\":9007199254740991,\"-xxo-x--o\":-9007199254740991,\"-xxo--x-o\":9007199254740991,\"-xxo---xo\":9007199254740991,\"-xxo----o\":9007199254740991,\"-xxo-----\":-9007199254740991,\"-x-oxoxox\":9007199254740991,\"-x-oxoxo-\":9007199254740991,\"-x-oxoxxo\":9007199254740991,\"-x-oxox-o\":9007199254740991,\"-x-oxox--\":9007199254740991,\"-x-oxo-x-\":9007199254740991,\"-x-oxooxx\":9007199254740991,\"-x-oxoo-x\":9007199254740991,\"-x-oxo-ox\":9007199254740991,\"-x-oxo--x\":9007199254740991,\"-x-oxo---\":9007199254740991,\"-x-oxxoox\":-9007199254740991,\"-x-oxxoo-\":-9007199254740991,\"-x-oxxoxo\":9007199254740991,\"-x-oxxo-o\":9007199254740991,\"-x-oxxo--\":-9007199254740991,\"-x-ox-ox-\":9007199254740991,\"-x-ox-oox\":9007199254740991,\"-x-ox-o-x\":-9007199254740991,\"-x-ox-o--\":9007199254740991,\"-x-oxxxoo\":0,\"-x-oxx-oo\":0,\"-x-oxx-o-\":-9007199254740991,\"-x-ox-xoo\":9007199254740991,\"-x-ox-xo-\":0,\"-x-ox--ox\":0,\"-x-ox--o-\":9007199254740991,\"-x-oxx--o\":0,\"-x-ox-x-o\":9007199254740991,\"-x-ox--xo\":9007199254740991,\"-x-ox---o\":9007199254740991,\"-x-ox----\":9007199254740991,\"-x-ooxxox\":0,\"-x-ooxxo-\":9007199254740991,\"-x-ooxxxo\":-9007199254740991,\"-x-ooxx-o\":0,\"-x-ooxx--\":0,\"-x-ooxoxx\":-9007199254740991,\"-x-ooxox-\":-9007199254740991,\"-x-oox-xo\":0,\"-x-oox-x-\":-9007199254740991,\"-x-ooxo-x\":9007199254740991,\"-x-oox-ox\":9007199254740991,\"-x-oox--x\":0,\"-x-oox---\":9007199254740991,\"-x-o-xoxo\":9007199254740991,\"-x-o-xox-\":-9007199254740991,\"-x-o-xoox\":9007199254740991,\"-x-o-xo-x\":-9007199254740991,\"-x-o-xo--\":9007199254740991,\"-x-o-xxoo\":9007199254740991,\"-x-o-xxo-\":0,\"-x-o-x-ox\":0,\"-x-o-x-o-\":9007199254740991,\"-x-o-xx-o\":0,\"-x-o-x-xo\":0,\"-x-o-x--o\":0,\"-x-o-x---\":0,\"-x-oooxx-\":-9007199254740991,\"-x-oo-xxo\":-9007199254740991,\"-x-oo-xx-\":-9007199254740991,\"-x-ooox-x\":-9007199254740991,\"-x-oo-xox\":0,\"-x-oo-x-x\":-9007199254740991,\"-x-oo-x--\":0,\"-x-o-oxxo\":9007199254740991,\"-x-o-oxx-\":-9007199254740991,\"-x-o-oxox\":9007199254740991,\"-x-o-ox-x\":-9007199254740991,\"-x-o-ox--\":9007199254740991,\"-x-o--xox\":0,\"-x-o--xo-\":9007199254740991,\"-x-o--xxo\":-9007199254740991,\"-x-o--x-o\":9007199254740991,\"-x-o--x--\":0,\"-x-ooo-xx\":-9007199254740991,\"-x-oo-oxx\":-9007199254740991,\"-x-oo--xx\":-9007199254740991,\"-x-oo--x-\":-9007199254740991,\"-x-o-ooxx\":9007199254740991,\"-x-o-o-xx\":-9007199254740991,\"-x-o-o-x-\":9007199254740991,\"-x-o--oxx\":-9007199254740991,\"-x-o--ox-\":9007199254740991,\"-x-o---xo\":9007199254740991,\"-x-o---x-\":-9007199254740991,\"-x-oo---x\":0,\"-x-o-o--x\":9007199254740991,\"-x-o--o-x\":9007199254740991,\"-x-o---ox\":9007199254740991,\"-x-o----x\":0,\"-x-o-----\":9007199254740991,\"-xxxoooxo\":9007199254740991,\"-xxxooox-\":0,\"-xxxoooox\":9007199254740991,\"-xxxooo-x\":0,\"-xxxooo--\":9007199254740991,\"xxxxooxoo\":9007199254740991,\"-xxxooxoo\":9007199254740991,\"-xxxooxo-\":0,\"-xxxoo-ox\":0,\"-xxxoo-o-\":9007199254740991,\"-xxxoox-o\":-9007199254740991,\"-xxxoo-xo\":-9007199254740991,\"-xxxoo--o\":9007199254740991,\"-xxxoo---\":0,\"-xx-ooxox\":-9007199254740991,\"-xx-ooxo-\":9007199254740991,\"-xx-ooxxo\":-9007199254740991,\"-xx-oox-o\":9007199254740991,\"-xx-oox--\":-9007199254740991,\"-xx-oooxx\":-9007199254740991,\"-xx-ooox-\":9007199254740991,\"-xx-oo-xo\":9007199254740991,\"-xx-oo-x-\":-9007199254740991,\"-xx-ooo-x\":9007199254740991,\"-xx-oo-ox\":9007199254740991,\"-xx-oo--x\":-9007199254740991,\"-xx-oo---\":9007199254740991,\"-xxxoxooo\":-9007199254740991,\"-xxxoxoo-\":-9007199254740991,\"-xxxo-oox\":9007199254740991,\"-xxxo-oo-\":9007199254740991,\"-xxxoxo-o\":-9007199254740991,\"-xxxo-oxo\":-9007199254740991,\"-xxxo-o-o\":9007199254740991,\"-xxxo-o--\":0,\"-xx-oxoox\":9007199254740991,\"-xx-oxoo-\":9007199254740991,\"-xx-oxoxo\":-9007199254740991,\"-xx-oxo-o\":9007199254740991,\"-xx-oxo--\":9007199254740991,\"-xx-o-oxo\":9007199254740991,\"-xx-o-ox-\":-9007199254740991,\"-xx-o-oox\":9007199254740991,\"-xx-o-o-x\":9007199254740991,\"-xx-o-o--\":9007199254740991,\"-xxxox-oo\":-9007199254740991,\"-xxxo-xoo\":-9007199254740991,\"-xxxo--oo\":9007199254740991,\"-xxxo--o-\":0,\"-xx-oxxoo\":-9007199254740991,\"-xx-ox-oo\":9007199254740991,\"-xx-ox-o-\":9007199254740991,\"-xx-o-xoo\":9007199254740991,\"-xx-o-xo-\":0,\"-xx-o--ox\":9007199254740991,\"-xx-o--o-\":9007199254740991,\"-xxxo---o\":-9007199254740991,\"-xx-ox--o\":-9007199254740991,\"-xx-o-x-o\":-9007199254740991,\"-xx-o--xo\":-9007199254740991,\"-xx-o---o\":9007199254740991,\"-xx-o----\":0,\"-x-xooxox\":0,\"-x-xooxo-\":9007199254740991,\"-x-xooxxo\":-9007199254740991,\"-x-xoox-o\":9007199254740991,\"-x-xoox--\":0,\"-x-xoooxx\":-9007199254740991,\"-x-xooox-\":0,\"-x-xoo-xo\":-9007199254740991,\"-x-xoo-x-\":-9007199254740991,\"-x-xooo-x\":0,\"-x-xoo-ox\":9007199254740991,\"-x-xoo--x\":0,\"-x-xoo---\":9007199254740991,\"-x-xoxoox\":-9007199254740991,\"-x-xoxoo-\":-9007199254740991,\"-x-xoxoxo\":-9007199254740991,\"-x-xoxo-o\":-9007199254740991,\"-x-xoxo--\":-9007199254740991,\"-x-xo-oxo\":-9007199254740991,\"-x-xo-ox-\":-9007199254740991,\"-x-xo-oox\":9007199254740991,\"-x-xo-o-x\":-9007199254740991,\"-x-xo-o--\":0,\"-x-xoxxoo\":-9007199254740991,\"-x-xox-oo\":-9007199254740991,\"-x-xox-o-\":-9007199254740991,\"-x-xo-xoo\":9007199254740991,\"-x-xo-xo-\":0,\"-x-xo--ox\":0,\"-x-xo--o-\":9007199254740991,\"-x-xox--o\":-9007199254740991,\"-x-xo-x-o\":-9007199254740991,\"-x-xo--xo\":-9007199254740991,\"-x-xo---o\":9007199254740991,\"-x-xo----\":0,\"-x--oxoxo\":-9007199254740991,\"-x--oxox-\":-9007199254740991,\"-x--oxoox\":9007199254740991,\"-x--oxo-x\":-9007199254740991,\"-x--oxo--\":9007199254740991,\"-x--oxxoo\":9007199254740991,\"-x--oxxo-\":0,\"-x--ox-ox\":0,\"-x--ox-o-\":9007199254740991,\"-x--oxx-o\":-9007199254740991,\"-x--ox-xo\":-9007199254740991,\"-x--ox--o\":0,\"-x--ox---\":0,\"-x--ooxxo\":-9007199254740991,\"-x--ooxx-\":-9007199254740991,\"-x--ooxox\":0,\"-x--oox-x\":-9007199254740991,\"-x--oox--\":0,\"-x--o-xox\":0,\"-x--o-xo-\":9007199254740991,\"-x--o-xxo\":-9007199254740991,\"-x--o-x-o\":9007199254740991,\"-x--o-x--\":0,\"-x--oooxx\":-9007199254740991,\"-x--oo-xx\":-9007199254740991,\"-x--oo-x-\":-9007199254740991,\"-x--o-oxx\":-9007199254740991,\"-x--o-ox-\":-9007199254740991,\"-x--o--xo\":-9007199254740991,\"-x--o--x-\":-9007199254740991,\"-x--oo--x\":0,\"-x--o-o-x\":9007199254740991,\"-x--o--ox\":9007199254740991,\"-x--o---x\":0,\"-x--o----\":0,\"-xxxxoooo\":-9007199254740991,\"-xxxxooo-\":-9007199254740991,\"-xxx-ooox\":0,\"-xxx-ooo-\":9007199254740991,\"-xxxxoo-o\":-9007199254740991,\"-xxx-ooxo\":9007199254740991,\"-xxx-oo-o\":9007199254740991,\"-xxx-oo--\":0,\"-xx-xooox\":0,\"-xx-xooo-\":9007199254740991,\"-xx-xooxo\":9007199254740991,\"-xx-xoo-o\":9007199254740991,\"-xx-xoo--\":9007199254740991,\"-xx--ooxo\":9007199254740991,\"-xx--oox-\":9007199254740991,\"-xx--ooox\":9007199254740991,\"-xx--oo-x\":0,\"-xx--oo--\":9007199254740991,\"-xxxxo-oo\":-9007199254740991,\"-xxx-oxoo\":9007199254740991,\"-xxx-o-oo\":9007199254740991,\"-xxx-o-o-\":0,\"-xx-xoxoo\":9007199254740991,\"-xx-xo-oo\":9007199254740991,\"-xx-xo-o-\":9007199254740991,\"-xx--oxoo\":9007199254740991,\"-xx--oxo-\":9007199254740991,\"-xx--o-ox\":0,\"-xx--o-o-\":9007199254740991,\"-xxx-o--o\":9007199254740991,\"-xx-xo--o\":9007199254740991,\"-xx--ox-o\":9007199254740991,\"-xx--o-xo\":9007199254740991,\"-xx--o--o\":9007199254740991,\"-xx--o---\":9007199254740991,\"-x-xxooox\":0,\"-x-xxooo-\":0,\"-x-xxooxo\":9007199254740991,\"-x-xxoo-o\":9007199254740991,\"-x-xxoo--\":0,\"-x-x-ooxo\":9007199254740991,\"-x-x-oox-\":0,\"-x-x-ooox\":9007199254740991,\"-x-x-oo-x\":0,\"-x-x-oo--\":0,\"-x-xxoxoo\":-9007199254740991,\"-x-xxo-oo\":-9007199254740991,\"-x-xxo-o-\":-9007199254740991,\"-x-x-oxoo\":9007199254740991,\"-x-x-oxo-\":0,\"-x-x-o-ox\":0,\"-x-x-o-o-\":9007199254740991,\"-x-xxo--o\":-9007199254740991,\"-x-x-ox-o\":-9007199254740991,\"-x-x-o-xo\":-9007199254740991,\"-x-x-o--o\":9007199254740991,\"-x-x-o---\":0,\"-x--xoox-\":9007199254740991,\"-x--xooox\":9007199254740991,\"-x--xoo-x\":9007199254740991,\"-x--xoo--\":9007199254740991,\"-x--xoxoo\":9007199254740991,\"-x--xoxo-\":0,\"-x--xo-ox\":0,\"-x--xo-o-\":9007199254740991,\"-x--xox-o\":-9007199254740991,\"-x--xo-xo\":9007199254740991,\"-x--xo--o\":9007199254740991,\"-x--xo---\":9007199254740991,\"-x---oxox\":0,\"-x---oxo-\":9007199254740991,\"-x---oxxo\":-9007199254740991,\"-x---ox-o\":9007199254740991,\"-x---ox--\":0,\"-x---ooxx\":-9007199254740991,\"-x---oox-\":9007199254740991,\"-x---o-xo\":9007199254740991,\"-x---o-x-\":-9007199254740991,\"-x---oo-x\":9007199254740991,\"-x---o-ox\":9007199254740991,\"-x---o--x\":0,\"-x---o---\":9007199254740991,\"-xxx--ooo\":-9007199254740991,\"-xxx--oo-\":-9007199254740991,\"-xx-x-ooo\":-9007199254740991,\"-xx-x-oo-\":-9007199254740991,\"-xx--xooo\":-9007199254740991,\"-xx--xoo-\":-9007199254740991,\"-xx---oox\":9007199254740991,\"-xx---oo-\":9007199254740991,\"-xxx--o-o\":-9007199254740991,\"-xx-x-o-o\":-9007199254740991,\"-xx--xo-o\":-9007199254740991,\"-xx---oxo\":9007199254740991,\"-xx---o-o\":9007199254740991,\"-xx---o--\":-9007199254740991,\"-x-xx-ooo\":-9007199254740991,\"-x-xx-oo-\":-9007199254740991,\"-x-x-xooo\":-9007199254740991,\"-x-x-xoo-\":-9007199254740991,\"-x-x--oox\":9007199254740991,\"-x-x--oo-\":9007199254740991,\"-x-xx-o-o\":-9007199254740991,\"-x-x-xo-o\":-9007199254740991,\"-x-x--oxo\":-9007199254740991,\"-x-x--o-o\":-9007199254740991,\"-x-x--o--\":-9007199254740991,\"-x--xxooo\":-9007199254740991,\"-x--xxoo-\":-9007199254740991,\"-x--x-oox\":0,\"-x--x-oo-\":0,\"-x--xxo-o\":-9007199254740991,\"-x--x-oxo\":9007199254740991,\"-x--x-o-o\":9007199254740991,\"-x--x-o--\":0,\"-x---xoox\":9007199254740991,\"-x---xoo-\":9007199254740991,\"-x---xoxo\":-9007199254740991,\"-x---xo-o\":-9007199254740991,\"-x---xo--\":-9007199254740991,\"-x----oxo\":9007199254740991,\"-x----ox-\":-9007199254740991,\"-x----oox\":9007199254740991,\"-x----o-x\":0,\"-x----o--\":9007199254740991,\"-xxx---oo\":-9007199254740991,\"-xx-x--oo\":-9007199254740991,\"-xx--x-oo\":-9007199254740991,\"-xx---xoo\":9007199254740991,\"-xx----oo\":9007199254740991,\"-xx----o-\":0,\"-x-xx--oo\":-9007199254740991,\"-x-x-x-oo\":-9007199254740991,\"-x-x--xoo\":9007199254740991,\"-x-x---oo\":9007199254740991,\"-x-x---o-\":0,\"-x--xx-oo\":-9007199254740991,\"-x--x-xoo\":0,\"-x--x--oo\":0,\"-x--x--o-\":0,\"-x---xxoo\":9007199254740991,\"-x---x-oo\":9007199254740991,\"-x---x-o-\":0,\"-x----xoo\":9007199254740991,\"-x----xo-\":0,\"-x-----ox\":0,\"-x-----o-\":0,\"-xx-----o\":9007199254740991,\"-x-x----o\":-9007199254740991,\"-x--x---o\":0,\"-x---x--o\":-9007199254740991,\"-x----x-o\":0,\"-x-----xo\":-9007199254740991,\"-x------o\":9007199254740991,\"-x-------\":0,\"ooxxxox--\":9007199254740991,\"ooxxxooxx\":0,\"ooxxxoox-\":0,\"ooxxxoxxo\":9007199254740991,\"ooxxxo-xo\":9007199254740991,\"ooxxxo-x-\":0,\"ooxxxoo-x\":0,\"ooxxxoxox\":9007199254740991,\"ooxxxo-ox\":9007199254740991,\"ooxxxo--x\":0,\"ooxxxo---\":9007199254740991,\"ooxxxxo--\":9007199254740991,\"ooxxxxoxo\":9007199254740991,\"ooxxx-oxo\":9007199254740991,\"ooxxx-ox-\":0,\"ooxxxxoox\":9007199254740991,\"ooxxx-oox\":9007199254740991,\"ooxxx-o-x\":0,\"ooxxx-o--\":9007199254740991,\"ooxxxx-o-\":9007199254740991,\"ooxxx-xo-\":9007199254740991,\"ooxxx--ox\":9007199254740991,\"ooxxx--o-\":9007199254740991,\"ooxxxx--o\":9007199254740991,\"ooxxx-x-o\":9007199254740991,\"ooxxx--xo\":9007199254740991,\"ooxxx---o\":9007199254740991,\"ooxxx----\":9007199254740991,\"ooxxoxxo-\":-9007199254740991,\"ooxxoxx-o\":-9007199254740991,\"ooxxoxx--\":-9007199254740991,\"ooxxoxoxx\":9007199254740991,\"ooxxoxox-\":9007199254740991,\"ooxxox-xo\":-9007199254740991,\"ooxxox-x-\":-9007199254740991,\"ooxxox--x\":9007199254740991,\"ooxxox---\":9007199254740991,\"ooxx-xoxo\":9007199254740991,\"ooxx-xox-\":9007199254740991,\"ooxx-xo-x\":9007199254740991,\"ooxx-xo--\":9007199254740991,\"ooxxxxxoo\":9007199254740991,\"ooxx-xxoo\":9007199254740991,\"ooxx-xxo-\":-9007199254740991,\"ooxx-x-ox\":9007199254740991,\"ooxx-x-o-\":9007199254740991,\"ooxx-xx-o\":-9007199254740991,\"ooxx-x-xo\":-9007199254740991,\"ooxx-x--o\":9007199254740991,\"ooxx-x---\":9007199254740991,\"ooxxooxxx\":9007199254740991,\"ooxxooxx-\":9007199254740991,\"ooxxo-xxo\":-9007199254740991,\"ooxxo-xx-\":-9007199254740991,\"ooxxoox-x\":9007199254740991,\"ooxxo-xox\":-9007199254740991,\"ooxxo-x-x\":-9007199254740991,\"ooxxo-x--\":-9007199254740991,\"ooxx-oxxo\":9007199254740991,\"ooxx-oxx-\":9007199254740991,\"ooxx-oxox\":9007199254740991,\"ooxx-ox-x\":9007199254740991,\"ooxx-ox--\":9007199254740991,\"ooxx--xox\":-9007199254740991,\"ooxx--xo-\":9007199254740991,\"ooxx--xxo\":-9007199254740991,\"ooxx--x-o\":9007199254740991,\"ooxx--x--\":-9007199254740991,\"ooxxoo-xx\":9007199254740991,\"ooxxo-oxx\":9007199254740991,\"ooxxo--xx\":9007199254740991,\"ooxxo--x-\":9007199254740991,\"ooxx-ooxx\":0,\"ooxx-o-xx\":0,\"ooxx-o-x-\":9007199254740991,\"ooxx--oxx\":0,\"ooxx--ox-\":9007199254740991,\"ooxx---xo\":9007199254740991,\"ooxx---x-\":9007199254740991,\"ooxxo---x\":9007199254740991,\"ooxx-o--x\":9007199254740991,\"ooxx--o-x\":9007199254740991,\"ooxx---ox\":9007199254740991,\"ooxx----x\":9007199254740991,\"ooxx-----\":9007199254740991,\"o-xxoxoxo\":-9007199254740991,\"o-xxoxox-\":-9007199254740991,\"o-xxoxo-x\":9007199254740991,\"o-xxoxo--\":9007199254740991,\"o-xxoxxoo\":-9007199254740991,\"o-xxoxxo-\":-9007199254740991,\"o-xxox-ox\":9007199254740991,\"o-xxox-o-\":9007199254740991,\"o-xxox--o\":-9007199254740991,\"o-xxox---\":-9007199254740991,\"o-xxooxxo\":-9007199254740991,\"o-xxooxx-\":-9007199254740991,\"o-xxooxox\":0,\"o-xxoox-x\":0,\"o-xxoox--\":0,\"o-xxo-xox\":-9007199254740991,\"o-xxo-xo-\":-9007199254740991,\"o-xxo-x-o\":-9007199254740991,\"o-xxo-x--\":-9007199254740991,\"o-xxoooxx\":0,\"o-xxoo-xx\":0,\"o-xxoo-x-\":0,\"o-xxo-oxx\":0,\"o-xxo-ox-\":0,\"o-xxo--xo\":-9007199254740991,\"o-xxo--x-\":-9007199254740991,\"o-xxoo--x\":0,\"o-xxo-o-x\":9007199254740991,\"o-xxo--ox\":9007199254740991,\"o-xxo---x\":0,\"o-xxo----\":0,\"o-xxxooxo\":9007199254740991,\"o-xxxoox-\":0,\"o-xxxooox\":0,\"o-xxxoo-x\":0,\"o-xxxoo--\":0,\"o-xxxoxo-\":9007199254740991,\"o-xxxo-ox\":0,\"o-xxxo-o-\":9007199254740991,\"o-xxxox-o\":9007199254740991,\"o-xxxo-xo\":9007199254740991,\"o-xxxo--o\":9007199254740991,\"o-xxxo---\":0,\"o-xx-oxox\":0,\"o-xx-oxo-\":9007199254740991,\"o-xx-oxxo\":-9007199254740991,\"o-xx-ox-o\":9007199254740991,\"o-xx-ox--\":0,\"o-xx-ooxx\":0,\"o-xx-oox-\":0,\"o-xx-o-xo\":9007199254740991,\"o-xx-o-x-\":0,\"o-xx-oo-x\":0,\"o-xx-o-ox\":0,\"o-xx-o--x\":0,\"o-xx-o---\":0,\"o-xxxxoo-\":9007199254740991,\"o-xxx-oox\":0,\"o-xxx-oo-\":9007199254740991,\"o-xxxxo-o\":9007199254740991,\"o-xxx-oxo\":9007199254740991,\"o-xxx-o-o\":9007199254740991,\"o-xxx-o--\":0,\"o-xx-xoox\":9007199254740991,\"o-xx-xoo-\":9007199254740991,\"o-xx-xoxo\":-9007199254740991,\"o-xx-xo-o\":9007199254740991,\"o-xx-xo--\":9007199254740991,\"o-xx--oxo\":9007199254740991,\"o-xx--ox-\":0,\"o-xx--oox\":9007199254740991,\"o-xx--o-x\":0,\"o-xx--o--\":9007199254740991,\"o-xxxx-oo\":9007199254740991,\"o-xxx-xoo\":9007199254740991,\"o-xxx--oo\":9007199254740991,\"o-xxx--o-\":9007199254740991,\"o-xx-xxoo\":-9007199254740991,\"o-xx-x-oo\":9007199254740991,\"o-xx-x-o-\":9007199254740991,\"o-xx--xoo\":9007199254740991,\"o-xx--xo-\":-9007199254740991,\"o-xx---ox\":0,\"o-xx---o-\":9007199254740991,\"o-xxx---o\":9007199254740991,\"o-xx-x--o\":-9007199254740991,\"o-xx--x-o\":-9007199254740991,\"o-xx---xo\":-9007199254740991,\"o-xx----o\":9007199254740991,\"o-xx-----\":0,\"ooxoxxx--\":9007199254740991,\"ooxoxxox-\":-9007199254740991,\"ooxoxxxxo\":9007199254740991,\"ooxoxx-xo\":9007199254740991,\"ooxoxx-x-\":-9007199254740991,\"ooxoxx--x\":9007199254740991,\"ooxoxx---\":9007199254740991,\"oox-xxoxo\":9007199254740991,\"oox-xxox-\":-9007199254740991,\"oox-xxo-x\":9007199254740991,\"oox-xxo--\":9007199254740991,\"oox-xxxo-\":9007199254740991,\"oox-xx-ox\":9007199254740991,\"oox-xx-o-\":9007199254740991,\"oox-xxx-o\":9007199254740991,\"oox-xx-xo\":9007199254740991,\"oox-xx--o\":9007199254740991,\"oox-xx---\":9007199254740991,\"oox-x-x--\":9007199254740991,\"ooxox-xx-\":9007199254740991,\"ooxoxoxxx\":9007199254740991,\"ooxoxo-xx\":9007199254740991,\"ooxox-oxx\":-9007199254740991,\"ooxox--xx\":-9007199254740991,\"ooxox--x-\":9007199254740991,\"oox-xoxx-\":9007199254740991,\"oox-xooxx\":0,\"oox-xo-xx\":0,\"oox-xo-x-\":9007199254740991,\"oox-x-oxx\":-9007199254740991,\"oox-x-ox-\":0,\"oox-x-xxo\":9007199254740991,\"oox-x--xo\":9007199254740991,\"oox-x--x-\":0,\"ooxox-x-x\":9007199254740991,\"ooxox---x\":9007199254740991,\"oox-xox-x\":9007199254740991,\"oox-xo--x\":9007199254740991,\"oox-x-o-x\":9007199254740991,\"oox-x-xox\":9007199254740991,\"oox-x--ox\":9007199254740991,\"oox-x---x\":9007199254740991,\"oox-x----\":9007199254740991,\"o-xoxxo--\":-9007199254740991,\"o-xoxxxo-\":9007199254740991,\"o-xoxx-ox\":9007199254740991,\"o-xoxx-o-\":9007199254740991,\"o-xoxxx-o\":9007199254740991,\"o-xoxxoxo\":-9007199254740991,\"o-xoxx-xo\":-9007199254740991,\"o-xoxx--o\":9007199254740991,\"o-xoxx---\":-9007199254740991,\"o-xox-x--\":9007199254740991,\"o-xoxoxx-\":9007199254740991,\"o-xoxooxx\":-9007199254740991,\"o-xoxo-xx\":-9007199254740991,\"o-xoxo-x-\":9007199254740991,\"o-xox-ox-\":-9007199254740991,\"o-xox-xxo\":9007199254740991,\"o-xox--xo\":9007199254740991,\"o-xox--x-\":-9007199254740991,\"o-xoxox-x\":9007199254740991,\"o-xoxo--x\":9007199254740991,\"o-xox-o-x\":-9007199254740991,\"o-xox-xox\":9007199254740991,\"o-xox--ox\":9007199254740991,\"o-xox---x\":-9007199254740991,\"o-xox----\":9007199254740991,\"o-x-xox--\":9007199254740991,\"o-x-xooxx\":-9007199254740991,\"o-x-xoox-\":9007199254740991,\"o-x-xoxxo\":9007199254740991,\"o-x-xo-xo\":9007199254740991,\"o-x-xo-x-\":9007199254740991,\"o-x-xoo-x\":0,\"o-x-xoxox\":9007199254740991,\"o-x-xo-ox\":9007199254740991,\"o-x-xo--x\":0,\"o-x-xo---\":9007199254740991,\"o-x-xxoox\":9007199254740991,\"o-x-xxoo-\":9007199254740991,\"o-x-xxoxo\":-9007199254740991,\"o-x-xxo-o\":9007199254740991,\"o-x-xxo--\":-9007199254740991,\"o-x-x-oxo\":9007199254740991,\"o-x-x-ox-\":-9007199254740991,\"o-x-x-oox\":9007199254740991,\"o-x-x-o-x\":-9007199254740991,\"o-x-x-o--\":0,\"o-x-xxxoo\":9007199254740991,\"o-x-xx-oo\":9007199254740991,\"o-x-xx-o-\":9007199254740991,\"o-x-x-xo-\":9007199254740991,\"o-x-x--ox\":9007199254740991,\"o-x-x--o-\":9007199254740991,\"o-x-xx--o\":9007199254740991,\"o-x-x-x-o\":9007199254740991,\"o-x-x--xo\":9007199254740991,\"o-x-x---o\":9007199254740991,\"o-x-x----\":0,\"ooxooxxxx\":9007199254740991,\"ooxooxxx-\":9007199254740991,\"ooxo-xxxo\":9007199254740991,\"ooxo-xxx-\":9007199254740991,\"ooxo-xx-x\":9007199254740991,\"ooxo-xx--\":9007199254740991,\"oox-oxxxo\":-9007199254740991,\"oox-oxxx-\":-9007199254740991,\"oox-oxx-x\":9007199254740991,\"oox-oxx--\":9007199254740991,\"oox--xxox\":9007199254740991,\"oox--xxo-\":9007199254740991,\"oox--xxxo\":-9007199254740991,\"oox--xx-o\":9007199254740991,\"oox--xx--\":9007199254740991,\"ooxo-x-xx\":9007199254740991,\"ooxo-x-x-\":9007199254740991,\"oox-ox-xx\":9007199254740991,\"oox-ox-x-\":9007199254740991,\"oox--xoxx\":9007199254740991,\"oox--xox-\":9007199254740991,\"oox--x-xo\":9007199254740991,\"oox--x-x-\":9007199254740991,\"oox--x--x\":9007199254740991,\"oox--x---\":9007199254740991,\"o-xooxxxo\":-9007199254740991,\"o-xooxxx-\":-9007199254740991,\"o-xooxx-x\":9007199254740991,\"o-xooxx--\":9007199254740991,\"o-xo-xxox\":9007199254740991,\"o-xo-xxo-\":9007199254740991,\"o-xo-xxxo\":-9007199254740991,\"o-xo-xx-o\":9007199254740991,\"o-xo-xx--\":9007199254740991,\"o-xoox-xx\":9007199254740991,\"o-xoox-x-\":9007199254740991,\"o-xo-xox-\":-9007199254740991,\"o-xo-x-xo\":-9007199254740991,\"o-xo-x-x-\":-9007199254740991,\"o-xo-x--x\":9007199254740991,\"o-xo-x---\":9007199254740991,\"o-x-oxxox\":9007199254740991,\"o-x-oxxo-\":9007199254740991,\"o-x-oxx-o\":-9007199254740991,\"o-x-oxx--\":-9007199254740991,\"o-x-oxoxx\":9007199254740991,\"o-x-oxox-\":9007199254740991,\"o-x-ox-xo\":-9007199254740991,\"o-x-ox-x-\":-9007199254740991,\"o-x-ox--x\":9007199254740991,\"o-x-ox---\":9007199254740991,\"o-x--xoxo\":-9007199254740991,\"o-x--xox-\":-9007199254740991,\"o-x--xo-x\":9007199254740991,\"o-x--xo--\":9007199254740991,\"o-x--xxoo\":9007199254740991,\"o-x--xxo-\":9007199254740991,\"o-x--x-ox\":9007199254740991,\"o-x--x-o-\":9007199254740991,\"o-x--xx-o\":-9007199254740991,\"o-x--x-xo\":-9007199254740991,\"o-x--x--o\":9007199254740991,\"o-x--x---\":9007199254740991,\"ooxo--xxx\":9007199254740991,\"ooxo--xx-\":9007199254740991,\"oox-o-xxx\":9007199254740991,\"oox-o-xx-\":9007199254740991,\"oox--oxxx\":9007199254740991,\"oox--oxx-\":9007199254740991,\"oox---xxo\":9007199254740991,\"oox---xx-\":9007199254740991,\"ooxo--x-x\":9007199254740991,\"oox-o-x-x\":9007199254740991,\"oox--ox-x\":9007199254740991,\"oox---xox\":9007199254740991,\"oox---x-x\":9007199254740991,\"oox---x--\":9007199254740991,\"o-xoo-xxx\":9007199254740991,\"o-xoo-xx-\":9007199254740991,\"o-xo-oxxx\":9007199254740991,\"o-xo-oxx-\":9007199254740991,\"o-xo--xxo\":9007199254740991,\"o-xo--xx-\":9007199254740991,\"o-xoo-x-x\":9007199254740991,\"o-xo-ox-x\":9007199254740991,\"o-xo--xox\":9007199254740991,\"o-xo--x-x\":9007199254740991,\"o-xo--x--\":9007199254740991,\"o-x-ooxxx\":9007199254740991,\"o-x-ooxx-\":9007199254740991,\"o-x-o-xxo\":-9007199254740991,\"o-x-o-xx-\":-9007199254740991,\"o-x-oox-x\":9007199254740991,\"o-x-o-xox\":9007199254740991,\"o-x-o-x-x\":9007199254740991,\"o-x-o-x--\":9007199254740991,\"o-x--oxxo\":9007199254740991,\"o-x--oxx-\":9007199254740991,\"o-x--oxox\":9007199254740991,\"o-x--ox-x\":9007199254740991,\"o-x--ox--\":9007199254740991,\"o-x---xox\":9007199254740991,\"o-x---xo-\":9007199254740991,\"o-x---xxo\":-9007199254740991,\"o-x---x-o\":9007199254740991,\"o-x---x--\":9007199254740991,\"ooxo---xx\":9007199254740991,\"oox-o--xx\":9007199254740991,\"oox--o-xx\":9007199254740991,\"oox---oxx\":9007199254740991,\"oox----xx\":9007199254740991,\"oox----x-\":9007199254740991,\"o-xoo--xx\":9007199254740991,\"o-xo-o-xx\":9007199254740991,\"o-xo--oxx\":-9007199254740991,\"o-xo---xx\":-9007199254740991,\"o-xo---x-\":9007199254740991,\"o-x-oo-xx\":9007199254740991,\"o-x-o-oxx\":9007199254740991,\"o-x-o--xx\":9007199254740991,\"o-x-o--x-\":9007199254740991,\"o-x--ooxx\":0,\"o-x--o-xx\":0,\"o-x--o-x-\":9007199254740991,\"o-x---oxx\":-9007199254740991,\"o-x---ox-\":0,\"o-x----xo\":9007199254740991,\"o-x----x-\":0,\"oox-----x\":9007199254740991,\"o-xo----x\":9007199254740991,\"o-x-o---x\":9007199254740991,\"o-x--o--x\":9007199254740991,\"o-x---o-x\":9007199254740991,\"o-x----ox\":9007199254740991,\"o-x-----x\":9007199254740991,\"o-x------\":9007199254740991,\"-oxxoxoxo\":0,\"-oxxoxox-\":0,\"-oxxoxo-x\":9007199254740991,\"-oxxoxo--\":9007199254740991,\"-oxxox-o-\":-9007199254740991,\"-oxxoxxoo\":-9007199254740991,\"-oxxoxx-o\":-9007199254740991,\"-oxxox-xo\":-9007199254740991,\"-oxxox--o\":-9007199254740991,\"-oxxox---\":-9007199254740991,\"-oxxooxxo\":9007199254740991,\"-oxxooxx-\":9007199254740991,\"-oxxooxox\":-9007199254740991,\"-oxxoox-x\":-9007199254740991,\"-oxxoox--\":9007199254740991,\"-oxxo-xo-\":-9007199254740991,\"-oxxo-xxo\":-9007199254740991,\"-oxxo-x-o\":9007199254740991,\"-oxxo-x--\":-9007199254740991,\"-oxxoooxx\":0,\"-oxxoo-xx\":0,\"-oxxoo-x-\":9007199254740991,\"-oxxo-oxx\":0,\"-oxxo-ox-\":0,\"-oxxo--xo\":0,\"-oxxo--x-\":0,\"-oxxoo--x\":0,\"-oxxo-o-x\":9007199254740991,\"-oxxo--ox\":-9007199254740991,\"-oxxo---x\":-9007199254740991,\"-oxxo----\":0,\"-oxxxooxo\":0,\"-oxxxoox-\":0,\"-oxxxooox\":9007199254740991,\"-oxxxoo-x\":0,\"-oxxxoo--\":0,\"-oxxxoxo-\":9007199254740991,\"-oxxxo-ox\":9007199254740991,\"-oxxxo-o-\":9007199254740991,\"-oxxxox-o\":9007199254740991,\"-oxxxo-xo\":0,\"-oxxxo--o\":9007199254740991,\"-oxxxo---\":0,\"-oxx-oxox\":-9007199254740991,\"-oxx-oxo-\":9007199254740991,\"-oxx-oxxo\":9007199254740991,\"-oxx-ox-o\":9007199254740991,\"-oxx-ox--\":9007199254740991,\"-oxx-ooxx\":0,\"-oxx-oox-\":0,\"-oxx-o-xo\":9007199254740991,\"-oxx-o-x-\":0,\"-oxx-oo-x\":0,\"-oxx-o-ox\":9007199254740991,\"-oxx-o--x\":0,\"-oxx-o---\":9007199254740991,\"-oxxxxoo-\":9007199254740991,\"-oxxx-oox\":9007199254740991,\"-oxxx-oo-\":9007199254740991,\"-oxxxxo-o\":9007199254740991,\"-oxxx-oxo\":0,\"-oxxx-o-o\":9007199254740991,\"-oxxx-o--\":0,\"-oxx-xoox\":9007199254740991,\"-oxx-xoo-\":9007199254740991,\"-oxx-xoxo\":0,\"-oxx-xo-o\":9007199254740991,\"-oxx-xo--\":9007199254740991,\"-oxx--oxo\":0,\"-oxx--ox-\":0,\"-oxx--oox\":9007199254740991,\"-oxx--o-x\":0,\"-oxx--o--\":9007199254740991,\"-oxxxx-oo\":9007199254740991,\"-oxxx-xoo\":9007199254740991,\"-oxxx--oo\":9007199254740991,\"-oxxx--o-\":9007199254740991,\"-oxx-xxoo\":-9007199254740991,\"-oxx-x-oo\":9007199254740991,\"-oxx-x-o-\":-9007199254740991,\"-oxx--xoo\":9007199254740991,\"-oxx--xo-\":-9007199254740991,\"-oxx---ox\":-9007199254740991,\"-oxx---o-\":9007199254740991,\"-oxxx---o\":9007199254740991,\"-oxx-x--o\":-9007199254740991,\"-oxx--x-o\":9007199254740991,\"-oxx---xo\":0,\"-oxx----o\":9007199254740991,\"-oxx-----\":0,\"-oxoxxoxo\":0,\"-oxoxxox-\":-9007199254740991,\"-oxoxxo-x\":9007199254740991,\"-oxoxxo--\":9007199254740991,\"-oxoxxxo-\":9007199254740991,\"-oxoxx-ox\":9007199254740991,\"-oxoxx-o-\":9007199254740991,\"-oxoxxx-o\":9007199254740991,\"-oxoxx-xo\":0,\"-oxoxx--o\":9007199254740991,\"-oxoxx---\":9007199254740991,\"-oxox-x--\":9007199254740991,\"-oxoxoxx-\":9007199254740991,\"-oxoxooxx\":9007199254740991,\"-oxoxo-xx\":9007199254740991,\"-oxoxo-x-\":9007199254740991,\"-oxox-oxx\":-9007199254740991,\"-oxox-ox-\":0,\"-oxox-xxo\":9007199254740991,\"-oxox--xo\":9007199254740991,\"-oxox--x-\":0,\"-oxoxox-x\":9007199254740991,\"-oxoxo--x\":9007199254740991,\"-oxox-o-x\":9007199254740991,\"-oxox-xox\":9007199254740991,\"-oxox--ox\":9007199254740991,\"-oxox---x\":9007199254740991,\"-oxox----\":9007199254740991,\"-ox-xox--\":9007199254740991,\"-ox-xooxx\":0,\"-ox-xoox-\":0,\"-ox-xoxxo\":9007199254740991,\"-ox-xo-xo\":9007199254740991,\"-ox-xo-x-\":0,\"-ox-xoo-x\":9007199254740991,\"-ox-xoxox\":9007199254740991,\"-ox-xo-ox\":9007199254740991,\"-ox-xo--x\":9007199254740991,\"-ox-xo---\":9007199254740991,\"-ox-xxoox\":9007199254740991,\"-ox-xxoo-\":9007199254740991,\"-ox-xxoxo\":0,\"-ox-xxo-o\":9007199254740991,\"-ox-xxo--\":9007199254740991,\"-ox-x-oxo\":0,\"-ox-x-ox-\":0,\"-ox-x-oox\":9007199254740991,\"-ox-x-o-x\":9007199254740991,\"-ox-x-o--\":9007199254740991,\"-ox-xxxoo\":9007199254740991,\"-ox-xx-oo\":9007199254740991,\"-ox-xx-o-\":9007199254740991,\"-ox-x-xo-\":9007199254740991,\"-ox-x--ox\":9007199254740991,\"-ox-x--o-\":9007199254740991,\"-ox-xx--o\":9007199254740991,\"-ox-x-x-o\":9007199254740991,\"-ox-x--xo\":0,\"-ox-x---o\":9007199254740991,\"-ox-x----\":9007199254740991,\"-oxooxxxo\":0,\"-oxooxxx-\":0,\"-oxooxx-x\":9007199254740991,\"-oxooxx--\":9007199254740991,\"-oxo-xxox\":9007199254740991,\"-oxo-xxo-\":9007199254740991,\"-oxo-xxxo\":0,\"-oxo-xx-o\":9007199254740991,\"-oxo-xx--\":9007199254740991,\"-oxoox-xx\":9007199254740991,\"-oxoox-x-\":9007199254740991,\"-oxo-xoxx\":9007199254740991,\"-oxo-xox-\":9007199254740991,\"-oxo-x-xo\":0,\"-oxo-x-x-\":0,\"-oxo-x--x\":9007199254740991,\"-oxo-x---\":9007199254740991,\"-ox-oxxo-\":-9007199254740991,\"-ox-oxxxo\":-9007199254740991,\"-ox-oxx-o\":-9007199254740991,\"-ox-oxx--\":-9007199254740991,\"-ox-oxoxx\":9007199254740991,\"-ox-oxox-\":9007199254740991,\"-ox-ox-xo\":0,\"-ox-ox-x-\":0,\"-ox-ox--x\":9007199254740991,\"-ox-ox---\":9007199254740991,\"-ox--xoxo\":0,\"-ox--xox-\":0,\"-ox--xo-x\":9007199254740991,\"-ox--xo--\":9007199254740991,\"-ox--xxoo\":9007199254740991,\"-ox--xxo-\":-9007199254740991,\"-ox--x-ox\":9007199254740991,\"-ox--x-o-\":9007199254740991,\"-ox--xx-o\":-9007199254740991,\"-ox--x-xo\":0,\"-ox--x--o\":9007199254740991,\"-ox--x---\":9007199254740991,\"-oxoo-xxx\":9007199254740991,\"-oxoo-xx-\":9007199254740991,\"-oxo-oxxx\":9007199254740991,\"-oxo-oxx-\":9007199254740991,\"-oxo--xxo\":9007199254740991,\"-oxo--xx-\":9007199254740991,\"-oxoo-x-x\":9007199254740991,\"-oxo-ox-x\":9007199254740991,\"-oxo--xox\":9007199254740991,\"-oxo--x-x\":9007199254740991,\"-oxo--x--\":9007199254740991,\"-ox-ooxxx\":9007199254740991,\"-ox-ooxx-\":9007199254740991,\"-ox-o-xxo\":0,\"-ox-o-xx-\":0,\"-ox-oox-x\":9007199254740991,\"-ox-o-xox\":-9007199254740991,\"-ox-o-x-x\":-9007199254740991,\"-ox-o-x--\":0,\"-ox--oxxo\":9007199254740991,\"-ox--oxx-\":9007199254740991,\"-ox--oxox\":9007199254740991,\"-ox--ox-x\":9007199254740991,\"-ox--ox--\":9007199254740991,\"-ox---xox\":-9007199254740991,\"-ox---xo-\":9007199254740991,\"-ox---xxo\":0,\"-ox---x-o\":9007199254740991,\"-ox---x--\":0,\"-oxoo--xx\":9007199254740991,\"-oxo-o-xx\":9007199254740991,\"-oxo--oxx\":9007199254740991,\"-oxo---xx\":9007199254740991,\"-oxo---x-\":9007199254740991,\"-ox-oo-xx\":9007199254740991,\"-ox-o-oxx\":9007199254740991,\"-ox-o--xx\":9007199254740991,\"-ox-o--x-\":9007199254740991,\"-ox--ooxx\":0,\"-ox--o-xx\":0,\"-ox--o-x-\":9007199254740991,\"-ox---oxx\":0,\"-ox---ox-\":0,\"-ox----xo\":0,\"-ox----x-\":0,\"-oxo----x\":9007199254740991,\"-ox-o---x\":9007199254740991,\"-ox--o--x\":9007199254740991,\"-ox---o-x\":9007199254740991,\"-ox----ox\":9007199254740991,\"-ox-----x\":9007199254740991,\"-ox------\":9007199254740991,\"--xoxox--\":9007199254740991,\"--xoxooxx\":-9007199254740991,\"--xoxoox-\":9007199254740991,\"--xoxoxxo\":9007199254740991,\"--xoxo-xo\":9007199254740991,\"--xoxo-x-\":9007199254740991,\"--xoxoo-x\":9007199254740991,\"--xoxoxox\":9007199254740991,\"--xoxo-ox\":9007199254740991,\"--xoxo--x\":9007199254740991,\"--xoxo---\":9007199254740991,\"--xoxxoox\":9007199254740991,\"--xoxxoo-\":9007199254740991,\"--xoxxoxo\":-9007199254740991,\"--xoxxo-o\":-9007199254740991,\"--xoxxo--\":-9007199254740991,\"--xox-oxo\":9007199254740991,\"--xox-ox-\":-9007199254740991,\"--xox-oox\":9007199254740991,\"--xox-o-x\":-9007199254740991,\"--xox-o--\":9007199254740991,\"--xoxxxoo\":9007199254740991,\"--xoxx-oo\":9007199254740991,\"--xoxx-o-\":9007199254740991,\"--xox-xo-\":9007199254740991,\"--xox--ox\":9007199254740991,\"--xox--o-\":9007199254740991,\"--xoxx--o\":-9007199254740991,\"--xox-x-o\":9007199254740991,\"--xox--xo\":9007199254740991,\"--xox---o\":9007199254740991,\"--xox----\":9007199254740991,\"--xooxxox\":9007199254740991,\"--xooxxo-\":9007199254740991,\"--xooxxxo\":-9007199254740991,\"--xooxx-o\":0,\"--xooxx--\":0,\"--xooxoxx\":9007199254740991,\"--xooxox-\":9007199254740991,\"--xoox-xo\":0,\"--xoox-x-\":0,\"--xoox--x\":9007199254740991,\"--xoox---\":9007199254740991,\"--xo-xoxo\":0,\"--xo-xox-\":-9007199254740991,\"--xo-xo-x\":9007199254740991,\"--xo-xo--\":9007199254740991,\"--xo-xxoo\":9007199254740991,\"--xo-xxo-\":9007199254740991,\"--xo-x-ox\":9007199254740991,\"--xo-x-o-\":9007199254740991,\"--xo-xx-o\":0,\"--xo-x-xo\":-9007199254740991,\"--xo-x--o\":0,\"--xo-x---\":0,\"--xoooxx-\":-9007199254740991,\"--xoo-xxo\":-9007199254740991,\"--xoo-xx-\":-9007199254740991,\"--xooox-x\":-9007199254740991,\"--xoo-xox\":9007199254740991,\"--xoo-x-x\":-9007199254740991,\"--xoo-x--\":0,\"--xo-oxxo\":9007199254740991,\"--xo-oxx-\":-9007199254740991,\"--xo-oxox\":9007199254740991,\"--xo-ox-x\":-9007199254740991,\"--xo-ox--\":9007199254740991,\"--xo--xox\":9007199254740991,\"--xo--xo-\":9007199254740991,\"--xo--xxo\":-9007199254740991,\"--xo--x-o\":9007199254740991,\"--xo--x--\":0,\"--xooo-xx\":-9007199254740991,\"--xoo-oxx\":9007199254740991,\"--xoo--xx\":-9007199254740991,\"--xoo--x-\":0,\"--xo-ooxx\":-9007199254740991,\"--xo-o-xx\":-9007199254740991,\"--xo-o-x-\":9007199254740991,\"--xo--oxx\":-9007199254740991,\"--xo--ox-\":9007199254740991,\"--xo---xo\":9007199254740991,\"--xo---x-\":0,\"--xoo---x\":9007199254740991,\"--xo-o--x\":9007199254740991,\"--xo--o-x\":9007199254740991,\"--xo---ox\":9007199254740991,\"--xo----x\":9007199254740991,\"--xo-----\":9007199254740991,\"--xxooxox\":-9007199254740991,\"--xxooxo-\":9007199254740991,\"--xxooxxo\":-9007199254740991,\"--xxoox-o\":9007199254740991,\"--xxoox--\":0,\"--xxoooxx\":0,\"--xxooox-\":0,\"--xxoo-xo\":9007199254740991,\"--xxoo-x-\":0,\"--xxooo-x\":0,\"--xxoo-ox\":0,\"--xxoo--x\":0,\"--xxoo---\":9007199254740991,\"--xxoxoox\":9007199254740991,\"--xxoxoo-\":9007199254740991,\"--xxoxoxo\":-9007199254740991,\"--xxoxo-o\":-9007199254740991,\"--xxoxo--\":-9007199254740991,\"--xxo-oxo\":0,\"--xxo-ox-\":0,\"--xxo-oox\":9007199254740991,\"--xxo-o-x\":0,\"--xxo-o--\":0,\"--xxoxxoo\":-9007199254740991,\"--xxox-oo\":-9007199254740991,\"--xxox-o-\":-9007199254740991,\"--xxo-xoo\":9007199254740991,\"--xxo-xo-\":-9007199254740991,\"--xxo--ox\":-9007199254740991,\"--xxo--o-\":0,\"--xxox--o\":-9007199254740991,\"--xxo-x-o\":-9007199254740991,\"--xxo--xo\":-9007199254740991,\"--xxo---o\":9007199254740991,\"--xxo----\":0,\"--x-oxoxo\":0,\"--x-oxox-\":0,\"--x-oxo-x\":9007199254740991,\"--x-oxo--\":9007199254740991,\"--x-oxxoo\":-9007199254740991,\"--x-oxxo-\":-9007199254740991,\"--x-ox-ox\":9007199254740991,\"--x-ox-o-\":9007199254740991,\"--x-oxx-o\":-9007199254740991,\"--x-ox-xo\":-9007199254740991,\"--x-ox--o\":0,\"--x-ox---\":0,\"--x-ooxxo\":-9007199254740991,\"--x-ooxx-\":-9007199254740991,\"--x-ooxox\":-9007199254740991,\"--x-oox-x\":-9007199254740991,\"--x-oox--\":0,\"--x-o-xox\":-9007199254740991,\"--x-o-xo-\":0,\"--x-o-xxo\":-9007199254740991,\"--x-o-x-o\":9007199254740991,\"--x-o-x--\":0,\"--x-oooxx\":0,\"--x-oo-xx\":-9007199254740991,\"--x-oo-x-\":0,\"--x-o-oxx\":0,\"--x-o-ox-\":0,\"--x-o--xo\":0,\"--x-o--x-\":0,\"--x-oo--x\":0,\"--x-o-o-x\":9007199254740991,\"--x-o--ox\":9007199254740991,\"--x-o---x\":0,\"--x-o----\":0,\"--xxxooox\":0,\"--xxxooo-\":0,\"--xxxooxo\":0,\"--xxxoo-o\":0,\"--xxxoo--\":0,\"--xx-ooxo\":9007199254740991,\"--xx-oox-\":0,\"--xx-ooox\":9007199254740991,\"--xx-oo-x\":0,\"--xx-oo--\":0,\"--xxxoxoo\":9007199254740991,\"--xxxo-oo\":9007199254740991,\"--xxxo-o-\":0,\"--xx-oxoo\":9007199254740991,\"--xx-oxo-\":9007199254740991,\"--xx-o-ox\":0,\"--xx-o-o-\":9007199254740991,\"--xxxo--o\":0,\"--xx-ox-o\":9007199254740991,\"--xx-o-xo\":9007199254740991,\"--xx-o--o\":9007199254740991,\"--xx-o---\":0,\"--x-xooxo\":9007199254740991,\"--x-xoox-\":0,\"--x-xooox\":9007199254740991,\"--x-xoo-x\":0,\"--x-xoo--\":9007199254740991,\"--x-xoxo-\":9007199254740991,\"--x-xo-ox\":9007199254740991,\"--x-xo-o-\":9007199254740991,\"--x-xox-o\":9007199254740991,\"--x-xo-xo\":9007199254740991,\"--x-xo--o\":9007199254740991,\"--x-xo---\":9007199254740991,\"--x--oxox\":-9007199254740991,\"--x--oxo-\":9007199254740991,\"--x--oxxo\":-9007199254740991,\"--x--ox-o\":9007199254740991,\"--x--ox--\":0,\"--x--ooxx\":-9007199254740991,\"--x--oox-\":9007199254740991,\"--x--o-xo\":9007199254740991,\"--x--o-x-\":0,\"--x--oo-x\":9007199254740991,\"--x--o-ox\":9007199254740991,\"--x--o--x\":0,\"--x--o---\":9007199254740991,\"--xxx-ooo\":-9007199254740991,\"--xxx-oo-\":-9007199254740991,\"--xx-xooo\":-9007199254740991,\"--xx-xoo-\":-9007199254740991,\"--xx--oox\":9007199254740991,\"--xx--oo-\":9007199254740991,\"--xxx-o-o\":-9007199254740991,\"--xx-xo-o\":-9007199254740991,\"--xx--oxo\":0,\"--xx--o-o\":0,\"--xx--o--\":0,\"--x-xxooo\":-9007199254740991,\"--x-xxoo-\":-9007199254740991,\"--x-x-oox\":9007199254740991,\"--x-x-oo-\":9007199254740991,\"--x-xxo-o\":-9007199254740991,\"--x-x-oxo\":0,\"--x-x-o-o\":0,\"--x-x-o--\":0,\"--x--xoox\":9007199254740991,\"--x--xoo-\":9007199254740991,\"--x--xoxo\":-9007199254740991,\"--x--xo-o\":-9007199254740991,\"--x--xo--\":-9007199254740991,\"--x---oxo\":9007199254740991,\"--x---ox-\":0,\"--x---oox\":9007199254740991,\"--x---o-x\":9007199254740991,\"--x---o--\":9007199254740991,\"--xxx--oo\":-9007199254740991,\"--xx-x-oo\":-9007199254740991,\"--xx--xoo\":9007199254740991,\"--xx---oo\":9007199254740991,\"--xx---o-\":0,\"--x-xx-oo\":-9007199254740991,\"--x-x-xoo\":9007199254740991,\"--x-x--oo\":9007199254740991,\"--x-x--o-\":9007199254740991,\"--x--xxoo\":-9007199254740991,\"--x--x-oo\":-9007199254740991,\"--x--x-o-\":-9007199254740991,\"--x---xoo\":9007199254740991,\"--x---xo-\":0,\"--x----ox\":9007199254740991,\"--x----o-\":9007199254740991,\"--xx----o\":0,\"--x-x---o\":0,\"--x--x--o\":-9007199254740991,\"--x---x-o\":9007199254740991,\"--x----xo\":0,\"--x-----o\":9007199254740991,\"--x------\":0,\"oo-xxx---\":9007199254740991,\"oooxx-x--\":-9007199254740991,\"oooxxoxx-\":-9007199254740991,\"oo-xxoxxo\":9007199254740991,\"oo-xxoxx-\":-9007199254740991,\"oooxxox-x\":-9007199254740991,\"oo-xxoxox\":9007199254740991,\"oo-xxox-x\":-9007199254740991,\"oo-xxox--\":9007199254740991,\"oo-xxxxo-\":9007199254740991,\"oooxx-xox\":-9007199254740991,\"oo-xx-xox\":-9007199254740991,\"oo-xx-xo-\":9007199254740991,\"oo-xxxx-o\":9007199254740991,\"oooxx-xxo\":-9007199254740991,\"oo-xx-xxo\":-9007199254740991,\"oo-xx-x-o\":9007199254740991,\"oo-xx-x--\":-9007199254740991,\"oooxx--x-\":-9007199254740991,\"oooxxo-xx\":-9007199254740991,\"oo-xxooxx\":0,\"oo-xxo-xx\":-9007199254740991,\"oo-xxo-x-\":0,\"oo-xxxox-\":9007199254740991,\"oooxx-oxx\":-9007199254740991,\"oo-xx-oxx\":-9007199254740991,\"oo-xx-ox-\":9007199254740991,\"oo-xxx-xo\":9007199254740991,\"oo-xx--xo\":9007199254740991,\"oo-xx--x-\":-9007199254740991,\"oooxx---x\":-9007199254740991,\"oo-xxo--x\":0,\"oo-xxxo-x\":9007199254740991,\"oo-xx-o-x\":9007199254740991,\"oo-xxx-ox\":9007199254740991,\"oo-xx--ox\":9007199254740991,\"oo-xx---x\":-9007199254740991,\"oo-xx----\":9007199254740991,\"o-oxxx---\":9007199254740991,\"o-oxxoxxo\":-9007199254740991,\"o-oxxoxx-\":-9007199254740991,\"o-oxxoxox\":0,\"o-oxxox-x\":-9007199254740991,\"o-oxxox--\":-9007199254740991,\"o-oxxxxo-\":9007199254740991,\"o-oxx-xox\":-9007199254740991,\"o-oxx-xo-\":9007199254740991,\"o-oxxxx-o\":9007199254740991,\"o-oxx-xxo\":-9007199254740991,\"o-oxx-x-o\":9007199254740991,\"o-oxx-x--\":-9007199254740991,\"o-oxxooxx\":9007199254740991,\"o-oxxo-xx\":-9007199254740991,\"o-oxxo-x-\":9007199254740991,\"o-oxxxox-\":9007199254740991,\"o-oxx-oxx\":-9007199254740991,\"o-oxx-ox-\":9007199254740991,\"o-oxxx-xo\":9007199254740991,\"o-oxx--xo\":9007199254740991,\"o-oxx--x-\":-9007199254740991,\"o-oxxo--x\":0,\"o-oxxxo-x\":9007199254740991,\"o-oxx-o-x\":9007199254740991,\"o-oxxx-ox\":9007199254740991,\"o-oxx--ox\":9007199254740991,\"o-oxx---x\":-9007199254740991,\"o-oxx----\":9007199254740991,\"o--xxoxox\":0,\"o--xxoxo-\":9007199254740991,\"o--xxoxxo\":-9007199254740991,\"o--xxox-o\":9007199254740991,\"o--xxox--\":-9007199254740991,\"o--xxooxx\":0,\"o--xxoox-\":9007199254740991,\"o--xxo-xo\":9007199254740991,\"o--xxo-x-\":0,\"o--xxoo-x\":0,\"o--xxo-ox\":0,\"o--xxo--x\":0,\"o--xxo---\":0,\"o--xxxo--\":9007199254740991,\"o--xxxoxo\":9007199254740991,\"o--xx-oxo\":9007199254740991,\"o--xx-ox-\":9007199254740991,\"o--xxxoox\":9007199254740991,\"o--xx-oox\":9007199254740991,\"o--xx-o-x\":0,\"o--xx-o--\":9007199254740991,\"o--xxx-o-\":9007199254740991,\"o--xxxxoo\":9007199254740991,\"o--xx-xoo\":9007199254740991,\"o--xx-xo-\":9007199254740991,\"o--xx--ox\":0,\"o--xx--o-\":9007199254740991,\"o--xxx--o\":9007199254740991,\"o--xx-x-o\":9007199254740991,\"o--xx--xo\":9007199254740991,\"o--xx---o\":9007199254740991,\"o--xx----\":0,\"ooox-xx--\":-9007199254740991,\"oooxoxxx-\":-9007199254740991,\"oo-xoxxxo\":-9007199254740991,\"oo-xoxxx-\":-9007199254740991,\"oooxoxx-x\":-9007199254740991,\"oo-xoxxox\":-9007199254740991,\"oo-xoxx-x\":-9007199254740991,\"oo-xoxx--\":-9007199254740991,\"ooox-xxox\":-9007199254740991,\"oo-x-xxox\":-9007199254740991,\"oo-x-xxo-\":9007199254740991,\"ooox-xxxo\":-9007199254740991,\"oo-x-xxxo\":-9007199254740991,\"oo-x-xx-o\":9007199254740991,\"oo-x-xx--\":-9007199254740991,\"ooox-x-x-\":-9007199254740991,\"oooxox-xx\":-9007199254740991,\"oo-xoxoxx\":9007199254740991,\"oo-xox-xx\":-9007199254740991,\"oo-xox-x-\":-9007199254740991,\"ooox-xoxx\":-9007199254740991,\"oo-x-xoxx\":-9007199254740991,\"oo-x-xox-\":9007199254740991,\"oo-x-x-xo\":9007199254740991,\"oo-x-x-x-\":-9007199254740991,\"ooox-x--x\":-9007199254740991,\"oo-xox--x\":9007199254740991,\"oo-x-xo-x\":9007199254740991,\"oo-x-x-ox\":9007199254740991,\"oo-x-x--x\":-9007199254740991,\"oo-x-x---\":9007199254740991,\"o-oxoxxxo\":-9007199254740991,\"o-oxoxxx-\":-9007199254740991,\"o-oxoxxox\":0,\"o-oxoxx-x\":-9007199254740991,\"o-oxoxx--\":-9007199254740991,\"o-ox-xxox\":-9007199254740991,\"o-ox-xxo-\":9007199254740991,\"o-ox-xxxo\":-9007199254740991,\"o-ox-xx-o\":9007199254740991,\"o-ox-xx--\":-9007199254740991,\"o-oxoxoxx\":-9007199254740991,\"o-oxox-xx\":-9007199254740991,\"o-oxox-x-\":-9007199254740991,\"o-ox-xoxx\":-9007199254740991,\"o-ox-xox-\":9007199254740991,\"o-ox-x-xo\":9007199254740991,\"o-ox-x-x-\":-9007199254740991,\"o-oxox--x\":-9007199254740991,\"o-ox-xo-x\":9007199254740991,\"o-ox-x-ox\":9007199254740991,\"o-ox-x--x\":-9007199254740991,\"o-ox-x---\":9007199254740991,\"o--xoxxox\":-9007199254740991,\"o--xoxxo-\":-9007199254740991,\"o--xoxx-o\":-9007199254740991,\"o--xoxx--\":-9007199254740991,\"o--xoxoxx\":-9007199254740991,\"o--xoxox-\":-9007199254740991,\"o--xox-xo\":-9007199254740991,\"o--xox-x-\":-9007199254740991,\"o--xoxo-x\":9007199254740991,\"o--xox-ox\":9007199254740991,\"o--xox--x\":-9007199254740991,\"o--xox---\":-9007199254740991,\"o--x-xoxo\":9007199254740991,\"o--x-xox-\":-9007199254740991,\"o--x-xoox\":9007199254740991,\"o--x-xo-x\":9007199254740991,\"o--x-xo--\":9007199254740991,\"o--x-xxoo\":9007199254740991,\"o--x-xxo-\":-9007199254740991,\"o--x-x-ox\":9007199254740991,\"o--x-x-o-\":9007199254740991,\"o--x-xx-o\":-9007199254740991,\"o--x-x-xo\":-9007199254740991,\"o--x-x--o\":9007199254740991,\"o--x-x---\":-9007199254740991,\"ooox--xx-\":-9007199254740991,\"oo-xo-xxx\":9007199254740991,\"oo-xo-xx-\":9007199254740991,\"oo-x-oxxx\":9007199254740991,\"oo-x-oxx-\":9007199254740991,\"oo-x--xxo\":-9007199254740991,\"oo-x--xx-\":-9007199254740991,\"ooox--x-x\":-9007199254740991,\"oo-xo-x-x\":9007199254740991,\"oo-x-ox-x\":9007199254740991,\"oo-x--xox\":-9007199254740991,\"oo-x--x-x\":-9007199254740991,\"oo-x--x--\":-9007199254740991,\"o-oxo-xxx\":9007199254740991,\"o-oxo-xx-\":9007199254740991,\"o-ox-oxxx\":9007199254740991,\"o-ox-oxx-\":9007199254740991,\"o-ox--xxo\":-9007199254740991,\"o-ox--xx-\":-9007199254740991,\"o-oxo-x-x\":9007199254740991,\"o-ox-ox-x\":9007199254740991,\"o-ox--xox\":0,\"o-ox--x-x\":-9007199254740991,\"o-ox--x--\":-9007199254740991,\"o--xooxxx\":9007199254740991,\"o--xooxx-\":9007199254740991,\"o--xo-xxo\":-9007199254740991,\"o--xo-xx-\":-9007199254740991,\"o--xoox-x\":9007199254740991,\"o--xo-xox\":0,\"o--xo-x-x\":0,\"o--xo-x--\":0,\"o--x-oxxo\":-9007199254740991,\"o--x-oxx-\":-9007199254740991,\"o--x-oxox\":0,\"o--x-ox-x\":0,\"o--x-ox--\":0,\"o--x--xox\":-9007199254740991,\"o--x--xo-\":9007199254740991,\"o--x--xxo\":-9007199254740991,\"o--x--x-o\":9007199254740991,\"o--x--x--\":-9007199254740991,\"ooox---xx\":-9007199254740991,\"oo-xo--xx\":9007199254740991,\"oo-x-o-xx\":9007199254740991,\"oo-x--oxx\":0,\"oo-x---xx\":-9007199254740991,\"oo-x---x-\":9007199254740991,\"o-oxo--xx\":9007199254740991,\"o-ox-o-xx\":9007199254740991,\"o-ox--oxx\":-9007199254740991,\"o-ox---xx\":-9007199254740991,\"o-ox---x-\":-9007199254740991,\"o--xoo-xx\":9007199254740991,\"o--xo-oxx\":0,\"o--xo--xx\":0,\"o--xo--x-\":0,\"o--x-ooxx\":0,\"o--x-o-xx\":0,\"o--x-o-x-\":0,\"o--x--oxx\":-9007199254740991,\"o--x--ox-\":9007199254740991,\"o--x---xo\":9007199254740991,\"o--x---x-\":-9007199254740991,\"oo-x----x\":9007199254740991,\"o-ox----x\":0,\"o--xo---x\":0,\"o--x-o--x\":0,\"o--x--o-x\":9007199254740991,\"o--x---ox\":9007199254740991,\"o--x----x\":0,\"o--x-----\":0,\"-ooxxx---\":9007199254740991,\"-ooxxoxxo\":-9007199254740991,\"-ooxxoxx-\":-9007199254740991,\"xooxxoxox\":9007199254740991,\"-ooxxoxox\":9007199254740991,\"-ooxxox-x\":-9007199254740991,\"-ooxxox--\":9007199254740991,\"-ooxxxxo-\":9007199254740991,\"-ooxx-xox\":-9007199254740991,\"-ooxx-xo-\":9007199254740991,\"-ooxxxx-o\":9007199254740991,\"-ooxx-xxo\":-9007199254740991,\"-ooxx-x-o\":9007199254740991,\"-ooxx-x--\":-9007199254740991,\"-ooxxooxx\":9007199254740991,\"-ooxxo-xx\":-9007199254740991,\"-ooxxo-x-\":-9007199254740991,\"-ooxxxox-\":9007199254740991,\"-ooxx-oxx\":-9007199254740991,\"-ooxx-ox-\":9007199254740991,\"-ooxxx-xo\":9007199254740991,\"-ooxx--xo\":9007199254740991,\"-ooxx--x-\":-9007199254740991,\"-ooxxo--x\":9007199254740991,\"-ooxxxo-x\":9007199254740991,\"-ooxx-o-x\":9007199254740991,\"-ooxxx-ox\":9007199254740991,\"-ooxx--ox\":9007199254740991,\"-ooxx---x\":-9007199254740991,\"-ooxx----\":9007199254740991,\"-o-xxoxox\":9007199254740991,\"-o-xxoxo-\":9007199254740991,\"-o-xxoxxo\":-9007199254740991,\"-o-xxox-o\":9007199254740991,\"-o-xxox--\":9007199254740991,\"-o-xxooxx\":0,\"-o-xxoox-\":0,\"-o-xxo-xo\":0,\"-o-xxo-x-\":-9007199254740991,\"-o-xxoo-x\":9007199254740991,\"-o-xxo-ox\":9007199254740991,\"-o-xxo--x\":0,\"-o-xxo---\":9007199254740991,\"-o-xxxo--\":9007199254740991,\"-o-xxxoxo\":9007199254740991,\"-o-xx-oxo\":9007199254740991,\"-o-xx-ox-\":0,\"-o-xxxoox\":9007199254740991,\"-o-xx-oox\":9007199254740991,\"-o-xx-o-x\":9007199254740991,\"-o-xx-o--\":9007199254740991,\"-o-xxx-o-\":9007199254740991,\"-o-xxxxoo\":9007199254740991,\"-o-xx-xoo\":9007199254740991,\"-o-xx-xo-\":9007199254740991,\"-o-xx--ox\":9007199254740991,\"-o-xx--o-\":9007199254740991,\"-o-xxx--o\":9007199254740991,\"-o-xx-x-o\":9007199254740991,\"-o-xx--xo\":0,\"-o-xx---o\":9007199254740991,\"-o-xx----\":9007199254740991,\"-ooxoxxxo\":9007199254740991,\"-ooxoxxx-\":-9007199254740991,\"-ooxoxxox\":-9007199254740991,\"-ooxoxx-x\":-9007199254740991,\"-ooxoxx--\":9007199254740991,\"-oox-xxox\":-9007199254740991,\"-oox-xxo-\":9007199254740991,\"-oox-xxxo\":-9007199254740991,\"-oox-xx-o\":9007199254740991,\"-oox-xx--\":-9007199254740991,\"-ooxoxoxx\":-9007199254740991,\"-ooxox-xx\":-9007199254740991,\"-ooxox-x-\":-9007199254740991,\"-oox-xoxx\":-9007199254740991,\"-oox-xox-\":9007199254740991,\"-oox-x-xo\":9007199254740991,\"-oox-x-x-\":-9007199254740991,\"-ooxox--x\":-9007199254740991,\"-oox-xo-x\":9007199254740991,\"-oox-x-ox\":9007199254740991,\"-oox-x--x\":-9007199254740991,\"-oox-x---\":9007199254740991,\"-o-xoxxo-\":-9007199254740991,\"-o-xoxxxo\":-9007199254740991,\"-o-xoxx-o\":9007199254740991,\"-o-xoxx--\":-9007199254740991,\"-o-xoxoxx\":-9007199254740991,\"-o-xoxox-\":0,\"-o-xox-xo\":0,\"-o-xox-x-\":-9007199254740991,\"-o-xoxo-x\":9007199254740991,\"-o-xox-ox\":-9007199254740991,\"-o-xox--x\":-9007199254740991,\"-o-xox---\":-9007199254740991,\"-o-x-xoxo\":9007199254740991,\"-o-x-xox-\":0,\"-o-x-xoox\":9007199254740991,\"-o-x-xo-x\":9007199254740991,\"-o-x-xo--\":9007199254740991,\"-o-x-xxoo\":9007199254740991,\"-o-x-xxo-\":-9007199254740991,\"-o-x-x-ox\":-9007199254740991,\"-o-x-x-o-\":9007199254740991,\"-o-x-xx-o\":9007199254740991,\"-o-x-x-xo\":0,\"-o-x-x--o\":9007199254740991,\"-o-x-x---\":-9007199254740991,\"-ooxo-xxx\":9007199254740991,\"-ooxo-xx-\":9007199254740991,\"-oox-oxxx\":9007199254740991,\"-oox-oxx-\":9007199254740991,\"-oox--xxo\":9007199254740991,\"-oox--xx-\":-9007199254740991,\"-ooxo-x-x\":9007199254740991,\"-oox-ox-x\":9007199254740991,\"-oox--xox\":9007199254740991,\"-oox--x-x\":-9007199254740991,\"-oox--x--\":9007199254740991,\"-o-xooxxx\":9007199254740991,\"-o-xooxx-\":9007199254740991,\"-o-xo-xxo\":9007199254740991,\"-o-xo-xx-\":9007199254740991,\"-o-xoox-x\":9007199254740991,\"-o-xo-xox\":-9007199254740991,\"-o-xo-x-x\":-9007199254740991,\"-o-xo-x--\":9007199254740991,\"-o-x-oxxo\":9007199254740991,\"-o-x-oxx-\":9007199254740991,\"-o-x-oxox\":9007199254740991,\"-o-x-ox-x\":9007199254740991,\"-o-x-ox--\":9007199254740991,\"-o-x--xox\":-9007199254740991,\"-o-x--xo-\":9007199254740991,\"-o-x--xxo\":-9007199254740991,\"-o-x--x-o\":9007199254740991,\"-o-x--x--\":-9007199254740991,\"-ooxo--xx\":9007199254740991,\"-oox-o-xx\":9007199254740991,\"-oox--oxx\":-9007199254740991,\"-oox---xx\":-9007199254740991,\"-oox---x-\":9007199254740991,\"-o-xoo-xx\":9007199254740991,\"-o-xo-oxx\":0,\"-o-xo--xx\":0,\"-o-xo--x-\":9007199254740991,\"-o-x-ooxx\":0,\"-o-x-o-xx\":0,\"-o-x-o-x-\":9007199254740991,\"-o-x--oxx\":-9007199254740991,\"-o-x--ox-\":0,\"-o-x---xo\":0,\"-o-x---x-\":0,\"-oox----x\":9007199254740991,\"-o-xo---x\":0,\"-o-x-o--x\":9007199254740991,\"-o-x--o-x\":9007199254740991,\"-o-x---ox\":9007199254740991,\"-o-x----x\":0,\"-o-x-----\":9007199254740991,\"--oxxoxox\":0,\"--oxxoxo-\":9007199254740991,\"--oxxox-o\":-9007199254740991,\"--oxxox--\":-9007199254740991,\"--oxxooxx\":9007199254740991,\"--oxxoox-\":9007199254740991,\"--oxxo-xo\":-9007199254740991,\"--oxxo-x-\":-9007199254740991,\"--oxxoo-x\":9007199254740991,\"--oxxo-ox\":9007199254740991,\"--oxxo--x\":0,\"--oxxo---\":0,\"--oxxxo--\":9007199254740991,\"--oxxxoxo\":9007199254740991,\"--oxx-oxo\":9007199254740991,\"--oxx-ox-\":9007199254740991,\"--oxxxoox\":9007199254740991,\"--oxx-oox\":9007199254740991,\"--oxx-o-x\":9007199254740991,\"--oxx-o--\":9007199254740991,\"--oxxx-o-\":9007199254740991,\"--oxxxxoo\":9007199254740991,\"--oxx-xoo\":9007199254740991,\"--oxx-xo-\":9007199254740991,\"--oxx--ox\":9007199254740991,\"--oxx--o-\":9007199254740991,\"--oxxx--o\":9007199254740991,\"--oxx-x-o\":-9007199254740991,\"--oxx--xo\":-9007199254740991,\"--oxx---o\":9007199254740991,\"--oxx----\":0,\"--oxoxxox\":-9007199254740991,\"--oxoxxo-\":9007199254740991,\"--oxoxxxo\":-9007199254740991,\"--oxoxx-o\":9007199254740991,\"--oxoxx--\":-9007199254740991,\"--oxoxox-\":-9007199254740991,\"--oxox-xo\":-9007199254740991,\"--oxox-x-\":-9007199254740991,\"--oxoxo-x\":-9007199254740991,\"--oxox-ox\":-9007199254740991,\"--oxox--x\":-9007199254740991,\"--oxox---\":-9007199254740991,\"--ox-xoxo\":9007199254740991,\"--ox-xox-\":-9007199254740991,\"--ox-xoox\":9007199254740991,\"--ox-xo-x\":-9007199254740991,\"--ox-xo--\":9007199254740991,\"--ox-xxoo\":9007199254740991,\"--ox-xxo-\":9007199254740991,\"--ox-x-ox\":-9007199254740991,\"--ox-x-o-\":9007199254740991,\"--ox-xx-o\":9007199254740991,\"--ox-x-xo\":-9007199254740991,\"--ox-x--o\":9007199254740991,\"--ox-x---\":-9007199254740991,\"--oxooxxx\":9007199254740991,\"--oxooxx-\":9007199254740991,\"--oxo-xxo\":9007199254740991,\"--oxo-xx-\":9007199254740991,\"--oxoox-x\":9007199254740991,\"--oxo-xox\":9007199254740991,\"--oxo-x-x\":9007199254740991,\"--oxo-x--\":9007199254740991,\"--ox-oxxo\":-9007199254740991,\"--ox-oxx-\":-9007199254740991,\"--ox-oxox\":9007199254740991,\"--ox-ox-x\":9007199254740991,\"--ox-ox--\":9007199254740991,\"--ox--xox\":0,\"--ox--xo-\":9007199254740991,\"--ox--xxo\":-9007199254740991,\"--ox--x-o\":9007199254740991,\"--ox--x--\":-9007199254740991,\"--oxoo-xx\":9007199254740991,\"--oxo-oxx\":-9007199254740991,\"--oxo--xx\":-9007199254740991,\"--oxo--x-\":9007199254740991,\"--ox-ooxx\":9007199254740991,\"--ox-o-xx\":9007199254740991,\"--ox-o-x-\":9007199254740991,\"--ox--oxx\":-9007199254740991,\"--ox--ox-\":9007199254740991,\"--ox---xo\":-9007199254740991,\"--ox---x-\":-9007199254740991,\"--oxo---x\":9007199254740991,\"--ox-o--x\":9007199254740991,\"--ox--o-x\":9007199254740991,\"--ox---ox\":9007199254740991,\"--ox----x\":0,\"--ox-----\":9007199254740991,\"---xoxoxo\":-9007199254740991,\"---xoxox-\":-9007199254740991,\"---xoxoox\":9007199254740991,\"---xoxo-x\":-9007199254740991,\"---xoxo--\":-9007199254740991,\"---xoxxoo\":9007199254740991,\"---xoxxo-\":-9007199254740991,\"---xox-ox\":-9007199254740991,\"---xox-o-\":-9007199254740991,\"---xoxx-o\":-9007199254740991,\"---xox-xo\":-9007199254740991,\"---xox--o\":-9007199254740991,\"---xox---\":-9007199254740991,\"---xooxxo\":9007199254740991,\"---xooxx-\":9007199254740991,\"---xooxox\":9007199254740991,\"---xoox-x\":9007199254740991,\"---xoox--\":9007199254740991,\"---xo-xox\":-9007199254740991,\"---xo-xo-\":9007199254740991,\"---xo-xxo\":-9007199254740991,\"---xo-x-o\":9007199254740991,\"---xo-x--\":0,\"---xoooxx\":0,\"---xoo-xx\":0,\"---xoo-x-\":9007199254740991,\"---xo-oxx\":-9007199254740991,\"---xo-ox-\":0,\"---xo--xo\":0,\"---xo--x-\":0,\"---xoo--x\":9007199254740991,\"---xo-o-x\":0,\"---xo--ox\":0,\"---xo---x\":0,\"---xo----\":0,\"---xxooxo\":9007199254740991,\"---xxoox-\":0,\"---xxooox\":9007199254740991,\"---xxoo-x\":0,\"---xxoo--\":0,\"---xxoxoo\":9007199254740991,\"---xxoxo-\":9007199254740991,\"---xxo-ox\":0,\"---xxo-o-\":9007199254740991,\"---xxox-o\":-9007199254740991,\"---xxo-xo\":-9007199254740991,\"---xxo--o\":0,\"---xxo---\":0,\"---x-oxox\":0,\"---x-oxo-\":9007199254740991,\"---x-oxxo\":-9007199254740991,\"---x-ox-o\":9007199254740991,\"---x-ox--\":0,\"---x-ooxx\":0,\"---x-oox-\":0,\"---x-o-xo\":9007199254740991,\"---x-o-x-\":0,\"---x-oo-x\":0,\"---x-o-ox\":9007199254740991,\"---x-o--x\":0,\"---x-o---\":0,\"---xxxoo-\":9007199254740991,\"---xx-oox\":9007199254740991,\"---xx-oo-\":9007199254740991,\"---xxxo-o\":9007199254740991,\"---xx-oxo\":9007199254740991,\"---xx-o-o\":9007199254740991,\"---xx-o--\":0,\"---x-xoox\":9007199254740991,\"---x-xoo-\":9007199254740991,\"---x-xoxo\":-9007199254740991,\"---x-xo-o\":9007199254740991,\"---x-xo--\":-9007199254740991,\"---x--oxo\":9007199254740991,\"---x--ox-\":0,\"---x--oox\":9007199254740991,\"---x--o-x\":0,\"---x--o--\":0,\"---xxx-oo\":9007199254740991,\"---xx-xoo\":9007199254740991,\"---xx--oo\":9007199254740991,\"---xx--o-\":9007199254740991,\"---x-xxoo\":9007199254740991,\"---x-x-oo\":9007199254740991,\"---x-x-o-\":-9007199254740991,\"---x--xoo\":9007199254740991,\"---x--xo-\":9007199254740991,\"---x---ox\":0,\"---x---o-\":9007199254740991,\"---xx---o\":0,\"---x-x--o\":-9007199254740991,\"---x--x-o\":9007199254740991,\"---x---xo\":-9007199254740991,\"---x----o\":9007199254740991,\"---x-----\":0,\"ooo-xxx--\":-9007199254740991,\"ooooxxxx-\":-9007199254740991,\"oo-oxxxxo\":9007199254740991,\"oo-oxxxx-\":-9007199254740991,\"ooooxxx-x\":-9007199254740991,\"ooxoxxxox\":9007199254740991,\"oo-oxxxox\":9007199254740991,\"oo-oxxx-x\":-9007199254740991,\"oo-oxxx--\":9007199254740991,\"ooo-xxxox\":-9007199254740991,\"oo--xxxox\":-9007199254740991,\"oo--xxxo-\":9007199254740991,\"ooo-xxxxo\":-9007199254740991,\"oo--xxxxo\":-9007199254740991,\"oo--xxx-o\":9007199254740991,\"oo--xxx--\":-9007199254740991,\"ooo-xx-x-\":-9007199254740991,\"ooooxx-xx\":-9007199254740991,\"oo-oxxoxx\":-9007199254740991,\"oo-oxx-xx\":-9007199254740991,\"oo-oxx-x-\":-9007199254740991,\"ooo-xxoxx\":-9007199254740991,\"oo--xxoxx\":-9007199254740991,\"oo--xxox-\":9007199254740991,\"oo--xx-xo\":9007199254740991,\"oo--xx-x-\":-9007199254740991,\"ooo-xx--x\":-9007199254740991,\"oo-oxx--x\":9007199254740991,\"oo--xxo-x\":9007199254740991,\"oo--xx-ox\":9007199254740991,\"oo--xx--x\":-9007199254740991,\"oo--xx---\":9007199254740991,\"o-ooxxxxo\":9007199254740991,\"o-ooxxxx-\":-9007199254740991,\"o-ooxxxox\":0,\"o-ooxxx-x\":-9007199254740991,\"o-ooxxx--\":0,\"o-o-xxxox\":-9007199254740991,\"o-o-xxxo-\":9007199254740991,\"o-o-xxxxo\":-9007199254740991,\"o-o-xxx-o\":9007199254740991,\"o-o-xxx--\":-9007199254740991,\"o-ooxxoxx\":-9007199254740991,\"o-ooxx-xx\":-9007199254740991,\"o-ooxx-x-\":9007199254740991,\"o-o-xxoxx\":-9007199254740991,\"o-o-xxox-\":9007199254740991,\"o-o-xx-xo\":9007199254740991,\"o-o-xx-x-\":-9007199254740991,\"o-ooxx--x\":-9007199254740991,\"o-o-xxo-x\":9007199254740991,\"o-o-xx-ox\":9007199254740991,\"o-o-xx--x\":-9007199254740991,\"o-o-xx---\":9007199254740991,\"o--oxxxox\":0,\"o--oxxxo-\":9007199254740991,\"o--oxxxxo\":9007199254740991,\"o--oxxx-o\":9007199254740991,\"o--oxxx--\":0,\"o--oxxox-\":-9007199254740991,\"o--oxx-xo\":9007199254740991,\"o--oxx-x-\":-9007199254740991,\"o--oxxo-x\":-9007199254740991,\"o--oxx-ox\":9007199254740991,\"o--oxx--x\":-9007199254740991,\"o--oxx---\":0,\"o---xxoxo\":9007199254740991,\"o---xxox-\":-9007199254740991,\"o---xxoox\":9007199254740991,\"o---xxo-x\":-9007199254740991,\"o---xxo--\":9007199254740991,\"o---xxxoo\":9007199254740991,\"o---xxxo-\":9007199254740991,\"o---xx-ox\":9007199254740991,\"o---xx-o-\":9007199254740991,\"o---xxx-o\":9007199254740991,\"o---xx-xo\":9007199254740991,\"o---xx--o\":9007199254740991,\"o---xx---\":0,\"ooo-x-xx-\":-9007199254740991,\"oo-ox-xxx\":9007199254740991,\"oo-ox-xx-\":9007199254740991,\"oo--xoxxx\":9007199254740991,\"oo--xoxx-\":9007199254740991,\"oo--x-xxo\":9007199254740991,\"oo--x-xx-\":-9007199254740991,\"ooo-x-x-x\":-9007199254740991,\"oo-ox-x-x\":9007199254740991,\"oo--xox-x\":9007199254740991,\"oo--x-xox\":9007199254740991,\"oo--x-x-x\":-9007199254740991,\"oo--x-x--\":9007199254740991,\"o-oox-xxx\":9007199254740991,\"o-oox-xx-\":9007199254740991,\"o-o-xoxxx\":9007199254740991,\"o-o-xoxx-\":9007199254740991,\"o-o-x-xxo\":9007199254740991,\"o-o-x-xx-\":-9007199254740991,\"o-oox-x-x\":9007199254740991,\"o-o-xox-x\":9007199254740991,\"o-o-x-xox\":0,\"o-o-x-x-x\":-9007199254740991,\"o-o-x-x--\":0,\"o--oxoxxx\":9007199254740991,\"o--oxoxx-\":9007199254740991,\"o--ox-xxo\":9007199254740991,\"o--ox-xx-\":9007199254740991,\"o--oxox-x\":9007199254740991,\"o--ox-xox\":9007199254740991,\"o--ox-x-x\":9007199254740991,\"o--ox-x--\":9007199254740991,\"o---xoxxo\":9007199254740991,\"o---xoxx-\":9007199254740991,\"o---xoxox\":9007199254740991,\"o---xox-x\":9007199254740991,\"o---xox--\":9007199254740991,\"o---x-xox\":0,\"o---x-xo-\":9007199254740991,\"o---x-xxo\":9007199254740991,\"o---x-x-o\":9007199254740991,\"o---x-x--\":0,\"ooo-x--xx\":-9007199254740991,\"oo-ox--xx\":9007199254740991,\"oo--xo-xx\":9007199254740991,\"oo--x-oxx\":-9007199254740991,\"oo--x--xx\":-9007199254740991,\"oo--x--x-\":0,\"o-oox--xx\":9007199254740991,\"o-o-xo-xx\":9007199254740991,\"o-o-x-oxx\":9007199254740991,\"o-o-x--xx\":-9007199254740991,\"o-o-x--x-\":9007199254740991,\"o--oxo-xx\":9007199254740991,\"o--ox-oxx\":-9007199254740991,\"o--ox--xx\":-9007199254740991,\"o--ox--x-\":9007199254740991,\"o---xooxx\":9007199254740991,\"o---xo-xx\":9007199254740991,\"o---xo-x-\":9007199254740991,\"o---x-oxx\":-9007199254740991,\"o---x-ox-\":9007199254740991,\"o---x--xo\":9007199254740991,\"o---x--x-\":0,\"oo--x---x\":9007199254740991,\"o-o-x---x\":0,\"o--ox---x\":9007199254740991,\"o---xo--x\":9007199254740991,\"o---x-o-x\":0,\"o---x--ox\":9007199254740991,\"o---x---x\":0,\"o---x----\":0,\"-oooxxxxo\":0,\"-oooxxxx-\":-9007199254740991,\"-oooxxxox\":9007199254740991,\"-oooxxx-x\":-9007199254740991,\"-oooxxx--\":0,\"-oo-xxxox\":-9007199254740991,\"-oo-xxxo-\":9007199254740991,\"-oo-xxxxo\":-9007199254740991,\"-oo-xxx-o\":9007199254740991,\"-oo-xxx--\":-9007199254740991,\"-oooxxoxx\":9007199254740991,\"-oooxx-xx\":-9007199254740991,\"-oooxx-x-\":0,\"-oo-xxoxx\":-9007199254740991,\"-oo-xxox-\":9007199254740991,\"-oo-xx-xo\":9007199254740991,\"-oo-xx-x-\":-9007199254740991,\"-oooxx--x\":9007199254740991,\"-oo-xxo-x\":9007199254740991,\"-oo-xx-ox\":9007199254740991,\"-oo-xx--x\":-9007199254740991,\"-oo-xx---\":9007199254740991,\"-o-oxxxox\":9007199254740991,\"-o-oxxxo-\":9007199254740991,\"-o-oxxxxo\":0,\"-o-oxxx-o\":9007199254740991,\"-o-oxxx--\":0,\"-o-oxxoxx\":-9007199254740991,\"-o-oxxox-\":0,\"-o-oxx-xo\":0,\"-o-oxx-x-\":-9007199254740991,\"-o-oxxo-x\":9007199254740991,\"-o-oxx-ox\":9007199254740991,\"-o-oxx--x\":9007199254740991,\"-o-oxx---\":9007199254740991,\"-o--xxoxo\":9007199254740991,\"-o--xxox-\":0,\"-o--xxoox\":9007199254740991,\"-o--xxo-x\":9007199254740991,\"-o--xxo--\":9007199254740991,\"-o--xxxoo\":9007199254740991,\"-o--xxxo-\":9007199254740991,\"-o--xx-ox\":9007199254740991,\"-o--xx-o-\":9007199254740991,\"-o--xxx-o\":9007199254740991,\"-o--xx-xo\":0,\"-o--xx--o\":9007199254740991,\"-o--xx---\":9007199254740991,\"-ooox-xxx\":9007199254740991,\"-ooox-xx-\":9007199254740991,\"-oo-xoxxx\":9007199254740991,\"-oo-xoxx-\":9007199254740991,\"-oo-x-xxo\":-9007199254740991,\"-oo-x-xx-\":-9007199254740991,\"-ooox-x-x\":9007199254740991,\"-oo-xox-x\":9007199254740991,\"-oo-x-xox\":9007199254740991,\"-oo-x-x-x\":-9007199254740991,\"-oo-x-x--\":9007199254740991,\"-o-oxoxxx\":9007199254740991,\"-o-oxoxx-\":9007199254740991,\"-o-ox-xxo\":9007199254740991,\"-o-ox-xx-\":9007199254740991,\"-o-oxox-x\":9007199254740991,\"-o-ox-xox\":9007199254740991,\"-o-ox-x-x\":9007199254740991,\"-o-ox-x--\":9007199254740991,\"-o--xoxxo\":9007199254740991,\"-o--xoxx-\":9007199254740991,\"-o--xoxox\":9007199254740991,\"-o--xox-x\":9007199254740991,\"-o--xox--\":9007199254740991,\"-o--x-xox\":9007199254740991,\"-o--x-xo-\":9007199254740991,\"-o--x-xxo\":-9007199254740991,\"-o--x-x-o\":9007199254740991,\"-o--x-x--\":9007199254740991,\"-ooox--xx\":9007199254740991,\"-oo-xo-xx\":9007199254740991,\"-oo-x-oxx\":9007199254740991,\"-oo-x--xx\":-9007199254740991,\"-oo-x--x-\":0,\"-o-oxo-xx\":9007199254740991,\"-o-ox-oxx\":9007199254740991,\"-o-ox--xx\":9007199254740991,\"-o-ox--x-\":9007199254740991,\"-o--xooxx\":9007199254740991,\"-o--xo-xx\":9007199254740991,\"-o--xo-x-\":9007199254740991,\"-o--x-oxx\":-9007199254740991,\"-o--x-ox-\":0,\"-o--x--xo\":0,\"-o--x--x-\":0,\"-oo-x---x\":9007199254740991,\"-o-ox---x\":9007199254740991,\"-o--xo--x\":9007199254740991,\"-o--x-o-x\":9007199254740991,\"-o--x--ox\":9007199254740991,\"-o--x---x\":9007199254740991,\"-o--x----\":9007199254740991,\"--ooxxxox\":0,\"--ooxxxo-\":0,\"--ooxxxxo\":0,\"--ooxxx-o\":0,\"--ooxxx--\":0,\"--ooxxoxx\":-9007199254740991,\"--ooxxox-\":9007199254740991,\"--ooxx-xo\":9007199254740991,\"--ooxx-x-\":0,\"--ooxxo-x\":9007199254740991,\"--ooxx-ox\":9007199254740991,\"--ooxx--x\":-9007199254740991,\"--ooxx---\":0,\"--o-xxoxo\":9007199254740991,\"--o-xxox-\":9007199254740991,\"--o-xxoox\":9007199254740991,\"--o-xxo-x\":9007199254740991,\"--o-xxo--\":9007199254740991,\"--o-xxxoo\":9007199254740991,\"--o-xxxo-\":0,\"--o-xx-ox\":9007199254740991,\"--o-xx-o-\":9007199254740991,\"--o-xxx-o\":0,\"--o-xx-xo\":9007199254740991,\"--o-xx--o\":9007199254740991,\"--o-xx---\":0,\"--ooxoxxx\":9007199254740991,\"--ooxoxx-\":9007199254740991,\"--oox-xxo\":9007199254740991,\"--oox-xx-\":9007199254740991,\"--ooxox-x\":9007199254740991,\"--oox-xox\":9007199254740991,\"--oox-x-x\":9007199254740991,\"--oox-x--\":9007199254740991,\"--o-xoxxo\":-9007199254740991,\"--o-xoxx-\":-9007199254740991,\"--o-xoxox\":9007199254740991,\"--o-xox-x\":9007199254740991,\"--o-xox--\":9007199254740991,\"--o-x-xox\":0,\"--o-x-xo-\":9007199254740991,\"--o-x-xxo\":-9007199254740991,\"--o-x-x-o\":0,\"--o-x-x--\":0,\"--ooxo-xx\":9007199254740991,\"--oox-oxx\":9007199254740991,\"--oox--xx\":9007199254740991,\"--oox--x-\":9007199254740991,\"--o-xooxx\":9007199254740991,\"--o-xo-xx\":9007199254740991,\"--o-xo-x-\":9007199254740991,\"--o-x-oxx\":9007199254740991,\"--o-x-ox-\":9007199254740991,\"--o-x--xo\":9007199254740991,\"--o-x--x-\":0,\"--oox---x\":9007199254740991,\"--o-xo--x\":9007199254740991,\"--o-x-o-x\":9007199254740991,\"--o-x--ox\":9007199254740991,\"--o-x---x\":0,\"--o-x----\":0,\"---oxxoxo\":9007199254740991,\"---oxxox-\":-9007199254740991,\"---oxxoox\":9007199254740991,\"---oxxo-x\":-9007199254740991,\"---oxxo--\":0,\"---oxxxoo\":9007199254740991,\"---oxxxo-\":0,\"---oxx-ox\":9007199254740991,\"---oxx-o-\":9007199254740991,\"---oxxx-o\":0,\"---oxx-xo\":0,\"---oxx--o\":0,\"---oxx---\":0,\"---oxoxxo\":9007199254740991,\"---oxoxx-\":9007199254740991,\"---oxoxox\":9007199254740991,\"---oxox-x\":9007199254740991,\"---oxox--\":9007199254740991,\"---ox-xox\":9007199254740991,\"---ox-xo-\":9007199254740991,\"---ox-xxo\":9007199254740991,\"---ox-x-o\":9007199254740991,\"---ox-x--\":9007199254740991,\"---oxooxx\":9007199254740991,\"---oxo-xx\":9007199254740991,\"---oxo-x-\":9007199254740991,\"---ox-oxx\":-9007199254740991,\"---ox-ox-\":9007199254740991,\"---ox--xo\":9007199254740991,\"---ox--x-\":9007199254740991,\"---oxo--x\":9007199254740991,\"---ox-o-x\":9007199254740991,\"---ox--ox\":9007199254740991,\"---ox---x\":9007199254740991,\"---ox----\":9007199254740991,\"----xoxox\":9007199254740991,\"----xoxo-\":9007199254740991,\"----xoxxo\":-9007199254740991,\"----xox-o\":9007199254740991,\"----xox--\":9007199254740991,\"----xooxx\":9007199254740991,\"----xoox-\":9007199254740991,\"----xo-xo\":9007199254740991,\"----xo-x-\":9007199254740991,\"----xoo-x\":9007199254740991,\"----xo-ox\":9007199254740991,\"----xo--x\":9007199254740991,\"----xo---\":9007199254740991,\"----xxoox\":9007199254740991,\"----xxoo-\":9007199254740991,\"----xxoxo\":9007199254740991,\"----xxo-o\":9007199254740991,\"----xxo--\":0,\"----x-oxo\":9007199254740991,\"----x-ox-\":0,\"----x-oox\":9007199254740991,\"----x-o-x\":0,\"----x-o--\":0,\"----xxxoo\":9007199254740991,\"----xx-oo\":9007199254740991,\"----xx-o-\":9007199254740991,\"----x-xoo\":9007199254740991,\"----x-xo-\":9007199254740991,\"----x--ox\":9007199254740991,\"----x--o-\":9007199254740991,\"----xx--o\":0,\"----x-x-o\":0,\"----x--xo\":0,\"----x---o\":0,\"----x----\":0,\"ooo--xxx-\":-9007199254740991,\"oo-o-xxxx\":9007199254740991,\"oo-o-xxx-\":9007199254740991,\"oo--oxxxx\":9007199254740991,\"oo--oxxx-\":9007199254740991,\"oo---xxxo\":-9007199254740991,\"oo---xxx-\":-9007199254740991,\"ooo--xx-x\":-9007199254740991,\"oo-o-xx-x\":9007199254740991,\"oo--oxx-x\":9007199254740991,\"oo---xxox\":9007199254740991,\"oo---xx-x\":-9007199254740991,\"oo---xx--\":9007199254740991,\"o-oo-xxxx\":9007199254740991,\"o-oo-xxx-\":9007199254740991,\"o-o-oxxxx\":9007199254740991,\"o-o-oxxx-\":9007199254740991,\"o-o--xxxo\":-9007199254740991,\"o-o--xxx-\":-9007199254740991,\"o-oo-xx-x\":9007199254740991,\"o-o-oxx-x\":9007199254740991,\"o-o--xxox\":0,\"o-o--xx-x\":-9007199254740991,\"o-o--xx--\":0,\"o--ooxxxx\":9007199254740991,\"o--ooxxx-\":9007199254740991,\"o--o-xxxo\":9007199254740991,\"o--o-xxx-\":9007199254740991,\"o--ooxx-x\":9007199254740991,\"o--o-xxox\":9007199254740991,\"o--o-xx-x\":9007199254740991,\"o--o-xx--\":9007199254740991,\"o---oxxxo\":-9007199254740991,\"o---oxxx-\":-9007199254740991,\"o---oxxox\":9007199254740991,\"o---oxx-x\":9007199254740991,\"o---oxx--\":9007199254740991,\"o----xxox\":0,\"o----xxo-\":9007199254740991,\"o----xxxo\":-9007199254740991,\"o----xx-o\":9007199254740991,\"o----xx--\":0,\"ooo--x-xx\":-9007199254740991,\"oo-o-x-xx\":9007199254740991,\"oo--ox-xx\":9007199254740991,\"oo---xoxx\":9007199254740991,\"oo---x-xx\":-9007199254740991,\"oo---x-x-\":9007199254740991,\"o-oo-x-xx\":9007199254740991,\"o-o-ox-xx\":9007199254740991,\"o-o--xoxx\":-9007199254740991,\"o-o--x-xx\":-9007199254740991,\"o-o--x-x-\":-9007199254740991,\"o--oox-xx\":9007199254740991,\"o--o-xoxx\":-9007199254740991,\"o--o-x-xx\":-9007199254740991,\"o--o-x-x-\":9007199254740991,\"o---oxoxx\":9007199254740991,\"o---ox-xx\":9007199254740991,\"o---ox-x-\":9007199254740991,\"o----xoxx\":-9007199254740991,\"o----xox-\":-9007199254740991,\"o----x-xo\":9007199254740991,\"o----x-x-\":-9007199254740991,\"oo---x--x\":9007199254740991,\"o-o--x--x\":-9007199254740991,\"o--o-x--x\":9007199254740991,\"o---ox--x\":9007199254740991,\"o----xo-x\":9007199254740991,\"o----x-ox\":9007199254740991,\"o----x--x\":-9007199254740991,\"o----x---\":9007199254740991,\"-ooo-xxxx\":9007199254740991,\"-ooo-xxx-\":9007199254740991,\"-oo-oxxxx\":9007199254740991,\"-oo-oxxx-\":9007199254740991,\"-oo--xxxo\":0,\"-oo--xxx-\":-9007199254740991,\"-ooo-xx-x\":9007199254740991,\"-oo-oxx-x\":9007199254740991,\"-oo--xxox\":-9007199254740991,\"-oo--xx-x\":-9007199254740991,\"-oo--xx--\":9007199254740991,\"-o-ooxxxx\":9007199254740991,\"-o-ooxxx-\":9007199254740991,\"-o-o-xxxo\":0,\"-o-o-xxx-\":0,\"-o-ooxx-x\":9007199254740991,\"-o-o-xxox\":9007199254740991,\"-o-o-xx-x\":9007199254740991,\"-o-o-xx--\":9007199254740991,\"-o--oxxxo\":0,\"-o--oxxx-\":0,\"-o--oxxox\":-9007199254740991,\"-o--oxx-x\":-9007199254740991,\"-o--oxx--\":0,\"-o---xxox\":-9007199254740991,\"-o---xxo-\":9007199254740991,\"-o---xxxo\":-9007199254740991,\"-o---xx-o\":9007199254740991,\"-o---xx--\":0,\"-ooo-x-xx\":9007199254740991,\"-oo-ox-xx\":9007199254740991,\"-oo--xoxx\":-9007199254740991,\"-oo--x-xx\":-9007199254740991,\"-oo--x-x-\":9007199254740991,\"-o-oox-xx\":9007199254740991,\"-o-o-xoxx\":9007199254740991,\"-o-o-x-xx\":9007199254740991,\"-o-o-x-x-\":9007199254740991,\"-o--oxoxx\":9007199254740991,\"-o--ox-xx\":9007199254740991,\"-o--ox-x-\":9007199254740991,\"-o---xoxx\":-9007199254740991,\"-o---xox-\":0,\"-o---x-xo\":0,\"-o---x-x-\":0,\"-oo--x--x\":-9007199254740991,\"-o-o-x--x\":9007199254740991,\"-o--ox--x\":9007199254740991,\"-o---xo-x\":9007199254740991,\"-o---x-ox\":9007199254740991,\"-o---x--x\":-9007199254740991,\"-o---x---\":9007199254740991,\"--oooxxxx\":9007199254740991,\"--oooxxx-\":9007199254740991,\"--oo-xxxo\":0,\"--oo-xxx-\":0,\"--oooxx-x\":9007199254740991,\"--oo-xxox\":0,\"--oo-xx-x\":0,\"--oo-xx--\":0,\"--o-oxxxo\":0,\"--o-oxxx-\":0,\"--o-oxxox\":0,\"--o-oxx-x\":0,\"--o-oxx--\":0,\"--o--xxox\":-9007199254740991,\"--o--xxo-\":9007199254740991,\"--o--xxxo\":-9007199254740991,\"--o--xx-o\":9007199254740991,\"--o--xx--\":0,\"--ooox-xx\":9007199254740991,\"--oo-xoxx\":-9007199254740991,\"--oo-x-xx\":-9007199254740991,\"--oo-x-x-\":0,\"--o-oxoxx\":-9007199254740991,\"--o-ox-xx\":-9007199254740991,\"--o-ox-x-\":0,\"--o--xoxx\":-9007199254740991,\"--o--xox-\":9007199254740991,\"--o--x-xo\":9007199254740991,\"--o--x-x-\":-9007199254740991,\"--oo-x--x\":0,\"--o-ox--x\":0,\"--o--xo-x\":9007199254740991,\"--o--x-ox\":9007199254740991,\"--o--x--x\":-9007199254740991,\"--o--x---\":0,\"---ooxxxo\":0,\"---ooxxx-\":0,\"---ooxxox\":9007199254740991,\"---ooxx-x\":9007199254740991,\"---ooxx--\":9007199254740991,\"---o-xxox\":0,\"---o-xxo-\":9007199254740991,\"---o-xxxo\":0,\"---o-xx-o\":0,\"---o-xx--\":0,\"---ooxoxx\":9007199254740991,\"---oox-xx\":9007199254740991,\"---oox-x-\":9007199254740991,\"---o-xoxx\":-9007199254740991,\"---o-xox-\":9007199254740991,\"---o-x-xo\":0,\"---o-x-x-\":0,\"---oox--x\":9007199254740991,\"---o-xo-x\":9007199254740991,\"---o-x-ox\":9007199254740991,\"---o-x--x\":0,\"---o-x---\":0,\"----oxxox\":-9007199254740991,\"----oxxo-\":0,\"----oxxxo\":-9007199254740991,\"----oxx-o\":0,\"----oxx--\":0,\"----oxoxx\":-9007199254740991,\"----oxox-\":0,\"----ox-xo\":0,\"----ox-x-\":0,\"----oxo-x\":9007199254740991,\"----ox-ox\":9007199254740991,\"----ox--x\":0,\"----ox---\":0,\"-----xoxo\":9007199254740991,\"-----xox-\":-9007199254740991,\"-----xoox\":9007199254740991,\"-----xo-x\":9007199254740991,\"-----xo--\":9007199254740991,\"-----xxoo\":9007199254740991,\"-----xxo-\":0,\"-----x-ox\":9007199254740991,\"-----x-o-\":9007199254740991,\"-----xx-o\":0,\"-----x-xo\":0,\"-----x--o\":0,\"-----x---\":0,\"oo----xxx\":9007199254740991,\"oo----xx-\":9007199254740991,\"o-o---xxx\":9007199254740991,\"o-o---xx-\":9007199254740991,\"o--o--xxx\":9007199254740991,\"o--o--xx-\":9007199254740991,\"o---o-xxx\":9007199254740991,\"o---o-xx-\":9007199254740991,\"o----oxxx\":9007199254740991,\"o----oxx-\":9007199254740991,\"o-----xxo\":9007199254740991,\"o-----xx-\":9007199254740991,\"oo----x-x\":9007199254740991,\"o-o---x-x\":9007199254740991,\"o--o--x-x\":9007199254740991,\"o---o-x-x\":9007199254740991,\"o----ox-x\":9007199254740991,\"o-----xox\":9007199254740991,\"o-----x-x\":9007199254740991,\"o-----x--\":9007199254740991,\"-oo---xxx\":9007199254740991,\"-oo---xx-\":9007199254740991,\"-o-o--xxx\":9007199254740991,\"-o-o--xx-\":9007199254740991,\"-o--o-xxx\":9007199254740991,\"-o--o-xx-\":9007199254740991,\"-o---oxxx\":9007199254740991,\"-o---oxx-\":9007199254740991,\"-o----xxo\":0,\"-o----xx-\":0,\"-oo---x-x\":9007199254740991,\"-o-o--x-x\":9007199254740991,\"-o--o-x-x\":9007199254740991,\"-o---ox-x\":9007199254740991,\"-o----xox\":9007199254740991,\"-o----x-x\":9007199254740991,\"-o----x--\":9007199254740991,\"--oo--xxx\":9007199254740991,\"--oo--xx-\":9007199254740991,\"--o-o-xxx\":9007199254740991,\"--o-o-xx-\":9007199254740991,\"--o--oxxx\":9007199254740991,\"--o--oxx-\":9007199254740991,\"--o---xxo\":-9007199254740991,\"--o---xx-\":-9007199254740991,\"--oo--x-x\":9007199254740991,\"--o-o-x-x\":9007199254740991,\"--o--ox-x\":9007199254740991,\"--o---xox\":9007199254740991,\"--o---x-x\":9007199254740991,\"--o---x--\":9007199254740991,\"---oo-xxx\":9007199254740991,\"---oo-xx-\":9007199254740991,\"---o-oxxx\":9007199254740991,\"---o-oxx-\":9007199254740991,\"---o--xxo\":9007199254740991,\"---o--xx-\":9007199254740991,\"---oo-x-x\":9007199254740991,\"---o-ox-x\":9007199254740991,\"---o--xox\":9007199254740991,\"---o--x-x\":9007199254740991,\"---o--x--\":9007199254740991,\"----ooxxx\":9007199254740991,\"----ooxx-\":9007199254740991,\"----o-xxo\":0,\"----o-xx-\":0,\"----oox-x\":9007199254740991,\"----o-xox\":0,\"----o-x-x\":0,\"----o-x--\":0,\"-----oxxo\":-9007199254740991,\"-----oxx-\":-9007199254740991,\"-----oxox\":9007199254740991,\"-----ox-x\":9007199254740991,\"-----ox--\":9007199254740991,\"------xox\":0,\"------xo-\":9007199254740991,\"------xxo\":-9007199254740991,\"------x-o\":9007199254740991,\"------x--\":0,\"oo-----xx\":9007199254740991,\"o-o----xx\":9007199254740991,\"o--o---xx\":9007199254740991,\"o---o--xx\":9007199254740991,\"o----o-xx\":9007199254740991,\"o-----oxx\":-9007199254740991,\"o------xx\":-9007199254740991,\"o------x-\":9007199254740991,\"-oo----xx\":9007199254740991,\"-o-o---xx\":9007199254740991,\"-o--o--xx\":9007199254740991,\"-o---o-xx\":9007199254740991,\"-o----oxx\":0,\"-o-----xx\":0,\"-o-----x-\":0,\"--oo---xx\":9007199254740991,\"--o-o--xx\":9007199254740991,\"--o--o-xx\":9007199254740991,\"--o---oxx\":9007199254740991,\"--o----xx\":9007199254740991,\"--o----x-\":9007199254740991,\"---oo--xx\":9007199254740991,\"---o-o-xx\":9007199254740991,\"---o--oxx\":-9007199254740991,\"---o---xx\":-9007199254740991,\"---o---x-\":9007199254740991,\"----oo-xx\":9007199254740991,\"----o-oxx\":0,\"----o--xx\":0,\"----o--x-\":0,\"-----ooxx\":9007199254740991,\"-----o-xx\":9007199254740991,\"-----o-x-\":9007199254740991,\"------oxx\":-9007199254740991,\"------ox-\":0,\"-------xo\":0,\"-------x-\":0,\"o-------x\":9007199254740991,\"-o------x\":9007199254740991,\"--o-----x\":9007199254740991,\"---o----x\":9007199254740991,\"----o---x\":0,\"-----o--x\":9007199254740991,\"------o-x\":9007199254740991,\"-------ox\":9007199254740991,\"--------x\":0,\"---------\":0}")

},{}],5:[function(require,module,exports){
var getNextPlayer = function(previousPlayer) {
  // if previous player is 'x', next player is 'o'.
  // otherwise (null or 'o'), next player is 'x'.
  return previousPlayer == 'x' ? 'o' : 'x';
};


module.exports = getNextPlayer;

},{}],6:[function(require,module,exports){
(function (global){
/**
 * React v0.13.3
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.React = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule React
 */

/* globals __REACT_DEVTOOLS_GLOBAL_HOOK__*/

'use strict';

var EventPluginUtils = _dereq_(19);
var ReactChildren = _dereq_(32);
var ReactComponent = _dereq_(34);
var ReactClass = _dereq_(33);
var ReactContext = _dereq_(38);
var ReactCurrentOwner = _dereq_(39);
var ReactElement = _dereq_(57);
var ReactElementValidator = _dereq_(58);
var ReactDOM = _dereq_(40);
var ReactDOMTextComponent = _dereq_(51);
var ReactDefaultInjection = _dereq_(54);
var ReactInstanceHandles = _dereq_(66);
var ReactMount = _dereq_(70);
var ReactPerf = _dereq_(75);
var ReactPropTypes = _dereq_(78);
var ReactReconciler = _dereq_(81);
var ReactServerRendering = _dereq_(84);

var assign = _dereq_(27);
var findDOMNode = _dereq_(117);
var onlyChild = _dereq_(144);

ReactDefaultInjection.inject();

var createElement = ReactElement.createElement;
var createFactory = ReactElement.createFactory;
var cloneElement = ReactElement.cloneElement;

if ("production" !== "development") {
  createElement = ReactElementValidator.createElement;
  createFactory = ReactElementValidator.createFactory;
  cloneElement = ReactElementValidator.cloneElement;
}

var render = ReactPerf.measure('React', 'render', ReactMount.render);

var React = {
  Children: {
    map: ReactChildren.map,
    forEach: ReactChildren.forEach,
    count: ReactChildren.count,
    only: onlyChild
  },
  Component: ReactComponent,
  DOM: ReactDOM,
  PropTypes: ReactPropTypes,
  initializeTouchEvents: function(shouldUseTouch) {
    EventPluginUtils.useTouchEvents = shouldUseTouch;
  },
  createClass: ReactClass.createClass,
  createElement: createElement,
  cloneElement: cloneElement,
  createFactory: createFactory,
  createMixin: function(mixin) {
    // Currently a noop. Will be used to validate and trace mixins.
    return mixin;
  },
  constructAndRenderComponent: ReactMount.constructAndRenderComponent,
  constructAndRenderComponentByID: ReactMount.constructAndRenderComponentByID,
  findDOMNode: findDOMNode,
  render: render,
  renderToString: ReactServerRendering.renderToString,
  renderToStaticMarkup: ReactServerRendering.renderToStaticMarkup,
  unmountComponentAtNode: ReactMount.unmountComponentAtNode,
  isValidElement: ReactElement.isValidElement,
  withContext: ReactContext.withContext,

  // Hook for JSX spread, don't use this for anything else.
  __spread: assign
};

// Inject the runtime into a devtools global hook regardless of browser.
// Allows for debugging when the hook is injected on the page.
if (
  typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' &&
  typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.inject === 'function') {
  __REACT_DEVTOOLS_GLOBAL_HOOK__.inject({
    CurrentOwner: ReactCurrentOwner,
    InstanceHandles: ReactInstanceHandles,
    Mount: ReactMount,
    Reconciler: ReactReconciler,
    TextComponent: ReactDOMTextComponent
  });
}

if ("production" !== "development") {
  var ExecutionEnvironment = _dereq_(21);
  if (ExecutionEnvironment.canUseDOM && window.top === window.self) {

    // If we're in Chrome, look for the devtools marker and provide a download
    // link if not installed.
    if (navigator.userAgent.indexOf('Chrome') > -1) {
      if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
        console.debug(
          'Download the React DevTools for a better development experience: ' +
          'https://fb.me/react-devtools'
        );
      }
    }

    var expectedFeatures = [
      // shims
      Array.isArray,
      Array.prototype.every,
      Array.prototype.forEach,
      Array.prototype.indexOf,
      Array.prototype.map,
      Date.now,
      Function.prototype.bind,
      Object.keys,
      String.prototype.split,
      String.prototype.trim,

      // shams
      Object.create,
      Object.freeze
    ];

    for (var i = 0; i < expectedFeatures.length; i++) {
      if (!expectedFeatures[i]) {
        console.error(
          'One or more ES5 shim/shams expected by React are not available: ' +
          'https://fb.me/react-warning-polyfills'
        );
        break;
      }
    }
  }
}

React.version = '0.13.3';

module.exports = React;

},{"117":117,"144":144,"19":19,"21":21,"27":27,"32":32,"33":33,"34":34,"38":38,"39":39,"40":40,"51":51,"54":54,"57":57,"58":58,"66":66,"70":70,"75":75,"78":78,"81":81,"84":84}],2:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule AutoFocusMixin
 * @typechecks static-only
 */

'use strict';

var focusNode = _dereq_(119);

var AutoFocusMixin = {
  componentDidMount: function() {
    if (this.props.autoFocus) {
      focusNode(this.getDOMNode());
    }
  }
};

module.exports = AutoFocusMixin;

},{"119":119}],3:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015 Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule BeforeInputEventPlugin
 * @typechecks static-only
 */

'use strict';

var EventConstants = _dereq_(15);
var EventPropagators = _dereq_(20);
var ExecutionEnvironment = _dereq_(21);
var FallbackCompositionState = _dereq_(22);
var SyntheticCompositionEvent = _dereq_(93);
var SyntheticInputEvent = _dereq_(97);

var keyOf = _dereq_(141);

var END_KEYCODES = [9, 13, 27, 32]; // Tab, Return, Esc, Space
var START_KEYCODE = 229;

var canUseCompositionEvent = (
  ExecutionEnvironment.canUseDOM &&
  'CompositionEvent' in window
);

var documentMode = null;
if (ExecutionEnvironment.canUseDOM && 'documentMode' in document) {
  documentMode = document.documentMode;
}

// Webkit offers a very useful `textInput` event that can be used to
// directly represent `beforeInput`. The IE `textinput` event is not as
// useful, so we don't use it.
var canUseTextInputEvent = (
  ExecutionEnvironment.canUseDOM &&
  'TextEvent' in window &&
  !documentMode &&
  !isPresto()
);

// In IE9+, we have access to composition events, but the data supplied
// by the native compositionend event may be incorrect. Japanese ideographic
// spaces, for instance (\u3000) are not recorded correctly.
var useFallbackCompositionData = (
  ExecutionEnvironment.canUseDOM &&
  (
    (!canUseCompositionEvent || documentMode && documentMode > 8 && documentMode <= 11)
  )
);

/**
 * Opera <= 12 includes TextEvent in window, but does not fire
 * text input events. Rely on keypress instead.
 */
function isPresto() {
  var opera = window.opera;
  return (
    typeof opera === 'object' &&
    typeof opera.version === 'function' &&
    parseInt(opera.version(), 10) <= 12
  );
}

var SPACEBAR_CODE = 32;
var SPACEBAR_CHAR = String.fromCharCode(SPACEBAR_CODE);

var topLevelTypes = EventConstants.topLevelTypes;

// Events and their corresponding property names.
var eventTypes = {
  beforeInput: {
    phasedRegistrationNames: {
      bubbled: keyOf({onBeforeInput: null}),
      captured: keyOf({onBeforeInputCapture: null})
    },
    dependencies: [
      topLevelTypes.topCompositionEnd,
      topLevelTypes.topKeyPress,
      topLevelTypes.topTextInput,
      topLevelTypes.topPaste
    ]
  },
  compositionEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionEnd: null}),
      captured: keyOf({onCompositionEndCapture: null})
    },
    dependencies: [
      topLevelTypes.topBlur,
      topLevelTypes.topCompositionEnd,
      topLevelTypes.topKeyDown,
      topLevelTypes.topKeyPress,
      topLevelTypes.topKeyUp,
      topLevelTypes.topMouseDown
    ]
  },
  compositionStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionStart: null}),
      captured: keyOf({onCompositionStartCapture: null})
    },
    dependencies: [
      topLevelTypes.topBlur,
      topLevelTypes.topCompositionStart,
      topLevelTypes.topKeyDown,
      topLevelTypes.topKeyPress,
      topLevelTypes.topKeyUp,
      topLevelTypes.topMouseDown
    ]
  },
  compositionUpdate: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionUpdate: null}),
      captured: keyOf({onCompositionUpdateCapture: null})
    },
    dependencies: [
      topLevelTypes.topBlur,
      topLevelTypes.topCompositionUpdate,
      topLevelTypes.topKeyDown,
      topLevelTypes.topKeyPress,
      topLevelTypes.topKeyUp,
      topLevelTypes.topMouseDown
    ]
  }
};

// Track whether we've ever handled a keypress on the space key.
var hasSpaceKeypress = false;

/**
 * Return whether a native keypress event is assumed to be a command.
 * This is required because Firefox fires `keypress` events for key commands
 * (cut, copy, select-all, etc.) even though no character is inserted.
 */
function isKeypressCommand(nativeEvent) {
  return (
    (nativeEvent.ctrlKey || nativeEvent.altKey || nativeEvent.metaKey) &&
    // ctrlKey && altKey is equivalent to AltGr, and is not a command.
    !(nativeEvent.ctrlKey && nativeEvent.altKey)
  );
}


/**
 * Translate native top level events into event types.
 *
 * @param {string} topLevelType
 * @return {object}
 */
function getCompositionEventType(topLevelType) {
  switch (topLevelType) {
    case topLevelTypes.topCompositionStart:
      return eventTypes.compositionStart;
    case topLevelTypes.topCompositionEnd:
      return eventTypes.compositionEnd;
    case topLevelTypes.topCompositionUpdate:
      return eventTypes.compositionUpdate;
  }
}

/**
 * Does our fallback best-guess model think this event signifies that
 * composition has begun?
 *
 * @param {string} topLevelType
 * @param {object} nativeEvent
 * @return {boolean}
 */
function isFallbackCompositionStart(topLevelType, nativeEvent) {
  return (
    topLevelType === topLevelTypes.topKeyDown &&
    nativeEvent.keyCode === START_KEYCODE
  );
}

/**
 * Does our fallback mode think that this event is the end of composition?
 *
 * @param {string} topLevelType
 * @param {object} nativeEvent
 * @return {boolean}
 */
function isFallbackCompositionEnd(topLevelType, nativeEvent) {
  switch (topLevelType) {
    case topLevelTypes.topKeyUp:
      // Command keys insert or clear IME input.
      return (END_KEYCODES.indexOf(nativeEvent.keyCode) !== -1);
    case topLevelTypes.topKeyDown:
      // Expect IME keyCode on each keydown. If we get any other
      // code we must have exited earlier.
      return (nativeEvent.keyCode !== START_KEYCODE);
    case topLevelTypes.topKeyPress:
    case topLevelTypes.topMouseDown:
    case topLevelTypes.topBlur:
      // Events are not possible without cancelling IME.
      return true;
    default:
      return false;
  }
}

/**
 * Google Input Tools provides composition data via a CustomEvent,
 * with the `data` property populated in the `detail` object. If this
 * is available on the event object, use it. If not, this is a plain
 * composition event and we have nothing special to extract.
 *
 * @param {object} nativeEvent
 * @return {?string}
 */
function getDataFromCustomEvent(nativeEvent) {
  var detail = nativeEvent.detail;
  if (typeof detail === 'object' && 'data' in detail) {
    return detail.data;
  }
  return null;
}

// Track the current IME composition fallback object, if any.
var currentComposition = null;

/**
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {DOMEventTarget} topLevelTarget The listening component root node.
 * @param {string} topLevelTargetID ID of `topLevelTarget`.
 * @param {object} nativeEvent Native browser event.
 * @return {?object} A SyntheticCompositionEvent.
 */
function extractCompositionEvent(
  topLevelType,
  topLevelTarget,
  topLevelTargetID,
  nativeEvent
) {
  var eventType;
  var fallbackData;

  if (canUseCompositionEvent) {
    eventType = getCompositionEventType(topLevelType);
  } else if (!currentComposition) {
    if (isFallbackCompositionStart(topLevelType, nativeEvent)) {
      eventType = eventTypes.compositionStart;
    }
  } else if (isFallbackCompositionEnd(topLevelType, nativeEvent)) {
    eventType = eventTypes.compositionEnd;
  }

  if (!eventType) {
    return null;
  }

  if (useFallbackCompositionData) {
    // The current composition is stored statically and must not be
    // overwritten while composition continues.
    if (!currentComposition && eventType === eventTypes.compositionStart) {
      currentComposition = FallbackCompositionState.getPooled(topLevelTarget);
    } else if (eventType === eventTypes.compositionEnd) {
      if (currentComposition) {
        fallbackData = currentComposition.getData();
      }
    }
  }

  var event = SyntheticCompositionEvent.getPooled(
    eventType,
    topLevelTargetID,
    nativeEvent
  );

  if (fallbackData) {
    // Inject data generated from fallback path into the synthetic event.
    // This matches the property of native CompositionEventInterface.
    event.data = fallbackData;
  } else {
    var customData = getDataFromCustomEvent(nativeEvent);
    if (customData !== null) {
      event.data = customData;
    }
  }

  EventPropagators.accumulateTwoPhaseDispatches(event);
  return event;
}

/**
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {object} nativeEvent Native browser event.
 * @return {?string} The string corresponding to this `beforeInput` event.
 */
function getNativeBeforeInputChars(topLevelType, nativeEvent) {
  switch (topLevelType) {
    case topLevelTypes.topCompositionEnd:
      return getDataFromCustomEvent(nativeEvent);
    case topLevelTypes.topKeyPress:
      /**
       * If native `textInput` events are available, our goal is to make
       * use of them. However, there is a special case: the spacebar key.
       * In Webkit, preventing default on a spacebar `textInput` event
       * cancels character insertion, but it *also* causes the browser
       * to fall back to its default spacebar behavior of scrolling the
       * page.
       *
       * Tracking at:
       * https://code.google.com/p/chromium/issues/detail?id=355103
       *
       * To avoid this issue, use the keypress event as if no `textInput`
       * event is available.
       */
      var which = nativeEvent.which;
      if (which !== SPACEBAR_CODE) {
        return null;
      }

      hasSpaceKeypress = true;
      return SPACEBAR_CHAR;

    case topLevelTypes.topTextInput:
      // Record the characters to be added to the DOM.
      var chars = nativeEvent.data;

      // If it's a spacebar character, assume that we have already handled
      // it at the keypress level and bail immediately. Android Chrome
      // doesn't give us keycodes, so we need to blacklist it.
      if (chars === SPACEBAR_CHAR && hasSpaceKeypress) {
        return null;
      }

      return chars;

    default:
      // For other native event types, do nothing.
      return null;
  }
}

/**
 * For browsers that do not provide the `textInput` event, extract the
 * appropriate string to use for SyntheticInputEvent.
 *
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {object} nativeEvent Native browser event.
 * @return {?string} The fallback string for this `beforeInput` event.
 */
function getFallbackBeforeInputChars(topLevelType, nativeEvent) {
  // If we are currently composing (IME) and using a fallback to do so,
  // try to extract the composed characters from the fallback object.
  if (currentComposition) {
    if (
      topLevelType === topLevelTypes.topCompositionEnd ||
      isFallbackCompositionEnd(topLevelType, nativeEvent)
    ) {
      var chars = currentComposition.getData();
      FallbackCompositionState.release(currentComposition);
      currentComposition = null;
      return chars;
    }
    return null;
  }

  switch (topLevelType) {
    case topLevelTypes.topPaste:
      // If a paste event occurs after a keypress, throw out the input
      // chars. Paste events should not lead to BeforeInput events.
      return null;
    case topLevelTypes.topKeyPress:
      /**
       * As of v27, Firefox may fire keypress events even when no character
       * will be inserted. A few possibilities:
       *
       * - `which` is `0`. Arrow keys, Esc key, etc.
       *
       * - `which` is the pressed key code, but no char is available.
       *   Ex: 'AltGr + d` in Polish. There is no modified character for
       *   this key combination and no character is inserted into the
       *   document, but FF fires the keypress for char code `100` anyway.
       *   No `input` event will occur.
       *
       * - `which` is the pressed key code, but a command combination is
       *   being used. Ex: `Cmd+C`. No character is inserted, and no
       *   `input` event will occur.
       */
      if (nativeEvent.which && !isKeypressCommand(nativeEvent)) {
        return String.fromCharCode(nativeEvent.which);
      }
      return null;
    case topLevelTypes.topCompositionEnd:
      return useFallbackCompositionData ? null : nativeEvent.data;
    default:
      return null;
  }
}

/**
 * Extract a SyntheticInputEvent for `beforeInput`, based on either native
 * `textInput` or fallback behavior.
 *
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {DOMEventTarget} topLevelTarget The listening component root node.
 * @param {string} topLevelTargetID ID of `topLevelTarget`.
 * @param {object} nativeEvent Native browser event.
 * @return {?object} A SyntheticInputEvent.
 */
function extractBeforeInputEvent(
  topLevelType,
  topLevelTarget,
  topLevelTargetID,
  nativeEvent
) {
  var chars;

  if (canUseTextInputEvent) {
    chars = getNativeBeforeInputChars(topLevelType, nativeEvent);
  } else {
    chars = getFallbackBeforeInputChars(topLevelType, nativeEvent);
  }

  // If no characters are being inserted, no BeforeInput event should
  // be fired.
  if (!chars) {
    return null;
  }

  var event = SyntheticInputEvent.getPooled(
    eventTypes.beforeInput,
    topLevelTargetID,
    nativeEvent
  );

  event.data = chars;
  EventPropagators.accumulateTwoPhaseDispatches(event);
  return event;
}

/**
 * Create an `onBeforeInput` event to match
 * http://www.w3.org/TR/2013/WD-DOM-Level-3-Events-20131105/#events-inputevents.
 *
 * This event plugin is based on the native `textInput` event
 * available in Chrome, Safari, Opera, and IE. This event fires after
 * `onKeyPress` and `onCompositionEnd`, but before `onInput`.
 *
 * `beforeInput` is spec'd but not implemented in any browsers, and
 * the `input` event does not provide any useful information about what has
 * actually been added, contrary to the spec. Thus, `textInput` is the best
 * available event to identify the characters that have actually been inserted
 * into the target node.
 *
 * This plugin is also responsible for emitting `composition` events, thus
 * allowing us to share composition fallback code for both `beforeInput` and
 * `composition` event types.
 */
var BeforeInputEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
    topLevelType,
    topLevelTarget,
    topLevelTargetID,
    nativeEvent
  ) {
    return [
      extractCompositionEvent(
        topLevelType,
        topLevelTarget,
        topLevelTargetID,
        nativeEvent
      ),
      extractBeforeInputEvent(
        topLevelType,
        topLevelTarget,
        topLevelTargetID,
        nativeEvent
      )
    ];
  }
};

module.exports = BeforeInputEventPlugin;

},{"141":141,"15":15,"20":20,"21":21,"22":22,"93":93,"97":97}],4:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CSSProperty
 */

'use strict';

/**
 * CSS properties which accept numbers but are not in units of "px".
 */
var isUnitlessNumber = {
  boxFlex: true,
  boxFlexGroup: true,
  columnCount: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  widows: true,
  zIndex: true,
  zoom: true,

  // SVG-related properties
  fillOpacity: true,
  strokeDashoffset: true,
  strokeOpacity: true,
  strokeWidth: true
};

/**
 * @param {string} prefix vendor-specific prefix, eg: Webkit
 * @param {string} key style name, eg: transitionDuration
 * @return {string} style name prefixed with `prefix`, properly camelCased, eg:
 * WebkitTransitionDuration
 */
function prefixKey(prefix, key) {
  return prefix + key.charAt(0).toUpperCase() + key.substring(1);
}

/**
 * Support style names that may come passed in prefixed by adding permutations
 * of vendor prefixes.
 */
var prefixes = ['Webkit', 'ms', 'Moz', 'O'];

// Using Object.keys here, or else the vanilla for-in loop makes IE8 go into an
// infinite loop, because it iterates over the newly added props too.
Object.keys(isUnitlessNumber).forEach(function(prop) {
  prefixes.forEach(function(prefix) {
    isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
  });
});

/**
 * Most style properties can be unset by doing .style[prop] = '' but IE8
 * doesn't like doing that with shorthand properties so for the properties that
 * IE8 breaks on, which are listed here, we instead unset each of the
 * individual properties. See http://bugs.jquery.com/ticket/12385.
 * The 4-value 'clock' properties like margin, padding, border-width seem to
 * behave without any problems. Curiously, list-style works too without any
 * special prodding.
 */
var shorthandPropertyExpansions = {
  background: {
    backgroundImage: true,
    backgroundPosition: true,
    backgroundRepeat: true,
    backgroundColor: true
  },
  border: {
    borderWidth: true,
    borderStyle: true,
    borderColor: true
  },
  borderBottom: {
    borderBottomWidth: true,
    borderBottomStyle: true,
    borderBottomColor: true
  },
  borderLeft: {
    borderLeftWidth: true,
    borderLeftStyle: true,
    borderLeftColor: true
  },
  borderRight: {
    borderRightWidth: true,
    borderRightStyle: true,
    borderRightColor: true
  },
  borderTop: {
    borderTopWidth: true,
    borderTopStyle: true,
    borderTopColor: true
  },
  font: {
    fontStyle: true,
    fontVariant: true,
    fontWeight: true,
    fontSize: true,
    lineHeight: true,
    fontFamily: true
  }
};

var CSSProperty = {
  isUnitlessNumber: isUnitlessNumber,
  shorthandPropertyExpansions: shorthandPropertyExpansions
};

module.exports = CSSProperty;

},{}],5:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CSSPropertyOperations
 * @typechecks static-only
 */

'use strict';

var CSSProperty = _dereq_(4);
var ExecutionEnvironment = _dereq_(21);

var camelizeStyleName = _dereq_(108);
var dangerousStyleValue = _dereq_(113);
var hyphenateStyleName = _dereq_(133);
var memoizeStringOnly = _dereq_(143);
var warning = _dereq_(154);

var processStyleName = memoizeStringOnly(function(styleName) {
  return hyphenateStyleName(styleName);
});

var styleFloatAccessor = 'cssFloat';
if (ExecutionEnvironment.canUseDOM) {
  // IE8 only supports accessing cssFloat (standard) as styleFloat
  if (document.documentElement.style.cssFloat === undefined) {
    styleFloatAccessor = 'styleFloat';
  }
}

if ("production" !== "development") {
  // 'msTransform' is correct, but the other prefixes should be capitalized
  var badVendoredStyleNamePattern = /^(?:webkit|moz|o)[A-Z]/;

  // style values shouldn't contain a semicolon
  var badStyleValueWithSemicolonPattern = /;\s*$/;

  var warnedStyleNames = {};
  var warnedStyleValues = {};

  var warnHyphenatedStyleName = function(name) {
    if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
      return;
    }

    warnedStyleNames[name] = true;
    ("production" !== "development" ? warning(
      false,
      'Unsupported style property %s. Did you mean %s?',
      name,
      camelizeStyleName(name)
    ) : null);
  };

  var warnBadVendoredStyleName = function(name) {
    if (warnedStyleNames.hasOwnProperty(name) && warnedStyleNames[name]) {
      return;
    }

    warnedStyleNames[name] = true;
    ("production" !== "development" ? warning(
      false,
      'Unsupported vendor-prefixed style property %s. Did you mean %s?',
      name,
      name.charAt(0).toUpperCase() + name.slice(1)
    ) : null);
  };

  var warnStyleValueWithSemicolon = function(name, value) {
    if (warnedStyleValues.hasOwnProperty(value) && warnedStyleValues[value]) {
      return;
    }

    warnedStyleValues[value] = true;
    ("production" !== "development" ? warning(
      false,
      'Style property values shouldn\'t contain a semicolon. ' +
      'Try "%s: %s" instead.',
      name,
      value.replace(badStyleValueWithSemicolonPattern, '')
    ) : null);
  };

  /**
   * @param {string} name
   * @param {*} value
   */
  var warnValidStyle = function(name, value) {
    if (name.indexOf('-') > -1) {
      warnHyphenatedStyleName(name);
    } else if (badVendoredStyleNamePattern.test(name)) {
      warnBadVendoredStyleName(name);
    } else if (badStyleValueWithSemicolonPattern.test(value)) {
      warnStyleValueWithSemicolon(name, value);
    }
  };
}

/**
 * Operations for dealing with CSS properties.
 */
var CSSPropertyOperations = {

  /**
   * Serializes a mapping of style properties for use as inline styles:
   *
   *   > createMarkupForStyles({width: '200px', height: 0})
   *   "width:200px;height:0;"
   *
   * Undefined values are ignored so that declarative programming is easier.
   * The result should be HTML-escaped before insertion into the DOM.
   *
   * @param {object} styles
   * @return {?string}
   */
  createMarkupForStyles: function(styles) {
    var serialized = '';
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      var styleValue = styles[styleName];
      if ("production" !== "development") {
        warnValidStyle(styleName, styleValue);
      }
      if (styleValue != null) {
        serialized += processStyleName(styleName) + ':';
        serialized += dangerousStyleValue(styleName, styleValue) + ';';
      }
    }
    return serialized || null;
  },

  /**
   * Sets the value for multiple styles on a node.  If a value is specified as
   * '' (empty string), the corresponding style property will be unset.
   *
   * @param {DOMElement} node
   * @param {object} styles
   */
  setValueForStyles: function(node, styles) {
    var style = node.style;
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      if ("production" !== "development") {
        warnValidStyle(styleName, styles[styleName]);
      }
      var styleValue = dangerousStyleValue(styleName, styles[styleName]);
      if (styleName === 'float') {
        styleName = styleFloatAccessor;
      }
      if (styleValue) {
        style[styleName] = styleValue;
      } else {
        var expansion = CSSProperty.shorthandPropertyExpansions[styleName];
        if (expansion) {
          // Shorthand property that IE8 won't like unsetting, so unset each
          // component to placate it
          for (var individualStyleName in expansion) {
            style[individualStyleName] = '';
          }
        } else {
          style[styleName] = '';
        }
      }
    }
  }

};

module.exports = CSSPropertyOperations;

},{"108":108,"113":113,"133":133,"143":143,"154":154,"21":21,"4":4}],6:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule CallbackQueue
 */

'use strict';

var PooledClass = _dereq_(28);

var assign = _dereq_(27);
var invariant = _dereq_(135);

/**
 * A specialized pseudo-event module to help keep track of components waiting to
 * be notified when their DOM representations are available for use.
 *
 * This implements `PooledClass`, so you should never need to instantiate this.
 * Instead, use `CallbackQueue.getPooled()`.
 *
 * @class ReactMountReady
 * @implements PooledClass
 * @internal
 */
function CallbackQueue() {
  this._callbacks = null;
  this._contexts = null;
}

assign(CallbackQueue.prototype, {

  /**
   * Enqueues a callback to be invoked when `notifyAll` is invoked.
   *
   * @param {function} callback Invoked when `notifyAll` is invoked.
   * @param {?object} context Context to call `callback` with.
   * @internal
   */
  enqueue: function(callback, context) {
    this._callbacks = this._callbacks || [];
    this._contexts = this._contexts || [];
    this._callbacks.push(callback);
    this._contexts.push(context);
  },

  /**
   * Invokes all enqueued callbacks and clears the queue. This is invoked after
   * the DOM representation of a component has been created or updated.
   *
   * @internal
   */
  notifyAll: function() {
    var callbacks = this._callbacks;
    var contexts = this._contexts;
    if (callbacks) {
      ("production" !== "development" ? invariant(
        callbacks.length === contexts.length,
        'Mismatched list of contexts in callback queue'
      ) : invariant(callbacks.length === contexts.length));
      this._callbacks = null;
      this._contexts = null;
      for (var i = 0, l = callbacks.length; i < l; i++) {
        callbacks[i].call(contexts[i]);
      }
      callbacks.length = 0;
      contexts.length = 0;
    }
  },

  /**
   * Resets the internal queue.
   *
   * @internal
   */
  reset: function() {
    this._callbacks = null;
    this._contexts = null;
  },

  /**
   * `PooledClass` looks for this.
   */
  destructor: function() {
    this.reset();
  }

});

PooledClass.addPoolingTo(CallbackQueue);

module.exports = CallbackQueue;

},{"135":135,"27":27,"28":28}],7:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ChangeEventPlugin
 */

'use strict';

var EventConstants = _dereq_(15);
var EventPluginHub = _dereq_(17);
var EventPropagators = _dereq_(20);
var ExecutionEnvironment = _dereq_(21);
var ReactUpdates = _dereq_(87);
var SyntheticEvent = _dereq_(95);

var isEventSupported = _dereq_(136);
var isTextInputElement = _dereq_(138);
var keyOf = _dereq_(141);

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  change: {
    phasedRegistrationNames: {
      bubbled: keyOf({onChange: null}),
      captured: keyOf({onChangeCapture: null})
    },
    dependencies: [
      topLevelTypes.topBlur,
      topLevelTypes.topChange,
      topLevelTypes.topClick,
      topLevelTypes.topFocus,
      topLevelTypes.topInput,
      topLevelTypes.topKeyDown,
      topLevelTypes.topKeyUp,
      topLevelTypes.topSelectionChange
    ]
  }
};

/**
 * For IE shims
 */
var activeElement = null;
var activeElementID = null;
var activeElementValue = null;
var activeElementValueProp = null;

/**
 * SECTION: handle `change` event
 */
function shouldUseChangeEvent(elem) {
  return (
    elem.nodeName === 'SELECT' ||
    (elem.nodeName === 'INPUT' && elem.type === 'file')
  );
}

var doesChangeEventBubble = false;
if (ExecutionEnvironment.canUseDOM) {
  // See `handleChange` comment below
  doesChangeEventBubble = isEventSupported('change') && (
    (!('documentMode' in document) || document.documentMode > 8)
  );
}

function manualDispatchChangeEvent(nativeEvent) {
  var event = SyntheticEvent.getPooled(
    eventTypes.change,
    activeElementID,
    nativeEvent
  );
  EventPropagators.accumulateTwoPhaseDispatches(event);

  // If change and propertychange bubbled, we'd just bind to it like all the
  // other events and have it go through ReactBrowserEventEmitter. Since it
  // doesn't, we manually listen for the events and so we have to enqueue and
  // process the abstract event manually.
  //
  // Batching is necessary here in order to ensure that all event handlers run
  // before the next rerender (including event handlers attached to ancestor
  // elements instead of directly on the input). Without this, controlled
  // components don't work properly in conjunction with event bubbling because
  // the component is rerendered and the value reverted before all the event
  // handlers can run. See https://github.com/facebook/react/issues/708.
  ReactUpdates.batchedUpdates(runEventInBatch, event);
}

function runEventInBatch(event) {
  EventPluginHub.enqueueEvents(event);
  EventPluginHub.processEventQueue();
}

function startWatchingForChangeEventIE8(target, targetID) {
  activeElement = target;
  activeElementID = targetID;
  activeElement.attachEvent('onchange', manualDispatchChangeEvent);
}

function stopWatchingForChangeEventIE8() {
  if (!activeElement) {
    return;
  }
  activeElement.detachEvent('onchange', manualDispatchChangeEvent);
  activeElement = null;
  activeElementID = null;
}

function getTargetIDForChangeEvent(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topChange) {
    return topLevelTargetID;
  }
}
function handleEventsForChangeEventIE8(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topFocus) {
    // stopWatching() should be a noop here but we call it just in case we
    // missed a blur event somehow.
    stopWatchingForChangeEventIE8();
    startWatchingForChangeEventIE8(topLevelTarget, topLevelTargetID);
  } else if (topLevelType === topLevelTypes.topBlur) {
    stopWatchingForChangeEventIE8();
  }
}


/**
 * SECTION: handle `input` event
 */
var isInputEventSupported = false;
if (ExecutionEnvironment.canUseDOM) {
  // IE9 claims to support the input event but fails to trigger it when
  // deleting text, so we ignore its input events
  isInputEventSupported = isEventSupported('input') && (
    (!('documentMode' in document) || document.documentMode > 9)
  );
}

/**
 * (For old IE.) Replacement getter/setter for the `value` property that gets
 * set on the active element.
 */
var newValueProp =  {
  get: function() {
    return activeElementValueProp.get.call(this);
  },
  set: function(val) {
    // Cast to a string so we can do equality checks.
    activeElementValue = '' + val;
    activeElementValueProp.set.call(this, val);
  }
};

/**
 * (For old IE.) Starts tracking propertychange events on the passed-in element
 * and override the value property so that we can distinguish user events from
 * value changes in JS.
 */
function startWatchingForValueChange(target, targetID) {
  activeElement = target;
  activeElementID = targetID;
  activeElementValue = target.value;
  activeElementValueProp = Object.getOwnPropertyDescriptor(
    target.constructor.prototype,
    'value'
  );

  Object.defineProperty(activeElement, 'value', newValueProp);
  activeElement.attachEvent('onpropertychange', handlePropertyChange);
}

/**
 * (For old IE.) Removes the event listeners from the currently-tracked element,
 * if any exists.
 */
function stopWatchingForValueChange() {
  if (!activeElement) {
    return;
  }

  // delete restores the original property definition
  delete activeElement.value;
  activeElement.detachEvent('onpropertychange', handlePropertyChange);

  activeElement = null;
  activeElementID = null;
  activeElementValue = null;
  activeElementValueProp = null;
}

/**
 * (For old IE.) Handles a propertychange event, sending a `change` event if
 * the value of the active element has changed.
 */
function handlePropertyChange(nativeEvent) {
  if (nativeEvent.propertyName !== 'value') {
    return;
  }
  var value = nativeEvent.srcElement.value;
  if (value === activeElementValue) {
    return;
  }
  activeElementValue = value;

  manualDispatchChangeEvent(nativeEvent);
}

/**
 * If a `change` event should be fired, returns the target's ID.
 */
function getTargetIDForInputEvent(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topInput) {
    // In modern browsers (i.e., not IE8 or IE9), the input event is exactly
    // what we want so fall through here and trigger an abstract event
    return topLevelTargetID;
  }
}

// For IE8 and IE9.
function handleEventsForInputEventIE(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topFocus) {
    // In IE8, we can capture almost all .value changes by adding a
    // propertychange handler and looking for events with propertyName
    // equal to 'value'
    // In IE9, propertychange fires for most input events but is buggy and
    // doesn't fire when text is deleted, but conveniently, selectionchange
    // appears to fire in all of the remaining cases so we catch those and
    // forward the event if the value has changed
    // In either case, we don't want to call the event handler if the value
    // is changed from JS so we redefine a setter for `.value` that updates
    // our activeElementValue variable, allowing us to ignore those changes
    //
    // stopWatching() should be a noop here but we call it just in case we
    // missed a blur event somehow.
    stopWatchingForValueChange();
    startWatchingForValueChange(topLevelTarget, topLevelTargetID);
  } else if (topLevelType === topLevelTypes.topBlur) {
    stopWatchingForValueChange();
  }
}

// For IE8 and IE9.
function getTargetIDForInputEventIE(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topSelectionChange ||
      topLevelType === topLevelTypes.topKeyUp ||
      topLevelType === topLevelTypes.topKeyDown) {
    // On the selectionchange event, the target is just document which isn't
    // helpful for us so just check activeElement instead.
    //
    // 99% of the time, keydown and keyup aren't necessary. IE8 fails to fire
    // propertychange on the first input event after setting `value` from a
    // script and fires only keydown, keypress, keyup. Catching keyup usually
    // gets it and catching keydown lets us fire an event for the first
    // keystroke if user does a key repeat (it'll be a little delayed: right
    // before the second keystroke). Other input methods (e.g., paste) seem to
    // fire selectionchange normally.
    if (activeElement && activeElement.value !== activeElementValue) {
      activeElementValue = activeElement.value;
      return activeElementID;
    }
  }
}


/**
 * SECTION: handle `click` event
 */
function shouldUseClickEvent(elem) {
  // Use the `click` event to detect changes to checkbox and radio inputs.
  // This approach works across all browsers, whereas `change` does not fire
  // until `blur` in IE8.
  return (
    elem.nodeName === 'INPUT' &&
    (elem.type === 'checkbox' || elem.type === 'radio')
  );
}

function getTargetIDForClickEvent(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topClick) {
    return topLevelTargetID;
  }
}

/**
 * This plugin creates an `onChange` event that normalizes change events
 * across form elements. This event fires at a time when it's possible to
 * change the element's value without seeing a flicker.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - select
 */
var ChangeEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {

    var getTargetIDFunc, handleEventFunc;
    if (shouldUseChangeEvent(topLevelTarget)) {
      if (doesChangeEventBubble) {
        getTargetIDFunc = getTargetIDForChangeEvent;
      } else {
        handleEventFunc = handleEventsForChangeEventIE8;
      }
    } else if (isTextInputElement(topLevelTarget)) {
      if (isInputEventSupported) {
        getTargetIDFunc = getTargetIDForInputEvent;
      } else {
        getTargetIDFunc = getTargetIDForInputEventIE;
        handleEventFunc = handleEventsForInputEventIE;
      }
    } else if (shouldUseClickEvent(topLevelTarget)) {
      getTargetIDFunc = getTargetIDForClickEvent;
    }

    if (getTargetIDFunc) {
      var targetID = getTargetIDFunc(
        topLevelType,
        topLevelTarget,
        topLevelTargetID
      );
      if (targetID) {
        var event = SyntheticEvent.getPooled(
          eventTypes.change,
          targetID,
          nativeEvent
        );
        EventPropagators.accumulateTwoPhaseDispatches(event);
        return event;
      }
    }

    if (handleEventFunc) {
      handleEventFunc(
        topLevelType,
        topLevelTarget,
        topLevelTargetID
      );
    }
  }

};

module.exports = ChangeEventPlugin;

},{"136":136,"138":138,"141":141,"15":15,"17":17,"20":20,"21":21,"87":87,"95":95}],8:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ClientReactRootIndex
 * @typechecks
 */

'use strict';

var nextReactRootIndex = 0;

var ClientReactRootIndex = {
  createReactRootIndex: function() {
    return nextReactRootIndex++;
  }
};

module.exports = ClientReactRootIndex;

},{}],9:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMChildrenOperations
 * @typechecks static-only
 */

'use strict';

var Danger = _dereq_(12);
var ReactMultiChildUpdateTypes = _dereq_(72);

var setTextContent = _dereq_(149);
var invariant = _dereq_(135);

/**
 * Inserts `childNode` as a child of `parentNode` at the `index`.
 *
 * @param {DOMElement} parentNode Parent node in which to insert.
 * @param {DOMElement} childNode Child node to insert.
 * @param {number} index Index at which to insert the child.
 * @internal
 */
function insertChildAt(parentNode, childNode, index) {
  // By exploiting arrays returning `undefined` for an undefined index, we can
  // rely exclusively on `insertBefore(node, null)` instead of also using
  // `appendChild(node)`. However, using `undefined` is not allowed by all
  // browsers so we must replace it with `null`.
  parentNode.insertBefore(
    childNode,
    parentNode.childNodes[index] || null
  );
}

/**
 * Operations for updating with DOM children.
 */
var DOMChildrenOperations = {

  dangerouslyReplaceNodeWithMarkup: Danger.dangerouslyReplaceNodeWithMarkup,

  updateTextContent: setTextContent,

  /**
   * Updates a component's children by processing a series of updates. The
   * update configurations are each expected to have a `parentNode` property.
   *
   * @param {array<object>} updates List of update configurations.
   * @param {array<string>} markupList List of markup strings.
   * @internal
   */
  processUpdates: function(updates, markupList) {
    var update;
    // Mapping from parent IDs to initial child orderings.
    var initialChildren = null;
    // List of children that will be moved or removed.
    var updatedChildren = null;

    for (var i = 0; i < updates.length; i++) {
      update = updates[i];
      if (update.type === ReactMultiChildUpdateTypes.MOVE_EXISTING ||
          update.type === ReactMultiChildUpdateTypes.REMOVE_NODE) {
        var updatedIndex = update.fromIndex;
        var updatedChild = update.parentNode.childNodes[updatedIndex];
        var parentID = update.parentID;

        ("production" !== "development" ? invariant(
          updatedChild,
          'processUpdates(): Unable to find child %s of element. This ' +
          'probably means the DOM was unexpectedly mutated (e.g., by the ' +
          'browser), usually due to forgetting a <tbody> when using tables, ' +
          'nesting tags like <form>, <p>, or <a>, or using non-SVG elements ' +
          'in an <svg> parent. Try inspecting the child nodes of the element ' +
          'with React ID `%s`.',
          updatedIndex,
          parentID
        ) : invariant(updatedChild));

        initialChildren = initialChildren || {};
        initialChildren[parentID] = initialChildren[parentID] || [];
        initialChildren[parentID][updatedIndex] = updatedChild;

        updatedChildren = updatedChildren || [];
        updatedChildren.push(updatedChild);
      }
    }

    var renderedMarkup = Danger.dangerouslyRenderMarkup(markupList);

    // Remove updated children first so that `toIndex` is consistent.
    if (updatedChildren) {
      for (var j = 0; j < updatedChildren.length; j++) {
        updatedChildren[j].parentNode.removeChild(updatedChildren[j]);
      }
    }

    for (var k = 0; k < updates.length; k++) {
      update = updates[k];
      switch (update.type) {
        case ReactMultiChildUpdateTypes.INSERT_MARKUP:
          insertChildAt(
            update.parentNode,
            renderedMarkup[update.markupIndex],
            update.toIndex
          );
          break;
        case ReactMultiChildUpdateTypes.MOVE_EXISTING:
          insertChildAt(
            update.parentNode,
            initialChildren[update.parentID][update.fromIndex],
            update.toIndex
          );
          break;
        case ReactMultiChildUpdateTypes.TEXT_CONTENT:
          setTextContent(
            update.parentNode,
            update.textContent
          );
          break;
        case ReactMultiChildUpdateTypes.REMOVE_NODE:
          // Already removed by the for-loop above.
          break;
      }
    }
  }

};

module.exports = DOMChildrenOperations;

},{"12":12,"135":135,"149":149,"72":72}],10:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMProperty
 * @typechecks static-only
 */

/*jslint bitwise: true */

'use strict';

var invariant = _dereq_(135);

function checkMask(value, bitmask) {
  return (value & bitmask) === bitmask;
}

var DOMPropertyInjection = {
  /**
   * Mapping from normalized, camelcased property names to a configuration that
   * specifies how the associated DOM property should be accessed or rendered.
   */
  MUST_USE_ATTRIBUTE: 0x1,
  MUST_USE_PROPERTY: 0x2,
  HAS_SIDE_EFFECTS: 0x4,
  HAS_BOOLEAN_VALUE: 0x8,
  HAS_NUMERIC_VALUE: 0x10,
  HAS_POSITIVE_NUMERIC_VALUE: 0x20 | 0x10,
  HAS_OVERLOADED_BOOLEAN_VALUE: 0x40,

  /**
   * Inject some specialized knowledge about the DOM. This takes a config object
   * with the following properties:
   *
   * isCustomAttribute: function that given an attribute name will return true
   * if it can be inserted into the DOM verbatim. Useful for data-* or aria-*
   * attributes where it's impossible to enumerate all of the possible
   * attribute names,
   *
   * Properties: object mapping DOM property name to one of the
   * DOMPropertyInjection constants or null. If your attribute isn't in here,
   * it won't get written to the DOM.
   *
   * DOMAttributeNames: object mapping React attribute name to the DOM
   * attribute name. Attribute names not specified use the **lowercase**
   * normalized name.
   *
   * DOMPropertyNames: similar to DOMAttributeNames but for DOM properties.
   * Property names not specified use the normalized name.
   *
   * DOMMutationMethods: Properties that require special mutation methods. If
   * `value` is undefined, the mutation method should unset the property.
   *
   * @param {object} domPropertyConfig the config as described above.
   */
  injectDOMPropertyConfig: function(domPropertyConfig) {
    var Properties = domPropertyConfig.Properties || {};
    var DOMAttributeNames = domPropertyConfig.DOMAttributeNames || {};
    var DOMPropertyNames = domPropertyConfig.DOMPropertyNames || {};
    var DOMMutationMethods = domPropertyConfig.DOMMutationMethods || {};

    if (domPropertyConfig.isCustomAttribute) {
      DOMProperty._isCustomAttributeFunctions.push(
        domPropertyConfig.isCustomAttribute
      );
    }

    for (var propName in Properties) {
      ("production" !== "development" ? invariant(
        !DOMProperty.isStandardName.hasOwnProperty(propName),
        'injectDOMPropertyConfig(...): You\'re trying to inject DOM property ' +
        '\'%s\' which has already been injected. You may be accidentally ' +
        'injecting the same DOM property config twice, or you may be ' +
        'injecting two configs that have conflicting property names.',
        propName
      ) : invariant(!DOMProperty.isStandardName.hasOwnProperty(propName)));

      DOMProperty.isStandardName[propName] = true;

      var lowerCased = propName.toLowerCase();
      DOMProperty.getPossibleStandardName[lowerCased] = propName;

      if (DOMAttributeNames.hasOwnProperty(propName)) {
        var attributeName = DOMAttributeNames[propName];
        DOMProperty.getPossibleStandardName[attributeName] = propName;
        DOMProperty.getAttributeName[propName] = attributeName;
      } else {
        DOMProperty.getAttributeName[propName] = lowerCased;
      }

      DOMProperty.getPropertyName[propName] =
        DOMPropertyNames.hasOwnProperty(propName) ?
          DOMPropertyNames[propName] :
          propName;

      if (DOMMutationMethods.hasOwnProperty(propName)) {
        DOMProperty.getMutationMethod[propName] = DOMMutationMethods[propName];
      } else {
        DOMProperty.getMutationMethod[propName] = null;
      }

      var propConfig = Properties[propName];
      DOMProperty.mustUseAttribute[propName] =
        checkMask(propConfig, DOMPropertyInjection.MUST_USE_ATTRIBUTE);
      DOMProperty.mustUseProperty[propName] =
        checkMask(propConfig, DOMPropertyInjection.MUST_USE_PROPERTY);
      DOMProperty.hasSideEffects[propName] =
        checkMask(propConfig, DOMPropertyInjection.HAS_SIDE_EFFECTS);
      DOMProperty.hasBooleanValue[propName] =
        checkMask(propConfig, DOMPropertyInjection.HAS_BOOLEAN_VALUE);
      DOMProperty.hasNumericValue[propName] =
        checkMask(propConfig, DOMPropertyInjection.HAS_NUMERIC_VALUE);
      DOMProperty.hasPositiveNumericValue[propName] =
        checkMask(propConfig, DOMPropertyInjection.HAS_POSITIVE_NUMERIC_VALUE);
      DOMProperty.hasOverloadedBooleanValue[propName] =
        checkMask(propConfig, DOMPropertyInjection.HAS_OVERLOADED_BOOLEAN_VALUE);

      ("production" !== "development" ? invariant(
        !DOMProperty.mustUseAttribute[propName] ||
          !DOMProperty.mustUseProperty[propName],
        'DOMProperty: Cannot require using both attribute and property: %s',
        propName
      ) : invariant(!DOMProperty.mustUseAttribute[propName] ||
        !DOMProperty.mustUseProperty[propName]));
      ("production" !== "development" ? invariant(
        DOMProperty.mustUseProperty[propName] ||
          !DOMProperty.hasSideEffects[propName],
        'DOMProperty: Properties that have side effects must use property: %s',
        propName
      ) : invariant(DOMProperty.mustUseProperty[propName] ||
        !DOMProperty.hasSideEffects[propName]));
      ("production" !== "development" ? invariant(
        !!DOMProperty.hasBooleanValue[propName] +
          !!DOMProperty.hasNumericValue[propName] +
          !!DOMProperty.hasOverloadedBooleanValue[propName] <= 1,
        'DOMProperty: Value can be one of boolean, overloaded boolean, or ' +
        'numeric value, but not a combination: %s',
        propName
      ) : invariant(!!DOMProperty.hasBooleanValue[propName] +
        !!DOMProperty.hasNumericValue[propName] +
        !!DOMProperty.hasOverloadedBooleanValue[propName] <= 1));
    }
  }
};
var defaultValueCache = {};

/**
 * DOMProperty exports lookup objects that can be used like functions:
 *
 *   > DOMProperty.isValid['id']
 *   true
 *   > DOMProperty.isValid['foobar']
 *   undefined
 *
 * Although this may be confusing, it performs better in general.
 *
 * @see http://jsperf.com/key-exists
 * @see http://jsperf.com/key-missing
 */
var DOMProperty = {

  ID_ATTRIBUTE_NAME: 'data-reactid',

  /**
   * Checks whether a property name is a standard property.
   * @type {Object}
   */
  isStandardName: {},

  /**
   * Mapping from lowercase property names to the properly cased version, used
   * to warn in the case of missing properties.
   * @type {Object}
   */
  getPossibleStandardName: {},

  /**
   * Mapping from normalized names to attribute names that differ. Attribute
   * names are used when rendering markup or with `*Attribute()`.
   * @type {Object}
   */
  getAttributeName: {},

  /**
   * Mapping from normalized names to properties on DOM node instances.
   * (This includes properties that mutate due to external factors.)
   * @type {Object}
   */
  getPropertyName: {},

  /**
   * Mapping from normalized names to mutation methods. This will only exist if
   * mutation cannot be set simply by the property or `setAttribute()`.
   * @type {Object}
   */
  getMutationMethod: {},

  /**
   * Whether the property must be accessed and mutated as an object property.
   * @type {Object}
   */
  mustUseAttribute: {},

  /**
   * Whether the property must be accessed and mutated using `*Attribute()`.
   * (This includes anything that fails `<propName> in <element>`.)
   * @type {Object}
   */
  mustUseProperty: {},

  /**
   * Whether or not setting a value causes side effects such as triggering
   * resources to be loaded or text selection changes. We must ensure that
   * the value is only set if it has changed.
   * @type {Object}
   */
  hasSideEffects: {},

  /**
   * Whether the property should be removed when set to a falsey value.
   * @type {Object}
   */
  hasBooleanValue: {},

  /**
   * Whether the property must be numeric or parse as a
   * numeric and should be removed when set to a falsey value.
   * @type {Object}
   */
  hasNumericValue: {},

  /**
   * Whether the property must be positive numeric or parse as a positive
   * numeric and should be removed when set to a falsey value.
   * @type {Object}
   */
  hasPositiveNumericValue: {},

  /**
   * Whether the property can be used as a flag as well as with a value. Removed
   * when strictly equal to false; present without a value when strictly equal
   * to true; present with a value otherwise.
   * @type {Object}
   */
  hasOverloadedBooleanValue: {},

  /**
   * All of the isCustomAttribute() functions that have been injected.
   */
  _isCustomAttributeFunctions: [],

  /**
   * Checks whether a property name is a custom attribute.
   * @method
   */
  isCustomAttribute: function(attributeName) {
    for (var i = 0; i < DOMProperty._isCustomAttributeFunctions.length; i++) {
      var isCustomAttributeFn = DOMProperty._isCustomAttributeFunctions[i];
      if (isCustomAttributeFn(attributeName)) {
        return true;
      }
    }
    return false;
  },

  /**
   * Returns the default property value for a DOM property (i.e., not an
   * attribute). Most default values are '' or false, but not all. Worse yet,
   * some (in particular, `type`) vary depending on the type of element.
   *
   * TODO: Is it better to grab all the possible properties when creating an
   * element to avoid having to create the same element twice?
   */
  getDefaultValueForProperty: function(nodeName, prop) {
    var nodeDefaults = defaultValueCache[nodeName];
    var testElement;
    if (!nodeDefaults) {
      defaultValueCache[nodeName] = nodeDefaults = {};
    }
    if (!(prop in nodeDefaults)) {
      testElement = document.createElement(nodeName);
      nodeDefaults[prop] = testElement[prop];
    }
    return nodeDefaults[prop];
  },

  injection: DOMPropertyInjection
};

module.exports = DOMProperty;

},{"135":135}],11:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMPropertyOperations
 * @typechecks static-only
 */

'use strict';

var DOMProperty = _dereq_(10);

var quoteAttributeValueForBrowser = _dereq_(147);
var warning = _dereq_(154);

function shouldIgnoreValue(name, value) {
  return value == null ||
    (DOMProperty.hasBooleanValue[name] && !value) ||
    (DOMProperty.hasNumericValue[name] && isNaN(value)) ||
    (DOMProperty.hasPositiveNumericValue[name] && (value < 1)) ||
    (DOMProperty.hasOverloadedBooleanValue[name] && value === false);
}

if ("production" !== "development") {
  var reactProps = {
    children: true,
    dangerouslySetInnerHTML: true,
    key: true,
    ref: true
  };
  var warnedProperties = {};

  var warnUnknownProperty = function(name) {
    if (reactProps.hasOwnProperty(name) && reactProps[name] ||
        warnedProperties.hasOwnProperty(name) && warnedProperties[name]) {
      return;
    }

    warnedProperties[name] = true;
    var lowerCasedName = name.toLowerCase();

    // data-* attributes should be lowercase; suggest the lowercase version
    var standardName = (
      DOMProperty.isCustomAttribute(lowerCasedName) ?
        lowerCasedName :
      DOMProperty.getPossibleStandardName.hasOwnProperty(lowerCasedName) ?
        DOMProperty.getPossibleStandardName[lowerCasedName] :
        null
    );

    // For now, only warn when we have a suggested correction. This prevents
    // logging too much when using transferPropsTo.
    ("production" !== "development" ? warning(
      standardName == null,
      'Unknown DOM property %s. Did you mean %s?',
      name,
      standardName
    ) : null);

  };
}

/**
 * Operations for dealing with DOM properties.
 */
var DOMPropertyOperations = {

  /**
   * Creates markup for the ID property.
   *
   * @param {string} id Unescaped ID.
   * @return {string} Markup string.
   */
  createMarkupForID: function(id) {
    return DOMProperty.ID_ATTRIBUTE_NAME + '=' +
      quoteAttributeValueForBrowser(id);
  },

  /**
   * Creates markup for a property.
   *
   * @param {string} name
   * @param {*} value
   * @return {?string} Markup string, or null if the property was invalid.
   */
  createMarkupForProperty: function(name, value) {
    if (DOMProperty.isStandardName.hasOwnProperty(name) &&
        DOMProperty.isStandardName[name]) {
      if (shouldIgnoreValue(name, value)) {
        return '';
      }
      var attributeName = DOMProperty.getAttributeName[name];
      if (DOMProperty.hasBooleanValue[name] ||
          (DOMProperty.hasOverloadedBooleanValue[name] && value === true)) {
        return attributeName;
      }
      return attributeName + '=' + quoteAttributeValueForBrowser(value);
    } else if (DOMProperty.isCustomAttribute(name)) {
      if (value == null) {
        return '';
      }
      return name + '=' + quoteAttributeValueForBrowser(value);
    } else if ("production" !== "development") {
      warnUnknownProperty(name);
    }
    return null;
  },

  /**
   * Sets the value for a property on a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   * @param {*} value
   */
  setValueForProperty: function(node, name, value) {
    if (DOMProperty.isStandardName.hasOwnProperty(name) &&
        DOMProperty.isStandardName[name]) {
      var mutationMethod = DOMProperty.getMutationMethod[name];
      if (mutationMethod) {
        mutationMethod(node, value);
      } else if (shouldIgnoreValue(name, value)) {
        this.deleteValueForProperty(node, name);
      } else if (DOMProperty.mustUseAttribute[name]) {
        // `setAttribute` with objects becomes only `[object]` in IE8/9,
        // ('' + value) makes it output the correct toString()-value.
        node.setAttribute(DOMProperty.getAttributeName[name], '' + value);
      } else {
        var propName = DOMProperty.getPropertyName[name];
        // Must explicitly cast values for HAS_SIDE_EFFECTS-properties to the
        // property type before comparing; only `value` does and is string.
        if (!DOMProperty.hasSideEffects[name] ||
            ('' + node[propName]) !== ('' + value)) {
          // Contrary to `setAttribute`, object properties are properly
          // `toString`ed by IE8/9.
          node[propName] = value;
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      if (value == null) {
        node.removeAttribute(name);
      } else {
        node.setAttribute(name, '' + value);
      }
    } else if ("production" !== "development") {
      warnUnknownProperty(name);
    }
  },

  /**
   * Deletes the value for a property on a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   */
  deleteValueForProperty: function(node, name) {
    if (DOMProperty.isStandardName.hasOwnProperty(name) &&
        DOMProperty.isStandardName[name]) {
      var mutationMethod = DOMProperty.getMutationMethod[name];
      if (mutationMethod) {
        mutationMethod(node, undefined);
      } else if (DOMProperty.mustUseAttribute[name]) {
        node.removeAttribute(DOMProperty.getAttributeName[name]);
      } else {
        var propName = DOMProperty.getPropertyName[name];
        var defaultValue = DOMProperty.getDefaultValueForProperty(
          node.nodeName,
          propName
        );
        if (!DOMProperty.hasSideEffects[name] ||
            ('' + node[propName]) !== defaultValue) {
          node[propName] = defaultValue;
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      node.removeAttribute(name);
    } else if ("production" !== "development") {
      warnUnknownProperty(name);
    }
  }

};

module.exports = DOMPropertyOperations;

},{"10":10,"147":147,"154":154}],12:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Danger
 * @typechecks static-only
 */

/*jslint evil: true, sub: true */

'use strict';

var ExecutionEnvironment = _dereq_(21);

var createNodesFromMarkup = _dereq_(112);
var emptyFunction = _dereq_(114);
var getMarkupWrap = _dereq_(127);
var invariant = _dereq_(135);

var OPEN_TAG_NAME_EXP = /^(<[^ \/>]+)/;
var RESULT_INDEX_ATTR = 'data-danger-index';

/**
 * Extracts the `nodeName` from a string of markup.
 *
 * NOTE: Extracting the `nodeName` does not require a regular expression match
 * because we make assumptions about React-generated markup (i.e. there are no
 * spaces surrounding the opening tag and there is at least one attribute).
 *
 * @param {string} markup String of markup.
 * @return {string} Node name of the supplied markup.
 * @see http://jsperf.com/extract-nodename
 */
function getNodeName(markup) {
  return markup.substring(1, markup.indexOf(' '));
}

var Danger = {

  /**
   * Renders markup into an array of nodes. The markup is expected to render
   * into a list of root nodes. Also, the length of `resultList` and
   * `markupList` should be the same.
   *
   * @param {array<string>} markupList List of markup strings to render.
   * @return {array<DOMElement>} List of rendered nodes.
   * @internal
   */
  dangerouslyRenderMarkup: function(markupList) {
    ("production" !== "development" ? invariant(
      ExecutionEnvironment.canUseDOM,
      'dangerouslyRenderMarkup(...): Cannot render markup in a worker ' +
      'thread. Make sure `window` and `document` are available globally ' +
      'before requiring React when unit testing or use ' +
      'React.renderToString for server rendering.'
    ) : invariant(ExecutionEnvironment.canUseDOM));
    var nodeName;
    var markupByNodeName = {};
    // Group markup by `nodeName` if a wrap is necessary, else by '*'.
    for (var i = 0; i < markupList.length; i++) {
      ("production" !== "development" ? invariant(
        markupList[i],
        'dangerouslyRenderMarkup(...): Missing markup.'
      ) : invariant(markupList[i]));
      nodeName = getNodeName(markupList[i]);
      nodeName = getMarkupWrap(nodeName) ? nodeName : '*';
      markupByNodeName[nodeName] = markupByNodeName[nodeName] || [];
      markupByNodeName[nodeName][i] = markupList[i];
    }
    var resultList = [];
    var resultListAssignmentCount = 0;
    for (nodeName in markupByNodeName) {
      if (!markupByNodeName.hasOwnProperty(nodeName)) {
        continue;
      }
      var markupListByNodeName = markupByNodeName[nodeName];

      // This for-in loop skips the holes of the sparse array. The order of
      // iteration should follow the order of assignment, which happens to match
      // numerical index order, but we don't rely on that.
      var resultIndex;
      for (resultIndex in markupListByNodeName) {
        if (markupListByNodeName.hasOwnProperty(resultIndex)) {
          var markup = markupListByNodeName[resultIndex];

          // Push the requested markup with an additional RESULT_INDEX_ATTR
          // attribute.  If the markup does not start with a < character, it
          // will be discarded below (with an appropriate console.error).
          markupListByNodeName[resultIndex] = markup.replace(
            OPEN_TAG_NAME_EXP,
            // This index will be parsed back out below.
            '$1 ' + RESULT_INDEX_ATTR + '="' + resultIndex + '" '
          );
        }
      }

      // Render each group of markup with similar wrapping `nodeName`.
      var renderNodes = createNodesFromMarkup(
        markupListByNodeName.join(''),
        emptyFunction // Do nothing special with <script> tags.
      );

      for (var j = 0; j < renderNodes.length; ++j) {
        var renderNode = renderNodes[j];
        if (renderNode.hasAttribute &&
            renderNode.hasAttribute(RESULT_INDEX_ATTR)) {

          resultIndex = +renderNode.getAttribute(RESULT_INDEX_ATTR);
          renderNode.removeAttribute(RESULT_INDEX_ATTR);

          ("production" !== "development" ? invariant(
            !resultList.hasOwnProperty(resultIndex),
            'Danger: Assigning to an already-occupied result index.'
          ) : invariant(!resultList.hasOwnProperty(resultIndex)));

          resultList[resultIndex] = renderNode;

          // This should match resultList.length and markupList.length when
          // we're done.
          resultListAssignmentCount += 1;

        } else if ("production" !== "development") {
          console.error(
            'Danger: Discarding unexpected node:',
            renderNode
          );
        }
      }
    }

    // Although resultList was populated out of order, it should now be a dense
    // array.
    ("production" !== "development" ? invariant(
      resultListAssignmentCount === resultList.length,
      'Danger: Did not assign to every index of resultList.'
    ) : invariant(resultListAssignmentCount === resultList.length));

    ("production" !== "development" ? invariant(
      resultList.length === markupList.length,
      'Danger: Expected markup to render %s nodes, but rendered %s.',
      markupList.length,
      resultList.length
    ) : invariant(resultList.length === markupList.length));

    return resultList;
  },

  /**
   * Replaces a node with a string of markup at its current position within its
   * parent. The markup must render into a single root node.
   *
   * @param {DOMElement} oldChild Child node to replace.
   * @param {string} markup Markup to render in place of the child node.
   * @internal
   */
  dangerouslyReplaceNodeWithMarkup: function(oldChild, markup) {
    ("production" !== "development" ? invariant(
      ExecutionEnvironment.canUseDOM,
      'dangerouslyReplaceNodeWithMarkup(...): Cannot render markup in a ' +
      'worker thread. Make sure `window` and `document` are available ' +
      'globally before requiring React when unit testing or use ' +
      'React.renderToString for server rendering.'
    ) : invariant(ExecutionEnvironment.canUseDOM));
    ("production" !== "development" ? invariant(markup, 'dangerouslyReplaceNodeWithMarkup(...): Missing markup.') : invariant(markup));
    ("production" !== "development" ? invariant(
      oldChild.tagName.toLowerCase() !== 'html',
      'dangerouslyReplaceNodeWithMarkup(...): Cannot replace markup of the ' +
      '<html> node. This is because browser quirks make this unreliable ' +
      'and/or slow. If you want to render to the root you must use ' +
      'server rendering. See React.renderToString().'
    ) : invariant(oldChild.tagName.toLowerCase() !== 'html'));

    var newChild = createNodesFromMarkup(markup, emptyFunction)[0];
    oldChild.parentNode.replaceChild(newChild, oldChild);
  }

};

module.exports = Danger;

},{"112":112,"114":114,"127":127,"135":135,"21":21}],13:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DefaultEventPluginOrder
 */

'use strict';

var keyOf = _dereq_(141);

/**
 * Module that is injectable into `EventPluginHub`, that specifies a
 * deterministic ordering of `EventPlugin`s. A convenient way to reason about
 * plugins, without having to package every one of them. This is better than
 * having plugins be ordered in the same order that they are injected because
 * that ordering would be influenced by the packaging order.
 * `ResponderEventPlugin` must occur before `SimpleEventPlugin` so that
 * preventing default on events is convenient in `SimpleEventPlugin` handlers.
 */
var DefaultEventPluginOrder = [
  keyOf({ResponderEventPlugin: null}),
  keyOf({SimpleEventPlugin: null}),
  keyOf({TapEventPlugin: null}),
  keyOf({EnterLeaveEventPlugin: null}),
  keyOf({ChangeEventPlugin: null}),
  keyOf({SelectEventPlugin: null}),
  keyOf({BeforeInputEventPlugin: null}),
  keyOf({AnalyticsEventPlugin: null}),
  keyOf({MobileSafariClickEventPlugin: null})
];

module.exports = DefaultEventPluginOrder;

},{"141":141}],14:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EnterLeaveEventPlugin
 * @typechecks static-only
 */

'use strict';

var EventConstants = _dereq_(15);
var EventPropagators = _dereq_(20);
var SyntheticMouseEvent = _dereq_(99);

var ReactMount = _dereq_(70);
var keyOf = _dereq_(141);

var topLevelTypes = EventConstants.topLevelTypes;
var getFirstReactDOM = ReactMount.getFirstReactDOM;

var eventTypes = {
  mouseEnter: {
    registrationName: keyOf({onMouseEnter: null}),
    dependencies: [
      topLevelTypes.topMouseOut,
      topLevelTypes.topMouseOver
    ]
  },
  mouseLeave: {
    registrationName: keyOf({onMouseLeave: null}),
    dependencies: [
      topLevelTypes.topMouseOut,
      topLevelTypes.topMouseOver
    ]
  }
};

var extractedEvents = [null, null];

var EnterLeaveEventPlugin = {

  eventTypes: eventTypes,

  /**
   * For almost every interaction we care about, there will be both a top-level
   * `mouseover` and `mouseout` event that occurs. Only use `mouseout` so that
   * we do not extract duplicate events. However, moving the mouse into the
   * browser from outside will not fire a `mouseout` event. In this case, we use
   * the `mouseover` top-level event.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    if (topLevelType === topLevelTypes.topMouseOver &&
        (nativeEvent.relatedTarget || nativeEvent.fromElement)) {
      return null;
    }
    if (topLevelType !== topLevelTypes.topMouseOut &&
        topLevelType !== topLevelTypes.topMouseOver) {
      // Must not be a mouse in or mouse out - ignoring.
      return null;
    }

    var win;
    if (topLevelTarget.window === topLevelTarget) {
      // `topLevelTarget` is probably a window object.
      win = topLevelTarget;
    } else {
      // TODO: Figure out why `ownerDocument` is sometimes undefined in IE8.
      var doc = topLevelTarget.ownerDocument;
      if (doc) {
        win = doc.defaultView || doc.parentWindow;
      } else {
        win = window;
      }
    }

    var from, to;
    if (topLevelType === topLevelTypes.topMouseOut) {
      from = topLevelTarget;
      to =
        getFirstReactDOM(nativeEvent.relatedTarget || nativeEvent.toElement) ||
        win;
    } else {
      from = win;
      to = topLevelTarget;
    }

    if (from === to) {
      // Nothing pertains to our managed components.
      return null;
    }

    var fromID = from ? ReactMount.getID(from) : '';
    var toID = to ? ReactMount.getID(to) : '';

    var leave = SyntheticMouseEvent.getPooled(
      eventTypes.mouseLeave,
      fromID,
      nativeEvent
    );
    leave.type = 'mouseleave';
    leave.target = from;
    leave.relatedTarget = to;

    var enter = SyntheticMouseEvent.getPooled(
      eventTypes.mouseEnter,
      toID,
      nativeEvent
    );
    enter.type = 'mouseenter';
    enter.target = to;
    enter.relatedTarget = from;

    EventPropagators.accumulateEnterLeaveDispatches(leave, enter, fromID, toID);

    extractedEvents[0] = leave;
    extractedEvents[1] = enter;

    return extractedEvents;
  }

};

module.exports = EnterLeaveEventPlugin;

},{"141":141,"15":15,"20":20,"70":70,"99":99}],15:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventConstants
 */

'use strict';

var keyMirror = _dereq_(140);

var PropagationPhases = keyMirror({bubbled: null, captured: null});

/**
 * Types of raw signals from the browser caught at the top level.
 */
var topLevelTypes = keyMirror({
  topBlur: null,
  topChange: null,
  topClick: null,
  topCompositionEnd: null,
  topCompositionStart: null,
  topCompositionUpdate: null,
  topContextMenu: null,
  topCopy: null,
  topCut: null,
  topDoubleClick: null,
  topDrag: null,
  topDragEnd: null,
  topDragEnter: null,
  topDragExit: null,
  topDragLeave: null,
  topDragOver: null,
  topDragStart: null,
  topDrop: null,
  topError: null,
  topFocus: null,
  topInput: null,
  topKeyDown: null,
  topKeyPress: null,
  topKeyUp: null,
  topLoad: null,
  topMouseDown: null,
  topMouseMove: null,
  topMouseOut: null,
  topMouseOver: null,
  topMouseUp: null,
  topPaste: null,
  topReset: null,
  topScroll: null,
  topSelectionChange: null,
  topSubmit: null,
  topTextInput: null,
  topTouchCancel: null,
  topTouchEnd: null,
  topTouchMove: null,
  topTouchStart: null,
  topWheel: null
});

var EventConstants = {
  topLevelTypes: topLevelTypes,
  PropagationPhases: PropagationPhases
};

module.exports = EventConstants;

},{"140":140}],16:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EventListener
 * @typechecks
 */

var emptyFunction = _dereq_(114);

/**
 * Upstream version of event listener. Does not take into account specific
 * nature of platform.
 */
var EventListener = {
  /**
   * Listen to DOM events during the bubble phase.
   *
   * @param {DOMEventTarget} target DOM element to register listener on.
   * @param {string} eventType Event type, e.g. 'click' or 'mouseover'.
   * @param {function} callback Callback function.
   * @return {object} Object with a `remove` method.
   */
  listen: function(target, eventType, callback) {
    if (target.addEventListener) {
      target.addEventListener(eventType, callback, false);
      return {
        remove: function() {
          target.removeEventListener(eventType, callback, false);
        }
      };
    } else if (target.attachEvent) {
      target.attachEvent('on' + eventType, callback);
      return {
        remove: function() {
          target.detachEvent('on' + eventType, callback);
        }
      };
    }
  },

  /**
   * Listen to DOM events during the capture phase.
   *
   * @param {DOMEventTarget} target DOM element to register listener on.
   * @param {string} eventType Event type, e.g. 'click' or 'mouseover'.
   * @param {function} callback Callback function.
   * @return {object} Object with a `remove` method.
   */
  capture: function(target, eventType, callback) {
    if (!target.addEventListener) {
      if ("production" !== "development") {
        console.error(
          'Attempted to listen to events during the capture phase on a ' +
          'browser that does not support the capture phase. Your application ' +
          'will not receive some events.'
        );
      }
      return {
        remove: emptyFunction
      };
    } else {
      target.addEventListener(eventType, callback, true);
      return {
        remove: function() {
          target.removeEventListener(eventType, callback, true);
        }
      };
    }
  },

  registerDefault: function() {}
};

module.exports = EventListener;

},{"114":114}],17:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPluginHub
 */

'use strict';

var EventPluginRegistry = _dereq_(18);
var EventPluginUtils = _dereq_(19);

var accumulateInto = _dereq_(105);
var forEachAccumulated = _dereq_(120);
var invariant = _dereq_(135);

/**
 * Internal store for event listeners
 */
var listenerBank = {};

/**
 * Internal queue of events that have accumulated their dispatches and are
 * waiting to have their dispatches executed.
 */
var eventQueue = null;

/**
 * Dispatches an event and releases it back into the pool, unless persistent.
 *
 * @param {?object} event Synthetic event to be dispatched.
 * @private
 */
var executeDispatchesAndRelease = function(event) {
  if (event) {
    var executeDispatch = EventPluginUtils.executeDispatch;
    // Plugins can provide custom behavior when dispatching events.
    var PluginModule = EventPluginRegistry.getPluginModuleForEvent(event);
    if (PluginModule && PluginModule.executeDispatch) {
      executeDispatch = PluginModule.executeDispatch;
    }
    EventPluginUtils.executeDispatchesInOrder(event, executeDispatch);

    if (!event.isPersistent()) {
      event.constructor.release(event);
    }
  }
};

/**
 * - `InstanceHandle`: [required] Module that performs logical traversals of DOM
 *   hierarchy given ids of the logical DOM elements involved.
 */
var InstanceHandle = null;

function validateInstanceHandle() {
  var valid =
    InstanceHandle &&
    InstanceHandle.traverseTwoPhase &&
    InstanceHandle.traverseEnterLeave;
  ("production" !== "development" ? invariant(
    valid,
    'InstanceHandle not injected before use!'
  ) : invariant(valid));
}

/**
 * This is a unified interface for event plugins to be installed and configured.
 *
 * Event plugins can implement the following properties:
 *
 *   `extractEvents` {function(string, DOMEventTarget, string, object): *}
 *     Required. When a top-level event is fired, this method is expected to
 *     extract synthetic events that will in turn be queued and dispatched.
 *
 *   `eventTypes` {object}
 *     Optional, plugins that fire events must publish a mapping of registration
 *     names that are used to register listeners. Values of this mapping must
 *     be objects that contain `registrationName` or `phasedRegistrationNames`.
 *
 *   `executeDispatch` {function(object, function, string)}
 *     Optional, allows plugins to override how an event gets dispatched. By
 *     default, the listener is simply invoked.
 *
 * Each plugin that is injected into `EventsPluginHub` is immediately operable.
 *
 * @public
 */
var EventPluginHub = {

  /**
   * Methods for injecting dependencies.
   */
  injection: {

    /**
     * @param {object} InjectedMount
     * @public
     */
    injectMount: EventPluginUtils.injection.injectMount,

    /**
     * @param {object} InjectedInstanceHandle
     * @public
     */
    injectInstanceHandle: function(InjectedInstanceHandle) {
      InstanceHandle = InjectedInstanceHandle;
      if ("production" !== "development") {
        validateInstanceHandle();
      }
    },

    getInstanceHandle: function() {
      if ("production" !== "development") {
        validateInstanceHandle();
      }
      return InstanceHandle;
    },

    /**
     * @param {array} InjectedEventPluginOrder
     * @public
     */
    injectEventPluginOrder: EventPluginRegistry.injectEventPluginOrder,

    /**
     * @param {object} injectedNamesToPlugins Map from names to plugin modules.
     */
    injectEventPluginsByName: EventPluginRegistry.injectEventPluginsByName

  },

  eventNameDispatchConfigs: EventPluginRegistry.eventNameDispatchConfigs,

  registrationNameModules: EventPluginRegistry.registrationNameModules,

  /**
   * Stores `listener` at `listenerBank[registrationName][id]`. Is idempotent.
   *
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @param {?function} listener The callback to store.
   */
  putListener: function(id, registrationName, listener) {
    ("production" !== "development" ? invariant(
      !listener || typeof listener === 'function',
      'Expected %s listener to be a function, instead got type %s',
      registrationName, typeof listener
    ) : invariant(!listener || typeof listener === 'function'));

    var bankForRegistrationName =
      listenerBank[registrationName] || (listenerBank[registrationName] = {});
    bankForRegistrationName[id] = listener;
  },

  /**
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @return {?function} The stored callback.
   */
  getListener: function(id, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName];
    return bankForRegistrationName && bankForRegistrationName[id];
  },

  /**
   * Deletes a listener from the registration bank.
   *
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   */
  deleteListener: function(id, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName];
    if (bankForRegistrationName) {
      delete bankForRegistrationName[id];
    }
  },

  /**
   * Deletes all listeners for the DOM element with the supplied ID.
   *
   * @param {string} id ID of the DOM element.
   */
  deleteAllListeners: function(id) {
    for (var registrationName in listenerBank) {
      delete listenerBank[registrationName][id];
    }
  },

  /**
   * Allows registered plugins an opportunity to extract events from top-level
   * native browser events.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @internal
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    var events;
    var plugins = EventPluginRegistry.plugins;
    for (var i = 0, l = plugins.length; i < l; i++) {
      // Not every plugin in the ordering may be loaded at runtime.
      var possiblePlugin = plugins[i];
      if (possiblePlugin) {
        var extractedEvents = possiblePlugin.extractEvents(
          topLevelType,
          topLevelTarget,
          topLevelTargetID,
          nativeEvent
        );
        if (extractedEvents) {
          events = accumulateInto(events, extractedEvents);
        }
      }
    }
    return events;
  },

  /**
   * Enqueues a synthetic event that should be dispatched when
   * `processEventQueue` is invoked.
   *
   * @param {*} events An accumulation of synthetic events.
   * @internal
   */
  enqueueEvents: function(events) {
    if (events) {
      eventQueue = accumulateInto(eventQueue, events);
    }
  },

  /**
   * Dispatches all synthetic events on the event queue.
   *
   * @internal
   */
  processEventQueue: function() {
    // Set `eventQueue` to null before processing it so that we can tell if more
    // events get enqueued while processing.
    var processingEventQueue = eventQueue;
    eventQueue = null;
    forEachAccumulated(processingEventQueue, executeDispatchesAndRelease);
    ("production" !== "development" ? invariant(
      !eventQueue,
      'processEventQueue(): Additional events were enqueued while processing ' +
      'an event queue. Support for this has not yet been implemented.'
    ) : invariant(!eventQueue));
  },

  /**
   * These are needed for tests only. Do not use!
   */
  __purge: function() {
    listenerBank = {};
  },

  __getListenerBank: function() {
    return listenerBank;
  }

};

module.exports = EventPluginHub;

},{"105":105,"120":120,"135":135,"18":18,"19":19}],18:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPluginRegistry
 * @typechecks static-only
 */

'use strict';

var invariant = _dereq_(135);

/**
 * Injectable ordering of event plugins.
 */
var EventPluginOrder = null;

/**
 * Injectable mapping from names to event plugin modules.
 */
var namesToPlugins = {};

/**
 * Recomputes the plugin list using the injected plugins and plugin ordering.
 *
 * @private
 */
function recomputePluginOrdering() {
  if (!EventPluginOrder) {
    // Wait until an `EventPluginOrder` is injected.
    return;
  }
  for (var pluginName in namesToPlugins) {
    var PluginModule = namesToPlugins[pluginName];
    var pluginIndex = EventPluginOrder.indexOf(pluginName);
    ("production" !== "development" ? invariant(
      pluginIndex > -1,
      'EventPluginRegistry: Cannot inject event plugins that do not exist in ' +
      'the plugin ordering, `%s`.',
      pluginName
    ) : invariant(pluginIndex > -1));
    if (EventPluginRegistry.plugins[pluginIndex]) {
      continue;
    }
    ("production" !== "development" ? invariant(
      PluginModule.extractEvents,
      'EventPluginRegistry: Event plugins must implement an `extractEvents` ' +
      'method, but `%s` does not.',
      pluginName
    ) : invariant(PluginModule.extractEvents));
    EventPluginRegistry.plugins[pluginIndex] = PluginModule;
    var publishedEvents = PluginModule.eventTypes;
    for (var eventName in publishedEvents) {
      ("production" !== "development" ? invariant(
        publishEventForPlugin(
          publishedEvents[eventName],
          PluginModule,
          eventName
        ),
        'EventPluginRegistry: Failed to publish event `%s` for plugin `%s`.',
        eventName,
        pluginName
      ) : invariant(publishEventForPlugin(
        publishedEvents[eventName],
        PluginModule,
        eventName
      )));
    }
  }
}

/**
 * Publishes an event so that it can be dispatched by the supplied plugin.
 *
 * @param {object} dispatchConfig Dispatch configuration for the event.
 * @param {object} PluginModule Plugin publishing the event.
 * @return {boolean} True if the event was successfully published.
 * @private
 */
function publishEventForPlugin(dispatchConfig, PluginModule, eventName) {
  ("production" !== "development" ? invariant(
    !EventPluginRegistry.eventNameDispatchConfigs.hasOwnProperty(eventName),
    'EventPluginHub: More than one plugin attempted to publish the same ' +
    'event name, `%s`.',
    eventName
  ) : invariant(!EventPluginRegistry.eventNameDispatchConfigs.hasOwnProperty(eventName)));
  EventPluginRegistry.eventNameDispatchConfigs[eventName] = dispatchConfig;

  var phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
  if (phasedRegistrationNames) {
    for (var phaseName in phasedRegistrationNames) {
      if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
        var phasedRegistrationName = phasedRegistrationNames[phaseName];
        publishRegistrationName(
          phasedRegistrationName,
          PluginModule,
          eventName
        );
      }
    }
    return true;
  } else if (dispatchConfig.registrationName) {
    publishRegistrationName(
      dispatchConfig.registrationName,
      PluginModule,
      eventName
    );
    return true;
  }
  return false;
}

/**
 * Publishes a registration name that is used to identify dispatched events and
 * can be used with `EventPluginHub.putListener` to register listeners.
 *
 * @param {string} registrationName Registration name to add.
 * @param {object} PluginModule Plugin publishing the event.
 * @private
 */
function publishRegistrationName(registrationName, PluginModule, eventName) {
  ("production" !== "development" ? invariant(
    !EventPluginRegistry.registrationNameModules[registrationName],
    'EventPluginHub: More than one plugin attempted to publish the same ' +
    'registration name, `%s`.',
    registrationName
  ) : invariant(!EventPluginRegistry.registrationNameModules[registrationName]));
  EventPluginRegistry.registrationNameModules[registrationName] = PluginModule;
  EventPluginRegistry.registrationNameDependencies[registrationName] =
    PluginModule.eventTypes[eventName].dependencies;
}

/**
 * Registers plugins so that they can extract and dispatch events.
 *
 * @see {EventPluginHub}
 */
var EventPluginRegistry = {

  /**
   * Ordered list of injected plugins.
   */
  plugins: [],

  /**
   * Mapping from event name to dispatch config
   */
  eventNameDispatchConfigs: {},

  /**
   * Mapping from registration name to plugin module
   */
  registrationNameModules: {},

  /**
   * Mapping from registration name to event name
   */
  registrationNameDependencies: {},

  /**
   * Injects an ordering of plugins (by plugin name). This allows the ordering
   * to be decoupled from injection of the actual plugins so that ordering is
   * always deterministic regardless of packaging, on-the-fly injection, etc.
   *
   * @param {array} InjectedEventPluginOrder
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginOrder}
   */
  injectEventPluginOrder: function(InjectedEventPluginOrder) {
    ("production" !== "development" ? invariant(
      !EventPluginOrder,
      'EventPluginRegistry: Cannot inject event plugin ordering more than ' +
      'once. You are likely trying to load more than one copy of React.'
    ) : invariant(!EventPluginOrder));
    // Clone the ordering so it cannot be dynamically mutated.
    EventPluginOrder = Array.prototype.slice.call(InjectedEventPluginOrder);
    recomputePluginOrdering();
  },

  /**
   * Injects plugins to be used by `EventPluginHub`. The plugin names must be
   * in the ordering injected by `injectEventPluginOrder`.
   *
   * Plugins can be injected as part of page initialization or on-the-fly.
   *
   * @param {object} injectedNamesToPlugins Map from names to plugin modules.
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginsByName}
   */
  injectEventPluginsByName: function(injectedNamesToPlugins) {
    var isOrderingDirty = false;
    for (var pluginName in injectedNamesToPlugins) {
      if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
        continue;
      }
      var PluginModule = injectedNamesToPlugins[pluginName];
      if (!namesToPlugins.hasOwnProperty(pluginName) ||
          namesToPlugins[pluginName] !== PluginModule) {
        ("production" !== "development" ? invariant(
          !namesToPlugins[pluginName],
          'EventPluginRegistry: Cannot inject two different event plugins ' +
          'using the same name, `%s`.',
          pluginName
        ) : invariant(!namesToPlugins[pluginName]));
        namesToPlugins[pluginName] = PluginModule;
        isOrderingDirty = true;
      }
    }
    if (isOrderingDirty) {
      recomputePluginOrdering();
    }
  },

  /**
   * Looks up the plugin for the supplied event.
   *
   * @param {object} event A synthetic event.
   * @return {?object} The plugin that created the supplied event.
   * @internal
   */
  getPluginModuleForEvent: function(event) {
    var dispatchConfig = event.dispatchConfig;
    if (dispatchConfig.registrationName) {
      return EventPluginRegistry.registrationNameModules[
        dispatchConfig.registrationName
      ] || null;
    }
    for (var phase in dispatchConfig.phasedRegistrationNames) {
      if (!dispatchConfig.phasedRegistrationNames.hasOwnProperty(phase)) {
        continue;
      }
      var PluginModule = EventPluginRegistry.registrationNameModules[
        dispatchConfig.phasedRegistrationNames[phase]
      ];
      if (PluginModule) {
        return PluginModule;
      }
    }
    return null;
  },

  /**
   * Exposed for unit testing.
   * @private
   */
  _resetEventPlugins: function() {
    EventPluginOrder = null;
    for (var pluginName in namesToPlugins) {
      if (namesToPlugins.hasOwnProperty(pluginName)) {
        delete namesToPlugins[pluginName];
      }
    }
    EventPluginRegistry.plugins.length = 0;

    var eventNameDispatchConfigs = EventPluginRegistry.eventNameDispatchConfigs;
    for (var eventName in eventNameDispatchConfigs) {
      if (eventNameDispatchConfigs.hasOwnProperty(eventName)) {
        delete eventNameDispatchConfigs[eventName];
      }
    }

    var registrationNameModules = EventPluginRegistry.registrationNameModules;
    for (var registrationName in registrationNameModules) {
      if (registrationNameModules.hasOwnProperty(registrationName)) {
        delete registrationNameModules[registrationName];
      }
    }
  }

};

module.exports = EventPluginRegistry;

},{"135":135}],19:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPluginUtils
 */

'use strict';

var EventConstants = _dereq_(15);

var invariant = _dereq_(135);

/**
 * Injected dependencies:
 */

/**
 * - `Mount`: [required] Module that can convert between React dom IDs and
 *   actual node references.
 */
var injection = {
  Mount: null,
  injectMount: function(InjectedMount) {
    injection.Mount = InjectedMount;
    if ("production" !== "development") {
      ("production" !== "development" ? invariant(
        InjectedMount && InjectedMount.getNode,
        'EventPluginUtils.injection.injectMount(...): Injected Mount module ' +
        'is missing getNode.'
      ) : invariant(InjectedMount && InjectedMount.getNode));
    }
  }
};

var topLevelTypes = EventConstants.topLevelTypes;

function isEndish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseUp ||
         topLevelType === topLevelTypes.topTouchEnd ||
         topLevelType === topLevelTypes.topTouchCancel;
}

function isMoveish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseMove ||
         topLevelType === topLevelTypes.topTouchMove;
}
function isStartish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseDown ||
         topLevelType === topLevelTypes.topTouchStart;
}


var validateEventDispatches;
if ("production" !== "development") {
  validateEventDispatches = function(event) {
    var dispatchListeners = event._dispatchListeners;
    var dispatchIDs = event._dispatchIDs;

    var listenersIsArr = Array.isArray(dispatchListeners);
    var idsIsArr = Array.isArray(dispatchIDs);
    var IDsLen = idsIsArr ? dispatchIDs.length : dispatchIDs ? 1 : 0;
    var listenersLen = listenersIsArr ?
      dispatchListeners.length :
      dispatchListeners ? 1 : 0;

    ("production" !== "development" ? invariant(
      idsIsArr === listenersIsArr && IDsLen === listenersLen,
      'EventPluginUtils: Invalid `event`.'
    ) : invariant(idsIsArr === listenersIsArr && IDsLen === listenersLen));
  };
}

/**
 * Invokes `cb(event, listener, id)`. Avoids using call if no scope is
 * provided. The `(listener,id)` pair effectively forms the "dispatch" but are
 * kept separate to conserve memory.
 */
function forEachEventDispatch(event, cb) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchIDs = event._dispatchIDs;
  if ("production" !== "development") {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      // Listeners and IDs are two parallel arrays that are always in sync.
      cb(event, dispatchListeners[i], dispatchIDs[i]);
    }
  } else if (dispatchListeners) {
    cb(event, dispatchListeners, dispatchIDs);
  }
}

/**
 * Default implementation of PluginModule.executeDispatch().
 * @param {SyntheticEvent} SyntheticEvent to handle
 * @param {function} Application-level callback
 * @param {string} domID DOM id to pass to the callback.
 */
function executeDispatch(event, listener, domID) {
  event.currentTarget = injection.Mount.getNode(domID);
  var returnValue = listener(event, domID);
  event.currentTarget = null;
  return returnValue;
}

/**
 * Standard/simple iteration through an event's collected dispatches.
 */
function executeDispatchesInOrder(event, cb) {
  forEachEventDispatch(event, cb);
  event._dispatchListeners = null;
  event._dispatchIDs = null;
}

/**
 * Standard/simple iteration through an event's collected dispatches, but stops
 * at the first dispatch execution returning true, and returns that id.
 *
 * @return id of the first dispatch execution who's listener returns true, or
 * null if no listener returned true.
 */
function executeDispatchesInOrderStopAtTrueImpl(event) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchIDs = event._dispatchIDs;
  if ("production" !== "development") {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      // Listeners and IDs are two parallel arrays that are always in sync.
      if (dispatchListeners[i](event, dispatchIDs[i])) {
        return dispatchIDs[i];
      }
    }
  } else if (dispatchListeners) {
    if (dispatchListeners(event, dispatchIDs)) {
      return dispatchIDs;
    }
  }
  return null;
}

/**
 * @see executeDispatchesInOrderStopAtTrueImpl
 */
function executeDispatchesInOrderStopAtTrue(event) {
  var ret = executeDispatchesInOrderStopAtTrueImpl(event);
  event._dispatchIDs = null;
  event._dispatchListeners = null;
  return ret;
}

/**
 * Execution of a "direct" dispatch - there must be at most one dispatch
 * accumulated on the event or it is considered an error. It doesn't really make
 * sense for an event with multiple dispatches (bubbled) to keep track of the
 * return values at each dispatch execution, but it does tend to make sense when
 * dealing with "direct" dispatches.
 *
 * @return The return value of executing the single dispatch.
 */
function executeDirectDispatch(event) {
  if ("production" !== "development") {
    validateEventDispatches(event);
  }
  var dispatchListener = event._dispatchListeners;
  var dispatchID = event._dispatchIDs;
  ("production" !== "development" ? invariant(
    !Array.isArray(dispatchListener),
    'executeDirectDispatch(...): Invalid `event`.'
  ) : invariant(!Array.isArray(dispatchListener)));
  var res = dispatchListener ?
    dispatchListener(event, dispatchID) :
    null;
  event._dispatchListeners = null;
  event._dispatchIDs = null;
  return res;
}

/**
 * @param {SyntheticEvent} event
 * @return {bool} True iff number of dispatches accumulated is greater than 0.
 */
function hasDispatches(event) {
  return !!event._dispatchListeners;
}

/**
 * General utilities that are useful in creating custom Event Plugins.
 */
var EventPluginUtils = {
  isEndish: isEndish,
  isMoveish: isMoveish,
  isStartish: isStartish,

  executeDirectDispatch: executeDirectDispatch,
  executeDispatch: executeDispatch,
  executeDispatchesInOrder: executeDispatchesInOrder,
  executeDispatchesInOrderStopAtTrue: executeDispatchesInOrderStopAtTrue,
  hasDispatches: hasDispatches,
  injection: injection,
  useTouchEvents: false
};

module.exports = EventPluginUtils;

},{"135":135,"15":15}],20:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventPropagators
 */

'use strict';

var EventConstants = _dereq_(15);
var EventPluginHub = _dereq_(17);

var accumulateInto = _dereq_(105);
var forEachAccumulated = _dereq_(120);

var PropagationPhases = EventConstants.PropagationPhases;
var getListener = EventPluginHub.getListener;

/**
 * Some event types have a notion of different registration names for different
 * "phases" of propagation. This finds listeners by a given phase.
 */
function listenerAtPhase(id, event, propagationPhase) {
  var registrationName =
    event.dispatchConfig.phasedRegistrationNames[propagationPhase];
  return getListener(id, registrationName);
}

/**
 * Tags a `SyntheticEvent` with dispatched listeners. Creating this function
 * here, allows us to not have to bind or create functions for each event.
 * Mutating the event's members allows us to not have to create a wrapping
 * "dispatch" object that pairs the event with the listener.
 */
function accumulateDirectionalDispatches(domID, upwards, event) {
  if ("production" !== "development") {
    if (!domID) {
      throw new Error('Dispatching id must not be null');
    }
  }
  var phase = upwards ? PropagationPhases.bubbled : PropagationPhases.captured;
  var listener = listenerAtPhase(domID, event, phase);
  if (listener) {
    event._dispatchListeners =
      accumulateInto(event._dispatchListeners, listener);
    event._dispatchIDs = accumulateInto(event._dispatchIDs, domID);
  }
}

/**
 * Collect dispatches (must be entirely collected before dispatching - see unit
 * tests). Lazily allocate the array to conserve memory.  We must loop through
 * each event and perform the traversal for each one. We can not perform a
 * single traversal for the entire collection of events because each event may
 * have a different target.
 */
function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    EventPluginHub.injection.getInstanceHandle().traverseTwoPhase(
      event.dispatchMarker,
      accumulateDirectionalDispatches,
      event
    );
  }
}


/**
 * Accumulates without regard to direction, does not look for phased
 * registration names. Same as `accumulateDirectDispatchesSingle` but without
 * requiring that the `dispatchMarker` be the same as the dispatched ID.
 */
function accumulateDispatches(id, ignoredDirection, event) {
  if (event && event.dispatchConfig.registrationName) {
    var registrationName = event.dispatchConfig.registrationName;
    var listener = getListener(id, registrationName);
    if (listener) {
      event._dispatchListeners =
        accumulateInto(event._dispatchListeners, listener);
      event._dispatchIDs = accumulateInto(event._dispatchIDs, id);
    }
  }
}

/**
 * Accumulates dispatches on an `SyntheticEvent`, but only for the
 * `dispatchMarker`.
 * @param {SyntheticEvent} event
 */
function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event.dispatchMarker, null, event);
  }
}

function accumulateTwoPhaseDispatches(events) {
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
}

function accumulateEnterLeaveDispatches(leave, enter, fromID, toID) {
  EventPluginHub.injection.getInstanceHandle().traverseEnterLeave(
    fromID,
    toID,
    accumulateDispatches,
    leave,
    enter
  );
}


function accumulateDirectDispatches(events) {
  forEachAccumulated(events, accumulateDirectDispatchesSingle);
}



/**
 * A small set of propagation patterns, each of which will accept a small amount
 * of information, and generate a set of "dispatch ready event objects" - which
 * are sets of events that have already been annotated with a set of dispatched
 * listener functions/ids. The API is designed this way to discourage these
 * propagation strategies from actually executing the dispatches, since we
 * always want to collect the entire set of dispatches before executing event a
 * single one.
 *
 * @constructor EventPropagators
 */
var EventPropagators = {
  accumulateTwoPhaseDispatches: accumulateTwoPhaseDispatches,
  accumulateDirectDispatches: accumulateDirectDispatches,
  accumulateEnterLeaveDispatches: accumulateEnterLeaveDispatches
};

module.exports = EventPropagators;

},{"105":105,"120":120,"15":15,"17":17}],21:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ExecutionEnvironment
 */

/*jslint evil: true */

"use strict";

var canUseDOM = !!(
  (typeof window !== 'undefined' &&
  window.document && window.document.createElement)
);

/**
 * Simple, lightweight module assisting with the detection and context of
 * Worker. Helps avoid circular dependencies and allows code to reason about
 * whether or not they are in a Worker, even if they never include the main
 * `ReactWorker` dependency.
 */
var ExecutionEnvironment = {

  canUseDOM: canUseDOM,

  canUseWorkers: typeof Worker !== 'undefined',

  canUseEventListeners:
    canUseDOM && !!(window.addEventListener || window.attachEvent),

  canUseViewport: canUseDOM && !!window.screen,

  isInWorker: !canUseDOM // For now, this is true - might change in the future.

};

module.exports = ExecutionEnvironment;

},{}],22:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule FallbackCompositionState
 * @typechecks static-only
 */

'use strict';

var PooledClass = _dereq_(28);

var assign = _dereq_(27);
var getTextContentAccessor = _dereq_(130);

/**
 * This helper class stores information about text content of a target node,
 * allowing comparison of content before and after a given event.
 *
 * Identify the node where selection currently begins, then observe
 * both its text content and its current position in the DOM. Since the
 * browser may natively replace the target node during composition, we can
 * use its position to find its replacement.
 *
 * @param {DOMEventTarget} root
 */
function FallbackCompositionState(root) {
  this._root = root;
  this._startText = this.getText();
  this._fallbackText = null;
}

assign(FallbackCompositionState.prototype, {
  /**
   * Get current text of input.
   *
   * @return {string}
   */
  getText: function() {
    if ('value' in this._root) {
      return this._root.value;
    }
    return this._root[getTextContentAccessor()];
  },

  /**
   * Determine the differing substring between the initially stored
   * text content and the current content.
   *
   * @return {string}
   */
  getData: function() {
    if (this._fallbackText) {
      return this._fallbackText;
    }

    var start;
    var startValue = this._startText;
    var startLength = startValue.length;
    var end;
    var endValue = this.getText();
    var endLength = endValue.length;

    for (start = 0; start < startLength; start++) {
      if (startValue[start] !== endValue[start]) {
        break;
      }
    }

    var minEnd = startLength - start;
    for (end = 1; end <= minEnd; end++) {
      if (startValue[startLength - end] !== endValue[endLength - end]) {
        break;
      }
    }

    var sliceTail = end > 1 ? 1 - end : undefined;
    this._fallbackText = endValue.slice(start, sliceTail);
    return this._fallbackText;
  }
});

PooledClass.addPoolingTo(FallbackCompositionState);

module.exports = FallbackCompositionState;

},{"130":130,"27":27,"28":28}],23:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule HTMLDOMPropertyConfig
 */

/*jslint bitwise: true*/

'use strict';

var DOMProperty = _dereq_(10);
var ExecutionEnvironment = _dereq_(21);

var MUST_USE_ATTRIBUTE = DOMProperty.injection.MUST_USE_ATTRIBUTE;
var MUST_USE_PROPERTY = DOMProperty.injection.MUST_USE_PROPERTY;
var HAS_BOOLEAN_VALUE = DOMProperty.injection.HAS_BOOLEAN_VALUE;
var HAS_SIDE_EFFECTS = DOMProperty.injection.HAS_SIDE_EFFECTS;
var HAS_NUMERIC_VALUE = DOMProperty.injection.HAS_NUMERIC_VALUE;
var HAS_POSITIVE_NUMERIC_VALUE =
  DOMProperty.injection.HAS_POSITIVE_NUMERIC_VALUE;
var HAS_OVERLOADED_BOOLEAN_VALUE =
  DOMProperty.injection.HAS_OVERLOADED_BOOLEAN_VALUE;

var hasSVG;
if (ExecutionEnvironment.canUseDOM) {
  var implementation = document.implementation;
  hasSVG = (
    implementation &&
    implementation.hasFeature &&
    implementation.hasFeature(
      'http://www.w3.org/TR/SVG11/feature#BasicStructure',
      '1.1'
    )
  );
}


var HTMLDOMPropertyConfig = {
  isCustomAttribute: RegExp.prototype.test.bind(
    /^(data|aria)-[a-z_][a-z\d_.\-]*$/
  ),
  Properties: {
    /**
     * Standard Properties
     */
    accept: null,
    acceptCharset: null,
    accessKey: null,
    action: null,
    allowFullScreen: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    allowTransparency: MUST_USE_ATTRIBUTE,
    alt: null,
    async: HAS_BOOLEAN_VALUE,
    autoComplete: null,
    // autoFocus is polyfilled/normalized by AutoFocusMixin
    // autoFocus: HAS_BOOLEAN_VALUE,
    autoPlay: HAS_BOOLEAN_VALUE,
    cellPadding: null,
    cellSpacing: null,
    charSet: MUST_USE_ATTRIBUTE,
    checked: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    classID: MUST_USE_ATTRIBUTE,
    // To set className on SVG elements, it's necessary to use .setAttribute;
    // this works on HTML elements too in all browsers except IE8. Conveniently,
    // IE8 doesn't support SVG and so we can simply use the attribute in
    // browsers that support SVG and the property in browsers that don't,
    // regardless of whether the element is HTML or SVG.
    className: hasSVG ? MUST_USE_ATTRIBUTE : MUST_USE_PROPERTY,
    cols: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    colSpan: null,
    content: null,
    contentEditable: null,
    contextMenu: MUST_USE_ATTRIBUTE,
    controls: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    coords: null,
    crossOrigin: null,
    data: null, // For `<object />` acts as `src`.
    dateTime: MUST_USE_ATTRIBUTE,
    defer: HAS_BOOLEAN_VALUE,
    dir: null,
    disabled: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    download: HAS_OVERLOADED_BOOLEAN_VALUE,
    draggable: null,
    encType: null,
    form: MUST_USE_ATTRIBUTE,
    formAction: MUST_USE_ATTRIBUTE,
    formEncType: MUST_USE_ATTRIBUTE,
    formMethod: MUST_USE_ATTRIBUTE,
    formNoValidate: HAS_BOOLEAN_VALUE,
    formTarget: MUST_USE_ATTRIBUTE,
    frameBorder: MUST_USE_ATTRIBUTE,
    headers: null,
    height: MUST_USE_ATTRIBUTE,
    hidden: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    high: null,
    href: null,
    hrefLang: null,
    htmlFor: null,
    httpEquiv: null,
    icon: null,
    id: MUST_USE_PROPERTY,
    label: null,
    lang: null,
    list: MUST_USE_ATTRIBUTE,
    loop: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    low: null,
    manifest: MUST_USE_ATTRIBUTE,
    marginHeight: null,
    marginWidth: null,
    max: null,
    maxLength: MUST_USE_ATTRIBUTE,
    media: MUST_USE_ATTRIBUTE,
    mediaGroup: null,
    method: null,
    min: null,
    multiple: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    muted: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    name: null,
    noValidate: HAS_BOOLEAN_VALUE,
    open: HAS_BOOLEAN_VALUE,
    optimum: null,
    pattern: null,
    placeholder: null,
    poster: null,
    preload: null,
    radioGroup: null,
    readOnly: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    rel: null,
    required: HAS_BOOLEAN_VALUE,
    role: MUST_USE_ATTRIBUTE,
    rows: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    rowSpan: null,
    sandbox: null,
    scope: null,
    scoped: HAS_BOOLEAN_VALUE,
    scrolling: null,
    seamless: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    selected: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    shape: null,
    size: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    sizes: MUST_USE_ATTRIBUTE,
    span: HAS_POSITIVE_NUMERIC_VALUE,
    spellCheck: null,
    src: null,
    srcDoc: MUST_USE_PROPERTY,
    srcSet: MUST_USE_ATTRIBUTE,
    start: HAS_NUMERIC_VALUE,
    step: null,
    style: null,
    tabIndex: null,
    target: null,
    title: null,
    type: null,
    useMap: null,
    value: MUST_USE_PROPERTY | HAS_SIDE_EFFECTS,
    width: MUST_USE_ATTRIBUTE,
    wmode: MUST_USE_ATTRIBUTE,

    /**
     * Non-standard Properties
     */
    // autoCapitalize and autoCorrect are supported in Mobile Safari for
    // keyboard hints.
    autoCapitalize: null,
    autoCorrect: null,
    // itemProp, itemScope, itemType are for
    // Microdata support. See http://schema.org/docs/gs.html
    itemProp: MUST_USE_ATTRIBUTE,
    itemScope: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    itemType: MUST_USE_ATTRIBUTE,
    // itemID and itemRef are for Microdata support as well but
    // only specified in the the WHATWG spec document. See
    // https://html.spec.whatwg.org/multipage/microdata.html#microdata-dom-api
    itemID: MUST_USE_ATTRIBUTE,
    itemRef: MUST_USE_ATTRIBUTE,
    // property is supported for OpenGraph in meta tags.
    property: null,
    // IE-only attribute that controls focus behavior
    unselectable: MUST_USE_ATTRIBUTE
  },
  DOMAttributeNames: {
    acceptCharset: 'accept-charset',
    className: 'class',
    htmlFor: 'for',
    httpEquiv: 'http-equiv'
  },
  DOMPropertyNames: {
    autoCapitalize: 'autocapitalize',
    autoComplete: 'autocomplete',
    autoCorrect: 'autocorrect',
    autoFocus: 'autofocus',
    autoPlay: 'autoplay',
    // `encoding` is equivalent to `enctype`, IE8 lacks an `enctype` setter.
    // http://www.w3.org/TR/html5/forms.html#dom-fs-encoding
    encType: 'encoding',
    hrefLang: 'hreflang',
    radioGroup: 'radiogroup',
    spellCheck: 'spellcheck',
    srcDoc: 'srcdoc',
    srcSet: 'srcset'
  }
};

module.exports = HTMLDOMPropertyConfig;

},{"10":10,"21":21}],24:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule LinkedValueUtils
 * @typechecks static-only
 */

'use strict';

var ReactPropTypes = _dereq_(78);

var invariant = _dereq_(135);

var hasReadOnlyValue = {
  'button': true,
  'checkbox': true,
  'image': true,
  'hidden': true,
  'radio': true,
  'reset': true,
  'submit': true
};

function _assertSingleLink(input) {
  ("production" !== "development" ? invariant(
    input.props.checkedLink == null || input.props.valueLink == null,
    'Cannot provide a checkedLink and a valueLink. If you want to use ' +
    'checkedLink, you probably don\'t want to use valueLink and vice versa.'
  ) : invariant(input.props.checkedLink == null || input.props.valueLink == null));
}
function _assertValueLink(input) {
  _assertSingleLink(input);
  ("production" !== "development" ? invariant(
    input.props.value == null && input.props.onChange == null,
    'Cannot provide a valueLink and a value or onChange event. If you want ' +
    'to use value or onChange, you probably don\'t want to use valueLink.'
  ) : invariant(input.props.value == null && input.props.onChange == null));
}

function _assertCheckedLink(input) {
  _assertSingleLink(input);
  ("production" !== "development" ? invariant(
    input.props.checked == null && input.props.onChange == null,
    'Cannot provide a checkedLink and a checked property or onChange event. ' +
    'If you want to use checked or onChange, you probably don\'t want to ' +
    'use checkedLink'
  ) : invariant(input.props.checked == null && input.props.onChange == null));
}

/**
 * @param {SyntheticEvent} e change event to handle
 */
function _handleLinkedValueChange(e) {
  /*jshint validthis:true */
  this.props.valueLink.requestChange(e.target.value);
}

/**
  * @param {SyntheticEvent} e change event to handle
  */
function _handleLinkedCheckChange(e) {
  /*jshint validthis:true */
  this.props.checkedLink.requestChange(e.target.checked);
}

/**
 * Provide a linked `value` attribute for controlled forms. You should not use
 * this outside of the ReactDOM controlled form components.
 */
var LinkedValueUtils = {
  Mixin: {
    propTypes: {
      value: function(props, propName, componentName) {
        if (!props[propName] ||
            hasReadOnlyValue[props.type] ||
            props.onChange ||
            props.readOnly ||
            props.disabled) {
          return null;
        }
        return new Error(
          'You provided a `value` prop to a form field without an ' +
          '`onChange` handler. This will render a read-only field. If ' +
          'the field should be mutable use `defaultValue`. Otherwise, ' +
          'set either `onChange` or `readOnly`.'
        );
      },
      checked: function(props, propName, componentName) {
        if (!props[propName] ||
            props.onChange ||
            props.readOnly ||
            props.disabled) {
          return null;
        }
        return new Error(
          'You provided a `checked` prop to a form field without an ' +
          '`onChange` handler. This will render a read-only field. If ' +
          'the field should be mutable use `defaultChecked`. Otherwise, ' +
          'set either `onChange` or `readOnly`.'
        );
      },
      onChange: ReactPropTypes.func
    }
  },

  /**
   * @param {ReactComponent} input Form component
   * @return {*} current value of the input either from value prop or link.
   */
  getValue: function(input) {
    if (input.props.valueLink) {
      _assertValueLink(input);
      return input.props.valueLink.value;
    }
    return input.props.value;
  },

  /**
   * @param {ReactComponent} input Form component
   * @return {*} current checked status of the input either from checked prop
   *             or link.
   */
  getChecked: function(input) {
    if (input.props.checkedLink) {
      _assertCheckedLink(input);
      return input.props.checkedLink.value;
    }
    return input.props.checked;
  },

  /**
   * @param {ReactComponent} input Form component
   * @return {function} change callback either from onChange prop or link.
   */
  getOnChange: function(input) {
    if (input.props.valueLink) {
      _assertValueLink(input);
      return _handleLinkedValueChange;
    } else if (input.props.checkedLink) {
      _assertCheckedLink(input);
      return _handleLinkedCheckChange;
    }
    return input.props.onChange;
  }
};

module.exports = LinkedValueUtils;

},{"135":135,"78":78}],25:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule LocalEventTrapMixin
 */

'use strict';

var ReactBrowserEventEmitter = _dereq_(30);

var accumulateInto = _dereq_(105);
var forEachAccumulated = _dereq_(120);
var invariant = _dereq_(135);

function remove(event) {
  event.remove();
}

var LocalEventTrapMixin = {
  trapBubbledEvent:function(topLevelType, handlerBaseName) {
    ("production" !== "development" ? invariant(this.isMounted(), 'Must be mounted to trap events') : invariant(this.isMounted()));
    // If a component renders to null or if another component fatals and causes
    // the state of the tree to be corrupted, `node` here can be null.
    var node = this.getDOMNode();
    ("production" !== "development" ? invariant(
      node,
      'LocalEventTrapMixin.trapBubbledEvent(...): Requires node to be rendered.'
    ) : invariant(node));
    var listener = ReactBrowserEventEmitter.trapBubbledEvent(
      topLevelType,
      handlerBaseName,
      node
    );
    this._localEventListeners =
      accumulateInto(this._localEventListeners, listener);
  },

  // trapCapturedEvent would look nearly identical. We don't implement that
  // method because it isn't currently needed.

  componentWillUnmount:function() {
    if (this._localEventListeners) {
      forEachAccumulated(this._localEventListeners, remove);
    }
  }
};

module.exports = LocalEventTrapMixin;

},{"105":105,"120":120,"135":135,"30":30}],26:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule MobileSafariClickEventPlugin
 * @typechecks static-only
 */

'use strict';

var EventConstants = _dereq_(15);

var emptyFunction = _dereq_(114);

var topLevelTypes = EventConstants.topLevelTypes;

/**
 * Mobile Safari does not fire properly bubble click events on non-interactive
 * elements, which means delegated click listeners do not fire. The workaround
 * for this bug involves attaching an empty click listener on the target node.
 *
 * This particular plugin works around the bug by attaching an empty click
 * listener on `touchstart` (which does fire on every element).
 */
var MobileSafariClickEventPlugin = {

  eventTypes: null,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    if (topLevelType === topLevelTypes.topTouchStart) {
      var target = nativeEvent.target;
      if (target && !target.onclick) {
        target.onclick = emptyFunction;
      }
    }
  }

};

module.exports = MobileSafariClickEventPlugin;

},{"114":114,"15":15}],27:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Object.assign
 */

// https://people.mozilla.org/~jorendorff/es6-draft.html#sec-object.assign

'use strict';

function assign(target, sources) {
  if (target == null) {
    throw new TypeError('Object.assign target cannot be null or undefined');
  }

  var to = Object(target);
  var hasOwnProperty = Object.prototype.hasOwnProperty;

  for (var nextIndex = 1; nextIndex < arguments.length; nextIndex++) {
    var nextSource = arguments[nextIndex];
    if (nextSource == null) {
      continue;
    }

    var from = Object(nextSource);

    // We don't currently support accessors nor proxies. Therefore this
    // copy cannot throw. If we ever supported this then we must handle
    // exceptions and side-effects. We don't support symbols so they won't
    // be transferred.

    for (var key in from) {
      if (hasOwnProperty.call(from, key)) {
        to[key] = from[key];
      }
    }
  }

  return to;
}

module.exports = assign;

},{}],28:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule PooledClass
 */

'use strict';

var invariant = _dereq_(135);

/**
 * Static poolers. Several custom versions for each potential number of
 * arguments. A completely generic pooler is easy to implement, but would
 * require accessing the `arguments` object. In each of these, `this` refers to
 * the Class itself, not an instance. If any others are needed, simply add them
 * here, or in their own files.
 */
var oneArgumentPooler = function(copyFieldsFrom) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, copyFieldsFrom);
    return instance;
  } else {
    return new Klass(copyFieldsFrom);
  }
};

var twoArgumentPooler = function(a1, a2) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2);
    return instance;
  } else {
    return new Klass(a1, a2);
  }
};

var threeArgumentPooler = function(a1, a2, a3) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3);
    return instance;
  } else {
    return new Klass(a1, a2, a3);
  }
};

var fiveArgumentPooler = function(a1, a2, a3, a4, a5) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4, a5);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4, a5);
  }
};

var standardReleaser = function(instance) {
  var Klass = this;
  ("production" !== "development" ? invariant(
    instance instanceof Klass,
    'Trying to release an instance into a pool of a different type.'
  ) : invariant(instance instanceof Klass));
  if (instance.destructor) {
    instance.destructor();
  }
  if (Klass.instancePool.length < Klass.poolSize) {
    Klass.instancePool.push(instance);
  }
};

var DEFAULT_POOL_SIZE = 10;
var DEFAULT_POOLER = oneArgumentPooler;

/**
 * Augments `CopyConstructor` to be a poolable class, augmenting only the class
 * itself (statically) not adding any prototypical fields. Any CopyConstructor
 * you give this may have a `poolSize` property, and will look for a
 * prototypical `destructor` on instances (optional).
 *
 * @param {Function} CopyConstructor Constructor that can be used to reset.
 * @param {Function} pooler Customizable pooler.
 */
var addPoolingTo = function(CopyConstructor, pooler) {
  var NewKlass = CopyConstructor;
  NewKlass.instancePool = [];
  NewKlass.getPooled = pooler || DEFAULT_POOLER;
  if (!NewKlass.poolSize) {
    NewKlass.poolSize = DEFAULT_POOL_SIZE;
  }
  NewKlass.release = standardReleaser;
  return NewKlass;
};

var PooledClass = {
  addPoolingTo: addPoolingTo,
  oneArgumentPooler: oneArgumentPooler,
  twoArgumentPooler: twoArgumentPooler,
  threeArgumentPooler: threeArgumentPooler,
  fiveArgumentPooler: fiveArgumentPooler
};

module.exports = PooledClass;

},{"135":135}],29:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactBrowserComponentMixin
 */

'use strict';

var findDOMNode = _dereq_(117);

var ReactBrowserComponentMixin = {
  /**
   * Returns the DOM node rendered by this component.
   *
   * @return {DOMElement} The root node of this component.
   * @final
   * @protected
   */
  getDOMNode: function() {
    return findDOMNode(this);
  }
};

module.exports = ReactBrowserComponentMixin;

},{"117":117}],30:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactBrowserEventEmitter
 * @typechecks static-only
 */

'use strict';

var EventConstants = _dereq_(15);
var EventPluginHub = _dereq_(17);
var EventPluginRegistry = _dereq_(18);
var ReactEventEmitterMixin = _dereq_(61);
var ViewportMetrics = _dereq_(104);

var assign = _dereq_(27);
var isEventSupported = _dereq_(136);

/**
 * Summary of `ReactBrowserEventEmitter` event handling:
 *
 *  - Top-level delegation is used to trap most native browser events. This
 *    may only occur in the main thread and is the responsibility of
 *    ReactEventListener, which is injected and can therefore support pluggable
 *    event sources. This is the only work that occurs in the main thread.
 *
 *  - We normalize and de-duplicate events to account for browser quirks. This
 *    may be done in the worker thread.
 *
 *  - Forward these native events (with the associated top-level type used to
 *    trap it) to `EventPluginHub`, which in turn will ask plugins if they want
 *    to extract any synthetic events.
 *
 *  - The `EventPluginHub` will then process each event by annotating them with
 *    "dispatches", a sequence of listeners and IDs that care about that event.
 *
 *  - The `EventPluginHub` then dispatches the events.
 *
 * Overview of React and the event system:
 *
 * +------------+    .
 * |    DOM     |    .
 * +------------+    .
 *       |           .
 *       v           .
 * +------------+    .
 * | ReactEvent |    .
 * |  Listener  |    .
 * +------------+    .                         +-----------+
 *       |           .               +--------+|SimpleEvent|
 *       |           .               |         |Plugin     |
 * +-----|------+    .               v         +-----------+
 * |     |      |    .    +--------------+                    +------------+
 * |     +-----------.--->|EventPluginHub|                    |    Event   |
 * |            |    .    |              |     +-----------+  | Propagators|
 * | ReactEvent |    .    |              |     |TapEvent   |  |------------|
 * |  Emitter   |    .    |              |<---+|Plugin     |  |other plugin|
 * |            |    .    |              |     +-----------+  |  utilities |
 * |     +-----------.--->|              |                    +------------+
 * |     |      |    .    +--------------+
 * +-----|------+    .                ^        +-----------+
 *       |           .                |        |Enter/Leave|
 *       +           .                +-------+|Plugin     |
 * +-------------+   .                         +-----------+
 * | application |   .
 * |-------------|   .
 * |             |   .
 * |             |   .
 * +-------------+   .
 *                   .
 *    React Core     .  General Purpose Event Plugin System
 */

var alreadyListeningTo = {};
var isMonitoringScrollValue = false;
var reactTopListenersCounter = 0;

// For events like 'submit' which don't consistently bubble (which we trap at a
// lower node than `document`), binding at `document` would cause duplicate
// events so we don't include them here
var topEventMapping = {
  topBlur: 'blur',
  topChange: 'change',
  topClick: 'click',
  topCompositionEnd: 'compositionend',
  topCompositionStart: 'compositionstart',
  topCompositionUpdate: 'compositionupdate',
  topContextMenu: 'contextmenu',
  topCopy: 'copy',
  topCut: 'cut',
  topDoubleClick: 'dblclick',
  topDrag: 'drag',
  topDragEnd: 'dragend',
  topDragEnter: 'dragenter',
  topDragExit: 'dragexit',
  topDragLeave: 'dragleave',
  topDragOver: 'dragover',
  topDragStart: 'dragstart',
  topDrop: 'drop',
  topFocus: 'focus',
  topInput: 'input',
  topKeyDown: 'keydown',
  topKeyPress: 'keypress',
  topKeyUp: 'keyup',
  topMouseDown: 'mousedown',
  topMouseMove: 'mousemove',
  topMouseOut: 'mouseout',
  topMouseOver: 'mouseover',
  topMouseUp: 'mouseup',
  topPaste: 'paste',
  topScroll: 'scroll',
  topSelectionChange: 'selectionchange',
  topTextInput: 'textInput',
  topTouchCancel: 'touchcancel',
  topTouchEnd: 'touchend',
  topTouchMove: 'touchmove',
  topTouchStart: 'touchstart',
  topWheel: 'wheel'
};

/**
 * To ensure no conflicts with other potential React instances on the page
 */
var topListenersIDKey = '_reactListenersID' + String(Math.random()).slice(2);

function getListeningForDocument(mountAt) {
  // In IE8, `mountAt` is a host object and doesn't have `hasOwnProperty`
  // directly.
  if (!Object.prototype.hasOwnProperty.call(mountAt, topListenersIDKey)) {
    mountAt[topListenersIDKey] = reactTopListenersCounter++;
    alreadyListeningTo[mountAt[topListenersIDKey]] = {};
  }
  return alreadyListeningTo[mountAt[topListenersIDKey]];
}

/**
 * `ReactBrowserEventEmitter` is used to attach top-level event listeners. For
 * example:
 *
 *   ReactBrowserEventEmitter.putListener('myID', 'onClick', myFunction);
 *
 * This would allocate a "registration" of `('onClick', myFunction)` on 'myID'.
 *
 * @internal
 */
var ReactBrowserEventEmitter = assign({}, ReactEventEmitterMixin, {

  /**
   * Injectable event backend
   */
  ReactEventListener: null,

  injection: {
    /**
     * @param {object} ReactEventListener
     */
    injectReactEventListener: function(ReactEventListener) {
      ReactEventListener.setHandleTopLevel(
        ReactBrowserEventEmitter.handleTopLevel
      );
      ReactBrowserEventEmitter.ReactEventListener = ReactEventListener;
    }
  },

  /**
   * Sets whether or not any created callbacks should be enabled.
   *
   * @param {boolean} enabled True if callbacks should be enabled.
   */
  setEnabled: function(enabled) {
    if (ReactBrowserEventEmitter.ReactEventListener) {
      ReactBrowserEventEmitter.ReactEventListener.setEnabled(enabled);
    }
  },

  /**
   * @return {boolean} True if callbacks are enabled.
   */
  isEnabled: function() {
    return !!(
      (ReactBrowserEventEmitter.ReactEventListener && ReactBrowserEventEmitter.ReactEventListener.isEnabled())
    );
  },

  /**
   * We listen for bubbled touch events on the document object.
   *
   * Firefox v8.01 (and possibly others) exhibited strange behavior when
   * mounting `onmousemove` events at some node that was not the document
   * element. The symptoms were that if your mouse is not moving over something
   * contained within that mount point (for example on the background) the
   * top-level listeners for `onmousemove` won't be called. However, if you
   * register the `mousemove` on the document object, then it will of course
   * catch all `mousemove`s. This along with iOS quirks, justifies restricting
   * top-level listeners to the document object only, at least for these
   * movement types of events and possibly all events.
   *
   * @see http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
   *
   * Also, `keyup`/`keypress`/`keydown` do not bubble to the window on IE, but
   * they bubble to document.
   *
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @param {object} contentDocumentHandle Document which owns the container
   */
  listenTo: function(registrationName, contentDocumentHandle) {
    var mountAt = contentDocumentHandle;
    var isListening = getListeningForDocument(mountAt);
    var dependencies = EventPluginRegistry.
      registrationNameDependencies[registrationName];

    var topLevelTypes = EventConstants.topLevelTypes;
    for (var i = 0, l = dependencies.length; i < l; i++) {
      var dependency = dependencies[i];
      if (!(
            (isListening.hasOwnProperty(dependency) && isListening[dependency])
          )) {
        if (dependency === topLevelTypes.topWheel) {
          if (isEventSupported('wheel')) {
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(
              topLevelTypes.topWheel,
              'wheel',
              mountAt
            );
          } else if (isEventSupported('mousewheel')) {
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(
              topLevelTypes.topWheel,
              'mousewheel',
              mountAt
            );
          } else {
            // Firefox needs to capture a different mouse scroll event.
            // @see http://www.quirksmode.org/dom/events/tests/scroll.html
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(
              topLevelTypes.topWheel,
              'DOMMouseScroll',
              mountAt
            );
          }
        } else if (dependency === topLevelTypes.topScroll) {

          if (isEventSupported('scroll', true)) {
            ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(
              topLevelTypes.topScroll,
              'scroll',
              mountAt
            );
          } else {
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(
              topLevelTypes.topScroll,
              'scroll',
              ReactBrowserEventEmitter.ReactEventListener.WINDOW_HANDLE
            );
          }
        } else if (dependency === topLevelTypes.topFocus ||
            dependency === topLevelTypes.topBlur) {

          if (isEventSupported('focus', true)) {
            ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(
              topLevelTypes.topFocus,
              'focus',
              mountAt
            );
            ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(
              topLevelTypes.topBlur,
              'blur',
              mountAt
            );
          } else if (isEventSupported('focusin')) {
            // IE has `focusin` and `focusout` events which bubble.
            // @see http://www.quirksmode.org/blog/archives/2008/04/delegating_the.html
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(
              topLevelTypes.topFocus,
              'focusin',
              mountAt
            );
            ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(
              topLevelTypes.topBlur,
              'focusout',
              mountAt
            );
          }

          // to make sure blur and focus event listeners are only attached once
          isListening[topLevelTypes.topBlur] = true;
          isListening[topLevelTypes.topFocus] = true;
        } else if (topEventMapping.hasOwnProperty(dependency)) {
          ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(
            dependency,
            topEventMapping[dependency],
            mountAt
          );
        }

        isListening[dependency] = true;
      }
    }
  },

  trapBubbledEvent: function(topLevelType, handlerBaseName, handle) {
    return ReactBrowserEventEmitter.ReactEventListener.trapBubbledEvent(
      topLevelType,
      handlerBaseName,
      handle
    );
  },

  trapCapturedEvent: function(topLevelType, handlerBaseName, handle) {
    return ReactBrowserEventEmitter.ReactEventListener.trapCapturedEvent(
      topLevelType,
      handlerBaseName,
      handle
    );
  },

  /**
   * Listens to window scroll and resize events. We cache scroll values so that
   * application code can access them without triggering reflows.
   *
   * NOTE: Scroll events do not bubble.
   *
   * @see http://www.quirksmode.org/dom/events/scroll.html
   */
  ensureScrollValueMonitoring: function() {
    if (!isMonitoringScrollValue) {
      var refresh = ViewportMetrics.refreshScrollValues;
      ReactBrowserEventEmitter.ReactEventListener.monitorScrollValue(refresh);
      isMonitoringScrollValue = true;
    }
  },

  eventNameDispatchConfigs: EventPluginHub.eventNameDispatchConfigs,

  registrationNameModules: EventPluginHub.registrationNameModules,

  putListener: EventPluginHub.putListener,

  getListener: EventPluginHub.getListener,

  deleteListener: EventPluginHub.deleteListener,

  deleteAllListeners: EventPluginHub.deleteAllListeners

});

module.exports = ReactBrowserEventEmitter;

},{"104":104,"136":136,"15":15,"17":17,"18":18,"27":27,"61":61}],31:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactChildReconciler
 * @typechecks static-only
 */

'use strict';

var ReactReconciler = _dereq_(81);

var flattenChildren = _dereq_(118);
var instantiateReactComponent = _dereq_(134);
var shouldUpdateReactComponent = _dereq_(151);

/**
 * ReactChildReconciler provides helpers for initializing or updating a set of
 * children. Its output is suitable for passing it onto ReactMultiChild which
 * does diffed reordering and insertion.
 */
var ReactChildReconciler = {

  /**
   * Generates a "mount image" for each of the supplied children. In the case
   * of `ReactDOMComponent`, a mount image is a string of markup.
   *
   * @param {?object} nestedChildNodes Nested child maps.
   * @return {?object} A set of child instances.
   * @internal
   */
  instantiateChildren: function(nestedChildNodes, transaction, context) {
    var children = flattenChildren(nestedChildNodes);
    for (var name in children) {
      if (children.hasOwnProperty(name)) {
        var child = children[name];
        // The rendered children must be turned into instances as they're
        // mounted.
        var childInstance = instantiateReactComponent(child, null);
        children[name] = childInstance;
      }
    }
    return children;
  },

  /**
   * Updates the rendered children and returns a new set of children.
   *
   * @param {?object} prevChildren Previously initialized set of children.
   * @param {?object} nextNestedChildNodes Nested child maps.
   * @param {ReactReconcileTransaction} transaction
   * @param {object} context
   * @return {?object} A new set of child instances.
   * @internal
   */
  updateChildren: function(
    prevChildren,
    nextNestedChildNodes,
    transaction,
    context) {
    // We currently don't have a way to track moves here but if we use iterators
    // instead of for..in we can zip the iterators and check if an item has
    // moved.
    // TODO: If nothing has changed, return the prevChildren object so that we
    // can quickly bailout if nothing has changed.
    var nextChildren = flattenChildren(nextNestedChildNodes);
    if (!nextChildren && !prevChildren) {
      return null;
    }
    var name;
    for (name in nextChildren) {
      if (!nextChildren.hasOwnProperty(name)) {
        continue;
      }
      var prevChild = prevChildren && prevChildren[name];
      var prevElement = prevChild && prevChild._currentElement;
      var nextElement = nextChildren[name];
      if (shouldUpdateReactComponent(prevElement, nextElement)) {
        ReactReconciler.receiveComponent(
          prevChild, nextElement, transaction, context
        );
        nextChildren[name] = prevChild;
      } else {
        if (prevChild) {
          ReactReconciler.unmountComponent(prevChild, name);
        }
        // The child must be instantiated before it's mounted.
        var nextChildInstance = instantiateReactComponent(
          nextElement,
          null
        );
        nextChildren[name] = nextChildInstance;
      }
    }
    // Unmount children that are no longer present.
    for (name in prevChildren) {
      if (prevChildren.hasOwnProperty(name) &&
          !(nextChildren && nextChildren.hasOwnProperty(name))) {
        ReactReconciler.unmountComponent(prevChildren[name]);
      }
    }
    return nextChildren;
  },

  /**
   * Unmounts all rendered children. This should be used to clean up children
   * when this component is unmounted.
   *
   * @param {?object} renderedChildren Previously initialized set of children.
   * @internal
   */
  unmountChildren: function(renderedChildren) {
    for (var name in renderedChildren) {
      var renderedChild = renderedChildren[name];
      ReactReconciler.unmountComponent(renderedChild);
    }
  }

};

module.exports = ReactChildReconciler;

},{"118":118,"134":134,"151":151,"81":81}],32:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactChildren
 */

'use strict';

var PooledClass = _dereq_(28);
var ReactFragment = _dereq_(63);

var traverseAllChildren = _dereq_(153);
var warning = _dereq_(154);

var twoArgumentPooler = PooledClass.twoArgumentPooler;
var threeArgumentPooler = PooledClass.threeArgumentPooler;

/**
 * PooledClass representing the bookkeeping associated with performing a child
 * traversal. Allows avoiding binding callbacks.
 *
 * @constructor ForEachBookKeeping
 * @param {!function} forEachFunction Function to perform traversal with.
 * @param {?*} forEachContext Context to perform context with.
 */
function ForEachBookKeeping(forEachFunction, forEachContext) {
  this.forEachFunction = forEachFunction;
  this.forEachContext = forEachContext;
}
PooledClass.addPoolingTo(ForEachBookKeeping, twoArgumentPooler);

function forEachSingleChild(traverseContext, child, name, i) {
  var forEachBookKeeping = traverseContext;
  forEachBookKeeping.forEachFunction.call(
    forEachBookKeeping.forEachContext, child, i);
}

/**
 * Iterates through children that are typically specified as `props.children`.
 *
 * The provided forEachFunc(child, index) will be called for each
 * leaf child.
 *
 * @param {?*} children Children tree container.
 * @param {function(*, int)} forEachFunc.
 * @param {*} forEachContext Context for forEachContext.
 */
function forEachChildren(children, forEachFunc, forEachContext) {
  if (children == null) {
    return children;
  }

  var traverseContext =
    ForEachBookKeeping.getPooled(forEachFunc, forEachContext);
  traverseAllChildren(children, forEachSingleChild, traverseContext);
  ForEachBookKeeping.release(traverseContext);
}

/**
 * PooledClass representing the bookkeeping associated with performing a child
 * mapping. Allows avoiding binding callbacks.
 *
 * @constructor MapBookKeeping
 * @param {!*} mapResult Object containing the ordered map of results.
 * @param {!function} mapFunction Function to perform mapping with.
 * @param {?*} mapContext Context to perform mapping with.
 */
function MapBookKeeping(mapResult, mapFunction, mapContext) {
  this.mapResult = mapResult;
  this.mapFunction = mapFunction;
  this.mapContext = mapContext;
}
PooledClass.addPoolingTo(MapBookKeeping, threeArgumentPooler);

function mapSingleChildIntoContext(traverseContext, child, name, i) {
  var mapBookKeeping = traverseContext;
  var mapResult = mapBookKeeping.mapResult;

  var keyUnique = !mapResult.hasOwnProperty(name);
  if ("production" !== "development") {
    ("production" !== "development" ? warning(
      keyUnique,
      'ReactChildren.map(...): Encountered two children with the same key, ' +
      '`%s`. Child keys must be unique; when two children share a key, only ' +
      'the first child will be used.',
      name
    ) : null);
  }

  if (keyUnique) {
    var mappedChild =
      mapBookKeeping.mapFunction.call(mapBookKeeping.mapContext, child, i);
    mapResult[name] = mappedChild;
  }
}

/**
 * Maps children that are typically specified as `props.children`.
 *
 * The provided mapFunction(child, key, index) will be called for each
 * leaf child.
 *
 * TODO: This may likely break any calls to `ReactChildren.map` that were
 * previously relying on the fact that we guarded against null children.
 *
 * @param {?*} children Children tree container.
 * @param {function(*, int)} mapFunction.
 * @param {*} mapContext Context for mapFunction.
 * @return {object} Object containing the ordered map of results.
 */
function mapChildren(children, func, context) {
  if (children == null) {
    return children;
  }

  var mapResult = {};
  var traverseContext = MapBookKeeping.getPooled(mapResult, func, context);
  traverseAllChildren(children, mapSingleChildIntoContext, traverseContext);
  MapBookKeeping.release(traverseContext);
  return ReactFragment.create(mapResult);
}

function forEachSingleChildDummy(traverseContext, child, name, i) {
  return null;
}

/**
 * Count the number of children that are typically specified as
 * `props.children`.
 *
 * @param {?*} children Children tree container.
 * @return {number} The number of children.
 */
function countChildren(children, context) {
  return traverseAllChildren(children, forEachSingleChildDummy, null);
}

var ReactChildren = {
  forEach: forEachChildren,
  map: mapChildren,
  count: countChildren
};

module.exports = ReactChildren;

},{"153":153,"154":154,"28":28,"63":63}],33:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactClass
 */

'use strict';

var ReactComponent = _dereq_(34);
var ReactCurrentOwner = _dereq_(39);
var ReactElement = _dereq_(57);
var ReactErrorUtils = _dereq_(60);
var ReactInstanceMap = _dereq_(67);
var ReactLifeCycle = _dereq_(68);
var ReactPropTypeLocations = _dereq_(77);
var ReactPropTypeLocationNames = _dereq_(76);
var ReactUpdateQueue = _dereq_(86);

var assign = _dereq_(27);
var invariant = _dereq_(135);
var keyMirror = _dereq_(140);
var keyOf = _dereq_(141);
var warning = _dereq_(154);

var MIXINS_KEY = keyOf({mixins: null});

/**
 * Policies that describe methods in `ReactClassInterface`.
 */
var SpecPolicy = keyMirror({
  /**
   * These methods may be defined only once by the class specification or mixin.
   */
  DEFINE_ONCE: null,
  /**
   * These methods may be defined by both the class specification and mixins.
   * Subsequent definitions will be chained. These methods must return void.
   */
  DEFINE_MANY: null,
  /**
   * These methods are overriding the base class.
   */
  OVERRIDE_BASE: null,
  /**
   * These methods are similar to DEFINE_MANY, except we assume they return
   * objects. We try to merge the keys of the return values of all the mixed in
   * functions. If there is a key conflict we throw.
   */
  DEFINE_MANY_MERGED: null
});


var injectedMixins = [];

/**
 * Composite components are higher-level components that compose other composite
 * or native components.
 *
 * To create a new type of `ReactClass`, pass a specification of
 * your new class to `React.createClass`. The only requirement of your class
 * specification is that you implement a `render` method.
 *
 *   var MyComponent = React.createClass({
 *     render: function() {
 *       return <div>Hello World</div>;
 *     }
 *   });
 *
 * The class specification supports a specific protocol of methods that have
 * special meaning (e.g. `render`). See `ReactClassInterface` for
 * more the comprehensive protocol. Any other properties and methods in the
 * class specification will available on the prototype.
 *
 * @interface ReactClassInterface
 * @internal
 */
var ReactClassInterface = {

  /**
   * An array of Mixin objects to include when defining your component.
   *
   * @type {array}
   * @optional
   */
  mixins: SpecPolicy.DEFINE_MANY,

  /**
   * An object containing properties and methods that should be defined on
   * the component's constructor instead of its prototype (static methods).
   *
   * @type {object}
   * @optional
   */
  statics: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of prop types for this component.
   *
   * @type {object}
   * @optional
   */
  propTypes: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of context types for this component.
   *
   * @type {object}
   * @optional
   */
  contextTypes: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of context types this component sets for its children.
   *
   * @type {object}
   * @optional
   */
  childContextTypes: SpecPolicy.DEFINE_MANY,

  // ==== Definition methods ====

  /**
   * Invoked when the component is mounted. Values in the mapping will be set on
   * `this.props` if that prop is not specified (i.e. using an `in` check).
   *
   * This method is invoked before `getInitialState` and therefore cannot rely
   * on `this.state` or use `this.setState`.
   *
   * @return {object}
   * @optional
   */
  getDefaultProps: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * Invoked once before the component is mounted. The return value will be used
   * as the initial value of `this.state`.
   *
   *   getInitialState: function() {
   *     return {
   *       isOn: false,
   *       fooBaz: new BazFoo()
   *     }
   *   }
   *
   * @return {object}
   * @optional
   */
  getInitialState: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * @return {object}
   * @optional
   */
  getChildContext: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * Uses props from `this.props` and state from `this.state` to render the
   * structure of the component.
   *
   * No guarantees are made about when or how often this method is invoked, so
   * it must not have side effects.
   *
   *   render: function() {
   *     var name = this.props.name;
   *     return <div>Hello, {name}!</div>;
   *   }
   *
   * @return {ReactComponent}
   * @nosideeffects
   * @required
   */
  render: SpecPolicy.DEFINE_ONCE,



  // ==== Delegate methods ====

  /**
   * Invoked when the component is initially created and about to be mounted.
   * This may have side effects, but any external subscriptions or data created
   * by this method must be cleaned up in `componentWillUnmount`.
   *
   * @optional
   */
  componentWillMount: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component has been mounted and has a DOM representation.
   * However, there is no guarantee that the DOM node is in the document.
   *
   * Use this as an opportunity to operate on the DOM when the component has
   * been mounted (initialized and rendered) for the first time.
   *
   * @param {DOMElement} rootNode DOM element representing the component.
   * @optional
   */
  componentDidMount: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked before the component receives new props.
   *
   * Use this as an opportunity to react to a prop transition by updating the
   * state using `this.setState`. Current props are accessed via `this.props`.
   *
   *   componentWillReceiveProps: function(nextProps, nextContext) {
   *     this.setState({
   *       likesIncreasing: nextProps.likeCount > this.props.likeCount
   *     });
   *   }
   *
   * NOTE: There is no equivalent `componentWillReceiveState`. An incoming prop
   * transition may cause a state change, but the opposite is not true. If you
   * need it, you are probably looking for `componentWillUpdate`.
   *
   * @param {object} nextProps
   * @optional
   */
  componentWillReceiveProps: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked while deciding if the component should be updated as a result of
   * receiving new props, state and/or context.
   *
   * Use this as an opportunity to `return false` when you're certain that the
   * transition to the new props/state/context will not require a component
   * update.
   *
   *   shouldComponentUpdate: function(nextProps, nextState, nextContext) {
   *     return !equal(nextProps, this.props) ||
   *       !equal(nextState, this.state) ||
   *       !equal(nextContext, this.context);
   *   }
   *
   * @param {object} nextProps
   * @param {?object} nextState
   * @param {?object} nextContext
   * @return {boolean} True if the component should update.
   * @optional
   */
  shouldComponentUpdate: SpecPolicy.DEFINE_ONCE,

  /**
   * Invoked when the component is about to update due to a transition from
   * `this.props`, `this.state` and `this.context` to `nextProps`, `nextState`
   * and `nextContext`.
   *
   * Use this as an opportunity to perform preparation before an update occurs.
   *
   * NOTE: You **cannot** use `this.setState()` in this method.
   *
   * @param {object} nextProps
   * @param {?object} nextState
   * @param {?object} nextContext
   * @param {ReactReconcileTransaction} transaction
   * @optional
   */
  componentWillUpdate: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component's DOM representation has been updated.
   *
   * Use this as an opportunity to operate on the DOM when the component has
   * been updated.
   *
   * @param {object} prevProps
   * @param {?object} prevState
   * @param {?object} prevContext
   * @param {DOMElement} rootNode DOM element representing the component.
   * @optional
   */
  componentDidUpdate: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component is about to be removed from its parent and have
   * its DOM representation destroyed.
   *
   * Use this as an opportunity to deallocate any external resources.
   *
   * NOTE: There is no `componentDidUnmount` since your component will have been
   * destroyed by that point.
   *
   * @optional
   */
  componentWillUnmount: SpecPolicy.DEFINE_MANY,



  // ==== Advanced methods ====

  /**
   * Updates the component's currently mounted DOM representation.
   *
   * By default, this implements React's rendering and reconciliation algorithm.
   * Sophisticated clients may wish to override this.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   * @overridable
   */
  updateComponent: SpecPolicy.OVERRIDE_BASE

};

/**
 * Mapping from class specification keys to special processing functions.
 *
 * Although these are declared like instance properties in the specification
 * when defining classes using `React.createClass`, they are actually static
 * and are accessible on the constructor instead of the prototype. Despite
 * being static, they must be defined outside of the "statics" key under
 * which all other static methods are defined.
 */
var RESERVED_SPEC_KEYS = {
  displayName: function(Constructor, displayName) {
    Constructor.displayName = displayName;
  },
  mixins: function(Constructor, mixins) {
    if (mixins) {
      for (var i = 0; i < mixins.length; i++) {
        mixSpecIntoComponent(Constructor, mixins[i]);
      }
    }
  },
  childContextTypes: function(Constructor, childContextTypes) {
    if ("production" !== "development") {
      validateTypeDef(
        Constructor,
        childContextTypes,
        ReactPropTypeLocations.childContext
      );
    }
    Constructor.childContextTypes = assign(
      {},
      Constructor.childContextTypes,
      childContextTypes
    );
  },
  contextTypes: function(Constructor, contextTypes) {
    if ("production" !== "development") {
      validateTypeDef(
        Constructor,
        contextTypes,
        ReactPropTypeLocations.context
      );
    }
    Constructor.contextTypes = assign(
      {},
      Constructor.contextTypes,
      contextTypes
    );
  },
  /**
   * Special case getDefaultProps which should move into statics but requires
   * automatic merging.
   */
  getDefaultProps: function(Constructor, getDefaultProps) {
    if (Constructor.getDefaultProps) {
      Constructor.getDefaultProps = createMergedResultFunction(
        Constructor.getDefaultProps,
        getDefaultProps
      );
    } else {
      Constructor.getDefaultProps = getDefaultProps;
    }
  },
  propTypes: function(Constructor, propTypes) {
    if ("production" !== "development") {
      validateTypeDef(
        Constructor,
        propTypes,
        ReactPropTypeLocations.prop
      );
    }
    Constructor.propTypes = assign(
      {},
      Constructor.propTypes,
      propTypes
    );
  },
  statics: function(Constructor, statics) {
    mixStaticSpecIntoComponent(Constructor, statics);
  }
};

function validateTypeDef(Constructor, typeDef, location) {
  for (var propName in typeDef) {
    if (typeDef.hasOwnProperty(propName)) {
      // use a warning instead of an invariant so components
      // don't show up in prod but not in __DEV__
      ("production" !== "development" ? warning(
        typeof typeDef[propName] === 'function',
        '%s: %s type `%s` is invalid; it must be a function, usually from ' +
        'React.PropTypes.',
        Constructor.displayName || 'ReactClass',
        ReactPropTypeLocationNames[location],
        propName
      ) : null);
    }
  }
}

function validateMethodOverride(proto, name) {
  var specPolicy = ReactClassInterface.hasOwnProperty(name) ?
    ReactClassInterface[name] :
    null;

  // Disallow overriding of base class methods unless explicitly allowed.
  if (ReactClassMixin.hasOwnProperty(name)) {
    ("production" !== "development" ? invariant(
      specPolicy === SpecPolicy.OVERRIDE_BASE,
      'ReactClassInterface: You are attempting to override ' +
      '`%s` from your class specification. Ensure that your method names ' +
      'do not overlap with React methods.',
      name
    ) : invariant(specPolicy === SpecPolicy.OVERRIDE_BASE));
  }

  // Disallow defining methods more than once unless explicitly allowed.
  if (proto.hasOwnProperty(name)) {
    ("production" !== "development" ? invariant(
      specPolicy === SpecPolicy.DEFINE_MANY ||
      specPolicy === SpecPolicy.DEFINE_MANY_MERGED,
      'ReactClassInterface: You are attempting to define ' +
      '`%s` on your component more than once. This conflict may be due ' +
      'to a mixin.',
      name
    ) : invariant(specPolicy === SpecPolicy.DEFINE_MANY ||
    specPolicy === SpecPolicy.DEFINE_MANY_MERGED));
  }
}

/**
 * Mixin helper which handles policy validation and reserved
 * specification keys when building React classses.
 */
function mixSpecIntoComponent(Constructor, spec) {
  if (!spec) {
    return;
  }

  ("production" !== "development" ? invariant(
    typeof spec !== 'function',
    'ReactClass: You\'re attempting to ' +
    'use a component class as a mixin. Instead, just use a regular object.'
  ) : invariant(typeof spec !== 'function'));
  ("production" !== "development" ? invariant(
    !ReactElement.isValidElement(spec),
    'ReactClass: You\'re attempting to ' +
    'use a component as a mixin. Instead, just use a regular object.'
  ) : invariant(!ReactElement.isValidElement(spec)));

  var proto = Constructor.prototype;

  // By handling mixins before any other properties, we ensure the same
  // chaining order is applied to methods with DEFINE_MANY policy, whether
  // mixins are listed before or after these methods in the spec.
  if (spec.hasOwnProperty(MIXINS_KEY)) {
    RESERVED_SPEC_KEYS.mixins(Constructor, spec.mixins);
  }

  for (var name in spec) {
    if (!spec.hasOwnProperty(name)) {
      continue;
    }

    if (name === MIXINS_KEY) {
      // We have already handled mixins in a special case above
      continue;
    }

    var property = spec[name];
    validateMethodOverride(proto, name);

    if (RESERVED_SPEC_KEYS.hasOwnProperty(name)) {
      RESERVED_SPEC_KEYS[name](Constructor, property);
    } else {
      // Setup methods on prototype:
      // The following member methods should not be automatically bound:
      // 1. Expected ReactClass methods (in the "interface").
      // 2. Overridden methods (that were mixed in).
      var isReactClassMethod =
        ReactClassInterface.hasOwnProperty(name);
      var isAlreadyDefined = proto.hasOwnProperty(name);
      var markedDontBind = property && property.__reactDontBind;
      var isFunction = typeof property === 'function';
      var shouldAutoBind =
        isFunction &&
        !isReactClassMethod &&
        !isAlreadyDefined &&
        !markedDontBind;

      if (shouldAutoBind) {
        if (!proto.__reactAutoBindMap) {
          proto.__reactAutoBindMap = {};
        }
        proto.__reactAutoBindMap[name] = property;
        proto[name] = property;
      } else {
        if (isAlreadyDefined) {
          var specPolicy = ReactClassInterface[name];

          // These cases should already be caught by validateMethodOverride
          ("production" !== "development" ? invariant(
            isReactClassMethod && (
              (specPolicy === SpecPolicy.DEFINE_MANY_MERGED || specPolicy === SpecPolicy.DEFINE_MANY)
            ),
            'ReactClass: Unexpected spec policy %s for key %s ' +
            'when mixing in component specs.',
            specPolicy,
            name
          ) : invariant(isReactClassMethod && (
            (specPolicy === SpecPolicy.DEFINE_MANY_MERGED || specPolicy === SpecPolicy.DEFINE_MANY)
          )));

          // For methods which are defined more than once, call the existing
          // methods before calling the new property, merging if appropriate.
          if (specPolicy === SpecPolicy.DEFINE_MANY_MERGED) {
            proto[name] = createMergedResultFunction(proto[name], property);
          } else if (specPolicy === SpecPolicy.DEFINE_MANY) {
            proto[name] = createChainedFunction(proto[name], property);
          }
        } else {
          proto[name] = property;
          if ("production" !== "development") {
            // Add verbose displayName to the function, which helps when looking
            // at profiling tools.
            if (typeof property === 'function' && spec.displayName) {
              proto[name].displayName = spec.displayName + '_' + name;
            }
          }
        }
      }
    }
  }
}

function mixStaticSpecIntoComponent(Constructor, statics) {
  if (!statics) {
    return;
  }
  for (var name in statics) {
    var property = statics[name];
    if (!statics.hasOwnProperty(name)) {
      continue;
    }

    var isReserved = name in RESERVED_SPEC_KEYS;
    ("production" !== "development" ? invariant(
      !isReserved,
      'ReactClass: You are attempting to define a reserved ' +
      'property, `%s`, that shouldn\'t be on the "statics" key. Define it ' +
      'as an instance property instead; it will still be accessible on the ' +
      'constructor.',
      name
    ) : invariant(!isReserved));

    var isInherited = name in Constructor;
    ("production" !== "development" ? invariant(
      !isInherited,
      'ReactClass: You are attempting to define ' +
      '`%s` on your component more than once. This conflict may be ' +
      'due to a mixin.',
      name
    ) : invariant(!isInherited));
    Constructor[name] = property;
  }
}

/**
 * Merge two objects, but throw if both contain the same key.
 *
 * @param {object} one The first object, which is mutated.
 * @param {object} two The second object
 * @return {object} one after it has been mutated to contain everything in two.
 */
function mergeIntoWithNoDuplicateKeys(one, two) {
  ("production" !== "development" ? invariant(
    one && two && typeof one === 'object' && typeof two === 'object',
    'mergeIntoWithNoDuplicateKeys(): Cannot merge non-objects.'
  ) : invariant(one && two && typeof one === 'object' && typeof two === 'object'));

  for (var key in two) {
    if (two.hasOwnProperty(key)) {
      ("production" !== "development" ? invariant(
        one[key] === undefined,
        'mergeIntoWithNoDuplicateKeys(): ' +
        'Tried to merge two objects with the same key: `%s`. This conflict ' +
        'may be due to a mixin; in particular, this may be caused by two ' +
        'getInitialState() or getDefaultProps() methods returning objects ' +
        'with clashing keys.',
        key
      ) : invariant(one[key] === undefined));
      one[key] = two[key];
    }
  }
  return one;
}

/**
 * Creates a function that invokes two functions and merges their return values.
 *
 * @param {function} one Function to invoke first.
 * @param {function} two Function to invoke second.
 * @return {function} Function that invokes the two argument functions.
 * @private
 */
function createMergedResultFunction(one, two) {
  return function mergedResult() {
    var a = one.apply(this, arguments);
    var b = two.apply(this, arguments);
    if (a == null) {
      return b;
    } else if (b == null) {
      return a;
    }
    var c = {};
    mergeIntoWithNoDuplicateKeys(c, a);
    mergeIntoWithNoDuplicateKeys(c, b);
    return c;
  };
}

/**
 * Creates a function that invokes two functions and ignores their return vales.
 *
 * @param {function} one Function to invoke first.
 * @param {function} two Function to invoke second.
 * @return {function} Function that invokes the two argument functions.
 * @private
 */
function createChainedFunction(one, two) {
  return function chainedFunction() {
    one.apply(this, arguments);
    two.apply(this, arguments);
  };
}

/**
 * Binds a method to the component.
 *
 * @param {object} component Component whose method is going to be bound.
 * @param {function} method Method to be bound.
 * @return {function} The bound method.
 */
function bindAutoBindMethod(component, method) {
  var boundMethod = method.bind(component);
  if ("production" !== "development") {
    boundMethod.__reactBoundContext = component;
    boundMethod.__reactBoundMethod = method;
    boundMethod.__reactBoundArguments = null;
    var componentName = component.constructor.displayName;
    var _bind = boundMethod.bind;
    /* eslint-disable block-scoped-var, no-undef */
    boundMethod.bind = function(newThis ) {for (var args=[],$__0=1,$__1=arguments.length;$__0<$__1;$__0++) args.push(arguments[$__0]);
      // User is trying to bind() an autobound method; we effectively will
      // ignore the value of "this" that the user is trying to use, so
      // let's warn.
      if (newThis !== component && newThis !== null) {
        ("production" !== "development" ? warning(
          false,
          'bind(): React component methods may only be bound to the ' +
          'component instance. See %s',
          componentName
        ) : null);
      } else if (!args.length) {
        ("production" !== "development" ? warning(
          false,
          'bind(): You are binding a component method to the component. ' +
          'React does this for you automatically in a high-performance ' +
          'way, so you can safely remove this call. See %s',
          componentName
        ) : null);
        return boundMethod;
      }
      var reboundMethod = _bind.apply(boundMethod, arguments);
      reboundMethod.__reactBoundContext = component;
      reboundMethod.__reactBoundMethod = method;
      reboundMethod.__reactBoundArguments = args;
      return reboundMethod;
      /* eslint-enable */
    };
  }
  return boundMethod;
}

/**
 * Binds all auto-bound methods in a component.
 *
 * @param {object} component Component whose method is going to be bound.
 */
function bindAutoBindMethods(component) {
  for (var autoBindKey in component.__reactAutoBindMap) {
    if (component.__reactAutoBindMap.hasOwnProperty(autoBindKey)) {
      var method = component.__reactAutoBindMap[autoBindKey];
      component[autoBindKey] = bindAutoBindMethod(
        component,
        ReactErrorUtils.guard(
          method,
          component.constructor.displayName + '.' + autoBindKey
        )
      );
    }
  }
}

var typeDeprecationDescriptor = {
  enumerable: false,
  get: function() {
    var displayName = this.displayName || this.name || 'Component';
    ("production" !== "development" ? warning(
      false,
      '%s.type is deprecated. Use %s directly to access the class.',
      displayName,
      displayName
    ) : null);
    Object.defineProperty(this, 'type', {
      value: this
    });
    return this;
  }
};

/**
 * Add more to the ReactClass base class. These are all legacy features and
 * therefore not already part of the modern ReactComponent.
 */
var ReactClassMixin = {

  /**
   * TODO: This will be deprecated because state should always keep a consistent
   * type signature and the only use case for this, is to avoid that.
   */
  replaceState: function(newState, callback) {
    ReactUpdateQueue.enqueueReplaceState(this, newState);
    if (callback) {
      ReactUpdateQueue.enqueueCallback(this, callback);
    }
  },

  /**
   * Checks whether or not this composite component is mounted.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function() {
    if ("production" !== "development") {
      var owner = ReactCurrentOwner.current;
      if (owner !== null) {
        ("production" !== "development" ? warning(
          owner._warnedAboutRefsInRender,
          '%s is accessing isMounted inside its render() function. ' +
          'render() should be a pure function of props and state. It should ' +
          'never access something that requires stale data from the previous ' +
          'render, such as refs. Move this logic to componentDidMount and ' +
          'componentDidUpdate instead.',
          owner.getName() || 'A component'
        ) : null);
        owner._warnedAboutRefsInRender = true;
      }
    }
    var internalInstance = ReactInstanceMap.get(this);
    return (
      internalInstance &&
      internalInstance !== ReactLifeCycle.currentlyMountingInstance
    );
  },

  /**
   * Sets a subset of the props.
   *
   * @param {object} partialProps Subset of the next props.
   * @param {?function} callback Called after props are updated.
   * @final
   * @public
   * @deprecated
   */
  setProps: function(partialProps, callback) {
    ReactUpdateQueue.enqueueSetProps(this, partialProps);
    if (callback) {
      ReactUpdateQueue.enqueueCallback(this, callback);
    }
  },

  /**
   * Replace all the props.
   *
   * @param {object} newProps Subset of the next props.
   * @param {?function} callback Called after props are updated.
   * @final
   * @public
   * @deprecated
   */
  replaceProps: function(newProps, callback) {
    ReactUpdateQueue.enqueueReplaceProps(this, newProps);
    if (callback) {
      ReactUpdateQueue.enqueueCallback(this, callback);
    }
  }
};

var ReactClassComponent = function() {};
assign(
  ReactClassComponent.prototype,
  ReactComponent.prototype,
  ReactClassMixin
);

/**
 * Module for creating composite components.
 *
 * @class ReactClass
 */
var ReactClass = {

  /**
   * Creates a composite component class given a class specification.
   *
   * @param {object} spec Class specification (which must define `render`).
   * @return {function} Component constructor function.
   * @public
   */
  createClass: function(spec) {
    var Constructor = function(props, context) {
      // This constructor is overridden by mocks. The argument is used
      // by mocks to assert on what gets mounted.

      if ("production" !== "development") {
        ("production" !== "development" ? warning(
          this instanceof Constructor,
          'Something is calling a React component directly. Use a factory or ' +
          'JSX instead. See: https://fb.me/react-legacyfactory'
        ) : null);
      }

      // Wire up auto-binding
      if (this.__reactAutoBindMap) {
        bindAutoBindMethods(this);
      }

      this.props = props;
      this.context = context;
      this.state = null;

      // ReactClasses doesn't have constructors. Instead, they use the
      // getInitialState and componentWillMount methods for initialization.

      var initialState = this.getInitialState ? this.getInitialState() : null;
      if ("production" !== "development") {
        // We allow auto-mocks to proceed as if they're returning null.
        if (typeof initialState === 'undefined' &&
            this.getInitialState._isMockFunction) {
          // This is probably bad practice. Consider warning here and
          // deprecating this convenience.
          initialState = null;
        }
      }
      ("production" !== "development" ? invariant(
        typeof initialState === 'object' && !Array.isArray(initialState),
        '%s.getInitialState(): must return an object or null',
        Constructor.displayName || 'ReactCompositeComponent'
      ) : invariant(typeof initialState === 'object' && !Array.isArray(initialState)));

      this.state = initialState;
    };
    Constructor.prototype = new ReactClassComponent();
    Constructor.prototype.constructor = Constructor;

    injectedMixins.forEach(
      mixSpecIntoComponent.bind(null, Constructor)
    );

    mixSpecIntoComponent(Constructor, spec);

    // Initialize the defaultProps property after all mixins have been merged
    if (Constructor.getDefaultProps) {
      Constructor.defaultProps = Constructor.getDefaultProps();
    }

    if ("production" !== "development") {
      // This is a tag to indicate that the use of these method names is ok,
      // since it's used with createClass. If it's not, then it's likely a
      // mistake so we'll warn you to use the static property, property
      // initializer or constructor respectively.
      if (Constructor.getDefaultProps) {
        Constructor.getDefaultProps.isReactClassApproved = {};
      }
      if (Constructor.prototype.getInitialState) {
        Constructor.prototype.getInitialState.isReactClassApproved = {};
      }
    }

    ("production" !== "development" ? invariant(
      Constructor.prototype.render,
      'createClass(...): Class specification must implement a `render` method.'
    ) : invariant(Constructor.prototype.render));

    if ("production" !== "development") {
      ("production" !== "development" ? warning(
        !Constructor.prototype.componentShouldUpdate,
        '%s has a method called ' +
        'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' +
        'The name is phrased as a question because the function is ' +
        'expected to return a value.',
        spec.displayName || 'A component'
      ) : null);
    }

    // Reduce time spent doing lookups by setting these on the prototype.
    for (var methodName in ReactClassInterface) {
      if (!Constructor.prototype[methodName]) {
        Constructor.prototype[methodName] = null;
      }
    }

    // Legacy hook
    Constructor.type = Constructor;
    if ("production" !== "development") {
      try {
        Object.defineProperty(Constructor, 'type', typeDeprecationDescriptor);
      } catch (x) {
        // IE will fail on defineProperty (es5-shim/sham too)
      }
    }

    return Constructor;
  },

  injection: {
    injectMixin: function(mixin) {
      injectedMixins.push(mixin);
    }
  }

};

module.exports = ReactClass;

},{"135":135,"140":140,"141":141,"154":154,"27":27,"34":34,"39":39,"57":57,"60":60,"67":67,"68":68,"76":76,"77":77,"86":86}],34:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactComponent
 */

'use strict';

var ReactUpdateQueue = _dereq_(86);

var invariant = _dereq_(135);
var warning = _dereq_(154);

/**
 * Base class helpers for the updating state of a component.
 */
function ReactComponent(props, context) {
  this.props = props;
  this.context = context;
}

/**
 * Sets a subset of the state. Always use this to mutate
 * state. You should treat `this.state` as immutable.
 *
 * There is no guarantee that `this.state` will be immediately updated, so
 * accessing `this.state` after calling this method may return the old value.
 *
 * There is no guarantee that calls to `setState` will run synchronously,
 * as they may eventually be batched together.  You can provide an optional
 * callback that will be executed when the call to setState is actually
 * completed.
 *
 * When a function is provided to setState, it will be called at some point in
 * the future (not synchronously). It will be called with the up to date
 * component arguments (state, props, context). These values can be different
 * from this.* because your function may be called after receiveProps but before
 * shouldComponentUpdate, and this new state, props, and context will not yet be
 * assigned to this.
 *
 * @param {object|function} partialState Next partial state or function to
 *        produce next partial state to be merged with current state.
 * @param {?function} callback Called after state is updated.
 * @final
 * @protected
 */
ReactComponent.prototype.setState = function(partialState, callback) {
  ("production" !== "development" ? invariant(
    typeof partialState === 'object' ||
    typeof partialState === 'function' ||
    partialState == null,
    'setState(...): takes an object of state variables to update or a ' +
    'function which returns an object of state variables.'
  ) : invariant(typeof partialState === 'object' ||
  typeof partialState === 'function' ||
  partialState == null));
  if ("production" !== "development") {
    ("production" !== "development" ? warning(
      partialState != null,
      'setState(...): You passed an undefined or null state object; ' +
      'instead, use forceUpdate().'
    ) : null);
  }
  ReactUpdateQueue.enqueueSetState(this, partialState);
  if (callback) {
    ReactUpdateQueue.enqueueCallback(this, callback);
  }
};

/**
 * Forces an update. This should only be invoked when it is known with
 * certainty that we are **not** in a DOM transaction.
 *
 * You may want to call this when you know that some deeper aspect of the
 * component's state has changed but `setState` was not called.
 *
 * This will not invoke `shouldComponentUpdate`, but it will invoke
 * `componentWillUpdate` and `componentDidUpdate`.
 *
 * @param {?function} callback Called after update is complete.
 * @final
 * @protected
 */
ReactComponent.prototype.forceUpdate = function(callback) {
  ReactUpdateQueue.enqueueForceUpdate(this);
  if (callback) {
    ReactUpdateQueue.enqueueCallback(this, callback);
  }
};

/**
 * Deprecated APIs. These APIs used to exist on classic React classes but since
 * we would like to deprecate them, we're not going to move them over to this
 * modern base class. Instead, we define a getter that warns if it's accessed.
 */
if ("production" !== "development") {
  var deprecatedAPIs = {
    getDOMNode: [
      'getDOMNode',
      'Use React.findDOMNode(component) instead.'
    ],
    isMounted: [
      'isMounted',
      'Instead, make sure to clean up subscriptions and pending requests in ' +
      'componentWillUnmount to prevent memory leaks.'
    ],
    replaceProps: [
      'replaceProps',
      'Instead call React.render again at the top level.'
    ],
    replaceState: [
      'replaceState',
      'Refactor your code to use setState instead (see ' +
      'https://github.com/facebook/react/issues/3236).'
    ],
    setProps: [
      'setProps',
      'Instead call React.render again at the top level.'
    ]
  };
  var defineDeprecationWarning = function(methodName, info) {
    try {
      Object.defineProperty(ReactComponent.prototype, methodName, {
        get: function() {
          ("production" !== "development" ? warning(
            false,
            '%s(...) is deprecated in plain JavaScript React classes. %s',
            info[0],
            info[1]
          ) : null);
          return undefined;
        }
      });
    } catch (x) {
      // IE will fail on defineProperty (es5-shim/sham too)
    }
  };
  for (var fnName in deprecatedAPIs) {
    if (deprecatedAPIs.hasOwnProperty(fnName)) {
      defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
    }
  }
}

module.exports = ReactComponent;

},{"135":135,"154":154,"86":86}],35:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactComponentBrowserEnvironment
 */

/*jslint evil: true */

'use strict';

var ReactDOMIDOperations = _dereq_(44);
var ReactMount = _dereq_(70);

/**
 * Abstracts away all functionality of the reconciler that requires knowledge of
 * the browser context. TODO: These callers should be refactored to avoid the
 * need for this injection.
 */
var ReactComponentBrowserEnvironment = {

  processChildrenUpdates:
    ReactDOMIDOperations.dangerouslyProcessChildrenUpdates,

  replaceNodeWithMarkupByID:
    ReactDOMIDOperations.dangerouslyReplaceNodeWithMarkupByID,

  /**
   * If a particular environment requires that some resources be cleaned up,
   * specify this in the injected Mixin. In the DOM, we would likely want to
   * purge any cached node ID lookups.
   *
   * @private
   */
  unmountIDFromEnvironment: function(rootNodeID) {
    ReactMount.purgeID(rootNodeID);
  }

};

module.exports = ReactComponentBrowserEnvironment;

},{"44":44,"70":70}],36:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactComponentEnvironment
 */

'use strict';

var invariant = _dereq_(135);

var injected = false;

var ReactComponentEnvironment = {

  /**
   * Optionally injectable environment dependent cleanup hook. (server vs.
   * browser etc). Example: A browser system caches DOM nodes based on component
   * ID and must remove that cache entry when this instance is unmounted.
   */
  unmountIDFromEnvironment: null,

  /**
   * Optionally injectable hook for swapping out mount images in the middle of
   * the tree.
   */
  replaceNodeWithMarkupByID: null,

  /**
   * Optionally injectable hook for processing a queue of child updates. Will
   * later move into MultiChildComponents.
   */
  processChildrenUpdates: null,

  injection: {
    injectEnvironment: function(environment) {
      ("production" !== "development" ? invariant(
        !injected,
        'ReactCompositeComponent: injectEnvironment() can only be called once.'
      ) : invariant(!injected));
      ReactComponentEnvironment.unmountIDFromEnvironment =
        environment.unmountIDFromEnvironment;
      ReactComponentEnvironment.replaceNodeWithMarkupByID =
        environment.replaceNodeWithMarkupByID;
      ReactComponentEnvironment.processChildrenUpdates =
        environment.processChildrenUpdates;
      injected = true;
    }
  }

};

module.exports = ReactComponentEnvironment;

},{"135":135}],37:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactCompositeComponent
 */

'use strict';

var ReactComponentEnvironment = _dereq_(36);
var ReactContext = _dereq_(38);
var ReactCurrentOwner = _dereq_(39);
var ReactElement = _dereq_(57);
var ReactElementValidator = _dereq_(58);
var ReactInstanceMap = _dereq_(67);
var ReactLifeCycle = _dereq_(68);
var ReactNativeComponent = _dereq_(73);
var ReactPerf = _dereq_(75);
var ReactPropTypeLocations = _dereq_(77);
var ReactPropTypeLocationNames = _dereq_(76);
var ReactReconciler = _dereq_(81);
var ReactUpdates = _dereq_(87);

var assign = _dereq_(27);
var emptyObject = _dereq_(115);
var invariant = _dereq_(135);
var shouldUpdateReactComponent = _dereq_(151);
var warning = _dereq_(154);

function getDeclarationErrorAddendum(component) {
  var owner = component._currentElement._owner || null;
  if (owner) {
    var name = owner.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

/**
 * ------------------ The Life-Cycle of a Composite Component ------------------
 *
 * - constructor: Initialization of state. The instance is now retained.
 *   - componentWillMount
 *   - render
 *   - [children's constructors]
 *     - [children's componentWillMount and render]
 *     - [children's componentDidMount]
 *     - componentDidMount
 *
 *       Update Phases:
 *       - componentWillReceiveProps (only called if parent updated)
 *       - shouldComponentUpdate
 *         - componentWillUpdate
 *           - render
 *           - [children's constructors or receive props phases]
 *         - componentDidUpdate
 *
 *     - componentWillUnmount
 *     - [children's componentWillUnmount]
 *   - [children destroyed]
 * - (destroyed): The instance is now blank, released by React and ready for GC.
 *
 * -----------------------------------------------------------------------------
 */

/**
 * An incrementing ID assigned to each component when it is mounted. This is
 * used to enforce the order in which `ReactUpdates` updates dirty components.
 *
 * @private
 */
var nextMountID = 1;

/**
 * @lends {ReactCompositeComponent.prototype}
 */
var ReactCompositeComponentMixin = {

  /**
   * Base constructor for all composite component.
   *
   * @param {ReactElement} element
   * @final
   * @internal
   */
  construct: function(element) {
    this._currentElement = element;
    this._rootNodeID = null;
    this._instance = null;

    // See ReactUpdateQueue
    this._pendingElement = null;
    this._pendingStateQueue = null;
    this._pendingReplaceState = false;
    this._pendingForceUpdate = false;

    this._renderedComponent = null;

    this._context = null;
    this._mountOrder = 0;
    this._isTopLevel = false;

    // See ReactUpdates and ReactUpdateQueue.
    this._pendingCallbacks = null;
  },

  /**
   * Initializes the component, renders markup, and registers event listeners.
   *
   * @param {string} rootID DOM ID of the root node.
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @return {?string} Rendered markup to be inserted into the DOM.
   * @final
   * @internal
   */
  mountComponent: function(rootID, transaction, context) {
    this._context = context;
    this._mountOrder = nextMountID++;
    this._rootNodeID = rootID;

    var publicProps = this._processProps(this._currentElement.props);
    var publicContext = this._processContext(this._currentElement._context);

    var Component = ReactNativeComponent.getComponentClassForElement(
      this._currentElement
    );

    // Initialize the public class
    var inst = new Component(publicProps, publicContext);

    if ("production" !== "development") {
      // This will throw later in _renderValidatedComponent, but add an early
      // warning now to help debugging
      ("production" !== "development" ? warning(
        inst.render != null,
        '%s(...): No `render` method found on the returned component ' +
        'instance: you may have forgotten to define `render` in your ' +
        'component or you may have accidentally tried to render an element ' +
        'whose type is a function that isn\'t a React component.',
        Component.displayName || Component.name || 'Component'
      ) : null);
    }

    // These should be set up in the constructor, but as a convenience for
    // simpler class abstractions, we set them up after the fact.
    inst.props = publicProps;
    inst.context = publicContext;
    inst.refs = emptyObject;

    this._instance = inst;

    // Store a reference from the instance back to the internal representation
    ReactInstanceMap.set(inst, this);

    if ("production" !== "development") {
      this._warnIfContextsDiffer(this._currentElement._context, context);
    }

    if ("production" !== "development") {
      // Since plain JS classes are defined without any special initialization
      // logic, we can not catch common errors early. Therefore, we have to
      // catch them here, at initialization time, instead.
      ("production" !== "development" ? warning(
        !inst.getInitialState ||
        inst.getInitialState.isReactClassApproved,
        'getInitialState was defined on %s, a plain JavaScript class. ' +
        'This is only supported for classes created using React.createClass. ' +
        'Did you mean to define a state property instead?',
        this.getName() || 'a component'
      ) : null);
      ("production" !== "development" ? warning(
        !inst.getDefaultProps ||
        inst.getDefaultProps.isReactClassApproved,
        'getDefaultProps was defined on %s, a plain JavaScript class. ' +
        'This is only supported for classes created using React.createClass. ' +
        'Use a static property to define defaultProps instead.',
        this.getName() || 'a component'
      ) : null);
      ("production" !== "development" ? warning(
        !inst.propTypes,
        'propTypes was defined as an instance property on %s. Use a static ' +
        'property to define propTypes instead.',
        this.getName() || 'a component'
      ) : null);
      ("production" !== "development" ? warning(
        !inst.contextTypes,
        'contextTypes was defined as an instance property on %s. Use a ' +
        'static property to define contextTypes instead.',
        this.getName() || 'a component'
      ) : null);
      ("production" !== "development" ? warning(
        typeof inst.componentShouldUpdate !== 'function',
        '%s has a method called ' +
        'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' +
        'The name is phrased as a question because the function is ' +
        'expected to return a value.',
        (this.getName() || 'A component')
      ) : null);
    }

    var initialState = inst.state;
    if (initialState === undefined) {
      inst.state = initialState = null;
    }
    ("production" !== "development" ? invariant(
      typeof initialState === 'object' && !Array.isArray(initialState),
      '%s.state: must be set to an object or null',
      this.getName() || 'ReactCompositeComponent'
    ) : invariant(typeof initialState === 'object' && !Array.isArray(initialState)));

    this._pendingStateQueue = null;
    this._pendingReplaceState = false;
    this._pendingForceUpdate = false;

    var childContext;
    var renderedElement;

    var previouslyMounting = ReactLifeCycle.currentlyMountingInstance;
    ReactLifeCycle.currentlyMountingInstance = this;
    try {
      if (inst.componentWillMount) {
        inst.componentWillMount();
        // When mounting, calls to `setState` by `componentWillMount` will set
        // `this._pendingStateQueue` without triggering a re-render.
        if (this._pendingStateQueue) {
          inst.state = this._processPendingState(inst.props, inst.context);
        }
      }

      childContext = this._getValidatedChildContext(context);
      renderedElement = this._renderValidatedComponent(childContext);
    } finally {
      ReactLifeCycle.currentlyMountingInstance = previouslyMounting;
    }

    this._renderedComponent = this._instantiateReactComponent(
      renderedElement,
      this._currentElement.type // The wrapping type
    );

    var markup = ReactReconciler.mountComponent(
      this._renderedComponent,
      rootID,
      transaction,
      this._mergeChildContext(context, childContext)
    );
    if (inst.componentDidMount) {
      transaction.getReactMountReady().enqueue(inst.componentDidMount, inst);
    }

    return markup;
  },

  /**
   * Releases any resources allocated by `mountComponent`.
   *
   * @final
   * @internal
   */
  unmountComponent: function() {
    var inst = this._instance;

    if (inst.componentWillUnmount) {
      var previouslyUnmounting = ReactLifeCycle.currentlyUnmountingInstance;
      ReactLifeCycle.currentlyUnmountingInstance = this;
      try {
        inst.componentWillUnmount();
      } finally {
        ReactLifeCycle.currentlyUnmountingInstance = previouslyUnmounting;
      }
    }

    ReactReconciler.unmountComponent(this._renderedComponent);
    this._renderedComponent = null;

    // Reset pending fields
    this._pendingStateQueue = null;
    this._pendingReplaceState = false;
    this._pendingForceUpdate = false;
    this._pendingCallbacks = null;
    this._pendingElement = null;

    // These fields do not really need to be reset since this object is no
    // longer accessible.
    this._context = null;
    this._rootNodeID = null;

    // Delete the reference from the instance to this internal representation
    // which allow the internals to be properly cleaned up even if the user
    // leaks a reference to the public instance.
    ReactInstanceMap.remove(inst);

    // Some existing components rely on inst.props even after they've been
    // destroyed (in event handlers).
    // TODO: inst.props = null;
    // TODO: inst.state = null;
    // TODO: inst.context = null;
  },

  /**
   * Schedule a partial update to the props. Only used for internal testing.
   *
   * @param {object} partialProps Subset of the next props.
   * @param {?function} callback Called after props are updated.
   * @final
   * @internal
   */
  _setPropsInternal: function(partialProps, callback) {
    // This is a deoptimized path. We optimize for always having an element.
    // This creates an extra internal element.
    var element = this._pendingElement || this._currentElement;
    this._pendingElement = ReactElement.cloneAndReplaceProps(
      element,
      assign({}, element.props, partialProps)
    );
    ReactUpdates.enqueueUpdate(this, callback);
  },

  /**
   * Filters the context object to only contain keys specified in
   * `contextTypes`
   *
   * @param {object} context
   * @return {?object}
   * @private
   */
  _maskContext: function(context) {
    var maskedContext = null;
    // This really should be getting the component class for the element,
    // but we know that we're not going to need it for built-ins.
    if (typeof this._currentElement.type === 'string') {
      return emptyObject;
    }
    var contextTypes = this._currentElement.type.contextTypes;
    if (!contextTypes) {
      return emptyObject;
    }
    maskedContext = {};
    for (var contextName in contextTypes) {
      maskedContext[contextName] = context[contextName];
    }
    return maskedContext;
  },

  /**
   * Filters the context object to only contain keys specified in
   * `contextTypes`, and asserts that they are valid.
   *
   * @param {object} context
   * @return {?object}
   * @private
   */
  _processContext: function(context) {
    var maskedContext = this._maskContext(context);
    if ("production" !== "development") {
      var Component = ReactNativeComponent.getComponentClassForElement(
        this._currentElement
      );
      if (Component.contextTypes) {
        this._checkPropTypes(
          Component.contextTypes,
          maskedContext,
          ReactPropTypeLocations.context
        );
      }
    }
    return maskedContext;
  },

  /**
   * @param {object} currentContext
   * @return {object}
   * @private
   */
  _getValidatedChildContext: function(currentContext) {
    var inst = this._instance;
    var childContext = inst.getChildContext && inst.getChildContext();
    if (childContext) {
      ("production" !== "development" ? invariant(
        typeof inst.constructor.childContextTypes === 'object',
        '%s.getChildContext(): childContextTypes must be defined in order to ' +
        'use getChildContext().',
        this.getName() || 'ReactCompositeComponent'
      ) : invariant(typeof inst.constructor.childContextTypes === 'object'));
      if ("production" !== "development") {
        this._checkPropTypes(
          inst.constructor.childContextTypes,
          childContext,
          ReactPropTypeLocations.childContext
        );
      }
      for (var name in childContext) {
        ("production" !== "development" ? invariant(
          name in inst.constructor.childContextTypes,
          '%s.getChildContext(): key "%s" is not defined in childContextTypes.',
          this.getName() || 'ReactCompositeComponent',
          name
        ) : invariant(name in inst.constructor.childContextTypes));
      }
      return childContext;
    }
    return null;
  },

  _mergeChildContext: function(currentContext, childContext) {
    if (childContext) {
      return assign({}, currentContext, childContext);
    }
    return currentContext;
  },

  /**
   * Processes props by setting default values for unspecified props and
   * asserting that the props are valid. Does not mutate its argument; returns
   * a new props object with defaults merged in.
   *
   * @param {object} newProps
   * @return {object}
   * @private
   */
  _processProps: function(newProps) {
    if ("production" !== "development") {
      var Component = ReactNativeComponent.getComponentClassForElement(
        this._currentElement
      );
      if (Component.propTypes) {
        this._checkPropTypes(
          Component.propTypes,
          newProps,
          ReactPropTypeLocations.prop
        );
      }
    }
    return newProps;
  },

  /**
   * Assert that the props are valid
   *
   * @param {object} propTypes Map of prop name to a ReactPropType
   * @param {object} props
   * @param {string} location e.g. "prop", "context", "child context"
   * @private
   */
  _checkPropTypes: function(propTypes, props, location) {
    // TODO: Stop validating prop types here and only use the element
    // validation.
    var componentName = this.getName();
    for (var propName in propTypes) {
      if (propTypes.hasOwnProperty(propName)) {
        var error;
        try {
          // This is intentionally an invariant that gets caught. It's the same
          // behavior as without this statement except with a better message.
          ("production" !== "development" ? invariant(
            typeof propTypes[propName] === 'function',
            '%s: %s type `%s` is invalid; it must be a function, usually ' +
            'from React.PropTypes.',
            componentName || 'React class',
            ReactPropTypeLocationNames[location],
            propName
          ) : invariant(typeof propTypes[propName] === 'function'));
          error = propTypes[propName](props, propName, componentName, location);
        } catch (ex) {
          error = ex;
        }
        if (error instanceof Error) {
          // We may want to extend this logic for similar errors in
          // React.render calls, so I'm abstracting it away into
          // a function to minimize refactoring in the future
          var addendum = getDeclarationErrorAddendum(this);

          if (location === ReactPropTypeLocations.prop) {
            // Preface gives us something to blacklist in warning module
            ("production" !== "development" ? warning(
              false,
              'Failed Composite propType: %s%s',
              error.message,
              addendum
            ) : null);
          } else {
            ("production" !== "development" ? warning(
              false,
              'Failed Context Types: %s%s',
              error.message,
              addendum
            ) : null);
          }
        }
      }
    }
  },

  receiveComponent: function(nextElement, transaction, nextContext) {
    var prevElement = this._currentElement;
    var prevContext = this._context;

    this._pendingElement = null;

    this.updateComponent(
      transaction,
      prevElement,
      nextElement,
      prevContext,
      nextContext
    );
  },

  /**
   * If any of `_pendingElement`, `_pendingStateQueue`, or `_pendingForceUpdate`
   * is set, update the component.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  performUpdateIfNecessary: function(transaction) {
    if (this._pendingElement != null) {
      ReactReconciler.receiveComponent(
        this,
        this._pendingElement || this._currentElement,
        transaction,
        this._context
      );
    }

    if (this._pendingStateQueue !== null || this._pendingForceUpdate) {
      if ("production" !== "development") {
        ReactElementValidator.checkAndWarnForMutatedProps(
          this._currentElement
        );
      }

      this.updateComponent(
        transaction,
        this._currentElement,
        this._currentElement,
        this._context,
        this._context
      );
    }
  },

  /**
   * Compare two contexts, warning if they are different
   * TODO: Remove this check when owner-context is removed
   */
   _warnIfContextsDiffer: function(ownerBasedContext, parentBasedContext) {
    ownerBasedContext = this._maskContext(ownerBasedContext);
    parentBasedContext = this._maskContext(parentBasedContext);
    var parentKeys = Object.keys(parentBasedContext).sort();
    var displayName = this.getName() || 'ReactCompositeComponent';
    for (var i = 0; i < parentKeys.length; i++) {
      var key = parentKeys[i];
      ("production" !== "development" ? warning(
        ownerBasedContext[key] === parentBasedContext[key],
        'owner-based and parent-based contexts differ '  +
        '(values: `%s` vs `%s`) for key (%s) while mounting %s ' +
        '(see: http://fb.me/react-context-by-parent)',
        ownerBasedContext[key],
        parentBasedContext[key],
        key,
        displayName
      ) : null);
    }
  },

  /**
   * Perform an update to a mounted component. The componentWillReceiveProps and
   * shouldComponentUpdate methods are called, then (assuming the update isn't
   * skipped) the remaining update lifecycle methods are called and the DOM
   * representation is updated.
   *
   * By default, this implements React's rendering and reconciliation algorithm.
   * Sophisticated clients may wish to override this.
   *
   * @param {ReactReconcileTransaction} transaction
   * @param {ReactElement} prevParentElement
   * @param {ReactElement} nextParentElement
   * @internal
   * @overridable
   */
  updateComponent: function(
    transaction,
    prevParentElement,
    nextParentElement,
    prevUnmaskedContext,
    nextUnmaskedContext
  ) {
    var inst = this._instance;

    var nextContext = inst.context;
    var nextProps = inst.props;

    // Distinguish between a props update versus a simple state update
    if (prevParentElement !== nextParentElement) {
      nextContext = this._processContext(nextParentElement._context);
      nextProps = this._processProps(nextParentElement.props);

      if ("production" !== "development") {
        if (nextUnmaskedContext != null) {
          this._warnIfContextsDiffer(
            nextParentElement._context,
            nextUnmaskedContext
          );
        }
      }

      // An update here will schedule an update but immediately set
      // _pendingStateQueue which will ensure that any state updates gets
      // immediately reconciled instead of waiting for the next batch.

      if (inst.componentWillReceiveProps) {
        inst.componentWillReceiveProps(nextProps, nextContext);
      }
    }

    var nextState = this._processPendingState(nextProps, nextContext);

    var shouldUpdate =
      this._pendingForceUpdate ||
      !inst.shouldComponentUpdate ||
      inst.shouldComponentUpdate(nextProps, nextState, nextContext);

    if ("production" !== "development") {
      ("production" !== "development" ? warning(
        typeof shouldUpdate !== 'undefined',
        '%s.shouldComponentUpdate(): Returned undefined instead of a ' +
        'boolean value. Make sure to return true or false.',
        this.getName() || 'ReactCompositeComponent'
      ) : null);
    }

    if (shouldUpdate) {
      this._pendingForceUpdate = false;
      // Will set `this.props`, `this.state` and `this.context`.
      this._performComponentUpdate(
        nextParentElement,
        nextProps,
        nextState,
        nextContext,
        transaction,
        nextUnmaskedContext
      );
    } else {
      // If it's determined that a component should not update, we still want
      // to set props and state but we shortcut the rest of the update.
      this._currentElement = nextParentElement;
      this._context = nextUnmaskedContext;
      inst.props = nextProps;
      inst.state = nextState;
      inst.context = nextContext;
    }
  },

  _processPendingState: function(props, context) {
    var inst = this._instance;
    var queue = this._pendingStateQueue;
    var replace = this._pendingReplaceState;
    this._pendingReplaceState = false;
    this._pendingStateQueue = null;

    if (!queue) {
      return inst.state;
    }

    if (replace && queue.length === 1) {
      return queue[0];
    }

    var nextState = assign({}, replace ? queue[0] : inst.state);
    for (var i = replace ? 1 : 0; i < queue.length; i++) {
      var partial = queue[i];
      assign(
        nextState,
        typeof partial === 'function' ?
          partial.call(inst, nextState, props, context) :
          partial
      );
    }

    return nextState;
  },

  /**
   * Merges new props and state, notifies delegate methods of update and
   * performs update.
   *
   * @param {ReactElement} nextElement Next element
   * @param {object} nextProps Next public object to set as properties.
   * @param {?object} nextState Next object to set as state.
   * @param {?object} nextContext Next public object to set as context.
   * @param {ReactReconcileTransaction} transaction
   * @param {?object} unmaskedContext
   * @private
   */
  _performComponentUpdate: function(
    nextElement,
    nextProps,
    nextState,
    nextContext,
    transaction,
    unmaskedContext
  ) {
    var inst = this._instance;

    var prevProps = inst.props;
    var prevState = inst.state;
    var prevContext = inst.context;

    if (inst.componentWillUpdate) {
      inst.componentWillUpdate(nextProps, nextState, nextContext);
    }

    this._currentElement = nextElement;
    this._context = unmaskedContext;
    inst.props = nextProps;
    inst.state = nextState;
    inst.context = nextContext;

    this._updateRenderedComponent(transaction, unmaskedContext);

    if (inst.componentDidUpdate) {
      transaction.getReactMountReady().enqueue(
        inst.componentDidUpdate.bind(inst, prevProps, prevState, prevContext),
        inst
      );
    }
  },

  /**
   * Call the component's `render` method and update the DOM accordingly.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  _updateRenderedComponent: function(transaction, context) {
    var prevComponentInstance = this._renderedComponent;
    var prevRenderedElement = prevComponentInstance._currentElement;
    var childContext = this._getValidatedChildContext();
    var nextRenderedElement = this._renderValidatedComponent(childContext);
    if (shouldUpdateReactComponent(prevRenderedElement, nextRenderedElement)) {
      ReactReconciler.receiveComponent(
        prevComponentInstance,
        nextRenderedElement,
        transaction,
        this._mergeChildContext(context, childContext)
      );
    } else {
      // These two IDs are actually the same! But nothing should rely on that.
      var thisID = this._rootNodeID;
      var prevComponentID = prevComponentInstance._rootNodeID;
      ReactReconciler.unmountComponent(prevComponentInstance);

      this._renderedComponent = this._instantiateReactComponent(
        nextRenderedElement,
        this._currentElement.type
      );
      var nextMarkup = ReactReconciler.mountComponent(
        this._renderedComponent,
        thisID,
        transaction,
        this._mergeChildContext(context, childContext)
      );
      this._replaceNodeWithMarkupByID(prevComponentID, nextMarkup);
    }
  },

  /**
   * @protected
   */
  _replaceNodeWithMarkupByID: function(prevComponentID, nextMarkup) {
    ReactComponentEnvironment.replaceNodeWithMarkupByID(
      prevComponentID,
      nextMarkup
    );
  },

  /**
   * @protected
   */
  _renderValidatedComponentWithoutOwnerOrContext: function() {
    var inst = this._instance;
    var renderedComponent = inst.render();
    if ("production" !== "development") {
      // We allow auto-mocks to proceed as if they're returning null.
      if (typeof renderedComponent === 'undefined' &&
          inst.render._isMockFunction) {
        // This is probably bad practice. Consider warning here and
        // deprecating this convenience.
        renderedComponent = null;
      }
    }

    return renderedComponent;
  },

  /**
   * @private
   */
  _renderValidatedComponent: function(childContext) {
    var renderedComponent;
    var previousContext = ReactContext.current;
    ReactContext.current = this._mergeChildContext(
      this._currentElement._context,
      childContext
    );
    ReactCurrentOwner.current = this;
    try {
      renderedComponent =
        this._renderValidatedComponentWithoutOwnerOrContext();
    } finally {
      ReactContext.current = previousContext;
      ReactCurrentOwner.current = null;
    }
    ("production" !== "development" ? invariant(
      // TODO: An `isValidNode` function would probably be more appropriate
      renderedComponent === null || renderedComponent === false ||
      ReactElement.isValidElement(renderedComponent),
      '%s.render(): A valid ReactComponent must be returned. You may have ' +
        'returned undefined, an array or some other invalid object.',
      this.getName() || 'ReactCompositeComponent'
    ) : invariant(// TODO: An `isValidNode` function would probably be more appropriate
    renderedComponent === null || renderedComponent === false ||
    ReactElement.isValidElement(renderedComponent)));
    return renderedComponent;
  },

  /**
   * Lazily allocates the refs object and stores `component` as `ref`.
   *
   * @param {string} ref Reference name.
   * @param {component} component Component to store as `ref`.
   * @final
   * @private
   */
  attachRef: function(ref, component) {
    var inst = this.getPublicInstance();
    var refs = inst.refs === emptyObject ? (inst.refs = {}) : inst.refs;
    refs[ref] = component.getPublicInstance();
  },

  /**
   * Detaches a reference name.
   *
   * @param {string} ref Name to dereference.
   * @final
   * @private
   */
  detachRef: function(ref) {
    var refs = this.getPublicInstance().refs;
    delete refs[ref];
  },

  /**
   * Get a text description of the component that can be used to identify it
   * in error messages.
   * @return {string} The name or null.
   * @internal
   */
  getName: function() {
    var type = this._currentElement.type;
    var constructor = this._instance && this._instance.constructor;
    return (
      type.displayName || (constructor && constructor.displayName) ||
      type.name || (constructor && constructor.name) ||
      null
    );
  },

  /**
   * Get the publicly accessible representation of this component - i.e. what
   * is exposed by refs and returned by React.render. Can be null for stateless
   * components.
   *
   * @return {ReactComponent} the public component instance.
   * @internal
   */
  getPublicInstance: function() {
    return this._instance;
  },

  // Stub
  _instantiateReactComponent: null

};

ReactPerf.measureMethods(
  ReactCompositeComponentMixin,
  'ReactCompositeComponent',
  {
    mountComponent: 'mountComponent',
    updateComponent: 'updateComponent',
    _renderValidatedComponent: '_renderValidatedComponent'
  }
);

var ReactCompositeComponent = {

  Mixin: ReactCompositeComponentMixin

};

module.exports = ReactCompositeComponent;

},{"115":115,"135":135,"151":151,"154":154,"27":27,"36":36,"38":38,"39":39,"57":57,"58":58,"67":67,"68":68,"73":73,"75":75,"76":76,"77":77,"81":81,"87":87}],38:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactContext
 */

'use strict';

var assign = _dereq_(27);
var emptyObject = _dereq_(115);
var warning = _dereq_(154);

var didWarn = false;

/**
 * Keeps track of the current context.
 *
 * The context is automatically passed down the component ownership hierarchy
 * and is accessible via `this.context` on ReactCompositeComponents.
 */
var ReactContext = {

  /**
   * @internal
   * @type {object}
   */
  current: emptyObject,

  /**
   * Temporarily extends the current context while executing scopedCallback.
   *
   * A typical use case might look like
   *
   *  render: function() {
   *    var children = ReactContext.withContext({foo: 'foo'}, () => (
   *
   *    ));
   *    return <div>{children}</div>;
   *  }
   *
   * @param {object} newContext New context to merge into the existing context
   * @param {function} scopedCallback Callback to run with the new context
   * @return {ReactComponent|array<ReactComponent>}
   */
  withContext: function(newContext, scopedCallback) {
    if ("production" !== "development") {
      ("production" !== "development" ? warning(
        didWarn,
        'withContext is deprecated and will be removed in a future version. ' +
        'Use a wrapper component with getChildContext instead.'
      ) : null);

      didWarn = true;
    }

    var result;
    var previousContext = ReactContext.current;
    ReactContext.current = assign({}, previousContext, newContext);
    try {
      result = scopedCallback();
    } finally {
      ReactContext.current = previousContext;
    }
    return result;
  }

};

module.exports = ReactContext;

},{"115":115,"154":154,"27":27}],39:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactCurrentOwner
 */

'use strict';

/**
 * Keeps track of the current owner.
 *
 * The current owner is the component who should own any components that are
 * currently being constructed.
 *
 * The depth indicate how many composite components are above this render level.
 */
var ReactCurrentOwner = {

  /**
   * @internal
   * @type {ReactComponent}
   */
  current: null

};

module.exports = ReactCurrentOwner;

},{}],40:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOM
 * @typechecks static-only
 */

'use strict';

var ReactElement = _dereq_(57);
var ReactElementValidator = _dereq_(58);

var mapObject = _dereq_(142);

/**
 * Create a factory that creates HTML tag elements.
 *
 * @param {string} tag Tag name (e.g. `div`).
 * @private
 */
function createDOMFactory(tag) {
  if ("production" !== "development") {
    return ReactElementValidator.createFactory(tag);
  }
  return ReactElement.createFactory(tag);
}

/**
 * Creates a mapping from supported HTML tags to `ReactDOMComponent` classes.
 * This is also accessible via `React.DOM`.
 *
 * @public
 */
var ReactDOM = mapObject({
  a: 'a',
  abbr: 'abbr',
  address: 'address',
  area: 'area',
  article: 'article',
  aside: 'aside',
  audio: 'audio',
  b: 'b',
  base: 'base',
  bdi: 'bdi',
  bdo: 'bdo',
  big: 'big',
  blockquote: 'blockquote',
  body: 'body',
  br: 'br',
  button: 'button',
  canvas: 'canvas',
  caption: 'caption',
  cite: 'cite',
  code: 'code',
  col: 'col',
  colgroup: 'colgroup',
  data: 'data',
  datalist: 'datalist',
  dd: 'dd',
  del: 'del',
  details: 'details',
  dfn: 'dfn',
  dialog: 'dialog',
  div: 'div',
  dl: 'dl',
  dt: 'dt',
  em: 'em',
  embed: 'embed',
  fieldset: 'fieldset',
  figcaption: 'figcaption',
  figure: 'figure',
  footer: 'footer',
  form: 'form',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
  h5: 'h5',
  h6: 'h6',
  head: 'head',
  header: 'header',
  hr: 'hr',
  html: 'html',
  i: 'i',
  iframe: 'iframe',
  img: 'img',
  input: 'input',
  ins: 'ins',
  kbd: 'kbd',
  keygen: 'keygen',
  label: 'label',
  legend: 'legend',
  li: 'li',
  link: 'link',
  main: 'main',
  map: 'map',
  mark: 'mark',
  menu: 'menu',
  menuitem: 'menuitem',
  meta: 'meta',
  meter: 'meter',
  nav: 'nav',
  noscript: 'noscript',
  object: 'object',
  ol: 'ol',
  optgroup: 'optgroup',
  option: 'option',
  output: 'output',
  p: 'p',
  param: 'param',
  picture: 'picture',
  pre: 'pre',
  progress: 'progress',
  q: 'q',
  rp: 'rp',
  rt: 'rt',
  ruby: 'ruby',
  s: 's',
  samp: 'samp',
  script: 'script',
  section: 'section',
  select: 'select',
  small: 'small',
  source: 'source',
  span: 'span',
  strong: 'strong',
  style: 'style',
  sub: 'sub',
  summary: 'summary',
  sup: 'sup',
  table: 'table',
  tbody: 'tbody',
  td: 'td',
  textarea: 'textarea',
  tfoot: 'tfoot',
  th: 'th',
  thead: 'thead',
  time: 'time',
  title: 'title',
  tr: 'tr',
  track: 'track',
  u: 'u',
  ul: 'ul',
  'var': 'var',
  video: 'video',
  wbr: 'wbr',

  // SVG
  circle: 'circle',
  clipPath: 'clipPath',
  defs: 'defs',
  ellipse: 'ellipse',
  g: 'g',
  line: 'line',
  linearGradient: 'linearGradient',
  mask: 'mask',
  path: 'path',
  pattern: 'pattern',
  polygon: 'polygon',
  polyline: 'polyline',
  radialGradient: 'radialGradient',
  rect: 'rect',
  stop: 'stop',
  svg: 'svg',
  text: 'text',
  tspan: 'tspan'

}, createDOMFactory);

module.exports = ReactDOM;

},{"142":142,"57":57,"58":58}],41:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMButton
 */

'use strict';

var AutoFocusMixin = _dereq_(2);
var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);

var keyMirror = _dereq_(140);

var button = ReactElement.createFactory('button');

var mouseListenerNames = keyMirror({
  onClick: true,
  onDoubleClick: true,
  onMouseDown: true,
  onMouseMove: true,
  onMouseUp: true,
  onClickCapture: true,
  onDoubleClickCapture: true,
  onMouseDownCapture: true,
  onMouseMoveCapture: true,
  onMouseUpCapture: true
});

/**
 * Implements a <button> native component that does not receive mouse events
 * when `disabled` is set.
 */
var ReactDOMButton = ReactClass.createClass({
  displayName: 'ReactDOMButton',
  tagName: 'BUTTON',

  mixins: [AutoFocusMixin, ReactBrowserComponentMixin],

  render: function() {
    var props = {};

    // Copy the props; except the mouse listeners if we're disabled
    for (var key in this.props) {
      if (this.props.hasOwnProperty(key) &&
          (!this.props.disabled || !mouseListenerNames[key])) {
        props[key] = this.props[key];
      }
    }

    return button(props, this.props.children);
  }

});

module.exports = ReactDOMButton;

},{"140":140,"2":2,"29":29,"33":33,"57":57}],42:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMComponent
 * @typechecks static-only
 */

/* global hasOwnProperty:true */

'use strict';

var CSSPropertyOperations = _dereq_(5);
var DOMProperty = _dereq_(10);
var DOMPropertyOperations = _dereq_(11);
var ReactBrowserEventEmitter = _dereq_(30);
var ReactComponentBrowserEnvironment =
  _dereq_(35);
var ReactMount = _dereq_(70);
var ReactMultiChild = _dereq_(71);
var ReactPerf = _dereq_(75);

var assign = _dereq_(27);
var escapeTextContentForBrowser = _dereq_(116);
var invariant = _dereq_(135);
var isEventSupported = _dereq_(136);
var keyOf = _dereq_(141);
var warning = _dereq_(154);

var deleteListener = ReactBrowserEventEmitter.deleteListener;
var listenTo = ReactBrowserEventEmitter.listenTo;
var registrationNameModules = ReactBrowserEventEmitter.registrationNameModules;

// For quickly matching children type, to test if can be treated as content.
var CONTENT_TYPES = {'string': true, 'number': true};

var STYLE = keyOf({style: null});

var ELEMENT_NODE_TYPE = 1;

/**
 * Optionally injectable operations for mutating the DOM
 */
var BackendIDOperations = null;

/**
 * @param {?object} props
 */
function assertValidProps(props) {
  if (!props) {
    return;
  }
  // Note the use of `==` which checks for null or undefined.
  if (props.dangerouslySetInnerHTML != null) {
    ("production" !== "development" ? invariant(
      props.children == null,
      'Can only set one of `children` or `props.dangerouslySetInnerHTML`.'
    ) : invariant(props.children == null));
    ("production" !== "development" ? invariant(
      typeof props.dangerouslySetInnerHTML === 'object' &&
      '__html' in props.dangerouslySetInnerHTML,
      '`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. ' +
      'Please visit https://fb.me/react-invariant-dangerously-set-inner-html ' +
      'for more information.'
    ) : invariant(typeof props.dangerouslySetInnerHTML === 'object' &&
    '__html' in props.dangerouslySetInnerHTML));
  }
  if ("production" !== "development") {
    ("production" !== "development" ? warning(
      props.innerHTML == null,
      'Directly setting property `innerHTML` is not permitted. ' +
      'For more information, lookup documentation on `dangerouslySetInnerHTML`.'
    ) : null);
    ("production" !== "development" ? warning(
      !props.contentEditable || props.children == null,
      'A component is `contentEditable` and contains `children` managed by ' +
      'React. It is now your responsibility to guarantee that none of ' +
      'those nodes are unexpectedly modified or duplicated. This is ' +
      'probably not intentional.'
    ) : null);
  }
  ("production" !== "development" ? invariant(
    props.style == null || typeof props.style === 'object',
    'The `style` prop expects a mapping from style properties to values, ' +
    'not a string. For example, style={{marginRight: spacing + \'em\'}} when ' +
    'using JSX.'
  ) : invariant(props.style == null || typeof props.style === 'object'));
}

function putListener(id, registrationName, listener, transaction) {
  if ("production" !== "development") {
    // IE8 has no API for event capturing and the `onScroll` event doesn't
    // bubble.
    ("production" !== "development" ? warning(
      registrationName !== 'onScroll' || isEventSupported('scroll', true),
      'This browser doesn\'t support the `onScroll` event'
    ) : null);
  }
  var container = ReactMount.findReactContainerForID(id);
  if (container) {
    var doc = container.nodeType === ELEMENT_NODE_TYPE ?
      container.ownerDocument :
      container;
    listenTo(registrationName, doc);
  }
  transaction.getPutListenerQueue().enqueuePutListener(
    id,
    registrationName,
    listener
  );
}

// For HTML, certain tags should omit their close tag. We keep a whitelist for
// those special cased tags.

var omittedCloseTags = {
  'area': true,
  'base': true,
  'br': true,
  'col': true,
  'embed': true,
  'hr': true,
  'img': true,
  'input': true,
  'keygen': true,
  'link': true,
  'meta': true,
  'param': true,
  'source': true,
  'track': true,
  'wbr': true
  // NOTE: menuitem's close tag should be omitted, but that causes problems.
};

// We accept any tag to be rendered but since this gets injected into abitrary
// HTML, we want to make sure that it's a safe tag.
// http://www.w3.org/TR/REC-xml/#NT-Name

var VALID_TAG_REGEX = /^[a-zA-Z][a-zA-Z:_\.\-\d]*$/; // Simplified subset
var validatedTagCache = {};
var hasOwnProperty = {}.hasOwnProperty;

function validateDangerousTag(tag) {
  if (!hasOwnProperty.call(validatedTagCache, tag)) {
    ("production" !== "development" ? invariant(VALID_TAG_REGEX.test(tag), 'Invalid tag: %s', tag) : invariant(VALID_TAG_REGEX.test(tag)));
    validatedTagCache[tag] = true;
  }
}

/**
 * Creates a new React class that is idempotent and capable of containing other
 * React components. It accepts event listeners and DOM properties that are
 * valid according to `DOMProperty`.
 *
 *  - Event listeners: `onClick`, `onMouseDown`, etc.
 *  - DOM properties: `className`, `name`, `title`, etc.
 *
 * The `style` property functions differently from the DOM API. It accepts an
 * object mapping of style properties to values.
 *
 * @constructor ReactDOMComponent
 * @extends ReactMultiChild
 */
function ReactDOMComponent(tag) {
  validateDangerousTag(tag);
  this._tag = tag;
  this._renderedChildren = null;
  this._previousStyleCopy = null;
  this._rootNodeID = null;
}

ReactDOMComponent.displayName = 'ReactDOMComponent';

ReactDOMComponent.Mixin = {

  construct: function(element) {
    this._currentElement = element;
  },

  /**
   * Generates root tag markup then recurses. This method has side effects and
   * is not idempotent.
   *
   * @internal
   * @param {string} rootID The root DOM ID for this node.
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @return {string} The computed markup.
   */
  mountComponent: function(rootID, transaction, context) {
    this._rootNodeID = rootID;
    assertValidProps(this._currentElement.props);
    var closeTag = omittedCloseTags[this._tag] ? '' : '</' + this._tag + '>';
    return (
      this._createOpenTagMarkupAndPutListeners(transaction) +
      this._createContentMarkup(transaction, context) +
      closeTag
    );
  },

  /**
   * Creates markup for the open tag and all attributes.
   *
   * This method has side effects because events get registered.
   *
   * Iterating over object properties is faster than iterating over arrays.
   * @see http://jsperf.com/obj-vs-arr-iteration
   *
   * @private
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @return {string} Markup of opening tag.
   */
  _createOpenTagMarkupAndPutListeners: function(transaction) {
    var props = this._currentElement.props;
    var ret = '<' + this._tag;

    for (var propKey in props) {
      if (!props.hasOwnProperty(propKey)) {
        continue;
      }
      var propValue = props[propKey];
      if (propValue == null) {
        continue;
      }
      if (registrationNameModules.hasOwnProperty(propKey)) {
        putListener(this._rootNodeID, propKey, propValue, transaction);
      } else {
        if (propKey === STYLE) {
          if (propValue) {
            propValue = this._previousStyleCopy = assign({}, props.style);
          }
          propValue = CSSPropertyOperations.createMarkupForStyles(propValue);
        }
        var markup =
          DOMPropertyOperations.createMarkupForProperty(propKey, propValue);
        if (markup) {
          ret += ' ' + markup;
        }
      }
    }

    // For static pages, no need to put React ID and checksum. Saves lots of
    // bytes.
    if (transaction.renderToStaticMarkup) {
      return ret + '>';
    }

    var markupForID = DOMPropertyOperations.createMarkupForID(this._rootNodeID);
    return ret + ' ' + markupForID + '>';
  },

  /**
   * Creates markup for the content between the tags.
   *
   * @private
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @param {object} context
   * @return {string} Content markup.
   */
  _createContentMarkup: function(transaction, context) {
    var prefix = '';
    if (this._tag === 'listing' ||
        this._tag === 'pre' ||
        this._tag === 'textarea') {
      // Add an initial newline because browsers ignore the first newline in
      // a <listing>, <pre>, or <textarea> as an "authoring convenience" -- see
      // https://html.spec.whatwg.org/multipage/syntax.html#parsing-main-inbody.
      prefix = '\n';
    }

    var props = this._currentElement.props;

    // Intentional use of != to avoid catching zero/false.
    var innerHTML = props.dangerouslySetInnerHTML;
    if (innerHTML != null) {
      if (innerHTML.__html != null) {
        return prefix + innerHTML.__html;
      }
    } else {
      var contentToUse =
        CONTENT_TYPES[typeof props.children] ? props.children : null;
      var childrenToUse = contentToUse != null ? null : props.children;
      if (contentToUse != null) {
        return prefix + escapeTextContentForBrowser(contentToUse);
      } else if (childrenToUse != null) {
        var mountImages = this.mountChildren(
          childrenToUse,
          transaction,
          context
        );
        return prefix + mountImages.join('');
      }
    }
    return prefix;
  },

  receiveComponent: function(nextElement, transaction, context) {
    var prevElement = this._currentElement;
    this._currentElement = nextElement;
    this.updateComponent(transaction, prevElement, nextElement, context);
  },

  /**
   * Updates a native DOM component after it has already been allocated and
   * attached to the DOM. Reconciles the root DOM node, then recurses.
   *
   * @param {ReactReconcileTransaction} transaction
   * @param {ReactElement} prevElement
   * @param {ReactElement} nextElement
   * @internal
   * @overridable
   */
  updateComponent: function(transaction, prevElement, nextElement, context) {
    assertValidProps(this._currentElement.props);
    this._updateDOMProperties(prevElement.props, transaction);
    this._updateDOMChildren(prevElement.props, transaction, context);
  },

  /**
   * Reconciles the properties by detecting differences in property values and
   * updating the DOM as necessary. This function is probably the single most
   * critical path for performance optimization.
   *
   * TODO: Benchmark whether checking for changed values in memory actually
   *       improves performance (especially statically positioned elements).
   * TODO: Benchmark the effects of putting this at the top since 99% of props
   *       do not change for a given reconciliation.
   * TODO: Benchmark areas that can be improved with caching.
   *
   * @private
   * @param {object} lastProps
   * @param {ReactReconcileTransaction} transaction
   */
  _updateDOMProperties: function(lastProps, transaction) {
    var nextProps = this._currentElement.props;
    var propKey;
    var styleName;
    var styleUpdates;
    for (propKey in lastProps) {
      if (nextProps.hasOwnProperty(propKey) ||
         !lastProps.hasOwnProperty(propKey)) {
        continue;
      }
      if (propKey === STYLE) {
        var lastStyle = this._previousStyleCopy;
        for (styleName in lastStyle) {
          if (lastStyle.hasOwnProperty(styleName)) {
            styleUpdates = styleUpdates || {};
            styleUpdates[styleName] = '';
          }
        }
        this._previousStyleCopy = null;
      } else if (registrationNameModules.hasOwnProperty(propKey)) {
        deleteListener(this._rootNodeID, propKey);
      } else if (
          DOMProperty.isStandardName[propKey] ||
          DOMProperty.isCustomAttribute(propKey)) {
        BackendIDOperations.deletePropertyByID(
          this._rootNodeID,
          propKey
        );
      }
    }
    for (propKey in nextProps) {
      var nextProp = nextProps[propKey];
      var lastProp = propKey === STYLE ?
        this._previousStyleCopy :
        lastProps[propKey];
      if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp) {
        continue;
      }
      if (propKey === STYLE) {
        if (nextProp) {
          nextProp = this._previousStyleCopy = assign({}, nextProp);
        } else {
          this._previousStyleCopy = null;
        }
        if (lastProp) {
          // Unset styles on `lastProp` but not on `nextProp`.
          for (styleName in lastProp) {
            if (lastProp.hasOwnProperty(styleName) &&
                (!nextProp || !nextProp.hasOwnProperty(styleName))) {
              styleUpdates = styleUpdates || {};
              styleUpdates[styleName] = '';
            }
          }
          // Update styles that changed since `lastProp`.
          for (styleName in nextProp) {
            if (nextProp.hasOwnProperty(styleName) &&
                lastProp[styleName] !== nextProp[styleName]) {
              styleUpdates = styleUpdates || {};
              styleUpdates[styleName] = nextProp[styleName];
            }
          }
        } else {
          // Relies on `updateStylesByID` not mutating `styleUpdates`.
          styleUpdates = nextProp;
        }
      } else if (registrationNameModules.hasOwnProperty(propKey)) {
        putListener(this._rootNodeID, propKey, nextProp, transaction);
      } else if (
          DOMProperty.isStandardName[propKey] ||
          DOMProperty.isCustomAttribute(propKey)) {
        BackendIDOperations.updatePropertyByID(
          this._rootNodeID,
          propKey,
          nextProp
        );
      }
    }
    if (styleUpdates) {
      BackendIDOperations.updateStylesByID(
        this._rootNodeID,
        styleUpdates
      );
    }
  },

  /**
   * Reconciles the children with the various properties that affect the
   * children content.
   *
   * @param {object} lastProps
   * @param {ReactReconcileTransaction} transaction
   */
  _updateDOMChildren: function(lastProps, transaction, context) {
    var nextProps = this._currentElement.props;

    var lastContent =
      CONTENT_TYPES[typeof lastProps.children] ? lastProps.children : null;
    var nextContent =
      CONTENT_TYPES[typeof nextProps.children] ? nextProps.children : null;

    var lastHtml =
      lastProps.dangerouslySetInnerHTML &&
      lastProps.dangerouslySetInnerHTML.__html;
    var nextHtml =
      nextProps.dangerouslySetInnerHTML &&
      nextProps.dangerouslySetInnerHTML.__html;

    // Note the use of `!=` which checks for null or undefined.
    var lastChildren = lastContent != null ? null : lastProps.children;
    var nextChildren = nextContent != null ? null : nextProps.children;

    // If we're switching from children to content/html or vice versa, remove
    // the old content
    var lastHasContentOrHtml = lastContent != null || lastHtml != null;
    var nextHasContentOrHtml = nextContent != null || nextHtml != null;
    if (lastChildren != null && nextChildren == null) {
      this.updateChildren(null, transaction, context);
    } else if (lastHasContentOrHtml && !nextHasContentOrHtml) {
      this.updateTextContent('');
    }

    if (nextContent != null) {
      if (lastContent !== nextContent) {
        this.updateTextContent('' + nextContent);
      }
    } else if (nextHtml != null) {
      if (lastHtml !== nextHtml) {
        BackendIDOperations.updateInnerHTMLByID(
          this._rootNodeID,
          nextHtml
        );
      }
    } else if (nextChildren != null) {
      this.updateChildren(nextChildren, transaction, context);
    }
  },

  /**
   * Destroys all event registrations for this instance. Does not remove from
   * the DOM. That must be done by the parent.
   *
   * @internal
   */
  unmountComponent: function() {
    this.unmountChildren();
    ReactBrowserEventEmitter.deleteAllListeners(this._rootNodeID);
    ReactComponentBrowserEnvironment.unmountIDFromEnvironment(this._rootNodeID);
    this._rootNodeID = null;
  }

};

ReactPerf.measureMethods(ReactDOMComponent, 'ReactDOMComponent', {
  mountComponent: 'mountComponent',
  updateComponent: 'updateComponent'
});

assign(
  ReactDOMComponent.prototype,
  ReactDOMComponent.Mixin,
  ReactMultiChild.Mixin
);

ReactDOMComponent.injection = {
  injectIDOperations: function(IDOperations) {
    ReactDOMComponent.BackendIDOperations = BackendIDOperations = IDOperations;
  }
};

module.exports = ReactDOMComponent;

},{"10":10,"11":11,"116":116,"135":135,"136":136,"141":141,"154":154,"27":27,"30":30,"35":35,"5":5,"70":70,"71":71,"75":75}],43:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMForm
 */

'use strict';

var EventConstants = _dereq_(15);
var LocalEventTrapMixin = _dereq_(25);
var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);

var form = ReactElement.createFactory('form');

/**
 * Since onSubmit doesn't bubble OR capture on the top level in IE8, we need
 * to capture it on the <form> element itself. There are lots of hacks we could
 * do to accomplish this, but the most reliable is to make <form> a
 * composite component and use `componentDidMount` to attach the event handlers.
 */
var ReactDOMForm = ReactClass.createClass({
  displayName: 'ReactDOMForm',
  tagName: 'FORM',

  mixins: [ReactBrowserComponentMixin, LocalEventTrapMixin],

  render: function() {
    // TODO: Instead of using `ReactDOM` directly, we should use JSX. However,
    // `jshint` fails to parse JSX so in order for linting to work in the open
    // source repo, we need to just use `ReactDOM.form`.
    return form(this.props);
  },

  componentDidMount: function() {
    this.trapBubbledEvent(EventConstants.topLevelTypes.topReset, 'reset');
    this.trapBubbledEvent(EventConstants.topLevelTypes.topSubmit, 'submit');
  }
});

module.exports = ReactDOMForm;

},{"15":15,"25":25,"29":29,"33":33,"57":57}],44:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMIDOperations
 * @typechecks static-only
 */

/*jslint evil: true */

'use strict';

var CSSPropertyOperations = _dereq_(5);
var DOMChildrenOperations = _dereq_(9);
var DOMPropertyOperations = _dereq_(11);
var ReactMount = _dereq_(70);
var ReactPerf = _dereq_(75);

var invariant = _dereq_(135);
var setInnerHTML = _dereq_(148);

/**
 * Errors for properties that should not be updated with `updatePropertyById()`.
 *
 * @type {object}
 * @private
 */
var INVALID_PROPERTY_ERRORS = {
  dangerouslySetInnerHTML:
    '`dangerouslySetInnerHTML` must be set using `updateInnerHTMLByID()`.',
  style: '`style` must be set using `updateStylesByID()`.'
};

/**
 * Operations used to process updates to DOM nodes. This is made injectable via
 * `ReactDOMComponent.BackendIDOperations`.
 */
var ReactDOMIDOperations = {

  /**
   * Updates a DOM node with new property values. This should only be used to
   * update DOM properties in `DOMProperty`.
   *
   * @param {string} id ID of the node to update.
   * @param {string} name A valid property name, see `DOMProperty`.
   * @param {*} value New value of the property.
   * @internal
   */
  updatePropertyByID: function(id, name, value) {
    var node = ReactMount.getNode(id);
    ("production" !== "development" ? invariant(
      !INVALID_PROPERTY_ERRORS.hasOwnProperty(name),
      'updatePropertyByID(...): %s',
      INVALID_PROPERTY_ERRORS[name]
    ) : invariant(!INVALID_PROPERTY_ERRORS.hasOwnProperty(name)));

    // If we're updating to null or undefined, we should remove the property
    // from the DOM node instead of inadvertantly setting to a string. This
    // brings us in line with the same behavior we have on initial render.
    if (value != null) {
      DOMPropertyOperations.setValueForProperty(node, name, value);
    } else {
      DOMPropertyOperations.deleteValueForProperty(node, name);
    }
  },

  /**
   * Updates a DOM node to remove a property. This should only be used to remove
   * DOM properties in `DOMProperty`.
   *
   * @param {string} id ID of the node to update.
   * @param {string} name A property name to remove, see `DOMProperty`.
   * @internal
   */
  deletePropertyByID: function(id, name, value) {
    var node = ReactMount.getNode(id);
    ("production" !== "development" ? invariant(
      !INVALID_PROPERTY_ERRORS.hasOwnProperty(name),
      'updatePropertyByID(...): %s',
      INVALID_PROPERTY_ERRORS[name]
    ) : invariant(!INVALID_PROPERTY_ERRORS.hasOwnProperty(name)));
    DOMPropertyOperations.deleteValueForProperty(node, name, value);
  },

  /**
   * Updates a DOM node with new style values. If a value is specified as '',
   * the corresponding style property will be unset.
   *
   * @param {string} id ID of the node to update.
   * @param {object} styles Mapping from styles to values.
   * @internal
   */
  updateStylesByID: function(id, styles) {
    var node = ReactMount.getNode(id);
    CSSPropertyOperations.setValueForStyles(node, styles);
  },

  /**
   * Updates a DOM node's innerHTML.
   *
   * @param {string} id ID of the node to update.
   * @param {string} html An HTML string.
   * @internal
   */
  updateInnerHTMLByID: function(id, html) {
    var node = ReactMount.getNode(id);
    setInnerHTML(node, html);
  },

  /**
   * Updates a DOM node's text content set by `props.content`.
   *
   * @param {string} id ID of the node to update.
   * @param {string} content Text content.
   * @internal
   */
  updateTextContentByID: function(id, content) {
    var node = ReactMount.getNode(id);
    DOMChildrenOperations.updateTextContent(node, content);
  },

  /**
   * Replaces a DOM node that exists in the document with markup.
   *
   * @param {string} id ID of child to be replaced.
   * @param {string} markup Dangerous markup to inject in place of child.
   * @internal
   * @see {Danger.dangerouslyReplaceNodeWithMarkup}
   */
  dangerouslyReplaceNodeWithMarkupByID: function(id, markup) {
    var node = ReactMount.getNode(id);
    DOMChildrenOperations.dangerouslyReplaceNodeWithMarkup(node, markup);
  },

  /**
   * Updates a component's children by processing a series of updates.
   *
   * @param {array<object>} updates List of update configurations.
   * @param {array<string>} markup List of markup strings.
   * @internal
   */
  dangerouslyProcessChildrenUpdates: function(updates, markup) {
    for (var i = 0; i < updates.length; i++) {
      updates[i].parentNode = ReactMount.getNode(updates[i].parentID);
    }
    DOMChildrenOperations.processUpdates(updates, markup);
  }
};

ReactPerf.measureMethods(ReactDOMIDOperations, 'ReactDOMIDOperations', {
  updatePropertyByID: 'updatePropertyByID',
  deletePropertyByID: 'deletePropertyByID',
  updateStylesByID: 'updateStylesByID',
  updateInnerHTMLByID: 'updateInnerHTMLByID',
  updateTextContentByID: 'updateTextContentByID',
  dangerouslyReplaceNodeWithMarkupByID: 'dangerouslyReplaceNodeWithMarkupByID',
  dangerouslyProcessChildrenUpdates: 'dangerouslyProcessChildrenUpdates'
});

module.exports = ReactDOMIDOperations;

},{"11":11,"135":135,"148":148,"5":5,"70":70,"75":75,"9":9}],45:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMIframe
 */

'use strict';

var EventConstants = _dereq_(15);
var LocalEventTrapMixin = _dereq_(25);
var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);

var iframe = ReactElement.createFactory('iframe');

/**
 * Since onLoad doesn't bubble OR capture on the top level in IE8, we need to
 * capture it on the <iframe> element itself. There are lots of hacks we could
 * do to accomplish this, but the most reliable is to make <iframe> a composite
 * component and use `componentDidMount` to attach the event handlers.
 */
var ReactDOMIframe = ReactClass.createClass({
  displayName: 'ReactDOMIframe',
  tagName: 'IFRAME',

  mixins: [ReactBrowserComponentMixin, LocalEventTrapMixin],

  render: function() {
    return iframe(this.props);
  },

  componentDidMount: function() {
    this.trapBubbledEvent(EventConstants.topLevelTypes.topLoad, 'load');
  }
});

module.exports = ReactDOMIframe;

},{"15":15,"25":25,"29":29,"33":33,"57":57}],46:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMImg
 */

'use strict';

var EventConstants = _dereq_(15);
var LocalEventTrapMixin = _dereq_(25);
var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);

var img = ReactElement.createFactory('img');

/**
 * Since onLoad doesn't bubble OR capture on the top level in IE8, we need to
 * capture it on the <img> element itself. There are lots of hacks we could do
 * to accomplish this, but the most reliable is to make <img> a composite
 * component and use `componentDidMount` to attach the event handlers.
 */
var ReactDOMImg = ReactClass.createClass({
  displayName: 'ReactDOMImg',
  tagName: 'IMG',

  mixins: [ReactBrowserComponentMixin, LocalEventTrapMixin],

  render: function() {
    return img(this.props);
  },

  componentDidMount: function() {
    this.trapBubbledEvent(EventConstants.topLevelTypes.topLoad, 'load');
    this.trapBubbledEvent(EventConstants.topLevelTypes.topError, 'error');
  }
});

module.exports = ReactDOMImg;

},{"15":15,"25":25,"29":29,"33":33,"57":57}],47:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMInput
 */

'use strict';

var AutoFocusMixin = _dereq_(2);
var DOMPropertyOperations = _dereq_(11);
var LinkedValueUtils = _dereq_(24);
var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);
var ReactMount = _dereq_(70);
var ReactUpdates = _dereq_(87);

var assign = _dereq_(27);
var invariant = _dereq_(135);

var input = ReactElement.createFactory('input');

var instancesByReactID = {};

function forceUpdateIfMounted() {
  /*jshint validthis:true */
  if (this.isMounted()) {
    this.forceUpdate();
  }
}

/**
 * Implements an <input> native component that allows setting these optional
 * props: `checked`, `value`, `defaultChecked`, and `defaultValue`.
 *
 * If `checked` or `value` are not supplied (or null/undefined), user actions
 * that affect the checked state or value will trigger updates to the element.
 *
 * If they are supplied (and not null/undefined), the rendered element will not
 * trigger updates to the element. Instead, the props must change in order for
 * the rendered element to be updated.
 *
 * The rendered element will be initialized as unchecked (or `defaultChecked`)
 * with an empty value (or `defaultValue`).
 *
 * @see http://www.w3.org/TR/2012/WD-html5-20121025/the-input-element.html
 */
var ReactDOMInput = ReactClass.createClass({
  displayName: 'ReactDOMInput',
  tagName: 'INPUT',

  mixins: [AutoFocusMixin, LinkedValueUtils.Mixin, ReactBrowserComponentMixin],

  getInitialState: function() {
    var defaultValue = this.props.defaultValue;
    return {
      initialChecked: this.props.defaultChecked || false,
      initialValue: defaultValue != null ? defaultValue : null
    };
  },

  render: function() {
    // Clone `this.props` so we don't mutate the input.
    var props = assign({}, this.props);

    props.defaultChecked = null;
    props.defaultValue = null;

    var value = LinkedValueUtils.getValue(this);
    props.value = value != null ? value : this.state.initialValue;

    var checked = LinkedValueUtils.getChecked(this);
    props.checked = checked != null ? checked : this.state.initialChecked;

    props.onChange = this._handleChange;

    return input(props, this.props.children);
  },

  componentDidMount: function() {
    var id = ReactMount.getID(this.getDOMNode());
    instancesByReactID[id] = this;
  },

  componentWillUnmount: function() {
    var rootNode = this.getDOMNode();
    var id = ReactMount.getID(rootNode);
    delete instancesByReactID[id];
  },

  componentDidUpdate: function(prevProps, prevState, prevContext) {
    var rootNode = this.getDOMNode();
    if (this.props.checked != null) {
      DOMPropertyOperations.setValueForProperty(
        rootNode,
        'checked',
        this.props.checked || false
      );
    }

    var value = LinkedValueUtils.getValue(this);
    if (value != null) {
      // Cast `value` to a string to ensure the value is set correctly. While
      // browsers typically do this as necessary, jsdom doesn't.
      DOMPropertyOperations.setValueForProperty(rootNode, 'value', '' + value);
    }
  },

  _handleChange: function(event) {
    var returnValue;
    var onChange = LinkedValueUtils.getOnChange(this);
    if (onChange) {
      returnValue = onChange.call(this, event);
    }
    // Here we use asap to wait until all updates have propagated, which
    // is important when using controlled components within layers:
    // https://github.com/facebook/react/issues/1698
    ReactUpdates.asap(forceUpdateIfMounted, this);

    var name = this.props.name;
    if (this.props.type === 'radio' && name != null) {
      var rootNode = this.getDOMNode();
      var queryRoot = rootNode;

      while (queryRoot.parentNode) {
        queryRoot = queryRoot.parentNode;
      }

      // If `rootNode.form` was non-null, then we could try `form.elements`,
      // but that sometimes behaves strangely in IE8. We could also try using
      // `form.getElementsByName`, but that will only return direct children
      // and won't include inputs that use the HTML5 `form=` attribute. Since
      // the input might not even be in a form, let's just use the global
      // `querySelectorAll` to ensure we don't miss anything.
      var group = queryRoot.querySelectorAll(
        'input[name=' + JSON.stringify('' + name) + '][type="radio"]');

      for (var i = 0, groupLen = group.length; i < groupLen; i++) {
        var otherNode = group[i];
        if (otherNode === rootNode ||
            otherNode.form !== rootNode.form) {
          continue;
        }
        var otherID = ReactMount.getID(otherNode);
        ("production" !== "development" ? invariant(
          otherID,
          'ReactDOMInput: Mixing React and non-React radio inputs with the ' +
          'same `name` is not supported.'
        ) : invariant(otherID));
        var otherInstance = instancesByReactID[otherID];
        ("production" !== "development" ? invariant(
          otherInstance,
          'ReactDOMInput: Unknown radio button ID %s.',
          otherID
        ) : invariant(otherInstance));
        // If this is a controlled radio button group, forcing the input that
        // was previously checked to update will cause it to be come re-checked
        // as appropriate.
        ReactUpdates.asap(forceUpdateIfMounted, otherInstance);
      }
    }

    return returnValue;
  }

});

module.exports = ReactDOMInput;

},{"11":11,"135":135,"2":2,"24":24,"27":27,"29":29,"33":33,"57":57,"70":70,"87":87}],48:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMOption
 */

'use strict';

var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);

var warning = _dereq_(154);

var option = ReactElement.createFactory('option');

/**
 * Implements an <option> native component that warns when `selected` is set.
 */
var ReactDOMOption = ReactClass.createClass({
  displayName: 'ReactDOMOption',
  tagName: 'OPTION',

  mixins: [ReactBrowserComponentMixin],

  componentWillMount: function() {
    // TODO (yungsters): Remove support for `selected` in <option>.
    if ("production" !== "development") {
      ("production" !== "development" ? warning(
        this.props.selected == null,
        'Use the `defaultValue` or `value` props on <select> instead of ' +
        'setting `selected` on <option>.'
      ) : null);
    }
  },

  render: function() {
    return option(this.props, this.props.children);
  }

});

module.exports = ReactDOMOption;

},{"154":154,"29":29,"33":33,"57":57}],49:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMSelect
 */

'use strict';

var AutoFocusMixin = _dereq_(2);
var LinkedValueUtils = _dereq_(24);
var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);
var ReactUpdates = _dereq_(87);

var assign = _dereq_(27);

var select = ReactElement.createFactory('select');

function updateOptionsIfPendingUpdateAndMounted() {
  /*jshint validthis:true */
  if (this._pendingUpdate) {
    this._pendingUpdate = false;
    var value = LinkedValueUtils.getValue(this);
    if (value != null && this.isMounted()) {
      updateOptions(this, value);
    }
  }
}

/**
 * Validation function for `value` and `defaultValue`.
 * @private
 */
function selectValueType(props, propName, componentName) {
  if (props[propName] == null) {
    return null;
  }
  if (props.multiple) {
    if (!Array.isArray(props[propName])) {
      return new Error(
        ("The `" + propName + "` prop supplied to <select> must be an array if ") +
        ("`multiple` is true.")
      );
    }
  } else {
    if (Array.isArray(props[propName])) {
      return new Error(
        ("The `" + propName + "` prop supplied to <select> must be a scalar ") +
        ("value if `multiple` is false.")
      );
    }
  }
}

/**
 * @param {ReactComponent} component Instance of ReactDOMSelect
 * @param {*} propValue A stringable (with `multiple`, a list of stringables).
 * @private
 */
function updateOptions(component, propValue) {
  var selectedValue, i, l;
  var options = component.getDOMNode().options;

  if (component.props.multiple) {
    selectedValue = {};
    for (i = 0, l = propValue.length; i < l; i++) {
      selectedValue['' + propValue[i]] = true;
    }
    for (i = 0, l = options.length; i < l; i++) {
      var selected = selectedValue.hasOwnProperty(options[i].value);
      if (options[i].selected !== selected) {
        options[i].selected = selected;
      }
    }
  } else {
    // Do not set `select.value` as exact behavior isn't consistent across all
    // browsers for all cases.
    selectedValue = '' + propValue;
    for (i = 0, l = options.length; i < l; i++) {
      if (options[i].value === selectedValue) {
        options[i].selected = true;
        return;
      }
    }
    if (options.length) {
      options[0].selected = true;
    }
  }
}

/**
 * Implements a <select> native component that allows optionally setting the
 * props `value` and `defaultValue`. If `multiple` is false, the prop must be a
 * stringable. If `multiple` is true, the prop must be an array of stringables.
 *
 * If `value` is not supplied (or null/undefined), user actions that change the
 * selected option will trigger updates to the rendered options.
 *
 * If it is supplied (and not null/undefined), the rendered options will not
 * update in response to user actions. Instead, the `value` prop must change in
 * order for the rendered options to update.
 *
 * If `defaultValue` is provided, any options with the supplied values will be
 * selected.
 */
var ReactDOMSelect = ReactClass.createClass({
  displayName: 'ReactDOMSelect',
  tagName: 'SELECT',

  mixins: [AutoFocusMixin, LinkedValueUtils.Mixin, ReactBrowserComponentMixin],

  propTypes: {
    defaultValue: selectValueType,
    value: selectValueType
  },

  render: function() {
    // Clone `this.props` so we don't mutate the input.
    var props = assign({}, this.props);

    props.onChange = this._handleChange;
    props.value = null;

    return select(props, this.props.children);
  },

  componentWillMount: function() {
    this._pendingUpdate = false;
  },

  componentDidMount: function() {
    var value = LinkedValueUtils.getValue(this);
    if (value != null) {
      updateOptions(this, value);
    } else if (this.props.defaultValue != null) {
      updateOptions(this, this.props.defaultValue);
    }
  },

  componentDidUpdate: function(prevProps) {
    var value = LinkedValueUtils.getValue(this);
    if (value != null) {
      this._pendingUpdate = false;
      updateOptions(this, value);
    } else if (!prevProps.multiple !== !this.props.multiple) {
      // For simplicity, reapply `defaultValue` if `multiple` is toggled.
      if (this.props.defaultValue != null) {
        updateOptions(this, this.props.defaultValue);
      } else {
        // Revert the select back to its default unselected state.
        updateOptions(this, this.props.multiple ? [] : '');
      }
    }
  },

  _handleChange: function(event) {
    var returnValue;
    var onChange = LinkedValueUtils.getOnChange(this);
    if (onChange) {
      returnValue = onChange.call(this, event);
    }

    this._pendingUpdate = true;
    ReactUpdates.asap(updateOptionsIfPendingUpdateAndMounted, this);
    return returnValue;
  }

});

module.exports = ReactDOMSelect;

},{"2":2,"24":24,"27":27,"29":29,"33":33,"57":57,"87":87}],50:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMSelection
 */

'use strict';

var ExecutionEnvironment = _dereq_(21);

var getNodeForCharacterOffset = _dereq_(128);
var getTextContentAccessor = _dereq_(130);

/**
 * While `isCollapsed` is available on the Selection object and `collapsed`
 * is available on the Range object, IE11 sometimes gets them wrong.
 * If the anchor/focus nodes and offsets are the same, the range is collapsed.
 */
function isCollapsed(anchorNode, anchorOffset, focusNode, focusOffset) {
  return anchorNode === focusNode && anchorOffset === focusOffset;
}

/**
 * Get the appropriate anchor and focus node/offset pairs for IE.
 *
 * The catch here is that IE's selection API doesn't provide information
 * about whether the selection is forward or backward, so we have to
 * behave as though it's always forward.
 *
 * IE text differs from modern selection in that it behaves as though
 * block elements end with a new line. This means character offsets will
 * differ between the two APIs.
 *
 * @param {DOMElement} node
 * @return {object}
 */
function getIEOffsets(node) {
  var selection = document.selection;
  var selectedRange = selection.createRange();
  var selectedLength = selectedRange.text.length;

  // Duplicate selection so we can move range without breaking user selection.
  var fromStart = selectedRange.duplicate();
  fromStart.moveToElementText(node);
  fromStart.setEndPoint('EndToStart', selectedRange);

  var startOffset = fromStart.text.length;
  var endOffset = startOffset + selectedLength;

  return {
    start: startOffset,
    end: endOffset
  };
}

/**
 * @param {DOMElement} node
 * @return {?object}
 */
function getModernOffsets(node) {
  var selection = window.getSelection && window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  var anchorNode = selection.anchorNode;
  var anchorOffset = selection.anchorOffset;
  var focusNode = selection.focusNode;
  var focusOffset = selection.focusOffset;

  var currentRange = selection.getRangeAt(0);

  // If the node and offset values are the same, the selection is collapsed.
  // `Selection.isCollapsed` is available natively, but IE sometimes gets
  // this value wrong.
  var isSelectionCollapsed = isCollapsed(
    selection.anchorNode,
    selection.anchorOffset,
    selection.focusNode,
    selection.focusOffset
  );

  var rangeLength = isSelectionCollapsed ? 0 : currentRange.toString().length;

  var tempRange = currentRange.cloneRange();
  tempRange.selectNodeContents(node);
  tempRange.setEnd(currentRange.startContainer, currentRange.startOffset);

  var isTempRangeCollapsed = isCollapsed(
    tempRange.startContainer,
    tempRange.startOffset,
    tempRange.endContainer,
    tempRange.endOffset
  );

  var start = isTempRangeCollapsed ? 0 : tempRange.toString().length;
  var end = start + rangeLength;

  // Detect whether the selection is backward.
  var detectionRange = document.createRange();
  detectionRange.setStart(anchorNode, anchorOffset);
  detectionRange.setEnd(focusNode, focusOffset);
  var isBackward = detectionRange.collapsed;

  return {
    start: isBackward ? end : start,
    end: isBackward ? start : end
  };
}

/**
 * @param {DOMElement|DOMTextNode} node
 * @param {object} offsets
 */
function setIEOffsets(node, offsets) {
  var range = document.selection.createRange().duplicate();
  var start, end;

  if (typeof offsets.end === 'undefined') {
    start = offsets.start;
    end = start;
  } else if (offsets.start > offsets.end) {
    start = offsets.end;
    end = offsets.start;
  } else {
    start = offsets.start;
    end = offsets.end;
  }

  range.moveToElementText(node);
  range.moveStart('character', start);
  range.setEndPoint('EndToStart', range);
  range.moveEnd('character', end - start);
  range.select();
}

/**
 * In modern non-IE browsers, we can support both forward and backward
 * selections.
 *
 * Note: IE10+ supports the Selection object, but it does not support
 * the `extend` method, which means that even in modern IE, it's not possible
 * to programatically create a backward selection. Thus, for all IE
 * versions, we use the old IE API to create our selections.
 *
 * @param {DOMElement|DOMTextNode} node
 * @param {object} offsets
 */
function setModernOffsets(node, offsets) {
  if (!window.getSelection) {
    return;
  }

  var selection = window.getSelection();
  var length = node[getTextContentAccessor()].length;
  var start = Math.min(offsets.start, length);
  var end = typeof offsets.end === 'undefined' ?
            start : Math.min(offsets.end, length);

  // IE 11 uses modern selection, but doesn't support the extend method.
  // Flip backward selections, so we can set with a single range.
  if (!selection.extend && start > end) {
    var temp = end;
    end = start;
    start = temp;
  }

  var startMarker = getNodeForCharacterOffset(node, start);
  var endMarker = getNodeForCharacterOffset(node, end);

  if (startMarker && endMarker) {
    var range = document.createRange();
    range.setStart(startMarker.node, startMarker.offset);
    selection.removeAllRanges();

    if (start > end) {
      selection.addRange(range);
      selection.extend(endMarker.node, endMarker.offset);
    } else {
      range.setEnd(endMarker.node, endMarker.offset);
      selection.addRange(range);
    }
  }
}

var useIEOffsets = (
  ExecutionEnvironment.canUseDOM &&
  'selection' in document &&
  !('getSelection' in window)
);

var ReactDOMSelection = {
  /**
   * @param {DOMElement} node
   */
  getOffsets: useIEOffsets ? getIEOffsets : getModernOffsets,

  /**
   * @param {DOMElement|DOMTextNode} node
   * @param {object} offsets
   */
  setOffsets: useIEOffsets ? setIEOffsets : setModernOffsets
};

module.exports = ReactDOMSelection;

},{"128":128,"130":130,"21":21}],51:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMTextComponent
 * @typechecks static-only
 */

'use strict';

var DOMPropertyOperations = _dereq_(11);
var ReactComponentBrowserEnvironment =
  _dereq_(35);
var ReactDOMComponent = _dereq_(42);

var assign = _dereq_(27);
var escapeTextContentForBrowser = _dereq_(116);

/**
 * Text nodes violate a couple assumptions that React makes about components:
 *
 *  - When mounting text into the DOM, adjacent text nodes are merged.
 *  - Text nodes cannot be assigned a React root ID.
 *
 * This component is used to wrap strings in elements so that they can undergo
 * the same reconciliation that is applied to elements.
 *
 * TODO: Investigate representing React components in the DOM with text nodes.
 *
 * @class ReactDOMTextComponent
 * @extends ReactComponent
 * @internal
 */
var ReactDOMTextComponent = function(props) {
  // This constructor and its argument is currently used by mocks.
};

assign(ReactDOMTextComponent.prototype, {

  /**
   * @param {ReactText} text
   * @internal
   */
  construct: function(text) {
    // TODO: This is really a ReactText (ReactNode), not a ReactElement
    this._currentElement = text;
    this._stringText = '' + text;

    // Properties
    this._rootNodeID = null;
    this._mountIndex = 0;
  },

  /**
   * Creates the markup for this text node. This node is not intended to have
   * any features besides containing text content.
   *
   * @param {string} rootID DOM ID of the root node.
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @return {string} Markup for this text node.
   * @internal
   */
  mountComponent: function(rootID, transaction, context) {
    this._rootNodeID = rootID;
    var escapedText = escapeTextContentForBrowser(this._stringText);

    if (transaction.renderToStaticMarkup) {
      // Normally we'd wrap this in a `span` for the reasons stated above, but
      // since this is a situation where React won't take over (static pages),
      // we can simply return the text as it is.
      return escapedText;
    }

    return (
      '<span ' + DOMPropertyOperations.createMarkupForID(rootID) + '>' +
        escapedText +
      '</span>'
    );
  },

  /**
   * Updates this component by updating the text content.
   *
   * @param {ReactText} nextText The next text content
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  receiveComponent: function(nextText, transaction) {
    if (nextText !== this._currentElement) {
      this._currentElement = nextText;
      var nextStringText = '' + nextText;
      if (nextStringText !== this._stringText) {
        // TODO: Save this as pending props and use performUpdateIfNecessary
        // and/or updateComponent to do the actual update for consistency with
        // other component types?
        this._stringText = nextStringText;
        ReactDOMComponent.BackendIDOperations.updateTextContentByID(
          this._rootNodeID,
          nextStringText
        );
      }
    }
  },

  unmountComponent: function() {
    ReactComponentBrowserEnvironment.unmountIDFromEnvironment(this._rootNodeID);
  }

});

module.exports = ReactDOMTextComponent;

},{"11":11,"116":116,"27":27,"35":35,"42":42}],52:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMTextarea
 */

'use strict';

var AutoFocusMixin = _dereq_(2);
var DOMPropertyOperations = _dereq_(11);
var LinkedValueUtils = _dereq_(24);
var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);
var ReactUpdates = _dereq_(87);

var assign = _dereq_(27);
var invariant = _dereq_(135);

var warning = _dereq_(154);

var textarea = ReactElement.createFactory('textarea');

function forceUpdateIfMounted() {
  /*jshint validthis:true */
  if (this.isMounted()) {
    this.forceUpdate();
  }
}

/**
 * Implements a <textarea> native component that allows setting `value`, and
 * `defaultValue`. This differs from the traditional DOM API because value is
 * usually set as PCDATA children.
 *
 * If `value` is not supplied (or null/undefined), user actions that affect the
 * value will trigger updates to the element.
 *
 * If `value` is supplied (and not null/undefined), the rendered element will
 * not trigger updates to the element. Instead, the `value` prop must change in
 * order for the rendered element to be updated.
 *
 * The rendered element will be initialized with an empty value, the prop
 * `defaultValue` if specified, or the children content (deprecated).
 */
var ReactDOMTextarea = ReactClass.createClass({
  displayName: 'ReactDOMTextarea',
  tagName: 'TEXTAREA',

  mixins: [AutoFocusMixin, LinkedValueUtils.Mixin, ReactBrowserComponentMixin],

  getInitialState: function() {
    var defaultValue = this.props.defaultValue;
    // TODO (yungsters): Remove support for children content in <textarea>.
    var children = this.props.children;
    if (children != null) {
      if ("production" !== "development") {
        ("production" !== "development" ? warning(
          false,
          'Use the `defaultValue` or `value` props instead of setting ' +
          'children on <textarea>.'
        ) : null);
      }
      ("production" !== "development" ? invariant(
        defaultValue == null,
        'If you supply `defaultValue` on a <textarea>, do not pass children.'
      ) : invariant(defaultValue == null));
      if (Array.isArray(children)) {
        ("production" !== "development" ? invariant(
          children.length <= 1,
          '<textarea> can only have at most one child.'
        ) : invariant(children.length <= 1));
        children = children[0];
      }

      defaultValue = '' + children;
    }
    if (defaultValue == null) {
      defaultValue = '';
    }
    var value = LinkedValueUtils.getValue(this);
    return {
      // We save the initial value so that `ReactDOMComponent` doesn't update
      // `textContent` (unnecessary since we update value).
      // The initial value can be a boolean or object so that's why it's
      // forced to be a string.
      initialValue: '' + (value != null ? value : defaultValue)
    };
  },

  render: function() {
    // Clone `this.props` so we don't mutate the input.
    var props = assign({}, this.props);

    ("production" !== "development" ? invariant(
      props.dangerouslySetInnerHTML == null,
      '`dangerouslySetInnerHTML` does not make sense on <textarea>.'
    ) : invariant(props.dangerouslySetInnerHTML == null));

    props.defaultValue = null;
    props.value = null;
    props.onChange = this._handleChange;

    // Always set children to the same thing. In IE9, the selection range will
    // get reset if `textContent` is mutated.
    return textarea(props, this.state.initialValue);
  },

  componentDidUpdate: function(prevProps, prevState, prevContext) {
    var value = LinkedValueUtils.getValue(this);
    if (value != null) {
      var rootNode = this.getDOMNode();
      // Cast `value` to a string to ensure the value is set correctly. While
      // browsers typically do this as necessary, jsdom doesn't.
      DOMPropertyOperations.setValueForProperty(rootNode, 'value', '' + value);
    }
  },

  _handleChange: function(event) {
    var returnValue;
    var onChange = LinkedValueUtils.getOnChange(this);
    if (onChange) {
      returnValue = onChange.call(this, event);
    }
    ReactUpdates.asap(forceUpdateIfMounted, this);
    return returnValue;
  }

});

module.exports = ReactDOMTextarea;

},{"11":11,"135":135,"154":154,"2":2,"24":24,"27":27,"29":29,"33":33,"57":57,"87":87}],53:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultBatchingStrategy
 */

'use strict';

var ReactUpdates = _dereq_(87);
var Transaction = _dereq_(103);

var assign = _dereq_(27);
var emptyFunction = _dereq_(114);

var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function() {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;
  }
};

var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
};

var TRANSACTION_WRAPPERS = [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];

function ReactDefaultBatchingStrategyTransaction() {
  this.reinitializeTransaction();
}

assign(
  ReactDefaultBatchingStrategyTransaction.prototype,
  Transaction.Mixin,
  {
    getTransactionWrappers: function() {
      return TRANSACTION_WRAPPERS;
    }
  }
);

var transaction = new ReactDefaultBatchingStrategyTransaction();

var ReactDefaultBatchingStrategy = {
  isBatchingUpdates: false,

  /**
   * Call the provided function in a context within which calls to `setState`
   * and friends are batched such that components aren't updated unnecessarily.
   */
  batchedUpdates: function(callback, a, b, c, d) {
    var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;

    ReactDefaultBatchingStrategy.isBatchingUpdates = true;

    // The code is written this way to avoid extra allocations
    if (alreadyBatchingUpdates) {
      callback(a, b, c, d);
    } else {
      transaction.perform(callback, null, a, b, c, d);
    }
  }
};

module.exports = ReactDefaultBatchingStrategy;

},{"103":103,"114":114,"27":27,"87":87}],54:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultInjection
 */

'use strict';

var BeforeInputEventPlugin = _dereq_(3);
var ChangeEventPlugin = _dereq_(7);
var ClientReactRootIndex = _dereq_(8);
var DefaultEventPluginOrder = _dereq_(13);
var EnterLeaveEventPlugin = _dereq_(14);
var ExecutionEnvironment = _dereq_(21);
var HTMLDOMPropertyConfig = _dereq_(23);
var MobileSafariClickEventPlugin = _dereq_(26);
var ReactBrowserComponentMixin = _dereq_(29);
var ReactClass = _dereq_(33);
var ReactComponentBrowserEnvironment =
  _dereq_(35);
var ReactDefaultBatchingStrategy = _dereq_(53);
var ReactDOMComponent = _dereq_(42);
var ReactDOMButton = _dereq_(41);
var ReactDOMForm = _dereq_(43);
var ReactDOMImg = _dereq_(46);
var ReactDOMIDOperations = _dereq_(44);
var ReactDOMIframe = _dereq_(45);
var ReactDOMInput = _dereq_(47);
var ReactDOMOption = _dereq_(48);
var ReactDOMSelect = _dereq_(49);
var ReactDOMTextarea = _dereq_(52);
var ReactDOMTextComponent = _dereq_(51);
var ReactElement = _dereq_(57);
var ReactEventListener = _dereq_(62);
var ReactInjection = _dereq_(64);
var ReactInstanceHandles = _dereq_(66);
var ReactMount = _dereq_(70);
var ReactReconcileTransaction = _dereq_(80);
var SelectEventPlugin = _dereq_(89);
var ServerReactRootIndex = _dereq_(90);
var SimpleEventPlugin = _dereq_(91);
var SVGDOMPropertyConfig = _dereq_(88);

var createFullPageComponent = _dereq_(111);

function autoGenerateWrapperClass(type) {
  return ReactClass.createClass({
    tagName: type.toUpperCase(),
    render: function() {
      return new ReactElement(
        type,
        null,
        null,
        null,
        null,
        this.props
      );
    }
  });
}

function inject() {
  ReactInjection.EventEmitter.injectReactEventListener(
    ReactEventListener
  );

  /**
   * Inject modules for resolving DOM hierarchy and plugin ordering.
   */
  ReactInjection.EventPluginHub.injectEventPluginOrder(DefaultEventPluginOrder);
  ReactInjection.EventPluginHub.injectInstanceHandle(ReactInstanceHandles);
  ReactInjection.EventPluginHub.injectMount(ReactMount);

  /**
   * Some important event plugins included by default (without having to require
   * them).
   */
  ReactInjection.EventPluginHub.injectEventPluginsByName({
    SimpleEventPlugin: SimpleEventPlugin,
    EnterLeaveEventPlugin: EnterLeaveEventPlugin,
    ChangeEventPlugin: ChangeEventPlugin,
    MobileSafariClickEventPlugin: MobileSafariClickEventPlugin,
    SelectEventPlugin: SelectEventPlugin,
    BeforeInputEventPlugin: BeforeInputEventPlugin
  });

  ReactInjection.NativeComponent.injectGenericComponentClass(
    ReactDOMComponent
  );

  ReactInjection.NativeComponent.injectTextComponentClass(
    ReactDOMTextComponent
  );

  ReactInjection.NativeComponent.injectAutoWrapper(
    autoGenerateWrapperClass
  );

  // This needs to happen before createFullPageComponent() otherwise the mixin
  // won't be included.
  ReactInjection.Class.injectMixin(ReactBrowserComponentMixin);

  ReactInjection.NativeComponent.injectComponentClasses({
    'button': ReactDOMButton,
    'form': ReactDOMForm,
    'iframe': ReactDOMIframe,
    'img': ReactDOMImg,
    'input': ReactDOMInput,
    'option': ReactDOMOption,
    'select': ReactDOMSelect,
    'textarea': ReactDOMTextarea,

    'html': createFullPageComponent('html'),
    'head': createFullPageComponent('head'),
    'body': createFullPageComponent('body')
  });

  ReactInjection.DOMProperty.injectDOMPropertyConfig(HTMLDOMPropertyConfig);
  ReactInjection.DOMProperty.injectDOMPropertyConfig(SVGDOMPropertyConfig);

  ReactInjection.EmptyComponent.injectEmptyComponent('noscript');

  ReactInjection.Updates.injectReconcileTransaction(
    ReactReconcileTransaction
  );
  ReactInjection.Updates.injectBatchingStrategy(
    ReactDefaultBatchingStrategy
  );

  ReactInjection.RootIndex.injectCreateReactRootIndex(
    ExecutionEnvironment.canUseDOM ?
      ClientReactRootIndex.createReactRootIndex :
      ServerReactRootIndex.createReactRootIndex
  );

  ReactInjection.Component.injectEnvironment(ReactComponentBrowserEnvironment);
  ReactInjection.DOMComponent.injectIDOperations(ReactDOMIDOperations);

  if ("production" !== "development") {
    var url = (ExecutionEnvironment.canUseDOM && window.location.href) || '';
    if ((/[?&]react_perf\b/).test(url)) {
      var ReactDefaultPerf = _dereq_(55);
      ReactDefaultPerf.start();
    }
  }
}

module.exports = {
  inject: inject
};

},{"111":111,"13":13,"14":14,"21":21,"23":23,"26":26,"29":29,"3":3,"33":33,"35":35,"41":41,"42":42,"43":43,"44":44,"45":45,"46":46,"47":47,"48":48,"49":49,"51":51,"52":52,"53":53,"55":55,"57":57,"62":62,"64":64,"66":66,"7":7,"70":70,"8":8,"80":80,"88":88,"89":89,"90":90,"91":91}],55:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultPerf
 * @typechecks static-only
 */

'use strict';

var DOMProperty = _dereq_(10);
var ReactDefaultPerfAnalysis = _dereq_(56);
var ReactMount = _dereq_(70);
var ReactPerf = _dereq_(75);

var performanceNow = _dereq_(146);

function roundFloat(val) {
  return Math.floor(val * 100) / 100;
}

function addValue(obj, key, val) {
  obj[key] = (obj[key] || 0) + val;
}

var ReactDefaultPerf = {
  _allMeasurements: [], // last item in the list is the current one
  _mountStack: [0],
  _injected: false,

  start: function() {
    if (!ReactDefaultPerf._injected) {
      ReactPerf.injection.injectMeasure(ReactDefaultPerf.measure);
    }

    ReactDefaultPerf._allMeasurements.length = 0;
    ReactPerf.enableMeasure = true;
  },

  stop: function() {
    ReactPerf.enableMeasure = false;
  },

  getLastMeasurements: function() {
    return ReactDefaultPerf._allMeasurements;
  },

  printExclusive: function(measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getExclusiveSummary(measurements);
    console.table(summary.map(function(item) {
      return {
        'Component class name': item.componentName,
        'Total inclusive time (ms)': roundFloat(item.inclusive),
        'Exclusive mount time (ms)': roundFloat(item.exclusive),
        'Exclusive render time (ms)': roundFloat(item.render),
        'Mount time per instance (ms)': roundFloat(item.exclusive / item.count),
        'Render time per instance (ms)': roundFloat(item.render / item.count),
        'Instances': item.count
      };
    }));
    // TODO: ReactDefaultPerfAnalysis.getTotalTime() does not return the correct
    // number.
  },

  printInclusive: function(measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getInclusiveSummary(measurements);
    console.table(summary.map(function(item) {
      return {
        'Owner > component': item.componentName,
        'Inclusive time (ms)': roundFloat(item.time),
        'Instances': item.count
      };
    }));
    console.log(
      'Total time:',
      ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms'
    );
  },

  getMeasurementsSummaryMap: function(measurements) {
    var summary = ReactDefaultPerfAnalysis.getInclusiveSummary(
      measurements,
      true
    );
    return summary.map(function(item) {
      return {
        'Owner > component': item.componentName,
        'Wasted time (ms)': item.time,
        'Instances': item.count
      };
    });
  },

  printWasted: function(measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    console.table(ReactDefaultPerf.getMeasurementsSummaryMap(measurements));
    console.log(
      'Total time:',
      ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms'
    );
  },

  printDOM: function(measurements) {
    measurements = measurements || ReactDefaultPerf._allMeasurements;
    var summary = ReactDefaultPerfAnalysis.getDOMSummary(measurements);
    console.table(summary.map(function(item) {
      var result = {};
      result[DOMProperty.ID_ATTRIBUTE_NAME] = item.id;
      result['type'] = item.type;
      result['args'] = JSON.stringify(item.args);
      return result;
    }));
    console.log(
      'Total time:',
      ReactDefaultPerfAnalysis.getTotalTime(measurements).toFixed(2) + ' ms'
    );
  },

  _recordWrite: function(id, fnName, totalTime, args) {
    // TODO: totalTime isn't that useful since it doesn't count paints/reflows
    var writes =
      ReactDefaultPerf
        ._allMeasurements[ReactDefaultPerf._allMeasurements.length - 1]
        .writes;
    writes[id] = writes[id] || [];
    writes[id].push({
      type: fnName,
      time: totalTime,
      args: args
    });
  },

  measure: function(moduleName, fnName, func) {
    return function() {for (var args=[],$__0=0,$__1=arguments.length;$__0<$__1;$__0++) args.push(arguments[$__0]);
      var totalTime;
      var rv;
      var start;

      if (fnName === '_renderNewRootComponent' ||
          fnName === 'flushBatchedUpdates') {
        // A "measurement" is a set of metrics recorded for each flush. We want
        // to group the metrics for a given flush together so we can look at the
        // components that rendered and the DOM operations that actually
        // happened to determine the amount of "wasted work" performed.
        ReactDefaultPerf._allMeasurements.push({
          exclusive: {},
          inclusive: {},
          render: {},
          counts: {},
          writes: {},
          displayNames: {},
          totalTime: 0
        });
        start = performanceNow();
        rv = func.apply(this, args);
        ReactDefaultPerf._allMeasurements[
          ReactDefaultPerf._allMeasurements.length - 1
        ].totalTime = performanceNow() - start;
        return rv;
      } else if (fnName === '_mountImageIntoNode' ||
          moduleName === 'ReactDOMIDOperations') {
        start = performanceNow();
        rv = func.apply(this, args);
        totalTime = performanceNow() - start;

        if (fnName === '_mountImageIntoNode') {
          var mountID = ReactMount.getID(args[1]);
          ReactDefaultPerf._recordWrite(mountID, fnName, totalTime, args[0]);
        } else if (fnName === 'dangerouslyProcessChildrenUpdates') {
          // special format
          args[0].forEach(function(update) {
            var writeArgs = {};
            if (update.fromIndex !== null) {
              writeArgs.fromIndex = update.fromIndex;
            }
            if (update.toIndex !== null) {
              writeArgs.toIndex = update.toIndex;
            }
            if (update.textContent !== null) {
              writeArgs.textContent = update.textContent;
            }
            if (update.markupIndex !== null) {
              writeArgs.markup = args[1][update.markupIndex];
            }
            ReactDefaultPerf._recordWrite(
              update.parentID,
              update.type,
              totalTime,
              writeArgs
            );
          });
        } else {
          // basic format
          ReactDefaultPerf._recordWrite(
            args[0],
            fnName,
            totalTime,
            Array.prototype.slice.call(args, 1)
          );
        }
        return rv;
      } else if (moduleName === 'ReactCompositeComponent' && (
        (// TODO: receiveComponent()?
        (fnName === 'mountComponent' ||
        fnName === 'updateComponent' || fnName === '_renderValidatedComponent')))) {

        if (typeof this._currentElement.type === 'string') {
          return func.apply(this, args);
        }

        var rootNodeID = fnName === 'mountComponent' ?
          args[0] :
          this._rootNodeID;
        var isRender = fnName === '_renderValidatedComponent';
        var isMount = fnName === 'mountComponent';

        var mountStack = ReactDefaultPerf._mountStack;
        var entry = ReactDefaultPerf._allMeasurements[
          ReactDefaultPerf._allMeasurements.length - 1
        ];

        if (isRender) {
          addValue(entry.counts, rootNodeID, 1);
        } else if (isMount) {
          mountStack.push(0);
        }

        start = performanceNow();
        rv = func.apply(this, args);
        totalTime = performanceNow() - start;

        if (isRender) {
          addValue(entry.render, rootNodeID, totalTime);
        } else if (isMount) {
          var subMountTime = mountStack.pop();
          mountStack[mountStack.length - 1] += totalTime;
          addValue(entry.exclusive, rootNodeID, totalTime - subMountTime);
          addValue(entry.inclusive, rootNodeID, totalTime);
        } else {
          addValue(entry.inclusive, rootNodeID, totalTime);
        }

        entry.displayNames[rootNodeID] = {
          current: this.getName(),
          owner: this._currentElement._owner ?
            this._currentElement._owner.getName() :
            '<root>'
        };

        return rv;
      } else {
        return func.apply(this, args);
      }
    };
  }
};

module.exports = ReactDefaultPerf;

},{"10":10,"146":146,"56":56,"70":70,"75":75}],56:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDefaultPerfAnalysis
 */

var assign = _dereq_(27);

// Don't try to save users less than 1.2ms (a number I made up)
var DONT_CARE_THRESHOLD = 1.2;
var DOM_OPERATION_TYPES = {
  '_mountImageIntoNode': 'set innerHTML',
  INSERT_MARKUP: 'set innerHTML',
  MOVE_EXISTING: 'move',
  REMOVE_NODE: 'remove',
  TEXT_CONTENT: 'set textContent',
  'updatePropertyByID': 'update attribute',
  'deletePropertyByID': 'delete attribute',
  'updateStylesByID': 'update styles',
  'updateInnerHTMLByID': 'set innerHTML',
  'dangerouslyReplaceNodeWithMarkupByID': 'replace'
};

function getTotalTime(measurements) {
  // TODO: return number of DOM ops? could be misleading.
  // TODO: measure dropped frames after reconcile?
  // TODO: log total time of each reconcile and the top-level component
  // class that triggered it.
  var totalTime = 0;
  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    totalTime += measurement.totalTime;
  }
  return totalTime;
}

function getDOMSummary(measurements) {
  var items = [];
  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    var id;

    for (id in measurement.writes) {
      measurement.writes[id].forEach(function(write) {
        items.push({
          id: id,
          type: DOM_OPERATION_TYPES[write.type] || write.type,
          args: write.args
        });
      });
    }
  }
  return items;
}

function getExclusiveSummary(measurements) {
  var candidates = {};
  var displayName;

  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    var allIDs = assign(
      {},
      measurement.exclusive,
      measurement.inclusive
    );

    for (var id in allIDs) {
      displayName = measurement.displayNames[id].current;

      candidates[displayName] = candidates[displayName] || {
        componentName: displayName,
        inclusive: 0,
        exclusive: 0,
        render: 0,
        count: 0
      };
      if (measurement.render[id]) {
        candidates[displayName].render += measurement.render[id];
      }
      if (measurement.exclusive[id]) {
        candidates[displayName].exclusive += measurement.exclusive[id];
      }
      if (measurement.inclusive[id]) {
        candidates[displayName].inclusive += measurement.inclusive[id];
      }
      if (measurement.counts[id]) {
        candidates[displayName].count += measurement.counts[id];
      }
    }
  }

  // Now make a sorted array with the results.
  var arr = [];
  for (displayName in candidates) {
    if (candidates[displayName].exclusive >= DONT_CARE_THRESHOLD) {
      arr.push(candidates[displayName]);
    }
  }

  arr.sort(function(a, b) {
    return b.exclusive - a.exclusive;
  });

  return arr;
}

function getInclusiveSummary(measurements, onlyClean) {
  var candidates = {};
  var inclusiveKey;

  for (var i = 0; i < measurements.length; i++) {
    var measurement = measurements[i];
    var allIDs = assign(
      {},
      measurement.exclusive,
      measurement.inclusive
    );
    var cleanComponents;

    if (onlyClean) {
      cleanComponents = getUnchangedComponents(measurement);
    }

    for (var id in allIDs) {
      if (onlyClean && !cleanComponents[id]) {
        continue;
      }

      var displayName = measurement.displayNames[id];

      // Inclusive time is not useful for many components without knowing where
      // they are instantiated. So we aggregate inclusive time with both the
      // owner and current displayName as the key.
      inclusiveKey = displayName.owner + ' > ' + displayName.current;

      candidates[inclusiveKey] = candidates[inclusiveKey] || {
        componentName: inclusiveKey,
        time: 0,
        count: 0
      };

      if (measurement.inclusive[id]) {
        candidates[inclusiveKey].time += measurement.inclusive[id];
      }
      if (measurement.counts[id]) {
        candidates[inclusiveKey].count += measurement.counts[id];
      }
    }
  }

  // Now make a sorted array with the results.
  var arr = [];
  for (inclusiveKey in candidates) {
    if (candidates[inclusiveKey].time >= DONT_CARE_THRESHOLD) {
      arr.push(candidates[inclusiveKey]);
    }
  }

  arr.sort(function(a, b) {
    return b.time - a.time;
  });

  return arr;
}

function getUnchangedComponents(measurement) {
  // For a given reconcile, look at which components did not actually
  // render anything to the DOM and return a mapping of their ID to
  // the amount of time it took to render the entire subtree.
  var cleanComponents = {};
  var dirtyLeafIDs = Object.keys(measurement.writes);
  var allIDs = assign({}, measurement.exclusive, measurement.inclusive);

  for (var id in allIDs) {
    var isDirty = false;
    // For each component that rendered, see if a component that triggered
    // a DOM op is in its subtree.
    for (var i = 0; i < dirtyLeafIDs.length; i++) {
      if (dirtyLeafIDs[i].indexOf(id) === 0) {
        isDirty = true;
        break;
      }
    }
    if (!isDirty && measurement.counts[id] > 0) {
      cleanComponents[id] = true;
    }
  }
  return cleanComponents;
}

var ReactDefaultPerfAnalysis = {
  getExclusiveSummary: getExclusiveSummary,
  getInclusiveSummary: getInclusiveSummary,
  getDOMSummary: getDOMSummary,
  getTotalTime: getTotalTime
};

module.exports = ReactDefaultPerfAnalysis;

},{"27":27}],57:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactElement
 */

'use strict';

var ReactContext = _dereq_(38);
var ReactCurrentOwner = _dereq_(39);

var assign = _dereq_(27);
var warning = _dereq_(154);

var RESERVED_PROPS = {
  key: true,
  ref: true
};

/**
 * Warn for mutations.
 *
 * @internal
 * @param {object} object
 * @param {string} key
 */
function defineWarningProperty(object, key) {
  Object.defineProperty(object, key, {

    configurable: false,
    enumerable: true,

    get: function() {
      if (!this._store) {
        return null;
      }
      return this._store[key];
    },

    set: function(value) {
      ("production" !== "development" ? warning(
        false,
        'Don\'t set the %s property of the React element. Instead, ' +
        'specify the correct value when initially creating the element.',
        key
      ) : null);
      this._store[key] = value;
    }

  });
}

/**
 * This is updated to true if the membrane is successfully created.
 */
var useMutationMembrane = false;

/**
 * Warn for mutations.
 *
 * @internal
 * @param {object} element
 */
function defineMutationMembrane(prototype) {
  try {
    var pseudoFrozenProperties = {
      props: true
    };
    for (var key in pseudoFrozenProperties) {
      defineWarningProperty(prototype, key);
    }
    useMutationMembrane = true;
  } catch (x) {
    // IE will fail on defineProperty
  }
}

/**
 * Base constructor for all React elements. This is only used to make this
 * work with a dynamic instanceof check. Nothing should live on this prototype.
 *
 * @param {*} type
 * @param {string|object} ref
 * @param {*} key
 * @param {*} props
 * @internal
 */
var ReactElement = function(type, key, ref, owner, context, props) {
  // Built-in properties that belong on the element
  this.type = type;
  this.key = key;
  this.ref = ref;

  // Record the component responsible for creating this element.
  this._owner = owner;

  // TODO: Deprecate withContext, and then the context becomes accessible
  // through the owner.
  this._context = context;

  if ("production" !== "development") {
    // The validation flag and props are currently mutative. We put them on
    // an external backing store so that we can freeze the whole object.
    // This can be replaced with a WeakMap once they are implemented in
    // commonly used development environments.
    this._store = {props: props, originalProps: assign({}, props)};

    // To make comparing ReactElements easier for testing purposes, we make
    // the validation flag non-enumerable (where possible, which should
    // include every environment we run tests in), so the test framework
    // ignores it.
    try {
      Object.defineProperty(this._store, 'validated', {
        configurable: false,
        enumerable: false,
        writable: true
      });
    } catch (x) {
    }
    this._store.validated = false;

    // We're not allowed to set props directly on the object so we early
    // return and rely on the prototype membrane to forward to the backing
    // store.
    if (useMutationMembrane) {
      Object.freeze(this);
      return;
    }
  }

  this.props = props;
};

// We intentionally don't expose the function on the constructor property.
// ReactElement should be indistinguishable from a plain object.
ReactElement.prototype = {
  _isReactElement: true
};

if ("production" !== "development") {
  defineMutationMembrane(ReactElement.prototype);
}

ReactElement.createElement = function(type, config, children) {
  var propName;

  // Reserved names are extracted
  var props = {};

  var key = null;
  var ref = null;

  if (config != null) {
    ref = config.ref === undefined ? null : config.ref;
    key = config.key === undefined ? null : '' + config.key;
    // Remaining properties are added to a new props object
    for (propName in config) {
      if (config.hasOwnProperty(propName) &&
          !RESERVED_PROPS.hasOwnProperty(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  // Resolve default props
  if (type && type.defaultProps) {
    var defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (typeof props[propName] === 'undefined') {
        props[propName] = defaultProps[propName];
      }
    }
  }

  return new ReactElement(
    type,
    key,
    ref,
    ReactCurrentOwner.current,
    ReactContext.current,
    props
  );
};

ReactElement.createFactory = function(type) {
  var factory = ReactElement.createElement.bind(null, type);
  // Expose the type on the factory and the prototype so that it can be
  // easily accessed on elements. E.g. <Foo />.type === Foo.type.
  // This should not be named `constructor` since this may not be the function
  // that created the element, and it may not even be a constructor.
  // Legacy hook TODO: Warn if this is accessed
  factory.type = type;
  return factory;
};

ReactElement.cloneAndReplaceProps = function(oldElement, newProps) {
  var newElement = new ReactElement(
    oldElement.type,
    oldElement.key,
    oldElement.ref,
    oldElement._owner,
    oldElement._context,
    newProps
  );

  if ("production" !== "development") {
    // If the key on the original is valid, then the clone is valid
    newElement._store.validated = oldElement._store.validated;
  }
  return newElement;
};

ReactElement.cloneElement = function(element, config, children) {
  var propName;

  // Original props are copied
  var props = assign({}, element.props);

  // Reserved names are extracted
  var key = element.key;
  var ref = element.ref;

  // Owner will be preserved, unless ref is overridden
  var owner = element._owner;

  if (config != null) {
    if (config.ref !== undefined) {
      // Silently steal the ref from the parent.
      ref = config.ref;
      owner = ReactCurrentOwner.current;
    }
    if (config.key !== undefined) {
      key = '' + config.key;
    }
    // Remaining properties override existing props
    for (propName in config) {
      if (config.hasOwnProperty(propName) &&
          !RESERVED_PROPS.hasOwnProperty(propName)) {
        props[propName] = config[propName];
      }
    }
  }

  // Children can be more than one argument, and those are transferred onto
  // the newly allocated props object.
  var childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    var childArray = Array(childrenLength);
    for (var i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  return new ReactElement(
    element.type,
    key,
    ref,
    owner,
    element._context,
    props
  );
};

/**
 * @param {?object} object
 * @return {boolean} True if `object` is a valid component.
 * @final
 */
ReactElement.isValidElement = function(object) {
  // ReactTestUtils is often used outside of beforeEach where as React is
  // within it. This leads to two different instances of React on the same
  // page. To identify a element from a different React instance we use
  // a flag instead of an instanceof check.
  var isElement = !!(object && object._isReactElement);
  // if (isElement && !(object instanceof ReactElement)) {
  // This is an indicator that you're using multiple versions of React at the
  // same time. This will screw with ownership and stuff. Fix it, please.
  // TODO: We could possibly warn here.
  // }
  return isElement;
};

module.exports = ReactElement;

},{"154":154,"27":27,"38":38,"39":39}],58:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactElementValidator
 */

/**
 * ReactElementValidator provides a wrapper around a element factory
 * which validates the props passed to the element. This is intended to be
 * used only in DEV and could be replaced by a static type checker for languages
 * that support it.
 */

'use strict';

var ReactElement = _dereq_(57);
var ReactFragment = _dereq_(63);
var ReactPropTypeLocations = _dereq_(77);
var ReactPropTypeLocationNames = _dereq_(76);
var ReactCurrentOwner = _dereq_(39);
var ReactNativeComponent = _dereq_(73);

var getIteratorFn = _dereq_(126);
var invariant = _dereq_(135);
var warning = _dereq_(154);

function getDeclarationErrorAddendum() {
  if (ReactCurrentOwner.current) {
    var name = ReactCurrentOwner.current.getName();
    if (name) {
      return ' Check the render method of `' + name + '`.';
    }
  }
  return '';
}

/**
 * Warn if there's no key explicitly set on dynamic arrays of children or
 * object keys are not valid. This allows us to keep track of children between
 * updates.
 */
var ownerHasKeyUseWarning = {};

var loggedTypeFailures = {};

var NUMERIC_PROPERTY_REGEX = /^\d+$/;

/**
 * Gets the instance's name for use in warnings.
 *
 * @internal
 * @return {?string} Display name or undefined
 */
function getName(instance) {
  var publicInstance = instance && instance.getPublicInstance();
  if (!publicInstance) {
    return undefined;
  }
  var constructor = publicInstance.constructor;
  if (!constructor) {
    return undefined;
  }
  return constructor.displayName || constructor.name || undefined;
}

/**
 * Gets the current owner's displayName for use in warnings.
 *
 * @internal
 * @return {?string} Display name or undefined
 */
function getCurrentOwnerDisplayName() {
  var current = ReactCurrentOwner.current;
  return (
    current && getName(current) || undefined
  );
}

/**
 * Warn if the element doesn't have an explicit key assigned to it.
 * This element is in an array. The array could grow and shrink or be
 * reordered. All children that haven't already been validated are required to
 * have a "key" property assigned to it.
 *
 * @internal
 * @param {ReactElement} element Element that requires a key.
 * @param {*} parentType element's parent's type.
 */
function validateExplicitKey(element, parentType) {
  if (element._store.validated || element.key != null) {
    return;
  }
  element._store.validated = true;

  warnAndMonitorForKeyUse(
    'Each child in an array or iterator should have a unique "key" prop.',
    element,
    parentType
  );
}

/**
 * Warn if the key is being defined as an object property but has an incorrect
 * value.
 *
 * @internal
 * @param {string} name Property name of the key.
 * @param {ReactElement} element Component that requires a key.
 * @param {*} parentType element's parent's type.
 */
function validatePropertyKey(name, element, parentType) {
  if (!NUMERIC_PROPERTY_REGEX.test(name)) {
    return;
  }
  warnAndMonitorForKeyUse(
    'Child objects should have non-numeric keys so ordering is preserved.',
    element,
    parentType
  );
}

/**
 * Shared warning and monitoring code for the key warnings.
 *
 * @internal
 * @param {string} message The base warning that gets output.
 * @param {ReactElement} element Component that requires a key.
 * @param {*} parentType element's parent's type.
 */
function warnAndMonitorForKeyUse(message, element, parentType) {
  var ownerName = getCurrentOwnerDisplayName();
  var parentName = typeof parentType === 'string' ?
    parentType : parentType.displayName || parentType.name;

  var useName = ownerName || parentName;
  var memoizer = ownerHasKeyUseWarning[message] || (
    (ownerHasKeyUseWarning[message] = {})
  );
  if (memoizer.hasOwnProperty(useName)) {
    return;
  }
  memoizer[useName] = true;

  var parentOrOwnerAddendum =
    ownerName ? (" Check the render method of " + ownerName + ".") :
    parentName ? (" Check the React.render call using <" + parentName + ">.") :
    '';

  // Usually the current owner is the offender, but if it accepts children as a
  // property, it may be the creator of the child that's responsible for
  // assigning it a key.
  var childOwnerAddendum = '';
  if (element &&
      element._owner &&
      element._owner !== ReactCurrentOwner.current) {
    // Name of the component that originally created this child.
    var childOwnerName = getName(element._owner);

    childOwnerAddendum = (" It was passed a child from " + childOwnerName + ".");
  }

  ("production" !== "development" ? warning(
    false,
    message + '%s%s See https://fb.me/react-warning-keys for more information.',
    parentOrOwnerAddendum,
    childOwnerAddendum
  ) : null);
}

/**
 * Ensure that every element either is passed in a static location, in an
 * array with an explicit keys property defined, or in an object literal
 * with valid key property.
 *
 * @internal
 * @param {ReactNode} node Statically passed child of any type.
 * @param {*} parentType node's parent's type.
 */
function validateChildKeys(node, parentType) {
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var child = node[i];
      if (ReactElement.isValidElement(child)) {
        validateExplicitKey(child, parentType);
      }
    }
  } else if (ReactElement.isValidElement(node)) {
    // This element was passed in a valid location.
    node._store.validated = true;
  } else if (node) {
    var iteratorFn = getIteratorFn(node);
    // Entry iterators provide implicit keys.
    if (iteratorFn) {
      if (iteratorFn !== node.entries) {
        var iterator = iteratorFn.call(node);
        var step;
        while (!(step = iterator.next()).done) {
          if (ReactElement.isValidElement(step.value)) {
            validateExplicitKey(step.value, parentType);
          }
        }
      }
    } else if (typeof node === 'object') {
      var fragment = ReactFragment.extractIfFragment(node);
      for (var key in fragment) {
        if (fragment.hasOwnProperty(key)) {
          validatePropertyKey(key, fragment[key], parentType);
        }
      }
    }
  }
}

/**
 * Assert that the props are valid
 *
 * @param {string} componentName Name of the component for error messages.
 * @param {object} propTypes Map of prop name to a ReactPropType
 * @param {object} props
 * @param {string} location e.g. "prop", "context", "child context"
 * @private
 */
function checkPropTypes(componentName, propTypes, props, location) {
  for (var propName in propTypes) {
    if (propTypes.hasOwnProperty(propName)) {
      var error;
      // Prop type validation may throw. In case they do, we don't want to
      // fail the render phase where it didn't fail before. So we log it.
      // After these have been cleaned up, we'll let them throw.
      try {
        // This is intentionally an invariant that gets caught. It's the same
        // behavior as without this statement except with a better message.
        ("production" !== "development" ? invariant(
          typeof propTypes[propName] === 'function',
          '%s: %s type `%s` is invalid; it must be a function, usually from ' +
          'React.PropTypes.',
          componentName || 'React class',
          ReactPropTypeLocationNames[location],
          propName
        ) : invariant(typeof propTypes[propName] === 'function'));
        error = propTypes[propName](props, propName, componentName, location);
      } catch (ex) {
        error = ex;
      }
      if (error instanceof Error && !(error.message in loggedTypeFailures)) {
        // Only monitor this failure once because there tends to be a lot of the
        // same error.
        loggedTypeFailures[error.message] = true;

        var addendum = getDeclarationErrorAddendum(this);
        ("production" !== "development" ? warning(false, 'Failed propType: %s%s', error.message, addendum) : null);
      }
    }
  }
}

var warnedPropsMutations = {};

/**
 * Warn about mutating props when setting `propName` on `element`.
 *
 * @param {string} propName The string key within props that was set
 * @param {ReactElement} element
 */
function warnForPropsMutation(propName, element) {
  var type = element.type;
  var elementName = typeof type === 'string' ? type : type.displayName;
  var ownerName = element._owner ?
    element._owner.getPublicInstance().constructor.displayName : null;

  var warningKey = propName + '|' + elementName + '|' + ownerName;
  if (warnedPropsMutations.hasOwnProperty(warningKey)) {
    return;
  }
  warnedPropsMutations[warningKey] = true;

  var elementInfo = '';
  if (elementName) {
    elementInfo = ' <' + elementName + ' />';
  }
  var ownerInfo = '';
  if (ownerName) {
    ownerInfo = ' The element was created by ' + ownerName + '.';
  }

  ("production" !== "development" ? warning(
    false,
    'Don\'t set .props.%s of the React component%s. Instead, specify the ' +
    'correct value when initially creating the element or use ' +
    'React.cloneElement to make a new element with updated props.%s',
    propName,
    elementInfo,
    ownerInfo
  ) : null);
}

// Inline Object.is polyfill
function is(a, b) {
  if (a !== a) {
    // NaN
    return b !== b;
  }
  if (a === 0 && b === 0) {
    // +-0
    return 1 / a === 1 / b;
  }
  return a === b;
}

/**
 * Given an element, check if its props have been mutated since element
 * creation (or the last call to this function). In particular, check if any
 * new props have been added, which we can't directly catch by defining warning
 * properties on the props object.
 *
 * @param {ReactElement} element
 */
function checkAndWarnForMutatedProps(element) {
  if (!element._store) {
    // Element was created using `new ReactElement` directly or with
    // `ReactElement.createElement`; skip mutation checking
    return;
  }

  var originalProps = element._store.originalProps;
  var props = element.props;

  for (var propName in props) {
    if (props.hasOwnProperty(propName)) {
      if (!originalProps.hasOwnProperty(propName) ||
          !is(originalProps[propName], props[propName])) {
        warnForPropsMutation(propName, element);

        // Copy over the new value so that the two props objects match again
        originalProps[propName] = props[propName];
      }
    }
  }
}

/**
 * Given an element, validate that its props follow the propTypes definition,
 * provided by the type.
 *
 * @param {ReactElement} element
 */
function validatePropTypes(element) {
  if (element.type == null) {
    // This has already warned. Don't throw.
    return;
  }
  // Extract the component class from the element. Converts string types
  // to a composite class which may have propTypes.
  // TODO: Validating a string's propTypes is not decoupled from the
  // rendering target which is problematic.
  var componentClass = ReactNativeComponent.getComponentClassForElement(
    element
  );
  var name = componentClass.displayName || componentClass.name;
  if (componentClass.propTypes) {
    checkPropTypes(
      name,
      componentClass.propTypes,
      element.props,
      ReactPropTypeLocations.prop
    );
  }
  if (typeof componentClass.getDefaultProps === 'function') {
    ("production" !== "development" ? warning(
      componentClass.getDefaultProps.isReactClassApproved,
      'getDefaultProps is only used on classic React.createClass ' +
      'definitions. Use a static property named `defaultProps` instead.'
    ) : null);
  }
}

var ReactElementValidator = {

  checkAndWarnForMutatedProps: checkAndWarnForMutatedProps,

  createElement: function(type, props, children) {
    // We warn in this case but don't throw. We expect the element creation to
    // succeed and there will likely be errors in render.
    ("production" !== "development" ? warning(
      type != null,
      'React.createElement: type should not be null or undefined. It should ' +
        'be a string (for DOM elements) or a ReactClass (for composite ' +
        'components).'
    ) : null);

    var element = ReactElement.createElement.apply(this, arguments);

    // The result can be nullish if a mock or a custom function is used.
    // TODO: Drop this when these are no longer allowed as the type argument.
    if (element == null) {
      return element;
    }

    for (var i = 2; i < arguments.length; i++) {
      validateChildKeys(arguments[i], type);
    }

    validatePropTypes(element);

    return element;
  },

  createFactory: function(type) {
    var validatedFactory = ReactElementValidator.createElement.bind(
      null,
      type
    );
    // Legacy hook TODO: Warn if this is accessed
    validatedFactory.type = type;

    if ("production" !== "development") {
      try {
        Object.defineProperty(
          validatedFactory,
          'type',
          {
            enumerable: false,
            get: function() {
              ("production" !== "development" ? warning(
                false,
                'Factory.type is deprecated. Access the class directly ' +
                'before passing it to createFactory.'
              ) : null);
              Object.defineProperty(this, 'type', {
                value: type
              });
              return type;
            }
          }
        );
      } catch (x) {
        // IE will fail on defineProperty (es5-shim/sham too)
      }
    }


    return validatedFactory;
  },

  cloneElement: function(element, props, children) {
    var newElement = ReactElement.cloneElement.apply(this, arguments);
    for (var i = 2; i < arguments.length; i++) {
      validateChildKeys(arguments[i], newElement.type);
    }
    validatePropTypes(newElement);
    return newElement;
  }

};

module.exports = ReactElementValidator;

},{"126":126,"135":135,"154":154,"39":39,"57":57,"63":63,"73":73,"76":76,"77":77}],59:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEmptyComponent
 */

'use strict';

var ReactElement = _dereq_(57);
var ReactInstanceMap = _dereq_(67);

var invariant = _dereq_(135);

var component;
// This registry keeps track of the React IDs of the components that rendered to
// `null` (in reality a placeholder such as `noscript`)
var nullComponentIDsRegistry = {};

var ReactEmptyComponentInjection = {
  injectEmptyComponent: function(emptyComponent) {
    component = ReactElement.createFactory(emptyComponent);
  }
};

var ReactEmptyComponentType = function() {};
ReactEmptyComponentType.prototype.componentDidMount = function() {
  var internalInstance = ReactInstanceMap.get(this);
  // TODO: Make sure we run these methods in the correct order, we shouldn't
  // need this check. We're going to assume if we're here it means we ran
  // componentWillUnmount already so there is no internal instance (it gets
  // removed as part of the unmounting process).
  if (!internalInstance) {
    return;
  }
  registerNullComponentID(internalInstance._rootNodeID);
};
ReactEmptyComponentType.prototype.componentWillUnmount = function() {
  var internalInstance = ReactInstanceMap.get(this);
  // TODO: Get rid of this check. See TODO in componentDidMount.
  if (!internalInstance) {
    return;
  }
  deregisterNullComponentID(internalInstance._rootNodeID);
};
ReactEmptyComponentType.prototype.render = function() {
  ("production" !== "development" ? invariant(
    component,
    'Trying to return null from a render, but no null placeholder component ' +
    'was injected.'
  ) : invariant(component));
  return component();
};

var emptyElement = ReactElement.createElement(ReactEmptyComponentType);

/**
 * Mark the component as having rendered to null.
 * @param {string} id Component's `_rootNodeID`.
 */
function registerNullComponentID(id) {
  nullComponentIDsRegistry[id] = true;
}

/**
 * Unmark the component as having rendered to null: it renders to something now.
 * @param {string} id Component's `_rootNodeID`.
 */
function deregisterNullComponentID(id) {
  delete nullComponentIDsRegistry[id];
}

/**
 * @param {string} id Component's `_rootNodeID`.
 * @return {boolean} True if the component is rendered to null.
 */
function isNullComponentID(id) {
  return !!nullComponentIDsRegistry[id];
}

var ReactEmptyComponent = {
  emptyElement: emptyElement,
  injection: ReactEmptyComponentInjection,
  isNullComponentID: isNullComponentID
};

module.exports = ReactEmptyComponent;

},{"135":135,"57":57,"67":67}],60:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactErrorUtils
 * @typechecks
 */

"use strict";

var ReactErrorUtils = {
  /**
   * Creates a guarded version of a function. This is supposed to make debugging
   * of event handlers easier. To aid debugging with the browser's debugger,
   * this currently simply returns the original function.
   *
   * @param {function} func Function to be executed
   * @param {string} name The name of the guard
   * @return {function}
   */
  guard: function(func, name) {
    return func;
  }
};

module.exports = ReactErrorUtils;

},{}],61:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEventEmitterMixin
 */

'use strict';

var EventPluginHub = _dereq_(17);

function runEventQueueInBatch(events) {
  EventPluginHub.enqueueEvents(events);
  EventPluginHub.processEventQueue();
}

var ReactEventEmitterMixin = {

  /**
   * Streams a fired top-level event to `EventPluginHub` where plugins have the
   * opportunity to create `ReactEvent`s to be dispatched.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {object} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native environment event.
   */
  handleTopLevel: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    var events = EventPluginHub.extractEvents(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent
    );

    runEventQueueInBatch(events);
  }
};

module.exports = ReactEventEmitterMixin;

},{"17":17}],62:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEventListener
 * @typechecks static-only
 */

'use strict';

var EventListener = _dereq_(16);
var ExecutionEnvironment = _dereq_(21);
var PooledClass = _dereq_(28);
var ReactInstanceHandles = _dereq_(66);
var ReactMount = _dereq_(70);
var ReactUpdates = _dereq_(87);

var assign = _dereq_(27);
var getEventTarget = _dereq_(125);
var getUnboundedScrollPosition = _dereq_(131);

/**
 * Finds the parent React component of `node`.
 *
 * @param {*} node
 * @return {?DOMEventTarget} Parent container, or `null` if the specified node
 *                           is not nested.
 */
function findParent(node) {
  // TODO: It may be a good idea to cache this to prevent unnecessary DOM
  // traversal, but caching is difficult to do correctly without using a
  // mutation observer to listen for all DOM changes.
  var nodeID = ReactMount.getID(node);
  var rootID = ReactInstanceHandles.getReactRootIDFromNodeID(nodeID);
  var container = ReactMount.findReactContainerForID(rootID);
  var parent = ReactMount.getFirstReactDOM(container);
  return parent;
}

// Used to store ancestor hierarchy in top level callback
function TopLevelCallbackBookKeeping(topLevelType, nativeEvent) {
  this.topLevelType = topLevelType;
  this.nativeEvent = nativeEvent;
  this.ancestors = [];
}
assign(TopLevelCallbackBookKeeping.prototype, {
  destructor: function() {
    this.topLevelType = null;
    this.nativeEvent = null;
    this.ancestors.length = 0;
  }
});
PooledClass.addPoolingTo(
  TopLevelCallbackBookKeeping,
  PooledClass.twoArgumentPooler
);

function handleTopLevelImpl(bookKeeping) {
  var topLevelTarget = ReactMount.getFirstReactDOM(
    getEventTarget(bookKeeping.nativeEvent)
  ) || window;

  // Loop through the hierarchy, in case there's any nested components.
  // It's important that we build the array of ancestors before calling any
  // event handlers, because event handlers can modify the DOM, leading to
  // inconsistencies with ReactMount's node cache. See #1105.
  var ancestor = topLevelTarget;
  while (ancestor) {
    bookKeeping.ancestors.push(ancestor);
    ancestor = findParent(ancestor);
  }

  for (var i = 0, l = bookKeeping.ancestors.length; i < l; i++) {
    topLevelTarget = bookKeeping.ancestors[i];
    var topLevelTargetID = ReactMount.getID(topLevelTarget) || '';
    ReactEventListener._handleTopLevel(
      bookKeeping.topLevelType,
      topLevelTarget,
      topLevelTargetID,
      bookKeeping.nativeEvent
    );
  }
}

function scrollValueMonitor(cb) {
  var scrollPosition = getUnboundedScrollPosition(window);
  cb(scrollPosition);
}

var ReactEventListener = {
  _enabled: true,
  _handleTopLevel: null,

  WINDOW_HANDLE: ExecutionEnvironment.canUseDOM ? window : null,

  setHandleTopLevel: function(handleTopLevel) {
    ReactEventListener._handleTopLevel = handleTopLevel;
  },

  setEnabled: function(enabled) {
    ReactEventListener._enabled = !!enabled;
  },

  isEnabled: function() {
    return ReactEventListener._enabled;
  },


  /**
   * Traps top-level events by using event bubbling.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} handle Element on which to attach listener.
   * @return {object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
  trapBubbledEvent: function(topLevelType, handlerBaseName, handle) {
    var element = handle;
    if (!element) {
      return null;
    }
    return EventListener.listen(
      element,
      handlerBaseName,
      ReactEventListener.dispatchEvent.bind(null, topLevelType)
    );
  },

  /**
   * Traps a top-level event by using event capturing.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} handle Element on which to attach listener.
   * @return {object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
  trapCapturedEvent: function(topLevelType, handlerBaseName, handle) {
    var element = handle;
    if (!element) {
      return null;
    }
    return EventListener.capture(
      element,
      handlerBaseName,
      ReactEventListener.dispatchEvent.bind(null, topLevelType)
    );
  },

  monitorScrollValue: function(refresh) {
    var callback = scrollValueMonitor.bind(null, refresh);
    EventListener.listen(window, 'scroll', callback);
  },

  dispatchEvent: function(topLevelType, nativeEvent) {
    if (!ReactEventListener._enabled) {
      return;
    }

    var bookKeeping = TopLevelCallbackBookKeeping.getPooled(
      topLevelType,
      nativeEvent
    );
    try {
      // Event queue being processed in the same cycle allows
      // `preventDefault`.
      ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
    } finally {
      TopLevelCallbackBookKeeping.release(bookKeeping);
    }
  }
};

module.exports = ReactEventListener;

},{"125":125,"131":131,"16":16,"21":21,"27":27,"28":28,"66":66,"70":70,"87":87}],63:[function(_dereq_,module,exports){
/**
 * Copyright 2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
* @providesModule ReactFragment
*/

'use strict';

var ReactElement = _dereq_(57);

var warning = _dereq_(154);

/**
 * We used to allow keyed objects to serve as a collection of ReactElements,
 * or nested sets. This allowed us a way to explicitly key a set a fragment of
 * components. This is now being replaced with an opaque data structure.
 * The upgrade path is to call React.addons.createFragment({ key: value }) to
 * create a keyed fragment. The resulting data structure is opaque, for now.
 */

if ("production" !== "development") {
  var fragmentKey = '_reactFragment';
  var didWarnKey = '_reactDidWarn';
  var canWarnForReactFragment = false;

  try {
    // Feature test. Don't even try to issue this warning if we can't use
    // enumerable: false.

    var dummy = function() {
      return 1;
    };

    Object.defineProperty(
      {},
      fragmentKey,
      {enumerable: false, value: true}
    );

    Object.defineProperty(
      {},
      'key',
      {enumerable: true, get: dummy}
    );

    canWarnForReactFragment = true;
  } catch (x) { }

  var proxyPropertyAccessWithWarning = function(obj, key) {
    Object.defineProperty(obj, key, {
      enumerable: true,
      get: function() {
        ("production" !== "development" ? warning(
          this[didWarnKey],
          'A ReactFragment is an opaque type. Accessing any of its ' +
          'properties is deprecated. Pass it to one of the React.Children ' +
          'helpers.'
        ) : null);
        this[didWarnKey] = true;
        return this[fragmentKey][key];
      },
      set: function(value) {
        ("production" !== "development" ? warning(
          this[didWarnKey],
          'A ReactFragment is an immutable opaque type. Mutating its ' +
          'properties is deprecated.'
        ) : null);
        this[didWarnKey] = true;
        this[fragmentKey][key] = value;
      }
    });
  };

  var issuedWarnings = {};

  var didWarnForFragment = function(fragment) {
    // We use the keys and the type of the value as a heuristic to dedupe the
    // warning to avoid spamming too much.
    var fragmentCacheKey = '';
    for (var key in fragment) {
      fragmentCacheKey += key + ':' + (typeof fragment[key]) + ',';
    }
    var alreadyWarnedOnce = !!issuedWarnings[fragmentCacheKey];
    issuedWarnings[fragmentCacheKey] = true;
    return alreadyWarnedOnce;
  };
}

var ReactFragment = {
  // Wrap a keyed object in an opaque proxy that warns you if you access any
  // of its properties.
  create: function(object) {
    if ("production" !== "development") {
      if (typeof object !== 'object' || !object || Array.isArray(object)) {
        ("production" !== "development" ? warning(
          false,
          'React.addons.createFragment only accepts a single object.',
          object
        ) : null);
        return object;
      }
      if (ReactElement.isValidElement(object)) {
        ("production" !== "development" ? warning(
          false,
          'React.addons.createFragment does not accept a ReactElement ' +
          'without a wrapper object.'
        ) : null);
        return object;
      }
      if (canWarnForReactFragment) {
        var proxy = {};
        Object.defineProperty(proxy, fragmentKey, {
          enumerable: false,
          value: object
        });
        Object.defineProperty(proxy, didWarnKey, {
          writable: true,
          enumerable: false,
          value: false
        });
        for (var key in object) {
          proxyPropertyAccessWithWarning(proxy, key);
        }
        Object.preventExtensions(proxy);
        return proxy;
      }
    }
    return object;
  },
  // Extract the original keyed object from the fragment opaque type. Warn if
  // a plain object is passed here.
  extract: function(fragment) {
    if ("production" !== "development") {
      if (canWarnForReactFragment) {
        if (!fragment[fragmentKey]) {
          ("production" !== "development" ? warning(
            didWarnForFragment(fragment),
            'Any use of a keyed object should be wrapped in ' +
            'React.addons.createFragment(object) before being passed as a ' +
            'child.'
          ) : null);
          return fragment;
        }
        return fragment[fragmentKey];
      }
    }
    return fragment;
  },
  // Check if this is a fragment and if so, extract the keyed object. If it
  // is a fragment-like object, warn that it should be wrapped. Ignore if we
  // can't determine what kind of object this is.
  extractIfFragment: function(fragment) {
    if ("production" !== "development") {
      if (canWarnForReactFragment) {
        // If it is the opaque type, return the keyed object.
        if (fragment[fragmentKey]) {
          return fragment[fragmentKey];
        }
        // Otherwise, check each property if it has an element, if it does
        // it is probably meant as a fragment, so we can warn early. Defer,
        // the warning to extract.
        for (var key in fragment) {
          if (fragment.hasOwnProperty(key) &&
              ReactElement.isValidElement(fragment[key])) {
            // This looks like a fragment object, we should provide an
            // early warning.
            return ReactFragment.extract(fragment);
          }
        }
      }
    }
    return fragment;
  }
};

module.exports = ReactFragment;

},{"154":154,"57":57}],64:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInjection
 */

'use strict';

var DOMProperty = _dereq_(10);
var EventPluginHub = _dereq_(17);
var ReactComponentEnvironment = _dereq_(36);
var ReactClass = _dereq_(33);
var ReactEmptyComponent = _dereq_(59);
var ReactBrowserEventEmitter = _dereq_(30);
var ReactNativeComponent = _dereq_(73);
var ReactDOMComponent = _dereq_(42);
var ReactPerf = _dereq_(75);
var ReactRootIndex = _dereq_(83);
var ReactUpdates = _dereq_(87);

var ReactInjection = {
  Component: ReactComponentEnvironment.injection,
  Class: ReactClass.injection,
  DOMComponent: ReactDOMComponent.injection,
  DOMProperty: DOMProperty.injection,
  EmptyComponent: ReactEmptyComponent.injection,
  EventPluginHub: EventPluginHub.injection,
  EventEmitter: ReactBrowserEventEmitter.injection,
  NativeComponent: ReactNativeComponent.injection,
  Perf: ReactPerf.injection,
  RootIndex: ReactRootIndex.injection,
  Updates: ReactUpdates.injection
};

module.exports = ReactInjection;

},{"10":10,"17":17,"30":30,"33":33,"36":36,"42":42,"59":59,"73":73,"75":75,"83":83,"87":87}],65:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInputSelection
 */

'use strict';

var ReactDOMSelection = _dereq_(50);

var containsNode = _dereq_(109);
var focusNode = _dereq_(119);
var getActiveElement = _dereq_(121);

function isInDocument(node) {
  return containsNode(document.documentElement, node);
}

/**
 * @ReactInputSelection: React input selection module. Based on Selection.js,
 * but modified to be suitable for react and has a couple of bug fixes (doesn't
 * assume buttons have range selections allowed).
 * Input selection module for React.
 */
var ReactInputSelection = {

  hasSelectionCapabilities: function(elem) {
    return elem && (
      ((elem.nodeName === 'INPUT' && elem.type === 'text') ||
      elem.nodeName === 'TEXTAREA' || elem.contentEditable === 'true')
    );
  },

  getSelectionInformation: function() {
    var focusedElem = getActiveElement();
    return {
      focusedElem: focusedElem,
      selectionRange:
          ReactInputSelection.hasSelectionCapabilities(focusedElem) ?
          ReactInputSelection.getSelection(focusedElem) :
          null
    };
  },

  /**
   * @restoreSelection: If any selection information was potentially lost,
   * restore it. This is useful when performing operations that could remove dom
   * nodes and place them back in, resulting in focus being lost.
   */
  restoreSelection: function(priorSelectionInformation) {
    var curFocusedElem = getActiveElement();
    var priorFocusedElem = priorSelectionInformation.focusedElem;
    var priorSelectionRange = priorSelectionInformation.selectionRange;
    if (curFocusedElem !== priorFocusedElem &&
        isInDocument(priorFocusedElem)) {
      if (ReactInputSelection.hasSelectionCapabilities(priorFocusedElem)) {
        ReactInputSelection.setSelection(
          priorFocusedElem,
          priorSelectionRange
        );
      }
      focusNode(priorFocusedElem);
    }
  },

  /**
   * @getSelection: Gets the selection bounds of a focused textarea, input or
   * contentEditable node.
   * -@input: Look up selection bounds of this input
   * -@return {start: selectionStart, end: selectionEnd}
   */
  getSelection: function(input) {
    var selection;

    if ('selectionStart' in input) {
      // Modern browser with input or textarea.
      selection = {
        start: input.selectionStart,
        end: input.selectionEnd
      };
    } else if (document.selection && input.nodeName === 'INPUT') {
      // IE8 input.
      var range = document.selection.createRange();
      // There can only be one selection per document in IE, so it must
      // be in our element.
      if (range.parentElement() === input) {
        selection = {
          start: -range.moveStart('character', -input.value.length),
          end: -range.moveEnd('character', -input.value.length)
        };
      }
    } else {
      // Content editable or old IE textarea.
      selection = ReactDOMSelection.getOffsets(input);
    }

    return selection || {start: 0, end: 0};
  },

  /**
   * @setSelection: Sets the selection bounds of a textarea or input and focuses
   * the input.
   * -@input     Set selection bounds of this input or textarea
   * -@offsets   Object of same form that is returned from get*
   */
  setSelection: function(input, offsets) {
    var start = offsets.start;
    var end = offsets.end;
    if (typeof end === 'undefined') {
      end = start;
    }

    if ('selectionStart' in input) {
      input.selectionStart = start;
      input.selectionEnd = Math.min(end, input.value.length);
    } else if (document.selection && input.nodeName === 'INPUT') {
      var range = input.createTextRange();
      range.collapse(true);
      range.moveStart('character', start);
      range.moveEnd('character', end - start);
      range.select();
    } else {
      ReactDOMSelection.setOffsets(input, offsets);
    }
  }
};

module.exports = ReactInputSelection;

},{"109":109,"119":119,"121":121,"50":50}],66:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInstanceHandles
 * @typechecks static-only
 */

'use strict';

var ReactRootIndex = _dereq_(83);

var invariant = _dereq_(135);

var SEPARATOR = '.';
var SEPARATOR_LENGTH = SEPARATOR.length;

/**
 * Maximum depth of traversals before we consider the possibility of a bad ID.
 */
var MAX_TREE_DEPTH = 100;

/**
 * Creates a DOM ID prefix to use when mounting React components.
 *
 * @param {number} index A unique integer
 * @return {string} React root ID.
 * @internal
 */
function getReactRootIDString(index) {
  return SEPARATOR + index.toString(36);
}

/**
 * Checks if a character in the supplied ID is a separator or the end.
 *
 * @param {string} id A React DOM ID.
 * @param {number} index Index of the character to check.
 * @return {boolean} True if the character is a separator or end of the ID.
 * @private
 */
function isBoundary(id, index) {
  return id.charAt(index) === SEPARATOR || index === id.length;
}

/**
 * Checks if the supplied string is a valid React DOM ID.
 *
 * @param {string} id A React DOM ID, maybe.
 * @return {boolean} True if the string is a valid React DOM ID.
 * @private
 */
function isValidID(id) {
  return id === '' || (
    id.charAt(0) === SEPARATOR && id.charAt(id.length - 1) !== SEPARATOR
  );
}

/**
 * Checks if the first ID is an ancestor of or equal to the second ID.
 *
 * @param {string} ancestorID
 * @param {string} descendantID
 * @return {boolean} True if `ancestorID` is an ancestor of `descendantID`.
 * @internal
 */
function isAncestorIDOf(ancestorID, descendantID) {
  return (
    descendantID.indexOf(ancestorID) === 0 &&
    isBoundary(descendantID, ancestorID.length)
  );
}

/**
 * Gets the parent ID of the supplied React DOM ID, `id`.
 *
 * @param {string} id ID of a component.
 * @return {string} ID of the parent, or an empty string.
 * @private
 */
function getParentID(id) {
  return id ? id.substr(0, id.lastIndexOf(SEPARATOR)) : '';
}

/**
 * Gets the next DOM ID on the tree path from the supplied `ancestorID` to the
 * supplied `destinationID`. If they are equal, the ID is returned.
 *
 * @param {string} ancestorID ID of an ancestor node of `destinationID`.
 * @param {string} destinationID ID of the destination node.
 * @return {string} Next ID on the path from `ancestorID` to `destinationID`.
 * @private
 */
function getNextDescendantID(ancestorID, destinationID) {
  ("production" !== "development" ? invariant(
    isValidID(ancestorID) && isValidID(destinationID),
    'getNextDescendantID(%s, %s): Received an invalid React DOM ID.',
    ancestorID,
    destinationID
  ) : invariant(isValidID(ancestorID) && isValidID(destinationID)));
  ("production" !== "development" ? invariant(
    isAncestorIDOf(ancestorID, destinationID),
    'getNextDescendantID(...): React has made an invalid assumption about ' +
    'the DOM hierarchy. Expected `%s` to be an ancestor of `%s`.',
    ancestorID,
    destinationID
  ) : invariant(isAncestorIDOf(ancestorID, destinationID)));
  if (ancestorID === destinationID) {
    return ancestorID;
  }
  // Skip over the ancestor and the immediate separator. Traverse until we hit
  // another separator or we reach the end of `destinationID`.
  var start = ancestorID.length + SEPARATOR_LENGTH;
  var i;
  for (i = start; i < destinationID.length; i++) {
    if (isBoundary(destinationID, i)) {
      break;
    }
  }
  return destinationID.substr(0, i);
}

/**
 * Gets the nearest common ancestor ID of two IDs.
 *
 * Using this ID scheme, the nearest common ancestor ID is the longest common
 * prefix of the two IDs that immediately preceded a "marker" in both strings.
 *
 * @param {string} oneID
 * @param {string} twoID
 * @return {string} Nearest common ancestor ID, or the empty string if none.
 * @private
 */
function getFirstCommonAncestorID(oneID, twoID) {
  var minLength = Math.min(oneID.length, twoID.length);
  if (minLength === 0) {
    return '';
  }
  var lastCommonMarkerIndex = 0;
  // Use `<=` to traverse until the "EOL" of the shorter string.
  for (var i = 0; i <= minLength; i++) {
    if (isBoundary(oneID, i) && isBoundary(twoID, i)) {
      lastCommonMarkerIndex = i;
    } else if (oneID.charAt(i) !== twoID.charAt(i)) {
      break;
    }
  }
  var longestCommonID = oneID.substr(0, lastCommonMarkerIndex);
  ("production" !== "development" ? invariant(
    isValidID(longestCommonID),
    'getFirstCommonAncestorID(%s, %s): Expected a valid React DOM ID: %s',
    oneID,
    twoID,
    longestCommonID
  ) : invariant(isValidID(longestCommonID)));
  return longestCommonID;
}

/**
 * Traverses the parent path between two IDs (either up or down). The IDs must
 * not be the same, and there must exist a parent path between them. If the
 * callback returns `false`, traversal is stopped.
 *
 * @param {?string} start ID at which to start traversal.
 * @param {?string} stop ID at which to end traversal.
 * @param {function} cb Callback to invoke each ID with.
 * @param {?boolean} skipFirst Whether or not to skip the first node.
 * @param {?boolean} skipLast Whether or not to skip the last node.
 * @private
 */
function traverseParentPath(start, stop, cb, arg, skipFirst, skipLast) {
  start = start || '';
  stop = stop || '';
  ("production" !== "development" ? invariant(
    start !== stop,
    'traverseParentPath(...): Cannot traverse from and to the same ID, `%s`.',
    start
  ) : invariant(start !== stop));
  var traverseUp = isAncestorIDOf(stop, start);
  ("production" !== "development" ? invariant(
    traverseUp || isAncestorIDOf(start, stop),
    'traverseParentPath(%s, %s, ...): Cannot traverse from two IDs that do ' +
    'not have a parent path.',
    start,
    stop
  ) : invariant(traverseUp || isAncestorIDOf(start, stop)));
  // Traverse from `start` to `stop` one depth at a time.
  var depth = 0;
  var traverse = traverseUp ? getParentID : getNextDescendantID;
  for (var id = start; /* until break */; id = traverse(id, stop)) {
    var ret;
    if ((!skipFirst || id !== start) && (!skipLast || id !== stop)) {
      ret = cb(id, traverseUp, arg);
    }
    if (ret === false || id === stop) {
      // Only break //after// visiting `stop`.
      break;
    }
    ("production" !== "development" ? invariant(
      depth++ < MAX_TREE_DEPTH,
      'traverseParentPath(%s, %s, ...): Detected an infinite loop while ' +
      'traversing the React DOM ID tree. This may be due to malformed IDs: %s',
      start, stop
    ) : invariant(depth++ < MAX_TREE_DEPTH));
  }
}

/**
 * Manages the IDs assigned to DOM representations of React components. This
 * uses a specific scheme in order to traverse the DOM efficiently (e.g. in
 * order to simulate events).
 *
 * @internal
 */
var ReactInstanceHandles = {

  /**
   * Constructs a React root ID
   * @return {string} A React root ID.
   */
  createReactRootID: function() {
    return getReactRootIDString(ReactRootIndex.createReactRootIndex());
  },

  /**
   * Constructs a React ID by joining a root ID with a name.
   *
   * @param {string} rootID Root ID of a parent component.
   * @param {string} name A component's name (as flattened children).
   * @return {string} A React ID.
   * @internal
   */
  createReactID: function(rootID, name) {
    return rootID + name;
  },

  /**
   * Gets the DOM ID of the React component that is the root of the tree that
   * contains the React component with the supplied DOM ID.
   *
   * @param {string} id DOM ID of a React component.
   * @return {?string} DOM ID of the React component that is the root.
   * @internal
   */
  getReactRootIDFromNodeID: function(id) {
    if (id && id.charAt(0) === SEPARATOR && id.length > 1) {
      var index = id.indexOf(SEPARATOR, 1);
      return index > -1 ? id.substr(0, index) : id;
    }
    return null;
  },

  /**
   * Traverses the ID hierarchy and invokes the supplied `cb` on any IDs that
   * should would receive a `mouseEnter` or `mouseLeave` event.
   *
   * NOTE: Does not invoke the callback on the nearest common ancestor because
   * nothing "entered" or "left" that element.
   *
   * @param {string} leaveID ID being left.
   * @param {string} enterID ID being entered.
   * @param {function} cb Callback to invoke on each entered/left ID.
   * @param {*} upArg Argument to invoke the callback with on left IDs.
   * @param {*} downArg Argument to invoke the callback with on entered IDs.
   * @internal
   */
  traverseEnterLeave: function(leaveID, enterID, cb, upArg, downArg) {
    var ancestorID = getFirstCommonAncestorID(leaveID, enterID);
    if (ancestorID !== leaveID) {
      traverseParentPath(leaveID, ancestorID, cb, upArg, false, true);
    }
    if (ancestorID !== enterID) {
      traverseParentPath(ancestorID, enterID, cb, downArg, true, false);
    }
  },

  /**
   * Simulates the traversal of a two-phase, capture/bubble event dispatch.
   *
   * NOTE: This traversal happens on IDs without touching the DOM.
   *
   * @param {string} targetID ID of the target node.
   * @param {function} cb Callback to invoke.
   * @param {*} arg Argument to invoke the callback with.
   * @internal
   */
  traverseTwoPhase: function(targetID, cb, arg) {
    if (targetID) {
      traverseParentPath('', targetID, cb, arg, true, false);
      traverseParentPath(targetID, '', cb, arg, false, true);
    }
  },

  /**
   * Traverse a node ID, calling the supplied `cb` for each ancestor ID. For
   * example, passing `.0.$row-0.1` would result in `cb` getting called
   * with `.0`, `.0.$row-0`, and `.0.$row-0.1`.
   *
   * NOTE: This traversal happens on IDs without touching the DOM.
   *
   * @param {string} targetID ID of the target node.
   * @param {function} cb Callback to invoke.
   * @param {*} arg Argument to invoke the callback with.
   * @internal
   */
  traverseAncestors: function(targetID, cb, arg) {
    traverseParentPath('', targetID, cb, arg, true, false);
  },

  /**
   * Exposed for unit testing.
   * @private
   */
  _getFirstCommonAncestorID: getFirstCommonAncestorID,

  /**
   * Exposed for unit testing.
   * @private
   */
  _getNextDescendantID: getNextDescendantID,

  isAncestorIDOf: isAncestorIDOf,

  SEPARATOR: SEPARATOR

};

module.exports = ReactInstanceHandles;

},{"135":135,"83":83}],67:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactInstanceMap
 */

'use strict';

/**
 * `ReactInstanceMap` maintains a mapping from a public facing stateful
 * instance (key) and the internal representation (value). This allows public
 * methods to accept the user facing instance as an argument and map them back
 * to internal methods.
 */

// TODO: Replace this with ES6: var ReactInstanceMap = new Map();
var ReactInstanceMap = {

  /**
   * This API should be called `delete` but we'd have to make sure to always
   * transform these to strings for IE support. When this transform is fully
   * supported we can rename it.
   */
  remove: function(key) {
    key._reactInternalInstance = undefined;
  },

  get: function(key) {
    return key._reactInternalInstance;
  },

  has: function(key) {
    return key._reactInternalInstance !== undefined;
  },

  set: function(key, value) {
    key._reactInternalInstance = value;
  }

};

module.exports = ReactInstanceMap;

},{}],68:[function(_dereq_,module,exports){
/**
 * Copyright 2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactLifeCycle
 */

'use strict';

/**
 * This module manages the bookkeeping when a component is in the process
 * of being mounted or being unmounted. This is used as a way to enforce
 * invariants (or warnings) when it is not recommended to call
 * setState/forceUpdate.
 *
 * currentlyMountingInstance: During the construction phase, it is not possible
 * to trigger an update since the instance is not fully mounted yet. However, we
 * currently allow this as a convenience for mutating the initial state.
 *
 * currentlyUnmountingInstance: During the unmounting phase, the instance is
 * still mounted and can therefore schedule an update. However, this is not
 * recommended and probably an error since it's about to be unmounted.
 * Therefore we still want to trigger in an error for that case.
 */

var ReactLifeCycle = {
  currentlyMountingInstance: null,
  currentlyUnmountingInstance: null
};

module.exports = ReactLifeCycle;

},{}],69:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMarkupChecksum
 */

'use strict';

var adler32 = _dereq_(106);

var ReactMarkupChecksum = {
  CHECKSUM_ATTR_NAME: 'data-react-checksum',

  /**
   * @param {string} markup Markup string
   * @return {string} Markup string with checksum attribute attached
   */
  addChecksumToMarkup: function(markup) {
    var checksum = adler32(markup);
    return markup.replace(
      '>',
      ' ' + ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="' + checksum + '">'
    );
  },

  /**
   * @param {string} markup to use
   * @param {DOMElement} element root React element
   * @returns {boolean} whether or not the markup is the same
   */
  canReuseMarkup: function(markup, element) {
    var existingChecksum = element.getAttribute(
      ReactMarkupChecksum.CHECKSUM_ATTR_NAME
    );
    existingChecksum = existingChecksum && parseInt(existingChecksum, 10);
    var markupChecksum = adler32(markup);
    return markupChecksum === existingChecksum;
  }
};

module.exports = ReactMarkupChecksum;

},{"106":106}],70:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMount
 */

'use strict';

var DOMProperty = _dereq_(10);
var ReactBrowserEventEmitter = _dereq_(30);
var ReactCurrentOwner = _dereq_(39);
var ReactElement = _dereq_(57);
var ReactElementValidator = _dereq_(58);
var ReactEmptyComponent = _dereq_(59);
var ReactInstanceHandles = _dereq_(66);
var ReactInstanceMap = _dereq_(67);
var ReactMarkupChecksum = _dereq_(69);
var ReactPerf = _dereq_(75);
var ReactReconciler = _dereq_(81);
var ReactUpdateQueue = _dereq_(86);
var ReactUpdates = _dereq_(87);

var emptyObject = _dereq_(115);
var containsNode = _dereq_(109);
var getReactRootElementInContainer = _dereq_(129);
var instantiateReactComponent = _dereq_(134);
var invariant = _dereq_(135);
var setInnerHTML = _dereq_(148);
var shouldUpdateReactComponent = _dereq_(151);
var warning = _dereq_(154);

var SEPARATOR = ReactInstanceHandles.SEPARATOR;

var ATTR_NAME = DOMProperty.ID_ATTRIBUTE_NAME;
var nodeCache = {};

var ELEMENT_NODE_TYPE = 1;
var DOC_NODE_TYPE = 9;

/** Mapping from reactRootID to React component instance. */
var instancesByReactRootID = {};

/** Mapping from reactRootID to `container` nodes. */
var containersByReactRootID = {};

if ("production" !== "development") {
  /** __DEV__-only mapping from reactRootID to root elements. */
  var rootElementsByReactRootID = {};
}

// Used to store breadth-first search state in findComponentRoot.
var findComponentRootReusableArray = [];

/**
 * Finds the index of the first character
 * that's not common between the two given strings.
 *
 * @return {number} the index of the character where the strings diverge
 */
function firstDifferenceIndex(string1, string2) {
  var minLen = Math.min(string1.length, string2.length);
  for (var i = 0; i < minLen; i++) {
    if (string1.charAt(i) !== string2.charAt(i)) {
      return i;
    }
  }
  return string1.length === string2.length ? -1 : minLen;
}

/**
 * @param {DOMElement} container DOM element that may contain a React component.
 * @return {?string} A "reactRoot" ID, if a React component is rendered.
 */
function getReactRootID(container) {
  var rootElement = getReactRootElementInContainer(container);
  return rootElement && ReactMount.getID(rootElement);
}

/**
 * Accessing node[ATTR_NAME] or calling getAttribute(ATTR_NAME) on a form
 * element can return its control whose name or ID equals ATTR_NAME. All
 * DOM nodes support `getAttributeNode` but this can also get called on
 * other objects so just return '' if we're given something other than a
 * DOM node (such as window).
 *
 * @param {?DOMElement|DOMWindow|DOMDocument|DOMTextNode} node DOM node.
 * @return {string} ID of the supplied `domNode`.
 */
function getID(node) {
  var id = internalGetID(node);
  if (id) {
    if (nodeCache.hasOwnProperty(id)) {
      var cached = nodeCache[id];
      if (cached !== node) {
        ("production" !== "development" ? invariant(
          !isValid(cached, id),
          'ReactMount: Two valid but unequal nodes with the same `%s`: %s',
          ATTR_NAME, id
        ) : invariant(!isValid(cached, id)));

        nodeCache[id] = node;
      }
    } else {
      nodeCache[id] = node;
    }
  }

  return id;
}

function internalGetID(node) {
  // If node is something like a window, document, or text node, none of
  // which support attributes or a .getAttribute method, gracefully return
  // the empty string, as if the attribute were missing.
  return node && node.getAttribute && node.getAttribute(ATTR_NAME) || '';
}

/**
 * Sets the React-specific ID of the given node.
 *
 * @param {DOMElement} node The DOM node whose ID will be set.
 * @param {string} id The value of the ID attribute.
 */
function setID(node, id) {
  var oldID = internalGetID(node);
  if (oldID !== id) {
    delete nodeCache[oldID];
  }
  node.setAttribute(ATTR_NAME, id);
  nodeCache[id] = node;
}

/**
 * Finds the node with the supplied React-generated DOM ID.
 *
 * @param {string} id A React-generated DOM ID.
 * @return {DOMElement} DOM node with the suppled `id`.
 * @internal
 */
function getNode(id) {
  if (!nodeCache.hasOwnProperty(id) || !isValid(nodeCache[id], id)) {
    nodeCache[id] = ReactMount.findReactNodeByID(id);
  }
  return nodeCache[id];
}

/**
 * Finds the node with the supplied public React instance.
 *
 * @param {*} instance A public React instance.
 * @return {?DOMElement} DOM node with the suppled `id`.
 * @internal
 */
function getNodeFromInstance(instance) {
  var id = ReactInstanceMap.get(instance)._rootNodeID;
  if (ReactEmptyComponent.isNullComponentID(id)) {
    return null;
  }
  if (!nodeCache.hasOwnProperty(id) || !isValid(nodeCache[id], id)) {
    nodeCache[id] = ReactMount.findReactNodeByID(id);
  }
  return nodeCache[id];
}

/**
 * A node is "valid" if it is contained by a currently mounted container.
 *
 * This means that the node does not have to be contained by a document in
 * order to be considered valid.
 *
 * @param {?DOMElement} node The candidate DOM node.
 * @param {string} id The expected ID of the node.
 * @return {boolean} Whether the node is contained by a mounted container.
 */
function isValid(node, id) {
  if (node) {
    ("production" !== "development" ? invariant(
      internalGetID(node) === id,
      'ReactMount: Unexpected modification of `%s`',
      ATTR_NAME
    ) : invariant(internalGetID(node) === id));

    var container = ReactMount.findReactContainerForID(id);
    if (container && containsNode(container, node)) {
      return true;
    }
  }

  return false;
}

/**
 * Causes the cache to forget about one React-specific ID.
 *
 * @param {string} id The ID to forget.
 */
function purgeID(id) {
  delete nodeCache[id];
}

var deepestNodeSoFar = null;
function findDeepestCachedAncestorImpl(ancestorID) {
  var ancestor = nodeCache[ancestorID];
  if (ancestor && isValid(ancestor, ancestorID)) {
    deepestNodeSoFar = ancestor;
  } else {
    // This node isn't populated in the cache, so presumably none of its
    // descendants are. Break out of the loop.
    return false;
  }
}

/**
 * Return the deepest cached node whose ID is a prefix of `targetID`.
 */
function findDeepestCachedAncestor(targetID) {
  deepestNodeSoFar = null;
  ReactInstanceHandles.traverseAncestors(
    targetID,
    findDeepestCachedAncestorImpl
  );

  var foundNode = deepestNodeSoFar;
  deepestNodeSoFar = null;
  return foundNode;
}

/**
 * Mounts this component and inserts it into the DOM.
 *
 * @param {ReactComponent} componentInstance The instance to mount.
 * @param {string} rootID DOM ID of the root node.
 * @param {DOMElement} container DOM element to mount into.
 * @param {ReactReconcileTransaction} transaction
 * @param {boolean} shouldReuseMarkup If true, do not insert markup
 */
function mountComponentIntoNode(
    componentInstance,
    rootID,
    container,
    transaction,
    shouldReuseMarkup) {
  var markup = ReactReconciler.mountComponent(
    componentInstance, rootID, transaction, emptyObject
  );
  componentInstance._isTopLevel = true;
  ReactMount._mountImageIntoNode(markup, container, shouldReuseMarkup);
}

/**
 * Batched mount.
 *
 * @param {ReactComponent} componentInstance The instance to mount.
 * @param {string} rootID DOM ID of the root node.
 * @param {DOMElement} container DOM element to mount into.
 * @param {boolean} shouldReuseMarkup If true, do not insert markup
 */
function batchedMountComponentIntoNode(
    componentInstance,
    rootID,
    container,
    shouldReuseMarkup) {
  var transaction = ReactUpdates.ReactReconcileTransaction.getPooled();
  transaction.perform(
    mountComponentIntoNode,
    null,
    componentInstance,
    rootID,
    container,
    transaction,
    shouldReuseMarkup
  );
  ReactUpdates.ReactReconcileTransaction.release(transaction);
}

/**
 * Mounting is the process of initializing a React component by creating its
 * representative DOM elements and inserting them into a supplied `container`.
 * Any prior content inside `container` is destroyed in the process.
 *
 *   ReactMount.render(
 *     component,
 *     document.getElementById('container')
 *   );
 *
 *   <div id="container">                   <-- Supplied `container`.
 *     <div data-reactid=".3">              <-- Rendered reactRoot of React
 *       // ...                                 component.
 *     </div>
 *   </div>
 *
 * Inside of `container`, the first element rendered is the "reactRoot".
 */
var ReactMount = {
  /** Exposed for debugging purposes **/
  _instancesByReactRootID: instancesByReactRootID,

  /**
   * This is a hook provided to support rendering React components while
   * ensuring that the apparent scroll position of its `container` does not
   * change.
   *
   * @param {DOMElement} container The `container` being rendered into.
   * @param {function} renderCallback This must be called once to do the render.
   */
  scrollMonitor: function(container, renderCallback) {
    renderCallback();
  },

  /**
   * Take a component that's already mounted into the DOM and replace its props
   * @param {ReactComponent} prevComponent component instance already in the DOM
   * @param {ReactElement} nextElement component instance to render
   * @param {DOMElement} container container to render into
   * @param {?function} callback function triggered on completion
   */
  _updateRootComponent: function(
      prevComponent,
      nextElement,
      container,
      callback) {
    if ("production" !== "development") {
      ReactElementValidator.checkAndWarnForMutatedProps(nextElement);
    }

    ReactMount.scrollMonitor(container, function() {
      ReactUpdateQueue.enqueueElementInternal(prevComponent, nextElement);
      if (callback) {
        ReactUpdateQueue.enqueueCallbackInternal(prevComponent, callback);
      }
    });

    if ("production" !== "development") {
      // Record the root element in case it later gets transplanted.
      rootElementsByReactRootID[getReactRootID(container)] =
        getReactRootElementInContainer(container);
    }

    return prevComponent;
  },

  /**
   * Register a component into the instance map and starts scroll value
   * monitoring
   * @param {ReactComponent} nextComponent component instance to render
   * @param {DOMElement} container container to render into
   * @return {string} reactRoot ID prefix
   */
  _registerComponent: function(nextComponent, container) {
    ("production" !== "development" ? invariant(
      container && (
        (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE)
      ),
      '_registerComponent(...): Target container is not a DOM element.'
    ) : invariant(container && (
      (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE)
    )));

    ReactBrowserEventEmitter.ensureScrollValueMonitoring();

    var reactRootID = ReactMount.registerContainer(container);
    instancesByReactRootID[reactRootID] = nextComponent;
    return reactRootID;
  },

  /**
   * Render a new component into the DOM.
   * @param {ReactElement} nextElement element to render
   * @param {DOMElement} container container to render into
   * @param {boolean} shouldReuseMarkup if we should skip the markup insertion
   * @return {ReactComponent} nextComponent
   */
  _renderNewRootComponent: function(
    nextElement,
    container,
    shouldReuseMarkup
  ) {
    // Various parts of our code (such as ReactCompositeComponent's
    // _renderValidatedComponent) assume that calls to render aren't nested;
    // verify that that's the case.
    ("production" !== "development" ? warning(
      ReactCurrentOwner.current == null,
      '_renderNewRootComponent(): Render methods should be a pure function ' +
      'of props and state; triggering nested component updates from ' +
      'render is not allowed. If necessary, trigger nested updates in ' +
      'componentDidUpdate.'
    ) : null);

    var componentInstance = instantiateReactComponent(nextElement, null);
    var reactRootID = ReactMount._registerComponent(
      componentInstance,
      container
    );

    // The initial render is synchronous but any updates that happen during
    // rendering, in componentWillMount or componentDidMount, will be batched
    // according to the current batching strategy.

    ReactUpdates.batchedUpdates(
      batchedMountComponentIntoNode,
      componentInstance,
      reactRootID,
      container,
      shouldReuseMarkup
    );

    if ("production" !== "development") {
      // Record the root element in case it later gets transplanted.
      rootElementsByReactRootID[reactRootID] =
        getReactRootElementInContainer(container);
    }

    return componentInstance;
  },

  /**
   * Renders a React component into the DOM in the supplied `container`.
   *
   * If the React component was previously rendered into `container`, this will
   * perform an update on it and only mutate the DOM as necessary to reflect the
   * latest React component.
   *
   * @param {ReactElement} nextElement Component element to render.
   * @param {DOMElement} container DOM element to render into.
   * @param {?function} callback function triggered on completion
   * @return {ReactComponent} Component instance rendered in `container`.
   */
  render: function(nextElement, container, callback) {
    ("production" !== "development" ? invariant(
      ReactElement.isValidElement(nextElement),
      'React.render(): Invalid component element.%s',
      (
        typeof nextElement === 'string' ?
          ' Instead of passing an element string, make sure to instantiate ' +
          'it by passing it to React.createElement.' :
        typeof nextElement === 'function' ?
          ' Instead of passing a component class, make sure to instantiate ' +
          'it by passing it to React.createElement.' :
        // Check if it quacks like an element
        nextElement != null && nextElement.props !== undefined ?
          ' This may be caused by unintentionally loading two independent ' +
          'copies of React.' :
          ''
      )
    ) : invariant(ReactElement.isValidElement(nextElement)));

    var prevComponent = instancesByReactRootID[getReactRootID(container)];

    if (prevComponent) {
      var prevElement = prevComponent._currentElement;
      if (shouldUpdateReactComponent(prevElement, nextElement)) {
        return ReactMount._updateRootComponent(
          prevComponent,
          nextElement,
          container,
          callback
        ).getPublicInstance();
      } else {
        ReactMount.unmountComponentAtNode(container);
      }
    }

    var reactRootElement = getReactRootElementInContainer(container);
    var containerHasReactMarkup =
      reactRootElement && ReactMount.isRenderedByReact(reactRootElement);

    if ("production" !== "development") {
      if (!containerHasReactMarkup || reactRootElement.nextSibling) {
        var rootElementSibling = reactRootElement;
        while (rootElementSibling) {
          if (ReactMount.isRenderedByReact(rootElementSibling)) {
            ("production" !== "development" ? warning(
              false,
              'render(): Target node has markup rendered by React, but there ' +
              'are unrelated nodes as well. This is most commonly caused by ' +
              'white-space inserted around server-rendered markup.'
            ) : null);
            break;
          }

          rootElementSibling = rootElementSibling.nextSibling;
        }
      }
    }

    var shouldReuseMarkup = containerHasReactMarkup && !prevComponent;

    var component = ReactMount._renderNewRootComponent(
      nextElement,
      container,
      shouldReuseMarkup
    ).getPublicInstance();
    if (callback) {
      callback.call(component);
    }
    return component;
  },

  /**
   * Constructs a component instance of `constructor` with `initialProps` and
   * renders it into the supplied `container`.
   *
   * @param {function} constructor React component constructor.
   * @param {?object} props Initial props of the component instance.
   * @param {DOMElement} container DOM element to render into.
   * @return {ReactComponent} Component instance rendered in `container`.
   */
  constructAndRenderComponent: function(constructor, props, container) {
    var element = ReactElement.createElement(constructor, props);
    return ReactMount.render(element, container);
  },

  /**
   * Constructs a component instance of `constructor` with `initialProps` and
   * renders it into a container node identified by supplied `id`.
   *
   * @param {function} componentConstructor React component constructor
   * @param {?object} props Initial props of the component instance.
   * @param {string} id ID of the DOM element to render into.
   * @return {ReactComponent} Component instance rendered in the container node.
   */
  constructAndRenderComponentByID: function(constructor, props, id) {
    var domNode = document.getElementById(id);
    ("production" !== "development" ? invariant(
      domNode,
      'Tried to get element with id of "%s" but it is not present on the page.',
      id
    ) : invariant(domNode));
    return ReactMount.constructAndRenderComponent(constructor, props, domNode);
  },

  /**
   * Registers a container node into which React components will be rendered.
   * This also creates the "reactRoot" ID that will be assigned to the element
   * rendered within.
   *
   * @param {DOMElement} container DOM element to register as a container.
   * @return {string} The "reactRoot" ID of elements rendered within.
   */
  registerContainer: function(container) {
    var reactRootID = getReactRootID(container);
    if (reactRootID) {
      // If one exists, make sure it is a valid "reactRoot" ID.
      reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(reactRootID);
    }
    if (!reactRootID) {
      // No valid "reactRoot" ID found, create one.
      reactRootID = ReactInstanceHandles.createReactRootID();
    }
    containersByReactRootID[reactRootID] = container;
    return reactRootID;
  },

  /**
   * Unmounts and destroys the React component rendered in the `container`.
   *
   * @param {DOMElement} container DOM element containing a React component.
   * @return {boolean} True if a component was found in and unmounted from
   *                   `container`
   */
  unmountComponentAtNode: function(container) {
    // Various parts of our code (such as ReactCompositeComponent's
    // _renderValidatedComponent) assume that calls to render aren't nested;
    // verify that that's the case. (Strictly speaking, unmounting won't cause a
    // render but we still don't expect to be in a render call here.)
    ("production" !== "development" ? warning(
      ReactCurrentOwner.current == null,
      'unmountComponentAtNode(): Render methods should be a pure function of ' +
      'props and state; triggering nested component updates from render is ' +
      'not allowed. If necessary, trigger nested updates in ' +
      'componentDidUpdate.'
    ) : null);

    ("production" !== "development" ? invariant(
      container && (
        (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE)
      ),
      'unmountComponentAtNode(...): Target container is not a DOM element.'
    ) : invariant(container && (
      (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE)
    )));

    var reactRootID = getReactRootID(container);
    var component = instancesByReactRootID[reactRootID];
    if (!component) {
      return false;
    }
    ReactMount.unmountComponentFromNode(component, container);
    delete instancesByReactRootID[reactRootID];
    delete containersByReactRootID[reactRootID];
    if ("production" !== "development") {
      delete rootElementsByReactRootID[reactRootID];
    }
    return true;
  },

  /**
   * Unmounts a component and removes it from the DOM.
   *
   * @param {ReactComponent} instance React component instance.
   * @param {DOMElement} container DOM element to unmount from.
   * @final
   * @internal
   * @see {ReactMount.unmountComponentAtNode}
   */
  unmountComponentFromNode: function(instance, container) {
    ReactReconciler.unmountComponent(instance);

    if (container.nodeType === DOC_NODE_TYPE) {
      container = container.documentElement;
    }

    // http://jsperf.com/emptying-a-node
    while (container.lastChild) {
      container.removeChild(container.lastChild);
    }
  },

  /**
   * Finds the container DOM element that contains React component to which the
   * supplied DOM `id` belongs.
   *
   * @param {string} id The ID of an element rendered by a React component.
   * @return {?DOMElement} DOM element that contains the `id`.
   */
  findReactContainerForID: function(id) {
    var reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(id);
    var container = containersByReactRootID[reactRootID];

    if ("production" !== "development") {
      var rootElement = rootElementsByReactRootID[reactRootID];
      if (rootElement && rootElement.parentNode !== container) {
        ("production" !== "development" ? invariant(
          // Call internalGetID here because getID calls isValid which calls
          // findReactContainerForID (this function).
          internalGetID(rootElement) === reactRootID,
          'ReactMount: Root element ID differed from reactRootID.'
        ) : invariant(// Call internalGetID here because getID calls isValid which calls
        // findReactContainerForID (this function).
        internalGetID(rootElement) === reactRootID));

        var containerChild = container.firstChild;
        if (containerChild &&
            reactRootID === internalGetID(containerChild)) {
          // If the container has a new child with the same ID as the old
          // root element, then rootElementsByReactRootID[reactRootID] is
          // just stale and needs to be updated. The case that deserves a
          // warning is when the container is empty.
          rootElementsByReactRootID[reactRootID] = containerChild;
        } else {
          ("production" !== "development" ? warning(
            false,
            'ReactMount: Root element has been removed from its original ' +
            'container. New container:', rootElement.parentNode
          ) : null);
        }
      }
    }

    return container;
  },

  /**
   * Finds an element rendered by React with the supplied ID.
   *
   * @param {string} id ID of a DOM node in the React component.
   * @return {DOMElement} Root DOM node of the React component.
   */
  findReactNodeByID: function(id) {
    var reactRoot = ReactMount.findReactContainerForID(id);
    return ReactMount.findComponentRoot(reactRoot, id);
  },

  /**
   * True if the supplied `node` is rendered by React.
   *
   * @param {*} node DOM Element to check.
   * @return {boolean} True if the DOM Element appears to be rendered by React.
   * @internal
   */
  isRenderedByReact: function(node) {
    if (node.nodeType !== 1) {
      // Not a DOMElement, therefore not a React component
      return false;
    }
    var id = ReactMount.getID(node);
    return id ? id.charAt(0) === SEPARATOR : false;
  },

  /**
   * Traverses up the ancestors of the supplied node to find a node that is a
   * DOM representation of a React component.
   *
   * @param {*} node
   * @return {?DOMEventTarget}
   * @internal
   */
  getFirstReactDOM: function(node) {
    var current = node;
    while (current && current.parentNode !== current) {
      if (ReactMount.isRenderedByReact(current)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  },

  /**
   * Finds a node with the supplied `targetID` inside of the supplied
   * `ancestorNode`.  Exploits the ID naming scheme to perform the search
   * quickly.
   *
   * @param {DOMEventTarget} ancestorNode Search from this root.
   * @pararm {string} targetID ID of the DOM representation of the component.
   * @return {DOMEventTarget} DOM node with the supplied `targetID`.
   * @internal
   */
  findComponentRoot: function(ancestorNode, targetID) {
    var firstChildren = findComponentRootReusableArray;
    var childIndex = 0;

    var deepestAncestor = findDeepestCachedAncestor(targetID) || ancestorNode;

    firstChildren[0] = deepestAncestor.firstChild;
    firstChildren.length = 1;

    while (childIndex < firstChildren.length) {
      var child = firstChildren[childIndex++];
      var targetChild;

      while (child) {
        var childID = ReactMount.getID(child);
        if (childID) {
          // Even if we find the node we're looking for, we finish looping
          // through its siblings to ensure they're cached so that we don't have
          // to revisit this node again. Otherwise, we make n^2 calls to getID
          // when visiting the many children of a single node in order.

          if (targetID === childID) {
            targetChild = child;
          } else if (ReactInstanceHandles.isAncestorIDOf(childID, targetID)) {
            // If we find a child whose ID is an ancestor of the given ID,
            // then we can be sure that we only want to search the subtree
            // rooted at this child, so we can throw out the rest of the
            // search state.
            firstChildren.length = childIndex = 0;
            firstChildren.push(child.firstChild);
          }

        } else {
          // If this child had no ID, then there's a chance that it was
          // injected automatically by the browser, as when a `<table>`
          // element sprouts an extra `<tbody>` child as a side effect of
          // `.innerHTML` parsing. Optimistically continue down this
          // branch, but not before examining the other siblings.
          firstChildren.push(child.firstChild);
        }

        child = child.nextSibling;
      }

      if (targetChild) {
        // Emptying firstChildren/findComponentRootReusableArray is
        // not necessary for correctness, but it helps the GC reclaim
        // any nodes that were left at the end of the search.
        firstChildren.length = 0;

        return targetChild;
      }
    }

    firstChildren.length = 0;

    ("production" !== "development" ? invariant(
      false,
      'findComponentRoot(..., %s): Unable to find element. This probably ' +
      'means the DOM was unexpectedly mutated (e.g., by the browser), ' +
      'usually due to forgetting a <tbody> when using tables, nesting tags ' +
      'like <form>, <p>, or <a>, or using non-SVG elements in an <svg> ' +
      'parent. ' +
      'Try inspecting the child nodes of the element with React ID `%s`.',
      targetID,
      ReactMount.getID(ancestorNode)
    ) : invariant(false));
  },

  _mountImageIntoNode: function(markup, container, shouldReuseMarkup) {
    ("production" !== "development" ? invariant(
      container && (
        (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE)
      ),
      'mountComponentIntoNode(...): Target container is not valid.'
    ) : invariant(container && (
      (container.nodeType === ELEMENT_NODE_TYPE || container.nodeType === DOC_NODE_TYPE)
    )));

    if (shouldReuseMarkup) {
      var rootElement = getReactRootElementInContainer(container);
      if (ReactMarkupChecksum.canReuseMarkup(markup, rootElement)) {
        return;
      } else {
        var checksum = rootElement.getAttribute(
          ReactMarkupChecksum.CHECKSUM_ATTR_NAME
        );
        rootElement.removeAttribute(ReactMarkupChecksum.CHECKSUM_ATTR_NAME);

        var rootMarkup = rootElement.outerHTML;
        rootElement.setAttribute(
          ReactMarkupChecksum.CHECKSUM_ATTR_NAME,
          checksum
        );

        var diffIndex = firstDifferenceIndex(markup, rootMarkup);
        var difference = ' (client) ' +
          markup.substring(diffIndex - 20, diffIndex + 20) +
          '\n (server) ' + rootMarkup.substring(diffIndex - 20, diffIndex + 20);

        ("production" !== "development" ? invariant(
          container.nodeType !== DOC_NODE_TYPE,
          'You\'re trying to render a component to the document using ' +
          'server rendering but the checksum was invalid. This usually ' +
          'means you rendered a different component type or props on ' +
          'the client from the one on the server, or your render() ' +
          'methods are impure. React cannot handle this case due to ' +
          'cross-browser quirks by rendering at the document root. You ' +
          'should look for environment dependent code in your components ' +
          'and ensure the props are the same client and server side:\n%s',
          difference
        ) : invariant(container.nodeType !== DOC_NODE_TYPE));

        if ("production" !== "development") {
          ("production" !== "development" ? warning(
            false,
            'React attempted to reuse markup in a container but the ' +
            'checksum was invalid. This generally means that you are ' +
            'using server rendering and the markup generated on the ' +
            'server was not what the client was expecting. React injected ' +
            'new markup to compensate which works but you have lost many ' +
            'of the benefits of server rendering. Instead, figure out ' +
            'why the markup being generated is different on the client ' +
            'or server:\n%s',
            difference
          ) : null);
        }
      }
    }

    ("production" !== "development" ? invariant(
      container.nodeType !== DOC_NODE_TYPE,
      'You\'re trying to render a component to the document but ' +
        'you didn\'t use server rendering. We can\'t do this ' +
        'without using server rendering due to cross-browser quirks. ' +
        'See React.renderToString() for server rendering.'
    ) : invariant(container.nodeType !== DOC_NODE_TYPE));

    setInnerHTML(container, markup);
  },

  /**
   * React ID utilities.
   */

  getReactRootID: getReactRootID,

  getID: getID,

  setID: setID,

  getNode: getNode,

  getNodeFromInstance: getNodeFromInstance,

  purgeID: purgeID
};

ReactPerf.measureMethods(ReactMount, 'ReactMount', {
  _renderNewRootComponent: '_renderNewRootComponent',
  _mountImageIntoNode: '_mountImageIntoNode'
});

module.exports = ReactMount;

},{"10":10,"109":109,"115":115,"129":129,"134":134,"135":135,"148":148,"151":151,"154":154,"30":30,"39":39,"57":57,"58":58,"59":59,"66":66,"67":67,"69":69,"75":75,"81":81,"86":86,"87":87}],71:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMultiChild
 * @typechecks static-only
 */

'use strict';

var ReactComponentEnvironment = _dereq_(36);
var ReactMultiChildUpdateTypes = _dereq_(72);

var ReactReconciler = _dereq_(81);
var ReactChildReconciler = _dereq_(31);

/**
 * Updating children of a component may trigger recursive updates. The depth is
 * used to batch recursive updates to render markup more efficiently.
 *
 * @type {number}
 * @private
 */
var updateDepth = 0;

/**
 * Queue of update configuration objects.
 *
 * Each object has a `type` property that is in `ReactMultiChildUpdateTypes`.
 *
 * @type {array<object>}
 * @private
 */
var updateQueue = [];

/**
 * Queue of markup to be rendered.
 *
 * @type {array<string>}
 * @private
 */
var markupQueue = [];

/**
 * Enqueues markup to be rendered and inserted at a supplied index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {string} markup Markup that renders into an element.
 * @param {number} toIndex Destination index.
 * @private
 */
function enqueueMarkup(parentID, markup, toIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.INSERT_MARKUP,
    markupIndex: markupQueue.push(markup) - 1,
    textContent: null,
    fromIndex: null,
    toIndex: toIndex
  });
}

/**
 * Enqueues moving an existing element to another index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {number} fromIndex Source index of the existing element.
 * @param {number} toIndex Destination index of the element.
 * @private
 */
function enqueueMove(parentID, fromIndex, toIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.MOVE_EXISTING,
    markupIndex: null,
    textContent: null,
    fromIndex: fromIndex,
    toIndex: toIndex
  });
}

/**
 * Enqueues removing an element at an index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {number} fromIndex Index of the element to remove.
 * @private
 */
function enqueueRemove(parentID, fromIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.REMOVE_NODE,
    markupIndex: null,
    textContent: null,
    fromIndex: fromIndex,
    toIndex: null
  });
}

/**
 * Enqueues setting the text content.
 *
 * @param {string} parentID ID of the parent component.
 * @param {string} textContent Text content to set.
 * @private
 */
function enqueueTextContent(parentID, textContent) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.TEXT_CONTENT,
    markupIndex: null,
    textContent: textContent,
    fromIndex: null,
    toIndex: null
  });
}

/**
 * Processes any enqueued updates.
 *
 * @private
 */
function processQueue() {
  if (updateQueue.length) {
    ReactComponentEnvironment.processChildrenUpdates(
      updateQueue,
      markupQueue
    );
    clearQueue();
  }
}

/**
 * Clears any enqueued updates.
 *
 * @private
 */
function clearQueue() {
  updateQueue.length = 0;
  markupQueue.length = 0;
}

/**
 * ReactMultiChild are capable of reconciling multiple children.
 *
 * @class ReactMultiChild
 * @internal
 */
var ReactMultiChild = {

  /**
   * Provides common functionality for components that must reconcile multiple
   * children. This is used by `ReactDOMComponent` to mount, update, and
   * unmount child components.
   *
   * @lends {ReactMultiChild.prototype}
   */
  Mixin: {

    /**
     * Generates a "mount image" for each of the supplied children. In the case
     * of `ReactDOMComponent`, a mount image is a string of markup.
     *
     * @param {?object} nestedChildren Nested child maps.
     * @return {array} An array of mounted representations.
     * @internal
     */
    mountChildren: function(nestedChildren, transaction, context) {
      var children = ReactChildReconciler.instantiateChildren(
        nestedChildren, transaction, context
      );
      this._renderedChildren = children;
      var mountImages = [];
      var index = 0;
      for (var name in children) {
        if (children.hasOwnProperty(name)) {
          var child = children[name];
          // Inlined for performance, see `ReactInstanceHandles.createReactID`.
          var rootID = this._rootNodeID + name;
          var mountImage = ReactReconciler.mountComponent(
            child,
            rootID,
            transaction,
            context
          );
          child._mountIndex = index;
          mountImages.push(mountImage);
          index++;
        }
      }
      return mountImages;
    },

    /**
     * Replaces any rendered children with a text content string.
     *
     * @param {string} nextContent String of content.
     * @internal
     */
    updateTextContent: function(nextContent) {
      updateDepth++;
      var errorThrown = true;
      try {
        var prevChildren = this._renderedChildren;
        // Remove any rendered children.
        ReactChildReconciler.unmountChildren(prevChildren);
        // TODO: The setTextContent operation should be enough
        for (var name in prevChildren) {
          if (prevChildren.hasOwnProperty(name)) {
            this._unmountChildByName(prevChildren[name], name);
          }
        }
        // Set new text content.
        this.setTextContent(nextContent);
        errorThrown = false;
      } finally {
        updateDepth--;
        if (!updateDepth) {
          if (errorThrown) {
            clearQueue();
          } else {
            processQueue();
          }
        }
      }
    },

    /**
     * Updates the rendered children with new children.
     *
     * @param {?object} nextNestedChildren Nested child maps.
     * @param {ReactReconcileTransaction} transaction
     * @internal
     */
    updateChildren: function(nextNestedChildren, transaction, context) {
      updateDepth++;
      var errorThrown = true;
      try {
        this._updateChildren(nextNestedChildren, transaction, context);
        errorThrown = false;
      } finally {
        updateDepth--;
        if (!updateDepth) {
          if (errorThrown) {
            clearQueue();
          } else {
            processQueue();
          }
        }

      }
    },

    /**
     * Improve performance by isolating this hot code path from the try/catch
     * block in `updateChildren`.
     *
     * @param {?object} nextNestedChildren Nested child maps.
     * @param {ReactReconcileTransaction} transaction
     * @final
     * @protected
     */
    _updateChildren: function(nextNestedChildren, transaction, context) {
      var prevChildren = this._renderedChildren;
      var nextChildren = ReactChildReconciler.updateChildren(
        prevChildren, nextNestedChildren, transaction, context
      );
      this._renderedChildren = nextChildren;
      if (!nextChildren && !prevChildren) {
        return;
      }
      var name;
      // `nextIndex` will increment for each child in `nextChildren`, but
      // `lastIndex` will be the last index visited in `prevChildren`.
      var lastIndex = 0;
      var nextIndex = 0;
      for (name in nextChildren) {
        if (!nextChildren.hasOwnProperty(name)) {
          continue;
        }
        var prevChild = prevChildren && prevChildren[name];
        var nextChild = nextChildren[name];
        if (prevChild === nextChild) {
          this.moveChild(prevChild, nextIndex, lastIndex);
          lastIndex = Math.max(prevChild._mountIndex, lastIndex);
          prevChild._mountIndex = nextIndex;
        } else {
          if (prevChild) {
            // Update `lastIndex` before `_mountIndex` gets unset by unmounting.
            lastIndex = Math.max(prevChild._mountIndex, lastIndex);
            this._unmountChildByName(prevChild, name);
          }
          // The child must be instantiated before it's mounted.
          this._mountChildByNameAtIndex(
            nextChild, name, nextIndex, transaction, context
          );
        }
        nextIndex++;
      }
      // Remove children that are no longer present.
      for (name in prevChildren) {
        if (prevChildren.hasOwnProperty(name) &&
            !(nextChildren && nextChildren.hasOwnProperty(name))) {
          this._unmountChildByName(prevChildren[name], name);
        }
      }
    },

    /**
     * Unmounts all rendered children. This should be used to clean up children
     * when this component is unmounted.
     *
     * @internal
     */
    unmountChildren: function() {
      var renderedChildren = this._renderedChildren;
      ReactChildReconciler.unmountChildren(renderedChildren);
      this._renderedChildren = null;
    },

    /**
     * Moves a child component to the supplied index.
     *
     * @param {ReactComponent} child Component to move.
     * @param {number} toIndex Destination index of the element.
     * @param {number} lastIndex Last index visited of the siblings of `child`.
     * @protected
     */
    moveChild: function(child, toIndex, lastIndex) {
      // If the index of `child` is less than `lastIndex`, then it needs to
      // be moved. Otherwise, we do not need to move it because a child will be
      // inserted or moved before `child`.
      if (child._mountIndex < lastIndex) {
        enqueueMove(this._rootNodeID, child._mountIndex, toIndex);
      }
    },

    /**
     * Creates a child component.
     *
     * @param {ReactComponent} child Component to create.
     * @param {string} mountImage Markup to insert.
     * @protected
     */
    createChild: function(child, mountImage) {
      enqueueMarkup(this._rootNodeID, mountImage, child._mountIndex);
    },

    /**
     * Removes a child component.
     *
     * @param {ReactComponent} child Child to remove.
     * @protected
     */
    removeChild: function(child) {
      enqueueRemove(this._rootNodeID, child._mountIndex);
    },

    /**
     * Sets this text content string.
     *
     * @param {string} textContent Text content to set.
     * @protected
     */
    setTextContent: function(textContent) {
      enqueueTextContent(this._rootNodeID, textContent);
    },

    /**
     * Mounts a child with the supplied name.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to mount.
     * @param {string} name Name of the child.
     * @param {number} index Index at which to insert the child.
     * @param {ReactReconcileTransaction} transaction
     * @private
     */
    _mountChildByNameAtIndex: function(
      child,
      name,
      index,
      transaction,
      context) {
      // Inlined for performance, see `ReactInstanceHandles.createReactID`.
      var rootID = this._rootNodeID + name;
      var mountImage = ReactReconciler.mountComponent(
        child,
        rootID,
        transaction,
        context
      );
      child._mountIndex = index;
      this.createChild(child, mountImage);
    },

    /**
     * Unmounts a rendered child by name.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to unmount.
     * @param {string} name Name of the child in `this._renderedChildren`.
     * @private
     */
    _unmountChildByName: function(child, name) {
      this.removeChild(child);
      child._mountIndex = null;
    }

  }

};

module.exports = ReactMultiChild;

},{"31":31,"36":36,"72":72,"81":81}],72:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactMultiChildUpdateTypes
 */

'use strict';

var keyMirror = _dereq_(140);

/**
 * When a component's children are updated, a series of update configuration
 * objects are created in order to batch and serialize the required changes.
 *
 * Enumerates all the possible types of update configurations.
 *
 * @internal
 */
var ReactMultiChildUpdateTypes = keyMirror({
  INSERT_MARKUP: null,
  MOVE_EXISTING: null,
  REMOVE_NODE: null,
  TEXT_CONTENT: null
});

module.exports = ReactMultiChildUpdateTypes;

},{"140":140}],73:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactNativeComponent
 */

'use strict';

var assign = _dereq_(27);
var invariant = _dereq_(135);

var autoGenerateWrapperClass = null;
var genericComponentClass = null;
// This registry keeps track of wrapper classes around native tags
var tagToComponentClass = {};
var textComponentClass = null;

var ReactNativeComponentInjection = {
  // This accepts a class that receives the tag string. This is a catch all
  // that can render any kind of tag.
  injectGenericComponentClass: function(componentClass) {
    genericComponentClass = componentClass;
  },
  // This accepts a text component class that takes the text string to be
  // rendered as props.
  injectTextComponentClass: function(componentClass) {
    textComponentClass = componentClass;
  },
  // This accepts a keyed object with classes as values. Each key represents a
  // tag. That particular tag will use this class instead of the generic one.
  injectComponentClasses: function(componentClasses) {
    assign(tagToComponentClass, componentClasses);
  },
  // Temporary hack since we expect DOM refs to behave like composites,
  // for this release.
  injectAutoWrapper: function(wrapperFactory) {
    autoGenerateWrapperClass = wrapperFactory;
  }
};

/**
 * Get a composite component wrapper class for a specific tag.
 *
 * @param {ReactElement} element The tag for which to get the class.
 * @return {function} The React class constructor function.
 */
function getComponentClassForElement(element) {
  if (typeof element.type === 'function') {
    return element.type;
  }
  var tag = element.type;
  var componentClass = tagToComponentClass[tag];
  if (componentClass == null) {
    tagToComponentClass[tag] = componentClass = autoGenerateWrapperClass(tag);
  }
  return componentClass;
}

/**
 * Get a native internal component class for a specific tag.
 *
 * @param {ReactElement} element The element to create.
 * @return {function} The internal class constructor function.
 */
function createInternalComponent(element) {
  ("production" !== "development" ? invariant(
    genericComponentClass,
    'There is no registered component for the tag %s',
    element.type
  ) : invariant(genericComponentClass));
  return new genericComponentClass(element.type, element.props);
}

/**
 * @param {ReactText} text
 * @return {ReactComponent}
 */
function createInstanceForText(text) {
  return new textComponentClass(text);
}

/**
 * @param {ReactComponent} component
 * @return {boolean}
 */
function isTextComponent(component) {
  return component instanceof textComponentClass;
}

var ReactNativeComponent = {
  getComponentClassForElement: getComponentClassForElement,
  createInternalComponent: createInternalComponent,
  createInstanceForText: createInstanceForText,
  isTextComponent: isTextComponent,
  injection: ReactNativeComponentInjection
};

module.exports = ReactNativeComponent;

},{"135":135,"27":27}],74:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactOwner
 */

'use strict';

var invariant = _dereq_(135);

/**
 * ReactOwners are capable of storing references to owned components.
 *
 * All components are capable of //being// referenced by owner components, but
 * only ReactOwner components are capable of //referencing// owned components.
 * The named reference is known as a "ref".
 *
 * Refs are available when mounted and updated during reconciliation.
 *
 *   var MyComponent = React.createClass({
 *     render: function() {
 *       return (
 *         <div onClick={this.handleClick}>
 *           <CustomComponent ref="custom" />
 *         </div>
 *       );
 *     },
 *     handleClick: function() {
 *       this.refs.custom.handleClick();
 *     },
 *     componentDidMount: function() {
 *       this.refs.custom.initialize();
 *     }
 *   });
 *
 * Refs should rarely be used. When refs are used, they should only be done to
 * control data that is not handled by React's data flow.
 *
 * @class ReactOwner
 */
var ReactOwner = {

  /**
   * @param {?object} object
   * @return {boolean} True if `object` is a valid owner.
   * @final
   */
  isValidOwner: function(object) {
    return !!(
      (object &&
      typeof object.attachRef === 'function' && typeof object.detachRef === 'function')
    );
  },

  /**
   * Adds a component by ref to an owner component.
   *
   * @param {ReactComponent} component Component to reference.
   * @param {string} ref Name by which to refer to the component.
   * @param {ReactOwner} owner Component on which to record the ref.
   * @final
   * @internal
   */
  addComponentAsRefTo: function(component, ref, owner) {
    ("production" !== "development" ? invariant(
      ReactOwner.isValidOwner(owner),
      'addComponentAsRefTo(...): Only a ReactOwner can have refs. This ' +
      'usually means that you\'re trying to add a ref to a component that ' +
      'doesn\'t have an owner (that is, was not created inside of another ' +
      'component\'s `render` method). Try rendering this component inside of ' +
      'a new top-level component which will hold the ref.'
    ) : invariant(ReactOwner.isValidOwner(owner)));
    owner.attachRef(ref, component);
  },

  /**
   * Removes a component by ref from an owner component.
   *
   * @param {ReactComponent} component Component to dereference.
   * @param {string} ref Name of the ref to remove.
   * @param {ReactOwner} owner Component on which the ref is recorded.
   * @final
   * @internal
   */
  removeComponentAsRefFrom: function(component, ref, owner) {
    ("production" !== "development" ? invariant(
      ReactOwner.isValidOwner(owner),
      'removeComponentAsRefFrom(...): Only a ReactOwner can have refs. This ' +
      'usually means that you\'re trying to remove a ref to a component that ' +
      'doesn\'t have an owner (that is, was not created inside of another ' +
      'component\'s `render` method). Try rendering this component inside of ' +
      'a new top-level component which will hold the ref.'
    ) : invariant(ReactOwner.isValidOwner(owner)));
    // Check that `component` is still the current ref because we do not want to
    // detach the ref if another component stole it.
    if (owner.getPublicInstance().refs[ref] === component.getPublicInstance()) {
      owner.detachRef(ref);
    }
  }

};

module.exports = ReactOwner;

},{"135":135}],75:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPerf
 * @typechecks static-only
 */

'use strict';

/**
 * ReactPerf is a general AOP system designed to measure performance. This
 * module only has the hooks: see ReactDefaultPerf for the analysis tool.
 */
var ReactPerf = {
  /**
   * Boolean to enable/disable measurement. Set to false by default to prevent
   * accidental logging and perf loss.
   */
  enableMeasure: false,

  /**
   * Holds onto the measure function in use. By default, don't measure
   * anything, but we'll override this if we inject a measure function.
   */
  storedMeasure: _noMeasure,

  /**
   * @param {object} object
   * @param {string} objectName
   * @param {object<string>} methodNames
   */
  measureMethods: function(object, objectName, methodNames) {
    if ("production" !== "development") {
      for (var key in methodNames) {
        if (!methodNames.hasOwnProperty(key)) {
          continue;
        }
        object[key] = ReactPerf.measure(
          objectName,
          methodNames[key],
          object[key]
        );
      }
    }
  },

  /**
   * Use this to wrap methods you want to measure. Zero overhead in production.
   *
   * @param {string} objName
   * @param {string} fnName
   * @param {function} func
   * @return {function}
   */
  measure: function(objName, fnName, func) {
    if ("production" !== "development") {
      var measuredFunc = null;
      var wrapper = function() {
        if (ReactPerf.enableMeasure) {
          if (!measuredFunc) {
            measuredFunc = ReactPerf.storedMeasure(objName, fnName, func);
          }
          return measuredFunc.apply(this, arguments);
        }
        return func.apply(this, arguments);
      };
      wrapper.displayName = objName + '_' + fnName;
      return wrapper;
    }
    return func;
  },

  injection: {
    /**
     * @param {function} measure
     */
    injectMeasure: function(measure) {
      ReactPerf.storedMeasure = measure;
    }
  }
};

/**
 * Simply passes through the measured function, without measuring it.
 *
 * @param {string} objName
 * @param {string} fnName
 * @param {function} func
 * @return {function}
 */
function _noMeasure(objName, fnName, func) {
  return func;
}

module.exports = ReactPerf;

},{}],76:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPropTypeLocationNames
 */

'use strict';

var ReactPropTypeLocationNames = {};

if ("production" !== "development") {
  ReactPropTypeLocationNames = {
    prop: 'prop',
    context: 'context',
    childContext: 'child context'
  };
}

module.exports = ReactPropTypeLocationNames;

},{}],77:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPropTypeLocations
 */

'use strict';

var keyMirror = _dereq_(140);

var ReactPropTypeLocations = keyMirror({
  prop: null,
  context: null,
  childContext: null
});

module.exports = ReactPropTypeLocations;

},{"140":140}],78:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPropTypes
 */

'use strict';

var ReactElement = _dereq_(57);
var ReactFragment = _dereq_(63);
var ReactPropTypeLocationNames = _dereq_(76);

var emptyFunction = _dereq_(114);

/**
 * Collection of methods that allow declaration and validation of props that are
 * supplied to React components. Example usage:
 *
 *   var Props = require('ReactPropTypes');
 *   var MyArticle = React.createClass({
 *     propTypes: {
 *       // An optional string prop named "description".
 *       description: Props.string,
 *
 *       // A required enum prop named "category".
 *       category: Props.oneOf(['News','Photos']).isRequired,
 *
 *       // A prop named "dialog" that requires an instance of Dialog.
 *       dialog: Props.instanceOf(Dialog).isRequired
 *     },
 *     render: function() { ... }
 *   });
 *
 * A more formal specification of how these methods are used:
 *
 *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
 *   decl := ReactPropTypes.{type}(.isRequired)?
 *
 * Each and every declaration produces a function with the same signature. This
 * allows the creation of custom validation functions. For example:
 *
 *  var MyLink = React.createClass({
 *    propTypes: {
 *      // An optional string or URI prop named "href".
 *      href: function(props, propName, componentName) {
 *        var propValue = props[propName];
 *        if (propValue != null && typeof propValue !== 'string' &&
 *            !(propValue instanceof URI)) {
 *          return new Error(
 *            'Expected a string or an URI for ' + propName + ' in ' +
 *            componentName
 *          );
 *        }
 *      }
 *    },
 *    render: function() {...}
 *  });
 *
 * @internal
 */

var ANONYMOUS = '<<anonymous>>';

var elementTypeChecker = createElementTypeChecker();
var nodeTypeChecker = createNodeChecker();

var ReactPropTypes = {
  array: createPrimitiveTypeChecker('array'),
  bool: createPrimitiveTypeChecker('boolean'),
  func: createPrimitiveTypeChecker('function'),
  number: createPrimitiveTypeChecker('number'),
  object: createPrimitiveTypeChecker('object'),
  string: createPrimitiveTypeChecker('string'),

  any: createAnyTypeChecker(),
  arrayOf: createArrayOfTypeChecker,
  element: elementTypeChecker,
  instanceOf: createInstanceTypeChecker,
  node: nodeTypeChecker,
  objectOf: createObjectOfTypeChecker,
  oneOf: createEnumTypeChecker,
  oneOfType: createUnionTypeChecker,
  shape: createShapeTypeChecker
};

function createChainableTypeChecker(validate) {
  function checkType(isRequired, props, propName, componentName, location) {
    componentName = componentName || ANONYMOUS;
    if (props[propName] == null) {
      var locationName = ReactPropTypeLocationNames[location];
      if (isRequired) {
        return new Error(
          ("Required " + locationName + " `" + propName + "` was not specified in ") +
          ("`" + componentName + "`.")
        );
      }
      return null;
    } else {
      return validate(props, propName, componentName, location);
    }
  }

  var chainedCheckType = checkType.bind(null, false);
  chainedCheckType.isRequired = checkType.bind(null, true);

  return chainedCheckType;
}

function createPrimitiveTypeChecker(expectedType) {
  function validate(props, propName, componentName, location) {
    var propValue = props[propName];
    var propType = getPropType(propValue);
    if (propType !== expectedType) {
      var locationName = ReactPropTypeLocationNames[location];
      // `propValue` being instance of, say, date/regexp, pass the 'object'
      // check, but we can offer a more precise error message here rather than
      // 'of type `object`'.
      var preciseType = getPreciseType(propValue);

      return new Error(
        ("Invalid " + locationName + " `" + propName + "` of type `" + preciseType + "` ") +
        ("supplied to `" + componentName + "`, expected `" + expectedType + "`.")
      );
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createAnyTypeChecker() {
  return createChainableTypeChecker(emptyFunction.thatReturns(null));
}

function createArrayOfTypeChecker(typeChecker) {
  function validate(props, propName, componentName, location) {
    var propValue = props[propName];
    if (!Array.isArray(propValue)) {
      var locationName = ReactPropTypeLocationNames[location];
      var propType = getPropType(propValue);
      return new Error(
        ("Invalid " + locationName + " `" + propName + "` of type ") +
        ("`" + propType + "` supplied to `" + componentName + "`, expected an array.")
      );
    }
    for (var i = 0; i < propValue.length; i++) {
      var error = typeChecker(propValue, i, componentName, location);
      if (error instanceof Error) {
        return error;
      }
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createElementTypeChecker() {
  function validate(props, propName, componentName, location) {
    if (!ReactElement.isValidElement(props[propName])) {
      var locationName = ReactPropTypeLocationNames[location];
      return new Error(
        ("Invalid " + locationName + " `" + propName + "` supplied to ") +
        ("`" + componentName + "`, expected a ReactElement.")
      );
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createInstanceTypeChecker(expectedClass) {
  function validate(props, propName, componentName, location) {
    if (!(props[propName] instanceof expectedClass)) {
      var locationName = ReactPropTypeLocationNames[location];
      var expectedClassName = expectedClass.name || ANONYMOUS;
      return new Error(
        ("Invalid " + locationName + " `" + propName + "` supplied to ") +
        ("`" + componentName + "`, expected instance of `" + expectedClassName + "`.")
      );
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createEnumTypeChecker(expectedValues) {
  function validate(props, propName, componentName, location) {
    var propValue = props[propName];
    for (var i = 0; i < expectedValues.length; i++) {
      if (propValue === expectedValues[i]) {
        return null;
      }
    }

    var locationName = ReactPropTypeLocationNames[location];
    var valuesString = JSON.stringify(expectedValues);
    return new Error(
      ("Invalid " + locationName + " `" + propName + "` of value `" + propValue + "` ") +
      ("supplied to `" + componentName + "`, expected one of " + valuesString + ".")
    );
  }
  return createChainableTypeChecker(validate);
}

function createObjectOfTypeChecker(typeChecker) {
  function validate(props, propName, componentName, location) {
    var propValue = props[propName];
    var propType = getPropType(propValue);
    if (propType !== 'object') {
      var locationName = ReactPropTypeLocationNames[location];
      return new Error(
        ("Invalid " + locationName + " `" + propName + "` of type ") +
        ("`" + propType + "` supplied to `" + componentName + "`, expected an object.")
      );
    }
    for (var key in propValue) {
      if (propValue.hasOwnProperty(key)) {
        var error = typeChecker(propValue, key, componentName, location);
        if (error instanceof Error) {
          return error;
        }
      }
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createUnionTypeChecker(arrayOfTypeCheckers) {
  function validate(props, propName, componentName, location) {
    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
      var checker = arrayOfTypeCheckers[i];
      if (checker(props, propName, componentName, location) == null) {
        return null;
      }
    }

    var locationName = ReactPropTypeLocationNames[location];
    return new Error(
      ("Invalid " + locationName + " `" + propName + "` supplied to ") +
      ("`" + componentName + "`.")
    );
  }
  return createChainableTypeChecker(validate);
}

function createNodeChecker() {
  function validate(props, propName, componentName, location) {
    if (!isNode(props[propName])) {
      var locationName = ReactPropTypeLocationNames[location];
      return new Error(
        ("Invalid " + locationName + " `" + propName + "` supplied to ") +
        ("`" + componentName + "`, expected a ReactNode.")
      );
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function createShapeTypeChecker(shapeTypes) {
  function validate(props, propName, componentName, location) {
    var propValue = props[propName];
    var propType = getPropType(propValue);
    if (propType !== 'object') {
      var locationName = ReactPropTypeLocationNames[location];
      return new Error(
        ("Invalid " + locationName + " `" + propName + "` of type `" + propType + "` ") +
        ("supplied to `" + componentName + "`, expected `object`.")
      );
    }
    for (var key in shapeTypes) {
      var checker = shapeTypes[key];
      if (!checker) {
        continue;
      }
      var error = checker(propValue, key, componentName, location);
      if (error) {
        return error;
      }
    }
    return null;
  }
  return createChainableTypeChecker(validate);
}

function isNode(propValue) {
  switch (typeof propValue) {
    case 'number':
    case 'string':
    case 'undefined':
      return true;
    case 'boolean':
      return !propValue;
    case 'object':
      if (Array.isArray(propValue)) {
        return propValue.every(isNode);
      }
      if (propValue === null || ReactElement.isValidElement(propValue)) {
        return true;
      }
      propValue = ReactFragment.extractIfFragment(propValue);
      for (var k in propValue) {
        if (!isNode(propValue[k])) {
          return false;
        }
      }
      return true;
    default:
      return false;
  }
}

// Equivalent of `typeof` but with special handling for array and regexp.
function getPropType(propValue) {
  var propType = typeof propValue;
  if (Array.isArray(propValue)) {
    return 'array';
  }
  if (propValue instanceof RegExp) {
    // Old webkits (at least until Android 4.0) return 'function' rather than
    // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
    // passes PropTypes.object.
    return 'object';
  }
  return propType;
}

// This handles more types than `getPropType`. Only used for error messages.
// See `createPrimitiveTypeChecker`.
function getPreciseType(propValue) {
  var propType = getPropType(propValue);
  if (propType === 'object') {
    if (propValue instanceof Date) {
      return 'date';
    } else if (propValue instanceof RegExp) {
      return 'regexp';
    }
  }
  return propType;
}

module.exports = ReactPropTypes;

},{"114":114,"57":57,"63":63,"76":76}],79:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactPutListenerQueue
 */

'use strict';

var PooledClass = _dereq_(28);
var ReactBrowserEventEmitter = _dereq_(30);

var assign = _dereq_(27);

function ReactPutListenerQueue() {
  this.listenersToPut = [];
}

assign(ReactPutListenerQueue.prototype, {
  enqueuePutListener: function(rootNodeID, propKey, propValue) {
    this.listenersToPut.push({
      rootNodeID: rootNodeID,
      propKey: propKey,
      propValue: propValue
    });
  },

  putListeners: function() {
    for (var i = 0; i < this.listenersToPut.length; i++) {
      var listenerToPut = this.listenersToPut[i];
      ReactBrowserEventEmitter.putListener(
        listenerToPut.rootNodeID,
        listenerToPut.propKey,
        listenerToPut.propValue
      );
    }
  },

  reset: function() {
    this.listenersToPut.length = 0;
  },

  destructor: function() {
    this.reset();
  }
});

PooledClass.addPoolingTo(ReactPutListenerQueue);

module.exports = ReactPutListenerQueue;

},{"27":27,"28":28,"30":30}],80:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactReconcileTransaction
 * @typechecks static-only
 */

'use strict';

var CallbackQueue = _dereq_(6);
var PooledClass = _dereq_(28);
var ReactBrowserEventEmitter = _dereq_(30);
var ReactInputSelection = _dereq_(65);
var ReactPutListenerQueue = _dereq_(79);
var Transaction = _dereq_(103);

var assign = _dereq_(27);

/**
 * Ensures that, when possible, the selection range (currently selected text
 * input) is not disturbed by performing the transaction.
 */
var SELECTION_RESTORATION = {
  /**
   * @return {Selection} Selection information.
   */
  initialize: ReactInputSelection.getSelectionInformation,
  /**
   * @param {Selection} sel Selection information returned from `initialize`.
   */
  close: ReactInputSelection.restoreSelection
};

/**
 * Suppresses events (blur/focus) that could be inadvertently dispatched due to
 * high level DOM manipulations (like temporarily removing a text input from the
 * DOM).
 */
var EVENT_SUPPRESSION = {
  /**
   * @return {boolean} The enabled status of `ReactBrowserEventEmitter` before
   * the reconciliation.
   */
  initialize: function() {
    var currentlyEnabled = ReactBrowserEventEmitter.isEnabled();
    ReactBrowserEventEmitter.setEnabled(false);
    return currentlyEnabled;
  },

  /**
   * @param {boolean} previouslyEnabled Enabled status of
   *   `ReactBrowserEventEmitter` before the reconciliation occured. `close`
   *   restores the previous value.
   */
  close: function(previouslyEnabled) {
    ReactBrowserEventEmitter.setEnabled(previouslyEnabled);
  }
};

/**
 * Provides a queue for collecting `componentDidMount` and
 * `componentDidUpdate` callbacks during the the transaction.
 */
var ON_DOM_READY_QUEUEING = {
  /**
   * Initializes the internal `onDOMReady` queue.
   */
  initialize: function() {
    this.reactMountReady.reset();
  },

  /**
   * After DOM is flushed, invoke all registered `onDOMReady` callbacks.
   */
  close: function() {
    this.reactMountReady.notifyAll();
  }
};

var PUT_LISTENER_QUEUEING = {
  initialize: function() {
    this.putListenerQueue.reset();
  },

  close: function() {
    this.putListenerQueue.putListeners();
  }
};

/**
 * Executed within the scope of the `Transaction` instance. Consider these as
 * being member methods, but with an implied ordering while being isolated from
 * each other.
 */
var TRANSACTION_WRAPPERS = [
  PUT_LISTENER_QUEUEING,
  SELECTION_RESTORATION,
  EVENT_SUPPRESSION,
  ON_DOM_READY_QUEUEING
];

/**
 * Currently:
 * - The order that these are listed in the transaction is critical:
 * - Suppresses events.
 * - Restores selection range.
 *
 * Future:
 * - Restore document/overflow scroll positions that were unintentionally
 *   modified via DOM insertions above the top viewport boundary.
 * - Implement/integrate with customized constraint based layout system and keep
 *   track of which dimensions must be remeasured.
 *
 * @class ReactReconcileTransaction
 */
function ReactReconcileTransaction() {
  this.reinitializeTransaction();
  // Only server-side rendering really needs this option (see
  // `ReactServerRendering`), but server-side uses
  // `ReactServerRenderingTransaction` instead. This option is here so that it's
  // accessible and defaults to false when `ReactDOMComponent` and
  // `ReactTextComponent` checks it in `mountComponent`.`
  this.renderToStaticMarkup = false;
  this.reactMountReady = CallbackQueue.getPooled(null);
  this.putListenerQueue = ReactPutListenerQueue.getPooled();
}

var Mixin = {
  /**
   * @see Transaction
   * @abstract
   * @final
   * @return {array<object>} List of operation wrap proceedures.
   *   TODO: convert to array<TransactionWrapper>
   */
  getTransactionWrappers: function() {
    return TRANSACTION_WRAPPERS;
  },

  /**
   * @return {object} The queue to collect `onDOMReady` callbacks with.
   */
  getReactMountReady: function() {
    return this.reactMountReady;
  },

  getPutListenerQueue: function() {
    return this.putListenerQueue;
  },

  /**
   * `PooledClass` looks for this, and will invoke this before allowing this
   * instance to be resused.
   */
  destructor: function() {
    CallbackQueue.release(this.reactMountReady);
    this.reactMountReady = null;

    ReactPutListenerQueue.release(this.putListenerQueue);
    this.putListenerQueue = null;
  }
};


assign(ReactReconcileTransaction.prototype, Transaction.Mixin, Mixin);

PooledClass.addPoolingTo(ReactReconcileTransaction);

module.exports = ReactReconcileTransaction;

},{"103":103,"27":27,"28":28,"30":30,"6":6,"65":65,"79":79}],81:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactReconciler
 */

'use strict';

var ReactRef = _dereq_(82);
var ReactElementValidator = _dereq_(58);

/**
 * Helper to call ReactRef.attachRefs with this composite component, split out
 * to avoid allocations in the transaction mount-ready queue.
 */
function attachRefs() {
  ReactRef.attachRefs(this, this._currentElement);
}

var ReactReconciler = {

  /**
   * Initializes the component, renders markup, and registers event listeners.
   *
   * @param {ReactComponent} internalInstance
   * @param {string} rootID DOM ID of the root node.
   * @param {ReactReconcileTransaction|ReactServerRenderingTransaction} transaction
   * @return {?string} Rendered markup to be inserted into the DOM.
   * @final
   * @internal
   */
  mountComponent: function(internalInstance, rootID, transaction, context) {
    var markup = internalInstance.mountComponent(rootID, transaction, context);
    if ("production" !== "development") {
      ReactElementValidator.checkAndWarnForMutatedProps(
        internalInstance._currentElement
      );
    }
    transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
    return markup;
  },

  /**
   * Releases any resources allocated by `mountComponent`.
   *
   * @final
   * @internal
   */
  unmountComponent: function(internalInstance) {
    ReactRef.detachRefs(internalInstance, internalInstance._currentElement);
    internalInstance.unmountComponent();
  },

  /**
   * Update a component using a new element.
   *
   * @param {ReactComponent} internalInstance
   * @param {ReactElement} nextElement
   * @param {ReactReconcileTransaction} transaction
   * @param {object} context
   * @internal
   */
  receiveComponent: function(
    internalInstance, nextElement, transaction, context
  ) {
    var prevElement = internalInstance._currentElement;

    if (nextElement === prevElement && nextElement._owner != null) {
      // Since elements are immutable after the owner is rendered,
      // we can do a cheap identity compare here to determine if this is a
      // superfluous reconcile. It's possible for state to be mutable but such
      // change should trigger an update of the owner which would recreate
      // the element. We explicitly check for the existence of an owner since
      // it's possible for an element created outside a composite to be
      // deeply mutated and reused.
      return;
    }

    if ("production" !== "development") {
      ReactElementValidator.checkAndWarnForMutatedProps(nextElement);
    }

    var refsChanged = ReactRef.shouldUpdateRefs(
      prevElement,
      nextElement
    );

    if (refsChanged) {
      ReactRef.detachRefs(internalInstance, prevElement);
    }

    internalInstance.receiveComponent(nextElement, transaction, context);

    if (refsChanged) {
      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
    }
  },

  /**
   * Flush any dirty changes in a component.
   *
   * @param {ReactComponent} internalInstance
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  performUpdateIfNecessary: function(
    internalInstance,
    transaction
  ) {
    internalInstance.performUpdateIfNecessary(transaction);
  }

};

module.exports = ReactReconciler;

},{"58":58,"82":82}],82:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactRef
 */

'use strict';

var ReactOwner = _dereq_(74);

var ReactRef = {};

function attachRef(ref, component, owner) {
  if (typeof ref === 'function') {
    ref(component.getPublicInstance());
  } else {
    // Legacy ref
    ReactOwner.addComponentAsRefTo(component, ref, owner);
  }
}

function detachRef(ref, component, owner) {
  if (typeof ref === 'function') {
    ref(null);
  } else {
    // Legacy ref
    ReactOwner.removeComponentAsRefFrom(component, ref, owner);
  }
}

ReactRef.attachRefs = function(instance, element) {
  var ref = element.ref;
  if (ref != null) {
    attachRef(ref, instance, element._owner);
  }
};

ReactRef.shouldUpdateRefs = function(prevElement, nextElement) {
  // If either the owner or a `ref` has changed, make sure the newest owner
  // has stored a reference to `this`, and the previous owner (if different)
  // has forgotten the reference to `this`. We use the element instead
  // of the public this.props because the post processing cannot determine
  // a ref. The ref conceptually lives on the element.

  // TODO: Should this even be possible? The owner cannot change because
  // it's forbidden by shouldUpdateReactComponent. The ref can change
  // if you swap the keys of but not the refs. Reconsider where this check
  // is made. It probably belongs where the key checking and
  // instantiateReactComponent is done.

  return (
    nextElement._owner !== prevElement._owner ||
    nextElement.ref !== prevElement.ref
  );
};

ReactRef.detachRefs = function(instance, element) {
  var ref = element.ref;
  if (ref != null) {
    detachRef(ref, instance, element._owner);
  }
};

module.exports = ReactRef;

},{"74":74}],83:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactRootIndex
 * @typechecks
 */

'use strict';

var ReactRootIndexInjection = {
  /**
   * @param {function} _createReactRootIndex
   */
  injectCreateReactRootIndex: function(_createReactRootIndex) {
    ReactRootIndex.createReactRootIndex = _createReactRootIndex;
  }
};

var ReactRootIndex = {
  createReactRootIndex: null,
  injection: ReactRootIndexInjection
};

module.exports = ReactRootIndex;

},{}],84:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @typechecks static-only
 * @providesModule ReactServerRendering
 */
'use strict';

var ReactElement = _dereq_(57);
var ReactInstanceHandles = _dereq_(66);
var ReactMarkupChecksum = _dereq_(69);
var ReactServerRenderingTransaction =
  _dereq_(85);

var emptyObject = _dereq_(115);
var instantiateReactComponent = _dereq_(134);
var invariant = _dereq_(135);

/**
 * @param {ReactElement} element
 * @return {string} the HTML markup
 */
function renderToString(element) {
  ("production" !== "development" ? invariant(
    ReactElement.isValidElement(element),
    'renderToString(): You must pass a valid ReactElement.'
  ) : invariant(ReactElement.isValidElement(element)));

  var transaction;
  try {
    var id = ReactInstanceHandles.createReactRootID();
    transaction = ReactServerRenderingTransaction.getPooled(false);

    return transaction.perform(function() {
      var componentInstance = instantiateReactComponent(element, null);
      var markup =
        componentInstance.mountComponent(id, transaction, emptyObject);
      return ReactMarkupChecksum.addChecksumToMarkup(markup);
    }, null);
  } finally {
    ReactServerRenderingTransaction.release(transaction);
  }
}

/**
 * @param {ReactElement} element
 * @return {string} the HTML markup, without the extra React ID and checksum
 * (for generating static pages)
 */
function renderToStaticMarkup(element) {
  ("production" !== "development" ? invariant(
    ReactElement.isValidElement(element),
    'renderToStaticMarkup(): You must pass a valid ReactElement.'
  ) : invariant(ReactElement.isValidElement(element)));

  var transaction;
  try {
    var id = ReactInstanceHandles.createReactRootID();
    transaction = ReactServerRenderingTransaction.getPooled(true);

    return transaction.perform(function() {
      var componentInstance = instantiateReactComponent(element, null);
      return componentInstance.mountComponent(id, transaction, emptyObject);
    }, null);
  } finally {
    ReactServerRenderingTransaction.release(transaction);
  }
}

module.exports = {
  renderToString: renderToString,
  renderToStaticMarkup: renderToStaticMarkup
};

},{"115":115,"134":134,"135":135,"57":57,"66":66,"69":69,"85":85}],85:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactServerRenderingTransaction
 * @typechecks
 */

'use strict';

var PooledClass = _dereq_(28);
var CallbackQueue = _dereq_(6);
var ReactPutListenerQueue = _dereq_(79);
var Transaction = _dereq_(103);

var assign = _dereq_(27);
var emptyFunction = _dereq_(114);

/**
 * Provides a `CallbackQueue` queue for collecting `onDOMReady` callbacks
 * during the performing of the transaction.
 */
var ON_DOM_READY_QUEUEING = {
  /**
   * Initializes the internal `onDOMReady` queue.
   */
  initialize: function() {
    this.reactMountReady.reset();
  },

  close: emptyFunction
};

var PUT_LISTENER_QUEUEING = {
  initialize: function() {
    this.putListenerQueue.reset();
  },

  close: emptyFunction
};

/**
 * Executed within the scope of the `Transaction` instance. Consider these as
 * being member methods, but with an implied ordering while being isolated from
 * each other.
 */
var TRANSACTION_WRAPPERS = [
  PUT_LISTENER_QUEUEING,
  ON_DOM_READY_QUEUEING
];

/**
 * @class ReactServerRenderingTransaction
 * @param {boolean} renderToStaticMarkup
 */
function ReactServerRenderingTransaction(renderToStaticMarkup) {
  this.reinitializeTransaction();
  this.renderToStaticMarkup = renderToStaticMarkup;
  this.reactMountReady = CallbackQueue.getPooled(null);
  this.putListenerQueue = ReactPutListenerQueue.getPooled();
}

var Mixin = {
  /**
   * @see Transaction
   * @abstract
   * @final
   * @return {array} Empty list of operation wrap proceedures.
   */
  getTransactionWrappers: function() {
    return TRANSACTION_WRAPPERS;
  },

  /**
   * @return {object} The queue to collect `onDOMReady` callbacks with.
   */
  getReactMountReady: function() {
    return this.reactMountReady;
  },

  getPutListenerQueue: function() {
    return this.putListenerQueue;
  },

  /**
   * `PooledClass` looks for this, and will invoke this before allowing this
   * instance to be resused.
   */
  destructor: function() {
    CallbackQueue.release(this.reactMountReady);
    this.reactMountReady = null;

    ReactPutListenerQueue.release(this.putListenerQueue);
    this.putListenerQueue = null;
  }
};


assign(
  ReactServerRenderingTransaction.prototype,
  Transaction.Mixin,
  Mixin
);

PooledClass.addPoolingTo(ReactServerRenderingTransaction);

module.exports = ReactServerRenderingTransaction;

},{"103":103,"114":114,"27":27,"28":28,"6":6,"79":79}],86:[function(_dereq_,module,exports){
/**
 * Copyright 2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactUpdateQueue
 */

'use strict';

var ReactLifeCycle = _dereq_(68);
var ReactCurrentOwner = _dereq_(39);
var ReactElement = _dereq_(57);
var ReactInstanceMap = _dereq_(67);
var ReactUpdates = _dereq_(87);

var assign = _dereq_(27);
var invariant = _dereq_(135);
var warning = _dereq_(154);

function enqueueUpdate(internalInstance) {
  if (internalInstance !== ReactLifeCycle.currentlyMountingInstance) {
    // If we're in a componentWillMount handler, don't enqueue a rerender
    // because ReactUpdates assumes we're in a browser context (which is
    // wrong for server rendering) and we're about to do a render anyway.
    // See bug in #1740.
    ReactUpdates.enqueueUpdate(internalInstance);
  }
}

function getInternalInstanceReadyForUpdate(publicInstance, callerName) {
  ("production" !== "development" ? invariant(
    ReactCurrentOwner.current == null,
    '%s(...): Cannot update during an existing state transition ' +
    '(such as within `render`). Render methods should be a pure function ' +
    'of props and state.',
    callerName
  ) : invariant(ReactCurrentOwner.current == null));

  var internalInstance = ReactInstanceMap.get(publicInstance);
  if (!internalInstance) {
    if ("production" !== "development") {
      // Only warn when we have a callerName. Otherwise we should be silent.
      // We're probably calling from enqueueCallback. We don't want to warn
      // there because we already warned for the corresponding lifecycle method.
      ("production" !== "development" ? warning(
        !callerName,
        '%s(...): Can only update a mounted or mounting component. ' +
        'This usually means you called %s() on an unmounted ' +
        'component. This is a no-op.',
        callerName,
        callerName
      ) : null);
    }
    return null;
  }

  if (internalInstance === ReactLifeCycle.currentlyUnmountingInstance) {
    return null;
  }

  return internalInstance;
}

/**
 * ReactUpdateQueue allows for state updates to be scheduled into a later
 * reconciliation step.
 */
var ReactUpdateQueue = {

  /**
   * Enqueue a callback that will be executed after all the pending updates
   * have processed.
   *
   * @param {ReactClass} publicInstance The instance to use as `this` context.
   * @param {?function} callback Called after state is updated.
   * @internal
   */
  enqueueCallback: function(publicInstance, callback) {
    ("production" !== "development" ? invariant(
      typeof callback === 'function',
      'enqueueCallback(...): You called `setProps`, `replaceProps`, ' +
      '`setState`, `replaceState`, or `forceUpdate` with a callback that ' +
      'isn\'t callable.'
    ) : invariant(typeof callback === 'function'));
    var internalInstance = getInternalInstanceReadyForUpdate(publicInstance);

    // Previously we would throw an error if we didn't have an internal
    // instance. Since we want to make it a no-op instead, we mirror the same
    // behavior we have in other enqueue* methods.
    // We also need to ignore callbacks in componentWillMount. See
    // enqueueUpdates.
    if (!internalInstance ||
        internalInstance === ReactLifeCycle.currentlyMountingInstance) {
      return null;
    }

    if (internalInstance._pendingCallbacks) {
      internalInstance._pendingCallbacks.push(callback);
    } else {
      internalInstance._pendingCallbacks = [callback];
    }
    // TODO: The callback here is ignored when setState is called from
    // componentWillMount. Either fix it or disallow doing so completely in
    // favor of getInitialState. Alternatively, we can disallow
    // componentWillMount during server-side rendering.
    enqueueUpdate(internalInstance);
  },

  enqueueCallbackInternal: function(internalInstance, callback) {
    ("production" !== "development" ? invariant(
      typeof callback === 'function',
      'enqueueCallback(...): You called `setProps`, `replaceProps`, ' +
      '`setState`, `replaceState`, or `forceUpdate` with a callback that ' +
      'isn\'t callable.'
    ) : invariant(typeof callback === 'function'));
    if (internalInstance._pendingCallbacks) {
      internalInstance._pendingCallbacks.push(callback);
    } else {
      internalInstance._pendingCallbacks = [callback];
    }
    enqueueUpdate(internalInstance);
  },

  /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   *
   * This will not invoke `shouldUpdateComponent`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @internal
   */
  enqueueForceUpdate: function(publicInstance) {
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'forceUpdate'
    );

    if (!internalInstance) {
      return;
    }

    internalInstance._pendingForceUpdate = true;

    enqueueUpdate(internalInstance);
  },

  /**
   * Replaces all of the state. Always use this or `setState` to mutate state.
   * You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} completeState Next state.
   * @internal
   */
  enqueueReplaceState: function(publicInstance, completeState) {
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'replaceState'
    );

    if (!internalInstance) {
      return;
    }

    internalInstance._pendingStateQueue = [completeState];
    internalInstance._pendingReplaceState = true;

    enqueueUpdate(internalInstance);
  },

  /**
   * Sets a subset of the state. This only exists because _pendingState is
   * internal. This provides a merging strategy that is not available to deep
   * properties which is confusing. TODO: Expose pendingState or don't use it
   * during the merge.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialState Next partial state to be merged with state.
   * @internal
   */
  enqueueSetState: function(publicInstance, partialState) {
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'setState'
    );

    if (!internalInstance) {
      return;
    }

    var queue =
      internalInstance._pendingStateQueue ||
      (internalInstance._pendingStateQueue = []);
    queue.push(partialState);

    enqueueUpdate(internalInstance);
  },

  /**
   * Sets a subset of the props.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} partialProps Subset of the next props.
   * @internal
   */
  enqueueSetProps: function(publicInstance, partialProps) {
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'setProps'
    );

    if (!internalInstance) {
      return;
    }

    ("production" !== "development" ? invariant(
      internalInstance._isTopLevel,
      'setProps(...): You called `setProps` on a ' +
      'component with a parent. This is an anti-pattern since props will ' +
      'get reactively updated when rendered. Instead, change the owner\'s ' +
      '`render` method to pass the correct value as props to the component ' +
      'where it is created.'
    ) : invariant(internalInstance._isTopLevel));

    // Merge with the pending element if it exists, otherwise with existing
    // element props.
    var element = internalInstance._pendingElement ||
                  internalInstance._currentElement;
    var props = assign({}, element.props, partialProps);
    internalInstance._pendingElement = ReactElement.cloneAndReplaceProps(
      element,
      props
    );

    enqueueUpdate(internalInstance);
  },

  /**
   * Replaces all of the props.
   *
   * @param {ReactClass} publicInstance The instance that should rerender.
   * @param {object} props New props.
   * @internal
   */
  enqueueReplaceProps: function(publicInstance, props) {
    var internalInstance = getInternalInstanceReadyForUpdate(
      publicInstance,
      'replaceProps'
    );

    if (!internalInstance) {
      return;
    }

    ("production" !== "development" ? invariant(
      internalInstance._isTopLevel,
      'replaceProps(...): You called `replaceProps` on a ' +
      'component with a parent. This is an anti-pattern since props will ' +
      'get reactively updated when rendered. Instead, change the owner\'s ' +
      '`render` method to pass the correct value as props to the component ' +
      'where it is created.'
    ) : invariant(internalInstance._isTopLevel));

    // Merge with the pending element if it exists, otherwise with existing
    // element props.
    var element = internalInstance._pendingElement ||
                  internalInstance._currentElement;
    internalInstance._pendingElement = ReactElement.cloneAndReplaceProps(
      element,
      props
    );

    enqueueUpdate(internalInstance);
  },

  enqueueElementInternal: function(internalInstance, newElement) {
    internalInstance._pendingElement = newElement;
    enqueueUpdate(internalInstance);
  }

};

module.exports = ReactUpdateQueue;

},{"135":135,"154":154,"27":27,"39":39,"57":57,"67":67,"68":68,"87":87}],87:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactUpdates
 */

'use strict';

var CallbackQueue = _dereq_(6);
var PooledClass = _dereq_(28);
var ReactCurrentOwner = _dereq_(39);
var ReactPerf = _dereq_(75);
var ReactReconciler = _dereq_(81);
var Transaction = _dereq_(103);

var assign = _dereq_(27);
var invariant = _dereq_(135);
var warning = _dereq_(154);

var dirtyComponents = [];
var asapCallbackQueue = CallbackQueue.getPooled();
var asapEnqueued = false;

var batchingStrategy = null;

function ensureInjected() {
  ("production" !== "development" ? invariant(
    ReactUpdates.ReactReconcileTransaction && batchingStrategy,
    'ReactUpdates: must inject a reconcile transaction class and batching ' +
    'strategy'
  ) : invariant(ReactUpdates.ReactReconcileTransaction && batchingStrategy));
}

var NESTED_UPDATES = {
  initialize: function() {
    this.dirtyComponentsLength = dirtyComponents.length;
  },
  close: function() {
    if (this.dirtyComponentsLength !== dirtyComponents.length) {
      // Additional updates were enqueued by componentDidUpdate handlers or
      // similar; before our own UPDATE_QUEUEING wrapper closes, we want to run
      // these new updates so that if A's componentDidUpdate calls setState on
      // B, B will update before the callback A's updater provided when calling
      // setState.
      dirtyComponents.splice(0, this.dirtyComponentsLength);
      flushBatchedUpdates();
    } else {
      dirtyComponents.length = 0;
    }
  }
};

var UPDATE_QUEUEING = {
  initialize: function() {
    this.callbackQueue.reset();
  },
  close: function() {
    this.callbackQueue.notifyAll();
  }
};

var TRANSACTION_WRAPPERS = [NESTED_UPDATES, UPDATE_QUEUEING];

function ReactUpdatesFlushTransaction() {
  this.reinitializeTransaction();
  this.dirtyComponentsLength = null;
  this.callbackQueue = CallbackQueue.getPooled();
  this.reconcileTransaction =
    ReactUpdates.ReactReconcileTransaction.getPooled();
}

assign(
  ReactUpdatesFlushTransaction.prototype,
  Transaction.Mixin, {
  getTransactionWrappers: function() {
    return TRANSACTION_WRAPPERS;
  },

  destructor: function() {
    this.dirtyComponentsLength = null;
    CallbackQueue.release(this.callbackQueue);
    this.callbackQueue = null;
    ReactUpdates.ReactReconcileTransaction.release(this.reconcileTransaction);
    this.reconcileTransaction = null;
  },

  perform: function(method, scope, a) {
    // Essentially calls `this.reconcileTransaction.perform(method, scope, a)`
    // with this transaction's wrappers around it.
    return Transaction.Mixin.perform.call(
      this,
      this.reconcileTransaction.perform,
      this.reconcileTransaction,
      method,
      scope,
      a
    );
  }
});

PooledClass.addPoolingTo(ReactUpdatesFlushTransaction);

function batchedUpdates(callback, a, b, c, d) {
  ensureInjected();
  batchingStrategy.batchedUpdates(callback, a, b, c, d);
}

/**
 * Array comparator for ReactComponents by mount ordering.
 *
 * @param {ReactComponent} c1 first component you're comparing
 * @param {ReactComponent} c2 second component you're comparing
 * @return {number} Return value usable by Array.prototype.sort().
 */
function mountOrderComparator(c1, c2) {
  return c1._mountOrder - c2._mountOrder;
}

function runBatchedUpdates(transaction) {
  var len = transaction.dirtyComponentsLength;
  ("production" !== "development" ? invariant(
    len === dirtyComponents.length,
    'Expected flush transaction\'s stored dirty-components length (%s) to ' +
    'match dirty-components array length (%s).',
    len,
    dirtyComponents.length
  ) : invariant(len === dirtyComponents.length));

  // Since reconciling a component higher in the owner hierarchy usually (not
  // always -- see shouldComponentUpdate()) will reconcile children, reconcile
  // them before their children by sorting the array.
  dirtyComponents.sort(mountOrderComparator);

  for (var i = 0; i < len; i++) {
    // If a component is unmounted before pending changes apply, it will still
    // be here, but we assume that it has cleared its _pendingCallbacks and
    // that performUpdateIfNecessary is a noop.
    var component = dirtyComponents[i];

    // If performUpdateIfNecessary happens to enqueue any new updates, we
    // shouldn't execute the callbacks until the next render happens, so
    // stash the callbacks first
    var callbacks = component._pendingCallbacks;
    component._pendingCallbacks = null;

    ReactReconciler.performUpdateIfNecessary(
      component,
      transaction.reconcileTransaction
    );

    if (callbacks) {
      for (var j = 0; j < callbacks.length; j++) {
        transaction.callbackQueue.enqueue(
          callbacks[j],
          component.getPublicInstance()
        );
      }
    }
  }
}

var flushBatchedUpdates = function() {
  // ReactUpdatesFlushTransaction's wrappers will clear the dirtyComponents
  // array and perform any updates enqueued by mount-ready handlers (i.e.,
  // componentDidUpdate) but we need to check here too in order to catch
  // updates enqueued by setState callbacks and asap calls.
  while (dirtyComponents.length || asapEnqueued) {
    if (dirtyComponents.length) {
      var transaction = ReactUpdatesFlushTransaction.getPooled();
      transaction.perform(runBatchedUpdates, null, transaction);
      ReactUpdatesFlushTransaction.release(transaction);
    }

    if (asapEnqueued) {
      asapEnqueued = false;
      var queue = asapCallbackQueue;
      asapCallbackQueue = CallbackQueue.getPooled();
      queue.notifyAll();
      CallbackQueue.release(queue);
    }
  }
};
flushBatchedUpdates = ReactPerf.measure(
  'ReactUpdates',
  'flushBatchedUpdates',
  flushBatchedUpdates
);

/**
 * Mark a component as needing a rerender, adding an optional callback to a
 * list of functions which will be executed once the rerender occurs.
 */
function enqueueUpdate(component) {
  ensureInjected();

  // Various parts of our code (such as ReactCompositeComponent's
  // _renderValidatedComponent) assume that calls to render aren't nested;
  // verify that that's the case. (This is called by each top-level update
  // function, like setProps, setState, forceUpdate, etc.; creation and
  // destruction of top-level components is guarded in ReactMount.)
  ("production" !== "development" ? warning(
    ReactCurrentOwner.current == null,
    'enqueueUpdate(): Render methods should be a pure function of props ' +
    'and state; triggering nested component updates from render is not ' +
    'allowed. If necessary, trigger nested updates in ' +
    'componentDidUpdate.'
  ) : null);

  if (!batchingStrategy.isBatchingUpdates) {
    batchingStrategy.batchedUpdates(enqueueUpdate, component);
    return;
  }

  dirtyComponents.push(component);
}

/**
 * Enqueue a callback to be run at the end of the current batching cycle. Throws
 * if no updates are currently being performed.
 */
function asap(callback, context) {
  ("production" !== "development" ? invariant(
    batchingStrategy.isBatchingUpdates,
    'ReactUpdates.asap: Can\'t enqueue an asap callback in a context where' +
    'updates are not being batched.'
  ) : invariant(batchingStrategy.isBatchingUpdates));
  asapCallbackQueue.enqueue(callback, context);
  asapEnqueued = true;
}

var ReactUpdatesInjection = {
  injectReconcileTransaction: function(ReconcileTransaction) {
    ("production" !== "development" ? invariant(
      ReconcileTransaction,
      'ReactUpdates: must provide a reconcile transaction class'
    ) : invariant(ReconcileTransaction));
    ReactUpdates.ReactReconcileTransaction = ReconcileTransaction;
  },

  injectBatchingStrategy: function(_batchingStrategy) {
    ("production" !== "development" ? invariant(
      _batchingStrategy,
      'ReactUpdates: must provide a batching strategy'
    ) : invariant(_batchingStrategy));
    ("production" !== "development" ? invariant(
      typeof _batchingStrategy.batchedUpdates === 'function',
      'ReactUpdates: must provide a batchedUpdates() function'
    ) : invariant(typeof _batchingStrategy.batchedUpdates === 'function'));
    ("production" !== "development" ? invariant(
      typeof _batchingStrategy.isBatchingUpdates === 'boolean',
      'ReactUpdates: must provide an isBatchingUpdates boolean attribute'
    ) : invariant(typeof _batchingStrategy.isBatchingUpdates === 'boolean'));
    batchingStrategy = _batchingStrategy;
  }
};

var ReactUpdates = {
  /**
   * React references `ReactReconcileTransaction` using this property in order
   * to allow dependency injection.
   *
   * @internal
   */
  ReactReconcileTransaction: null,

  batchedUpdates: batchedUpdates,
  enqueueUpdate: enqueueUpdate,
  flushBatchedUpdates: flushBatchedUpdates,
  injection: ReactUpdatesInjection,
  asap: asap
};

module.exports = ReactUpdates;

},{"103":103,"135":135,"154":154,"27":27,"28":28,"39":39,"6":6,"75":75,"81":81}],88:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SVGDOMPropertyConfig
 */

/*jslint bitwise: true*/

'use strict';

var DOMProperty = _dereq_(10);

var MUST_USE_ATTRIBUTE = DOMProperty.injection.MUST_USE_ATTRIBUTE;

var SVGDOMPropertyConfig = {
  Properties: {
    clipPath: MUST_USE_ATTRIBUTE,
    cx: MUST_USE_ATTRIBUTE,
    cy: MUST_USE_ATTRIBUTE,
    d: MUST_USE_ATTRIBUTE,
    dx: MUST_USE_ATTRIBUTE,
    dy: MUST_USE_ATTRIBUTE,
    fill: MUST_USE_ATTRIBUTE,
    fillOpacity: MUST_USE_ATTRIBUTE,
    fontFamily: MUST_USE_ATTRIBUTE,
    fontSize: MUST_USE_ATTRIBUTE,
    fx: MUST_USE_ATTRIBUTE,
    fy: MUST_USE_ATTRIBUTE,
    gradientTransform: MUST_USE_ATTRIBUTE,
    gradientUnits: MUST_USE_ATTRIBUTE,
    markerEnd: MUST_USE_ATTRIBUTE,
    markerMid: MUST_USE_ATTRIBUTE,
    markerStart: MUST_USE_ATTRIBUTE,
    offset: MUST_USE_ATTRIBUTE,
    opacity: MUST_USE_ATTRIBUTE,
    patternContentUnits: MUST_USE_ATTRIBUTE,
    patternUnits: MUST_USE_ATTRIBUTE,
    points: MUST_USE_ATTRIBUTE,
    preserveAspectRatio: MUST_USE_ATTRIBUTE,
    r: MUST_USE_ATTRIBUTE,
    rx: MUST_USE_ATTRIBUTE,
    ry: MUST_USE_ATTRIBUTE,
    spreadMethod: MUST_USE_ATTRIBUTE,
    stopColor: MUST_USE_ATTRIBUTE,
    stopOpacity: MUST_USE_ATTRIBUTE,
    stroke: MUST_USE_ATTRIBUTE,
    strokeDasharray: MUST_USE_ATTRIBUTE,
    strokeLinecap: MUST_USE_ATTRIBUTE,
    strokeOpacity: MUST_USE_ATTRIBUTE,
    strokeWidth: MUST_USE_ATTRIBUTE,
    textAnchor: MUST_USE_ATTRIBUTE,
    transform: MUST_USE_ATTRIBUTE,
    version: MUST_USE_ATTRIBUTE,
    viewBox: MUST_USE_ATTRIBUTE,
    x1: MUST_USE_ATTRIBUTE,
    x2: MUST_USE_ATTRIBUTE,
    x: MUST_USE_ATTRIBUTE,
    y1: MUST_USE_ATTRIBUTE,
    y2: MUST_USE_ATTRIBUTE,
    y: MUST_USE_ATTRIBUTE
  },
  DOMAttributeNames: {
    clipPath: 'clip-path',
    fillOpacity: 'fill-opacity',
    fontFamily: 'font-family',
    fontSize: 'font-size',
    gradientTransform: 'gradientTransform',
    gradientUnits: 'gradientUnits',
    markerEnd: 'marker-end',
    markerMid: 'marker-mid',
    markerStart: 'marker-start',
    patternContentUnits: 'patternContentUnits',
    patternUnits: 'patternUnits',
    preserveAspectRatio: 'preserveAspectRatio',
    spreadMethod: 'spreadMethod',
    stopColor: 'stop-color',
    stopOpacity: 'stop-opacity',
    strokeDasharray: 'stroke-dasharray',
    strokeLinecap: 'stroke-linecap',
    strokeOpacity: 'stroke-opacity',
    strokeWidth: 'stroke-width',
    textAnchor: 'text-anchor',
    viewBox: 'viewBox'
  }
};

module.exports = SVGDOMPropertyConfig;

},{"10":10}],89:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SelectEventPlugin
 */

'use strict';

var EventConstants = _dereq_(15);
var EventPropagators = _dereq_(20);
var ReactInputSelection = _dereq_(65);
var SyntheticEvent = _dereq_(95);

var getActiveElement = _dereq_(121);
var isTextInputElement = _dereq_(138);
var keyOf = _dereq_(141);
var shallowEqual = _dereq_(150);

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  select: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSelect: null}),
      captured: keyOf({onSelectCapture: null})
    },
    dependencies: [
      topLevelTypes.topBlur,
      topLevelTypes.topContextMenu,
      topLevelTypes.topFocus,
      topLevelTypes.topKeyDown,
      topLevelTypes.topMouseDown,
      topLevelTypes.topMouseUp,
      topLevelTypes.topSelectionChange
    ]
  }
};

var activeElement = null;
var activeElementID = null;
var lastSelection = null;
var mouseDown = false;

/**
 * Get an object which is a unique representation of the current selection.
 *
 * The return value will not be consistent across nodes or browsers, but
 * two identical selections on the same node will return identical objects.
 *
 * @param {DOMElement} node
 * @param {object}
 */
function getSelection(node) {
  if ('selectionStart' in node &&
      ReactInputSelection.hasSelectionCapabilities(node)) {
    return {
      start: node.selectionStart,
      end: node.selectionEnd
    };
  } else if (window.getSelection) {
    var selection = window.getSelection();
    return {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset
    };
  } else if (document.selection) {
    var range = document.selection.createRange();
    return {
      parentElement: range.parentElement(),
      text: range.text,
      top: range.boundingTop,
      left: range.boundingLeft
    };
  }
}

/**
 * Poll selection to see whether it's changed.
 *
 * @param {object} nativeEvent
 * @return {?SyntheticEvent}
 */
function constructSelectEvent(nativeEvent) {
  // Ensure we have the right element, and that the user is not dragging a
  // selection (this matches native `select` event behavior). In HTML5, select
  // fires only on input and textarea thus if there's no focused element we
  // won't dispatch.
  if (mouseDown ||
      activeElement == null ||
      activeElement !== getActiveElement()) {
    return null;
  }

  // Only fire when selection has actually changed.
  var currentSelection = getSelection(activeElement);
  if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
    lastSelection = currentSelection;

    var syntheticEvent = SyntheticEvent.getPooled(
      eventTypes.select,
      activeElementID,
      nativeEvent
    );

    syntheticEvent.type = 'select';
    syntheticEvent.target = activeElement;

    EventPropagators.accumulateTwoPhaseDispatches(syntheticEvent);

    return syntheticEvent;
  }
}

/**
 * This plugin creates an `onSelect` event that normalizes select events
 * across form elements.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - contentEditable
 *
 * This differs from native browser implementations in the following ways:
 * - Fires on contentEditable fields as well as inputs.
 * - Fires for collapsed selection.
 * - Fires after user input.
 */
var SelectEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {

    switch (topLevelType) {
      // Track the input node that has focus.
      case topLevelTypes.topFocus:
        if (isTextInputElement(topLevelTarget) ||
            topLevelTarget.contentEditable === 'true') {
          activeElement = topLevelTarget;
          activeElementID = topLevelTargetID;
          lastSelection = null;
        }
        break;
      case topLevelTypes.topBlur:
        activeElement = null;
        activeElementID = null;
        lastSelection = null;
        break;

      // Don't fire the event while the user is dragging. This matches the
      // semantics of the native select event.
      case topLevelTypes.topMouseDown:
        mouseDown = true;
        break;
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topMouseUp:
        mouseDown = false;
        return constructSelectEvent(nativeEvent);

      // Chrome and IE fire non-standard event when selection is changed (and
      // sometimes when it hasn't).
      // Firefox doesn't support selectionchange, so check selection status
      // after each key entry. The selection changes after keydown and before
      // keyup, but we check on keydown as well in the case of holding down a
      // key, when multiple keydown events are fired but only one keyup is.
      case topLevelTypes.topSelectionChange:
      case topLevelTypes.topKeyDown:
      case topLevelTypes.topKeyUp:
        return constructSelectEvent(nativeEvent);
    }
  }
};

module.exports = SelectEventPlugin;

},{"121":121,"138":138,"141":141,"15":15,"150":150,"20":20,"65":65,"95":95}],90:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ServerReactRootIndex
 * @typechecks
 */

'use strict';

/**
 * Size of the reactRoot ID space. We generate random numbers for React root
 * IDs and if there's a collision the events and DOM update system will
 * get confused. In the future we need a way to generate GUIDs but for
 * now this will work on a smaller scale.
 */
var GLOBAL_MOUNT_POINT_MAX = Math.pow(2, 53);

var ServerReactRootIndex = {
  createReactRootIndex: function() {
    return Math.ceil(Math.random() * GLOBAL_MOUNT_POINT_MAX);
  }
};

module.exports = ServerReactRootIndex;

},{}],91:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SimpleEventPlugin
 */

'use strict';

var EventConstants = _dereq_(15);
var EventPluginUtils = _dereq_(19);
var EventPropagators = _dereq_(20);
var SyntheticClipboardEvent = _dereq_(92);
var SyntheticEvent = _dereq_(95);
var SyntheticFocusEvent = _dereq_(96);
var SyntheticKeyboardEvent = _dereq_(98);
var SyntheticMouseEvent = _dereq_(99);
var SyntheticDragEvent = _dereq_(94);
var SyntheticTouchEvent = _dereq_(100);
var SyntheticUIEvent = _dereq_(101);
var SyntheticWheelEvent = _dereq_(102);

var getEventCharCode = _dereq_(122);

var invariant = _dereq_(135);
var keyOf = _dereq_(141);
var warning = _dereq_(154);

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  blur: {
    phasedRegistrationNames: {
      bubbled: keyOf({onBlur: true}),
      captured: keyOf({onBlurCapture: true})
    }
  },
  click: {
    phasedRegistrationNames: {
      bubbled: keyOf({onClick: true}),
      captured: keyOf({onClickCapture: true})
    }
  },
  contextMenu: {
    phasedRegistrationNames: {
      bubbled: keyOf({onContextMenu: true}),
      captured: keyOf({onContextMenuCapture: true})
    }
  },
  copy: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCopy: true}),
      captured: keyOf({onCopyCapture: true})
    }
  },
  cut: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCut: true}),
      captured: keyOf({onCutCapture: true})
    }
  },
  doubleClick: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDoubleClick: true}),
      captured: keyOf({onDoubleClickCapture: true})
    }
  },
  drag: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDrag: true}),
      captured: keyOf({onDragCapture: true})
    }
  },
  dragEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragEnd: true}),
      captured: keyOf({onDragEndCapture: true})
    }
  },
  dragEnter: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragEnter: true}),
      captured: keyOf({onDragEnterCapture: true})
    }
  },
  dragExit: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragExit: true}),
      captured: keyOf({onDragExitCapture: true})
    }
  },
  dragLeave: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragLeave: true}),
      captured: keyOf({onDragLeaveCapture: true})
    }
  },
  dragOver: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragOver: true}),
      captured: keyOf({onDragOverCapture: true})
    }
  },
  dragStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragStart: true}),
      captured: keyOf({onDragStartCapture: true})
    }
  },
  drop: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDrop: true}),
      captured: keyOf({onDropCapture: true})
    }
  },
  focus: {
    phasedRegistrationNames: {
      bubbled: keyOf({onFocus: true}),
      captured: keyOf({onFocusCapture: true})
    }
  },
  input: {
    phasedRegistrationNames: {
      bubbled: keyOf({onInput: true}),
      captured: keyOf({onInputCapture: true})
    }
  },
  keyDown: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyDown: true}),
      captured: keyOf({onKeyDownCapture: true})
    }
  },
  keyPress: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyPress: true}),
      captured: keyOf({onKeyPressCapture: true})
    }
  },
  keyUp: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyUp: true}),
      captured: keyOf({onKeyUpCapture: true})
    }
  },
  load: {
    phasedRegistrationNames: {
      bubbled: keyOf({onLoad: true}),
      captured: keyOf({onLoadCapture: true})
    }
  },
  error: {
    phasedRegistrationNames: {
      bubbled: keyOf({onError: true}),
      captured: keyOf({onErrorCapture: true})
    }
  },
  // Note: We do not allow listening to mouseOver events. Instead, use the
  // onMouseEnter/onMouseLeave created by `EnterLeaveEventPlugin`.
  mouseDown: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseDown: true}),
      captured: keyOf({onMouseDownCapture: true})
    }
  },
  mouseMove: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseMove: true}),
      captured: keyOf({onMouseMoveCapture: true})
    }
  },
  mouseOut: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseOut: true}),
      captured: keyOf({onMouseOutCapture: true})
    }
  },
  mouseOver: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseOver: true}),
      captured: keyOf({onMouseOverCapture: true})
    }
  },
  mouseUp: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseUp: true}),
      captured: keyOf({onMouseUpCapture: true})
    }
  },
  paste: {
    phasedRegistrationNames: {
      bubbled: keyOf({onPaste: true}),
      captured: keyOf({onPasteCapture: true})
    }
  },
  reset: {
    phasedRegistrationNames: {
      bubbled: keyOf({onReset: true}),
      captured: keyOf({onResetCapture: true})
    }
  },
  scroll: {
    phasedRegistrationNames: {
      bubbled: keyOf({onScroll: true}),
      captured: keyOf({onScrollCapture: true})
    }
  },
  submit: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSubmit: true}),
      captured: keyOf({onSubmitCapture: true})
    }
  },
  touchCancel: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchCancel: true}),
      captured: keyOf({onTouchCancelCapture: true})
    }
  },
  touchEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchEnd: true}),
      captured: keyOf({onTouchEndCapture: true})
    }
  },
  touchMove: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchMove: true}),
      captured: keyOf({onTouchMoveCapture: true})
    }
  },
  touchStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchStart: true}),
      captured: keyOf({onTouchStartCapture: true})
    }
  },
  wheel: {
    phasedRegistrationNames: {
      bubbled: keyOf({onWheel: true}),
      captured: keyOf({onWheelCapture: true})
    }
  }
};

var topLevelEventsToDispatchConfig = {
  topBlur:        eventTypes.blur,
  topClick:       eventTypes.click,
  topContextMenu: eventTypes.contextMenu,
  topCopy:        eventTypes.copy,
  topCut:         eventTypes.cut,
  topDoubleClick: eventTypes.doubleClick,
  topDrag:        eventTypes.drag,
  topDragEnd:     eventTypes.dragEnd,
  topDragEnter:   eventTypes.dragEnter,
  topDragExit:    eventTypes.dragExit,
  topDragLeave:   eventTypes.dragLeave,
  topDragOver:    eventTypes.dragOver,
  topDragStart:   eventTypes.dragStart,
  topDrop:        eventTypes.drop,
  topError:       eventTypes.error,
  topFocus:       eventTypes.focus,
  topInput:       eventTypes.input,
  topKeyDown:     eventTypes.keyDown,
  topKeyPress:    eventTypes.keyPress,
  topKeyUp:       eventTypes.keyUp,
  topLoad:        eventTypes.load,
  topMouseDown:   eventTypes.mouseDown,
  topMouseMove:   eventTypes.mouseMove,
  topMouseOut:    eventTypes.mouseOut,
  topMouseOver:   eventTypes.mouseOver,
  topMouseUp:     eventTypes.mouseUp,
  topPaste:       eventTypes.paste,
  topReset:       eventTypes.reset,
  topScroll:      eventTypes.scroll,
  topSubmit:      eventTypes.submit,
  topTouchCancel: eventTypes.touchCancel,
  topTouchEnd:    eventTypes.touchEnd,
  topTouchMove:   eventTypes.touchMove,
  topTouchStart:  eventTypes.touchStart,
  topWheel:       eventTypes.wheel
};

for (var type in topLevelEventsToDispatchConfig) {
  topLevelEventsToDispatchConfig[type].dependencies = [type];
}

var SimpleEventPlugin = {

  eventTypes: eventTypes,

  /**
   * Same as the default implementation, except cancels the event when return
   * value is false. This behavior will be disabled in a future release.
   *
   * @param {object} Event to be dispatched.
   * @param {function} Application-level callback.
   * @param {string} domID DOM ID to pass to the callback.
   */
  executeDispatch: function(event, listener, domID) {
    var returnValue = EventPluginUtils.executeDispatch(event, listener, domID);

    ("production" !== "development" ? warning(
      typeof returnValue !== 'boolean',
      'Returning `false` from an event handler is deprecated and will be ' +
      'ignored in a future release. Instead, manually call ' +
      'e.stopPropagation() or e.preventDefault(), as appropriate.'
    ) : null);

    if (returnValue === false) {
      event.stopPropagation();
      event.preventDefault();
    }
  },

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    var dispatchConfig = topLevelEventsToDispatchConfig[topLevelType];
    if (!dispatchConfig) {
      return null;
    }
    var EventConstructor;
    switch (topLevelType) {
      case topLevelTypes.topInput:
      case topLevelTypes.topLoad:
      case topLevelTypes.topError:
      case topLevelTypes.topReset:
      case topLevelTypes.topSubmit:
        // HTML Events
        // @see http://www.w3.org/TR/html5/index.html#events-0
        EventConstructor = SyntheticEvent;
        break;
      case topLevelTypes.topKeyPress:
        // FireFox creates a keypress event for function keys too. This removes
        // the unwanted keypress events. Enter is however both printable and
        // non-printable. One would expect Tab to be as well (but it isn't).
        if (getEventCharCode(nativeEvent) === 0) {
          return null;
        }
        /* falls through */
      case topLevelTypes.topKeyDown:
      case topLevelTypes.topKeyUp:
        EventConstructor = SyntheticKeyboardEvent;
        break;
      case topLevelTypes.topBlur:
      case topLevelTypes.topFocus:
        EventConstructor = SyntheticFocusEvent;
        break;
      case topLevelTypes.topClick:
        // Firefox creates a click event on right mouse clicks. This removes the
        // unwanted click events.
        if (nativeEvent.button === 2) {
          return null;
        }
        /* falls through */
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topDoubleClick:
      case topLevelTypes.topMouseDown:
      case topLevelTypes.topMouseMove:
      case topLevelTypes.topMouseOut:
      case topLevelTypes.topMouseOver:
      case topLevelTypes.topMouseUp:
        EventConstructor = SyntheticMouseEvent;
        break;
      case topLevelTypes.topDrag:
      case topLevelTypes.topDragEnd:
      case topLevelTypes.topDragEnter:
      case topLevelTypes.topDragExit:
      case topLevelTypes.topDragLeave:
      case topLevelTypes.topDragOver:
      case topLevelTypes.topDragStart:
      case topLevelTypes.topDrop:
        EventConstructor = SyntheticDragEvent;
        break;
      case topLevelTypes.topTouchCancel:
      case topLevelTypes.topTouchEnd:
      case topLevelTypes.topTouchMove:
      case topLevelTypes.topTouchStart:
        EventConstructor = SyntheticTouchEvent;
        break;
      case topLevelTypes.topScroll:
        EventConstructor = SyntheticUIEvent;
        break;
      case topLevelTypes.topWheel:
        EventConstructor = SyntheticWheelEvent;
        break;
      case topLevelTypes.topCopy:
      case topLevelTypes.topCut:
      case topLevelTypes.topPaste:
        EventConstructor = SyntheticClipboardEvent;
        break;
    }
    ("production" !== "development" ? invariant(
      EventConstructor,
      'SimpleEventPlugin: Unhandled event type, `%s`.',
      topLevelType
    ) : invariant(EventConstructor));
    var event = EventConstructor.getPooled(
      dispatchConfig,
      topLevelTargetID,
      nativeEvent
    );
    EventPropagators.accumulateTwoPhaseDispatches(event);
    return event;
  }

};

module.exports = SimpleEventPlugin;

},{"100":100,"101":101,"102":102,"122":122,"135":135,"141":141,"15":15,"154":154,"19":19,"20":20,"92":92,"94":94,"95":95,"96":96,"98":98,"99":99}],92:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticClipboardEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticEvent = _dereq_(95);

/**
 * @interface Event
 * @see http://www.w3.org/TR/clipboard-apis/
 */
var ClipboardEventInterface = {
  clipboardData: function(event) {
    return (
      'clipboardData' in event ?
        event.clipboardData :
        window.clipboardData
    );
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticClipboardEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticEvent.augmentClass(SyntheticClipboardEvent, ClipboardEventInterface);

module.exports = SyntheticClipboardEvent;

},{"95":95}],93:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticCompositionEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticEvent = _dereq_(95);

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#events-compositionevents
 */
var CompositionEventInterface = {
  data: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticCompositionEvent(
  dispatchConfig,
  dispatchMarker,
  nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticEvent.augmentClass(
  SyntheticCompositionEvent,
  CompositionEventInterface
);

module.exports = SyntheticCompositionEvent;

},{"95":95}],94:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticDragEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticMouseEvent = _dereq_(99);

/**
 * @interface DragEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var DragEventInterface = {
  dataTransfer: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticDragEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticMouseEvent.augmentClass(SyntheticDragEvent, DragEventInterface);

module.exports = SyntheticDragEvent;

},{"99":99}],95:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticEvent
 * @typechecks static-only
 */

'use strict';

var PooledClass = _dereq_(28);

var assign = _dereq_(27);
var emptyFunction = _dereq_(114);
var getEventTarget = _dereq_(125);

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var EventInterface = {
  type: null,
  target: getEventTarget,
  // currentTarget is set when dispatching; no use in copying it here
  currentTarget: emptyFunction.thatReturnsNull,
  eventPhase: null,
  bubbles: null,
  cancelable: null,
  timeStamp: function(event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: null,
  isTrusted: null
};

/**
 * Synthetic events are dispatched by event plugins, typically in response to a
 * top-level event delegation handler.
 *
 * These systems should generally use pooling to reduce the frequency of garbage
 * collection. The system should check `isPersistent` to determine whether the
 * event should be released into the pool after being dispatched. Users that
 * need a persisted event should invoke `persist`.
 *
 * Synthetic events (and subclasses) implement the DOM Level 3 Events API by
 * normalizing browser quirks. Subclasses do not necessarily have to implement a
 * DOM interface; custom application-specific events can also subclass this.
 *
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 */
function SyntheticEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  this.dispatchConfig = dispatchConfig;
  this.dispatchMarker = dispatchMarker;
  this.nativeEvent = nativeEvent;

  var Interface = this.constructor.Interface;
  for (var propName in Interface) {
    if (!Interface.hasOwnProperty(propName)) {
      continue;
    }
    var normalize = Interface[propName];
    if (normalize) {
      this[propName] = normalize(nativeEvent);
    } else {
      this[propName] = nativeEvent[propName];
    }
  }

  var defaultPrevented = nativeEvent.defaultPrevented != null ?
    nativeEvent.defaultPrevented :
    nativeEvent.returnValue === false;
  if (defaultPrevented) {
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  } else {
    this.isDefaultPrevented = emptyFunction.thatReturnsFalse;
  }
  this.isPropagationStopped = emptyFunction.thatReturnsFalse;
}

assign(SyntheticEvent.prototype, {

  preventDefault: function() {
    this.defaultPrevented = true;
    var event = this.nativeEvent;
    if (event.preventDefault) {
      event.preventDefault();
    } else {
      event.returnValue = false;
    }
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  },

  stopPropagation: function() {
    var event = this.nativeEvent;
    if (event.stopPropagation) {
      event.stopPropagation();
    } else {
      event.cancelBubble = true;
    }
    this.isPropagationStopped = emptyFunction.thatReturnsTrue;
  },

  /**
   * We release all dispatched `SyntheticEvent`s after each event loop, adding
   * them back into the pool. This allows a way to hold onto a reference that
   * won't be added back into the pool.
   */
  persist: function() {
    this.isPersistent = emptyFunction.thatReturnsTrue;
  },

  /**
   * Checks if this event should be released back into the pool.
   *
   * @return {boolean} True if this should not be released, false otherwise.
   */
  isPersistent: emptyFunction.thatReturnsFalse,

  /**
   * `PooledClass` looks for `destructor` on each instance it releases.
   */
  destructor: function() {
    var Interface = this.constructor.Interface;
    for (var propName in Interface) {
      this[propName] = null;
    }
    this.dispatchConfig = null;
    this.dispatchMarker = null;
    this.nativeEvent = null;
  }

});

SyntheticEvent.Interface = EventInterface;

/**
 * Helper to reduce boilerplate when creating subclasses.
 *
 * @param {function} Class
 * @param {?object} Interface
 */
SyntheticEvent.augmentClass = function(Class, Interface) {
  var Super = this;

  var prototype = Object.create(Super.prototype);
  assign(prototype, Class.prototype);
  Class.prototype = prototype;
  Class.prototype.constructor = Class;

  Class.Interface = assign({}, Super.Interface, Interface);
  Class.augmentClass = Super.augmentClass;

  PooledClass.addPoolingTo(Class, PooledClass.threeArgumentPooler);
};

PooledClass.addPoolingTo(SyntheticEvent, PooledClass.threeArgumentPooler);

module.exports = SyntheticEvent;

},{"114":114,"125":125,"27":27,"28":28}],96:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticFocusEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticUIEvent = _dereq_(101);

/**
 * @interface FocusEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var FocusEventInterface = {
  relatedTarget: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticFocusEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticUIEvent.augmentClass(SyntheticFocusEvent, FocusEventInterface);

module.exports = SyntheticFocusEvent;

},{"101":101}],97:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticInputEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticEvent = _dereq_(95);

/**
 * @interface Event
 * @see http://www.w3.org/TR/2013/WD-DOM-Level-3-Events-20131105
 *      /#events-inputevents
 */
var InputEventInterface = {
  data: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticInputEvent(
  dispatchConfig,
  dispatchMarker,
  nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticEvent.augmentClass(
  SyntheticInputEvent,
  InputEventInterface
);

module.exports = SyntheticInputEvent;

},{"95":95}],98:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticKeyboardEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticUIEvent = _dereq_(101);

var getEventCharCode = _dereq_(122);
var getEventKey = _dereq_(123);
var getEventModifierState = _dereq_(124);

/**
 * @interface KeyboardEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var KeyboardEventInterface = {
  key: getEventKey,
  location: null,
  ctrlKey: null,
  shiftKey: null,
  altKey: null,
  metaKey: null,
  repeat: null,
  locale: null,
  getModifierState: getEventModifierState,
  // Legacy Interface
  charCode: function(event) {
    // `charCode` is the result of a KeyPress event and represents the value of
    // the actual printable character.

    // KeyPress is deprecated, but its replacement is not yet final and not
    // implemented in any major browser. Only KeyPress has charCode.
    if (event.type === 'keypress') {
      return getEventCharCode(event);
    }
    return 0;
  },
  keyCode: function(event) {
    // `keyCode` is the result of a KeyDown/Up event and represents the value of
    // physical keyboard key.

    // The actual meaning of the value depends on the users' keyboard layout
    // which cannot be detected. Assuming that it is a US keyboard layout
    // provides a surprisingly accurate mapping for US and European users.
    // Due to this, it is left to the user to implement at this time.
    if (event.type === 'keydown' || event.type === 'keyup') {
      return event.keyCode;
    }
    return 0;
  },
  which: function(event) {
    // `which` is an alias for either `keyCode` or `charCode` depending on the
    // type of the event.
    if (event.type === 'keypress') {
      return getEventCharCode(event);
    }
    if (event.type === 'keydown' || event.type === 'keyup') {
      return event.keyCode;
    }
    return 0;
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticKeyboardEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticUIEvent.augmentClass(SyntheticKeyboardEvent, KeyboardEventInterface);

module.exports = SyntheticKeyboardEvent;

},{"101":101,"122":122,"123":123,"124":124}],99:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticMouseEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticUIEvent = _dereq_(101);
var ViewportMetrics = _dereq_(104);

var getEventModifierState = _dereq_(124);

/**
 * @interface MouseEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var MouseEventInterface = {
  screenX: null,
  screenY: null,
  clientX: null,
  clientY: null,
  ctrlKey: null,
  shiftKey: null,
  altKey: null,
  metaKey: null,
  getModifierState: getEventModifierState,
  button: function(event) {
    // Webkit, Firefox, IE9+
    // which:  1 2 3
    // button: 0 1 2 (standard)
    var button = event.button;
    if ('which' in event) {
      return button;
    }
    // IE<9
    // which:  undefined
    // button: 0 0 0
    // button: 1 4 2 (onmouseup)
    return button === 2 ? 2 : button === 4 ? 1 : 0;
  },
  buttons: null,
  relatedTarget: function(event) {
    return event.relatedTarget || (
      ((event.fromElement === event.srcElement ? event.toElement : event.fromElement))
    );
  },
  // "Proprietary" Interface.
  pageX: function(event) {
    return 'pageX' in event ?
      event.pageX :
      event.clientX + ViewportMetrics.currentScrollLeft;
  },
  pageY: function(event) {
    return 'pageY' in event ?
      event.pageY :
      event.clientY + ViewportMetrics.currentScrollTop;
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticMouseEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticUIEvent.augmentClass(SyntheticMouseEvent, MouseEventInterface);

module.exports = SyntheticMouseEvent;

},{"101":101,"104":104,"124":124}],100:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticTouchEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticUIEvent = _dereq_(101);

var getEventModifierState = _dereq_(124);

/**
 * @interface TouchEvent
 * @see http://www.w3.org/TR/touch-events/
 */
var TouchEventInterface = {
  touches: null,
  targetTouches: null,
  changedTouches: null,
  altKey: null,
  metaKey: null,
  ctrlKey: null,
  shiftKey: null,
  getModifierState: getEventModifierState
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticTouchEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticUIEvent.augmentClass(SyntheticTouchEvent, TouchEventInterface);

module.exports = SyntheticTouchEvent;

},{"101":101,"124":124}],101:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticUIEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticEvent = _dereq_(95);

var getEventTarget = _dereq_(125);

/**
 * @interface UIEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var UIEventInterface = {
  view: function(event) {
    if (event.view) {
      return event.view;
    }

    var target = getEventTarget(event);
    if (target != null && target.window === target) {
      // target is a window object
      return target;
    }

    var doc = target.ownerDocument;
    // TODO: Figure out why `ownerDocument` is sometimes undefined in IE8.
    if (doc) {
      return doc.defaultView || doc.parentWindow;
    } else {
      return window;
    }
  },
  detail: function(event) {
    return event.detail || 0;
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticEvent}
 */
function SyntheticUIEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticEvent.augmentClass(SyntheticUIEvent, UIEventInterface);

module.exports = SyntheticUIEvent;

},{"125":125,"95":95}],102:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule SyntheticWheelEvent
 * @typechecks static-only
 */

'use strict';

var SyntheticMouseEvent = _dereq_(99);

/**
 * @interface WheelEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var WheelEventInterface = {
  deltaX: function(event) {
    return (
      'deltaX' in event ? event.deltaX :
      // Fallback to `wheelDeltaX` for Webkit and normalize (right is positive).
      'wheelDeltaX' in event ? -event.wheelDeltaX : 0
    );
  },
  deltaY: function(event) {
    return (
      'deltaY' in event ? event.deltaY :
      // Fallback to `wheelDeltaY` for Webkit and normalize (down is positive).
      'wheelDeltaY' in event ? -event.wheelDeltaY :
      // Fallback to `wheelDelta` for IE<9 and normalize (down is positive).
      'wheelDelta' in event ? -event.wheelDelta : 0
    );
  },
  deltaZ: null,

  // Browsers without "deltaMode" is reporting in raw wheel delta where one
  // notch on the scroll is always +/- 120, roughly equivalent to pixels.
  // A good approximation of DOM_DELTA_LINE (1) is 5% of viewport size or
  // ~40 pixels, for DOM_DELTA_SCREEN (2) it is 87.5% of viewport size.
  deltaMode: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticMouseEvent}
 */
function SyntheticWheelEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticMouseEvent.augmentClass(SyntheticWheelEvent, WheelEventInterface);

module.exports = SyntheticWheelEvent;

},{"99":99}],103:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Transaction
 */

'use strict';

var invariant = _dereq_(135);

/**
 * `Transaction` creates a black box that is able to wrap any method such that
 * certain invariants are maintained before and after the method is invoked
 * (Even if an exception is thrown while invoking the wrapped method). Whoever
 * instantiates a transaction can provide enforcers of the invariants at
 * creation time. The `Transaction` class itself will supply one additional
 * automatic invariant for you - the invariant that any transaction instance
 * should not be run while it is already being run. You would typically create a
 * single instance of a `Transaction` for reuse multiple times, that potentially
 * is used to wrap several different methods. Wrappers are extremely simple -
 * they only require implementing two methods.
 *
 * <pre>
 *                       wrappers (injected at creation time)
 *                                      +        +
 *                                      |        |
 *                    +-----------------|--------|--------------+
 *                    |                 v        |              |
 *                    |      +---------------+   |              |
 *                    |   +--|    wrapper1   |---|----+         |
 *                    |   |  +---------------+   v    |         |
 *                    |   |          +-------------+  |         |
 *                    |   |     +----|   wrapper2  |--------+   |
 *                    |   |     |    +-------------+  |     |   |
 *                    |   |     |                     |     |   |
 *                    |   v     v                     v     v   | wrapper
 *                    | +---+ +---+   +---------+   +---+ +---+ | invariants
 * perform(anyMethod) | |   | |   |   |         |   |   | |   | | maintained
 * +----------------->|-|---|-|---|-->|anyMethod|---|---|-|---|-|-------->
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | +---+ +---+   +---------+   +---+ +---+ |
 *                    |  initialize                    close    |
 *                    +-----------------------------------------+
 * </pre>
 *
 * Use cases:
 * - Preserving the input selection ranges before/after reconciliation.
 *   Restoring selection even in the event of an unexpected error.
 * - Deactivating events while rearranging the DOM, preventing blurs/focuses,
 *   while guaranteeing that afterwards, the event system is reactivated.
 * - Flushing a queue of collected DOM mutations to the main UI thread after a
 *   reconciliation takes place in a worker thread.
 * - Invoking any collected `componentDidUpdate` callbacks after rendering new
 *   content.
 * - (Future use case): Wrapping particular flushes of the `ReactWorker` queue
 *   to preserve the `scrollTop` (an automatic scroll aware DOM).
 * - (Future use case): Layout calculations before and after DOM updates.
 *
 * Transactional plugin API:
 * - A module that has an `initialize` method that returns any precomputation.
 * - and a `close` method that accepts the precomputation. `close` is invoked
 *   when the wrapped process is completed, or has failed.
 *
 * @param {Array<TransactionalWrapper>} transactionWrapper Wrapper modules
 * that implement `initialize` and `close`.
 * @return {Transaction} Single transaction for reuse in thread.
 *
 * @class Transaction
 */
var Mixin = {
  /**
   * Sets up this instance so that it is prepared for collecting metrics. Does
   * so such that this setup method may be used on an instance that is already
   * initialized, in a way that does not consume additional memory upon reuse.
   * That can be useful if you decide to make your subclass of this mixin a
   * "PooledClass".
   */
  reinitializeTransaction: function() {
    this.transactionWrappers = this.getTransactionWrappers();
    if (!this.wrapperInitData) {
      this.wrapperInitData = [];
    } else {
      this.wrapperInitData.length = 0;
    }
    this._isInTransaction = false;
  },

  _isInTransaction: false,

  /**
   * @abstract
   * @return {Array<TransactionWrapper>} Array of transaction wrappers.
   */
  getTransactionWrappers: null,

  isInTransaction: function() {
    return !!this._isInTransaction;
  },

  /**
   * Executes the function within a safety window. Use this for the top level
   * methods that result in large amounts of computation/mutations that would
   * need to be safety checked.
   *
   * @param {function} method Member of scope to call.
   * @param {Object} scope Scope to invoke from.
   * @param {Object?=} args... Arguments to pass to the method (optional).
   *                           Helps prevent need to bind in many cases.
   * @return Return value from `method`.
   */
  perform: function(method, scope, a, b, c, d, e, f) {
    ("production" !== "development" ? invariant(
      !this.isInTransaction(),
      'Transaction.perform(...): Cannot initialize a transaction when there ' +
      'is already an outstanding transaction.'
    ) : invariant(!this.isInTransaction()));
    var errorThrown;
    var ret;
    try {
      this._isInTransaction = true;
      // Catching errors makes debugging more difficult, so we start with
      // errorThrown set to true before setting it to false after calling
      // close -- if it's still set to true in the finally block, it means
      // one of these calls threw.
      errorThrown = true;
      this.initializeAll(0);
      ret = method.call(scope, a, b, c, d, e, f);
      errorThrown = false;
    } finally {
      try {
        if (errorThrown) {
          // If `method` throws, prefer to show that stack trace over any thrown
          // by invoking `closeAll`.
          try {
            this.closeAll(0);
          } catch (err) {
          }
        } else {
          // Since `method` didn't throw, we don't want to silence the exception
          // here.
          this.closeAll(0);
        }
      } finally {
        this._isInTransaction = false;
      }
    }
    return ret;
  },

  initializeAll: function(startIndex) {
    var transactionWrappers = this.transactionWrappers;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      try {
        // Catching errors makes debugging more difficult, so we start with the
        // OBSERVED_ERROR state before overwriting it with the real return value
        // of initialize -- if it's still set to OBSERVED_ERROR in the finally
        // block, it means wrapper.initialize threw.
        this.wrapperInitData[i] = Transaction.OBSERVED_ERROR;
        this.wrapperInitData[i] = wrapper.initialize ?
          wrapper.initialize.call(this) :
          null;
      } finally {
        if (this.wrapperInitData[i] === Transaction.OBSERVED_ERROR) {
          // The initializer for wrapper i threw an error; initialize the
          // remaining wrappers but silence any exceptions from them to ensure
          // that the first error is the one to bubble up.
          try {
            this.initializeAll(i + 1);
          } catch (err) {
          }
        }
      }
    }
  },

  /**
   * Invokes each of `this.transactionWrappers.close[i]` functions, passing into
   * them the respective return values of `this.transactionWrappers.init[i]`
   * (`close`rs that correspond to initializers that failed will not be
   * invoked).
   */
  closeAll: function(startIndex) {
    ("production" !== "development" ? invariant(
      this.isInTransaction(),
      'Transaction.closeAll(): Cannot close transaction when none are open.'
    ) : invariant(this.isInTransaction()));
    var transactionWrappers = this.transactionWrappers;
    for (var i = startIndex; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      var initData = this.wrapperInitData[i];
      var errorThrown;
      try {
        // Catching errors makes debugging more difficult, so we start with
        // errorThrown set to true before setting it to false after calling
        // close -- if it's still set to true in the finally block, it means
        // wrapper.close threw.
        errorThrown = true;
        if (initData !== Transaction.OBSERVED_ERROR && wrapper.close) {
          wrapper.close.call(this, initData);
        }
        errorThrown = false;
      } finally {
        if (errorThrown) {
          // The closer for wrapper i threw an error; close the remaining
          // wrappers but silence any exceptions from them to ensure that the
          // first error is the one to bubble up.
          try {
            this.closeAll(i + 1);
          } catch (e) {
          }
        }
      }
    }
    this.wrapperInitData.length = 0;
  }
};

var Transaction = {

  Mixin: Mixin,

  /**
   * Token to look for to determine if an error occured.
   */
  OBSERVED_ERROR: {}

};

module.exports = Transaction;

},{"135":135}],104:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ViewportMetrics
 */

'use strict';

var ViewportMetrics = {

  currentScrollLeft: 0,

  currentScrollTop: 0,

  refreshScrollValues: function(scrollPosition) {
    ViewportMetrics.currentScrollLeft = scrollPosition.x;
    ViewportMetrics.currentScrollTop = scrollPosition.y;
  }

};

module.exports = ViewportMetrics;

},{}],105:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule accumulateInto
 */

'use strict';

var invariant = _dereq_(135);

/**
 *
 * Accumulates items that must not be null or undefined into the first one. This
 * is used to conserve memory by avoiding array allocations, and thus sacrifices
 * API cleanness. Since `current` can be null before being passed in and not
 * null after this function, make sure to assign it back to `current`:
 *
 * `a = accumulateInto(a, b);`
 *
 * This API should be sparingly used. Try `accumulate` for something cleaner.
 *
 * @return {*|array<*>} An accumulation of items.
 */

function accumulateInto(current, next) {
  ("production" !== "development" ? invariant(
    next != null,
    'accumulateInto(...): Accumulated items must not be null or undefined.'
  ) : invariant(next != null));
  if (current == null) {
    return next;
  }

  // Both are not empty. Warning: Never call x.concat(y) when you are not
  // certain that x is an Array (x could be a string with concat method).
  var currentIsArray = Array.isArray(current);
  var nextIsArray = Array.isArray(next);

  if (currentIsArray && nextIsArray) {
    current.push.apply(current, next);
    return current;
  }

  if (currentIsArray) {
    current.push(next);
    return current;
  }

  if (nextIsArray) {
    // A bit too dangerous to mutate `next`.
    return [current].concat(next);
  }

  return [current, next];
}

module.exports = accumulateInto;

},{"135":135}],106:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule adler32
 */

/* jslint bitwise:true */

'use strict';

var MOD = 65521;

// This is a clean-room implementation of adler32 designed for detecting
// if markup is not what we expect it to be. It does not need to be
// cryptographically strong, only reasonably good at detecting if markup
// generated on the server is different than that on the client.
function adler32(data) {
  var a = 1;
  var b = 0;
  for (var i = 0; i < data.length; i++) {
    a = (a + data.charCodeAt(i)) % MOD;
    b = (b + a) % MOD;
  }
  return a | (b << 16);
}

module.exports = adler32;

},{}],107:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule camelize
 * @typechecks
 */

var _hyphenPattern = /-(.)/g;

/**
 * Camelcases a hyphenated string, for example:
 *
 *   > camelize('background-color')
 *   < "backgroundColor"
 *
 * @param {string} string
 * @return {string}
 */
function camelize(string) {
  return string.replace(_hyphenPattern, function(_, character) {
    return character.toUpperCase();
  });
}

module.exports = camelize;

},{}],108:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule camelizeStyleName
 * @typechecks
 */

"use strict";

var camelize = _dereq_(107);

var msPattern = /^-ms-/;

/**
 * Camelcases a hyphenated CSS property name, for example:
 *
 *   > camelizeStyleName('background-color')
 *   < "backgroundColor"
 *   > camelizeStyleName('-moz-transition')
 *   < "MozTransition"
 *   > camelizeStyleName('-ms-transition')
 *   < "msTransition"
 *
 * As Andi Smith suggests
 * (http://www.andismith.com/blog/2012/02/modernizr-prefixed/), an `-ms` prefix
 * is converted to lowercase `ms`.
 *
 * @param {string} string
 * @return {string}
 */
function camelizeStyleName(string) {
  return camelize(string.replace(msPattern, 'ms-'));
}

module.exports = camelizeStyleName;

},{"107":107}],109:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule containsNode
 * @typechecks
 */

var isTextNode = _dereq_(139);

/*jslint bitwise:true */

/**
 * Checks if a given DOM node contains or is another DOM node.
 *
 * @param {?DOMNode} outerNode Outer DOM node.
 * @param {?DOMNode} innerNode Inner DOM node.
 * @return {boolean} True if `outerNode` contains or is `innerNode`.
 */
function containsNode(outerNode, innerNode) {
  if (!outerNode || !innerNode) {
    return false;
  } else if (outerNode === innerNode) {
    return true;
  } else if (isTextNode(outerNode)) {
    return false;
  } else if (isTextNode(innerNode)) {
    return containsNode(outerNode, innerNode.parentNode);
  } else if (outerNode.contains) {
    return outerNode.contains(innerNode);
  } else if (outerNode.compareDocumentPosition) {
    return !!(outerNode.compareDocumentPosition(innerNode) & 16);
  } else {
    return false;
  }
}

module.exports = containsNode;

},{"139":139}],110:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule createArrayFromMixed
 * @typechecks
 */

var toArray = _dereq_(152);

/**
 * Perform a heuristic test to determine if an object is "array-like".
 *
 *   A monk asked Joshu, a Zen master, "Has a dog Buddha nature?"
 *   Joshu replied: "Mu."
 *
 * This function determines if its argument has "array nature": it returns
 * true if the argument is an actual array, an `arguments' object, or an
 * HTMLCollection (e.g. node.childNodes or node.getElementsByTagName()).
 *
 * It will return false for other array-like objects like Filelist.
 *
 * @param {*} obj
 * @return {boolean}
 */
function hasArrayNature(obj) {
  return (
    // not null/false
    !!obj &&
    // arrays are objects, NodeLists are functions in Safari
    (typeof obj == 'object' || typeof obj == 'function') &&
    // quacks like an array
    ('length' in obj) &&
    // not window
    !('setInterval' in obj) &&
    // no DOM node should be considered an array-like
    // a 'select' element has 'length' and 'item' properties on IE8
    (typeof obj.nodeType != 'number') &&
    (
      // a real array
      (// HTMLCollection/NodeList
      (Array.isArray(obj) ||
      // arguments
      ('callee' in obj) || 'item' in obj))
    )
  );
}

/**
 * Ensure that the argument is an array by wrapping it in an array if it is not.
 * Creates a copy of the argument if it is already an array.
 *
 * This is mostly useful idiomatically:
 *
 *   var createArrayFromMixed = require('createArrayFromMixed');
 *
 *   function takesOneOrMoreThings(things) {
 *     things = createArrayFromMixed(things);
 *     ...
 *   }
 *
 * This allows you to treat `things' as an array, but accept scalars in the API.
 *
 * If you need to convert an array-like object, like `arguments`, into an array
 * use toArray instead.
 *
 * @param {*} obj
 * @return {array}
 */
function createArrayFromMixed(obj) {
  if (!hasArrayNature(obj)) {
    return [obj];
  } else if (Array.isArray(obj)) {
    return obj.slice();
  } else {
    return toArray(obj);
  }
}

module.exports = createArrayFromMixed;

},{"152":152}],111:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule createFullPageComponent
 * @typechecks
 */

'use strict';

// Defeat circular references by requiring this directly.
var ReactClass = _dereq_(33);
var ReactElement = _dereq_(57);

var invariant = _dereq_(135);

/**
 * Create a component that will throw an exception when unmounted.
 *
 * Components like <html> <head> and <body> can't be removed or added
 * easily in a cross-browser way, however it's valuable to be able to
 * take advantage of React's reconciliation for styling and <title>
 * management. So we just document it and throw in dangerous cases.
 *
 * @param {string} tag The tag to wrap
 * @return {function} convenience constructor of new component
 */
function createFullPageComponent(tag) {
  var elementFactory = ReactElement.createFactory(tag);

  var FullPageComponent = ReactClass.createClass({
    tagName: tag.toUpperCase(),
    displayName: 'ReactFullPageComponent' + tag,

    componentWillUnmount: function() {
      ("production" !== "development" ? invariant(
        false,
        '%s tried to unmount. Because of cross-browser quirks it is ' +
        'impossible to unmount some top-level components (eg <html>, <head>, ' +
        'and <body>) reliably and efficiently. To fix this, have a single ' +
        'top-level component that never unmounts render these elements.',
        this.constructor.displayName
      ) : invariant(false));
    },

    render: function() {
      return elementFactory(this.props);
    }
  });

  return FullPageComponent;
}

module.exports = createFullPageComponent;

},{"135":135,"33":33,"57":57}],112:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule createNodesFromMarkup
 * @typechecks
 */

/*jslint evil: true, sub: true */

var ExecutionEnvironment = _dereq_(21);

var createArrayFromMixed = _dereq_(110);
var getMarkupWrap = _dereq_(127);
var invariant = _dereq_(135);

/**
 * Dummy container used to render all markup.
 */
var dummyNode =
  ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;

/**
 * Pattern used by `getNodeName`.
 */
var nodeNamePattern = /^\s*<(\w+)/;

/**
 * Extracts the `nodeName` of the first element in a string of markup.
 *
 * @param {string} markup String of markup.
 * @return {?string} Node name of the supplied markup.
 */
function getNodeName(markup) {
  var nodeNameMatch = markup.match(nodeNamePattern);
  return nodeNameMatch && nodeNameMatch[1].toLowerCase();
}

/**
 * Creates an array containing the nodes rendered from the supplied markup. The
 * optionally supplied `handleScript` function will be invoked once for each
 * <script> element that is rendered. If no `handleScript` function is supplied,
 * an exception is thrown if any <script> elements are rendered.
 *
 * @param {string} markup A string of valid HTML markup.
 * @param {?function} handleScript Invoked once for each rendered <script>.
 * @return {array<DOMElement|DOMTextNode>} An array of rendered nodes.
 */
function createNodesFromMarkup(markup, handleScript) {
  var node = dummyNode;
  ("production" !== "development" ? invariant(!!dummyNode, 'createNodesFromMarkup dummy not initialized') : invariant(!!dummyNode));
  var nodeName = getNodeName(markup);

  var wrap = nodeName && getMarkupWrap(nodeName);
  if (wrap) {
    node.innerHTML = wrap[1] + markup + wrap[2];

    var wrapDepth = wrap[0];
    while (wrapDepth--) {
      node = node.lastChild;
    }
  } else {
    node.innerHTML = markup;
  }

  var scripts = node.getElementsByTagName('script');
  if (scripts.length) {
    ("production" !== "development" ? invariant(
      handleScript,
      'createNodesFromMarkup(...): Unexpected <script> element rendered.'
    ) : invariant(handleScript));
    createArrayFromMixed(scripts).forEach(handleScript);
  }

  var nodes = createArrayFromMixed(node.childNodes);
  while (node.lastChild) {
    node.removeChild(node.lastChild);
  }
  return nodes;
}

module.exports = createNodesFromMarkup;

},{"110":110,"127":127,"135":135,"21":21}],113:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule dangerousStyleValue
 * @typechecks static-only
 */

'use strict';

var CSSProperty = _dereq_(4);

var isUnitlessNumber = CSSProperty.isUnitlessNumber;

/**
 * Convert a value into the proper css writable value. The style name `name`
 * should be logical (no hyphens), as specified
 * in `CSSProperty.isUnitlessNumber`.
 *
 * @param {string} name CSS property name such as `topMargin`.
 * @param {*} value CSS property value such as `10px`.
 * @return {string} Normalized style value with dimensions applied.
 */
function dangerousStyleValue(name, value) {
  // Note that we've removed escapeTextForBrowser() calls here since the
  // whole string will be escaped when the attribute is injected into
  // the markup. If you provide unsafe user data here they can inject
  // arbitrary CSS which may be problematic (I couldn't repro this):
  // https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet
  // http://www.thespanner.co.uk/2007/11/26/ultimate-xss-css-injection/
  // This is not an XSS hole but instead a potential CSS injection issue
  // which has lead to a greater discussion about how we're going to
  // trust URLs moving forward. See #2115901

  var isEmpty = value == null || typeof value === 'boolean' || value === '';
  if (isEmpty) {
    return '';
  }

  var isNonNumeric = isNaN(value);
  if (isNonNumeric || value === 0 ||
      isUnitlessNumber.hasOwnProperty(name) && isUnitlessNumber[name]) {
    return '' + value; // cast to string
  }

  if (typeof value === 'string') {
    value = value.trim();
  }
  return value + 'px';
}

module.exports = dangerousStyleValue;

},{"4":4}],114:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule emptyFunction
 */

function makeEmptyFunction(arg) {
  return function() {
    return arg;
  };
}

/**
 * This function accepts and discards inputs; it has no side effects. This is
 * primarily useful idiomatically for overridable function endpoints which
 * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
 */
function emptyFunction() {}

emptyFunction.thatReturns = makeEmptyFunction;
emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
emptyFunction.thatReturnsNull = makeEmptyFunction(null);
emptyFunction.thatReturnsThis = function() { return this; };
emptyFunction.thatReturnsArgument = function(arg) { return arg; };

module.exports = emptyFunction;

},{}],115:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule emptyObject
 */

"use strict";

var emptyObject = {};

if ("production" !== "development") {
  Object.freeze(emptyObject);
}

module.exports = emptyObject;

},{}],116:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule escapeTextContentForBrowser
 */

'use strict';

var ESCAPE_LOOKUP = {
  '&': '&amp;',
  '>': '&gt;',
  '<': '&lt;',
  '"': '&quot;',
  '\'': '&#x27;'
};

var ESCAPE_REGEX = /[&><"']/g;

function escaper(match) {
  return ESCAPE_LOOKUP[match];
}

/**
 * Escapes text to prevent scripting attacks.
 *
 * @param {*} text Text value to escape.
 * @return {string} An escaped string.
 */
function escapeTextContentForBrowser(text) {
  return ('' + text).replace(ESCAPE_REGEX, escaper);
}

module.exports = escapeTextContentForBrowser;

},{}],117:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule findDOMNode
 * @typechecks static-only
 */

'use strict';

var ReactCurrentOwner = _dereq_(39);
var ReactInstanceMap = _dereq_(67);
var ReactMount = _dereq_(70);

var invariant = _dereq_(135);
var isNode = _dereq_(137);
var warning = _dereq_(154);

/**
 * Returns the DOM node rendered by this element.
 *
 * @param {ReactComponent|DOMElement} componentOrElement
 * @return {DOMElement} The root node of this element.
 */
function findDOMNode(componentOrElement) {
  if ("production" !== "development") {
    var owner = ReactCurrentOwner.current;
    if (owner !== null) {
      ("production" !== "development" ? warning(
        owner._warnedAboutRefsInRender,
        '%s is accessing getDOMNode or findDOMNode inside its render(). ' +
        'render() should be a pure function of props and state. It should ' +
        'never access something that requires stale data from the previous ' +
        'render, such as refs. Move this logic to componentDidMount and ' +
        'componentDidUpdate instead.',
        owner.getName() || 'A component'
      ) : null);
      owner._warnedAboutRefsInRender = true;
    }
  }
  if (componentOrElement == null) {
    return null;
  }
  if (isNode(componentOrElement)) {
    return componentOrElement;
  }
  if (ReactInstanceMap.has(componentOrElement)) {
    return ReactMount.getNodeFromInstance(componentOrElement);
  }
  ("production" !== "development" ? invariant(
    componentOrElement.render == null ||
    typeof componentOrElement.render !== 'function',
    'Component (with keys: %s) contains `render` method ' +
    'but is not mounted in the DOM',
    Object.keys(componentOrElement)
  ) : invariant(componentOrElement.render == null ||
  typeof componentOrElement.render !== 'function'));
  ("production" !== "development" ? invariant(
    false,
    'Element appears to be neither ReactComponent nor DOMNode (keys: %s)',
    Object.keys(componentOrElement)
  ) : invariant(false));
}

module.exports = findDOMNode;

},{"135":135,"137":137,"154":154,"39":39,"67":67,"70":70}],118:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule flattenChildren
 */

'use strict';

var traverseAllChildren = _dereq_(153);
var warning = _dereq_(154);

/**
 * @param {function} traverseContext Context passed through traversal.
 * @param {?ReactComponent} child React child component.
 * @param {!string} name String name of key path to child.
 */
function flattenSingleChildIntoContext(traverseContext, child, name) {
  // We found a component instance.
  var result = traverseContext;
  var keyUnique = !result.hasOwnProperty(name);
  if ("production" !== "development") {
    ("production" !== "development" ? warning(
      keyUnique,
      'flattenChildren(...): Encountered two children with the same key, ' +
      '`%s`. Child keys must be unique; when two children share a key, only ' +
      'the first child will be used.',
      name
    ) : null);
  }
  if (keyUnique && child != null) {
    result[name] = child;
  }
}

/**
 * Flattens children that are typically specified as `props.children`. Any null
 * children will not be included in the resulting object.
 * @return {!object} flattened children keyed by name.
 */
function flattenChildren(children) {
  if (children == null) {
    return children;
  }
  var result = {};
  traverseAllChildren(children, flattenSingleChildIntoContext, result);
  return result;
}

module.exports = flattenChildren;

},{"153":153,"154":154}],119:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule focusNode
 */

"use strict";

/**
 * @param {DOMElement} node input/textarea to focus
 */
function focusNode(node) {
  // IE8 can throw "Can't move focus to the control because it is invisible,
  // not enabled, or of a type that does not accept the focus." for all kinds of
  // reasons that are too expensive and fragile to test.
  try {
    node.focus();
  } catch(e) {
  }
}

module.exports = focusNode;

},{}],120:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule forEachAccumulated
 */

'use strict';

/**
 * @param {array} an "accumulation" of items which is either an Array or
 * a single item. Useful when paired with the `accumulate` module. This is a
 * simple utility that allows us to reason about a collection of items, but
 * handling the case when there is exactly one item (and we do not need to
 * allocate an array).
 */
var forEachAccumulated = function(arr, cb, scope) {
  if (Array.isArray(arr)) {
    arr.forEach(cb, scope);
  } else if (arr) {
    cb.call(scope, arr);
  }
};

module.exports = forEachAccumulated;

},{}],121:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getActiveElement
 * @typechecks
 */

/**
 * Same as document.activeElement but wraps in a try-catch block. In IE it is
 * not safe to call document.activeElement if there is nothing focused.
 *
 * The activeElement will be null only if the document body is not yet defined.
 */
function getActiveElement() /*?DOMElement*/ {
  try {
    return document.activeElement || document.body;
  } catch (e) {
    return document.body;
  }
}

module.exports = getActiveElement;

},{}],122:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventCharCode
 * @typechecks static-only
 */

'use strict';

/**
 * `charCode` represents the actual "character code" and is safe to use with
 * `String.fromCharCode`. As such, only keys that correspond to printable
 * characters produce a valid `charCode`, the only exception to this is Enter.
 * The Tab-key is considered non-printable and does not have a `charCode`,
 * presumably because it does not produce a tab-character in browsers.
 *
 * @param {object} nativeEvent Native browser event.
 * @return {string} Normalized `charCode` property.
 */
function getEventCharCode(nativeEvent) {
  var charCode;
  var keyCode = nativeEvent.keyCode;

  if ('charCode' in nativeEvent) {
    charCode = nativeEvent.charCode;

    // FF does not set `charCode` for the Enter-key, check against `keyCode`.
    if (charCode === 0 && keyCode === 13) {
      charCode = 13;
    }
  } else {
    // IE8 does not implement `charCode`, but `keyCode` has the correct value.
    charCode = keyCode;
  }

  // Some non-printable keys are reported in `charCode`/`keyCode`, discard them.
  // Must not discard the (non-)printable Enter-key.
  if (charCode >= 32 || charCode === 13) {
    return charCode;
  }

  return 0;
}

module.exports = getEventCharCode;

},{}],123:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventKey
 * @typechecks static-only
 */

'use strict';

var getEventCharCode = _dereq_(122);

/**
 * Normalization of deprecated HTML5 `key` values
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent#Key_names
 */
var normalizeKey = {
  'Esc': 'Escape',
  'Spacebar': ' ',
  'Left': 'ArrowLeft',
  'Up': 'ArrowUp',
  'Right': 'ArrowRight',
  'Down': 'ArrowDown',
  'Del': 'Delete',
  'Win': 'OS',
  'Menu': 'ContextMenu',
  'Apps': 'ContextMenu',
  'Scroll': 'ScrollLock',
  'MozPrintableKey': 'Unidentified'
};

/**
 * Translation from legacy `keyCode` to HTML5 `key`
 * Only special keys supported, all others depend on keyboard layout or browser
 * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent#Key_names
 */
var translateToKey = {
  8: 'Backspace',
  9: 'Tab',
  12: 'Clear',
  13: 'Enter',
  16: 'Shift',
  17: 'Control',
  18: 'Alt',
  19: 'Pause',
  20: 'CapsLock',
  27: 'Escape',
  32: ' ',
  33: 'PageUp',
  34: 'PageDown',
  35: 'End',
  36: 'Home',
  37: 'ArrowLeft',
  38: 'ArrowUp',
  39: 'ArrowRight',
  40: 'ArrowDown',
  45: 'Insert',
  46: 'Delete',
  112: 'F1', 113: 'F2', 114: 'F3', 115: 'F4', 116: 'F5', 117: 'F6',
  118: 'F7', 119: 'F8', 120: 'F9', 121: 'F10', 122: 'F11', 123: 'F12',
  144: 'NumLock',
  145: 'ScrollLock',
  224: 'Meta'
};

/**
 * @param {object} nativeEvent Native browser event.
 * @return {string} Normalized `key` property.
 */
function getEventKey(nativeEvent) {
  if (nativeEvent.key) {
    // Normalize inconsistent values reported by browsers due to
    // implementations of a working draft specification.

    // FireFox implements `key` but returns `MozPrintableKey` for all
    // printable characters (normalized to `Unidentified`), ignore it.
    var key = normalizeKey[nativeEvent.key] || nativeEvent.key;
    if (key !== 'Unidentified') {
      return key;
    }
  }

  // Browser does not implement `key`, polyfill as much of it as we can.
  if (nativeEvent.type === 'keypress') {
    var charCode = getEventCharCode(nativeEvent);

    // The enter-key is technically both printable and non-printable and can
    // thus be captured by `keypress`, no other non-printable key should.
    return charCode === 13 ? 'Enter' : String.fromCharCode(charCode);
  }
  if (nativeEvent.type === 'keydown' || nativeEvent.type === 'keyup') {
    // While user keyboard layout determines the actual meaning of each
    // `keyCode` value, almost all function keys have a universal value.
    return translateToKey[nativeEvent.keyCode] || 'Unidentified';
  }
  return '';
}

module.exports = getEventKey;

},{"122":122}],124:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventModifierState
 * @typechecks static-only
 */

'use strict';

/**
 * Translation from modifier key to the associated property in the event.
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#keys-Modifiers
 */

var modifierKeyToProp = {
  'Alt': 'altKey',
  'Control': 'ctrlKey',
  'Meta': 'metaKey',
  'Shift': 'shiftKey'
};

// IE8 does not implement getModifierState so we simply map it to the only
// modifier keys exposed by the event itself, does not support Lock-keys.
// Currently, all major browsers except Chrome seems to support Lock-keys.
function modifierStateGetter(keyArg) {
  /*jshint validthis:true */
  var syntheticEvent = this;
  var nativeEvent = syntheticEvent.nativeEvent;
  if (nativeEvent.getModifierState) {
    return nativeEvent.getModifierState(keyArg);
  }
  var keyProp = modifierKeyToProp[keyArg];
  return keyProp ? !!nativeEvent[keyProp] : false;
}

function getEventModifierState(nativeEvent) {
  return modifierStateGetter;
}

module.exports = getEventModifierState;

},{}],125:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getEventTarget
 * @typechecks static-only
 */

'use strict';

/**
 * Gets the target node from a native browser event by accounting for
 * inconsistencies in browser DOM APIs.
 *
 * @param {object} nativeEvent Native browser event.
 * @return {DOMEventTarget} Target node.
 */
function getEventTarget(nativeEvent) {
  var target = nativeEvent.target || nativeEvent.srcElement || window;
  // Safari may fire events on text nodes (Node.TEXT_NODE is 3).
  // @see http://www.quirksmode.org/js/events_properties.html
  return target.nodeType === 3 ? target.parentNode : target;
}

module.exports = getEventTarget;

},{}],126:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getIteratorFn
 * @typechecks static-only
 */

'use strict';

/* global Symbol */
var ITERATOR_SYMBOL = typeof Symbol === 'function' && Symbol.iterator;
var FAUX_ITERATOR_SYMBOL = '@@iterator'; // Before Symbol spec.

/**
 * Returns the iterator method function contained on the iterable object.
 *
 * Be sure to invoke the function with the iterable as context:
 *
 *     var iteratorFn = getIteratorFn(myIterable);
 *     if (iteratorFn) {
 *       var iterator = iteratorFn.call(myIterable);
 *       ...
 *     }
 *
 * @param {?object} maybeIterable
 * @return {?function}
 */
function getIteratorFn(maybeIterable) {
  var iteratorFn = maybeIterable && (
    (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL])
  );
  if (typeof iteratorFn === 'function') {
    return iteratorFn;
  }
}

module.exports = getIteratorFn;

},{}],127:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getMarkupWrap
 */

var ExecutionEnvironment = _dereq_(21);

var invariant = _dereq_(135);

/**
 * Dummy container used to detect which wraps are necessary.
 */
var dummyNode =
  ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;

/**
 * Some browsers cannot use `innerHTML` to render certain elements standalone,
 * so we wrap them, render the wrapped nodes, then extract the desired node.
 *
 * In IE8, certain elements cannot render alone, so wrap all elements ('*').
 */
var shouldWrap = {
  // Force wrapping for SVG elements because if they get created inside a <div>,
  // they will be initialized in the wrong namespace (and will not display).
  'circle': true,
  'clipPath': true,
  'defs': true,
  'ellipse': true,
  'g': true,
  'line': true,
  'linearGradient': true,
  'path': true,
  'polygon': true,
  'polyline': true,
  'radialGradient': true,
  'rect': true,
  'stop': true,
  'text': true
};

var selectWrap = [1, '<select multiple="true">', '</select>'];
var tableWrap = [1, '<table>', '</table>'];
var trWrap = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

var svgWrap = [1, '<svg>', '</svg>'];

var markupWrap = {
  '*': [1, '?<div>', '</div>'],

  'area': [1, '<map>', '</map>'],
  'col': [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  'legend': [1, '<fieldset>', '</fieldset>'],
  'param': [1, '<object>', '</object>'],
  'tr': [2, '<table><tbody>', '</tbody></table>'],

  'optgroup': selectWrap,
  'option': selectWrap,

  'caption': tableWrap,
  'colgroup': tableWrap,
  'tbody': tableWrap,
  'tfoot': tableWrap,
  'thead': tableWrap,

  'td': trWrap,
  'th': trWrap,

  'circle': svgWrap,
  'clipPath': svgWrap,
  'defs': svgWrap,
  'ellipse': svgWrap,
  'g': svgWrap,
  'line': svgWrap,
  'linearGradient': svgWrap,
  'path': svgWrap,
  'polygon': svgWrap,
  'polyline': svgWrap,
  'radialGradient': svgWrap,
  'rect': svgWrap,
  'stop': svgWrap,
  'text': svgWrap
};

/**
 * Gets the markup wrap configuration for the supplied `nodeName`.
 *
 * NOTE: This lazily detects which wraps are necessary for the current browser.
 *
 * @param {string} nodeName Lowercase `nodeName`.
 * @return {?array} Markup wrap configuration, if applicable.
 */
function getMarkupWrap(nodeName) {
  ("production" !== "development" ? invariant(!!dummyNode, 'Markup wrapping node not initialized') : invariant(!!dummyNode));
  if (!markupWrap.hasOwnProperty(nodeName)) {
    nodeName = '*';
  }
  if (!shouldWrap.hasOwnProperty(nodeName)) {
    if (nodeName === '*') {
      dummyNode.innerHTML = '<link />';
    } else {
      dummyNode.innerHTML = '<' + nodeName + '></' + nodeName + '>';
    }
    shouldWrap[nodeName] = !dummyNode.firstChild;
  }
  return shouldWrap[nodeName] ? markupWrap[nodeName] : null;
}


module.exports = getMarkupWrap;

},{"135":135,"21":21}],128:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getNodeForCharacterOffset
 */

'use strict';

/**
 * Given any node return the first leaf node without children.
 *
 * @param {DOMElement|DOMTextNode} node
 * @return {DOMElement|DOMTextNode}
 */
function getLeafNode(node) {
  while (node && node.firstChild) {
    node = node.firstChild;
  }
  return node;
}

/**
 * Get the next sibling within a container. This will walk up the
 * DOM if a node's siblings have been exhausted.
 *
 * @param {DOMElement|DOMTextNode} node
 * @return {?DOMElement|DOMTextNode}
 */
function getSiblingNode(node) {
  while (node) {
    if (node.nextSibling) {
      return node.nextSibling;
    }
    node = node.parentNode;
  }
}

/**
 * Get object describing the nodes which contain characters at offset.
 *
 * @param {DOMElement|DOMTextNode} root
 * @param {number} offset
 * @return {?object}
 */
function getNodeForCharacterOffset(root, offset) {
  var node = getLeafNode(root);
  var nodeStart = 0;
  var nodeEnd = 0;

  while (node) {
    if (node.nodeType === 3) {
      nodeEnd = nodeStart + node.textContent.length;

      if (nodeStart <= offset && nodeEnd >= offset) {
        return {
          node: node,
          offset: offset - nodeStart
        };
      }

      nodeStart = nodeEnd;
    }

    node = getLeafNode(getSiblingNode(node));
  }
}

module.exports = getNodeForCharacterOffset;

},{}],129:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getReactRootElementInContainer
 */

'use strict';

var DOC_NODE_TYPE = 9;

/**
 * @param {DOMElement|DOMDocument} container DOM element that may contain
 *                                           a React component
 * @return {?*} DOM element that may have the reactRoot ID, or null.
 */
function getReactRootElementInContainer(container) {
  if (!container) {
    return null;
  }

  if (container.nodeType === DOC_NODE_TYPE) {
    return container.documentElement;
  } else {
    return container.firstChild;
  }
}

module.exports = getReactRootElementInContainer;

},{}],130:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getTextContentAccessor
 */

'use strict';

var ExecutionEnvironment = _dereq_(21);

var contentKey = null;

/**
 * Gets the key used to access text content on a DOM node.
 *
 * @return {?string} Key used to access text content.
 * @internal
 */
function getTextContentAccessor() {
  if (!contentKey && ExecutionEnvironment.canUseDOM) {
    // Prefer textContent to innerText because many browsers support both but
    // SVG <text> elements don't support innerText even when <div> does.
    contentKey = 'textContent' in document.documentElement ?
      'textContent' :
      'innerText';
  }
  return contentKey;
}

module.exports = getTextContentAccessor;

},{"21":21}],131:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule getUnboundedScrollPosition
 * @typechecks
 */

"use strict";

/**
 * Gets the scroll position of the supplied element or window.
 *
 * The return values are unbounded, unlike `getScrollPosition`. This means they
 * may be negative or exceed the element boundaries (which is possible using
 * inertial scrolling).
 *
 * @param {DOMWindow|DOMElement} scrollable
 * @return {object} Map with `x` and `y` keys.
 */
function getUnboundedScrollPosition(scrollable) {
  if (scrollable === window) {
    return {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop
    };
  }
  return {
    x: scrollable.scrollLeft,
    y: scrollable.scrollTop
  };
}

module.exports = getUnboundedScrollPosition;

},{}],132:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule hyphenate
 * @typechecks
 */

var _uppercasePattern = /([A-Z])/g;

/**
 * Hyphenates a camelcased string, for example:
 *
 *   > hyphenate('backgroundColor')
 *   < "background-color"
 *
 * For CSS style names, use `hyphenateStyleName` instead which works properly
 * with all vendor prefixes, including `ms`.
 *
 * @param {string} string
 * @return {string}
 */
function hyphenate(string) {
  return string.replace(_uppercasePattern, '-$1').toLowerCase();
}

module.exports = hyphenate;

},{}],133:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule hyphenateStyleName
 * @typechecks
 */

"use strict";

var hyphenate = _dereq_(132);

var msPattern = /^ms-/;

/**
 * Hyphenates a camelcased CSS property name, for example:
 *
 *   > hyphenateStyleName('backgroundColor')
 *   < "background-color"
 *   > hyphenateStyleName('MozTransition')
 *   < "-moz-transition"
 *   > hyphenateStyleName('msTransition')
 *   < "-ms-transition"
 *
 * As Modernizr suggests (http://modernizr.com/docs/#prefixed), an `ms` prefix
 * is converted to `-ms-`.
 *
 * @param {string} string
 * @return {string}
 */
function hyphenateStyleName(string) {
  return hyphenate(string).replace(msPattern, '-ms-');
}

module.exports = hyphenateStyleName;

},{"132":132}],134:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule instantiateReactComponent
 * @typechecks static-only
 */

'use strict';

var ReactCompositeComponent = _dereq_(37);
var ReactEmptyComponent = _dereq_(59);
var ReactNativeComponent = _dereq_(73);

var assign = _dereq_(27);
var invariant = _dereq_(135);
var warning = _dereq_(154);

// To avoid a cyclic dependency, we create the final class in this module
var ReactCompositeComponentWrapper = function() { };
assign(
  ReactCompositeComponentWrapper.prototype,
  ReactCompositeComponent.Mixin,
  {
    _instantiateReactComponent: instantiateReactComponent
  }
);

/**
 * Check if the type reference is a known internal type. I.e. not a user
 * provided composite type.
 *
 * @param {function} type
 * @return {boolean} Returns true if this is a valid internal type.
 */
function isInternalComponentType(type) {
  return (
    typeof type === 'function' &&
    typeof type.prototype !== 'undefined' &&
    typeof type.prototype.mountComponent === 'function' &&
    typeof type.prototype.receiveComponent === 'function'
  );
}

/**
 * Given a ReactNode, create an instance that will actually be mounted.
 *
 * @param {ReactNode} node
 * @param {*} parentCompositeType The composite type that resolved this.
 * @return {object} A new instance of the element's constructor.
 * @protected
 */
function instantiateReactComponent(node, parentCompositeType) {
  var instance;

  if (node === null || node === false) {
    node = ReactEmptyComponent.emptyElement;
  }

  if (typeof node === 'object') {
    var element = node;
    if ("production" !== "development") {
      ("production" !== "development" ? warning(
        element && (typeof element.type === 'function' ||
                    typeof element.type === 'string'),
        'Only functions or strings can be mounted as React components.'
      ) : null);
    }

    // Special case string values
    if (parentCompositeType === element.type &&
        typeof element.type === 'string') {
      // Avoid recursion if the wrapper renders itself.
      instance = ReactNativeComponent.createInternalComponent(element);
      // All native components are currently wrapped in a composite so we're
      // safe to assume that this is what we should instantiate.
    } else if (isInternalComponentType(element.type)) {
      // This is temporarily available for custom components that are not string
      // represenations. I.e. ART. Once those are updated to use the string
      // representation, we can drop this code path.
      instance = new element.type(element);
    } else {
      instance = new ReactCompositeComponentWrapper();
    }
  } else if (typeof node === 'string' || typeof node === 'number') {
    instance = ReactNativeComponent.createInstanceForText(node);
  } else {
    ("production" !== "development" ? invariant(
      false,
      'Encountered invalid React node of type %s',
      typeof node
    ) : invariant(false));
  }

  if ("production" !== "development") {
    ("production" !== "development" ? warning(
      typeof instance.construct === 'function' &&
      typeof instance.mountComponent === 'function' &&
      typeof instance.receiveComponent === 'function' &&
      typeof instance.unmountComponent === 'function',
      'Only React Components can be mounted.'
    ) : null);
  }

  // Sets up the instance. This can probably just move into the constructor now.
  instance.construct(node);

  // These two fields are used by the DOM and ART diffing algorithms
  // respectively. Instead of using expandos on components, we should be
  // storing the state needed by the diffing algorithms elsewhere.
  instance._mountIndex = 0;
  instance._mountImage = null;

  if ("production" !== "development") {
    instance._isOwnerNecessary = false;
    instance._warnedAboutRefsInRender = false;
  }

  // Internal instances should fully constructed at this point, so they should
  // not get any new fields added to them at this point.
  if ("production" !== "development") {
    if (Object.preventExtensions) {
      Object.preventExtensions(instance);
    }
  }

  return instance;
}

module.exports = instantiateReactComponent;

},{"135":135,"154":154,"27":27,"37":37,"59":59,"73":73}],135:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule invariant
 */

"use strict";

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var invariant = function(condition, format, a, b, c, d, e, f) {
  if ("production" !== "development") {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  }

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error(
        'Minified exception occurred; use the non-minified dev environment ' +
        'for the full error message and additional helpful warnings.'
      );
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(
        'Invariant Violation: ' +
        format.replace(/%s/g, function() { return args[argIndex++]; })
      );
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
};

module.exports = invariant;

},{}],136:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isEventSupported
 */

'use strict';

var ExecutionEnvironment = _dereq_(21);

var useHasFeature;
if (ExecutionEnvironment.canUseDOM) {
  useHasFeature =
    document.implementation &&
    document.implementation.hasFeature &&
    // always returns true in newer browsers as per the standard.
    // @see http://dom.spec.whatwg.org/#dom-domimplementation-hasfeature
    document.implementation.hasFeature('', '') !== true;
}

/**
 * Checks if an event is supported in the current execution environment.
 *
 * NOTE: This will not work correctly for non-generic events such as `change`,
 * `reset`, `load`, `error`, and `select`.
 *
 * Borrows from Modernizr.
 *
 * @param {string} eventNameSuffix Event name, e.g. "click".
 * @param {?boolean} capture Check if the capture phase is supported.
 * @return {boolean} True if the event is supported.
 * @internal
 * @license Modernizr 3.0.0pre (Custom Build) | MIT
 */
function isEventSupported(eventNameSuffix, capture) {
  if (!ExecutionEnvironment.canUseDOM ||
      capture && !('addEventListener' in document)) {
    return false;
  }

  var eventName = 'on' + eventNameSuffix;
  var isSupported = eventName in document;

  if (!isSupported) {
    var element = document.createElement('div');
    element.setAttribute(eventName, 'return;');
    isSupported = typeof element[eventName] === 'function';
  }

  if (!isSupported && useHasFeature && eventNameSuffix === 'wheel') {
    // This is the only way to test support for the `wheel` event in IE9+.
    isSupported = document.implementation.hasFeature('Events.wheel', '3.0');
  }

  return isSupported;
}

module.exports = isEventSupported;

},{"21":21}],137:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isNode
 * @typechecks
 */

/**
 * @param {*} object The object to check.
 * @return {boolean} Whether or not the object is a DOM node.
 */
function isNode(object) {
  return !!(object && (
    ((typeof Node === 'function' ? object instanceof Node : typeof object === 'object' &&
    typeof object.nodeType === 'number' &&
    typeof object.nodeName === 'string'))
  ));
}

module.exports = isNode;

},{}],138:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isTextInputElement
 */

'use strict';

/**
 * @see http://www.whatwg.org/specs/web-apps/current-work/multipage/the-input-element.html#input-type-attr-summary
 */
var supportedInputTypes = {
  'color': true,
  'date': true,
  'datetime': true,
  'datetime-local': true,
  'email': true,
  'month': true,
  'number': true,
  'password': true,
  'range': true,
  'search': true,
  'tel': true,
  'text': true,
  'time': true,
  'url': true,
  'week': true
};

function isTextInputElement(elem) {
  return elem && (
    (elem.nodeName === 'INPUT' && supportedInputTypes[elem.type] || elem.nodeName === 'TEXTAREA')
  );
}

module.exports = isTextInputElement;

},{}],139:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule isTextNode
 * @typechecks
 */

var isNode = _dereq_(137);

/**
 * @param {*} object The object to check.
 * @return {boolean} Whether or not the object is a DOM text node.
 */
function isTextNode(object) {
  return isNode(object) && object.nodeType == 3;
}

module.exports = isTextNode;

},{"137":137}],140:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule keyMirror
 * @typechecks static-only
 */

'use strict';

var invariant = _dereq_(135);

/**
 * Constructs an enumeration with keys equal to their value.
 *
 * For example:
 *
 *   var COLORS = keyMirror({blue: null, red: null});
 *   var myColor = COLORS.blue;
 *   var isColorValid = !!COLORS[myColor];
 *
 * The last line could not be performed if the values of the generated enum were
 * not equal to their keys.
 *
 *   Input:  {key1: val1, key2: val2}
 *   Output: {key1: key1, key2: key2}
 *
 * @param {object} obj
 * @return {object}
 */
var keyMirror = function(obj) {
  var ret = {};
  var key;
  ("production" !== "development" ? invariant(
    obj instanceof Object && !Array.isArray(obj),
    'keyMirror(...): Argument must be an object.'
  ) : invariant(obj instanceof Object && !Array.isArray(obj)));
  for (key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }
    ret[key] = key;
  }
  return ret;
};

module.exports = keyMirror;

},{"135":135}],141:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule keyOf
 */

/**
 * Allows extraction of a minified key. Let's the build system minify keys
 * without loosing the ability to dynamically use key strings as values
 * themselves. Pass in an object with a single key/val pair and it will return
 * you the string key of that single record. Suppose you want to grab the
 * value for a key 'className' inside of an object. Key/val minification may
 * have aliased that key to be 'xa12'. keyOf({className: null}) will return
 * 'xa12' in that case. Resolve keys you want to use once at startup time, then
 * reuse those resolutions.
 */
var keyOf = function(oneKeyObj) {
  var key;
  for (key in oneKeyObj) {
    if (!oneKeyObj.hasOwnProperty(key)) {
      continue;
    }
    return key;
  }
  return null;
};


module.exports = keyOf;

},{}],142:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule mapObject
 */

'use strict';

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Executes the provided `callback` once for each enumerable own property in the
 * object and constructs a new object from the results. The `callback` is
 * invoked with three arguments:
 *
 *  - the property value
 *  - the property name
 *  - the object being traversed
 *
 * Properties that are added after the call to `mapObject` will not be visited
 * by `callback`. If the values of existing properties are changed, the value
 * passed to `callback` will be the value at the time `mapObject` visits them.
 * Properties that are deleted before being visited are not visited.
 *
 * @grep function objectMap()
 * @grep function objMap()
 *
 * @param {?object} object
 * @param {function} callback
 * @param {*} context
 * @return {?object}
 */
function mapObject(object, callback, context) {
  if (!object) {
    return null;
  }
  var result = {};
  for (var name in object) {
    if (hasOwnProperty.call(object, name)) {
      result[name] = callback.call(context, object[name], name, object);
    }
  }
  return result;
}

module.exports = mapObject;

},{}],143:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule memoizeStringOnly
 * @typechecks static-only
 */

'use strict';

/**
 * Memoizes the return value of a function that accepts one string argument.
 *
 * @param {function} callback
 * @return {function}
 */
function memoizeStringOnly(callback) {
  var cache = {};
  return function(string) {
    if (!cache.hasOwnProperty(string)) {
      cache[string] = callback.call(this, string);
    }
    return cache[string];
  };
}

module.exports = memoizeStringOnly;

},{}],144:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule onlyChild
 */
'use strict';

var ReactElement = _dereq_(57);

var invariant = _dereq_(135);

/**
 * Returns the first child in a collection of children and verifies that there
 * is only one child in the collection. The current implementation of this
 * function assumes that a single child gets passed without a wrapper, but the
 * purpose of this helper function is to abstract away the particular structure
 * of children.
 *
 * @param {?object} children Child collection structure.
 * @return {ReactComponent} The first and only `ReactComponent` contained in the
 * structure.
 */
function onlyChild(children) {
  ("production" !== "development" ? invariant(
    ReactElement.isValidElement(children),
    'onlyChild must be passed a children with exactly one child.'
  ) : invariant(ReactElement.isValidElement(children)));
  return children;
}

module.exports = onlyChild;

},{"135":135,"57":57}],145:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule performance
 * @typechecks
 */

"use strict";

var ExecutionEnvironment = _dereq_(21);

var performance;

if (ExecutionEnvironment.canUseDOM) {
  performance =
    window.performance ||
    window.msPerformance ||
    window.webkitPerformance;
}

module.exports = performance || {};

},{"21":21}],146:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule performanceNow
 * @typechecks
 */

var performance = _dereq_(145);

/**
 * Detect if we can use `window.performance.now()` and gracefully fallback to
 * `Date.now()` if it doesn't exist. We need to support Firefox < 15 for now
 * because of Facebook's testing infrastructure.
 */
if (!performance || !performance.now) {
  performance = Date;
}

var performanceNow = performance.now.bind(performance);

module.exports = performanceNow;

},{"145":145}],147:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule quoteAttributeValueForBrowser
 */

'use strict';

var escapeTextContentForBrowser = _dereq_(116);

/**
 * Escapes attribute value to prevent scripting attacks.
 *
 * @param {*} value Value to escape.
 * @return {string} An escaped string.
 */
function quoteAttributeValueForBrowser(value) {
  return '"' + escapeTextContentForBrowser(value) + '"';
}

module.exports = quoteAttributeValueForBrowser;

},{"116":116}],148:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule setInnerHTML
 */

/* globals MSApp */

'use strict';

var ExecutionEnvironment = _dereq_(21);

var WHITESPACE_TEST = /^[ \r\n\t\f]/;
var NONVISIBLE_TEST = /<(!--|link|noscript|meta|script|style)[ \r\n\t\f\/>]/;

/**
 * Set the innerHTML property of a node, ensuring that whitespace is preserved
 * even in IE8.
 *
 * @param {DOMElement} node
 * @param {string} html
 * @internal
 */
var setInnerHTML = function(node, html) {
  node.innerHTML = html;
};

// Win8 apps: Allow all html to be inserted
if (typeof MSApp !== 'undefined' && MSApp.execUnsafeLocalFunction) {
  setInnerHTML = function(node, html) {
    MSApp.execUnsafeLocalFunction(function() {
      node.innerHTML = html;
    });
  };
}

if (ExecutionEnvironment.canUseDOM) {
  // IE8: When updating a just created node with innerHTML only leading
  // whitespace is removed. When updating an existing node with innerHTML
  // whitespace in root TextNodes is also collapsed.
  // @see quirksmode.org/bugreports/archives/2004/11/innerhtml_and_t.html

  // Feature detection; only IE8 is known to behave improperly like this.
  var testElement = document.createElement('div');
  testElement.innerHTML = ' ';
  if (testElement.innerHTML === '') {
    setInnerHTML = function(node, html) {
      // Magic theory: IE8 supposedly differentiates between added and updated
      // nodes when processing innerHTML, innerHTML on updated nodes suffers
      // from worse whitespace behavior. Re-adding a node like this triggers
      // the initial and more favorable whitespace behavior.
      // TODO: What to do on a detached node?
      if (node.parentNode) {
        node.parentNode.replaceChild(node, node);
      }

      // We also implement a workaround for non-visible tags disappearing into
      // thin air on IE8, this only happens if there is no visible text
      // in-front of the non-visible tags. Piggyback on the whitespace fix
      // and simply check if any non-visible tags appear in the source.
      if (WHITESPACE_TEST.test(html) ||
          html[0] === '<' && NONVISIBLE_TEST.test(html)) {
        // Recover leading whitespace by temporarily prepending any character.
        // \uFEFF has the potential advantage of being zero-width/invisible.
        node.innerHTML = '\uFEFF' + html;

        // deleteData leaves an empty `TextNode` which offsets the index of all
        // children. Definitely want to avoid this.
        var textNode = node.firstChild;
        if (textNode.data.length === 1) {
          node.removeChild(textNode);
        } else {
          textNode.deleteData(0, 1);
        }
      } else {
        node.innerHTML = html;
      }
    };
  }
}

module.exports = setInnerHTML;

},{"21":21}],149:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule setTextContent
 */

'use strict';

var ExecutionEnvironment = _dereq_(21);
var escapeTextContentForBrowser = _dereq_(116);
var setInnerHTML = _dereq_(148);

/**
 * Set the textContent property of a node, ensuring that whitespace is preserved
 * even in IE8. innerText is a poor substitute for textContent and, among many
 * issues, inserts <br> instead of the literal newline chars. innerHTML behaves
 * as it should.
 *
 * @param {DOMElement} node
 * @param {string} text
 * @internal
 */
var setTextContent = function(node, text) {
  node.textContent = text;
};

if (ExecutionEnvironment.canUseDOM) {
  if (!('textContent' in document.documentElement)) {
    setTextContent = function(node, text) {
      setInnerHTML(node, escapeTextContentForBrowser(text));
    };
  }
}

module.exports = setTextContent;

},{"116":116,"148":148,"21":21}],150:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule shallowEqual
 */

'use strict';

/**
 * Performs equality by iterating through keys on an object and returning
 * false when any key has values which are not strictly equal between
 * objA and objB. Returns true when the values of all keys are strictly equal.
 *
 * @return {boolean}
 */
function shallowEqual(objA, objB) {
  if (objA === objB) {
    return true;
  }
  var key;
  // Test for A's keys different from B.
  for (key in objA) {
    if (objA.hasOwnProperty(key) &&
        (!objB.hasOwnProperty(key) || objA[key] !== objB[key])) {
      return false;
    }
  }
  // Test for B's keys missing from A.
  for (key in objB) {
    if (objB.hasOwnProperty(key) && !objA.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

module.exports = shallowEqual;

},{}],151:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule shouldUpdateReactComponent
 * @typechecks static-only
 */

'use strict';

var warning = _dereq_(154);

/**
 * Given a `prevElement` and `nextElement`, determines if the existing
 * instance should be updated as opposed to being destroyed or replaced by a new
 * instance. Both arguments are elements. This ensures that this logic can
 * operate on stateless trees without any backing instance.
 *
 * @param {?object} prevElement
 * @param {?object} nextElement
 * @return {boolean} True if the existing instance should be updated.
 * @protected
 */
function shouldUpdateReactComponent(prevElement, nextElement) {
  if (prevElement != null && nextElement != null) {
    var prevType = typeof prevElement;
    var nextType = typeof nextElement;
    if (prevType === 'string' || prevType === 'number') {
      return (nextType === 'string' || nextType === 'number');
    } else {
      if (nextType === 'object' &&
          prevElement.type === nextElement.type &&
          prevElement.key === nextElement.key) {
        var ownersMatch = prevElement._owner === nextElement._owner;
        var prevName = null;
        var nextName = null;
        var nextDisplayName = null;
        if ("production" !== "development") {
          if (!ownersMatch) {
            if (prevElement._owner != null &&
                prevElement._owner.getPublicInstance() != null &&
                prevElement._owner.getPublicInstance().constructor != null) {
              prevName =
                prevElement._owner.getPublicInstance().constructor.displayName;
            }
            if (nextElement._owner != null &&
                nextElement._owner.getPublicInstance() != null &&
                nextElement._owner.getPublicInstance().constructor != null) {
              nextName =
                nextElement._owner.getPublicInstance().constructor.displayName;
            }
            if (nextElement.type != null &&
                nextElement.type.displayName != null) {
              nextDisplayName = nextElement.type.displayName;
            }
            if (nextElement.type != null && typeof nextElement.type === 'string') {
              nextDisplayName = nextElement.type;
            }
            if (typeof nextElement.type !== 'string' ||
                nextElement.type === 'input' ||
                nextElement.type === 'textarea') {
              if ((prevElement._owner != null &&
                  prevElement._owner._isOwnerNecessary === false) ||
                  (nextElement._owner != null &&
                  nextElement._owner._isOwnerNecessary === false)) {
                if (prevElement._owner != null) {
                  prevElement._owner._isOwnerNecessary = true;
                }
                if (nextElement._owner != null) {
                  nextElement._owner._isOwnerNecessary = true;
                }
                ("production" !== "development" ? warning(
                  false,
                  '<%s /> is being rendered by both %s and %s using the same ' +
                  'key (%s) in the same place. Currently, this means that ' +
                  'they don\'t preserve state. This behavior should be very ' +
                  'rare so we\'re considering deprecating it. Please contact ' +
                  'the React team and explain your use case so that we can ' +
                  'take that into consideration.',
                  nextDisplayName || 'Unknown Component',
                  prevName || '[Unknown]',
                  nextName || '[Unknown]',
                  prevElement.key
                ) : null);
              }
            }
          }
        }
        return ownersMatch;
      }
    }
  }
  return false;
}

module.exports = shouldUpdateReactComponent;

},{"154":154}],152:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule toArray
 * @typechecks
 */

var invariant = _dereq_(135);

/**
 * Convert array-like objects to arrays.
 *
 * This API assumes the caller knows the contents of the data type. For less
 * well defined inputs use createArrayFromMixed.
 *
 * @param {object|function|filelist} obj
 * @return {array}
 */
function toArray(obj) {
  var length = obj.length;

  // Some browse builtin objects can report typeof 'function' (e.g. NodeList in
  // old versions of Safari).
  ("production" !== "development" ? invariant(
    !Array.isArray(obj) &&
    (typeof obj === 'object' || typeof obj === 'function'),
    'toArray: Array-like object expected'
  ) : invariant(!Array.isArray(obj) &&
  (typeof obj === 'object' || typeof obj === 'function')));

  ("production" !== "development" ? invariant(
    typeof length === 'number',
    'toArray: Object needs a length property'
  ) : invariant(typeof length === 'number'));

  ("production" !== "development" ? invariant(
    length === 0 ||
    (length - 1) in obj,
    'toArray: Object should have keys for indices'
  ) : invariant(length === 0 ||
  (length - 1) in obj));

  // Old IE doesn't give collections access to hasOwnProperty. Assume inputs
  // without method will throw during the slice call and skip straight to the
  // fallback.
  if (obj.hasOwnProperty) {
    try {
      return Array.prototype.slice.call(obj);
    } catch (e) {
      // IE < 9 does not support Array#slice on collections objects
    }
  }

  // Fall back to copying key by key. This assumes all keys have a value,
  // so will not preserve sparsely populated inputs.
  var ret = Array(length);
  for (var ii = 0; ii < length; ii++) {
    ret[ii] = obj[ii];
  }
  return ret;
}

module.exports = toArray;

},{"135":135}],153:[function(_dereq_,module,exports){
/**
 * Copyright 2013-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule traverseAllChildren
 */

'use strict';

var ReactElement = _dereq_(57);
var ReactFragment = _dereq_(63);
var ReactInstanceHandles = _dereq_(66);

var getIteratorFn = _dereq_(126);
var invariant = _dereq_(135);
var warning = _dereq_(154);

var SEPARATOR = ReactInstanceHandles.SEPARATOR;
var SUBSEPARATOR = ':';

/**
 * TODO: Test that a single child and an array with one item have the same key
 * pattern.
 */

var userProvidedKeyEscaperLookup = {
  '=': '=0',
  '.': '=1',
  ':': '=2'
};

var userProvidedKeyEscapeRegex = /[=.:]/g;

var didWarnAboutMaps = false;

function userProvidedKeyEscaper(match) {
  return userProvidedKeyEscaperLookup[match];
}

/**
 * Generate a key string that identifies a component within a set.
 *
 * @param {*} component A component that could contain a manual key.
 * @param {number} index Index that is used if a manual key is not provided.
 * @return {string}
 */
function getComponentKey(component, index) {
  if (component && component.key != null) {
    // Explicit key
    return wrapUserProvidedKey(component.key);
  }
  // Implicit key determined by the index in the set
  return index.toString(36);
}

/**
 * Escape a component key so that it is safe to use in a reactid.
 *
 * @param {*} key Component key to be escaped.
 * @return {string} An escaped string.
 */
function escapeUserProvidedKey(text) {
  return ('' + text).replace(
    userProvidedKeyEscapeRegex,
    userProvidedKeyEscaper
  );
}

/**
 * Wrap a `key` value explicitly provided by the user to distinguish it from
 * implicitly-generated keys generated by a component's index in its parent.
 *
 * @param {string} key Value of a user-provided `key` attribute
 * @return {string}
 */
function wrapUserProvidedKey(key) {
  return '$' + escapeUserProvidedKey(key);
}

/**
 * @param {?*} children Children tree container.
 * @param {!string} nameSoFar Name of the key path so far.
 * @param {!number} indexSoFar Number of children encountered until this point.
 * @param {!function} callback Callback to invoke with each child found.
 * @param {?*} traverseContext Used to pass information throughout the traversal
 * process.
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildrenImpl(
  children,
  nameSoFar,
  indexSoFar,
  callback,
  traverseContext
) {
  var type = typeof children;

  if (type === 'undefined' || type === 'boolean') {
    // All of the above are perceived as null.
    children = null;
  }

  if (children === null ||
      type === 'string' ||
      type === 'number' ||
      ReactElement.isValidElement(children)) {
    callback(
      traverseContext,
      children,
      // If it's the only child, treat the name as if it was wrapped in an array
      // so that it's consistent if the number of children grows.
      nameSoFar === '' ? SEPARATOR + getComponentKey(children, 0) : nameSoFar,
      indexSoFar
    );
    return 1;
  }

  var child, nextName, nextIndex;
  var subtreeCount = 0; // Count of children found in the current subtree.

  if (Array.isArray(children)) {
    for (var i = 0; i < children.length; i++) {
      child = children[i];
      nextName = (
        (nameSoFar !== '' ? nameSoFar + SUBSEPARATOR : SEPARATOR) +
        getComponentKey(child, i)
      );
      nextIndex = indexSoFar + subtreeCount;
      subtreeCount += traverseAllChildrenImpl(
        child,
        nextName,
        nextIndex,
        callback,
        traverseContext
      );
    }
  } else {
    var iteratorFn = getIteratorFn(children);
    if (iteratorFn) {
      var iterator = iteratorFn.call(children);
      var step;
      if (iteratorFn !== children.entries) {
        var ii = 0;
        while (!(step = iterator.next()).done) {
          child = step.value;
          nextName = (
            (nameSoFar !== '' ? nameSoFar + SUBSEPARATOR : SEPARATOR) +
            getComponentKey(child, ii++)
          );
          nextIndex = indexSoFar + subtreeCount;
          subtreeCount += traverseAllChildrenImpl(
            child,
            nextName,
            nextIndex,
            callback,
            traverseContext
          );
        }
      } else {
        if ("production" !== "development") {
          ("production" !== "development" ? warning(
            didWarnAboutMaps,
            'Using Maps as children is not yet fully supported. It is an ' +
            'experimental feature that might be removed. Convert it to a ' +
            'sequence / iterable of keyed ReactElements instead.'
          ) : null);
          didWarnAboutMaps = true;
        }
        // Iterator will provide entry [k,v] tuples rather than values.
        while (!(step = iterator.next()).done) {
          var entry = step.value;
          if (entry) {
            child = entry[1];
            nextName = (
              (nameSoFar !== '' ? nameSoFar + SUBSEPARATOR : SEPARATOR) +
              wrapUserProvidedKey(entry[0]) + SUBSEPARATOR +
              getComponentKey(child, 0)
            );
            nextIndex = indexSoFar + subtreeCount;
            subtreeCount += traverseAllChildrenImpl(
              child,
              nextName,
              nextIndex,
              callback,
              traverseContext
            );
          }
        }
      }
    } else if (type === 'object') {
      ("production" !== "development" ? invariant(
        children.nodeType !== 1,
        'traverseAllChildren(...): Encountered an invalid child; DOM ' +
        'elements are not valid children of React components.'
      ) : invariant(children.nodeType !== 1));
      var fragment = ReactFragment.extract(children);
      for (var key in fragment) {
        if (fragment.hasOwnProperty(key)) {
          child = fragment[key];
          nextName = (
            (nameSoFar !== '' ? nameSoFar + SUBSEPARATOR : SEPARATOR) +
            wrapUserProvidedKey(key) + SUBSEPARATOR +
            getComponentKey(child, 0)
          );
          nextIndex = indexSoFar + subtreeCount;
          subtreeCount += traverseAllChildrenImpl(
            child,
            nextName,
            nextIndex,
            callback,
            traverseContext
          );
        }
      }
    }
  }

  return subtreeCount;
}

/**
 * Traverses children that are typically specified as `props.children`, but
 * might also be specified through attributes:
 *
 * - `traverseAllChildren(this.props.children, ...)`
 * - `traverseAllChildren(this.props.leftPanelChildren, ...)`
 *
 * The `traverseContext` is an optional argument that is passed through the
 * entire traversal. It can be used to store accumulations or anything else that
 * the callback might find relevant.
 *
 * @param {?*} children Children tree object.
 * @param {!function} callback To invoke upon traversing each child.
 * @param {?*} traverseContext Context for traversal.
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildren(children, callback, traverseContext) {
  if (children == null) {
    return 0;
  }

  return traverseAllChildrenImpl(children, '', 0, callback, traverseContext);
}

module.exports = traverseAllChildren;

},{"126":126,"135":135,"154":154,"57":57,"63":63,"66":66}],154:[function(_dereq_,module,exports){
/**
 * Copyright 2014-2015, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule warning
 */

"use strict";

var emptyFunction = _dereq_(114);

/**
 * Similar to invariant but only logs a warning if the condition is not met.
 * This can be used to log issues in development environments in critical
 * paths. Removing the logging code for production environments will keep the
 * same logic and follow the same code paths.
 */

var warning = emptyFunction;

if ("production" !== "development") {
  warning = function(condition, format ) {for (var args=[],$__0=2,$__1=arguments.length;$__0<$__1;$__0++) args.push(arguments[$__0]);
    if (format === undefined) {
      throw new Error(
        '`warning(condition, format, ...args)` requires a warning ' +
        'message argument'
      );
    }

    if (format.length < 10 || /^[s\W]*$/.test(format)) {
      throw new Error(
        'The warning format should be able to uniquely identify this ' +
        'warning. Please, use a more descriptive format than: ' + format
      );
    }

    if (format.indexOf('Failed Composite propType: ') === 0) {
      return; // Ignore CompositeComponent proptype check.
    }

    if (!condition) {
      var argIndex = 0;
      var message = 'Warning: ' + format.replace(/%s/g, function()  {return args[argIndex++];});
      console.warn(message);
      try {
        // --- Welcome to debugging React ---
        // This error was thrown as a convenience so that you can use this stack
        // to find the callsite that caused this warning to fire.
        throw new Error(message);
      } catch(x) {}
    }
  };
}

module.exports = warning;

},{"114":114}]},{},[1])(1)
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],7:[function(require,module,exports){
var BoardState = require('./BoardState.jsx');
var React = require('./react.js');
var TicTacToeBoard = require('./TicTacToeBoard.jsx');
var AI = require('./AI.jsx');

var run = function() {
  AI.initialize();
  var initialBoardState = new BoardState()
  if (localStorage.boardState) {
    initialBoardState = new BoardState(
      null, null, JSON.parse(localStorage.boardState))
  }

  var onNewBoardState = function(boardState) {
    localStorage.boardState = JSON.stringify({
      player: boardState.player,
      cells: boardState.cells
    });
  }
  React.render(React.createElement(TicTacToeBoard, {
        initialBoardState: initialBoardState, 
        onNewBoardState: onNewBoardState}),
    document.getElementById('root'));
}

module.exports = run;

},{"./AI.jsx":1,"./BoardState.jsx":2,"./TicTacToeBoard.jsx":3,"./react.js":6}],8:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],9:[function(require,module,exports){
var _ = require('underscore');
var run = require('./js/run.jsx');

// let browser render loading view if we're computing the AI table, then
// run our stuff
_.defer(run);

},{"./js/run.jsx":7,"underscore":8}]},{},[9]);
