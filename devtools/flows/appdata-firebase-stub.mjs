// Firebase-mode test of PPAPI.appData (assets/js/store-apps.js) and of the planning app's "Proyek Saya"
// WITHOUT a real project or network.  Run from devtools/:  node flows/appdata-firebase-stub.mjs
//
// Pattern of flows/firebase-v2-stub.mjs (whose STUB source is reused verbatim, like admin-firebase.mjs does):
// config.js is served with a FAKE apiKey (→ Firebase mode), the compat-SDK stub is installed by an init script.
// On top of it, AD_EXT adds the sub-collection path app_data/{uid}/{coll}/{docId} with a JavaScript MIRROR of
// devtools/rules-fragments/appdata.rules (owner read/write/delete, admin read, coll whitelist, doc shape/size).
// The app_data documents live in a Node-side Map shared by every page and browser context of this run, so a
// second context signed in to the same account is a real "second device". window.__adOffline = true makes every
// app_data call fail with {code:'unavailable'} (network outage).
// What it proves: every Firestore call store-apps.js makes (paths, document shape, transactions, queries) is
// allowed for the owner and refused for others; LWW, the offline queue and cross-device restore work in
// Firebase mode. What it cannot prove: that Google's rules engine accepts the fragment (publish to confirm).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const stubFile = fs.readFileSync(path.join(__dirname, 'firebase-v2-stub.mjs'), 'utf8');
const s0 = stubFile.indexOf('const STUB = () => {');
const endM = s0 < 0 ? null : /\r?\n\};\r?\n/.exec(stubFile.slice(s0));
const s1 = endM ? s0 + endM.index : -1;
if (s0 < 0 || s1 < 0) { console.error('Stub not found in firebase-v2-stub.mjs'); process.exit(2); }
const STUB_SRC = '(' + stubFile.slice(s0 + 'const STUB = '.length, s1) + '\n})();';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const PAGE = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Uji appData — PPAPI</title></head>
<body data-page="beranda" data-auth="public"><div id="site-header"></div><main id="main"><p>Uji</p></main><div id="site-footer"></div>
<script src="assets/js/config.js" defer></script><script src="assets/js/core.js" defer></script><script src="assets/js/auth.js" defer></script>
<script src="assets/js/store.js" defer></script><script src="assets/js/store-apps.js" defer></script></body></html>`;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__ad.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(PAGE); }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/assets/js/config.js') body = body.toString('utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: 'AIzaSyFAKE-stub-key-000000000000000000'").replace(/projectId:\s*'[^']*'/, "projectId: 'ppapi-stub'");
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ---------------- app_data layer (runs in the page, after STUB) ---------------- */
const AD_EXT = () => {
  const F = window.__fstub, db = window.firebase.firestore();
  const COLLS = ['perencanaan', 'perencanaan_media', 'simulator', 'simulator_media'];
  const isMap = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const log = window.__adlog = [];
  /* mirror of rules-fragments/appdata.rules — appDataDoc() */
  function validAppDoc(d) {
    return isMap(d) && Object.keys(d).every(k => ['v', 'meta', 'data', 'size', 'updatedAt', 'parent'].includes(k))
      && 'data' in d && 'updatedAt' in d
      && typeof d.data === 'string' && d.data.length <= 800000
      && typeof d.updatedAt === 'number'
      && (!('size' in d) || typeof d.size === 'number')
      && (!('meta' in d) || (isMap(d.meta) && Object.keys(d.meta).length <= 24))
      && (!('parent' in d) || (typeof d.parent === 'string' && d.parent.length <= 120));
  }
  function allowed(op, owner, coll, id, after) {
    const me = F.uid(), isOwner = !!me && me === owner, isAdmin = !!me && !!F.console.get('admins/' + me);
    if (op === 'get' || op === 'list') return isOwner || isAdmin;
    if (op === 'write') return isOwner && COLLS.includes(coll) && id.length <= 120 && validAppDoc(after);
    if (op === 'delete') return isOwner;
    return false;
  }
  function guard(op, p, after) {
    const parts = p.split('/'), ok = allowed(op, parts[1], parts[2], parts[3] || '', after);
    log.push([op, p, ok, F.uid()]);
    if (!ok) { const e = new Error('Missing or insufficient permissions (' + op + ' ' + p + ')'); e.code = 'permission-denied'; throw e; }
  }
  const net = () => { if (window.__adOffline) { const e = new Error('Failed to get document because the client is offline.'); e.code = 'unavailable'; return Promise.reject(e); } return Promise.resolve(); };
  const be = (...a) => window.__adBackend(...a);
  const snapOf = (id, json) => ({ id, exists: json != null, data: () => (json == null ? undefined : JSON.parse(json)) });
  function docRef(p) {
    const id = p.split('/').pop();
    return {
      __ad: true, id, path: p,
      get: async () => { await net(); guard('get', p); return snapOf(id, await be('get', p)); },
      set: async (data) => { await net(); const clean = JSON.parse(JSON.stringify(data)); guard('write', p, clean); await be('set', p, JSON.stringify(clean)); },
      delete: async () => { await net(); guard('delete', p); await be('delete', p); }
    };
  }
  function collRef(cp, filters) {
    return {
      doc: id => docRef(cp + '/' + id),
      where: (f, op, v) => { if (op !== '==') throw new Error('stub: unsupported operator ' + op); return collRef(cp, (filters || []).concat([[f, v]])); },
      get: async () => {
        await net(); guard('list', cp + '/*');
        let rows = (await be('list', cp)).map(r => ({ id: r.id, json: r.json, d: JSON.parse(r.json) }));
        (filters || []).forEach(([f, v]) => { rows = rows.filter(x => x.d[f] === v); });
        const docs = rows.map(x => snapOf(x.id, x.json));
        return { docs, size: docs.length, empty: !docs.length, forEach: cb => docs.forEach(cb) };
      }
    };
  }
  const origCollection = db.collection.bind(db), origTx = db.runTransaction.bind(db);
  db.collection = function (name) {
    if (name !== 'app_data') return origCollection(name);
    return { doc: uid => ({ id: uid, collection: coll => collRef('app_data/' + uid + '/' + coll) }) };
  };
  db.runTransaction = async function (fn) {
    const writes = []; let usedAd = false;
    const result = await origTx(function (t) {
      const wt = {
        get: ref => (ref.__ad ? (usedAd = true, ref.get()) : t.get(ref)),
        set: (ref, d, o) => { if (ref.__ad) { usedAd = true; writes.push(['set', ref, d]); } else t.set(ref, d, o); return wt; },
        update: (ref, d) => { t.update(ref, d); return wt; },
        delete: ref => { if (ref.__ad) { usedAd = true; writes.push(['delete', ref]); } else t.delete(ref); return wt; }
      };
      return fn(wt);
    });
    for (const w of writes) { if (w[0] === 'set') await w[1].set(w[2]); else await w[1].delete(); }
    if (usedAd) window.__adTx = (window.__adTx || 0) + 1;
    return result;
  };
};
/* signed-in ACTIVE member (the stub signs in synchronously); optional admin role */
const SEED = ({ email, name, admin }) => {
  const F = window.__fstub;
  firebase.auth().createUserWithEmailAndPassword(email, 'Perancah2026');
  const me = F.uid();
  F.console.set('members/' + me, { uid: me, name, email, phone: '+6281299990001', photoURL: '', kta: 'PPAPI-2026-000077', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-02-01', validUntil: '2029-12-31', approvedAt: '2026-02-01T02:00:00.000Z', approvedBy: 'console', profile: { city: 'Bekasi', province: 'Jawa Barat', company: 'PT Uji', position: 'Inspektor' }, competencies: [], certificates: [], application: {}, review: { note: '', history: [] }, createdAt: '2026-01-20T02:00:00.000Z', updatedAt: '2026-02-01T02:00:00.000Z' });
  if (admin) F.console.set('admins/' + me, { uid: me, name, email, addedAt: '2026-10-01T02:00:00.000Z', addedBy: 'console' });
};

const BACK = new Map();   // 'app_data/uid/coll/id' → JSON text  (the "server")
async function device(browser, user) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
  await ctx.exposeFunction('__adBackend', (op, p, json) => {
    if (op === 'get') return BACK.has(p) ? BACK.get(p) : null;
    if (op === 'set') { BACK.set(p, json); return true; }
    if (op === 'delete') { BACK.delete(p); return true; }
    if (op === 'list') { const pre = p + '/'; return [...BACK].filter(([k]) => k.startsWith(pre) && !k.slice(pre.length).includes('/')).map(([k, v]) => ({ id: k.slice(pre.length), json: v })); }
    return null;
  });
  await ctx.addInitScript({ content: STUB_SRC });
  await ctx.addInitScript(AD_EXT);
  await ctx.addInitScript(SEED, user);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return { ctx, page, errors };
}
const back = (pfx) => [...BACK.keys()].filter(k => k.startsWith(pfx));
const backDoc = (k) => (BACK.has(k) ? JSON.parse(BACK.get(k)) : null);

let passed = 0;
const failures = [];
const ok = (c, m, x) => { if (c) { passed++; console.log('  ✓ ' + m); } else { failures.push(m); console.log('  ✗ ' + m + (x !== undefined ? '\n      ' + JSON.stringify(x).slice(0, 600) : '')); } };

const ANI = { email: 'ani@contoh.id', name: 'Ani Firebase' };
const BUDI = { email: 'budi@contoh.id', name: 'Budi Lain' };
const ADMIN = { email: 'sekretariat@contoh.id', name: 'Sekretariat Uji', admin: true };
const browser = await chromium.launch();
const all = [];
try {
  /* ================= A. PPAPI.appData API (test page) ================= */
  console.log('\n— A  PPAPI.appData in Firebase mode (paths, shape, LWW, queue, limits)');
  const A1 = await device(browser, ANI); all.push(A1);
  await A1.page.goto(`${BASE}/__ad.html`, { waitUntil: 'networkidle' });
  await A1.page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady() && PPAPI.appData);
  const uidA = await A1.page.evaluate(() => PPAPI.auth.current().uid);
  const R1 = await A1.page.evaluate(async () => {
    const D = PPAPI.appData, out = {};
    const err = async p => { try { await p; return 'NO ERROR'; } catch (e) { return e.code || e.message; } };
    out.mode = [PPAPI.auth.mode, D.mode()];
    out.save = await D.save('perencanaan', 'puji0001', { meta: { name: 'Tangki T-101', lokasi: 'Plant 2', status: 'HIJAU', nested: { x: 1 } }, data: { fields: { 'f-proyek': 'Tangki T-101' }, answers: { '0-0': 'ok' }, mats: [[1, 2], [3]] }, updatedAt: 1000 });
    out.tx = window.__adTx || 0;
    out.list = await D.list('perencanaan');
    out.get = await D.get('perencanaan', 'puji0001');
    out.media = await D.save('perencanaan_media', 'puji0001__ph_0-0', { meta: { kind: 'photo', key: '0-0' }, data: { d: 'data:image/jpeg;base64,/9j/4AAQ' }, parent: 'puji0001', updatedAt: 1000 });
    out.mediaTx = window.__adTx || 0;
    out.listMedia = (await D.listMedia('perencanaan', 'puji0001')).map(m => [m.id, m.parent, m.data && m.data.d.slice(0, 15)]);
    out.otherParent = (await D.listMedia('perencanaan', 'plain0001')).length;
    out.badApp = await err(D.save('evil', 'x1', { data: 1 }));
    out.badId = await err(D.save('perencanaan', '../x', { data: 1 }));
    out.big = await err(D.save('perencanaan', 'pbesar01', { data: { s: 'x'.repeat(800001) } }));
    out.bigWritten = !!(await D.get('perencanaan', 'pbesar01'));
    return out;
  });
  ok(R1.mode[0] === 'firebase' && R1.mode[1] === 'firebase', 'Firebase mode (stub) active', R1.mode);
  const kA = `app_data/${uidA}/perencanaan/puji0001`;
  const rawA = backDoc(kA);
  ok(R1.save.synced === true && R1.save.queued === false && !!rawA, 'save() → synced; document at app_data/{uid}/perencanaan/{docId}', { save: R1.save, keys: back('app_data/') });
  ok(rawA && Object.keys(rawA).sort().join() === 'data,meta,parent,size,updatedAt,v' && typeof rawA.data === 'string' && rawA.updatedAt === 1000 && rawA.size === rawA.data.length && rawA.parent === '', 'stored shape {v, meta, data:JSON text, size, updatedAt, parent}', rawA);
  ok(rawA && !('nested' in rawA.meta) && rawA.meta.name === 'Tangki T-101', 'meta kept flat (nested values dropped)', rawA && rawA.meta);
  ok(R1.tx === 1 && R1.mediaTx === 1, 'main documents are written in a transaction (LWW check), media without one', [R1.tx, R1.mediaTx]);
  ok(R1.list.length === 1 && R1.list[0].id === 'puji0001' && R1.list[0].meta.lokasi === 'Plant 2' && !('data' in R1.list[0]), 'list() → id + meta (without the payload)', R1.list);
  ok(R1.get && R1.get.data.answers['0-0'] === 'ok' && JSON.stringify(R1.get.data.mats) === '[[1,2],[3]]', 'get() → parsed payload (nested arrays survive: stored as JSON text)', R1.get);
  ok(R1.media.synced && !!backDoc(`app_data/${uidA}/perencanaan_media/puji0001__ph_0-0`), 'media → app_data/{uid}/perencanaan_media/{id}', R1.media);
  ok(R1.listMedia.length === 1 && R1.listMedia[0][1] === 'puji0001' && R1.otherParent === 0, 'listMedia(app, parent) = query parent == id', R1.listMedia);
  ok(R1.badApp === 'appdata/invalid-app' && R1.badId === 'appdata/invalid-id', 'unknown app / unsafe id refused before any write', [R1.badApp, R1.badId]);
  ok(R1.big === 'appdata/too-large' && !R1.bigWritten, 'document > 800 000 bytes refused (appdata/too-large), nothing written', R1.big);

  /* ---- second device, same account ---- */
  console.log('\n— B  second device (other browser context, same account), last-write-wins');
  const A2 = await device(browser, ANI); all.push(A2);
  await A2.page.goto(`${BASE}/__ad.html`, { waitUntil: 'networkidle' });
  await A2.page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady() && PPAPI.appData);
  const R2 = await A2.page.evaluate(async () => {
    const D = PPAPI.appData;
    return { uid: PPAPI.auth.current().uid, ls: Object.keys(localStorage).filter(k => /appdata/.test(k)), list: await D.list('perencanaan'), get: await D.get('perencanaan', 'puji0001'),
      newer: await D.save('perencanaan', 'puji0001', { meta: { name: 'Tangki T-101 (perangkat 2)' }, data: { v: 2 }, updatedAt: 2000 }) };
  });
  ok(R2.uid === uidA && R2.ls.length === 0, 'device 2: same uid, empty localStorage (nothing copied)', R2);
  ok(R2.list.length === 1 && R2.get && R2.get.data.fields['f-proyek'] === 'Tangki T-101', 'device 2 lists and opens the inspection saved on device 1', R2.get);
  ok(R2.newer.synced && backDoc(kA).updatedAt === 2000, 'device 2 saves a newer version (updatedAt 2000)', R2.newer);
  const R3 = await A1.page.evaluate(async () => {
    const D = PPAPI.appData;
    const stale = await D.save('perencanaan', 'puji0001', { meta: { name: 'lama' }, data: { v: 1.5 }, updatedAt: 1500 });
    const staleDel = await D.remove('perencanaan', 'puji0001', { updatedAt: 1200 });
    return { stale, staleDel, after: await D.get('perencanaan', 'puji0001') };
  });
  ok(R3.stale.conflict === true && R3.stale.synced === false && R3.stale.remote && R3.stale.remote.updatedAt === 2000 && R3.stale.remote.data.v === 2, 'older write (1500) does not overwrite the newer one (2000): {conflict, remote}', R3.stale);
  ok(R3.staleDel.conflict === true && !!backDoc(kA), 'a delete older than the account version is refused too (no lost edits)', R3.staleDel);
  ok(R3.after.data.v === 2 && backDoc(kA).meta.name === 'Tangki T-101 (perangkat 2)', 'account keeps the newest version', R3.after);

  /* ---- offline queue ---- */
  console.log('\n— C  offline queue');
  const R4 = await A1.page.evaluate(async () => {
    const D = PPAPI.appData, uid = PPAPI.auth.current().uid;
    window.__adOffline = true;
    const r = await D.save('perencanaan', 'pluring01', { meta: { name: 'Isian luring' }, data: { x: 'luring' }, updatedAt: Date.now() });
    const q = JSON.parse(localStorage.getItem('ppapi_appdata_q_' + uid) || '[]');
    const st = D.status();
    const got = await D.get('perencanaan', 'pluring01');
    const lst = await D.list('perencanaan');
    return { r, q: q.map(o => [o.op, o.coll, o.id]), st, got: got && [got.data.x, got.pending], lst: lst.map(x => [x.id, x.pending, !!x.stale]), stale: !!lst.stale };
  });
  ok(R4.r.queued === true && R4.r.synced === false, 'offline save → {queued:true}', R4.r);
  ok(R4.q.length === 1 && R4.q[0][2] === 'pluring01' && !back(`app_data/${uidA}/perencanaan/pluring01`).length, 'operation kept in localStorage queue (ppapi_appdata_q_<uid>), not on the server yet', R4.q);
  ok(R4.st.state === 'pending' && R4.st.pending === 1 && R4.st.durable === true, 'status: pending (durable queue)', R4.st);
  ok(R4.got[0] === 'luring' && R4.got[1] === true && R4.lst.some(x => x[0] === 'pluring01' && x[1] === true), 'get()/list() show the pending version while offline (list falls back to the cached index)', R4);
  const R5 = await A1.page.evaluate(async () => {
    const D = PPAPI.appData, uid = PPAPI.auth.current().uid;
    window.__adOffline = false;
    await D.flush();
    return { st: D.status(), q: localStorage.getItem('ppapi_appdata_q_' + uid) };
  });
  ok(!!backDoc(`app_data/${uidA}/perencanaan/pluring01`) && R5.q === null && R5.st.state === 'saved' && R5.st.pending === 0, 'back online: flush() delivers the queue; status saved', R5);

  /* ---- access rules (mirror) ---- */
  console.log('\n— D  access: other member denied, admin read-only, shape checks');
  const B = await device(browser, BUDI); all.push(B);
  await B.page.goto(`${BASE}/__ad.html`, { waitUntil: 'networkidle' });
  await B.page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady() && PPAPI.appData);
  const RB = await B.page.evaluate(async (uidA) => {
    const err = async p => { try { await p; return 'NO ERROR'; } catch (e) { return e.code || e.message; } };
    const db = firebase.firestore(), D = PPAPI.appData;
    const rec = { v: 1, meta: {}, data: '{}', size: 2, updatedAt: 1, parent: '' };
    return {
      own: (await D.list('perencanaan')).length,
      readOther: await err(db.collection('app_data').doc(uidA).collection('perencanaan').doc('puji0001').get()),
      listOther: await err(db.collection('app_data').doc(uidA).collection('perencanaan').get()),
      writeOther: await err(db.collection('app_data').doc(uidA).collection('perencanaan').doc('pjahat01').set(rec)),
      deleteOther: await err(db.collection('app_data').doc(uidA).collection('perencanaan').doc('puji0001').delete()),
      badColl: await err(db.collection('app_data').doc(PPAPI.auth.current().uid).collection('lain').doc('x').set(rec)),
      extraKey: await err(db.collection('app_data').doc(PPAPI.auth.current().uid).collection('perencanaan').doc('x').set(Object.assign({ status: 'Aktif' }, rec))),
      noString: await err(db.collection('app_data').doc(PPAPI.auth.current().uid).collection('perencanaan').doc('x').set(Object.assign({}, rec, { data: { a: 1 } }))),
      tooLong: await err(db.collection('app_data').doc(PPAPI.auth.current().uid).collection('perencanaan').doc('x').set(Object.assign({}, rec, { data: 'x'.repeat(800001) }))),
      ownRaw: await err(db.collection('app_data').doc(PPAPI.auth.current().uid).collection('simulator').doc('progress').set(rec))
    };
  }, uidA);
  ok(RB.own === 0, 'member B sees none of member A\'s projects', RB.own);
  ok(['readOther', 'listOther', 'writeOther', 'deleteOther'].every(k => RB[k] === 'permission-denied'), 'member B cannot read, list, write or delete A\'s app_data', RB);
  ok(['badColl', 'extraKey', 'noString', 'tooLong'].every(k => RB[k] === 'permission-denied'), 'owner writes outside the whitelist / shape / 800 000-char limit are refused', RB);
  ok(RB.ownRaw === 'NO ERROR', 'owner may write a well-formed document to their own app_data', RB.ownRaw);
  const C = await device(browser, ADMIN); all.push(C);
  await C.page.goto(`${BASE}/__ad.html`, { waitUntil: 'networkidle' });
  await C.page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady() && PPAPI.appData);
  const RC = await C.page.evaluate(async (uidA) => {
    const err = async p => { try { await p; return 'NO ERROR'; } catch (e) { return e.code || e.message; } };
    const col = firebase.firestore().collection('app_data').doc(uidA).collection('perencanaan');
    const snap = await col.doc('puji0001').get().catch(e => e);
    return { read: snap && snap.exists === true, list: await err(col.get()), write: await err(col.doc('padmin01').set({ v: 1, meta: {}, data: '{}', size: 2, updatedAt: 1, parent: '' })), del: await err(col.doc('puji0001').delete()) };
  }, uidA);
  ok(RC.read === true && RC.list === 'NO ERROR', 'admin PPAPI may read a member\'s app_data (support)', RC);
  ok(RC.write === 'permission-denied' && RC.del === 'permission-denied', 'admin cannot write or delete a member\'s app_data', RC);
  const RS = await A1.page.evaluate(async () => {
    const err = async p => { try { await p; return 'NO ERROR'; } catch (e) { return e.code || e.message; } };
    await PPAPI.auth.signOut();
    return { save: await err(PPAPI.appData.save('perencanaan', 'pkeluar1', { data: 1 })), list: await err(PPAPI.appData.list('perencanaan')) };
  });
  ok(RS.save === 'appdata/signed-out' && RS.list === 'appdata/signed-out', 'signed out → appdata/signed-out', RS);
  await A1.page.evaluate(() => firebase.auth().signInWithEmailAndPassword('ani@contoh.id', 'Perancah2026'));

  /* ================= E. planning app, Firebase mode, two devices ================= */
  console.log('\n— E  planning app (Firebase mode): autosave to the account, reload, second device, offline');
  const PR = `${BASE}/aplikasi/perencanaan/index.html`;
  const gateOk = (page) => page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
  const savedText = (page) => page.$eval('#saved-ind', el => el.textContent.trim());
  const P1 = await device(browser, { email: 'citra@contoh.id', name: 'Citra Inspektor' }); all.push(P1);
  await P1.page.goto(PR, { waitUntil: 'networkidle' });
  await gateOk(P1.page);
  const uidP = await P1.page.evaluate(() => PPAPI.auth.current().uid);
  await P1.page.evaluate(() => {
    go('proyek');
    const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    set('f-proyek', 'Pemeliharaan Boiler B-2'); set('f-lokasi', 'Unit Utilitas, Cilegon'); set('f-tag', 'SC-2026-201');
    state.answers['0-0'] = 'ok'; state.answers['0-1'] = 'no'; save();
    state.photos['0-1'] = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD'; savePhotos();
  });
  await P1.page.waitForFunction(() => /^Tersimpan ke akun · \d{2}\.\d{2}$/.test(document.getElementById('saved-ind').textContent.trim()), null, { timeout: 15000 });
  const mainKeys = back(`app_data/${uidP}/perencanaan/`), mediaKeys = back(`app_data/${uidP}/perencanaan_media/`);
  ok(mainKeys.length === 1 && mediaKeys.length === 1, 'autosave: one project document + one photo document on the account', { mainKeys, mediaKeys });
  const pm = mainKeys.length ? backDoc(mainKeys[0]) : null;
  ok(pm && pm.meta.name === 'Pemeliharaan Boiler B-2' && pm.meta.lokasi === 'Unit Utilitas, Cilegon' && pm.meta.status === 'BELUM LENGKAP' && JSON.parse(pm.data).photos['0-1'] === mediaKeys[0].split('/').pop(), 'project meta (name, location, verdict BELUM LENGKAP: 2 of 52 answered) + photo manifest → media id', pm && pm.meta);
  ok(await savedText(P1.page) !== '' && /^Tersimpan ke akun · \d{2}\.\d{2}$/.test(await savedText(P1.page)), 'status in the menu band: "Tersimpan ke akun · HH.MM"', await savedText(P1.page));
  await P1.page.reload({ waitUntil: 'networkidle' });
  await gateOk(P1.page);
  await P1.page.waitForFunction(() => document.querySelector('#proj-list .proj-item'), null, { timeout: 10000 });
  const r1 = await P1.page.evaluate(() => ({ proj: document.getElementById('f-proyek').value, ans: state.answers['0-1'], photo: !!state.photos['0-1'], list: document.getElementById('proj-list').textContent }));
  ok(r1.proj === 'Pemeliharaan Boiler B-2' && r1.ans === 'no' && r1.photo && /Sedang dibuka/.test(r1.list), 'reload: inspection still open, listed in Proyek Saya', r1);

  const P2 = await device(browser, { email: 'citra@contoh.id', name: 'Citra Inspektor' }); all.push(P2);
  await P2.page.goto(PR, { waitUntil: 'networkidle' });
  await gateOk(P2.page);
  await P2.page.evaluate(() => go('proyek'));
  await P2.page.waitForFunction(() => /Pemeliharaan Boiler B-2/.test(document.getElementById('proj-list').textContent), null, { timeout: 10000 });
  const before2 = await P2.page.evaluate(() => ({ proj: document.getElementById('f-proyek').value, ls: Object.keys(localStorage).filter(k => /^ppapi_app_perencanaan_v1_/.test(k) && /_sync$/.test(k)).map(k => localStorage.getItem(k)) }));
  ok(before2.proj === '', 'device 2: empty screen, project offered in Proyek Saya', before2);
  await P2.page.click('#proj-list button:has-text("Buka")');
  await P2.page.waitForFunction(() => document.getElementById('f-proyek').value === 'Pemeliharaan Boiler B-2', null, { timeout: 10000 });
  const r2 = await P2.page.evaluate(() => ({ lok: document.getElementById('f-lokasi').value, tag: document.getElementById('f-tag').value, ans: [state.answers['0-0'], state.answers['0-1']], photo: (state.photos['0-1'] || '').slice(0, 23), saved: document.getElementById('saved-ind').textContent.trim() }));
  ok(r2.lok === 'Unit Utilitas, Cilegon' && r2.tag === 'SC-2026-201' && r2.ans.join() === 'ok,no' && r2.photo === 'data:image/jpeg;base64,', 'device 2 opens it: fields, checklist answers and photo restored', r2);
  ok(/^Tersimpan ke akun · \d{2}\.\d{2}$/.test(r2.saved), 'device 2 status: "Tersimpan ke akun"', r2.saved);

  /* offline on device 2: edit → "Belum tersinkron — akan dicoba lagi" → online → delivered */
  await P2.page.evaluate(() => { window.__adOffline = true; const e = document.getElementById('f-catatan'); e.value = 'Catatan dari perangkat kedua (luring)'; e.dispatchEvent(new Event('input', { bubbles: true })); });
  await P2.page.waitForFunction(() => /Belum tersinkron/.test(document.getElementById('saved-ind').textContent), null, { timeout: 20000 });
  const off = await P2.page.evaluate(() => ({ t: document.getElementById('saved-ind').textContent.trim(), title: document.getElementById('saved-ind').getAttribute('title'), q: PPAPI.appData.pending().length }));
  ok(off.t === 'Belum tersinkron — akan dicoba lagi' && off.q >= 1, 'offline: "Belum tersinkron — akan dicoba lagi", change queued', off);
  ok(!JSON.parse(backDoc(mainKeys[0]).data).fields['f-catatan'], 'offline: the account still has the previous version', null);
  await P2.page.evaluate(() => { window.__adOffline = false; window.dispatchEvent(new Event('online')); });
  await P2.page.waitForFunction(() => /^Tersimpan ke akun/.test(document.getElementById('saved-ind').textContent.trim()), null, { timeout: 70000 });
  ok(JSON.parse(backDoc(mainKeys[0]).data).fields['f-catatan'] === 'Catatan dari perangkat kedua (luring)', 'back online: the queued change reaches the account', null);

  /* device 1 reopens → the newer account version (device 2) is loaded */
  await P1.page.reload({ waitUntil: 'networkidle' });
  await gateOk(P1.page);
  await P1.page.waitForFunction(() => document.getElementById('f-catatan').value !== '', null, { timeout: 10000 });
  const r3 = await P1.page.evaluate(() => ({ cat: document.getElementById('f-catatan').value, toast: (document.querySelector('.toast-region') || document.body).textContent }));
  ok(r3.cat === 'Catatan dari perangkat kedua (luring)' && /Versi terbaru proyek/.test(r3.toast), 'device 1 reload: newer version from the account loaded (last-write-wins) with a notice', r3.cat);

  /* ---- no unexpected denial in the app_data mirror ---- */
  for (const d of [P1, P2]) {
    const denied = await d.page.evaluate(() => (window.__adlog || []).filter(l => !l[2]));
    ok(denied.length === 0, 'planning app: every app_data call allowed by the rules mirror', denied.slice(0, 3));
  }
  const errs = all.flatMap(d => d.errors);
  ok(errs.length === 0, 'no console errors / page errors', errs.slice(0, 5));
} catch (e) {
  failures.push('exception: ' + (e && e.stack || e));
  console.error(e);
} finally {
  await browser.close();
  server.close();
}
console.log(`\nappdata-firebase-stub: ${passed}/${passed + failures.length} passed${failures.length ? ' — FAILED: ' + failures.join(' | ') : ''}`);
process.exit(failures.length ? 1 : 0);
