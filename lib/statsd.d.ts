/// <reference types="node" />
/** A NodeJS style callback function that may resolve to a number */
export declare type CallbackFn = (error: NodeJS.ErrnoException | null, value?: number) => void;
export declare type ClientOptions = {
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
};
/** StatsD client */
export default class Client {
    /** The port to connect to default: 8125 */
    private port;
    /** An optional prefix to assign to each stat name sent */
    private prefix;
    /** An optional suffix to assign to each stat name sent */
    private suffix;
    /** An optional boolean to add "statsd" as an object in the global namespace */
    private globalize;
    /** An optional option to only lookup the hostname -> ip address once */
    private cacheDns;
    /** An optional boolean indicating this Client is a mock object, no stats are sent. */
    private mock;
    /** Optional tags that will be added to every metric */
    private global_tags;
    unique: (stat: string | string[], value: any, sampleRate?: number | undefined, tags?: string[] | undefined, callback?: CallbackFn | undefined) => void;
    private socket;
    private host;
    constructor(
        /** Initialization options */
        hostOrOptions: ClientOptions);
    /**
     * Represents the timing stat
     * @param stat The stat(s) to send
     * @param time The time in milliseconds to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    timing(stat: string | string[], time: number, sampleRate?: number, tags?: any[], callback?: CallbackFn): void;
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
    /**
     * Decrements a stat by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    decrement(stat: string | string[], value: any, sampleRate?: number, tags?: string[], callback?: CallbackFn): void;
    /**
     * Represents the histogram stat
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    histogram(stat: string | string[], value: any, sampleRate?: number, tags?: string[], callback?: CallbackFn): void;
    /**
     * Gauges a stat by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    gauge(stat: string | string[], value: any, sampleRate?: number, tags?: string[], callback?: CallbackFn): void;
    /**
     * Counts unique values by a specified amount
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param sampleRate The Number of times to sample (0 to 1). Optional.
     * @param tags The Array of tags to add to metrics. Optional.
     * @param callback Callback when message is done being delivered. Optional.
     */
    set(stat: string | string[], value: any, sampleRate?: number, tags?: string[], callback?: CallbackFn): void;
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
    /**
     * Sends a stat across the wire
     * @param stat The stat(s) to send
     * @param value The value to send
     * @param type The type of message to send to statsd
     * @param sampleRate The Number of times to sample (0 to 1)
     * @param tags The Array of tags to add to metrics
     * @param callback Callback when message is done being delivered. Optional.
     */
    send(stat: string | string[], value: any, type: string, sampleRate?: number, tags?: string[], callback?: CallbackFn): void;
    /**
     * Close the underlying socket and stop listening for data on it.
     */
    close(): void;
}
