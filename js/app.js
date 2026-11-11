import * as D from './data.js';
import { HOLIDAYS } from './holidays.js';
import {
  ymd, parse, addDays, todayStr, WD, EN_MONTH, weekStart, monthWeeks, weekOfMonth,
  itemsOnDay, sortDay, layoutWeek, textOn, PALETTE, uid, esc, isCarried, itemEnd,
} from './util.js';
import { occItems, occDates, nextOcc, ruleText, lunarToSolar } from './routine.js';
import { writeXlsx, buildIcs, downloadBlob, stampName } from './export.js';

export const APP_VERSION = '1.4.3';

const NI = {
  month: '<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4"/><circle cx="8" cy="14" r=".6"/><circle cx="12" cy="14" r=".6"/><circle cx="16" cy="14" r=".6"/><circle cx="8" cy="17.3" r=".6"/><circle cx="12" cy="17.3" r=".6"/>',
  week: '<rect x="3.5" y="4.5" width="17" height="16" rx="3"/><path d="M3.5 9.5h17M8 2.5v4M16 2.5v4M7.5 14.5h9"/>',
  proj: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M8.5 14l2.2 2.2 4.5-4.5"/>',
  mini: '<path d="M5.5 4.5a2 2 0 0 1 2-2h11v17h-11a2 2 0 0 0-2 2z"/><path d="M5.5 19.5v-15M9.5 7.5h5"/>',
  year: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r=".9"/><circle cx="8" cy="12" r=".9"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r=".9"/><circle cx="16" cy="16" r=".9"/>',
  routine: '<path d="M17 3.5l3 3-3 3"/><path d="M4 11v-1.5a3 3 0 0 1 3-3h13M7 20.5l-3-3 3-3"/><path d="M20 13v1.5a3 3 0 0 1-3 3H4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
};
const nIc = (k) => `<svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NI[k]}</svg>`;
const IC = {
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  sync: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1"/><path d="M18.5 3v4.3h-4.3M5.5 21v-4.3h4.3"/></svg>',
  l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 6l-6 6 6 6"/></svg>',
  r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6l6 6-6 6"/></svg>',
  set: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="14" height="14" role="img" aria-label="미니북 연결됨"><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z"/><path d="M9 3v18M12 8h3M12 12h3"/></svg>',
};
const small = (svg, n = 16) => svg.replace('<svg', `<svg width="${n}" height="${n}"`);

const DEFAULT_SETTINGS = () => ({
  cats: [
    { id: 'c_work', name: '회사', color: '#A9C7F2', subs: [{ id: uid(), name: '회의', color: null }] },
    { id: 'c_me', name: '개인', color: '#F2B3C7', subs: [] },
    { id: 'c_att', name: '근태', color: '#F3CD95', subs: [{ id: uid(), name: '출장', color: null }, { id: uid(), name: '휴가', color: null }, { id: uid(), name: '여행', color: null }] },
  ],
  todoColor: '#CFCFCF', defCat: 'c_work', defSub: '', topics: [],
  backupVer: APP_VERSION,
});

const S = {
  user: undefined, items: [], notes: [], records: [], routines: [], yb: [], projects: [], settings: null, pjTab: 'progress', pjId: null,
  loaded: {}, view: 'month', sel: todayStr(), month: null,
  loginView: 'login', loginErr: '', loginMsg: '', busy: false,
  sheet: null, acc: { cats: false, topics: false, data: false, acct: false },
  toast: '', delArm: false, mbTab: 'meet', year: new Date().getFullYear(), topic: null,
};
let unwatch = null;
const $app = document.getElementById('app');
const wide = () => window.innerWidth >= 900;
const U = () => S.user.uid;

// ---------- 색·분류 ----------
const catOf = (id) => (S.settings?.cats || []).find((c) => c.id === id);
const topicOf = (id) => (S.settings?.topics || []).find((t) => t.id === id);
function colorOf(it) {
  if (!it) return '#111111';
  if (it.type === 'todo') return S.settings?.todoColor || '#CFCFCF';
  const c = catOf(it.cat);
  if (!c) return '#CFCFCF';
  const s = (c.subs || []).find((x) => x.id === it.sub);
  return (s && s.color) || c.color;
}
const sty = (hex) => `--c:${hex};--t:${textOn(hex)}`;
const catLabel = (it) => { const c = catOf(it.cat); if (!c) return ''; const s = (c.subs || []).find((x) => x.id === it.sub); return c.name + (s ? ' › ' + s.name : ''); };

// ---------- 공통 ----------
function toast(msg) {
  S.toast = msg; render();
  clearTimeout(toast.t); toast.t = setTimeout(() => { S.toast = ''; render(); }, 2400);
}
function dayClass(d) {
  const w = parse(d).getDay();
  return HOLIDAYS[d] ? 'hol' : w === 0 ? 'sun' : w === 6 ? 'sat' : '';
}
const fmtMD = (d) => { const x = parse(d); return `${x.getMonth() + 1}월 ${x.getDate()}일 (${WD[x.getDay()]})`; };
const fmtDot = (d) => { const x = parse(d); return `${x.getMonth() + 1}.${x.getDate()}`; };
const allItems = (from, to) => S.items.concat(occItems(S.routines, from, to));
const findItem = (id) => S.items.find((x) => x.id === id);
const linkedNotes = (id) => S.notes.filter((n) => n.linkId === id);

// ---------- 로그인 ----------
const AUTH_ERR = {
  'auth/invalid-email': '이메일 형식을 확인해 주세요.',
  'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않아요.',
  'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않아요.',
  'auth/user-not-found': '가입되지 않은 이메일이에요.',
  'auth/email-already-in-use': '이미 가입된 이메일이에요.',
  'auth/weak-password': '비밀번호는 6자 이상이어야 해요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 후 다시 해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
  'auth/missing-password': '비밀번호를 입력해 주세요.',
};
const authMsg = (e) => AUTH_ERR[e.code] || `문제가 생겼어요 (${e.code || e.message})`;
const logoHtml = () => '<div class="logo"><span style="width:100%;background:#A9C7F2"></span><span style="width:78%;background:#F2B3C7"></span><span style="width:56%;background:#F3CD95"></span></div>';

function loginHtml() {
  const v = S.loginView;
  const err = S.loginErr ? `<p class="err">${esc(S.loginErr)}</p>` : '';
  let body = '';
  if (v === 'login') {
    body = `<h2>로그인</h2>
      <label class="lb" for="em">이메일</label><input id="em" type="email" autocomplete="email">
      <label class="lb" for="pw">비밀번호</label><input id="pw" type="password" autocomplete="current-password">
      ${err}<button class="btn pri" data-act="doLogin" ${S.busy ? 'disabled' : ''}>로그인</button>
      <div class="links"><button class="lk" data-act="lv" data-v="reset">비밀번호 찾기</button><button class="lk" data-act="lv" data-v="signup">계정 만들기</button></div>`;
  } else if (v === 'signup') {
    body = `<h2>계정 만들기</h2>
      <label class="lb" for="em">이메일</label><input id="em" type="email" autocomplete="email">
      <label class="lb" for="pw">비밀번호</label><input id="pw" type="password" autocomplete="new-password">
      <label class="lb" for="pw2">비밀번호 확인</label><input id="pw2" type="password" autocomplete="new-password">
      ${err}<button class="btn pri" data-act="doSignup" ${S.busy ? 'disabled' : ''}>가입하기</button>
      <div class="links"><button class="lk" data-act="lv" data-v="login">로그인으로 돌아가기</button></div>`;
  } else {
    body = `<h2>비밀번호 찾기</h2>
      <label class="lb" for="em">가입한 이메일</label><input id="em" type="email" autocomplete="email">
      ${err}${S.loginMsg ? `<p class="ok">${esc(S.loginMsg)}</p>` : ''}
      <button class="btn pri" data-act="doReset" ${S.busy ? 'disabled' : ''}>재설정 메일 보내기</button>
      <div class="links"><button class="lk" data-act="lv" data-v="login">로그인으로 돌아가기</button></div>`;
  }
  return `<div class="login"><div class="box">${logoHtml()}<h1>플랜북</h1><div class="rule"></div>${body}</div></div>`;
}

// ---------- 머리 ----------
function headTools(prev, next, opt = {}) {
  const W = wide();
  const nav = prev ? (W
    ? `<button class="ico bd" aria-label="이전" data-act="${prev}">${IC.l}</button>${opt.today === false ? '' : '<button class="today" data-act="goToday">오늘</button>'}<button class="ico bd" aria-label="다음" data-act="${next}">${IC.r}</button>`
    : `<button class="ico" aria-label="이전" data-act="${prev}">${IC.l}</button>${opt.today === false ? '' : '<button class="today" data-act="goToday">오늘</button>'}<button class="ico" aria-label="다음" data-act="${next}">${IC.r}</button>`) : '';
  const extra = (opt.extra || '') + (opt.plus ? PLUS(opt.plus) : '');
  const set = W ? '' : `<button class="ico ${S.syncing ? 'spin' : ''}" aria-label="동기화" data-act="sync">${IC.sync}</button><button class="ico" aria-label="설정" data-act="nav" data-v="settings">${IC.set}</button>`;
  return `<div class="tools">${nav}${extra}${set}</div>`;
}
const PLUS = (a='fab') => `<button class="ico plus" aria-label="추가" data-act="${a}">${IC.plus}</button>`;
const titleHead = (t, tools = '') => `<div class="head"><div class="big"><h1 class="word">${t}</h1></div>${tools || headTools()}</div>`;

// ---------- 먼슬리 ----------
function monthHead() {
  const [y, m] = S.month;
  return `<div class="head"><div class="big"><h1>${m + 1}</h1><div class="sub"><p class="y">${y}</p><p class="m">${EN_MONTH[m]}</p></div></div>${headTools('mPrev', 'mNext')}</div>`;
}
function monthBody() {
  const [y, m] = S.month;
  const weeks = monthWeeks(y, m);
  const today = todayStr();
  const W = wide();
  const list = allItems(weeks[0][0], weeks[weeks.length - 1][6]);
  const headH = W ? 150 : 100, navH = W ? 0 : 64;
  const avail = window.innerHeight - headH - navH - 30;
  const weekH = Math.max(W ? 90 : 60, avail / weeks.length);
  const laneH = W ? 23 : 18, topH = W ? 30 : 22;
  const maxL = Math.max(1, Math.floor((weekH - topH) / laneH));
  let h = `<div class="wdrow">${WD.map((w, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}</div>`;
  for (const days of weeks) {
    const segs = layoutWeek(list, days, today);
    const hidden = Array(7).fill(0);
    segs.forEach((s) => { if (s.lane >= maxL) for (let c = s.col; c < s.col + s.span; c++) hidden[c]++; });
    h += `<div class="wk" style="grid-template-rows:${topH}px repeat(${maxL},${laneH - 2}px)">`;
    days.forEach((d, i) => {
      const cls = ['cell', dayClass(d), parse(d).getMonth() !== m ? 'other' : '', d === today ? 'today' : '', W && d === S.sel ? 'sel' : ''].join(' ');
      const hol = HOLIDAYS[d] && W ? `<span class="hn">${HOLIDAYS[d]}</span>` : '';
      const more = hidden[i] ? `<span class="more" data-act="daySheet" data-d="${d}">+${hidden[i]}</span>` : '';
      h += `<button class="${cls}" style="grid-column:${i + 1}" data-act="addOn" data-d="${d}" aria-label="${fmtMD(d)} 새 일정"><span class="n">${parse(d).getDate()}</span>${hol}${more}</button>`;
    });
    segs.filter((s) => s.lane < maxL).forEach((s) => {
      const c = colorOf(s.item);
      // 이번 달이 아닌 날에 걸친 부분은 옅게
      const inM = days.slice(s.col, s.col + s.span).map((d) => parse(d).getMonth() === m);
      const nIn = inM.filter(Boolean).length;
      let bg = c, cls = 'chip';
      if (!nIn) { bg = fadeHex(c); cls += ' other'; }
      else if (nIn < s.span) {
        const f = fadeHex(c), lead = inM.indexOf(true), tail = s.span - 1 - inM.lastIndexOf(true);
        const p1 = (lead / s.span) * 100, p2 = 100 - (tail / s.span) * 100;
        bg = `linear-gradient(to right,${f} 0 ${p1}%,${c} ${p1}% ${p2}%,${f} ${p2}% 100%)`;
      }
      if (s.item.type === 'todo') {
        const st = s.item.status || 'progress', isR = s.item.id.startsWith('r~');
        const done = st !== 'progress';
        const tc = colorOf(s.item);
        h += `<button class="${cls} td ${done ? 'done' : ''}" style="grid-column:${s.col + 1}/span ${s.span};grid-row:${s.lane + 2};--tc:${shadeHex(tc, 0.55)};--tb:${shadeHex(tc, 0.4)};--tl:${shadeHex(tc, 0.08)}" data-act="open" data-id="${s.item.id}"><span class="cb ${st === 'done' ? 'on' : ''}" ${isR ? '' : `data-act="tdTog" data-id="${s.item.id}"`} role="checkbox" aria-checked="${st === 'done'}" aria-label="완료">${st === 'done' ? IC.check : ''}</span><span class="tt">${esc(s.item.title || '(제목 없음)')}</span></button>`;
        return;
      }
      h += `<button class="${cls}" style="grid-column:${s.col + 1}/span ${s.span};grid-row:${s.lane + 2};background:${bg};color:${textOn(c)}" data-act="open" data-id="${s.item.id}">${esc(s.item.title || '(제목 없음)')}</button>`;
    });
    h += '</div>';
  }
  return `<div class="month">${h}</div>`;
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16), dk = (v) => Math.round(v * (1 - k));
  return `rgb(${dk(n >> 16)},${dk((n >> 8) & 255)},${dk(n & 255)})`;
}
function fadeHex(hex) {
  const n = parseInt(hex.slice(1), 16), mix = (v) => Math.round(v + (255 - v) * 0.62);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}
function cardHtml(it) {
  const c = colorOf(it);
  const memo = it.memo ? `<div class="cm">${esc(it.memo)}</div>` : '';
  const nt = !it.routine && linkedNotes(it.id).length ? `<span class="ni">${IC.note}</span>` : '';
  return `<button class="card" style="${sty(c)}" data-act="open" data-id="${it.id}"><div class="ch"><span class="tt">${esc(it.title || '(제목 없음)')}</span>${nt}</div>${memo}</button>`;
}
function dayList(d) {
  return sortDay(itemsOnDay(allItems(d, d), d, todayStr())).map(cardHtml).join('');
}

// ---------- 위클리 ----------
function weekHead() {
  const ws = weekStart(S.sel);
  const we = addDays(ws, 6);
  const wm = weekOfMonth(S.sel);
  return `<div class="head"><div class="big"><h1>W${wm.n}</h1><div class="sub"><p class="y">${wm.year} · ${wm.month}월 ${wm.n}주차</p><p class="m">${fmtDot(ws)} – ${fmtDot(we)}</p></div></div>${headTools('wPrev', 'wNext')}</div>`;
}
function weekBody() {
  const ws = weekStart(S.sel);
  const today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  if (wide()) {
    return `<div class="wgrid">${days.map((d) => `<div class="wcol ${d === today ? 'today' : ''}">
      <div><span class="dnum ${d === today ? '' : dayClass(d)}">${parse(d).getDate()}</span></div>
      <div class="dwk ${dayClass(d)}">${WD[parse(d).getDay()]}요일${HOLIDAYS[d] ? ' · ' + HOLIDAYS[d] : ''}</div>
      ${dayList(d)}<button class="dadd" data-act="newOn" data-d="${d}" aria-label="${fmtMD(d)} 추가"></button></div>`).join('')}</div>`;
  }
  return `<div class="wlist">${days.map((d) => `<div class="wday ${d === today ? 'today' : ''}">
    <div><span class="dnum ${d === today ? '' : dayClass(d)}">${parse(d).getDate()}</span><div class="dwk ${dayClass(d)}">${WD[parse(d).getDay()]}${HOLIDAYS[d] ? ' · ' + HOLIDAYS[d] : ''}</div></div>
    <div>${dayList(d)}</div></div>`).join('')}</div>`;
}

// ---------- 미니북 ----------
function noteColor(n) { const it = n.linkId && findItem(n.linkId); return it ? colorOf(it) : '#111111'; }
function miniBody() {
  const tab = (k, l) => `<button class="tab ${S.mbTab === k ? 'on' : ''}" data-act="mbTab" data-v="${k}">${l}</button>`;
  let h = titleHead('미니북', headTools(null, null, { plus: S.mbTab === 'rec' ? '' : 'fab' })) + `<div class="pad"><div class="tabs">${tab('meet', '회의')}${tab('memo', '메모')}${tab('rec', '기록')}</div>`;
  const byDate = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.created || 0) - (a.created || 0);
  if (S.mbTab === 'meet') {
    const list = S.notes.filter((n) => n.kind === 'meeting').sort(byDate);
    h += '<div class="cards">' + list.map((n) => {
      const c = noteColor(n);
      return `<button class="card" style="${sty(c)}" data-act="openNote" data-id="${n.id}"><div class="ch"><span class="tt">${esc(n.title || '(제목 없음)')}</span><small>${n.date ? fmtDot(n.date) : ''}</small></div>
        <div class="kv"><span>일자</span><span>${n.date ? n.date.replace(/-/g, '.') : ''}${n.time ? ' ' + esc(n.time) : ''}</span><span>장소</span><span>${esc(n.place || '')}</span><span>참석자</span><span>${esc(n.attendees || '')}</span></div>
        ${n.content ? `<div class="cm clamp">${esc(n.content)}</div>` : ''}</button>`;
    }).join('') + '</div>';
  } else if (S.mbTab === 'memo') {
    const list = S.notes.filter((n) => n.kind === 'memo').sort(byDate);
    h += list.map((n) => {
      const it = n.linkId && findItem(n.linkId);
      return `<button class="mm" data-act="openNote" data-id="${n.id}"><div class="mt"><b>${esc(n.title || '(제목 없음)')}</b><small>${n.date ? fmtDot(n.date) : ''}</small></div>
        ${n.content ? `<div class="mb">${esc(n.content)}</div>` : ''}${it ? `<div class="lkd"><i style="background:${colorOf(it)}"></i>${fmtDot(it.start)} ${esc(it.title)}</div>` : ''}</button>`;
    }).join('');
  } else {
    h += salSections();
    h += recSection('cert', '자격증', ['자격증명', '취득일', '발급기관'], (r) => [r.name, (r.date || '').replace(/-/g, '.'), r.issuer], (a, b) => (a.date || '').localeCompare(b.date || ''));
    h += recSection('edu', '교육', ['교육명', '기관', '수료일'], (r) => [r.name, r.org, (r.end || '').replace(/-/g, '.')], (a, b) => (b.end || '').localeCompare(a.end || ''));
  }
  return h + '</div>';
}
function recSection(kind, label, heads, cols, sort) {
  const rows = S.records.filter((r) => r.kind === kind).sort(sort);
  return `<div class="sec"><div class="sh"><span>${label}</span><button aria-label="${label} 추가" data-act="recNew" data-v="${kind}">${small(IC.plus, 18)}</button></div>
    <table><thead><tr>${heads.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r) => `<tr data-act="recOpen" data-id="${r.id}">${cols(r).map((v) => `<td>${esc(v ?? '')}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}

// ---------- 이어북 ----------
const ybDoc = (topic, year) => S.yb.find((x) => x.id === `${topic}_${year}`);
function linkedDays(topic, year) {
  const set = new Map();
  const ys = `${year}-01-01`, ye = `${year}-12-31`;
  S.items.filter((it) => it.yb === topic).forEach((it) => {
    const s = it.start < ys ? ys : it.start, e = itemEnd(it) > ye ? ye : itemEnd(it);
    for (let d = s; d <= e; d = addDays(d, 1)) set.set(d, it.id);
  });
  return set;
}
function yearBody() {
  const topics = S.settings.topics || [];
  if (!S.topic || !topicOf(S.topic)) S.topic = topics[0]?.id || null;
  const tp = topicOf(S.topic);
  let h = `<div class="head"><div class="big"><h1>${S.year}</h1></div>${headTools('yPrev', 'yNext', { today: false, extra: tp ? '<button class="today" data-act="nav" data-v="ysum">요약</button>' : '', plus: 'topicNew' })}</div><div class="pad">`;
  h += `<div class="chips">${topics.map((t) => `<button class="chip2 ${t.id === S.topic ? 'on' : ''}" data-act="topicSel" data-id="${t.id}">${esc(t.name)}</button>`).join('')}
    ${tp ? `<button class="chip2 ghost" data-act="topicEdit" data-id="${tp.id}">편집</button>` : ''}</div>`;
  if (!tp) return h + '</div>';
  const doc = ybDoc(tp.id, S.year);
  const manual = new Set(doc?.days || []);
  const linked = linkedDays(tp.id, S.year);
  const W = wide();
  const cellH = W ? 24 : 16;
  h += `<div class="ygrid"><span></span>${Array.from({ length: 31 }, (_, i) => `<span class="yd">${W || [0, 9, 19, 29].includes(i) ? i + 1 : ''}</span>`).join('')}`;
  for (let m = 0; m < 12; m++) {
    const n = new Date(S.year, m + 1, 0).getDate();
    h += `<span class="ym">${m + 1}${W ? '월' : ''}</span>`;
    for (let d = 1; d <= 31; d++) {
      if (d > n) { h += '<span></span>'; continue; }
      const k = ymd(new Date(S.year, m, d));
      const on = manual.has(k) || linked.has(k);
      h += `<button class="yc" style="height:${cellH}px;background:${on ? tp.color : '#EDEDED'}" aria-label="${m + 1}월 ${d}일" data-act="ybTog" data-d="${k}" ${linked.has(k) ? `data-link="${linked.get(k)}"` : ''}></button>`;
    }
  }
  h += '</div>';
  h += `<div class="sec" style="margin-top:18px"><div class="sh"><span>메모</span></div><textarea class="ymemo" aria-label="${S.year}년 ${esc(tp.name)} 메모" data-ybmemo="1">${esc(doc?.memo || '')}</textarea></div>`;
  return h + '</div>';
}
function rangesOf(days) {
  const s = [...new Set(days)].sort();
  const out = [];
  for (const d of s) {
    const last = out[out.length - 1];
    if (last && addDays(last[1], 1) === d) last[1] = d; else out.push([d, d]);
  }
  return out;
}
function summaryData(topic) {
  const years = new Set(S.yb.filter((x) => x.topic === topic).map((x) => x.year));
  S.items.filter((it) => it.yb === topic).forEach((it) => { for (let y = parse(it.start).getFullYear(); y <= parse(itemEnd(it)).getFullYear(); y++) years.add(y); });
  return [...years].sort((a, b) => b - a).map((y) => {
    const days = [...(ybDoc(topic, y)?.days || []), ...linkedDays(topic, y).keys()];
    const ranges = rangesOf(days);
    return { year: y, ranges, total: ranges.reduce((a, r) => a + (parse(r[1]) - parse(r[0])) / 86400000 + 1, 0), memo: ybDoc(topic, y)?.memo || '' };
  }).filter((r) => r.ranges.length || r.memo);
}
const md = (d) => { const x = parse(d); return `${x.getMonth() + 1}월 ${x.getDate()}일`; };
function ysumBody() {
  const tp = topicOf(S.topic);
  if (!tp) { S.view = 'year'; return yearBody(); }
  const rows = summaryData(tp.id);
  let h = `<div class="head"><div class="big" style="align-items:center"><button class="ico" aria-label="이어북으로" data-act="nav" data-v="year">${IC.l}</button><h1 class="word" style="font-size:28px;letter-spacing:0;font-weight:500">요약</h1><span class="badge" style="border-color:${tp.color}">${esc(tp.name)}</span></div>
    <div class="tools"><button class="btn sm pri" data-act="ysumXlsx">엑셀로 내보내기</button></div></div><div class="pad ygrid2">`;
  h += rows.map((r) => `<div class="sec"><div class="sh"><span>${r.year}년</span><small>${r.ranges.length}회 · ${r.total}일</small></div>
    ${r.ranges.map(([a, b]) => `<div class="pr"><span>${a === b ? md(a) : `${md(a)} ~ ${md(b)}`}</span><span>${(parse(b) - parse(a)) / 86400000 + 1}일</span></div>`).join('')}
    ${r.memo ? `<div class="cm" style="padding:8px 12px">${esc(r.memo)}</div>` : ''}</div>`).join('');
  return h + '</div>';
}

// ---------- 루틴북 ----------
function routineBody() {
  const today = todayStr();
  let h = titleHead('루틴북', headTools(null, null, { plus: 'fab' })) + '<div class="pad">';
  [['daily', '매일'], ['weekly', '매주'], ['monthly', '매월'], ['yearly', '매년']].forEach(([k, l]) => {
    const list = S.routines.filter((r) => r.rep === k).sort((a, b) => (nextOcc(a, today) || '9').localeCompare(nextOcc(b, today) || '9'));
    if (!list.length) return;
    h += `<div class="sl">${l}</div>` + list.map((r) => {
      const c = colorOf({ type: r.kind, cat: r.cat, sub: r.sub });
      const nx = nextOcc(r, today);
      return `<button class="card" style="${sty(c)}" data-act="rtOpen" data-id="${r.id}"><div class="ch"><span class="tt">${esc(r.title)}</span></div><div class="cm rr"><span>${esc(ruleText(r))}</span><span class="muted">${nx ? `다음 ${fmtDot(nx)} (${WD[parse(nx).getDay()]})` : '끝남'}</span></div></button>`;
    }).join('');
  });
  return h + '</div>';
}

// ---------- 설정 ----------
function settingsBody() {
  const st = S.settings;
  const A = S.acc;
  let h = `<div class="head"><div class="big"><h1 class="word">설정</h1></div>${wide() ? '' : `<div class="tools"><button class="ico" aria-label="닫기" data-act="nav" data-v="month">${IC.x}</button></div>`}</div><div class="setpage">`;
  h += `<button class="acc" data-act="acc" data-v="cats"><span>분류와 색</span><span>${A.cats ? '−' : '+'}</span></button>`;
  if (A.cats) {
    h += `<button class="row hl" data-act="defCat"><b>기본 분류</b><span class="vl">${esc(catLabel({ cat: st.defCat, sub: st.defSub }) || '없음')}</span></button>`;
    h += `<div class="sorthd"><span>분류</span><button data-act="sortAbc" data-v="cats">가나다순</button></div><div data-sort="cats">`;
    st.cats.forEach((c) => {
      h += `<div class="sitem"><div class="srow"><span class="grip" aria-label="순서 바꾸기">${IC.grip}</span><button class="row" data-act="catEdit" data-id="${c.id}"><span class="sw" style="background:${c.color}"></span>${esc(c.name)}<span class="vl">세분류 ${(c.subs || []).length}</span></button></div>`;
      (c.subs || []).forEach((s) => {
        h += `<button class="row sub" data-act="catEdit" data-id="${c.id}"><span class="sw" style="background:${s.color || c.color}"></span>${esc(s.name)}<span class="vl">${s.color ? '직접 지정' : '대분류 색'}</span></button>`;
      });
      h += '</div>';
    });
    h += '</div>';
    h += `<button class="row" data-act="todoColor"><span class="sw" style="background:${st.todoColor}"></span>할 일</button>`;
    h += `<button class="row" data-act="catNew" style="font-size:14px">${small(IC.plus)}분류 추가</button>`;
  }
  h += `<button class="acc" data-act="acc" data-v="topics"><span>이어북 주제 색</span><span>${A.topics ? '−' : '+'}</span></button>`;
  if (A.topics) {
    h += `<div class="sorthd"><span>주제</span><button data-act="sortAbc" data-v="topics">가나다순</button></div><div data-sort="topics">`;
    (st.topics || []).forEach((t) => { h += `<div class="sitem"><div class="srow"><span class="grip" aria-label="순서 바꾸기">${IC.grip}</span><button class="row" data-act="topicEdit" data-id="${t.id}"><span class="sw" style="background:${t.color}"></span>${esc(t.name)}</button></div></div>`; });
    h += '</div>';
    h += `<button class="row" data-act="topicNew" style="font-size:14px">${small(IC.plus)}주제 추가</button>`;
  }
  h += `<button class="acc" data-act="acc" data-v="data"><span>데이터</span><span>${A.data ? '−' : '+'}</span></button>`;
  if (A.data) {
    const CKS = { ok: ['일치', '#2E7D4F'], less: ['확인 필요', '#A32D2D'], none: ['백업 없음', '#6B6B6B'] }[S.ckStatus] || ['', ''];
    h += `<button class="row hl" data-act="ckOpen"><b>데이터 점검</b><span class="vl" style="color:${CKS[1]}">${CKS[0]}</span></button>`;
    h += `<button class="row" data-act="xlsxOpen">엑셀로 내보내기<span class="vl">.xlsx</span></button>
      <button class="row" data-act="icsOpen">구글 캘린더용 내보내기<span class="vl">.ics</span></button>
      <button class="row" data-act="exportJson">백업 파일 받기<span class="vl">.json</span></button>
      <button class="row" data-act="importJson">백업 파일로 복원</button>
      <button class="row" data-act="backups">자동 백업 목록</button>
      <input type="file" id="imp" accept=".json,application/json" hidden>`;
  }
  h += `<button class="acc" data-act="acc" data-v="acct"><span>계정</span><span>${A.acct ? '−' : '+'}</span></button>`;
  if (A.acct) {
    h += `<div class="row">로그인 계정<span class="vl">${esc(S.user?.email || '')}</span></div>
      <button class="row" data-act="pinSet">기록 잠금 비밀번호<span class="vl">${S.settings.recPin ? '설정됨' : '없음'}</span></button>
      <button class="row red" data-act="logout">로그아웃</button>
      <div class="row">앱 버전<span class="vl">${APP_VERSION}</span></div>`;
  }
  return h + '</div>';
}

// ---------- 팝업 ----------
const band = (color, text, closeAct = 'close') => `<div class="band" style="background:${color};color:${textOn(color)}"><span id="bandT">${esc(text)}</span><button class="x" aria-label="닫기" data-act="${closeAct}">${IC.x}</button></div>`;
const seg = (opts, cur, act, n) => `<div class="seg" style="grid-template-columns:repeat(${n || opts.length},minmax(0,1fr))">${opts.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-v="${k}">${l}</button>`).join('')}</div>`;
const bandIn = (color, val, f = 'title', label = '제목') => `<div class="band in" style="background:${color};color:${textOn(color)}"><input id="bandT" data-f="${f}" value="${esc(val ?? '')}" aria-label="${label}" style="color:inherit" autocomplete="off"><button class="x" aria-label="닫기" data-act="close">${IC.x}</button></div>`;
const field = (label, f, val, type = 'text', extra = '') => `<label class="lb" for="f_${f}">${label}</label><input id="f_${f}" type="${type}" data-f="${f}" value="${esc(val ?? '')}" ${extra}>`;
const area = (label, f, val, h = 96) => `<label class="lb" for="f_${f}">${label}</label><textarea id="f_${f}" data-f="${f}" style="height:${h}px">${esc(val ?? '')}</textarea>`;
const errLine = (sh) => (sh.err ? `<p class="err">${esc(sh.err)}</p>` : '');
const acts = (delAct, saveAct, isNew) => `<div class="acts">${isNew || !delAct ? '' : `<button class="btn del" data-act="${delAct}">${S.delArm ? '정말 삭제' : '삭제'}</button>`}<button class="btn pri" data-act="${saveAct}">저장</button></div>`;
function catSelects(d) {
  const cat = catOf(d.cat);
  return `<div class="two"><select aria-label="대분류" data-f="cat">${S.settings.cats.map((x) => `<option value="${x.id}" ${x.id === d.cat ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <select aria-label="세분류" data-f="sub"><option value="">세분류 없음</option>${((cat && cat.subs) || []).map((x) => `<option value="${x.id}" ${x.id === d.sub ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>`;
}

function sheetHtml() {
  const sh = S.sheet;
  if (!sh) return '';
  const F = {
    day: () => `${band('#111111', `${fmtMD(sh.d)}${HOLIDAYS[sh.d] ? ' · ' + HOLIDAYS[sh.d] : ''}`)}<div style="margin-top:12px">${dayList(sh.d)}</div><button class="btn pri" style="width:100%;margin-top:8px" data-act="newOn" data-d="${sh.d}">추가</button>`,
    edit: editHtml, cat: catHtml, topic: catHtml, note: noteHtml, rec: recHtml, rt: rtHtml, rocc: roccHtml, defcat: defCatHtml,
    backups: backupsHtml, check: checkHtml, impPrev: impPrevHtml, impRes: impResHtml,
    ct: ctHtml, bn: bnHtml, pin: pinHtml,
    pjName: pjNameHtml, pjMenu: pjMenuHtml, pjDone: pjDoneHtml, pjChoose: pjChooseHtml, pjPick: pjPickHtml, plan: planHtml,
    xlsx: () => `${band('#111111', '엑셀로 내보내기')}<div class="two">${'<div>' + field('시작', 'from', sh.from, 'date') + '</div><div>' + field('끝', 'to', sh.to, 'date') + '</div>'}</div>${errLine(sh)}<div class="acts"><button class="btn pri" data-act="xlsxGo">내보내기</button></div>`,
    ics: () => `${band('#111111', '구글 캘린더용 내보내기')}<label class="check"><input type="checkbox" data-f="todos" ${sh.todos ? 'checked' : ''}> 할 일도 종일 일정으로 넣기</label>${errLine(sh)}<div class="acts"><button class="btn pri" data-act="icsGo">내보내기</button></div>`,
  };
  return `<div class="dim" data-act="close"></div><div class="sheet" role="dialog">${(F[sh.kind] || (() => ''))()}</div>`;
}

function editHtml() {
  const sh = S.sheet;
  const it = sh.draft;
  const c = colorOf(it);
  const isTodo = it.type === 'todo';
  const st = it.status || 'progress';
  const topics = S.settings.topics || [];
  let h = bandIn(c, it.title);
  if (sh.isNew) h += `<div style="margin-top:12px">${seg([['event', '일정'], ['todo', '할 일']], it.type, 'setType')}</div>`;
  if (isTodo) h += `<span class="lb">상태</span>${seg([['progress', '진행'], ['done', '완료'], ['cancel', '취소']], st, 'status')}`;
  if (isTodo && sh.doneAt) h += `<span class="lb">${st === 'cancel' ? '취소한 날' : '완료한 날'}</span>${seg([['reg', `등록일자 ${md2(sh.regDate)}`], ['today', `오늘 ${md2(todayStr())}`]], sh.doneAt, 'doneAt')}`;
  h += isTodo ? field('날짜', 'start', it.start, 'date')
    : `<div class="two"><div>${field('시작', 'start', it.start, 'date')}</div><div>${field('종료', 'end', it.end || it.start, 'date')}</div></div>`;
  if (isTodo && isCarried(it, todayStr())) h += `<p class="muted" style="font-size:13px;margin:8px 0 0">원래 날짜 ${fmtMD(it.start)}</p>`;
  h += `<span class="lb">분류</span>${catSelects(it)}`;
  h += pjSelect(it);
  h += area('메모', 'memo', it.memo);
  if (!isTodo) {
    h += `<div class="row" style="border-bottom:none;padding-bottom:0"><span>이어북에 기록</span><button class="sw2 ${it.yb ? 'on' : ''}" role="switch" aria-checked="${!!it.yb}" aria-label="이어북에 기록" data-act="ybSwitch"><i></i></button></div>`;
    if (it.yb !== undefined && it.yb !== '' && it.yb !== null) {
      h += `<select aria-label="이어북 주제" data-f="yb">${topics.map((t) => `<option value="${t.id}" ${t.id === it.yb ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
    }
  }
  if (!sh.isNew) {
    const ln = linkedNotes(it.id);
    h += `<span class="lb">미니북</span>${ln.map((n) => `<button class="row" data-act="openNote" data-id="${n.id}">${small(IC.note)}${esc(n.title || '(제목 없음)')}<span class="vl">${n.kind === 'meeting' ? '회의록' : '메모'}</span></button>`).join('')}
      <div class="two" style="margin-top:6px"><button class="btn sm" data-act="noteFrom" data-v="meeting">회의록 쓰기</button><button class="btn sm" data-act="noteFrom" data-v="memo">메모 쓰기</button></div>`;
  }
  return h + errLine(sh) + acts('delItem', 'saveItem', sh.isNew);
}

function noteHtml() {
  const sh = S.sheet, n = sh.draft;
  const it = n.linkId && findItem(n.linkId);
  const c = it ? colorOf(it) : '#111111';
  let h = bandIn(c, n.title);
  if (n.kind === 'meeting') {
    h += `<div class="two"><div>${field('일자', 'date', n.date, 'date')}</div><div>${field('시간', 'time', n.time)}</div></div>`;
    h += field('회의장소', 'place', n.place) + field('참석자', 'attendees', n.attendees) + pjSelect(n) + area('내용', 'content', n.content, 180);
  } else {
    h += field('날짜', 'date', n.date, 'date') + pjSelect(n) + area('내용', 'content', n.content, 200);
  }
  if (it) h += `<span class="lb">연결된 일정</span><div class="row"><span class="sw" style="background:${c};width:14px;height:14px"></span>${fmtDot(it.start)} ${esc(it.title)}<button class="lk" style="margin-left:auto;padding:4px" data-act="unlink">연결 해제</button></div>`;
  return h + errLine(sh) + acts('delNote', 'saveNote', sh.isNew);
}

const REC_FIELDS = {
  salary: { label: '연봉', f: [['year', '연도', 'number'], ['base', '기본연봉'], ['bonus', '성과급'], ['rank', '직급']] },
  cert: { label: '자격증', f: [['name', '자격증명'], ['date', '취득일', 'date'], ['issuer', '발급기관']] },
  edu: { label: '교육', f: [['name', '교육명'], ['org', '기관'], ['start', '시작일 (선택)', 'date'], ['end', '수료일', 'date']] },
};
function recHtml() {
  const sh = S.sheet, r = sh.draft, def = REC_FIELDS[r.kind];
  return band('#111111', def.label) + def.f.map(([k, l, t]) => field(l, k, r[k], t || 'text')).join('') + errLine(sh) + acts('delRec', 'saveRec', sh.isNew);
}

function rtHtml() {
  const sh = S.sheet, r = sh.draft;
  const c = colorOf({ type: r.kind, cat: r.cat, sub: r.sub });
  let h = bandIn(c, r.title);
  h += `<span class="lb">종류</span>${seg([['event', '일정'], ['todo', '할 일']], r.kind, 'rtKind')}`;
  h += `<span class="lb">반복</span>${seg([['daily', '매일'], ['weekly', '매주'], ['monthly', '매월'], ['yearly', '매년']], r.rep, 'rtRep')}`;
  if (r.rep === 'weekly') h += `<div class="wds">${WD.map((w, i) => `<button class="${(r.wdays || []).includes(i) ? 'on' : ''}" data-act="rtWd" data-v="${i}">${w}</button>`).join('')}</div>`;
  if (r.rep === 'monthly') h += `<div class="inl"><span>매월</span><input type="number" min="1" max="31" aria-label="날짜" data-f="mday" value="${esc(r.mday)}" style="width:80px;text-align:center"><span>일</span></div>`;
  if (r.rep === 'yearly') {
    const [mm, dd] = (r.md || '01-01').split('-').map(Number);
    h += `<div class="inl">${seg([['solar', '양력'], ['lunar', '음력']], r.lunar ? 'lunar' : 'solar', 'rtCal')}
      <select aria-label="월" data-f="mm">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 === mm ? 'selected' : ''}>${i + 1}월</option>`).join('')}</select>
      <select aria-label="일" data-f="dd">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${i + 1 === dd ? 'selected' : ''}>${i + 1}일</option>`).join('')}</select></div>`;
  }
  h += `<span class="lb">분류</span>${catSelects(r)}`;
  h += `<div class="two"><div>${field('시작일', 'start', r.start, 'date')}</div><div>${field('종료일 (선택)', 'end', r.end, 'date')}</div></div>`;
  h += area('메모', 'memo', r.memo, 70);
  return h + errLine(sh) + acts('delRt', 'saveRt', sh.isNew);
}

function roccHtml() {
  const sh = S.sheet, r = S.routines.find((x) => x.id === sh.rid);
  if (!r) return '';
  const c = colorOf({ type: r.kind, cat: r.cat, sub: r.sub });
  let h = band(c, r.title);
  h += `<div class="row">${fmtMD(sh.d)}<span class="vl">${esc(ruleText(r))}</span></div>`;
  if (r.kind === 'todo') h += `<span class="lb">이날 상태</span>${seg([['progress', '진행'], ['done', '완료'], ['cancel', '취소']], sh.status, 'roccStatus')}`;
  if (r.kind === 'todo' && sh.status !== 'progress') h += field(sh.status === 'cancel' ? '취소한 날' : '완료한 날', 'at', sh.at || sh.d, 'date');
  if (r.memo) h += `<div class="cm" style="padding:10px 0;white-space:pre-line;font-size:14px">${esc(r.memo)}</div>`;
  return h + `<div class="acts"><button class="btn" data-act="rtOpen" data-id="${r.id}">루틴 수정</button>${r.kind === 'todo' ? '<button class="btn pri" data-act="roccSave">저장</button>' : ''}</div>`;
}

function defCatHtml() {
  return band('#111111', '기본 분류') + `<div style="margin-top:14px">${catSelects(S.sheet.draft)}</div>` + acts(null, 'defCatSave', true);
}

function catHtml() {
  const sh = S.sheet, d = sh.draft, col = d.color;
  const isTopic = sh.kind === 'topic';
  let h = sh.todo ? band(col, '할 일') : bandIn(col, d.name, 'name', '이름');
  h += `<span class="lb">색</span><div class="pal">${PALETTE.map((p) => `<button style="background:${p}" class="${p.toUpperCase() === (col || '').toUpperCase() ? 'on' : ''}" aria-label="${p}" data-act="pick" data-v="${p}"></button>`).join('')}</div>
    <label class="lb" for="c_hex">직접 지정</label><div class="hexrow"><input type="color" aria-label="색 고르기" data-pick="1" value="${col}"><input id="c_hex" data-f="hex" value="${col}"></div>`;
  if (sh.kind === 'cat' && !sh.todo) {
    h += '<div class="sorthd lb"><span>세분류</span><button data-act="sortAbc" data-v="subs">가나다순</button></div><div data-sort="subs">';
    d.subs.forEach((s, i) => {
      h += `<div class="subrow sitem"><span class="grip" aria-label="순서 바꾸기">${IC.grip}</span><input aria-label="세분류 이름" data-sf="name" data-i="${i}" value="${esc(s.name)}">
        <select aria-label="세분류 색" data-sf="mode" data-i="${i}"><option value="inherit" ${s.color ? '' : 'selected'}>대분류 색</option><option value="own" ${s.color ? 'selected' : ''}>직접 지정</option></select>
        <input type="color" aria-label="세분류 색 고르기" data-sf="color" data-i="${i}" value="${s.color || col}" ${s.color ? '' : 'disabled'}>
        <button class="rm" aria-label="세분류 삭제" data-act="subDel" data-i="${i}">${small(IC.x, 18)}</button></div>`;
    });
    h += '</div><button class="btn sm" data-act="subAdd">세분류 추가</button>';
  }
  return h + errLine(sh) + acts(sh.todo ? null : (isTopic ? 'topicDel' : 'catDel'), isTopic ? 'topicSave' : 'catSave', sh.isNew);
}

function backupsHtml() {
  const sh = S.sheet;
  let h = band('#111111', '자동 백업');
  if (!sh.list) return h + '<p class="muted" style="font-size:14px">불러오는 중</p>';
  if (!sh.list.length) return h + '<p class="muted" style="font-size:14px">아직 백업이 없어요.</p>';
  return h + sh.list.map((b) => {
    const t = new Date(b.at);
    const when = `${t.getFullYear()}.${t.getMonth() + 1}.${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    const armed = sh.arm === b.id;
    return `<div class="row"><div><div>${when}</div><div class="muted" style="font-size:12px">${esc(b.reason || '')} · ${b.counts ? b.counts.ev + b.counts.td : (b.items || []).length}건</div></div>
      <button class="btn sm" style="margin-left:auto" data-act="restoreBk" data-id="${b.id}">복원</button></div>`;
  }).join('');
}

// ---------- 플젝북 ----------
const pjOf = (id) => S.projects.find((p) => p.id === id);
const pjItems = (id) => S.items.filter((it) => it.pj === id).sort((a, b) => (a.start || '').localeCompare(b.start || '') || (a.created || 0) - (b.created || 0));
const pjNotes = (id) => S.notes.filter((n) => n.pj === id).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
const pjStart = (id) => pjItems(id)[0]?.start || '';
const dotYmd = (d) => (d || '').replace(/-/g, '.');
function pjPeriod(p) {
  const s = pjStart(p.id);
  if (p.status === 'done') return `${dotYmd(s)}${s ? ' – ' : ''}${dotYmd(p.doneDate)}`;
  return s ? `${dotYmd(s)} –` : '';
}
const ST_TXT = { progress: '진행', done: '완료', cancel: '취소' };
const md2 = (d) => (d || '').slice(5).replace('-', '.');

function projBody() {
  const tab = (k, l) => `<button class="tab ${S.pjTab === k ? 'on' : ''}" data-act="pjTab" data-v="${k}">${l}</button>`;
  let h = titleHead('플젝북', headTools(null, null, { plus: 'pjNew' })) + `<div class="pad"><div class="tabs">${tab('progress', '진행')}${tab('done', '완료')}</div>`;
  const list = S.projects.filter((p) => (p.status === 'done' ? 'done' : 'progress') === S.pjTab)
    .sort((a, b) => S.pjTab === 'done' ? (b.doneDate || '').localeCompare(a.doneDate || '') : (pjStart(b.id) || '9').localeCompare(pjStart(a.id) || '9') || (b.created || 0) - (a.created || 0));
  h += '<div class="cards">' + list.map((p) => {
    const its = pjItems(p.id);
    const ev = its.filter((x) => x.type !== 'todo').length;
    const td = its.filter((x) => x.type === 'todo');
    const done = td.filter((x) => x.status === 'done').length;
    const base = td.filter((x) => x.status !== 'cancel').length;
    const pct = base ? Math.round((done / base) * 100) : 0;
    const per = pjPeriod(p);
    return `<button class="pj" data-act="pjOpen" data-id="${p.id}"><div class="ch"><span class="tt">${esc(p.name || '(이름 없음)')}</span><small>${esc(per.replace(/^\d{4}\./, '').replace(/ – \d{4}\./, ' – '))}</small></div>
      <div class="bd"><div class="bar"><i style="width:${pct}%"></i></div><div class="nums">일정<b>${ev}</b>할 일<b>${td.length}</b>완료<b>${done}</b>회의·메모<b>${pjNotes(p.id).length}</b></div></div></button>`;
  }).join('') + '</div>';
  return h + '</div>';
}

function pjDetailBody() {
  const p = pjOf(S.pjId);
  if (!p) { S.view = 'proj'; return projBody(); }
  const W = wide();
  const dots = `<button class="ico" aria-label="더 보기" data-act="pjMenu">${IC.dots}</button>`;
  let h = `<div class="head pjh"><div class="big" style="align-items:center;min-width:0"><button class="ico" aria-label="플젝북으로" data-act="nav" data-v="proj">${IC.l}</button><h1 class="word pjn">${esc(p.name || '(이름 없음)')}</h1>${W ? `<span class="per">${pjPeriod(p)}</span>${p.status === 'done' ? '<span class="tg">완료</span>' : ''}` : ''}</div><div class="tools">${dots}</div></div>`;
  if (!W) h += `<div class="per ph">${pjPeriod(p)}${p.status === 'done' ? '<span class="tg">완료</span>' : ''}</div>`;
  const plusBtn = (act, label) => `<button aria-label="${label}" data-act="${act}">${small(IC.plus, 18)}</button>`;
  const its = pjItems(p.id);
  let secItems = `<div class="sec"><div class="sh"><span>일정 · 할 일</span>${plusBtn('pjItemPlus', '일정 · 할 일 추가')}</div>`;
  secItems += its.map((it) => `<button class="pk" data-act="open" data-id="${it.id}"><span class="d">${md2(it.start)}</span><span class="sw" style="background:${colorOf(it)}"></span><span class="t">${esc(it.title || '(제목 없음)')}</span>${it.type === 'todo' ? `<span class="o">${ST_TXT[it.status || 'progress']}</span>` : ''}</button>`).join('');
  if (p.status === 'done') secItems += `<button class="pk end" data-act="pjDone"><span class="d">${md2(p.doneDate)}</span><span class="sw" style="background:#111"></span><span class="t">프로젝트 완료</span></button>`;
  secItems += '</div>';
  const plans = (p.plans || []);
  let secPlans = `<div class="sec"><div class="sh"><span>향후 계획</span>${plusBtn('planNew', '향후 계획 추가')}</div>`;
  secPlans += plans.map((x) => `<button class="pl" data-act="planOpen" data-id="${x.id}"><span class="d">${x.ym ? `${+x.ym.slice(5)}월` : ''}</span><span>${esc(x.title || '(제목 없음)')}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span></button>`).join('') + '</div>';
  const ns = pjNotes(p.id);
  let secNotes = `<div class="sec"><div class="sh"><span>회의 · 메모</span>${plusBtn('pjNotePlus', '회의 · 메모 추가')}</div>`;
  secNotes += ns.map((n) => `<button class="mm" data-act="openNote" data-id="${n.id}"><div class="mt"><b><span class="tg">${n.kind === 'meeting' ? '회의' : '메모'}</span>${esc(n.title || '(제목 없음)')}</b><small>${md2(n.date)}</small></div></button>`).join('') + '</div>';
  const secMemo = `<div class="sec"><div class="sh"><span>메모</span></div><textarea id="pjmemo" class="pjmemo" aria-label="메모" data-pjmemo="1">${esc(p.memo || '')}</textarea></div>`;
  h += W ? `<div class="pad"><div class="pjcols"><div>${secItems}${secPlans}</div><div>${secNotes}${secMemo}</div></div></div>`
    : `<div class="pad">${secItems}${secPlans}${secNotes}${secMemo}</div>`;
  return h;
}

// 시트들
function pjNameHtml() {
  const sh = S.sheet;
  return bandIn('#111111', sh.draft.name, 'name', '이름') + errLine(sh) + `<div class="acts"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="pjNameSave">${sh.isNew ? '만들기' : '저장'}</button></div>`;
}
function pjMenuHtml() {
  const p = pjOf(S.pjId);
  if (!p) return '';
  return band('#111111', p.name || '') + `<button class="row" data-act="pjRename">이름 바꾸기</button>
    <button class="row" data-act="pjDone">${p.status === 'done' ? '완료일 바꾸기 · 다시 진행' : '완료로 바꾸기'}</button>
    <button class="row red" data-act="pjDel">${S.delArm ? '정말 삭제 (일정·메모는 남아요)' : '플젝 삭제'}</button>`;
}
function pjDoneHtml() {
  const sh = S.sheet, p = pjOf(S.pjId);
  const again = p && p.status === 'done';
  return band('#111111', '완료') + field('완료일', 'doneDate', sh.doneDate, 'date') + errLine(sh)
    + `<div class="acts">${again ? '<button class="btn" data-act="pjReopen">다시 진행</button>' : '<button class="btn" data-act="close">취소</button>'}<button class="btn pri" data-act="pjDoneSave">${again ? '저장' : '완료'}</button></div>`;
}
function pjChooseHtml() {
  const sh = S.sheet;
  if (sh.what === 'notes') {
    return band('#111111', '회의 · 메모') + `<button class="row" data-act="pjNoteNew" data-v="meeting">새 회의</button><button class="row" data-act="pjNoteNew" data-v="memo">새 메모</button><button class="row" data-act="pjNotePick">기존 회의 · 메모 담기</button>`;
  }
  const p = pjOf(S.pjId);
  return band('#111111', '일정 · 할 일') + `<button class="row" data-act="pjItemNew">새 일정 · 할 일</button><button class="row" data-act="pjPick">기존 일정 담기</button>`
    + (wide() && p ? `<button class="row" data-act="pjDone">${p.status === 'done' ? '완료일 바꾸기 · 다시 진행' : '완료로 바꾸기'}</button>` : '');
}
function pjPickHtml() {
  const sh = S.sheet, p = pjOf(S.pjId);
  let h = band('#111111', p ? p.name : '');
  let rows;
  if (sh.what === 'notes') {
    rows = S.notes.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((n) => ({ id: n.id, d: n.date, c: '#111111', t: `${n.kind === 'meeting' ? '[회의] ' : '[메모] '}${n.title || '(제목 없음)'}`, other: n.pj && n.pj !== S.pjId ? pjOf(n.pj) : null }));
  } else {
    h += `<div class="two"><div>${field('시작', 'from', sh.from, 'date')}</div><div>${field('끝', 'to', sh.to, 'date')}</div></div>`;
    rows = S.items.filter((it) => it.start && it.start <= sh.to && (itemEnd(it) || it.start) >= sh.from)
      .sort((a, b) => a.start.localeCompare(b.start)).map((it) => ({ id: it.id, d: it.start, c: colorOf(it), t: it.title || '(제목 없음)', other: it.pj && it.pj !== S.pjId ? pjOf(it.pj) : null }));
  }
  h += `<div class="pkl">${rows.map((r) => {
    const on = sh.sel.has(r.id);
    return r.other
      ? `<div class="pk dis"><span class="bx"></span><span class="d">${md2(r.d)}</span><span class="sw" style="background:${r.c}"></span><span class="t">${esc(r.t)}</span><span class="o">${esc(r.other.name || '')}</span></div>`
      : `<button class="pk" data-act="pkTog" data-id="${r.id}"><span class="bx ${on ? 'on' : ''}">${on ? IC.check : ''}</span><span class="d">${md2(r.d)}</span><span class="sw" style="background:${r.c}"></span><span class="t">${esc(r.t)}</span></button>`;
  }).join('') || '<p class="muted" style="font-size:14px">이 기간에는 일정이 없어요.</p>'}</div>`;
  return h + `<div class="acts"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="pkSave">담기</button></div>`;
}
function planHtml() {
  const sh = S.sheet, x = sh.draft;
  return bandIn('#111111', x.title) + field('시기', 'ym', x.ym, 'month') + area('비고', 'note', x.note, 110) + errLine(sh)
    + `<div class="acts">${sh.isNew ? '' : `<button class="btn del" data-act="planDel">${S.delArm ? '정말 삭제' : '삭제'}</button>`}<button class="btn" data-act="planToItem">일정으로 올리기</button><button class="btn pri" data-act="planSave">저장</button></div>`;
}
function pjSelect(d) {
  const opts = S.projects.filter((p) => p.status !== 'done' || p.id === d.pj).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  if (!opts.length && !d.pj) return '';
  return `<span class="lb">플젝</span><select aria-label="플젝" data-f="pj" style="width:100%"><option value="">없음</option>${opts.map((p) => `<option value="${p.id}" ${p.id === d.pj ? 'selected' : ''}>${esc(p.name || '(이름 없음)')}</option>`).join('')}</select>`;
}
function savePj(p) { save('projects', p); }
function setPj(col, obj, pjId) {
  const x = { ...obj };
  if (pjId) x.pj = pjId; else delete x.pj;
  save(col, x);
}
const PJ_ACT = {
  pjTab: (el) => { S.pjTab = el.dataset.v; render(); },
  pjNew: () => openSheet({ kind: 'pjName', isNew: true, draft: { name: '' } }),
  pjOpen: (el) => { S.pjId = el.dataset.id; S.view = 'pjd'; render(); window.scrollTo(0, 0); },
  pjRename: () => { const p = pjOf(S.pjId); if (p) swapSheet({ kind: 'pjName', isNew: false, draft: { name: p.name } }); },
  pjNameSave: () => {
    const sh = S.sheet, name = (sh.draft.name || '').trim();
    if (!name) { sh.err = '이름을 입력해 주세요.'; render(); return; }
    if (sh.isNew) {
      const p = { id: uid(), name, status: 'progress', doneDate: '', plans: [], memo: '', created: Date.now() };
      S.projects = [...S.projects, p]; savePj(p); S.pjId = p.id; S.view = 'pjd'; closeSheet();
    } else { const p = pjOf(S.pjId); if (p) savePj({ ...p, name }); closeSheet(); }
  },
  pjMenu: () => openSheet({ kind: 'pjMenu' }),
  pjDone: () => {
    const p = pjOf(S.pjId); if (!p) return;
    const last = pjItems(p.id).map((x) => itemEnd(x) || x.start).sort().pop();
    swapSheet({ kind: 'pjDone', doneDate: p.doneDate || (last && last > todayStr() ? last : todayStr()) });
  },
  pjDoneSave: () => {
    const sh = S.sheet, p = pjOf(S.pjId);
    if (!sh.doneDate) { sh.err = '완료일을 골라 주세요.'; render(); return; }
    if (p) savePj({ ...p, status: 'done', doneDate: sh.doneDate });
    closeSheet();
  },
  pjReopen: () => { const p = pjOf(S.pjId); if (p) savePj({ ...p, status: 'progress', doneDate: '' }); closeSheet(); },
  pjDel: () => {
    if (!armDel()) return;
    const id = S.pjId;
    // 묶음만 풀고 일정·메모는 그대로 둠
    S.items.filter((x) => x.pj === id).forEach((x) => setPj('items', x, ''));
    S.notes.filter((x) => x.pj === id).forEach((x) => setPj('notes', x, ''));
    D.deleteDocIn(U(), 'projects', id);
    S.view = 'proj'; closeSheet();
  },
  pjItemPlus: () => openSheet({ kind: 'pjChoose', what: 'items' }),
  pjNotePlus: () => openSheet({ kind: 'pjChoose', what: 'notes' }),
  pjItemNew: () => { const it = newItem('event', todayStr()); it.pj = S.pjId; swapSheet({ kind: 'edit', draft: it, isNew: true }); setTimeout(() => document.getElementById('bandT')?.focus(), 30); },
  pjNoteNew: (el) => swapSheet({ kind: 'note', isNew: true, draft: { id: uid(), kind: el.dataset.v, title: '', date: todayStr(), time: '', place: '', attendees: '', content: '', linkId: '', pj: S.pjId, created: Date.now() } }),
  pjPick: () => {
    const its = pjItems(S.pjId);
    const from = its[0]?.start ? addDays(its[0].start, -14) : addDays(todayStr(), -30);
    const to = its.length ? addDays(its[its.length - 1].start, 30) : addDays(todayStr(), 30);
    swapSheet({ kind: 'pjPick', what: 'items', from, to, sel: new Set(its.map((x) => x.id)), orig: new Set(its.map((x) => x.id)) });
  },
  pjNotePick: () => { const ns = pjNotes(S.pjId); swapSheet({ kind: 'pjPick', what: 'notes', sel: new Set(ns.map((x) => x.id)), orig: new Set(ns.map((x) => x.id)) }); },
  pkTog: (el) => { const s = S.sheet.sel, id = el.dataset.id; if (s.has(id)) s.delete(id); else s.add(id); render(); },
  pkSave: () => {
    const sh = S.sheet, col = sh.what === 'notes' ? 'notes' : 'items', list = S[col];
    list.forEach((x) => {
      const want = sh.sel.has(x.id), had = sh.orig.has(x.id);
      if (want && !had && (!x.pj || x.pj === S.pjId)) setPj(col, x, S.pjId);
      if (!want && had && x.pj === S.pjId) setPj(col, x, '');
    });
    closeSheet();
  },
  planNew: () => openSheet({ kind: 'plan', isNew: true, draft: { id: uid(), title: '', ym: '', note: '' } }),
  planOpen: (el) => { const p = pjOf(S.pjId), x = p && (p.plans || []).find((y) => y.id === el.dataset.id); if (x) openSheet({ kind: 'plan', isNew: false, draft: { ...x } }); },
  planSave: () => {
    const sh = S.sheet, x = { ...sh.draft }, p = pjOf(S.pjId);
    x.title = (x.title || '').trim();
    if (!x.title) { sh.err = '제목을 입력해 주세요.'; render(); return; }
    if (!p) return closeSheet();
    const plans = (p.plans || []).filter((y) => y.id !== x.id);
    const i = (p.plans || []).findIndex((y) => y.id === x.id);
    if (i >= 0) plans.splice(i, 0, x); else plans.push(x);
    savePj({ ...p, plans }); closeSheet();
  },
  planDel: () => { if (!armDel()) return; const p = pjOf(S.pjId); if (p) savePj({ ...p, plans: (p.plans || []).filter((y) => y.id !== S.sheet.draft.id) }); closeSheet(); },
  planToItem: () => {
    const x = { ...S.sheet.draft };
    x.title = (x.title || '').trim();
    if (!x.title) { S.sheet.err = '제목을 입력해 주세요.'; render(); return; }
    const d = x.ym ? (x.ym === todayStr().slice(0, 7) ? todayStr() : `${x.ym}-01`) : todayStr();
    const it = newItem('event', d);
    it.title = x.title; it.memo = x.note || ''; it.pj = S.pjId; it.fromPlan = x.id;
    swapSheet({ kind: 'edit', draft: it, isNew: true });
  },
};
// 일정이 저장되면 그 일정으로 올린 향후 계획은 목록에서 뺌
function afterItemSaved(it) {
  if (!it.fromPlan) return it;
  const p = pjOf(it.pj);
  if (p) savePj({ ...p, plans: (p.plans || []).filter((y) => y.id !== it.fromPlan) });
  const { fromPlan, ...rest } = it;
  return rest;
}

// ---------- 연봉 · 성과급 (계약 단위) ----------
const wonOf = (v) => { const n = Number(String(v ?? '').replace(/[^\d]/g, '')); return Number.isFinite(n) ? n : 0; };
const commas = (n) => (n || n === 0 ? Number(n).toLocaleString('ko-KR') : '');
const man = (won) => (won ? Math.round(won / 10000).toLocaleString('ko-KR') : '0');
const wonText = (won) => {
  if (!won) return '';
  const m = Math.floor(won / 10000), r = won % 10000;
  return `${m ? commas(m) + '만' : ''}${r ? (m ? ' ' : '') + commas(r) : ''}원`;
};
const CT_TYPE = [['join', '입사'], ['regular', '정기'], ['adjust', '조정'], ['promo', '승진'], ['move', '이직']];
const ctTypeTxt = (t) => (CT_TYPE.find((x) => x[0] === t) || ['', ''])[1];
// 옛 형식(연도 1줄) 기록도 계약·성과급으로 읽어서 보여줌. 원본은 그대로 둠
function salData() {
  const contracts = [], bonuses = [];
  S.records.forEach((r) => {
    if (r.kind === 'contract') contracts.push(r);
    else if (r.kind === 'bonus') bonuses.push(r);
    else if (r.kind === 'salary') {
      const y = String(r.year || '').trim();
      if (wonOf(r.base) || r.rank) contracts.push({ id: r.id, kind: 'contract', legacy: true, company: r.company || '', date: y ? `${y}-01-01` : '', base: wonOf(r.base), rank: r.rank || '', type: '', memo: '' });
      if (wonOf(r.bonus)) bonuses.push({ id: r.id + '~b', kind: 'bonus', legacy: true, legacyOf: r.id, company: r.company || '', date: y ? `${y}-12-31` : '', amount: wonOf(r.bonus), memo: '이전 기록' });
    }
  });
  contracts.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.created || 0) - (b.created || 0));
  bonuses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return { contracts, bonuses };
}
const rateTxt = (now, prev) => (prev ? `${now >= prev ? '+' : ''}${(((now - prev) / prev) * 100).toFixed(1)}%` : '');
function prevContract(contracts, c) {
  const before = contracts.filter((x) => x.id !== c.id && (x.date || '') <= (c.date || '') && !(x.date === c.date && (x.created || 0) > (c.created || 0)));
  return before[before.length - 1] || null;
}
function salYears(contracts, bonuses) {
  const ys = new Set();
  contracts.forEach((c) => c.date && ys.add(+c.date.slice(0, 4)));
  bonuses.forEach((b) => b.date && ys.add(+b.date.slice(0, 4)));
  if (!ys.size) return [];
  const min = Math.min(...ys), max = Math.max(...ys, new Date().getFullYear());
  const out = [];
  let prevEnd = null;
  for (let y = min; y <= max; y++) {
    const end = contracts.filter((c) => c.date && c.date <= `${y}-12-31`).pop() || null;
    const bsum = bonuses.filter((b) => (b.date || '').startsWith(String(y))).reduce((s, b) => s + (b.amount || 0), 0);
    const started = end && (end.date || '').startsWith(String(y));
    if (end || bsum) out.push({ y, end, rate: started && prevEnd ? rateTxt(end.base, prevEnd.base) : '', bsum });
    if (end) prevEnd = end;
  }
  return out.reverse();
}
function lastCompany() {
  const all = S.records.filter((r) => (r.kind === 'contract' || r.kind === 'bonus') && r.company);
  all.sort((a, b) => (a.created || 0) - (b.created || 0));
  return all.length ? all[all.length - 1].company : '';
}
function salSections() {
  const { contracts, bonuses } = salData();
  const plus = (act, label) => `<button aria-label="${label} 추가" data-act="${act}">${small(IC.plus, 18)}</button>`;
  if (S.settings.recPin && !S.unlocked) {
    return `<div class="lockbox">${IC.lock}<b>연봉 · 성과급</b><button class="btn pri" data-act="pinOpen">열기</button></div>`;
  }
  const lockBtn = S.settings.recPin ? `<button class="lk" data-act="relock">${IC.unlock}잠그기</button>` : '';
  let h = `<div class="sec"><div class="sh"><span>연도별 요약</span>${lockBtn}</div><table class="sal"><thead><tr><th>연도</th><th class="r">연말 연봉</th><th class="r">인상률</th><th class="r">성과급</th></tr></thead><tbody>`;
  h += salYears(contracts, bonuses).map((r) => `<tr><td>${r.y}</td><td class="r">${r.end ? man(r.end.base) : ''}</td><td class="r up">${r.rate}</td><td class="r">${r.bsum ? man(r.bsum) : ''}</td></tr>`).join('');
  h += '</tbody></table></div>';
  // 계약: 회사별 묶음, 최근 계약이 있는 회사부터
  const byCo = new Map();
  contracts.slice().reverse().forEach((c) => { const k = c.company || ''; if (!byCo.has(k)) byCo.set(k, []); byCo.get(k).push(c); });
  h += `<div class="sec"><div class="sh"><span>연봉 계약</span>${plus('ctNew', '연봉 계약')}</div><table class="sal"><thead><tr><th>적용일</th><th class="r">기본연봉</th><th class="r">인상률</th><th>직급</th><th>구분</th></tr></thead><tbody>`;
  byCo.forEach((list, co) => {
    h += `<tr class="co"><td colspan="5">${esc(co || '회사 미입력')}</td></tr>`;
    h += list.map((c) => { const p = prevContract(contracts, c); return `<tr data-act="ctOpen" data-id="${c.id}"><td>${dotYmd(c.date)}</td><td class="r">${man(c.base)}</td><td class="r up">${p ? rateTxt(c.base, p.base) : ''}</td><td>${esc(c.rank || '')}</td><td>${ctTypeTxt(c.type)}</td></tr>`; }).join('');
  });
  h += '</tbody></table></div>';
  h += `<div class="sec"><div class="sh"><span>성과급</span>${plus('bnNew', '성과급')}</div><table class="sal"><thead><tr><th>지급일</th><th>회사</th><th class="r">금액</th><th>메모</th></tr></thead><tbody>`;
  h += bonuses.map((b) => `<tr data-act="bnOpen" data-id="${b.legacyOf || b.id}"><td>${dotYmd(b.date)}</td><td>${esc(b.company || '')}</td><td class="r">${man(b.amount)}</td><td>${esc(b.memo || '')}</td></tr>`).join('');
  h += '</tbody></table></div>';
  return h;
}
const wonField = (label, f, won) => `<label class="lb" for="f_${f}">${label}</label><input id="f_${f}" data-f="${f}" inputmode="numeric" autocomplete="off" value="${won ? commas(won) : ''}"><p class="wonh" id="wh_${f}">${wonText(won)}</p>`;
function ctHtml() {
  const sh = S.sheet, c = sh.draft;
  const { contracts } = salData();
  const p = prevContract(contracts, c);
  let h = band('#111111', '연봉 계약') + field('회사', 'company', c.company);
  h += `<div class="two"><div>${field('적용일', 'date', c.date, 'date')}</div><div>${field('직급', 'rank', c.rank)}</div></div>`;
  h += wonField('기본연봉', 'base', c.base);
  h += `<p class="rate" id="ctRate">${p && c.base ? `직전 계약 대비 ${rateTxt(c.base, p.base)}` : ''}</p>`;
  h += `<span class="lb">구분</span>${seg(CT_TYPE, c.type, 'ctType')}`;
  h += area('메모', 'memo', c.memo, 64);
  return h + errLine(sh) + acts('ctDel', 'ctSave', sh.isNew);
}
function bnHtml() {
  const sh = S.sheet, b = sh.draft;
  let h = band('#111111', '성과급') + field('회사', 'company', b.company);
  h += `<div class="two"><div>${field('지급일', 'date', b.date, 'date')}</div><div>${wonField('금액', 'amount', b.amount)}</div></div>`;
  h += field('메모', 'memo', b.memo);
  return h + errLine(sh) + acts('bnDel', 'bnSave', sh.isNew);
}
// 금액 칸: 입력 중에는 아래 글자만 바꾸고, 칸을 벗어나면 쉼표를 붙임
function salLive(el) {
  const sh = S.sheet, f = el.dataset.f;
  if (!sh || (sh.kind !== 'ct' && sh.kind !== 'bn') || (f !== 'base' && f !== 'amount')) return false;
  const won = wonOf(el.value);
  sh.draft[f] = won;
  const hp = document.getElementById('wh_' + f); if (hp) hp.textContent = wonText(won);
  if (sh.kind === 'ct') {
    const p = prevContract(salData().contracts, sh.draft);
    const r = document.getElementById('ctRate'); if (r) r.textContent = p && won ? `직전 계약 대비 ${rateTxt(won, p.base)}` : '';
  }
  return true;
}
// ---------- 기록 잠금 비밀번호 ----------
async function pinHash(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`planbook:${U()}:${pin}`));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
// mode: open(열기) / old(지금 비밀번호 확인) / new(새 비밀번호) / again(한 번 더) / pw(로그인 비밀번호로 확인)
function pinHtml() {
  const sh = S.sheet;
  const title = { open: '비밀번호', old: '지금 비밀번호', new: '새 비밀번호', again: '새 비밀번호 확인', pw: '로그인 비밀번호' }[sh.mode];
  let h = band('#111111', title);
  if (sh.mode === 'pw') {
    return h + `<label class="lb" for="f_pw">로그인 비밀번호</label><input id="f_pw" type="password" data-f="pw" autocomplete="current-password" value="">${errLine(sh)}<div class="acts"><button class="btn pri" data-act="pinPwGo">확인</button></div>`;
  }
  h += `<div class="dots">${[0, 1, 2, 3].map((i) => `<i class="${i < sh.v.length ? 'on' : ''}"></i>`).join('')}</div>`;
  h += sh.err ? `<p class="err" style="text-align:center">${esc(sh.err)}</p>` : '';
  h += `<div class="kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '←'].map((k) => k === '' ? '<span></span>' : `<button data-act="pinKey" data-v="${k}" aria-label="${k === '←' ? '지우기' : k}">${k}</button>`).join('')}</div>`;
  if (sh.mode === 'open' || sh.mode === 'old') h += '<button class="lk2" data-act="pinForgot">비밀번호를 잊었어요</button>';
  if (sh.mode === 'new' && S.settings.recPin) h += '<button class="lk2 red" data-act="pinRemove">잠금 끄기</button>';
  return h;
}
async function pinDone() {
  const sh = S.sheet, v = sh.v;
  if (sh.mode === 'open' || sh.mode === 'old') {
    if ((await pinHash(v)) !== S.settings.recPin) { sh.v = ''; sh.err = '비밀번호가 달라요'; render(); return; }
    if (sh.mode === 'old') { S.sheet = { kind: 'pin', mode: 'new', v: '' }; render(); return; }
    S.unlocked = true;
    if (sh.then === 'xlsx') { const y = new Date().getFullYear(); swapSheet({ kind: 'xlsx', from: `${y}-01-01`, to: `${y}-12-31` }); return; }
    closeSheet();
    return;
  }
  if (sh.mode === 'new') { S.sheet = { kind: 'pin', mode: 'again', v: '', first: v }; render(); return; }
  if (sh.mode === 'again') {
    if (v !== sh.first) { S.sheet = { kind: 'pin', mode: 'new', v: '', err: '두 번 입력한 비밀번호가 달라요' }; render(); return; }
    saveSettings({ ...S.settings, recPin: await pinHash(v) });
    S.unlocked = false; closeSheet(); toast('잠금 비밀번호를 정했어요');
  }
}
const SAL_ACT = {
  ctNew: () => openSheet({ kind: 'ct', isNew: true, draft: { id: uid(), kind: 'contract', company: lastCompany(), date: todayStr(), base: 0, rank: '', type: 'regular', memo: '', created: Date.now() } }),
  ctOpen: (el) => {
    const c = salData().contracts.find((x) => x.id === el.dataset.id);
    if (c) openSheet({ kind: 'ct', isNew: false, draft: { ...c } });
  },
  ctType: (el) => { S.sheet.draft.type = el.dataset.v; render(); },
  ctSave: () => {
    const sh = S.sheet, c = { ...sh.draft };
    c.company = (c.company || '').trim();
    if (!c.date) { sh.err = '적용일을 골라 주세요.'; render(); return; }
    if (!c.base) { sh.err = '기본연봉을 입력해 주세요.'; render(); return; }
    // 옛 형식 기록을 고치면 새 형식으로 저장하고, 거기 있던 성과급은 따로 남김
    const old = c.legacy ? S.records.find((r) => r.id === c.id) : null;
    delete c.legacy; c.kind = 'contract'; if (!c.created) c.created = Date.now();
    save('records', c);
    if (old && wonOf(old.bonus)) save('records', { id: uid(), kind: 'bonus', company: c.company, date: `${String(old.year).trim()}-12-31`, amount: wonOf(old.bonus), memo: '이전 기록', created: Date.now() });
    closeSheet();
  },
  ctDel: () => { if (!armDel()) return; D.deleteDocIn(U(), 'records', S.sheet.draft.id); closeSheet(); },
  bnNew: () => openSheet({ kind: 'bn', isNew: true, draft: { id: uid(), kind: 'bonus', company: lastCompany(), date: todayStr(), amount: 0, memo: '', created: Date.now() } }),
  bnOpen: (el) => {
    const id = el.dataset.id;
    const b = S.records.find((x) => x.id === id && x.kind === 'bonus');
    if (b) return openSheet({ kind: 'bn', isNew: false, draft: { ...b } });
    // 옛 형식 성과급은 그 연도 계약을 열어서 고침
    const c = salData().contracts.find((x) => x.id === id);
    if (c) openSheet({ kind: 'ct', isNew: false, draft: { ...c } });
  },
  bnSave: () => {
    const sh = S.sheet, b = { ...sh.draft };
    b.company = (b.company || '').trim();
    if (!b.date) { sh.err = '지급일을 골라 주세요.'; render(); return; }
    if (!b.amount) { sh.err = '금액을 입력해 주세요.'; render(); return; }
    save('records', b); closeSheet();
  },
  bnDel: () => { if (!armDel()) return; D.deleteDocIn(U(), 'records', S.sheet.draft.id); closeSheet(); },
  pinOpen: () => openSheet(S.settings.recPin ? { kind: 'pin', mode: 'open', v: '' } : { kind: 'pin', mode: 'new', v: '' }),
  pinSet: () => openSheet(S.settings.recPin ? { kind: 'pin', mode: 'old', v: '' } : { kind: 'pin', mode: 'new', v: '' }),
  pinKey: (el) => {
    const sh = S.sheet, k = el.dataset.v;
    if (k === '←') { sh.v = sh.v.slice(0, -1); render(); return; }
    if (sh.v.length >= 4) return;
    sh.v += k; sh.err = '';
    render();
    if (sh.v.length === 4) setTimeout(pinDone, 120);
  },
  pinForgot: () => { S.sheet = { kind: 'pin', mode: 'pw', pw: '' }; render(); },
  pinPwGo: async () => {
    const sh = S.sheet;
    try { await D.reauth(sh.pw || ''); S.sheet = { kind: 'pin', mode: 'new', v: '' }; render(); }
    catch (e) { sh.err = '로그인 비밀번호가 달라요.'; render(); }
  },
  pinRemove: () => { const st = { ...S.settings }; delete st.recPin; saveSettings(st); S.unlocked = false; closeSheet(); toast('잠금을 껐어요'); },
  relock: () => { S.unlocked = false; render(); },
};

// ---------- 전체 그리기 ----------
const ALL_LOADED = () => S.settings && D.COLS.every((c) => S.loaded[c]);
function render() {
  if (S.user === undefined) { $app.innerHTML = '<div class="wait">불러오는 중</div>'; return; }
  if (!S.user) { $app.innerHTML = loginHtml(); return; }
  if (!ALL_LOADED()) { $app.innerHTML = '<div class="wait">불러오는 중</div>'; return; }
  if (!S.month) { const t = parse(S.sel); S.month = [t.getFullYear(), t.getMonth()]; }
  const active = document.activeElement;
  const keepId = active && active.id && $app.contains(active) ? active.id : null;
  const V = S.view;
  const page = V === 'month' ? monthHead() + monthBody() : V === 'week' ? weekHead() + weekBody() : V === 'mini' ? miniBody()
    : V === 'year' ? yearBody() : V === 'ysum' ? ysumBody() : V === 'routine' ? routineBody() : V === 'proj' ? projBody() : V === 'pjd' ? pjDetailBody() : settingsBody();
  const navV = V === 'ysum' ? 'year' : V === 'pjd' ? 'proj' : V;
  let html;
  if (wide()) {
    const mi = (v, l) => `<button class="mi ${navV === v ? 'on' : ''}" data-act="nav" data-v="${v}">${nIc(v)}${l}</button>`;
    const right = V === 'month' ? `<aside class="rpanel"><p class="dt ${dayClass(S.sel)}">${fmtMD(S.sel)}${HOLIDAYS[S.sel] ? ' · ' + HOLIDAYS[S.sel] : ''}</p><p class="dn">${parse(S.sel).getDate()}</p>${dayList(S.sel)}<button class="btn sm" style="margin-top:6px" data-act="newOn" data-d="${S.sel}">추가</button></aside>` : '';
    html = `<div class="wide"><nav class="side">${mi('month', '먼슬리')}${mi('week', '위클리')}${mi('proj', '플젝북')}${mi('mini', '미니북')}${mi('year', '이어북')}${mi('routine', '루틴북')}<div class="grow"></div><button class="mi sync ${S.syncing ? 'spin' : ''}" data-act="sync">${IC.sync}<span>동기화</span><small>${S.syncAt ? fmtAt(S.syncAt).slice(11) : ''}</small></button><button class="mi set ${V === 'settings' ? 'on' : ''}" data-act="nav" data-v="settings">${nIc('settings')}설정</button></nav><main class="main">${page}</main>${right}${sheetHtml()}</div>`;
  } else {
    const tab = (v, l) => `<button class="${navV === v ? 'on' : ''}" data-act="nav" data-v="${v}">${nIc(v)}<span>${l}</span></button>`;
    const showFab = ['month', 'week'].includes(V);
    const fab = showFab ? `<button class="fab" aria-label="추가" data-act="fab">${IC.plus}</button>` : '';
    html = `<div class="phone"><div class="page">${page}</div>${V !== 'settings' ? `<nav class="nav">${tab('month', '먼슬리')}${tab('week', '위클리')}${tab('proj', '플젝북')}${tab('mini', '미니북')}${tab('year', '이어북')}${tab('routine', '루틴북')}</nav>` : ''}${fab}${sheetHtml()}</div>`;
  }
  if (S.toast) html += `<div class="toast">${esc(S.toast)}</div>`;
  $app.innerHTML = html;
  if (keepId) { const el = document.getElementById(keepId); if (el) el.focus(); }
}

// ---------- 열고 닫기 ----------
function openSheet(sh) {
  if (!S.sheet) history.pushState({ sheet: 1 }, '');
  S.sheet = sh; S.delArm = false; render();
}
function swapSheet(sh) { if (S.sheet) { S.sheet = sh; S.delArm = false; render(); } else openSheet(sh); }
function closeSheet(fromPop) {
  if (!S.sheet) return;
  S.sheet = null; S.delArm = false; render();
  if (!fromPop && history.state && history.state.sheet) history.back();
}
window.addEventListener('popstate', () => closeSheet(true));
document.addEventListener('visibilitychange', () => { if (document.hidden && S.unlocked) { S.unlocked = false; if (S.sheet && (S.sheet.kind === 'ct' || S.sheet.kind === 'bn')) closeSheet(); else render(); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

function defCat() {
  const st = S.settings;
  const c = catOf(st.defCat) || st.cats[0];
  const sub = c && (c.subs || []).find((x) => x.id === st.defSub) ? st.defSub : '';
  return { cat: c ? c.id : '', sub: c && c.id === st.defCat ? sub : '' };
}
function newItem(type, d) {
  return { id: uid(), type, title: '', start: d, end: d, ...defCat(), memo: '', status: 'progress', created: Date.now() };
}
function newForm(d) {
  swapSheet({ kind: 'edit', draft: newItem('event', d), isNew: true });
  setTimeout(() => document.getElementById('bandT')?.focus(), 30);
}
const save = (name, obj) => { try { D.saveDoc(U(), name, obj); } catch (e) { toast('저장하지 못했어요'); } };
const armDel = () => { if (!S.delArm) { S.delArm = true; render(); return false; } return true; };

function snapshot() {
  return { items: S.items, notes: S.notes, records: S.records, routines: S.routines, yb: S.yb, projects: S.projects, settings: S.settings };
}
async function ensureSettingsAndBackup() {
  const st = S.settings;
  if (st.backupVer !== APP_VERSION) {
    const has = D.COLS.some((c) => S[c].length);
    if (has) {
      try { await backupCurrent(`${APP_VERSION} 업데이트 전 자동 백업`); } catch (e) { console.warn(e); toast('자동 백업을 하지 못했어요. 인터넷 연결 후 다시 열어 주세요'); return; }
    }
    S.settings = { ...st, backupVer: APP_VERSION };
    D.saveSettings(U(), S.settings);
  }
}
// ---------- 데이터 점검 · 합치기 복원 ----------
const CK = [['ev', '일정'], ['td', '할 일'], ['pj', '플젝'], ['mt', '회의'], ['mm', '메모'], ['rc', '기록'], ['rt', '루틴'], ['yb', '이어북 칠한 날'], ['ct', '분류 · 주제']];
const ckKey = (name, o) => name === 'items' ? (o.type === 'todo' ? 'td' : 'ev') : name === 'notes' ? (o.kind === 'meeting' ? 'mt' : 'mm') : name === 'records' ? 'rc' : name === 'projects' ? 'pj' : 'rt';
const zeroC = () => Object.fromEntries(CK.map(([k]) => [k, 0]));
function countsOf(d) {
  const c = zeroC();
  ['items', 'notes', 'records', 'routines', 'projects'].forEach((n) => (d[n] || []).forEach((o) => { c[ckKey(n, o)]++; }));
  (d.yb || []).forEach((y) => { c.yb += (y.days || []).length; });
  const st = d.settings || {};
  c.ct = (st.cats || []).length + (st.topics || []).length;
  return c;
}
// 어떤 버전의 백업이든 같은 모양으로 맞춤 (빠뜨리는 항목 없이)
function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('형식');
  const has = D.COLS.some((n) => Array.isArray(raw[n]));
  if (!has) throw new Error('형식');
  const out = {};
  D.COLS.forEach((n) => {
    out[n] = (Array.isArray(raw[n]) ? raw[n] : []).filter((o) => o && typeof o === 'object').map((o) => {
      const x = { ...o };
      x.id = x.id != null && String(x.id) !== '' ? String(x.id) : (n === 'yb' && x.topic && x.year ? `${x.topic}_${x.year}` : uid());
      if (n === 'yb') x.days = Array.isArray(x.days) ? x.days.filter((d) => typeof d === 'string') : [];
      return x;
    });
  });
  out.settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : null;
  return out;
}
const RK = { salary: '연봉', contract: '연봉 계약', bonus: '성과급', cert: '자격증', edu: '교육' };
function labelOf(name, o) {
  if (name === 'items') return `${(o.start || '').replace(/-/g, '.')} ${o.title || '(제목 없음)'}`;
  if (name === 'notes') return `${(o.date || '').replace(/-/g, '.')} ${o.title || '(제목 없음)'}`;
  if (name === 'records') return `${RK[o.kind] || '기록'} ${o.name || o.year || o.company || ''} ${o.date || ''}`.trim();
  if (name === 'projects') return `플젝 ${o.name || ''}`;
  return `루틴 ${o.title || ''}`;
}
// 지금(cur)에 파일(file)을 합치는 계획. 지금 있는 것은 그대로 둠
function planMerge(cur, file) {
  const plan = { add: {}, yb: [], upd: [], settings: null };
  ['items', 'notes', 'records', 'routines', 'projects'].forEach((n) => {
    const ids = new Set((cur[n] || []).map((o) => o.id));
    plan.add[n] = file[n].filter((o) => !ids.has(o.id));
  });
  // 같은 항목이 이미 있으면 바꾸지 않고, 지금 없는 칸(예: 플젝 연결)만 채움
  ['items', 'notes', 'records', 'routines'].forEach((n) => {
    const cm = new Map((cur[n] || []).map((o) => [o.id, o]));
    file[n].forEach((o) => {
      const c = cm.get(o.id);
      if (!c) return;
      const fill = {};
      Object.keys(o).forEach((k) => { if (k !== 'updated' && !(k in c) && o[k] !== undefined && o[k] !== '') fill[k] = o[k]; });
      if (Object.keys(fill).length) plan.upd.push({ name: n, before: c, after: { ...c, ...fill } });
    });
  });
  // 같은 플젝이 이미 있으면 빠진 향후 계획만 채우고, 비어 있는 메모만 채움
  const pjCur = new Map((cur.projects || []).map((p) => [p.id, p]));
  file.projects.forEach((fp) => {
    const c = pjCur.get(fp.id);
    if (!c) return;
    const have = new Set((c.plans || []).map((x) => x.id));
    const more = (fp.plans || []).filter((x) => x && !have.has(x.id));
    const memo = !c.memo && fp.memo ? fp.memo : c.memo;
    if (more.length || memo !== c.memo) plan.upd.push({ name: 'projects', before: c, after: { ...c, plans: [...(c.plans || []), ...more], memo: memo || '' } });
  });
  const ybCur = new Map((cur.yb || []).map((y) => [y.id, y]));
  plan.add.yb = [];
  file.yb.forEach((y) => {
    const c = ybCur.get(y.id);
    if (!c) { plan.add.yb.push(y); return; }
    const days = new Set(c.days || []);
    const more = y.days.filter((d) => !days.has(d));
    const memo = !c.memo && y.memo ? y.memo : c.memo;
    if (more.length || memo !== c.memo) plan.yb.push({ before: c, after: { ...c, days: [...days, ...more].sort(), memo: memo || '' } });
  });
  if (file.settings) {
    const before = cur.settings || {};
    const after = clone(before);
    after.cats = after.cats || []; after.topics = after.topics || [];
    let changed = false;
    (file.settings.cats || []).forEach((fc) => {
      const c = after.cats.find((x) => x.id === fc.id);
      if (!c) { after.cats.push(clone(fc)); changed = true; return; }
      c.subs = c.subs || [];
      (fc.subs || []).forEach((fs) => { if (!c.subs.some((s) => s.id === fs.id)) { c.subs.push(clone(fs)); changed = true; } });
    });
    (file.settings.topics || []).forEach((ft) => { if (!after.topics.some((t) => t.id === ft.id)) { after.topics.push(clone(ft)); changed = true; } });
    Object.keys(file.settings).forEach((k) => { if (!(k in after)) { after[k] = clone(file.settings[k]); changed = true; } });
    if (changed) plan.settings = { before, after };
  }
  return plan;
}
// 파일의 모든 항목이 지금(after)에 있는지 하나씩 확인
function verifyMerge(file, after) {
  const got = zeroC(), missing = [];
  ['items', 'notes', 'records', 'routines', 'projects'].forEach((n) => {
    const ids = new Set((after[n] || []).map((o) => o.id));
    file[n].forEach((o) => { if (ids.has(o.id)) got[ckKey(n, o)]++; else missing.push(labelOf(n, o)); });
  });
  const pjA = new Map((after.projects || []).map((p) => [p.id, new Set((p.plans || []).map((x) => x.id))]));
  file.projects.forEach((fp) => { const set = pjA.get(fp.id); if (!set) return; (fp.plans || []).forEach((x) => { if (x && !set.has(x.id)) missing.push(`향후 계획 ${x.title || ''}`); }); });
  const ybA = new Map((after.yb || []).map((y) => [y.id, new Set(y.days || [])]));
  const topicName = (id) => ((after.settings || {}).topics || []).find((t) => t.id === id)?.name || '이어북';
  file.yb.forEach((y) => {
    const set = ybA.get(y.id) || new Set();
    y.days.forEach((d) => { if (set.has(d)) got.yb++; else missing.push(`${topicName(y.topic)} ${d.replace(/-/g, '.')}`); });
  });
  const st = after.settings || {};
  const fs = file.settings || {};
  (fs.cats || []).forEach((c) => { if ((st.cats || []).some((x) => x.id === c.id)) got.ct++; else missing.push(`분류 ${c.name || ''}`); });
  (fs.topics || []).forEach((t) => { if ((st.topics || []).some((x) => x.id === t.id)) got.ct++; else missing.push(`주제 ${t.name || ''}`); });
  return { got, missing };
}
// 백업에는 있는데 지금은 없는 것
function missingNow(bk, now) {
  return verifyMerge(bk, now).missing;
}
const fmtAt = (ms) => { const t = new Date(ms); return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
async function backupCurrent(reason) {
  const data = snapshot();
  return D.backupNow(U(), data, reason, APP_VERSION, countsOf(data));
}
// 점검: 지금 건수 vs 최근 백업 건수
async function runCheck() {
  const list = await D.listBackups(U());
  const now = snapshot(), nowC = countsOf(now);
  if (!list.length) return { nowC, bk: null };
  const bk = list[0];
  let bkData = null, bkC = bk.counts;
  if (!bkC) { bkData = normalizeData(await D.loadBackup(U(), bk)); bkC = countsOf(bkData); }
  const less = CK.some(([k]) => (nowC[k] || 0) < (bkC[k] || 0));
  const same = CK.every(([k]) => (nowC[k] || 0) === (bkC[k] || 0));
  let missing = [];
  if (less) { bkData = bkData || normalizeData(await D.loadBackup(U(), bk)); missing = missingNow(bkData, now); }
  return { nowC, bk, bkC, less, same, missing, bkData };
}
async function refreshCheckStatus() {
  try { const r = await runCheck(); S.ckStatus = !r.bk ? 'none' : r.less ? 'less' : 'ok'; } catch (e) { S.ckStatus = null; }
  render();
}
function ckTable(h1, h2, a, b, mark) {
  return `<table class="ck"><thead><tr><th></th><th>${h1}</th><th>${h2}</th><th></th></tr></thead><tbody>${CK.map(([k, l]) => {
    const x = a[k] || 0, y = b ? b[k] || 0 : '';
    const m = mark ? mark(x, y) : '';
    return `<tr class="${m === 'no' ? 'bad' : ''}"><td>${l}</td><td>${x}</td><td>${y}</td><td class="${m}">${m === 'ok' ? '✓' : m === 'no' ? '!' : m === 'up' ? '+' + (x - y) : ''}</td></tr>`;
  }).join('')}</tbody></table>`;
}
const missList = (list) => list.length ? `<div class="miss">${list.slice(0, 30).map(esc).join('<br>')}${list.length > 30 ? `<br>외 ${list.length - 30}건` : ''}</div>` : '';
function checkHtml() {
  const sh = S.sheet;
  let h = band('#111111', '데이터 점검');
  if (sh.busy || !sh.r) return h + '<p class="muted" style="font-size:14px;margin-top:14px">확인하는 중</p>';
  const r = sh.r;
  if (!r.bk) return h + `<div class="st">아직 백업이 없어요</div>${ckTable('지금', '', r.nowC, null, () => '')}<div class="acts"><button class="btn" data-act="close">닫기</button><button class="btn pri" data-act="ckBackup">지금 백업</button></div>`;
  const st = r.same ? '<div class="st ok"><i></i>모두 일치</div>' : r.less ? `<div class="st bad"><i></i>백업보다 줄어든 항목이 있어요</div>` : '<div class="st ok"><i></i>줄어든 항목 없음</div>';
  h += st + ckTable('지금', '최근 백업', r.nowC, r.bkC, (x, y) => x === y ? 'ok' : x < y ? 'no' : 'up');
  h += `<p class="meta">최근 백업 ${fmtAt(r.bk.at)}${r.bk.ver ? ' · v' + esc(r.bk.ver) : ''}</p>`;
  if (r.less) h += missList(r.missing);
  h += r.less
    ? `<div class="acts"><button class="btn" data-act="ckBackup">지금 백업</button><button class="btn pri" data-act="ckRevive">되살리기</button></div>`
    : `<div class="acts"><button class="btn" data-act="close">닫기</button><button class="btn pri" data-act="ckBackup">지금 백업</button></div>`;
  return h;
}
function impPrevHtml() {
  const sh = S.sheet;
  let h = band('#111111', '백업 파일로 복원');
  h += `<p class="meta">${esc(sh.name || '')}${sh.at ? `<br>${esc(sh.at)}` : ''}</p>`;
  h += ckTable('파일', '지금', countsOf(sh.file), countsOf(snapshot()), () => '');
  return h + `<div class="acts"><button class="btn" data-act="close">취소</button><button class="btn pri" data-act="impGo" ${sh.busy ? 'disabled' : ''}>${sh.busy ? '복원하는 중' : '복원'}</button></div>`;
}
function impResHtml() {
  const sh = S.sheet, n = sh.missing.length;
  let h = band('#111111', '복원 결과');
  h += n ? `<div class="st bad"><i></i>${n}건이 들어오지 않았어요</div>` : '<div class="st ok"><i></i>모두 들어왔어요</div>';
  h += ckTable('파일', '들어옴', countsOf(sh.file), sh.got, (x, y) => x === y ? 'ok' : 'no');
  h += missList(sh.missing);
  return h + `<div class="acts"><button class="btn" data-act="impUndo" ${sh.busy ? 'disabled' : ''}>되돌리기</button>${n ? `<button class="btn pri" data-act="impGo" ${sh.busy ? 'disabled' : ''}>다시 시도</button>` : '<button class="btn pri" data-act="close">확인</button>'}</div>`;
}
function openImport(file, name, at) {
  openSheet({ kind: 'impPrev', file, name, at });
}
async function doImport() {
  const sh = S.sheet;
  if (sh.busy) return;
  sh.busy = true; render();
  try {
    const cur = await D.syncNow(U());
    // 복원 직전 상태를 먼저 백업. 실패하면 복원하지 않음
    await D.backupNow(U(), cur, '복원 직전 자동 백업', APP_VERSION, countsOf(cur));
    const plan = planMerge(cur, sh.file);
    await D.applyMerge(U(), plan);
    const after = await D.syncNow(U());
    const v = verifyMerge(sh.file, after);
    const prevPlan = sh.kind === 'impRes' && sh.plan ? sh.plan : null;
    const merged = prevPlan ? mergePlans(prevPlan, plan) : plan;
    S.sheet = { kind: 'impRes', file: sh.file, got: v.got, missing: v.missing, plan: merged };
  } catch (e) {
    console.error(e); sh.busy = false;
    toast('복원하지 못했어요. 인터넷 연결을 확인해 주세요');
  }
  render();
}
function mergePlans(a, b) {
  const out = { add: {}, yb: [...(a.yb || []), ...(b.yb || [])], upd: [...(a.upd || []), ...(b.upd || [])], settings: a.settings || b.settings };
  if (a.settings && b.settings) out.settings = { before: a.settings.before, after: b.settings.after };
  D.COLS.forEach((n) => { out.add[n] = [...(a.add[n] || []), ...(b.add[n] || [])]; });
  return out;
}
async function undoImport() {
  const sh = S.sheet;
  if (sh.busy) return;
  sh.busy = true; render();
  try { await D.undoMerge(U(), sh.plan); closeSheet(); toast('되돌렸어요'); } catch (e) { console.error(e); sh.busy = false; toast('되돌리지 못했어요. 인터넷 연결을 확인해 주세요'); render(); }
}
async function doSync() {
  if (S.syncing) return;
  S.syncing = true; render();
  try {
    const d = await D.syncNow(U());
    D.COLS.forEach((c) => { S[c] = d[c]; });
    if (d.settings) S.settings = { todoColor: '#CFCFCF', cats: [], topics: [], ...d.settings };
    S.syncAt = Date.now();
    if (BR) { try { BR.refresh(); } catch (e) {} }
    toast('동기화했어요');
  } catch (e) {
    console.error(e); toast('동기화하지 못했어요. 인터넷 연결을 확인해 주세요');
  }
  S.syncing = false; render();
}

function saveSettings(st) { S.settings = st; D.saveSettings(U(), st); }
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- 내보내기 ----------
async function exportXlsx(from, to) {
  const list = allItems(from, to).filter((it) => it.start <= to && itemEnd(it) >= from);
  const ev = list.filter((x) => x.type === 'event').sort((a, b) => a.start.localeCompare(b.start));
  const td = list.filter((x) => x.type === 'todo').sort((a, b) => a.start.localeCompare(b.start));
  const ST = { progress: '진행', done: '완료', cancel: '취소' };
  const inR = (d) => d && d >= from && d <= to;
  const meet = S.notes.filter((n) => n.kind === 'meeting' && inR(n.date)).sort((a, b) => a.date.localeCompare(b.date));
  const memo = S.notes.filter((n) => n.kind === 'memo' && inR(n.date)).sort((a, b) => a.date.localeCompare(b.date));
  const recs = (k) => S.records.filter((r) => r.kind === k);
  const linkT = (n) => { const it = n.linkId && findItem(n.linkId); return it ? `${it.start} ${it.title}` : ''; };
  await writeXlsx(`플랜북_${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.xlsx`, [
    { name: '일정', headers: ['시작', '종료', '제목', '분류', '메모', '구분'], widths: [12, 12, 36, 16, 50, 8], rows: ev.map((x) => ({ 시작: x.start, 종료: itemEnd(x), 제목: x.title, 분류: catLabel(x), 메모: x.memo || '', 구분: x.routine ? '루틴' : '' })) },
    { name: '할 일', headers: ['날짜', '제목', '상태', '분류', '메모'], widths: [12, 36, 8, 16, 50], rows: td.map((x) => ({ 날짜: x.start, 제목: x.title, 상태: ST[x.status || 'progress'], 분류: catLabel(x), 메모: x.memo || '' })) },
    { name: '회의', headers: ['일자', '시간', '제목', '회의장소', '참석자', '내용', '연결 일정'], widths: [12, 8, 30, 18, 24, 60, 30], rows: meet.map((n) => ({ 일자: n.date, 시간: n.time || '', 제목: n.title, 회의장소: n.place || '', 참석자: n.attendees || '', 내용: n.content || '', '연결 일정': linkT(n) })) },
    { name: '메모', headers: ['날짜', '제목', '내용', '연결 일정'], widths: [12, 30, 70, 30], rows: memo.map((n) => ({ 날짜: n.date, 제목: n.title, 내용: n.content || '', '연결 일정': linkT(n) })) },
    { name: '연봉 계약', headers: ['회사', '적용일', '기본연봉(원)', '직급', '구분', '메모'], widths: [20, 12, 16, 10, 8, 30], rows: salData().contracts.map((c) => ({ 회사: c.company || '', 적용일: c.date, '기본연봉(원)': c.base, 직급: c.rank || '', 구분: ctTypeTxt(c.type), 메모: c.memo || '' })) },
    { name: '성과급', headers: ['회사', '지급일', '금액(원)', '메모'], widths: [20, 12, 16, 30], rows: salData().bonuses.slice().reverse().map((b) => ({ 회사: b.company || '', 지급일: b.date, '금액(원)': b.amount, 메모: b.memo || '' })) },
    { name: '자격증', headers: ['자격증명', '취득일', '발급기관'], widths: [24, 12, 20], rows: recs('cert').map((r) => ({ 자격증명: r.name, 취득일: r.date, 발급기관: r.issuer })) },
    { name: '교육', headers: ['교육명', '기관', '시작일', '수료일'], widths: [30, 20, 12, 12], rows: recs('edu').map((r) => ({ 교육명: r.name, 기관: r.org, 시작일: r.start || '', 수료일: r.end })) },
  ]);
}
function exportIcs(withTodos) {
  const evs = S.items.filter((x) => x.type === 'event' || (withTodos && x.type === 'todo'))
    .map((x) => ({ uid: x.id, title: x.title, start: x.start, end: itemEnd(x), memo: x.memo, cat: catLabel(x) }));
  const today = todayStr();
  const rts = S.routines.filter((r) => r.kind === 'event' || withTodos).map((r) => {
    const o = { ...r, catName: catLabel(r), firstDate: occDates(r, r.start || today, addDays(r.start || today, 800))[0] || r.start };
    if (r.rep === 'yearly' && r.lunar) {
      const [mm, dd] = (r.md || '01-01').split('-').map(Number);
      const y0 = parse(r.start || today).getFullYear();
      o.lunarDates = [];
      for (let y = y0; y < y0 + 10; y++) lunarToSolar(y, mm, dd).forEach((d) => { if ((!r.start || d >= r.start) && (!r.end || d <= r.end)) o.lunarDates.push(d); });
    }
    return o;
  });
  downloadBlob(`플랜북_${stampName()}.ics`, new Blob([buildIcs(evs, rts)], { type: 'text/calendar;charset=utf-8' }));
}

// ---------- 동작 ----------
const ybAnchor = { d: null, topic: null, on: true };
const ybDrag = { timer: 0, active: false, on: true, days: new Set(), start: null, cur: null, x: 0, y: 0, quiet: 0 };
function ybApply(days, on) {
  const id = `${S.topic}_${S.year}`;
  const doc = ybDoc(S.topic, S.year) || { id, topic: S.topic, year: S.year, days: [], memo: '' };
  const set = new Set(doc.days || []);
  days.forEach((d) => (on ? set.add(d) : set.delete(d)));
  const nd = { ...doc, days: [...set].sort() };
  const i = S.yb.findIndex((x) => x.id === id);
  if (i >= 0) S.yb[i] = nd; else S.yb.push(nd);
  save('yb', nd); render();
}
const ybCellAt = (x, y) => { const c = document.elementFromPoint(x, y); return c && c.classList.contains('yc') ? c : null; };
function ybPreview(cur) {
  const [a, z] = ybDrag.start < cur ? [ybDrag.start, cur] : [cur, ybDrag.start];
  const col = ybDrag.on ? topicOf(S.topic).color : '#EDEDED';
  ybDrag.days = new Set();
  document.querySelectorAll('.ygrid .yc').forEach((c) => {
    if (c.dataset.orig === undefined) c.dataset.orig = c.style.background;
    const d = c.dataset.d, inR = d >= a && d <= z && !c.dataset.link;
    if (inR) ybDrag.days.add(d);
    c.style.background = inR ? col : c.dataset.orig;
  });
}
$app.addEventListener('touchstart', (e) => {
  const c = e.target.closest && e.target.closest('.yc');
  if (!c || c.dataset.link || e.touches.length > 1) return;
  const t = e.touches[0];
  ybDrag.x = t.clientX; ybDrag.y = t.clientY;
  clearTimeout(ybDrag.timer);
  ybDrag.timer = setTimeout(() => {
    const set = new Set(ybDoc(S.topic, S.year)?.days || []);
    ybDrag.active = true; ybDrag.on = !set.has(c.dataset.d); ybDrag.start = c.dataset.d; ybDrag.cur = c.dataset.d;
    ybPreview(c.dataset.d);
    if (navigator.vibrate) navigator.vibrate(15);
  }, 450);
}, { passive: true });
$app.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (!ybDrag.active) { if (Math.abs(t.clientX - ybDrag.x) + Math.abs(t.clientY - ybDrag.y) > 10) clearTimeout(ybDrag.timer); return; }
  e.preventDefault();
  const c = ybCellAt(t.clientX, t.clientY);
  if (c && c.dataset.d !== ybDrag.cur) { ybDrag.cur = c.dataset.d; ybPreview(c.dataset.d); }
}, { passive: false });
const ybEnd = () => {
  clearTimeout(ybDrag.timer);
  if (!ybDrag.active) return;
  ybDrag.active = false; ybDrag.cur = null; ybDrag.quiet = Date.now() + 500;
  ybApply([...ybDrag.days], ybDrag.on);
};
$app.addEventListener('touchend', ybEnd);
$app.addEventListener('touchcancel', ybEnd);
$app.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.yc')) e.preventDefault(); });

const ACT = {
  lv: (el) => { S.loginView = el.dataset.v; S.loginErr = ''; S.loginMsg = ''; render(); },
  doLogin: async () => {
    const em = document.getElementById('em').value.trim(), pw = document.getElementById('pw').value;
    S.busy = true; S.loginErr = ''; render();
    try { await D.login(em, pw); } catch (e) { S.loginErr = authMsg(e); }
    S.busy = false; render();
  },
  doSignup: async () => {
    const em = document.getElementById('em').value.trim(), pw = document.getElementById('pw').value, pw2 = document.getElementById('pw2').value;
    if (pw !== pw2) { S.loginErr = '비밀번호 확인이 맞지 않아요.'; render(); return; }
    S.busy = true; S.loginErr = ''; render();
    try { await D.signup(em, pw); } catch (e) { S.loginErr = authMsg(e); }
    S.busy = false; render();
  },
  doReset: async () => {
    const em = document.getElementById('em').value.trim();
    S.busy = true; S.loginErr = ''; S.loginMsg = ''; render();
    try { await D.resetPw(em); S.loginMsg = '메일을 보냈어요. 메일의 링크에서 새 비밀번호를 정해 주세요.'; } catch (e) { S.loginErr = authMsg(e); }
    S.busy = false; render();
  },
  nav: (el) => { if (el.dataset.v !== S.view) S.unlocked = false; S.view = el.dataset.v; if (S.sheet) closeSheet(); else render(); },
  mPrev: () => { let [y, m] = S.month; m--; if (m < 0) { m = 11; y--; } S.month = [y, m]; render(); },
  mNext: () => { let [y, m] = S.month; m++; if (m > 11) { m = 0; y++; } S.month = [y, m]; render(); },
  wPrev: () => { S.sel = addDays(S.sel, -7); render(); },
  wNext: () => { S.sel = addDays(S.sel, 7); render(); },
  yPrev: () => { S.year--; render(); },
  yNext: () => { S.year++; render(); },
  goToday: () => { S.sel = todayStr(); const t = new Date(); S.month = [t.getFullYear(), t.getMonth()]; render(); },
  addOn: (el) => { S.sel = el.dataset.d; newForm(el.dataset.d); },
  newOn: (el) => { S.sel = el.dataset.d; newForm(el.dataset.d); },
  daySheet: (el) => { S.sel = el.dataset.d; openSheet({ kind: 'day', d: el.dataset.d }); },
  fab: () => {
    if (S.view === 'mini') return ACT.noteNew({ dataset: { v: S.mbTab === 'meet' ? 'meeting' : 'memo' } });
    if (S.view === 'routine') return ACT.rtNew();
    newForm(S.view === 'week' || wide() ? S.sel : todayStr());
  },
  open: (el) => {
    const id = el.dataset.id;
    if (id.startsWith('r~')) {
      const [, rid, d] = id.split('~');
      const r = S.routines.find((x) => x.id === rid);
      if (r) swapSheet({ kind: 'rocc', rid, d, status: (r.st && r.st[d]) || 'progress', at: (r.mv && r.mv[d]) || d });
      return;
    }
    const it = findItem(id);
    if (it) swapSheet({ kind: 'edit', draft: { ...it }, isNew: false });
  },
  setType: (el) => { const sh = S.sheet, d = sh.draft; d.type = el.dataset.v; if (d.type === 'event') d.end = d.end && d.end >= d.start ? d.end : d.start; if (d.type === 'todo' && sh.isNew && !sh.stManual) d.status = d.start < todayStr() ? 'done' : 'progress'; render(); },
  close: () => closeSheet(),
  status: (el) => {
    const sh = S.sheet, it = sh.draft, today = todayStr(), v = el.dataset.v;
    if (sh.isNew) { sh.stManual = true; it.status = v; render(); return; }
    // 지난 할 일을 완료·취소할 때: 등록일자에 남길지, 오늘로 옮길지 고름 (기본: 등록일자)
    if (!sh.doneAt && v !== 'progress' && (it.status || 'progress') === 'progress' && it.start < today) { sh.doneAt = 'reg'; sh.regDate = it.start; }
    if (v === 'progress' && sh.doneAt) { if (sh.doneAt === 'today') { it.start = sh.regDate; delete it.origStart; } sh.doneAt = null; }
    it.status = v; render();
  },
  doneAt: (el) => {
    const sh = S.sheet, it = sh.draft, v = el.dataset.v;
    if (v === 'today') { it.origStart = sh.regDate; it.start = todayStr(); } else { it.start = sh.regDate; delete it.origStart; }
    sh.doneAt = v; render();
  },
  ybSwitch: () => {
    const it = S.sheet.draft;
    if (it.yb) it.yb = '';
    else {
      const t = (S.settings.topics || [])[0];
      if (!t) { S.sheet.err = '이어북에 주제가 없어요. 이어북에서 주제를 먼저 추가해 주세요.'; render(); return; }
      it.yb = t.id;
    }
    render();
  },
  saveItem: () => {
    const sh = S.sheet, it = { ...sh.draft };
    it.title = (it.title || '').trim();
    if (!it.title) { sh.err = '제목을 입력해 주세요.'; render(); return; }
    if (!it.start) { sh.err = '날짜를 골라 주세요.'; render(); return; }
    if (it.type === 'event') { if (!it.end || it.end < it.start) it.end = it.start; } else { delete it.end; delete it.yb; }
    if (!it.pj) delete it.pj;
    save('items', afterItemSaved(it)); closeSheet();
  },
  delItem: () => { if (!armDel()) return; D.deleteDocIn(U(), 'items', S.sheet.draft.id); closeSheet(); },

  // 미니북
  mbTab: (el) => { S.mbTab = el.dataset.v; render(); },
  noteNew: (el) => swapSheet({ kind: 'note', isNew: true, draft: { id: uid(), kind: el.dataset.v, title: '', date: todayStr(), time: '', place: '', attendees: '', content: '', linkId: '', created: Date.now() } }),
  noteFrom: (el) => {
    const it = S.sheet.draft;
    const m = /^\s*(\d{1,2}:\d{2})\s*(.*)$/.exec(it.title || '');
    swapSheet({ kind: 'note', isNew: true, back: { ...S.sheet }, draft: { id: uid(), kind: el.dataset.v, title: m ? m[2] : it.title, date: it.start, time: m ? m[1] : '', place: '', attendees: '', content: '', linkId: it.id, ...(it.pj ? { pj: it.pj } : {}), created: Date.now() } });
  },
  openNote: (el) => { const n = S.notes.find((x) => x.id === el.dataset.id); if (n) swapSheet({ kind: 'note', isNew: false, draft: { ...n } }); },
  unlink: () => { S.sheet.draft.linkId = ''; render(); },
  saveNote: () => {
    const sh = S.sheet, n = { ...sh.draft };
    n.title = (n.title || '').trim();
    if (!n.title) { sh.err = '제목을 입력해 주세요.'; render(); return; }
    if (!n.pj) delete n.pj;
    save('notes', n);
    if (sh.back) { const it = findItem(sh.back.draft.id); swapSheet({ ...sh.back, draft: it ? { ...it, ...sh.back.draft } : sh.back.draft }); } else closeSheet();
  },
  delNote: () => { if (!armDel()) return; D.deleteDocIn(U(), 'notes', S.sheet.draft.id); closeSheet(); },
  recNew: (el) => swapSheet({ kind: 'rec', isNew: true, draft: { id: uid(), kind: el.dataset.v, created: Date.now(), ...(el.dataset.v === 'salary' ? { year: String(new Date().getFullYear()) } : {}) } }),
  recOpen: (el) => { const r = S.records.find((x) => x.id === el.dataset.id); if (r) swapSheet({ kind: 'rec', isNew: false, draft: { ...r } }); },
  saveRec: () => {
    const sh = S.sheet, r = { ...sh.draft };
    const first = REC_FIELDS[r.kind].f[0][0];
    if (!String(r[first] || '').trim()) { sh.err = `${REC_FIELDS[r.kind].f[0][1]}을(를) 입력해 주세요.`; render(); return; }
    save('records', r); closeSheet();
  },
  delRec: () => { if (!armDel()) return; D.deleteDocIn(U(), 'records', S.sheet.draft.id); closeSheet(); },

  // 이어북
  topicSel: (el) => { S.topic = el.dataset.id; render(); },
  topicNew: () => openSheet({ kind: 'topic', isNew: true, draft: { id: uid(), name: '', color: PALETTE[0] } }),
  topicEdit: (el) => { const t = topicOf(el.dataset.id); if (t) openSheet({ kind: 'topic', isNew: false, draft: { ...t } }); },
  topicSave: () => {
    const sh = S.sheet, d = sh.draft;
    d.name = (d.name || '').trim();
    if (!d.name) { sh.err = '이름을 입력해 주세요.'; render(); return; }
    if (!/^#[0-9a-fA-F]{6}$/.test(d.color || '')) { sh.err = '색 코드는 #A9C7F2 같은 형식으로 넣어 주세요.'; render(); return; }
    const st = clone(S.settings); st.topics = st.topics || [];
    const i = st.topics.findIndex((t) => t.id === d.id);
    if (i >= 0) st.topics[i] = { id: d.id, name: d.name, color: d.color }; else st.topics.push({ id: d.id, name: d.name, color: d.color });
    saveSettings(st); S.topic = d.id; closeSheet();
  },
  topicDel: () => {
    if (!armDel()) return;
    const st = clone(S.settings); st.topics = (st.topics || []).filter((t) => t.id !== S.sheet.draft.id);
    saveSettings(st); S.topic = null; closeSheet();
  },
  ybTog: (el, e) => {
    if (Date.now() < ybDrag.quiet) return;
    const d = el.dataset.d;
    const set = new Set(ybDoc(S.topic, S.year)?.days || []);
    if (e && e.shiftKey && ybAnchor.d && ybAnchor.d.slice(0, 4) === d.slice(0, 4) && ybAnchor.topic === S.topic) {
      const [a, b] = ybAnchor.d < d ? [ybAnchor.d, d] : [d, ybAnchor.d];
      const linked = linkedDays(S.topic, S.year);
      const days = [];
      for (let x = a; x <= b; x = addDays(x, 1)) if (!linked.has(x)) days.push(x);
      ybApply(days, ybAnchor.on);
      return;
    }
    if (el.dataset.link) { const it = findItem(el.dataset.link); if (it) swapSheet({ kind: 'edit', draft: { ...it }, isNew: false }); return; }
    const on = !set.has(d);
    ybAnchor.d = d; ybAnchor.topic = S.topic; ybAnchor.on = on;
    ybApply([d], on);
  },
  ysumXlsx: async () => {
    const tp = topicOf(S.topic);
    const rows = [];
    summaryData(tp.id).forEach((r) => {
      r.ranges.forEach(([a, b]) => rows.push({ 연도: r.year, 기간: a === b ? md(a) : `${md(a)} ~ ${md(b)}`, 일수: (parse(b) - parse(a)) / 86400000 + 1, 메모: '' }));
      if (r.memo) rows.push({ 연도: r.year, 기간: '', 일수: '', 메모: r.memo });
    });
    try { await writeXlsx(`플랜북_이어북_${tp.name}_${stampName()}.xlsx`, [{ name: tp.name.slice(0, 30), headers: ['연도', '기간', '일수', '메모'], widths: [8, 28, 8, 60], rows }]); }
    catch (e) { toast(e.message || '내보내지 못했어요'); }
  },

  // 루틴북
  rtNew: () => swapSheet({ kind: 'rt', isNew: true, draft: { id: uid(), title: '', kind: 'event', rep: 'weekly', wdays: [parse(todayStr()).getDay()], mday: String(parse(todayStr()).getDate()), md: todayStr().slice(5), lunar: false, start: todayStr(), end: '', ...defCat(), memo: '', st: {}, created: Date.now() } }),
  rtOpen: (el) => { const r = S.routines.find((x) => x.id === el.dataset.id); if (r) swapSheet({ kind: 'rt', isNew: false, draft: clone(r) }); },
  rtKind: (el) => { S.sheet.draft.kind = el.dataset.v; render(); },
  rtRep: (el) => { S.sheet.draft.rep = el.dataset.v; render(); },
  rtCal: (el) => { S.sheet.draft.lunar = el.dataset.v === 'lunar'; render(); },
  rtWd: (el) => { const d = S.sheet.draft, w = +el.dataset.v; d.wdays = (d.wdays || []).includes(w) ? d.wdays.filter((x) => x !== w) : [...(d.wdays || []), w]; render(); },
  saveRt: () => {
    const sh = S.sheet, r = clone(sh.draft);
    r.title = (r.title || '').trim();
    if (!r.title) { sh.err = '제목을 입력해 주세요.'; render(); return; }
    if (r.rep === 'weekly' && !(r.wdays || []).length) { sh.err = '요일을 하나 이상 골라 주세요.'; render(); return; }
    if (r.rep === 'monthly') { const n = parseInt(r.mday, 10); if (!(n >= 1 && n <= 31)) { sh.err = '날짜는 1~31 사이로 넣어 주세요.'; render(); return; } r.mday = n; }
    if (!r.start) r.start = todayStr();
    if (r.end && r.end < r.start) { sh.err = '종료일이 시작일보다 빨라요.'; render(); return; }
    save('routines', r); closeSheet();
  },
  delRt: () => { if (!armDel()) return; D.deleteDocIn(U(), 'routines', S.sheet.draft.id); closeSheet(); },
  roccStatus: (el) => { S.sheet.status = el.dataset.v; render(); },
  roccSave: () => {
    const sh = S.sheet, r = clone(S.routines.find((x) => x.id === sh.rid));
    r.st = r.st || {};
    if (sh.status === 'progress') delete r.st[sh.d]; else r.st[sh.d] = sh.status;
    r.mv = r.mv || {};
    if (sh.status !== 'progress' && sh.at && sh.at !== sh.d) r.mv[sh.d] = sh.at; else delete r.mv[sh.d];
    if (!Object.keys(r.mv).length) delete r.mv;
    save('routines', r); closeSheet();
  },

  // 설정
  acc: (el) => { S.acc[el.dataset.v] = !S.acc[el.dataset.v]; render(); if (el.dataset.v === 'data' && S.acc.data) refreshCheckStatus(); },
  sync: () => doSync(),
  ckOpen: async () => { openSheet({ kind: 'check', busy: true }); try { const r = await runCheck(); if (S.sheet?.kind === 'check') { S.sheet.r = r; S.sheet.busy = false; } S.ckStatus = !r.bk ? 'none' : r.less ? 'less' : 'ok'; } catch (e) { console.error(e); closeSheet(); toast('점검하지 못했어요. 인터넷 연결을 확인해 주세요'); } render(); },
  ckBackup: async () => { const sh = S.sheet; sh.busy = true; render(); try { await backupCurrent('직접 백업'); toast('백업했어요'); } catch (e) { toast('백업하지 못했어요. 인터넷 연결을 확인해 주세요'); } ACT.ckOpen(); },
  ckRevive: () => { const r = S.sheet.r; if (r && r.bkData) openImport(r.bkData, '최근 백업', fmtAt(r.bk.at)); },
  impGo: () => doImport(),
  impUndo: () => undoImport(),
  defCat: () => openSheet({ kind: 'defcat', draft: { ...defCat() } }),
  defCatSave: () => { const st = clone(S.settings); st.defCat = S.sheet.draft.cat; st.defSub = S.sheet.draft.sub || ''; saveSettings(st); closeSheet(); },
  catEdit: (el) => { const c = catOf(el.dataset.id); if (c) openSheet({ kind: 'cat', draft: clone(c), isNew: false }); },
  catNew: () => openSheet({ kind: 'cat', draft: { id: uid(), name: '', color: PALETTE[1], subs: [] }, isNew: true }),
  todoColor: () => openSheet({ kind: 'cat', todo: true, draft: { color: S.settings.todoColor, subs: [] } }),
  pick: (el) => { S.sheet.draft.color = el.dataset.v; render(); },
  subAdd: () => { S.sheet.draft.subs.push({ id: uid(), name: '', color: null }); render(); },
  subDel: (el) => { S.sheet.draft.subs.splice(+el.dataset.i, 1); render(); },
  catSave: () => {
    const sh = S.sheet, d = sh.draft;
    if (!/^#[0-9a-fA-F]{6}$/.test(d.color || '')) { sh.err = '색 코드는 #A9C7F2 같은 형식으로 넣어 주세요.'; render(); return; }
    const st = clone(S.settings);
    if (sh.todo) st.todoColor = d.color;
    else {
      d.name = (d.name || '').trim();
      if (!d.name) { sh.err = '이름을 입력해 주세요.'; render(); return; }
      d.subs = d.subs.map((s) => ({ ...s, name: (s.name || '').trim() })).filter((s) => s.name);
      const i = st.cats.findIndex((c) => c.id === d.id);
      if (i >= 0) st.cats[i] = d; else st.cats.push(d);
      if (st.defCat === d.id && st.defSub && !d.subs.some((s) => s.id === st.defSub)) st.defSub = '';
    }
    saveSettings(st); closeSheet();
  },
  catDel: () => {
    if (S.settings.cats.length <= 1) { S.sheet.err = '분류는 하나 이상 있어야 해요.'; render(); return; }
    if (!armDel()) return;
    const st = clone(S.settings);
    st.cats = st.cats.filter((c) => c.id !== S.sheet.draft.id);
    if (st.defCat === S.sheet.draft.id) { st.defCat = st.cats[0].id; st.defSub = ''; }
    saveSettings(st); closeSheet();
  },
  xlsxOpen: () => {
    const y = new Date().getFullYear(), sh = { kind: 'xlsx', from: `${y}-01-01`, to: `${y}-12-31` };
    const hasSal = S.records.some((r) => r.kind === 'contract' || r.kind === 'bonus' || r.kind === 'salary');
    if (S.settings.recPin && !S.unlocked && hasSal) return openSheet({ kind: 'pin', mode: 'open', v: '', then: 'xlsx' });
    swapSheet(sh);
  },
  xlsxGo: async () => {
    const sh = S.sheet;
    if (!sh.from || !sh.to || sh.from > sh.to) { sh.err = '기간을 확인해 주세요.'; render(); return; }
    try { await exportXlsx(sh.from, sh.to); closeSheet(); } catch (e) { sh.err = e.message || '내보내지 못했어요.'; render(); }
  },
  icsOpen: () => openSheet({ kind: 'ics', todos: false }),
  icsGo: () => { exportIcs(!!S.sheet.todos); closeSheet(); },
  exportJson: () => {
    const t = new Date();
    downloadBlob(`플랜북_백업_${stampName()}.json`, new Blob([JSON.stringify({ app: 'planbook', ver: APP_VERSION, at: t.toISOString(), ...snapshot() }, null, 1)], { type: 'application/json' }));
  },
  importJson: () => document.getElementById('imp')?.click(),
  backups: async () => {
    openSheet({ kind: 'backups', list: null });
    try { const list = await D.listBackups(U()); if (S.sheet?.kind === 'backups') { S.sheet.list = list; render(); } }
    catch (e) { if (S.sheet) { S.sheet.list = []; render(); } }
  },
  restoreBk: async (el) => {
    const b = S.sheet.list.find((x) => x.id === el.dataset.id);
    if (!b) return;
    try { openImport(normalizeData(await D.loadBackup(U(), b)), b.reason || '자동 백업', fmtAt(b.at) + (b.ver ? ' · v' + b.ver : '')); }
    catch (e) { console.error(e); toast('백업을 읽지 못했어요'); }
  },
  logout: () => { D.logout(); },
};

// ---------- 순서 바꾸기 ----------
const abc = (a, b) => (a.name || '').localeCompare(b.name || '', 'ko', { numeric: true, sensitivity: 'base' });
function moveIn(arr, from, to) { const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; }
function applyOrder(kind, fn) {
  if (kind === 'subs') { const d = S.sheet && S.sheet.draft; if (d) { d.subs = fn(d.subs); render(); } return; }
  const st = clone(S.settings);
  st[kind] = fn(st[kind] || []);
  saveSettings(st); render();
}
const SORT_ACT = { sortAbc: (el) => applyOrder(el.dataset.v, (a) => a.slice().sort(abc)) };
let DRAG = null;
$app.addEventListener('pointerdown', (e) => {
  const g = e.target.closest && e.target.closest('.grip');
  if (!g) return;
  const list = g.closest('[data-sort]'), item = g.closest('.sitem');
  if (!list || !item) return;
  e.preventDefault();
  const items = [...list.children].filter((x) => x.classList.contains('sitem'));
  const rects = items.map((x) => x.getBoundingClientRect());
  const from = items.indexOf(item);
  DRAG = { list, item, items, rects, from, to: from, y0: e.clientY, kind: list.dataset.sort };
  try { g.setPointerCapture(e.pointerId); } catch (err) {}
  item.classList.add('lift');
  if (navigator.vibrate) navigator.vibrate(10);
});
$app.addEventListener('pointermove', (e) => {
  if (!DRAG) return;
  e.preventDefault();
  const { item, items, rects, from } = DRAG;
  const dy = e.clientY - DRAG.y0;
  item.style.transform = `translateY(${dy}px)`;
  const mid = rects[from].top + rects[from].height / 2 + dy;
  let to = from;
  for (let i = 0; i < rects.length; i++) {
    const c = rects[i].top + rects[i].height / 2;
    if (i < from && mid < c) { to = i; break; }
    if (i > from && mid > c) to = i;
  }
  DRAG.to = to;
  const h = rects[from].height + (rects[1] ? Math.max(0, rects[1].top - rects[0].bottom) : 0);
  items.forEach((x, i) => {
    if (x === item) return;
    let off = 0;
    if (from < to && i > from && i <= to) off = -h;
    if (from > to && i >= to && i < from) off = h;
    x.style.transform = off ? `translateY(${off}px)` : '';
  });
});
const dragEnd = () => {
  if (!DRAG) return;
  const { from, to, kind, items } = DRAG;
  items.forEach((x) => { x.style.transform = ''; x.classList.remove('lift'); });
  DRAG = null;
  if (from !== to) applyOrder(kind, (a) => moveIn(a, from, to));
};
$app.addEventListener('pointerup', dragEnd);
$app.addEventListener('pointercancel', dragEnd);

const TD_ACT = {
  // 먼슬리 체크박스: 진행 ↔ 완료. 지난 할 일은 등록일자에 그대로 완료로 남김
  tdTog: (el) => {
    const it = S.items.find((x) => x.id === el.dataset.id);
    if (!it) return;
    const st = it.status || 'progress';
    const next = { ...it, status: st === 'done' ? 'progress' : 'done' };
    if (next.status === 'progress' && it.origStart) { next.start = it.origStart; delete next.origStart; }
    save('items', next);
  },
};
Object.assign(ACT, PJ_ACT, SAL_ACT, SORT_ACT, TD_ACT);

// ---------- 입력 ----------
$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !$app.contains(el)) return;
  const f = ACT[el.dataset.act];
  if (f) { e.preventDefault(); f(el, e); }
});
function setField(el, live) {
  const sh = S.sheet, d = sh.draft || sh, f = el.dataset.f;
  if (f === 'hex') {
    if (/^#[0-9a-fA-F]{6}$/.test(el.value)) {
      d.color = el.value.toUpperCase();
      const b = document.getElementById('bandT')?.parentElement;
      if (b) { b.style.background = d.color; b.style.color = textOn(d.color); }
    }
    return false;
  }
  if (el.type === 'checkbox') { d[f] = el.checked; return false; }
  if (f === 'mm' || f === 'dd') {
    const [mm, dd] = (d.md || '01-01').split('-');
    d.md = f === 'mm' ? `${String(el.value).padStart(2, '0')}-${dd}` : `${mm}-${String(el.value).padStart(2, '0')}`;
    return false;
  }
  if (sh.kind === 'xlsx') { sh[f] = el.value; return false; }
  if (sh.kind === 'pjPick') { sh[f] = el.value; return !live; }
  if (sh.kind === 'pjDone') { sh[f] = el.value; return false; }
  d[f] = el.value;
  if ((f === 'title' || f === 'name') && el.id !== 'bandT') { const b = document.getElementById('bandT'); if (b && b.tagName !== 'INPUT') b.textContent = el.value || ' '; }
  if (live) return false;
  if (f === 'cat') d.sub = '';
  if (f === 'start' && d.type === 'event' && (d.end || '') < el.value) d.end = el.value;
  if (f === 'start' && d.type === 'todo' && sh.kind === 'edit' && sh.isNew && !sh.stManual) { d.status = el.value < todayStr() ? 'done' : 'progress'; return true; }
  return el.tagName === 'SELECT' || (el.type === 'date' && sh.kind === 'edit');
}
$app.addEventListener('input', (e) => {
  const el = e.target;
  if (!S.sheet) return;
  if (salLive(el)) return;
  if (el.dataset.f) setField(el, true);
  if (el.dataset.sf === 'name') S.sheet.draft.subs[+el.dataset.i].name = el.value;
});
$app.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'imp' && el.files[0]) {
    try {
      const raw = JSON.parse(await el.files[0].text());
      const at = raw.at ? fmtAt(Date.parse(raw.at)) + (raw.ver ? ' · v' + raw.ver : '') : '';
      openImport(normalizeData(raw), el.files[0].name, at);
    } catch (err) { toast('백업 파일을 읽지 못했어요'); }
    el.value = '';
    return;
  }
  if (el.dataset.pjmemo) {
    const p = pjOf(S.pjId);
    if (p && (p.memo || '') !== el.value) savePj({ ...p, memo: el.value });
    return;
  }
  if (el.dataset.ybmemo) {
    const id = `${S.topic}_${S.year}`;
    const doc = ybDoc(S.topic, S.year) || { id, topic: S.topic, year: S.year, days: [], memo: '' };
    save('yb', { ...doc, memo: el.value });
    return;
  }
  if (!S.sheet) return;
  if (salLive(el)) { el.value = S.sheet.draft[el.dataset.f] ? commas(S.sheet.draft[el.dataset.f]) : ''; return; }
  if (el.dataset.f) { if (setField(el, false)) render(); }
  if (el.dataset.pick) { S.sheet.draft.color = el.value.toUpperCase(); render(); }
  if (el.dataset.sf === 'mode') { const s = S.sheet.draft.subs[+el.dataset.i]; s.color = el.value === 'own' ? (s.color || S.sheet.draft.color) : null; render(); }
  if (el.dataset.sf === 'color') { S.sheet.draft.subs[+el.dataset.i].color = el.value.toUpperCase(); render(); }
});
let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 120); });
let lastDay = todayStr();
setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); render(); } }, 60000);

// 안드로이드 앱(위젯)과 연결
const BR = window.PlanbookBridge || null;
let brT;
const bridgeRefresh = () => { if (!BR) return; clearTimeout(brT); brT = setTimeout(() => { try { BR.refresh(); } catch (e) { /* 무시 */ } }, 1500); };
function openAt(d, v) {
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { S.sel = d; const t = parse(d); S.month = [t.getFullYear(), t.getMonth()]; }
  if (v && ['month', 'week', 'mini', 'year', 'routine'].includes(v)) S.view = v;
  if (S.sheet) closeSheet(); else render();
}
window.__pbOpen = openAt;
{
  const q = new URLSearchParams(location.search);
  if (q.get('d') || q.get('v')) {
    const d = q.get('d'), v = q.get('v');
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) { S.sel = d; const t = parse(d); S.month = [t.getFullYear(), t.getMonth()]; }
    if (v && ['month', 'week', 'mini', 'year', 'routine'].includes(v)) S.view = v;
    history.replaceState(null, '', location.pathname);
  }
}

D.onUser((user) => {
  if (unwatch) { unwatch(); unwatch = null; }
  if (BR) { try { if (user) BR.setAuth(user.refreshToken, user.uid); else BR.clearAuth(); } catch (e) { /* 무시 */ } }
  S.user = user || null; S.settings = null; S.loaded = {}; S.sheet = null;
  D.COLS.forEach((c) => { S[c] = []; });
  if (user) {
    let first = true;
    const check = () => { if (first && ALL_LOADED()) { first = false; ensureSettingsAndBackup(); } };
    unwatch = D.watch(user.uid, (name, list) => {
      S[name] = list; S.loaded[name] = true; check(); render(); bridgeRefresh();
    }, (st) => {
      if (!st) { const d = DEFAULT_SETTINGS(); S.settings = d; D.saveSettings(user.uid, d); }
      else S.settings = { todoColor: '#CFCFCF', cats: [], topics: [], ...st };
      check(); render(); bridgeRefresh();
    }, (err, name) => {
      console.error(err);
      if (name && !S.loaded[name]) { S.loaded[name] = true; render(); }
      toast(name === 'projects' ? '플젝북을 불러오지 못했어요' : '데이터를 불러오지 못했어요');
    });
  }
  render();
});
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
