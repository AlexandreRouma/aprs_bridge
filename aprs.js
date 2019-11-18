const net = require('net');
const readline = require('readline');
const aprs_parser = require('./aprs-parser');
const parser = new aprs_parser.APRSParser();
const logger = require('../../utils/logger');
let client = new net.Socket();

let handler = null;

module.exports.connect = (host, port, callsign, pass, msgHandler) => {
    doConnect(host, port, callsign, pass, msgHandler)
}

function doConnect(host, port, callsign, pass, msgHandler) {
    client = new net.Socket();
    handler = msgHandler;
    client.connect(port, host, () => {
        client.write(`user ${callsign} pass ${pass}\n`);
        let rl = readline.createInterface(client, null);
        rl.on('line', (line) => {
            let packet = parser.parse(line);
            if (!packet.data) {
                return;
            }
            if (!packet.data.addressee) {
                return;
            }
            if (packet.data.addressee.call == callsign) {
                handler(packet);
            }
        })
    });
    client.once('end', () => {
        logger.logWarn('Disconnected from the APRS Network! Reconnecting...');
        doConnect(host, port, callsign, pass, msgHandler);
    });
}

module.exports.disconnect = (callsign, pass) => {
    client.destroy();
}

module.exports.injectMessage = (packet) => {
    handler(packet);
}
function padStr(str, len) {
    let ret = str;
    for (let i = 0; i < len - str.length; i++) {
        ret += ' ';
    }
    return ret;
}

module.exports.send = (sender, receiver, message) => {
    client.write(`${sender}>${receiver},TCPIP*::${padStr(receiver, 9)}:${message}\n`);
}