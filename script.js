// Implementing delta-time based movement for smooth animation

let lastFrameTime = 0;

function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastFrameTime) / 1000; // Convert to seconds
    lastFrameTime = currentTime;

    updateParticles(deltaTime);
    updateOtherEntities(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

function updateParticles(deltaTime) {
    // Use deltaTime for consistent physics
    particles.forEach(particle => {
        particle.position.x += particle.velocity.x * deltaTime;
        particle.position.y += particle.velocity.y * deltaTime;
    });
}

function updateOtherEntities(deltaTime) {
    // Similar updates for other game entities
}

function render() {
    // Rendering logic here
}

requestAnimationFrame(gameLoop);