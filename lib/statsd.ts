import * as dgram from 'dgram';
import * as dns from 'dns';

/** A NodeJS style callback function that may resolve to a number */
export type CallbackFn = (error: NodeJS.ErrnoException | null, value?: number) => void;

export type ClientOptions = {
    host: string;
    /** The port to connect to default: 8125 */
    port: number;
    /** An optional prefix to assign to each stat name sent */
    prefix: string;
    /** An optional suffix to assign to each stat name sent */
    suffix: string;
    /** An optional boolean to add "statsd" as an object in the global namespace */
    globalize: boolean | undefined;
    /** An optional option to only lookup the hostname -> ip address once */
    cacheDns: boolean | undefined;
    /** An optional boolean indicating this Client is a mock object, no stats are sent. */
    mock: boolean | undefined;
    /** Optional tags that will be added to every metric */
    global_tags: string[];
}

/** StatsD client */
export default class Client {
    public unique = this.set;

    private socket = dgram.createSocket('udp4');
    private host: string;

    constructor(
        /** Initialization options */
        hostOrOptions: ClientOptions
    )
    constructor(
        /** The host to connect to default: localhost */
        hostOrOptions: string | ClientOptions = 'localhost',
        /** The port to connect to default: 8125 */
        private port: number = 8125,
        /** An optional prefix to assign to each stat name sent */
        private prefix: string = '',
        /** An optional suffix to assign to each stat name sent */
        private suffix: string = '',
        /** An optional boolean to add "statsd" as an object in the global namespace */
        private globalize: boolean | undefined = undefined,
        /** An optional option to only lookup the hostname -> ip address once */
        private cacheDns: boolean | undefined = undefined,
        /** An optional boolean indicating this Client is a mock object, no stats are sent. */
        private mock: boolean | undefined = undefined,
        /** Optional tags that will be added to every metric */
        private global_tags: string[] = [],
    ) {
        if (typeof hostOrOptions === 'object') {
            this.host = hostOrOptions.host;
            this.port = hostOrOptions.port;
            this.prefix = hostOrOptions.prefix || '';
            this.suffix = hostOrOptions.suffix || '';
            this.globalize = hostOrOptions.globalize;
            this.cacheDns = hostOrOptions.cacheDns;
            this.mock = hostOrOptions.mock;
            this.global_tags = hostOrOptions.global_tags || [];
        } else {
            this.host = hostOrOptions;
        }

        if (this.cacheDns === true) {
            dns.lookup(this.host, (err, address, family) => {
                if (err === null) {
                    this.host = address;
                }
            });
        }

        if (this.globalize) {
            (global as any).statsd = this;
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
    timing(stat: string | string[], time: number, sampleRate?: number, tags?: any[], callback?: CallbackFn) {
        this.sendAll(stat, time, 'ms', sampleRate, tags, callback);
    }

    /**
     * Increments a stat by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    increment(stats: string | string[], value: any, tags: string[], callback?: CallbackFn): void;
    increment(stats: string | string[], value: any, sampleRate: number, tags: string[], callback?: CallbackFn): void;
    increment(stat: string | string[], value: any, sampleRateOrTags?: number | string[], tagsOrCallback?: string[] | CallbackFn, callback?: CallbackFn) {

        this.sendAll(stat, value || 1, 'c', sampleRateOrTags as number, tagsOrCallback as string[], callback);
    }

    /**
     * Decrements a stat by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    decrement(stat: string | string[], value: any, sampleRate?: number, tags?: string[], callback?: CallbackFn) {
        this.sendAll(stat, -value || -1, 'c', sampleRate, tags, callback);
    };

    /**
     * Represents the histogram stat
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    histogram(stat: string | string[], value: any, sampleRate?: number, tags?: string[], callback?: CallbackFn) {
        this.sendAll(stat, value, 'h', sampleRate, tags, callback);
    };


    /**
     * Gauges a stat by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    gauge(stat: string | string[], value: any, sampleRate?: number, tags?: string[], callback?: CallbackFn) {
        this.sendAll(stat, value, 'g', sampleRate, tags, callback);
    };

    /**
     * Counts unique values by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */

    set(stat: string | string[], value: any, sampleRate?: number, tags?: string[], callback?: CallbackFn) {
        this.sendAll(stat, value, 's', sampleRate, tags, callback);
    };


    /**
     * Checks if stats is an array and sends all stats calling back once all have sent
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    sendAll(stat: string | string[], value: any, type: string, tags?: string[], callback?: CallbackFn): void;
    sendAll(stat: string | string[], value: any, type: string, sampleRate?: number, tags?: string[], callback?: CallbackFn): void;
    sendAll(stat: string | string[], value: any, type: string, sampleRateOrTags?: number | string[], tagsOrCallback?: string[] | CallbackFn, callback?: CallbackFn) {
        let completed = 0,
            calledback = false,
            sentBytes = 0,
            tags: string[] | undefined,
            sampleRate: number | undefined;

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
            stat.forEach((item) => this.send(item, value, type, sampleRate, tags, onSend));
        } else {
            this.send(stat, value, type, sampleRate, tags, callback);
        }

        /**
         * Gets called once for each callback, when all callbacks return we will
         * call back from the function
         * @private
         */
        function onSend(error: NodeJS.ErrnoException | null, bytes?: number) {
            completed += 1;
            if (calledback || typeof callback !== 'function') {
                return;
            }

            if (error) {
                calledback = true;
                return callback(error);
            }

            sentBytes += bytes!;
            if (completed === stat.length) {
                callback(null, sentBytes);
            }
        }
    }

    /**
     * Sends a stat across the wire
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param type The type of message to send to statsd
     * @param sampleRate The Number of times to sample (0 to 1)
     * @param tags The Array of tags to add to metrics
     * @param callback Callback when message is done being delivered. Optional.
     */
    send(stat: string | string[], value: any, type: string, sampleRate?: number, tags?: string[], callback?: CallbackFn) {
        var message = this.prefix + stat + this.suffix + ':' + value + '|' + type,
            buf: Buffer,
            merged_tags: string[] = [];

        if (sampleRate && sampleRate < 1) {
            if (Math.random() < sampleRate) {
                message += '|@' + sampleRate;
            } else {
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
        } else {
            if (typeof callback === 'function') {
                callback(null, 0);
            }
        }
    }

    /**
     * Close the underlying socket and stop listening for data on it.
     */
    close() {
        this.socket.close();
    }
}

exports.StatsD = Client;
