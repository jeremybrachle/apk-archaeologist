package com.archeologist.dinodash

import android.app.Activity
import android.os.Bundle
import android.view.Window
import android.view.WindowManager
import com.archeologist.dinodash.api.ApiClient
import com.archeologist.dinodash.api.AuthManager

class MainActivity : Activity() {

    private lateinit var gameView: GameView
    private lateinit var authManager: AuthManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestWindowFeature(Window.FEATURE_NO_TITLE)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        ApiClient.initialize(applicationContext)
        authManager = AuthManager(ApiClient.instance)
        authManager.loginAsGuest()

        gameView = GameView(this)
        setContentView(gameView)
    }

    override fun onPause() {
        super.onPause()
        gameView.pause()
    }

    override fun onResume() {
        super.onResume()
        gameView.resume()
    }

    override fun onDestroy() {
        super.onDestroy()
        gameView.shutdown()
    }
}
