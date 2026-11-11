package kr.planbook.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

// 데이터를 새로 받아 위젯을 다시 그림
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    private fun say(msg: String) {
        if (!inputData.getBoolean("manual", false)) return
        Handler(Looper.getMainLooper()).post { Toast.makeText(applicationContext, msg, Toast.LENGTH_SHORT).show() }
    }

    override suspend fun doWork(): Result {
        return try {
            if (!Fetch.fetchAll(applicationContext)) throw IllegalStateException("no auth")
            Widgets.renderAll(applicationContext)
            say("동기화했어요")
            Result.success()
        } catch (e: Exception) {
            Widgets.renderAll(applicationContext) // 받은 게 없어도 날짜는 맞춰서 다시 그림
            if (inputData.getBoolean("manual", false)) { say("동기화하지 못했어요. 인터넷 연결을 확인해 주세요"); Result.failure() }
            else if (runAttemptCount < 2) Result.retry() else Result.failure()
        }
    }
}
