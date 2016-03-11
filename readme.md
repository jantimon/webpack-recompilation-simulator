# Webpack recompilation helper

This is just a small util to test and measure caching
during webpacks recompilation.

## Usage:

```js
  var compiler = webpack(config);
  var webpackSimulator = new WebpackRecompilationHelper(comiler);

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

- `tmpDirectory`: In order to simulate file changes this util needs a temp directory. Default: `process.cwd() + '/tmp/'

