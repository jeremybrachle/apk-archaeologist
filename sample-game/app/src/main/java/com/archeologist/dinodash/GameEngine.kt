package com.archeologist.dinodash

import kotlin.math.max
import kotlin.random.Random

enum class ObstacleType { CACTUS, BIRD }

data class Dino(
    var x: Float = 100f,
    var y: Float = 0f,
    var width: Float = 50f,
    var height: Float = 60f,
    var velocityY: Float = 0f,
    var isOnGround: Boolean = true
)

data class Obstacle(
    var x: Float,
    var y: Float,
    var width: Float,
    var height: Float,
    val type: ObstacleType
)

data class Cloud(
    var x: Float,
    var y: Float,
    var width: Float = 80f,
    var height: Float = 30f,
    var speed: Float = 30f
)

data class GameState(
    val dino: Dino = Dino(),
    val obstacles: MutableList<Obstacle> = mutableListOf(),
    val clouds: MutableList<Cloud> = mutableListOf(),
    var score: Int = 0,
    var highScore: Int = 0,
    var isGameOver: Boolean = false,
    var groundY: Float = 0f,
    var scrollOffset: Float = 0f,
    var gameSpeed: Float = START_SPEED,
    var spawnTimer: Float = 0f,
    var cloudTimer: Float = 0f,
    var scoreTimer: Float = 0f
) {
    companion object {
        const val START_SPEED = 300f
        const val MAX_SPEED = 800f
        const val SPEED_INCREMENT = 8f
        const val GRAVITY = 2200f
        const val JUMP_VELOCITY = -850f
        const val MIN_SPAWN_INTERVAL = 0.8f
        const val MAX_SPAWN_INTERVAL = 2.2f
    }
}

class GameEngine {

    var state = GameState()
        private set

    private var screenWidth = 0f
    private var screenHeight = 0f

    fun init(width: Float, height: Float) {
        screenWidth = width
        screenHeight = height
        state.groundY = height * 0.75f
        state.dino.y = state.groundY - state.dino.height
        state.dino.x = width * 0.1f
    }

    fun update(dt: Float) {
        if (state.isGameOver) return

        updateDino(dt)
        updateObstacles(dt)
        updateClouds(dt)
        updateScore(dt)
        checkCollisions()

        state.scrollOffset += state.gameSpeed * dt
    }

    private fun updateDino(dt: Float) {
        val dino = state.dino
        if (!dino.isOnGround) {
            dino.velocityY += GameState.GRAVITY * dt
            dino.y += dino.velocityY * dt

            val groundLevel = state.groundY - dino.height
            if (dino.y >= groundLevel) {
                dino.y = groundLevel
                dino.velocityY = 0f
                dino.isOnGround = true
            }
        }
    }

    private fun updateObstacles(dt: Float) {
        // move existing
        val iterator = state.obstacles.iterator()
        while (iterator.hasNext()) {
            val obs = iterator.next()
            obs.x -= state.gameSpeed * dt
            if (obs.x + obs.width < -50f) {
                iterator.remove()
            }
        }

        // spawn new
        state.spawnTimer -= dt
        if (state.spawnTimer <= 0f) {
            spawnObstacle()
            state.spawnTimer = GameState.MIN_SPAWN_INTERVAL +
                Random.nextFloat() * (GameState.MAX_SPAWN_INTERVAL - GameState.MIN_SPAWN_INTERVAL)
        }
    }

    private fun spawnObstacle() {
        val type = if (state.score > 50 && Random.nextFloat() > 0.7f) {
            ObstacleType.BIRD
        } else {
            ObstacleType.CACTUS
        }

        val obstacle = when (type) {
            ObstacleType.CACTUS -> {
                val h = 40f + Random.nextFloat() * 30f
                Obstacle(
                    x = screenWidth + 20f,
                    y = state.groundY - h,
                    width = 25f + Random.nextFloat() * 15f,
                    height = h,
                    type = type
                )
            }
            ObstacleType.BIRD -> {
                val flyHeight = state.groundY - 80f - Random.nextFloat() * 60f
                Obstacle(
                    x = screenWidth + 20f,
                    y = flyHeight,
                    width = 40f,
                    height = 25f,
                    type = type
                )
            }
        }
        state.obstacles.add(obstacle)
    }

    private fun updateClouds(dt: Float) {
        state.clouds.removeAll { it.x + it.width < 0f }

        state.cloudTimer -= dt
        if (state.cloudTimer <= 0f) {
            state.clouds.add(Cloud(
                x = screenWidth + 10f,
                y = 30f + Random.nextFloat() * (state.groundY * 0.4f),
                speed = 20f + Random.nextFloat() * 40f
            ))
            state.cloudTimer = 2f + Random.nextFloat() * 4f
        }

        for (cloud in state.clouds) {
            cloud.x -= cloud.speed * dt
        }
    }

    private fun updateScore(dt: Float) {
        state.scoreTimer += dt
        if (state.scoreTimer >= 0.1f) {
            state.score++
            state.scoreTimer -= 0.1f
            // increase speed every 100 points
            if (state.score % 100 == 0) {
                state.gameSpeed = (state.gameSpeed + GameState.SPEED_INCREMENT * 10)
                    .coerceAtMost(GameState.MAX_SPEED)
            }
        }
    }

    private fun checkCollisions() {
        val dino = state.dino
        val dinoRect = RectBounds(dino.x + 5f, dino.y + 5f,
            dino.x + dino.width - 5f, dino.y + dino.height - 5f)

        for (obs in state.obstacles) {
            val obsRect = RectBounds(obs.x + 3f, obs.y + 3f,
                obs.x + obs.width - 3f, obs.y + obs.height - 3f)
            if (dinoRect.intersects(obsRect)) {
                state.isGameOver = true
                state.highScore = max(state.highScore, state.score)
                return
            }
        }
    }

    fun jump() {
        if (state.dino.isOnGround && !state.isGameOver) {
            state.dino.velocityY = GameState.JUMP_VELOCITY
            state.dino.isOnGround = false
        }
    }

    fun restart() {
        val highScore = state.highScore
        state = GameState()
        state.highScore = highScore
        init(screenWidth, screenHeight)
    }
}

private data class RectBounds(val left: Float, val top: Float, val right: Float, val bottom: Float) {
    fun intersects(other: RectBounds): Boolean {
        return left < other.right && right > other.left &&
               top < other.bottom && bottom > other.top
    }
}
