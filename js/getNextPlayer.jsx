var getNextPlayer = function(previousPlayer) {
  // if previous player is 'x', next player is 'o'.
  // otherwise (null or 'o'), next player is 'x'.
  return previousPlayer == 'x' ? 'o' : 'x';
};


module.exports = getNextPlayer;