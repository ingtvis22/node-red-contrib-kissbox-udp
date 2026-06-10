module.exports = function (RED) {

    var dgram = require('dgram');
    var udpClient = null;

    function UdpListenerNode(config) {
        RED.nodes.createNode(this, config);
        this.topic = config.topic;
        var topic = this.topic;
        var node = this;
        var command = [];
        var output = [];

        udpClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        node.on('input', function(msg) {
            var buffer = null;
            if (msg.payload && msg.payload.hasOwnProperty('command')) {
                command = [];
                var kbCommand = msg.payload.command;

                if (kbCommand == 'reset') {
                    command = [0x84];
                }
                if (kbCommand == 'freezeDMXOut') {
                    command = [0xA2];
                }
                if (kbCommand == 'unFreezeDMXOut') {
                    command = [0xA3];
                }
                if (kbCommand == 'clearDMXOut') {
                    command = [0xA4];
                }
                if (kbCommand == 'startDMXIn') {
                    command = [0xA5];
                }
                if (kbCommand == 'stopDMXIn') {
                    command = [0xA7];
                }
                if (kbCommand == 'mergeChannel') {
                    var channel = parseInt(msg.payload.channel, 10);
                    if (!Number.isNaN(channel) && channel >= 0 && channel <= 255) {
                        command = [0xA3].concat(setOutputAddress(channel));
                    }
                }
                if (kbCommand == 'unMergeChannel') {
                    var channel = parseInt(msg.payload.channel, 10);
                    if (!Number.isNaN(channel) && channel >= 0 && channel <= 255) {
                        command = [0xA9].concat(setOutputAddress(channel));
                    }
                }
                if (command.length > 0) {
                    buffer = Buffer.from(command);
                    output[1] = buffer;
                    node.send(output);
                    UdpSender(buffer);
                }
            }
            if (msg.payload && msg.payload.hasOwnProperty('setonechannel')) {
                var address = parseInt(msg.payload.setonechannel.address, 10);
                var value = msg.payload.setonechannel.value;
                if (!Number.isNaN(address) && address >= 0 && address <= 512) {
                    command = [0xAB].concat(setOutputAddress(address), [0x00, 0x01, setOutputValue(value)]);
                    buffer = Buffer.from(command);
                    output[1] = buffer;
                    node.send(output);
                    UdpSender(buffer);
                } else {
                    node.error('value not correct onechannel ' + address);
                }
            }
            if (msg.payload && msg.payload.hasOwnProperty('setblockchannels')) {
                command = [];
                var startaddress = parseInt(msg.payload.setblockchannels.startaddress, 10);
                var amount = parseInt(msg.payload.setblockchannels.amount, 10);
                var values = msg.payload.setblockchannels.value;
                if (!Number.isNaN(startaddress) && !Number.isNaN(amount) && startaddress >= 0 && startaddress + amount <= 512) {
                    if (Array.isArray(values) && values.length == amount) {
                        command = [0xAB].concat(setOutputAddress(startaddress), setOutputAddress(amount));
                        for (var i = 0; i < amount; i++) {
                            command.push(setOutputValue(values[i]));
                        }
                        buffer = Buffer.from(command);
                        output[1] = buffer;
                        node.send(output);
                        UdpSender(buffer);
                        setTimeout(function() { if (node.hub && node.hub.sendReadAll) node.hub.sendReadAll(); }, 30);
                    } else {
                        node.error('wrong amount of channeldata :' + amount + ' channels');
                    }
                } else {
                    node.error('value not correct blockchannels');
                }
            }
            if (msg.payload && msg.payload.hasOwnProperty('setallchannels')) {
                var values = msg.payload.setallchannels.value;
                if (Array.isArray(values) && values.length == 512) {
                    command = [0xA0];
                    for (var j = 0; j < 512; j++) {
                        command.push(setOutputValue(values[j]));
                    }
                    buffer = Buffer.from(command);
                    output[1] = buffer;
                    node.send(output);
                    UdpSender(buffer);
                    setTimeout(function() { if (node.hub && node.hub.sendReadAll) node.hub.sendReadAll(); }, 30);
                } else {
                    node.error('wrong amount of channeldata :' + (values ? values.length : 'undefined') + ' channels');
                }
            }
        });

        function setOutputValue(decimalNumber) {
            var parsed = parseInt(decimalNumber, 10);
            if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 255) {
                return parsed;
            }
            node.error('value not correct ' + decimalNumber);
            return 0;
        }

        function setOutputAddress(decimalNumber) {
            var parsed = parseInt(decimalNumber, 10);
            if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 512) {
                var high = (parsed >> 8) & 0xFF;
                var low = parsed & 0xFF;
                return [high, low];
            }
            node.error('value not correct ' + decimalNumber);
            return [0, 0];
        }

        function UdpSender(command) {
            if (!Buffer.isBuffer(command)) {
                command = Buffer.from(command);
            }
            udpClient.send(command, node.hub.portout, node.hub.host, function(error) {
                if (error) {
                    udpClient.close();
                } else {
                    console.log(command + ' sent to ' + node.hub.host + ' at port ' + node.hub.portout);
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
                if (payload && payload.type === 'A6' && Array.isArray(payload.values)) {
                    for (var k = 0; k < payload.values.length; k++) {
                        outputMsgs[k] = { payload: payload.values[k], topic: topic };
                    }
                }
                node.send(outputMsgs);
            } catch (error) {
                node.error(error, data);
            }
        });
    }

    RED.nodes.registerType('kissbox-DMX', UdpListenerNode);
}