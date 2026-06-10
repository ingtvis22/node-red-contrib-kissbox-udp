module.exports = function (RED) {

    var dgram = require('dgram');
    var udpClient = null;

    function UdpListenerNode(config) {
        RED.nodes.createNode(this, config);
        this.slot = parseInt(config.slot, 10);
        this.topic = config.topic;
        var slot = this.slot;
        var topic = this.topic;
        var node = this;
        var slothex = slot & 0xFF;

        udpClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        node.on('input', function(msg) {
            if (msg.payload && msg.payload.hasOwnProperty('readoutput')) {
                var number = msg.payload.readoutput.number;
                if (number === 'all') {
                    var buffer = Buffer.from([0xA0, slothex]);
                    UdpSender(buffer);
                } else {
                    var channel = parseInt(number, 10);
                    if (!Number.isNaN(channel) && channel >= 0 && channel <= 7) {
                        var buffer = Buffer.from([0xA2, slothex, channel]);
                        UdpSender(buffer);
                    } else {
                        node.error('value not correct');
                    }
                }
            }
            if (msg.payload && msg.payload.hasOwnProperty('setoutput')) {
                var number = msg.payload.setoutput.number;
                var value = msg.payload.setoutput.value;
                if (number === 'all') {
                    if (Array.isArray(value) && value.length === 8) {
                        var values = value.map(setOutputValue);
                        var buffer = Buffer.from([0xA4, slothex].concat(values));
                        UdpSender(buffer);
                        setTimeout(function() { sendUdp(Buffer.from([0xA1, slothex])); }, 6);
                        function sendUdp(value) {
                            UdpSender(value);
                        }
                    } else {
                        node.error('value not correct: ' + value);
                    }
                } else {
                    var channel = parseInt(number, 10);
                    if (!Number.isNaN(channel) && channel >= 1 && channel <= 8) {
                        var outputValue = setOutputValue(value);
                        var buffer = Buffer.from([0xA5, slothex, channel - 1, outputValue]);
                        UdpSender(buffer);
                        setTimeout(function() { 
                            sendUdp(Buffer.from([0xA2, slothex, channel - 1]));
                        }, 6);
                        function sendUdp(value) {
                            UdpSender(value);
                        }
                    } else {
                        node.error('value not correct: ' + value);
                    }
                }
            }
        });

        function setOutputValue(value) {
            if (typeof value === 'number') {
                if (value >= 0 && value <= 255) {
                    return value;
                }
            }
            if (typeof value === 'string') {
                if (value === 'off') return 0x00;
                if (value === 'on') return 0xFF;
                var parsed = parseInt(value, 10);
                if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 255) {
                    return parsed;
                }
            }
            if (value === true) return 0xFF;
            if (value === false) return 0x00;
            node.error('value not correct: ' + value);
            return 0x00;
        }

        function UdpSender(command) {
            if (!Buffer.isBuffer(command)) {
                command = Buffer.from(command);
            }
            udpClient.send(command, node.hub.portout, 'localhost', function(error) {
                if (error) {
                    udpClient.close();
                } else {
                    console.log(command + ' sent');
                }
            });
        }

        node.hub = RED.nodes.getNode(config.hub);
        if (!node.hub) {
            node.status({ fill: 'red', shape: 'ring', text: 'missing hub config' });
            node.error('Missing hub configuration');
            return;
        }

        node.hub.on('status', function (status) {
            node.status(status);
        });

        node.hub.on('evt_input', function (data) {
            try {
                var outputMsgs = [];
                var payload = data.payload;
                if (payload && payload.slot === slot) {
                    if (payload.type === 'A1') {
                        for (let i = 0; i < payload.values.length; i++) {
                            outputMsgs[i] = { payload: payload.values[i], topic: topic };
                        }
                    } else if (payload.type === 'A3') {
                        outputMsgs[payload.channel] = { payload: payload.value, topic: topic };
                    }
                }
                node.send(outputMsgs);
            } catch (error) {
                node.error(error, data);
            }
        });
    }

    RED.nodes.registerType('kissbox-analog-output', UdpListenerNode);
}