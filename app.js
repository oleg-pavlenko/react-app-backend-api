const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const sanitizeHTML = require('sanitize-html');
const jwt = require('jsonwebtoken');

const router = require('./router');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/', router);

const server = http.createServer(app);

const io = socketio(server, {
  pingTimeout: 30000,
});
io.on('connection', (socket) => {
  socket.on('chatFromBrowser', (data) => {
    try {
      const user = jwt.verify(data.token, process.env.JWTSECRET);
      socket.broadcast.emit(
        'chatFromServer',
        {
          message: sanitizeHTML(data.message, { allowedTags: [], allowedAttributes: {} }),
          username: user.username,
          avatar: user.avatar,
        },
      );
    } catch (e) {
      console.log('Not a valid token for chat.');
    }
  });
});

module.exports = server;
