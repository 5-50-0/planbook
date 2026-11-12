package kr.planbook.app

import java.time.DayOfWeek
import java.time.LocalDate

// 공휴일 (웹 js/holidays.js 와 같은 규칙). 정해진 공휴일은 계산하고, 선거일·임시공휴일만 목록으로 둠
object Holidays {
    private const val FROM_YEAR = 2022
    private val SPECIAL = mapOf(
        "2022-03-09" to "대통령선거", "2022-06-01" to "지방선거", "2023-10-02" to "임시공휴일",
        "2024-04-10" to "국회의원선거", "2024-10-01" to "임시공휴일", "2025-01-27" to "임시공휴일",
        "2025-06-03" to "대통령선거", "2026-06-03" to "지방선거", "2028-04-12" to "국회의원선거",
    )
    private val cache = HashMap<Int, Map<String, String>>()

    fun name(d: LocalDate): String? = year(d.year)[d.toString()]
    fun has(d: LocalDate) = name(d) != null

    @Synchronized
    private fun year(y: Int): Map<String, String> = cache.getOrPut(y) { if (y in FROM_YEAR..2200) build(y) else emptyMap() }

    private class H(val d: LocalDate, val name: String, val sub: String?)

    private fun lunar(y: Int, m: Int, d: Int): LocalDate? = if (KrLunar.has(y)) KrLunar.solar(y, m, d) else null
    private fun weekend(d: LocalDate) = d.dayOfWeek == DayOfWeek.SATURDAY || d.dayOfWeek == DayOfWeek.SUNDAY

    private fun build(y: Int): Map<String, String> {
        val list = ArrayList<H>()
        val base = LinkedHashMap<LocalDate, MutableList<String>>()
        fun push(d: LocalDate?, name: String, sub: String?) { if (d == null) return; base.getOrPut(d) { ArrayList() }.add(name); list.add(H(d, name, sub)) }
        push(LocalDate.of(y, 1, 1), "신정", null)
        lunar(y, 1, 1)?.let { push(it.minusDays(1), "설날", "sun"); push(it, "설날", "sun"); push(it.plusDays(1), "설날", "sun") }
        push(LocalDate.of(y, 3, 1), "삼일절", if (y >= 2021) "we" else null)
        if (y >= 2026) push(LocalDate.of(y, 5, 1), "노동절", "we")
        push(LocalDate.of(y, 5, 5), "어린이날", "we")
        push(lunar(y, 4, 8), "부처님오신날", if (y >= 2023) "we" else null)
        push(LocalDate.of(y, 6, 6), "현충일", null)
        if (y >= 2026) push(LocalDate.of(y, 7, 17), "제헌절", "we")
        push(LocalDate.of(y, 8, 15), "광복절", if (y >= 2021) "we" else null)
        lunar(y, 8, 15)?.let { push(it.minusDays(1), "추석", "sun"); push(it, "추석", "sun"); push(it.plusDays(1), "추석", "sun") }
        push(LocalDate.of(y, 10, 3), "개천절", if (y >= 2021) "we" else null)
        push(LocalDate.of(y, 10, 9), "한글날", if (y >= 2021) "we" else null)
        push(LocalDate.of(y, 12, 25), "성탄절", if (y >= 2023) "we" else null)
        SPECIAL.forEach { (k, v) -> if (k.startsWith("$y-")) base.getOrPut(LocalDate.parse(k)) { ArrayList() }.add(v) }

        val out = HashMap<String, String>()
        base.forEach { (d, names) -> out[d.toString()] = names[0] }
        fun nextFree(d: LocalDate): LocalDate { var t = d.plusDays(1); while (out.containsKey(t.toString()) || weekend(t)) t = t.plusDays(1); return t }
        val blocks = listOf("설날", "추석").map { n -> list.filter { it.name == n }.map { it.d } }.filter { it.isNotEmpty() }
        fun anchor(d: LocalDate): LocalDate = blocks.firstOrNull { it.contains(d) }?.last() ?: d
        val subs = ArrayList<LocalDate>()
        blocks.forEach { b -> if (b.any { it.dayOfWeek == DayOfWeek.SUNDAY }) subs.add(b.last()) }
        list.filter { it.sub == "we" && weekend(it.d) }.forEach { subs.add(it.d) }
        val named = list.filter { it.sub != null }.map { it.d.toString() + "|" + it.name }.toSet()
        base.forEach { (d, names) ->
            if (weekend(d)) return@forEach
            val n = names.count { named.contains(d.toString() + "|" + it) }
            if (names.size > 1 && n >= 1 && names.count { it != "신정" } > 1) subs.add(anchor(d))
        }
        subs.sorted().forEach { out[nextFree(it).toString()] = "대체공휴일" }
        return out
    }
}
