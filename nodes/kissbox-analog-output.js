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
            // send command read outputs
            if (msg.payload.hasOwnProperty("readoutput")) { 
                var number = msg.payload.readoutput.number
                if (number >= 0 && number <= 7) {
                    var command = "$A2$0"+ slot +"$0"+ number ;
                    UdpSender(command);
                }else if (number == "all") { 
                    var command = "$A0$0"+slot;
                    UdpSender(command);
                }else{
                    node.error("value not correct")
                }
            }
            if (msg.payload.hasOwnProperty("setoutput")) { 
                var number = msg.payload.setoutput.number
                var value = msg.payload.setoutput.value
                if (number == "all"){
                    if (Array.isArray(value) == true) { 
                        var command = "$A4$0"+slot+ setOutputValue(value[0])+setOutputValue(value[1])+setOutputValue(value[2])+setOutputValue(value[3])+setOutputValue(value[4])+setOutputValue(value[5])+setOutputValue(value[6])+setOutputValue(value[7]);

                        UdpSender(command);
                        // small delay else read command exeeds send command
                        setTimeout(function() { sendUdp("$A1$0"+slot); }, 6);

                        function sendUdp(value) {
                            UdpSender(value);
                        }

                    }else{    
                        node.error("value not correct"+value)
                    }
                }else if (number >= 1 && number <= 8) {
                        var outputValue = setOutputValue(value)
                        console.log(outputValue+" : "+value)
                        var command = "$A5$0"+ slot +"$0"+(number-1)+outputValue ;

                        UdpSender(command);
                        // small delay else read command exeeds send command
                        setTimeout(function() { sendUdp("$A1$0"+slot); }, 6);

                        function sendUdp(value) {
                            UdpSender(value);
                        }

                    }else{    
                        node.error("value not correct"+value)
                    }
            }
        });

        function setOutputValue(decimalNumber) {
            if (decimalNumber >= 0 && decimalNumber <= 255) {
                var hexNumber = decimalNumber.toString(16); // value tohex
                if (decimalNumber > 15) {
                    return "$"+hexNumber; 
                }else{
                    return "$0"+hexNumber; 
                }
        
            }else {
                node.error("value not correct"+decimalNumber)
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
                        for(let i = 0; i <= 7; i++) {
                            outputMsgs[i] = {payload: (parseInt(message[i+3],16)), topic: topic}
                        }    
                    } else if (message[1] == "A3 ") {
                        //console.log("one channel");
                        outputMsgs[parseInt(message[3])] = {payload: (parseInt(message[4],16)), topic: topic}
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

    RED.nodes.registerType("kissbox-analog-output", UdpListenerNode);
}