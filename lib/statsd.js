var dgram = require('dgram'),
    dns   = require('dns');

/**
 * @const
 */
var DEFAULT_MAX_BATCH_DELAY = 1000;

/**
 * @const
 */
var DEFAULT_MAX_BATCH_LENGTH = 1500;

/**
 * The UDP Client for StatsD
 * @param options
 *   @option host            {String}  The host to connect to default: localhost
 *   @option port            {String|Integer} The port to connect to default: 8125
 *   @option prefix          {String}  An optional prefix to assign to each stat name sent
 *   @option suffix          {String}  An optional suffix to assign to each stat name sent
 *   @option globalize       {boolean} An optional boolean to add "statsd" as an object in the global namespace
 *   @option cacheDns        {boolean} An optional option to only lookup the hostname -> ip address once
 *   @option mock            {boolean} An optional boolean indicating this Client is a mock object, no stats are sent.
 *   @option global_tags     {Array=} Optional tags that will be added to every metric
 *   @option batch           {boolean} Whether to send metrics in batches
 *   @option maxBatchDelay   {Integer} Maximum period for batch accumulation in millisecond
 *   @option maxBatchLength  {Integer} Maximum length of a packet, should not be more then the network MTU
 * @constructor
 */
var Client = function (host, port, prefix, suffix, globalize, cacheDns, mock, global_tags, batch, maxBatchDelay, maxBatchLength) {
  var options = host || {},
         self = this;

  if(arguments.length > 1 || typeof(host) === 'string'){
    options = {
      host            : host,
      port            : port,
      prefix          : prefix,
      suffix          : suffix,
      globalize       : globalize,
      cacheDns        : cacheDns,
      mock            : mock === true,
      global_tags     : global_tags,
      batch           : batch,
      maxBatchDelay   : maxBatchDelay,
      maxBatchLength  : maxBatchLength
    };
  }

  this.host        = options.host || 'localhost';
  this.port        = options.port || 8125;
  this.prefix      = options.prefix || '';
  this.suffix      = options.suffix || '';
  this.socket      = dgram.createSocket('udp4');
  this.mock        = options.mock;
  this.global_tags = options.global_tags || [];
  this.batch       = options.batch;
  this.maxBatchDelay = options.maxBatchDelay || DEFAULT_MAX_BATCH_DELAY;
  this.maxBatchLength = options.maxBatchLength || DEFAULT_MAX_BATCH_LENGTH;

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

  if (options.batch) {
    this.pendingMessages = [];
    this.batchLength = 0;
  }
};

Client.prototype._sendBatch = function(batchCallback) {
    if (this.pendingMessages.length) {
      var batchMessage = this.pendingMessages.map(function(msg) { return msg.message; }).join('\n');
      var callbacks = this.pendingMessages.map(function(msg) { return msg.callback; });
      this._send(batchMessage, function(err) {
        if (typeof batchCallback === 'function') {
          batchCallback(err);
        }
        callbacks.forEach(function(callback) {
          if (typeof callback === 'function') {
            callback(err);
          }
        });
      });
      this.pendingMessages = [];
      this.batchLength = 0;
    } else if (typeof batchCallback === 'function') {
      batchCallback();
    }
};

Client.prototype._addToBatch = function(message, callback) {
  if (!!message) {
    if (this.batchLength + message.length > this.maxBatchLength) {
      this._sendBatch();
      // Reset the timer as we've just sent the batches
      if (this.sendTimeout) {
        clearTimeout(this.sendTimeout);
        this.sendTimeout = null;
      }
    } else if (!this.sendTimeout) {
      // If we are not sending a batch now and didn't have a send timeout yet
      // we need to init it to ensure this message will be sent not more that
      // after maxBatchDelay
      this.sendTimeout = setTimeout(this._sendBatch.bind(this), this.maxBatchDelay);
    }

    this.pendingMessages.push({
      message: message,
      callback: callback
    });
    this.batchLength += message.length;
  }
};

/**
 * Represents the timing stat
 * @param stat {String|Array} The stat(s) to send
 * @param time {Number} The time in milliseconds to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.timing = function (stat, time, sampleRate, tags, callback) {
  this.sendAll(stat, time, 'ms', sampleRate, tags, callback);
};

/**
 * Increments a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.increment = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, value || 1, 'c', sampleRate, tags, callback);
};

/**
 * Decrements a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.decrement = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, -value || -1, 'c', sampleRate, tags, callback);
};

/**
 * Represents the histogram stat
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.histogram = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, value, 'h', sampleRate, tags, callback);
};


/**
 * Gauges a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.gauge = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, value, 'g', sampleRate, tags, callback);
};

/**
 * Counts unique values by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number=} The Number of times to sample (0 to 1). Optional.
 * @param tags {Array=} The Array of tags to add to metrics. Optional.
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.unique =
Client.prototype.set = function (stat, value, sampleRate, tags, callback) {
  this.sendAll(stat, value, 's', sampleRate, tags, callback);
};

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
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param type {String} The type of message to send to statsd
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param tags {Array} The Array of tags to add to metrics
 * @param callback {Function=} Callback when message is done being delivered. Optional.
 */
Client.prototype.send = function (stat, value, type, sampleRate, tags, callback) {
  var message = this.prefix + stat + this.suffix + ':' + value + '|' + type,
      buf,
      merged_tags = [];

  if(sampleRate && sampleRate < 1){
    if(Math.random() < sampleRate){
      message += '|@' + sampleRate;
    } else {
      //don't want to send if we don't meet the sample ratio
      return;
    }
  }

  if(tags && Array.isArray(tags)){
    merged_tags = merged_tags.concat(tags);
  }
  if(this.global_tags && Array.isArray(this.global_tags)){
    merged_tags = merged_tags.concat(this.global_tags);
  }
  if(merged_tags.length > 0){
    message += '|#' + merged_tags.join(',');
  }

  if (this.batch) {
    this._addToBatch(message, callback);
  } else {
    this._send(message, callback);
  }
};

Client.prototype._send = function(message, callback) {
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
 * Close the underlying socket and stop listening for data on it.
 */
Client.prototype.close = function() {
  var self = this;
    if (self.batch) {
      // Clear the send timeout
      if (self.sendTimeout) {
        clearTimeout(this.sendTimeout);
        self.sendTimeout = null;
      }
      // And send pending messages immediately
      self._sendBatch(function() {
        self.socket.close();
      });
    } else {
      self.socket.close();
    }
};

exports = module.exports = Client;
exports.StatsD = Client;
