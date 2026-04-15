package com.archeologist.dinodash.models

data class Player(
    val id: String,
    val username: String,
    val displayName: String,
    val avatarUrl: String = "",
    val guestSession: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

data class Score(
    val playerId: String,
    val value: Int,
    val timestamp: Long,
    val verified: Boolean = false
)

data class LeaderboardEntry(
    val rank: Int,
    val player: Player,
    val score: Score
)

data class GameConfig(
    val startSpeed: Float = 300f,
    val maxSpeed: Float = 800f,
    val gravity: Float = 2200f,
    val jumpVelocity: Float = -850f,
    val scoreMultiplier: Float = 1.0f,
    val eventBannerUrl: String = ""
)

data class ShopItem(
    val id: String,
    val name: String,
    val description: String,
    val price: Int,
    val currency: String = "coins",
    val iconUrl: String = ""
)

data class InventoryItem(
    val itemId: String,
    val quantity: Int,
    val equipped: Boolean = false
)
