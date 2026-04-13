class Rabbit {
    constructor(canvas, difficulty) {
        this.canvas = canvas;
        this.difficulty = difficulty;
        this.spawnTime = Date.now();
        this.timeLimit = 10000;
        
        this.baseSize = Math.max(20, 50 - difficulty * 3);
        this.size = this.baseSize;
        
        this.baseSpeed = 2 + difficulty * 0.5;
        this.speed = this.baseSpeed;
        
        this.x = Math.random() * (canvas.width - this.size * 2) + this.size;
        this.y = Math.random() * (canvas.height - this.size * 2) + this.size;
        
        this.dirX = Math.random() > 0.5 ? 1 : -1;
        this.dirY = Math.random() > 0.5 ? 1 : -1;
        
        this.hopIndex = 0;
        this.hopCycle = 0.1;
        this.verticalBob = 0;
    }
    
    update() {
        this.x += this.speed * this.dirX;
        this.y += this.speed * this.dirY;
        
        if (this.x - this.size <= 0 || this.x + this.size >= this.canvas.width) {
            this.dirX *= -1;
            this.x = Math.max(this.size, Math.min(this.canvas.width - this.size, this.x));
        }
        if (this.y - this.size <= 0 || this.y + this.size >= this.canvas.height) {
            this.dirY *= -1;
            this.y = Math.max(this.size, Math.min(this.canvas.height - this.size, this.y));
        }
        
        this.hopIndex += this.hopCycle;
        this.verticalBob = Math.abs(Math.sin(this.hopIndex * Math.PI)) * this.size * 0.3;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y - this.verticalBob);
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.3, -this.size * 1.2, this.size * 0.25, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.ellipse(this.size * 0.3, -this.size * 1.2, this.size * 0.25, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#ffb6d9';
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.3, -this.size * 1.2, this.size * 0.12, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(this.size * 0.3, -this.size * 1.2, this.size * 0.12, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-this.size * 0.2, -this.size * 0.3, this.size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(this.size * 0.2, -this.size * 0.3, this.size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffb6d9';
        ctx.beginPath();
        ctx.arc(0, this.size * 0.2, this.size * 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    isHit(clickX, clickY) {
        const distance = Math.sqrt((clickX - this.x) ** 2 + (clickY - (this.y - this.verticalBob)) ** 2);
        return distance < this.size;
    }
    
    getElapsedTime() {
        return Date.now() - this.spawnTime;
    }
    
    isTimeUp() {
        return this.getElapsedTime() > this.timeLimit;
    }
}

class HitParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 2;
        this.life = 1;
        this.decay = 0.05;
        this.size = Math.random() * 8 + 4;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2;
        this.life -= this.decay;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    isAlive() {
        return this.life > 0;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        this.lives = 10;
        this.hits = 0;
        this.attempts = 0;
        this.difficulty = 1;
        this.particles = [];
        this.isGameOver = false;
        this.reactionTimes = [];
        
        this.rabbit = new Rabbit(this.canvas, this.difficulty);
        
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        window.addEventListener('resize', () => this.handleResize());
        
        this.gameLoop();
    }
    
    handleClick(e) {
        if (this.isGameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        this.attempts++;
        
        if (this.rabbit.isHit(clickX, clickY)) {
            this.hits++;
            const reactionTime = this.rabbit.getElapsedTime();
            this.reactionTimes.push(reactionTime);
            
            for (let i = 0; i < 12; i++) {
                this.particles.push(new HitParticle(clickX, clickY));
            }
            
            if (this.hits % 5 === 0) {
                this.difficulty++;
            }
            
            this.rabbit = new Rabbit(this.canvas, this.difficulty);
        } else {
            this.lives--;
            if (this.lives <= 0) {
                this.endGame();
            }
        }
        
        this.updateHUD();
    }
    
    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    update() {
        if (this.isGameOver) return;
        
        this.rabbit.update();
        
        if (this.rabbit.isTimeUp()) {
            this.lives--;
            if (this.lives <= 0) {
                this.endGame();
            } else {
                this.difficulty = Math.max(1, Math.floor(this.hits / 5) + 1);
                this.rabbit = new Rabbit(this.canvas, this.difficulty);
            }
            this.updateHUD();
        }
        
        this.particles = this.particles.filter(p => p.isAlive());
        this.particles.forEach(p => p.update());
    }
    
    draw() {
        this.ctx.fillStyle = '#87ceeb';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#90EE90';
        this.ctx.fillRect(0, this.canvas.height * 0.7, this.canvas.width, this.canvas.height * 0.3);
        
        this.rabbit.draw(this.ctx);
        
        this.particles.forEach(p => p.draw(this.ctx));
    }
    
    updateHUD() {
        document.getElementById('livesDisplay').textContent = this.lives;
        document.getElementById('hitsDisplay').textContent = this.hits;
        
        const accuracy = this.attempts > 0 ? Math.round((this.hits / this.attempts) * 100) : 0;
        document.getElementById('accuracyDisplay').textContent = accuracy + '%';
        
        const avgSpeed = this.reactionTimes.length > 0 
            ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length)
            : 0;
        document.getElementById('speedDisplay').textContent = avgSpeed + 'ms';
        
        const timeLeft = Math.max(0, (10000 - this.rabbit.getElapsedTime()) / 1000);
        const timerDisplay = document.getElementById('timerDisplay');
        timerDisplay.textContent = timeLeft.toFixed(1) + 's';
        
        if (timeLeft > 5) {
            timerDisplay.style.color = '#00ff00';
        } else if (timeLeft > 2) {
            timerDisplay.style.color = '#ffaa00';
        } else {
            timerDisplay.style.color = '#ff0000';
        }
        
        document.getElementById('difficultyDisplay').textContent = this.difficulty;
    }
    
    endGame() {
        this.isGameOver = true;
        document.getElementById('gameOverScreen').classList.remove('hidden');
        
        const accuracy = this.attempts > 0 ? Math.round((this.hits / this.attempts) * 100) : 0;
        const avgSpeed = this.reactionTimes.length > 0 
            ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length)
            : 0;
        
        document.getElementById('finalHits').textContent = this.hits;
        document.getElementById('finalAccuracy').textContent = accuracy;
        document.getElementById('finalSpeed').textContent = avgSpeed;
        document.getElementById('finalDifficulty').textContent = this.difficulty;
    }
    
    restart() {
        document.getElementById('gameOverScreen').classList.add('hidden');
        this.lives = 10;
        this.hits = 0;
        this.attempts = 0;
        this.difficulty = 1;
        this.particles = [];
        this.isGameOver = false;
        this.reactionTimes = [];
        this.rabbit = new Rabbit(this.canvas, this.difficulty);
        this.updateHUD();
    }
    
    gameLoop() {
        this.update();
        this.draw();
        this.updateHUD();
        requestAnimationFrame(() => this.gameLoop());
    }
}

window.addEventListener('load', () => {
    new Game();
});
