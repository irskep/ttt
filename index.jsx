var _ = require('underscore');
var run = require('./js/run.jsx');

// let browser render loading view if we're computing the AI table, then
// run our stuff
_.defer(run);
