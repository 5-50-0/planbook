// 가계부: 내역 · 예산 · 자산 · 통계
// 데이터: gbTx(내역), gbFixed(고정 지출 · 이체), gbConf(설정 한 장, id = main)
export const GB_COLS = ['gbTx', 'gbFixed', 'gbConf'];

export function setupGb(X) {
  const { S, render, openSheet, closeSheet, toast, save, U, D, esc, uid, band, seg, errLine, armDel, wide, IC,
    HOLIDAYS, parse, ymd, addDays, todayStr, WD, EN_MONTH, monthWeeks, textOn, PALETTE, writeXlsx, stampName,
    backupCurrent, commas, wonOf, fmtMD, dayClass, clone, small, downloadBlob, APP_VERSION } = X;

  const won = (n) => Number(n || 0).toLocaleString('ko-KR');
  const sgn = (n) => (n > 0 ? '+' : '') + won(n);
  const md = (d) => `${+d.slice(5, 7)}.${+d.slice(8, 10)}`;
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  const mkDate = (y, m, d) => ymd(new Date(y, m, Math.min(d, dim(y, m))));
  const GI = {
    book: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
    bud: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5V12l6 6"/>',
    asset: '<rect x="3.5" y="6" width="17" height="13" rx="2.5"/><path d="M3.5 10h17M15 14.5h2.5"/>',
    stat: '<path d="M4 20h16"/><rect x="5" y="12" width="3" height="6" rx="1"/><rect x="10.5" y="8" width="3" height="10" rx="1"/><rect x="16" y="5" width="3" height="13" rx="1"/>',
    set: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  };
  const gIc = (k) => `<svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GI[k]}</svg>`;
  const CHEV = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';

  // ---------- 설정 ----------
  const DEFAULT_CONF = () => ({
    id: 'main', payday: 25, budget: {},
    accounts: [],
    exp: [
      ['식비', '#F3CD95', ['평일 점심', '주말 외식', '장보기', '배달', '카페']],
      ['생활', '#B8D8B0', ['생활용품', '통신비', '관리비']],
      ['교통', '#A9C7F2', ['대중교통', '택시', '주유']],
      ['주거', '#C9C2B4', ['월세']],
      ['쇼핑', '#C9B6E4', ['의류', '전자기기']],
      ['모임비', '#E7B7C8', ['회식 · 모임', '경조사']],
      ['건강', '#9FD3CB', ['병원', '운동']],
      ['여가', '#F2B3A0', ['문화', '구독', '여행']],
      ['기타', '#CFCFCF', []],
    ].map(([name, color, subs]) => ({ id: uid(), name, color, subs: subs.map((n) => ({ id: uid(), name: n })) })),
    inc: [['월급', '#A9C7F2', []], ['상여', '#9FD3CB', []], ['기타 수입', '#CFCFCF', []]]
      .map(([name, color, subs]) => ({ id: uid(), name, color, subs })),
  });
  const conf = () => {
    if (!S.gbConfMem) S.gbConfMem = DEFAULT_CONF();
    const c = S.gbConf.find((x) => x.id === 'main');
    return c ? { payday: 25, budget: {}, accounts: [], exp: [], inc: [], ...c } : S.gbConfMem;
  };
  const saveConf = (c) => save('gbConf', { ...c, id: 'main' });
  const accs = (all) => conf().accounts.filter((a) => all || !a.closed);
  const accOf = (id) => conf().accounts.find((a) => a.id === id);
  const catList = (kind) => conf()[kind] || [];
  const catOf = (kind, id) => catList(kind).find((c) => c.id === id);
  const subOf = (kind, cid, sid) => (catOf(kind, cid)?.subs || []).find((s) => s.id === sid);
  const catName = (kind, cid, sid) => { const c = catOf(kind, cid); if (!c) return '분류 없음'; const s = sid && (c.subs || []).find((x) => x.id === sid); return s ? `${c.name} › ${s.name}` : c.name; };
  // 이체: 수수료는 금액에 더하고, '지출로 잡기'면 지출로 셈
  const isE = (e) => e.type === 'exp' || (e.type === 'tr' && !!e.asExp);
  const amtE = (e) => (e.type === 'tr' ? (e.amount || 0) + (+e.fee || 0) : e.amount || 0);
  const colorOfE = (e) => (e.type === 'tr' ? (e.asExp ? catOf('exp', e.cat)?.color || '#D9D9D9' : '#D9D9D9') : catOf(e.type, e.cat)?.color || '#CFCFCF');
  const accName = (id) => accOf(id)?.name || '통장 없음';
  const ACC_COL = { bank: '#111111', saving: '#8A8A8A', card: '#C0392B' };
  const accColor = (a) => a.color || ACC_COL[a.type] || '#111111';

  // ---------- 월급일 · 예산 기간 ----------
  const isOff = (d) => { const w = parse(d).getDay(); return w === 0 || w === 6 || !!HOLIDAYS[d]; };
  function payDate(y, m) {
    let d = mkDate(y, m, conf().payday || 25);
    while (isOff(d)) d = addDays(d, -1);
    return d;
  }
  // 이름이 y년 m월인 기간: 전월 월급일 ~ 이번 달 월급일 전날
  function periodOf(y, m) {
    const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
    return { y, m, start: payDate(py, pm), end: addDays(payDate(y, m), -1) };
  }
  // 오늘이 들어 있는 기간의 이름
  function curLabel() {
    const t = todayStr(), tt = parse(t);
    let y = tt.getFullYear(), m = tt.getMonth();
    if (t >= payDate(y, m)) { m++; if (m > 11) { m = 0; y++; } }
    return [y, m];
  }
  // off = 0이면 오늘이 들어 있는 기간. 기간 이름은 끝나는 달
  function period(off = 0) {
    const t = todayStr(); const tt = parse(t);
    let y = tt.getFullYear(), m = tt.getMonth();
    if (t >= payDate(y, m)) { m++; if (m > 11) { m = 0; y++; } }
    m += off; while (m > 11) { m -= 12; y++; } while (m < 0) { m += 12; y--; }
    const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
    const start = payDate(py, pm), end = addDays(payDate(y, m), -1);
    return { y, m, start, end };
  }

  // ---------- 내역 펼치기 (할부 · 고정) ----------
  function entries(from, to) {
    const out = [];
    S.gbTx.forEach((t) => {
      const n = t.type === 'exp' && accOf(t.acc)?.type === 'card' ? Math.max(1, +t.inst || 1) : 1;
      if (n === 1) { if (t.date >= from && t.date <= to) out.push({ ...t, src: 'tx', key: t.id }); return; }
      const d0 = parse(t.date), per = Math.floor(t.amount / n);
      for (let k = 0; k < n; k++) {
        const d = mkDate(d0.getFullYear(), d0.getMonth() + k, d0.getDate());
        if (d < from || d > to) continue;
        out.push({ ...t, src: 'tx', key: `${t.id}~${k}`, date: d, amount: k === n - 1 ? t.amount - per * (n - 1) : per, total: t.amount, k: k + 1, n });
      }
    });
    S.gbFixed.forEach((f) => {
      if (!f.start) return;
      const s = parse(f.start); const last = f.end && f.end < to ? f.end : to;
      for (let i = 0; i < 1200; i++) {
        const d = mkDate(s.getFullYear(), s.getMonth() + i, +f.day || s.getDate());
        if (d > last) break;
        if (d < f.start || d < from) continue;
        out.push({ ...f, src: 'fx', key: `${f.id}~${d}`, date: d, fixed: true });
      }
    });
    return out;
  }
  const sortE = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0));
  const sum = (list, f) => list.reduce((s, e) => s + (f ? f(e) : e.amount || 0), 0);
  const incOf = (l) => sum(l.filter((e) => e.type === 'inc'));
  const expOf = (l) => sum(l.filter(isE), amtE);

  // ---------- 잔액 ----------
  function balance(a, upto = todayStr()) {
    if (a.type === 'card') return -cardRemain(a.id);
    const from = a.initDate || '0000-01-01';
    const l = entries(from, upto);
    let b = (a.init || 0) + (a.adj || 0);
    l.forEach((e) => {
      if (e.type === 'inc' && e.acc === a.id) b += e.amount;
      if (e.type === 'exp' && e.acc === a.id) b -= e.amount;
      if (e.type === 'tr') { if (e.acc === a.id) b -= amtE(e); if (e.to === a.id) b += e.amount; }
    });
    return b;
  }
  function installs(cardId) {
    const t = todayStr();
    return S.gbTx.filter((x) => x.type === 'exp' && x.acc === cardId && (+x.inst || 1) > 1).map((x) => {
      const n = +x.inst, per = Math.floor(x.amount / n), d0 = parse(x.date);
      let paid = 0, k = 0;
      for (let i = 0; i < n; i++) { if (mkDate(d0.getFullYear(), d0.getMonth() + i, d0.getDate()) <= t) { k = i + 1; paid += i === n - 1 ? x.amount - per * (n - 1) : per; } }
      return { x, n, k, paid, remain: x.amount - paid };
    }).filter((r) => r.remain > 0).sort((a, b) => (a.x.date < b.x.date ? 1 : -1));
  }
  const cardRemain = (id) => sum(installs(id), (r) => r.remain);

  // ---------- 공통 조각 ----------
  const sumBar = (inc, exp) => `<div class="gsum"><div><small>수입</small><b class="gin">${won(inc)}</b></div><div><small>지출</small><b class="gout">${won(exp)}</b></div><div><small>합계</small><b>${sgn(inc - exp)}</b></div></div>`;
  const tabs = (opts, cur, act) => `<div class="gtabs">${opts.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-v="${k}">${l}</button>`).join('')}</div>`;
  const tools = (prev, next, extra = '') => {
    const W = wide();
    const nav = prev ? `<button class="ico ${W ? 'bd' : ''}" aria-label="이전" data-act="${prev}">${IC.l}</button><button class="ico ${W ? 'bd' : ''}" aria-label="다음" data-act="${next}">${IC.r}</button>` : '';
    const ph = W ? '' : `<button class="ico ${S.syncing ? 'spin' : ''}" aria-label="동기화" data-act="sync">${IC.sync}</button><button class="ico" aria-label="머니북 설정" data-act="gView" data-v="set">${small(gIc('set').replace('class="ni"', ''), 20)}</button>`;
    return `<div class="tools">${extra}${nav}${ph}</div>`;
  };
  const headMonth = (y, m, t) => `<div class="head"><div class="big"><h1>${m + 1}</h1><div class="sub"><p class="y">${y}</p><p class="m">${EN_MONTH[m]}</p></div></div>${t}</div>`;
  const headWord = (w, sub, t) => `<div class="head"><div class="big"><h1 class="word">${w}</h1>${sub || ''}</div>${t}</div>`;
  const txRow = (e) => {
    const sub = e.type === 'tr' ? `${e.asExp ? esc(catName('exp', e.cat, e.sub)) + ' · ' : ''}${esc(accName(e.acc))} → ${esc(accName(e.to))}` : `${esc(catName(e.type, e.cat, e.sub))} · ${esc(accName(e.acc))}`;
    const extra = [e.n ? `${e.n}개월 할부 ${e.k}회 · 전체 ${won(e.total)}` : '', e.type === 'tr' && +e.fee ? `수수료 ${won(e.fee)} 포함` : '', e.fixed ? '고정' : ''].filter(Boolean).join(' · ');
    const amt = e.type === 'inc' ? `<span class="gin">+${won(e.amount)}</span>` : isE(e) ? `-${won(amtE(e))}` : won(amtE(e));
    const act = e.src === 'fx' ? `data-act="gFxOpen" data-id="${e.id}"` : `data-act="gTxOpen" data-id="${e.id}"`;
    return `<button class="gtx ${e.date > todayStr() ? 'fut' : ''}" ${act}><span class="sw" style="background:${colorOfE(e)}"></span><span class="t">${esc(e.title || (e.type === 'tr' ? '이체' : catName(e.type, e.cat, e.sub)))}<small>${sub}</small></span><span class="a ${e.type === 'tr' && !e.asExp ? 'tr' : ''}">${amt}${extra ? `<small>${extra}</small>` : ''}</span></button>`;
  };
  const dayTotal = (l) => { const v = incOf(l) - expOf(l); return v ? `<span class="${v < 0 ? 'gout' : 'gin'}">${sgn(v)}</span>` : ''; };
  const dayListG = (d) => { const l = entries(d, d).sort(sortE); return l.length ? l.map(txRow).join('') : '<p class="empty">내역 없음</p>'; };

  // ---------- 가계부 ----------
  function bookPage() {
    const [y, m] = S.gbMonth;
    const tab = S.gbTab;
    if (tab === 'mon') {
      const rows = [];
      let ti = 0, te = 0;
      for (let i = 0; i < 12; i++) {
        const PR = periodOf(y, i); const l = entries(PR.start, PR.end);
        const a = incOf(l), b = expOf(l); ti += a; te += b;
        rows.push(`<button class="gmrow ${curLabel()[0] === y && curLabel()[1] === i ? 'cur' : ''}" data-act="gGoMonth" data-v="${i}"><span>${i + 1}월</span><span class="gin">${a ? won(a) : '–'}</span><span class="gout">${b ? won(b) : '–'}</span><span>${a || b ? sgn(a - b) : '–'}</span></button>`);
      }
      return headWord(String(y), '', tools('gYPrev', 'gYNext')) + tabs([['day', '일일'], ['cal', '달력'], ['mon', '월별']], tab, 'gTab') + sumBar(ti, te)
        + `<div class="gpad"><div class="gmrow h"><span>월</span><span>수입</span><span>지출</span><span>합계</span></div>${rows.join('')}</div>`;
    }
    const PR0 = periodOf(y, m), from = PR0.start, to = PR0.end;
    const l = entries(from, to);
    const PP = periodOf(y, m);
    let h = (tab === 'cal' || tab === 'day' ? `<div class="head"><div class="big"><h1>${m + 1}</h1><div class="sub"><p class="y">${y}</p><p class="m">${md(PP.start)} – ${md(PP.end)}</p></div></div>${tools('gMPrev', 'gMNext')}</div>` : headMonth(y, m, tools('gMPrev', 'gMNext'))) + tabs([['day', '일일'], ['cal', '달력'], ['mon', '월별']], tab, 'gTab') + (tab === 'cal' ? '<div style="height:8px"></div>' : sumBar(incOf(l), expOf(l)));
    if (tab === 'day') {
      const by = new Map();
      l.filter((e) => e.date <= todayStr() || e.src === 'tx').sort(sortE).forEach((e) => { if (!by.has(e.date)) by.set(e.date, []); by.get(e.date).push(e); });
      h += '<div class="gpad gbot">';
      if (!by.size) h += '<p class="empty" style="padding:16px 2px">내역 없음</p>';
      by.forEach((list, d) => { h += `<div class="gdh"><b class="${dayClass(d)}">${+d.slice(5, 7) !== m + 1 ? `${+d.slice(5, 7)}월 ` : ''}${+d.slice(8)}일 ${WD[parse(d).getDay()]}요일</b>${dayTotal(list)}</div>${list.map(txRow).join('')}`; });
      return h + '</div>';
    }
    // 달력: 전월 월급일 ~ 이번 달 월급일 전날
    const P = periodOf(y, m), today = todayStr(), W = wide();
    const weeks = [];
    for (let ws = addDays(P.start, -parse(P.start).getDay()); ws <= P.end; ws = addDays(ws, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(ws, i)));
    const pays = new Set([P.start, payDate(y, m)]);
    const all = entries(weeks[0][0], weeks[weeks.length - 1][6]);
    const byD = new Map(); all.forEach((e) => { if (!byD.has(e.date)) byD.set(e.date, []); byD.get(e.date).push(e); });
    h += `<div class="gcal"><div class="gwd">${WD.map((w, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</span>`).join('')}</div>`;
    weeks.forEach((days) => {
      h += '<div class="gwk">';
      days.forEach((d) => {
        const dl = byD.get(d) || [];
        const a = incOf(dl), b = expOf(dl);
        const other = d < P.start || d > P.end;
        const cls = ['gcell', dayClass(d), other ? 'other' : '', d === today ? 'today' : '', W && d === S.gbSel ? 'sel' : ''].join(' ');
        const big = (v) => (v >= 1000000 ? ' sm' : '');
        const dn = parse(d).getDate() === 1 ? `${parse(d).getMonth() + 1}.1` : parse(d).getDate();
        h += `<button class="${cls}" data-act="gAddOn" data-d="${d}"><span class="n"><span data-act="gSelDay" data-d="${d}" role="button">${dn}</span>${pays.has(d) ? '<i>월급</i>' : ''}</span>${!other && a ? `<span class="v gin${big(a)}">${won(a)}</span>` : ''}${!other && b ? `<span class="v gout${big(b)}">${won(b)}</span>` : ''}</button>`;
      });
      h += '</div>';
    });
    return h + '</div>';
  }

  // ---------- 예산 금액 (기본 예산 + 달마다 따로) ----------
  // budgetV[key] = { base: [['YYYY-MM', 금액], ...], over: { 'YYYY-MM': 금액 } }
  // key: 소분류 id 또는 'c:' + 대분류 id. 예전 budget(한 벌)은 처음부터 쓰던 기본 예산으로 읽음
  const lab = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
  function bv(c = conf()) {
    if (c.budgetV) return c.budgetV;
    const out = {};
    const catIds = new Set(catList('exp').map((x) => x.id));
    Object.entries(c.budget || {}).forEach(([k, v]) => { if (v > 0) out[catIds.has(k) ? 'c:' + k : k] = { base: [['0000-00', v]], over: {} }; });
    return out;
  }
  function baseAt(e, L) { let v = 0; (e?.base || []).slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)).forEach(([f, a]) => { if (f <= L) v = a; }); return v; }
  function budAt(key, y, m, B = bv()) { const e = B[key]; if (!e) return 0; const L = lab(y, m); return e.over && L in e.over ? e.over[L] : baseAt(e, L); }
  const isOver = (key, y, m, B = bv()) => !!(B[key]?.over && lab(y, m) in B[key].over);
  function setBase(B, key, y, m, v) {
    const L = lab(y, m), e = B[key] || (B[key] = { base: [], over: {} });
    e.base = (e.base || []).filter(([f]) => f !== L);
    if (baseAt(e, L) !== v) e.base.push([L, v]);
  }
  function setOver(B, key, y, m, v) { const e = B[key] || (B[key] = { base: [], over: {} }); e.over = e.over || {}; if (v === null) delete e.over[lab(y, m)]; else e.over[lab(y, m)] = v; }
  // 대분류 예산이 소분류 합보다 작으면 안 됨
  function budCheck(B, y, m) {
    for (const c of catList('exp')) {
      const cb = budAt('c:' + c.id, y, m, B);
      const sb = sum(c.subs || [], (x) => budAt(x.id, y, m, B));
      if (cb && sb > cb) return `${c.name}: 소분류 예산 합(${won(sb)})이 대분류 예산(${won(cb)})보다 커요.`;
    }
    return '';
  }

  // ---------- 예산 ----------
  function budPage() {
    const p = period(S.gbBudOff || 0);
    const t = todayStr();
    const sub = `<div class="sub"><p class="y">${md(p.start)} – ${md(p.end)}</p><p class="m">${p.m + 1}월</p></div>`;
    let h = headWord('버짓북', sub, tools('gBPrev', 'gBNext')) + tabs([['bud', '예산'], ['fix', '고정 지출 · 이체']], S.gbBudTab, 'gBudTab');
    if (S.gbBudTab === 'fix') return h + fixList();
    const upto = t < p.end ? t : p.end;
    const l = p.start <= t ? entries(p.start, upto).filter(isE) : [];
    const left = t > p.end ? 0 : t < p.start ? Math.round((parse(p.end) - parse(p.start)) / 864e5) + 1 : Math.round((parse(p.end) - parse(t)) / 864e5) + 1;
    const B = bv(), Y = p.y, M = p.m;
    const fixedKeys = new Set(S.gbFixed.filter((f) => isE(f) && (!f.end || f.end >= p.start)).map((f) => f.sub || 'c:' + f.cat));
    const usedSub = new Map(), usedCat = new Map();
    l.forEach((e) => { const v = amtE(e); if (e.sub) usedSub.set(e.sub, (usedSub.get(e.sub) || 0) + v); usedCat.set(e.cat, (usedCat.get(e.cat) || 0) + v); });
    const rowH = (key, n, b, u, fixed) => {
      const pct = b ? Math.round((u / b) * 100) : 0;
      const right = !b ? '예산 없음' : fixed ? '고정' : u > b ? `초과 ${won(u - b)}` : left ? `하루 ${won(Math.floor((b - u) / left / 100) * 100)}` : `남음 ${won(b - u)}`;
      return `<button class="gbg" ${key ? `data-act="gBudKey" data-k="${key}"` : ''}><div class="r1"><span>${esc(n)}</span><small>${won(u)} / ${won(b)}</small></div><div class="gbar"><i class="${u > b ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></i></div><div class="r2"><span>${b ? pct + '%' : ''}</span><span class="${u > b ? 'gout' : ''}">${right}</span></div></button>`;
    };
    let total = 0, used = 0;
    let body = '';
    catList('exp').forEach((c) => {
      const subs = c.subs || [];
      const cb = budAt('c:' + c.id, Y, M, B);
      const sbs = subs.map((x) => ({ x, b: budAt(x.id, Y, M, B), u: usedSub.get(x.id) || 0 }));
      const sbSum = sum(sbs, (r) => r.b);
      const cu = usedCat.get(c.id) || 0;
      const cBud = cb || sbSum;
      if (!cBud && !cu) return;
      total += cBud; used += cu;
      body += `<button class="ggh gghb" data-act="gBudKey" data-k="c:${c.id}"><b>${esc(c.name)}</b><span>${won(cu)} / ${won(cBud)}${cb ? '' : ''}</span></button>`;
      if (!subs.length) { body += rowH('c:' + c.id, '전체', cb, cu, fixedKeys.has('c:' + c.id)); return; }
      sbs.filter((r) => r.b || r.u).forEach((r) => { body += rowH(r.x.id, r.x.name, r.b, r.u, fixedKeys.has(r.x.id)); });
      // 그 외: 대분류 예산 중 소분류에 나누지 않은 몫, 예산 없는 소분류 · 소분류 없이 쓴 돈
      const restU = cu - sum(sbs.filter((r) => r.b), (r) => r.u);
      if (cb > sbSum || (cb && restU)) body += rowH('', '그 외', Math.max(0, cb - sbSum), restU, false);
    });
    const pct = total ? Math.min(100, Math.round((used / total) * 100)) : 0;
    h += `<div class="gpad gbot"><div class="gbx"><div class="l"><span>남은 예산</span><span>${left ? `남은 ${left}일` : ''}</span></div><div class="big2">${won(total - used)}</div><div class="gbar"><i class="${used > total ? 'over' : ''}" style="width:${pct}%"></i></div><div class="r"><span>${won(used)} 씀</span><span class="mut">예산 ${won(total)}</span></div></div>`;
    h += body || '<p class="empty" style="padding:14px 2px">예산을 정하면 여기에 분류별로 보여요</p>';
    return h + `<button class="btn sm" style="margin-top:14px" data-act="gBudEdit">예산 금액 정하기</button></div>`;
  }
  function fixList() {
    const t = todayStr();
    const act = S.gbFixed.filter((f) => !f.end || f.end >= t), ended = S.gbFixed.filter((f) => f.end && f.end < t);
    const row = (f) => {
      const s = f.type === 'tr' ? `매월 ${f.day}일 · ${f.asExp ? esc(catName('exp', f.cat, f.sub)) + ' · ' : ''}${esc(accName(f.acc))} → ${esc(accName(f.to))}` : `매월 ${f.day}일 · ${esc(catName('exp', f.cat, f.sub))} · ${esc(accName(f.acc))}`;
      return `<button class="gtx" data-act="gFxOpen" data-id="${f.id}"><span class="sw" style="background:${f.type === 'tr' && !f.asExp ? '#8A8A8A' : colorOfE(f)}"></span><span class="t">${esc(f.title || '')}<small>${s}</small></span><span class="a">${won(amtE(f))}<small>${f.start.slice(0, 7).replace('-', '.')} – ${f.end ? f.end.slice(0, 7).replace('-', '.') : ''}</small></span></button>`;
    };
    const ex = act.filter((f) => f.type === 'exp'), tr = act.filter((f) => f.type === 'tr');
    let h = '<div class="gpad gbot">';
    h += `<div class="ggh"><b>고정 지출</b><span>매달 ${won(sum(ex, amtE))}</span></div>${ex.map(row).join('') || '<p class="empty" style="padding:10px 2px">없음</p>'}`;
    h += `<div class="ggh"><b>고정 이체</b><span>매달 ${won(sum(tr, amtE))}</span></div>${tr.map(row).join('') || '<p class="empty" style="padding:10px 2px">없음</p>'}`;
    if (ended.length) h += `<div class="ggh"><b>끝난 항목</b><span></span></div>${ended.map(row).join('')}`;
    return h + `<button class="btn sm" style="margin-top:14px" data-act="gFxNew">${small(IC.plus, 16)} 고정 항목 추가</button></div>`;
  }

  // ---------- 자산 ----------
  function assetPage() {
    const A = accs();
    const bank = A.filter((a) => a.type === 'bank'), sav = A.filter((a) => a.type === 'saving'), card = A.filter((a) => a.type === 'card');
    const bs = sum(bank, balance), ss = sum(sav, balance), cs = sum(card, balance);
    const net = bs + ss + cs;
    const tot = Math.abs(bs) + Math.abs(ss) + Math.abs(cs) || 1;
    let h = headWord('에셋북', '', tools('', '', `<button class="ico ${wide() ? 'bd' : ''}" aria-label="통장 추가" data-act="gAccNew">${IC.plus}</button>`));
    h += `<div class="gpad gbot"><div class="gnet"><small>순자산</small><b>${won(net)}</b></div>`;
    h += `<div class="gstk"><i style="flex:${Math.abs(bs) / tot};background:#111"></i><i style="flex:${Math.abs(ss) / tot};background:#8A8A8A"></i><i style="flex:${Math.abs(cs) / tot};background:#C0392B"></i></div>`;
    h += '<div class="glg"><span><i style="background:#111"></i>통장</span><span><i style="background:#8A8A8A"></i>저축</span><span><i style="background:#C0392B"></i>신용카드</span></div>';
    const arow = (a, sub = '') => `<button class="gac" data-act="gAccOpen" data-id="${a.id}"><span class="sw" style="background:${accColor(a)}"></span><span class="t">${esc(a.name)}${sub ? `<small>${sub}</small>` : ''}</span><span class="v">${a.type === 'card' ? '<small class="mut">낸 금액 / 남은 금액</small>' : won(balance(a))}</span></button>`;
    const fxIn = (a) => { const f = S.gbFixed.find((x) => x.type === 'tr' && x.to === a.id && (!x.end || x.end >= todayStr())); return f ? `매월 ${f.day}일 · ${won(f.amount)}` : ''; };
    h += `<div class="gsec"><span>통장</span><small>${won(bs)}</small></div>${bank.map((a) => arow(a)).join('') || '<p class="empty" style="padding:10px 2px">없음</p>'}`;
    h += `<div class="gsec"><span>저축</span><small>${won(ss)}</small></div>${sav.map((a) => arow(a, fxIn(a))).join('') || '<p class="empty" style="padding:10px 2px">없음</p>'}`;
    h += `<div class="gsec"><span>신용카드</span><small class="${cs ? 'gout' : ''}">${won(cs)}</small></div>`;
    card.forEach((a) => {
      h += arow(a);
      h += installs(a.id).map((r) => `<button class="gins" data-act="gTxOpen" data-id="${r.x.id}"><span>${esc(r.x.title || '할부')} · ${r.n}개월 중 ${r.k}회</span><span>${won(r.paid)} / ${won(r.remain)}</span></button>`).join('');
    });
    if (!card.length) h += '<p class="empty" style="padding:10px 2px">없음</p>';
    return h + '</div>';
  }

  // ---------- 통계 ----------
  function monthAgg(y, i) {
    const PR = periodOf(y, i); const l = entries(PR.start, PR.end);
    const t = todayStr();
    return l.filter((e) => e.date <= t || e.src === 'tx');
  }
  function savIn(l, accId) { return sum(l.filter((e) => e.type === 'tr'), (e) => (e.to === accId ? e.amount : e.acc === accId ? -e.amount : 0)); }
  function yearRows(y) {
    const months = Array.from({ length: 12 }, (_, i) => monthAgg(y, i));
    const rows = [];
    rows.push({ key: '_net', g: '', name: '수입 − 지출', vals: months.map((l) => incOf(l) - expOf(l)), cls: 'nt' });
    rows.push({ g: '수입' });
    catList('inc').forEach((c) => rows.push({ key: 'inc:' + c.id, name: c.name, vals: months.map((l) => sum(l.filter((e) => e.type === 'inc' && e.cat === c.id))) }));
    const sav = accs(true).filter((a) => a.type === 'saving');
    if (sav.length) {
      rows.push({ g: '저축' });
      sav.forEach((a) => rows.push({ key: 'sav:' + a.id, name: a.name, vals: months.map((l) => savIn(l, a.id)) }));
    }
    rows.push({ g: '지출' });
    catList('exp').forEach((c) => {
      rows.push({ key: 'exp:' + c.id, name: c.name, vals: months.map((l) => sum(l.filter((e) => isE(e) && e.cat === c.id), amtE)), cat: c.id, hasSub: (c.subs || []).length > 0 });
      (c.subs || []).forEach((s) => rows.push({ key: 'sub:' + s.id, parent: c.id, name: s.name, vals: months.map((l) => sum(l.filter((e) => isE(e) && e.sub === s.id), amtE)) }));
    });
    return rows;
  }
  function statPage() {
    const y = S.gbYear;
    let h;
    if (S.gbStatTab === 'mon') {
      const [yy, m] = S.gbMonth;
      const l = monthAgg(yy, m);
      const PQ = periodOf(yy, m);
      h = `<div class="head"><div class="big"><h1>${m + 1}</h1><div class="sub"><p class="y">${yy}</p><p class="m">${md(PQ.start)} – ${md(PQ.end)}</p></div></div>${tools('gMPrev', 'gMNext')}</div>` + tabs([['mon', '월별'], ['year', '연간']], 'mon', 'gStatTab') + sumBar(incOf(l), expOf(l));
      const ex = l.filter(isE), tot = sum(ex, amtE) || 1;
      const prev = monthAgg(m === 0 ? yy - 1 : yy, m === 0 ? 11 : m - 1).filter(isE);
      const rows = catList('exp').map((c) => ({ c, v: sum(ex.filter((e) => e.cat === c.id), amtE), pv: sum(prev.filter((e) => e.cat === c.id), amtE) })).filter((r) => r.v || r.pv).sort((a, b) => b.v - a.v);
      const max = Math.max(1, ...rows.map((r) => r.v));
      h += `<div class="gpad gbot"><div class="ggh"><b>분류별 지출</b><span>전월 대비</span></div>`;
      h += rows.map((r) => { const d = r.pv ? Math.round(((r.v - r.pv) / r.pv) * 100) : null; return `<div class="gcr"><span>${esc(r.c.name)}</span><span class="b"><i style="width:${(r.v / max) * 100}%;background:${r.c.color}"></i></span><span class="v">${won(r.v)}</span><span class="c ${d > 0 ? 'gout' : d < 0 ? 'gin' : ''}">${d === null ? '' : (d > 0 ? '+' : '') + d + '%'}</span></div>`; }).join('') || '<p class="empty" style="padding:10px 2px">없음</p>';
      const sv = accs(true).filter((a) => a.type === 'saving').map((a) => [a, savIn(l, a.id)]).filter(([, v]) => v);
      if (sv.length) h += `<div class="ggh"><b>저축</b><span>${won(sum(sv, ([, v]) => v))}</span></div>${sv.map(([a, v]) => `<div class="gcr two"><span>${esc(a.name)}</span><span></span><span class="v">${won(v)}</span></div>`).join('')}`;
      return h + `<p class="mut" style="font-size:12px;margin-top:8px">${tot ? '' : ''}</p></div>`;
    }
    const xl = wide() ? `<button class="btn sm" style="margin-right:8px" data-act="gXlsx">엑셀로 내보내기</button>` : '';
    h = headWord('리포트', `<div class="sub"><p class="y">&nbsp;</p><p class="m">${y}</p></div>`, tools('gYPrev', 'gYNext', xl)) + tabs([['mon', '월별'], ['year', '연간']], 'year', 'gStatTab');
    const rows = yearRows(y);
    const cm = curLabel()[0] === y ? curLabel()[1] : -1;
    if (wide()) {
      let t = `<div class="gyt"><table class="yt"><thead><tr><th>${y}</th>${Array.from({ length: 12 }, (_, i) => `<th class="${i === cm ? 'cur' : ''}">${i + 1}월</th>`).join('')}<th class="tot">합계</th></tr></thead><tbody>`;
      rows.forEach((r) => {
        if (r.g !== undefined && !r.key) { t += `<tr class="g"><td colspan="14">${r.g}</td></tr>`; return; }
        if (r.parent && !S.gbExpand.has(r.parent)) return;
        const tot = sum(r.vals, (v) => v);
        const ex = r.hasSub ? `<span class="ex">${S.gbExpand.has(r.cat) ? '▾' : '▸'}</span>` : r.parent ? '' : '';
        t += `<tr class="${r.cls || (r.parent ? 's' : 'c')}" ${r.hasSub ? `data-act="gExpand" data-v="${r.cat}"` : ''}><td>${ex}${esc(r.name)}</td>${r.vals.map((v, i) => `<td class="${i === cm ? 'cur' : ''}">${v ? (r.key === '_net' ? sgn(v) : won(v)) : '–'}</td>`).join('')}<td class="tot">${!tot ? '–' : r.key === '_net' ? sgn(tot) : won(tot)}</td></tr>`;
      });
      return h + t + '</tbody></table></div>';
    }
    const pick = rows.find((r) => r.key === S.gbPick) || rows[0];
    const gname = (() => { let g = ''; for (const r of rows) { if (r.g !== undefined && !r.key) g = r.g; if (r === pick) return g; } return ''; })();
    const max = Math.max(1, ...pick.vals.map((v) => Math.abs(v)));
    const tot = sum(pick.vals, (v) => v), cnt = pick.vals.filter((v, i) => v || i <= cm).length || 1;
    h += `<div class="gpad gbot"><button class="gpick" data-act="gPick"><span>${esc(pick.name)}</span><small>${gname}</small>${CHEV}</button>`;
    h += `<div class="gyr h"><span>월</span><span></span><span>금액</span></div>`;
    h += pick.vals.map((v, i) => `<div class="gyr ${i === cm ? 'cur' : ''}"><span>${i + 1}월</span><span class="b"><i style="width:${(Math.abs(v) / max) * 100}%"></i></span><span>${v ? (pick.key === '_net' ? sgn(v) : won(v)) : '–'}</span></div>`).join('');
    h += `<div class="gyr tot"><span>합계</span><span></span><span>${pick.key === '_net' ? sgn(tot) : won(tot)}</span></div><div class="gyr"><span class="mut">월평균</span><span></span><span class="mut">${won(Math.round(tot / cnt))}</span></div>`;
    return h + '</div>';
  }

  // ---------- 가계부 설정 ----------
  function setPage() {
    const c = conf(), A = S.gbAcc;
    let h = headWord('머니북 설정', '', wide() ? '' : `<div class="tools"><button class="ico" aria-label="닫기" data-act="gView" data-v="book">${IC.x}</button></div>`) + '<div class="setpage">';
    const acc = (k, l) => `<button class="acc" data-act="gAcc" data-v="${k}"><span>${l}</span><span>${A[k] ? '−' : '+'}</span></button>`;
    h += acc('pay', '월급일');
    if (A.pay) {
      const p = period(0);
      h += `<div class="setbox"><label class="lb" for="g_payday">기준일 (주말 · 공휴일이면 바로 전 평일)</label><select id="g_payday" data-g="payday">${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}" ${+c.payday === i + 1 ? 'selected' : ''}>매월 ${i + 1}일</option>`).join('')}</select><p class="mut" style="font-size:13px;margin:10px 0 0">이번 예산 기간 ${md(p.start)} – ${md(p.end)}</p></div>`;
    }
    h += acc('acc', '통장 · 카드');
    if (A.acc) {
      const T = { bank: '통장', saving: '저축', card: '신용카드' };
      ['bank', 'saving', 'card'].forEach((t) => {
        const l = conf().accounts.filter((a) => a.type === t);
        if (!l.length) return;
        h += `<div class="sorthd"><span>${T[t]}</span></div>`;
        h += l.map((a) => `<button class="row" data-act="gAccOpen" data-id="${a.id}"><span class="sw" style="background:${accColor(a)}"></span>${esc(a.name)}<span class="vl">${a.closed ? '보관됨' : t === 'card' ? '' : won(balance(a))}</span></button>`).join('');
      });
      h += `<button class="row" data-act="gAccNew" style="font-size:14px">${small(IC.plus)}통장 · 카드 추가</button>`;
    }
    [['exp', '지출 분류'], ['inc', '수입 분류']].forEach(([k, l]) => {
      h += acc(k, l);
      if (A[k]) {
        catList(k).forEach((ct) => {
          const n = (ct.subs || []).length, open = S.gbCatOpen.has(ct.id);
          h += `<div class="gcatrow"><button class="row" data-act="gCatOpen" data-k="${k}" data-id="${ct.id}"><span class="sw" style="background:${ct.color}"></span>${esc(ct.name)}</button><button class="gfold" data-act="gCatFold" data-v="${ct.id}" ${n ? '' : 'disabled'} aria-label="소분류 펼치기">${n ? `소분류 ${n} <b>${open ? '−' : '+'}</b>` : ''}</button></div>`;
          if (open) (ct.subs || []).forEach((s) => { h += `<button class="row sub" data-act="gCatOpen" data-k="${k}" data-id="${ct.id}"><span class="sw" style="background:${ct.color}"></span>${esc(s.name)}</button>`; });
        });
        h += `<button class="row" data-act="gCatNew" data-k="${k}" style="font-size:14px">${small(IC.plus)}분류 추가</button>`;
      }
    });
    h += acc('data', '데이터');
    if (A.data) {
      h += '<button class="row" data-act="gExportJson">머니북 백업 파일 받기<span class="vl">.json</span></button>';
      h += '<button class="row" data-act="importJson">백업 파일로 복원</button>';
      h += '<button class="row" data-act="backups">자동 백업 목록</button>';
      h += '<button class="row" data-act="ckOpen">데이터 점검</button>';
      h += '<input type="file" id="imp" accept=".json,application/json" hidden>';
    }
    h += acc('etc', '잠금 · 내보내기');
    if (A.etc) {
      h += `<button class="row" data-act="pinSet">잠금 비밀번호<span class="vl">${S.settings.recPin ? '설정됨' : '없음'}</span></button>`;
      h += '<button class="row" data-act="gXlsx">엑셀로 내보내기<span class="vl">.xlsx</span></button>';
    }
    return h + '</div>';
  }

  function lockPage() {
    return `<div class="head"><div class="big"><h1 class="word">머니북</h1></div></div><div class="gpad"><div class="lockbox">${IC.lock}<b>머니북</b><button class="btn pri" data-act="gUnlock">열기</button></div></div>`;
  }
  const locked = () => S.settings.recPin && !S.gbUnlock;

  function page() {
    if (locked()) return lockPage();
    const V = S.gbView;
    return V === 'bud' ? budPage() : V === 'asset' ? assetPage() : V === 'stat' ? statPage() : V === 'set' ? setPage() : bookPage();
  }
  function rpanel() {
    if (locked() || S.gbView !== 'book' || S.gbTab !== 'cal') return '';
    const d = S.gbSel;
    const l = entries(d, d);
    return `<aside class="rpanel"><p class="dt ${dayClass(d)}">${fmtMD(d)}${HOLIDAYS[d] ? ' · ' + HOLIDAYS[d] : ''}</p><p class="dn">${parse(d).getDate()}</p>${dayListG(d)}${l.length ? `<div class="gdt"><span>이날 합계</span>${dayTotal(l) || '0'}</div>` : ''}<button class="btn sm" style="margin-top:10px" data-act="gNew" data-d="${d}">추가</button></aside>`;
  }
  const MENU = [['book', '데일리'], ['bud', '버짓북'], ['asset', '에셋북'], ['stat', '리포트']];
  const sideItems = () => MENU.map(([k, l]) => `<button class="mi ${S.gbView === k ? 'on' : ''}" data-act="gView" data-v="${k}">${gIc(k)}${l}</button>`).join('');
  const navTabs = () => MENU.map(([k, l]) => `<button class="${S.gbView === k ? 'on' : ''}" data-act="gView" data-v="${k}">${gIc(k)}<span>${l}</span></button>`).join('');
  const showFab = () => !locked() && S.gbView === 'book' && S.gbTab !== 'mon';
  const setIcon = () => gIc('set');

  // ---------- 입력 시트 ----------
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
  const sel = (label, f, opts, cur, empty) => `<div class="gfld"><label class="lb" for="g_${f}">${label}</label><select id="g_${f}" data-gf="${f}">${empty ? opt('', empty, cur) : ''}${opts.map(([v, l]) => opt(v, l, cur)).join('')}</select></div>`;
  // 날짜는 기기 설정과 상관없이 yyyy-mm-dd 로 보이게 (누르면 달력은 그대로 열림)
  const inp = (label, f, val, type = 'text', extra = '') => type === 'date'
    ? `<div class="gfld"><label class="lb" for="g_${f}">${label}</label><div class="gdate"><input id="g_${f}" type="date" data-gf="${f}" value="${esc(val ?? '')}" ${extra}><span>${esc(val || '')}</span></div></div>`
    : `<div class="gfld"><label class="lb" for="g_${f}">${label}</label><input id="g_${f}" type="${type}" data-gf="${f}" value="${esc(val ?? '')}" ${extra}></div>`;
  const accOpts = (types) => accs().filter((a) => types.includes(a.type)).map((a) => [a.id, a.name]);
  const amtBand = (color, d) => `<div class="band in gband" style="background:${color};color:${textOn(color)}"><input id="g_title" data-gf="title" value="${esc(d.title || '')}" autocomplete="off" style="color:inherit"><input id="g_amount" data-gf="amount" inputmode="numeric" autocomplete="off" value="${d.amount ? commas(d.amount) : ''}" style="color:inherit"><button class="x" aria-label="닫기" data-act="close">${IC.x}</button></div>`;
  function catSel(kind, d) {
    const cs = catList(kind);
    const c = catOf(kind, d.cat);
    return `<div class="two">${sel('대분류', 'cat', cs.map((x) => [x.id, x.name]), d.cat, '고르기')}${sel('소분류', 'sub', (c?.subs || []).map((x) => [x.id, x.name]), d.sub, (c?.subs || []).length ? '없음' : '없음')}</div>`;
  }
  // 자동완성: 예전에 쓴 내역에서 같은 내용을 찾아 자주 쓴 순서로
  function sugList(type, q) {
    const map = new Map();
    S.gbTx.filter((t) => t.type === type && (t.title || '').trim()).forEach((t) => {
      const k = t.title.trim();
      const m = map.get(k) || { n: 0, last: null };
      m.n++;
      if (!m.last || t.date > m.last.date || (t.date === m.last.date && (t.created || 0) > (m.last.created || 0))) m.last = t;
      map.set(k, m);
    });
    const qq = (q || '').trim().toLowerCase();
    return [...map.entries()].filter(([k]) => !qq || (k.toLowerCase().includes(qq) && k.toLowerCase() !== qq))
      .sort((a, b) => (qq ? (b[0].toLowerCase().startsWith(qq) - a[0].toLowerCase().startsWith(qq)) : 0) || b[1].n - a[1].n || (a[1].last.date < b[1].last.date ? 1 : -1))
      .slice(0, qq ? 5 : 6).map(([k, m]) => m.last);
  }
  function sugHtml(sh) {
    if (!sh.isNew || sh.sugOff) return '';
    const d = sh.draft, q = d.title || '';
    const l = sugList(d.type, q);
    sh.sug = l;
    if (!l.length) return '';
    if (!q.trim()) return `<div class="gsugc">${l.map((t, i) => `<button data-act="gSug" data-i="${i}">${esc(t.title)}</button>`).join('')}</div>`;
    return `<div class="gsugl">${l.map((t, i) => `<button data-act="gSug" data-i="${i}"><span>${esc(t.title)}<small>${t.type === 'tr' ? `${esc(accName(t.acc))} → ${esc(accName(t.to))}` : `${esc(catName(t.type, t.cat, t.sub))} · ${esc(accName(t.acc))}`}</small></span><b>${won(t.amount)}</b></button>`).join('')}</div>`;
  }
  const feeInp = (d) => `<div class="gfld"><label class="lb" for="g_fee">수수료</label><input id="g_fee" data-gf="fee" inputmode="numeric" autocomplete="off" value="${+d.fee ? commas(d.fee) : ''}"></div>`;
  const ynHtml = (d) => `<div class="gfld gyn"><span>지출로 잡기</span>${seg([['n', '아니요'], ['y', '예']], d.asExp ? 'y' : 'n', 'gAsExp')}</div>`;
  function txHtml() {
    const sh = S.sheet, d = sh.draft;
    const color = d.type === 'tr' ? (d.asExp && catOf('exp', d.cat)?.color) || '#D9D9D9' : catOf(d.type, d.cat)?.color || '#E6E6E6';
    let h = amtBand(color, d) + `<div id="gsug">${sugHtml(sh)}</div>`;
    h += `<div class="gform">${seg([['exp', '지출'], ['inc', '수입'], ['tr', '이체']], d.type, 'gTxType')}`;
    if (d.type === 'tr') {
      h += `<div class="two">${sel('보내는 통장', 'acc', accOpts(['bank', 'saving']), d.acc, '고르기')}${sel('받는 통장', 'to', accOpts(['bank', 'saving']), d.to, '고르기')}</div>`;
      h += catSel('exp', d);
      h += `<div class="two">${inp('날짜', 'date', d.date, 'date')}${feeInp(d)}</div>`;
      h += ynHtml(d);
    } else {
      const ao = d.type === 'exp' ? accOpts(['bank', 'saving', 'card']) : accOpts(['bank', 'saving']);
      h += `<div class="two">${inp('날짜', 'date', d.date, 'date')}${sel(d.type === 'exp' ? '결제 방법' : '입금 통장', 'acc', ao, d.acc, '고르기')}</div>`;
      h += catSel(d.type, d);
      if (d.type === 'exp' && accOf(d.acc)?.type === 'card') {
        const n = +d.inst || 1, preset = [1, 3, 6, 12];
        const custom = sh.instCustom || !preset.includes(n);
        h += `<div class="gfld"><span class="lb">할부</span><div class="gchips">${preset.map((k) => `<button class="${!custom && n === k ? 'on' : ''}" data-act="gInst" data-v="${k}">${k === 1 ? '일시불' : k + '개월'}</button>`).join('')}<button class="${custom ? 'on' : ''}" data-act="gInst" data-v="c">직접</button></div>${custom ? `<input data-gf="inst" inputmode="numeric" value="${n > 1 ? n : ''}" style="margin-top:8px">` : ''}${n > 1 && d.amount ? `<p class="mut" style="font-size:12.5px;margin:6px 0 0">매달 ${won(Math.floor(d.amount / n))}</p>` : ''}</div>`;
      }
    }
    h += inp('메모', 'memo', d.memo);
    h += '</div>' + errLine(sh) + `<div class="acts">${sh.isNew ? '<button class="btn" data-act="close">닫기</button>' : `<button class="btn del" data-act="gTxDel">${S.delArm ? '정말 삭제' : '삭제'}</button>`}<button class="btn pri" data-act="gTxSave">저장</button></div>`;
    return h;
  }
  function fxHtml() {
    const sh = S.sheet, d = sh.draft;
    const color = d.type === 'tr' ? (d.asExp && catOf('exp', d.cat)?.color) || '#D9D9D9' : catOf('exp', d.cat)?.color || '#E6E6E6';
    let h = amtBand(color, d) + `<div class="gform">${seg([['exp', '고정 지출'], ['tr', '고정 이체']], d.type, 'gFxType')}`;
    const daySel = sel('반복', 'day', Array.from({ length: 31 }, (_, i) => [String(i + 1), `매월 ${i + 1}일`]), String(d.day));
    // 왼쪽 줄: 보내는 통장(결제 방법) - 대분류 - 반복 - 시작일 - 지출로 잡기
    if (d.type === 'tr') h += `<div class="two">${sel('보내는 통장', 'acc', accOpts(['bank', 'saving']), d.acc, '고르기')}${sel('받는 통장', 'to', accOpts(['bank', 'saving']), d.to, '고르기')}</div>`;
    else h += `<div class="two">${sel('결제 방법', 'acc', accOpts(['bank', 'saving', 'card']), d.acc, '고르기')}<div></div></div>`;
    h += catSel('exp', d);
    h += `<div class="two">${daySel}${d.type === 'tr' ? feeInp(d) : '<div></div>'}</div>`;
    h += `<div class="two">${inp('시작일', 'start', d.start, 'date')}${inp('종료일', 'end', d.end, 'date')}</div>`;
    if (d.type === 'tr') h += ynHtml(d);
    h += inp('메모', 'memo', d.memo);
    h += '</div>' + errLine(sh) + `<div class="acts">${sh.isNew ? '<button class="btn" data-act="close">닫기</button>' : `<button class="btn del" data-act="gFxDel">${S.delArm ? '정말 삭제' : '삭제'}</button>`}<button class="btn pri" data-act="gFxSave">저장</button></div>`;
    return h;
  }
  function budFill(sh) {
    const B = bv(), L = lab(sh.y, sh.m), d = {};
    catList('exp').forEach((c) => [{ id: 'c:' + c.id }, ...(c.subs || [])].forEach((x) => { d[x.id] = sh.mode === 'cont' ? baseAt(B[x.id], L) : budAt(x.id, sh.y, sh.m, B); }));
    sh.draft = d;
  }
  // 예산 정하기 (표): 분류 | 지난달 | 이번 달. 빈칸은 예산 없음
  function budHtml() {
    const sh = S.sheet, b = sh.draft, B = bv();
    const py = sh.m === 0 ? sh.y - 1 : sh.y, pm = sh.m === 0 ? 11 : sh.m - 1;
    let h = band('#111111', `${sh.m + 1}월 예산`);
    h += `<div class="gtabs gbtab">${[['cont', `${sh.m + 1}월부터 계속`], ['only', `${sh.m + 1}월만`]].map(([k, l]) => `<button class="${sh.mode === k ? 'on' : ''}" data-act="gBudMode" data-v="${k}">${l}</button>`).join('')}</div>`;
    h += `<table class="gct"><thead><tr><th>분류</th><th>지난달</th><th>${sh.m + 1}월</th></tr></thead><tbody>`;
    const cell = (k, c) => { const v = b[k]; const ov = sh.mode === 'only' && isOver(k, sh.y, sh.m, B); return `<td class="v"><input id="gb_${k.replace(':', '_')}" data-gb="${k}" data-c="${c}" inputmode="numeric" autocomplete="off" class="${ov ? 'ov' : ''}" value="${v ? commas(v) : ''}"></td>`; };
    catList('exp').forEach((c) => {
      const pv = budAt('c:' + c.id, py, pm, B);
      h += `<tr class="c"><td><span class="sw" style="background:${c.color}"></span>${esc(c.name)}</td><td class="p">${pv ? won(pv) : ''}</td>${cell('c:' + c.id, c.id)}</tr>`;
      (c.subs || []).forEach((x) => { const sv = budAt(x.id, py, pm, B); h += `<tr class="s"><td>${esc(x.name)}</td><td class="p">${sv ? won(sv) : ''}</td>${cell(x.id, c.id)}</tr>`; });
    });
    h += '</tbody></table>';
    return h + `${errLine(sh)}<div class="gbft"><div><small>합계</small><b id="gbt_all">${won(budAllTxt(b))}</b></div><button class="btn pri" data-act="gBudSave">저장</button></div>`;
  }
  const budSubTxt = () => '';
  const budAllTxt = (b) => sum(catList('exp'), (c) => b['c:' + c.id] || sum(c.subs || [], (x) => b[x.id] || 0));
  // 한 항목: 기본 예산 + 달마다
  function budKeyHtml() {
    const sh = S.sheet, B = sh.B, k = sh.k, y = sh.y;
    const name = k.startsWith('c:') ? catOf('exp', k.slice(2))?.name : catName('exp', catList('exp').find((c) => (c.subs || []).some((x) => x.id === k))?.id, k);
    const color = k.startsWith('c:') ? catOf('exp', k.slice(2))?.color : catList('exp').find((c) => (c.subs || []).some((x) => x.id === k))?.color;
    let h = band(color || '#E6E6E6', name || '');
    h += `<div class="gform"><div class="gfld"><label class="lb" for="g_base">기본 예산 (${sh.m0 + 1}월부터)</label><div class="gbedit"><input id="g_base" data-gk="base" inputmode="numeric" value="${sh.base ? commas(sh.base) : ''}"><button class="btn sm pri" data-act="gBkBase">저장</button></div></div></div>`;
    h += `<div class="gyrnav"><button class="ico" aria-label="이전 해" data-act="gBkY" data-v="-1">${IC.l}</button><b>${y}</b><button class="ico" aria-label="다음 해" data-act="gBkY" data-v="1">${IC.r}</button></div>`;
    const cl = curLabel();
    for (let m = 11; m >= 0; m--) {
      const v = budAt(k, y, m, B), o = isOver(k, y, m, B);
      const cur = cl[0] === y && cl[1] === m;
      h += `<button class="gbm ${cur ? 'cur' : ''} ${o ? 'ch' : ''}" data-act="gBkMonth" data-v="${m}"><span>${m + 1}월</span><span class="v">${v ? won(v) : '–'}${o ? '<i>따로</i>' : ''}</span></button>`;
      if (sh.edit === m) h += `<div class="gbedit"><input data-gk="over" inputmode="numeric" value="${sh.ov ? commas(sh.ov) : ''}"><button class="btn sm" data-act="gBkOff">기본으로</button><button class="btn sm pri" data-act="gBkOver">저장</button></div>`;
    }
    return h + errLine(sh);
  }
  function accHtml() {
    const sh = S.sheet, a = sh.draft;
    const col = a.color || ACC_COL[a.type];
    let h = `<div class="band in" style="background:${col};color:${textOn(col)}"><input id="g_name" data-gf="name" value="${esc(a.name || '')}" autocomplete="off" style="color:inherit"><button class="x" aria-label="닫기" data-act="close">${IC.x}</button></div><div class="gform">`;
    h += seg([['bank', '통장'], ['saving', '저축'], ['card', '신용카드']], a.type, 'gAccType');
    h += colField(sh, col);
    if (a.type !== 'card') h += `<div class="gfld"><label class="lb" for="g_bal">현재 잔액</label><input id="g_bal" data-gf="bal" inputmode="numeric" value="${a.bal != null ? commas(a.bal) : ''}"></div>`;
    if (!sh.isNew) {
      const n = refCount('acc', a.id);
      if (sh.delMode) {
        h += `<div class="gfld"><span class="lb">이 통장에 걸린 내역 ${n}건</span>${seg([['keep', '보관 (내역 그대로)'], ['move', '다른 통장으로 옮기고 삭제']], sh.delMode, 'gAccDelMode')}</div>`;
        if (sh.delMode === 'move') h += sel('옮길 통장', 'moveTo', accs().filter((x) => x.id !== a.id && (a.type === 'card' ? true : x.type !== 'card')).map((x) => [x.id, x.name]), sh.moveTo, '고르기');
      }
    }
    h += '</div>' + errLine(sh);
    if (!sh.isNew && sh.delMode) return h + `<div class="acts"><button class="btn" data-act="gAccDelCancel">취소</button><button class="btn del" style="flex:2" data-act="gAccDelGo">${sh.delMode === 'keep' ? '보관하기' : '옮기고 삭제'}</button></div>`;
    return h + `<div class="acts">${sh.isNew ? '<button class="btn" data-act="close">닫기</button>' : `<button class="btn del" data-act="gAccDel">${a.closed ? '다시 쓰기' : '삭제'}</button>`}<button class="btn pri" data-act="gAccSave">저장</button></div>`;
  }
  // 색: 한 칸만 보이고, 누르면 추천 색 · 직접 입력
  function colField(sh, color) {
    let h = `<div class="gfld"><span class="lb">색</span><button class="gcolrow" data-act="gColTog"><span class="sw" style="background:${color}"></span><span>${esc((color || '').toUpperCase())}</span><b>${sh.colOpen ? '−' : '+'}</b></button>`;
    if (sh.colOpen) {
      h += `<div class="gcolbox"><span class="lb">추천 색</span><div class="pal">${PALETTE.map((p) => `<button style="background:${p}" class="${p.toUpperCase() === (color || '').toUpperCase() ? 'on' : ''}" aria-label="${p}" data-act="gCatColor" data-v="${p}"></button>`).join('')}</div>`;
      h += `<span class="lb">직접 입력</span><div class="hexrow"><input type="color" aria-label="색 고르기" data-gf="pick" value="${color}"><input data-gf="hex" value="${esc(color)}" autocomplete="off"></div></div>`;
    }
    return h + '</div>';
  }
  function catHtml() {
    const sh = S.sheet, c = sh.draft;
    let h = `<div class="band in" style="background:${c.color};color:${textOn(c.color)}"><input id="g_name" data-gf="name" value="${esc(c.name || '')}" autocomplete="off" style="color:inherit"><button class="x" aria-label="닫기" data-act="close">${IC.x}</button></div><div class="gform">`;
    h += colField(sh, c.color);
    h += '<div class="gfld"><span class="lb">소분류</span>';
    (c.subs || []).forEach((s, i) => { h += `<div class="gsubrow"><input data-gs="${i}" value="${esc(s.name)}"><button class="ico" aria-label="빼기" data-act="gSubDel" data-i="${i}">${IC.x}</button></div>`; });
    h += `<button class="row" data-act="gSubAdd" style="font-size:14px">${small(IC.plus)}소분류 추가</button></div>`;
    if (sh.delMode) {
      const n = refCount('cat', c.id);
      h += `<div class="gfld"><span class="lb">이 분류에 걸린 내역 ${n}건 · 옮길 분류</span><select data-gf="moveTo">${catList(sh.k).filter((x) => x.id !== c.id).map((x) => opt(x.id, x.name, sh.moveTo)).join('')}</select></div>`;
    }
    h += '</div>' + errLine(sh);
    if (sh.delMode) return h + `<div class="acts"><button class="btn" data-act="gCatDelCancel">취소</button><button class="btn del" style="flex:2" data-act="gCatDelGo">옮기고 삭제</button></div>`;
    return h + `<div class="acts">${sh.isNew ? '<button class="btn" data-act="close">닫기</button>' : `<button class="btn del" data-act="gCatDel">삭제</button>`}<button class="btn pri" data-act="gCatSave">저장</button></div>`;
  }
  function pickHtml() {
    const rows = yearRows(S.gbYear);
    let h = band('#111111', '항목 고르기') + '<div class="gplist">';
    rows.forEach((r) => {
      if (r.g !== undefined && !r.key) { h += `<div class="pg">${r.g}</div>`; return; }
      h += `<button class="${r.key === S.gbPick ? 'on' : ''} ${r.parent ? 'sub' : ''}" data-act="gPickSet" data-v="${r.key}">${esc(r.name)}${r.key === S.gbPick ? small(IC.check, 16) : ''}</button>`;
    });
    return h + '</div>';
  }
  const dayHtml = () => { const d = S.sheet.d; return `${band('#111111', `${fmtMD(d)}${HOLIDAYS[d] ? ' · ' + HOLIDAYS[d] : ''}`)}<div style="margin-top:12px">${dayListG(d)}</div><button class="btn pri" style="width:100%;margin-top:8px" data-act="gNew" data-d="${d}">추가</button>`; };
  const xlsxHtml = () => { const sh = S.sheet; return `${band('#111111', '머니북 엑셀로 내보내기')}<div class="gform"><div class="two">${inp('시작', 'from', sh.from, 'date')}${inp('끝', 'to', sh.to, 'date')}</div></div>${errLine(sh)}<div class="acts"><button class="btn pri" data-act="gXlsxGo">내보내기</button></div>`; };
  const sheets = { gtx: txHtml, gfx: fxHtml, gbud: budHtml, gbkey: budKeyHtml, gacc: accHtml, gcat: catHtml, gpick: pickHtml, gday: dayHtml, gxlsx: xlsxHtml };

  function refCount(kind, id) {
    if (kind === 'acc') return S.gbTx.filter((t) => t.acc === id || t.to === id).length + S.gbFixed.filter((t) => t.acc === id || t.to === id).length;
    return S.gbTx.filter((t) => t.cat === id).length + S.gbFixed.filter((t) => t.cat === id).length;
  }
  function ensureConf() { if (!S.gbConf.some((x) => x.id === 'main')) saveConf(conf()); }

  // ---------- 동작 ----------
  const newTx = (d, type = 'exp') => {
    const last = S.gbTx.slice().sort((a, b) => (b.created || 0) - (a.created || 0)).find((t) => t.type === type);
    return { id: uid(), type, date: d || todayStr(), amount: 0, title: '', acc: last?.acc || accs()[0]?.id || '', to: '', cat: '', sub: '', memo: '', inst: 1, created: Date.now() };
  };
  const shiftMonth = (k) => { let [y, m] = S.gbMonth; m += k; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } S.gbMonth = [y, m]; render(); };
  const guardAcc = () => { if (!accs().length) { toast('먼저 통장이나 카드를 추가해 주세요'); S.gbView = 'set'; S.gbAcc.acc = true; render(); return false; } return true; };
  const ACT = {
    gMode: (el) => setMode(el.dataset.v),
    gView: (el) => { S.gbView = el.dataset.v; if (S.sheet) closeSheet(); else render(); },
    gTab: (el) => { S.gbTab = el.dataset.v; render(); },
    gMPrev: () => shiftMonth(-1), gMNext: () => shiftMonth(1),
    gYPrev: () => { S.gbYear--; render(); }, gYNext: () => { S.gbYear++; render(); },
    gGoMonth: (el) => { S.gbMonth = [S.gbYear, +el.dataset.v]; S.gbTab = 'cal'; render(); },
    gBPrev: () => { S.gbBudOff = (S.gbBudOff || 0) - 1; render(); }, gBNext: () => { S.gbBudOff = (S.gbBudOff || 0) + 1; render(); },
    gBudTab: (el) => { S.gbBudTab = el.dataset.v; render(); },
    gStatTab: (el) => { S.gbStatTab = el.dataset.v; render(); },
    gExpand: (el) => { const v = el.dataset.v; if (S.gbExpand.has(v)) S.gbExpand.delete(v); else S.gbExpand.add(v); render(); },
    gPick: () => openSheet({ kind: 'gpick' }),
    gPickSet: (el) => { S.gbPick = el.dataset.v; closeSheet(); },
    gSelDay: (el, e) => { e.stopPropagation(); const d = el.dataset.d; S.gbSel = d; if (wide()) render(); else openSheet({ kind: 'gday', d }); },
    gAddOn: (el) => { S.gbSel = el.dataset.d; ACT.gNew(el); },
    gNew: (el) => { if (!guardAcc()) return; ensureConf(); const sh = { kind: 'gtx', isNew: true, draft: newTx(el?.dataset?.d || (S.gbView === 'book' && wide() ? S.gbSel : todayStr())) }; if (S.sheet) { S.sheet = sh; render(); } else openSheet(sh); },
    gFab: () => ACT.gNew(null),
    gTxOpen: (el) => { const t = S.gbTx.find((x) => x.id === el.dataset.id); if (!t) return; const sh = { kind: 'gtx', isNew: false, draft: { inst: 1, ...clone(t) } }; if (S.sheet) { S.sheet = sh; S.delArm = false; render(); } else openSheet(sh); },
    gTxType: (el) => { const d = S.sheet.draft; d.type = el.dataset.v; d.cat = ''; d.sub = ''; if (d.type !== 'exp') d.inst = 1; if (d.type !== 'exp' && accOf(d.acc)?.type === 'card') d.acc = accs().find((a) => a.type !== 'card')?.id || ''; render(); },
    gSug: (el) => {
      const sh = S.sheet, t = (sh.sug || [])[+el.dataset.i];
      if (!t) return;
      const d = sh.draft;
      Object.assign(d, { title: t.title, cat: t.cat || '', sub: t.sub || '', acc: t.acc || d.acc, to: t.to || '', amount: t.inst > 1 ? d.amount || t.amount : t.amount, inst: 1 });
      if (t.acc && !accOf(t.acc)) d.acc = accs()[0]?.id || '';
      sh.sugOff = true;
      render();
    },
    gAsExp: (el) => { S.sheet.draft.asExp = el.dataset.v === 'y'; render(); },
    gInst: (el) => { const sh = S.sheet; if (el.dataset.v === 'c') { sh.instCustom = true; } else { sh.instCustom = false; sh.draft.inst = +el.dataset.v; } render(); },
    gTxSave: () => {
      const sh = S.sheet, d = { ...sh.draft };
      d.title = (d.title || '').trim();
      if (!d.amount) { sh.err = '금액을 입력해 주세요.'; render(); return; }
      if (!d.date) { sh.err = '날짜를 골라 주세요.'; render(); return; }
      if (!d.acc) { sh.err = d.type === 'tr' ? '보내는 통장을 골라 주세요.' : '통장이나 카드를 골라 주세요.'; render(); return; }
      if (d.type === 'tr' && (!d.to || d.to === d.acc)) { sh.err = '받는 통장을 골라 주세요.'; render(); return; }
      if ((d.type !== 'tr' || d.asExp) && !d.cat) { sh.err = '대분류를 골라 주세요.'; render(); return; }
      if (d.type !== 'exp' || accOf(d.acc)?.type !== 'card') d.inst = 1;
      if (d.type !== 'tr') { delete d.fee; delete d.asExp; } else { d.fee = +d.fee || 0; d.asExp = !!d.asExp; }
      d.inst = Math.max(1, Math.min(60, +d.inst || 1));
      if (d.type !== 'tr') d.to = '';
      save('gbTx', d); closeSheet();
    },
    gTxDel: () => { if (!armDel()) return; D.deleteDocIn(U(), 'gbTx', S.sheet.draft.id); closeSheet(); },
    gFxNew: () => { if (!guardAcc()) return; ensureConf(); openSheet({ kind: 'gfx', isNew: true, draft: { id: uid(), type: 'exp', title: '', amount: 0, day: 25, start: todayStr(), end: '', acc: accs()[0]?.id || '', to: '', cat: '', sub: '', memo: '', created: Date.now() } }); },
    gFxOpen: (el) => { const f = S.gbFixed.find((x) => x.id === el.dataset.id); if (!f) return; const sh = { kind: 'gfx', isNew: false, draft: clone(f) }; if (S.sheet) { S.sheet = sh; S.delArm = false; render(); } else openSheet(sh); },
    gFxType: (el) => { const d = S.sheet.draft; d.type = el.dataset.v; d.cat = ''; d.sub = ''; if (d.type === 'tr' && accOf(d.acc)?.type === 'card') d.acc = accs().find((a) => a.type !== 'card')?.id || ''; render(); },
    gFxSave: () => {
      const sh = S.sheet, d = { ...sh.draft };
      d.title = (d.title || '').trim();
      if (!d.title) { sh.err = '이름을 입력해 주세요.'; render(); return; }
      if (!d.amount) { sh.err = '금액을 입력해 주세요.'; render(); return; }
      if (!d.acc) { sh.err = '통장을 골라 주세요.'; render(); return; }
      if (d.type === 'tr' && (!d.to || d.to === d.acc)) { sh.err = '받는 통장을 골라 주세요.'; render(); return; }
      if ((d.type === 'exp' || d.asExp) && !d.cat) { sh.err = '대분류를 골라 주세요.'; render(); return; }
      if (d.type !== 'tr') { delete d.fee; delete d.asExp; } else { d.fee = +d.fee || 0; d.asExp = !!d.asExp; }
      if (!d.start) { sh.err = '시작일을 골라 주세요.'; render(); return; }
      if (d.end && d.end < d.start) { sh.err = '종료일이 시작일보다 빨라요.'; render(); return; }
      d.day = +d.day || 1;
      save('gbFixed', d); closeSheet();
    },
    gFxDel: () => { if (!armDel()) return; D.deleteDocIn(U(), 'gbFixed', S.sheet.draft.id); closeSheet(); },
    gBudEdit: (el) => {
      ensureConf();
      const p = period(S.gbBudOff || 0);
      const sh = { kind: 'gbud', y: p.y, m: p.m, mode: 'cont', draft: {} };
      budFill(sh);
      openSheet(sh);
      const k = el?.dataset?.k; if (k) setTimeout(() => { const inp2 = document.getElementById('gb_' + k.replace(':', '_')); if (inp2) { inp2.scrollIntoView({ block: 'center' }); inp2.focus(); } }, 50);
    },
    gBudMode: (el) => { const sh = S.sheet; sh.mode = el.dataset.v; sh.err = ''; budFill(sh); render(); },
    gBudSave: () => {
      const sh = S.sheet, c = conf(), B = clone(bv(c));
      Object.entries(sh.draft).forEach(([k, v]) => {
        v = v || 0;
        if (sh.mode === 'cont') setBase(B, k, sh.y, sh.m, v);
        else if (v === baseAt(B[k], lab(sh.y, sh.m))) setOver(B, k, sh.y, sh.m, null);
        else setOver(B, k, sh.y, sh.m, v);
      });
      const err = budCheck(B, sh.y, sh.m); if (err) { sh.err = err; render(); return; }
      saveConf({ ...c, budgetV: B }); closeSheet();
    },
    gBudKey: (el) => ACT.gBudEdit(el),
    gBkY: (el) => { const sh = S.sheet; sh.y += +el.dataset.v; sh.edit = null; render(); },
    gBkMonth: (el) => { const sh = S.sheet, m = +el.dataset.v; if (sh.edit === m) { sh.edit = null; render(); return; } sh.edit = m; sh.ov = budAt(sh.k, sh.y, m, sh.B); sh.err = ''; render(); },
    gBkBase: () => {
      const sh = S.sheet, c = conf(), B = clone(bv(c));
      setBase(B, sh.k, sh.y0, sh.m0, sh.base || 0);
      const err = budCheck(B, sh.y0, sh.m0); if (err) { sh.err = err; render(); return; }
      sh.B = B; sh.err = ''; saveConf({ ...c, budgetV: B }); toast(`${sh.m0 + 1}월부터 기본 예산을 바꿨어요`); render();
    },
    gBkOver: () => {
      const sh = S.sheet, c = conf(), B = clone(bv(c));
      setOver(B, sh.k, sh.y, sh.edit, sh.ov || 0);
      const err = budCheck(B, sh.y, sh.edit); if (err) { sh.err = err; render(); return; }
      sh.B = B; sh.edit = null; sh.err = ''; saveConf({ ...c, budgetV: B }); render();
    },
    gBkOff: () => {
      const sh = S.sheet, c = conf(), B = clone(bv(c));
      setOver(B, sh.k, sh.y, sh.edit, null);
      const err = budCheck(B, sh.y, sh.edit); if (err) { sh.err = err; render(); return; }
      sh.B = B; sh.edit = null; sh.err = ''; saveConf({ ...c, budgetV: B }); render();
    },
    gAcc: (el) => { S.gbAcc[el.dataset.v] = !S.gbAcc[el.dataset.v]; render(); },
    gAccNew: () => { ensureConf(); openSheet({ kind: 'gacc', isNew: true, draft: { id: uid(), name: '', type: 'bank', bal: 0 } }); },
    gAccOpen: (el) => { const a = accOf(el.dataset.id); if (!a) return; openSheet({ kind: 'gacc', isNew: false, draft: { ...clone(a), bal: a.type === 'card' ? 0 : balance(a) } }); },
    gAccType: (el) => { const d = S.sheet.draft; if (!d.color || Object.values(ACC_COL).includes(d.color)) d.color = ACC_COL[el.dataset.v]; d.type = el.dataset.v; render(); },
    gAccSave: () => {
      const sh = S.sheet, d = sh.draft;
      const name = (d.name || '').trim();
      if (!name) { sh.err = '이름을 입력해 주세요.'; render(); return; }
      const c = clone(conf());
      if (sh.isNew) c.accounts.push({ id: d.id, name, type: d.type, color: d.color || ACC_COL[d.type], init: d.type === 'card' ? 0 : d.bal || 0, initDate: todayStr(), adj: 0 });
      else {
        const a = c.accounts.find((x) => x.id === d.id); if (!a) return closeSheet();
        a.name = name; a.type = d.type; if (d.color) a.color = d.color;
        if (d.type !== 'card') { const cur = balance({ ...a, adj: 0 }); a.adj = (d.bal || 0) - cur; }
      }
      saveConf(c); closeSheet();
    },
    gAccDel: async () => {
      const sh = S.sheet, a = sh.draft;
      if (a.closed) { const c = clone(conf()); const x = c.accounts.find((y) => y.id === a.id); if (x) delete x.closed; saveConf(c); closeSheet(); return; }
      if (refCount('acc', a.id) === 0) {
        if (!armDel()) return;
        try { await backupCurrent('머니북 통장 삭제 전 자동 백업'); } catch (e) { toast('백업을 하지 못해서 지우지 않았어요'); return; }
        const c = clone(conf()); c.accounts = c.accounts.filter((x) => x.id !== a.id); saveConf(c); closeSheet(); return;
      }
      sh.delMode = 'keep'; render();
    },
    gAccDelMode: (el) => { S.sheet.delMode = el.dataset.v; render(); },
    gAccDelCancel: () => { S.sheet.delMode = null; S.sheet.err = ''; render(); },
    gAccDelGo: async () => {
      const sh = S.sheet, a = sh.draft;
      const c = clone(conf());
      if (sh.delMode === 'keep') { const x = c.accounts.find((y) => y.id === a.id); if (x) x.closed = true; saveConf(c); closeSheet(); toast('보관했어요. 설정에서 다시 쓸 수 있어요'); return; }
      if (!sh.moveTo) { sh.err = '옮길 통장을 골라 주세요.'; render(); return; }
      try { await backupCurrent('머니북 통장 삭제 전 자동 백업'); } catch (e) { toast('백업을 하지 못해서 지우지 않았어요'); return; }
      S.gbTx.forEach((t) => { if (t.acc === a.id || t.to === a.id) save('gbTx', { ...t, acc: t.acc === a.id ? sh.moveTo : t.acc, to: t.to === a.id ? sh.moveTo : t.to }); });
      S.gbFixed.forEach((t) => { if (t.acc === a.id || t.to === a.id) save('gbFixed', { ...t, acc: t.acc === a.id ? sh.moveTo : t.acc, to: t.to === a.id ? sh.moveTo : t.to }); });
      c.accounts = c.accounts.filter((x) => x.id !== a.id); saveConf(c); closeSheet(); toast('옮기고 지웠어요');
    },
    gCatNew: (el) => { ensureConf(); openSheet({ kind: 'gcat', k: el.dataset.k, isNew: true, draft: { id: uid(), name: '', color: PALETTE[0], subs: [] } }); },
    gCatOpen: (el) => { const c = catOf(el.dataset.k, el.dataset.id); if (c) openSheet({ kind: 'gcat', k: el.dataset.k, isNew: false, draft: clone({ subs: [], ...c }) }); },
    gCatColor: (el) => { S.sheet.draft.color = el.dataset.v; S.sheet.colOpen = false; render(); },
    gCatFold: (el) => { const v = el.dataset.v; if (S.gbCatOpen.has(v)) S.gbCatOpen.delete(v); else S.gbCatOpen.add(v); render(); },
    gColTog: () => { S.sheet.colOpen = !S.sheet.colOpen; render(); },
    gSubAdd: () => { S.sheet.draft.subs.push({ id: uid(), name: '' }); render(); },
    gSubDel: (el) => { S.sheet.draft.subs.splice(+el.dataset.i, 1); render(); },
    gCatSave: () => {
      const sh = S.sheet, d = sh.draft;
      const name = (d.name || '').trim();
      if (!name) { sh.err = '분류 이름을 입력해 주세요.'; render(); return; }
      d.subs = d.subs.map((s) => ({ ...s, name: (s.name || '').trim() })).filter((s) => s.name);
      const c = clone(conf());
      const list = c[sh.k];
      const i = list.findIndex((x) => x.id === d.id);
      // 빠진 소분류의 내역은 대분류에만 남김
      if (i >= 0) {
        const keep = new Set(d.subs.map((s) => s.id));
        const gone = (list[i].subs || []).filter((s) => !keep.has(s.id)).map((s) => s.id);
        if (gone.length) {
          S.gbTx.forEach((t) => { if (gone.includes(t.sub)) save('gbTx', { ...t, sub: '' }); });
          S.gbFixed.forEach((t) => { if (gone.includes(t.sub)) save('gbFixed', { ...t, sub: '' }); });
          gone.forEach((g) => { if (c.budget) delete c.budget[g]; if (c.budgetV) delete c.budgetV[g]; });
        }
        list[i] = { ...list[i], name, color: d.color, subs: d.subs };
      } else list.push({ id: d.id, name, color: d.color, subs: d.subs });
      saveConf(c); closeSheet();
    },
    gCatDel: () => {
      const sh = S.sheet;
      if (catList(sh.k).length <= 1) { sh.err = '분류가 하나는 있어야 해요.'; render(); return; }
      const other = catList(sh.k).filter((x) => x.id !== sh.draft.id);
      sh.delMode = true; sh.moveTo = (other.find((x) => x.name.includes('기타')) || other[0]).id; render();
    },
    gCatDelCancel: () => { S.sheet.delMode = false; render(); },
    gCatDelGo: async () => {
      const sh = S.sheet, d = sh.draft;
      try { await backupCurrent('머니북 분류 삭제 전 자동 백업'); } catch (e) { toast('백업을 하지 못해서 지우지 않았어요'); return; }
      S.gbTx.forEach((t) => { if (t.cat === d.id) save('gbTx', { ...t, cat: sh.moveTo, sub: '' }); });
      S.gbFixed.forEach((t) => { if (t.cat === d.id) save('gbFixed', { ...t, cat: sh.moveTo, sub: '' }); });
      const c = clone(conf());
      c[sh.k] = c[sh.k].filter((x) => x.id !== d.id);
      if (c.budget) { delete c.budget[d.id]; (d.subs || []).forEach((s) => delete c.budget[s.id]); }
      if (c.budgetV) { delete c.budgetV['c:' + d.id]; (d.subs || []).forEach((s) => delete c.budgetV[s.id]); }
      saveConf(c); closeSheet(); toast('옮기고 지웠어요');
    },
    // 머니북 자료만 담은 백업 파일 (플랜북 설정의 백업 파일에도 함께 들어 있음)
    gExportJson: () => {
      const out = { app: 'planbook', part: 'moneybook', ver: APP_VERSION, at: new Date().toISOString() };
      ['items', 'notes', 'records', 'routines', 'yb', 'projects'].forEach((c) => { out[c] = []; });
      out.gbTx = S.gbTx; out.gbFixed = S.gbFixed; out.gbConf = S.gbConf;
      downloadBlob(`플랜북_머니북_백업_${stampName()}.json`, new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
    },
    gUnlock: () => openSheet({ kind: 'pin', mode: 'open', v: '', then: 'gb' }),
    gXlsx: () => { const y = S.gbYear; openSheet({ kind: 'gxlsx', from: `${y}-01-01`, to: `${y}-12-31` }); },
    gXlsxGo: async () => {
      const sh = S.sheet;
      if (!sh.from || !sh.to || sh.from > sh.to) { sh.err = '기간을 확인해 주세요.'; render(); return; }
      const T = { exp: '지출', inc: '수입', tr: '이체' };
      const l = entries(sh.from, sh.to).sort((a, b) => (a.date < b.date ? -1 : 1));
      const rows = l.map((e) => {
        const c = e.type === 'tr' && !e.asExp ? null : catOf(e.type === 'tr' ? 'exp' : e.type, e.cat);
        const s = c && e.sub ? (c.subs || []).find((x) => x.id === e.sub) : null;
        return [e.date, e.type === 'tr' && e.asExp ? '이체(지출)' : T[e.type], amtE(e), c?.name || '', s?.name || '', e.title || '', accName(e.acc), e.type === 'tr' ? accName(e.to) : '', e.n ? `${e.k}/${e.n}` : e.fixed ? '고정' : '', e.memo || ''];
      });
      const y = +sh.from.slice(0, 4);
      const yr = yearRows(y).filter((r) => r.key).map((r) => [r.parent ? '  ' + r.name : r.name, ...r.vals, r.vals.reduce((s, v) => s + v, 0)]);
      try {
        await writeXlsx(`플랜북_머니북_${sh.from.replace(/-/g, '')}-${sh.to.replace(/-/g, '')}.xlsx`, [
          { name: '내역', headers: ['날짜', '구분', '금액', '대분류', '소분류', '내용', '통장 · 카드', '받는 통장', '할부 · 고정', '메모'], widths: [12, 6, 12, 10, 12, 24, 14, 14, 10, 30], rows },
          { name: `${y} 연간표`, headers: ['항목', ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), '합계'], widths: [16, ...Array(13).fill(12)], rows: yr },
        ]);
        closeSheet();
      } catch (e) { console.error(e); sh.err = '내보내지 못했어요.'; render(); }
    },
  };
  function setMode(m) {
    if (m === 'gb' && !S.gbInit) { S.gbInit = true; S.gbMonth = curLabel(); }
    if (S.sheet) { S.sheet = null; if (history.state && history.state.sheet) history.back(); }
    S.mode = m;
    if (m === 'gb') { S.gbView = S.gbView || 'book'; if (S.settings.recPin && !S.gbUnlock) { render(); openSheet({ kind: 'pin', mode: 'open', v: '', then: 'gb' }); return; } }
    render();
  }

  // 입력: data-gf(시트 칸), data-gb(예산 칸), data-gs(소분류 이름), data-g(설정)
  function onInput(el, live) {
    const sh = S.sheet;
    if (el.dataset.g === 'payday' && !live) { saveConf({ ...conf(), payday: +el.value }); return true; }
    if (!sh) return false;
    if (el.dataset.gb) {
      const v = wonOf(el.value); sh.draft[el.dataset.gb] = v;
      const c = catOf('exp', el.dataset.c);
      const ct = document.getElementById('gbt_' + el.dataset.c); if (ct && c) ct.textContent = budSubTxt(c, sh.draft);
      const all = document.getElementById('gbt_all'); if (all) all.textContent = won(budAllTxt(sh.draft));
      if (!live) el.value = v ? commas(v) : '';
      return true;
    }
    if (el.dataset.gk) {
      const v = wonOf(el.value);
      if (el.dataset.gk === 'base') sh.base = v; else sh.ov = v;
      if (!live) el.value = v ? commas(v) : '';
      return true;
    }
    if (el.dataset.gs) { sh.draft.subs[+el.dataset.gs].name = el.value; return true; }
    const f = el.dataset.gf;
    if (!f) return false;
    const d = sh.draft || sh;
    if (el.type === 'date' && el.parentElement?.classList.contains('gdate')) { const sp = el.nextElementSibling; if (sp) sp.textContent = el.value; }
    if (f === 'amount' || f === 'bal' || f === 'fee') { d[f] = wonOf(el.value); if (!live) { el.value = d[f] ? commas(d[f]) : ''; if (sh.kind === 'gtx' && d.inst > 1) render(); } return true; }
    if (f === 'from' || f === 'to') { if (sh.kind === 'gxlsx') { sh[f] = el.value; return true; } }
    if (f === 'moveTo') { sh.moveTo = el.value; return true; }
    if (f === 'pick' || f === 'hex') {
      const v = el.value.trim().toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(v)) return true;
      d.color = v;
      // 다시 그리지 않고 색만 바꿈 (입력 중 칸이 사라지지 않게)
      const bd = document.querySelector('.sheet .band'); if (bd) { bd.style.background = v; bd.style.color = textOn(v); }
      const sw = document.querySelector('.sheet .gcolrow .sw'); if (sw) sw.style.background = v;
      const tx = document.querySelector('.sheet .gcolrow span:nth-child(2)'); if (tx) tx.textContent = v;
      const other = document.querySelector(f === 'pick' ? '.sheet [data-gf="hex"]' : '.sheet [data-gf="pick"]'); if (other) other.value = f === 'pick' ? v : v.toLowerCase();
      return true;
    }
    if (f === 'title' && sh.kind === 'gtx') {
      d.title = el.value;
      if (live) sh.sugOff = false;
      if (sh.isNew && live) { const box = document.getElementById('gsug'); if (box) box.innerHTML = sugHtml(sh); }
      return true;
    }
    if (f === 'inst') { d.inst = Math.max(1, Math.min(60, +el.value.replace(/[^\d]/g, '') || 1)); if (!live) render(); return true; }
    d[f] = el.value;
    if (!live && (f === 'cat' || f === 'acc')) { if (f === 'cat') d.sub = ''; render(); }
    return true;
  }

  return { page, rpanel, sideItems, navTabs, showFab, sheets, ACT, onInput, setMode, setIcon };
}
