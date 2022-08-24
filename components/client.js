const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

let intents = new Intents(Intents.NON_PRIVILEGED);
intents.add('GUILDS');
intents.add('GUILD_MEMBERS');
intents.add('GUILD_MESSAGES');
intents.add('GUILD_MESSAGE_REACTIONS');

let query;
let connection;
let socketClients;
let io;

const client = new Client({ intents });

const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Valorant Customs Ping'),
    new SlashCommandBuilder()
        .setName('setmessage')
        .setDescription('Set customs ping message')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to ping')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('setreactions')
        .setDescription('Set customs ping reactions')
        .addStringOption(option =>
            option.setName('reactions')
                .setDescription('The reactions for ping (comma separated)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('roles')
                .setDescription('The roles to assign to each reaction (comma separated)')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('setday')
        .setDescription('Set day for customs ping')
        .addStringOption(option =>
            option.setName('day')
                .setDescription('Day of the week (e.g. Sunday, Monday, etc.)')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('Set channel for customs ping to current channel')
];

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    let guilds = client.guilds.cache;

    guilds.forEach(async guild => {
        let res = await query(`select * from messages where guild_id = ${guild.id}`);
        if (res.length == 0) {
            await query(`insert into messages (message, guild_id, reactions, roles) values ("This is the default ping message, please set the message using the /setmessage command", ${guild.id}, "[]", "[]")`);
        }
        res = await query(`select * from schedule where guild_id = ${guild.id}`);
        if (res.length == 0) {
            await query(`insert into schedule (guild_id, day) values (${guild.id}, "Wednesday")`);
        }
        res = await query(`select * from currentpings where guild_id = ${guild.id}`);
        if (res.length == 0) {
            await query(`insert into currentpings (guild_id, channel, message) values (${guild.id}, "000000000000000000", "000000000000000000")`);
        }
    });

    res = await query(`select * from currentpings where message != "000000000000000000" && channel != "000000000000000000"`);
    res.forEach(async row => {
        let guild = await client.guilds.fetch(row.guild_id);
        if (guild == null) return;
        let channel = guild.channels.cache.get(row.channel);
        if (channel == null) return;
        let message = await channel.messages.fetch(row.message);
    });
});

client.on("guildCreate", async guild => {
    console.log("Joined a new guild: " + guild.name);
    let res = await query(`select * from messages where guild_id = ${guild.id}`);
    if (res.length == 0) {
        await query(`insert into messages (message, guild_id, reactions) values ("This is the default ping message, please set the message using the /setmessage command", ${guild.id}, "[]")`);
    }
    res = await query(`select * from schedule where guild_id = ${guild.id}`);
    if (res.length == 0) {
        await query(`insert into schedule (guild_id, day) values (${guild.id}, "Wednesday")`);
    }
})

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    let guild = interaction.guild;

    let owner = await interaction.guild.fetchOwner()
    if (interaction.member.id != owner.id && interaction.member.id != 157958436657692672) {
        // await interaction.reply({ content: 'Only the server owner can run commands.', fetchReply: true })
        return;
    }

    if (interaction.commandName === 'ping') {
        let res = await query(`select * from messages where guild_id = ${interaction.guild.id}`);
        let res2 = await query(`select * from schedule where guild_id = ${interaction.guild.id}`);
        let channel = await interaction.guild.channels.fetch(res2[0].channel);
        let message = await channel.send({ content: res[0].message, fetchReply: true });
        let emojis = JSON.parse(res[0].reactions);

        emojis.forEach(async emoji => {
            try {
                await message.react(emoji);
            } catch (e) {
                await channel.send('Failed to react with ' + emoji);
            }
        });

        let recRoles = JSON.parse(res[0].roles);
        recRoles.forEach(async (role) => {
            try {
                let discordRole = await guild.roles.fetch(role);
                if (discordRole != null) {
                    if (discordRole.members && discordRole.members.length > 0) {
                        discordRole.members.forEach((roleMember) => {
                            roleMember.roles.remove(discordRole);
                        });
                    }
                }
            } catch(e) {
                console.error(e.message);
            }
        });
    
        await query(`UPDATE currentpings SET channel = '${channel.id}', message = '${message.id}' WHERE guild_id = '${interaction.guild.id}';`);
    } else if (interaction.commandName === 'setmessage') {
        await query(`UPDATE messages SET message = ${connection.escape(interaction.options.getString('message'))} WHERE guild_id = '${interaction.guild.id}';`);
        await interaction.reply('Message set.');
    } else if (interaction.commandName === 'setreactions') {
        let reactions = interaction.options.getString('reactions').replace(/\s+/g, '').split(',');
        let roles = [];

        interaction.options.getString('roles').replace(/\s+/g, '').split(',').forEach(role => {
            roles.push(role.replace(/\D/g, ""));
        });

        await query(`UPDATE messages SET roles = ${connection.escape(JSON.stringify(roles))}, reactions = ${connection.escape(JSON.stringify(reactions))} WHERE guild_id = '${interaction.guild.id}';`);

        await interaction.reply('Reactions set.');
    } else if (interaction.commandName === 'setday') {
        let day = interaction.options.getString('day').toLowerCase();
        if (!days.includes(day)) {
            await interaction.reply('Invalid day.');
            return;
        }
        await query(`UPDATE schedule SET day = '${day}' WHERE guild_id = '${interaction.guild.id}';`);
        await interaction.reply('Day set.');
    } else if (interaction.commandName === 'setchannel') {
        await query(`UPDATE schedule SET channel = '${interaction.channel.id}' WHERE guild_id = '${interaction.guild.id}';`);
        await interaction.reply('Channel set.');
    }
});

client.on('messageCreate', async (message) => {
    toSend = [];
    for (let key in socketClients) {
        data = socketClients[key];
        if (data.guild == message.guild.id && data.channel == message.channel.id) {
            toSend.push(key);
        }
    }

    for (let i = 0; i < toSend.length; i++) {
        let socket = io.sockets.sockets.get(toSend[i]);
        socket.emit('newMessage', {
            message: message,
            member: await message.guild.members.fetch(message.author.id)
        });
    }

    if (message.cleanContent.toLowerCase() == 'owo') {
        await message.channel.send('UwU');
    }
});

client.on('messageReactionAdd', async (messageReaction, user) => {
    if (user.bot) return;
    if (messageReaction.message.author.id != client.user.id) return;

    try {
        reactions = await messageReaction.message.reactions;
        reaction = await reactions.cache.get(messageReaction._emoji.name).fetch();
        let guild = await client.guilds.fetch(messageReaction.message.guildId);

        let res = await query(`select * from messages where guild_id = ${messageReaction.message.guildId}`);
        if (!res) return;

        let recReactions = JSON.parse(res[0].reactions);
        let recRoles = JSON.parse(res[0].roles);
        let role = null;

        recReactions.forEach((react, index) => {
            if (react == reaction._emoji.name) {
                role = recRoles[index];
            }
        });

        if (role != null && role != '') {
            let discordRole = await guild.roles.fetch(role);
            if (discordRole != null) {
                let member = guild.members.cache.get(user.id);
                await member.roles.add(discordRole);
            }
        }

        if (reaction.count > 2) {
            await messageReaction.users.remove(client.user.id);
        }
    } catch(e) {
        console.error(e.message);
    }
});

client.on('messageReactionRemove', async (messageReaction, user) => {
    if (user.bot) return;
    if (messageReaction.message.author.id != client.user.id) return;

    try {
        reactions = await messageReaction.message.reactions;
        reaction = await reactions.cache.get(messageReaction._emoji.name).fetch();
        let guild = await client.guilds.fetch(messageReaction.message.guildId);

        let res = await query(`select * from messages where guild_id = ${messageReaction.message.guildId}`);
        if (!res) return;

        let recReactions = JSON.parse(res[0].reactions);
        let recRoles = JSON.parse(res[0].roles);
        let role = null;

        recReactions.forEach((react, index) => {
            if (react == reaction._emoji.name) {
                role = recRoles[index];
            }
        });

        if (role != null && role != '') {
            let discordRole = await guild.roles.fetch(role);
            if (discordRole != null) {
                let member = guild.members.cache.get(user.id);
                await member.roles.remove(discordRole);
            }
        }

        if (reaction.count == 1) {
            await messageReaction.message.react(messageReaction._emoji);
        }
    } catch(e) {
        console.error(e.message);
    }
});

client.login(process.env.TOKEN);

module.exports = function (sqlquery, conn, socket, sockets) {
    query = sqlquery;
    connection = conn;
    io = socket;
    socketClients = sockets;
    return client;
}