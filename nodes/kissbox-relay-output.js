module.exports = function (RED) {

    // sn = slotnummer
    // cn = channelnummer
    // cv = channel value

    // A5 write one channel             sn cn cv
    // A4 write all channels            sn cv cv cv cv cv cv cv cv
    // A0 read all channels             sn
    // A2 read one channel              sn cn
    // A3 read one channel response     sn cn cv
    // A1 read all channels response    sn cv cv cv cv cv cv cv cv

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
            if (msg.payload && msg.payload.hasOwnProperty('readrelay')) {
                var number = msg.payload.readrelay.number;
                if (number === 'all') {
                    var buffer = Buffer.from([0xA0, slothex]);
                    UdpSender(buffer);
                } else {
                    var idx = parseInt(number, 10);
                    if (!Number.isNaN(idx) && idx >= 0 && idx <= 3) {
                        var buffer = Buffer.from([0xA2, slothex, idx]);
                        UdpSender(buffer);
                    } else {
                        node.error('value not correct');
                    }
                }
            }

            if (msg.payload && msg.payload.hasOwnProperty('setrelay')) {
                var relayNumber = msg.payload.setrelay.number;
                var relayValue = msg.payload.setrelay.value;
                if (relayNumber === 'all') {
                    if (Array.isArray(relayValue) && relayValue.length === 4) {
                        var values = [
                            setOutputValue(relayValue[0]),
                            setOutputValue(relayValue[1]),
                            setOutputValue(relayValue[2]),
                            setOutputValue(relayValue[3])
                        ];
                        var buffer = Buffer.from([0xA4, slothex].concat(values));
                        UdpSender(buffer);
                        setTimeout(function() { 
                            sendUdp(Buffer.from([0xA1, slothex]));
                            setTimeout(function() { if (node.hub && node.hub.sendReadAll) node.hub.sendReadAll(); }, 20);
                        }, 6);
                        function sendUdp(value) {
                            UdpSender(value);
                        }
                    } else {
                        node.error('value not correct: ' + relayValue);
                    }
                } else {
                    var idx = parseInt(relayNumber, 10);
                    if (!Number.isNaN(idx) && idx >= 1 && idx <= 4) {
                        var command = Buffer.from([0xA5, slothex, idx - 1, setOutputValue(relayValue)]);
                        console.log(command);
                        UdpSender(command);
                        setTimeout(function() { 
                            sendUdp(Buffer.from([0xA2, slothex, idx - 1]));
                        }, 6);
                        function sendUdp(value) {
                            UdpSender(value);
                        }
                    } else {
                        node.error('value not correct: ' + relayValue);
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
                if (value === 'on') return 0x01;
                if (value === 'off') return 0x00;
                if (value === 'toggle') return 0xFF;
                if (value === 'pulse') return 0xFE;
                var parsed = parseInt(value, 10);
                if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 255) {
                    return parsed;
                }
            }
            if (value === true) return 0x01;
            if (value === false) return 0x00;
            node.error('value not correct: ' + value);
            return 0x00;
        }

        function UdpSender(command) {
            if (!Buffer.isBuffer(command)) {
                command = Buffer.from(command);
            }
            udpClient.send(command, node.hub.portout, node.hub.targetHost, function(error) {
            // udpClient.send(command, node.hub.portout, 'localhost', function(error) {
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
                            outputMsgs[i] = { payload: Boolean(payload.values[i]), topic: topic };
                        }
                    } else if (payload.type === 'A3') {
                        outputMsgs[payload.channel] = { payload: Boolean(payload.value), topic: topic };
                    }
                }
                node.send(outputMsgs);
            } catch (error) {
                node.error(error, data);
            }
        });
    }

    RED.nodes.registerType('kissbox-relay-output', UdpListenerNode);
}