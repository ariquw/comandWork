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

// REST API 
app.post('/api/board', function(req, res) {
  try {
    const boardId = store.createBoard();
    res.json({ boardId: boardId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/board/:boardId', function(req, res) {
  try {
    const board = store.getBoard(req.params.boardId);
    res.json({
      board: {
        id: board.id,
        objects: board.objects,
        connectedUsers: board.connectedUsers.size
      }
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// WebSocket
io.on('connection', function(socket) {
  console.log('Пользователь подключился:', socket.id);

  socket.on('board:join', function(boardId) {
    try {
      const board = store.getBoard(boardId);
      
      board.connectedUsers.add(socket.id);
      socket.join(boardId);
      
      socket.emit('board:state', {
        objects: board.objects,
        connectedUsers: board.connectedUsers.size
      });
      
      socket.to(boardId).emit('user:joined', {
        userId: socket.id,
        totalUsers: board.connectedUsers.size
      });
      
      console.log('Пользователь ' + socket.id + ' присоединился к доске ' + boardId);
      console.log('Пользователей на доске ' + boardId + ': ' + board.connectedUsers.size);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  // oтключение пользователя
  socket.on('disconnect', function() {
    console.log('Пользователь отключился:', socket.id);
   
    store.boards.forEach(function(board, boardId) {
      if (board.connectedUsers.has(socket.id)) {
        board.connectedUsers.delete(socket.id);
        
        io.to(boardId).emit('user:left', {
          userId: socket.id,
          totalUsers: board.connectedUsers.size
        });
        
        console.log('Пользователь ' + socket.id + ' покинул доску ' + boardId);
        console.log('Пользователей на доске ' + boardId + ': ' + board.connectedUsers.size);
      }
    });
  });
});

const PORT = 3000;

server.listen(PORT, function() {
  console.log('Сервер запущен на порту', PORT);
  console.log('WebSocket готов к работе');
});