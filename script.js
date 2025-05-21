// Define the board parameters
const boardShape = [
    [ 0,  0,  0,  0,  1, -1,  1,  0,  0,  0,  0],
    [ 0,  0,  0,  1, -1,  1, -1,  1,  0,  0,  0],
    [ 0,  0,  1, -1,  1, -1,  1, -1,  1,  0,  0],
    [ 0,  1, -1,  1, -1,  1, -1,  1, -1,  1,  0],
    [ 1, -1,  1, -1,  1, -1,  1, -1,  1, -1,  1],
    [-1,  1, -1,  1, -1,  1, -1,  1, -1,  1, -1],
    [ 0, -1,  1, -1,  1, -1,  1, -1,  1, -1,  0]
];
const boardRows = boardShape.length;
const boardCols = boardShape[0].length;
const triangleSize = 80; // Size of each triangle side

// Define the pieces (shapes made up of equilateral triangles)
// const piecesData = { ... }; // This has been moved to pieces_data.js

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

function initBoard() {
    const boardElement = document.getElementById('board');
    boardElement.innerHTML = '';
    board = [];

    // Create an SVG element for the board
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', (boardCols + 1) * triangleSize / 2);
    svg.setAttribute('height', boardRows * (triangleSize * Math.sqrt(3) / 2));
    boardElement.appendChild(svg);

    // Draw the triangular grid
    for (let row = 0; row < boardRows; row++) {
        board[row] = [];
        for (let col = 0; col < boardCols; col++) {
            if (boardShape[row][col] === 0) {
                continue;
            }
            const triangle = createTriangle(row, col);
            triangle.addEventListener('dragover', allowDrop);
            triangle.addEventListener('drop', dropPiece);
            svg.appendChild(triangle);
            board[row][col] = null;
        }
    }
}

function createTriangle(row, col) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const triangle = document.createElementNS(svgNS, 'polygon');
    const points = calculateTrianglePoints(row, col);
    triangle.setAttribute('points', points);
    triangle.setAttribute('fill', '#f0f0f0');
    triangle.setAttribute('stroke', '#ccc');
    triangle.dataset.row = row;
    triangle.dataset.col = col;
    triangle.dataset.orientation = boardShape[row][col] > 0 ? 'up' : 'down';
    return triangle;
}

function calculateTrianglePoints(row, col) {
    const h = triangleSize * Math.sqrt(3) / 2;
    const x = col * (triangleSize / 2);
    const y = row * h;

    if ((row + col) % 2 === 0) { // Upward triangle
        return `${x},${y + h} ${x + triangleSize / 2},${y} ${x + triangleSize},${y + h}`;
    } else { // Downward triangle
        return `${x},${y} ${x + triangleSize / 2},${y + h} ${x + triangleSize},${y}`;
    }
}

function initPieces() {
    const piecesElement = document.getElementById('pieces');
    piecesElement.innerHTML = '';
    pieces = {};
    for (let name in piecesData) {
        // Pre-calculate triangle count for each piece
        const firstRotationShape = piecesData[name].shapeByRotation[0];
        let size = 0;
        for (let r_idx = 0; r_idx < firstRotationShape.length; r_idx++) {
            for (let c_idx = 0; c_idx < firstRotationShape[r_idx].length; c_idx++) {
                if (firstRotationShape[r_idx][c_idx] !== 0) {
                    size++;
                }
            }
        }
        piecesData[name].triangleCount = size;

        const piece = createPiece(name, piecesData[name]);
        pieces[name] = piece;
        piecesElement.appendChild(piece.element);
    }
}

function createPiece(name, data) {
    const piece = {
        name: name,
        shape: data.shapeByRotation[0],
        color: data.color,
        element: document.createElement('div'),
        rotation: 0,
    };
    piece.element.className = 'piece';
    piece.element.draggable = true;
    piece.element.dataset.name = name;
    piece.element.addEventListener('dragstart', dragPiece);
    piece.element.addEventListener('click', () => selectPiece(name));
    drawPiece(piece);
    return piece;
}

function drawPiece(piece) {
    piece.element.innerHTML = '';
    const pieceContainer = document.createElement('div');
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');

    const shape = piece.shape;
    const h = triangleSize * Math.sqrt(3) / 2;

    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const triangle = document.createElementNS(svgNS, 'polygon');
                const x = j * (triangleSize / 2);
                const y = i * h;
                const points = calculatePieceTrianglePoints(x, y, shape[i][j] > 0);
                triangle.setAttribute('points', points);
                triangle.setAttribute('fill', piece.color);
                triangle.setAttribute('stroke', '#999');
                triangle.dataset.name = "polygon-" + piece.element.dataset.name
                triangle.dataset.i = i;
                triangle.dataset.j = j;
                svg.appendChild(triangle);
            }
        }
    }
    svg.setAttribute('width', (shape[0].length + 1) * triangleSize / 2);
    svg.setAttribute('height', shape.length * h);
    pieceContainer.appendChild(svg);
    const label = document.createElement('div');
    label.className = 'piece-label';
    label.textContent = piece.name;
    pieceContainer.appendChild(label);
    piece.element.appendChild(pieceContainer);
}

function calculatePieceTrianglePoints(x, y, isUpward) {
    const h = triangleSize * Math.sqrt(3) / 2;
    if (isUpward) {
        return `${x},${y + h} ${x + triangleSize / 2},${y} ${x + triangleSize},${y + h}`;
    } else {
        return `${x},${y} ${x + triangleSize / 2},${y + h} ${x + triangleSize},${y}`;
    }
}

function rotatePiece() {
    if (selectedPiece) {
        selectedPiece.rotation = (selectedPiece.rotation + 60) % 360;
        selectedPiece.shape = piecesData[selectedPiece.name].shapeByRotation[selectedPiece.rotation];
        drawPiece(selectedPiece);
        selectedPiece.element.querySelector('svg').classList.add('selected');
        selectedPiece.element.querySelector('svg').style.outline = '2px solid red';
    }
}

function selectPiece(name) {
    if (selectedPiece) {
        selectedPiece.element.querySelector('svg').classList.remove('selected');
        selectedPiece.element.querySelector('svg').style.outline = 'none';
    }
    selectedPiece = pieces[name];
    selectedPiece.element.querySelector('svg').classList.add('selected');
    selectedPiece.element.querySelector('svg').style.outline = '2px solid red';
}

function dragPiece(event) {
    const piece = pieces[event.target.dataset.name];

    // If for some reason the piece isn't found or the target isn't a piece,
    // prevent drag. This is a defensive check.
    if (!piece) {
        event.preventDefault();
        console.warn("Drag attempt on non-piece element or piece not found.");
        return;
    }

    const rect = event.target.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    let triangleIndex = getTriangleFromCoordinates(mouseX, mouseY, piece);

    if (triangleIndex) {
        // Click was on a valid triangle, proceed with drag
        event.dataTransfer.setData('text', event.target.dataset.name);
        event.dataTransfer.setData('src-offset-row', triangleIndex.i);
        event.dataTransfer.setData('src-offset-col', triangleIndex.j);
    } else {
        // Click was on a transparent area of the piece's bounding box.
        // Prevent the drag operation from starting.
        event.preventDefault();
        // Optional: console.log("Drag attempt on transparent area of piece denied.");
    }
}

function getTriangleFromCoordinates(mouseX, mouseY, piece) {
    let shape = piece.shape
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const polygon = document.querySelector(`polygon[data-name='${"polygon-" + piece.element.dataset.name}'][data-i='${i}'][data-j='${j}']`);
                if (isPointInTriangle(mouseX, mouseY, polygon.points[0], polygon.points[1], polygon.points[2]))
                {
                    return {i, j}
                }
            }
        }
    }
    return null;
}

function isPointInTriangle(mouseX, mouseY, point1, point2, point3) {
    // Calculate areas using barycentric coordinates
    const areaOrig = Math.abs((point2.x - point1.x) * (point3.y - point1.y) - (point3.x - point1.x) * (point2.y - point1.y));  // Area of the whole triangle
    const area1 = Math.abs((point1.x - mouseX) * (point2.y - mouseY) - (point2.x - mouseX) * (point1.y - mouseY));  // Area with the point
    const area2 = Math.abs((point2.x - mouseX) * (point3.y - mouseY) - (point3.x - mouseX) * (point2.y - mouseY));  // Area with the point
    const area3 = Math.abs((point3.x - mouseX) * (point1.y - mouseY) - (point1.x - mouseX) * (point3.y - mouseY));  // Area with the point

    // Check if the sum of the sub-areas is equal to the original area
    return (area1 + area2 + area3) === areaOrig;
}

function allowDrop(event) {
    event.preventDefault();
}

function dropPiece(event) {
    event.preventDefault();
    const pieceName = event.dataTransfer.getData('text');
    const piece = pieces[pieceName];
    var row = parseInt(event.target.dataset.row);
    var col = parseInt(event.target.dataset.col);
    if (event.dataTransfer.getData('src-offset-row') && event.dataTransfer.getData('src-offset-col'))
    {
        const offset_row = parseInt(event.dataTransfer.getData('src-offset-row'));
        const offset_col = parseInt(event.dataTransfer.getData('src-offset-col'));
        row -= offset_row
        col -= offset_col
    }
    else
    {
        // col -= piece.shape[0].findIndex(element => element !== 0);
    }
    if (canPlacePiece(piece, row, col)) {
        placePieceOnBoard(piece, row, col);
        history.push({ piece, row, col });
        piece.element.draggable = false;
        piece.element.style.opacity = '0.5';
        updateButtonStates();
    } else {
        alert('Cannot place piece here.');
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
        rotateButton.disabled = false;
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

    const originalPieceDisplayStates = {};
    allPieceNames.forEach(name => { 
        const pieceElement = pieces[name].element;
        if (pieceElement) {
            originalPieceDisplayStates[name] = {
                draggable: pieceElement.draggable,
                opacity: pieceElement.style.opacity,
                rotation: pieces[name].rotation,
                shape: pieces[name].shape
            };
        }
    });

    let solved = false;
    try {
        if (await solveRecursive(allPieceNames, 0, userPlacedPieces)) {
            // solveRecursive thinks it's done, now verify the board is completely full.
            let isBoardTrulyFull = true;
            for (let r = 0; r < boardRows; r++) {
                for (let c = 0; c < boardCols; c++) {
                    // Check if a valid board cell (boardShape[r][c] !== 0) is empty (!board[r][c])
                    if (boardShape[r][c] !== 0 && !board[r][c]) {
                        isBoardTrulyFull = false;
                        break;
                    }
                }
                if (!isBoardTrulyFull) break;
            }

            if (isBoardTrulyFull) {
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
        } else {
            solved = false;
        }

        if (!solved) {
            if (!isSolverPaused) {
                messageEl.textContent = 'No solution found. Try placing some pieces manually or reset.';
                messageEl.className = 'error';
            }
            if (!isSolverPaused && !isSolverRunning) { 
                allPieceNames.forEach(name => {
                    if (!userPlacedPieces.includes(name)) {
                        let isNowPlaced = false;
                        for (let r = 0; r < boardRows; r++) {
                            for (let c = 0; c < boardCols; c++) {
                                if (board[r][c] === name) {
                                    isNowPlaced = true;
                                    break;
                                }
                            }
                            if (isNowPlaced) break;
                        }
                        const pieceElement = pieces[name].element;
                        if (!isNowPlaced && pieceElement && originalPieceDisplayStates[name]) {
                            pieceElement.draggable = originalPieceDisplayStates[name].draggable;
                            pieceElement.style.opacity = originalPieceDisplayStates[name].opacity;
                            const piece = pieces[name];
                            piece.rotation = originalPieceDisplayStates[name].rotation;
                            piece.shape = originalPieceDisplayStates[name].shape;
                            drawPiece(piece);
                        }
                    }
                });
            }
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

    // Advance pieceIndex past pieces that were already placed by the user.
    // This mirrors the logic from the simpler HTML version.
    let currentProcessingPieceIndex = pieceIndex;
    while (currentProcessingPieceIndex < pieceNames.length && placedPieces.includes(pieceNames[currentProcessingPieceIndex])) {
        currentProcessingPieceIndex++;
    }

    // Base Case: If all pieces have been considered (either user-placed or successfully placed by solver based on index)
    // This is the simpler base case from the HTML version.
    if (currentProcessingPieceIndex >= pieceNames.length) {
        return true; 
    }

    iterCnt++;
    if (iterCnt % 2000 === 0) {
        console.log(`Solver iteration: ${iterCnt}, considering piece: ${pieceNames[currentProcessingPieceIndex]}`);
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield for UI updates/pause check
    }

    const pieceName = pieceNames[currentProcessingPieceIndex];
    const piece = pieces[pieceName];
    const originalShape = piece.shape; 
    const originalRotation = piece.rotation;

    const rotations = [0, 60, 120, 180, 240, 300];

    for (let r = 0; r < boardRows; r++) {
        for (let c = 0; c < boardCols; c++) {
            // Rely on canPlacePiece to handle boardShape[r][c] === 0 or other invalid placements.
            for (const rotation of rotations) {
                if (piecesData[piece.name].duplicatedRotations && piecesData[piece.name].duplicatedRotations.includes(rotation)) {
                    continue;
                }
                piece.shape = piecesData[piece.name].shapeByRotation[rotation];
                piece.rotation = rotation; 

                if (canPlacePiece(piece, r, c)) {
                    placePieceOnBoard(piece, r, c);
                    if (await solveRecursive(pieceNames, currentProcessingPieceIndex + 1, placedPieces)) {
                        return true;
                    }
                    removePieceFromBoard(piece, r, c); // Backtrack
                }
            }
        }
    }

    piece.shape = originalShape; 
    piece.rotation = originalRotation;
    // drawPiece(piece); // Optionally redraw if it was visually changed if needed

    return false;
}

resetPuzzle();
// Ensure buttons are initialized on load, as resetPuzzle might not find them yet
document.addEventListener('DOMContentLoaded', updateButtonStates); 