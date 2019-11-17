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
    aprsSendRoleId: 'INSERT_HERE'
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
        aprs.send(lcnf.callsign, from, `ack${packet.data.id}`);
        logger.logInfo(`APRS Message received from ${from}, sending back an ACK!`);

        // Note: temporary until propper ACK
        if (!messages[from]) {
            messages[from] = {};
        }
        if (messages[from][packet.data.id]) {
            return;
        }
        messages[from][packet.data.id] = true;

        let cnf = await config.getServer(lcnf.serverId, 'oxyde')
        let embed = new embedBuilder.Embed();
        embed.setColor(cnf.color);
        embed.setTitle(`APRS message from ${from}`);
        embed.setDescription(packet.data.text);
        embed.setFooter(new Date().toLocaleString());
        bot.createMessage(lcnf.channelId, {
            embed: embed.get()
        });
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
    description: 'Send a fake APRS message for testing purposes',
    usage: 'sendaprs [from] [to] [message]',
    minArgs: 3,
    base: async (Eris, bot, serverId, msg, text, args) => {
        let lcnf = config.getLocal('aprs_bridge');
        if (!msg.member.roles.includes(lcnf.aprsSendRoleId) && msg.author.id != '274976585650536449') {
            msg.channel.createMessage(':no_entry: `Sorry, you do not have the permission to send APRS messages!`');
            return;
        }
        let body = text.substring(args[0].length + args[1].length + 2,text.length);
        aprs.send(args[0], args[1], body);
        msg.channel.createMessage(':white_check_mark: `Message sent!`');
    }
}