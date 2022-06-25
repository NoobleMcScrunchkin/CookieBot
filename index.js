require('dotenv').config();
const { query, connection } = require('./components/mysql');
const { io, socketClients } = require('./components/socket');
const client = require('./components/client')(query, connection, io, socketClients);
const api = require('./components/api')(client);
const cron = require('./components/cron')(query, client);