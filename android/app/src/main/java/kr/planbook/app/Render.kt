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
    // 위젯 색 (기본 / 다크)
    class Th(val dark: Boolean, alphaPct: Int) {
        val bg: Int = Color.argb(((100 - alphaPct.coerceIn(0, 100)) * 255) / 100, if (dark) 28 else 255, if (dark) 28 else 255, if (dark) 30 else 255)
        val ink = Color.parseColor(if (dark) "#EDEDED" else "#111111")
        val muted = Color.parseColor(if (dark) "#9A9A9A" else "#6B6B6B")
        val line = if (dark) Color.argb(40, 255, 255, 255) else Color.parseColor("#E6E6E6")
        val red = Color.parseColor(if (dark) "#FF7B6E" else "#C0392B")
        val blue = Color.parseColor(if (dark) "#7FA7FF" else "#1F4FB8")
        val faint = Color.parseColor(if (dark) "#5A5A5A" else "#BBBBBB")
        val onInk = Color.parseColor(if (dark) "#111111" else "#FFFFFF")
        // 일정 칸 색: 다크에서는 어둡게 눌러서
        fun chip(c: Int): Int = if (!dark) c else Color.rgb((Color.red(c) * 0.42f).toInt(), (Color.green(c) * 0.42f).toInt(), (Color.blue(c) * 0.42f).toInt())
        fun chipText(c: Int): Int = if (dark) Color.parseColor("#EDEDED") else Model.textOn(c)
        // 할 일 (체크박스): 앱과 같이 할 일 색을 어둡게(다크는 밝게) 눌러서
        private fun dk(c: Int, k: Float) = Color.rgb((Color.red(c) * (1 - k)).toInt(), (Color.green(c) * (1 - k)).toInt(), (Color.blue(c) * (1 - k)).toInt())
        private fun lt(c: Int, k: Float) = Color.rgb((Color.red(c) + (255 - Color.red(c)) * k).toInt(), (Color.green(c) + (255 - Color.green(c)) * k).toInt(), (Color.blue(c) + (255 - Color.blue(c)) * k).toInt())
        fun tdText(c: Int): Int = if (dark) lt(c, 0.45f) else dk(c, 0.55f)
        fun tdBorder(c: Int): Int = if (dark) lt(c, 0.2f) else dk(c, 0.4f)
        fun tdDone(c: Int): Int = if (dark) Color.parseColor("#5A5A5A") else dk(c, 0.08f)
    }
    private var T = Th(false, 0)
    fun theme(m: Model?) { T = if (m == null) Th(false, 0) else Th(m.widgetDark, m.widgetAlpha) }
    private val INK get() = T.ink
    private val MUTED get() = T.muted
    private val LINE get() = T.line
    private val RED get() = T.red
    private val BLUE get() = T.blue
    private val FAINT get() = T.faint
    private val EN = arrayOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
    private val WD = arrayOf("일", "월", "화", "수", "목", "금", "토")

    private fun light(): Typeface = if (Build.VERSION.SDK_INT >= 28) Typeface.create(Typeface.DEFAULT, 300, false) else Typeface.create("sans-serif-light", Typeface.NORMAL)
    private fun medium(): Typeface = if (Build.VERSION.SDK_INT >= 28) Typeface.create(Typeface.DEFAULT, 500, false) else Typeface.DEFAULT_BOLD

    private fun base(w: Int, h: Int, dp: Float): Pair<Bitmap, Canvas> {
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val path = Path().apply { addRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), 22 * dp, 22 * dp, Path.Direction.CW) }
        cv.clipPath(path)
        cv.drawColor(T.bg)
        return bmp to cv
    }

    private fun p(color: Int, size: Float, tf: Typeface? = null) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color; textSize = size; if (tf != null) typeface = tf
    }

    private fun dayColor(d: LocalDate): Int = when {
        Holidays.has(d) -> RED
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

    // 할 일 한 줄: 체크박스 + 제목 (완료는 체크 + 흐리게). (x0, y0) 왼쪽 위, h = 줄 높이
    private fun todoRow(cv: Canvas, e: Ev, x0: Float, y0: Float, x1: Float, h: Float, box: Float, gap: Float, tp: Paint, dp: Float) {
        val done = e.status != "progress"
        val bx = x0 + 1 * dp; val by = y0 + (h - box) / 2
        val st = Paint(Paint.ANTI_ALIAS_FLAG)
        if (done) {
            st.color = T.tdDone(e.color); st.style = Paint.Style.FILL
            cv.drawRect(bx, by, bx + box, by + box, st)
            st.color = Color.WHITE; st.style = Paint.Style.STROKE; st.strokeWidth = maxOf(1.2f * dp, box * 0.14f); st.strokeCap = Paint.Cap.ROUND; st.strokeJoin = Paint.Join.ROUND
            val ck = Path().apply { moveTo(bx + box * 0.22f, by + box * 0.52f); lineTo(bx + box * 0.42f, by + box * 0.72f); lineTo(bx + box * 0.8f, by + box * 0.3f) }
            cv.drawPath(ck, st)
        } else {
            st.color = if (T.dark) Color.rgb(28, 28, 30) else Color.WHITE; st.style = Paint.Style.FILL
            cv.drawRect(bx, by, bx + box, by + box, st)
            st.color = T.tdBorder(e.color); st.style = Paint.Style.STROKE; st.strokeWidth = 1.2f * dp
            cv.drawRect(bx, by, bx + box, by + box, st)
        }
        tp.color = if (done) T.tdDone(e.color) else T.tdText(e.color)
        val tx = bx + box + gap
        clipText(cv, e.title, tx, y0 + h * 0.72f, x1 - tx - 1 * dp, tp)
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

    const val HEAD = 0.1f // 위젯 레이아웃(머리 1 : 칸 9)과 맞춤
    fun weeksOf(grid: List<List<LocalDate>>, mo: Int): Int = if (grid[5][0].monthValue != mo) 5 else 6

    // 월간 위젯
    fun month(m: Model, w: Int, h: Int, dp: Float, today: LocalDate): Bitmap {
        val (bmp, cv) = base(w, h, dp)
        val y = today.year; val mo = today.monthValue
        val grid = Model.monthGrid(y, mo)
        val list = m.all(grid[0][0], grid[5][6])
        val pad = 10 * dp
        // 위 1/10: 머리(월 · 요일), 아래 9/10: 그 달 주 수(5 또는 6)만큼 나눔
        val headH = h * HEAD
        val nRows = weeksOf(grid, mo)
        val rowH = (h - headH) / nRows
        val colW = (w - pad * 2) / 7f

        // 머리: 월 숫자 + 연도/영문 월 + 동기화 / 요일 줄
        val wdH = headH * 0.34f
        val numArea = headH - wdH
        val wdSize = minOf(10 * dp, wdH * 0.62f)
        val bigSize = minOf(numArea * 0.92f, 32 * dp)
        val big = p(INK, bigSize, light())
        val numBase = numArea - 2 * dp
        cv.drawText(mo.toString(), pad, numBase, big)
        val nx = pad + big.measureText(mo.toString()) + 6 * dp
        val smallSize = minOf(9 * dp, bigSize * 0.3f)
        cv.drawText(y.toString(), nx, numBase - smallSize * 1.35f, p(MUTED, smallSize))
        cv.drawText(EN[mo - 1], nx, numBase, p(INK, smallSize * 1.2f, medium()))
        val wdp = p(MUTED, wdSize)
        for (i in 0 until 7) {
            wdp.color = if (i == 0) RED else if (i == 6) BLUE else MUTED
            cv.drawText(WD[i], pad + colW * i + 3 * dp, headH - 4 * dp, wdp)
        }
        cv.drawRect(pad, headH, w - pad, headH + 1.5f * dp, p(INK, 0f))
        val ic = minOf(18 * dp, numArea * 0.62f)
        syncIcon(cv, w - pad - ic - 2 * dp, (numArea - ic) / 2 + 2 * dp, ic, INK)

        val numSize = minOf(11 * dp, rowH * 0.28f)
        val dateH = numSize + 5 * dp
        val laneH = 15 * dp
        val lanes = ((rowH - dateH - 2 * dp) / (laneH + 2 * dp)).toInt()
        val dotsMode = lanes < 1
        val np = p(INK, numSize)
        val chipText = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = minOf(10 * dp, laneH * 0.7f); typeface = medium() }
        val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        val linePaint = p(LINE, 0f)

        for (r in 0 until nRows) {
            val top = headH + rowH * r
            if (r > 0) cv.drawRect(pad, top, w - pad, top + 1 * dp, linePaint)
            val days = grid[r]
            days.forEachIndexed { c, d ->
                val x = pad + colW * c
                val other = d.monthValue != mo
                if (d == today) {
                    val tw = maxOf(np.measureText(d.dayOfMonth.toString()) + 6 * dp, numSize + 6 * dp)
                    cv.drawRect(x + 1 * dp, top + 2 * dp, x + 1 * dp + tw, top + 2 * dp + numSize + 4 * dp, p(INK, 0f))
                    np.color = T.onInk
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
                        fill.color = T.chip(s.ev.color)
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
                    if (s.ev.type == "todo") { todoRow(cv, s.ev, x0, y0, x1, laneH, laneH * 0.62f, 3 * dp, chipText, dp); return@forEach }
                    fill.color = T.chip(s.ev.color)
                    cv.drawRect(x0, y0, x1, y0 + laneH, fill)
                    chipText.color = T.chipText(s.ev.color)
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
        val hol = Holidays.name(today)
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
            if (e.type == "todo") { todoRow(cv, e, pad, y, w - pad, boxH, 13 * dp, 7 * dp, tp, dp); y += boxH + gap; continue }
            fill.color = T.chip(e.color)
            cv.drawRect(pad, y, w - pad, y + boxH, fill)
            tp.color = T.chipText(e.color)
            clipText(cv, e.title, pad + 7 * dp, y + boxH * 0.68f, w - pad * 2 - 12 * dp, tp)
            y += boxH + gap
        }
        if (list.size > show) cv.drawText("+${list.size - show}", pad, y + 14 * dp, p(MUTED, 12 * dp))
        return bmp
    }
}
