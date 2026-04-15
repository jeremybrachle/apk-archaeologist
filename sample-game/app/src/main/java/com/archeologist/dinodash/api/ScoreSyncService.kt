package com.archeologist.dinodash.api

import android.app.Service
import android.content.Intent
import android.os.IBinder
import java.util.Timer
import java.util.TimerTask

class ScoreSyncService : Service() {

    private var syncTimer: Timer? = null
    private val pendingScores = mutableListOf<Int>()

    companion object {
        private const val SYNC_INTERVAL_MS = 30_000L
        private const val SYNC_ENDPOINT = "/scores/batch-sync"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.getIntExtra("score", -1)?.let { score ->
            if (score > 0) pendingScores.add(score)
        }

        if (syncTimer == null) {
            syncTimer = Timer().apply {
                scheduleAtFixedRate(object : TimerTask() {
                    override fun run() { syncPendingScores() }
                }, SYNC_INTERVAL_MS, SYNC_INTERVAL_MS)
            }
        }

        return START_STICKY
    }

    private fun syncPendingScores() {
        if (pendingScores.isEmpty()) return
        val batch = pendingScores.toList()
        pendingScores.clear()

        try {
            val scores = batch.joinToString(",")
            val body = """{"scores":[$scores],"device":"android"}"""
            ApiClient.instance.post(SYNC_ENDPOINT, body)
        } catch (_: Exception) {
            pendingScores.addAll(batch)
        }
    }

    override fun onDestroy() {
        syncTimer?.cancel()
        super.onDestroy()
    }
}
