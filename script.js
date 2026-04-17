// JavaScript Delta-Time Based Smooth Animation Implementation

class Rabbit {
    constructor() {
        this.position = {
            x: 0,
            y: 0
        };
        this.lastTime = 0;
    }

    update(currentTime) {
        // Calculate delta time
        let deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Move the rabbit
        this.position.x += 100 * deltaTime; // Example speed
    }

    draw(ctx) {
        // Draw the rabbit
        ctx.fillStyle = 'brown';
        ctx.fillRect(this.position.x, this.position.y, 50, 50);
    }
}

class HitParticle {
    constructor(x, y) {
        this.position = { x, y };
        this.alpha = 1;
        this.lastTime = 0;
    }

    update(currentTime) {
        let deltaTime = (currentTime - this.lastTime) / 1000;
        this.alpha -= deltaTime * 0.5; // Fade out
        this.lastTime = currentTime;
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 0, 0, ' + this.alpha + ')';
        ctx.fillRect(this.position.x, this.position.y, 10, 10);
    }
}

class GameLoop {
    constructor() {
        this.rabbit = new Rabbit();
        this.hitParticles = [];
    }

    update(currentTime) {
        this.rabbit.update(currentTime);
        this.hitParticles.forEach(particle => particle.update(currentTime));
    }

    draw(ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        this.rabbit.draw(ctx);
        this.hitParticles.forEach(particle => particle.draw(ctx));
    }

    start() {
        const loop = (currentTime) => {
            this.update(currentTime);
            this.draw(ctx);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

// Start the game loop
const gameLoop = new GameLoop();
gameLoop.start();