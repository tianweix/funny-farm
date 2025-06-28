import React from 'react';
import { boardShape, boardRows, boardCols, piecesData } from '../utils/gameUtils';
import { calculateTrianglePoints } from '../utils/gameUtils';

function GameBoard({ board, triangleSize, onPlacePiece, onRemovePiece, onSelectPiece }) {
  
  const handleTriangleClick = (row, col) => {
    const cellValue = board[row] && board[row][col];
    if (cellValue) {
      // Piece is placed here, remove it
      onRemovePiece(cellValue);
    }
  };

  const handleTriangleDrop = (event, row, col) => {
    event.preventDefault();
    const pieceName = event.dataTransfer.getData('text');
    if (pieceName) {
      onPlacePiece(pieceName, row, col);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const svgWidth = (boardCols + 1) * triangleSize / 2;
  const svgHeight = boardRows * (triangleSize * Math.sqrt(3) / 2);

  return (
    <div id="board-grid">
      <svg 
        width={svgWidth} 
        height={svgHeight}
        style={{ border: '1px solid #ccc' }}
      >
        {Array.from({ length: boardRows }, (_, row) =>
          Array.from({ length: boardCols }, (_, col) => {
            if (boardShape[row][col] === 0) {
              return null;
            }

            const points = calculateTrianglePoints(row, col, triangleSize);
            const isOccupied = board[row] && board[row][col];
            const pieceColor = isOccupied ? getPieceColor(board[row][col]) : '#f0f0f0';

            return (
              <polygon
                key={`${row}-${col}`}
                points={points}
                fill={pieceColor}
                stroke="#ccc"
                strokeWidth="1"
                style={{ cursor: 'pointer' }}
                data-row={row}
                data-col={col}
                data-orientation={boardShape[row][col] > 0 ? 'up' : 'down'}
                onClick={() => handleTriangleClick(row, col)}
                onDrop={(e) => handleTriangleDrop(e, row, col)}
                onDragOver={handleDragOver}
                onMouseEnter={(e) => {
                  if (!isOccupied) {
                    e.target.style.opacity = '0.7';
                    e.target.style.strokeWidth = '2';
                    e.target.style.stroke = '#ff6347';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isOccupied) {
                    e.target.style.opacity = '1';
                    e.target.style.strokeWidth = '1';
                    e.target.style.stroke = '#ccc';
                  }
                }}
              />
            );
          })
        )}
      </svg>
    </div>
  );
}

// Helper function to get piece color
function getPieceColor(pieceName) {
  return piecesData[pieceName]?.color || '#cccccc';
}

export default GameBoard;