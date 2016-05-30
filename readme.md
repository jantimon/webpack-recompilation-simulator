# Webpack recompilation helper [![npm version](https://badge.fury.io/js/webpack-recompilation-simulator.svg)](http://badge.fury.io/js/webpack-recompilation-simulator) [![Dependency Status](https://david-dm.org/jantimon/webpack-recompilation-simulator.svg)](https://david-dm.org/jantimon/webpack-recompilation-simulator)  [![Build Status](https://travis-ci.org/jantimon/webpack-recompilation-simulator.svg?branch=master)](https://travis-ci.org/jantimon/webpack-recompilation-simulator) [![Windows build status](https://ci.appveyor.com/api/projects/status/github/jantimon/webpack-recompilation-simulator?svg=true&branch=master)](https://ci.appveyor.com/project/jantimon/webpack-recompilation-simulator)

This is just a small util to test and measure caching
during webpacks recompilation.

## Usage:

```js
  var compiler = webpack(config);
  var webpackSimulator = new WebpackRecompilationHelper(compiler);

  webpackSimulator.run()  
    .then(function(stats) {
      console.log('Initial compilation result:', stats);
      // Simulate a change to the main.js file
      webpackSimulator.simulateFileChange(__dirname + '/src/main.js', {
        banner: 'require("./demo.js");'
      });
      // Compile it again:
      return webpackSimulator.run();
    })
    .then(function(stats) {
      console.log('Partial compilation result:', stats);
    });
```

## Options

- `tmpDirectory`: In order to simulate file changes this util needs a temporary directory. Default: `process.cwd() + '/tmp/'`

