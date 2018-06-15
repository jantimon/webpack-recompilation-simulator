/* global beforeEach, it, describe */
const WebpackRecompilationHelper = require("../src/");
const webpack = require("webpack");
const assert = require("chai").assert;
const path = require("path");

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
  return files;
}

let webpackSimulator;
beforeEach(function(done) {
  loaderMock.history = {};
  webpackSimulator = new WebpackRecompilationHelper(webpack(webpackConfig()));
  done();
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
    webpackSimulator = new WebpackRecompilationHelper(webpack(config));
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

  it("should not compile files if they were already run", function() {
    webpackSimulator.addTestFile("./src/main.js");
    return webpackSimulator
      .run()
      .then(() => {
        loaderMock.history.requests = [];
      })
      .then(() => webpackSimulator.run())
      .then(() => {
        assert.deepEqual([], loaderMock.history.requests);
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
});
