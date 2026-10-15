// Security lens v2 — ATTACK cases against the Firestore rules mirror (copied stub of firebase-v2-stub.mjs).
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
    body = body.toString('utf8').replace("apiKey: ''", "apiKey: 'AIzaSyFAKE-stub-key-000000000000000000'").replace("projectId: ''", "projectId: 'ppapi-stub'");
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* the stub + rules mirror (runs in the page): read from flows/firebase-v2-stub.mjs (single source) */
const STUB_SRC = (() => {
  const src = fs.readFileSync(path.join(__dirname, "firebase-v2-stub.mjs"), "utf8").replace(/\r\n/g, "\n");
  const start = src.indexOf("const STUB = () => {");
  const mark = src.indexOf("/* ------------------------------------------------------------------ test */", start);
  const end = mark === -1 ? -1 : src.lastIndexOf("\n};", mark);
  if (start === -1 || end < start) throw new Error("stub not found in firebase-v2-stub.mjs");
  return "(" + src.slice(start + "const STUB = ".length, end + 2) + ")();";
})();

/* ------------------------------------------------------------------ attack test */
let passed = 0;
const failures = [];
const ok = (c, m, x) => { if (c) { passed++; console.log('  ✓ ' + m); } else { failures.push(m + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); console.log('  ✗ ' + m + (x !== undefined ? '\n      ' + JSON.stringify(x) : '')); } };
const DENIED = v => v === 'permission-denied' || v === 'store/permission-denied';

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(new Date('2026-10-09T10:00:00+07:00'));
  await ctx.addInitScript({ content: STUB_SRC });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/__fb.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());

  const R = await page.evaluate(async () => {
    const S = PPAPI.store, AU = PPAPI.auth, F = window.__fstub, out = {};
    const err = async p => { try { await p; return 'ALLOWED'; } catch (e) { return e.code || e.message; } };
    const tick = () => new Promise(r => setTimeout(r, 40));
    const col = (c) => F.db.collection(c);
    const mdoc = (u) => col('members').doc(u);
    const cur = (u) => F.console.get('members/' + u);
    const setStatus = (u, patch) => F.console.set('members/' + u, Object.assign(cur(u), patch));
    const TS = () => window.firebase.firestore.FieldValue.serverTimestamp();
    const JPEG = 'data:image/jpeg;base64,' + 'A'.repeat(200);

    /* first admin (console) + a victim member + the attacker */
    const adm = await AU.signUpEmail({ name: 'Admin Satu', email: 'admin.satu@contoh.id', password: 'Perancah2026' }); await tick();
    F.console.set('admins/' + adm.uid, { uid: adm.uid, name: 'Admin Satu', email: 'admin.satu@contoh.id', addedAt: 'x', addedBy: 'console' });
    await AU.signOut();
    const vic = await AU.signUpEmail({ name: 'Korban Aktif', email: 'korban@contoh.id', password: 'Perancah2026' }); await tick();
    setStatus(vic.uid, { status: 'Aktif', kta: 'PPAPI-2026-000050', validUntil: '2029-12-31', approvedAt: '2026-01-01T00:00:00Z', approvedBy: adm.uid });
    F.console.set('registry/PPAPI-2026-000050', { kta: 'PPAPI-2026-000050', nama: 'Korban Aktif', status: 'Aktif' });
    await AU.signOut();
    const ev = await AU.signUpEmail({ name: 'Penyerang', email: 'penyerang@contoh.id', password: 'Perancah2026' }); await tick();
    const me = ev.uid, ref = mdoc(me);
    out.attackerStatus = cur(me).status;

    /* 1. self-approval (Draf) */
    out.selfApprove = {
      statusAktif: await err(ref.update({ status: 'Aktif' })),
      statusAktifFull: await err(ref.set({ status: 'Aktif', kta: 'PPAPI-2026-999999', validUntil: '2099-12-31', approvedAt: '2026-10-09', approvedBy: me }, { merge: true })),
      memberType: await err(ref.update({ memberType: 'Kehormatan' })),
      kta: await err(ref.update({ kta: 'PPAPI-2026-999999' })),
      validUntil: await err(ref.update({ validUntil: '2099-12-31' })),
      approvedAt: await err(ref.update({ approvedAt: '2026-10-09T00:00:00Z' })),
      approvedBy: await err(ref.update({ approvedBy: adm.uid })),
      review: await err(ref.update({ review: { note: 'ok', history: [{ action: 'disetujui', by: adm.uid }] } })),
      joinedAt: await err(ref.update({ joinedAt: '2000-01-01' })),
      createdAt: await err(ref.update({ createdAt: '2000-01-01T00:00:00Z' })),
      contoh: await err(ref.update({ contoh: true })),
      uid: await err(ref.update({ uid: vic.uid })),
      unknownKey: await err(ref.update({ role: 'admin' })),
      deleteOwn: await err(ref.delete()),
      createOther: await err(mdoc('uid-lain-123').set({ uid: 'uid-lain-123', name: 'x', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-10-09' })),
      writeOtherMember: await err(mdoc(vic.uid).update({ name: 'Diubah penyerang' })),
    };
    /* 1b. pas foto store (member_photos/{uid}) */
    const pref = col('member_photos').doc(me);
    out.photoDraf = {
      ownJpeg: await err(pref.set({ uid: me, data: JPEG, updatedAt: TS() })),
      ownPng: await err(pref.set({ uid: me, data: 'data:image/png;base64,AAAA', updatedAt: TS() })),
      ownSvg: await err(pref.set({ uid: me, data: 'data:image/svg+xml;base64,PHN2Zz4=', updatedAt: TS() })),
      ownClientTime: await err(pref.set({ uid: me, data: JPEG, updatedAt: '2026-01-01T00:00:00Z' })),
      ownExtraKey: await err(pref.set({ uid: me, data: JPEG, updatedAt: TS(), html: '<b>x</b>' })),
      otherWrite: await err(col('member_photos').doc(vic.uid).set({ uid: vic.uid, data: JPEG, updatedAt: TS() })),
      otherRead: await err(col('member_photos').doc(vic.uid).get()),
      list: await err(col('member_photos').get()),
    };
    /* 2. submitted → pending; edits while pending */
    await S.saveMember(me, { phone: '0812-3333-4444', profile: { birthDate: '1992-03-04', province: 'Banten', city: 'Tangerang', company: 'PT X', position: 'Supervisor', experienceYears: 8 } });
    await S.saveApplication(me, { kategori: 'Praktisi', pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Penyerang' } });
    await S.submitApplication(me);
    const app = cur(me).application;
    out.pending = {
      editApp: await err(ref.update({ application: Object.assign({}, app, { catatan: 'diam-diam' }) })),
      editAppClearSubmitted: await err(ref.update({ application: Object.assign({}, app, { submittedAt: '' }) })),
      withdrawKeepSubmitted: await err(ref.update({ status: 'Draf', application: Object.assign({}, app, { catatan: 'x' }) })),
      toAktif: await err(ref.update({ status: 'Aktif' })),
      toPerluPerbaikan: await err(ref.update({ status: 'Perlu Perbaikan' })),
    };
    out.pendingProfile = {
      profileWhilePending: await err(ref.update({ profile: Object.assign({}, cur(me).profile, { company: 'Diubah saat diverifikasi' }) })),
      nameWhilePending: await err(ref.update({ name: 'Nama Lain Saat Verifikasi' })),
      competenciesWhilePending: await err(ref.update({ competencies: [{ id: 'k', name: 'Ahli Utama', level: 'Ahli' }] })),
      certificatesWhilePending: await err(ref.update({ certificates: [{ id: 'c', title: 'Ahli K3 Utama', issuer: 'Kemnaker' }], updatedAt: TS() })),
      phoneWhilePending: await err(ref.update({ phone: '081299990000', updatedAt: TS() })),
      photoURLWhilePending: await err(ref.update({ photoURL: 'https://example.com/lain.jpg', updatedAt: TS() })),
      pasFotoWhilePending: await err(pref.set({ uid: me, data: JPEG.replace('AAAA', 'BBBB'), updatedAt: TS() })),
      pasFotoDeleteWhilePending: await err(pref.delete()),
      storeSaveMember: await err(S.saveMember(me, { name: 'Nama Diganti', profile: { company: 'Perusahaan Lain', experienceYears: 30 }, certificates: [{ title: 'Ahli K3 Utama', issuer: 'Kemnaker' }] })),
    };
    /* withdrawing (→ Draf) re-opens the data — in the same write as well */
    out.withdrawWithProfile = await err(ref.update({ status: 'Draf', application: Object.assign({}, cur(me).application, { submittedAt: '', updatedAt: TS() }), profile: Object.assign({}, cur(me).profile, { company: 'PT X Baru' }), updatedAt: TS() }));
    await S.submitApplication(me);
    /* 3. other transitions */
    setStatus(me, { status: 'Perlu Perbaikan' });
    out.revisi = { toAktif: await err(ref.update({ status: 'Aktif' })) };
    setStatus(me, { status: 'Ditolak' });
    out.ditolak = { toAktif: await err(ref.update({ status: 'Aktif' })) };
    setStatus(me, { status: 'Nonaktif', kta: 'PPAPI-2026-000060', validUntil: '2029-12-31', approvedAt: '2026-01-01T00:00:00Z', approvedBy: adm.uid });
    out.nonaktif = {
      toAktif: await err(ref.update({ status: 'Aktif' })),
      toMvBaru: await err(ref.update({ status: 'Menunggu Verifikasi', application: Object.assign({}, cur(me).application, { type: 'baru', submittedAt: '2026-10-09T03:00:00Z' }) })),
    };
    setStatus(me, { status: 'Aktif', validUntil: '2029-12-31', application: Object.assign({}, cur(me).application, { submittedAt: '2026-01-01T00:00:00Z', type: 'baru' }) });
    out.aktifFar = {
      toMvRenew: await err(ref.update({ status: 'Menunggu Verifikasi', application: Object.assign({}, cur(me).application, { type: 'perpanjangan', submittedAt: '2026-10-09T03:00:00Z' }) })),
      extendSelf: await err(ref.update({ validUntil: '2035-12-31' })),
      editApp: await err(ref.update({ application: Object.assign({}, cur(me).application, { catatan: 'x' }) })),
    };
    setStatus(me, { status: 'Aktif', validUntil: '2026-07-31' });      /* expired */
    out.expired = {
      extendSelf: await err(ref.update({ validUntil: '2035-12-31' })),
      clearValidUntil: await err(ref.update({ validUntil: '' })),
    };
    /* 4. data reads per status */
    F.console.set('pustaka_files/modul-x', { url: 'https://drive.example.com/rahasia.pdf', updatedAt: 'x', updatedBy: adm.uid });
    F.console.set('feedback/fb1', { kategori: 'Kritik', pesan: 'Pesan rahasia pengunjung lain.', nama: 'Tamu', email: 'tamu@contoh.id', createdAt: 'x' });
    const readsFor = async () => ({
      otherMember: await err(mdoc(vic.uid).get()),
      listMembers: await err(col('members').get()),
      queryByEmail: await err(col('members').where('email', '==', 'korban@contoh.id').get()),
      filesGet: await err(col('pustaka_files').doc('modul-x').get()),
      filesList: await err(col('pustaka_files').get()),
      feedbackGet: await err(col('feedback').doc('fb1').get()),
      feedbackList: await err(col('feedback').get()),
      adminsList: await err(col('admins').get()),
      adminsOther: await err(col('admins').doc(adm.uid).get()),
      adminsOwn: await err(col('admins').doc(me).get()),
      counters: await err(col('counters').doc('kta-2026').get()),
      audit: await err(col('audit_log').get()),
      registryList: await err(col('registry').get()),
      registryQuery: await err(col('registry').limit(20).get()),
    });
    out.reads = {};
    for (const st of [['Draf', ''], ['Menunggu Verifikasi', ''], ['Perlu Perbaikan', ''], ['Ditolak', ''], ['Nonaktif', '2029-12-31'], ['Kedaluwarsa', '2026-07-31'], ['Aktif', '2029-12-31']]) {
      const status = st[0] === 'Kedaluwarsa' ? 'Aktif' : st[0];
      const appX = Object.assign({}, cur(me).application, { submittedAt: status === 'Draf' ? '' : '2026-10-01T00:00:00Z' });
      setStatus(me, { status, validUntil: st[1], application: appX });
      out.reads[st[0]] = await readsFor();
    }
    /* 5. writes to admin-only collections */
    out.writes = {
      registryCreate: await err(col('registry').doc('PPAPI-2026-777777').set({ kta: 'PPAPI-2026-777777', nama: 'Palsu', status: 'Aktif' })),
      registryUpdateOther: await err(col('registry').doc('PPAPI-2026-000050').set({ kta: 'PPAPI-2026-000050', nama: 'Diubah' }, { merge: true })),
      registryDelete: await err(col('registry').doc('PPAPI-2026-000050').delete()),
      selfAdmin: await err(col('admins').doc(me).set({ uid: me, name: 'x', email: 'penyerang@contoh.id', addedAt: 'x', addedBy: me })),
      selfAdminForged: await err(col('admins').doc(me).set({ uid: me, addedBy: adm.uid })),
      pustakaFileWrite: await err(col('pustaka_files').doc('modul-x').set({ url: 'https://evil.example/x.pdf' })),
      contentWrite: await err(col('content_pustaka').doc('evil').set({ judul: 'x', tautan: 'javascript:alert(1)' })),
      counterWrite: await err(col('counters').doc('kta-2026').set({ value: 0 })),
      auditCreate: await err(col('audit_log').add({ at: 'x', by: me, action: 'x' })),
      auditForged: await err(col('audit_log').add({ at: 'x', by: adm.uid, action: 'x' })),
      feedbackUpdate: await err(col('feedback').doc('fb1').update({ status: 'Selesai' })),
      feedbackDelete: await err(col('feedback').doc('fb1').delete()),
      feedbackCreateWithStatus: await err(col('feedback').add({ kategori: 'Saran', pesan: 'Pesan cukup panjang.', status: 'Selesai', createdAt: TS() })),
      feedbackCreateOtherUid: await err(col('feedback').add({ kategori: 'Saran', pesan: 'Pesan cukup panjang.', uid: vic.uid, createdAt: TS() })),
      feedbackCreateClientTime: await err(col('feedback').add({ kategori: 'Saran', pesan: 'Pesan cukup panjang.', createdAt: '2020-01-01' })),
      emailOther: await err(ref.update({ email: 'admin.satu@contoh.id' })),
      emailOwnUnverified: await err(ref.update({ email: 'penyerang@contoh.id' })),
    };
    /* 6. rule-accepted but questionable member writes (read side must cope) */
    setStatus(me, { status: 'Draf', validUntil: '', application: Object.assign({}, cur(me).application, { submittedAt: '' }) });
    out.accepted = {
      kategoriKehormatan: await err(ref.update({ application: Object.assign({}, cur(me).application, { kategori: 'Kehormatan' }) })),
      photoJs: await err(ref.update({ photoURL: 'javascript:alert(1)' })),
      updatedAtHtml: await err(ref.update({ updatedAt: '<img src=x onerror=alert(1)>' })),
    };
    out.accepted.dokumenJs = await err(ref.update({ application: Object.assign({}, cur(me).application, { dokumen: [{ id: 'd', jenis: 'CV', label: 'x', url: 'javascript:alert(1)' }] }) }));
    /* formerly accepted by the rules — now refused (finding: forged times, incomplete submissions) */
    const fullDecl = { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Penyerang', tanggal: '2026-10-09' };
    out.refused = {
      updatedAtHtml: out.accepted.updatedAtHtml,
      submitIncomplete: await err(ref.update({ status: 'Menunggu Verifikasi', application: Object.assign({}, cur(me).application, { submittedAt: '<b>x</b>', pernyataan: { kodeEtik: false } }) })),
      submitForgedTime: await err(ref.update({ status: 'Menunggu Verifikasi', application: Object.assign({}, cur(me).application, { kategori: 'Praktisi', submittedAt: '0000-01-01T00:00:00Z', updatedAt: TS(), pernyataan: fullDecl }), updatedAt: TS() })),
      submitKehormatan: await err(ref.update({ status: 'Menunggu Verifikasi', application: Object.assign({}, cur(me).application, { kategori: 'Kehormatan', submittedAt: TS(), updatedAt: TS(), pernyataan: fullDecl }), updatedAt: TS() })),
      submitNoDeclarations: await err(ref.update({ status: 'Menunggu Verifikasi', application: Object.assign({}, cur(me).application, { kategori: 'Praktisi', submittedAt: TS(), updatedAt: TS(), pernyataan: { kodeEtik: true, kebenaranData: true, privasi: false, namaTerang: 'Penyerang' } }), updatedAt: TS() })),
      appForgedUpdatedAt: await err(ref.update({ application: Object.assign({}, cur(me).application, { catatan: 'x', updatedAt: '9999-12-31T00:00:00Z' }) })),
    };
    delete out.accepted.updatedAtHtml;
    out.submitServerTime = await err(ref.update({ status: 'Menunggu Verifikasi', application: Object.assign({}, cur(me).application, { kategori: 'Praktisi', submittedAt: TS(), updatedAt: TS(), pernyataan: fullDecl }), updatedAt: TS() }));
    await S.withdrawApplication(me);
    out.normalizedRead = await (async () => { const m = await S.getMember(me); return { status: m.status, photoURL: m.photoURL, kategori: m.application.kategori, dokUrl: (m.application.dokumen[0] || {}).url, updatedAt: m.updatedAt, submittedAt: m.application.submittedAt }; })();
    await AU.signOut();

    /* 7. admin add via spoofed (unverified) email: attacker registers the address the secretariat will promote */
    const spoof = await AU.signUpEmail({ name: 'Staf Baru Sekretariat', email: 'staf.baru@ppapi-contoh.id', password: 'Perancah2026' }); await tick();
    out.spoofOwnEmail = [cur(spoof.uid).email, await err(mdoc(spoof.uid).update({ email: 'staf.baru@ppapi-contoh.id' }))];
    await AU.signOut();
    await AU.signInEmail({ email: 'admin.satu@contoh.id', password: 'Perancah2026' }); await tick();
    out.spoofAdd = await err(S.admin.addAdmin('staf.baru@ppapi-contoh.id'));
    out.spoofIsAdmin = !!F.console.get('admins/' + spoof.uid);
    out.approveDefaultKategori = (await S.admin.getMember(me)).application.kategori;
    await AU.signOut();
    /* 8. signed out */
    out.anon = {
      member: await err(mdoc(vic.uid).get()), files: await err(col('pustaka_files').doc('modul-x').get()), feedback: await err(col('feedback').get()),
      registry: await err(col('registry').limit(20).get()), registryAll: await err(col('registry').get()), registryBig: await err(col('registry').limit(5000).get()),
      registryGet: await err(col('registry').doc('PPAPI-2026-000050').get()),
      feedbackCreate: await err(col('feedback').add({ kategori: 'Saran', pesan: 'Pesan tanpa akun, cukup panjang.', createdAt: TS() })),
      fileUrlStore: await err(S.pustaka.fileUrl({ id: 'modul-x', akses: 'anggota' })),
    };
    return out;
  });

  console.log('\n── Firestore rules mirror: attack cases (attacker status after sign-up: ' + R.attackerStatus + ')');
  for (const [k, v] of Object.entries(R.selfApprove)) ok(DENIED(v), 'Draf member self-approval / privileged field / others: ' + k, v);
  for (const [k, v] of Object.entries(R.photoDraf)) ok(k === 'ownJpeg' ? v === 'ALLOWED' : DENIED(v), 'member_photos as Draf owner: ' + k + (k === 'ownJpeg' ? ' allowed' : ' denied'), v);
  for (const [k, v] of Object.entries(R.pending)) ok(DENIED(v), 'while Menunggu Verifikasi: ' + k + ' denied', v);
  for (const [k, v] of Object.entries(R.pendingProfile)) ok(k === 'storeSaveMember' ? v === 'store/application-locked' : DENIED(v), 'while Menunggu Verifikasi (reviewed data): ' + k + ' refused', v);
  ok(R.withdrawWithProfile === 'ALLOWED', 'withdraw (→ Draf) may change the profile in the same write', R.withdrawWithProfile);
  ok(DENIED(R.revisi.toAktif) && DENIED(R.ditolak.toAktif), 'Perlu Perbaikan / Ditolak → Aktif denied', [R.revisi, R.ditolak]);
  ok(DENIED(R.nonaktif.toAktif) && DENIED(R.nonaktif.toMvBaru), 'Nonaktif → Aktif and Nonaktif → Menunggu Verifikasi (type baru) denied', R.nonaktif);
  ok(DENIED(R.aktifFar.toMvRenew) && DENIED(R.aktifFar.extendSelf) && DENIED(R.aktifFar.editApp), 'Aktif (far from expiry): renewal / self-extend / application edit denied', R.aktifFar);
  ok(DENIED(R.expired.extendSelf) && DENIED(R.expired.clearValidUntil), 'expired member cannot extend or clear validUntil', R.expired);
  for (const [st, r] of Object.entries(R.reads)) {
    const active = st === 'Aktif';
    const bad = Object.entries(r).filter(([k, v]) => {
      if (k === 'registryQuery' || k === 'adminsOwn') return v !== 'ALLOWED';
      if ((k === 'filesGet' || k === 'filesList') && active) return v !== 'ALLOWED';
      return !DENIED(v);
    });
    ok(!bad.length, `reads as ${st}: others' members/list/query, pustaka_files ${active ? 'ALLOWED' : 'denied'}, feedback, admins, counters, audit denied; registry: query ≤20 allowed, whole collection denied`, bad.length ? bad : undefined);
  }
  for (const [k, v] of Object.entries(R.writes)) ok(DENIED(v), 'member write denied: ' + k, v);
  for (const [k, v] of Object.entries(R.refused)) ok(DENIED(v), 'formerly rule-accepted, now refused: ' + k, v);
  ok(R.submitServerTime === 'ALLOWED', 'complete submission with server time (request.time) allowed', R.submitServerTime);
  console.log('\n── rule-ACCEPTED member writes (must be neutralised on read / by the admin UI):', JSON.stringify(R.accepted));
  console.log('   normalised read:', JSON.stringify(R.normalizedRead));
  console.log('   admin approve dialog default kategori for that applicant:', R.approveDefaultKategori);
  console.log('\n── spoofed-email admin add: addAdmin("staf.baru@…") →', R.spoofAdd, '| attacker uid became admin:', R.spoofIsAdmin);
  ok(R.spoofOwnEmail[0] === '' && DENIED(R.spoofOwnEmail[1]), 'unverified sign-up: member.email stays empty; writing the unverified address is refused', R.spoofOwnEmail);
  ok(R.spoofAdd === 'store/not-found' && R.spoofIsAdmin === false, 'admin cannot be granted through an unverified e-mail address (addAdmin → store/not-found)', [R.spoofAdd, R.spoofIsAdmin]);
  console.log('── signed out:', JSON.stringify(R.anon));
  ok(DENIED(R.anon.member) && DENIED(R.anon.files) && DENIED(R.anon.feedback) && R.anon.registry === 'ALLOWED' && R.anon.registryGet === 'ALLOWED' && DENIED(R.anon.registryAll) && DENIED(R.anon.registryBig) && R.anon.feedbackCreate === 'ALLOWED' && R.anon.fileUrlStore === 'store/forbidden', 'signed out: member/files/feedback denied; registry get + query ≤20 allowed, bulk list denied; feedback create allowed; store fileUrl forbidden', R.anon);
  ok(!errors.length, 'no page errors', errors);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.map(f => ' • ' + f).join('\n')); process.exitCode = 1; }
