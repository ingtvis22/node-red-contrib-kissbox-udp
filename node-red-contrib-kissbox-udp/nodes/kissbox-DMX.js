module.exports = function (RED) {

    var dgram = require('dgram');
    var udpClient = null;

    function UdpListenerNode(config) {
        RED.nodes.createNode(this, config);
        this.topic = config.topic;
        var topic = config.topic;
        var node = this;
        var command = [];
        var output = [];

        udpClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });

        node.on("input", function(msg) {
            if (msg.payload.hasOwnProperty("command")){
                command = [];
                var kbCommand = msg.payload.command;

                //console.log(" KBcommand is " + kbCommand )

                if (kbCommand == "reset") {
                    command = [0x84];
                }
                if (kbCommand == "freezeDMXOut") {
                    command = [0xA2];
                }
                if (kbCommand == "unFreezeDMXOut") {
                    command = [0xA3];
                }
                if (kbCommand == "clearDMXOut") {
                    command = [0xA4];
                }
                if (kbCommand == "startDMXIn") {
                    command = [0xA5];
                }
                if (kbCommand == "stopDMXIn") {
                    command = [0xA7];
                }
                if (kbCommand == "mergeChannel") {
                    if (msg.payload.channel >= 0 && msg,payload.channel <= 255 ){
                        var command = [0xA3, setOutputAddress(channel)];
                    }
                }
                if (kbCommand == "unMergeChannel") {
                    if (msg.payload.channel >= 0 && msg,payload.channel <= 255 ){
                        var command = [0xA9, setOutputAddress(channel)];
                    }
                }
                command = Buffer.from(command)
                output[1] = command;
                node.send(output);
                UdpSender(command);
            }
            if (msg.payload.hasOwnProperty("setonechannel")) { 
                //command = [];
                var address = msg.payload.setonechannel.address
                var value = msg.payload.setonechannel.value    
                if (address >= 0 && address <= 512) {
                    command = [0xAB, (setOutputAddress(address)[0]), (setOutputAddress(address)[1]), 0x00, 0x01, setOutputValue(value)];
                    console.log(command);
                    command = Buffer.from(command);
                    output[1] = command;
                    node.send(output);
                    UdpSender(command);
                }else{
                    node.error("value not correct onechannel "+address);
                }
            }    
            if (msg.payload.hasOwnProperty("setblockchannels")) { 
                command = [];
                var startadress = msg.payload.setblockchannels.startaddress;
                var amount = msg.payload.setblockchannels.amount;
                var values = msg.payload.setblockchannels.value;
/// hier boven werkt 
                if (startadress >= 0 && startadress+amount <= 512) {
                    console.log(values.length)
                    console.log(amount)
                    if (values.length == amount) { 
                        command = [0xAB, (setOutputAddress(startadress)[0]), (setOutputAddress(startadress)[1]), (setOutputAddress(amount)[0]), (setOutputAddress(amount)[1])]
                        for (i=0;i<amount;i++) {
                            command.push(setOutputValue(values[i]))
                        }
                        command = Buffer.from(command)
                        output[1] = command
                        node.send(output)
                        UdpSender(command);
                    }else{
                        node.error("wong amount of channeldata :"+ amount+" channels")
                    }       
                }else{
                    node.error("value not correct blockchannels ")
                }       
            }
 
            if (msg.payload.hasOwnProperty("setallchannels")) { 
                var values = msg.payload.setallchannels.value;
                if (values.length == 512) { 
                    var hexvalue = [];
                    command = [0xA0];
                    for (i=0;i<512;i++) {
                        command.push(setOutputValue(values[i]))
                    }
                    command = Buffer.from(command)
                    output[1] = command
                    node.send(output)
                    UdpSender(command);
                }else{
                    node.error("wong amount of channeldata :"+ values.length+ " channels");
                }       
            }
        });


        function setOutputValue(decimalNumber) {
            if (decimalNumber >= 0 && decimalNumber <= 255) {
                //console.log(decimalNumber)
                var hexNumber = decimalNumber.toString(16); // value tohex
                //console.log(hexNumber)
                if (decimalNumber > 15) {
                    var hexval = "0x"+hexNumber; 
                }else{
                    var hexval = "0x0"+hexNumber; 
                }   
                return hexval
            }else {
                node.error("value not correct"+decimalNumber)
            }
        }

        function setOutputAddress(decimalNumber) {
            if (decimalNumber >= 0 && decimalNumber <= 512) {
                if (decimalNumber > 255) {
                    decimalNumber = decimalNumber - 255;
                    hex ="0x01";
                }else{
                    hex = "0x00";
                }
                var hexNumber = decimalNumber.toString(16); // value tohex
                if (decimalNumber > 15) {
                    hexaddress = [hex, "0x"+hexNumber]; 
                }else{
                    hexaddress = [hex, "0x0"+hexNumber]; 
                }   
                return hexaddress
            }else {
                node.error("value not correct"+decimalNumber)
            }
        }

        function UdpSender(command) {
            udpClient.send(command /*+ "\r"*/ ,node.hub.portout,node.hub.host,function(error){
                if(error){
                    client.close();
                }else{
                    console.log(command + ' sent to '+node.hub.host+" at port "+node.hub.portout );
                }
            }); 
        }

        // Retrieve the hub node
        node.hub = RED.nodes.getNode(config.hub);
        node.hub.on("status", function (status) {
            node.status(status);
        });
        node.hub.on("evt_input", function (data) {
            try {
                console.log("er komt een bericht binnen op poort " + node.hub.port)
                var outputMsgs = [];// 
                var dmxValues = data.payload.data;
                console.log(data);
                console.log(data.payload.data[0]);
                console.log(dmxValues[0]);
                console.log(dmxValues.length)
                if (dmxValues[0].toString(16).toUpperCase() == "A6") {
                    for(let i = 1; i <= 512; i++) {
                        outputMsgs[i-1] = {payload: (dmxValues[i]), topic: topic}
                        console.log(dmxValues[i])
                    }    
                } 
                node.send(outputMsgs);
            }   catch (error) {
                node.error(error, data);
            }
        });
    }

    RED.nodes.registerType("kissbox-DMX", UdpListenerNode);
}