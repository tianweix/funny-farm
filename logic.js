const { boardShape } = require('./data');

const boardRows = boardShape.length;
const boardCols = boardShape[0].length;
const SNAP_SEARCH_RADIUS = 2;

function calculatePieceTrianglePoints(x, y, isUpward, size) {
  const h = size * Math.sqrt(3) / 2;
  if (isUpward) {
    return `${x},${y + h} ${x + size / 2},${y} ${x + size},${y + h}`;
  } else {
    return `${x},${y} ${x + size / 2},${y + h} ${x + size},${y}`;
  }
}

function getShapeAnchor(shape) {
  for (let i = 0; i < shape.length; i++) {
    for (let j = 0; j < shape[i].length; j++) {
      if (shape[i][j] !== 0) {
        return { i, j };
      }
    }
  }
  return { i: 0, j: 0 };
}

function canPlacePiece(piece, row, col, board, shape = boardShape) {
  const pieceShape = piece.shape;
  for (let i = 0; i < pieceShape.length; i++) {
    if (!pieceShape[i]) continue;
    for (let j = 0; j < pieceShape[i].length; j++) {
      if (pieceShape[i][j] !== 0) {
        const ri = row + i;
        const cj = col + j;
        if (ri < 0 || ri >= boardRows || cj < 0 || cj >= boardCols) return false;
        if (!shape[ri] || shape[ri][cj] === 0) return false;
        if (board[ri] && board[ri][cj]) return false;
        const pieceTriangleDirection = pieceShape[i][j];
        const boardTriangleDirection = (ri + cj) % 2 === 0 ? 1 : -1;
        if (pieceTriangleDirection !== boardTriangleDirection) return false;
      }
    }
  }
  return true;
}

function findBestPlacement(piece, idealRow, idealCol, board) {
  if (canPlacePiece(piece, idealRow, idealCol, board)) {
    return { row: idealRow, col: idealCol };
  }
  for (let d = 1; d <= SNAP_SEARCH_RADIUS; d++) {
    for (let cOffset = -d; cOffset <= d; cOffset++) {
      if (canPlacePiece(piece, idealRow - d, idealCol + cOffset, board)) {
        return { row: idealRow - d, col: idealCol + cOffset };
      }
      if (canPlacePiece(piece, idealRow + d, idealCol + cOffset, board)) {
        return { row: idealRow + d, col: idealCol + cOffset };
      }
    }
    for (let rOffset = -d + 1; rOffset <= d - 1; rOffset++) {
      if (canPlacePiece(piece, idealRow + rOffset, idealCol - d, board)) {
        return { row: idealRow + rOffset, col: idealCol - d };
      }
      if (canPlacePiece(piece, idealRow + rOffset, idealCol + d, board)) {
        return { row: idealRow + rOffset, col: idealCol + d };
      }
    }
  }
  return null;
}

module.exports = {
  calculatePieceTrianglePoints,
  getShapeAnchor,
  canPlacePiece,
  findBestPlacement
};
