const fritzConfig = {
  version: require('./package.json').version,
  debug: true
}

const fritzRequest = require('./src/request.js')
const fritzLogin = require('./src/login.js')
const fritzFon = require('./src/fon.js')
const fritz = Object.assign( {}, fritzConfig, fritzRequest, fritzLogin, fritzFon )

const util = require('util');

const XMLhead = '<?xml version="1.0" encoding="ISO-8859-1"?><REPLACEREQUESTTYPE xmlns="http://schema.broadsoft.com/xsi">';
const XMLfoot = '</REPLACEREQUESTTYPE>';

module.exports = function(RED) {
    "use strict";

    function FRITZaccess(n) {
        RED.nodes.createNode(this,n);
        let FRITZaddress                = n.address || "fritz.box";
        let FRITZprotocol               = n.protocol || "https";
        let FRITZlimit                  = parseInt(n.limit) || 100;
        let FRITZGroup                  = n.Group || false;
        let FRITZGroupCommon            = n.GroupCommon || false;
        let FRITZEnterprise             = n.Enterprise || false;
        let FRITZEnterpriseCommon       = n.EnterpriseCommon || false;
        
        let Directories = {};
        if (FRITZGroup !== false) { Directories['Group'] = FRITZGroup; }
        if (FRITZGroupCommon !== false) { Directories['GroupCommon'] = FRITZGroupCommon; }
        if (FRITZEnterprise !== false) { Directories['Enterprise'] = FRITZEnterprise; }
        if (FRITZEnterpriseCommon !== false) { Directories['EnterpriseCommon'] = FRITZEnterpriseCommon; }
        
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
            
            let requestType = msg.req.path.substr(msg.req.path.lastIndexOf('/') + 1);
            
            if (requestType == 'CallLogs') {
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
                    let data = XMLhead.replace(/REPLACEREQUESTTYPE/, requestType) + XML['placed'] + XML['received'] + XML['missed'] + XMLfoot.replace(/REPLACEREQUESTTYPE/, requestType);
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
            }
            else if (Directories.hasOwnProperty(requestType) === true) {
                fritz.getPhonebook(Directories[requestType], node.options)
                .then((phonebook) => {
                    //console.log(util.inspect(phonebook, { showHidden: true, depth: null }));
                    node.log("Received phonebook entries from FRITZBox: " + phonebook.length);
                    let XML = {};
                    XML['Group'] = '<groupDirectory>';
                    XML['GroupCommon'] = '<groupCommonDirectory>';
                    XML['Enterprise'] = '<enterpriseDirectory>';
                    XML['EnterpriseCommon'] = '<enterpriseCommonDirectory>';
                    let recordsCount = 0;
                    for (var i=0; i < phonebook.length; i++) {
                        for (var j=0; j < phonebook[i].numbers.length; j++) {
                            recordsCount +=1;
                            let record	= '<directoryDetails>'
                                        + '<userId>' + recordsCount + '</userId>'
                                        + '<firstName>' + phonebook[i].name + '</firstName>'
                                        + '<lastName>(' + phonebook[i].numbers[j].type + ')</lastName>'
                                        + '<number>' + phonebook[i].numbers[j].number + '</number>'
                                        + '</directoryDetails>';
                            XML[requestType] += record;
                            node.log(record);
                        }
                    }
                    let commonData = '<startIndex>1</startIndex><numberOfRecords>' + recordsCount + '</numberOfRecords><totalAvailableRecords>' + recordsCount + '</totalAvailableRecords>';
                    XML['Group'] += '</groupDirectory>';
                    XML['GroupCommon'] += '</groupCommonDirectory>';
                    XML['Enterprise'] += '</enterpriseDirectory>';
                    XML['EnterpriseCommon'] += '</enterpriseCommonDirectory>';
                    let data = XMLhead.replace(/REPLACEREQUESTTYPE/, requestType) + commonData + XML[requestType] + XMLfoot.replace(/REPLACEREQUESTTYPE/, requestType);
                    msg.res._res.append('Content-Type', 'application/xml;charset=ISO-8859-1');
                    msg.res._res.append('Content-Length', data.length);
                    msg.res._res.status(200).send(data);
                    node.log("Sending " + i + " phonebook entries to device. Length: " + data.length);
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
            }
            else {
                node.log('Unkown request to: >' + msg.req.path + '< sending 404 - not found');
                msg.res._res.status(404).end();
            }
        });
    }

    RED.nodes.registerType("FRITZaccess-node",FRITZaccess);
}

const storeFritzCredentials = function(authHeader, FRITZoptions) {
	let base64 = authHeader.split(' ')[1];
	let base64decoded = Buffer.from(base64, 'base64').toString();
	let credentials = base64decoded.split(':');
	FRITZoptions.username = credentials[0];
	FRITZoptions.password = credentials[1];
};