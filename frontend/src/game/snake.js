class Snake {
    constructor(board) {
        this.board = board;
        this.reset();
    }

    reset() {
        const startX = Math.floor(this.board.columns / 2);
        const startY = Math.floor(this.board.rows / 2);

        this.body = [
            { x: startX,     y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];

        // prevBody guarda las posiciones del tick anterior para interpolar
        this.prevBody      = this.body.map(s => ({ ...s }));
        this.direction     = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
    }

    setDirection(newDir) {
        if (this.direction.x + newDir.x === 0 && this.direction.y + newDir.y === 0) return;
        this.nextDirection = newDir;
    }

    move(grow = false) {
        // Guardar posiciones antes de mover
        this.prevBody = this.body.map(s => ({ ...s }));

        this.direction = this.nextDirection;
        const head = this.body[0];
        this.body.unshift({ x: head.x + this.direction.x, y: head.y + this.direction.y });
        if (!grow) this.body.pop();
    }

    checkCollision() {
        const head = this.body[0];
        if (head.x < 0 || head.x >= this.board.columns ||
            head.y < 0 || head.y >= this.board.rows) return true;
        for (let i = 1; i < this.body.length; i++) {
            if (head.x === this.body[i].x && head.y === this.body[i].y) return true;
        }
        return false;
    }

    // ── Dibujo con interpolación ───────────────────────────────────────────
    // t       = 0 → posición del tick anterior  |  1 → posición actual
    // rainbow = true → modo arcoíris animado
    draw(t = 1, rainbow = false) {
        const ctx  = this.board.ctx;
        const size = this.board.gridSize;
        const len  = this.body.length;
        const segR = size * 0.50;
        const now  = performance.now();

        // Posiciones interpoladas
        const pts = this.body.map((cur, i) => {
            const prev = this.prevBody[i] ?? cur;
            return {
                x: (prev.x + (cur.x - prev.x) * t) * size + size / 2,
                y: (prev.y + (cur.y - prev.y) * t) * size + size / 2
            };
        });

        // Helper de color por índice
        const segColor = (i, darken = false) => {
            if (rainbow) {
                const hue = (now / 6 + i * (300 / Math.max(1, len - 1))) % 360;
                return `hsl(${hue}, 100%, ${darken ? 40 : 55}%)`;
            }
            const tc    = len > 1 ? i / (len - 1) : 0;
            const green = Math.round(255 - tc * 194);
            const blue  = Math.round(42  - tc * 21);
            return darken
                ? `rgb(0, ${Math.max(0, green - 50)}, ${Math.max(0, blue - 10)})`
                : `rgb(0, ${green}, ${blue})`;
        };

        // ── 1. Conexiones entre segmentos ──────────────────────────────────────
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = segR * 1.88;
        for (let i = len - 1; i > 0; i--) {
            ctx.strokeStyle = segColor(i);
            ctx.beginPath();
            ctx.moveTo(pts[i].x,     pts[i].y);
            ctx.lineTo(pts[i - 1].x, pts[i - 1].y);
            ctx.stroke();
        }

        // ── 2. Círculos ────────────────────────────────────────────────────────
        for (let i = len - 1; i >= 0; i--) {
            ctx.fillStyle = segColor(i);
            ctx.beginPath();
            ctx.arc(pts[i].x, pts[i].y, segR, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── 3. Brillo en la cabeza (extra visible en modo arcoíris) ───────────
        if (rainbow && len > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.18)';
            ctx.beginPath();
            ctx.arc(pts[0].x - segR * 0.2, pts[0].y - segR * 0.2, segR * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        // ── 4. Ojos en la cabeza ───────────────────────────────────────────────
        if (len > 0) this._drawEyes(ctx, pts[0].x, pts[0].y, size);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _drawEyes(ctx, cx, cy, size) {
        const dir  = this.direction;
        const eyeR = Math.max(1.8, size * 0.11);
        const off  = size * 0.24;

        let e1, e2;
        if      (dir.x ===  1) { e1 = { x: cx + off, y: cy - off }; e2 = { x: cx + off, y: cy + off }; }
        else if (dir.x === -1) { e1 = { x: cx - off, y: cy - off }; e2 = { x: cx - off, y: cy + off }; }
        else if (dir.y === -1) { e1 = { x: cx - off, y: cy - off }; e2 = { x: cx + off, y: cy - off }; }
        else                   { e1 = { x: cx - off, y: cy + off }; e2 = { x: cx + off, y: cy + off }; }

        [e1, e2].forEach(e => {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(e.x, e.y, eyeR, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(
                e.x + dir.x * eyeR * 0.4,
                e.y + dir.y * eyeR * 0.4,
                eyeR * 0.52, 0, Math.PI * 2
            );
            ctx.fill();
        });
    }
}
