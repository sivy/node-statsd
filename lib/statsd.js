var sys = require('sys')
  , dgram = require('dgram')
  , mersenne = require('mersenne')
  , mt = new mersenne.MersenneTwister19937();

Client = function (host, port, socket) {
    this.host = host;
    this.port = port;

    // optional shared socket
    this.socket = socket;
}

Client.prototype.timing = function (stat, time, sample_rate) {
    var self = this;
    var stats = {};
    stats[stat] = time+"|ms";
    self.send(stats, sample_rate);
};

Client.prototype.increment = function (stats, sample_rate) {
    var self = this;
    self.update_stats(stats, 1, sample_rate);
}

Client.prototype.decrement = function (stats, sample_rate) {
    var self = this;
    self.update_stats(stats, -1, sample_rate);
}

Client.prototype.update_stats = function (stats, delta, sampleRate) {
    var self = this;
    if (typeof(stats) === 'string') {
        stats = [stats];
    }
    if (!delta) {
        delta=1;
    }
    data = {};
    for (var i=0; i<stats.length; i++){
        data[stats[i]] = delta+"|c";
    }
    self.send(data, sampleRate);
}

Client.prototype.send_data = function (buffer) {
    var self = this;
    var socket;

    if (this.socket === undefined) {
        socket = dgram.createSocket('udp4');
    } else {
        socket = this.socket;
    }

    socket.send(buffer, 0, buffer.length, this.port, this.host, function (err, bytes) {
        if (err) {
            console.log("Error while sending data:", err.msg);
        }

        if (self.socket === undefined) {
            // close ephemeral sockets while keeping shared ones open
            socket.close();
        }
    });
}

Client.prototype.send = function (data, sample_rate) {
    var self = this;
    if (!sample_rate) {
        sample_rate = 1;
    }

    sampled_data = {};
    if(sample_rate < 1) {
        if (mt.genrand_real2(0,1) <= sample_rate) {
            for (stat in data) {
                value = data[stat];
                sampled_data[stat] = value + "|@" + sample_rate;
            }
        }
    }
    else {
        sampled_data=data;
    }
    for (stat in sampled_data) {
        send_data = stat+":"+sampled_data[stat];
        this.send_data(new Buffer(send_data));
    }
};

exports.StatsD = Client;
