// game.js

class Rabbit {
    constructor() {
        this.position = { x: 0, y: 0 };
        this.hopHeight = 50;
        this.isHopping = false;
    }

    hop() {
        this.isHopping = true;
        // Logic for hopping animation
        setTimeout(() => {
            this.isHopping = false;
            this.position.y -= this.hopHeight;
        }, 500);
    }

    move(x, y) {
        this.position.x += x;
        this.position.y += y;
    }
}

class HitParticle {
    constructor() {
        this.position = { x: 0, y: 0 };
        this.isVisible = false;
    }

    createEffect(x, y) {
        this.position = { x, y };
        this.isVisible = true;
        // Logic for visual effect
        setTimeout(() => this.isVisible = false, 1000);
    }
}

class Game {
    constructor() {
        this.score = 0;
        this.level = 1;
        this.difficulty = 1000;
        this.isGameOver = false;
    }

    start() {
        this.isGameOver = false;
        this.score = 0;
        this.level = 1;
        // Start the gameplay
        this.update();
    }

    update() {
        if (this.isGameOver) return;
        // Game logic to update score, check for game over state
        setTimeout(() => this.update(), this.difficulty);
    }

    endGame() {
        this.isGameOver = true;
        console.log(`Game Over! Your score: ${this.score}`);
    }

    increaseDifficulty() {
        this.difficulty -= 100;
    }
}

// Sample instantiation
const game = new Game();
game.start();
const rabbit = new Rabbit();
const hitParticle = new HitParticle();

// Example usage:
rabbit.hop();
hitParticle.createEffect(100, 100);
