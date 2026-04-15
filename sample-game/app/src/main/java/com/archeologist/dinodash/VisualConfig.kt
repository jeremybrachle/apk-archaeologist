package com.archeologist.dinodash

/**
 * Visual configuration helpers. Extracted for reuse across rendering pipeline.
 *
 * NOTE: After ProGuard, this file gets heavily obfuscated.
 * The decompiler recovers these as single-letter classes/methods.
 * The AI reconstructor must infer what they originally did.
 */

// ─── These names survive ProGuard (public API) ───

object VisualConfig {
    const val DINO_BODY_CORNER_RADIUS = 8f
    const val DINO_EYE_RADIUS = 6f
    const val DINO_PUPIL_RADIUS = 3f
    const val DINO_LEG_STROKE = 6f

    // The dino's "face" — eye is positioned relative to top-right corner
    const val EYE_OFFSET_X = -12f   // from right edge
    const val EYE_OFFSET_Y = 14f    // from top edge
    const val PUPIL_SHIFT_X = 2f    // pupil offset from eye center (looking right)
}

// ─── These get OBFUSCATED by ProGuard into unreadable names ───
// ─── The decompiler sees: class a { fun a(p0: Float): Float }  ───
// ─── The AI must guess what these do from context clues        ───

/**
 * Controls the dino's squash-and-stretch during jumps.
 * Without this, the dino is a rigid rectangle. With it,
 * the body compresses on landing and stretches at peak.
 *
 * After ProGuard: class `a`
 */
object DinoAnimator {
    /**
     * Returns a width multiplier for squash-and-stretch.
     * velocityY near 0 (peak) → stretch tall & narrow.
     * velocityY large (falling) → squash wide & short.
     *
     * After ProGuard: fun a(p0: Float, p1: Float): Float
     */
    fun computeSquashX(velocityY: Float, maxVelocity: Float): Float {
        val t = (velocityY / maxVelocity).coerceIn(-1f, 1f)
        return 1f + t * 0.15f   // ±15% width change
    }

    /**
     * Returns a height multiplier (inverse of squash).
     * After ProGuard: fun b(p0: Float, p1: Float): Float
     */
    fun computeSquashY(velocityY: Float, maxVelocity: Float): Float {
        val t = (velocityY / maxVelocity).coerceIn(-1f, 1f)
        return 1f - t * 0.12f   // ±12% height change (inverse)
    }
}

/**
 * Generates the tail shape as a series of points.
 * The tail curves based on horizontal speed, giving
 * a wind-blown effect at high speeds.
 *
 * After ProGuard: class `b`
 */
object TailRenderer {
    /**
     * Returns tail endpoint offset from dino's back edge.
     * Higher speed → more swept-back tail.
     *
     * After ProGuard: fun a(p0: Float, p1: Float): Pair<Float, Float>
     */
    fun computeTailCurve(gameSpeed: Float, maxSpeed: Float): Pair<Float, Float> {
        val sweep = (gameSpeed / maxSpeed).coerceIn(0f, 1f)
        val dx = -12f - sweep * 10f    // tail extends further back at speed
        val dy = -5f + sweep * 8f      // tail lifts then drops
        return Pair(dx, dy)
    }
}

/**
 * Computes parallax offsets for background layers.
 * Creates depth by scrolling clouds slower than ground.
 *
 * After ProGuard: class `c`
 */
object ParallaxHelper {
    /**
     * After ProGuard: fun a(p0: Float, p1: Int): Float
     */
    fun layerSpeed(baseSpeed: Float, depth: Int): Float {
        // depth 0 = ground (1.0x), depth 1 = near clouds (0.4x), depth 2 = far clouds (0.15x)
        val multipliers = floatArrayOf(1.0f, 0.4f, 0.15f)
        val idx = depth.coerceIn(0, multipliers.size - 1)
        return baseSpeed * multipliers[idx]
    }
}

/**
 * Procedural ground decoration. Generates small rocks and divots
 * in the ground plane based on scroll position.
 *
 * After ProGuard: class `d`
 */
object GroundDecorator {
    /**
     * Returns whether a decorative rock should appear at this x position.
     * Uses a simple hash to create pseudo-random but deterministic pattern.
     *
     * After ProGuard: fun a(p0: Float): Boolean
     */
    fun hasRockAt(scrollX: Float): Boolean {
        val hash = ((scrollX * 7.3f).toInt() xor 0x5F3759DF)
        return (hash % 7) == 0
    }

    /**
     * Returns rock height (1-4 pixels) for visual variety.
     * After ProGuard: fun b(p0: Float): Float
     */
    fun rockHeight(scrollX: Float): Float {
        val hash = ((scrollX * 13.7f).toInt() xor 0xDEADBEEF.toInt())
        return 1f + (hash % 4).coerceIn(0, 3).toFloat()
    }
}

/**
 * Score display formatting with animated digit roll.
 * Each digit rolls independently when incrementing.
 *
 * After ProGuard: class `e`
 */
object ScoreAnimator {
    /**
     * Returns a y-offset for a score digit during its roll animation.
     * After ProGuard: fun a(p0: Int, p1: Float): Float
     */
    fun digitRollOffset(previousDigit: Int, progress: Float): Float {
        // smooth ease-out roll
        val t = 1f - (1f - progress) * (1f - progress)
        return (1f - t) * 20f
    }
}
