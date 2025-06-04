const { boardShape } = require('../data');
const { calculatePieceTrianglePoints, getShapeAnchor, canPlacePiece, findBestPlacement } = require('../logic');

const boardRows = boardShape.length;
const boardCols = boardShape[0].length;

function createEmptyBoard() {
  return Array.from({ length: boardRows }, () => Array(boardCols).fill(null));
}

describe('utility functions', () => {
  test('calculatePieceTrianglePoints upward', () => {
    const pts = calculatePieceTrianglePoints(0, 0, true, 2).split(' ').map(s => s.split(',').map(Number));
    expect(pts[0][0]).toBeCloseTo(0);
    expect(pts[0][1]).toBeCloseTo(Math.sqrt(3));
    expect(pts[1][0]).toBeCloseTo(1);
    expect(pts[1][1]).toBeCloseTo(0);
    expect(pts[2][0]).toBeCloseTo(2);
    expect(pts[2][1]).toBeCloseTo(Math.sqrt(3));
  });

  test('getShapeAnchor finds first non-zero cell', () => {
    const shape = [[0,0,0],[0,-1,0],[1,1,0]];
    expect(getShapeAnchor(shape)).toEqual({ i:1, j:1 });
  });
});

describe('board placement logic', () => {
  test('canPlacePiece respects triangle orientation', () => {
    const board = createEmptyBoard();
    const piece = { shape: [[1]] };
    expect(canPlacePiece(piece, 4, 0, board)).toBe(true);
    // orientation mismatch
    expect(canPlacePiece(piece, 5, 0, board)).toBe(false);
  });

  test('canPlacePiece detects occupied cell', () => {
    const board = createEmptyBoard();
    const piece = { name:'A', shape: [[1]] };
    board[4][0] = 'A';
    expect(canPlacePiece(piece, 4, 0, board)).toBe(false);
  });

  test('findBestPlacement finds available spot', () => {
    const board = createEmptyBoard();
    const piece = { shape: [[1]] };
    board[4][0] = 'X';
    const result = findBestPlacement(piece, 4, 0, board);
    expect(result).not.toBeNull();
    expect(canPlacePiece(piece, result.row, result.col, board)).toBe(true);
    expect(result.row !== 4 || result.col !== 0).toBe(true);
  });
});
