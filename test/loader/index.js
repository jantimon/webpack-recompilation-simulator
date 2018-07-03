module.exports = function(source) {
  // Store the processed data in a global so we can check them during testing
  module.exports.history.requests = module.exports.history.requests || [];
  module.exports.history.source = module.exports.history.source || [];
  module.exports.history.context = module.exports.history.context || [];
  // Remember the results
  module.exports.history.requests.push(this.request);
  module.exports.history.source.push(source);
  module.exports.history.context.push(this.context);
  // Just pass the source
  return source;
};
module.exports.history = {};
