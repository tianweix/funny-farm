import React, { useState, useReducer, useEffect } from 'react';
import GameBoard from './GameBoard';
import PiecesPanel from './PiecesPanel';
import Controls from './Controls';
import InstructionsModal from './InstructionsModal';
import { 
  createEmptyBoard, 
  isPuzzleSolved, 
  piecesData,
  tryPlacePiece,
  removePieceFromBoard,
  getPieceWithRotation
} from '../utils/gameUtils';

// Game state reducer
function gameReducer(state, action) {
  switch (action.type) {
    case 'RESET_PUZZLE':
      return {
        ...state,
        board: createEmptyBoard(),
        pieceStates: initializePieceStates(),
        isPuzzleSolved: false,
        selectedPiece: null,
        isSolverRunning: false,
        isSolverPaused: false,
        message: ''
      };
      
    case 'SELECT_PIECE':
      return {
        ...state,
        selectedPiece: action.pieceName
      };
      
    case 'PLACE_PIECE':
      const result = tryPlacePiece(
        state.board, 
        action.pieceName, 
        action.row, 
        action.col, 
        state.pieceStates[action.pieceName].rotation
      );
      
      if (result.success) {
        const newPieceStates = { ...state.pieceStates };
        newPieceStates[action.pieceName] = {
          ...newPieceStates[action.pieceName],
          inCanvas: true,
          boardPosition: result.position
        };
        
        const solved = isPuzzleSolved(result.board);
        
        return {
          ...state,
          board: result.board,
          pieceStates: newPieceStates,
          isPuzzleSolved: solved,
          message: solved ? 'Puzzle Solved!' : ''
        };
      }
      return state;
      
    case 'REMOVE_PIECE':
      const newBoard = removePieceFromBoard(state.board, action.pieceName);
      const newPieceStates = { ...state.pieceStates };
      newPieceStates[action.pieceName] = {
        ...newPieceStates[action.pieceName],
        inCanvas: false,
        boardPosition: null
      };
      
      return {
        ...state,
        board: newBoard,
        pieceStates: newPieceStates,
        isPuzzleSolved: false,
        message: ''
      };
      
    case 'ROTATE_PIECE':
      const currentRotation = state.pieceStates[action.pieceName].rotation;
      const newRotation = (currentRotation + 60) % 360;
      
      return {
        ...state,
        pieceStates: {
          ...state.pieceStates,
          [action.pieceName]: {
            ...state.pieceStates[action.pieceName],
            rotation: newRotation
          }
        }
      };
      
    case 'UPDATE_PIECE_POSITION':
      return {
        ...state,
        pieceStates: {
          ...state.pieceStates,
          [action.pieceName]: {
            ...state.pieceStates[action.pieceName],
            x: action.x,
            y: action.y
          }
        }
      };
      
    case 'START_SOLVER':
      return {
        ...state,
        isSolverRunning: true,
        isSolverPaused: false,
        message: 'Solving... Please wait.'
      };
      
    case 'PAUSE_SOLVER':
      return {
        ...state,
        isSolverPaused: true,
        message: 'Solver Paused.'
      };
      
    case 'RESUME_SOLVER':
      return {
        ...state,
        isSolverPaused: false,
        message: 'Resuming...'
      };
      
    case 'STOP_SOLVER':
      return {
        ...state,
        isSolverRunning: false,
        isSolverPaused: false,
        message: ''
      };
      
    case 'SET_MESSAGE':
      return {
        ...state,
        message: action.message
      };
      
    default:
      return state;
  }
}

// Initialize piece states
function initializePieceStates() {
  const states = {};
  Object.keys(piecesData).forEach((pieceName, index) => {
    states[pieceName] = {
      x: 600,
      y: 100 + index * 80,
      rotation: 0,
      initialX: 600,
      initialY: 100 + index * 80,
      inCanvas: false,
      scale: 1,
      boardPosition: null
    };
  });
  return states;
}

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, {
    board: createEmptyBoard(),
    pieceStates: initializePieceStates(),
    selectedPiece: null,
    isPuzzleSolved: false,
    isSolverRunning: false,
    isSolverPaused: false,
    message: ''
  });
  
  const [showInstructions, setShowInstructions] = useState(false);
  const [triangleSize, setTriangleSize] = useState(80);

  // Build version
  const [buildVersion, setBuildVersion] = useState('unknown');
  
  useEffect(() => {
    // Fetch build version
    fetch('./package.json')
      .then(r => r.json())
      .then(pkg => setBuildVersion(pkg.version))
      .catch(() => {});
      
    // F12 keydown handler
    const handleKeyDown = (event) => {
      if (event.key === 'F12') {
        console.log(`Build version: ${buildVersion}`);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [buildVersion]);

  const handleResetPuzzle = () => {
    dispatch({ type: 'RESET_PUZZLE' });
  };

  const handleSelectPiece = (pieceName) => {
    dispatch({ type: 'SELECT_PIECE', pieceName });
  };

  const handlePlacePiece = (pieceName, row, col) => {
    dispatch({ type: 'PLACE_PIECE', pieceName, row, col });
  };

  const handleRemovePiece = (pieceName) => {
    dispatch({ type: 'REMOVE_PIECE', pieceName });
  };

  const handleRotatePiece = (pieceName) => {
    if (!pieceName && gameState.selectedPiece) {
      pieceName = gameState.selectedPiece;
    }
    if (pieceName) {
      dispatch({ type: 'ROTATE_PIECE', pieceName });
    }
  };

  const handleToggleSolver = () => {
    if (gameState.isSolverRunning) {
      if (gameState.isSolverPaused) {
        dispatch({ type: 'RESUME_SOLVER' });
      } else {
        dispatch({ type: 'PAUSE_SOLVER' });
      }
    } else {
      dispatch({ type: 'START_SOLVER' });
      // TODO: Implement solver algorithm
    }
  };

  return (
    <div className="App">
      <div className="header">
        <h1>Funny Farm Puzzle</h1>
        <div className="top-controls">
          <div className="button-container">
            <button onClick={handleToggleSolver}>
              {gameState.isSolverRunning 
                ? (gameState.isSolverPaused ? 'Resume' : 'Pause')
                : 'Solve Puzzle'
              }
            </button>
            <button onClick={handleResetPuzzle}>Reset Puzzle</button>
          </div>
          <span 
            onClick={() => setShowInstructions(true)} 
            className="settings-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 28 28">
              <path d="M0 0h24v24H0z" fill="none"/>
              <path d="M19.44 12.99l-.01.02c.04-.33.07-.67.07-1.01s-.03-.68-.07-1.01l.01.02 2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98L14.47 2.4c-.03-.24-.24-.4-.48-.4H9.99c-.24 0-.45.16-.48.4L9.13 4.06c-.61.25-1.17.58-1.69.98l-2.49-1c-.22-.08-.49 0-.61.22l-2 3.46c-.12.22-.07.49.12.64l2.11 1.65-.01-.02c-.04.33-.07.67-.07 1.01s.03.68.07 1.01l-.01-.02-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.4.48.4h4.02c.24 0 .45-.16.48-.4l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zm-7.44 2.51c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
            </svg>
          </span>
        </div>
      </div>

      <div className="main-layout">
        <div className="canvas-container">
          <div id="canvas">
            <GameBoard 
              board={gameState.board}
              triangleSize={triangleSize}
              onPlacePiece={handlePlacePiece}
              onRemovePiece={handleRemovePiece}
              onSelectPiece={handleSelectPiece}
            />
            <PiecesPanel 
              pieceStates={gameState.pieceStates}
              selectedPiece={gameState.selectedPiece}
              onSelectPiece={handleSelectPiece}
              onRotatePiece={handleRotatePiece}
            />
          </div>
        </div>
      </div>

      <div id="message" className={
        gameState.isSolverRunning 
          ? (gameState.isSolverPaused ? 'paused' : 'solving')
          : (gameState.isPuzzleSolved ? 'solved' : '')
      }>
        {gameState.message}
      </div>

      <Controls 
        selectedPiece={gameState.selectedPiece}
        isPuzzleSolved={gameState.isPuzzleSolved}
        isSolverRunning={gameState.isSolverRunning}
        onRotatePiece={handleRotatePiece}
      />

      <InstructionsModal 
        show={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  );
}

export default App;