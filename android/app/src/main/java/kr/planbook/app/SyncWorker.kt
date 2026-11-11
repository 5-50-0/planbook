package kr.planbook.app

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

// 데이터를 새로 받아 위젯을 다시 그림
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        return try {
            Fetch.fetchAll(applicationContext)
            Widgets.renderAll(applicationContext)
            Result.success()
        } catch (e: Exception) {
            Widgets.renderAll(applicationContext) // 받은 게 없어도 날짜는 맞춰서 다시 그림
            if (runAttemptCount < 2) Result.retry() else Result.failure()
        }
    }
}
