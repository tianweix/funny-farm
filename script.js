// data.js defines boardShape, piecesData
// board.js defines the initBoard, initPieces

const boardRows = boardShape.length;
const boardCols = boardShape[0].length;
const triangleSize = 80; // Size of each triangle side

let board = [];
let selectedPiece = null;
let history = [];
let pieces = {};
let isSolverRunning = false;
let isSolverPaused = false;
let solveButton;
let resetButton;
let rotateButton;
let undoButton;

function calculatePieceTrianglePoints(x, y, isUpward) {
    const h = triangleSize * Math.sqrt(3) / 2;
    if (isUpward) {
        return `${x},${y + h} ${x + triangleSize / 2},${y} ${x + triangleSize},${y + h}`;
    } else {
        return `${x},${y} ${x + triangleSize / 2},${y + h} ${x + triangleSize},${y}`;
    }
}

function canPlacePiece(piece, row, col) {
    const shape = piece.shape;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const ri = row + i;
                const cj = col + j;
                if (ri >= boardRows || cj >= boardCols || boardShape[ri][cj] !== shape[i][j] || board[ri][cj] ) {
                    return false;
                }
            }
        }
    }
    return true;
}

function placePieceOnBoard(piece, row, col) {
    const shape = piece.shape;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                const ri = row + i;
                const cj = col + j;
                board[ri][cj] = piece.name;
                const polygon = document.querySelector(`polygon[data-row='${ri}'][data-col='${cj}']`);
                polygon.setAttribute('fill', piece.color);
            }
        }
    }
    // Disable rotation for placed pieces
    if (!rotateButton) updateButtonStates();
    rotateButton.disabled = true;
}

function removePieceFromBoard(piece, row, col) {
    const shape = piece.shape;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                const xi = row + i;
                const yj = col + j;
                board[xi][yj] = null;
                const polygon = document.querySelector(`polygon[data-row='${xi}'][data-col='${yj}']`);
                polygon.setAttribute('fill', '#f0f0f0');
            }
        }
    }
}

function undoStep() {
    if (history.length > 0) {
        const lastMove = history.pop();
        removePieceFromBoard(lastMove.piece, lastMove.row, lastMove.col);
        lastMove.piece.element.draggable = true;
        lastMove.piece.element.style.opacity = '1';
        updateButtonStates();
        
        // Re-enable rotation if a piece is selected
        if (selectedPiece) {
            rotateButton.disabled = false;
        }
    } else {
        alert('No moves to undo.');
    }
}

function resetPuzzle() {
    initBoard();
    initPieces();
    selectedPiece = null;
    history = [];
    const messageEl = document.getElementById('message');
    messageEl.textContent = 'Game Reset!';
    messageEl.className = '';

    isSolverRunning = false;
    isSolverPaused = false;
    updateButtonStates();

    setTimeout(() => { if(messageEl.textContent === 'Game Reset!') messageEl.textContent = ''; }, 2000);
    iterCnt = 0;
}

function updateButtonStates() {
    if (!solveButton || !resetButton || !rotateButton || !undoButton) {
        solveButton = document.querySelector('button[onclick="toggleSolver()"]');
        resetButton = document.querySelector('button[onclick="resetPuzzle()"]');
        rotateButton = document.querySelector('button[onclick="rotatePiece()"]');
        undoButton = document.querySelector('button[onclick="undoStep()"]');
    }

    if (isSolverRunning) {
        solveButton.textContent = isSolverPaused ? 'Resume' : 'Pause';
        solveButton.disabled = false;
        resetButton.disabled = false; // Allow reset even when paused
        rotateButton.disabled = true;
        undoButton.disabled = true;
    } else {
        solveButton.textContent = 'Solve Puzzle';
        solveButton.disabled = false;
        resetButton.disabled = false;
        
        // Check if any piece is placed on the board
        const placedPieces = getPlacedPieces();
        if (placedPieces.length > 0 && selectedPiece && placedPieces.includes(selectedPiece.name)) {
            rotateButton.disabled = true; // Disable rotation for placed pieces
        } else {
            rotateButton.disabled = !selectedPiece; // Only enable if a piece is selected
        }
        
        undoButton.disabled = history.length === 0;
    }
}

async function toggleSolver() {
    const messageEl = document.getElementById('message');
    if (!solveButton) updateButtonStates(); // Initialize buttons if not already

    if (isSolverRunning) {
        if (isSolverPaused) {
            // Resume
            isSolverPaused = false;
            messageEl.textContent = 'Resuming...';
            messageEl.className = 'solving';
            updateButtonStates();
            // The solveRecursive loop will pick up from where it left off
        } else {
            // Pause
            isSolverPaused = true;
            messageEl.textContent = 'Solver Paused.';
            messageEl.className = 'paused';
            updateButtonStates();
        }
    } else {
        // Start solving
        isSolverRunning = true;
        isSolverPaused = false;
        messageEl.textContent = 'Solving... Please wait.';
        messageEl.className = 'solving';
        updateButtonStates();
        iterCnt = 0;
        runSolverAlgorithm(); // Call the actual solving logic
    }
}

async function runSolverAlgorithm() {
    const messageEl = document.getElementById('message');
    const allPieceNames = Object.keys(pieces);
    const userPlacedPieces = getPlacedPieces(); 

    // Check if user already solved it
    if (userPlacedPieces.length === allPieceNames.length) {
        let isBoardFullByUser = true;
        for (let r = 0; r < boardRows; r++) {
            for (let c = 0; c < boardCols; c++) {
                if (boardShape[r][c] !== 0 && !board[r][c]) {
                    isBoardFullByUser = false;
                    break;
                }
            }
            if (!isBoardFullByUser) break;
        }
        if (isBoardFullByUser) { 
            messageEl.textContent = 'Puzzle solved!';
            messageEl.className = '';
            allPieceNames.forEach(pieceName => {
                if (pieces[pieceName] && pieces[pieceName].element) {
                    pieces[pieceName].element.draggable = false;
                }
            });
            isSolverRunning = false;
            isSolverPaused = false;
            updateButtonStates();
            return; 
        }
    }

    let solved = false;
    try {
        if (await solveRecursive(allPieceNames, 0, userPlacedPieces)) {
            solved = true;
            messageEl.textContent = 'Puzzle solved!';
            messageEl.className = '';
            allPieceNames.forEach(pieceName => {
                const piece = pieces[pieceName];
                if (piece.element) {
                    piece.element.draggable = false;
                    piece.element.style.opacity = '0.5'; 
                }
            });
        } else {
            solved = false;
        }

        if (!solved && !isSolverPaused && isSolverRunning) {
            messageEl.textContent = 'No solution found. Try placing some pieces manually or reset.';
            messageEl.className = 'error';
        }
    } catch (e) {
        console.error("Error during solving:", e);
        if (!isSolverPaused) {
            messageEl.textContent = 'An error occurred during solving.';
            messageEl.className = 'error';
        }
        solved = false; // Ensure solver stops if error occurs
    } finally {
        if (!isSolverPaused) {
            isSolverRunning = false;
            isSolverPaused = false;
        }
        updateButtonStates();
    }
}

function getPlacedPieces() {
    const placedPieces = [];
    for (let i = 0; i < boardRows; i++) {
        for (let j = 0; j < boardCols; j++) {
            if (board[i][j] && !placedPieces.includes(board[i][j])) {
                placedPieces.push(board[i][j]);
            }
        }
    }
    return placedPieces;
}

let iterCnt = 0;
async function solveRecursive(pieceNames, pieceIndex, placedPieces) {
    // Handle pause and resume
    if (!isSolverRunning) return false;
    while (isSolverPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!isSolverRunning) return false;
    }

    while (pieceIndex < pieceNames.length && placedPieces.includes(pieceNames[pieceIndex])) {
        pieceIndex++;
    }
    if (pieceIndex >= pieceNames.length) {
        return true; 
    }

    iterCnt++;
    if (iterCnt % 2000 === 0) {
        console.log(`Solver iteration: ${iterCnt}, considering piece: ${pieceNames[pieceIndex]}`);
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield for UI updates/pause check
    }

    const pieceName = pieceNames[pieceIndex];
    const piece = pieces[pieceName];
    const rotations = [0, 60, 120, 180, 240, 300];
    for (let r = 0; r < boardRows; r++) {
        for (let c = 0; c < boardCols; c++) {
            for (const rotation of rotations) {
                if (piecesData[piece.name].duplicatedRotations && piecesData[piece.name].duplicatedRotations.includes(rotation)) {
                    continue;
                }
                piece.shape = piecesData[piece.name].shapeByRotation[rotation];
                if (canPlacePiece(piece, r, c)) {
                    placePieceOnBoard(piece, r, c);
                    if (await solveRecursive(pieceNames, pieceIndex + 1, placedPieces)) {
                        return true;
                    }
                    removePieceFromBoard(piece, r, c); // Backtrack
                }
            }
        }
    }

    return false;
}

resetPuzzle();
document.addEventListener('DOMContentLoaded', updateButtonStates); 