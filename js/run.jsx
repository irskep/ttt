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
  React.render(<TicTacToeBoard
        initialBoardState={initialBoardState}
        onNewBoardState={onNewBoardState} />,
    document.getElementById('root'));
}

module.exports = run;