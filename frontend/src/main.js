// ── Variables globales ────────────────────────────────────────────────────
let board, mySnake, snakeAI, sounds;
let food         = { x: 5, y: 5 };
let applesEaten  = 0;
let gameRunning  = false;

// Configuración de sesión (se leen al iniciar)
let winAppleTarget = 92;
let winGoal        = 0;
let totalWins      = 0;

let GAME_SPEED = 150; // ms por paso lógico (puede cambiar por eventos del chat)

// ── Estado de efectos de regalos / chat ──────────────────────────────────
let bonusFood      = false;   // próxima manzana → dorada
let flashOverlay   = null;    // { r,g,b, maxAlpha, startTime, duration }
let rainbowEndTime = 0;       // timestamp hasta el que corre el modo arcoíris
let freezeUntil    = 0;       // timestamp hasta el que el juego está congelado

const GRID_CONFIGS = {
    10: { cellSize: 40 },
    16: { cellSize: 25 },
    20: { cellSize: 20 },
};

// Manzanas por defecto según grilla (total − 8 = ~5 celdas libres al final)
const DEFAULT_WIN_APPLES = { 10: 92, 16: 248, 20: 392 };

let selectedGridSize = 10;

// ── RAF loop ─────────────────────────────────────────────────────────────
// El render corre a 60 fps (requestAnimationFrame) mientras la lógica del
// juego se ejecuta cada GAME_SPEED ms. La interpolación (t 0→1) hace que
// la serpiente se deslice suavemente entre celdas sin "saltitos".
let rafId        = null;
let lastStepTime = null;  // timestamp del último paso lógico

function startGameLoop() {
    stopGameLoop();
    lastStepTime = null;
    gameRunning  = true;
    rafId = requestAnimationFrame(animLoop);
}

function stopGameLoop() {
    gameRunning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

function animLoop(ts) {
    if (!gameRunning) return;

    if (lastStepTime === null) lastStepTime = ts;

    // ¿Pasó suficiente tiempo para un nuevo paso lógico?
    if (ts - lastStepTime >= GAME_SPEED) {
        if (ts < freezeUntil) {
            // ── CONGELADO: reseteamos el timer para que no acumule pasos ──
            lastStepTime = ts;
        } else {
            lastStepTime += GAME_SPEED;
            // Si la pestaña estuvo oculta, evitar una avalancha de pasos
            if (ts - lastStepTime > GAME_SPEED * 3) lastStepTime = ts;

            runGameStep();
            if (!gameRunning) return; // el paso pudo haber disparado win / death
        }
    }

    // t ∈ [0, 1]: cuán avanzados estamos hacia el siguiente paso
    const t = Math.min(1, (ts - lastStepTime) / GAME_SPEED);
    renderFrame(t);

    rafId = requestAnimationFrame(animLoop);
}

// ── Pantalla de configuración ─────────────────────────────────────────────
document.querySelectorAll('.grid-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.grid-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedGridSize = parseInt(btn.dataset.size);
        document.getElementById('win-apples-input').value = DEFAULT_WIN_APPLES[selectedGridSize];
    });
});

document.getElementById('start-btn').addEventListener('click', () => {
    winAppleTarget = Math.max(1, parseInt(document.getElementById('win-apples-input').value) || 92);
    winGoal        = Math.max(0, parseInt(document.getElementById('win-goal-input').value)   || 0);
    totalWins      = 0;

    document.getElementById('config-screen').style.display = 'none';
    document.getElementById('game-wrapper').style.display  = 'flex';

    updateScore();
    updateWins();
    startGame(selectedGridSize);
});

// ── Inicialización ────────────────────────────────────────────────────────
function startGame(gridSize) {
    const config  = GRID_CONFIGS[gridSize] ?? GRID_CONFIGS[10];
    const canvas  = document.getElementById('gameCanvas');
    canvas.width  = gridSize * config.cellSize;
    canvas.height = gridSize * config.cellSize;

    board   = new GameBoard('gameCanvas', config.cellSize);
    mySnake = new Snake(board);
    snakeAI = new SnakeAI(board, mySnake);
    sounds  = new SoundManager();

    applesEaten = 0;
    updateScore();
    generateFood();
    startGameLoop();
}

function restartGame() {
    applesEaten = 0;
    updateScore();
    mySnake.reset();
    generateFood();
    startGameLoop();
}

// ── Paso lógico (sin render) ──────────────────────────────────────────────
function runGameStep() {
    // 1. IA decide la dirección
    const prevDir  = { ...mySnake.nextDirection };
    const nextMove = snakeAI.getNextMove(food);
    mySnake.setDirection(nextMove);

    if (prevDir.x !== mySnake.nextDirection.x || prevDir.y !== mySnake.nextDirection.y) {
        sounds.playClick();
    }

    // 2. ¿Comerá en este paso?
    const head    = mySnake.body[0];
    const nextX   = head.x + mySnake.nextDirection.x;
    const nextY   = head.y + mySnake.nextDirection.y;
    const willEat = (nextX === food.x && nextY === food.y);

    // 3. Mover
    mySnake.move(willEat);

    // 4. ¿Comió?
    if (willEat) {
        applesEaten++;
        updateScore();
        sounds.playEat();

        if (applesEaten >= winAppleTarget) {
            handleWin();
            return;
        }

        bonusFood = false;   // reset después de comer la comida especial
        generateFood();
    }

    // 5. ¿Colisión?
    if (mySnake.checkCollision()) {
        handleDeath();
    }
}

// ── Render ────────────────────────────────────────────────────────────────
function renderFrame(t = 1) {
    board.clear();
    drawFood();
    mySnake.draw(t, performance.now() < rainbowEndTime);

    // Flash overlay (efecto obstáculo / evento especial)
    if (flashOverlay) {
        const now      = performance.now();
        const elapsed  = now - flashOverlay.startTime;
        const duration = flashOverlay.duration;
        if (elapsed < duration) {
            // Fade: máximo a los 200 ms, luego decrece hasta 0
            const progress = elapsed / duration;
            const alpha    = progress < 0.15
                ? (progress / 0.15) * flashOverlay.maxAlpha
                : flashOverlay.maxAlpha * (1 - (progress - 0.15) / 0.85);
            const ctx = board.ctx;
            ctx.fillStyle = `rgba(${flashOverlay.r},${flashOverlay.g},${flashOverlay.b},${alpha.toFixed(3)})`;
            ctx.fillRect(0, 0, board.canvas.width, board.canvas.height);
        } else {
            flashOverlay = null;
        }
    }
}

// ── WIN ───────────────────────────────────────────────────────────────────
function handleWin() {
    stopGameLoop();
    totalWins++;
    updateWins();

    renderFrame(1);     // render final con la serpiente en su posición exacta
    drawWinScreen();

    setTimeout(() => restartGame(), 4000);
}

function drawWinScreen() {
    const ctx = board.ctx;
    const w   = board.canvas.width;
    const h   = board.canvas.height;
    const fs  = Math.max(14, Math.floor(h / 7));

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#00ff2a';
    ctx.font      = `bold ${fs}px Segoe UI`;
    ctx.fillText('¡GANASTE! 🏆', w / 2, h / 2 - fs * 0.9);

    const winsText = winGoal > 0
        ? `🏆 ${totalWins} / ${winGoal} wins`
        : `🏆 ${totalWins} win${totalWins !== 1 ? 's' : ''}`;
    ctx.fillStyle = '#ffdd00';
    ctx.font      = `bold ${Math.floor(fs * 0.58)}px Segoe UI`;
    ctx.fillText(winsText, w / 2, h / 2 - fs * 0.05);

    ctx.fillStyle = '#ffffff';
    ctx.font      = `${Math.floor(fs * 0.52)}px Segoe UI`;
    ctx.fillText(`🍎 ${applesEaten} manzanas`, w / 2, h / 2 + fs * 0.65);

    ctx.fillStyle = '#666666';
    ctx.font      = `${Math.floor(fs * 0.4)}px Segoe UI`;
    ctx.fillText('Reiniciando en 4 s...', w / 2, h / 2 + fs * 1.2);
}

// ── MUERTE ────────────────────────────────────────────────────────────────
function handleDeath() {
    stopGameLoop();
    applesEaten = 0;
    updateScore();
    mySnake.reset();
    generateFood();
    renderFrame(1);
    setTimeout(() => restartGame(), 800);
}

// ── Helpers ───────────────────────────────────────────────────────────────
function updateScore() {
    document.getElementById('score-value').textContent  = applesEaten;
    document.getElementById('score-target').textContent = `/ ${winAppleTarget}`;
}

function updateWins() {
    document.getElementById('wins-value').textContent = totalWins;
    document.getElementById('wins-goal').textContent  = winGoal > 0 ? `/ ${winGoal}` : '';
}

function generateFood() {
    const total = board.columns * board.rows;
    if (mySnake.body.length >= total) return;

    food = {
        x: Math.floor(Math.random() * board.columns),
        y: Math.floor(Math.random() * board.rows)
    };

    for (const seg of mySnake.body) {
        if (food.x === seg.x && food.y === seg.y) {
            generateFood();
            return;
        }
    }
}

// ── Dibujo de la manzana ─────────────────────────────────────────────────
function drawFood() {
    const ctx  = board.ctx;
    const size = board.gridSize;
    const cx   = food.x * size + size / 2;
    const cy   = food.y * size + size / 2 + size * 0.04;
    const r    = size * 0.34;

    // Color: roja normal o dorada si es comida bonus
    const bodyColor    = bonusFood ? '#f5c400' : '#e32b20';
    const highlightClr = bonusFood ? 'rgba(255,255,180,0.50)' : 'rgba(255,255,255,0.32)';
    const leafColor    = bonusFood ? '#c8a000' : '#29a846';

    // Cuerpo
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Brillo extra para la dorada
    if (bonusFood) {
        ctx.fillStyle = 'rgba(255,230,0,0.25)';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
        ctx.fill();
    }

    // Brillo
    ctx.fillStyle = highlightClr;
    ctx.beginPath();
    ctx.arc(cx - r * 0.27, cy - r * 0.27, r * 0.33, 0, Math.PI * 2);
    ctx.fill();

    // Tallo
    ctx.strokeStyle = '#5a3010';
    ctx.lineWidth   = Math.max(1, size * 0.07);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.05, cy - r * 0.95);
    ctx.lineTo(cx + r * 0.22, cy - r * 1.38);
    ctx.stroke();

    // Hoja
    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.22, cy - r * 1.22);
    ctx.quadraticCurveTo(cx + r * 0.75, cy - r * 1.55, cx + r * 0.60, cy - r * 0.95);
    ctx.quadraticCurveTo(cx + r * 0.08, cy - r * 1.05, cx + r * 0.22, cy - r * 1.22);
    ctx.fill();
}

// ── Eventos del socket (chat / regalos TikTok) ────────────────────────────

// ⚡ / 🐢 Cambio de velocidad
window.addEventListener('snake-speed-change', e => {
    GAME_SPEED = Math.min(320, Math.max(70, GAME_SPEED + e.detail.delta));
});

// 🌟 Comida bonus: la próxima manzana se vuelve dorada
window.addEventListener('snake-bonus-food', () => {
    bonusFood = true;
});

// 💣 Obstáculo: comida al punto más lejano + flash rojo
window.addEventListener('snake-obstacle', e => {
    moveFoodToFarthest();
    startFlash(220, 30, 30, 0.45, e.detail.duration ?? 5000);
});

// 🌱 Crecer: agrega N segmentos a la cola
window.addEventListener('snake-grow', e => {
    if (!mySnake) return;
    growSnake(e.detail.amount ?? 3);
    startFlash(0, 200, 50, 0.30, 600);
});

// ✂️ Encoger: quita N segmentos de la cola
window.addEventListener('snake-shrink', e => {
    if (!mySnake) return;
    shrinkSnake(e.detail.amount ?? 3);
    startFlash(180, 100, 0, 0.35, 600);
});

// 🌈 Arcoíris: colores en la serpiente por N ms
window.addEventListener('snake-rainbow', e => {
    rainbowEndTime = performance.now() + (e.detail.duration ?? 8000);
});

// 🧊 Congelar: pausa el juego N ms + flash azul
window.addEventListener('snake-freeze', e => {
    const dur = e.detail.duration ?? 2500;
    freezeUntil = performance.now() + dur;
    startFlash(60, 140, 220, 0.35, dur);
});

// ── Helpers de efectos ────────────────────────────────────────────────────

function growSnake(n) {
    const tail = mySnake.body[mySnake.body.length - 1];
    for (let i = 0; i < n; i++) {
        mySnake.body.push({ ...tail });
        mySnake.prevBody.push({ ...tail });
    }
    // Subir contador pero sin disparar el WIN
    applesEaten = Math.min(applesEaten + n, winAppleTarget - 1);
    updateScore();
}

function shrinkSnake(n) {
    const minLen  = 3;
    const toRemove = Math.min(n, mySnake.body.length - minLen);
    if (toRemove <= 0) return;
    mySnake.body.splice(mySnake.body.length - toRemove, toRemove);
    mySnake.prevBody.splice(mySnake.prevBody.length - toRemove, toRemove);
    applesEaten = Math.max(0, applesEaten - toRemove);
    updateScore();
}

function moveFoodToFarthest() {
    if (!board || !snakeAI || !mySnake) return;
    const { columns: W, rows: H } = board;
    const total    = W * H;
    const cycle    = snakeAI.cycle;
    const headIdx  = cycle[mySnake.body[0].y][mySnake.body[0].x];
    const occupied = new Set(mySnake.body.map(s => `${s.x},${s.y}`));
    let bestPos = null, bestDist = -1;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (occupied.has(`${x},${y}`)) continue;
            const dist = (cycle[y][x] - headIdx + total) % total;
            if (dist > bestDist) { bestDist = dist; bestPos = { x, y }; }
        }
    }
    if (bestPos) food = bestPos;
}

function startFlash(r, g, b, maxAlpha, duration) {
    flashOverlay = { r, g, b, maxAlpha, startTime: performance.now(), duration };
}
