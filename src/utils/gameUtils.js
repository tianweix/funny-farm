import { boardShape, piecesData } from './data.js';
import { canPlacePiece, findBestPlacement } from './logic.js';

const boardRows = boardShape.length;
const boardCols = boardShape[0].length;

// Game constants
export const GRID_AREA_RATIO = 0.4; 
export const GRID_PADDING = 20; 
export const PIECE_MARGIN = 16; 
export const PIECE_LABEL_HEIGHT = 20; 
export const MIN_SCALE = 0.6; 

// Initialize empty board
export function createEmptyBoard() {
  const board = [];
  for (let row = 0; row < boardRows; row++) {
    board[row] = [];
    for (let col = 0; col < boardCols; col++) {
      if (boardShape[row][col] === 0) {
        continue;
      }
      board[row][col] = null;
    }
  }
  return board;
}

// Calculate triangle points for SVG
export function calculateTrianglePoints(row, col, triangleSize = 80) {
  const h = triangleSize * Math.sqrt(3) / 2;
  const x = col * (triangleSize / 2);
  const y = row * h;

  if ((row + col) % 2 === 0) { // Upward triangle
    return `${x},${y + h} ${x + triangleSize / 2},${y} ${x + triangleSize},${y + h}`;
  } else { // Downward triangle
    return `${x},${y} ${x + triangleSize / 2},${y + h} ${x + triangleSize},${y}`;
  }
}

// Calculate piece triangle points for rendering
export function calculatePieceTrianglePoints(x, y, isUpward, size) {
  const h = size * Math.sqrt(3) / 2;
  if (isUpward) {
    return `${x},${y + h} ${x + size / 2},${y} ${x + size},${y + h}`;
  } else {
    return `${x},${y} ${x + size / 2},${y + h} ${x + size},${y}`;
  }
}

// Place piece on board
export function placePieceOnBoard(board, piece, row, col) {
  const newBoard = board.map(r => [...r]);
  const pieceShape = piece.shape;
  
  for (let i = 0; i < pieceShape.length; i++) {
    if (!pieceShape[i]) continue;
    for (let j = 0; j < pieceShape[i].length; j++) {
      if (pieceShape[i][j] !== 0) {
        const ri = row + i;
        const cj = col + j;
        if (ri >= 0 && ri < boardRows && cj >= 0 && cj < boardCols) {
          newBoard[ri][cj] = piece.name;
        }
      }
    }
  }
  return newBoard;
}

// Remove piece from board
export function removePieceFromBoard(board, pieceName) {
  const newBoard = board.map(row => 
    row.map(cell => cell === pieceName ? null : cell)
  );
  return newBoard;
}

// Check if puzzle is solved
export function isPuzzleSolved(board) {
  for (let row = 0; row < boardRows; row++) {
    for (let col = 0; col < boardCols; col++) {
      if (boardShape[row][col] !== 0 && board[row][col] === null) {
        return false;
      }
    }
  }
  return true;
}

// Get piece by name with current rotation
export function getPieceWithRotation(pieceName, rotation) {
  const pieceData = piecesData[pieceName];
  if (!pieceData) return null;
  
  return {
    name: pieceName,
    shape: pieceData.shapeByRotation[rotation],
    color: pieceData.color,
    rotation: rotation
  };
}

// Try to place piece and return result
export function tryPlacePiece(board, pieceName, row, col, rotation) {
  const piece = getPieceWithRotation(pieceName, rotation);
  if (!piece) return { success: false };

  const bestPosition = findBestPlacement(piece, row, col, board);
  if (bestPosition) {
    const newBoard = placePieceOnBoard(board, piece, bestPosition.row, bestPosition.col);
    return { 
      success: true, 
      board: newBoard, 
      position: bestPosition 
    };
  }
  
  return { success: false };
}

export { boardShape, piecesData, boardRows, boardCols, canPlacePiece, findBestPlacement };