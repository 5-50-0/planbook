// 날짜·정렬·배치 등 화면과 무관한 순수 로직

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const todayStr = () => ymd(new Date());
export const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const EN_MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// 그 날짜가 들어 있는 주의 일요일
export const weekStart = (s) => { const d = parse(s); d.setDate(d.getDate() - d.getDay()); return ymd(d); };

// 월 달력에 그릴 주 목록 (일요일 시작, 5~6주)
export function monthWeeks(year, month) {
  const first = ymd(new Date(year, month, 1));
  const last = ymd(new Date(year, month + 1, 0));
  const weeks = [];
  let ws = weekStart(first);
  while (ws <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(ws, i)));
    ws = addDays(ws, 7);
  }
  return weeks;
}

// 해당 연도 몇째 주 (월 기준 n주차)
export function weekOfMonth(s) {
  const ws = weekStart(s);
  const d = parse(addDays(ws, 3)); // 그 주의 목요일이 속한 달 기준
  const firstWs = weekStart(ymd(new Date(d.getFullYear(), d.getMonth(), 1)));
  const firstThu = parse(addDays(firstWs, 3));
  const base = firstThu.getMonth() === d.getMonth() ? firstWs : addDays(firstWs, 7);
  return { year: d.getFullYear(), month: d.getMonth() + 1, n: diffDays(base, ws) / 7 + 1 };
}

// 할 일의 표시 날짜: 진행 중이고 날짜가 지났으면 오늘로 이월
export function shownDate(item, today) {
  if (item.type === 'todo' && (item.status || 'progress') === 'progress' && item.start < today) return today;
  return item.start;
}
export const isCarried = (item, today) => item.type === 'todo' && (item.status || 'progress') === 'progress' && item.start < today;

export function itemEnd(item) {
  return item.type === 'event' && item.end && item.end > item.start ? item.end : item.start;
}

// 하루에 걸치는 항목들 (이월 반영)
export function itemsOnDay(items, day, today) {
  return items.filter((it) => {
    const s = shownDate(it, today);
    const e = it.type === 'event' ? itemEnd(it) : s;
    return s <= day && day <= e;
  });
}

const TIME_RE = /^\s*(\d{1,2}):(\d{2})/;
export function titleMinutes(t) {
  const m = TIME_RE.exec(t || '');
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

// 정렬: 시간 없는 일정(등록순) → 시간으로 시작하는 일정(시간순) → 할 일(진행 먼저, 등록순)
export function sortDay(list) {
  const created = (x) => x.created || 0;
  const ev = list.filter((x) => x.type === 'event');
  const untimed = ev.filter((x) => titleMinutes(x.title) === null).sort((a, b) => created(a) - created(b));
  const timed = ev.filter((x) => titleMinutes(x.title) !== null).sort((a, b) => titleMinutes(a.title) - titleMinutes(b.title) || created(a) - created(b));
  const td = list.filter((x) => x.type === 'todo');
  const rank = (x) => ((x.status || 'progress') === 'progress' ? 0 : 1);
  td.sort((a, b) => rank(a) - rank(b) || created(a) - created(b));
  return [...untimed, ...timed, ...td];
}

// 한 주(7일)에 들어갈 막대 배치: [{item, col, span, lane}]
export function layoutWeek(items, days, today) {
  const ws = days[0], we = days[6];
  const segs = [];
  for (const it of items) {
    const s = shownDate(it, today);
    const e = it.type === 'event' ? itemEnd(it) : s;
    if (e < ws || s > we) continue;
    const cs = s < ws ? ws : s;
    const ce = e > we ? we : e;
    segs.push({ item: it, col: diffDays(ws, cs), span: diffDays(cs, ce) + 1, multi: e > s });
  }
  // 여러 날 일정 먼저, 그다음 날짜·하루 정렬 순서
  const order = new Map();
  for (const d of days) sortDay(itemsOnDay(items, d, today)).forEach((it, i) => { if (!order.has(it.id)) order.set(it.id, i); });
  segs.sort((a, b) => (b.multi - a.multi) || (a.col - b.col) || (b.span - a.span) || ((order.get(a.item.id) ?? 0) - (order.get(b.item.id) ?? 0)));
  const lanes = [];
  for (const sg of segs) {
    let lane = 0;
    for (;;) {
      const row = lanes[lane] || (lanes[lane] = Array(7).fill(false));
      let free = true;
      for (let c = sg.col; c < sg.col + sg.span; c++) if (row[c]) { free = false; break; }
      if (free) { for (let c = sg.col; c < sg.col + sg.span; c++) row[c] = true; sg.lane = lane; break; }
      lane++;
    }
  }
  return segs;
}

// 색: 밝은 바탕 위 글씨색(같은 계열 진한 색)
export function textOn(hex) {
  const h = (hex || '#CFCFCF').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hh = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh /= 6;
  }
  // 어두운 바탕이면 흰 글씨
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (lum < 0.45) return '#FFFFFF';
  return `hsl(${Math.round(hh * 360)}, ${Math.round(Math.min(s, 0.65) * 100)}%, 20%)`;
}

export const PALETTE = ['#A9C7F2', '#9ED8D6', '#A8DABA', '#D6E3A0', '#F3CD95', '#F5B49E', '#F2B3C7', '#C7B9F0', '#7FAEEA', '#74C4C1', '#7FC79B', '#C2D27A', '#EDB566', '#EE9579', '#E98BAA', '#A996E6', '#CFCFCF', '#B0B0B0'];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
