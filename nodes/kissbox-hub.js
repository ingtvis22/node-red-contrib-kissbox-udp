module.exports = function (RED) {
    var dgram = require('dgram');

    var udpClient = null;

    function parseKissboxMessage(message) {
        if (!Buffer.isBuffer(message)) {
            message = Buffer.from(message);
            // console.warn('Received non-buffer message, converted to buffer:', message);
        }

        if (message.includes(0x24)) { // ASCII '$'
            var text = message.toString('utf8');
            var parts = text.split('$').filter(Boolean);
            if (parts.length < 1) {
                return { type: 'UNKNOWN', raw: text };
            }
            var type = parts[0].trim();
            if (type === 'A1') {
                return {
                    type: 'A1',
                    slot: parseInt(parts[1], 10),
                    values: parts.slice(2).map(function (v) { return parseInt(v, 16); }),
                    raw: text
                };
            }
            if (type === 'A3') {
                return {
                    type: 'A3',
                    slot: parseInt(parts[1], 10),
                    channel: parseInt(parts[2], 10),
                    value: parseInt(parts[3], 16),
                    raw: text
                };
            }
            if (type === 'A6') {
                return {
                    type: 'A6',
                    values: parts.slice(1).map(function (v) { return parseInt(v, 16); }),
                    raw: text
                };
            }
            return { type: type, parts: parts, raw: text };
        }

        var typeByte = message[0];
        if (typeByte === 0xA1) {
            var slot = message[1];
            var values = [];
            for (var i = 2; i < message.length; i++) {
                values.push(message[i]);
            }
            return { type: 'A1', slot: slot, values: values, raw: message };
        }
        if (typeByte === 0xA3) {
            return {
                type: 'A3',
                slot: message[1],
                channel: message[2],
                value: message[3],
                raw: message
            };
        }
        if (typeByte === 0xA6) {
            var valuesA6 = [];
            for (var j = 1; j < message.length; j++) {
                valuesA6.push(message[j]);
            }
            return { type: 'A6', values: valuesA6, raw: message };
        }
        return { type: 'UNKNOWN', raw: message };
    }

    function KissboxHubNode(config) {
        RED.nodes.createNode(this, config);
        this.listenHost = config.listenHost; // 0.0.0.0
        this.targetHost = config.targetHost; // IP Kissbox
        this.host = config.host;
        this.port = config.port;
        this.portout = config.portout;
        var node = this;

        console.log("SEND TO:", node.targetHost, node.portout);

        var bindOptions = {
            port: config.port,
            exclusive: false
        }; 
        // if (config.host && config.host !== '0.0.0.0') {
        //     bindOptions.address = config.host;
        // }
        bindOptions.address = this.listenHost;

        var attemptedFallback = false;

        function attachSocketListeners(client) {
            client.on('close', function () {
                node.emit('status', { fill: 'grey', shape: 'dot', text: 'close' });
            });

            client.on('connect', function () {
                node.emit('status', { fill: 'yellow', shape: 'dot', text: 'connect' });
            });

            client.on('error', function (error) {
                node.error(error);
                node.emit('status', { fill: 'red', shape: 'ring', text: 'error' });
                if (error && error.code === 'EADDRNOTAVAIL' && bindOptions.address && !attemptedFallback) {
                    attemptedFallback = true;
                    node.warn('Host ' + bindOptions.address + ' unavailable; retrying bind on 0.0.0.0');
                    bindOptions.address = undefined;
                    client.close();
                    udpClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });
                    attachSocketListeners(udpClient);
                    udpClient.bind(bindOptions);
                }
            });

            client.on('listening', function () {
                node.emit('status', { fill: 'green', shape: 'dot', text: 'listening' });
                // Query all slots on startup
                node.sendReadAll();
            });

            client.on('message', function (message, remote) {
                var parsed = parseKissboxMessage(message);
                if (parsed.type === 'A1' || parsed.type === 'A3' || parsed.type === 'A6') {
                    node.emit('evt_input', { payload: parsed });
                }
            });
        }

        // Send read-all command for each slot (0xA0 = read all channels for a slot)
        node.sendReadAll = function() {
            for (var slot = 0; slot <= 7; slot++) {
                var slothex = slot & 0xFF;
                var buffer = Buffer.from([0xA0, slothex]);
                setTimeout(function(buf) {
                    udpClient.send(buf, node.portout, node.targetHost, function(error) {
                        if (error) {
                            node.error('Error sending read-all for slot: ' + error);
                        }
                    });
                }, slot * 10, buffer);  // Stagger requests by 10ms per slot
            }
        };

        udpClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        attachSocketListeners(udpClient);
        udpClient.bind(bindOptions);
    }

    RED.nodes.registerType('kissbox-hub', KissboxHubNode);
}