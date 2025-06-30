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
            if (msg.payload.hasOwnProperty("command")){
                var kbCommand = msg.payload.command;
                if (kbCommand == "reset") {
                    command = "$84"
                }
                if (kbCommand == "freezeDMXOut") {
                    command = "$A2"
                }
                if (kbCommand == "unFreezeDMXOut") {
                    command = "$A3"
                }
                if (kbCommand == "clearDMXOut") {
                    command = "$A4"
                }
                if (kbCommand == "startDMXIn") {
                    command = "$A5"
                }
                if (kbCommand == "stopDMXIn") {
                    command = "$A7"
                }
                if (kbCommand == "mergeChannel") {
                    if (msg.payload.msb < 255 && msg,payload.lsb < 255 ){
                        msb = setOutputValue(msb);
                        lsb = setOutputValue(lsb);
                    }
                    command = "$A3"+msb+lsb
                }
                if (kbCommand == "unMergeChannel") {
                    if (msg.payload.msb < 255 && msg,payload.lsb < 255 ){
                        msb = setOutputValue(msb);
                        lsb = setOutputValue(lsb);
                    }
                    command = "$A9"+msb+lsb
                }
                


            }
            // send command DMX values
            if (msg.payload.hasOwnProperty("setonechannel")) { 
                var address = msg.payload.setonechannel.address
                var value = msg.payload.setonechannel.value
                console.log(address);
                console.log(value)

                if (address >= 0 && address <= 512) {
                    var hexAdress = setOutputAddress(address) 
                    var hexvalue = setOutputValue(value)
                    var command = "$AB"+hexAdress+"$00$01"+hexvalue;
                   // UdpSender(command);
                   command = Buffer.from([0xab, 0x00, 0x06, 0x00, 0x01, 0x50])
                   console.log(command)
                    UdpSender(command)
                   // UdpSender("ab0006000150")

                }else{
                    node.error("value not correct onechannel "+address)
                }
            }    
            if (msg.payload.hasOwnProperty("setblockchannels")) { 
                var startadress = msg.payload.setblockchannels.startadress;
                var amountadress = msg.payload.setblockchannels.amountadress;
                var values = msg.payload.setblockchannels.value;
                
                if (startadress >= 0 && startadress+amountadress <= 512) {
                    console.log(values.length)
                    console.log(amountadress)
                    if (values.length == amountadress) { 
                        var hexstartadress = setOutputAddress(startadress) 
                        var hexamountadress = setOutputAddress(amountadress) 
                        var hexvalue = [];
                        command = "$AB"+hexstartadress+hexamountadress;
                        for (i=0;i<amountadress;i++) {
                            hexvalue[i] = setOutputValue(values[i])
                            command = command+hexvalue[i]
                        }
                        console.log(command)
                        UdpSender(command);
                    }else{
                        node.error("wong amount of channeldata :"+ amountadress+" channels")
                    }       
                }else{
                    node.error("value not correct blockchannels ")
                }       
            }
            if (msg.payload.hasOwnProperty("setallchannels")) { 
                var values = msg.payload.setallchannels.value;
                if (values.length == 512) { 
                    var hexvalue = [];
                    command = "$A0";
                    for (i=0;i<512;i++) {
                        hexvalue[i] = setOutputValue(values[i])
                        command = command+hexvalue[i]
                    }
                    console.log(command);
                    UdpSender(command);
                }else{
                    node.error("wong amount of channeldata :"+ values.length+ " channels");
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

        function setOutputAddress(decimalNumber) {
            if (decimalNumber >= 0 && decimalNumber <= 512) {
                if (decimalNumber > 255) {
                    decimalNumber = decimalNumber - 255;
                    preload = "$01";
                }else{
                    preload = "$00";
                }
                var hexNumber = decimalNumber.toString(16); // value tohex
                if (decimalNumber > 15) {
                    return preload+"$"+hexNumber; 
                }else{
                    return preload+"$0"+hexNumber; 
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
        // // de evt-precip varvangen voor kissbox idetifier
        // node.hub.on("evt_input", function (data) {
        //     try {
        //         var outputMsgs = [];
        //         //console.log(data.payload)
        //         const message = data.payload.split("$")
        //         if (parseInt(message[2].trim()) == slot) {     // straks vergelijken met het slotnummer wat is ingevuld in het dashbord
        //             if (message[1].trim() == "A1") {
        //                 //console.log("all channels");
        //                 for(let i = 0; i <= 7; i++) {
        //                     outputMsgs[i] = {payload: Boolean(parseInt(message[i+3])), topic: topic}
        //                 }    
        //             } else if (message[1] == "A3 ") {
        //                 //console.log("one channel");
        //                 outputMsgs[parseInt(message[3])] = {payload: Boolean(parseInt(message[4])), topic: topic}
        //             }
             
        //             var msg = {
        //                 payload: data.payload
        //             };
              
        //         } 
        //         node.send(outputMsgs);
        //     }   catch (error) {
        //         node.error(error, data);
        //     }
        // });
    }

    RED.nodes.registerType("kissbox-DMX", UdpListenerNode);
}