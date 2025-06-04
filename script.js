// data.js defines boardShape, piecesData
// board.js defines the initBoard, initPieces

const boardRows = boardShape.length;
const boardCols = boardShape[0].length;
let triangleSize = 80; // Size of each triangle side

let board = [];
let selectedPiece = null;
let history = [];
const gridOffsetX = 100;
const gridOffsetY = 50;
let isSolverRunning = false;
let isSolverPaused = false;
let isPuzzleSolved = false;
let solveButton;
let resetButton;
let rotateButton;
let undoButton;

// Build version derived from package.json
let BUILD_VERSION = 'unknown';

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Node environment (tests, builds)
    try {
        BUILD_VERSION = require('./package.json').version;
    } catch (e) {
        // ignore
    }
} else if (typeof fetch !== 'undefined') {
    // Browser environment - fetch package.json for version
    fetch('./package.json')
        .then(r => r.json())
        .then(pkg => {
            BUILD_VERSION = pkg.version;
        })
        .catch(() => { /* ignore */ });
}

if (typeof window !== 'undefined') {
    window.addEventListener('keydown', event => {
        if (event.key === 'F12') {
            console.log(`Build version: ${BUILD_VERSION}`);
        }
    });
}

// 每个图块的状态
let pieceStates = {}; // { name: { x, y, rotation, inCanvas, initialX, initialY } }
let selectedPieceName = null;

let canvasWidth = 1000;
let canvasHeight = 600;

// 全局常量和配置
const GRID_AREA_RATIO = 0.4; // grid区域占40%
const GRID_PADDING = 20; // grid区域的padding
const PIECE_MARGIN = 16; // 拼块之间的间距
const MIN_SCALE = 0.6; // 最小缩放比例

// 响应式布局的断点
const BREAKPOINTS = {
    MOBILE: 768,  // 移动设备
    TABLET: 1024  // 平板设备
};

// --- 全局拖拽信息 ---
let dragInfo = null;

function calculatePieceTrianglePoints(x, y, isUpward, size = triangleSize) {
    const h = size * Math.sqrt(3) / 2;
    if (isUpward) {
        // 向上三角形：底边在下方，顶点在上方
        return `${x},${y + h} ${x + size / 2},${y} ${x + size},${y + h}`;
    } else {
        // 向下三角形：底边在上方，顶点在下方
        return `${x},${y} ${x + size / 2},${y + h} ${x + size},${y}`;
    }
}

// 辅助函数：获取shape的锚点（第一个非零元素的i,j）
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

function canPlacePiece(piece, row, col) {
    const shape = piece.shape;
    for (let i = 0; i < shape.length; i++) {
        if (!shape[i]) continue;
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const ri = row + i;
                const cj = col + j;
                if (ri < 0 || ri >= boardRows || cj < 0 || cj >= boardCols) return false;
                if (!boardShape[ri] || boardShape[ri][cj] === 0) return false;
                if (board[ri] && board[ri][cj]) return false;
                // 验证三角形方向
                const pieceTriangleDirection = shape[i][j];
                const boardTriangleDirection = (ri + cj) % 2 === 0 ? 1 : -1;
                if (pieceTriangleDirection !== boardTriangleDirection) return false;
            }
        }
    }
    return true;
}

function placePieceOnBoard(piece, row, col) {
    const shape = piece.shape;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const ri = row + i;
                const cj = col + j;
                board[ri][cj] = piece.name;
                const polygon = document.querySelector(`polygon[data-row='${ri}'][data-col='${cj}']`);
                if (polygon) {
                    polygon.setAttribute('fill', piece.color);
                }
            }
        }
    }
}

function removePieceFromBoard(piece, row, col) {
    const shape = piece.shape;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const ri = row + i;
                const cj = col + j;
                board[ri][cj] = null;
                const polygon = document.querySelector(`polygon[data-row='${ri}'][data-col='${cj}']`);
                if (polygon) {
                    polygon.setAttribute('fill', '#f5f5f5');
                }
            }
        }
    }
}

function undoStep() {
    if (history.length > 0) {
        const lastMove = history.pop();
        removePieceFromBoard(lastMove.piece, lastMove.row, lastMove.col);
        restorePieceToPanel(lastMove.piece);
        updateButtonStates();
    } else {
        alert('No moves to undo.');
    }
}

function resetPuzzle() {
    // 清空拖拽层
    const piecesLayer = document.getElementById('pieces-layer');
    if (piecesLayer) {
        piecesLayer.innerHTML = '';
    }

    // 初始化board为和boardShape结构一致的二维数组
    board = [];
    for (let i = 0; i < boardShape.length; i++) {
        board[i] = [];
        for (let j = 0; j < boardShape[i].length; j++) {
            board[i][j] = null;
        }
    }
    pieceStates = {};
    selectedPieceName = null;
    history = [];
    isSolverRunning = false;
    isSolverPaused = false;
    isPuzzleSolved = false;
    const messageEl = document.getElementById('message');
    messageEl.textContent = 'Game Reset!';
    messageEl.className = '';
    setTimeout(() => { if(messageEl.textContent === 'Game Reset!') messageEl.textContent = ''; }, 2000);
    // 初始化网格
    renderGrid();
    // 初始化所有图块
    initPiecesNew();
    updateButtonStates();
}

function updateButtonStates() {
    if (!solveButton || !resetButton) {
        solveButton = document.querySelector('button[onclick="toggleSolver()"]');
        resetButton = document.querySelector('button[onclick="resetPuzzle()"]');
    }

    if (isPuzzleSolved) {
        solveButton.disabled = true;
        resetButton.disabled = false;
        return;
    }

    if (isSolverRunning) {
        solveButton.textContent = isSolverPaused ? 'Resume' : 'Pause';
        solveButton.disabled = false;
        resetButton.disabled = false;
    } else {
        solveButton.textContent = 'Solve Puzzle';
        solveButton.disabled = false;
        resetButton.disabled = false;
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
    const allPieceNames = Object.keys(piecesData);
    const userPlacedPieces = getPlacedPieces(); 

    if (checkPuzzleSolved()) {
        return; // Puzzle is already solved by the user
    }

    let solved = false;
    try {
        if (await solveRecursive(allPieceNames, 0, userPlacedPieces)) {
            solved = true;
            messageEl.textContent = 'Puzzle solved!';
            messageEl.className = '';
            isPuzzleSolved = true;
            allPieceNames.forEach(pieceName => {
                // 新系统中拼块已放置时会被隐藏，不需要额外处理
                if (pieceStates[pieceName]) {
                    pieceStates[pieceName].inCanvas = true;
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
        if (!board[i]) continue;
        for (let j = 0; j < (board[i] ? board[i].length : 0); j++) {
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
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield for UI updates/pause check
    }

    const pieceName = pieceNames[pieceIndex];
    const pieceData = piecesData[pieceName];
    const rotations = [0, 60, 120, 180, 240, 300];
    for (let r = 0; r < boardRows; r++) {
        for (let c = 0; c < boardCols; c++) {
            for (const rotation of rotations) {
                if (pieceData.duplicatedRotations && pieceData.duplicatedRotations.includes(rotation)) {
                    continue;
                }
                const piece = {
                    name: pieceName,
                    shape: pieceData.shapeByRotation[rotation],
                    color: pieceData.color
                };
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

function checkPuzzleSolved() {
    const messageEl = document.getElementById('message');
    const allPieceNames = Object.keys(piecesData);
    const placedPieces = getPlacedPieces();
    
    // Check if all pieces are placed
    if (placedPieces.length === allPieceNames.length) {
        // Verify all valid board positions are filled
        let isBoardFull = true;
        for (let r = 0; r < boardRows; r++) {
            for (let c = 0; c < boardCols; c++) {
                if (boardShape[r][c] !== 0 && !board[r][c]) {
                    isBoardFull = false;
                    break;
                }
            }
            if (!isBoardFull) break;
        }
        
        if (isBoardFull) {
            messageEl.textContent = 'Puzzle solved!';
            messageEl.className = '';
            isPuzzleSolved = true;
            
            // 标记所有拼块为已放置状态
            allPieceNames.forEach(pieceName => {
                if (pieceStates[pieceName]) {
                    pieceStates[pieceName].inCanvas = true;
                }
            });
            
            updateButtonStates();
            return true;
        }
    }
    return false;
}

function getMaxPieceSize(piece) {
    let maxWidth = 0, maxHeight = 0;
    Object.values(piece.shapeByRotation).forEach(shape => {
        const bounds = calculateShapeBounds(shape);
        maxWidth = Math.max(maxWidth, bounds.width);
        maxHeight = Math.max(maxHeight, bounds.height);
    });
    return { maxWidth, maxHeight };
}

// 计算布局边界和空间分配
function calculateLayoutBounds() {
    // 首先更新canvas尺寸
    const container = document.getElementById('canvas');
    if (container) {
        canvasWidth = container.offsetWidth;
        canvasHeight = container.offsetHeight;
    }
    


    // 1. 确定当前设备类型
    const isMobile = window.innerWidth <= BREAKPOINTS.MOBILE;
    const isTablet = window.innerWidth <= BREAKPOINTS.TABLET && window.innerWidth > BREAKPOINTS.MOBILE;
    
    // 2. 计算grid的原始尺寸（使用当前triangleSize）
    const { maxX, minX, maxY, minY } = getBoardOffset();
    const gridOriginalWidth = maxX - minX;
    const gridOriginalHeight = maxY - minY;

    // 3. 计算最佳的triangleSize，使整个布局充分利用空间
    let bestTriangleSize = triangleSize;
    let bestLayout = null;
    
    // 尝试不同的triangleSize，找到最佳的布局
    for (let testSize = 120; testSize >= 40; testSize -= 10) {
        const testLayout = calculateOptimalLayout(testSize, isMobile, isTablet);
        if (testLayout.isValid) {
            bestTriangleSize = testSize;
            bestLayout = testLayout;
            break;
        }
    }

    // 如果没有找到合适的布局，使用最小尺寸
    if (!bestLayout) {
        bestTriangleSize = 40;
        bestLayout = calculateOptimalLayout(bestTriangleSize, isMobile, isTablet);
    }

    // 更新全局triangleSize
    triangleSize = bestTriangleSize;



    return bestLayout;
}

// 计算给定triangleSize下的最佳布局
function calculateOptimalLayout(testTriangleSize, isMobile, isTablet) {
    // 计算grid在这个triangleSize下的尺寸
    const h = testTriangleSize * Math.sqrt(3) / 2;
    let gridWidth = 0, gridHeight = 0;
    
    for (let row = 0; row < boardRows; row++) {
        for (let col = 0; col < boardCols; col++) {
            if (boardShape[row][col] === 0) continue;
            const x = col * (testTriangleSize / 2);
            const y = row * h;
            gridWidth = Math.max(gridWidth, x + testTriangleSize);
            gridHeight = Math.max(gridHeight, y + h);
        }
    }

    // 计算pieces在这个triangleSize下的最大尺寸
    let maxPieceWidth = 0, maxPieceHeight = 0;
    Object.keys(piecesData).forEach(pieceName => {
        const shape = piecesData[pieceName].shapeByRotation[0];
        let pieceWidth = 0, pieceHeight = 0;
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j] !== 0) {
                    pieceWidth = Math.max(pieceWidth, j * (testTriangleSize / 2) + testTriangleSize);
                    pieceHeight = Math.max(pieceHeight, i * h + h);
                }
            }
        }
        maxPieceWidth = Math.max(maxPieceWidth, pieceWidth);
        maxPieceHeight = Math.max(maxPieceHeight, pieceHeight);
    });

    // 根据设备类型决定布局方式
    let layout;
    if (isMobile) {
        // 移动设备：垂直布局
        layout = calculateVerticalLayout(gridWidth, gridHeight, maxPieceWidth, maxPieceHeight, testTriangleSize);
    } else {
        // 桌面/平板：水平布局
        layout = calculateHorizontalLayout(gridWidth, gridHeight, maxPieceWidth, maxPieceHeight, testTriangleSize);
    }

    return layout;
}

// 计算水平布局（grid在左，pieces在右）
function calculateHorizontalLayout(gridWidth, gridHeight, maxPieceWidth, maxPieceHeight, testTriangleSize) {
    const totalPadding = GRID_PADDING * 3; // 左边距 + 中间间距 + 右边距
    const availableWidth = canvasWidth - totalPadding;
    const availableHeight = canvasHeight - 2 * GRID_PADDING;

    // 计算grid需要的宽度
    const gridNeededWidth = gridWidth;
    
    // 计算pieces区域的可用宽度
    const piecesAvailableWidth = availableWidth - gridNeededWidth;
    
    // 计算pieces的最佳列数
    const minPieceSpace = maxPieceWidth + PIECE_MARGIN;
    const maxCols = Math.floor(piecesAvailableWidth / minPieceSpace);
    const targetCols = Math.min(4, Math.max(2, maxCols));
    
    // 计算pieces的总高度需求
    const pieceCount = Object.keys(piecesData).length;
    const piecesPerCol = Math.ceil(pieceCount / targetCols);
    const totalPiecesHeight = piecesPerCol * (maxPieceHeight + PIECE_MARGIN);

    // 检查布局是否可行
    const isValid = (
        gridNeededWidth <= availableWidth * 0.6 && // grid不超过60%宽度
        gridHeight <= availableHeight && // grid高度适合
        piecesAvailableWidth > maxPieceWidth && // pieces有足够宽度
        totalPiecesHeight <= availableHeight // pieces高度适合
    );

    return {
        isValid,
        triangleSize: testTriangleSize,
        gridWidth: gridNeededWidth,
        gridHeight,
        gridStartX: GRID_PADDING,
        gridStartY: GRID_PADDING + (availableHeight - gridHeight) / 2, // 垂直居中
        piecesStartX: GRID_PADDING + gridNeededWidth + GRID_PADDING,
        piecesStartY: GRID_PADDING,
        piecesAvailableWidth,
        availableHeight,
        targetCols,
        isMobile: false,
        isTablet: false
    };
}

// 计算垂直布局（grid在上，pieces在下）
function calculateVerticalLayout(gridWidth, gridHeight, maxPieceWidth, maxPieceHeight, testTriangleSize) {
    const totalPadding = GRID_PADDING * 3; // 上边距 + 中间间距 + 下边距
    const availableWidth = canvasWidth - 2 * GRID_PADDING;
    const availableHeight = canvasHeight - totalPadding;

    // 计算grid需要的高度
    const gridNeededHeight = gridHeight;
    
    // 计算pieces区域的可用高度
    const piecesAvailableHeight = availableHeight - gridNeededHeight;
    
    // 移动设备固定2列
    const targetCols = 2;
    const piecesAvailableWidth = availableWidth;
    
    // 计算pieces的总高度需求
    const pieceCount = Object.keys(piecesData).length;
    const piecesPerCol = Math.ceil(pieceCount / targetCols);
    const totalPiecesHeight = piecesPerCol * (maxPieceHeight + PIECE_MARGIN);

    // 检查布局是否可行
    const isValid = (
        gridWidth <= availableWidth && // grid宽度适合
        gridNeededHeight <= availableHeight * 0.6 && // grid不超过60%高度
        totalPiecesHeight <= piecesAvailableHeight // pieces高度适合
    );

    return {
        isValid,
        triangleSize: testTriangleSize,
        gridWidth,
        gridHeight: gridNeededHeight,
        gridStartX: GRID_PADDING + (availableWidth - gridWidth) / 2, // 水平居中
        gridStartY: GRID_PADDING,
        piecesStartX: GRID_PADDING,
        piecesStartY: GRID_PADDING + gridNeededHeight + GRID_PADDING,
        piecesAvailableWidth,
        availableHeight: piecesAvailableHeight,
        targetCols,
        isMobile: true,
        isTablet: false
    };
}

function findBestLayout(pieces, sizes, layout) {

    // 按高度排序，高的在前面
    const sortedPieces = Object.keys(piecesData).map((name, idx) => ({
        name,
        size: sizes[idx],
        index: idx
    })).sort((a, b) => b.size.maxHeight - a.size.maxHeight);

    const targetCols = layout.targetCols;
    
    // 计算目标列宽
    const targetColWidth = Math.floor((layout.piecesAvailableWidth - (targetCols + 1) * PIECE_MARGIN) / targetCols);

    // 创建列
    const columns = Array(targetCols).fill(0).map(() => ({
        width: targetColWidth,
        height: 0,
        pieces: []
    }));

    // 使用"最短列优先"策略放置拼块
    sortedPieces.forEach(piece => {
        // 找出当前最短的列
        const shortestCol = columns.reduce((min, col, idx) => 
            col.height < columns[min].height ? idx : min, 0);
        
        // 将拼块添加到最短列（不需要额外缩放，因为triangleSize已经优化过了）
        columns[shortestCol].height += piece.size.maxHeight + PIECE_MARGIN;
        columns[shortestCol].pieces.push({...piece, scale: 1});
    });

    return {
        columns,
        totalWidth: layout.piecesAvailableWidth,
        maxHeight: Math.max(...columns.map(col => col.height)),
        colCount: targetCols,
        targetColWidth,
        scale: 1 // 统一使用1，因为triangleSize已经优化
    };
}

// 创建应急布局方案
function createFallbackLayout(sortedPieces, layout) {
    const cols = 2;
    const targetColWidth = Math.floor((layout.availableWidth - (cols + 1) * PIECE_MARGIN) / cols);
    
    const columns = Array(cols).fill(0).map(() => ({
        width: targetColWidth,
        height: 0,
        pieces: []
    }));

    // 平均分配拼块
    const piecesPerCol = Math.ceil(sortedPieces.length / cols);
    sortedPieces.forEach((piece, index) => {
        const colIndex = Math.floor(index / piecesPerCol);
        columns[colIndex].height += piece.size.maxHeight + PIECE_MARGIN;
        columns[colIndex].pieces.push(piece);
    });

    return {
        columns,
        totalWidth: layout.availableWidth,
        maxHeight: Math.max(...columns.map(col => col.height)),
        colCount: cols,
        targetColWidth
    };
}

// 修改initPiecesNew中的布局应用部分
function initPiecesNew() {
    // 1. 计算布局边界
    const layout = calculateLayoutBounds();
    
    // 2. 获取所有拼块尺寸
    const sizes = Object.keys(piecesData).map(name => {
        const size = getMaxPieceSize(piecesData[name]);
        return size;
    });
    
    // 3. 计算最佳布局
    let bestLayout = findBestLayout(piecesData, sizes, layout);
    
    // 4. 计算每个拼块的位置
    let pieceStatesNew = {};
    
    // 计算起始位置
    let x = layout.piecesStartX + PIECE_MARGIN;
    const startY = layout.piecesStartY;
    
    // 遍历每列放置拼块
    bestLayout.columns.forEach((column, colIndex) => {
        let y = startY;
        
        column.pieces.forEach(piece => {
            // 水平居中到列宽度
            const pieceX = x + (bestLayout.targetColWidth - piece.size.maxWidth) / 2;
            
            pieceStatesNew[piece.name] = {
                x: pieceX,
                y: y,
                rotation: 0,
                initialX: pieceX,
                initialY: y,
                inCanvas: false,
                scale: piece.scale
            };
            

            
            y += piece.size.maxHeight * piece.scale + PIECE_MARGIN;
        });
        
        x += bestLayout.targetColWidth + PIECE_MARGIN;
    });
    
    pieceStates = pieceStatesNew;
    renderAllPieces();
}

// 计算图块形状的边界
function calculateShapeBounds(shape) {
    const h = triangleSize * Math.sqrt(3) / 2;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const x = j * (triangleSize / 2);
                const y = i * h;
                
                // 计算三角形的边界点
                if (shape[i][j] > 0) { // 向上的三角形
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x + triangleSize);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y + h);
                } else { // 向下的三角形
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x + triangleSize);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y + h);
                }
            }
        }
    }
    
    return {
        width: maxX - minX,
        height: maxY - minY,
        minX: minX,
        minY: minY
    };
}

// 修改generatePieceSVG函数，添加偏移参数
function generatePieceSVG(shape, color) {
    let svg = '';
    const h = triangleSize * Math.sqrt(3) / 2;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const x = j * (triangleSize / 2);
                const y = i * h;
                const isUpward = shape[i][j] > 0;
                const points = calculatePieceTrianglePoints(x, y, isUpward);
                svg += `<polygon points="${points}" fill="${color}" stroke="#333" stroke-width="1" />`;
            }
        }
    }
    return svg;
}

// 这个函数已经不再使用，因为现在使用新的拖拽系统
// 旋转功能通过右键点击SVG或双击重置来实现

// 旧的handleDragStart和handleDragEnd函数已被删除

// 旧的拖拽系统已被删除，现在使用 startDragPiece/onDragPiece/stopDragPiece 系统

// 旧的resetPiecePosition函数已被删除

// 添加游戏板点击事件处理
function addBoardClickListeners() {
    const boardSvg = document.querySelector('#board svg');
    if (boardSvg) {
        boardSvg.addEventListener('click', handleBoardClick);
    }
}

// 处理单个polygon的点击事件
function handlePolygonClick(e) {
    e.stopPropagation(); // 阻止事件冒泡
    
    const polygon = e.target;
    const row = parseInt(polygon.dataset.row);
    const col = parseInt(polygon.dataset.col);
    
    // 检查这个位置是否有图块
    const pieceName = board[row][col];
    
    if (pieceName) {
        removePieceFromBoardAndRestore(pieceName);
    }
}

// 处理polygon的鼠标按下事件（用于拖拽已放置的拼块）
function handlePolygonMouseDown(e) {
    if (e.button !== 0) return; // 只处理左键
    
    const polygon = e.target;
    const row = parseInt(polygon.dataset.row);
    const col = parseInt(polygon.dataset.col);
    
    // 检查这个位置是否有图块
    const pieceName = board[row][col];
    
    if (pieceName) {
        // 记录初始鼠标位置，用于检测是否真的在拖拽
        const startX = e.clientX;
        const startY = e.clientY;
        let isDragging = false;
        let dragThreshold = 5; // 像素阈值，超过这个距离才认为是拖拽
        
        // 临时的鼠标移动监听器
        const tempMouseMove = (moveEvent) => {
            const dx = Math.abs(moveEvent.clientX - startX);
            const dy = Math.abs(moveEvent.clientY - startY);
            
            if (!isDragging && (dx > dragThreshold || dy > dragThreshold)) {
                // 开始拖拽：取下拼块并开始拖拽
                isDragging = true;
                
                // 移除临时监听器
                document.removeEventListener('mousemove', tempMouseMove);
                document.removeEventListener('mouseup', tempMouseUp);
                
                // 取下拼块并恢复到可拖拽状态
                removePieceFromBoardAndRestore(pieceName);
                
                // 等待一帧让DOM更新，然后开始拖拽
                requestAnimationFrame(() => {
                    // 找到恢复后的拼块SVG
                    const pieceElement = document.getElementById('piece-' + pieceName.replace(/[^a-zA-Z0-9]/g, ''));
                    if (pieceElement) {
                        // 计算鼠标相对于拼块的偏移
                        const rect = pieceElement.getBoundingClientRect();
                        const offsetX = moveEvent.clientX - rect.left;
                        const offsetY = moveEvent.clientY - rect.top;
                        
                        // 创建一个模拟的mousedown事件来启动拖拽
                        const syntheticEvent = new MouseEvent('mousedown', {
                            clientX: moveEvent.clientX,
                            clientY: moveEvent.clientY,
                            button: 0,
                            bubbles: true
                        });
                        
                        // 手动设置拖拽信息
                        selectedPieceName = pieceName;
                        const state = pieceStates[pieceName];
                        state.isDragging = true;
                        
                        dragInfo = {
                            mouseStartX: moveEvent.clientX,
                            mouseStartY: moveEvent.clientY,
                            pieceStartX: state.x,
                            pieceStartY: state.y,
                            pieceName,
                            offsetX,
                            offsetY
                        };
                        
                        // 开始拖拽监听
                        document.addEventListener('mousemove', onDragPiece);
                        document.addEventListener('mouseup', stopDragPiece);
                        
                        // 立即更新拼块位置
                        onDragPiece(moveEvent);
                    }
                });
            }
        };
        
        // 临时的鼠标释放监听器
        const tempMouseUp = (upEvent) => {
            document.removeEventListener('mousemove', tempMouseMove);
            document.removeEventListener('mouseup', tempMouseUp);
            
            if (!isDragging) {
                // 如果没有拖拽，就当作点击处理
                handlePolygonClick(upEvent);
            }
        };
        
        // 添加临时监听器
        document.addEventListener('mousemove', tempMouseMove);
        document.addEventListener('mouseup', tempMouseUp);
        
        // 阻止默认行为和事件冒泡
        e.preventDefault();
        e.stopPropagation();
    }
}

// 处理游戏板点击事件（实际点击由handlePolygonClick处理）
function handleBoardClick(e) {
    // 实际点击由handlePolygonClick处理
}

// 从游戏板移除图块并恢复到右侧面板
function removePieceFromBoardAndRestore(pieceName) {
    
    // 获取拼块的当前旋转状态
    const currentRotation = pieceStates[pieceName] ? pieceStates[pieceName].rotation : 0;
    const shape = piecesData[pieceName].shapeByRotation[currentRotation];
    
    // 找到拼块占据的所有位置
    let occupiedPositions = [];
    for (let r = 0; r < boardRows; r++) {
        for (let c = 0; c < boardCols; c++) {
            if (board[r][c] === pieceName) {
                occupiedPositions.push({ row: r, col: c });
            }
        }
    }
    
    if (occupiedPositions.length > 0) {
        // 找到shape的左上角位置（第一个非零元素）
        let shapeTopLeft = null;
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j] !== 0) {
                    shapeTopLeft = { i, j };
                    break;
                }
            }
            if (shapeTopLeft) break;
        }
        
        if (shapeTopLeft) {
            // 计算拼块在board上的起始位置
            // 找到占据位置中对应shape左上角的那个位置
            const firstOccupied = occupiedPositions[0];
            const pieceStartPosition = {
                row: firstOccupied.row - shapeTopLeft.i,
                col: firstOccupied.col - shapeTopLeft.j
            };
            
            const piece = { 
                name: pieceName, 
                shape: shape,
                color: piecesData[pieceName].color 
            };
            

            
            // 从游戏板移除图块
            removePieceFromBoard(piece, pieceStartPosition.row, pieceStartPosition.col);
            
            // 恢复图块状态 - 计算拼图块在当前位置应该显示的坐标
            if (pieceStates[pieceName]) {
                pieceStates[pieceName].inCanvas = false;
                
                // 计算拼图块在被取下时应该在的位置（基于其在board上的位置）
                const layout = calculateLayoutBounds();
                const h = triangleSize * Math.sqrt(3) / 2;
                
                // 计算锚点在网格中的位置
                const anchor = getShapeAnchor(shape);
                const anchorGridRow = pieceStartPosition.row + anchor.i;
                const anchorGridCol = pieceStartPosition.col + anchor.j;
                
                // 计算锚点在容器坐标系中的位置
                const anchorAbsoluteX = layout.gridStartX + anchorGridCol * (triangleSize / 2);
                const anchorAbsoluteY = layout.gridStartY + anchorGridRow * h;
                
                // 计算拼图块的渲染偏移
                const scaledTriangleSize = triangleSize * (pieceStates[pieceName].scale || 1);
                const scaledH = scaledTriangleSize * Math.sqrt(3) / 2;
                
                let allPoints = [];
                for (let i = 0; i < shape.length; i++) {
                    for (let j = 0; j < shape[i].length; j++) {
                        if (shape[i][j] !== 0) {
                            const x = j * (scaledTriangleSize / 2);
                            const y = i * scaledH;
                            const isUpward = shape[i][j] > 0;
                            const pts = calculatePieceTrianglePoints(x, y, isUpward, scaledTriangleSize).split(' ').map(p => p.split(',').map(Number));
                            allPoints.push(...pts);
                        }
                    }
                }
                
                const minX = Math.min(...allPoints.map(p => p[0]));
                const minY = Math.min(...allPoints.map(p => p[1]));
                const renderOffsetX = -minX;
                const renderOffsetY = -minY;
                
                // 计算锚点在拼图块SVG中的位置
                const anchorPixelX = anchor.j * (scaledTriangleSize / 2) + renderOffsetX;
                const anchorPixelY = anchor.i * scaledH + renderOffsetY;
                
                // 计算拼图块SVG应该放置的位置
                pieceStates[pieceName].x = anchorAbsoluteX - anchorPixelX;
                pieceStates[pieceName].y = anchorAbsoluteY - anchorPixelY;
                // 保持当前旋转状态，不重置
            }
            
            // 重新渲染拼块到右侧面板
            renderPieceOnCanvas(pieceName);
            
            // 从历史记录中移除相关项
            removeFromHistory(pieceName);
            
            // 重新渲染board以更新颜色
            renderBoardPieces();
            
            // 更新按钮状态
            updateButtonStates();
            
            // 重新检查解题状态
            isPuzzleSolved = false;
        }
    }
}

// 恢复图块到右侧面板
function restorePieceToPanel(piece) {
    // 显示图块元素
    piece.element.style.display = '';
    piece.element.style.position = 'static';
    piece.element.style.left = '';
    piece.style.top = '';
    piece.element.style.zIndex = '';
    piece.element.style.opacity = '1';
    piece.element.draggable = true;
    
    // 将图块重新添加到右侧面板
    const piecesContainer = document.getElementById('pieces');
    piecesContainer.appendChild(piece.element);
}

// 从历史记录中移除指定图块的记录
function removeFromHistory(pieceName) {
    history = history.filter(move => move.piece.name !== pieceName);
}

// 旋转形状矩阵（备用函数，虽然我们使用预定义的旋转）
function rotateShape(shape) {
    const rows = shape.length;
    const cols = shape[0].length;
    const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
    
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            rotated[j][rows - 1 - i] = shape[i][j];
        }
    }
    
    return rotated;
}

function renderGrid() {
    const gridContainer = document.getElementById('board-grid');
    if (!gridContainer) {
        setTimeout(renderGrid, 30);
        return;
    }

    const layout = calculateLayoutBounds();

    gridContainer.innerHTML = '';
    const h = triangleSize * Math.sqrt(3) / 2;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', canvasWidth);
    svg.setAttribute('height', canvasHeight);
    svg.style.position = 'absolute';
    svg.style.left = '0';
    svg.style.top = '0';

    // 移除transform，直接计算绝对坐标
    // const g = document.createElementNS(svgNS, 'g');
    // g.setAttribute('transform', `translate(${layout.gridStartX},${layout.gridStartY})`);

    // 绘制三角形网格 - 直接使用绝对坐标
    for (let row = 0; row < boardRows; row++) {
        for (let col = 0; col < boardCols; col++) {
            if (boardShape[row][col] === 0) continue;
            // 计算绝对坐标（包含布局偏移）
            const x = layout.gridStartX + col * (triangleSize / 2);
            const y = layout.gridStartY + row * h;
            const isUpward = (row + col) % 2 === 0;
            const points = calculatePieceTrianglePoints(x, y, isUpward);
            const polygon = document.createElementNS(svgNS, 'polygon');
            polygon.setAttribute('points', points);
            polygon.setAttribute('fill', '#f5f5f5');
            polygon.setAttribute('stroke', '#a2b18e');
            polygon.setAttribute('stroke-width', 1);
            polygon.setAttribute('data-row', row);
            polygon.setAttribute('data-col', col);
            
            // 直接在每个polygon上添加点击和拖拽事件监听器
            polygon.addEventListener('click', handlePolygonClick);
            polygon.addEventListener('mousedown', handlePolygonMouseDown);
            polygon.style.cursor = 'pointer';
            
            svg.appendChild(polygon);
        }
    }

    gridContainer.appendChild(svg);
    
    // 添加点击事件监听器
    svg.addEventListener('click', handleBoardClick);
}

function renderAllPieces() {
    Object.keys(pieceStates).forEach(pieceName => {
        renderPieceOnCanvas(pieceName);
    });
}

function renderPieceOnCanvas(pieceName) {
    if (!pieceStates[pieceName]) {
        pieceStates[pieceName] = {
            x: 600,
            y: 100 + Object.keys(pieceStates).length * 80,
            rotation: 0,
            initialX: 600,
            initialY: 100 + Object.keys(pieceStates).length * 80,
            inCanvas: false,
            scale: 1
        };
    }
    const state = pieceStates[pieceName];
    const piecesLayer = document.getElementById('pieces-layer');
    if (!piecesLayer) {
        setTimeout(() => renderPieceOnCanvas(pieceName), 30);
        return;
    }

    // 渲染前移除同名元素
    const oldLabel = document.getElementById('label-' + pieceName.replace(/[^a-zA-Z0-9]/g, ''));
    if (oldLabel) oldLabel.remove();
    let old = document.getElementById('piece-' + pieceName.replace(/[^a-zA-Z0-9]/g, ''));
    if (old) old.remove();

    // 获取形状并应用缩放
    const shape = piecesData[pieceName].shapeByRotation[state.rotation || 0];
    const scaledTriangleSize = triangleSize * state.scale;
    const h = scaledTriangleSize * Math.sqrt(3) / 2;

    // 计算所有顶点
    let allPoints = [];
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const x = j * (scaledTriangleSize / 2);
                const y = i * h;
                const isUpward = shape[i][j] > 0;
                const pts = calculatePieceTrianglePoints(x, y, isUpward, scaledTriangleSize).split(' ').map(p => p.split(',').map(Number));
                allPoints.push(...pts);
            }
        }
    }

    // 计算边界和SVG尺寸
    let minX = Math.min(...allPoints.map(p => p[0]));
    let minY = Math.min(...allPoints.map(p => p[1]));
    let maxX = Math.max(...allPoints.map(p => p[0]));
    let maxY = Math.max(...allPoints.map(p => p[1]));
    
    const svgWidth = maxX - minX;
    const svgHeight = maxY - minY;
    const offsetX = -minX;
    const offsetY = -minY;

    // 创建SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('id', 'piece-' + pieceName.replace(/[^a-zA-Z0-9]/g, ''));
    svg.style.position = 'absolute';
    svg.style.left = state.x + 'px';
    svg.style.top = state.y + 'px';
    svg.style.cursor = 'move';
    svg.style.zIndex = selectedPieceName === pieceName ? 10 : 1;
    svg.style.display = state.inCanvas ? 'none' : 'block'; // 根据状态设置显示

    // 创建拼块形状
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const x = j * (scaledTriangleSize / 2) + offsetX;
                const y = i * h + offsetY;
                const isUpward = shape[i][j] > 0;
                const points = calculatePieceTrianglePoints(x, y, isUpward, scaledTriangleSize);
                const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                poly.setAttribute('points', points);
                poly.setAttribute('fill', piecesData[pieceName].color);
                poly.setAttribute('stroke', '#333');
                poly.setAttribute('stroke-width', 1 / state.scale); // 保持线条粗细一致
                g.appendChild(poly);
            }
        }
    }
    svg.appendChild(g);

    // 添加标签
    if (!state.isDragging && !state.inCanvas) {
        const label = document.createElement('div');
        label.textContent = pieceName;
        label.id = 'label-' + pieceName.replace(/[^a-zA-Z0-9]/g, '');
        label.style.position = 'absolute';
        label.style.left = state.x + 'px';
        label.style.top = (state.y + svgHeight + 4) + 'px';
        label.style.fontSize = '15px';
        label.style.color = '#666';
        label.style.textAlign = 'center';
        label.style.width = svgWidth + 'px';
        label.style.pointerEvents = 'none';
        label.style.display = state.inCanvas ? 'none' : 'block'; // 根据状态设置显示
        label.className = 'piece-label';
        piecesLayer.appendChild(label);
    }

    // 添加事件监听
    svg.addEventListener('mousedown', e => startDragPiece(e, pieceName));
    svg.addEventListener('contextmenu', e => { e.preventDefault(); rotatePieceOnCanvas(pieceName); });
    svg.addEventListener('dblclick', e => { e.preventDefault(); resetPieceToInitial(pieceName); });

    piecesLayer.appendChild(svg);
}

// 统一的坐标转换函数
// 将网格坐标转换为相对于 pieces-layer 容器的坐标
function gridToContainerCoords(gridRow, gridCol) {
    const layout = calculateLayoutBounds();
    const h = triangleSize * Math.sqrt(3) / 2;
    
    // 由于 board-grid 和 pieces-layer 都在同一个 #canvas 容器内，
    // 且都是 position: absolute; top: 0; left: 0;
    // 所以网格坐标可以直接使用 layout 中的偏移
    const result = {
        x: layout.gridStartX + gridCol * (triangleSize / 2),
        y: layout.gridStartY + gridRow * h
    };
    

    
    return result;
}

// 将鼠标的绝对坐标转换为网格坐标
function mouseToGrid(mouseClientX, mouseClientY) {
    const layout = calculateLayoutBounds();
    const h = triangleSize * Math.sqrt(3) / 2;
    const boardSvg = document.querySelector('#board svg');
    const svgRect = boardSvg ? boardSvg.getBoundingClientRect() : { left: 0, top: 0 };
    
    // 计算相对于网格起始点的坐标
    const relativeX = mouseClientX - svgRect.left - layout.gridStartX;
    const relativeY = mouseClientY - svgRect.top - layout.gridStartY;
    
    return {
        row: Math.round(relativeY / h),
        col: Math.round(relativeX / (triangleSize / 2))
    };
}

// 保持向后兼容的 gridToScreen 函数（返回绝对坐标）
function gridToScreen(gridRow, gridCol) {
    const layout = calculateLayoutBounds();
    const h = triangleSize * Math.sqrt(3) / 2;
    const boardSvg = document.querySelector('#board svg');
    const svgRect = boardSvg ? boardSvg.getBoundingClientRect() : { left: 0, top: 0 };
    
    return {
        x: svgRect.left + layout.gridStartX + gridCol * (triangleSize / 2),
        y: svgRect.top + layout.gridStartY + gridRow * h
    };
}

function startDragPiece(e, pieceName) {
    e.preventDefault();
    selectedPieceName = pieceName;
    
    const svg = document.getElementById('piece-' + pieceName.replace(/[^a-zA-Z0-9]/g, ''));
    if (!svg) return;
    
    const state = pieceStates[pieceName] || {};
    const shape = piecesData[pieceName].shapeByRotation[state.rotation || 0];
    const anchor = getShapeAnchor(shape);
    
    // 获取容器的偏移量（pieces-layer相对于页面的位置）
    const piecesLayer = document.getElementById('pieces-layer');
    const containerRect = piecesLayer ? piecesLayer.getBoundingClientRect() : { left: 0, top: 0 };
    
    // 计算鼠标相对于拼图块左上角的像素偏移
    // 使用 state.x/y（相对于容器）+ 容器偏移 来计算拼图块的绝对位置
    const pieceAbsoluteX = containerRect.left + state.x;
    const pieceAbsoluteY = containerRect.top + state.y;
    const offsetX = e.clientX - pieceAbsoluteX;
    const offsetY = e.clientY - pieceAbsoluteY;
    

    
    // 不再需要复杂的网格偏移计算，只需要记录鼠标相对于拼图块的像素偏移
    
    state.isDragging = true;
    pieceStates[pieceName] = state;
    
    dragInfo = {
        pieceName,
        offsetX,
        offsetY
    };
    
    // 立即调用一次 onDragPiece 来检查初始位置
    onDragPiece(e);
    
    document.addEventListener('mousemove', onDragPiece);
    document.addEventListener('mouseup', stopDragPiece);
}

function onDragPiece(e) {
    if (!dragInfo) return;
    
    const state = pieceStates[dragInfo.pieceName];
    const shape = piecesData[dragInfo.pieceName].shapeByRotation[state.rotation || 0];
    
    // 首先更新拼图块位置（保持鼠标与拼图块的相对位置不变）
    const piecesLayer = document.getElementById('pieces-layer');
    const containerRect = piecesLayer ? piecesLayer.getBoundingClientRect() : { left: 0, top: 0 };
    
    const newPieceX = e.clientX - containerRect.left - dragInfo.offsetX;
    const newPieceY = e.clientY - containerRect.top - dragInfo.offsetY;
    
    // 计算拼图块锚点的当前位置（在容器坐标系中）
    const anchor = getShapeAnchor(shape);
    const scaledTriangleSize = triangleSize * (state.scale || 1);
    const scaledH = scaledTriangleSize * Math.sqrt(3) / 2;
    
    // 计算拼图块的渲染偏移
    let allPoints = [];
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const x = j * (scaledTriangleSize / 2);
                const y = i * scaledH;
                const isUpward = shape[i][j] > 0;
                const pts = calculatePieceTrianglePoints(x, y, isUpward, scaledTriangleSize).split(' ').map(p => p.split(',').map(Number));
                allPoints.push(...pts);
            }
        }
    }
    
    const minX = Math.min(...allPoints.map(p => p[0]));
    const minY = Math.min(...allPoints.map(p => p[1]));
    const renderOffsetX = -minX;
    const renderOffsetY = -minY;
    
    // 计算锚点在容器坐标系中的位置
    const anchorPixelX = anchor.j * (scaledTriangleSize / 2) + renderOffsetX;
    const anchorPixelY = anchor.i * scaledH + renderOffsetY;
    const anchorAbsoluteX = newPieceX + anchorPixelX;
    const anchorAbsoluteY = newPieceY + anchorPixelY;
    
    // 将锚点位置转换为网格坐标
    const layout = calculateLayoutBounds();
    const h = triangleSize * Math.sqrt(3) / 2;
    const anchorGridCol = Math.round((anchorAbsoluteX - layout.gridStartX) / (triangleSize / 2));
    const anchorGridRow = Math.round((anchorAbsoluteY - layout.gridStartY) / h);
    
    // 计算拼图块左上角的网格位置
    const pieceGridRow = anchorGridRow - anchor.i;
    const pieceGridCol = anchorGridCol - anchor.j;
    

    
    // 检查是否可以放置
    let canPlace = true;
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j] !== 0) {
                const targetRow = pieceGridRow + i;
                const targetCol = pieceGridCol + j;
                if (
                    targetRow < 0 || targetRow >= boardRows ||
                    targetCol < 0 || targetCol >= boardCols ||
                    !boardShape[targetRow] || boardShape[targetRow][targetCol] === 0 ||
                    (board[targetRow] && board[targetRow][targetCol])
                ) {
                    canPlace = false;
                    break;
                }
                // 检查三角形方向
                const pieceTriangleDirection = shape[i][j];
                const boardTriangleDirection = (targetRow + targetCol) % 2 === 0 ? 1 : -1;
                if (pieceTriangleDirection !== boardTriangleDirection) {
                    canPlace = false;
                    break;
                }
            }
        }
        if (!canPlace) break;
    }
    
    // 更新拼图块位置
    if (canPlace) {
        // 吸附到网格 - 计算精确的吸附位置
        const snapAnchorX = layout.gridStartX + anchorGridCol * (triangleSize / 2);
        const snapAnchorY = layout.gridStartY + anchorGridRow * h;
        const snapPieceX = snapAnchorX - anchorPixelX;
        const snapPieceY = snapAnchorY - anchorPixelY;
        
        const oldX = state.x;
        const oldY = state.y;
        state.x = snapPieceX;
        state.y = snapPieceY;
        state._snapRow = pieceGridRow;
        state._snapCol = pieceGridCol;
        state._canSnap = true;
    } else {
        // 自由移动 - 直接使用计算好的位置
        const oldX = state.x;
        const oldY = state.y;
        state.x = newPieceX;
        state.y = newPieceY;
        state._canSnap = false;
    }
    
    renderPieceOnCanvas(dragInfo.pieceName);
}

function stopDragPiece(e) {
    if (!dragInfo) return;
    
    const state = pieceStates[dragInfo.pieceName];
    
    if (state._canSnap && typeof state._snapRow === 'number' && typeof state._snapCol === 'number') {
        // 可以放置
        const shape = piecesData[dragInfo.pieceName].shapeByRotation[state.rotation || 0];
        const piece = {
            name: dragInfo.pieceName,
            ...piecesData[dragInfo.pieceName],
            shape
        };
        
        // 直接使用计算好的网格位置放置
        placePieceOnBoard(piece, state._snapRow, state._snapCol);
        state.inCanvas = true;
        
        // 更新UI
        renderGrid();
        renderBoardPieces();
        
        // 隐藏拼图块
        const svg = document.getElementById('piece-' + dragInfo.pieceName.replace(/[^a-zA-Z0-9]/g, ''));
        if (svg) svg.style.display = 'none';
        const label = document.getElementById('label-' + dragInfo.pieceName.replace(/[^a-zA-Z0-9]/g, ''));
        if (label) label.style.display = 'none';
        
        // 记录历史
        history.push({ piece, row: state._snapRow, col: state._snapCol });
        
        checkPuzzleSolved();
        if (typeof updateButtonStates === 'function') updateButtonStates();
    } else {
        // 不能放置，重置到右侧初始位置
        state.x = state.initialX;
        state.y = state.initialY;
        // 保持当前旋转状态，不重置旋转
        state.inCanvas = false;
    }
    
    // 清理状态
    state.isDragging = false;
    state._canSnap = false;
    state._snapRow = null;
    state._snapCol = null;
    dragInfo = null;
    
    document.removeEventListener('mousemove', onDragPiece);
    document.removeEventListener('mouseup', stopDragPiece);
    
    renderAllPieces();
}

function rotatePieceOnCanvas(pieceName) {
    pieceStates[pieceName].rotation = (pieceStates[pieceName].rotation + 60) % 360;
    renderPieceOnCanvas(pieceName);
}

function resetPieceToInitial(pieceName) {
    const state = pieceStates[pieceName];
    state.x = state.initialX;
    state.y = state.initialY;
    state.rotation = 0;
    renderPieceOnCanvas(pieceName);
}

// 旋转按钮支持
function rotatePiece() {
    if (selectedPieceName) rotatePieceOnCanvas(selectedPieceName);
}

// 撤销支持
function undoStep() {
    // 可选：实现撤销拖动/旋转操作
}

function safeInit() {
    // 如果关键DOM还没渲染，延迟重试
    if (!document.getElementById('board-grid') || !document.getElementById('pieces-layer')) {
        setTimeout(safeInit, 30);
        return;
    }
    
    // 直接重置拼图，不再调用updateTriangleSize
    resetPuzzle();
    updateButtonStates();

    // 只注册一次resize事件
    if (!window._resizeRegistered) {
        window.addEventListener('resize', () => {
            resetPuzzle(); // 直接重置，让calculateLayoutBounds处理尺寸
        });
        window._resizeRegistered = true;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', safeInit);
} else {
    safeInit();
}

// 新增：渲染已放置拼块到board网格
function renderBoardPieces() {
    const gridContainer = document.getElementById('board-grid');
    const svg = gridContainer.querySelector('svg');
    if (!svg) return;
    
    for (let row = 0; row < boardRows; row++) {
        for (let col = 0; col < boardCols; col++) {
            if (boardShape[row][col] === 0) continue; // 跳过无效位置
            
            const polygon = svg.querySelector(`polygon[data-row='${row}'][data-col='${col}']`);
            if (polygon) {
                if (board[row] && board[row][col]) {
                    // 有拼块：设置拼块颜色
                    const pieceName = board[row][col];
                    const color = piecesData[pieceName] ? piecesData[pieceName].color : '#ccc';
                    polygon.setAttribute('fill', color);
                } else {
                    // 没有拼块：重置为默认颜色
                    polygon.setAttribute('fill', '#f5f5f5');
                }
            }
        }
    }
}

// 计算grid的实际边界
function getBoardOffset() {
    const h = triangleSize * Math.sqrt(3) / 2;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // 计算grid的实际边界
    for (let row = 0; row < boardRows; row++) {
        for (let col = 0; col < boardCols; col++) {
            if (boardShape[row][col] === 0) continue;
            const x = col * (triangleSize / 2);
            const y = row * h;
            // 考虑三角形的三个顶点
            if ((row + col) % 2 === 0) { // 向上的三角形
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x + triangleSize);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y + h);
            } else { // 向下的三角形
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x + triangleSize);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y + h);
            }
        }
    }

    return { minX, minY, maxX, maxY };
} 
if (typeof module !== 'undefined') {
  module.exports = { calculatePieceTrianglePoints, getShapeAnchor, canPlacePiece };
}
