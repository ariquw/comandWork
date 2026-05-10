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
  },
  maxHttpBufferSize: 1e8
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/', function(req, res) {
  res.json({ status: 'Server is running' });
});

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
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('object:create', function(data) {
    try {
      const boardId = data.boardId;
      const objectData = data.object;
      
      console.log('Создание объекта на доске ' + boardId);
      console.log('Тип:', objectData.type);
      console.log('Позиция:', objectData.x + ', ' + objectData.y);
      
      const newObject = store.addObject(boardId, objectData);
      
      io.to(boardId).emit('object:created', newObject);
      
      console.log('Объект создан, id:', newObject.id);
    } catch (error) {
      console.error('Ошибка создания объекта:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('object:update', function(data) {
    try {
      const boardId = data.boardId;
      const objectId = data.objectId;
      const updates = data.updates;
      
      console.log('Обновление объекта ' + objectId + ' на доске ' + boardId);
      console.log('Изменения:', JSON.stringify(updates));
      
      const updatedObject = store.updateObject(boardId, objectId, updates);
      
      io.to(boardId).emit('object:updated', updatedObject);
      
      console.log('Объект обновлен');
    } catch (error) {
      console.error('Ошибка обновления объекта:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('object:move', function(data) {
    try {
      const boardId = data.boardId;
      const objectId = data.objectId;
      const x = data.x;
      const y = data.y;
      
      store.updateObject(boardId, objectId, { x: x, y: y });
      
      socket.to(boardId).emit('object:moved', {
        objectId: objectId,
        x: x,
        y: y
      });
    } catch (error) {
      console.error('Ошибка перемещения объекта:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('object:delete', function(data) {
    try {
      const boardId = data.boardId;
      const objectId = data.objectId;
      
      console.log('Удаление объекта ' + objectId + ' с доски ' + boardId);
      
      store.deleteObject(boardId, objectId);
      
      io.to(boardId).emit('object:deleted', objectId);
      
      console.log('Объект удален');
    } catch (error) {
      console.error('Ошибка удаления объекта:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

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
      }
    });
  });
});

const PORT = 3000;

server.listen(PORT, function() {
  console.log('Сервер запущен на порту', PORT);
  console.log('WebSocket готов к работе');
});