// 루틴(반복) 계산과 음력 변환
import { ymd, parse, addDays } from './util.js';

const lunarCache = new Map();
let lunarFmt = null;
try { lunarFmt = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric' }); } catch (e) { lunarFmt = null; }

// 양력 연도 y 안에서 음력 m월 d일에 해당하는 양력 날짜들
export function lunarToSolar(y, m, d) {
  const key = `${y}-${m}-${d}`;
  if (lunarCache.has(key)) return lunarCache.get(key);
  const out = [];
  if (lunarFmt) {
    const find = (dd) => {
      const res = [];
      for (let t = new Date(y, 0, 1); t.getFullYear() === y; t.setDate(t.getDate() + 1)) {
        const p = lunarFmt.formatToParts(t);
        const mo = p.find((x) => x.type === 'month')?.value;
        const da = p.find((x) => x.type === 'day')?.value;
        if (mo === String(m) && +da === dd) res.push(ymd(t));
      }
      return res;
    };
    let r = find(d);
    if (!r.length && d === 30) r = find(29); // 작은달이면 29일로
    out.push(...r);
  }
  lunarCache.set(key, out);
  return out;
}

export const REP_LABEL = { daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년' };
const WD = ['일', '월', '화', '수', '목', '금', '토'];

export function ruleText(rt) {
  if (rt.rep === 'daily') return '매일';
  if (rt.rep === 'weekly') return '매주 ' + (rt.wdays || []).slice().sort().map((w) => WD[w] + '요일').join(', ');
  if (rt.rep === 'monthly') return `매월 ${rt.mday}일`;
  const [mm, dd] = (rt.md || '01-01').split('-').map(Number);
  return `${rt.lunar ? '음력 ' : ''}${mm}월 ${dd}일`;
}

// from~to(포함) 사이 반복 날짜들
export function occDates(rt, from, to) {
  const s = rt.start && rt.start > from ? rt.start : from;
  const e = rt.end && rt.end < to ? rt.end : to;
  if (s > e) return [];
  const res = [];
  if (rt.rep === 'yearly' && rt.lunar) {
    const [mm, dd] = (rt.md || '01-01').split('-').map(Number);
    for (let y = parse(s).getFullYear(); y <= parse(e).getFullYear(); y++) {
      lunarToSolar(y, mm, dd).forEach((d) => { if (d >= s && d <= e) res.push(d); });
    }
    return res.sort();
  }
  for (let d = s; d <= e; d = addDays(d, 1)) {
    const t = parse(d);
    if (rt.rep === 'daily') res.push(d);
    else if (rt.rep === 'weekly') { if ((rt.wdays || []).includes(t.getDay())) res.push(d); }
    else if (rt.rep === 'monthly') {
      const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
      const want = Math.min(+rt.mday || 1, last);
      if (t.getDate() === want) res.push(d);
    } else if (rt.rep === 'yearly') {
      const [mm, dd] = (rt.md || '01-01').split('-').map(Number);
      const last = new Date(t.getFullYear(), mm, 0).getDate();
      if (t.getMonth() + 1 === mm && t.getDate() === Math.min(dd, last)) res.push(d);
    }
  }
  return res;
}

export function nextOcc(rt, today) {
  const r = occDates(rt, today, addDays(today, 800));
  return r[0] || null;
}

// 달력에 넣을 가상 항목
export function occItems(routines, from, to) {
  const out = [];
  for (const rt of routines) {
    // mv: 이번 회차만 실제로 끝낸 날로 옮긴 기록 { 예정일: 완료한 날 }
    const mv = rt.mv || {};
    const hasMv = Object.keys(mv).length > 0;
    for (const d of occDates(rt, hasMv ? addDays(from, -62) : from, hasMv ? addDays(to, 62) : to)) {
      const shown = mv[d] || d;
      if (shown < from || shown > to) continue;
      out.push({
        id: `r~${rt.id}~${d}`, routine: rt.id, type: rt.kind || 'event', title: rt.title, start: shown, end: shown, sched: d,
        cat: rt.cat, sub: rt.sub, memo: rt.memo || '', status: (rt.st && rt.st[d]) || 'progress', created: rt.created || 0,
      });
    }
  }
  return out;
}
