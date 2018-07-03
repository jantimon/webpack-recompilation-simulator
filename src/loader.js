/**
 * @file This file loads the file context from another location
 *
 * Usage:
 *
 * `tempLoader!main.js?/path/to/other/file.js` -> will return the content of /path/to/other/file.js
 *
 */

const fs = require('fs');

/**
 * The tempLoader which returns the content of the query value
 *
 * @type {(this: any) => string}
 */
function tempLoader() {
  // Strip the ?
  // e.g. ?/some/path/file.js -> /some/path/file.js
  const targetFile = this.query.substr(1);
  // Add the tmp file as dependency
  this.addDependency(targetFile);
  // Return the tmp files content
  return fs.readFileSync(targetFile).toString('utf-8');
}

module.exports = tempLoader;
