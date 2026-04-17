class Rabbit {
    update(deltaTime) {
        // Scale movement by deltaTime for smooth motion
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }
}

class HitParticle {
    update(deltaTime) {
        // Use deltaTime for velocity updates
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
    }
}

class Game {
    gameLoop() {
        const currentTime = Date.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        this.update(deltaTime);
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    update(deltaTime) {
        this.rabbit.update(deltaTime);
        this.hitParticle.update(deltaTime);
    }
}