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

const itemsCol = (uid) => collection(db, 'users', uid, 'items');
const settingsDoc = (uid) => doc(db, 'users', uid, 'meta', 'settings');
const backupsCol = (uid) => collection(db, 'users', uid, 'backups');

export function watch(uid, onItems, onSettings, onError) {
  const u1 = onSnapshot(itemsCol(uid), (snap) => onItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  const u2 = onSnapshot(settingsDoc(uid), (snap) => onSettings(snap.exists() ? snap.data() : null), onError);
  return () => { u1(); u2(); };
}

export function saveItem(uid, item) {
  const { id, ...rest } = item;
  return setDoc(doc(db, 'users', uid, 'items', id), { ...rest, updated: Date.now() });
}
export const deleteItem = (uid, id) => deleteDoc(doc(db, 'users', uid, 'items', id));
export const saveSettings = (uid, s) => setDoc(settingsDoc(uid), s);

// 백업: Firestore 안에 사본 저장 (최근 10개 유지)
export async function backupNow(uid, items, settings, reason, ver) {
  const id = String(Date.now());
  await setDoc(doc(db, 'users', uid, 'backups', id), { at: Date.now(), reason, ver, items, settings: settings || null });
  const snap = await getDocs(query(backupsCol(uid), orderBy('at', 'desc')));
  const old = snap.docs.slice(10);
  if (old.length) {
    const b = writeBatch(db);
    old.forEach((d) => b.delete(d.ref));
    await b.commit();
  }
}

export async function listBackups(uid) {
  const snap = await getDocs(query(backupsCol(uid), orderBy('at', 'desc'), limit(10)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// 복원: 지금 데이터를 모두 지우고 백업 내용으로 바꿈
export async function restoreAll(uid, currentItems, data) {
  const ops = [];
  currentItems.forEach((it) => ops.push((b) => b.delete(doc(db, 'users', uid, 'items', it.id))));
  (data.items || []).forEach((it) => {
    const { id, ...rest } = it;
    ops.push((b) => b.set(doc(db, 'users', uid, 'items', id), rest));
  });
  if (data.settings) ops.push((b) => b.set(settingsDoc(uid), data.settings));
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach((f) => f(b));
    await b.commit();
  }
}
