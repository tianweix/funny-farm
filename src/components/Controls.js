import React from 'react';

function Controls({ selectedPiece, isPuzzleSolved, isSolverRunning, onRotatePiece }) {
  
  const handleRotateClick = () => {
    if (selectedPiece) {
      onRotatePiece(selectedPiece);
    }
  };

  // Check if the selected piece is placed on the board
  const isPiecePlaced = selectedPiece && isPuzzleSolved; // Simplified for now
  
  return (
    <div className="side-controls" style={{ display: 'none' }}>
      {/* Controls are hidden in the original design, keeping for compatibility */}
      <button 
        onClick={handleRotateClick}
        disabled={!selectedPiece || isPiecePlaced}
      >
        Rotate
      </button>
    </div>
  );
}

export default Controls;