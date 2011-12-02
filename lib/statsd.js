var sys = require('sys')
  , dgram = require('dgram')
  , mersenne = require('mersenne')
  , mt = new mersenne.MersenneTwister19937();

const EPHEMERAL_LIFETIME_MS = 1000;

Client = function (host, port, socket) {
    this.host = host;
    this.port = port;

    // optional shared socket
    this.socket = socket;

    // when a *shared* socked isn't provided, an ephemeral
    // socket is demand allocated.  This ephemeral socket is closed
    // after being idle for EPHEMERAL_LIFETIME_MS.
    this.ephemeral_socket = undefined;
    this.last_used_timer = undefined;
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

// An internal function update the last time the socket was
// used.  This function is called when the socket is used
// and causes demand allocated ephemeral sockets to be closed
// after a period of inactivity.
Client.prototype._update_last_used = function () {
    if (this.ephemeral_socket) {
        if (this.last_used_timer) clearTimeout(this.last_used_timer);
        var self = this;
        this.last_used_timer = setTimeout(function() {
            if (self.ephemeral_socket) self.ephemeral_socket.close();
            delete self.ephemeral_socket;
        }, EPHEMERAL_LIFETIME_MS);
    }
};

Client.prototype.send_data = function (buffer) {
    var self = this;
    var socket;

    if (this.socket === undefined) {
        if (!this.ephemeral_socket) {
            this.ephemeral_socket = dgram.createSocket('udp4');
        }
        socket = this.ephemeral_socket;
    } else {
        socket = this.socket;
    }

    this._update_last_used();

    socket.send(buffer, 0, buffer.length, this.port, this.host, function (err, bytes) {
        if (err) {
            console.log("Error while sending data:", err.msg);
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

Client.prototype.close = function () {
    if (this.socket) {
        this.socket.close();
        this.socket = undefined;
    }
    if (this.ephemeral_socket) {
        this.ephemeral_socket.close();
        this.ephemeral_socket = undefined;
    }
    if (this.last_used_timer) {
        cancelTimeout(this.last_used_timer);
        this.last_used_timer = undefined;
    }
};

exports.StatsD = Client;
