"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dgram = require("dgram");
var dns = require("dns");
/** StatsD client */
var Client = (function () {
    function Client(
        /** The host to connect to default: localhost */
        hostOrOptions, 
        /** The port to connect to default: 8125 */
        port, 
        /** An optional prefix to assign to each stat name sent */
        prefix, 
        /** An optional suffix to assign to each stat name sent */
        suffix, 
        /** An optional boolean to add "statsd" as an object in the global namespace */
        globalize, 
        /** An optional option to only lookup the hostname -> ip address once */
        cacheDns, 
        /** An optional boolean indicating this Client is a mock object, no stats are sent. */
        mock, 
        /** Optional tags that will be added to every metric */
        global_tags) {
        /** The host to connect to default: localhost */
        if (hostOrOptions === void 0) { hostOrOptions = 'localhost'; }
        if (port === void 0) { port = 8125; }
        if (prefix === void 0) { prefix = ''; }
        if (suffix === void 0) { suffix = ''; }
        if (globalize === void 0) { globalize = undefined; }
        if (cacheDns === void 0) { cacheDns = undefined; }
        if (mock === void 0) { mock = undefined; }
        if (global_tags === void 0) { global_tags = []; }
        var _this = this;
        this.port = port;
        this.prefix = prefix;
        this.suffix = suffix;
        this.globalize = globalize;
        this.cacheDns = cacheDns;
        this.mock = mock;
        this.global_tags = global_tags;
        this.unique = this.set;
        this.socket = dgram.createSocket('udp4');
        if (typeof hostOrOptions === 'object') {
            this.host = hostOrOptions.host;
            this.port = hostOrOptions.port;
            this.prefix = hostOrOptions.prefix || '';
            this.suffix = hostOrOptions.suffix || '';
            this.globalize = hostOrOptions.globalize;
            this.cacheDns = hostOrOptions.cacheDns;
            this.mock = hostOrOptions.mock;
            this.global_tags = hostOrOptions.global_tags || [];
        }
        else {
            this.host = hostOrOptions;
        }
        if (this.cacheDns === true) {
            dns.lookup(this.host, function (err, address, family) {
                if (err === null) {
                    _this.host = address;
                }
            });
        }
        if (this.globalize) {
            global.statsd = this;
        }
    }
    /**
     * Represents the timing stat
     * @param stat The stat(s) to send
     * @param time The time in milliseconds to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    Client.prototype.timing = function (stat, time, sampleRate, tags, callback) {
        this.sendAll(stat, time, 'ms', sampleRate, tags, callback);
    };
    Client.prototype.increment = function (stat, value, sampleRateOrTags, tagsOrCallback, callback) {
        this.sendAll(stat, value || 1, 'c', sampleRateOrTags, tagsOrCallback, callback);
    };
    /**
     * Decrements a stat by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    Client.prototype.decrement = function (stat, value, sampleRate, tags, callback) {
        this.sendAll(stat, -value || -1, 'c', sampleRate, tags, callback);
    };
    ;
    /**
     * Represents the histogram stat
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    Client.prototype.histogram = function (stat, value, sampleRate, tags, callback) {
        this.sendAll(stat, value, 'h', sampleRate, tags, callback);
    };
    ;
    /**
     * Gauges a stat by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    Client.prototype.gauge = function (stat, value, sampleRate, tags, callback) {
        this.sendAll(stat, value, 'g', sampleRate, tags, callback);
    };
    ;
    /**
     * Counts unique values by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    Client.prototype.set = function (stat, value, sampleRate, tags, callback) {
        this.sendAll(stat, value, 's', sampleRate, tags, callback);
    };
    ;
    Client.prototype.sendAll = function (stat, value, type, sampleRateOrTags, tagsOrCallback, callback) {
        var _this = this;
        var completed = 0, calledback = false, sentBytes = 0, tags, sampleRate;
        if (sampleRateOrTags && typeof sampleRateOrTags !== 'number' && typeof tagsOrCallback === 'function') {
            callback = tagsOrCallback;
            tags = sampleRateOrTags;
            sampleRate = undefined;
        }
        if (tagsOrCallback && !Array.isArray(tagsOrCallback)) {
            callback = tagsOrCallback;
            tags = undefined;
        }
        if (Array.isArray(stat)) {
            stat.forEach(function (item) { return _this.send(item, value, type, sampleRate, tags, onSend); });
        }
        else {
            this.send(stat, value, type, sampleRate, tags, callback);
        }
        /**
         * Gets called once for each callback, when all callbacks return we will
         * call back from the function
         * @private
         */
        function onSend(error, bytes) {
            completed += 1;
            if (calledback || typeof callback !== 'function') {
                return;
            }
            if (error) {
                calledback = true;
                return callback(error);
            }
            sentBytes += bytes;
            if (completed === stat.length) {
                callback(null, sentBytes);
            }
        }
    };
    /**
     * Sends a stat across the wire
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param type The type of message to send to statsd
     * @param sampleRate The Number of times to sample (0 to 1)
     * @param tags The Array of tags to add to metrics
     * @param callback Callback when message is done being delivered. Optional.
     */
    Client.prototype.send = function (stat, value, type, sampleRate, tags, callback) {
        var message = this.prefix + stat + this.suffix + ':' + value + '|' + type, buf, merged_tags = [];
        if (sampleRate && sampleRate < 1) {
            if (Math.random() < sampleRate) {
                message += '|@' + sampleRate;
            }
            else {
                //don't want to send if we don't meet the sample ratio
                return;
            }
        }
        if (tags && Array.isArray(tags)) {
            merged_tags = merged_tags.concat(tags);
        }
        if (this.global_tags && Array.isArray(this.global_tags)) {
            merged_tags = merged_tags.concat(this.global_tags);
        }
        if (merged_tags.length > 0) {
            message += '|#' + merged_tags.join(',');
        }
        // Only send this stat if we're not a mock Client.
        if (!this.mock) {
            buf = new Buffer(message);
            this.socket.send(buf, 0, buf.length, this.port, this.host, callback);
        }
        else {
            if (typeof callback === 'function') {
                callback(null, 0);
            }
        }
    };
    /**
     * Close the underlying socket and stop listening for data on it.
     */
    Client.prototype.close = function () {
        this.socket.close();
    };
    return Client;
}());
exports.default = Client;
exports.StatsD = Client;
