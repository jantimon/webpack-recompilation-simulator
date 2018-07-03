/* global beforeEach, it, describe */
// @ts-check
/** @typedef {import('webpack').Configuration} Configuration */
const webpack = require('webpack');
const WebpackRecompilationHelper = require("../src/");
const assert = require("chai").assert;
const path = require("path");
const fs = require("fs");


const loaderMock = require("./loader");
const webpackConfig = () => ({
  // Webpack will only cache in "development" mode
  // See https://github.com/webpack/webpack/issues/7533
  mode: "development",

  entry: { main: "./src/main.js" },

  context: __dirname,

  module: {
    rules: [
      {
        test: /\.js$/,
        loader: require.resolve("./loader")
      }
    ]
  },

  // Config for our build files
  output: {
    path: __dirname + "/dist",
    filename: "[name].bundle.js",
    sourceMapFilename: "[name].map",
    chunkFilename: "[id].chunk.js"
  }
});

function getBaseFileNames(files) {
  files = Array.from(files || []).map(filename => path.basename(filename));
  files.sort();
  // Ignore tmp files:
  const filesWithoutTmpFiles = files.filter((filename) => filename.indexOf('__') !== 0);
  return filesWithoutTmpFiles;
}

let webpackSimulator;
beforeEach(function(done) {
  loaderMock.history = {};
  const config = webpackConfig();
  const compiler = webpack(/** @type {Configuration} */(config));
  webpackSimulator = new WebpackRecompilationHelper(compiler);
  done();
});

afterEach(function(done) {
  webpackSimulator.stopWatching().then(done);
});

describe("webpackSimulator", function() {
  it("should throw an error if the file has not mapping", function() {
    let message;
    try {
      webpackSimulator.simulateFileChange(__dirname + "/src/main.js", {
        banner: ""
      });
    } catch (e) {
      message = e.message;
    }
    assert.equal(
      message,
      "There is no mapping for " + path.join(__dirname, "src", "main.js")
    );
  });

  it("should load without a dependency by default", function() {
    return webpackSimulator.run().then(function(stats) {
      assert.deepEqual(
        ["main.js"],
        getBaseFileNames(stats.compilation.fileDependencies)
      );
    });
  });

  it("should allow adding a dependency as banner", function() {
    webpackSimulator.addTestFile("./src/main.js");

    return webpackSimulator
      .run()
      .then(() =>
        webpackSimulator.simulateFileChange("./src/main.js", {
          banner: 'require("./demo.js");'
        })
      )
      .then(() => webpackSimulator.run())
      .then(function(stats) {
        assert.deepEqual(
          ["demo.js", "main.js"],
          getBaseFileNames(stats.compilation.fileDependencies)
        );
      });
  });

  it("should allow adding a dependency as footer", function() {
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(() =>
        webpackSimulator.simulateFileChange(__dirname + "/src/main.js", {
          footer: 'require("./demo.js");'
        })
      )
      .then(() => webpackSimulator.run())
      .then(function(stats) {
        assert.deepEqual(
          ["demo.js", "main.js"],
          getBaseFileNames(stats.compilation.fileDependencies)
        );
      });
  });

  it("should allow to overwrite the content and add a new dependency", function() {
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(() =>
        webpackSimulator.simulateFileChange(__dirname + "/src/main.js", {
          content: 'require("./demo.js");'
        })
      )
      .then(() => webpackSimulator.run())
      .then(function(stats) {
        assert.deepEqual(
          ["demo.js", "main.js"],
          getBaseFileNames(stats.compilation.fileDependencies)
        );
      });
  });

  it("should allow to overwrite the content even if a loader configuration is peresent", function() {
    const config = webpackConfig();
    config.entry.main = "!!" + config.entry.main;
    webpackSimulator = new WebpackRecompilationHelper(webpack(/** @type {Configuration} */(config)));
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(() =>
        webpackSimulator.simulateFileChange(__dirname + "/src/main.js", {
          content: 'require("./demo.js");'
        })
      )
      .then(() => webpackSimulator.run())
      .then(function(stats) {
        assert.deepEqual(
          ["demo.js", "main.js"],
          getBaseFileNames(stats.compilation.fileDependencies)
        );
      });
  });

  it("should change the compilation hash even if no new dependency was added", function() {
    var hash;
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(function(stats) {
        hash = stats.compilation.hash;
        webpackSimulator.simulateFileChange(__dirname + "/src/main.js", {
          banner: "\n"
        });
        return webpackSimulator.run();
      })
      .then(function(stats) {
        assert.notEqual(hash, stats.compilation.hash);
      });
  });

  it("should not execute the loader for files which have already been compiled (and cached)", function() {
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(() => {
        // Reset loader history
        loaderMock.history.requests = [];
      })
      .then(() => webpackSimulator.run())
      .then(() => {
        // Because of the webpack cache the
        // loader must not have been called
        assert.deepEqual([], loaderMock.history.requests);
      });
  });

  it("should execute loaders in the real files context", function() {
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(() => webpackSimulator.run())
      .then(() => {
        assert.deepEqual(loaderMock.history.context, [path.resolve(__dirname, 'src/')]);
      });
  });

  it("should revaluate the changed file using the loader", function() {
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(() => webpackSimulator.run())
      .then(() => (loaderMock.history = {}))
      .then(() =>
        webpackSimulator.simulateFileChange(__dirname + "/src/main.js", {
          banner: 'console.log("modified");'
        })
      )
      .then(() => webpackSimulator.run())
      .then(function(stats) {
        assert.deepEqual(
          ["main.js"],
          getBaseFileNames(stats.compilation.fileDependencies)
        );
        assert.deepEqual(
          ["main.js"],
          getBaseFileNames(loaderMock.history.requests)
        );
      });
  });

  it("should revaluate the changed file using the loader again", function() {
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(() =>
        webpackSimulator.simulateFileChange("./src/main.js", {
          banner: 'require("./demo.js");'
        })
      )
      .then(() => webpackSimulator.run())
      .then(() => (loaderMock.history = {}))
      .then(() =>
        webpackSimulator.simulateFileChange("./src/main.js", {
          banner: "// Second modification"
        })
      )
      .then(() => webpackSimulator.run())
      .then(function(stats) {
        assert.deepEqual(
          ["main.js"],
          getBaseFileNames(loaderMock.history.requests)
        );
      });
  });

  it("should revaluate only the modified dependency", function() {
    webpackSimulator.addTestFile("./src/main.js");
    webpackSimulator.addTestFile("./src/demo.js");
    return webpackSimulator
      .run()
      .then(() =>
        webpackSimulator.simulateFileChange(__dirname + "/src/main.js", {
          banner: 'require("./demo.js");'
        })
      )
      .then(() => webpackSimulator.run())
      .then(() => (loaderMock.history = {}))
      .then(() =>
        webpackSimulator.simulateFileChange(__dirname + "/src/demo.js", {
          banner: 'console.log("modified");'
        })
      )
      .then(() => webpackSimulator.run())
      .then(function(stats) {
        assert.deepEqual(
          ["demo.js"],
          getBaseFileNames(loaderMock.history.requests)
        );
      });
  });

  it("should not compile twice during watch mode initialisation", function() {
    const filename = webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator.startWatching().then(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => resolve('timeout'), 300);
          webpackSimulator.waitForWatchRunComplete().then(resolve);
        });
      }).then((result) => {
        assert.equal(result, 'timeout');
        assert.equal(webpackSimulator.watcher.running, false);
      });
  });

  it("should compile once a watched dependency is changed", function() {
    const temporaryFileName = webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator.startWatching().then(() => {
          fs.writeFileSync(temporaryFileName, '// Modified');
          return webpackSimulator.waitForWatchRunComplete();
      }).then((stats) => {
        assert.deepEqual(
          ["main.js"],
          getBaseFileNames(stats.compilation.fileDependencies)
        );
      });
  });

});
