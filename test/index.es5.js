'use strict';

/* global beforeEach, afterEach, it, describe */
var WebpackRecompilationHelper = require('../src/index.js');
var assert = require('chai').assert;
var path = require('path');
var rimraf = require('rimraf');

var loaderMock = require('./loader');
var webpackConfig = function webpackConfig() {
  return {

    entry: { 'main': './src/main.js' },

    context: __dirname,

    module: {
      loaders: [{
        test: /\.js$/,
        loader: require.resolve('./loader')
      }]
    },

    // Config for our build files
    output: {
      path: __dirname + '/dist',
      filename: '[name].bundle.js',
      sourceMapFilename: '[name].map',
      chunkFilename: '[id].chunk.js'
    }
  };
};

function getBaseFileNames(files) {
  files = (files || []).map(function (filename) {
    return path.basename(filename);
  });
  files.sort();
  return files;
}

var webpackSimulator;
beforeEach(function () {
  var webpack = require('webpack');
  loaderMock.history = {};
  webpackSimulator = new WebpackRecompilationHelper(webpack(webpackConfig()));
  return webpackSimulator;
});

afterEach(function () {
  rimraf.sync(path.resolve(__dirname, '..', 'tmp'));
});

describe('webpackSimulator', function () {
  it('should throw an error if the file was not changed', function () {
    var catched = false;
    try {
      webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { banner: '' });
    } catch (e) {
      catched = true;
    }
    assert.equal(catched, true);
  });

  it('should load without a dependency by default', function () {
    return webpackSimulator.run().then(function (stats) {
      assert.deepEqual(['main.js'], getBaseFileNames(stats.compilation.fileDependencies));
    });
  });

  it('should allow adding a dependency as banner', function () {
    return webpackSimulator.run().then(function () {
      return webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { banner: 'require("./demo.js");' });
    }).then(function () {
      return webpackSimulator.run();
    }).then(function (stats) {
      assert.deepEqual(['demo.js', 'main.js'], getBaseFileNames(stats.compilation.fileDependencies));
    });
  });

  it('should allow adding a dependency as footer', function () {
    return webpackSimulator.run().then(function () {
      return webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { footer: 'require("./demo.js");' });
    }).then(function () {
      return webpackSimulator.run();
    }).then(function (stats) {
      assert.deepEqual(['demo.js', 'main.js'], getBaseFileNames(stats.compilation.fileDependencies));
    });
  });

  it('should allow to overwrite the content and add a new dependency', function () {
    return webpackSimulator.run().then(function () {
      return webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { content: 'require("./demo.js");' });
    }).then(function () {
      return webpackSimulator.run();
    }).then(function (stats) {
      var files = stats.compilation.fileDependencies.map(function (filename) {
        return path.basename(filename);
      });
      files.sort();
      assert.deepEqual(['demo.js', 'main.js'], getBaseFileNames(stats.compilation.fileDependencies));
    });
  });

  it('should change the compilation hash even if no new dependency was added', function () {
    var hash;
    return webpackSimulator.run().then(function (stats) {
      hash = stats.compilation.hash;
      webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { banner: '\n' });
      return webpackSimulator.run();
    }).then(function (stats) {
      assert.notEqual(hash, stats.compilation.hash);
    });
  });

  it('should not compile files if they were already run', function () {
    return webpackSimulator.run().then(function () {
      return loaderMock.history = {};
    }).then(function () {
      return webpackSimulator.run();
    }).then(function (stats) {
      assert.deepEqual([], getBaseFileNames(loaderMock.history.requests));
    });
  });

  it('should revaluate the changed file using the loader', function () {
    return webpackSimulator.run().then(function () {
      return webpackSimulator.run();
    }).then(function () {
      return loaderMock.history = {};
    }).then(function () {
      return webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { banner: 'console.log("modified");' });
    }).then(function () {
      return webpackSimulator.run();
    }).then(function (stats) {
      assert.deepEqual(['main.js'], getBaseFileNames(stats.compilation.fileDependencies));
      assert.deepEqual(['main.js'], getBaseFileNames(loaderMock.history.requests));
    });
  });

  it('should revaluate the changed file using the loader again', function () {
    return webpackSimulator.run().then(function () {
      return webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { banner: 'require("./demo.js");' });
    }).then(function () {
      return webpackSimulator.run();
    }).then(function () {
      return loaderMock.history = {};
    }).then(function () {
      return webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { banner: 'console.log("modified");' });
    }).then(function () {
      return webpackSimulator.run();
    }).then(function (stats) {
      assert.deepEqual(['main.js'], getBaseFileNames(loaderMock.history.requests));
    });
  });

  it('should revaluate only the modified dependency', function () {
    return webpackSimulator.run().then(function () {
      return webpackSimulator.simulateFileChange(__dirname + '/src/main.js', { banner: 'require("./demo.js");' });
    }).then(function () {
      return webpackSimulator.run();
    }).then(function () {
      return loaderMock.history = {};
    }).then(function () {
      return webpackSimulator.simulateFileChange(__dirname + '/src/demo.js', { banner: 'console.log("modified");' });
    }).then(function () {
      return webpackSimulator.run();
    }).then(function (stats) {
      assert.deepEqual(['demo.js'], getBaseFileNames(loaderMock.history.requests));
    });
  });
});

