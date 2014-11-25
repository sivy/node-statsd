var dgram = require('dgram'),
    dns   = require('dns');

var functions = {};

/**
 * Represents the timing stat
 * @param stat {String|Array} The stat(s) to send
 * @param time {Number} The time in milliseconds to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
functions.timing = function (method) {
  return function (stat, time, sampleRate, tags, callback) {
    return this[method](stat, time, 'ms', sampleRate, tags, callback);
  };
};

/**
 * Increments a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
functions.increment = function (method) {
  return function (stat, value, sampleRate, tags, callback) {
    return this[method](stat, value || 1, 'c', sampleRate, tags, callback);
  };
};

/**
 * Decrements a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
functions.decrement = function (method) {
  return function (stat, value, sampleRate, tags, callback) {
    return this[method](stat, -value || -1, 'c', sampleRate, tags, callback);
  };
};

/**
 * Represents the histogram stat
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
functions.histogram = function (method) {
  return function (stat, value, sampleRate, tags, callback) {
    return this[method](stat, value, 'h', sampleRate, tags, callback);
  };
};


/**
 * Gauges a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
functions.gauge = function (method) {
  return function (stat, value, sampleRate, tags, callback) {
    return this[method](stat, value, 'g', sampleRate, tags, callback);
  };
};

/**
 * Counts unique values by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
functions.unique =
functions.set = function (method) {
  return function (stat, value, sampleRate, tags, callback) {
    return this[method](stat, value, 's', sampleRate, tags, callback);
  }
};

/**
 * The UDP Client for StatsD
 * @param options
 *   @option host      {String}  The host to connect to default: localhost
 *   @option port      {String|Integer} The port to connect to default: 8125
 *   @option prefix    {String}  An optional prefix to assign to each stat name sent
 *   @option suffix    {String}  An optional suffix to assign to each stat name sent
 *   @option globalize {boolean} An optional boolean to add "statsd" as an object in the global namespace
 *   @option cacheDns  {boolean} An optional option to only lookup the hostname -> ip address once
 *   @option mock      {boolean} An optional boolean indicating this Client is a mock object, no stats are sent.
 * @constructor
 */
var Client = function (host, port, prefix, suffix, globalize, cacheDns, mock) {
  var options = host || {},
         self = this;

  if(arguments.length > 1 || typeof(host) === 'string'){
    options = {
      host      : host,
      port      : port,
      prefix    : prefix,
      suffix    : suffix,
      globalize : globalize,
      cacheDns  : cacheDns,
      mock      : mock === true
    };
  }

  this.host   = options.host || 'localhost';
  this.port   = options.port || 8125;
  this.prefix = options.prefix || '';
  this.suffix = options.suffix || '';
  this.socket = dgram.createSocket('udp4');
  this.mock   = options.mock;

  if(options.cacheDns === true){
    dns.lookup(options.host, function(err, address, family){
      if(err == null){
        self.host = address;
      }
    });
  }

  if(options.globalize){
    global.statsd = this;
  }
};

Object.keys(functions).forEach(function(fn) {
  Client.prototype[fn] = functions[fn]('sendAll');
});

/**
 * Checks if stats is an array and sends all stats calling back once all have sent
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.sendAll = function(stat, value, type, sampleRate, tags, callback){
  var completed = 0,
      calledback = false,
      sentBytes = 0,
      self = this;

  if(sampleRate && typeof sampleRate !== 'number'){
    callback = tags;
    tags = sampleRate;
    sampleRate = undefined;
  }

  if(tags && !Array.isArray(tags)){
    callback = tags;
    tags = undefined;
  }

  /**
   * Gets called once for each callback, when all callbacks return we will
   * call back from the function
   * @private
   */
  function onSend(error, bytes){
    completed += 1;
    if(calledback || typeof callback !== 'function'){
      return;
    }

    if(error){
      calledback = true;
      return callback(error);
    }

    sentBytes += bytes;
    if(completed === stat.length){
      callback(null, sentBytes);
    }
  }

  if(Array.isArray(stat)){
    stat.forEach(function(item){
      self.send(item, value, type, sampleRate, tags, onSend);
    });
  } else {
    this.send(stat, value, type, sampleRate, tags, callback);
  }
};

/**
 * Sends a stat across the wire
 * @param stat {String} The stat to send
 * @param value The value to send
 * @param type {String} The type of message to send to statsd
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param tags {Array} The Array of tags to add to metrics
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.send = function (stat, value, type, sampleRate, tags, callback) {
  var message = this.message(stat, value, type, sampleRate, tags);
  this.sendMessage(message, callback);
};

/**
 * Checks if stat is an array and returns an array of messages
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 */
Client.prototype.allMessages = function(stat, value, type, sampleRate, tags) {
  var self = this;
  var stats = Array.isArray(stat) ? stat : [stat];
  return stats.map(function(item) {
    return self.message(item, value, type, sampleRate, tags);
  }).filter(function(item) {
    return !!item;
  });
};

/**
 * Creates the message
 * @param stat {String} The stat to send
 * @param value The value to send
 * @param type {String} The type of message to send to statsd
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param tags {Array} The Array of tags to add to metrics
 */
Client.prototype.message = function(stat, value, type, sampleRate, tags) {
  var message = this.prefix + stat + this.suffix + ':' + value + '|' + type;

  if(sampleRate && sampleRate < 1){
    if(Math.random() < sampleRate){
      message += '|@' + sampleRate;
    } else {
      //don't want to send if we don't meet the sample ratio
      return null;
    }
  }

  if(tags && Array.isArray(tags)){
    message += '|#' + tags.join(',');
  }

  return message;
};

/**
 * Sends a stat message across the wire
 * @param message {String} the full StatsD message
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.sendMessage = function(message, callback) {
  var buf;

  // Only send this stat if we're not a mock Client.
  if(!this.mock) {
    buf = new Buffer(message);
    this.socket.send(buf, 0, buf.length, this.port, this.host, callback);
  } else {
    if(typeof callback === 'function'){
      callback(null, 0);
    }
  }
};

/**
 * Returns a multi object that allows you to send multiple metrics at once
 */
Client.prototype.multi = function() {
  return new Multi(this);
};

/**
 * Close the underlying socket and stop listening for data on it.
 */
Client.prototype.close = function(){
    this.socket.close();
}

exports = module.exports = Client;
exports.StatsD = Client;

/**
 * The Multi class that allows you to send multiple metrics at once
 */
var Multi = function (client) {
  this.client = client;
  this.messages = [];
};

/**
 * Send the multi-metric
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Multi.prototype.send = function(callback) {
  if (!this.messages.length) {
    if(typeof callback === 'function'){
      callback(null, 0);
    }
    return;
  }

  var message = this.messages.join('\n');
  this.client.sendMessage(message, callback);
};

Object.keys(functions).forEach(function(fn) {
  Multi.prototype[fn] = function() {
    var messages = functions[fn]('allMessages').apply(this.client, arguments);
    this.messages = this.messages.concat(messages);
  };
});

