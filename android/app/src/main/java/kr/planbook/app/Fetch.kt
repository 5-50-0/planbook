package kr.planbook.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

// Firebase에서 위젯용 데이터 가져오기
object Fetch {
    private const val API_KEY = "AIzaSyAe0T0jxos_qQUg0qoXPKikukUhmd0Uj9E"
    private const val PROJECT = "planbook-794e6"

    private fun http(method: String, url: String, body: String? = null, auth: String? = null, form: Boolean = false): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.connectTimeout = 15000
        c.readTimeout = 20000
        if (auth != null) c.setRequestProperty("Authorization", "Bearer $auth")
        if (body != null) {
            c.doOutput = true
            c.setRequestProperty("Content-Type", if (form) "application/x-www-form-urlencoded" else "application/json")
            c.outputStream.use { it.write(body.toByteArray()) }
        }
        val code = c.responseCode
        val text = (if (code in 200..299) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        if (code !in 200..299) throw RuntimeException("HTTP $code $text")
        return text
    }

    private fun idToken(ctx: Context): String? {
        val rt = Store.refreshToken(ctx) ?: return null
        val res = JSONObject(http("POST", "https://securetoken.googleapis.com/v1/token?key=$API_KEY",
            "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(rt, "UTF-8"), form = true))
        val newRt = res.optString("refresh_token", "")
        if (newRt.isNotEmpty() && newRt != rt) Store.setRefreshToken(ctx, newRt)
        return res.getString("id_token")
    }

    // Firestore 값 → 일반 JSON 값
    private fun value(v: JSONObject): Any? {
        return when {
            v.has("stringValue") -> v.getString("stringValue")
            v.has("integerValue") -> v.getString("integerValue").toLongOrNull() ?: 0L
            v.has("doubleValue") -> v.getDouble("doubleValue")
            v.has("booleanValue") -> v.getBoolean("booleanValue")
            v.has("timestampValue") -> v.getString("timestampValue")
            v.has("nullValue") -> JSONObject.NULL
            v.has("mapValue") -> fields(v.getJSONObject("mapValue").optJSONObject("fields"))
            v.has("arrayValue") -> {
                val arr = JSONArray()
                val vs = v.getJSONObject("arrayValue").optJSONArray("values")
                if (vs != null) for (i in 0 until vs.length()) arr.put(value(vs.getJSONObject(i)))
                arr
            }
            else -> JSONObject.NULL
        }
    }

    private fun fields(f: JSONObject?): JSONObject {
        val o = JSONObject()
        if (f == null) return o
        val keys = f.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            o.put(k, value(f.getJSONObject(k)))
        }
        return o
    }

    private fun base(uid: String) = "https://firestore.googleapis.com/v1/projects/$PROJECT/databases/(default)/documents/users/$uid"

    private fun listCol(uid: String, name: String, tok: String): JSONArray {
        val out = JSONArray()
        var page: String? = null
        do {
            val url = base(uid) + "/$name?pageSize=300" + (if (page != null) "&pageToken=" + URLEncoder.encode(page, "UTF-8") else "")
            val res = JSONObject(http("GET", url, auth = tok))
            val docs = res.optJSONArray("documents")
            if (docs != null) for (i in 0 until docs.length()) {
                val d = docs.getJSONObject(i)
                val o = fields(d.optJSONObject("fields"))
                o.put("id", d.getString("name").substringAfterLast('/'))
                out.put(o)
            }
            page = res.optString("nextPageToken", "").ifEmpty { null }
        } while (page != null)
        return out
    }

    // 성공하면 true
    fun fetchAll(ctx: Context): Boolean {
        val uid = Store.uid(ctx) ?: return false
        val tok = idToken(ctx) ?: return false
        val items = listCol(uid, "items", tok)
        val routines = listCol(uid, "routines", tok)
        val settings = try {
            val d = JSONObject(http("GET", base(uid) + "/meta/settings", auth = tok))
            fields(d.optJSONObject("fields"))
        } catch (e: Exception) { JSONObject() }
        val data = JSONObject()
        data.put("items", items)
        data.put("routines", routines)
        data.put("settings", settings)
        data.put("at", System.currentTimeMillis())
        Store.saveData(ctx, data)
        return true
    }
}
