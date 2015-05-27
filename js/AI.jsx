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
