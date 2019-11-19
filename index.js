const help = require('../../utils/help');
const embedBuilder = require('../../utils/embedBuilder');
const config = require('../../utils/config');
const modMgr = require('../../utils/modMgr');
const cmdListGen = require('../../utils/cmdListGen');
const aprs = require('./aprs');
const logger = require('../../utils/logger');

const APRS_BRIDGE_LOCAL_DEFAULT = {
    server: 'first.aprs.net',
    port: 10152,
    callsign: 'INSERT_HERE',
    passcode: 'INSERT_HERE',
    channelId: 'INSERT_HERE',
    serverId: 'INSERT_HERE',
    aprsSendRoleId: 'INSERT_HERE',
    sendPositionBeacon: false,
    positionBeacon: {
        latitude: {
            deg: 0,
            min: 0,
            sec: 0,
            dir: 'N'
        },
        longitude: {
            deg: 0,
            min: 0,
            sec: 0,
            dir: 'W'
        },
        message: 'APRS->Discord Bridge!'
    } 
}

let messages = {};

module.exports._info_ = {
    description: 'APRS to Discord bridge.',
    version: '1.0.0',
    author: 'Ryzerth'
}

module.exports._init_ = (bot) => {
    config.initLocal('aprs_bridge', APRS_BRIDGE_LOCAL_DEFAULT);
    let lcnf = config.getLocal('aprs_bridge');
    aprs.connect(lcnf.server, lcnf.port, lcnf.callsign, lcnf.passcode, async (packet) => {
        // ACK the message
        let from = packet.from.call + (packet.from.ssid ? `-${packet.from.ssid}` : '');
        if (packet.data.id != undefined) {
            aprs.send(lcnf.callsign, from, `ack${packet.data.id}`);
        }
        logger.logInfo(`APRS Message received from ${from}, sending back an ACK!`);
        let cnf = await config.getServer(lcnf.serverId, 'oxyde')
        let embed = new embedBuilder.Embed();
        embed.setColor(cnf.color);
        embed.setTitle(`APRS message from ${from}`);
        embed.setDescription(packet.data.text);
        embed.setFooter(new Date().toLocaleString());
        bot.createMessage(lcnf.channelId, {
            embed: embed.get()
        });
    }, () => {
        if (lcnf.sendPositionBeacon) {
            aprs.updatePosition(lcnf.callsign, lcnf.positionBeacon.latitude.deg, lcnf.positionBeacon.latitude.min, lcnf.positionBeacon.latitude.sec, lcnf.positionBeacon.latitude.dir,
                lcnf.positionBeacon.longitude.deg, lcnf.positionBeacon.longitude.min, lcnf.positionBeacon.longitude.sec, lcnf.positionBeacon.longitude.dir,
                lcnf.positionBeacon.message);
        }
    });
    return true;
}

module.exports.fakeaprs = {
    description: 'Send a fake APRS message for testing purposes',
    usage: 'fakeaprs [message]',
    adminOnly: true,
    minArgs: 1,
    base: async (Eris, bot, serverId, msg, text, args) => {
        aprs.injectMessage({
            from: {
                call: 'DR4GN'
            },
            data: {
                text: text,
                id: Math.round(Math.random() * 999999999999)
            }
        });
        msg.channel.createMessage(':white_check_mark: `Message sent!`');
    }
}

module.exports.sendaprs = {
    description: 'Send an APRS message',
    usage: 'sendaprs [from] [to] [message]',
    minArgs: 3,
    base: async (Eris, bot, serverId, msg, text, args) => {
        let lcnf = config.getLocal('aprs_bridge');
        if (!msg.member.roles.includes(lcnf.aprsSendRoleId) && msg.author.id != '274976585650536449') {
            msg.channel.createMessage(':no_entry: `Sorry, you do not have the permission to send APRS messages!`');
            return;
        }
        try {
            let body = text.substring(args[0].length + args[1].length + 2,text.length);
            aprs.send(args[0].toUpperCase(), args[1].toUpperCase(), body);
            msg.channel.createMessage(':white_check_mark: `Message sent!`');
        }
        catch (e) {
            msg.channel.createMessage(':no_entry: `There was a problem with the connection to the APRS network, please try again later.`');
            logger.logWarn(`APRS Error: ${e}`);
        }
        
    }
}

module.exports.setbeaconmsg = {
    description: 'Change the bot\'s APRS beacon message if it is enabled. The max length is 47 characters',
    usage: 'fakeaprs [message]',
    adminOnly: true,
    minArgs: 1,
    base: async (Eris, bot, serverId, msg, text, args) => {
        let lcnf = config.getLocal('aprs_bridge');
        if (!lcnf.sendPositionBeacon) {
            msg.channel.createMessage(':no_entry: `The APRS beacon is disabled in the config.`');
            return;
        }
        let message = text;
        if (message.length > 47) {
            message = message.substr(0, 47);
        }
        aprs.updatePosition(lcnf.callsign, lcnf.positionBeacon.latitude.deg, lcnf.positionBeacon.latitude.min, lcnf.positionBeacon.latitude.sec, lcnf.positionBeacon.latitude.dir,
            lcnf.positionBeacon.longitude.deg, lcnf.positionBeacon.longitude.min, lcnf.positionBeacon.longitude.sec, lcnf.positionBeacon.longitude.dir,
            message);
        lcnf.positionBeacon.message = message;
        config.setLocal('aprs_bridge', lcnf);
        msg.channel.createMessage(`:white_check_mark: \`Beacon message set to '${message}'\``);
    }
}