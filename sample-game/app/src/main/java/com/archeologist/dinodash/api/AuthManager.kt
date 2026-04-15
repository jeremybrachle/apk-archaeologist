package com.archeologist.dinodash.api

class AuthManager(private val api: ApiClient) {

    companion object {
        private const val LOGIN_PATH = "/auth/login"
        private const val REGISTER_PATH = "/auth/register"
        private const val GUEST_PATH = "/auth/guest"
        private const val REFRESH_PATH = "/auth/refresh"
        private const val LOGOUT_PATH = "/auth/logout"
        private const val PROFILE_PATH = "/users/me/profile"
        private const val OAUTH_GOOGLE_PATH = "/auth/oauth/google"
        private const val OAUTH_FACEBOOK_PATH = "/auth/oauth/facebook"
    }

    var isAuthenticated = false
        private set

    fun login(username: String, password: String): Boolean {
        return try {
            val body = """{"username":"$username","password":"$password"}"""
            val response = api.post(LOGIN_PATH, body)
            handleAuthResponse(response)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun register(username: String, email: String, password: String): Boolean {
        return try {
            val body = """{"username":"$username","email":"$email","password":"$password"}"""
            val response = api.post(REGISTER_PATH, body)
            handleAuthResponse(response)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun loginAsGuest(): Boolean {
        return try {
            val deviceId = "android_" + System.currentTimeMillis()
            val body = """{"device_id":"$deviceId","platform":"android"}"""
            val response = api.post(GUEST_PATH, body)
            handleAuthResponse(response)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun loginWithGoogle(idToken: String): Boolean {
        return try {
            val body = """{"id_token":"$idToken","provider":"google"}"""
            val response = api.post(OAUTH_GOOGLE_PATH, body)
            handleAuthResponse(response)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun loginWithFacebook(accessToken: String): Boolean {
        return try {
            val body = """{"access_token":"$accessToken","provider":"facebook"}"""
            val response = api.post(OAUTH_FACEBOOK_PATH, body)
            handleAuthResponse(response)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun logout() {
        try {
            api.post(LOGOUT_PATH, """{"all_devices":false}""")
        } catch (_: Exception) { /* best effort */ }
        isAuthenticated = false
    }

    fun getProfile(): String? {
        return try {
            api.get(PROFILE_PATH)
        } catch (_: Exception) {
            null
        }
    }

    private fun handleAuthResponse(response: String) {
        // parse JWT tokens from response:
        // { "access_token": "eyJhbG...", "refresh_token": "...", "session_id": "..." }
        val accessToken = parseField(response, "access_token")
        val refreshToken = parseField(response, "refresh_token")
        val sessionId = parseField(response, "session_id")

        if (accessToken != null && refreshToken != null) {
            api.setTokens(accessToken, refreshToken)
            isAuthenticated = true
        }
        if (sessionId != null) {
            api.setSessionId(sessionId)
        }
    }

    private fun parseField(json: String, field: String): String? {
        val pattern = Regex(""""$field"\s*:\s*"([^"]+)"""")
        return pattern.find(json)?.groupValues?.get(1)
    }
}
