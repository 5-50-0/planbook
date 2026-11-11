package kr.planbook.app

import android.content.Context
import org.json.JSONObject
import java.io.File

// 로그인 정보와 마지막으로 받은 데이터 보관
object Store {
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("pb", Context.MODE_PRIVATE)

    fun setAuth(ctx: Context, refreshToken: String, uid: String) {
        prefs(ctx).edit().putString("rt", refreshToken).putString("uid", uid).apply()
    }

    fun clearAuth(ctx: Context) {
        prefs(ctx).edit().clear().apply()
        File(ctx.filesDir, "data.json").delete()
    }

    fun refreshToken(ctx: Context): String? = prefs(ctx).getString("rt", null)
    fun uid(ctx: Context): String? = prefs(ctx).getString("uid", null)
    fun setRefreshToken(ctx: Context, t: String) { prefs(ctx).edit().putString("rt", t).apply() }

    fun saveData(ctx: Context, data: JSONObject) {
        File(ctx.filesDir, "data.json").writeText(data.toString())
    }

    fun loadData(ctx: Context): JSONObject? {
        val f = File(ctx.filesDir, "data.json")
        if (!f.exists()) return null
        return try { JSONObject(f.readText()) } catch (e: Exception) { null }
    }
}
