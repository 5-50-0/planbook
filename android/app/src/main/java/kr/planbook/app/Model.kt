package kr.planbook.app

import android.graphics.Color
import android.icu.util.ChineseCalendar
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.util.GregorianCalendar
import java.util.TimeZone

// 웹앱(js/util.js, js/routine.js)과 같은 규칙으로 위젯에 그릴 항목 계산
data class Ev(
    val id: String, val type: String, val title: String,
    val start: LocalDate, val end: LocalDate,
    val color: Int, val status: String, val routine: Boolean, val created: Long,
    val carry: Boolean = false,
)

data class Seg(val ev: Ev, val col: Int, val span: Int, var lane: Int = 0)

class Model(data: JSONObject?) {
    private val items: JSONArray = data?.optJSONArray("items") ?: JSONArray()
    private val routines: JSONArray = data?.optJSONArray("routines") ?: JSONArray()
    private val settings: JSONObject = data?.optJSONObject("settings") ?: JSONObject()
    val hasData = data != null

    private fun parseColor(s: String?, def: String): Int = try { Color.parseColor(if (s.isNullOrEmpty()) def else s) } catch (e: Exception) { Color.parseColor(def) }

    private fun colorOf(type: String, cat: String?, sub: String?): Int {
        if (type == "todo") return parseColor(settings.optString("todoColor"), "#CFCFCF")
        val cats = settings.optJSONArray("cats") ?: return parseColor(null, "#CFCFCF")
        for (i in 0 until cats.length()) {
            val c = cats.getJSONObject(i)
            if (c.optString("id") != cat) continue
            val subs = c.optJSONArray("subs")
            if (subs != null && !sub.isNullOrEmpty()) for (j in 0 until subs.length()) {
                val s = subs.getJSONObject(j)
                if (s.optString("id") == sub && !s.isNull("color") && s.optString("color").isNotEmpty()) return parseColor(s.optString("color"), "#CFCFCF")
            }
            return parseColor(c.optString("color"), "#CFCFCF")
        }
        return parseColor(null, "#CFCFCF")
    }

    private fun date(s: String?): LocalDate? = try { if (s.isNullOrEmpty()) null else LocalDate.parse(s) } catch (e: Exception) { null }

    private fun plainItems(): List<Ev> {
        val out = ArrayList<Ev>()
        for (i in 0 until items.length()) {
            val o = items.getJSONObject(i)
            val s = date(o.optString("start")) ?: continue
            val type = o.optString("type", "event")
            var e = if (type == "event") date(o.optString("end")) ?: s else s
            if (e.isBefore(s)) e = s
            out.add(Ev(o.optString("id"), type, o.optString("title"), s, e,
                colorOf(type, o.optString("cat"), o.optString("sub")),
                o.optString("status", "progress").ifEmpty { "progress" }, false, o.optLong("created", 0)))
        }
        return out
    }

    // ----- 루틴 -----
    private val lunarCache = HashMap<String, List<LocalDate>>()
    private fun lunarToSolar(y: Int, m: Int, d: Int): List<LocalDate> {
        val key = "$y-$m-$d"
        lunarCache[key]?.let { return it }
        // 1950~2050년은 한국천문연구원 표로 (중국 음력과 하루씩 다른 해가 있어서)
        if (KrLunar.has(y - 1) && KrLunar.has(y)) { val r = KrLunar.inYear(y, m, d); lunarCache[key] = r; return r }
        fun find(dd: Int): List<LocalDate> {
            val res = ArrayList<LocalDate>()
            val cc = ChineseCalendar()
            var t = LocalDate.of(y, 1, 1)
            while (t.year == y) {
                val g = GregorianCalendar(TimeZone.getTimeZone("Asia/Seoul"))
                g.clear(); g.set(t.year, t.monthValue - 1, t.dayOfMonth, 12, 0)
                cc.timeInMillis = g.timeInMillis
                if (cc.get(ChineseCalendar.IS_LEAP_MONTH) == 0 && cc.get(ChineseCalendar.MONTH) + 1 == m && cc.get(ChineseCalendar.DAY_OF_MONTH) == dd) res.add(t)
                t = t.plusDays(1)
            }
            return res
        }
        var r = find(d)
        if (r.isEmpty() && d == 30) r = find(29)
        lunarCache[key] = r
        return r
    }

    private fun occDates(o: JSONObject, from: LocalDate, to: LocalDate): List<LocalDate> {
        val st = date(o.optString("start"))
        val en = date(o.optString("end"))
        val s = if (st != null && st.isAfter(from)) st else from
        val e = if (en != null && en.isBefore(to)) en else to
        if (s.isAfter(e)) return emptyList()
        val rep = o.optString("rep")
        val res = ArrayList<LocalDate>()
        val md = o.optString("md", "01-01").split("-")
        val mm = md.getOrNull(0)?.toIntOrNull() ?: 1
        val dd = md.getOrNull(1)?.toIntOrNull() ?: 1
        if (rep == "yearly" && o.optBoolean("lunar")) {
            for (y in s.year..e.year) lunarToSolar(y, mm, dd).forEach { if (!it.isBefore(s) && !it.isAfter(e)) res.add(it) }
            return res.sorted()
        }
        val wd = HashSet<Int>()
        o.optJSONArray("wdays")?.let { for (i in 0 until it.length()) wd.add(it.optInt(i)) }
        val mday = o.optString("mday").toIntOrNull() ?: o.optInt("mday", 1)
        var t = s
        while (!t.isAfter(e)) {
            when (rep) {
                "daily" -> res.add(t)
                "weekly" -> if (wd.contains(t.dayOfWeek.value % 7)) res.add(t)
                "monthly" -> if (t.dayOfMonth == minOf(mday, t.lengthOfMonth())) res.add(t)
                "yearly" -> if (t.monthValue == mm && t.dayOfMonth == minOf(dd, t.withDayOfMonth(1).withMonth(mm).lengthOfMonth())) res.add(t)
            }
            t = t.plusDays(1)
        }
        return res
    }

    private fun occItems(from: LocalDate, to: LocalDate): List<Ev> {
        val out = ArrayList<Ev>()
        for (i in 0 until routines.length()) {
            val o = routines.getJSONObject(i)
            val kind = o.optString("kind", "event")
            val stMap = o.optJSONObject("st")
            // mv: 이번 회차만 실제로 끝낸 날로 옮긴 기록 { 예정일: 완료한 날 }
            val mv = o.optJSONObject("mv")
            val hasMv = mv != null && mv.length() > 0
            val f2 = if (hasMv) from.minusDays(62) else from
            val t2 = if (hasMv) to.plusDays(62) else to
            for (d in occDates(o, f2, t2)) {
                val shown = mv?.optString(d.toString(), "")?.let { s -> if (s.isEmpty()) null else try { LocalDate.parse(s) } catch (e: Exception) { null } } ?: d
                if (shown.isBefore(from) || shown.isAfter(to)) continue
                val bday = o.optBoolean("bday", false)
                out.add(Ev("r~" + o.optString("id") + "~" + d, if (bday) "event" else kind, if (bday) o.optString("title") + " 생일" else o.optString("title"), shown, shown,
                    colorOf(kind, o.optString("cat"), o.optString("sub")),
                    stMap?.optString(d.toString(), "progress")?.ifEmpty { "progress" } ?: "progress", true, o.optLong("created", 0),
                    !bday && kind == "todo" && carryFrom != null && !d.isBefore(carryFrom) && shown == d))
            }
        }
        return out
    }

    // 루틴 할 일은 rtCarryFrom 이후 회차만 완료 전까지 오늘로 넘어옴
    private val carryFrom: LocalDate? = settings.optString("rtCarryFrom", "").let { if (it.isEmpty()) null else try { LocalDate.parse(it) } catch (e: Exception) { null } }

    fun all(from: LocalDate, to: LocalDate): List<Ev> {
        val base = plainItems() + occItems(from, to)
        val today = today()
        val cf = carryFrom ?: return base
        if (today.isBefore(from) || today.isAfter(to) || !cf.isBefore(today)) return base
        val have = base.map { it.id }.toHashSet()
        val past = occItems(cf, today.minusDays(1)).filter { it.carry && it.status == "progress" && !have.contains(it.id) }
        return base + past
    }

    // ----- 표시 규칙 -----
    private fun carried(e: Ev, today: LocalDate) = (!e.routine || e.carry) && e.type == "todo" && e.status == "progress" && e.start.isBefore(today)
    private fun shownStart(e: Ev, today: LocalDate) = if (carried(e, today)) today else e.start
    private fun shownEnd(e: Ev, today: LocalDate) = if (e.type == "event") e.end else shownStart(e, today)

    private val timeRe = Regex("^\\s*(\\d{1,2}):(\\d{2})")
    private fun minutes(t: String): Int? {
        val m = timeRe.find(t) ?: return null
        val h = m.groupValues[1].toInt(); val mi = m.groupValues[2].toInt()
        return if (h > 23 || mi > 59) null else h * 60 + mi
    }

    fun onDay(list: List<Ev>, day: LocalDate, today: LocalDate): List<Ev> {
        val l = list.filter { !shownStart(it, today).isAfter(day) && !shownEnd(it, today).isBefore(day) }
        val ev = l.filter { it.type == "event" }
        val untimed = ev.filter { minutes(it.title) == null }.sortedBy { it.created }
        val timed = ev.filter { minutes(it.title) != null }.sortedWith(compareBy({ minutes(it.title) }, { it.created }))
        val td = l.filter { it.type == "todo" }.sortedWith(compareBy({ if (it.status == "progress") 0 else 1 }, { it.created }))
        return untimed + timed + td
    }

    fun layoutWeek(list: List<Ev>, days: List<LocalDate>, today: LocalDate): List<Seg> {
        val ws = days[0]; val we = days[6]
        val order = HashMap<String, Int>()
        for (d in days) onDay(list, d, today).forEachIndexed { i, e -> if (!order.containsKey(e.id)) order[e.id] = i }
        val segs = ArrayList<Seg>()
        for (e in list) {
            val s = shownStart(e, today); val en = shownEnd(e, today)
            if (en.isBefore(ws) || s.isAfter(we)) continue
            val cs = if (s.isBefore(ws)) ws else s
            val ce = if (en.isAfter(we)) we else en
            segs.add(Seg(e, (cs.toEpochDay() - ws.toEpochDay()).toInt(), (ce.toEpochDay() - cs.toEpochDay()).toInt() + 1))
        }
        segs.sortWith(compareBy<Seg>({ if (it.ev.end.isAfter(it.ev.start) && it.ev.type == "event") 0 else 1 }, { it.col }, { -it.span }, { order[it.ev.id] ?: 0 }))
        val lanes = ArrayList<BooleanArray>()
        for (sg in segs) {
            var lane = 0
            while (true) {
                if (lane >= lanes.size) lanes.add(BooleanArray(7))
                val row = lanes[lane]
                var free = true
                for (c in sg.col until sg.col + sg.span) if (row[c]) { free = false; break }
                if (free) { for (c in sg.col until sg.col + sg.span) row[c] = true; sg.lane = lane; break }
                lane++
            }
        }
        return segs
    }

    companion object {
        fun today(): LocalDate = LocalDate.now(ZoneId.of("Asia/Seoul"))

        // 밝은 바탕 위 글씨색 (같은 계열 진한 색)
        fun textOn(c: Int): Int {
            val r = Color.red(c) / 255f; val g = Color.green(c) / 255f; val b = Color.blue(c) / 255f
            val lum = 0.2126f * r + 0.7152f * g + 0.0722f * b
            if (lum < 0.45f) return Color.WHITE
            val hsl = FloatArray(3)
            androidx.core.graphics.ColorUtils.colorToHSL(c, hsl)
            hsl[1] = minOf(hsl[1], 0.65f); hsl[2] = 0.20f
            return androidx.core.graphics.ColorUtils.HSLToColor(hsl)
        }

        // 그 달 달력의 6주 (일요일 시작)
        fun monthGrid(y: Int, m: Int): List<List<LocalDate>> {
            val first = LocalDate.of(y, m, 1)
            val start = first.minusDays((first.dayOfWeek.value % 7).toLong())
            return (0 until 6).map { w -> (0 until 7).map { d -> start.plusDays((w * 7 + d).toLong()) } }
        }
    }
}
