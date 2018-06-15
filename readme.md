# Webpack Recompilation Simulator [![npm version](https://badge.fury.io/js/webpack-recompilation-simulator.svg)](http://badge.fury.io/js/webpack-recompilation-simulator) [![Dependency Status](https://david-dm.org/jantimon/webpack-recompilation-simulator.svg)](https://david-dm.org/jantimon/webpack-recompilation-simulator)  [![Build Status](https://travis-ci.org/jantimon/webpack-recompilation-simulator.svg?branch=master)](https://travis-ci.org/jantimon/webpack-recompilation-simulator) [![Windows build status](https://ci.appveyor.com/api/projects/status/github/jantimon/webpack-recompilation-simulator?svg=true&branch=master)](https://ci.appveyor.com/project/jantimon/webpack-recompilation-simulator)

If you are writting a webpack loader or a webpack plugin you might want to test the efficiency of your
caching solutions.

The Webpack Recompilation Simulator allows you to run the webpack compilation multiple times and also to simulate file changes on the real file system just like a user would do.

## How does it work?

The simulator hooks into webpack using the `beforeResolve` hook of the `normalModuleFactory`.  
Inside the `beforeResolve` hook it will map all files you want to modify during your tests to a temporary file on the disk.  

The temporary files are stored using [temp-fs](https://www.npmjs.com/package/temp-fs) and can be altered using the `simulateFileChange` method provided by the Webpack Recompilation Simulator.


## Api
  
### Creating a new instance

To create an instance of the Webpack Recompilation Simulator you have to pass a webpack compiler:

```js
const compiler = webpack(config);
const webpackSimulator = new WebpackRecompilationSimulator(compiler);
```

### Add all files you might want to modify during your test

To make sure that webpack will add the correct file dependencies we have to add the test files before we
run any tests:

```js
webpackSimulator.addTestFile(__dirname + '/src/main.js');
```

### Start a compilation

The webpack simulator will start a new compiler run: 

```js
webpackSimulator
  .run()  
  .then(function(stats) {
    console.log(stats);
  });
```

### Simulate a file change

You can prepend a banner, append a footer or replace the entire content of the file.  
Make sure that you added it using `addTestFile`.

```js
    webpackSimulator.simulateFileChange(testFilePath, {
      banner: '/* Add a header */'
    });
```

```js
    webpackSimulator.simulateFileChange(testFilePath, {
      content: '/* Overwrite the entire file */'
    });
```

```js
    webpackSimulator.simulateFileChange(testFilePath, {
      footer: '/* Add a footer */'
    });
```

## Usage:

```js
  const compiler = webpack(config);
  const webpackSimulator = new WebpackRecompilationHelper(compiler);
  
  const testFilePath = __dirname + '/src/main.js';
  webpackSimulator.addTestFile(testFilePath);

  webpackSimulator.run()  
    .then(function(stats) {
      console.log('Initial compilation result:', stats);
      // Simulate a change to the main.js file
      webpackSimulator.simulateFileChange(testFilePath, {
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

## Motiviation

The Webpack Recompilation Simulator is used to test the https://github.com/jantimon/html-webpack-plugin

## Requirements

+ Webpack 4
+ Node 6+

## Known Issues

+ [Webpack will only cache loaders in development mode](https://github.com/webpack/webpack/issues/7533)
