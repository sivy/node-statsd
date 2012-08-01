var socket = require('dgram').createSocket('udp4');
var mersenne = require('mersenne');
var mt = new mersenne.MersenneTwister19937();

var Client = function (host, port) {
    this.host = host;
    this.port = port;
}

Client.prototype.timing = function (stat, time, sample_rate) {
    var stats = {};
    stats[stat] = time + '|ms';
    this.send(stats, sample_rate);
};

Client.prototype.increment = function (stats, sample_rate) {
    this.update_stats(stats, 1, sample_rate);
}

Client.prototype.decrement = function (stats, sample_rate) {
    this.update_stats(stats, -1, sample_rate);
}

Client.prototype.gauge = function (stat, value, sample_rate) {
    var stats = {};
    stats[stat] = value + '|g';
    this.send(stats, sample_rate);
}

Client.prototype.update_stats = function (stats, delta, sampleRate) {
    if (typeof(stats) === 'string') {
        stats = [stats];
    }
    if (!delta) {
        delta=1;
    }
    var data = {};
    for (var i=0; i<stats.length; i++){
        data[stats[i]] = delta + '|c';
    }
    this.send(data, sampleRate);
}

Client.prototype.send = function (data, sample_rate) {
    if (!sample_rate) {
        sample_rate = 1;
    }

    var sampled_data = {};
    if(sample_rate < 1) {
        if (mt.genrand_real2(0,1) <= sample_rate) {
            for (stat in data) {
                value = data[stat];
                sampled_data[stat] = value + '|@' + sample_rate;
            }
        }
    }
    else {
        sampled_data = data;
    }
    for (var stat in sampled_data) {
        var send_data = stat + ':'+sampled_data[stat];
        send_data = new Buffer(send_data);
        socket.send(
            send_data,
            0,
            send_data.length,
            this.port,
            this.host,
            function (err, bytes) {
                if (err) {
                    console.log(err.msg);
                }
            }
        );
    }
};

exports.StatsD = Client;
