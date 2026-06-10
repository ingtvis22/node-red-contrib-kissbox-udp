   // sn = slotnummer
    // cn = channelnummer
    // cv = channel value

    // A5 write one channel             sn cn cv
    // A4 write all channels            sn cv cv cv cv cv cv cv cv
    // A0 read all channels             sn
    // A2 read one channel              sn cn
    // A3 read one channel response     sn cn cv
    // A1 read all channels response    sn cv cv cv cv cv cv cv cv


module.exports = function (RED) {

    var dgram = require('dgram');
    var udpClient = null;

    function UdpListenerNode(config) {
        RED.nodes.createNode(this, config);
        this.slot = parseInt(config.slot, 10);
        this.topic = config.topic;
        var slot = parseInt(config.slot, 10);
        var topic = config.topic;
        var node = this;

        var slothex = slot.toString(16).padStart(2, '0').toUpperCase();
        slothex = parseInt(slothex, 16);

        udpClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        node.on("input", function(msg) {

            if (msg.payload.hasOwnProperty("readinput")) { 
                var input = msg.payload.readinput;
                if (input >= 0 && input <= 7) {
                    var buffer = Buffer.from([0xA2, slothex, input]);
                    UdpSender(buffer);
                    setTimeout(function() { if (node.hub && node.hub.sendReadAll) node.hub.sendReadAll(); }, 20);
                } else if (input == "all") { 
                    var buffer = Buffer.from([0xA0, slothex]);
                    UdpSender(buffer);
                    setTimeout(function() { if (node.hub && node.hub.sendReadAll) node.hub.sendReadAll(); }, 20);
                } else {
                    node.error("value not correct")
                }
            }
        });

        function UdpSender(command) {
            udpClient.send(command /*+ "\r"*/ ,node.hub.portout,'localhost',function(error){
                if(error){
                    udpClient.close();
                }else{
                    console.log(command + ' sent');
                }
            }); 
        }

        // Retrieve the hub node
        node.hub = RED.nodes.getNode(config.hub);
        if (!node.hub) {
            node.status({ fill: 'red', shape: 'ring', text: 'missing hub config' });
            node.error('Missing hub configuration');
            return;
        }

        node.hub.on("status", function (status) {
            node.status(status);
        });
        // de evt-precip varvangen voor kissbox idetifier
        node.hub.on("evt_input", function (data) {
            try {
                var outputMsgs = [];
                var payload = data.payload;
                if (payload && payload.slot === slot) {
                    if (payload.type === "A1") {
                        for (let i = 0; i < payload.values.length; i++) {
                            outputMsgs[i] = {
                                payload: Boolean(payload.values[i]),
                                topic: topic
                            };
                        }
                    } else if (payload.type === "A3") {
                        outputMsgs[payload.channel] = {
                            payload: Boolean(payload.value),
                            topic: topic
                        };
                    }
                }
                node.send(outputMsgs);
            }   catch (error) {
                node.error(error, data);
            }
        });
    }

    RED.nodes.registerType("kissbox-digital-input", UdpListenerNode);
}