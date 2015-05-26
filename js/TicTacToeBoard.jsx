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
      boardState: this.props.initialBoardState
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
        boardState.player != 'x' &&
        !boardState.getIsGameOver()) {
      _.delay(function(){
        self.setNewBoardState(new BoardState(
          boardState, AI.getBestMoveForX(boardState)));
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
      !isGameOver && (currentPlayer == 'o' || !IS_AI_ENABLED));

    return <div className="tic-tac-toe-game">
      <div className="tic-tac-toe-container">
        <table className="tic-tac-toe-board">
          <tbody>
            {_.range(0, 3).map(function(row) {
              return <tr key={row}>
                {_.range(0, 3).map(function(col) {
                  var value = boardState.getCell(row, col);
                  if (value == '' && canHumanPlayerMove) {
                    return <td
                      className="clickable"
                      key={col}
                      currentPlayer={currentPlayer}
                      onClick={function() {
                        self.setNewBoardState(boardState.setCell(row, col));
                      }} />
                  } else {
                    return <td key={col}>
                      {value == 'x' && <div>×</div>}
                      {value == 'o' && <div>○</div>}
                    </td>;
                  }
                })}
              </tr>
            })}
          </tbody>
        </table>
        {winner && <WinnerDisplay cells={winner.cells} />}
      </div>
      <div className="controls">
        <PlayerTurnIndicator
          currentPlayer={currentPlayer}
          winner={boardState.getWinner()}
          isGameOver={boardState.getIsGameOver()} />
        <button onClick={function() {self.setNewBoardState(new BoardState());}}>
          New game
        </button>
      </div>
    </div>;
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
    return <svg className="tic-tac-toe-win-display"
      width={BOARD_SIZE} height={BOARD_SIZE}
      viewBox={"0 0 " + BOARD_SIZE + " " + BOARD_SIZE}>
       <line x1={x1} y1={y1} x2={x2} y2={y2}
        strokeLinecap="round" strokeWidth="20" stroke="#f00"/>
    </svg>
  }
});

var PlayerTurnIndicator = React.createClass({
  displayName: 'PlayerTurnIndicator',
  render: function() {
    var winner = this.props.winner;
    return <p>
      {!this.props.isGameOver && <span>
        Current player: {this.props.currentPlayer}
      </span>}
      {this.props.isGameOver && winner && <span>
        Winner: {this.props.winner.player}
      </span>}
      {this.props.isGameOver && !winner && <span>
        It’s a tie!
      </span>}
    </p>
  }
});

module.exports = TicTacToeBoard;