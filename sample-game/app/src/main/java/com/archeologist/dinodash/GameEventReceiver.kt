package com.archeologist.dinodash

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class GameEventReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_GAME_EVENT = "com.archeologist.dinodash.GAME_EVENT"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val eventType = intent.getStringExtra("event_type") ?: return
        when (eventType) {
            "high_score" -> {
                val score = intent.getIntExtra("score", 0)
                android.util.Log.d("DinoDash", "New high score: $score")
            }
            "achievement" -> {
                val name = intent.getStringExtra("achievement_name") ?: "unknown"
                android.util.Log.d("DinoDash", "Achievement unlocked: $name")
            }
        }
    }
}
