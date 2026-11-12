// 공휴일 (관공서의 공휴일에 관한 규정 기준, 대체공휴일 포함)
// 해마다 정해진 공휴일은 규칙으로 계산하고, 선거일·임시공휴일만 아래 목록에 적어 둠
import { ymd, parse, addDays } from './util.js';
import { lunarToSolar } from './routine.js';

export const FROM_YEAR = 2022;

// 선거일·임시공휴일 (발표되면 여기에 추가)
const SPECIAL = {
  '2022-03-09': '대통령선거',
  '2022-06-01': '지방선거',
  '2023-10-02': '임시공휴일',
  '2024-04-10': '국회의원선거',
  '2024-10-01': '임시공휴일',
  '2025-01-27': '임시공휴일',
  '2025-06-03': '대통령선거',
  '2026-06-03': '지방선거',
  '2028-04-12': '국회의원선거',
};

const dow = (d) => parse(d).getDay();
const lunar = (y, m, d) => lunarToSolar(y, m, d)[0] || null;

function build(y) {
  const base = {}; // 날짜 → [이름...]
  const add = (d, name) => { if (d) (base[d] = base[d] || []).push(name); };
  const md = (m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // sub: 대체공휴일 규칙 — 'we'(토·일과 겹침), 'sun'(일요일과 겹침, 설·추석), null(없음)
  const list = [];
  const push = (d, name, sub) => { if (!d) return; add(d, name); list.push({ d, name, sub }); };

  push(md(1, 1), '신정', null);
  const seol = lunar(y, 1, 1);
  if (seol) { push(addDays(seol, -1), '설날', 'sun'); push(seol, '설날', 'sun'); push(addDays(seol, 1), '설날', 'sun'); }
  push(md(3, 1), '삼일절', y >= 2021 ? 'we' : null);
  if (y >= 2026) push(md(5, 1), '노동절', 'we');
  push(md(5, 5), '어린이날', 'we');
  push(lunar(y, 4, 8), '부처님오신날', y >= 2023 ? 'we' : null);
  push(md(6, 6), '현충일', null);
  if (y >= 2026) push(md(7, 17), '제헌절', 'we');
  push(md(8, 15), '광복절', y >= 2021 ? 'we' : null);
  const chu = lunar(y, 8, 15);
  if (chu) { push(addDays(chu, -1), '추석', 'sun'); push(chu, '추석', 'sun'); push(addDays(chu, 1), '추석', 'sun'); }
  push(md(10, 3), '개천절', y >= 2021 ? 'we' : null);
  push(md(10, 9), '한글날', y >= 2021 ? 'we' : null);
  push(md(12, 25), '성탄절', y >= 2023 ? 'we' : null);
  Object.keys(SPECIAL).filter((d) => d.startsWith(String(y))).forEach((d) => add(d, SPECIAL[d]));

  const out = {};
  Object.keys(base).forEach((d) => { out[d] = base[d][0]; });
  const taken = (d) => !!out[d];
  // 대체공휴일은 그 공휴일 다음의 첫 번째 비공휴일 (토·일 건너뜀)
  const nextFree = (d) => { let t = addDays(d, 1); while (taken(t) || dow(t) === 0 || dow(t) === 6) t = addDays(t, 1); return t; };
  const blocks = ['설날', '추석'].map((n) => list.filter((x) => x.name === n).map((x) => x.d)).filter((a) => a.length);
  const anchor = (d) => { const b = blocks.find((a) => a.includes(d)); return b ? b[b.length - 1] : d; };
  const subs = []; // 대체공휴일이 생기는 사유마다 기준일 하나
  blocks.forEach((a) => { if (a.some((d) => dow(d) === 0)) subs.push(a[a.length - 1]); });
  list.filter((x) => x.sub === 'we').forEach((x) => { const w = dow(x.d); if (w === 0 || w === 6) subs.push(x.d); });
  // 평일에 공휴일끼리 겹치면 그 날 하나당 한 번
  const named = new Set(list.filter((x) => x.sub).map((x) => x.d + '|' + x.name));
  Object.keys(base).forEach((d) => {
    const w = dow(d);
    if (w === 0 || w === 6) return;
    const n = base[d].filter((name) => named.has(d + '|' + name)).length;
    if (base[d].length > 1 && n >= 1 && base[d].filter((name) => name !== '신정').length > 1) subs.push(anchor(d));
  });
  subs.sort().forEach((d) => { out[nextFree(d)] = '대체공휴일'; });
  return out;
}

const cache = new Map();
function yearMap(y) {
  if (!cache.has(y)) cache.set(y, y >= FROM_YEAR && y <= 2200 ? build(y) : {});
  return cache.get(y);
}
export function holidayOf(d) {
  if (typeof d !== 'string' || d.length < 10) return undefined;
  return yearMap(+d.slice(0, 4))[d];
}
// 기존 코드가 HOLIDAYS[날짜]로 쓰고 있어서 같은 모양으로 둠
export const HOLIDAYS = new Proxy({}, { get: (_, k) => holidayOf(String(k)) });
export const holidaysOfYear = (y) => ({ ...yearMap(y) });
