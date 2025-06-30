module.exports = function (RED) {

    var dgram = require('dgram');
    var udpClient = null;

    function UdpListenerNode(config) {
        RED.nodes.createNode(this, config);
        this.slot = config.slot;
        this.topic = config.topic;
        var slot = config.slot;
        var topic = config.topic;
        var node = this;

        udpClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        node.on("input", function(msg) {
            // if (msg.hasOwnProperty("readinput")) { 
            //     var command = "$A0$0"+slot;
            //     UdpSender(command);
            // }
            if (msg.payload.hasOwnProperty("readinput")) { 
                var input = msg.payload.readinput
                if (input >= 0 && input <= 7) {
                    var command = "$A2$0"+ slot +"$0"+ input ;
                    UdpSender(command);
                }else if (input == "all") { 
                    var command = "$A0$0"+slot;
                    UdpSender(command);
                }else{
                    node.error("value not correct")
                }
            }
        });

        function UdpSender(command) {
            udpClient.send(command /*+ "\r"*/ ,node.hub.portout,'localhost',function(error){
                if(error){
                    client.close();
                }else{
                    console.log(command + ' sent');
                }
            }); 
        }

        // Retrieve the hub node
        node.hub = RED.nodes.getNode(config.hub);

        node.hub.on("status", function (status) {
            node.status(status);
        });
        // de evt-precip varvangen voor kissbox idetifier
        node.hub.on("evt_input", function (data) {
            try {
                var outputMsgs = [];
                //console.log(data.payload)
                const message = data.payload.split("$")
                if (parseInt(message[2].trim()) == slot) {     // straks vergelijken met het slotnummer wat is ingevuld in het dashbord
                    if (message[1].trim() == "A1") {
                        //console.log("all channels");
                        for(let i = 0; i < 8; i++) {
                            outputMsgs[i] = {payload: Boolean(parseInt(message[i+3])), topic: topic}
                        }    
                    } else if (message[1] == "A3 ") {
                        //console.log("one channel");
                        outputMsgs[parseInt(message[3])] = {payload: Boolean(parseInt(message[4])), topic: topic}
                    }
             
                    var msg = {
                        payload: data.payload
                    };
              
                } 
                node.send(outputMsgs);
            }   catch (error) {
                node.error(error, data);
            }
        });
    }

    RED.nodes.registerType("kissbox-digital-input", UdpListenerNode);
}