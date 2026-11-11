// Firebase 연결: 로그인과 데이터 저장
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, query, orderBy, limit,
  getDocsFromServer, getDocFromServer, waitForPendingWrites,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAe0T0jxos_qQUg0qoXPKikukUhmd0Uj9E',
  authDomain: 'planbook-794e6.firebaseapp.com',
  projectId: 'planbook-794e6',
  storageBucket: 'planbook-794e6.firebasestorage.app',
  messagingSenderId: '630310913877',
  appId: '1:630310913877:web:ad6ac526c92dd40e1651dc',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'ko';

let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = initializeFirestore(app, {});
}

export const onUser = (cb) => onAuthStateChanged(auth, cb);
export const login = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export const signup = (email, pw) => createUserWithEmailAndPassword(auth, email, pw);
export const resetPw = (email) => sendPasswordResetEmail(auth, email);
export const logout = () => signOut(auth);

// 데이터 묶음: items(일정·할 일), notes(회의·메모), records(기록), routines(루틴), yb(이어북)
export const COLS = ['items', 'notes', 'records', 'routines', 'yb'];
const col = (uid, name) => collection(db, 'users', uid, name);
const settingsDoc = (uid) => doc(db, 'users', uid, 'meta', 'settings');

// onData(name, list), onSettings(obj|null)
export function watch(uid, onData, onSettings, onError) {
  const subs = COLS.map((name) => onSnapshot(col(uid, name), (snap) => onData(name, snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError));
  subs.push(onSnapshot(settingsDoc(uid), (snap) => onSettings(snap.exists() ? snap.data() : null), onError));
  return () => subs.forEach((u) => u());
}

export function saveDoc(uid, name, obj) {
  const { id, ...rest } = obj;
  return setDoc(doc(db, 'users', uid, name, id), { ...rest, updated: Date.now() });
}
export const deleteDocIn = (uid, name, id) => deleteDoc(doc(db, 'users', uid, name, id));
export const saveSettings = (uid, s) => setDoc(settingsDoc(uid), s);

// ---------- 동기화 ----------
// 올리지 못한 입력을 먼저 올리고, 서버에서 최신 내용을 다시 받아옴
export async function syncNow(uid) {
  await waitForPendingWrites(db);
  const out = {};
  for (const name of COLS) {
    const snap = await getDocsFromServer(col(uid, name));
    out[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const st = await getDocFromServer(settingsDoc(uid));
  out.settings = st.exists() ? st.data() : null;
  return out;
}

// ---------- 백업 ----------
// 백업 한 건 = 요약 문서(시각·사유·버전·건수) + 내용 조각(parts). 문서 크기 제한(1MB)을 넘지 않게 나눠 저장
const PART = 200000;
export async function backupNow(uid, data, reason, ver, counts) {
  const id = String(Date.now());
  const json = JSON.stringify(data);
  const n = Math.max(1, Math.ceil(json.length / PART));
  for (let k = 0; k < n; k++) {
    await setDoc(doc(db, 'users', uid, 'backups', id, 'parts', String(k)), { s: json.slice(k * PART, (k + 1) * PART) });
  }
  // 요약 문서는 조각을 다 쓴 뒤에 만듦 → 목록에 보이는 백업은 항상 완전한 백업
  await setDoc(doc(db, 'users', uid, 'backups', id), { at: Date.now(), reason, ver, counts: counts || null, parts: n, fmt: 2 });
  const snap = await getDocs(query(col(uid, 'backups'), orderBy('at', 'desc')));
  for (const d of snap.docs.slice(10)) {
    const parts = await getDocs(collection(db, 'users', uid, 'backups', d.id, 'parts'));
    const b = writeBatch(db);
    parts.docs.forEach((x) => b.delete(x.ref));
    b.delete(d.ref);
    await b.commit();
  }
  return id;
}
// 목록: 요약만. 옛 형식(내용이 문서 안에 그대로 있는 백업)도 그대로 보여줌
export async function listBackups(uid) {
  const snap = await getDocs(query(col(uid, 'backups'), orderBy('at', 'desc'), limit(10)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function loadBackup(uid, b) {
  if (b.fmt !== 2) { const { id, at, reason, ver, ...data } = b; return data; }
  let json = '';
  for (let k = 0; k < b.parts; k++) {
    const p = await getDocFromServer(doc(db, 'users', uid, 'backups', b.id, 'parts', String(k)));
    if (!p.exists()) throw new Error('백업 조각이 없어요');
    json += p.data().s;
  }
  return JSON.parse(json);
}

// ---------- 합치기 복원 ----------
// plan = { add: {col: [obj]}, yb: [{after, before}], settings: {after, before} }
// 지금 있는 것은 지우거나 바꾸지 않고, 파일에만 있는 것을 넣음
async function runOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((f) => f(b));
    await b.commit();
  }
}
const strip = (o) => { const { id, ...rest } = o; return rest; };
export async function applyMerge(uid, plan) {
  const ops = [];
  for (const name of COLS) (plan.add[name] || []).forEach((o) => ops.push((b) => b.set(doc(db, 'users', uid, name, o.id), strip(o))));
  (plan.yb || []).forEach(({ after }) => ops.push((b) => b.set(doc(db, 'users', uid, 'yb', after.id), strip(after))));
  if (plan.settings) ops.push((b) => b.set(settingsDoc(uid), plan.settings.after));
  await runOps(ops);
}
export async function undoMerge(uid, plan) {
  const ops = [];
  for (const name of COLS) (plan.add[name] || []).forEach((o) => ops.push((b) => b.delete(doc(db, 'users', uid, name, o.id))));
  (plan.yb || []).forEach(({ before }) => ops.push((b) => b.set(doc(db, 'users', uid, 'yb', before.id), strip(before))));
  if (plan.settings) ops.push((b) => b.set(settingsDoc(uid), plan.settings.before));
  await runOps(ops);
}
