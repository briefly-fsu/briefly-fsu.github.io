const titleScreen = document.getElementById('title-screen');
const gameScreen = document.getElementById('game-screen');
const boardCanvas = document.getElementById('game-board');
const nextCanvas = document.getElementById('next-board');
const boardContext = boardCanvas.getContext('2d');
const nextContext = nextCanvas.getContext('2d');
const columns = 10;
const rows = 20;
const cellSize = 30;
const colors = {
  I: '#62d8d0',
  O: '#f5d15d',
  T: '#b795e8',
  S: '#9bd66b',
  Z: '#fa785e',
  J: '#6ea7ed',
  L: '#efa34e'
};
const shapes = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

let grid;
let activePiece;
let nextPiece;
let score;
let clearedLines;
let level;
let dropInterval;
let dropElapsed = 0;
let previousFrame = 0;
let isPaused = false;
let isGameOver = false;
let animationFrame;

function createGrid() {
  return Array.from({ length: rows }, () => Array(columns).fill(null));
}

function randomPiece() {
  const type = Object.keys(shapes)[Math.floor(Math.random() * 7)];
  const matrix = shapes[type].map((row) => [...row]);
  return { type, matrix, x: Math.floor((columns - matrix[0].length) / 2), y: 0 };
}

function startGame() {
  titleScreen.classList.add('is-hidden');
  gameScreen.classList.remove('is-hidden');
  resetGame();
  boardCanvas.focus();
}

function resetGame() {
  grid = createGrid();
  activePiece = randomPiece();
  nextPiece = randomPiece();
  score = 0;
  clearedLines = 0;
  level = 1;
  dropInterval = 850;
  dropElapsed = 0;
  previousFrame = 0;
  isPaused = false;
  isGameOver = false;
  document.getElementById('game-overlay').classList.add('is-hidden');
  document.getElementById('game-status').textContent = 'LIVE';
  updateStats();
  draw();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(update);
}

function updateStats() {
  document.getElementById('score-value').textContent = String(score).padStart(6, '0');
  document.getElementById('lines-value').textContent = String(clearedLines).padStart(2, '0');
  document.getElementById('level-value').textContent = String(level).padStart(2, '0');
}

function collides(piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  return matrix.some((row, rowIndex) => row.some((value, columnIndex) => {
    if (!value) return false;
    const x = piece.x + columnIndex + offsetX;
    const y = piece.y + rowIndex + offsetY;
    return x < 0 || x >= columns || y >= rows || (y >= 0 && grid[y][x]);
  }));
}

function movePiece(offsetX, offsetY) {
  if (!collides(activePiece, offsetX, offsetY)) {
    activePiece.x += offsetX;
    activePiece.y += offsetY;
    return true;
  }
  return false;
}

function rotatePiece() {
  const matrix = activePiece.matrix[0].map((_, index) => activePiece.matrix.map((row) => row[index]).reverse());
  for (const offset of [0, -1, 1, -2, 2]) {
    if (!collides(activePiece, offset, 0, matrix)) {
      activePiece.x += offset;
      activePiece.matrix = matrix;
      draw();
      return;
    }
  }
}

function lockPiece() {
  activePiece.matrix.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value && activePiece.y + rowIndex >= 0) {
      grid[activePiece.y + rowIndex][activePiece.x + columnIndex] = activePiece.type;
    }
  }));
  clearFullRows();
  activePiece = nextPiece;
  nextPiece = randomPiece();
  drawNext();
  if (collides(activePiece)) endGame();
}

function clearFullRows() {
  let removed = 0;
  grid = grid.filter((row) => {
    if (row.every(Boolean)) {
      removed += 1;
      return false;
    }
    return true;
  });
  while (grid.length < rows) grid.unshift(Array(columns).fill(null));
  if (removed) {
    const points = [0, 100, 300, 500, 800][removed] || removed * 200;
    score += points * level;
    clearedLines += removed;
    level = Math.floor(clearedLines / 10) + 1;
    dropInterval = Math.max(100, 850 - (level - 1) * 65);
    updateStats();
  }
}

function hardDrop() {
  let distance = 0;
  while (movePiece(0, 1)) distance += 1;
  score += distance * 2;
  updateStats();
  lockPiece();
  draw();
}

function togglePause() {
  if (isGameOver) return;
  isPaused = !isPaused;
  document.getElementById('game-status').textContent = isPaused ? 'PAUSED' : 'LIVE';
  document.getElementById('pause-btn').setAttribute('aria-label', isPaused ? 'Resume game' : 'Pause game');
  document.getElementById('overlay-title').textContent = 'PAUSED';
  document.getElementById('overlay-copy').textContent = 'Press P or resume to continue';
  document.getElementById('overlay-action').textContent = 'Resume';
  document.getElementById('game-overlay').classList.toggle('is-hidden', !isPaused);
  draw();
}

function endGame() {
  isGameOver = true;
  document.getElementById('game-status').textContent = 'COMPLETE';
  document.getElementById('overlay-title').textContent = 'RUN OVER';
  document.getElementById('overlay-copy').textContent = `Final score: ${String(score).padStart(6, '0')}`;
  document.getElementById('overlay-action').textContent = 'Run it back';
  document.getElementById('game-overlay').classList.remove('is-hidden');
}

function drawCell(context, x, y, size, color) {
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255, 255, 255, 0.15)';
  context.fillRect(x * size + 2, y * size + 2, size - 4, 2);
  context.fillStyle = 'rgba(0, 0, 0, 0.12)';
  context.fillRect(x * size + 2, y * size + size - 4, size - 4, 2);
}

function drawMatrix(context, matrix, type, offsetX, offsetY, size) {
  matrix.forEach((row, rowIndex) => row.forEach((value, columnIndex) => {
    if (value) drawCell(context, offsetX + columnIndex, offsetY + rowIndex, size, colors[type]);
  }));
}

function draw() {
  boardContext.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardContext.strokeStyle = 'rgba(190, 212, 191, 0.075)';
  boardContext.lineWidth = 1;
  for (let x = 0; x <= columns; x += 1) {
    boardContext.beginPath();
    boardContext.moveTo(x * cellSize + 0.5, 0);
    boardContext.lineTo(x * cellSize + 0.5, boardCanvas.height);
    boardContext.stroke();
  }
  for (let y = 0; y <= rows; y += 1) {
    boardContext.beginPath();
    boardContext.moveTo(0, y * cellSize + 0.5);
    boardContext.lineTo(boardCanvas.width, y * cellSize + 0.5);
    boardContext.stroke();
  }
  grid.forEach((row, y) => row.forEach((type, x) => {
    if (type) drawCell(boardContext, x, y, cellSize, colors[type]);
  }));

  if (activePiece && !isGameOver) {
    const ghost = { ...activePiece, y: activePiece.y };
    while (!collides(ghost, 0, 1)) ghost.y += 1;
    boardContext.globalAlpha = .22;
    drawMatrix(boardContext, ghost.matrix, ghost.type, ghost.x, ghost.y, cellSize);
    boardContext.globalAlpha = 1;
    drawMatrix(boardContext, activePiece.matrix, activePiece.type, activePiece.x, activePiece.y, cellSize);
  }
  drawNext();
}

function drawNext() {
  if (!nextPiece) return;
  nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const size = 22;
  const offsetX = (nextCanvas.width / size - nextPiece.matrix[0].length) / 2;
  const offsetY = (nextCanvas.height / size - nextPiece.matrix.length) / 2;
  drawMatrix(nextContext, nextPiece.matrix, nextPiece.type, offsetX, offsetY, size);
}

function update(timestamp = 0) {
  const delta = timestamp - previousFrame;
  previousFrame = timestamp;
  if (!isPaused && !isGameOver) {
    dropElapsed += delta;
    if (dropElapsed >= dropInterval) {
      if (!movePiece(0, 1)) lockPiece();
      dropElapsed = 0;
    }
    draw();
  }
  animationFrame = requestAnimationFrame(update);
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', resetGame);
document.getElementById('pause-btn').addEventListener('click', togglePause);
document.getElementById('overlay-action').addEventListener('click', () => {
  if (isGameOver) resetGame();
  else togglePause();
});
document.getElementById('home-btn').addEventListener('click', () => {
  cancelAnimationFrame(animationFrame);
  gameScreen.classList.add('is-hidden');
  titleScreen.classList.remove('is-hidden');
});

document.addEventListener('keydown', (event) => {
  if (gameScreen.classList.contains('is-hidden')) return;
  const actions = {
    ArrowLeft: () => movePiece(-1, 0),
    ArrowRight: () => movePiece(1, 0),
    ArrowDown: () => {
      if (movePiece(0, 1)) {
        score += 1;
        updateStats();
      } else lockPiece();
      dropElapsed = 0;
    },
    ArrowUp: rotatePiece,
    ' ': hardDrop,
    p: togglePause,
    P: togglePause
  };
  const action = actions[event.key];
  if (action) {
    event.preventDefault();
    if (event.key === 'p' || event.key === 'P') action();
    else if (!isPaused && !isGameOver) action();
    draw();
  }
});