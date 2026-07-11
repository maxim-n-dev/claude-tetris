'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Nut - steel gray
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca) - agujero central
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEME_KEY = 'tetris-theme';
const THEME_COLORS = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#c9ccd9', highlight: 'rgba(0,0,0,0.12)' },
};
let theme = 'dark';

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.checked = theme === 'light';
  localStorage.setItem(THEME_KEY, theme);
}

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'light' : 'dark');
  if (typeof current !== 'undefined' && current) {
    draw();
    drawNext();
  }
});

applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

const HIGHSCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';

let highScores = JSON.parse(localStorage.getItem(HIGHSCORES_KEY) || '[]');
let bestCombo = parseInt(localStorage.getItem(BEST_COMBO_KEY) || '0', 10) || 0;
let maxLines = parseInt(localStorage.getItem(MAX_LINES_KEY) || '0', 10) || 0;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const highscoreList = document.getElementById('highscore-list');
const bestComboDisplay = document.getElementById('best-combo-display');
const maxLinesDisplay = document.getElementById('max-lines-display');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const submitNameBtn = document.getElementById('submit-name-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gameStarted = false;

function saveHighScores() {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(highScores));
}

function qualifiesForHighScore(s) {
  return highScores.length < 5 || s > highScores[highScores.length - 1].score;
}

function insertHighScore(entry) {
  highScores.push(entry);
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 5);
  saveHighScores();
}

function renderHighScores(highlightEntry) {
  highscoreList.innerHTML = '';
  if (highScores.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin puntuaciones aún';
    highscoreList.appendChild(li);
  } else {
    highScores.forEach(entry => {
      const li = document.createElement('li');
      li.textContent = `${entry.name} — ${entry.score.toLocaleString()}`;
      if (highlightEntry && entry === highlightEntry) li.classList.add('highscore-new');
      highscoreList.appendChild(li);
    });
  }
  bestComboDisplay.textContent = `Mejor combo: ${bestCombo} líneas`;
  maxLinesDisplay.textContent = `Máx. líneas: ${maxLines}`;
}

function resetRecords() {
  highScores = [];
  bestCombo = 0;
  maxLines = 0;
  localStorage.removeItem(HIGHSCORES_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
  renderHighScores();
}

resetRecordsBtn.addEventListener('click', resetRecords);

nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitNameBtn.click();
});

submitNameBtn.addEventListener('click', () => {
  const name = nameInput.value.trim().slice(0, 12) || 'AAA';
  const entry = { name, score };
  insertHighScore(entry);
  nameEntry.classList.add('hidden');
  renderHighScores(entry);
});

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const NUT_CHANCE = 0.12; // ~1 de cada ~8 piezas es la tuerca
  const type = Math.random() < NUT_CHANCE ? 8 : Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (cleared > bestCombo) {
      bestCombo = cleared;
      localStorage.setItem(BEST_COMBO_KEY, String(bestCombo));
    }
    if (lines > maxLines) {
      maxLines = lines;
      localStorage.setItem(MAX_LINES_KEY, String(maxLines));
    }
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = THEME_COLORS[theme].highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = THEME_COLORS[theme].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.textContent = 'Reiniciar';
  renderHighScores();
  if (qualifiesForHighScore(score)) {
    nameEntry.classList.remove('hidden');
    nameInput.value = '';
    overlay.classList.remove('hidden');
    nameInput.focus();
  } else {
    nameEntry.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    nameEntry.classList.add('hidden');
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  gameStarted = true;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  nameEntry.classList.add('hidden');
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Comenzar';
  nameEntry.classList.add('hidden');
  renderHighScores();
  overlay.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (!gameStarted) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

showStartScreen();
