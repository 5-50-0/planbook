package kr.planbook.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import android.content.BroadcastReceiver
import android.widget.Toast
import java.util.concurrent.TimeUnit

object Widgets {
    private fun openIntent(ctx: Context, date: String?, view: String, code: Int): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).apply {
            action = "kr.planbook.OPEN_$code"
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("date", date); putExtra("view", view)
        }
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun syncIntent(ctx: Context): PendingIntent {
        val i = Intent(ctx, SyncReceiver::class.java).apply { action = "kr.planbook.SYNC" }
        return PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    // 위젯 크기 (px)
    private fun size(ctx: Context, mgr: AppWidgetManager, id: Int, defW: Int, defH: Int): Pair<Int, Int> {
        val o: Bundle = mgr.getAppWidgetOptions(id)
        val dp = ctx.resources.displayMetrics.density
        val portrait = ctx.resources.configuration.orientation != android.content.res.Configuration.ORIENTATION_LANDSCAPE
        var wDp = if (portrait) o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH) else o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH)
        var hDp = if (portrait) o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT) else o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
        if (wDp <= 0) wDp = defW
        if (hDp <= 0) hDp = defH
        val scale = minOf(dp, 1400f / maxOf(wDp, hDp)) // 너무 큰 그림 방지
        return (wDp * scale).toInt().coerceAtLeast(60) to (hDp * scale).toInt().coerceAtLeast(40)
    }

    fun updateMonth(ctx: Context, mgr: AppWidgetManager, id: Int) {
        val (w, h) = size(ctx, mgr, id, 250, 250)
        val dpScale = w / maxOf(1f, (mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).takeIf { it > 0 } ?: 250).toFloat())
        val dp = dpScale.coerceAtLeast(1f)
        val rv = RemoteViews(ctx.packageName, R.layout.widget_month)
        val today = Model.today()
        val hasAuth = Store.uid(ctx) != null
        val m = Model(Store.loadData(ctx))
        val bmp = if (!hasAuth) Render.message(w, h, dp, "플랜북 앱에서 로그인해 주세요")
            else if (!m.hasData) Render.message(w, h, dp, "불러오는 중")
            else Render.month(m, w, h, dp, today)
        rv.setImageViewBitmap(R.id.img, bmp)
        rv.setOnClickPendingIntent(R.id.head, openIntent(ctx, null, "month", 1000 + id % 1000))
        rv.setOnClickPendingIntent(R.id.sync, syncIntent(ctx))
        val grid = Model.monthGrid(today.year, today.monthValue)
        val ids = arrayOf(
            intArrayOf(R.id.c00, R.id.c01, R.id.c02, R.id.c03, R.id.c04, R.id.c05, R.id.c06),
            intArrayOf(R.id.c10, R.id.c11, R.id.c12, R.id.c13, R.id.c14, R.id.c15, R.id.c16),
            intArrayOf(R.id.c20, R.id.c21, R.id.c22, R.id.c23, R.id.c24, R.id.c25, R.id.c26),
            intArrayOf(R.id.c30, R.id.c31, R.id.c32, R.id.c33, R.id.c34, R.id.c35, R.id.c36),
            intArrayOf(R.id.c40, R.id.c41, R.id.c42, R.id.c43, R.id.c44, R.id.c45, R.id.c46),
            intArrayOf(R.id.c50, R.id.c51, R.id.c52, R.id.c53, R.id.c54, R.id.c55, R.id.c56),
        )
        for (r in 0 until 6) for (c in 0 until 7) {
            val d = grid[r][c].toString()
            rv.setOnClickPendingIntent(ids[r][c], openIntent(ctx, d, "week", 2000 + (id % 100) * 100 + r * 7 + c))
        }
        mgr.updateAppWidget(id, rv)
    }

    fun updateToday(ctx: Context, mgr: AppWidgetManager, id: Int) {
        val (w, h) = size(ctx, mgr, id, 250, 110)
        val minW = mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).takeIf { it > 0 } ?: 250
        val dp = (w / minW.toFloat()).coerceAtLeast(1f)
        val rv = RemoteViews(ctx.packageName, R.layout.widget_today)
        val today = Model.today()
        val hasAuth = Store.uid(ctx) != null
        val m = Model(Store.loadData(ctx))
        val bmp = if (!hasAuth) Render.message(w, h, dp, "플랜북 앱에서 로그인해 주세요")
            else if (!m.hasData) Render.message(w, h, dp, "불러오는 중")
            else Render.today(m, w, h, dp, today)
        rv.setImageViewBitmap(R.id.img, bmp)
        rv.setOnClickPendingIntent(R.id.root, openIntent(ctx, today.toString(), "week", 9000 + id % 1000))
        rv.setOnClickPendingIntent(R.id.sync, syncIntent(ctx))
        mgr.updateAppWidget(id, rv)
    }

    fun renderAll(ctx: Context) {
        val mgr = AppWidgetManager.getInstance(ctx)
        mgr.getAppWidgetIds(ComponentName(ctx, MonthWidget::class.java)).forEach { updateMonth(ctx, mgr, it) }
        mgr.getAppWidgetIds(ComponentName(ctx, TodayWidget::class.java)).forEach { updateToday(ctx, mgr, it) }
    }

    private val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    fun syncNow(ctx: Context, manual: Boolean = false) {
        val req = OneTimeWorkRequestBuilder<SyncWorker>()
            .setInputData(workDataOf("manual" to manual))
        if (!manual) req.setConstraints(net)
        WorkManager.getInstance(ctx).enqueueUniqueWork("pb-now", ExistingWorkPolicy.REPLACE, req.build())
    }

    fun schedule(ctx: Context) {
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("pb-periodic", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<SyncWorker>(30, TimeUnit.MINUTES).setConstraints(net).build())
    }
}

class MonthWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { Widgets.updateMonth(ctx, mgr, it) }
        Widgets.schedule(ctx); Widgets.syncNow(ctx)
    }
    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, newOptions: Bundle) {
        Widgets.updateMonth(ctx, mgr, id)
    }
}

class TodayWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { Widgets.updateToday(ctx, mgr, it) }
        Widgets.schedule(ctx); Widgets.syncNow(ctx)
    }
    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, newOptions: Bundle) {
        Widgets.updateToday(ctx, mgr, id)
    }
}

// 위젯의 동기화 버튼
class SyncReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        if (Store.uid(ctx) == null) {
            Toast.makeText(ctx, "플랜북 앱에서 로그인해 주세요", Toast.LENGTH_SHORT).show(); return
        }
        Toast.makeText(ctx, "동기화하는 중", Toast.LENGTH_SHORT).show()
        Widgets.syncNow(ctx, manual = true)
    }
}
