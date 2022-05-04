require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const mysql = require('mysql');
const util = require('util');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const schedule = require('node-schedule');

let connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
});

connection.connect();

const query = util.promisify(connection.query).bind(connection);

(async () => {
    await query(`create table if not exists messages ( id int auto_increment primary key, message longtext null, guild_id text not null, reactions longtext null ) collate = utf8mb4_bin;`);
    await query(`create table if not exists schedule ( id int auto_increment primary key, guild_id text not null, day text null, channel  text null );`);
})();

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
        .setDescription('Set day for customs ping')
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
            await query(`insert into messages (message, guild_id, reactions) values ("This is the default ping message, please set the message using the /setmessage command", ${guild.id}, "[]")`);
        }
        res = await query(`select * from schedule where guild_id = ${guild.id}`);
        if (res.length == 0) {
            await query(`insert into schedule (guild_id, day) values (${guild.id}, "Wednesday")`);
        }
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

    if (interaction.commandName === 'ping') {
        let res = await query(`select * from messages where guild_id = ${interaction.guild.id}`)
        let message = await interaction.reply({ content: res[0].message, fetchReply: true });
        let emojis = JSON.parse(res[0].reactions);
        emojis.forEach(async emoji => {
            try {
                await message.react(emoji);
            } catch (e) {
                interaction.channel.send('Failed to react with ' + emoji);
            }
        });
    } else if (interaction.commandName === 'setmessage') {
        await query(`UPDATE messages SET message = ${connection.escape(interaction.options.getString('message'))} WHERE guild_id = '${interaction.guild.id}';`);
        await interaction.reply('Message set.');
    } else if (interaction.commandName === 'setreactions') {
        await query(`UPDATE messages SET reactions = ${connection.escape(JSON.stringify(interaction.options.getString('reactions').replace(/\s+/g, '').split(',')))} WHERE guild_id = '${interaction.guild.id}';`);
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

client.login(process.env.TOKEN);

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sundary'];

const job = schedule.scheduleJob('12 * * *', async () => {
    let schedule = await query(`select * from schedule where day = '${days[new Date().getDay()]}'`);
    if (schedule.length == 0) return;
    schedule.forEach(async row => {
        if (row.channel == null) return;

        let guild = client.guilds.cache.get(row.guild_id);
        let channel = await guild.channels.fetch(row.channel);
        if (channel == null) return;

        let res = await query(`select * from messages where guild_id = ${row.guild_id}`)

        let message = await channel.send({ content: res[0].message, fetchReply: true });

        let emojis = JSON.parse(res[0].reactions);
        emojis.forEach(async emoji => {
            try {
                await message.react(emoji);
            } catch (e) {
                channel.send('Failed to react with ' + emoji);
            }
        });
    });
});