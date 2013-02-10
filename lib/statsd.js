var dgram = require('dgram');

/**
 * The UDP Client for StatsD
 * @param host The host to connect to default: localhost
 * @param port The port to connect to default: 8125
 * @param prefix An optional prefix to assign to each stat name sent
 * @param suffix An optional suffix to assign to each stat name sent
 * @param globalize An optional boolean to add "statsd" as an object in the global namespace
 * @constructor
 */
var Client = function (host, port, prefix, suffix, globalize) {
  this.host = host || 'localhost';
  this.port = port || 8125;
  this.prefix = prefix || '';
  this.suffix = suffix || '';
  this.socket = dgram.createSocket('udp4');

  if(globalize){
    global.statsd = this;
  }
};

/**
 * Represents the timing stat
 * @param stat {String|Array} The stat(s) to send
 * @param time {Number} The time in milliseconds to send
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.timing = function (stat, time, sampleRate, callback) {
  this.sendAll(stat, time, 'ms', sampleRate, callback);
};

/**
 * Increments a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.increment = function (stat, value, sampleRate, callback) {
  this.sendAll(stat, value || 1, 'c', sampleRate, callback);
};

/**
 * Decrements a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.decrement = function (stat, value, sampleRate, callback) {
  this.sendAll(stat, -value || -1, 'c', sampleRate, callback);
};

/**
 * Gauges a stat by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.gauge = function (stat, value, sampleRate, callback) {
  this.sendAll(stat, value, 'g', sampleRate, callback);
};

/**
 * Counts unique values by a specified amount
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.unique =
Client.prototype.set = function (stat, value, sampleRate, callback) {
  this.sendAll(stat, value, 's', sampleRate, callback);
};

/**
 * Checks if stats is an array and sends all stats calling back once all have sent
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.sendAll = function(stat, value, type, sampleRate, callback){
  var completed = 0,
      self = this;

  /**
   * Gets called once for each callback, when all callbacks return we will
   * call back from the function
   * @private
   */
  function onSend(){
    completed += 1;
    if(completed === stat.length){
      if(typeof callback === 'function'){
        callback();
      }
    }
  }

  if(Array.isArray(stat)){
    stat.forEach(function(item){
      self.send(item, value, type, sampleRate, onSend);
    });
  } else {
    this.send(stat, value, type, sampleRate, callback);
  }
};

/**
 * Sends a stat across the wire
 * @param stat {String|Array} The stat(s) to send
 * @param value The value to send
 * @param type {String} The type of message to send to statsd
 * @param sampleRate {Number} The Number of times to sample (0 to 1)
 * @param callback {Function} Callback when message is done being delivered. Optional.
 */
Client.prototype.send = function (stat, value, type, sampleRate, callback) {
  var message = this.prefix + stat + this.suffix + ':' + value + '|' + type,
      buf;

  if(sampleRate && sampleRate < 1){
    if(Math.random() < sampleRate){
      message += '|@' + sampleRate;
    } else {
      //don't want to send if we don't meet the sample ratio
      return;
    }
  }

  buf = new Buffer(message);
  this.socket.send(buf, 0, buf.length, this.port, this.host, callback);
};


exports.StatsD = Client;
