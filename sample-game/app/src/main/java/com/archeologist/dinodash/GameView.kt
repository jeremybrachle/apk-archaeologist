package com.archeologist.dinodash

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.MotionEvent
import android.view.SurfaceHolder
import android.view.SurfaceView
import com.archeologist.dinodash.api.ApiClient
import com.archeologist.dinodash.api.LeaderboardService
import com.archeologist.dinodash.models.Score

class GameView(context: Context) : SurfaceView(context), SurfaceHolder.Callback, Runnable {

    private var gameThread: Thread? = null
    private var running = false
    private val engine = GameEngine()
    private val leaderboard = LeaderboardService(ApiClient.instance)

    // paints
    private val bgPaint = Paint().apply { color = Color.parseColor("#F7F1E3") }
    private val groundPaint = Paint().apply { color = Color.parseColor("#6D5D4B") }
    private val dinoPaint = Paint().apply { color = Color.parseColor("#2D8B46") }
    private val cactusPaint = Paint().apply { color = Color.parseColor("#3B7A3B") }
    private val birdPaint = Paint().apply { color = Color.parseColor("#8B4513") }
    private val scorePaint = Paint().apply {
        color = Color.parseColor("#333333")
        textSize = 48f
        isAntiAlias = true
        isFakeBoldText = true
    }
    private val gameOverPaint = Paint().apply {
        color = Color.parseColor("#CC0000")
        textSize = 72f
        isAntiAlias = true
        isFakeBoldText = true
        textAlign = Paint.Align.CENTER
    }
    private val subtitlePaint = Paint().apply {
        color = Color.parseColor("#666666")
        textSize = 36f
        isAntiAlias = true
        textAlign = Paint.Align.CENTER
    }

    init {
        holder.addCallback(this)
        isFocusable = true
    }

    override fun surfaceCreated(holder: SurfaceHolder) {
        engine.init(width.toFloat(), height.toFloat())
        resume()
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, w: Int, h: Int) {
        engine.init(w.toFloat(), h.toFloat())
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        pause()
    }

    override fun run() {
        var lastTime = System.nanoTime()
        while (running) {
            val now = System.nanoTime()
            val dt = (now - lastTime) / 1_000_000_000f
            lastTime = now

            engine.update(dt)
            drawFrame()

            // cap at ~60fps
            val elapsed = (System.nanoTime() - now) / 1_000_000
            if (elapsed < 16) {
                try { Thread.sleep(16 - elapsed) } catch (_: InterruptedException) {}
            }
        }
    }

    private fun drawFrame() {
        val canvas: Canvas
        try {
            canvas = holder.lockCanvas() ?: return
        } catch (_: Exception) { return }

        try {
            drawGame(canvas)
        } finally {
            holder.unlockCanvasAndPost(canvas)
        }
    }

    private fun drawGame(canvas: Canvas) {
        val state = engine.state
        val w = canvas.width.toFloat()
        val h = canvas.height.toFloat()

        // background
        canvas.drawRect(0f, 0f, w, h, bgPaint)

        // ground
        val groundY = state.groundY
        canvas.drawRect(0f, groundY, w, h, groundPaint)

        // ground texture lines
        val linePaint = Paint().apply { color = Color.parseColor("#5C4E3C"); strokeWidth = 2f }
        var lx = (state.scrollOffset % 40f)
        while (lx < w) {
            canvas.drawLine(lx, groundY + 4f, lx + 15f, groundY + 4f, linePaint)
            lx += 40f
        }

        // dino (with squash-and-stretch animation)
        val dino = state.dino
        val squashX = DinoAnimator.computeSquashX(dino.velocityY, -GameState.JUMP_VELOCITY)
        val squashY = DinoAnimator.computeSquashY(dino.velocityY, -GameState.JUMP_VELOCITY)
        val drawW = dino.width * squashX
        val drawH = dino.height * squashY
        val drawX = dino.x + (dino.width - drawW) / 2f
        val drawY = dino.y + (dino.height - drawH)  // anchor to feet
        val dinoRect = RectF(drawX, drawY, drawX + drawW, drawY + drawH)
        canvas.drawRoundRect(dinoRect, VisualConfig.DINO_BODY_CORNER_RADIUS, VisualConfig.DINO_BODY_CORNER_RADIUS, dinoPaint)

        // dino tail (curves with speed)
        val tailPaint = Paint().apply { color = Color.parseColor("#24753A"); strokeWidth = 5f; strokeCap = Paint.Cap.ROUND }
        val (tailDx, tailDy) = TailRenderer.computeTailCurve(state.gameSpeed, GameState.MAX_SPEED)
        canvas.drawLine(drawX, drawY + drawH * 0.4f, drawX + tailDx, drawY + drawH * 0.4f + tailDy, tailPaint)

        // dino eye
        val eyePaint = Paint().apply { color = Color.WHITE }
        canvas.drawCircle(drawX + drawW + VisualConfig.EYE_OFFSET_X, drawY + VisualConfig.EYE_OFFSET_Y, VisualConfig.DINO_EYE_RADIUS, eyePaint)
        val pupilPaint = Paint().apply { color = Color.BLACK }
        canvas.drawCircle(drawX + drawW + VisualConfig.EYE_OFFSET_X + VisualConfig.PUPIL_SHIFT_X, drawY + VisualConfig.EYE_OFFSET_Y, VisualConfig.DINO_PUPIL_RADIUS, pupilPaint)

        // dino legs (simple lines)
        val legPaint = Paint().apply { color = Color.parseColor("#1E6B30"); strokeWidth = VisualConfig.DINO_LEG_STROKE }
        val legCycle = ((state.scrollOffset / 15f) % 2).toInt()
        val legTop = drawY + drawH
        if (state.dino.isOnGround) {
            if (legCycle == 0) {
                canvas.drawLine(drawX + 10f, legTop, drawX + 6f, legTop + 16f, legPaint)
                canvas.drawLine(drawX + drawW - 20f, legTop, drawX + drawW - 16f, legTop + 16f, legPaint)
            } else {
                canvas.drawLine(drawX + 10f, legTop, drawX + 14f, legTop + 16f, legPaint)
                canvas.drawLine(drawX + drawW - 20f, legTop, drawX + drawW - 24f, legTop + 16f, legPaint)
            }
        } else {
            canvas.drawLine(drawX + 10f, legTop, drawX + 8f, legTop + 12f, legPaint)
            canvas.drawLine(drawX + drawW - 20f, legTop, drawX + drawW - 18f, legTop + 12f, legPaint)
        }

        // ground decorations (procedural rocks)
        val rockPaint = Paint().apply { color = Color.parseColor("#5C4E3C") }
        var rx = (state.scrollOffset % 60f)
        while (rx < w) {
            val worldX = rx + state.scrollOffset
            if (GroundDecorator.hasRockAt(worldX)) {
                val rh = GroundDecorator.rockHeight(worldX)
                canvas.drawCircle(rx, groundY + 8f + rh, rh, rockPaint)
            }
            rx += 20f
        }

        // obstacles
        for (obstacle in state.obstacles) {
            val paint = if (obstacle.type == ObstacleType.BIRD) birdPaint else cactusPaint
            val rect = RectF(obstacle.x, obstacle.y, obstacle.x + obstacle.width, obstacle.y + obstacle.height)
            if (obstacle.type == ObstacleType.CACTUS) {
                canvas.drawRoundRect(rect, 4f, 4f, paint)
                // cactus arms
                canvas.drawRect(obstacle.x - 8f, obstacle.y + 10f, obstacle.x + 4f, obstacle.y + 25f, paint)
                canvas.drawRect(obstacle.x + obstacle.width - 4f, obstacle.y + 15f, obstacle.x + obstacle.width + 8f, obstacle.y + 30f, paint)
            } else {
                canvas.drawRoundRect(rect, 6f, 6f, paint)
                // bird wing
                val wingOffset = if (((state.scrollOffset / 10f) % 2).toInt() == 0) -10f else 10f
                canvas.drawLine(obstacle.x + obstacle.width / 2, obstacle.y,
                    obstacle.x + obstacle.width / 2, obstacle.y + wingOffset, paint)
            }
        }

        // clouds (with parallax depth)
        val cloudPaint = Paint().apply { color = Color.parseColor("#DDDDDD") }
        val farCloudPaint = Paint().apply { color = Color.parseColor("#EEEEEE") }
        for ((i, cloud) in state.clouds.withIndex()) {
            val depth = if (cloud.y < state.groundY * 0.25f) 2 else 1
            val paint = if (depth == 2) farCloudPaint else cloudPaint
            canvas.drawRoundRect(
                RectF(cloud.x, cloud.y, cloud.x + cloud.width, cloud.y + cloud.height),
                20f, 20f, paint
            )
        }

        // score
        canvas.drawText("Score: ${state.score}", 20f, 50f, scorePaint)
        canvas.drawText("High: ${state.highScore}", 20f, 100f, scorePaint)

        // game over overlay
        if (state.isGameOver) {
            val overlayPaint = Paint().apply { color = Color.argb(120, 0, 0, 0) }
            canvas.drawRect(0f, 0f, w, h, overlayPaint)
            canvas.drawText("GAME OVER", w / 2, h / 2 - 40f, gameOverPaint)
            canvas.drawText("Score: ${state.score}", w / 2, h / 2 + 20f, subtitlePaint)
            canvas.drawText("Tap to restart", w / 2, h / 2 + 70f, subtitlePaint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_DOWN) {
            if (engine.state.isGameOver) {
                if (engine.state.score > engine.state.highScore) {
                    submitScore(engine.state.score)
                }
                engine.restart()
            } else {
                engine.jump()
            }
            return true
        }
        return super.onTouchEvent(event)
    }

    private fun submitScore(score: Int) {
        Thread {
            try {
                leaderboard.submitScore(Score(
                    playerId = "guest",
                    value = score,
                    timestamp = System.currentTimeMillis()
                ))
            } catch (_: Exception) { /* offline is fine */ }
        }.start()
    }

    fun resume() {
        running = true
        gameThread = Thread(this).also { it.start() }
    }

    fun pause() {
        running = false
        try { gameThread?.join() } catch (_: InterruptedException) {}
    }

    fun shutdown() {
        pause()
    }
}
