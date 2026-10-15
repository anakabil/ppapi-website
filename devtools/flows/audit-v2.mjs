// PPAPI foundation v2 — INDEPENDENT AUDIT (contract auditor). Adversarial checks of SPEC-v2 §1–§3 that
// complement flows/contract-v2.mjs: whitelist holes, cross-account writes, admin-guard bypasses, status
// transition matrix, session caching across sign-in/out on ONE page, gating chains (no redirect loops),
// XSS in the v2 render helpers, CSV injection, registry privacy, seed duplicates, KTA collisions,
// read-side sanitising of member/content data written around the store (direct SDK / console writes),
// prototype-key ids, firestore.rules static review markers.
// Run from devtools/:  node flows/audit-v2.mjs     (demo mode, no internet; clock frozen 2026-10-09 10:00 WIB)
// Throwaway pages site/__v2audit_*.html are created and DELETED at the end. Exit code 1 on any failure.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const FIXED_NOW = new Date('2026-10-09T10:00:00+07:00');

let passed = 0;
const failures = [];
let section = '';
function sect(name) { section = name; console.log(`\n── ${name}`); }
function ok(cond, msg, detail) {
  if (cond) { passed++; console.log('  ✓ ' + msg); return true; }
  failures.push(`[${section}] ${msg}` + (detail !== undefined ? `  → ${JSON.stringify(detail)}` : ''));
  console.log('  ✗ ' + msg + (detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ''));
  return false;
}
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg, JSON.stringify(a) === JSON.stringify(b) ? undefined : { got: a, want: b });

/* ------------------------------------------------------------ static: firestore.rules review markers */
function rulesChecks() {
  sect('firestore.rules — static review markers (fixes of this audit)');
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const strip = rules.replace(/\/\/[^\n]*/g, '');
  const bal = (o, c) => (strip.split(o).length - 1) === (strip.split(c).length - 1);
  ok(bal('{', '}') && bal('(', ')') && bal('[', ']'), 'braces / parentheses / brackets balance');
  ok(/function verifiedEmail\(email\)[\s\S]*?email_verified[\s\S]*?request\.auth\.token\.email/.test(rules) && /function ownEmailOk\(after, before\)[\s\S]*?verifiedEmail\(after\.email\)/.test(rules) && /ownEmailOk\(after, before\)/.test(rules.slice(rules.indexOf('function ownerUpdate'))), 'owner update: member.email may only become \'\' or the VERIFIED account email (token.email) — addAdmin looks members up by email');
  ok(/request\.resource\.data\.updatedBy == request\.auth\.uid/.test(rules.slice(rules.indexOf('match /feedback/'))), 'feedback update: updatedBy must be the acting admin');
  ok(!/allow (read|write|get|list|create|update|delete)[^;]*if true[^;]*;/.test(strip.replace(/match \/(registry|content_\w+)\/\{\w+\} \{\s*allow (read|get): if true;/g, '')), 'only registry + content_* are world-readable (if true)');
  ok(/match \/\{document=\*\*\} \{\s*allow read, write: if false;/.test(rules), 'catch-all deny');
}

/* ------------------------------------------------------------ browser */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function page(name, auth) {
  const html = `<!doctype html><html lang="id" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Audit v2 — PPAPI</title><meta name="robots" content="noindex"><link rel="stylesheet" href="assets/css/main.css">
<script>document.documentElement.classList.replace('no-js','js')</script></head>
<body data-page="beranda" data-auth="${auth}"><a class="skip-link" href="#main">Lewati ke konten utama</a><div id="site-header"></div>
<main id="main" tabindex="-1"><section class="section"><div class="container" id="sandbox"><h1>Audit ${auth}</h1></div></section></main><div id="site-footer"></div>
<script src="assets/js/config.js" defer></script><script src="assets/data/berita.js" defer></script><script src="assets/data/agenda.js" defer></script>
<script src="assets/data/regulasi.js" defer></script><script src="assets/data/organisasi.js" defer></script><script src="assets/data/registry.js" defer></script>
<script src="assets/data/pustaka.js" defer></script><script src="assets/js/core.js" defer></script><script src="assets/js/auth.js" defer></script><script src="assets/js/store.js" defer></script>
</body></html>`;
  fs.writeFileSync(path.join(ROOT, name), html);
}
function cleanup() { for (const f of fs.readdirSync(ROOT)) if (/^__v2audit_.*\.html$/.test(f)) { try { fs.unlinkSync(path.join(ROOT, f)); } catch (e) { /* ignore */ } } }

const HELPERS = () => {
  const S = PPAPI.store, A = PPAPI.auth;
  window.__h = {
    async err(p) { try { await p; return 'NO ERROR'; } catch (e) { return e.code || e.message; } },
    async signUp(name, email) { await A.signOut(); return A.signUpEmail({ name, email, password: 'Perancah2026' }); },
    async asAdmin() { await A.signOut(); return A.signInEmail({ email: 'admin@ppapi.demo', password: 'AdminPPAPI2026' }); },
    async as(email) { await A.signOut(); return A.signInEmail({ email, password: 'Perancah2026' }); },
    raw(uid) { return JSON.parse(localStorage.getItem('ppapi_member_' + uid) || 'null'); },
    put(uid, m) { localStorage.setItem('ppapi_member_' + uid, JSON.stringify(m)); },
    async complete(uid, name) {
      await S.saveMember(uid, { name, phone: '0812-3333-4444', profile: { birthPlace: 'Medan', birthDate: '1992-03-04', gender: 'Laki-laki', province: 'Sumatera Utara', city: 'Medan', company: 'PT Audit Perancah', position: 'Teknisi', experienceYears: 4 } });
      return S.saveApplication(uid, { kategori: 'Praktisi', pengalaman: [{ proyek: 'Proyek audit', peran: 'Teknisi', tahun: '2025', lokasi: 'Medan' }], pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: name } });
    },
    sess() { const s = PPAPI.session.current(); return { uid: s.user && s.user.uid, status: s.status, isAdmin: s.isAdmin, isActive: s.isActive }; },
    tick(ms) { return new Promise(r => setTimeout(r, ms || 60)); }
  };
};

async function browserChecks() {
  cleanup();
  page('__v2audit_public.html', 'public');
  page('__v2audit_active.html', 'active');
  page('__v2audit_admin.html', 'admin');
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end('<!doctype html><title>404</title>'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const pageErrors = [];
  async function newCtx() {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
    await ctx.clock.setFixedTime(FIXED_NOW);
    return ctx;
  }
  function watch(pg, label) {
    pg.on('pageerror', e => pageErrors.push(`${label}: ${e.message}`));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) pageErrors.push(`${label}: console.error ${m.text()}`); });
  }
  async function open(pg, file) {
    await pg.goto(`${BASE}/${file}`, { waitUntil: 'networkidle' });
    await pg.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());
    await pg.evaluate(HELPERS);
  }
  const rel = u => u.replace(BASE, '');
  try {
    const ctx = await newCtx();
    const pg = await ctx.newPage();
    watch(pg, 'main');
    await open(pg, '__v2audit_public.html');

    /* ---------------------------------------------------------------- whitelist holes */
    sect('Whitelist: a member cannot grant themselves status/KTA/validity/review (demo = Firebase rules)');
    const W = await pg.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, r = {};
      const u = await H.signUp('Wawan Pemohon', 'wawan.audit@contoh.id');
      await H.complete(u.uid, 'Wawan Pemohon');
      const evil = { status: 'Aktif', kta: 'PPAPI-2026-999999', validUntil: '2099-12-31', approvedAt: '2026-01-01T00:00:00Z', approvedBy: 'x', memberType: 'Ahli', joinedAt: '2000-01-01', createdAt: 'x', uid: 'other', contoh: true, review: { note: 'ok', history: [{ action: 'disetujui' }] }, application: { submittedAt: '2026-01-01T00:00:00Z', type: 'perpanjangan' } };
      await S.saveMember(u.uid, evil);
      await S.saveApplication(u.uid, Object.assign({}, evil, { submittedAt: '2026-01-01T00:00:00Z', type: 'perpanjangan', updatedAt: 'x', pernyataan: { kodeEtik: true } }));
      const m = H.raw(u.uid);
      r.after = [m.status, m.kta, m.validUntil, m.approvedAt, m.approvedBy, m.memberType, m.uid, !!m.contoh, m.review.note, m.review.history.length, m.application.submittedAt, m.application.type];
      r.topKeys = Object.keys(m).filter(k => !['uid', 'name', 'email', 'phone', 'photoURL', 'kta', 'memberType', 'status', 'joinedAt', 'validUntil', 'approvedAt', 'approvedBy', 'profile', 'competencies', 'certificates', 'application', 'review', 'createdAt', 'updatedAt', 'contoh'].includes(k));
      await H.tick(); r.sess = H.sess().status;
      /* email impersonation (admin "add by email" looks members up by email) */
      await S.saveMember(u.uid, { email: 'ketua.sekretariat@contoh.id' });
      r.email = H.raw(u.uid).email;
      await S.saveMember(u.uid, { email: 'WAWAN.AUDIT@contoh.id' });
      r.emailSame = H.raw(u.uid).email;
      /* cross-account writes */
      const before3 = JSON.stringify(H.raw('demo-contoh-0003'));
      r.cross = await H.err(S.saveMember('demo-contoh-0003', { name: 'Diretas', profile: { city: 'X' } }));
      r.crossUnchanged = JSON.stringify(H.raw('demo-contoh-0003')) === before3;
      r.crossApp = [await H.err(S.saveApplication('demo-contoh-0003', { catatan: 'x' })), await H.err(S.submitApplication('demo-contoh-0001')), await H.err(S.withdrawApplication('demo-contoh-0001'))];
      /* kategori that cannot be applied for */
      r.keh = (await S.saveApplication(u.uid, { kategori: 'Kehormatan' })).application.kategori;
      r.kehOk = (await S.saveApplication(u.uid, { kategori: 'Ahli' })).application.kategori;
      r.uid = u.uid;
      return r;
    });
    eq(W.after, ['Draf', '', '', '', '', 'Praktisi', W.uid, false, '', 0, '', 'baru'], 'saveMember/saveApplication ignore status, kta, validUntil, approvedAt/By, memberType, uid, contoh, review, submittedAt, type');
    eq(W.topKeys, [], 'no foreign top-level keys reach the stored record');
    eq(W.sess, 'Draf', 'session stays Draf');
    eq([W.email, W.emailSame], ['wawan.audit@contoh.id', 'wawan.audit@contoh.id'], "member.email cannot be changed to someone else's address (only the account's own email)");
    eq([W.cross, W.crossUnchanged], ['store/forbidden', true], "saveMember on another member's record → store/forbidden, record unchanged");
    eq(W.crossApp, ['store/forbidden', 'store/forbidden', 'store/forbidden'], 'saveApplication / submitApplication / withdrawApplication on another record → store/forbidden');
    eq([W.keh, W.kehOk], ['', 'Ahli'], "saveApplication: kategori 'Kehormatan' (bisaDiajukan:false) is not stored; Ahli is");

    /* ---------------------------------------------------------------- admin guard */
    sect('Admin guard: member / signed-out callers');
    const G = await pg.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, A = S.admin;
      const calls = () => [A.listMembers(), A.getMember('demo-contoh-0001'), A.approve('demo-contoh-0001', {}), A.requestRevision('demo-contoh-0001', 'catatan panjang'), A.reject('demo-contoh-0001', 'alasan panjang'), A.deactivate('demo-contoh-0003'), A.reactivate('demo-contoh-0003', {}), A.extend('demo-contoh-0003', '2030-12-31'), A.setMemberType('demo-contoh-0003', 'Praktisi'), A.listFeedback(), A.updateFeedback('x', { status: 'Selesai' }), A.listAdmins(), A.addAdmin('wawan.audit@contoh.id'), A.removeAdmin('demo-admin-0001'), A.audit(), A.summary(), S.content.save('berita', { judul: 'X', ringkasan: 'Y' }), S.content.remove('berita', 'x'), S.content.restore('berita', 'x')];
      const asMember = await Promise.all(calls().map(p => H.err(p)));
      /* forging the demo admin list is the ONLY way in demo — localStorage is client-side by nature */
      await PPAPI.auth.signOut();
      const out = await Promise.all(calls().map(p => H.err(p)));
      return { asMember, out, admins: JSON.parse(localStorage.getItem('ppapi_demo_admins')), s3: H.raw('demo-contoh-0003').status };
    });
    ok(G.asMember.every(x => x === 'store/forbidden'), `member: all ${G.asMember.length} admin/content writes → store/forbidden`, G.asMember);
    ok(G.out.every(x => x === 'store/forbidden'), 'signed out: all → store/forbidden', G.out);
    eq([G.admins, G.s3], [['demo-admin-0001'], 'Aktif'], 'nothing changed (admins list, sample status)');

    /* ---------------------------------------------------------------- transitions matrix */
    sect('Status transitions matrix (member side)');
    const T = await pg.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, out = {};
      const u = await H.signUp('Tari Transisi', 'tari.audit@contoh.id');
      await H.complete(u.uid, 'Tari Transisi');
      const base = H.raw(u.uid);
      const cases = {
        'Draf': {}, 'Menunggu Verifikasi': { submittedAt: '2026-10-01T00:00:00Z' }, 'Perlu Perbaikan': { submittedAt: '2026-10-01T00:00:00Z' },
        'Ditolak': { submittedAt: '2026-10-01T00:00:00Z' }, 'Aktif (2029)': { st: 'Aktif', validUntil: '2029-12-31' }, 'Aktif (≤60 hari)': { st: 'Aktif', validUntil: '2026-11-30' },
        'Kedaluwarsa': { st: 'Aktif', validUntil: '2026-01-31' }, 'Nonaktif': { st: 'Nonaktif', validUntil: '2028-12-31' }
      };
      for (const [label, c] of Object.entries(cases)) {
        const m = JSON.parse(JSON.stringify(base));
        m.status = c.st || label; m.validUntil = c.validUntil || ''; m.application.submittedAt = c.submittedAt || '';
        if (c.st) { m.kta = 'PPAPI-2026-000777'; m.approvedAt = '2026-01-02T00:00:00Z'; }
        H.put(u.uid, m);
        const save = await H.err(S.saveApplication(u.uid, { catatan: 'uji ' + label }));
        H.put(u.uid, m);
        const sub = await H.err(S.submitApplication(u.uid));
        const after = H.raw(u.uid);
        H.put(u.uid, m);
        const wd = await H.err(S.withdrawApplication(u.uid));
        out[label] = [save, sub, sub === 'NO ERROR' ? after.status + '/' + after.application.type : '-', wd];
      }
      H.put(u.uid, base);
      return out;
    });
    eq(T, {
      'Draf': ['NO ERROR', 'NO ERROR', 'Menunggu Verifikasi/baru', 'store/invalid-transition'],
      'Menunggu Verifikasi': ['store/application-locked', 'store/invalid-transition', '-', 'NO ERROR'],
      'Perlu Perbaikan': ['NO ERROR', 'NO ERROR', 'Menunggu Verifikasi/baru', 'store/invalid-transition'],
      'Ditolak': ['NO ERROR', 'NO ERROR', 'Menunggu Verifikasi/baru', 'store/invalid-transition'],
      'Aktif (2029)': ['store/application-locked', 'store/invalid-transition', '-', 'store/invalid-transition'],
      'Aktif (≤60 hari)': ['NO ERROR', 'NO ERROR', 'Menunggu Verifikasi/perpanjangan', 'store/invalid-transition'],
      'Kedaluwarsa': ['NO ERROR', 'NO ERROR', 'Menunggu Verifikasi/perpanjangan', 'store/invalid-transition'],
      'Nonaktif': ['NO ERROR', 'NO ERROR', 'Menunggu Verifikasi/perpanjangan', 'store/invalid-transition']
    }, 'save / submit / withdraw per status = SPEC §1 + rules ownerTransition (renewal = perpanjangan)');

    /* ---------------------------------------------------------------- session caching */
    sect('PPAPI.session across sign-in / sign-out / status change on ONE page');
    const SS = await pg.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, r = {};
      await H.asAdmin(); await H.tick(); r.admin = H.sess();
      await PPAPI.auth.signOut(); await H.tick(); r.out = H.sess();
      await H.as('tari.audit@contoh.id'); await H.tick(); r.member = H.sess();
      const uid = r.member.uid;
      /* admin approves the member, then deactivates — the member's session after each sign-in must follow */
      const m = H.raw(uid); m.status = 'Menunggu Verifikasi'; m.application.submittedAt = '2026-10-05T00:00:00Z'; H.put(uid, m);
      await H.asAdmin(); await S.admin.approve(uid, {});
      await H.as('tari.audit@contoh.id'); await H.tick(); r.approved = H.sess();
      r.file = await H.err(S.pustaka.fileUrl({ id: 'aplikasi-simulator', tautan: 'aplikasi/simulator/index.html', akses: 'anggota' }));
      await H.asAdmin(); await S.admin.deactivate(uid, 'Uji');
      await H.as('tari.audit@contoh.id'); await H.tick(); r.deact = H.sess();
      r.fileDeact = await H.err(S.pustaka.fileUrl({ id: 'aplikasi-simulator', tautan: 'aplikasi/simulator/index.html', akses: 'anggota' }));
      const c = PPAPI.session.current(); c.isAdmin = true; c.member.status = 'Aktif';
      r.copy = H.sess();
      await PPAPI.auth.signOut(); await H.tick();
      r.fileOut = await H.err(S.pustaka.fileUrl({ id: 'aplikasi-simulator', tautan: 'x' }));
      return r;
    });
    eq([SS.admin.isAdmin, SS.admin.isActive, SS.admin.status], [true, true, 'Draf'], 'admin (own member record Draf): isAdmin + isActive');
    eq(SS.out, { uid: null, status: '', isAdmin: false, isActive: false }, 'after sign-out: empty session');
    eq([SS.member.isAdmin, SS.member.status, SS.member.isActive], [false, 'Draf', false], 'next user on the same page: no stale admin flag');
    eq([SS.approved.status, SS.approved.isActive, SS.file], ['Aktif', true, 'NO ERROR'], 'after approval: Aktif, fileUrl allowed');
    eq([SS.deact.status, SS.deact.isActive, SS.fileDeact], ['Nonaktif', false, 'store/forbidden'], 'after deactivation: Nonaktif, fileUrl forbidden');
    eq([SS.copy.isAdmin, SS.copy.status], [false, 'Nonaktif'], 'session.current() returns a copy (caller mutation does not leak)');
    eq(SS.fileOut, 'store/forbidden', 'fileUrl after sign-out on the same page → forbidden');

    /* ---------------------------------------------------------------- XSS in render helpers */
    sect('XSS: ui.locked / lockedAction / statusBadge / drawer / modal escape data');
    const X = await pg.evaluate(async () => {
      const U = PPAPI.util, ui = PPAPI.ui, box = document.getElementById('sandbox');
      window.__pwn = 0;
      const P = '"><img src=x onerror="window.__pwn++">';
      box.insertAdjacentHTML('beforeend', '<div id="x1">' + ui.locked({ title: P, text: P, eyebrow: P, cls: P, icon: P }) + U.statusBadge(P) + U.statusBadge('constructor') + '</div>');
      const d = ui.drawer({ title: P, eyebrow: P, cls: 'x" onclick="window.__pwn++', actions: [{ label: P }] });
      d.setTitle(P);
      const imgs = document.querySelectorAll('#x1 img, .drawer img').length;
      d.close();
      const md = ui.modal({ title: P, eyebrow: P, actions: [{ label: P }] }); const mi = md.el.querySelectorAll('img').length; md.close();
      await new Promise(r => setTimeout(r, 50));
      return { imgs, mi, pwn: window.__pwn, tone: U.statusTone('constructor'), label: U.statusLabel('toString'), badgeCtor: /badge--muted/.test(U.statusBadge('constructor')) };
    });
    eq([X.imgs, X.mi, X.pwn], [0, 0, 0], 'no element injection from title/text/eyebrow/cls/icon/labels');
    eq([X.tone, X.label, X.badgeCtor], ['muted', '', true], "statusTone/statusLabel use own keys only ('constructor', 'toString' → muted / '')");

    /* ---------------------------------------------------------------- CSV injection */
    sect('exportMembersCsv: formula injection + quoting');
    const C = await pg.evaluate(() => {
      const S = PPAPI.store;
      const names = ['=HYPERLINK("http://evil","x")', '+62 812', '-1+1', '@SUM(A1)', '\t=1', '\r=1', '＝1+1', '＋1', 'a;b', 'baris\nbaru', 'ku"tip', 'koma, titik', 'Biasa'];
      const csv = S.admin.exportMembersCsv(names.map((n, i) => ({ uid: 'u' + i, name: n, status: 'Aktif', profile: { company: i === 0 ? '=cmd|"/c calc"!A0' : '' } })));
      const rows = csv.slice(1).split('\r\n');
      const parse = line => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ';') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
      /* re-join rows broken by quoted newlines */
      const joined = []; let buf = '';
      rows.forEach(rw => { buf = buf ? buf + '\r\n' + rw : rw; if ((buf.match(/"/g) || []).length % 2 === 0) { joined.push(buf); buf = ''; } });
      const data = joined.filter(Boolean).slice(1).map(parse);
      return { bom: csv.charCodeAt(0) === 0xFEFF, crlf: /\r\n$/.test(csv), cols: parse(joined[0]).length, names: data.map(r => r[1]), company: data[0][12], width: data.every(r => r.length === parse(joined[0]).length) };
    });
    ok(C.bom && C.crlf && C.cols >= 15 && C.width, 'UTF-8 BOM, CRLF, header width = row width');
    eq(C.names, ["'=HYPERLINK(\"http://evil\",\"x\")", "'+62 812", "'-1+1", "'@SUM(A1)", "'\t=1", "'\r=1", "'＝1+1", "'＋1", 'a;b', 'baris\nbaru', 'ku"tip', 'koma, titik', 'Biasa'], 'cells starting with = + - @ TAB CR (and full-width ＝ ＋ － ＠) get a leading apostrophe; ; " newline and , are quoted');
    eq(C.company, "'=cmd|\"/c calc\"!A0", 'DDE payload in another column neutralised');

    /* ---------------------------------------------------------------- registry privacy + KTA collisions */
    sect('Registry privacy + KTA uniqueness');
    const R = await pg.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, r = {};
      await H.asAdmin();
      const all = [];
      for (const q of ['PPAPI-2025-000318', 'Dimas', 'Tari', '2026', 'PPAPI-2026']) { const x = await S.registry.lookup(q); all.push(...(x.exact ? [x.exact] : []), ...x.matches); }
      r.keys = [...new Set(all.flatMap(e => Object.keys(e)))].sort();
      r.count = all.length;
      /* a v1 record carries an unofficial KTA (ktaFromUid) that collides with the static registry sample PPAPI-2026-000123 */
      const u = await H.signUp('Vina Versi Satu', 'vina.audit@contoh.id');
      await H.complete(u.uid, 'Vina Versi Satu');
      const m = H.raw(u.uid); m.kta = 'PPAPI-2026-000123'; m.status = 'Menunggu Verifikasi'; m.application.submittedAt = '2026-10-02T00:00:00Z'; H.put(u.uid, m);
      await H.asAdmin();
      const ap = await S.admin.approve(u.uid, {});
      r.v1kta = ap.kta;
      const look = await S.registry.lookup('PPAPI-2026-000123');
      r.sampleKept = look.exact && look.exact.nama;
      /* a never-approved v1 KTA that is NOT taken is kept (SPEC: existing KTAs are kept) */
      const u2 = await H.signUp('Yudi Versi Satu', 'yudi.audit@contoh.id');
      await H.complete(u2.uid, 'Yudi Versi Satu');
      const m2 = H.raw(u2.uid); m2.kta = 'PPAPI-2026-654321'; m2.status = 'Menunggu Verifikasi'; m2.application.submittedAt = '2026-10-02T00:00:00Z'; H.put(u2.uid, m2);
      await H.asAdmin();
      r.keptKta = (await S.admin.approve(u2.uid, {})).kta;
      const ktas = S.admin.listMembers ? (await S.admin.listMembers()).map(x => x.kta).filter(Boolean) : [];
      r.unique = new Set(ktas).size === ktas.length;
      const reg = JSON.parse(localStorage.getItem('ppapi_registry'));
      r.regRaw = Object.keys(reg[r.v1kta] || {}).includes('namaCari');
      return r;
    });
    ok(R.count > 3 && R.keys.every(k => ['berlakuHingga', 'contoh', 'kategori', 'kompetensi', 'kota', 'kta', 'nama', 'status'].includes(k)), 'lookup entries carry public fields only (no email/phone/uid/namaCari/updatedAt)', R.keys);
    ok(R.v1kta && R.v1kta !== 'PPAPI-2026-000123' && /^PPAPI-2026-\d{6}$/.test(R.v1kta), 'approve: a never-approved v1 KTA already used in the registry is replaced by a fresh sequential KTA', R.v1kta);
    ok(R.sampleKept && !/Vina/.test(R.sampleKept), 'the existing registry entry keeps its owner', R.sampleKept);
    eq([R.keptKta, R.unique, R.regRaw], ['PPAPI-2026-654321', true, true], 'a free v1 KTA is kept; all member KTAs unique; raw registry keeps namaCari internally only');

    /* ---------------------------------------------------------------- read-side sanitising */
    sect('Read-side sanitising (data written around the store, e.g. direct SDK/console writes)');
    const RS = await pg.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, r = {};
      const m = H.raw('demo-contoh-0001');
      m.photoURL = 'javascript:alert(1)';
      m.application.dokumen = [{ id: 'd1', jenis: '<b>', label: 7, url: 'javascript:alert(1)' }, { id: 'd2', jenis: 'CV', label: 'Ok', url: 'https://example.com/a.pdf' }, 'bukan objek'];
      m.application.pembayaran = { metode: 'x', tanggal: '2026-10-01', buktiUrl: 'data:text/html,<script>' };
      m.application.pengalaman = [{ id: 'p', proyek: { a: 1 }, peran: 5, tahun: 2024, lokasi: null }];
      m.application.pasFoto = 'data:image/svg+xml;base64,PHN2Zz4=';
      m.certificates = [{ id: 'c', title: 'T', link: 'javascript:alert(1)' }, { id: 'c2', title: 'U', link: 'https://example.com/s' }];
      m.competencies = [{ id: 'k', name: { x: 1 }, level: 'Dewa' }];
      H.put('demo-contoh-0001', m);
      await H.asAdmin();
      const g = await S.admin.getMember('demo-contoh-0001');
      r.photo = g.photoURL;
      r.dok = g.application.dokumen.map(d => [d.jenis, d.label, d.url]);
      r.bukti = g.application.pembayaran.buktiUrl;
      r.peng = g.application.pengalaman.map(p => [typeof p.proyek, p.peran, p.tahun, p.lokasi]);
      r.foto = g.application.pasFoto;
      r.cert = g.certificates.map(c => c.link);
      r.comp = g.competencies.map(c => [typeof c.name, c.level]);
      /* managed content written directly (Firestore console / old data) */
      localStorage.setItem('ppapi_content_pustaka', JSON.stringify([{ id: 'evil-doc', judul: 'Evil', kategori: 'Standar', ringkasan: 'x', akses: 'publik', tautan: 'javascript:alert(1)', tag: [] }]));
      localStorage.setItem('ppapi_content_agenda', JSON.stringify([{ id: 'evil-ag', judul: 'Evil', jenis: 'Seminar', mulai: '2026-12-01', lokasi: 'X', tautanDaftar: 'javascript:alert(1)' }]));
      localStorage.setItem('ppapi_content_berita', JSON.stringify([{ id: 'evil-br', judul: 'Evil', tanggal: '2026-10-01', ringkasan: 'x', gambar: 'javascript:alert(1)' }]));
      const pu = (await S.content.list('pustaka')).find(x => x.id === 'evil-doc');
      const ag = (await S.content.list('agenda')).find(x => x.id === 'evil-ag');
      const br = (await S.content.list('berita')).find(x => x.id === 'evil-br');
      r.content = [pu && pu.tautan, ag && ag.tautanDaftar, br && br.gambar];
      localStorage.setItem('ppapi_pustaka_files', JSON.stringify({ 'evil-doc': 'javascript:alert(1)' }));
      r.file = await S.pustaka.fileUrl(pu);
      return r;
    });
    eq(RS.photo, '', 'photoURL javascript: → ""');
    eq(RS.dok, [['Lainnya', '7', ''], ['CV', 'Ok', 'https://example.com/a.pdf']], 'dokumen: non-https url → "", unknown jenis → Lainnya, label string, non-object items dropped');
    eq([RS.bukti, RS.foto], ['', ''], 'buktiUrl non-https → ""; pasFoto non-image data URL → ""');
    eq(RS.peng, [['string', '5', '2024', '']], 'pengalaman fields coerced to strings');
    eq(RS.cert, ['', 'https://example.com/s'], 'certificate links: only http(s)');
    eq(RS.comp, [['string', 'Dasar']], 'competency shape (name string, level enum)');
    eq(RS.content, ['', '', ''], 'managed content: javascript: tautan / tautanDaftar / gambar → ""');
    eq(RS.file, '', 'fileUrl never returns a javascript: URL');

    /* ---------------------------------------------------------------- prototype-key ids */
    sect('Prototype-named ids (constructor, toString …)');
    const PK = await pg.evaluate(async () => {
      const S = PPAPI.store, r = {};
      localStorage.removeItem('ppapi_content_berita');
      const sv = await S.content.save('berita', { id: 'constructor', judul: 'Konstruktor', ringkasan: 'Uji id prototipe.', tanggal: '2026-10-08' });
      r.saved = sv && sv.id;
      r.listed = (await S.content.list('berita')).some(x => x.id === 'constructor');
      r.auto = (await S.content.save('berita', { judul: 'toString', ringkasan: 'Uji slug prototipe.' })).id;
      r.listed2 = (await S.content.list('berita')).some(x => x.id === r.auto);
      r.file = await S.pustaka.fileUrl({ id: 'constructor', akses: 'anggota', tautan: '' });
      r.fileType = typeof r.file;
      return r;
    });
    eq([PK.saved, PK.listed, PK.listed2, PK.fileType, PK.file], ['constructor', true, true, 'string', ''], "content ids 'constructor' / 'tostring' are listed; fileUrl({id:'constructor'}) → '' (not Object.prototype.constructor)");

    /* ---------------------------------------------------------------- admins */
    sect('Admins: add by email (ambiguity), feedback update keys');
    const AD = await pg.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, r = {};
      await H.asAdmin();
      /* two records share an email (only possible via direct writes) → refuse, never guess */
      const a = H.raw('demo-contoh-0002'); a.email = 'ganda@contoh.id'; H.put('demo-contoh-0002', a);
      const b = H.raw('demo-contoh-0004'); b.email = 'Ganda@contoh.id'; H.put('demo-contoh-0004', b);
      r.amb = await H.err(S.admin.addAdmin('ganda@contoh.id'));
      r.admins = JSON.parse(localStorage.getItem('ppapi_demo_admins'));
      const fb = await S.submitFeedback({ kategori: 'Saran', pesan: 'Pesan uji audit yang cukup panjang.' });
      const up = await S.admin.updateFeedback(fb.id, { status: 'Diproses', catatanAdmin: 'ok', pesan: 'diubah', kategori: 'Kritik', createdAt: 'x' });
      r.fb = [up.status, up.catatanAdmin, up.pesan, up.kategori];
      return r;
    });
    eq([AD.amb, AD.admins], ['store/ambiguous-email', ['demo-admin-0001']], 'addAdmin: an email shared by several records → store/ambiguous-email (no admin added)');
    eq(AD.fb, ['Diproses', 'ok', 'Pesan uji audit yang cukup panjang.', 'Saran'], 'updateFeedback only changes status + catatanAdmin');

    /* ---------------------------------------------------------------- seed duplicates */
    sect('Demo seed: no duplicates after reloads / repeated seeding');
    for (let i = 0; i < 3; i++) await open(pg, '__v2audit_public.html');
    const SD = await pg.evaluate(async () => {
      localStorage.removeItem('ppapi_demo_seed_v2');   /* force the seed path again */
      return true;
    });
    await open(pg, '__v2audit_public.html');
    await open(pg, '__v2audit_public.html');
    const SD2 = await pg.evaluate(() => {
      const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins'));
      const members = Object.keys(localStorage).filter(k => k.startsWith('ppapi_member_')).map(k => JSON.parse(localStorage.getItem(k)));
      const contoh = members.filter(m => m.contoh);
      const reg = JSON.parse(localStorage.getItem('ppapi_registry'));
      const users = JSON.parse(localStorage.getItem('ppapi_demo_users'));
      return { adminsUnique: new Set(admins).size === admins.length, adminCount: admins.filter(a => a === 'demo-admin-0001').length, contoh: contoh.length, contohUids: new Set(contoh.map(m => m.uid)).size, regKeys: Object.keys(reg).length === new Set(Object.keys(reg).map(k => k.toUpperCase())).size, adminUsers: Object.values(users).filter(u => u.uid === 'demo-admin-0001').length, s1: contoh.find(m => m.uid === 'demo-contoh-0001').status };
    });
    eq([SD, SD2.adminsUnique, SD2.adminCount, SD2.contoh, SD2.contohUids, SD2.regKeys, SD2.adminUsers], [true, true, 1, 4, 4, true, 1], 'admins list unique, 4 contoh records, unique registry keys, one admin account — also after the seed key is removed');
    eq(SD2.s1, 'Menunggu Verifikasi', 'reseeding never overwrites a sample the admin changed (sample record kept as is)');

    /* ---------------------------------------------------------------- gating chains / loops */
    sect('Gating chains (no redirect loops)');
    async function landing(start, setup) {
      const c = await newCtx();
      if (setup) await c.addInitScript(setup);
      const p = await c.newPage();
      watch(p, 'gate');
      await p.goto(`${BASE}/${start}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(2200);
      const first = rel(p.url());
      await p.waitForTimeout(1200);
      const second = rel(p.url());
      const toast = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent.trim()).join(' | '));
      await c.close();
      return { first, second, toast };
    }
    const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
    const AD1 = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
    const asMember = st => new Function(`localStorage.setItem('ppapi_demo_session', ${JSON.stringify(JSON.stringify(U))});
      localStorage.setItem('ppapi_member_demo-uji-0001', JSON.stringify(Object.assign({ uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', memberType: 'Praktisi', kta: '' }, ${JSON.stringify(st)})));`);
    const asAdminSess = new Function(`localStorage.setItem('ppapi_demo_session', ${JSON.stringify(JSON.stringify(AD1))}); localStorage.setItem('ppapi_demo_admins', '["demo-admin-0001"]');`);
    let L = await landing('__v2audit_admin.html');
    eq([L.first.split('?')[0], L.second === L.first], ['/masuk.html', true], 'signed out → admin page → masuk.html (stays)');
    L = await landing('__v2audit_active.html', asMember({ status: 'Draf' }));
    ok(L.first === '/dashboard.html' && L.second === L.first && /khusus anggota berstatus Aktif/.test(L.toast), 'Draf member → active page → dashboard.html, stays, flash toast', L);
    L = await landing('__v2audit_admin.html', asMember({ status: 'Aktif', validUntil: '2029-12-31', application: { submittedAt: '2026-03-01T00:00:00Z' } }));
    ok(L.first === '/dashboard.html' && L.second === L.first && /khusus admin PPAPI/.test(L.toast), 'active member → admin page → dashboard.html, stays, flash toast', L);
    L = await landing('masuk.html?next=__v2audit_admin.html', asMember({ status: 'Draf' }));
    ok(L.first === '/dashboard.html' && L.second === L.first, 'signed-in non-admin: masuk.html?next=admin page → admin page → dashboard (chain ends)', L);
    L = await landing('__v2audit_active.html', asAdminSess);
    eq([L.first, L.second], ['/__v2audit_active.html', '/__v2audit_active.html'], 'admin whose own membership is Draf → active page opens (admins see everything)');
    L = await landing('__v2audit_admin.html', asAdminSess);
    eq(L.first, '/__v2audit_admin.html', 'admin → admin page opens');
    L = await landing('__v2audit_active.html', asMember({ status: 'Menunggu Verifikasi', application: { submittedAt: '2026-10-01T00:00:00Z' }, validUntil: '2029-12-31', kta: 'PPAPI-2026-004821', approvedAt: '2026-01-01T00:00:00Z' }));
    eq(L.first, '/dashboard.html', 'renewal pending (Menunggu Verifikasi) → member features locked (documented SPEC behaviour)');

    await ctx.close();
  } finally {
    await browser.close();
    server.close();
    cleanup();
  }
  sect('Page errors during the audit');
  ok(!pageErrors.length, 'no page errors / console errors', pageErrors.length ? pageErrors.slice(0, 12) : undefined);
}

rulesChecks();
await browserChecks();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.map(f => ' - ' + f).join('\n')); process.exit(1); }
