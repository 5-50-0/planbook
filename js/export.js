// 엑셀·캘린더 파일 내보내기
import { addDays, ymd } from './util.js';

let xlsxP = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!xlsxP) {
    xlsxP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = () => res(window.XLSX);
      s.onerror = () => { xlsxP = null; rej(new Error('엑셀 도구를 불러오지 못했어요')); };
      document.head.appendChild(s);
    });
  }
  return xlsxP;
}

function sheet(X, rows, headers, widths) {
  const ws = X.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(headers.map((h) => [h, '']))], { header: headers });
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  return ws;
}

export function downloadBlob(name, blob) {
  // 안드로이드 앱 안에서는 앱이 직접 다운로드 폴더에 저장
  if (window.PlanbookBridge && window.PlanbookBridge.saveFile) {
    const r = new FileReader();
    r.onload = () => window.PlanbookBridge.saveFile(String(r.result).split(',')[1] || '', name, blob.type || 'application/octet-stream');
    r.readAsDataURL(blob);
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

// sheets: [{name, headers, widths, rows}]
export async function writeXlsx(fileName, sheets) {
  const X = await loadXLSX();
  const wb = X.utils.book_new();
  sheets.forEach((s) => X.utils.book_append_sheet(wb, sheet(X, s.rows, s.headers, s.widths), s.name));
  const out = X.write(wb, { type: 'array', bookType: 'xlsx' });
  downloadBlob(fileName, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

// ----- iCalendar (.ics) -----
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const dt = (s) => s.replace(/-/g, '');
function fold(line) {
  const out = []; let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}
const WDK = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// events: [{uid,title,start,end,memo,cat}], routines: [{...rule, lunarDates:[...]}]
export function buildIcs(events, routines) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//planbook//KO', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:플랜북'];
  const ev = (uid, title, s, e, memo, cat, rrule) => {
    L.push('BEGIN:VEVENT', `UID:${uid}@planbook`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dt(s)}`, `DTEND;VALUE=DATE:${dt(addDays(e, 1))}`, fold(`SUMMARY:${icsEsc(title)}`));
    if (memo) L.push(fold(`DESCRIPTION:${icsEsc(memo)}`));
    if (cat) L.push(fold(`CATEGORIES:${icsEsc(cat)}`));
    if (rrule) L.push(rrule);
    L.push('END:VEVENT');
  };
  events.forEach((x) => ev(x.uid, x.title, x.start, x.end || x.start, x.memo, x.cat));
  routines.forEach((r) => {
    if (r.rep === 'yearly' && r.lunar) {
      (r.lunarDates || []).forEach((d, i) => ev(`${r.id}-${i}`, r.title, d, d, r.memo, r.catName));
      return;
    }
    let rule = '';
    if (r.rep === 'daily') rule = 'RRULE:FREQ=DAILY';
    else if (r.rep === 'weekly') rule = `RRULE:FREQ=WEEKLY;BYDAY=${(r.wdays || []).map((w) => WDK[w]).join(',') || 'MO'}`;
    else if (r.rep === 'monthly') rule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${r.mday || 1}`;
    else { const [mm, dd] = (r.md || '01-01').split('-').map(Number); rule = `RRULE:FREQ=YEARLY;BYMONTH=${mm};BYMONTHDAY=${dd}`; }
    if (r.end) rule += `;UNTIL=${dt(r.end)}`;
    ev(r.id, r.title, r.firstDate || r.start, r.firstDate || r.start, r.memo, r.catName, rule);
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}

export const stampName = () => ymd(new Date()).replace(/-/g, '');
