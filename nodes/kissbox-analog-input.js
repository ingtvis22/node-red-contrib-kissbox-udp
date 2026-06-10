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
            if (msg.payload && msg.payload.hasOwnProperty('readinput')) {
                var input = msg.payload.readinput;
                if (input === 'all') {
                    var buffer = Buffer.from([0xA0, slothex]);
                    UdpSender(buffer);
                    setTimeout(function() { if (node.hub && node.hub.sendReadAll) node.hub.sendReadAll(); }, 20);
                } else {
                    var inputNr = parseInt(input, 10);
                    if (!Number.isNaN(inputNr) && inputNr >= 0 && inputNr <= 7) {
                        var buffer = Buffer.from([0xA2, slothex, inputNr]);
                        UdpSender(buffer);
                        setTimeout(function() { if (node.hub && node.hub.sendReadAll) node.hub.sendReadAll(); }, 20);
                    } else {
                        node.error('value not correct');
                    }
                }
            }
        });

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
                            outputMsgs[i] = {
                                payload: payload.values[i],
                                topic: topic
                            };
                        }
                    } else if (payload.type === 'A3') {
                        outputMsgs[payload.channel] = {
                            payload: payload.value,
                            topic: topic
                        };
                    }
                }
                node.send(outputMsgs);
            } catch (error) {
                node.error(error, data);
            }
        });
    }

    RED.nodes.registerType('kissbox-analog-input', UdpListenerNode);
}