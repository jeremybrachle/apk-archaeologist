package com.archeologist.dinodash.api

import android.content.Context
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class ApiClient private constructor(private val context: Context) {

    companion object {
        private const val BASE_URL = "https://api.dinodash.archeologist.dev/v2"
        private const val CDN_URL = "https://cdn.dinodash.archeologist.dev/assets/v1"
        private const val ANALYTICS_URL = "https://analytics.dinodash.archeologist.dev/v1"
        private const val REALTIME_URL = "wss://realtime.dinodash.archeologist.dev/v1/multiplayer"
        private const val API_KEY = "dk_live_2xK9mP4vR7nQ8sW3jL6hY5tB"

        lateinit var instance: ApiClient
            private set

        fun initialize(context: Context) {
            instance = ApiClient(context.applicationContext)
        }
    }

    private var accessToken: String? = null
    private var refreshToken: String? = null
    private var sessionId: String? = null

    fun setTokens(access: String, refresh: String) {
        this.accessToken = access
        this.refreshToken = refresh
    }

    fun setSessionId(id: String) {
        this.sessionId = id
    }

    fun get(path: String): String {
        return request("GET", path, null)
    }

    fun post(path: String, body: String): String {
        return request("POST", path, body)
    }

    fun put(path: String, body: String): String {
        return request("PUT", path, body)
    }

    fun delete(path: String): String {
        return request("DELETE", path, null)
    }

    private fun request(method: String, path: String, body: String?): String {
        val url = URL("$BASE_URL$path")
        val conn = url.openConnection() as HttpURLConnection

        conn.requestMethod = method
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Accept", "application/json")
        conn.setRequestProperty("X-API-Key", API_KEY)
        conn.setRequestProperty("X-Client-Version", "1.0.0")
        conn.setRequestProperty("X-Platform", "android")

        // JWT Bearer token auth
        accessToken?.let {
            conn.setRequestProperty("Authorization", "Bearer $it")
        }

        // Session tracking
        sessionId?.let {
            conn.setRequestProperty("X-Session-Id", it)
        }

        conn.connectTimeout = 10_000
        conn.readTimeout = 10_000

        if (body != null) {
            conn.doOutput = true
            OutputStreamWriter(conn.outputStream).use { it.write(body) }
        }

        val responseCode = conn.responseCode
        if (responseCode == 401) {
            attemptTokenRefresh()
            return request(method, path, body)
        }

        val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
        return BufferedReader(InputStreamReader(stream)).use { it.readText() }
    }

    private fun attemptTokenRefresh() {
        val refresh = refreshToken ?: throw RuntimeException("No refresh token available")
        val url = URL("$BASE_URL/auth/refresh")
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("X-API-Key", API_KEY)
        conn.doOutput = true

        val body = """{"refresh_token": "$refresh"}"""
        OutputStreamWriter(conn.outputStream).use { it.write(body) }

        if (conn.responseCode == 200) {
            val response = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
            // parse new tokens from response
            val newAccess = parseJsonField(response, "access_token")
            val newRefresh = parseJsonField(response, "refresh_token")
            if (newAccess != null) accessToken = newAccess
            if (newRefresh != null) refreshToken = newRefresh
        }
    }

    fun getAssetUrl(assetPath: String): String {
        return "$CDN_URL/$assetPath"
    }

    fun getRealtimeUrl(): String {
        return "$REALTIME_URL?token=$accessToken"
    }

    fun trackEvent(eventName: String, data: Map<String, String>) {
        Thread {
            try {
                val url = URL("$ANALYTICS_URL/events")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("X-API-Key", API_KEY)
                conn.doOutput = true

                val pairs = data.entries.joinToString(",") { "\"${it.key}\":\"${it.value}\"" }
                val body = """{"event":"$eventName","data":{$pairs},"ts":${System.currentTimeMillis()}}"""
                OutputStreamWriter(conn.outputStream).use { it.write(body) }
                conn.responseCode // trigger send
            } catch (_: Exception) { /* analytics failures are silent */ }
        }.start()
    }

    private fun parseJsonField(json: String, field: String): String? {
        val pattern = Regex(""""$field"\s*:\s*"([^"]+)"""")
        return pattern.find(json)?.groupValues?.get(1)
    }
}
