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
        await query(`UPDATE currentpings SET channel = '${channel.id}', message = '${message.id}' WHERE guild_id = '${guild.id}';`);

        let emojis = JSON.parse(res[0].reactions);
        emojis.forEach(async emoji => {
            try {
                await message.react(emoji);
            } catch (e) {
                channel.send('Failed to react with ' + emoji);
            }
        });

        let recRoles = JSON.parse(res[0].roles);
        recRoles.forEach(async (role) => {
            try {
                let discordRole = await guild.roles.fetch(role);
                if (discordRole != null) {
                    if (discordRole.members) {
                        discordRole.members.forEach(async (roleMember) => {
                            try {
                                await roleMember.roles.remove(discordRole);
                            } catch (e) {
                                console.error(e.message);
                            }
                        });
                    }
                }
            } catch(e) {
                console.error(e.message);
            }
        });
        
    });
}, function () {}, true, 'Europe/London');

module.exports = function (sql, cl) {
    query = sql;
    client = cl;
    return job;
}

// let guild = await client.guilds.fetch("554018573320978442");
// await guild.members.fetch();
// let channel = await guild.channels.fetch("835210067786727434"); 
// let message = await channel.messages.fetch("1017026446247604274");
// let roles = ["1010186588686401586", "1010186659100377159", "1010186724879642635"];
// for (let i = 0; i < roles.length; i++) {
//     let role = await guild.roles.fetch(roles[i]);
//     if (role != null) {
//         if (role.members) {
//             role.members.forEach(async (roleMember) => {
//                 await roleMember.roles.remove(role);
//             });
//         }
//     }
// }

// let guild = await client.guilds.fetch("554018573320978442");
// await guild.members.fetch();
// let channel = await guild.channels.fetch("835210067786727434"); 
// let message = await channel.messages.fetch("1017026446247604274");
// let recReactions = ["✅","☑️","🕐","❓"];
// let recRoles = ["1010186588686401586","1010186659100377159","","1010186724879642635"];

// message.reactions.cache.forEach(async (reaction) => {
//     await reaction.users.fetch();
//     reaction.users.cache.forEach(async (user) => {
//         if (user.id != client.user.id) {
//             let role = null;
//             recReactions.forEach((react, index) => {
//                 if (react == reaction._emoji.name) {
//                     role = recRoles[index];
//                 }
//             });
            
//             if (role != null && role != "") {
//                 let discordRole = await guild.roles.fetch(role);
//                 if (discordRole != null) {
//                     let member = guild.members.cache.get(user.id);
//                     await member.roles.add(discordRole);
//                 }
//             }
//         }
//     });
// });

// let guild = await client.guilds.fetch("554018573320978442");
// let member = await guild.members.fetch("157958436657692672");
// await member.setNickname("Kieran")