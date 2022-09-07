const express = require('express');
const bodyParser = require('body-parser');
const { application } = require('express');
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let client;

app.post('/eval', async (req, res) => {
    const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
    try {
        let output = await (new AsyncFunction('client', req.body.command))(client);
        res.json({
            success: true,
            output,
        });
    } catch (e) {
        res.json({
            success: false,
            output: e.message,
        });
    }
});

app.post('/set-nickname', async (req, res) => {
    if (req.body.guild == undefined || req.body.member == undefined || req.body.nickname == undefined) {
        res.json({
            success: false,
            output: 'Invalid request',
        });
        return;
    }

    let guild = await client.guilds.fetch(req.body.guild);
    if (guild == undefined) {
        res.json({
            success: false,
            output: 'Guild not found',
        });
        return;
    }

    let member = await guild.members.fetch(req.body.member);
    if (member == undefined) {
        res.json({
            success: false,
            output: 'Member not found',
        });
        return;
    }

    try {
        await member.setNickname(req.body.nickname);
    } catch (e) {
        res.json({
            success: false,
            output: e.message,
        });
        return;    
    }

    res.json({ success: true });
});

app.post('/send-msg', async (req, res) => {
    if (req.body.message == undefined || req.body.guild == undefined || req.body.channel == undefined || req.body.userid == undefined) {
        res.json({
            success: false,
            output: 'Invalid request',
        });
        return;
    }

    let guild = await client.guilds.fetch(req.body.guild);
    if (guild == undefined) {
        res.json({
            success: false,
            output: 'Guild not found',
        });
        return;
    }

    try {
        if (!(await guild.members.fetch(req.body.userid)).permissions.has("ADMINISTRATOR")) {
            res.json({
                success: false,
                output: 'Invalid request',
            });
            return;
        }
    } catch (e) {
        res.json({
            success: false,
            output: 'Invalid request',
        });
        return;
    }

    let channel = await guild.channels.fetch(req.body.channel);
    if (channel == undefined) {
        res.json({
            success: false,
            output: 'Channel not found',
        });
    }

    await channel.send(req.body.message);

    res.json({ success: true });
});

app.get('/guilds', async (req, res) => {
    if (!req.query.userid) {
        res.json({
            success: false
        });
        return;
    }

    let guilds = client.guilds.cache;
    let guildsArray = [];

    for (let [index, guild] of guilds) {
        try {
            if (!(await guild.members.fetch(req.query.userid)).permissions.has("ADMINISTRATOR")) {
                continue;
            }
        } catch (e) {
            continue;
        }
        let members = await guild.members.fetch();
        let channels = await guild.channels.fetch();
        guildsArray.push({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            members,
            channels,
        });
    }

    res.json({
        success: true,
        guilds: guildsArray,
    });
});

app.get('/messages', async (req, res) => {
    if (!req.query.guildid || !req.query.channelid || !req.query.userid) {
        res.json({
            success: false
        });
        return;
    }

    let guild = client.guilds.cache.find(guild => {
        return req.query.guildid == guild.id
    });

    if (!guild) {
        res.json({
            success: false
        });
        return;
    }

    try {
        if (!(await guild.members.fetch(req.query.userid)).permissions.has("ADMINISTRATOR")) {
            res.json({
                success: false,
                output: 'Invalid request',
            });
            return;
        }
    } catch (e) {
        return;
    }

    let channel = await guild.channels.fetch(req.query.channelid);

    if (!channel) {
        res.json({
            success: false
        });
        return;
    }

    let messages = await channel.messages.fetch({ limit: 25 });

    let members = {};

    for (let [index, message] of messages) {
        if (members[message.author.id] != undefined) {
            continue;
        }
        try {
            members[message.author.id] = await message.guild.members.fetch(message.author.id);
        } catch (e) {
            members[message.author.id] = {
                joinedTimestamp: 0,
                premiumSinceTimestamp: null,
                nickname: 'Unknown User',
                pending: false,
                communicationDisabledUntilTimestamp: null,
                _roles: [],
                user: {
                    id: '0',
                    bot: true,
                    system: false,
                    flags: { bitfield: 256 },
                    username: 'Unknown User',
                    discriminator: '0000',
                    avatar: null,
                    banner: undefined,
                    accentColor: undefined
                },
                avatar: null,
                displayAvatarURL: null,
                displayName: 'Unknown User',
            };
        }
    }

    let resMessages = [];

    for (let [index, message] of messages) {
        resMessages.push({
            message: message,
            member: members[message.author.id]
        });
    }


    res.json({
        success: true,
        messages: resMessages,
    });
});

app.get('/guild', async (req, res) => {
    if (!req.query.guildid || !req.query.userid) {
        res.json({
            success: false
        });
        return;
    }

    let guild = client.guilds.cache.find(guild => {
        return req.query.guildid == guild.id
    });

    if (!guild) {
        res.json({
            success: false
        });
        return;
    }

    try {
        if (!(await guild.members.fetch(req.query.userid)).permissions.has("ADMINISTRATOR")) {
            res.json({
                success: false,
                output: 'Invalid request',
            });
            return;
        }
    } catch (e) {
        return;
    }

    let members = await guild.members.fetch();
    let channels = await guild.channels.fetch();

    resGuild = {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL(),
        members,
        channels,
    };

    res.json({
        success: true,
        guild: resGuild,
    });
});

app.listen(process.env.API_PORT, () => {
    console.log(`API listening on ${process.env.API_PORT}`)
});

module.exports = function(cl) {
    client = cl;
    return app;
}