class GameBoard{
    constructor(canvasId,gridSize = 20){
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = gridSize;
        //esto es para calcular cuántas columnas y filas caben en el canvas según el tamaño de la cuadrícula
        this.columns = this.canvas.width / this.gridSize;
        this.rows = this.canvas.height / this.gridSize;
    }
    clear(){
        this.ctx.fillStyle = '#0c0c0e';
        this.ctx.fillRect(0,0 , this.canvas.width, this.canvas.height);
        this.drawGrid();
    }

    drawGrid(){
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        this.ctx.lineWidth = 1;

        for(let i = 0; i<this.columns; i++){
            this.ctx.beginPath();
            this.ctx.moveTo(i*this.gridSize, 0);
            this.ctx.lineTo(i*this.gridSize, this.canvas.height);
            this.ctx.stroke();
        }

        for(let j = 0; j<this.rows; j++){
            this.ctx.beginPath();
            this.ctx.moveTo(0, j*this.gridSize);
            this.ctx.lineTo(this.canvas.width, j*this.gridSize);
            this.ctx.stroke();
        }
    }
}