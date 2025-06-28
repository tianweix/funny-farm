import React from 'react';
import { piecesData, getPieceWithRotation } from '../utils/gameUtils';
import { calculatePieceTrianglePoints } from '../utils/gameUtils';

function PiecesPanel({ pieceStates, selectedPiece, onSelectPiece, onRotatePiece }) {
  
  const handlePieceDragStart = (event, pieceName) => {
    event.dataTransfer.setData('text', pieceName);
  };

  const handlePieceClick = (pieceName) => {
    onSelectPiece(pieceName);
  };

  const handlePieceDoubleClick = (pieceName) => {
    onRotatePiece(pieceName);
  };

  const renderPiece = (pieceName) => {
    const state = pieceStates[pieceName];
    const piece = getPieceWithRotation(pieceName, state.rotation);
    
    if (!piece || !piece.shape) return null;

    const isSelected = selectedPiece === pieceName;
    const isOnBoard = state.inCanvas;
    
    // Calculate SVG dimensions
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    const triangleSize = 40; // Smaller size for pieces panel
    
    piece.shape.forEach((row, i) => {
      row.forEach((cell, j) => {
        if (cell !== 0) {
          const x = j * (triangleSize / 2);
          const y = i * (triangleSize * Math.sqrt(3) / 2);
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x + triangleSize);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y + triangleSize * Math.sqrt(3) / 2);
        }
      });
    });

    const svgWidth = maxX - minX;
    const svgHeight = maxY - minY;

    return (
      <div
        key={pieceName}
        className={`piece ${isSelected ? 'selected' : ''} ${isOnBoard ? 'on-board' : ''}`}
        style={{
          position: 'absolute',
          left: state.x,
          top: state.y,
          cursor: isOnBoard ? 'default' : 'grab'
        }}
        draggable={!isOnBoard}
        onDragStart={(e) => handlePieceDragStart(e, pieceName)}
        onClick={() => handlePieceClick(pieceName)}
        onDoubleClick={() => handlePieceDoubleClick(pieceName)}
      >
        <div className="piece-label">{pieceName}</div>
        <svg 
          width={svgWidth} 
          height={svgHeight}
          className={isSelected ? 'selected' : ''}
          style={{
            outline: isSelected ? '2px solid red' : 'none',
            opacity: isOnBoard ? 0.5 : 1
          }}
        >
          {piece.shape.map((row, i) =>
            row.map((cell, j) => {
              if (cell === 0) return null;

              const x = j * (triangleSize / 2) - minX;
              const y = i * (triangleSize * Math.sqrt(3) / 2) - minY;
              const isUpward = cell > 0;
              const points = calculatePieceTrianglePoints(x, y, isUpward, triangleSize);

              return (
                <polygon
                  key={`${i}-${j}`}
                  points={points}
                  fill={piece.color}
                  stroke="#333"
                  strokeWidth="1"
                />
              );
            })
          )}
        </svg>
      </div>
    );
  };

  return (
    <div id="pieces-layer">
      {Object.keys(piecesData).map(pieceName => renderPiece(pieceName))}
    </div>
  );
}

export default PiecesPanel;