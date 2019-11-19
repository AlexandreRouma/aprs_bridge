const net = require('net');
const readline = require('readline');
const aprs_parser = require('./aprs-parser');
const parser = new aprs_parser.APRSParser();
const logger = require('../../utils/logger');
let client = new net.Socket();

let handler = null;

module.exports.connect = (host, port, callsign, pass, msgHandler, connectHandler) => {
    doConnect(host, port, callsign, pass, msgHandler, connectHandler);
}

function doConnect(host, port, callsign, pass, msgHandler, connectHandler) {
    if (!client.destroyed) {
        try {
            client.end();
        }
        catch (e) {}
        try {
            client.destroy();
        }
        catch (e) {}
    }
    client = new net.Socket();
    handler = msgHandler;
    client.connect(port, host, () => {
        client.write(`user ${callsign} pass ${pass}\n`);
        let rl = readline.createInterface(client, null);
        rl.on('line', (line) => {
            if (line.startsWith('# logresp')) {
                connectHandler();
                return;
            }
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
        doConnect(host, port, callsign, pass, msgHandler, connectHandler);
    });
}

module.exports.disconnect = (callsign, pass) => {
    client.destroy();
}

module.exports.injectMessage = (packet) => {
    handler(packet);
}
function padStrEnd(str, len, c) {
    let ret = str;
    for (let i = 0; i < len - str.length; i++) {
        ret += c;
    }
    return ret;
}

function padStrSt(str, len, c) {
    let ret = str;
    for (let i = 0; i < len - str.length; i++) {
        ret = c + ret;
    }
    return ret;
}

module.exports.send = (sender, receiver, message) => {
    client.write(`${sender}>${receiver},TCPIP*::${padStrEnd(receiver, 9, ' ')}:${message}\n`);
}

module.exports.updatePosition = (callsign, lat_deg, lat_min, lat_sec, lat_dir, lon_deg, lon_min, lon_sec, lon_dir, msg) => {
    let lat = `${padStrSt(`${lat_deg}`, 2, '0')}${padStrSt(`${lat_min}`, 2, '0')}.${padStrSt(`${lat_sec}`, 2, '0')}${lat_dir}`;
    let lon = `${padStrSt(`${lon_deg}`, 3, '0')}${padStrSt(`${lon_min}`, 2, '0')}.${padStrSt(`${lon_sec}`, 2, '0')}${lon_dir}`;
    client.write(`${callsign}>APRS,TCPIP*:!${lat}/${lon}-${msg}\n`);
}