// data.js defines boardShape and piecesData

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

const SNAP_SEARCH_RADIUS = 2; // How far to look for a snap position (e.g., 2 means a 5x5 area centered on drop)

/**
 * Finds the best valid placement for a piece near the ideal drop coordinates.
 * It searches outwards in square layers from the ideal position.
 * Assumes `canPlacePiece(piece, row, col)` function is defined elsewhere
 * and returns true if the piece can be placed at (row, col), false otherwise.
 */
function findBestPlacement(piece, idealRow, idealCol) {
    // Try the exact spot first
    if (canPlacePiece(piece, idealRow, idealCol)) {
        return { row: idealRow, col: idealCol };
    }

    // Search outwards in square layers
    for (let d = 1; d <= SNAP_SEARCH_RADIUS; d++) {
        // Check cells on the perimeter of a square of side 2*d+1, centered at idealRow, idealCol
        // Top and bottom rows of the current search square
        for (let cOffset = -d; cOffset <= d; cOffset++) {
            // Top row: (idealRow - d, idealCol + cOffset)
            if (canPlacePiece(piece, idealRow - d, idealCol + cOffset)) {
                return { row: idealRow - d, col: idealCol + cOffset };
            }
            // Bottom row: (idealRow + d, idealCol + cOffset)
            if (canPlacePiece(piece, idealRow + d, idealCol + cOffset)) {
                return { row: idealRow + d, col: idealCol + cOffset };
            }
        }

        // Left and right columns of the current search square (excluding corners already checked by above loops)
        for (let rOffset = -d + 1; rOffset <= d - 1; rOffset++) {
            // Left column: (idealRow + rOffset, idealCol - d)
            if (canPlacePiece(piece, idealRow + rOffset, idealCol - d)) {
                return { row: idealRow + rOffset, col: idealCol - d };
            }
            // Right column: (idealRow + rOffset, idealCol + d)
            if (canPlacePiece(piece, idealRow + rOffset, idealCol + d)) {
                return { row: idealRow + rOffset, col: idealCol + d };
            }
        }
    }
    return null; // No suitable placement found in the search radius
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

    const bestPosition = findBestPlacement(piece, row, col);

    if (bestPosition) {
        // Assumes `placePieceOnBoard(piece, row, col)` function is defined elsewhere
        // and handles the actual placement on the game board data structure and UI.
        placePieceOnBoard(piece, bestPosition.row, bestPosition.col);
        // Assumes `history` is a global array for game state history.
        history.push({ piece, row: bestPosition.row, col: bestPosition.col });
        piece.element.draggable = false;
        piece.element.style.opacity = '0.5';
        // Assumes `updateButtonStates()` function is defined elsewhere.
        updateButtonStates();
        
        // Check if the puzzle is solved after placing a piece
        checkPuzzleSolved();
    } else {
        alert('Cannot place piece here or nearby.');
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
    
    // Check if the selected piece is already placed on the board
    // and disable rotation if it is
    if (!rotateButton) updateButtonStates();
    
    // Check board array to see if this piece is already placed
    let isPiecePlaced = false;
    for (let r = 0; r < boardRows; r++) {
        for (let c = 0; c < boardCols; c++) {
            if (board[r][c] === name) {
                isPiecePlaced = true;
                break;
            }
        }
        if (isPiecePlaced) break;
    }
    
    rotateButton.disabled = isPiecePlaced;
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
if (typeof module !== 'undefined') {
  module.exports = { findBestPlacement };
}
