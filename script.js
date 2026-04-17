class Rabbit {
    constructor() {
        this.position = 0;
        this.velocity = 0.1; // units per second
    }

    update(deltaTime) {
        this.position += this.velocity * deltaTime * 60; // scale movement by deltaTime
    }
}

class HitParticle {
    constructor() {
        this.position = 0;
        this.velocity = 0.05; // units per second
    }

    update(deltaTime) {
        this.position += this.velocity * deltaTime * 60; // smooth physics
    }
}

class Game {
    constructor() {
        this.rabbit = new Rabbit();
        this.hitParticle = new HitParticle();
        this.lastTimestamp = performance.now();
    }

    gameLoop = () => {
        const currentTimestamp = performance.now();
        const deltaTime = (currentTimestamp - this.lastTimestamp) / 1000; // convert to seconds
        this.lastTimestamp = currentTimestamp;

        this.rabbit.update(deltaTime);
        this.hitParticle.update(deltaTime);

        requestAnimationFrame(this.gameLoop); // call next frame
    }

    start() {
        this.gameLoop(); // start the game loop
    }
}

const game = new Game();
game.start();