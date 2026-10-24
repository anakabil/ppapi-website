// Firebase-mode test of the v2 store/auth code WITHOUT a real project or network.
// Run from devtools/:  node flows/firebase-v2-stub.mjs
//
// config.js is served with a FAKE apiKey (→ PPAPI.auth.mode 'firebase') and an init script installs an
// in-memory stub of the compat SDK surface the site uses (firebase.initializeApp/apps/app, auth() with
// email sign-up/in/out + onAuthStateChanged, firestore() with collection/doc/get/set(merge)/update/delete/
// add/where/orderBy/limit/runTransaction, FieldValue.serverTimestamp). Every read and write is checked by
// a JavaScript MIRROR of site/firestore.rules (same functions, same whitelists, same transitions), with
// request.auth = the stub's current user and request.time = now. A denied operation throws
// {code:'permission-denied'} exactly like Firestore.
// What it proves: every Firestore call PPAPI.store makes (paths, field sets, transactions, queries) is
// allowed by the rules for the right role and refused for the wrong one. What it cannot prove: that
// Google's rules engine parses firestore.rules — publish it in the Firebase console (README) to confirm.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SB = {}; SB.window = SB; vm.createContext(SB); vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/data/berita.js'), 'utf8'), SB);
const PPAPI_BERITA = SB.PPAPI_DATA.berita.length;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const PAGE = `<!doctype html><html lang="id" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Uji Firebase v2 — PPAPI</title>
<link rel="stylesheet" href="assets/css/main.css"><script>document.documentElement.classList.replace('no-js','js')</script></head>
<body data-page="beranda" data-auth="public"><div id="site-header"></div><main id="main" tabindex="-1"><p>Uji</p></main><div id="site-footer"></div>
<script src="assets/js/config.js" defer></script><script src="assets/data/organisasi.js" defer></script><script src="assets/data/registry.js" defer></script><script src="assets/data/pustaka.js" defer></script><script src="assets/data/berita.js" defer></script>
<script src="assets/js/core.js" defer></script><script src="assets/js/auth.js" defer></script><script src="assets/js/store.js" defer></script></body></html>`;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__fb.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(PAGE); }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/assets/js/config.js') {
    body = body.toString('utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: 'AIzaSyFAKE-stub-key-000000000000000000'").replace(/projectId:\s*'[^']*'/, "projectId: 'ppapi-stub'");
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ------------------------------------------------------------------ the stub (runs in the page) */
/* Compat-SDK stub + JavaScript MIRROR of site/firestore.rules — keep it in step with the rules.
   Other flows (masuk-flow, admin-firebase, verifikasi-v2-flow, sec-v2-firebase-attacks) read this
   source text of the STUB function below (from its declaration to the test marker): keep both unchanged.
   Test handles: window.__fstub.{docs, log, console.set/get/del, verifyEmail(email), mails(email), db, uid}. */
const STUB = () => {
  const DAY = 86400000;
  const docs = new Map();       // 'coll/id' → data
  const log = [];               // [op, path, allowed, uid]
  const SERVER_TS = { __serverTimestamp: true };
  class Timestamp {
    constructor(ms) { this._ms = ms; }
    toDate() { return new Date(this._ms); }
    toMillis() { return this._ms; }
    toJSON() { return { seconds: Math.floor(this._ms / 1000), nanoseconds: (this._ms % 1000) * 1e6 }; }
  }
  const isTs = v => v instanceof Timestamp;
  const isMap = x => !!x && typeof x === 'object' && !Array.isArray(x) && x !== SERVER_TS && !isTs(x);
  function clone(v) {
    if (v === SERVER_TS) return v;
    if (isTs(v)) return new Timestamp(v._ms);
    if (Array.isArray(v)) return v.map(clone);
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => { if (v[k] !== undefined) o[k] = clone(v[k]); }); return o; }
    return v;
  }
  function resolve(v, now) {
    if (v === SERVER_TS) return new Timestamp(now);
    if (Array.isArray(v)) return v.map(x => resolve(x, now));
    if (v && typeof v === 'object' && !isTs(v)) { const o = {}; Object.keys(v).forEach(k => { o[k] = resolve(v[k], now); }); return o; }
    return v;
  }
  /* set(…, {merge:true}): nested maps merge */
  function deepMerge(base, patch) {
    const out = clone(base || {});
    Object.keys(patch).forEach(k => {
      const v = patch[k];
      if (isMap(v) && isMap(out[k])) out[k] = deepMerge(out[k], v);
      else out[k] = clone(v);
    });
    return out;
  }
  /* update(): a top-level key REPLACES the field; 'a.b.c' sets one nested field (maps created) */
  function applyUpdate(base, data) {
    const out = clone(base || {});
    Object.keys(data).forEach(k => {
      const parts = k.split('.');
      let o = out;
      for (let i = 0; i < parts.length - 1; i++) { if (!isMap(o[parts[i]])) o[parts[i]] = {}; o = o[parts[i]]; }
      o[parts[parts.length - 1]] = clone(data[k]);
    });
    return out;
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /* ---------------- auth stub ---------------- */
  const A = { user: null, accounts: {}, listeners: [], n: 0 };
  function account(u) { return u ? Object.values(A.accounts).find(a => a.uid === u.uid) || null : null; }
  function mkUser(acc) {
    return {
      uid: acc.uid, email: acc.email, emailVerified: !!acc.verified, displayName: acc.displayName || null, phoneNumber: null, photoURL: null,
      providerData: [{ providerId: 'password' }], metadata: { creationTime: new Date(acc.created).toUTCString() },
      updateProfile: async (p) => { acc.displayName = p.displayName; A.user = mkUser(acc); },
      sendEmailVerification: async (settings) => { acc.mails.push(settings || null); },
      reload: async () => { if (A.user && A.user.uid === acc.uid) A.user = mkUser(acc); },
      getIdToken: async (force) => { if (force) acc.tokenVerified = !!acc.verified; return 'stub-token-' + acc.uid; }
    };
  }
  function fire() { const u = A.user; A.listeners.slice().forEach(cb => setTimeout(() => cb(u), 0)); }
  function signInAs(acc) { acc.tokenVerified = !!acc.verified; A.user = mkUser(acc); fire(); return { user: A.user }; }
  const authObj = {
    languageCode: 'id',
    get currentUser() { return A.user; },
    onAuthStateChanged(cb) { A.listeners.push(cb); setTimeout(() => cb(A.user), 0); return () => {}; },
    setPersistence: async () => {},
    async createUserWithEmailAndPassword(email, pw) {
      if (A.accounts[email]) { const e = new Error('in use'); e.code = 'auth/email-already-in-use'; throw e; }
      const acc = A.accounts[email] = { uid: 'fb-' + (++A.n) + '-' + email.split('@')[0].replace(/\W/g, ''), email, pw, created: Date.now(), verified: false, tokenVerified: false, mails: [] };
      return signInAs(acc);
    },
    async signInWithEmailAndPassword(email, pw) {
      const acc = A.accounts[email];
      if (!acc || acc.pw !== pw) { const e = new Error('bad'); e.code = 'auth/invalid-credential'; throw e; }
      return signInAs(acc);
    },
    async signOut() { A.user = null; fire(); },
    sendPasswordResetEmail: async () => {}
  };
  function authFn() { return authObj; }
  authFn.Auth = { Persistence: { LOCAL: 'local', SESSION: 'session' } };
  authFn.GoogleAuthProvider = class { setCustomParameters() {} };
  authFn.RecaptchaVerifier = class { clear() {} };

  /* ---------------- rules mirror (site/firestore.rules) ---------------- */
  const uid = () => (A.user ? A.user.uid : null);
  const signedIn = () => !!uid();
  const isOwner = id => signedIn() && uid() === id;
  const isAdmin = () => signedIn() && docs.has('admins/' + uid());
  const isNow = v => v === SERVER_TS;                               // == request.time
  const optString = (d, k, max) => !(k in d) || d[k] == null || (typeof d[k] === 'string' && d[k].length <= max);
  const optStringOrTime = (d, k, max) => optString(d, k, max) || isNow(d[k]) || isTs(d[k]);
  const emptyOrMissing = (d, k) => !(k in d) || d[k] == null || d[k] === '';
  const isoDate = s => typeof s === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s);
  const dateTs = s => { const p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); };
  const hasOnly = (d, keys) => Object.keys(d).every(k => keys.includes(k));
  const get = (m, k, dflt) => (isMap(m) && k in m ? m[k] : dflt);
  const tokenEmailVerified = () => { const acc = account(A.user); return !!(acc && acc.tokenVerified); };
  const verifiedEmail = email => signedIn() && !!A.user.email && tokenEmailVerified() && email === A.user.email;
  const jpegDataUrl = s => typeof s === 'string' && s.length <= 164000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s);
  const validityOk = (m, now) => !('validUntil' in m) || m.validUntil == null || m.validUntil === '' || (isoDate(m.validUntil) && dateTs(m.validUntil) + DAY > now);
  const isActiveMember = now => { const m = docs.get('members/' + uid()); return signedIn() && !!m && m.status === 'Aktif' && validityOk(m, now); };
  function validProfile(p) {
    return isMap(p) && hasOnly(p, ['birthPlace', 'birthDate', 'gender', 'city', 'province', 'address', 'company', 'position', 'experienceYears', 'education', 'bio', 'linkedin'])
      && ['birthPlace', 'birthDate', 'gender', 'city', 'province', 'company', 'position', 'education', 'linkedin'].every(k => optString(p, k, 300)) && optString(p, 'address', 2000) && optString(p, 'bio', 2000)
      && (!('experienceYears' in p) || p.experienceYears == null || (Number.isInteger(p.experienceYears) && p.experienceYears >= 0 && p.experienceYears <= 80));
  }
  function validApplication(a) {
    return isMap(a) && hasOnly(a, ['type', 'kategori', 'submittedAt', 'updatedAt', 'pengalaman', 'dokumen', 'pasFoto', 'pasFotoAda', 'pembayaran', 'pernyataan', 'catatan'])
      && (!('type' in a) || ['baru', 'perpanjangan'].includes(a.type))
      && (!('kategori' in a) || ['', 'Praktisi', 'Ahli', 'Kehormatan'].includes(a.kategori))
      && optStringOrTime(a, 'submittedAt', 40) && optStringOrTime(a, 'updatedAt', 40)
      && (!('pengalaman' in a) || (Array.isArray(a.pengalaman) && a.pengalaman.length <= 10))
      && (!('dokumen' in a) || (Array.isArray(a.dokumen) && a.dokumen.length <= 12))
      && (!('pasFoto' in a) || a.pasFoto == null || a.pasFoto === '' || jpegDataUrl(a.pasFoto))
      && (!('pasFotoAda' in a) || typeof a.pasFotoAda === 'boolean')
      && (!('pembayaran' in a) || (isMap(a.pembayaran) && hasOnly(a.pembayaran, ['metode', 'tanggal', 'buktiUrl']) && optString(a.pembayaran, 'metode', 60) && optString(a.pembayaran, 'tanggal', 10) && optString(a.pembayaran, 'buktiUrl', 1000)))
      && (!('pernyataan' in a) || (isMap(a.pernyataan) && hasOnly(a.pernyataan, ['kodeEtik', 'kebenaranData', 'privasi', 'namaTerang', 'tanggal'])
          && ['kodeEtik', 'kebenaranData', 'privasi'].every(k => !(k in a.pernyataan) || typeof a.pernyataan[k] === 'boolean')
          && optString(a.pernyataan, 'namaTerang', 120) && optString(a.pernyataan, 'tanggal', 10)))
      && optString(a, 'catatan', 1000);
  }
  function validMember(d, id) {
    return hasOnly(d, ['uid', 'name', 'email', 'phone', 'photoURL', 'kta', 'memberType', 'status', 'joinedAt', 'validUntil', 'approvedAt', 'approvedBy', 'profile', 'competencies', 'certificates', 'application', 'review', 'contoh', 'createdAt', 'updatedAt'])
      && d.uid === id && (!('kta' in d) || (typeof d.kta === 'string' && d.kta.length <= 40))
      && ['Praktisi', 'Ahli', 'Kehormatan'].includes(d.memberType)
      && ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Aktif', 'Ditolak', 'Nonaktif'].includes(d.status)
      && optString(d, 'name', 120) && optString(d, 'email', 200) && optString(d, 'phone', 24) && optString(d, 'photoURL', 1000)
      && optString(d, 'joinedAt', 32) && optString(d, 'validUntil', 10) && optString(d, 'approvedAt', 40) && optString(d, 'approvedBy', 128)
      && optStringOrTime(d, 'createdAt', 40) && optStringOrTime(d, 'updatedAt', 40)
      && (!('profile' in d) || validProfile(d.profile))
      && (!('competencies' in d) || (Array.isArray(d.competencies) && d.competencies.length <= 50))
      && (!('certificates' in d) || (Array.isArray(d.certificates) && d.certificates.length <= 50))
      && (!('application' in d) || validApplication(d.application))
      && (!('review' in d) || (d.review && typeof d.review === 'object'))
      && (!('contoh' in d) || typeof d.contoh === 'boolean');
  }
  const contactMatches = d => (!('email' in d) || d.email == null || d.email === '' || verifiedEmail(d.email)) && (!('phone' in d) || d.phone == null || d.phone === '');
  const submitted = d => 'application' in d && isMap(d.application) && 'submittedAt' in d.application
    && (isTs(d.application.submittedAt) || isNow(d.application.submittedAt) || (typeof d.application.submittedAt === 'string' && d.application.submittedAt.length > 0));
  const renewable = (m, now) => m.status === 'Nonaktif' || (m.status === 'Aktif' && 'validUntil' in m && isoDate(m.validUntil) && dateTs(m.validUntil) <= now + 61 * DAY);
  function completeSubmission(b, a) {
    const app = a.application, p = get(app, 'pernyataan', {}), kat = get(app, 'kategori', '');
    return (['Praktisi', 'Ahli'].includes(kat) || (kat !== '' && kat === get(b, 'memberType', '') && get(b, 'approvedAt', '') !== ''))
      && typeof get(a, 'name', '') === 'string' && get(a, 'name', '').length >= 3
      && get(p, 'kodeEtik', false) === true && get(p, 'kebenaranData', false) === true && get(p, 'privasi', false) === true
      && typeof get(p, 'namaTerang', '') === 'string' && get(p, 'namaTerang', '').length >= 3;
  }
  const ownerTransition = (b, a, now) => (['Draf', 'Perlu Perbaikan', 'Ditolak'].includes(b.status) && a.status === 'Menunggu Verifikasi' && submitted(a) && completeSubmission(b, a))
    || (renewable(b, now) && a.status === 'Menunggu Verifikasi' && submitted(a) && a.application.type === 'perpanjangan' && completeSubmission(b, a))
    || (b.status === 'Menunggu Verifikasi' && a.status === 'Draf' && !submitted(a));
  const applicationEditable = (b, a, now) => ['Draf', 'Perlu Perbaikan', 'Ditolak'].includes(b.status) || renewable(b, now) || (b.status === 'Menunggu Verifikasi' && (a.status === 'Draf' || !submitted(b)));
  const affected = (a, b) => [...new Set(Object.keys(a).concat(Object.keys(b)))].filter(k => !same(a[k], b[k]));
  const ownEmailOk = (after, before) => !affected(after, before).includes('email') || !('email' in after) || after.email == null || after.email === '' || verifiedEmail(after.email);
  const reviewedDataKept = (after, before) => before.status !== 'Menunggu Verifikasi' || !submitted(before) || after.status === 'Draf'
    || !affected(after, before).some(k => ['name', 'phone', 'photoURL', 'profile', 'competencies', 'certificates'].includes(k));
  /* firestore.rules identityKept: the reviewed name stays once the membership was approved (an empty name may be filled) */
  const identityKept = (after, before) => get(before, 'approvedAt', '') === '' || get(before, 'approvedAt', '') == null
    || typeof get(before, 'name', '') !== 'string' || get(before, 'name', '').length < 3 || get(after, 'name', '') === get(before, 'name', '');
  /* firestore.rules kategoriAllowed: Praktisi / Ahli, or the member's own kategori, or unchanged */
  const kategoriAllowed = (after, before) => { const k = get(get(after, 'application', {}), 'kategori', '');
    return ['', 'Praktisi', 'Ahli'].includes(k) || k === get(before, 'memberType', '') || k === get(get(before, 'application', {}), 'kategori', ''); };
  function ownerTimesOk(after, before) {
    const ch = affected(after, before), a = get(after, 'application', {}), b = get(before, 'application', {});
    return (!ch.includes('updatedAt') || isNow(after.updatedAt))
      && (!ch.includes('application')
          || ((same(get(a, 'updatedAt', ''), get(b, 'updatedAt', '')) || isNow(get(a, 'updatedAt', '')))
              && (same(get(a, 'submittedAt', ''), get(b, 'submittedAt', '')) || get(a, 'submittedAt', '') === '' || isNow(get(a, 'submittedAt', '')))));
  }
  function ownerUpdate(after, before, id, now) {
    const ch = affected(after, before);
    return validMember(after, id) && ch.every(k => ['name', 'email', 'phone', 'photoURL', 'profile', 'competencies', 'certificates', 'application', 'status', 'updatedAt'].includes(k))
      && ownEmailOk(after, before)
      && reviewedDataKept(after, before)
      && identityKept(after, before)
      && kategoriAllowed(after, before)
      && ownerTimesOk(after, before)
      && (!ch.includes('status') || ownerTransition(before, after, now))
      && (!ch.includes('application') || applicationEditable(before, after, now));
  }
  function photoEditable(id, now) {
    const m = docs.get('members/' + id);
    return !!m && (['Draf', 'Perlu Perbaikan', 'Ditolak'].includes(m.status) || renewable(m, now) || (m.status === 'Menunggu Verifikasi' && !submitted(m)));
  }
  function validFeedback(d) {
    return hasOnly(d, ['kategori', 'nama', 'email', 'phone', 'subjek', 'pesan', 'rating', 'anonim', 'uid', 'halaman', 'createdAt'])
      && ['Kritik', 'Saran', 'Pertanyaan', 'Pengaduan', 'Apresiasi'].includes(d.kategori) && typeof d.pesan === 'string' && d.pesan.length >= 10 && d.pesan.length <= 4000
      && optString(d, 'nama', 120) && optString(d, 'email', 200) && optString(d, 'phone', 24) && optString(d, 'subjek', 200) && optString(d, 'halaman', 200)
      && (!('rating' in d) || d.rating == null || (Number.isInteger(d.rating) && d.rating >= 1 && d.rating <= 5))
      && (!('anonim' in d) || typeof d.anonim === 'boolean') && (!('uid' in d) || d.uid == null || (signedIn() && d.uid === uid()))
      && d.createdAt === SERVER_TS;
  }
  const CONTENT = ['content_berita', 'content_pengumuman', 'content_agenda', 'content_pustaka', 'content_regulasi'];
  /* for 'list', `after` carries the query: { limit } */
  function allowed(op, coll, id, before, after, now) {
    switch (coll) {
      case 'members':
        if (op === 'get') return isOwner(id) || isAdmin();
        if (op === 'list') return isAdmin();
        if (op === 'create') return (isOwner(id) && validMember(after, id) && contactMatches(after) && after.status === 'Draf' && after.memberType === 'Praktisi'
            && emptyOrMissing(after, 'kta') && emptyOrMissing(after, 'validUntil') && emptyOrMissing(after, 'approvedAt') && emptyOrMissing(after, 'approvedBy') && !('contoh' in after)
            && (!('review' in after) || (hasOnly(after.review, ['note', 'history']) && (!('note' in after.review) || after.review.note === '') && (!('history' in after.review) || (Array.isArray(after.review.history) && after.review.history.length === 0))))
            && !submitted(after) && ['', 'Praktisi', 'Ahli'].includes(get(get(after, 'application', {}), 'kategori', '')) && isoDate(after.joinedAt)) || (isAdmin() && validMember(after, id));
        if (op === 'update') return (isOwner(id) && ownerUpdate(after, before, id, now)) || (isAdmin() && validMember(after, id));
        return false;
      case 'member_photos':
        if (op === 'get') return isOwner(id) || isAdmin();
        if (op === 'list') return false;
        if (op === 'create' || op === 'update') return ((isOwner(id) && photoEditable(id, now)) || isAdmin()) && hasOnly(after, ['uid', 'data', 'updatedAt']) && after.uid === id && jpegDataUrl(after.data) && isNow(after.updatedAt);
        return op === 'delete' && ((isOwner(id) && photoEditable(id, now)) || isAdmin());
      case 'admins':
        if (op === 'get') return isOwner(id) || isAdmin();
        if (op === 'list') return isAdmin();
        if (op === 'create' || op === 'update') return isAdmin() && hasOnly(after, ['uid', 'name', 'email', 'addedAt', 'addedBy']) && after.uid === id && after.addedBy === uid();
        return op === 'delete' && isAdmin();
      case 'registry':
        if (op === 'get') return true;
        if (op === 'list') return !!after && after.limit != null && after.limit <= 20;
        if (op === 'create' || op === 'update') return isAdmin() && hasOnly(after, ['kta', 'nama', 'kategori', 'kompetensi', 'kota', 'berlakuHingga', 'status', 'namaCari', 'namaKata', 'ktaNomor', 'updatedAt', 'contoh']) && after.kta === id;
        return op === 'delete' && isAdmin();
      case 'pustaka_files':
        if (op === 'get' || op === 'list') return isAdmin() || isActiveMember(now);
        if (op === 'create' || op === 'update') return isAdmin() && hasOnly(after, ['url', 'updatedAt', 'updatedBy']) && typeof after.url === 'string' && after.url.length <= 1000;
        return op === 'delete' && isAdmin();
      case 'feedback':
        if (op === 'create') return validFeedback(after);
        if (op === 'get' || op === 'list') return isAdmin();
        if (op === 'update') return isAdmin() && affected(after, before).every(k => ['status', 'catatanAdmin', 'updatedAt', 'updatedBy'].includes(k)) && (!('status' in after) || ['Baru', 'Diproses', 'Selesai'].includes(after.status)) && optString(after, 'catatanAdmin', 2000) && after.updatedBy === uid();
        return false;
      case 'counters':
        if (op === 'get' || op === 'list') return isAdmin();
        return (op === 'create' || op === 'update') ? isAdmin() && hasOnly(after, ['value', 'updatedAt']) && Number.isInteger(after.value) && after.value >= 0 : op === 'delete' && isAdmin();
      case 'audit_log':
        if (op === 'get' || op === 'list') return isAdmin();
        if (op === 'create') return isAdmin() && hasOnly(after, ['at', 'by', 'byName', 'action', 'label', 'targetType', 'targetId', 'targetName', 'note']) && after.by === uid();
        return false;
      default:
        if (CONTENT.includes(coll)) return (op === 'get' || op === 'list') ? true : isAdmin();
        return false;
    }
  }
  function denied(op, p) { const e = new Error('Missing or insufficient permissions (' + op + ' ' + p + ')'); e.code = 'permission-denied'; return e; }
  function guard(op, p, before, after) {
    const [coll, id] = p.split('/');
    const ok = allowed(op, coll, id, before, after, Date.now());
    log.push([op, p, ok, uid()]);
    if (!ok) throw denied(op, p);
  }

  /* ---------------- firestore stub ---------------- */
  let auto = 0;
  function snap(p) { const d = docs.get(p); return { id: p.split('/')[1], exists: d !== undefined, ref: docRef(p), data: () => (d === undefined ? undefined : clone(d)) }; }
  function writeDoc(p, kind, data, opts) {
    const before = docs.get(p);
    let after;
    if (kind === 'set') after = opts && opts.merge ? deepMerge(before || {}, data) : clone(data);
    else if (kind === 'update') { if (before === undefined) { const e = new Error('No document to update: ' + p); e.code = 'not-found'; throw e; } after = applyUpdate(before, data); }
    const op = kind === 'delete' ? 'delete' : (before === undefined ? 'create' : 'update');
    guard(op, p, before ? clone(before) : null, after);
    if (kind === 'delete') docs.delete(p); else docs.set(p, resolve(after, Date.now()));
  }
  function docRef(p) {
    return {
      id: p.split('/')[1], path: p,
      get: async () => { guard('get', p, docs.get(p) || null, null); return snap(p); },
      set: async (data, opts) => writeDoc(p, 'set', data, opts),
      update: async (data) => writeDoc(p, 'update', data),
      delete: async () => writeDoc(p, 'delete')
    };
  }
  const cmpVal = x => (isTs(x) ? x._ms : x);
  function query(coll, filters, order, lim) {
    return {
      where: (f, op, v) => query(coll, filters.concat([[f, op, v]]), order, lim),
      orderBy: (f, dir) => query(coll, filters, [f, dir || 'asc'], lim),
      limit: n => query(coll, filters, order, n),
      get: async () => {
        guard('list', coll + '/*', null, { limit: lim == null ? null : lim });
        let list = [...docs.keys()].filter(k => k.split('/')[0] === coll).map(k => snap(k));
        let rangeField = null;
        filters.forEach(([f, op, v]) => {
          const val = s => cmpVal((s.data() || {})[f]);
          if (op === '==') list = list.filter(s => same(val(s), v));
          else if (op === '>=') { rangeField = f; list = list.filter(s => typeof val(s) === typeof v && val(s) >= v); }
          else if (op === '<=') { rangeField = f; list = list.filter(s => typeof val(s) === typeof v && val(s) <= v); }
          else if (op === 'array-contains') list = list.filter(s => Array.isArray((s.data() || {})[f]) && (s.data() || {})[f].some(x => same(x, v)));
          else throw new Error('stub: unsupported operator ' + op);
        });
        const ord = order || (rangeField ? [rangeField, 'asc'] : null);
        if (ord) {
          const val = s => cmpVal((s.data() || {})[ord[0]]);
          list.sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * (ord[1] === 'desc' ? -1 : 1));
        }
        if (lim) list = list.slice(0, lim);
        return { docs: list, size: list.length, empty: !list.length, forEach: cb => list.forEach(cb) };
      }
    };
  }
  const db = {
    settings() {},
    collection(name) {
      const q = query(name, [], null, null);
      return Object.assign(q, {
        doc: id => docRef(name + '/' + (id || ('auto' + (++auto)))),
        add: async (data) => { const r = docRef(name + '/auto' + (++auto)); await r.set(data); return r; }
      });
    },
    async runTransaction(fn) {
      const snapshot = new Map([...docs].map(([k, v]) => [k, clone(v)]));
      const writes = [];
      const t = {
        get: async (ref) => { guard('get', ref.path, docs.get(ref.path) || null, null); return snap(ref.path); },
        set: (ref, data, opts) => { writes.push([ref.path, 'set', data, opts]); return t; },
        update: (ref, data) => { writes.push([ref.path, 'update', data]); return t; },
        delete: (ref) => { writes.push([ref.path, 'delete']); return t; }
      };
      const result = await fn(t);
      try { writes.forEach(w => writeDoc(w[0], w[1], w[2], w[3])); }
      catch (e) { docs.clear(); snapshot.forEach((v, k) => docs.set(k, v)); throw e; }
      window.__fstub.transactions++;
      return result;
    }
  };
  function firestoreFn() { return db; }
  firestoreFn.FieldValue = { serverTimestamp: () => SERVER_TS };
  firestoreFn.Timestamp = Timestamp;

  const apps = [];
  window.firebase = {
    SDK_VERSION: 'stub',
    apps,
    initializeApp(cfg) { const app = { name: '[DEFAULT]', options: cfg }; apps.push(app); return app; },
    app() { return apps[0]; },
    auth: authFn,
    firestore: firestoreFn
  };
  window.__fstub = {
    docs, log, transactions: 0,
    console: { set: (p, d) => docs.set(p, clone(d)), get: p => clone(docs.get(p)), del: p => docs.delete(p) },   // "Firebase console": bypasses rules
    /* the owner opens the verification link (the ID token learns it at the next sign-in / getIdToken(true)) */
    verifyEmail: email => { const acc = A.accounts[email]; if (acc) acc.verified = true; return !!acc; },
    mails: email => (A.accounts[email] ? A.accounts[email].mails.length : 0),
    db, uid
  };
};

/* ------------------------------------------------------------------ test */
let passed = 0;
const failures = [];
const ok = (c, m, x) => { if (c) { passed++; console.log('  ✓ ' + m); } else { failures.push(m + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); console.log('  ✗ ' + m + (x !== undefined ? '\n      ' + JSON.stringify(x) : '')); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m, JSON.stringify(a) === JSON.stringify(b) ? undefined : { got: a, want: b });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(new Date('2026-10-09T10:00:00+07:00'));
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/__fb.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());

  const R = await page.evaluate(async () => {
    const S = PPAPI.store, AU = PPAPI.auth, F = window.__fstub, out = {};
    const err = async p => { try { await p; return 'NO ERROR'; } catch (e) { return e.code || e.message; } };
    const tick = () => new Promise(r => setTimeout(r, 30));
    /* deliberate refusals: log ranges excluded from the "unexpected denial" check at the end */
    const skip = [];
    const deliberate = async fn => { const a0 = F.log.length; try { return await fn(); } finally { skip.push([a0, F.log.length]); } };
    const JPEG = 'data:image/jpeg;base64,' + 'A'.repeat(400);
    out.mode = [AU.mode, S.mode, AU.demoAdmin];
    // ---- member A: sign up → ensureMember (create rule) ----
    const a = await AU.signUpEmail({ name: 'Ani Firebase', email: 'ani@contoh.id', password: 'Perancah2026' });
    await tick();
    const docA = F.console.get('members/' + a.uid);
    out.create = [docA.status, docA.kta, docA.memberType, Object.keys(docA).sort().join(), F.log.filter(l => l[1] === 'members/' + a.uid && l[0] === 'create').map(l => l[2])];
    out.isAdminA = await AU.isAdmin();
    out.sessA = PPAPI.session.current().status;
    out.verifyMail = [docA.email, F.mails('ani@contoh.id'), AU.current().emailVerified];
    // ---- profile + application (owner update rule) ----
    await S.saveMember(a.uid, { phone: '0812-3333-4444', profile: { birthDate: '1992-03-04', province: 'Banten', city: 'Tangerang', company: 'PT Firebase Uji', position: 'Supervisor', experienceYears: 8 } });
    await S.saveApplication(a.uid, { kategori: 'Praktisi', pengalaman: [{ proyek: 'Gudang', peran: 'Supervisor', tahun: '2025', lokasi: 'Tangerang' }], pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Ani Firebase' } });
    // ---- pas foto → member_photos/{uid}; the member record keeps only the flag ----
    out.photoPng = await err(S.saveApplication(a.uid, { pasFoto: 'data:image/png;base64,AAAA' }));
    const withPhoto = await S.saveApplication(a.uid, { pasFoto: JPEG });
    const rawA = F.console.get('members/' + a.uid);
    out.photo = [withPhoto.application.pasFoto === JPEG, rawA.application.pasFoto, rawA.application.pasFotoAda, (F.console.get('member_photos/' + a.uid) || {}).data === JPEG,
      (await S.getMember(a.uid)).application.pasFoto === JPEG, (await S.getMember(a.uid, { pasFoto: false })).application.pasFoto, PPAPI.session.current().member.application.pasFoto];
    const sub = await S.submitApplication(a.uid);
    const rawSub = F.console.get('members/' + a.uid);
    out.submit = [sub.status, !!sub.application.submittedAt, ((rawSub.review || {}).history || []).length];
    out.serverTimes = [typeof rawSub.application.submittedAt.toDate, typeof rawSub.application.updatedAt.toDate, typeof rawSub.updatedAt.toDate, /^\d{4}-\d{2}-\d{2}T/.test(sub.application.submittedAt)];
    out.lockedA = await err(S.saveApplication(a.uid, { catatan: 'x' }));
    out.lockedProfile = [await err(S.saveMember(a.uid, { profile: { company: 'Perusahaan Lain' } })), await err(S.saveMember(a.uid, { name: 'Nama Diganti' })), await err(S.saveApplication(a.uid, { pasFoto: '' }))];
    out.lockedPhotoRaw = await deliberate(async () => [await err(F.db.collection('member_photos').doc(a.uid).set({ uid: a.uid, data: JPEG, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() })), await err(F.db.collection('member_photos').doc(a.uid).delete())]);
    out.wd = (await S.withdrawApplication(a.uid)).status;
    out.resub = (await S.submitApplication(a.uid)).status;
    // ---- malicious owner writes are refused by the rules mirror ----
    const ref = F.db.collection('members').doc(a.uid);
    out.evil = {
      kta: await err(ref.update({ kta: 'PPAPI-2026-999999' })),
      status: await err(ref.update({ status: 'Aktif' })),
      validUntil: await err(ref.update({ validUntil: '2099-12-31' })),
      review: await err(ref.update({ review: { note: 'Disetujui sendiri', history: [{ action: 'disetujui' }] } })),
      appWhilePending: await err(ref.update({ 'application': Object.assign({}, F.console.get('members/' + a.uid).application, { catatan: 'diam-diam' }) })),
      readOther: await err(F.db.collection('members').doc('orang-lain').get()),
      listMembers: await err(F.db.collection('members').get()),
      registry: await err(F.db.collection('registry').doc('PPAPI-2026-777777').set({ kta: 'PPAPI-2026-777777', nama: 'Palsu' })),
      selfAdmin: await err(F.db.collection('admins').doc(a.uid).set({ uid: a.uid, addedBy: a.uid })),
      content: await err(F.db.collection('content_berita').doc('x').set({ judul: 'x' })),
      counters: await err(F.db.collection('counters').doc('kta-2026').get()),
      audit: await err(F.db.collection('audit_log').add({ at: 'x', by: a.uid })),
      feedbackRead: await err(F.db.collection('feedback').get()),
      emailOther: await err(ref.update({ email: 'ketua.sekretariat@contoh.id' })),
      nameWhilePending: await err(ref.update({ name: 'Nama Saat Diverifikasi', updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() })),
      forgedUpdatedAt: await err(ref.update({ updatedAt: '0000-01-01T00:00:00Z' })),
      otherPhoto: await err(F.db.collection('member_photos').doc('orang-lain').get())
    };
    /* unverified account email: refused by the rules until the owner opens the verification link */
    out.emailOwn = [await err(ref.update({ email: '' })), await deliberate(() => err(ref.update({ email: 'ani@contoh.id' })))];
    F.verifyEmail('ani@contoh.id');
    await AU.refreshUser();
    await tick();
    out.emailVerified = [AU.current().emailVerified, F.console.get('members/' + a.uid).email, await err(ref.update({ email: 'ani@contoh.id' }))];
    out.emailStore = (await S.saveMember(a.uid, { email: 'ketua.sekretariat@contoh.id' })).email;
    out.adminApiA = await err(S.admin.listMembers());
    // ---- member C (legacy v1 doc) → migrated to Draf on sign-in ----
    await AU.signOut();
    const c = await AU.signUpEmail({ name: 'Citra Lama', email: 'citra@contoh.id', password: 'Perancah2026' });
    await tick();   /* let the session read for the new account finish before the next switch (real users do not switch within ms) */
    F.console.set('members/' + c.uid, { uid: c.uid, name: 'Citra Lama', email: 'citra@contoh.id', phone: '', photoURL: '', kta: 'PPAPI-2026-123456', memberType: 'Praktisi', status: 'Menunggu Verifikasi', joinedAt: '2026-09-01', profile: {}, competencies: [], certificates: [], createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' });
    await AU.signOut();
    await AU.signInEmail({ email: 'citra@contoh.id', password: 'Perancah2026' });
    await tick();
    out.legacy = [F.console.get('members/' + c.uid).status, (await S.getMember(c.uid)).status];
    // ---- admin B: first admin created "in the Firebase console" ----
    await AU.signOut();
    const b = await AU.signUpEmail({ name: 'Budi Admin', email: 'budi.admin@contoh.id', password: 'Perancah2026' });
    F.console.set('admins/' + b.uid, { uid: b.uid, name: 'Budi Admin', email: 'budi.admin@contoh.id', addedAt: '2026-10-09T00:00:00Z', addedBy: 'console' });
    PPAPI.session.refresh && await PPAPI.session.refresh();
    out.isAdminB = [await AU.isAdmin(), PPAPI.session.current().isAdmin, PPAPI.session.current().isActive];
    const list = await S.admin.listMembers();
    out.list = list.map(m => m.status);
    out.listPhoto = [list.filter(m => m.uid === a.uid)[0].application.pasFoto === JPEG, (await S.admin.listMembers({ pasFoto: false })).filter(m => m.uid === a.uid).map(m => [m.application.pasFoto, m.application.pasFotoAda])[0],
      (await S.admin.getMember(a.uid)).application.pasFoto === JPEG, (await S.pasFoto(a.uid)) === JPEG, (await S.admin.summary()).menunggu];
    F.console.set('registry/PPAPI-2026-000002', { kta: 'PPAPI-2026-000002', nama: 'Sudah ada', kategori: 'Praktisi', kompetensi: [], kota: '', berlakuHingga: '2029-12-31', status: 'Aktif' });
    const t0 = F.transactions;
    const ap = await S.admin.approve(a.uid, { note: 'OK' });
    out.approve = [ap.status, ap.kta, ap.validUntil, F.console.get('counters/kta-2026'), Object.keys(F.console.get('registry/' + ap.kta)).sort().join(), F.transactions - t0];
    // a second applicant skips the existing registry number 000002
    await AU.signOut();
    const d = await AU.signUpEmail({ name: 'Dodi Kedua', email: 'dodi@contoh.id', password: 'Perancah2026' });
    await S.saveMember(d.uid, { phone: '0812-5555-6666', profile: { birthDate: '1990-01-01', province: 'Bali', city: 'Denpasar', company: 'CV Dua', position: 'Teknisi', experienceYears: 3 } });
    await S.saveApplication(d.uid, { kategori: 'Ahli', pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Dodi Kedua' } });
    await S.submitApplication(d.uid);
    await AU.signOut();
    await AU.signInEmail({ email: 'budi.admin@contoh.id', password: 'Perancah2026' });
    await tick();
    const ap2 = await S.admin.approve(d.uid, {});
    out.approve2 = [ap2.kta, ap2.memberType, F.console.get('counters/kta-2026').value];
    out.revision = await err(S.admin.requestRevision(d.uid, 'catatan'));
    const dd = await S.admin.deactivate(d.uid, 'Uji');
    out.deact = [dd.status, F.console.get('registry/' + dd.kta).status];
    const rr = await S.admin.reactivate(d.uid, { validUntil: '2030-12-31' });
    out.react = [rr.status, rr.validUntil, F.console.get('registry/' + rr.kta).berlakuHingga];
    out.extend = (await S.admin.extend(d.uid, '2031-01-31')).validUntil;
    out.type = [(await S.admin.setMemberType(d.uid, 'Kehormatan')).memberType, F.console.get('registry/' + ap2.kta).kategori];
    // ---- content + pustaka files ----
    const pk = await S.content.save('pustaka', { judul: 'Modul Firebase', ringkasan: 'Uji.', kategori: 'Modul Pelatihan', akses: 'anggota', tautan: 'https://drive.example.com/modul.pdf' });
    out.pustaka = [F.console.get('content_pustaka/' + pk.id).tautan, F.console.get('pustaka_files/' + pk.id).url, pk.berkasAnggota];
    await S.content.save('berita', { judul: 'Berita Firebase', ringkasan: 'Ringkas.', tanggal: '2026-10-09' });
    await S.content.remove('berita', PPAPI.data.berita[0].id);
    out.berita = [(await S.content.list('berita')).length, (await S.content.list('berita')).some(x => x.id === PPAPI.data.berita[0].id)];
    out.fileAdmin = await S.pustaka.fileUrl(pk);
    // ---- feedback: public create (serverTimestamp) → admin list/update ----
    await AU.signOut();
    const fb = await S.submitFeedback({ kategori: 'Pertanyaan', pesan: 'Bagaimana cara memperpanjang keanggotaan?', nama: 'Tamu' });
    out.pustakaOut = await err(S.pustaka.fileUrl(pk));
    out.lookupOut = (await S.registry.lookup(ap.kta)).exact && (await S.registry.lookup(ap.kta)).exact.nama;
    out.lookupName = (await S.registry.lookup('dodi')).matches.map(m => m.kta);
    out.samplesHidden = (await S.registry.lookup('PPAPI-2026-000123')).exact;
    out.lookupBounded = [(await S.registry.lookup('kedua')).matches.map(m => m.kta), (await S.registry.lookup('000003')).matches.map(m => m.kta), (await S.registry.lookup('PPAPI-2026')).matches.map(m => m.kta), (await S.registry.lookup('2026 0000')).matches.map(m => m.kta)];
    out.registryList = await deliberate(async () => [await err(F.db.collection('registry').get()), await err(F.db.collection('registry').limit(21).get()), await err(F.db.collection('registry').limit(20).get()), await err(F.db.collection('registry').doc(ap.kta).get())]);
    await AU.signInEmail({ email: 'budi.admin@contoh.id', password: 'Perancah2026' });
    await tick();
    const fl = await S.admin.listFeedback();
    out.feedback = [fl.length, fl[0].status, typeof fl[0].createdAt];
    out.feedbackUp = (await S.admin.updateFeedback(fb.id, { status: 'Selesai', catatanAdmin: 'Dijawab.' })).status;
    out.feedbackEvil = await err(F.db.collection('feedback').doc(fb.id).update({ pesan: 'diubah admin' }));
    out.feedbackForged = await err(F.db.collection('feedback').doc(fb.id).update({ status: 'Diproses', updatedBy: 'orang-lain', updatedAt: 'x' }));
    // ---- admins ----
    out.addAdmin = (await S.admin.addAdmin('ANI@contoh.id')).uid === a.uid;
    out.admins = (await S.admin.listAdmins()).length;
    out.rmAdmin = await S.admin.removeAdmin(a.uid);
    out.lastAdmin = await err(S.admin.removeAdmin(b.uid));
    out.audit = (await S.admin.audit(50)).map(x => x.action);
    out.summary = await S.admin.summary();
    // ---- active member A reads the member-only file; expired → perpanjangan ----
    await AU.signOut();
    await AU.signInEmail({ email: 'ani@contoh.id', password: 'Perancah2026' });
    await tick();
    out.sessActive = [PPAPI.session.current().status, PPAPI.session.current().isActive];
    out.fileActive = await S.pustaka.fileUrl(pk);
    const docA2 = F.console.get('members/' + a.uid); docA2.validUntil = '2026-07-31'; F.console.set('members/' + a.uid, docA2);
    await PPAPI.session.refresh();
    out.expired = [PPAPI.session.current().status, await err(S.pustaka.fileUrl(pk)), await err(F.db.collection('pustaka_files').doc(pk.id).get())];
    const ren = await S.submitApplication(a.uid);
    out.renew = [ren.status, ren.application.type, ren.kta];
    // ---- early renewal of D (Aktif, 52 days left) returned/rejected → membership kept ----
    await AU.signOut();
    const docD = F.console.get('members/' + d.uid); docD.validUntil = '2026-11-30'; F.console.set('members/' + d.uid, docD);
    await AU.signInEmail({ email: 'dodi@contoh.id', password: 'Perancah2026' });
    await tick();
    const renD = await S.submitApplication(d.uid);
    await AU.signOut();
    await AU.signInEmail({ email: 'budi.admin@contoh.id', password: 'Perancah2026' });
    await tick();
    const revD = await S.admin.requestRevision(d.uid, 'Lengkapi sertifikat terbaru.');
    const rejA = await S.admin.reject(a.uid, 'Data perpanjangan belum sesuai.');
    out.earlyRenewal = [renD.status, revD.status, revD.validUntil, revD.kta, revD.review.history.slice(-1)[0].action, F.console.get('registry/' + revD.kta).status,
      rejA.status, PPAPI.util.effectiveStatus(rejA), rejA.review.note];
    // ---- Draf member C cannot read member-only files (store + rules) ----
    await AU.signOut();
    await AU.signInEmail({ email: 'citra@contoh.id', password: 'Perancah2026' });
    await tick();
    out.draf = [await err(S.pustaka.fileUrl(pk)), await err(F.db.collection('pustaka_files').doc(pk.id).get())];
    out.denied = F.log.filter(l => !l[2]).length;
    out.deniedUnexpected = F.log.filter((l, i) => !l[2] && !skip.some(r => i >= r[0] && i < r[1]) && !/^(members\/orang-lain|member_photos\/orang-lain|members\/\*|registry\/PPAPI-2026-777777|admins\/fb-|content_berita\/x|counters\/kta-2026|audit_log\/|feedback\/\*|feedback\/auto|members\/fb-1-ani|pustaka_files\/)/.test(l[1])).map(l => l.join(' '));
    return out;
  });

  console.log('\n── Firebase mode (stub SDK + rules mirror)');
  eq(R.mode, ['firebase', 'firebase', null], "auth.mode / store.mode 'firebase'; no demo admin in Firebase mode");
  eq(R.create.slice(0, 3), ['Draf', '', 'Praktisi'], 'ensureMember creates members/{uid} with status Draf, kta "" (create rule allowed)');
  ok(R.create[3].includes('uid') && R.create[3].includes('status') && !R.create[3].includes('application') && !R.create[3].includes('review') && !R.create[3].includes('contoh') && R.create[4].length === 1 && R.create[4][0] === true, 'core shape written on create (no application/review — rules budget); create allowed by the rules mirror', R.create);
  eq([R.isAdminA, R.sessA], [false, 'Draf'], 'isAdmin() reads admins/{uid} (absent → false); session Draf');
  eq(R.verifyMail, ['', 1, false], 'sign-up sends the verification mail; the unverified address is NOT copied into members/{uid}.email');
  eq(R.photoPng, 'store/invalid-photo', 'pas foto: a PNG data URL is refused (JPEG only)');
  eq(R.photo, [true, '', true, true, true, '', ''], 'pas foto → member_photos/{uid}; record keeps pasFoto "" + pasFotoAda; getMember hydrates, {pasFoto:false} and the session do not');
  eq(R.serverTimes, ['function', 'function', 'function', true], 'submittedAt / application.updatedAt / updatedAt are server timestamps (read back as ISO)');
  eq(R.lockedProfile, ['store/application-locked', 'store/application-locked', 'store/application-locked'], 'while Menunggu Verifikasi: profile, name and pas foto are locked (store)');
  eq(R.lockedPhotoRaw, ['permission-denied', 'permission-denied'], 'while Menunggu Verifikasi: direct member_photos write/delete refused (rules)');
  eq(R.submit, ['Menunggu Verifikasi', true, 0], 'submitApplication (owner transition Draf → Menunggu Verifikasi) — no review write by the member');
  eq([R.lockedA, R.wd, R.resub], ['store/application-locked', 'Draf', 'Menunggu Verifikasi'], 'locked while pending; withdraw (→ Draf) and re-submit pass the rules');
  const evilBad = Object.entries(R.evil).filter(([, v]) => v !== 'store/permission-denied' && v !== 'permission-denied');
  ok(!evilBad.length, `rules mirror refuses ${Object.keys(R.evil).length} malicious member writes/reads (kta, status, validUntil, review, application while pending, other member, list, registry, self-admin, content, counters, audit, feedback)`, evilBad.length ? evilBad : undefined);
  eq(R.adminApiA, 'store/forbidden', 'store.admin.* refuses a non-admin before touching Firestore');
  eq(R.emailOwn, ['NO ERROR', 'permission-denied'], "member.email: '' passes; the account's own email is refused while it is unverified");
  eq([R.emailVerified, R.emailStore], [[true, 'ani@contoh.id', 'NO ERROR'], 'ani@contoh.id'], 'after the verification link: refreshUser() refreshes the token and fills member.email; store keeps the account email (audit E1)');
  eq(R.legacy, ['Draf', 'Draf'], "v1 record 'Menunggu Verifikasi' without application → stored as Draf on sign-in (allowed withdraw transition)");
  eq(R.isAdminB, [true, true, true], 'first admin created in the console (admins/{uid}) → isAdmin, session.isAdmin/isActive');
  ok(R.list.length === 3 && R.list[0] === 'Menunggu Verifikasi', 'admin listMembers (list rule) — pending first', R.list);
  eq(R.listPhoto, [true, ['', true], true, true, 1], 'listMembers: queue rows carry the pas foto, {pasFoto:false} only the flag; admin.getMember / store.pasFoto load it; summary counts');
  eq(R.approve.slice(0, 3), ['Aktif', 'PPAPI-2026-000001', '2029-12-31'], 'approve in a transaction → PPAPI-2026-000001, validUntil 2029-12-31');
  eq([R.approve[3].value, R.approve[4], R.approve[5]], [1, 'berlakuHingga,kategori,kompetensi,kota,kta,ktaNomor,nama,namaCari,namaKata,status,updatedAt', 1], 'counters/kta-2026 = 1; registry doc with public fields + search keys only; one transaction');
  eq(R.approve2, ['PPAPI-2026-000003', 'Ahli', 3], 'next approval skips an existing registry number (000002 taken) → 000003; counter 3');
  eq(R.revision, 'store/invalid-transition', 'requestRevision on an Aktif member is refused');
  eq([R.deact, R.react, R.extend, R.type], [['Nonaktif', 'Nonaktif'], ['Aktif', '2030-12-31', '2030-12-31'], '2031-01-31', ['Kehormatan', 'Kehormatan']], 'deactivate / reactivate / extend / setMemberType (transactions + registry)');
  eq(R.pustaka, ['', 'https://drive.example.com/modul.pdf', true], 'member-only knowledge file: content_pustaka doc has no link; pustaka_files/{id}.url holds it');
  eq(R.berita, [PPAPI_BERITA, false], 'content_berita merged with static data; hidden static item not listed');
  eq(R.fileAdmin, 'https://drive.example.com/modul.pdf', 'admin reads pustaka_files');
  eq([R.pustakaOut, R.lookupOut, R.lookupName, R.samplesHidden], ['store/forbidden', 'Ani Firebase', ['PPAPI-2026-000003'], null], 'signed out: fileUrl forbidden; registry lookup (public) exact + name; contoh samples hidden in Firebase mode');
  eq(R.lookupBounded, [['PPAPI-2026-000003'], ['PPAPI-2026-000003'], ['PPAPI-2026-000001', 'PPAPI-2026-000002', 'PPAPI-2026-000003'], ['PPAPI-2026-000001', 'PPAPI-2026-000002', 'PPAPI-2026-000003']], 'bounded registry queries: whole word (namaKata), KTA number (ktaNomor), KTA prefix (year)');
  eq(R.registryList, ['permission-denied', 'permission-denied', 'NO ERROR', 'NO ERROR'], 'registry: list without limit / limit 21 refused; limit 20 and get allowed (no bulk download)');
  eq(R.feedback, [1, 'Baru', 'string'], 'feedback create (serverTimestamp == request.time) → admin list (orderBy createdAt) with ISO date');
  eq([R.feedbackUp, R.feedbackEvil], ['Selesai', 'permission-denied'], 'admin updates feedback status; other feedback fields are immutable');
  ok(['permission-denied', 'store/permission-denied'].includes(R.feedbackForged), 'feedback update with a forged updatedBy is refused (audit)', R.feedbackForged);
  eq([R.addAdmin, R.admins, R.rmAdmin, R.lastAdmin], [true, 2, true, 'store/last-admin'], 'addAdmin by email (members query) / removeAdmin / last-admin guard');
  ok(['anggota.disetujui', 'anggota.dinonaktifkan', 'anggota.diaktifkan', 'anggota.diperpanjang', 'anggota.kategori-diubah', 'konten.disimpan', 'konten.dihapus', 'umpan-balik.diperbarui', 'admin.ditambah', 'admin.dihapus'].every(x => R.audit.includes(x)), 'audit_log entries for every admin action (create rule: by == auth.uid)', R.audit);
  ok(R.summary.aktif === 2 && R.summary.umpanBalikBaru === 0, 'admin.summary()', R.summary);
  eq(R.sessActive, ['Aktif', true], 'approved member: session Aktif');
  eq(R.fileActive, 'https://drive.example.com/modul.pdf', 'active member reads pustaka_files (isActiveMember rule)');
  eq(R.expired, ['Kedaluwarsa', 'store/forbidden', 'permission-denied'], 'expired: session Kedaluwarsa; store and rules (validityOk) refuse the member-only file');
  eq(R.renew, ['Menunggu Verifikasi', 'perpanjangan', 'PPAPI-2026-000001'], 'expired member submits a perpanjangan (rules: renewable → Menunggu Verifikasi)');
  eq(R.earlyRenewal.slice(0, 6), ['Menunggu Verifikasi', 'Aktif', '2026-11-30', 'PPAPI-2026-000003', 'perbaikan', 'Aktif'], 'early renewal returned for revision → stays Aktif (validUntil, KTA, registry kept); history perbaikan');
  eq(R.earlyRenewal.slice(6), ['Aktif', 'Kedaluwarsa', 'Data perpanjangan belum sesuai.'], 'renewal of an expired membership rejected → back to Aktif/Kedaluwarsa (not Ditolak), reason kept for the member');
  eq(R.draf, ['store/forbidden', 'permission-denied'], 'Draf member: fileUrl forbidden; direct read of pustaka_files denied');
  eq(R.deniedUnexpected, [], 'no store-initiated Firestore call was denied (only the deliberate malicious ones)');
  ok(!errors.length, 'no page errors', errors);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.map(f => ' • ' + f).join('\n')); process.exitCode = 1; }
