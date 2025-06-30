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

            // if (msg.hasOwnProperty("readrelay")){
            //     console.log(msg.payload.readrelay.number)
            // }

            if (msg.payload.hasOwnProperty("readrelay")) { 
                var number = msg.payload.readrelay.number;
                console.log(msg.payload.readrelay.number);

                if (number >= 0 && number <= 3) {
                    var command = "$A2$0"+ slot +"$0"+ number ;
                    UdpSender(command);
                }else if (number == "all") { 
                    var command = "$A0$0"+slot;
                    UdpSender(command);
                }else{
                    node.error("value not correct")
                }
            }
            if (msg.payload.hasOwnProperty("setrelay")) { 
                var number = msg.payload.setrelay.number;
                var relayValue = msg.payload.setrelay.value;
                console.log(msg.payload.setrelay.number+" : "+msg.payload.setrelay.value);

                if (number == "all"){
                    if (Array.isArray(relayValue) == true) { 
                        var command = "$A4$0"+slot+ setRelayValue(relayValue[0])+setRelayValue(relayValue[1])+setRelayValue(relayValue[2])+setRelayValue(relayValue[3]);

                        UdpSender(command);
                        // small delay else read command exeeds send command
                        setTimeout(function() { sendUdp("$A1$0"+slot); }, 6);

                        function sendUdp(value) {
                            UdpSender(value);
                        }

                    }else{    
                        node.error("value not correct"+msg['setrelay'][key])
                    }
                }else if (number >= 1 && number <= 4) {
                        var KBrelayValue = setRelayValue(relayValue)
                        var command = "$A5$0"+ slot +"$0"+(number-1)+KBrelayValue ;

                        UdpSender(command);
                        // small delay else read command exeeds send command
                        setTimeout(function() { sendUdp("$A1$0"+slot); }, 6);

                        function sendUdp(value) {
                            UdpSender(value);
                        }

                    }else{    
                        node.error("value not correct"+msg['setrelay'][key])
                    }
            }
        });

        function setOutputValue(value) {
            if (value == "on" || value == 1 || value == true) {
                return "$01"
            }else if (value == "off" || value == 0 || value == false) {
                return "$00"
            }else {
                node.error("value not correct"+value)
            }
        }    

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
                        for(let i = 0; i <= 3; i++) {
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

    RED.nodes.registerType("kissbox-relay-output", UdpListenerNode);
}