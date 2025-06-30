module.exports = function (RED) {
    var dgram = require('dgram');

    var udpClient = null;

    function KissboxHubNode(config) {
        RED.nodes.createNode(this, config);
        this.host = config.host;
        this.port = config.port;
        this.portout = config.portout;
        var node = this;

        udpClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        udpClient.on('close', function () {
            node.emit("status", { fill: "grey", shape: "dot", text: "close" });
        });

        udpClient.on('connect', function () {
            node.emit("status", { fill: "yellow", shape: "dot", text: "connect" });
        });

        udpClient.on('error', function (error) {
            node.error(error);
            node.emit("status", { fill: "red", shape: "ring", text: "error" });
        });

        udpClient.on('listening', function () {
            node.emit("status", { fill: "green", shape: "dot", text: "listening" });
        });

        udpClient.on('message', function (message, remote) {
            console.log(message);
            var messageText = message.toJSON();
            console.log(messageText);
            console.log(messageText.data[0]);
            var firstChar = messageText.data[0].toString(16).toUpperCase();
            console.log("Firstchar is "+ firstChar + " Message is " + messageText );
            if (firstChar == "A1" || firstChar == "A3" || firstChar == "A6") {
                console.log("versturen die handel")
                node.emit("evt_input", { payload: messageText});
            }
        });
        
        udpClient.bind({
            address: config.host,
            port: config.port,
            //portout: config.portout,
            exclusive: false
        });  

    }


    RED.nodes.registerType("kissbox-hub", KissboxHubNode);
}