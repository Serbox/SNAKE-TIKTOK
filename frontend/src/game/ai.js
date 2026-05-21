class SnakeAI {
  constructor(board, snake) {
    this.board  = board;
    this.snake  = snake;
    this.cycle  = this.buildHamiltonianCycle();
    // cycle[y][x] = índice de orden en que la serpiente pasa por esa celda
  }

  // Genera un ciclo hamiltoniano en serpentina (boustrophedon).
  // Funciona con cualquier tablero donde COLS sea par.
  buildHamiltonianCycle() {
    const { columns: W, rows: H } = this.board;
    const cycle = Array.from({ length: H }, () => new Array(W).fill(0));
    let idx = 0;

    // Fila 0: siempre de izquierda a derecha (la "autopista" superior)
    for (let x = 0; x < W; x++) cycle[0][x] = idx++;

    // Columnas 1..W-2 (zona central): zigzag vertical por columnas pares/impares
    for (let x = W - 1; x >= 1; x--) {
      if (x === W - 1) {
        for (let y = 1; y < H; y++) cycle[y][x] = idx++;
      } else if (x % 2 === 0) {
        for (let y = H - 1; y >= 1; y--) cycle[y][x] = idx++;
      } else {
        for (let y = 1; y < H; y++) cycle[y][x] = idx++;
      }
    }

    // Columna 0 (borde izquierdo): sube de vuelta
    for (let y = H - 1; y >= 1; y--) cycle[y][0] = idx++;

    return cycle;
  }

  getNextMove(foodPosition) {
    const { columns: W, rows: H } = this.board;
    const total = W * H;
    const head  = this.snake.body[0];
    const headIdx = this.cycle[head.y][head.x];

    // ─── Atajo opcional: ir directo a la comida si es seguro ─────────────────
    // Solo recortamos el ciclo cuando la serpiente es corta y el atajo
    // no rompe el orden relativo head → food → tail en el ciclo.
    if (this.canShortcut(foodPosition)) {
      const shortcut = this.moveToward(head, foodPosition);
      if (shortcut) return shortcut;
    }

    // ─── Seguir el ciclo hamiltoniano ─────────────────────────────────────────
    const candidates = [
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    let bestDir  = null;
    let bestNext = -1;

    for (const dir of candidates) {
      const nx = head.x + dir.x;
      const ny = head.y + dir.y;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;

      const nIdx = this.cycle[ny][nx];
      // El siguiente paso correcto del ciclo es (headIdx + 1) % total
      const expected = (headIdx + 1) % total;
      if (nIdx === expected) { return dir; } // movimiento exacto del ciclo

      // Guardamos el mejor vecino por si el exacto no existe (borde de arranque)
      if (nIdx > bestNext) { bestNext = nIdx; bestDir = dir; }
    }

    return bestDir ?? candidates[0];
  }

  // ─── Atajo: solo si la comida está "por delante" en el ciclo ─────────────
  canShortcut(food) {
    const { columns: W, rows: H } = this.board;
    const total     = W * H;
    const head      = this.snake.body[0];
    const tail      = this.snake.body[this.snake.body.length - 1];
    const headIdx   = this.cycle[head.y][head.x];
    const tailIdx   = this.cycle[tail.y][tail.x];
    const foodIdx   = this.cycle[food.y][food.x];
    const snakeLen  = this.snake.body.length;
    const threshold = Math.floor(total * 0.5); // atajo solo cuando < 50% lleno

    if (snakeLen >= threshold) return false;

    // La comida debe estar entre head y tail en dirección del ciclo
    const ahead = (idx) => ((idx - headIdx + total) % total);
    return ahead(foodIdx) < ahead(tailIdx);
  }

  // Devuelve la dirección de un paso Manhattan hacia el destino
  moveToward(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
    }
    return dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
  }
}