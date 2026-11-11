package kr.planbook.app

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import java.time.LocalDate

// 위젯 그림 그리기 (플랜북 B 스타일)
object Render {
    private val INK = Color.parseColor("#111111")
    private val MUTED = Color.parseColor("#6B6B6B")
    private val LINE = Color.parseColor("#E6E6E6")
    private val RED = Color.parseColor("#C0392B")
    private val BLUE = Color.parseColor("#1F4FB8")
    private val FAINT = Color.parseColor("#BBBBBB")
    private val EN = arrayOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
    private val WD = arrayOf("일", "월", "화", "수", "목", "금", "토")

    private fun light(): Typeface = if (Build.VERSION.SDK_INT >= 28) Typeface.create(Typeface.DEFAULT, 300, false) else Typeface.create("sans-serif-light", Typeface.NORMAL)
    private fun medium(): Typeface = if (Build.VERSION.SDK_INT >= 28) Typeface.create(Typeface.DEFAULT, 500, false) else Typeface.DEFAULT_BOLD

    private fun base(w: Int, h: Int, dp: Float): Pair<Bitmap, Canvas> {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val path = Path().apply { addRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), 22 * dp, 22 * dp, Path.Direction.CW) }
        cv.clipPath(path)
        cv.drawColor(Color.WHITE)
        return bmp to cv
    }

    private fun p(color: Int, size: Float, tf: Typeface? = null) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color; textSize = size; if (tf != null) typeface = tf
    }

    private fun dayColor(d: LocalDate): Int = when {
        Holidays.MAP.containsKey(d.toString()) -> RED
        d.dayOfWeek.value == 7 -> RED
        d.dayOfWeek.value == 6 -> BLUE
        else -> INK
    }

    // 글자를 너비에 맞춰 잘라 그리기
    private fun clipText(cv: Canvas, t: String, x: Float, y: Float, maxW: Float, paint: Paint) {
        if (maxW <= 0) return
        val n = paint.breakText(t, true, maxW, null)
        cv.drawText(t, 0, n, x, y, paint)
    }

    // 동기화 아이콘 (웹과 같은 모양). (x, y) = 왼쪽 위, size = 한 변
    fun syncIcon(cv: Canvas, x: Float, y: Float, size: Float, color: Int) {
        val s = size / 24f
        val pt = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color; style = Paint.Style.STROKE; strokeWidth = 1.7f * s
            strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
        }
        val oval = RectF(x + 4 * s, y + 4 * s, x + 20 * s, y + 20 * s)
        cv.drawArc(oval, 0f, 142f, false, pt)
        cv.drawArc(oval, 180f, 142f, false, pt)
        val a = Path().apply {
            moveTo(x + 18.5f * s, y + 3 * s); lineTo(x + 18.5f * s, y + 7.3f * s); lineTo(x + 14.2f * s, y + 7.3f * s)
            moveTo(x + 5.5f * s, y + 21 * s); lineTo(x + 5.5f * s, y + 16.7f * s); lineTo(x + 9.8f * s, y + 16.7f * s)
        }
        cv.drawPath(a, pt)
    }

    fun message(w: Int, h: Int, dp: Float, msg: String): Bitmap {
        val (bmp, cv) = base(w, h, dp)
        val pt = p(MUTED, 13 * dp)
        val tw = pt.measureText(msg)
        cv.drawText(msg, (w - tw) / 2, h / 2f, pt)
        return bmp
    }

    // 월간 위젯: 위 1/6은 머리, 아래 5/6은 6주
    fun month(m: Model, w: Int, h: Int, dp: Float, today: LocalDate): Bitmap {
        val (bmp, cv) = base(w, h, dp)
        val y = today.year; val mo = today.monthValue
        val grid = Model.monthGrid(y, mo)
        val list = m.all(grid[0][0], grid[5][6])
        val pad = 10 * dp
        val headH = h / 6f
        val rowH = (h - headH) / 6f
        val colW = (w - pad * 2) / 7f

        // 머리: 큰 월 숫자 + 연도/영문 월 + 요일 줄
        val wdSize = minOf(10 * dp, headH * 0.22f)
        val bigSize = minOf(headH * 0.62f, 40 * dp)
        val big = p(INK, bigSize, light())
        val numBase = headH - wdSize - 6 * dp
        cv.drawText(mo.toString(), pad, numBase, big)
        val nx = pad + big.measureText(mo.toString()) + 6 * dp
        val smallSize = minOf(10 * dp, bigSize * 0.3f)
        cv.drawText(y.toString(), nx, numBase - smallSize * 1.25f, p(MUTED, smallSize))
        cv.drawText(EN[mo - 1], nx, numBase, p(INK, smallSize * 1.2f, medium()))
        val wdp = p(MUTED, wdSize)
        for (i in 0 until 7) {
            wdp.color = if (i == 0) RED else if (i == 6) BLUE else MUTED
            cv.drawText(WD[i], pad + colW * i + 3 * dp, headH - 3 * dp, wdp)
        }
        cv.drawRect(pad, headH, w - pad, headH + 1.5f * dp, p(INK, 0f))
        val ic = minOf(18 * dp, headH * 0.42f)
        syncIcon(cv, w - pad - ic - 2 * dp, 8 * dp, ic, INK)

        val numSize = minOf(11 * dp, rowH * 0.28f)
        val dateH = numSize + 5 * dp
        val laneH = 15 * dp
        val lanes = ((rowH - dateH - 2 * dp) / (laneH + 2 * dp)).toInt()
        val dotsMode = lanes < 1
        val np = p(INK, numSize)
        val chipText = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = minOf(10 * dp, laneH * 0.7f); typeface = medium() }
        val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        val linePaint = p(LINE, 0f)

        for (r in 0 until 6) {
            val top = headH + rowH * r
            if (r > 0) cv.drawRect(pad, top, w - pad, top + 1 * dp, linePaint)
            val days = grid[r]
            if (r == 5 && days[0].monthValue != mo) continue
            days.forEachIndexed { c, d ->
                val x = pad + colW * c
                val other = d.monthValue != mo
                if (d == today) {
                    val tw = maxOf(np.measureText(d.dayOfMonth.toString()) + 6 * dp, numSize + 6 * dp)
                    cv.drawRect(x + 1 * dp, top + 2 * dp, x + 1 * dp + tw, top + 2 * dp + numSize + 4 * dp, p(INK, 0f))
                    np.color = Color.WHITE
                    cv.drawText(d.dayOfMonth.toString(), x + 4 * dp, top + 2 * dp + numSize + 1 * dp, np)
                } else {
                    np.color = if (other) FAINT else dayColor(d)
                    cv.drawText(d.dayOfMonth.toString(), x + 4 * dp, top + 2 * dp + numSize + 1 * dp, np)
                }
            }
            val segs = m.layoutWeek(list, days, today)
            if (dotsMode) {
                // 작게 줄였을 때: 일정 있는 날에 점
                val r2 = 2.2f * dp
                val counts = IntArray(7)
                segs.forEach { s -> for (cc in s.col until s.col + s.span) {
                    if (counts[cc] < 3) {
                        fill.color = s.ev.color
                        cv.drawCircle(pad + colW * cc + 6 * dp + counts[cc] * (r2 * 2.6f), top + rowH - r2 * 2.2f, r2, fill)
                    }
                    counts[cc]++
                } }
            } else {
                val hidden = IntArray(7)
                segs.forEach { s ->
                    if (s.lane >= lanes) { for (cc in s.col until s.col + s.span) hidden[cc]++; return@forEach }
                    val x0 = pad + colW * s.col + 1 * dp
                    val x1 = pad + colW * (s.col + s.span) - 1 * dp
                    val y0 = top + dateH + s.lane * (laneH + 2 * dp)
                    fill.color = s.ev.color
                    cv.drawRect(x0, y0, x1, y0 + laneH, fill)
                    chipText.color = Model.textOn(s.ev.color)
                    clipText(cv, s.ev.title, x0 + 3 * dp, y0 + laneH * 0.74f, x1 - x0 - 5 * dp, chipText)
                }
                val mp = p(MUTED, minOf(9 * dp, numSize))
                hidden.forEachIndexed { c, n ->
                    if (n > 0) {
                        val t = "+$n"
                        cv.drawText(t, pad + colW * (c + 1) - mp.measureText(t) - 3 * dp, top + 2 * dp + numSize, mp)
                    }
                }
            }
        }
        return bmp
    }

    // 오늘 위젯
    fun today(m: Model, w: Int, h: Int, dp: Float, today: LocalDate): Bitmap {
        val (bmp, cv) = base(w, h, dp)
        val pad = 12 * dp
        val title = "${today.monthValue}월 ${today.dayOfMonth}일 ${WD[today.dayOfWeek.value % 7]}요일"
        val hp = p(dayColor(today).let { if (it == INK) INK else it }, 14 * dp, medium())
        cv.drawText(title, pad, pad + 14 * dp, hp)
        val brand = p(MUTED, 10 * dp)
        val ic = 18 * dp
        syncIcon(cv, w - pad - ic + 2 * dp, pad - 1 * dp, ic, INK)
        cv.drawText("플랜북", w - pad - ic - 4 * dp - brand.measureText("플랜북"), pad + 13 * dp, brand)
        val hol = Holidays.MAP[today.toString()]
        if (hol != null) cv.drawText(hol, pad + hp.measureText(title) + 6 * dp, pad + 13 * dp, p(RED, 10 * dp))

        val list = m.onDay(m.all(today, today), today, today)
        var y = pad + 24 * dp
        val boxH = 22 * dp
        val gap = 4 * dp
        val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 12 * dp; typeface = medium() }
        val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        if (list.isEmpty()) {
            cv.drawText("일정 없음", pad, y + 15 * dp, p(FAINT, 12 * dp))
            return bmp
        }
        val fit = maxOf(1, ((h - y - pad + gap) / (boxH + gap)).toInt())
        val show = if (list.size > fit) fit - 1 else list.size
        for (i in 0 until maxOf(show, 0)) {
            val e = list[i]
            fill.color = e.color
            cv.drawRect(pad, y, w - pad, y + boxH, fill)
            tp.color = Model.textOn(e.color)
            clipText(cv, e.title, pad + 7 * dp, y + boxH * 0.68f, w - pad * 2 - 12 * dp, tp)
            y += boxH + gap
        }
        if (list.size > show) cv.drawText("+${list.size - show}", pad, y + 14 * dp, p(MUTED, 12 * dp))
        return bmp
    }
}
