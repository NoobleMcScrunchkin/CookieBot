var CronJob = require('cron').CronJob;

let query;
let client;

const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'disable'];

var job = new CronJob('00 00 12 * * 0-6', async function () {
    let schedule = await query(`select * from schedule where day = '${days[new Date().getDay()]}'`);
    if (schedule.length == 0) return;
    schedule.forEach(async row => {
        if (row.channel == null) return;

        let guild = await client.guilds.fetch(row.guild_id);
        if (guild == null) return;
        
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
}, function () {}, true, 'Europe/London');

module.exports = function (sql, cl) {
    query = sql;
    client = cl;
    return job;
}