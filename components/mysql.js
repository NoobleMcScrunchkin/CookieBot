const mysql = require('mysql');
const util = require('util');

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

module.exports = {query, connection};