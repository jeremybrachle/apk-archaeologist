package com.archeologist.dinodash.api

import com.archeologist.dinodash.models.Score

class LeaderboardService(private val api: ApiClient) {

    companion object {
        private const val LEADERBOARD_GLOBAL = "/leaderboard/global"
        private const val LEADERBOARD_FRIENDS = "/leaderboard/friends"
        private const val SCORES_SUBMIT = "/scores/submit"
        private const val SCORES_HISTORY = "/scores/history"
        private const val CONFIG_GAME = "/config/game"
        private const val EVENTS_CURRENT = "/events/current"
        private const val SHOP_ITEMS = "/shop/items"
        private const val SHOP_PURCHASE = "/shop/purchase"
        private const val INVENTORY_PATH = "/inventory"
        private const val REWARDS_DAILY = "/rewards/daily"
        private const val REWARDS_CLAIM = "/rewards/claim"
        private const val FRIENDS_LIST = "/friends"
        private const val FRIENDS_ADD = "/friends/add"
        private const val NOTIFICATIONS = "/notifications"
    }

    fun submitScore(score: Score): Boolean {
        return try {
            val body = """{"player_id":"${score.playerId}","value":${score.value},"timestamp":${score.timestamp}}"""
            api.post(SCORES_SUBMIT, body)
            api.trackEvent("score_submitted", mapOf("value" to score.value.toString()))
            true
        } catch (_: Exception) {
            false
        }
    }

    fun getGlobalLeaderboard(limit: Int = 100, offset: Int = 0): String? {
        return try {
            api.get("$LEADERBOARD_GLOBAL?limit=$limit&offset=$offset")
        } catch (_: Exception) {
            null
        }
    }

    fun getFriendsLeaderboard(): String? {
        return try {
            api.get(LEADERBOARD_FRIENDS)
        } catch (_: Exception) {
            null
        }
    }

    fun getScoreHistory(): String? {
        return try {
            api.get(SCORES_HISTORY)
        } catch (_: Exception) {
            null
        }
    }

    fun getGameConfig(): String? {
        return try {
            api.get(CONFIG_GAME)
        } catch (_: Exception) {
            null
        }
    }

    fun getCurrentEvents(): String? {
        return try {
            api.get(EVENTS_CURRENT)
        } catch (_: Exception) {
            null
        }
    }

    fun getShopItems(): String? {
        return try {
            api.get(SHOP_ITEMS)
        } catch (_: Exception) {
            null
        }
    }

    fun purchaseItem(itemId: String, currency: String = "coins"): Boolean {
        return try {
            val body = """{"item_id":"$itemId","currency":"$currency"}"""
            api.post(SHOP_PURCHASE, body)
            api.trackEvent("purchase", mapOf("item" to itemId, "currency" to currency))
            true
        } catch (_: Exception) {
            false
        }
    }

    fun getInventory(): String? {
        return try {
            api.get(INVENTORY_PATH)
        } catch (_: Exception) {
            null
        }
    }

    fun claimDailyReward(): Boolean {
        return try {
            api.post(REWARDS_CLAIM, """{"type":"daily"}""")
            true
        } catch (_: Exception) {
            false
        }
    }

    fun getFriends(): String? {
        return try {
            api.get(FRIENDS_LIST)
        } catch (_: Exception) {
            null
        }
    }

    fun addFriend(friendId: String): Boolean {
        return try {
            api.post(FRIENDS_ADD, """{"friend_id":"$friendId"}""")
            true
        } catch (_: Exception) {
            false
        }
    }

    fun getNotifications(): String? {
        return try {
            api.get(NOTIFICATIONS)
        } catch (_: Exception) {
            null
        }
    }
}
