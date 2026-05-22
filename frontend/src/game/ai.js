/*
 * SnakeAI — Ciclo Hamiltoniano con atajos correctos
 *
 * REGLA DE ORO: un atajo solo se permite si avanza en el ciclo
 * (nunca retrocede) y el segmento del ciclo que saltea está libre.
 * De este modo el ciclo hamiltoniano nunca se rompe y la serpiente
 * SIEMPRE completa el tablero.
 *
 * Requisito: columnas PARES (10, 16, 20 ✓).
 */
class SnakeAI {
    constructor(board, snake) {
        this.board = board;
        this.snake = snake;
        this.cycle = this.buildHamiltonianCycle();
    }

    // ── Construcción del ciclo ────────────────────────────────────────────────
    buildHamiltonianCycle() {
        const { columns: W, rows: H } = this.board;
        const cycle = Array.from({ length: H }, () => new Array(W).fill(0));
        let idx = 0;

        for (let x = 0; x < W; x++) cycle[0][x] = idx++;

        for (let x = W - 1; x >= 1; x--) {
            if (x === W - 1) {
                for (let y = 1; y < H; y++) cycle[y][x] = idx++;
            } else if (x % 2 === 0) {
                for (let y = H - 1; y >= 1; y--) cycle[y][x] = idx++;
            } else {
                for (let y = 1; y < H; y++) cycle[y][x] = idx++;
            }
        }

        for (let y = H - 1; y >= 1; y--) cycle[y][0] = idx++;
        return cycle;
    }

    // ── Decisión de movimiento ────────────────────────────────────────────────
    getNextMove(foodPosition) {
        const { columns: W, rows: H } = this.board;
        const total    = W * H;
        const head     = this.snake.body[0];
        const headIdx  = this.cycle[head.y][head.x];
        const foodIdx  = this.cycle[foodPosition.y][foodPosition.x];

        // distancia hacia adelante en el ciclo (0 = mismo, total-1 = justo atrás)
        const aheadOf  = idx => ((idx - headIdx + total) % total);
        const foodDist = aheadOf(foodIdx);

        // ── ATAJO: solo cuando la comida está en la mitad "adelante" del ciclo ─
        // Esto garantiza que la comida no está "detrás" de la cabeza en el ciclo,
        // lo que haría que el atajo rompiera el orden hamiltoniano.
        if (foodDist > 0 && foodDist <= Math.floor(total / 2)) {
            const toward = this.moveToward(head, foodPosition);
            if (toward) {
                const nx = head.x + toward.x;
                const ny = head.y + toward.y;

                if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                    const nIdx  = this.cycle[ny][nx];
                    const nDist = aheadOf(nIdx);

                    // El paso debe avanzar en el ciclo (sin retroceder ni pasarse la comida)
                    if (nDist > 0 && nDist <= foodDist) {

                        // El "hueco" del ciclo entre la cabeza y el paso debe estar libre
                        // (si hay cuerpo en ese hueco, el atajo rompería el orden)
                        let gapClear = true;
                        for (const seg of this.snake.body) {
                            const sDist = aheadOf(this.cycle[seg.y][seg.x]);
                            if (sDist > 0 && sDist < nDist) {
                                gapClear = false;
                                break;
                            }
                        }

                        // La celda destino tampoco puede ser cuerpo (excepto cola)
                        if (gapClear) {
                            let cellFree = true;
                            for (let i = 0; i < this.snake.body.length - 1; i++) {
                                if (this.snake.body[i].x === nx && this.snake.body[i].y === ny) {
                                    cellFree = false;
                                    break;
                                }
                            }
                            if (cellFree) return toward;
                        }
                    }
                }
            }
        }

        // ── CICLO HAMILTONIANO: siguiente paso exacto ─────────────────────────
        const expected = (headIdx + 1) % total;
        const candidates = [
            { x: 1, y: 0 }, { x: -1, y: 0 },
            { x: 0, y: 1 }, { x: 0, y: -1 }
        ];

        let bestDir  = null;
        let bestDist = Infinity;

        for (const dir of candidates) {
            const nx = head.x + dir.x;
            const ny = head.y + dir.y;
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;

            const nIdx = this.cycle[ny][nx];
            if (nIdx === expected) return dir;          // paso exacto ✓

            const dist = (expected - nIdx + total) % total;
            if (dist < bestDist) { bestDist = dist; bestDir = dir; }
        }

        return bestDir ?? candidates[0];
    }

    // ── Paso Manhattan hacia el destino ───────────────────────────────────────
    moveToward(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 };
        }
        return dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }
}
