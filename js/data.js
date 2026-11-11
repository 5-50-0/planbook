// Firebase 연결: 로그인과 데이터 저장
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, query, orderBy, limit,
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

// 백업: Firestore 안에 사본 저장 (최근 10개 유지). data = {items, notes, ..., settings}
export async function backupNow(uid, data, reason, ver) {
  const id = String(Date.now());
  await setDoc(doc(db, 'users', uid, 'backups', id), { at: Date.now(), reason, ver, ...data });
  const snap = await getDocs(query(col(uid, 'backups'), orderBy('at', 'desc')));
  const old = snap.docs.slice(10);
  if (old.length) {
    const b = writeBatch(db);
    old.forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

export async function listBackups(uid) {
  const snap = await getDocs(query(col(uid, 'backups'), orderBy('at', 'desc'), limit(10)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 복원: 지금 데이터를 모두 지우고 백업 내용으로 바꿈
export async function restoreAll(uid, current, data) {
  const ops = [];
  for (const name of COLS) {
    if (!Array.isArray(data[name])) continue;
    (current[name] || []).forEach((it) => ops.push((b) => b.delete(doc(db, 'users', uid, name, it.id))));
    data[name].forEach((it) => {
      const { id, ...rest } = it;
      ops.push((b) => b.set(doc(db, 'users', uid, name, id), rest));
    });
  }
  if (data.settings) ops.push((b) => b.set(settingsDoc(uid), data.settings));
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((f) => f(b));
    await b.commit();
  }
}
