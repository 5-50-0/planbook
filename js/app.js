import * as D from './data.js';
import { HOLIDAYS } from './holidays.js';
import {
  ymd, parse, addDays, todayStr, WD, EN_MONTH, weekStart, monthWeeks, weekOfMonth,
  itemsOnDay, sortDay, layoutWeek, textOn, PALETTE, uid, esc, isCarried,
} from './util.js';

export const APP_VERSION = '1.0.2';

const IC = {
  l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 6l-6 6 6 6"/></svg>',
  r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 6l6 6-6 6"/></svg>',
  set: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M9 6l6 6-6 6"/></svg>',
};

const DEFAULT_SETTINGS = () => ({
  cats: [
    { id: 'c_work', name: '회사', color: '#A9C7F2', subs: [{ id: uid(), name: '회의', color: null }] },
    { id: 'c_me', name: '개인', color: '#F2B3C7', subs: [] },
    { id: 'c_att', name: '근태', color: '#F3CD95', subs: [{ id: uid(), name: '출장', color: null }, { id: uid(), name: '휴가', color: null }, { id: uid(), name: '여행', color: null }] },
  ],
  todoColor: '#CFCFCF',
  backupVer: APP_VERSION,
});

const S = {
  user: undefined, items: [], settings: null, loaded: { items: false, settings: false },
  view: 'month', sel: todayStr(), month: null,
  loginView: 'login', loginErr: '', loginMsg: '', busy: false,
  sheet: null, // {kind:'day'|'edit'|'choose'|'cat'|'backups', ...}
  acc: { cats: false, data: false, acct: false },
  toast: '', delArm: false,
};
let unwatch = null;
const $app = document.getElementById('app');
const wide = () => window.innerWidth >= 900;

// ---------- 색·분류 ----------
const catOf = (id) => (S.settings?.cats || []).find((c) => c.id === id);
function colorOf(it) {
  if (it.type === 'todo') return S.settings?.todoColor || '#CFCFCF';
  const c = catOf(it.cat);
  if (!c) return '#CFCFCF';
  const s = (c.subs || []).find((x) => x.id === it.sub);
  return (s && s.color) || c.color;
}
const sty = (hex) => `--c:${hex};--t:${textOn(hex)}`;

// ---------- 공통 ----------
function toast(msg) {
  S.toast = msg; render();
  clearTimeout(toast.t); toast.t = setTimeout(() => { S.toast = ''; render(); }, 2200);
}
function dayClass(d) {
  const w = parse(d).getDay();
  return HOLIDAYS[d] ? 'hol' : w === 0 ? 'sun' : w === 6 ? 'sat' : '';
}
const fmtMD = (d) => { const x = parse(d); return `${x.getMonth() + 1}월 ${x.getDate()}일 (${WD[x.getDay()]})`; };

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

function logoHtml() {
  return '<div class="logo"><span style="width:100%;background:#A9C7F2"></span><span style="width:78%;background:#F2B3C7"></span><span style="width:56%;background:#F3CD95"></span></div>';
}
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

// ---------- 먼슬리 ----------
function monthHead() {
  const [y, m] = S.month;
  return `<div class="head"><div class="big"><h1>${m + 1}</h1><div class="sub"><p class="y">${y}</p><p class="m">${EN_MONTH[m]}</p></div></div>
    <div class="tools">${wide() ? `<button class="ico bd" aria-label="이전 달" data-act="mPrev">${IC.l}</button><button class="today" data-act="goToday">오늘</button><button class="ico bd" aria-label="다음 달" data-act="mNext">${IC.r}</button>`
    : `<button class="ico" aria-label="이전 달" data-act="mPrev">${IC.l}</button><button class="today" data-act="goToday">오늘</button><button class="ico" aria-label="다음 달" data-act="mNext">${IC.r}</button><button class="ico" aria-label="설정" data-act="nav" data-v="settings">${IC.set}</button>`}</div></div>`;
}
function monthBody() {
  const [y, m] = S.month;
  const weeks = monthWeeks(y, m);
  const today = todayStr();
  const W = wide();
  const headH = W ? 150 : 100, navH = W ? 0 : 64;
  const avail = window.innerHeight - headH - navH - 30;
  const weekH = Math.max(W ? 90 : 60, avail / weeks.length);
  const laneH = W ? 23 : 18, topH = W ? 30 : 22;
  const maxL = Math.max(1, Math.floor((weekH - topH) / laneH));
  let h = `<div class="wdrow">${WD.map((w, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}</div>`;
  for (const days of weeks) {
    const segs = layoutWeek(S.items, days, today);
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

// 하루 목록 (상자)
function cardHtml(it) {
  const c = colorOf(it);
  const memo = it.memo ? `<div class="cm">${esc(it.memo)}</div>` : '';
  return `<button class="card" style="${sty(c)}" data-act="open" data-id="${it.id}"><div class="ch">${esc(it.title || '(제목 없음)')}</div>${memo}</button>`;
}
function dayList(d) {
  const list = sortDay(itemsOnDay(S.items, d, todayStr()));
  return list.length ? list.map(cardHtml).join('') : '';
}

// ---------- 위클리 ----------
function weekHead() {
  const ws = weekStart(S.sel);
  const we = addDays(ws, 6);
  const wm = weekOfMonth(S.sel);
  const a = parse(ws), b = parse(we);
  const range = `${a.getMonth() + 1}.${a.getDate()} – ${b.getMonth() + 1}.${b.getDate()}`;
  return `<div class="head"><div class="big"><h1>W${wm.n}</h1><div class="sub"><p class="y">${wm.year} · ${wm.month}월 ${wm.n}주차</p><p class="m">${range}</p></div></div>
    <div class="tools">${wide() ? `<button class="ico bd" aria-label="이전 주" data-act="wPrev">${IC.l}</button><button class="today" data-act="goToday">오늘</button><button class="ico bd" aria-label="다음 주" data-act="wNext">${IC.r}</button>`
    : `<button class="ico" aria-label="이전 주" data-act="wPrev">${IC.l}</button><button class="today" data-act="goToday">오늘</button><button class="ico" aria-label="다음 주" data-act="wNext">${IC.r}</button><button class="ico" aria-label="설정" data-act="nav" data-v="settings">${IC.set}</button>`}</div></div>`;
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
  return `<div class="wlist" style="border-top:1.5px solid #111">${days.map((d) => `<div class="wday ${d === today ? 'today' : ''}">
    <div><span class="dnum ${d === today ? '' : dayClass(d)}">${parse(d).getDate()}</span><div class="dwk ${dayClass(d)}">${WD[parse(d).getDay()]}${HOLIDAYS[d] ? ' · ' + HOLIDAYS[d] : ''}</div></div>
    <div>${dayList(d)}</div></div>`).join('')}</div>`;
}

// ---------- 설정 ----------
function settingsBody() {
  const st = S.settings;
  const A = S.acc;
  let h = `<div class="head"><div class="big"><h1 style="font-size:${wide() ? 56 : 44}px;letter-spacing:-2px">설정</h1></div>${wide() ? '' : `<div class="tools"><button class="ico" aria-label="닫기" data-act="nav" data-v="month">${IC.x}</button></div>`}</div><div class="setpage">`;
  h += `<button class="acc" data-act="acc" data-v="cats"><span>분류와 색</span><span>${A.cats ? '−' : '+'}</span></button>`;
  if (A.cats) {
    st.cats.forEach((c) => {
      h += `<button class="row" data-act="catEdit" data-id="${c.id}"><span class="sw" style="background:${c.color}"></span>${esc(c.name)}<span class="vl">세분류 ${(c.subs || []).length}</span></button>`;
      (c.subs || []).forEach((s) => {
        h += `<button class="row sub" data-act="catEdit" data-id="${c.id}"><span class="sw" style="background:${s.color || c.color}"></span>${esc(s.name)}<span class="vl">${s.color ? '직접 지정' : '대분류 색'}</span></button>`;
      });
    });
    h += `<button class="row" data-act="todoColor"><span class="sw" style="background:${st.todoColor}"></span>할 일</button>`;
    h += `<button class="row" data-act="catNew" style="font-size:14px">${IC.plus.replace('<svg', '<svg width="16" height="16"')}분류 추가</button>`;
  }
  h += `<button class="acc" data-act="acc" data-v="data"><span>데이터</span><span>${A.data ? '−' : '+'}</span></button>`;
  if (A.data) {
    h += `<button class="row" data-act="exportJson">백업 파일 받기<span class="vl">.json</span></button>
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

// ---------- 시트 ----------
function sheetHtml() {
  const sh = S.sheet;
  if (!sh) return '';
  let inner = '';
  if (sh.kind === 'day') {
    const list = dayList(sh.d);
    inner = `<div class="grab"></div><div class="dayhead"><b class="${dayClass(sh.d)}">${fmtMD(sh.d)}${HOLIDAYS[sh.d] ? ' · ' + HOLIDAYS[sh.d] : ''}</b><button class="ico" aria-label="닫기" data-act="close">${IC.x}</button></div>
      ${list}<button class="btn pri" style="width:100%;margin-top:8px" data-act="newOn" data-d="${sh.d}">추가</button>`;
  } else if (sh.kind === 'choose') {
    inner = `<div class="grab"></div>
      <button class="opt" style="background:#A9C7F2;color:${textOn('#A9C7F2')}" data-act="newType" data-v="event">일정${IC.go}</button>
      <button class="opt" style="background:${S.settings.todoColor};color:${textOn(S.settings.todoColor)}" data-act="newType" data-v="todo">할 일${IC.go}</button>
      <button class="btn" style="width:100%;margin-top:6px" data-act="close">닫기</button>`;
  } else if (sh.kind === 'edit') {
    inner = editHtml(sh);
  } else if (sh.kind === 'cat') {
    inner = catHtml(sh);
  } else if (sh.kind === 'backups') {
    inner = `<div class="grab"></div><div class="band" style="background:#111;color:#fff"><span>자동 백업</span><button class="x" aria-label="닫기" data-act="close">${IC.x}</button></div>`;
    if (!sh.list) inner += '<p class="muted" style="font-size:14px">불러오는 중</p>';
    else if (!sh.list.length) inner += '<p class="muted" style="font-size:14px">아직 백업이 없어요.</p>';
    else inner += sh.list.map((b) => {
      const t = new Date(b.at);
      const when = `${t.getFullYear()}.${t.getMonth() + 1}.${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      const armed = sh.arm === b.id;
      return `<div class="row"><div><div>${when}</div><div class="muted" style="font-size:12px">${esc(b.reason || '')} · ${(b.items || []).length}건</div></div>
        <button class="btn sm ${armed ? 'del' : ''}" style="margin-left:auto" data-act="restoreBk" data-id="${b.id}">${armed ? '정말 복원' : '복원'}</button></div>`;
    }).join('');
  }
  return `<div class="dim" data-act="close"></div><div class="sheet" role="dialog">${inner}</div>`;
}

function editHtml(sh) {
  const it = sh.draft;
  const c = colorOf(it);
  const isTodo = it.type === 'todo';
  const cat = catOf(it.cat);
  const st = it.status || 'progress';
  const catOpts = S.settings.cats.map((x) => `<option value="${x.id}" ${x.id === it.cat ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const subOpts = `<option value="">세분류 없음</option>` + ((cat && cat.subs) || []).map((x) => `<option value="${x.id}" ${x.id === it.sub ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  return `<div class="grab"></div>
    <div class="band" style="background:${c};color:${textOn(c)}"><span id="bandT">${esc(it.title || (isTodo ? '새 할 일' : '새 일정'))}</span><button class="x" aria-label="닫기" data-act="close">${IC.x}</button></div>
    ${sh.isNew ? `<div class="seg" style="grid-template-columns:1fr 1fr;margin-top:12px">${[['event', '일정'], ['todo', '할 일']].map(([k, l]) => `<button class="${it.type === k ? 'on' : ''}" data-act="setType" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
    ${isTodo && !sh.isNew ? `<span class="lb">상태</span><div class="seg" style="grid-template-columns:repeat(3,1fr)">${[['progress', '진행'], ['done', '완료'], ['cancel', '취소']].map(([k, l]) => `<button class="${st === k ? 'on' : ''}" data-act="status" data-v="${k}">${l}</button>`).join('')}</div>` : ''}
    <label class="lb" for="f_title">제목</label><input id="f_title" data-f="title" value="${esc(it.title || '')}">
    ${isTodo
      ? `<label class="lb" for="f_start">날짜</label><input id="f_start" type="date" data-f="start" value="${it.start}">`
      : `<div class="two"><div><label class="lb" for="f_start">시작</label><input id="f_start" type="date" data-f="start" value="${it.start}"></div><div><label class="lb" for="f_end">종료</label><input id="f_end" type="date" data-f="end" value="${it.end || it.start}"></div></div>`}
    ${isTodo && isCarried(it, todayStr()) ? `<p class="muted" style="font-size:13px;margin:8px 0 0">원래 날짜 ${fmtMD(it.start)}</p>` : ''}
    <span class="lb">분류</span><div class="two"><select aria-label="대분류" data-f="cat">${catOpts}</select><select aria-label="세분류" data-f="sub">${subOpts}</select></div>
    <label class="lb" for="f_memo">메모</label><textarea id="f_memo" data-f="memo">${esc(it.memo || '')}</textarea>
    ${sh.err ? `<p class="err">${esc(sh.err)}</p>` : ''}
    <div class="acts">${sh.isNew ? '' : `<button class="btn del" data-act="delItem">${S.delArm ? '정말 삭제' : '삭제'}</button>`}<button class="btn pri" data-act="saveItem">저장</button></div>`;
}

function catHtml(sh) {
  const d = sh.draft;
  const col = d.color;
  let h = `<div class="grab"></div><div class="band" style="background:${col};color:${textOn(col)}"><span id="bandT">${esc(sh.todo ? '할 일' : (d.name || '새 분류'))}</span><button class="x" aria-label="닫기" data-act="close">${IC.x}</button></div>`;
  if (!sh.todo) h += `<label class="lb" for="c_name">이름</label><input id="c_name" data-cf="name" value="${esc(d.name || '')}">`;
  h += `<span class="lb">색</span><div class="pal">${PALETTE.map((p) => `<button style="background:${p}" class="${p.toUpperCase() === (col || '').toUpperCase() ? 'on' : ''}" aria-label="${p}" data-act="pick" data-v="${p}"></button>`).join('')}</div>
    <label class="lb" for="c_hex">직접 지정</label><div class="hexrow"><input type="color" aria-label="색 고르기" data-act-change="pickInput" value="${col}"><input id="c_hex" data-cf="hex" value="${col}"></div>`;
  if (!sh.todo) {
    h += '<span class="lb">세분류</span>';
    d.subs.forEach((s, i) => {
      h += `<div class="subrow"><input aria-label="세분류 이름" data-sf="name" data-i="${i}" value="${esc(s.name)}">
        <select aria-label="세분류 색" data-sf="mode" data-i="${i}"><option value="inherit" ${s.color ? '' : 'selected'}>대분류 색</option><option value="own" ${s.color ? 'selected' : ''}>직접 지정</option></select>
        <input type="color" aria-label="세분류 색 고르기" data-sf="color" data-i="${i}" value="${s.color || col}" ${s.color ? '' : 'disabled'}>
        <button class="rm" aria-label="세분류 삭제" data-act="subDel" data-i="${i}">${IC.x.replace('<svg', '<svg width="18" height="18"')}</button></div>`;
    });
    h += `<button class="btn sm" data-act="subAdd">세분류 추가</button>`;
  }
  if (sh.err) h += `<p class="err">${esc(sh.err)}</p>`;
  h += `<div class="acts">${!sh.todo && !sh.isNew ? `<button class="btn del" data-act="catDel">${S.delArm ? '정말 삭제' : '삭제'}</button>` : ''}<button class="btn pri" data-act="catSave">저장</button></div>`;
  return h;
}

// ---------- 전체 그리기 ----------
function render() {
  if (S.user === undefined) { $app.innerHTML = '<div class="wait">불러오는 중</div>'; return; }
  if (!S.user) { $app.innerHTML = loginHtml(); return; }
  if (!S.settings || !S.loaded.items) { $app.innerHTML = '<div class="wait">불러오는 중</div>'; return; }
  if (!S.month) { const t = parse(S.sel); S.month = [t.getFullYear(), t.getMonth()]; }
  const active = document.activeElement;
  const keepId = active && active.id && $app.contains(active) ? active.id : null;
  let page = '';
  if (S.view === 'month') page = monthHead() + monthBody();
  else if (S.view === 'week') page = weekHead() + weekBody();
  else page = settingsBody();
  const tab = (v, l, dis) => `<button class="${S.view === v ? 'on' : ''}" ${dis ? 'disabled' : `data-act="nav" data-v="${v}"`}>${l}</button>`;
  let html;
  if (wide()) {
    const mi = (v, l, dis) => `<button class="mi ${S.view === v ? 'on' : ''}" ${dis ? 'disabled' : `data-act="nav" data-v="${v}"`}>${l}</button>`;
    const right = S.view === 'month' ? `<aside class="rpanel"><p class="dt ${dayClass(S.sel)}">${fmtMD(S.sel)}${HOLIDAYS[S.sel] ? ' · ' + HOLIDAYS[S.sel] : ''}</p><p class="dn">${parse(S.sel).getDate()}</p>${dayList(S.sel) || ''}<button class="btn sm" style="margin-top:6px" data-act="newOn" data-d="${S.sel}">추가</button></aside>` : '';
    html = `<div class="wide"><nav class="side"><button class="add" data-act="choose">${IC.plus}새로 추가</button>${mi('month', '먼슬리')}${mi('week', '위클리')}${mi('mini', '미니북', 1)}${mi('year', '이어북', 1)}${mi('routine', '루틴북', 1)}<div class="grow"></div><button class="mi set ${S.view === 'settings' ? 'on' : ''}" data-act="nav" data-v="settings">설정</button></nav><main class="main">${page}</main>${right}${sheetHtml()}</div>`;
  } else {
    const fab = S.view !== 'settings' ? `<button class="fab" aria-label="추가" data-act="choose">${IC.plus}</button>` : '';
    html = `<div class="phone"><div class="page">${page}</div>${S.view !== 'settings' ? `<nav class="nav">${tab('month', '먼슬리')}${tab('week', '위클리')}${tab('mini', '미니북', 1)}${tab('year', '이어북', 1)}${tab('routine', '루틴북', 1)}</nav>` : ''}${fab}${sheetHtml()}</div>`;
  }
  if (S.toast) html += `<div class="toast">${esc(S.toast)}</div>`;
  $app.innerHTML = html;
  if (keepId) { const el = document.getElementById(keepId); if (el) el.focus(); }
}

// ---------- 동작 ----------
function openSheet(sh) {
  if (!S.sheet) history.pushState({ sheet: 1 }, '');
  S.sheet = sh; S.delArm = false; render();
}
function closeSheet(fromPop) {
  if (!S.sheet) return;
  S.sheet = null; S.delArm = false; render();
  if (!fromPop && history.state && history.state.sheet) history.back();
}
window.addEventListener('popstate', () => closeSheet(true));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

function newForm(d) {
  const draft = newItem('event', d);
  if (S.sheet) { S.sheet = { kind: 'edit', draft, isNew: true }; S.delArm = false; render(); }
  else openSheet({ kind: 'edit', draft, isNew: true });
}

function newItem(type, d) {
  const cat = S.settings.cats[0];
  return { id: uid(), type, title: '', start: d, end: d, cat: cat ? cat.id : '', sub: '', memo: '', status: 'progress', created: Date.now() };
}

async function saveItem() {
  const sh = S.sheet;
  const it = { ...sh.draft };
  it.title = (it.title || '').trim();
  if (!it.title) { sh.err = '제목을 입력해 주세요.'; render(); return; }
  if (!it.start) { sh.err = '날짜를 골라 주세요.'; render(); return; }
  if (it.type === 'event') { if (!it.end || it.end < it.start) it.end = it.start; } else delete it.end;
  try {
    D.saveItem(S.user.uid, it); // 오프라인에서도 바로 반영되도록 기다리지 않음
    closeSheet();
  } catch (e) { sh.err = '저장하지 못했어요. 다시 해 주세요.'; render(); }
}

function setStatus(v) {
  const it = S.sheet.draft;
  const today = todayStr();
  if (v !== 'progress' && (it.status || 'progress') === 'progress' && it.start < today) { it.origStart = it.start; it.start = today; }
  it.status = v;
  render();
}

async function ensureSettingsAndBackup() {
  const st = S.settings;
  if (st.backupVer !== APP_VERSION) {
    if (S.items.length) {
      try { await D.backupNow(S.user.uid, S.items, st, `${APP_VERSION} 업데이트 전 자동 백업`, APP_VERSION); } catch (e) { console.warn(e); return; }
    }
    S.settings = { ...st, backupVer: APP_VERSION };
    D.saveSettings(S.user.uid, S.settings);
  }
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

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
  nav: (el) => { S.view = el.dataset.v; closeSheet(); render(); },
  mPrev: () => { let [y, m] = S.month; m--; if (m < 0) { m = 11; y--; } S.month = [y, m]; render(); },
  mNext: () => { let [y, m] = S.month; m++; if (m > 11) { m = 0; y++; } S.month = [y, m]; render(); },
  wPrev: () => { S.sel = addDays(S.sel, -7); render(); },
  wNext: () => { S.sel = addDays(S.sel, 7); render(); },
  goToday: () => { S.sel = todayStr(); const t = new Date(); S.month = [t.getFullYear(), t.getMonth()]; render(); },
  day: (el) => {
    S.sel = el.dataset.d;
    if (wide()) render(); else openSheet({ kind: 'day', d: el.dataset.d });
  },
  open: (el) => {
    const it = S.items.find((x) => x.id === el.dataset.id);
    if (it) openSheet({ kind: 'edit', draft: { ...it }, isNew: false });
  },
  choose: () => newForm(S.view === 'month' && wide() ? S.sel : (S.view === 'week' ? S.sel : todayStr())),
  newOn: (el) => { S.sel = el.dataset.d; newForm(el.dataset.d); },
  addOn: (el) => { S.sel = el.dataset.d; newForm(el.dataset.d); },
  daySheet: (el) => { S.sel = el.dataset.d; openSheet({ kind: 'day', d: el.dataset.d }); },
  setType: (el) => { const d = S.sheet.draft; d.type = el.dataset.v; if (d.type === 'event') d.end = d.end && d.end >= d.start ? d.end : d.start; render(); },
  newType: (el) => { const d = S.sheet?.d || S.sel; S.sheet = { kind: 'edit', draft: newItem(el.dataset.v, d), isNew: true }; render(); setTimeout(() => document.getElementById('f_title')?.focus(), 30); },
  close: () => closeSheet(),
  status: (el) => setStatus(el.dataset.v),
  saveItem,
  delItem: () => {
    if (!S.delArm) { S.delArm = true; render(); return; }
    D.deleteItem(S.user.uid, S.sheet.draft.id); closeSheet();
  },
  acc: (el) => { S.acc[el.dataset.v] = !S.acc[el.dataset.v]; render(); },
  catEdit: (el) => { const c = catOf(el.dataset.id); if (c) openSheet({ kind: 'cat', draft: JSON.parse(JSON.stringify(c)), isNew: false }); },
  catNew: () => openSheet({ kind: 'cat', draft: { id: uid(), name: '', color: PALETTE[1], subs: [] }, isNew: true }),
  todoColor: () => openSheet({ kind: 'cat', todo: true, draft: { color: S.settings.todoColor, subs: [] } }),
  pick: (el) => { S.sheet.draft.color = el.dataset.v; render(); },
  subAdd: () => { S.sheet.draft.subs.push({ id: uid(), name: '', color: null }); render(); },
  subDel: (el) => { S.sheet.draft.subs.splice(+el.dataset.i, 1); render(); },
  catSave: () => {
    const sh = S.sheet, d = sh.draft;
    if (!/^#[0-9a-fA-F]{6}$/.test(d.color || '')) { sh.err = '색 코드는 #A9C7F2 같은 형식으로 넣어 주세요.'; render(); return; }
    const st = JSON.parse(JSON.stringify(S.settings));
    if (sh.todo) st.todoColor = d.color;
    else {
      d.name = (d.name || '').trim();
      if (!d.name) { sh.err = '이름을 입력해 주세요.'; render(); return; }
      d.subs = d.subs.map((s) => ({ ...s, name: (s.name || '').trim() })).filter((s) => s.name);
      const i = st.cats.findIndex((c) => c.id === d.id);
      if (i >= 0) st.cats[i] = d; else st.cats.push(d);
    }
    S.settings = st; D.saveSettings(S.user.uid, st); closeSheet();
  },
  catDel: () => {
    if (S.settings.cats.length <= 1) { S.sheet.err = '분류는 하나 이상 있어야 해요.'; render(); return; }
    if (!S.delArm) { S.delArm = true; render(); return; }
    const st = JSON.parse(JSON.stringify(S.settings));
    st.cats = st.cats.filter((c) => c.id !== S.sheet.draft.id);
    S.settings = st; D.saveSettings(S.user.uid, st); closeSheet();
  },
  exportJson: () => {
    const t = new Date();
    download(`planbook-backup-${ymd(t)}.json`, JSON.stringify({ app: 'planbook', ver: APP_VERSION, at: t.toISOString(), items: S.items, settings: S.settings }, null, 1));
  },
  importJson: () => document.getElementById('imp')?.click(),
  backups: async () => {
    openSheet({ kind: 'backups', list: null });
    try { const list = await D.listBackups(S.user.uid); if (S.sheet?.kind === 'backups') { S.sheet.list = list; render(); } }
    catch (e) { if (S.sheet) { S.sheet.list = []; render(); } }
  },
  restoreBk: async (el) => {
    const sh = S.sheet;
    if (sh.arm !== el.dataset.id) { sh.arm = el.dataset.id; render(); return; }
    const b = sh.list.find((x) => x.id === el.dataset.id);
    await restore(b);
  },
  logout: () => { D.logout(); },
};

async function restore(data) {
  try {
    await D.backupNow(S.user.uid, S.items, S.settings, '복원 직전 자동 백업', APP_VERSION);
    await D.restoreAll(S.user.uid, S.items, data);
    closeSheet(); toast('복원했어요');
  } catch (e) { console.error(e); toast('복원하지 못했어요'); }
}

$app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !$app.contains(el)) return;
  const f = ACT[el.dataset.act];
  if (f) { e.preventDefault(); f(el); }
});
$app.addEventListener('input', (e) => {
  const el = e.target;
  if (!S.sheet) return;
  if (el.dataset.f && S.sheet.kind === 'edit') {
    S.sheet.draft[el.dataset.f] = el.value;
    if (el.dataset.f === 'title') { const b = document.getElementById('bandT'); if (b) b.textContent = el.value || '새 항목'; }
  }
  if (S.sheet.kind === 'cat') {
    if (el.dataset.cf === 'name') { S.sheet.draft.name = el.value; const b = document.getElementById('bandT'); if (b) b.textContent = el.value || '새 분류'; }
    if (el.dataset.cf === 'hex' && /^#[0-9a-fA-F]{6}$/.test(el.value)) {
      S.sheet.draft.color = el.value;
      const band = document.getElementById('bandT')?.parentElement;
      if (band) { band.style.background = el.value; band.style.color = textOn(el.value); }
    }
    if (el.dataset.sf === 'name') S.sheet.draft.subs[+el.dataset.i].name = el.value;
  }
});
$app.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.id === 'imp' && el.files[0]) {
    try {
      const data = JSON.parse(await el.files[0].text());
      if (!Array.isArray(data.items)) throw new Error('형식');
      if (confirmRestore(data)) await restore(data);
    } catch (err) { toast('백업 파일을 읽지 못했어요'); }
    el.value = '';
    return;
  }
  if (!S.sheet) return;
  if (S.sheet.kind === 'edit' && el.dataset.f) {
    S.sheet.draft[el.dataset.f] = el.value;
    // 글자 칸은 다시 그리지 않음 (다시 그리면 바로 다음 버튼 누름이 사라짐)
    if (el.tagName !== 'SELECT' && el.type !== 'date') return;
    if (el.dataset.f === 'cat') S.sheet.draft.sub = '';
    if (el.dataset.f === 'start' && S.sheet.draft.type === 'event' && (S.sheet.draft.end || '') < el.value) S.sheet.draft.end = el.value;
    render();
  }
  if (S.sheet.kind === 'cat') {
    if (el.dataset.actChange === 'pickInput') { S.sheet.draft.color = el.value.toUpperCase(); render(); }
    if (el.dataset.sf === 'mode') { const s = S.sheet.draft.subs[+el.dataset.i]; s.color = el.value === 'own' ? (s.color || S.sheet.draft.color) : null; render(); }
    if (el.dataset.sf === 'color') { S.sheet.draft.subs[+el.dataset.i].color = el.value.toUpperCase(); render(); }
  }
});
// 파일 복원은 실수 방지를 위해 한 번 더 묻기 (브라우저 확인창 대신 토스트 두 번 누르기 방식)
let pendingFile = null;
function confirmRestore(data) {
  if (pendingFile && pendingFile === JSON.stringify(data).length) { pendingFile = null; return true; }
  pendingFile = JSON.stringify(data).length;
  toast('같은 파일을 한 번 더 고르면 복원해요');
  return false;
}

let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 120); });

// 자정이 지나면 이월 반영을 위해 다시 그리기
let lastDay = todayStr();
setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); render(); } }, 60000);

D.onUser((user) => {
  if (unwatch) { unwatch(); unwatch = null; }
  S.user = user || null; S.items = []; S.settings = null; S.loaded = { items: false, settings: false }; S.sheet = null;
  if (user) {
    let first = true;
    unwatch = D.watch(user.uid, (items) => {
      S.items = items; S.loaded.items = true;
      if (first && S.settings) { first = false; ensureSettingsAndBackup(); }
      render();
    }, (st) => {
      if (!st) { const d = DEFAULT_SETTINGS(); S.settings = d; D.saveSettings(user.uid, d); }
      else S.settings = { todoColor: '#CFCFCF', cats: [], ...st };
      S.loaded.settings = true;
      if (first && S.loaded.items) { first = false; ensureSettingsAndBackup(); }
      render();
    }, (err) => { console.error(err); toast('데이터를 불러오지 못했어요'); });
  }
  render();
});
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
