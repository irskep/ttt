var _ = require('underscore');
var BoardState = require('./BoardState.jsx');
var getNextPlayer = require('./getNextPlayer.jsx');

// board key -> n
// more positive = X advantage, more negative = Y advantage
var STATE_KEY_TO_SCORE = null;

// cheating! I captured the output to avoid long load time.
STATE_KEY_TO_SCORE = require('./boardStateHashKeyToScore.jsx');
// set to true if you want to see how long it takes
var FORCE_COMPUTE = false;

var getScore = function(boardState) {
  return STATE_KEY_TO_SCORE[boardState.hashKey];
}

// if leaf, score = weighted constant
//    (positive, negative, or zero depending on X win, O win, or tie)
// otherwise, score = sum of children's scores
// store score in cache and return it
var _computeScore = function(boardState, weightFactor, numLevelsDeep) {
  // a loss at level X is weighted much heavier than a loss at level X+1
  //winValue = Math.pow(weightFactor, 10 - numLevelsDeep)
  var winValue = 10 - numLevelsDeep;

  var possibleMoves = boardState.getPossibleMoves();
  if (possibleMoves.length == 0) {
    var count = 0;
    var winner = boardState.getWinner();
    if (winner && winner.player == 'x') count = winValue;
    if (winner && winner.player == 'o') count = -winValue;
    STATE_KEY_TO_SCORE[boardState.hashKey] = count;
    return count;
  } else {
    var count = 0;
    _.each(possibleMoves, function(move) {
      count += _computeScore(
        new BoardState(boardState, move), weightFactor, numLevelsDeep + 1);
    });
    STATE_KEY_TO_SCORE[boardState.hashKey] = count;
    return count;
  }
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


var getBestMoveForO = function(boardState) {
  var possibleMoves = boardState.getPossibleMoves();
  var minScore = getScore(new BoardState(boardState, possibleMoves[0]));
  var bestMove = possibleMoves[0];
  _.each(possibleMoves, function(cell) {
    var score = getScore(new BoardState(boardState, cell));
    if (score < minScore) {
      minScore = score;
      bestMove = cell;
    }
  })
  return bestMove;
}


var getBestMoveForX = function(boardState) {
  var possibleMoves = boardState.getPossibleMoves();
  var maxScore = getScore(new BoardState(boardState, possibleMoves[0]));
  var bestMove = possibleMoves[0];
  _.each(possibleMoves, function(cell) {
    var score = getScore(new BoardState(boardState, cell));
    if (score > maxScore) {
      maxScore = score;
      bestMove = cell;
    }
  })
  return bestMove;
}


module.exports = {
  initialize: initialize,
  getScore: getScore,
  getBestMoveForO: getBestMoveForO,
  getBestMoveForX: getBestMoveForX
}
