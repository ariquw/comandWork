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
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
  pingInterval: 25000
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

app.post('/api/board/:boardId/object', function(req, res) {
  try {
    const object = store.addObject(req.params.boardId, req.body);
    io.to(req.params.boardId).emit('object:created', object);
    res.json({ object: object });
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});

app.use(function(req, res) {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// WEB SOCKET 

io.on('connection', function(socket) {
  
  console.log('Новое подключение');
  console.log('ID сокета:', socket.id);
  console.log('Всего подключений:', io.engine.clientsCount);

  socket.on('board:join', function(boardId) {
    console.log('Присоединение к доске');
    console.log('Пользователь:', socket.id);
    console.log('Доска:', boardId);
    
    try {
      const board = store.getBoard(boardId);
      board.connectedUsers.add(socket.id);
      socket.join(boardId);
      
      console.log('Объектов на доске:', board.objects.length);
      console.log('Пользователей на доске:', board.connectedUsers.size);
      
      socket.emit('board:state', {
        objects: board.objects,
        connectedUsers: board.connectedUsers.size
      });
      
      socket.to(boardId).emit('user:joined', {
        userId: socket.id,
        totalUsers: board.connectedUsers.size
      });
      
    } catch (error) {
      console.error('Ошибка присоединения:', error.message);
      socket.emit('error', { message: 'Не удалось подключиться к доске: ' + error.message });
    }
  });

  socket.on('object:create', function(data) {
    try {
      if (!data.boardId) throw new Error('Отсутствует boardId');
      if (!data.object) throw new Error('Отсутствуют данные объекта');
      if (!data.object.type) throw new Error('Отсутствует тип объекта');
      
      const boardId = data.boardId;
      const objectData = data.object;
      
      console.log('Создание объекта');
      console.log('Доска:', boardId);
      console.log('Тип:', objectData.type);
      console.log('Пользователь:', socket.id);
      
      const newObject = store.addObject(boardId, objectData);
      
      io.to(boardId).emit('object:created', newObject);
      
      console.log('Создан объект с id:', newObject.id);
      
    } catch (error) {
      console.error('Ошибка создания объекта:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('object:update', function(data) {
    try {
      if (!data.boardId) throw new Error('Отсутствует boardId');
      if (!data.objectId) throw new Error('Отсутствует objectId');
      if (!data.updates) throw new Error('Отсутствуют обновления');
      
      const boardId = data.boardId;
      const objectId = data.objectId;
      const updates = data.updates;
      
      console.log('Обновление объекта');
      console.log('Доска:', boardId);
      console.log('Объект:', objectId);
      console.log('Изменения:', Object.keys(updates).join(', '));
      
      const updatedObject = store.updateObject(boardId, objectId, updates);
      
      io.to(boardId).emit('object:updated', updatedObject);
      
    } catch (error) {
      console.error('Ошибка обновления:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('object:move', function(data) {
    try {
      if (!data.boardId) throw new Error('Отсутствует boardId');
      if (!data.objectId) throw new Error('Отсутствует objectId');
      if (data.x === undefined || data.y === undefined) {
        throw new Error('Отсутствуют координаты');
      }
      
      const boardId = data.boardId;
      const objectId = data.objectId;
      const x = Number(data.x);
      const y = Number(data.y);
      
      store.updateObject(boardId, objectId, { x: x, y: y });
      
      socket.to(boardId).emit('object:moved', {
        objectId: objectId,
        x: x,
        y: y
      });
      
    } catch (error) {
      console.error('Ошибка перемещения:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('object:delete', function(data) {
    try {
      if (!data.boardId) throw new Error('Отсутствует boardId');
      if (!data.objectId) throw new Error('Отсутствует objectId');
      
      const boardId = data.boardId;
      const objectId = data.objectId;
      
      console.log('Удаление объекта');
      console.log('Доска:', boardId);
      console.log('Объект:', objectId);
      
      store.deleteObject(boardId, objectId);
      
      io.to(boardId).emit('object:deleted', objectId);
      
    } catch (error) {
      console.error('Ошибка удаления:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  
  socket.on('disconnect', function(reason) {
    console.log('Отключение');
    console.log('ID сокета:', socket.id);
    console.log('Причина:', reason);
    
    let leftBoards = 0;
    
    store.boards.forEach(function(board, boardId) {
      if (board.connectedUsers.has(socket.id)) {
        board.connectedUsers.delete(socket.id);
        
        io.to(boardId).emit('user:left', {
          userId: socket.id,
          totalUsers: board.connectedUsers.size
        });
        
        leftBoards++;
        console.log('Пользователь покинул доску:', boardId);
        console.log('Осталось пользователей:', board.connectedUsers.size);
      }
    });
    
    console.log('Пользователь покинул ' + leftBoards + ' досок');
    console.log('Всего подключений:', io.engine.clientsCount);
  });
});

const PORT = 3000;

server.listen(PORT, function() {
  console.log('Сервер запущен на порту', PORT);
  console.log('WebSocket готов к работе');
});