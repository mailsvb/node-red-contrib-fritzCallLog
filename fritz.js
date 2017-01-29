const fritzConfig = {
  version: require('./package.json').version,
  debug: true
}

const fritzRequest = require('./src/request.js')
const fritzLogin = require('./src/login.js')
const fritzFon = require('./src/fon.js')
const fritz = Object.assign( {}, fritzConfig, fritzRequest, fritzLogin, fritzFon )

const util = require('util');

const XMLhead = '<?xml version="1.0" encoding="ISO-8859-1"?><CallLogs xmlns="http://schema.broadsoft.com/xsi">';
const XMLfoot = '</CallLogs>';

module.exports = function(RED) {
    "use strict";

    function FritzCallLog(n) {
        RED.nodes.createNode(this,n);
        let FRITZaddress = n.address || "fritz.box";
        let FRITZprotocol = n.protocol || "https";
        let FRITZlimit = parseInt(n.limit) || 100;
        
        let node = this;
        node.options = {
            server: FRITZaddress,
            protocol: FRITZprotocol
        };

        this.on("input",function(msg) {
            if (typeof msg.req.get('authorization') === 'undefined') {
                node.log('missing auhtorization header, sending 401 response');
                msg.res._res.append('WWW-Authenticate', 'Basic realm="XtendedServicesInterface"');
                msg.res._res.status(401).end();
                node.status({fill:"yellow",shape:"dot",text:"unauthorized"});
                return;
            }
            storeFritzCredentials(msg.req.get('authorization'), node.options);
            node.log(util.inspect(node.options, { showHidden: true, depth: null }));
            node.status({fill:"yellow",shape:"dot",text:"query Fritz!Box"});
            
            fritz.getCalls(node.options)
            .then((callHistory) => {
                node.log("Received call log entries from FRITZBox: " + callHistory.length + ", Max entries: " + FRITZlimit);
                let XML = {};
                XML['placed'] = '<placed>';
                XML['received'] = '<received>';
                XML['missed'] = '<missed>';
                for (var i=0; i < ((callHistory.length > FRITZlimit) ? FRITZlimit : callHistory.length) ; i++) {
                    if (callHistory[i].type == 'placed' || callHistory[i].type == 'received' || callHistory[i].type == 'missed') {
                        let record	= '<callLogsEntry>'
                                    + '<phoneNumber>' + callHistory[i].phoneNumber + '</phoneNumber>'
                                    + '<name>' + ((callHistory[i].name == '') ? callHistory[i].phoneNumber : callHistory[i].name) + '</name>'
                                    + '<time>' + callHistory[i].time + '</time>'
                                    + '<callLogId>' + i + '</callLogId>'
                                    + '</callLogsEntry>';
                        XML[callHistory[i].type] += record;
                        node.log(record);
                    }
                }
                XML['placed'] += '</placed>';
                XML['received'] += '</received>';
                XML['missed'] += '</missed>';
                let data = XMLhead + XML['placed'] + XML['received'] + XML['missed'] + XMLfoot;
                msg.res._res.append('Content-Type', 'application/xml;charset=ISO-8859-1');
                msg.res._res.append('Content-Length', data.length);
                msg.res._res.status(200).send(data);
                node.log("Sending " + i + " call log entries to device. Length: " + data.length);
                node.status({fill:"green",shape:"dot",text:i + " entries sent"});
                setTimeout(function(){
                    node.status({});
                }, 2000);
            })
            .catch((error) => {
                msg.res._res.append('Content-Type', 'application/xml;charset=ISO-8859-1');
                msg.res._res.status(500).end();
                node.error("sending 500: " + error);
                node.status({fill:"red",shape:"dot",text:"error"});
            });
        });
    }

    RED.nodes.registerType("fritzCallLog-node",FritzCallLog);
}

const storeFritzCredentials = function(authHeader, FRITZoptions) {
	let base64 = authHeader.split(' ')[1];
	let base64decoded = Buffer.from(base64, 'base64').toString();
	let credentials = base64decoded.split(':');
	FRITZoptions.username = credentials[0];
	FRITZoptions.password = credentials[1];
};