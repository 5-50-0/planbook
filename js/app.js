import * as D from './data.js';
import { HOLIDAYS } from './holidays.js';
import {
  ymd, parse, addDays, todayStr, WD, EN_MONTH, weekStart, monthWeeks, weekOfMonth,
  itemsOnDay, sortDay, layoutWeek, textOn, PALETTE, uid, esc, isCarried, itemEnd,
} from './util.js';
import { occItems, occDates, nextOcc, ruleText, lunarToSolar } from './routine.js';
import { writeXlsx, buildIcs, downloadBlob, stampName } from './export.js';

export const APP_VERSION = '1.2.2';

const IC = {
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
  user: undefined, items: [], notes: [], records: [], routines: [], yb: [], settings: null,
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
      h += `<button class="chip" style="grid-column:${s.col + 1}/span ${s.span};grid-row:${s.lane + 2};background:${c};color:${textOn(c)}" data-act="open" data-id="${s.item.id}">${esc(s.item.title || '(제목 없음)')}</button>`;
    });
    h += '</div>';
  }
  return `<div class="month">${h}</div>`;
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
    h += recSection('salary', '연봉', ['연도', '기본연봉', '성과급', '직급'], (r) => [r.year, r.base, r.bonus, r.rank], (a, b) => String(b.year).localeCompare(String(a.year)));
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
    st.cats.forEach((c) => {
      h += `<button class="row" data-act="catEdit" data-id="${c.id}"><span class="sw" style="background:${c.color}"></span>${esc(c.name)}<span class="vl">세분류 ${(c.subs || []).length}</span></button>`;
      (c.subs || []).forEach((s) => {
        h += `<button class="row sub" data-act="catEdit" data-id="${c.id}"><span class="sw" style="background:${s.color || c.color}"></span>${esc(s.name)}<span class="vl">${s.color ? '직접 지정' : '대분류 색'}</span></button>`;
      });
    });
    h += `<button class="row" data-act="todoColor"><span class="sw" style="background:${st.todoColor}"></span>할 일</button>`;
    h += `<button class="row" data-act="catNew" style="font-size:14px">${small(IC.plus)}분류 추가</button>`;
  }
  h += `<button class="acc" data-act="acc" data-v="topics"><span>이어북 주제 색</span><span>${A.topics ? '−' : '+'}</span></button>`;
  if (A.topics) {
    (st.topics || []).forEach((t) => { h += `<button class="row" data-act="topicEdit" data-id="${t.id}"><span class="sw" style="background:${t.color}"></span>${esc(t.name)}</button>`; });
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
  if (isTodo && !sh.isNew) h += `<span class="lb">상태</span>${seg([['progress', '진행'], ['done', '완료'], ['cancel', '취소']], st, 'status')}`;
  h += isTodo ? field('날짜', 'start', it.start, 'date')
    : `<div class="two"><div>${field('시작', 'start', it.start, 'date')}</div><div>${field('종료', 'end', it.end || it.start, 'date')}</div></div>`;
  if (isTodo && isCarried(it, todayStr())) h += `<p class="muted" style="font-size:13px;margin:8px 0 0">원래 날짜 ${fmtMD(it.start)}</p>`;
  h += `<span class="lb">분류</span>${catSelects(it)}`;
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
    h += field('회의장소', 'place', n.place) + field('참석자', 'attendees', n.attendees) + area('내용', 'content', n.content, 180);
  } else {
    h += field('날짜', 'date', n.date, 'date') + area('내용', 'content', n.content, 200);
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
    h += '<span class="lb">세분류</span>';
    d.subs.forEach((s, i) => {
      h += `<div class="subrow"><input aria-label="세분류 이름" data-sf="name" data-i="${i}" value="${esc(s.name)}">
        <select aria-label="세분류 색" data-sf="mode" data-i="${i}"><option value="inherit" ${s.color ? '' : 'selected'}>대분류 색</option><option value="own" ${s.color ? 'selected' : ''}>직접 지정</option></select>
        <input type="color" aria-label="세분류 색 고르기" data-sf="color" data-i="${i}" value="${s.color || col}" ${s.color ? '' : 'disabled'}>
        <button class="rm" aria-label="세분류 삭제" data-act="subDel" data-i="${i}">${small(IC.x, 18)}</button></div>`;
    });
    h += '<button class="btn sm" data-act="subAdd">세분류 추가</button>';
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
    : V === 'year' ? yearBody() : V === 'ysum' ? ysumBody() : V === 'routine' ? routineBody() : settingsBody();
  const navV = V === 'ysum' ? 'year' : V;
  let html;
  if (wide()) {
    const mi = (v, l) => `<button class="mi ${navV === v ? 'on' : ''}" data-act="nav" data-v="${v}">${l}</button>`;
    const right = V === 'month' ? `<aside class="rpanel"><p class="dt ${dayClass(S.sel)}">${fmtMD(S.sel)}${HOLIDAYS[S.sel] ? ' · ' + HOLIDAYS[S.sel] : ''}</p><p class="dn">${parse(S.sel).getDate()}</p>${dayList(S.sel)}<button class="btn sm" style="margin-top:6px" data-act="newOn" data-d="${S.sel}">추가</button></aside>` : '';
    html = `<div class="wide"><nav class="side">${mi('month', '먼슬리')}${mi('week', '위클리')}${mi('mini', '미니북')}${mi('year', '이어북')}${mi('routine', '루틴북')}<div class="grow"></div><button class="mi sync ${S.syncing ? 'spin' : ''}" data-act="sync">${IC.sync}<span>동기화</span><small>${S.syncAt ? fmtAt(S.syncAt).slice(11) : ''}</small></button><button class="mi set ${V === 'settings' ? 'on' : ''}" data-act="nav" data-v="settings">설정</button></nav><main class="main">${page}</main>${right}${sheetHtml()}</div>`;
  } else {
    const tab = (v, l) => `<button class="${navV === v ? 'on' : ''}" data-act="nav" data-v="${v}">${l}</button>`;
    const showFab = ['month', 'week'].includes(V);
    const fab = showFab ? `<button class="fab" aria-label="추가" data-act="fab">${IC.plus}</button>` : '';
    html = `<div class="phone"><div class="page">${page}</div>${V !== 'settings' ? `<nav class="nav">${tab('month', '먼슬리')}${tab('week', '위클리')}${tab('mini', '미니북')}${tab('year', '이어북')}${tab('routine', '루틴북')}</nav>` : ''}${fab}${sheetHtml()}</div>`;
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
  return { items: S.items, notes: S.notes, records: S.records, routines: S.routines, yb: S.yb, settings: S.settings };
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
const CK = [['ev', '일정'], ['td', '할 일'], ['mt', '회의'], ['mm', '메모'], ['rc', '기록'], ['rt', '루틴'], ['yb', '이어북 칠한 날'], ['ct', '분류 · 주제']];
const ckKey = (name, o) => name === 'items' ? (o.type === 'todo' ? 'td' : 'ev') : name === 'notes' ? (o.kind === 'meeting' ? 'mt' : 'mm') : name === 'records' ? 'rc' : 'rt';
const zeroC = () => Object.fromEntries(CK.map(([k]) => [k, 0]));
function countsOf(d) {
  const c = zeroC();
  ['items', 'notes', 'records', 'routines'].forEach((n) => (d[n] || []).forEach((o) => { c[ckKey(n, o)]++; }));
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
const RK = { salary: '연봉', cert: '자격증', edu: '교육' };
function labelOf(name, o) {
  if (name === 'items') return `${(o.start || '').replace(/-/g, '.')} ${o.title || '(제목 없음)'}`;
  if (name === 'notes') return `${(o.date || '').replace(/-/g, '.')} ${o.title || '(제목 없음)'}`;
  if (name === 'records') return `${RK[o.kind] || '기록'} ${o.name || o.year || ''}`;
  return `루틴 ${o.title || ''}`;
}
// 지금(cur)에 파일(file)을 합치는 계획. 지금 있는 것은 그대로 둠
function planMerge(cur, file) {
  const plan = { add: {}, yb: [], settings: null };
  ['items', 'notes', 'records', 'routines'].forEach((n) => {
    const ids = new Set((cur[n] || []).map((o) => o.id));
    plan.add[n] = file[n].filter((o) => !ids.has(o.id));
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
  ['items', 'notes', 'records', 'routines'].forEach((n) => {
    const ids = new Set((after[n] || []).map((o) => o.id));
    file[n].forEach((o) => { if (ids.has(o.id)) got[ckKey(n, o)]++; else missing.push(labelOf(n, o)); });
  });
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
    const x = a[k] || 0, y = b[k] || 0;
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
  if (!r.bk) return h + `<div class="st">아직 백업이 없어요</div>${ckTable('지금', '', r.nowC, {}, () => '')}<div class="acts"><button class="btn" data-act="close">닫기</button><button class="btn pri" data-act="ckBackup">지금 백업</button></div>`;
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
  const out = { add: {}, yb: [...(a.yb || []), ...(b.yb || [])], settings: a.settings || b.settings };
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
    { name: '연봉', headers: ['연도', '기본연봉', '성과급', '직급'], widths: [8, 16, 16, 12], rows: recs('salary').sort((a, b) => String(a.year).localeCompare(String(b.year))).map((r) => ({ 연도: r.year, 기본연봉: r.base, 성과급: r.bonus, 직급: r.rank })) },
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
  nav: (el) => { S.view = el.dataset.v; if (S.sheet) closeSheet(); else render(); },
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
      if (r) swapSheet({ kind: 'rocc', rid, d, status: (r.st && r.st[d]) || 'progress' });
      return;
    }
    const it = findItem(id);
    if (it) swapSheet({ kind: 'edit', draft: { ...it }, isNew: false });
  },
  setType: (el) => { const d = S.sheet.draft; d.type = el.dataset.v; if (d.type === 'event') d.end = d.end && d.end >= d.start ? d.end : d.start; render(); },
  close: () => closeSheet(),
  status: (el) => {
    const it = S.sheet.draft, today = todayStr(), v = el.dataset.v;
    if (v !== 'progress' && (it.status || 'progress') === 'progress' && it.start < today) { it.origStart = it.start; it.start = today; }
    it.status = v; render();
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
    save('items', it); closeSheet();
  },
  delItem: () => { if (!armDel()) return; D.deleteDocIn(U(), 'items', S.sheet.draft.id); closeSheet(); },

  // 미니북
  mbTab: (el) => { S.mbTab = el.dataset.v; render(); },
  noteNew: (el) => swapSheet({ kind: 'note', isNew: true, draft: { id: uid(), kind: el.dataset.v, title: '', date: todayStr(), time: '', place: '', attendees: '', content: '', linkId: '', created: Date.now() } }),
  noteFrom: (el) => {
    const it = S.sheet.draft;
    const m = /^\s*(\d{1,2}:\d{2})\s*(.*)$/.exec(it.title || '');
    swapSheet({ kind: 'note', isNew: true, back: { ...S.sheet }, draft: { id: uid(), kind: el.dataset.v, title: m ? m[2] : it.title, date: it.start, time: m ? m[1] : '', place: '', attendees: '', content: '', linkId: it.id, created: Date.now() } });
  },
  openNote: (el) => { const n = S.notes.find((x) => x.id === el.dataset.id); if (n) swapSheet({ kind: 'note', isNew: false, draft: { ...n } }); },
  unlink: () => { S.sheet.draft.linkId = ''; render(); },
  saveNote: () => {
    const sh = S.sheet, n = { ...sh.draft };
    n.title = (n.title || '').trim();
    if (!n.title) { sh.err = '제목을 입력해 주세요.'; render(); return; }
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
  xlsxOpen: () => { const y = new Date().getFullYear(); openSheet({ kind: 'xlsx', from: `${y}-01-01`, to: `${y}-12-31` }); },
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
  d[f] = el.value;
  if ((f === 'title' || f === 'name') && el.id !== 'bandT') { const b = document.getElementById('bandT'); if (b && b.tagName !== 'INPUT') b.textContent = el.value || ' '; }
  if (live) return false;
  if (f === 'cat') d.sub = '';
  if (f === 'start' && d.type === 'event' && (d.end || '') < el.value) d.end = el.value;
  return el.tagName === 'SELECT' || (el.type === 'date' && sh.kind === 'edit');
}
$app.addEventListener('input', (e) => {
  const el = e.target;
  if (!S.sheet) return;
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
  if (el.dataset.ybmemo) {
    const id = `${S.topic}_${S.year}`;
    const doc = ybDoc(S.topic, S.year) || { id, topic: S.topic, year: S.year, days: [], memo: '' };
    save('yb', { ...doc, memo: el.value });
    return;
  }
  if (!S.sheet) return;
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
    }, (err) => { console.error(err); toast('데이터를 불러오지 못했어요'); });
  }
  render();
});
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
