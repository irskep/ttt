.PHONY: browserify

browserify:
	browserify -t reactify --es6 --extension jsx index.jsx -o index.js