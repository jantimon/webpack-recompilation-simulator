// @ts-check
/** @typedef {import('webpack').Compiler} WebpackCompiler */
/** @typedef {import('webpack/lib/Compiler')} Compiler */
/** @typedef {import('webpack/lib/Compilation')} Compilation */
/** @typedef {import('webpack/lib/Watching')} Watching */
/** @typedef {import('webpack/lib/Stats')} Stats */


"use strict";
const tempfs = require("temp-fs");
const fs = require("fs");
const path = require("path");

module.exports = class WebpackRecompilationHelper {
  /**
   * @param {WebpackCompiler | Compiler} compiler
   * @param {{ tmpDirectory?: string }} [options]
   */
  constructor(compiler, options) {
    this.compiler = /** @type {Compiler} */ (compiler);
    this.options = options || {};
    /** @type {{files: {[key:string] : string}}} */
    this.mappings = { files: {}};
    this.runCount = 0;
    // The tmp direcotry for the modified files
    this.tmpDirectory = this.options.tmpDirectory;
    // As we don't want to change the real source files we tell webpack to use
    // a laoder which takes the source from a the tmp directory
    this.compiler.hooks.normalModuleFactory.tap(
      "WebpackRecompilationSimulator",
      nmf => {
        nmf.hooks.afterResolve.tapAsync(
          "WebpackRecompilationSimulator",
          (data, callback) => {
            return callback(null, this._injectTmpLoader(data));
          }
        );
      }
    );

  }

  /**
   * This function creates a tmp version of the given file and modifies it
   * and will add the mapping so this file will be used during the next compilation
   *
   * @param {string} filename - The absolute path to the source file e.g. /a/path/main.js
   * @param {{banner?: string, footer?: string, content?: string}} options - You have to set options.banner, options.footer or options.content to modify the file
   */
  simulateFileChange(filename, options) {
    options = options || {};
    filename = path.resolve(this.compiler.context, filename);
    const tmpFile = this.mappings.files[filename];
    if (!tmpFile) {
      throw new Error(`There is no mapping for ${filename}`);
    }
    const originalFileContent = fs.readFileSync(filename).toString();
    const banner = options.banner || "";
    const footer = options.footer || "";
    let content = options.content;
    if (content === undefined) {
      content = banner + originalFileContent + footer;
    }
    if (content === originalFileContent) {
      throw new Error("File was not changed");
    }
    fs.writeFileSync(tmpFile, content);
  }

  /**
   * Add a mapping so that webpack will use the targetFile instead of the sourceFile
   * during compilation
   * @param {string} filename
   * @returns {string}
   */
  addTestFile(filename) {
    if (this.runCount !== 0) {
      throw new Error("A test file can only be added before the first run");
    }
    const tmpDir = tempfs.mkdirSync({
      dir: this.tmpDirectory,
      track: true,
      recursive: true
    });
    const resolvedFilename = path.resolve(this.compiler.context, filename);
    const originalFileContent = fs.readFileSync(resolvedFilename).toString();
    const tmpFolder = fs.realpathSync(`${tmpDir.path}`);
    const tmpFile = path.join(tmpFolder, '__' + path.basename(resolvedFilename));
    fs.writeFileSync(tmpFile, originalFileContent);
    const tmpFileTime = this._getTempCreationFileTime();
    fs.utimesSync(tmpFile, tmpFileTime, tmpFileTime);
    this.mappings.files[resolvedFilename] = tmpFile;
    return tmpFile;
  }

  /**
   * Create a timestamp 10 seconds in the past which is save to be used in webpack.
   *
   * sokra: "set the mtime on the written file to some value 2 seconds in the past. Because of fs accuracy we can't be sure that the file hasn't
   * changed with looking at the timestamp and the watcher is not yet in place."
   */
  _getTempCreationFileTime() {
    var time = new Date();
    time.setSeconds(time.getSeconds() - 10);
    return time;
  }

  /**
   * This function will inject the `./loader.js` file for every file
   * which was added with `webpackRecompilationHelper.addTestFile`
   *
   * The `./loader.js` will add the temp file as file dependency and
   * pass the content from the temp file to webpack
   */
  _injectTmpLoader(data) {
    const requestParts = data.request.split("!");
    const requestedFile = path.resolve(data.context, requestParts.pop());
    // If a mapping from addTestFile exists add the loader
    if (this.mappings.files[requestedFile]) {
      data.loaders.push({
        loader: require.resolve('./loader.js'),
        // The path to the temporary file
        options: this.mappings.files[requestedFile]
     });
    }

    return data;
  }

  /**
   * Single compile run
   *
   * @returns {Promise<Stats>}
   */
  run() {
    this.runCount++;
    return new Promise((resolve, reject) =>
      // Wait for 10ms before starting the compile run
      setTimeout(
        () => {
          this.compiler.run(
            /**
              @param {any} err
              @param {Stats} stats
            */
            (err, stats) => {
              if (err) {
                return reject(err);
              }
              if (stats.compilation.errors.length) {
                return reject(stats.compilation.errors);
              }
              // Wait for the next tick before resolving to allow all
              // plugins to finish
              process.nextTick(() => resolve(stats));
            })
          },
        10
      )
    );
  }

  /**
   * Start the webpack watch mode.
   * Webpack will compile the current sources and track the file system for changes.
   *
   * @returns {Promise<Stats>} A promise of the initial compilation
   */
  startWatching() {
    // Internal util to create a deferred which can be used by waitForWatchRunPromise
    let watchRunDeferred;
    const setupWatchRunPromise = () => {
      this.watchRunPromise = new Promise((resolve, reject) => {
        watchRunDeferred = {
          resolve,
          reject
        }
      });
    }
    // Create the initial waitForWatchRunPromise
    setupWatchRunPromise();
    // Start watching - this will always create an inital compilation
    /**
     * @type {Watching}
     */
    this.watcher = this.compiler.watch({aggregateTimeout: 50},
      /**
        @param {any} err
        @param {Stats} stats
      */
     (err, stats) => {
      process.nextTick(() => {
        const {resolve, reject} = watchRunDeferred;
        setupWatchRunPromise();
        if (err) {
          return reject(err);
        }
        if (stats.compilation.errors.length) {
          return reject(stats.compilation.errors);
        }
        resolve(stats);
      });
    });
    // Return the promise of the initial compilation
    if (!this.watchRunPromise) {
      throw new Error('Watch mode was not started');
    }
    return this.watchRunPromise;
  }

  /**
   * Wait until the next watch run succeeded
   *
   * @returns {Promise<Stats>}
   */
  waitForWatchRunComplete() {
    if (this.watcher.closed) {
      throw new Error('Watcher has already been closed.');
    }
    if (!this.watchRunPromise) {
      throw new Error('Watch mode was not started');
    }
    return this.watchRunPromise;
  }

  /**
   * Stop the watch mode
   *
   * @returns {Promise<Stats>}
   */
  stopWatching() {
    return new Promise((resolve) => {
      if (this.watcher) {
        this.watcher.close(resolve);
        this.watcher = undefined;
      } else {
        resolve();
      }
    });
  }

};
