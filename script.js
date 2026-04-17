class Rabbit {
    constructor(canvas, difficulty) {
        this.canvas = canvas;
        this.difficulty = difficulty;
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.speed = this.difficulty === 'hard' ? 5 : 2;
        this.hitBox = 30;
        this.startTime = performance.now();
    }

    update(deltaTime) {
        this.x += this.speed * deltaTime * 60;
        if (this.x > this.canvas.width) {
            this.x = 0;
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'brown';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 20, 30, Math.PI / 2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x, this.y - 20, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.fill();
    }

    isHit(mouseX, mouseY) {
        return Math.abs(mouseX - this.x) < this.hitBox && Math.abs(mouseY - this.y) < this.hitBox;
    }

    getElapsedTime() {
        return (performance.now() - this.startTime) / 1000;
    }

    isTimeUp(limit) {
        return this.getElapsedTime() > limit;
    }
}

class HitParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.lifetime = 1.0;
        this.alive = true;
    }

    update(deltaTime) {
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.alive = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, 2 * Math.PI);
        ctx.fill();
    }

    isAlive() {
        return this.alive;
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.rabbit = new Rabbit(canvas, 'normal');
        this.hitParticles = [];
        this.score = 0;
        this.startTime = performance.now();
        this.gameDuration = 30; // seconds
        window.addEventListener('click', this.handleClick.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
        this.init();
    }

    init() {
        this.rabbit = new Rabbit(this.canvas, 'normal');
        this.score = 0;
        this.startTime = performance.now();
        this.gameLoop();
    }

    handleClick(event) {
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        if (this.rabbit.isHit(mouseX, mouseY)) {
            this.score++;
            this.hitParticles.push(new HitParticle(mouseX, mouseY));
            this.rabbit = new Rabbit(this.canvas, 'normal');
        }
    }

    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    update(deltaTime) {
        this.rabbit.update(deltaTime);
        this.hitParticles.forEach(p => p.update(deltaTime));
        this.hitParticles = this.hitParticles.filter(p => p.isAlive());

        if (this.rabbit.isTimeUp(this.gameDuration)) {
            this.endGame();
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.rabbit.draw(this.ctx);
        this.hitParticles.forEach(p => p.draw(this.ctx));
        this.updateHUD();
    }

    updateHUD() {
        this.ctx.fillStyle = 'black';
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
        this.ctx.fillText(`Time: ${(this.gameDuration - this.rabbit.getElapsedTime()).toFixed(2)}`, 10, 60);
    }

    endGame() {
        alert(`Game Over! Your score: ${this.score}`);
    }

    gameLoop = () => {
        const now = performance.now();
        const deltaTime = (now - this.startTime) / 1000;
        this.startTime = now;
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame(this.gameLoop);
    };
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    new Game(canvas);
};
