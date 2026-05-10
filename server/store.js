class Store {
  constructor() {
    this.boards = new Map();
  }

  createBoard() {
    const boardId = this.generateId();
    this.boards.set(boardId, {
      id: boardId,
      objects: [],
      connectedUsers: new Set(),
      createdAt: Date.now()
    });
    return boardId;
  }

  getBoard(boardId) {
    const board = this.boards.get(boardId);
    if (!board) {
      const error = new Error('Доска не найдена');
      error.status = 404;
      throw error;
    }
    return board;
  }

  addObject(boardId, objectData) {
    const board = this.getBoard(boardId);
    const newObject = {
      id: this.generateId(),
      type: objectData.type,
      x: Number(objectData.x) || 100,
      y: Number(objectData.y) || 100,
      width: Number(objectData.width) || 150,
      height: Number(objectData.height) || 100,
      color: objectData.color || '#000000',
      lineWidth: Number(objectData.lineWidth) || 2,
      fillColor: objectData.fillColor || '#ffffff',
      text: objectData.text || 'Текст',
      fontSize: Number(objectData.fontSize) || 16,
      imageUrl: objectData.imageUrl || '',
      createdAt: Date.now()
    };
    board.objects.push(newObject);
    return newObject;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }
}

module.exports = new Store();