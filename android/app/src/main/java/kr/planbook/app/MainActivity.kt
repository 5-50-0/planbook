package kr.planbook.app

import android.annotation.SuppressLint
import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import java.io.File

class MainActivity : AppCompatActivity() {
    companion object { const val BASE = "https://5-50-0.github.io/planbook/" }

    private lateinit var web: WebView
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private val pickFile = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileCb?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        fileCb = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            userAgentString = "$userAgentString PlanbookApp"
        }
        web.addJavascriptInterface(Bridge(), "PlanbookBridge")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url.toString()
                if (u.startsWith(BASE)) return false
                return try { startActivity(Intent(Intent.ACTION_VIEW, req.url)); true } catch (e: Exception) { true }
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null)
                fileCb = cb
                pickFile.launch("*/*")
                return true
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })
        web.loadUrl(urlFor(intent))
        Widgets.schedule(this)
    }

    private fun urlFor(i: Intent?): String {
        val d = i?.getStringExtra("date")
        val v = i?.getStringExtra("view")
        val q = ArrayList<String>()
        if (!d.isNullOrEmpty()) q.add("d=$d")
        if (!v.isNullOrEmpty()) q.add("v=$v")
        return if (q.isEmpty()) BASE else BASE + "?" + q.joinToString("&")
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val d = intent.getStringExtra("date") ?: ""
        val v = intent.getStringExtra("view") ?: ""
        web.evaluateJavascript("window.__pbOpen && window.__pbOpen('$d','$v')", null)
    }

    override fun onResume() {
        super.onResume()
        Widgets.syncNow(this)
    }

    override fun onPause() {
        super.onPause()
        Widgets.syncNow(this)
    }

    inner class Bridge {
        @JavascriptInterface
        fun setAuth(refreshToken: String, uid: String) {
            Store.setAuth(this@MainActivity, refreshToken, uid)
            Widgets.syncNow(this@MainActivity)
        }

        @JavascriptInterface
        fun clearAuth() {
            Store.clearAuth(this@MainActivity)
            Widgets.renderAll(this@MainActivity)
        }

        @JavascriptInterface
        fun refresh() { Widgets.syncNow(this@MainActivity) }

        @JavascriptInterface
        fun saveFile(base64: String, name: String, mime: String) {
            val ok = try {
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                if (Build.VERSION.SDK_INT >= 29) {
                    val cv = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, name)
                        put(MediaStore.Downloads.MIME_TYPE, mime)
                        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    }
                    val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv)
                    uri != null && contentResolver.openOutputStream(uri)?.use { it.write(bytes); true } == true
                } else {
                    val dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                    File(dir, name).writeBytes(bytes); true
                }
            } catch (e: Exception) { false }
            runOnUiThread {
                Toast.makeText(this@MainActivity, if (ok) "다운로드 폴더에 저장했어요" else "저장하지 못했어요", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
