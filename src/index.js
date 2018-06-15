"use strict";
const tempfs = require("temp-fs");
const fs = require("fs");
const path = require("path");

module.exports = class WebpackRecompilationHelper {
  constructor(compiler, options) {
    this.compiler = compiler;
    this.options = options || {};
    this.mappings = { files: {}, folders: {} };
    this.runCount = 0;
    // The tmp direcotry for the modified files
    this.tmpDirectory = this.options.tmpDirectory;
    // As we don't want to change the real source files we tell webpack to use
    // a version in the tmp directory
    compiler.hooks.normalModuleFactory.tap(
      "WebpackRecompilationSimulator",
      nmf => {
        nmf.hooks.beforeResolve.tapAsync(
          "WebpackRecompilationSimulator",
          (data, callback) => {
            return callback(null, this._resolveDependency(data));
          }
        );
      }
    );
    // Store the stats after the compilation is done
    compiler.hooks.done.tap("WebpackRecompilationSimulator", stats => {
      this.stats = stats;
    });
  }

  /**
   * This function creates a tmp version of the given file and modifies it
   * and will add the mapping so this file will be used during the next compilation
   *
   * @param {string} filename - The absolute path to the source file e.g. /a/path/main.js
   * @param {object} options - You have to set options.banner, options.footer or options.content to modify the file
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
    const tmpFolder = fs.realpathSync(tmpDir.path);
    const tmpFile = path.join(tmpFolder, path.basename(resolvedFilename));
    fs.writeFileSync(tmpFile, originalFileContent);
    this.mappings.files[resolvedFilename] = tmpFile;
    this.mappings.folders[tmpFolder] = path.dirname(resolvedFilename);
  }

  /**
   * @private
   *
   * This function uses the mapping to compile the fake file instead of the real source file
   */
  _resolveDependency(data) {
    // Context mapping
    data.context = this.mappings.folders[data.context] || data.context;
    // File mapping
    const requestParts = data.request.split("!");
    const requestedFile = path.resolve(data.context, requestParts.pop());
    if (this.mappings.files[requestedFile]) {
      requestParts.push(this.mappings.files[requestedFile]);
      data.request = requestParts.join("!");
    }
    return data;
  }

  /**
   * Compile
   */
  run() {
    this.runCount++;
    return new Promise((resolve, reject) =>
      // Wait for 10ms before starting the compile run
      setTimeout(
        () =>
          this.compiler.run((err, stats) => {
            if (err) {
              return reject(err);
            }
            if (this.stats.errors) {
              return reject(errors);
            }
            // Wait for the next tick before resolving to allow all
            // plugins to finish
            process.nextTick(() => resolve(this.stats));
          }),
        10
      )
    );
  }
};
