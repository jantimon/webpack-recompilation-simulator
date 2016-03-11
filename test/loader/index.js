module.exports = function (source) {
  // This loader is cacheable:
  this.cacheable();
  // Store the processed data in a global so we can check them during testing
  module.exports.history.requests = module.exports.history.requests || [];
  module.exports.history.source = module.exports.history.source || [];
  module.exports.history.requests.push(this.request);
  module.exports.history.source.push(source);
  // Just pass the source
  return source;
};
module.exports.history = {};
