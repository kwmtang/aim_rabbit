// Target framerate used to express speeds in the original code.
// All velocities are defined as "pixels per frame at 60 fps" and then
// multiplied by dt (seconds) so the game runs identically at any refresh rate.
const TARGET_FPS = 60;

class Rabbit {
    constructor(canvas, difficulty) {
        this.canvas = canvas;
        this.difficulty = difficulty;
        this.spawnTime = performance.now();
        this.timeLimit = 10000;

        this.baseSize = Math.max(20, 50 - difficulty * 3);
        this.size = this.baseSize;

        // Speed in px/frame @60fps — will be scaled by dt in update()
        this.speed = 2 + difficulty * 0.5;

        this.x = Math.random() * (canvas.width  - this.size * 2) + this.size;
        this.y = Math.random() * (canvas.height - this.size * 2) + this.size;

        this.dirX = Math.random() > 0.5 ? 1 : -1;
        this.dirY = Math.random() > 0.5 ? 1 : -1;

        // hopIndex drives the vertical bob animation; advance per second
        // at 60fps the original added 0.1 per frame → 6 units/sec
        this.hopIndex = 0;
        this.hopRate  = 0.1 * TARGET_FPS; // radians per second (≈6)
        this.verticalBob = 0;
    }

    update(dt) {
        // dt is seconds elapsed since last frame
        const px = this.speed * TARGET_FPS * dt; // pixels to move this frame

        this.x += px * this.dirX;
        this.y += px * this.dirY;

        if (this.x - this.size <= 0 || this.x + this.size >= this.canvas.width) {
            this.dirX *= -1;
            this.x = Math.max(this.size, Math.min(this.canvas.width  - this.size, this.x));
        }
        if (this.y - this.size <= 0 || this.y + this.size >= this.canvas.height) {
            this.dirY *= -1;
            this.y = Math.max(this.size, Math.min(this.canvas.height - this.size, this.y));
        }

        this.hopIndex   += this.hopRate * dt;
        this.verticalBob = Math.abs(Math.sin(this.hopIndex * Math.PI)) * this.size * 0.3;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y - this.verticalBob);

        // Body
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Left ear
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.3, -this.size * 1.2, this.size * 0.25, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Right ear
        ctx.beginPath();
        ctx.ellipse( this.size * 0.3, -this.size * 1.2, this.size * 0.25, this.size * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner ears
        ctx.fillStyle = '#ffb6d9';
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.3, -this.size * 1.2, this.size * 0.12, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse( this.size * 0.3, -this.size * 1.2, this.size * 0.12, this.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-this.size * 0.2, -this.size * 0.3, this.size * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc( this.size * 0.2, -this.size * 0.3, this.size * 0.12, 0, Math.PI * 2);
        ctx.fill();

        // Nose
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
        return performance.now() - this.spawnTime;
    }

    isTimeUp() {
        return this.getElapsedTime() > this.timeLimit;
    }
}

class HitParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        // Velocities in px/frame @60fps; will be scaled by dt
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8 - 2;
        this.gravity = 0.2; // px/frame² @60fps
        this.life  = 1;
        this.decay = 0.05 * TARGET_FPS; // life units per second
        this.size  = Math.random() * 8 + 4;
    }

    update(dt) {
        this.x  += this.vx * TARGET_FPS * dt;
        this.y  += this.vy * TARGET_FPS * dt;
        this.vy += this.gravity * TARGET_FPS * dt;
        this.life -= this.decay * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
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
        this.ctx    = this.canvas.getContext('2d');

        // Overlay canvas: rabbit + particles drawn here so they appear
        // above all HTML elements (HUD, title) at all times.
        this.rabbitCanvas = document.getElementById('rabbitCanvas');
        this.rctx         = this.rabbitCanvas.getContext('2d');

        this.canvas.width        = window.innerWidth;
        this.canvas.height       = window.innerHeight;
        this.rabbitCanvas.width  = window.innerWidth;
        this.rabbitCanvas.height = window.innerHeight;

        this.lives      = 10;
        this.hits       = 0;
        this.attempts   = 0;
        this.difficulty = 1;
        this.particles  = [];
        this.isGameOver = false;
        this.reactionTimes = [];

        this.rabbit = new Rabbit(this.canvas, this.difficulty);

        this.lastTimestamp = null;

        // Listen on the whole document so clicks over HTML elements
        // (HUD, title) are still caught by the game.
        document.addEventListener('pointerdown', (e) => this.handleClick(e));
        document.getElementById('restartBtn').addEventListener('click', () => this.restart());
        window.addEventListener('resize', () => this.handleResize());

        requestAnimationFrame((ts) => this.gameLoop(ts));
    }

    handleClick(e) {
        if (this.isGameOver) return;
        // restartBtn click should not count as a miss
        if (e.target && e.target.id === 'restartBtn') return;

        const clickX = e.clientX;
        const clickY = e.clientY;

        this.attempts++;

        if (this.rabbit.isHit(clickX, clickY)) {
            this.hits++;
            this.reactionTimes.push(this.rabbit.getElapsedTime());

            for (let i = 0; i < 12; i++) {
                this.particles.push(new HitParticle(clickX, clickY));
            }

            if (this.hits % 5 === 0) this.difficulty++;
            this.rabbit = new Rabbit(this.canvas, this.difficulty);
        } else {
            this.lives--;
            if (this.lives <= 0) this.endGame();
        }

        this.updateHUD();
    }

    handleResize() {
        this.canvas.width        = window.innerWidth;
        this.canvas.height       = window.innerHeight;
        this.rabbitCanvas.width  = window.innerWidth;
        this.rabbitCanvas.height = window.innerHeight;
    }

    update(dt) {
        if (this.isGameOver) return;

        this.rabbit.update(dt);

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
        this.particles.forEach(p => p.update(dt));
    }

    draw() {
        // Background and ground on the main canvas (behind HTML elements)
        this.ctx.fillStyle = '#87ceeb';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#90EE90';
        this.ctx.fillRect(0, this.canvas.height * 0.7, this.canvas.width, this.canvas.height * 0.3);

        // Rabbit and particles on the overlay canvas (above HTML elements)
        this.rctx.clearRect(0, 0, this.rabbitCanvas.width, this.rabbitCanvas.height);
        this.rabbit.draw(this.rctx);
        this.particles.forEach(p => p.draw(this.rctx));
    }

    updateHUD() {
        document.getElementById('livesDisplay').textContent = this.lives;
        document.getElementById('hitsDisplay').textContent  = this.hits;

        const accuracy = this.attempts > 0
            ? Math.round((this.hits / this.attempts) * 100) : 0;
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

        const accuracy = this.attempts > 0
            ? Math.round((this.hits / this.attempts) * 100) : 0;
        const avgSpeed = this.reactionTimes.length > 0
            ? Math.round(this.reactionTimes.reduce((a, b) => a + b, 0) / this.reactionTimes.length)
            : 0;

        document.getElementById('finalHits').textContent       = this.hits;
        document.getElementById('finalAccuracy').textContent   = accuracy;
        document.getElementById('finalSpeed').textContent      = avgSpeed;
        document.getElementById('finalDifficulty').textContent = this.difficulty;
    }

    restart() {
        document.getElementById('gameOverScreen').classList.add('hidden');
        this.lives      = 10;
        this.hits       = 0;
        this.attempts   = 0;
        this.difficulty = 1;
        this.particles  = [];
        this.isGameOver = false;
        this.reactionTimes = [];
        this.lastTimestamp = null;
        this.rctx.clearRect(0, 0, this.rabbitCanvas.width, this.rabbitCanvas.height);
        this.rabbit = new Rabbit(this.canvas, this.difficulty);
        this.updateHUD();
    }

    gameLoop(timestamp) {
        // Compute dt in seconds; clamp to 100ms so a tab-switch spike
        // doesn't teleport the rabbit across the canvas.
        let dt = 0;
        if (this.lastTimestamp !== null) {
            dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
        }
        this.lastTimestamp = timestamp;

        this.update(dt);
        this.draw();
        this.updateHUD();

        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
}

window.addEventListener('load', () => {
    new Game();
});
