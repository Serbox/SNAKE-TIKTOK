// Variables globales del juego - Cambiamos 'snake' por 'mySnake' para evitar choques
let board;
let mySnake; 
let snakeAI;
let food = { x: 5, y: 5 }; // Posición inicial de la comida
let gameInterval;
let score = 0;
let sounds;
const gameSpeed = 150; // Milisegundos entre cada paso

// Función para inicializar el proyecto cuando cargue la página
function init() {
    board = new GameBoard('gameCanvas');
    mySnake = new Snake(board); // Usamos la variable renombrada
    snakeAI = new SnakeAI(board, mySnake);
    sounds = new SoundManager();
    
    generateFood();
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, gameSpeed);
}

// El ciclo que se ejecuta infinitamente a la velocidad del juego
function gameLoop() {
    // Guardamos la dirección que tenía ANTES de que la IA decida
    const previousDirection = { x: mySnake.nextDirection.x, y: mySnake.nextDirection.y };

    runBasicAI();

    // Si la siguiente dirección calculada es diferente a la que traía, ¡giró!
    if (previousDirection.x !== mySnake.nextDirection.x || previousDirection.y !== mySnake.nextDirection.y) {
        sounds.playClick(); // Suena el teclado mecánico
    }

    const head = mySnake.body[0];
    const nextX = head.x + mySnake.nextDirection.x;
    const nextY = head.y + mySnake.nextDirection.y;
    
    let willEat = (nextX === food.x && nextY === food.y);

    mySnake.move(willEat);

    if (willEat) {
        score += 10;
        sounds.playEat(); // <--- Suena cuando come
        generateFood();
        console.log(`¡Comida! Score: ${score}`);
    }

    if (mySnake.checkCollision()) {
        console.log("¡GAME OVER! Reiniciando...");
        score = 0;
        mySnake.reset();
        generateFood();
        return; 
    }

    board.clear();
    drawFood();
    mySnake.draw();
}

// IA Básica: Persigue la comida en línea recta
function runBasicAI() {
    // Le pedimos a la IA el mejor movimiento calculando la posición de la comida
    const nextMove = snakeAI.getNextMove(food);
    mySnake.setDirection(nextMove);
}

function generateFood() {
    food = {
        x: Math.floor(Math.random() * board.columns),
        y: Math.floor(Math.random() * board.rows)
    };

    for (let segment of mySnake.body) { // Modificado
        if (food.x === segment.x && food.y === segment.y) {
            generateFood(); 
            break;
        }
    }
}

function drawFood() {
    const ctx = board.ctx;
    const size = board.gridSize;

    ctx.fillStyle = '#ff3860'; 
    ctx.fillRect(
        food.x * size + 1,
        food.y * size + 1,
        size - 2,
        size - 2
    );
}

window.onload = init;