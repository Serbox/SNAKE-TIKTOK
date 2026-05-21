class Snake {
    constructor(board) {
        this.board = board;
        this.reset();
    }

    reset() {
        const startX = Math.floor(this.board.columns / 2);
        const startY = Math.floor(this.board.rows / 2);

        this.body = [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ];

        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
    }

    setDirection(newDir) {
        if (this.direction.x + newDir.x === 0 && this.direction.y + newDir.y === 0) {
            return;
        }
        this.nextDirection = newDir;
    }

    move(grow = false) {
        this.direction = this.nextDirection;

        const head = this.body[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };

        this.body.unshift(newHead);

        if (!grow) {
            this.body.pop();
        }
    }

    checkCollision() {
        const head = this.body[0];

        if (head.x < 0 || head.x >= this.board.columns || head.y < 0 || head.y >= this.board.rows) {
            return true;
        }

        for (let i = 1; i < this.body.length; i++) {
            if (head.x === this.body[i].x && head.y === this.body[i].y) {
                return true;
            }
        }

        return false;
    }

    draw() {
        const ctx = this.board.ctx;
        const size = this.board.gridSize;

        this.body.forEach((segment, index) => {
            if (index === 0) {
                ctx.fillStyle = '#00ff2a';
            } else {
                ctx.fillStyle = '#00b35f';
            }

            ctx.fillRect(
                segment.x * size + 1,
                segment.y * size + 1,
                size - 2,
                size - 2
            );
        });
    }
}