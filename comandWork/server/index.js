const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const store = require('./store');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

app.get('/', function(req, res) {
  res.json({ status: 'Server is running' });
});

io.on('connection', function(socket) {
  console.log('Пользователь подключился:', socket.id);

  socket.on('disconnect', function() {
    console.log('Пользователь отключился:', socket.id);
  });
});

const PORT = 3000;

server.listen(PORT, function() {
  console.log('Сервер запущен на порту', PORT);
  console.log('WebSocket готов к работе');
});