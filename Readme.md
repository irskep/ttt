# Tic Tac DIE

## Playing the game

Open `index.html`. The end! The JS is already built.

## Developing

```sh
npm install -g browserify
npm install
make
open index.html  # if on OS X
```

## Shortcomings

* React is vendored instead of being npm-installed.
* The build setup is very rudimentary.
* The game loop is handled by the React view, which is gross.
