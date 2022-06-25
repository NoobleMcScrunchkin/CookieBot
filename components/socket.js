const https = require("https");
const http = require("http");
const { Server } = require("socket.io");
const fs = require('fs');

var webServer;

if (process.env.SSL == 'true') {
    webServer = https.createServer({
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT)
    });
} else {
    webServer = http.createServer();
}
const io = new Server(webServer, {
    cors: {
        origin: process.env.ORIGIN_URL,
        methods: ["GET", "POST"]
    }
});

let socketClients = [];

io.on("connection", (socket) => {

    socket.on('setChannel', data => {
        socketClients[socket.id] = {
            guild: data.guild,
            channel: data.channel,
        };
    });

    socket.on("disconnect", (reason) => {
        delete socketClients[socket.id];
    });
});

webServer.listen(process.env.WS_PORT);

module.exports = { io, socketClients };