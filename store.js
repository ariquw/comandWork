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

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }
}

module.exports = new Store();