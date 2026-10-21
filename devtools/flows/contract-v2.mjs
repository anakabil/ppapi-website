// PPAPI foundation — CONTRACT test v2 (SPEC-v2 §1–§3, demo mode).
// Run from devtools/:  node flows/contract-v2.mjs        (no internet needed; font 404s ignored)
//
// Node side : config v2 (apps/iuran/pustaka/masaBerlakuTahun/nav/footer), data/pustaka.js (§4.3),
//             organisasi.keanggotaan (langkah, bisaDiajukan), main.css v2 classes, styleguide coverage,
//             firestore.rules v2 constructs + whitelist/limits agreement with store.js.
// Browser   : clock frozen at 2026-10-09 10:00 WIB. Lifecycle util; demo seed (admin + 4 contoh, idempotent,
//             check.mjs --admin compatible); session per role/status; account menu; full lifecycle
//             (KTA PPAPI-2026-000001…, revision loop, reject → re-apply, deactivate/reactivate/extend,
//             expired → Kedaluwarsa → perpanjangan); admin guards; feedback/admins/audit/CSV; content
//             merge/override/hide/restore + sorting; registry lookup; pustaka.fileUrl; ui.locked; ui.drawer;
//             data-auth active/admin gating on throwaway site/__v2test_*.html pages (DELETED at the end).
// Exit code 1 when any check fails; every failure is listed at the end.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV = path.resolve(__dirname, '..');
const ROOT = path.resolve(DEV, '..', 'site');
const FIXED_NOW = new Date('2026-10-09T10:00:00+07:00');
const TODAY = '2026-10-09';
let PPAPI_STATIC_PUSTAKA = 0;

/* ------------------------------------------------------------------ report */
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

/* ================================================================ NODE SIDE */
function nodeChecks() {
  const sandbox = { console }; sandbox.window = sandbox; vm.createContext(sandbox);
  for (const f of ['js/config.js', 'data/organisasi.js', 'data/pustaka.js', 'data/regulasi.js']) {
    try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8'), sandbox, { filename: f }); }
    catch (e) { ok(false, `${f} runs`, e.message); }
  }
  const C = sandbox.PPAPI_CONFIG, D = sandbox.PPAPI_DATA;

  sect('config.js v2 (§3.1, §3.5)');
  eq(C.apps.map(a => [a.key, a.url]), [['perencanaan', 'aplikasi/perencanaan/index.html'], ['simulator', 'aplikasi/simulator/index.html']], 'apps[] = perencanaan + simulator with internal paths');
  ok(C.apps.every(a => a.title && a.desc && Array.isArray(a.fitur) && a.fitur.length >= 3), 'apps have title, desc and ≥3 fitur');
  // client rule 2026-10-10: the planning app title carries "(Beta)" (intentional change)
  eq(C.apps[0].title, 'PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur', 'planning app title per SPEC + client Beta rule');
  eq(C.apps[1].title, 'Simulator Pemasangan Perancah Tube & Coupler', 'simulator title per SPEC');
  ok(C.iuran && C.iuran.aktif === false && ['nominal', 'keterangan', 'rekening'].every(k => C.iuran[k] === ''), "iuran: { aktif:false, nominal:'', keterangan:'', rekening:'' }");
  ok(C.pustaka && C.pustaka.katalogPublik === true, 'pustaka.katalogPublik = true');
  eq(C.masaBerlakuTahun, 3, 'masaBerlakuTahun = 3');
  eq(C.nav.map(n => n.key + ':' + n.label + ':' + n.href), ['beranda:Beranda:index.html', 'profil:Profil:profil.html', 'berita:Berita:berita.html', 'agenda:Agenda:agenda.html', 'pustaka:Pengetahuan:pustaka.html', 'instruktur:Instruktur:instruktur.html', 'keanggotaan:Keanggotaan:keanggotaan.html', 'toko:Toko:toko.html', 'umpan-balik:Kontak:umpan-balik.html'], 'nav (since 2026-10-21 + Instruktur, Toko): Beranda, Profil, Berita, Agenda, Pengetahuan (pustaka.html), Instruktur, Keanggotaan, Toko, Kontak');
  const foot = Object.values(C.footerLinks).flat().map(l => l.label + '|' + l.href);
  ok(['Produk Pengetahuan|pustaka.html', 'Regulasi & Standar|regulasi.html', 'Verifikasi Anggota|verifikasi.html', 'Formulir Pendaftaran|pendaftaran.html'].every(x => foot.includes(x)), 'footer: Produk Pengetahuan, Regulasi, Verifikasi, Formulir Pendaftaran', foot);
  const cfgSrc = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8');
  ok(/masaBerlakuTahun[\s\S]{0,40}/.test(cfgSrc) && /Iuran keanggotaan/.test(cfgSrc) && /katalogPublik: true  =/.test(cfgSrc), 'config.js v2 keys have Indonesian comments');

  sect('data/pustaka.js (§4.3)');
  const P = D.pustaka || [];
  PPAPI_STATIC_PUSTAKA = P.length;
  const KAT = ['Standar', 'Code of Practice', 'Petunjuk Teknis', 'Modul Pelatihan', 'Formulir & Daftar Periksa', 'Kajian Teknis', 'Aplikasi'];
  const FIELDS = ['id', 'judul', 'kategori', 'kode', 'versi', 'tanggal', 'status', 'ringkasan', 'penyusun', 'format', 'halaman', 'akses', 'tautan', 'tag', 'contoh'];
  ok(P.length === 2, `pustaka: ${P.length} items — only the two real member apps (sample drafts removed 2026-10-15)`);
  ok(P.every(p => FIELDS.every(k => k in p)), 'every item has all §4.3 fields');
  ok(new Set(P.map(p => p.id)).size === P.length && P.every(p => /^[a-z0-9-]+$/.test(p.id)), 'ids unique slugs');
  ok(P.every(p => KAT.includes(p.kategori) && ['Berlaku', 'Draf', 'Dalam Penyusunan'].includes(p.status) && ['anggota', 'publik'].includes(p.akses) && Array.isArray(p.tag)), 'kategori/status/akses enums, tag[]');
  ok(P.every(p => p.kategori === 'Aplikasi'), 'no document items yet (collections are filled via Konsol Admin or pustaka.js)');
  const apps = P.filter(p => p.kategori === 'Aplikasi');
  eq(apps.map(a => [a.app, a.tautan, a.contoh, a.akses]), [['perencanaan', 'aplikasi/perencanaan/index.html', false, 'anggota'], ['simulator', 'aplikasi/simulator/index.html', false, 'anggota']], 'two REAL app items (contoh:false) pointing at the internal apps');
  ok(P.every(p => p.contoh === false), 'no contoh:true item remains in the static catalogue');
  ok(P.every((p, i) => i === 0 || KAT.indexOf(P[i - 1].kategori) <= KAT.indexOf(p.kategori)), 'file order follows the kategori order');
  const pSrc = fs.readFileSync(path.join(ROOT, 'assets/data/pustaka.js'), 'utf8');
  ok(/^\/\*[\s\S]*CARA MENAMBAH[\s\S]*pustaka\/[\s\S]*KHUSUS ANGGOTA[\s\S]*Konsol Admin[\s\S]*\*\//.test(pSrc), 'Indonesian header: how to add, public files in pustaka/, member-only via admin link');
  ok(!/Komisi/.test(pSrc), 'no invented committee names');

  sect('organisasi.keanggotaan (§4.5 keanggotaan flow)');
  const K = D.organisasi.keanggotaan;
  eq(K.langkah.map(l => l.judul), ['Buat akun', 'Isi formulir pendaftaran', 'Verifikasi sekretariat', 'Aktif & KTA digital', 'Akses fitur anggota'], 'langkah reflects the real flow');
  eq(K.kategori.map(k => [k.nama, k.bisaDiajukan !== false]), [['Praktisi', true], ['Ahli', true], ['Mitra Korporat', true], ['Kehormatan', false]], 'Kehormatan cannot be applied for (bisaDiajukan:false)');

  sect('main.css v2 components');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const have = new Set((css.match(/\.[A-Za-z_][\w-]*/g) || []).map(s => s.slice(1)));
  const V2 = `locked locked__icon locked__eyebrow locked__title locked__text locked__actions locked--compact locked--center locked-veil locked-veil__content
    status-track status-track--vertical status-track__step status-track__node status-track__label status-track__meta is-done is-current is-error is-warn
    stepper stepper__compact stepper__count stepper__current stepper__bar stepper__list stepper__item stepper__btn stepper__num stepper__text stepper__label stepper__hint
    drawer drawer__backdrop drawer__panel drawer__panel--sm drawer__panel--lg drawer__header drawer__title drawer__eyebrow drawer__body drawer__footer drawer__section drawer__section-title
    kpi kpi__head kpi__label kpi__icon kpi__value kpi__note kpi--ok kpi--warn kpi--err kpi--accent
    doc-card doc-card--locked doc-card--feature doc-card__top doc-card__kind doc-card__code doc-card__title doc-card__summary doc-card__meta doc-card__foot doc-card__access doc-card__media doc-card__body
    account-menu__status`.split(/\s+/).filter(Boolean);
  const miss = V2.filter(c => !have.has(c));
  ok(!miss.length, `all ${V2.length} v2 class names exist`, miss.length ? miss : undefined);
  ok(/body:is\(\[data-auth="required"\], \[data-auth="active"\], \[data-auth="admin"\]\):not\(\.auth-ready\) main/.test(css), 'gated main hidden for required/active/admin before auth-ready');
  ok(/prefers-reduced-motion: reduce[\s\S]*\.doc-card:hover/.test(css), 'reduced motion neutralises doc-card/kpi hover lift');
  const sg = fs.readFileSync(path.join(ROOT, 'styleguide.html'), 'utf8');
  ok(['status-track', 'stepper', 'locked', 'locked-veil', 'kpi', 'doc-card', 'doc-card--feature', 'data-sg-drawer', 'data-sg="status-badges"'].every(c => sg.includes(c)), 'styleguide shows every v2 component');

  sect('firestore.rules v2 (§3.4) vs store.js');
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  const store = fs.readFileSync(path.join(ROOT, 'assets/js/store.js'), 'utf8');
  ok(/function isAdmin\(\)[\s\S]*?exists\(\/databases\/\$\(database\)\/documents\/admins\/\$\(request\.auth\.uid\)\)/.test(rules), 'isAdmin() = exists(admins/{auth.uid})');
  ok(/function isActiveMember\(\)[\s\S]*?\.data\.status == 'Aktif'/.test(rules), "isActiveMember() reads members/{auth.uid}.status == 'Aktif'");
  const ownerKeys = (/(?:affectedKeys\(\)|changed)\.hasOnly\(\[([\s\S]*?)\]\)/.exec(rules.slice(rules.indexOf('function ownerUpdate'))) || [])[1];
  const ok1 = ownerKeys && ownerKeys.replace(/[\s']/g, '').split(',').sort().join();
  const editable = (/var EDITABLE = \{([^}]*)\}/.exec(store) || [])[1].match(/(\w+):/g).map(s => s.slice(0, -1));
  eq(ok1, editable.concat(['application', 'status', 'updatedAt']).sort().join(), 'owner update whitelist = store EDITABLE + application/status/updatedAt');
  ok(/'Draf', 'Perlu Perbaikan', 'Ditolak'\]\s*&& after\.status == 'Menunggu Verifikasi' && submitted\(after\)/.test(rules) && /renewable\(before\) && after\.status == 'Menunggu Verifikasi'[\s\S]{0,160}'perpanjangan'/.test(rules) && /before\.status == 'Menunggu Verifikasi' && after\.status == 'Draf' && !submitted\(after\)/.test(rules), 'owner transitions: submit, perpanjangan, withdraw only');
  ok(/request\.resource\.data\.status == 'Draf'/.test(rules) && /request\.resource\.data\.get\('kta', ''\) == ''/.test(rules) && /!submitted\(request\.resource\.data\)/.test(rules), "create: status 'Draf', kta '', not submitted");
  ok(['content_berita', 'content_pengumuman', 'content_agenda', 'content_pustaka', 'content_regulasi'].every(c => new RegExp(`match /${c}/\\{id\\} \\{\\s*allow read: if true;\\s*allow write: if isAdmin\\(\\);`).test(rules)), 'content_<type>: read anyone, write admin');
  ok(/match \/pustaka_files\/\{id\} \{\s*allow read: if isAdmin\(\) \|\| isActiveMember\(\);/.test(rules), 'pustaka_files: read admin or active member');
  ok(/match \/registry\/\{kta\} \{\s*allow get: if true;\s*allow list: if request\.query\.limit <= 20;/.test(rules) && /match \/counters\/\{id\} \{\s*allow read: if isAdmin\(\);/.test(rules) && /match \/audit_log\/\{id\} \{\s*allow read: if isAdmin\(\);[\s\S]*?allow update, delete: if false;/.test(rules), 'registry: public get + bounded list (≤ 20); counters + audit_log admin-only; audit append-only');
  ok(/match \/feedback\/\{id\} \{\s*allow create: if validFeedback[\s\S]*?allow read: if isAdmin\(\);[\s\S]*?allow delete: if false;/.test(rules), 'feedback: create anyone, read/update admin, no delete');
  ok(/match \/admins\/\{uid\} \{[\s\S]*?allow get: if isOwner\(uid\) \|\| isAdmin\(\);\s*allow list: if isAdmin\(\);/.test(rules), 'admins: get self/admin, list admin');
  const lim = JSON.parse('{' + /var LIMITS = \{([^}]*)\}/.exec(store)[1].replace(/(\w+):/g, '"$1":') + '}');
  ok(rules.includes(`listMax(a.get('pengalaman', null), ${lim.pengalaman})`) && rules.includes(`listMax(a.get('dokumen', null), ${lim.dokumen})`) && rules.includes(`strMax(a.get('catatan', ''), ${lim.catatan})`), 'application limits identical in store.js and rules (pengalaman/dokumen/catatan)', lim);
  ok(/function jpegDataUrl\(s\)[\s\S]*?s\.size\(\) <= 164000[\s\S]*?data:image\/jpeg;base64/.test(rules) && /jpegDataUrl\(a\.pasFoto\)/.test(rules) && /jpegDataUrl\(request\.resource\.data\.data\)/.test(rules) && Math.ceil(lim.pasFotoKB * 1024 / 3) * 4 + 32 <= 164000, 'pas foto limit (JPEG only; members.application + member_photos): store max data-URL length fits the rules limit');
  const regKeys = (/match \/registry\/\{kta\}[\s\S]*?hasOnly\(\[([\s\S]*?)\]\)/.exec(rules) || [])[1].replace(/[\s']/g, '').split(',');
  const regEntry = /function registryEntry\(m, overrides\) \{[\s\S]*?var e = \{([\s\S]*?)\};/.exec(store)[1].match(/(\w+):/g).map(s => s.slice(0, -1)).concat(['contoh']);
  ok(regEntry.every(k => regKeys.includes(k)) && !regKeys.some(k => ['email', 'phone', 'uid', 'alamat'].includes(k)), 'registry entry keys ⊆ rules whitelist, no private fields', { regEntry, regKeys });
  ok(/runTransaction/.test(store) && /counters'\)\.doc\('kta-' \+ year\)/.test(store), 'Firebase KTA counter via runTransaction on counters/kta-YYYY');

  /* integration 2026-10-21: the four feature fragments (devtools/rules-fragments/*.rules) are merged verbatim
     (comments aside) before the closing deny-all; function names stay unique; the file stays far below 256 KB */
  const strip = t => t.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
  const merged = strip(rules);
  const FRAG = ['instruktur', 'kegiatan', 'toko', 'appdata'];
  const fragDir = path.join(DEV, 'rules-fragments');
  const fragMissing = FRAG.filter(f => { const fp = path.join(fragDir, f + '.rules'); return fs.existsSync(fp) && !merged.includes(strip(fs.readFileSync(fp, 'utf8'))); });
  ok(!fragMissing.length, 'rules fragments merged verbatim: instruktur, kegiatan, toko, appdata', fragMissing);
  const catchAll = rules.indexOf('match /{document=**}');
  const NEWCOLL = ['instructors/{id}', 'instructor_contacts/{id}', 'instructor_requests/{id}', 'events/{eid}', 'certificates/{no}', 'products/{id}', 'product_media/{id}', 'product_files/{id}', 'entitlements/{eid}', 'orders/{id}', 'shop_settings/{id}', 'carts/{uid}', 'app_data/{uid}/{coll}/{docId}'];
  const misplaced = NEWCOLL.filter(c => { const i = rules.indexOf('match /' + c + ' {'); return i < 0 || i > catchAll; });
  ok(!misplaced.length && catchAll > 0 && rules.lastIndexOf('match /{document=**}') === catchAll, 'new collections matched before the single closing deny-all', misplaced);
  const fnNames = [...rules.matchAll(/function (\w+)\(/g)].map(m => m[1]);
  ok(new Set(fnNames).size === fnNames.length, 'firestore.rules: every function name is unique (' + fnNames.length + ')', fnNames.filter((f, i) => fnNames.indexOf(f) !== i));
  const rulesBytes = Buffer.byteLength(rules, 'utf8');
  ok(rulesBytes < 256 * 1024, 'firestore.rules size ' + Math.round(rulesBytes / 1024) + ' KB < 256 KB');
  const code = rules.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/\/\/.*$/gm, '');
  const balanced = [['{', '}'], ['(', ')'], ['[', ']']].every(([o, c]) => code.split(o).length === code.split(c).length);
  ok(balanced, 'firestore.rules: brackets balanced after the merge');
}

/* ============================================================= BROWSER SIDE */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const TEST_FILES = [];
function writeTestPage(name, { key = 'beranda', auth = 'public', main = '', inline = '' }) {
  const html = `<!doctype html>
<html lang="id" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Uji Kontrak v2 — PPAPI</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="assets/css/main.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
</head>
<body data-page="${key}" data-auth="${auth}">
  <a class="skip-link" href="#main">Lewati ke konten utama</a>
  <div id="site-header"></div>
  <main id="main" tabindex="-1"><section class="page-hero page-hero--compact"><div class="container page-hero__inner"><h1 class="h1">Uji ${auth}</h1></div></section><section class="section"><div class="container" id="sandbox">${main}</div></section></main>
  <div id="site-footer"></div>
  ${inline ? `<script>${inline}</script>` : ''}
  <script src="assets/js/config.js" defer></script>
  <script src="assets/data/berita.js" defer></script>
  <script src="assets/data/agenda.js" defer></script>
  <script src="assets/data/regulasi.js" defer></script>
  <script src="assets/data/organisasi.js" defer></script>
  <script src="assets/data/registry.js" defer></script>
  <script src="assets/data/pustaka.js" defer></script>
  <script src="assets/js/core.js" defer></script>
  <script src="assets/js/auth.js" defer></script>
  <script src="assets/js/store.js" defer></script>
</body>
</html>`;
  const file = path.join(ROOT, name);
  fs.writeFileSync(file, html);
  TEST_FILES.push(file);
}
function cleanupTestFiles() {
  for (const f of fs.readdirSync(ROOT)) if (/^__v2test_.*\.html$/.test(f)) { try { fs.unlinkSync(path.join(ROOT, f)); } catch (e) { /* ignore */ } }
}
const READY_LOG = `window.__ready=null;document.addEventListener('DOMContentLoaded',function(){PPAPI.onReady(function(){window.__ready={session:PPAPI.session.current(),authReady:document.body.classList.contains('auth-ready')};});});`;

/* helpers injected into the page (window.__h) */
const HELPERS = () => {
  const S = PPAPI.store, A = PPAPI.auth;
  window.__h = {
    async err(p) { try { await p; return 'NO ERROR'; } catch (e) { return e.code || e.message; } },
    async signUp(name, email) { return A.signUpEmail({ name, email, password: 'Perancah2026' }); },
    async signIn(email, password) { return A.signInEmail({ email, password: password || 'Perancah2026' }); },
    async asAdmin() { await A.signOut(); return A.signInEmail({ email: 'admin@ppapi.demo', password: 'AdminPPAPI2026' }); },
    async as(email) { await A.signOut(); return A.signInEmail({ email, password: 'Perancah2026' }); },
    async complete(uid, name, kategori) {
      await S.saveMember(uid, { name, phone: '0812-1111-2222', profile: { birthPlace: 'Bandung', birthDate: '1990-01-02', gender: 'Laki-laki', province: 'Jawa Barat', city: 'Bandung', company: 'PT Uji Perancah', position: 'Teknisi', experienceYears: 5 } });
      return S.saveApplication(uid, { kategori: kategori || 'Praktisi', pengalaman: [{ proyek: 'Proyek uji', peran: 'Teknisi', tahun: '2024', lokasi: 'Bandung' }], dokumen: [{ jenis: 'CV', label: 'Daftar riwayat hidup', url: 'https://example.com/cv.pdf' }], pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: name } });
    },
    menu() { return [...document.querySelectorAll('#account-menu [role=menuitem]')].map(x => x.textContent.trim()); },
    sess() { const s = PPAPI.session.current(); return { uid: s.user && s.user.uid, status: s.status, isAdmin: s.isAdmin, isActive: s.isActive, isMemberActive: s.isMemberActive, label: s.statusLabel }; },
    tick(ms) { return new Promise(r => setTimeout(r, ms || 60)); }
  };
};

async function browserChecks() {
  cleanupTestFiles();
  writeTestPage('__v2test_public.html', { key: 'regulasi', auth: 'public' });
  writeTestPage('__v2test_required.html', { key: 'dashboard', auth: 'required', inline: READY_LOG });
  writeTestPage('__v2test_active.html', { key: 'anggota', auth: 'active', inline: READY_LOG });
  writeTestPage('__v2test_admin.html', { key: 'admin', auth: 'admin', inline: READY_LOG });

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end('<!doctype html><title>404</title><p>nf</p>'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const pageErrors = [];
  async function newCtx(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce', ...opts });
    await ctx.clock.setFixedTime(FIXED_NOW);
    return ctx;
  }
  function watch(page, label) {
    page.on('pageerror', e => pageErrors.push(`${label}: ${e.message}`));
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/Failed to load resource|ERR_/.test(m.text())) pageErrors.push(`${label}: console.${m.type()} ${m.text()}`); });
  }
  async function open(page, file) {
    await page.goto(`${BASE}/${file}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());
    await page.evaluate(HELPERS);
  }
  const url = p => p.replace(BASE, '');
  try {
    /* ------------------------------------------------------- util */
    const ctx = await newCtx();
    const page = await ctx.newPage();
    watch(page, 'public');
    await open(page, '__v2test_public.html');

    sect('PPAPI.util lifecycle helpers (§1, §3.1)');
    const U = await page.evaluate(() => {
      const u = PPAPI.util;
      const sub = { submittedAt: '2026-10-01T00:00:00Z' };
      return {
        eff: [null, { status: 'Draf' }, { status: 'Menunggu Verifikasi' }, { status: 'Menunggu Verifikasi', application: sub }, { status: 'Aktif' }, { status: 'Aktif', validUntil: '2026-10-08' }, { status: 'Aktif', validUntil: '2026-10-09' }, { status: 'Aktif', validUntil: '2029-12-31' }, { status: 'Nonaktif' }, { status: 'Hilang' }].map(m => u.effectiveStatus(m)),
        active: [{ status: 'Aktif' }, { status: 'Aktif', validUntil: '2026-01-01' }, { status: 'Perlu Perbaikan' }, null].map(m => u.isActiveMember(m)),
        badges: ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Aktif', 'Ditolak', 'Nonaktif', 'Kedaluwarsa'].map(s => /badge--(\w+)/.exec(u.statusBadge(s))[1]),
        badgeHtml: u.statusBadge('Aktif'), badgeEsc: u.statusBadge('<b>x</b>'), badgeEmpty: u.statusBadge(''),
        labels: ['Draf', 'Kedaluwarsa'].map(s => u.statusLabel(s)),
        renew: [{ status: 'Aktif', validUntil: '2026-12-08' }, { status: 'Aktif', validUntil: '2026-12-09' }, { status: 'Aktif', validUntil: '2026-01-01' }, { status: 'Nonaktif' }, { status: 'Aktif' }, { status: 'Draf' }].map(m => u.canRenew(m)),
        until: u.defaultValidUntil(),
        lists: [u.MEMBER_STATUSES.length, u.PROVINSI.length, new Set(u.PROVINSI).size, u.PENDIDIKAN.length, u.GENDER.join()]
      };
    });
    eq(U.eff, ['', 'Draf', 'Draf', 'Menunggu Verifikasi', 'Aktif', 'Kedaluwarsa', 'Aktif', 'Aktif', 'Nonaktif', 'Draf'], 'effectiveStatus: Kedaluwarsa when validUntil < today; v1 pending without submittedAt → Draf; missing validUntil = active');
    eq(U.active, [true, false, false, false], 'isActiveMember ⇔ effectiveStatus === Aktif');
    eq(U.badges, ['muted', 'warn', 'warn', 'ok', 'err', 'err', 'err'], 'statusBadge tones: Aktif ok; Menunggu/Perlu Perbaikan warn; Ditolak/Nonaktif/Kedaluwarsa err; Draf muted');
    eq(U.badgeHtml, '<span class="badge badge--ok" data-status="Aktif">Aktif</span>', 'statusBadge markup');
    ok(!/<b>/.test(U.badgeEsc) && U.badgeEmpty === '', 'statusBadge escapes data; empty status → ""');
    ok(U.labels.every(l => l.length > 10), 'statusLabel gives Indonesian descriptions', U.labels);
    eq(U.renew, [true, false, true, true, false, false], 'canRenew: Aktif ≤60 days, Kedaluwarsa, Nonaktif');
    eq(U.until, '2029-12-31', 'defaultValidUntil = 31 Dec (this year + masaBerlakuTahun)');
    eq(U.lists, [6, 38, 38, 10, 'Laki-laki,Perempuan'], 'util.MEMBER_STATUSES (6), PROVINSI (38 unique), PENDIDIKAN (10), GENDER');

    sect('Demo seed (§2) — admin + 4 contoh, idempotent');
    const SD = await page.evaluate(async () => {
      const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
      const m = uid => JSON.parse(localStorage.getItem('ppapi_member_' + uid) || 'null');
      const samples = ['demo-contoh-0001', 'demo-contoh-0002', 'demo-contoh-0003', 'demo-contoh-0004'].map(m);
      return {
        seed: !!localStorage.getItem('ppapi_demo_seed_v2'), admins: JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]'),
        admin: users['admin@ppapi.demo'] && { uid: users['admin@ppapi.demo'].uid, name: users['admin@ppapi.demo'].name, hash: /^[0-9a-f]{64}$/.test(users['admin@ppapi.demo'].hash) },
        samples: samples.map(s => s && [s.status, s.contoh, /\(Contoh\)$/.test(s.name), s.kta]),
        reg: Object.keys(JSON.parse(localStorage.getItem('ppapi_registry') || '{}')),
        perbaikanNote: samples[1] && samples[1].review.note.length > 10,
        mvApp: samples[0] && [samples[0].application.kategori, samples[0].application.pengalaman.length, samples[0].application.dokumen.length, !!samples[0].application.submittedAt],
        demoAdmin: PPAPI.auth.demoAdmin, target: PPAPI.auth.postSignUpTarget, storeV: PPAPI.store.version
      };
    });
    ok(SD.seed && SD.admins.includes('demo-admin-0001'), 'ppapi_demo_seed_v2 written; ppapi_demo_admins includes demo-admin-0001');
    eq(SD.admin, { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', hash: true }, 'admin@ppapi.demo seeded with SHA-256 password hash');
    eq(SD.samples, [['Menunggu Verifikasi', true, true, ''], ['Perlu Perbaikan', true, true, ''], ['Aktif', true, true, 'PPAPI-2025-000318'], ['Ditolak', true, true, '']], '4 contoh members: Menunggu Verifikasi, Perlu Perbaikan (note), Aktif (KTA), Ditolak — names "(Contoh)"');
    ok(SD.perbaikanNote && SD.reg.includes('PPAPI-2025-000318'), 'Perlu Perbaikan sample has an admin note; Aktif sample has a registry entry');
    eq(SD.mvApp, ['Praktisi', 2, 2, true], 'Menunggu Verifikasi sample: kategori Praktisi with experience + documents, submitted');
    eq([SD.demoAdmin, SD.target, SD.storeV], [{ email: 'admin@ppapi.demo', password: 'AdminPPAPI2026', name: 'Admin PPAPI (Demo)' }, 'pendaftaran.html', 2], 'auth.demoAdmin, auth.postSignUpTarget = pendaftaran.html, store.version 2');

    /* ------------------------------------------- lifecycle (member) */
    sect('Lifecycle: Draf → submit (validation) → withdraw → submit (§1, §3.3)');
    const L1 = await page.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, r = {};
      const u = await H.signUp('Agus Pemohon', 'agus.pemohon@contoh.id');
      await H.tick();
      r.sess0 = H.sess(); r.menu0 = H.menu();
      const m0 = await S.getMember(u.uid);
      r.m0 = [m0.status, m0.kta, m0.memberType, m0.validUntil, m0.application.type, m0.review.history.length, m0.joinedAt];
      try { await S.submitApplication(u.uid); r.inc = 'NO ERROR'; } catch (e) { r.inc = [e.code, e.missing, e.fields.map(f => f.step)]; }
      r.photoBad = await H.err(S.saveApplication(u.uid, { pasFoto: 'data:image/svg+xml;base64,PHN2Zz4=' }));
      r.photoBig = await H.err(S.saveApplication(u.uid, { pasFoto: 'data:image/jpeg;base64,' + 'A'.repeat(170000) }));
      const sa = await S.saveApplication(u.uid, { kategori: 'Kehormatan', dokumen: [{ jenis: 'Aneh', label: 'Skrip', url: 'javascript:alert(1)' }], pengalaman: new Array(14).fill({ proyek: 'P' }), catatan: 'x'.repeat(1500), pernyataan: { kodeEtik: 'ya' }, extra: 1 });
      r.sanitised = [sa.application.kategori, sa.application.dokumen[0].jenis, sa.application.dokumen[0].url, sa.application.pengalaman.length, sa.application.catatan.length, sa.application.pernyataan.kodeEtik, 'extra' in sa.application];
      const missKeh = S.applicationMissing(sa).map(x => x.key);
      r.kehormatan = missKeh.includes('kategori');
      await H.complete(u.uid, 'Agus Pemohon');
      r.missingAfter = S.applicationMissing(await S.getMember(u.uid));
      const sub = await S.submitApplication(u.uid);
      await H.tick();
      r.sub = [sub.status, !!sub.application.submittedAt, sub.application.type, sub.application.pernyataan.tanggal, sub.review.history.map(x => x.action)];
      r.sess1 = H.sess();
      r.locked = await H.err(S.saveApplication(u.uid, { catatan: 'ubah' }));
      r.again = await H.err(S.submitApplication(u.uid));
      const wd = await S.withdrawApplication(u.uid);
      r.wd = [wd.status, wd.application.submittedAt, wd.review.history.map(x => x.action)];
      r.wd2 = await H.err(S.withdrawApplication(u.uid));
      r.editAfterWd = (await S.saveApplication(u.uid, { catatan: 'Siap diverifikasi.' })).application.catatan;
      const sub2 = await S.submitApplication(u.uid);
      r.sub2 = sub2.status;
      r.otherUid = await H.err(S.saveApplication('demo-contoh-0001', { catatan: 'x' }));
      r.uid = u.uid;
      return r;
    });
    eq(L1.m0, ['Draf', '', 'Praktisi', '', 'baru', 0, TODAY], "new account: status 'Draf', kta '', Praktisi placeholder, empty application/review");
    eq(L1.sess0, { uid: L1.uid, status: 'Draf', isAdmin: false, isActive: false, isMemberActive: false, label: 'Formulir pendaftaran belum diajukan' }, 'session after sign-up (refreshed automatically): Draf, not active');
    eq(L1.menu0, ['Dasbor', 'Formulir Pendaftaran', 'Kegiatan Saya', 'Pesanan Saya', 'Keluar'], 'account menu (non-active): Dasbor, Formulir Pendaftaran, Kegiatan Saya, Pesanan Saya, Keluar');
    ok(Array.isArray(L1.inc) && L1.inc[0] === 'store/application-incomplete' && L1.inc[1].includes('Kategori keanggotaan') && L1.inc[1].includes('Nomor HP') && L1.inc[1].includes('Nama terang (tanda tangan)') && L1.inc[2].includes('pernyataan'), 'submitApplication incomplete → store/application-incomplete with Indonesian .missing[] + .fields[{step}]', L1.inc);
    eq([L1.photoBad, L1.photoBig], ['store/invalid-photo', 'store/photo-too-large'], 'pas foto: only JPEG/PNG/WebP data URLs ≤120 KB');
    eq(L1.sanitised, ['', 'Lainnya', '', 10, 1000, false, false], 'saveApplication whitelists + limits (kategori Kehormatan not stored — audit-v2, dokumen jenis, https-only url, pengalaman ≤10, catatan ≤1000, booleans, unknown keys dropped)');
    ok(L1.kehormatan, 'Kehormatan (bisaDiajukan:false) is not a valid applied kategori');
    eq(L1.missingAfter, [], 'complete application → applicationMissing() is empty');
    eq(L1.sub, ['Menunggu Verifikasi', true, 'baru', TODAY, ['diajukan']], "submit → 'Menunggu Verifikasi', submittedAt, pernyataan.tanggal = today, history 'diajukan' (demo)");
    eq([L1.sess1.status, L1.sess1.isActive], ['Menunggu Verifikasi', false], 'session refreshed after submit');
    eq([L1.locked, L1.again], ['store/application-locked', 'store/invalid-transition'], 'application locked while verifying; second submit rejected');
    eq(L1.wd, ['Draf', '', ['diajukan', 'ditarik']], "withdraw → 'Draf', submittedAt cleared, history 'ditarik'");
    eq([L1.wd2, L1.editAfterWd, L1.sub2], ['store/invalid-transition', 'Siap diverifikasi.', 'Menunggu Verifikasi'], 'withdraw only from Menunggu Verifikasi; editable again; re-submit');
    eq(L1.otherUid, 'store/forbidden', "saveApplication on someone else's record → store/forbidden");

    sect('Admin guards — every store.admin.* / content write throws store/forbidden for non-admins');
    const G = await page.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, A = S.admin;
      const calls = {
        listMembers: () => A.listMembers(), getMember: () => A.getMember('demo-contoh-0001'), approve: () => A.approve('demo-contoh-0001', {}),
        requestRevision: () => A.requestRevision('demo-contoh-0001', 'catatan uji'), reject: () => A.reject('demo-contoh-0001', 'alasan uji'),
        deactivate: () => A.deactivate('demo-contoh-0003', ''), reactivate: () => A.reactivate('demo-contoh-0003', {}), extend: () => A.extend('demo-contoh-0003', '2030-01-01'),
        setMemberType: () => A.setMemberType('demo-contoh-0003', 'Ahli'), listFeedback: () => A.listFeedback(), updateFeedback: () => A.updateFeedback('x', { status: 'Selesai' }),
        listAdmins: () => A.listAdmins(), addAdmin: () => A.addAdmin('agus.pemohon@contoh.id'), removeAdmin: () => A.removeAdmin('demo-admin-0001'), audit: () => A.audit(), summary: () => A.summary(),
        contentSave: () => S.content.save('berita', { judul: 'X', ringkasan: 'Y' }), contentRemove: () => S.content.remove('berita', 'x'), contentRestore: () => S.content.restore('berita', 'x')
      };
      const out = {};
      for (const k of Object.keys(calls)) out[k] = await H.err(calls[k]());
      const still = JSON.parse(localStorage.getItem('ppapi_member_demo-contoh-0001')).status;
      await PPAPI.auth.signOut();
      out.signedOut = await H.err(A.listMembers());
      out.still = still;
      return out;
    });
    const notForbidden = Object.entries(G).filter(([k, v]) => k !== 'still' && v !== 'store/forbidden');
    ok(!notForbidden.length, `all ${Object.keys(G).length - 1} admin/content calls → store/forbidden (member and signed out)`, notForbidden.length ? notForbidden : undefined);
    eq(G.still, 'Menunggu Verifikasi', 'forbidden calls changed nothing');

    sect('Admin console flows: approve (KTA sequence), registry, audit (§1.2, §3.3)');
    const AD = await page.evaluate(async (agusUid) => {
      const H = window.__h, S = PPAPI.store, A = S.admin, r = {};
      await H.asAdmin();
      await H.tick();
      r.sess = H.sess(); r.menu = H.menu();
      r.isAdmin = await PPAPI.auth.isAdmin();
      const all = await A.listMembers();
      r.order = all.slice(0, 2).map(m => m.uid);
      r.pendingFirst = all.findIndex(m => m.status !== 'Menunggu Verifikasi') === all.filter(m => m.status === 'Menunggu Verifikasi').length;
      r.filter = (await A.listMembers({ status: 'Perlu Perbaikan' })).map(m => m.uid);
      r.q = (await A.listMembers({ q: 'wulandari' })).map(m => m.uid);
      r.qKta = (await A.listMembers({ q: '2025-000318' })).map(m => m.uid);
      r.sum0 = await A.summary();
      const a1 = await A.approve(agusUid, { note: 'Data lengkap.' });
      r.a1 = [a1.status, a1.kta, a1.validUntil, a1.memberType, a1.approvedBy, a1.joinedAt, a1.review.history.slice(-1)[0].action, a1.review.history.slice(-1)[0].byName];
      const a2 = await A.approve('demo-contoh-0001', { memberType: 'Ahli', validUntil: '2028-12-31' });
      r.a2 = [a2.kta, a2.memberType, a2.validUntil];
      r.again = await H.err(A.approve(agusUid, {}));
      r.badDate = await H.err(A.approve('demo-contoh-0002', { validUntil: '2020-01-01' }));
      r.badType = await H.err(A.approve('demo-contoh-0002', { memberType: 'Raja' }));
      r.noNoteRev = await H.err(A.requestRevision('demo-contoh-0004', ''));
      const reg = JSON.parse(localStorage.getItem('ppapi_registry'));
      r.reg = reg['PPAPI-2026-000001'];
      r.counter = JSON.parse(localStorage.getItem('ppapi_counters'));
      r.audit = (await A.audit(10)).map(x => [x.action, x.targetId, typeof x.label]);
      r.uid = agusUid;
      return r;
    }, L1.uid);
    eq(AD.sess, { uid: 'demo-admin-0001', status: 'Draf', isAdmin: true, isActive: true, isMemberActive: false, label: 'Formulir pendaftaran belum diajukan' }, 'admin session: isAdmin + isActive (admin sees everything), own member status Draf');
    eq(AD.menu, ['Dasbor', 'Profil Anggota', 'Produk Pengetahuan', 'Aplikasi Anggota', 'Kegiatan Saya', 'Pesanan Saya', 'Konsol Admin', 'Keluar'], 'account menu (admin): …, Kegiatan Saya, Pesanan Saya, Konsol Admin, Keluar');
    ok(AD.isAdmin === true, 'auth.isAdmin() → true for demo-admin-0001');
    eq(AD.order, ['demo-contoh-0001', AD.uid], 'listMembers: Menunggu Verifikasi first, oldest submittedAt first');
    ok(AD.pendingFirst, 'listMembers: all pending applications precede the others');
    eq([AD.filter, AD.q, AD.qKta], [['demo-contoh-0002'], ['demo-contoh-0002'], ['demo-contoh-0003']], 'listMembers({status}) and ({q}) by name / KTA');
    ok(AD.sum0.menunggu === 2 && AD.sum0.perbaikan === 1 && AD.sum0.aktif === 1 && AD.sum0.ditolak === 1, 'admin.summary() counts by effective status', AD.sum0);
    eq(AD.a1, ['Aktif', 'PPAPI-2026-000001', '2029-12-31', 'Praktisi', 'demo-admin-0001', TODAY, 'disetujui', 'Admin PPAPI (Demo)'], 'approve → Aktif, KTA PPAPI-2026-000001, default validUntil 2029-12-31, approvedBy, joinedAt, history');
    eq(AD.a2, ['PPAPI-2026-000002', 'Ahli', '2028-12-31'], 'second approval → PPAPI-2026-000002 (sequential), chosen kategori + validUntil');
    eq([AD.again, AD.badDate, AD.badType, AD.noNoteRev], ['store/invalid-transition', 'store/invalid-date', 'store/invalid-type', 'store/invalid-transition'], 'approve guards: already Aktif, past date, invalid kategori; revision only for pending');
    ok(AD.reg && AD.reg.kta === 'PPAPI-2026-000001' && AD.reg.nama === 'Agus Pemohon' && AD.reg.status === 'Aktif' && AD.reg.berlakuHingga === '2029-12-31' && AD.reg.kota === 'Bandung' && !('email' in AD.reg) && !('phone' in AD.reg) && !('uid' in AD.reg), 'approve writes a public registry entry (limited fields only)', AD.reg);
    eq(AD.counter, { 'kta-2026': 2 }, 'demo KTA counter ppapi_counters.kta-2026 = 2');
    ok(AD.audit.length >= 2 && AD.audit[0][0] === 'anggota.disetujui' && AD.audit[0][2] === 'string', 'audit log records approvals (newest first, with label)', AD.audit);

    sect('Member sees active features after approval (§3.1)');
    const MA = await page.evaluate(async () => {
      const H = window.__h, r = {};
      await H.as('agus.pemohon@contoh.id');
      await H.tick();
      r.sess = H.sess(); r.menu = H.menu();
      r.badges = [...document.querySelectorAll('.account-menu__status .badge')].map(b => b.textContent);
      r.file = await PPAPI.store.pustaka.fileUrl(PPAPI.data.pustaka.find(p => p.id === 'aplikasi-simulator'));
      r.locked = PPAPI.ui.locked();
      return r;
    });
    eq([MA.sess.status, MA.sess.isMemberActive, MA.sess.isActive, MA.sess.isAdmin], ['Aktif', true, true, false], 'session: Aktif member');
    eq(MA.menu, ['Dasbor', 'Profil Anggota', 'Produk Pengetahuan', 'Aplikasi Anggota', 'Kegiatan Saya', 'Pesanan Saya', 'Keluar'], 'account menu (active): Dasbor, Profil Anggota, Produk Pengetahuan, Aplikasi Anggota, Kegiatan Saya, Pesanan Saya, Keluar');
    eq(MA.badges, ['Aktif'], 'account menu shows the status badge');
    eq(MA.file, 'aplikasi/simulator/index.html', 'pustaka.fileUrl(app item) for an active member');
    ok(!/locked__actions/.test(MA.locked), 'ui.locked() for an active member has no CTA');

    sect('Revision loop · reject → re-apply (§1)');
    const RV = await page.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, A = S.admin, r = {};
      await PPAPI.auth.signOut();
      const b = await H.signUp('Budi Revisi', 'budi.revisi@contoh.id');
      await H.complete(b.uid, 'Budi Revisi', 'Ahli');
      await S.submitApplication(b.uid);
      const c = await H.signUp('Citra Tolak', 'citra.tolak@contoh.id');
      await H.complete(c.uid, 'Citra Tolak');
      await S.submitApplication(c.uid);
      await H.asAdmin();
      r.noNote = await H.err(A.requestRevision(b.uid, 'ok'));
      const rv = await A.requestRevision(b.uid, 'Mohon lampirkan sertifikat Ahli yang masih berlaku.');
      r.rv = [rv.status, rv.review.note, rv.review.history.slice(-1)[0].action];
      r.rejNoNote = await H.err(A.reject(c.uid, ''));
      const rj = await A.reject(c.uid, 'Pengalaman belum memenuhi syarat kategori.');
      r.rj = [rj.status, rj.review.note];
      await H.as('budi.revisi@contoh.id');
      await H.tick();
      r.bSess = H.sess().status;
      r.bLocked = PPAPI.ui.locked();
      const be = await S.saveApplication(b.uid, { dokumen: [{ jenis: 'Sertifikat', label: 'Sertifikat Ahli', url: 'https://example.com/ahli.pdf' }] });
      r.bEdit = [be.status, be.application.dokumen[0].jenis];
      r.bSub = (await S.submitApplication(b.uid)).status;
      await H.as('citra.tolak@contoh.id');
      await H.tick();
      r.cSess = H.sess().status;
      r.cLocked = PPAPI.ui.locked({ compact: true, title: 'Judul <uji>' });
      r.cEdit = (await S.saveApplication(c.uid, { catatan: 'Saya lampirkan dokumen tambahan.' })).status;
      const cs = await S.submitApplication(c.uid);
      r.cSub = [cs.status, cs.application.type];
      await H.asAdmin();
      const ba = await A.approve(b.uid, {});
      r.bApproved = [ba.status, ba.kta, ba.memberType];
      r.uids = { b: b.uid, c: c.uid };
      return r;
    });
    eq(RV.noNote, 'store/note-required', 'requestRevision needs a note (≥5 chars)');
    eq(RV.rv, ['Perlu Perbaikan', 'Mohon lampirkan sertifikat Ahli yang masih berlaku.', 'perbaikan'], "requestRevision → 'Perlu Perbaikan' + review.note + history");
    eq([RV.rejNoNote, RV.rj], ['store/note-required', ['Ditolak', 'Pengalaman belum memenuhi syarat kategori.']], "reject requires a reason → 'Ditolak'");
    eq(RV.bSess, 'Perlu Perbaikan', 'member session shows Perlu Perbaikan');
    ok(/href="pendaftaran\.html"/.test(RV.bLocked) && /Perbaiki Pengajuan/.test(RV.bLocked), 'ui.locked CTA for Perlu Perbaikan → "Perbaiki Pengajuan" → pendaftaran.html');
    eq([RV.bEdit, RV.bSub], [['Perlu Perbaikan', 'Sertifikat'], 'Menunggu Verifikasi'], 'revision loop: edit while Perlu Perbaikan, re-submit');
    ok(RV.cSess === 'Ditolak' && /Ajukan Ulang/.test(RV.cLocked) && /locked--compact/.test(RV.cLocked) && /Judul &lt;uji&gt;/.test(RV.cLocked), 'Ditolak: ui.locked compact, escaped title, CTA "Ajukan Ulang"');
    eq([RV.cEdit, RV.cSub], ['Ditolak', ['Menunggu Verifikasi', 'baru']], 'reject → re-apply (edit while Ditolak, submit again)');
    eq(RV.bApproved, ['Aktif', 'PPAPI-2026-000003', 'Ahli'], 'approval after revision → next KTA PPAPI-2026-000003, kategori from application');

    sect('Deactivate · reactivate · extend · setMemberType (§3.3)');
    const DX = await page.evaluate(async (uid) => {
      const H = window.__h, A = PPAPI.store.admin, r = {};
      const reg = () => JSON.parse(localStorage.getItem('ppapi_registry'))['PPAPI-2026-000001'];
      const d = await A.deactivate(uid, 'Iuran belum diselesaikan.');
      r.d = [d.status, reg().status, d.review.history.slice(-1)[0].action];
      r.dAgain = await H.err(A.deactivate(uid, ''));
      r.extNon = await H.err(A.extend(uid, '2031-01-01'));
      const ra = await A.reactivate(uid, { validUntil: '2030-12-31' });
      r.ra = [ra.status, ra.validUntil, ra.kta, reg().status, reg().berlakuHingga];
      const ex = await A.extend(uid, '2031-06-30');
      r.ex = [ex.validUntil, reg().berlakuHingga, ex.review.history.slice(-1)[0].action];
      r.exPast = await H.err(A.extend(uid, '2026-10-01'));
      const t = await A.setMemberType(uid, 'Ahli');
      r.t = [t.memberType, reg().kategori, t.review.history.slice(-1)[0].action];
      r.tBad = await H.err(A.setMemberType(uid, 'Kaisar'));
      return r;
    }, L1.uid);
    eq(DX.d, ['Nonaktif', 'Nonaktif', 'dinonaktifkan'], 'deactivate → Nonaktif (registry too)');
    eq([DX.dAgain, DX.extNon], ['store/invalid-transition', 'store/invalid-transition'], 'deactivate only Aktif; extend only Aktif');
    eq(DX.ra, ['Aktif', '2030-12-31', 'PPAPI-2026-000001', 'Aktif', '2030-12-31'], 'reactivate → Aktif with validUntil, KTA kept, registry updated');
    eq(DX.ex, ['2031-06-30', '2031-06-30', 'diperpanjang'], 'extend → new validUntil (registry berlakuHingga)');
    eq(DX.exPast, 'store/invalid-date', 'extend rejects a past date');
    eq([DX.t, DX.tBad], [['Ahli', 'Ahli', 'kategori-diubah'], 'store/invalid-type'], 'setMemberType → memberType + registry kategori; invalid type rejected');

    sect('Expired → Kedaluwarsa → perpanjangan (§1)');
    const EXP = await page.evaluate(async (uid) => {
      const H = window.__h, S = PPAPI.store, A = S.admin, r = {};
      const raw = JSON.parse(localStorage.getItem('ppapi_member_' + uid));
      raw.validUntil = '2026-06-30';
      localStorage.setItem('ppapi_member_' + uid, JSON.stringify(raw));
      await H.as('agus.pemohon@contoh.id');
      await H.tick();
      r.sess = H.sess();
      r.locked = PPAPI.ui.locked();
      r.renew = PPAPI.util.canRenew(await S.getMember(uid));
      const sa = await S.saveApplication(uid, { catatan: 'Perpanjangan keanggotaan.' });
      r.type = sa.application.type;
      const sub = await S.submitApplication(uid);
      r.sub = [sub.status, sub.application.type, sub.kta];
      await H.asAdmin();
      r.listExpired = (await A.listMembers({ status: 'Menunggu Verifikasi' })).some(m => m.uid === uid);
      const ap = await A.approve(uid, {});
      r.ap = [ap.status, ap.kta, ap.validUntil, ap.joinedAt];
      // Aktif within 60 days → perpanjangan allowed; far away → locked
      const raw2 = JSON.parse(localStorage.getItem('ppapi_member_' + uid));
      raw2.validUntil = '2026-11-20';
      localStorage.setItem('ppapi_member_' + uid, JSON.stringify(raw2));
      await H.as('agus.pemohon@contoh.id');
      r.soon = [PPAPI.store.applicationType(await S.getMember(uid)), PPAPI.store.canEditApplication(await S.getMember(uid))];
      raw2.validUntil = '2029-12-31';
      localStorage.setItem('ppapi_member_' + uid, JSON.stringify(raw2));
      r.far = await H.err(S.saveApplication(uid, { catatan: 'x' }));
      return r;
    }, L1.uid);
    eq([EXP.sess.status, EXP.sess.isActive, EXP.sess.label], ['Kedaluwarsa', false, 'Masa berlaku keanggotaan telah berakhir'], 'validUntil in the past → session status Kedaluwarsa, features locked');
    ok(/Ajukan Perpanjangan/.test(EXP.locked) && EXP.renew, 'Kedaluwarsa: canRenew + ui.locked CTA "Ajukan Perpanjangan"');
    eq([EXP.type, EXP.sub], ['perpanjangan', ['Menunggu Verifikasi', 'perpanjangan', 'PPAPI-2026-000001']], "perpanjangan application (type 'perpanjangan', KTA kept) → Menunggu Verifikasi");
    ok(EXP.listExpired, 'renewal appears in the admin queue');
    eq(EXP.ap, ['Aktif', 'PPAPI-2026-000001', '2029-12-31', TODAY], 'approving the renewal keeps the KTA and sets a new validUntil');
    eq([EXP.soon, EXP.far], [['perpanjangan', true], 'store/application-locked'], 'Aktif ≤60 days → perpanjangan allowed; Aktif far from expiry → application locked');

    sect('Feedback · admins · CSV (§3.3)');
    const FA = await page.evaluate(async () => {
      const H = window.__h, S = PPAPI.store, A = S.admin, r = {};
      await PPAPI.auth.signOut();
      const fb = await S.submitFeedback({ kategori: 'Saran', nama: 'Pengunjung', pesan: 'Mohon tambahkan modul pelatihan inspeksi.', rating: 4 });
      await H.asAdmin();
      const list = await A.listFeedback();
      r.fb = list.filter(x => x.id === fb.id).map(x => [x.status, x.catatanAdmin, x.kategori])[0];
      const up = await A.updateFeedback(fb.id, { status: 'Diproses', catatanAdmin: 'Diteruskan ke tim pelatihan.' });
      r.up = [up.status, up.catatanAdmin, !!up.updatedAt];
      r.upBad = await H.err(A.updateFeedback(fb.id, { status: 'Hilang' }));
      r.upNone = await H.err(A.updateFeedback('tidak-ada', { status: 'Selesai' }));
      r.admins0 = (await A.listAdmins()).map(a => [a.uid, a.email]);
      r.addUnknown = await H.err(A.addAdmin('tidak.terdaftar@contoh.id'));
      r.addBad = await H.err(A.addAdmin('bukan-email'));
      const added = await A.addAdmin('Budi.Revisi@contoh.id');
      r.added = [added.email, added.addedBy];
      r.dup = await H.err(A.addAdmin('budi.revisi@contoh.id'));
      await H.as('budi.revisi@contoh.id');
      await H.tick();
      r.budiAdmin = [await PPAPI.auth.isAdmin(), H.sess().isAdmin, H.menu().includes('Konsol Admin')];
      const out = await A.removeAdmin('demo-admin-0001');
      r.removedOther = out;
      r.last = await H.err(A.removeAdmin(PPAPI.auth.current().uid));
      await A.addAdmin('admin@ppapi.demo');
      await A.removeAdmin(PPAPI.auth.current().uid);
      await H.tick();
      r.selfRemoved = [await PPAPI.auth.isAdmin(), H.sess().isAdmin];
      await H.asAdmin();
      const members = await A.listMembers();
      const evil = Object.assign({}, members[0], { name: '=HYPERLINK("http://x")', profile: Object.assign({}, members[0].profile, { company: 'PT A; B "C"' }) });
      const csv = A.exportMembersCsv([evil].concat(members));
      const lines = csv.split('\r\n');
      r.csv = [csv.charCodeAt(0) === 0xFEFF, lines[0].replace('﻿', '').split(';').slice(0, 6), lines.length - 2 === members.length + 1, csv.endsWith('\r\n')];
      r.csvEvil = lines[1].split(';')[1];
      r.csvQuote = /"PT A; B ""C"""/.test(lines[1]);
      r.csvPhone = lines.slice(1).some(l => /;08\d{8,11};/.test(l));
      r.auditActions = [...new Set((await A.audit(100)).map(x => x.action))].sort();
      return r;
    });
    eq(FA.fb, ['Baru', '', 'Saran'], "listFeedback: default status 'Baru'");
    eq(FA.up, ['Diproses', 'Diteruskan ke tim pelatihan.', true], 'updateFeedback(status, catatanAdmin)');
    eq([FA.upBad, FA.upNone], ['store/invalid-status', 'store/not-found'], 'updateFeedback validates status / id');
    eq(FA.admins0, [['demo-admin-0001', 'admin@ppapi.demo']], 'listAdmins');
    eq([FA.addUnknown, FA.addBad], ['store/not-found', 'store/invalid-email'], 'addAdmin requires an existing account email');
    eq([FA.added, FA.dup], [['budi.revisi@contoh.id', 'demo-admin-0001'], 'store/already-admin'], 'addAdmin by email (case-insensitive); duplicate rejected');
    eq(FA.budiAdmin, [true, true, true], 'new admin: isAdmin, session.isAdmin, Konsol Admin in the menu');
    eq([FA.removedOther, FA.last], [true, 'store/last-admin'], 'removeAdmin; the last admin cannot remove themself');
    eq(FA.selfRemoved, [false, false], 'self-removal (another admin left) refreshes the session');
    eq(FA.csv, [true, ['Nomor KTA', 'Nama', 'Email', 'Nomor HP', 'Kategori', 'Status'], true, true], 'exportMembersCsv: UTF-8 BOM, ";" separator, header + one row per member, CRLF');
    eq(FA.csvEvil, `"'=HYPERLINK(""http://x"")"`, 'CSV neutralises formula cells (leading apostrophe, quoted)');
    ok(FA.csvQuote && FA.csvPhone, 'CSV quotes ; and " ; phone as 08… (no leading +)');
    ok(['admin.dihapus', 'admin.ditambah', 'anggota.diaktifkan', 'anggota.dinonaktifkan', 'anggota.diperpanjang', 'anggota.disetujui', 'anggota.ditolak', 'anggota.kategori-diubah', 'anggota.perbaikan', 'umpan-balik.diperbarui'].every(a => FA.auditActions.includes(a)), 'audit log covers every admin action type', FA.auditActions);

    sect('Content: static + managed merge, override, hide, restore, sorting (§3.3)');
    const CT = await page.evaluate(async () => {
      const H = window.__h, C = PPAPI.store.content, r = {};
      const base = await C.list('berita');
      r.base = [base.length, base.every(x => x._static && !x._managed), base[0].id === PPAPI.data.berita[0].id];
      const n = await C.save('berita', { judul: 'Rapat Kerja Uji', ringkasan: 'Ringkasan rapat kerja.', tanggal: '2026-10-16', kategori: 'Organisasi', isi: 'Paragraf satu.\n\nParagraf dua.', gambar: 'javascript:alert(1)' });
      const l1 = await C.list('berita');
      r.newItem = [n.id, n._static, n._managed, n.isi.length, n.gambar, n.contoh, l1.length, l1[0].id];
      const sid = PPAPI.data.berita[3].id;
      const ov = await C.save('berita', Object.assign({}, PPAPI.data.berita[3], { judul: 'Judul diubah admin' }));
      const l2 = await C.list('berita');
      r.override = [ov.judul, ov._static, ov._managed, l2.findIndex(x => x.id === sid) === l1.findIndex(x => x.id === sid), l2.length];
      await C.remove('berita', sid);
      const l3 = await C.list('berita');
      const l3h = await C.list('berita', { includeHidden: true });
      r.hidden = [l3.some(x => x.id === sid), l3.length, l3h.find(x => x.id === sid).hidden];
      const rs = await C.restore('berita', sid);
      r.restored = [rs.judul === PPAPI.data.berita[3].judul, !!rs.hidden, (await C.list('berita')).length];
      await C.remove('berita', n.id);
      r.managedGone = (await C.list('berita', { includeHidden: true })).some(x => x.id === n.id);
      r.restoreBad = await H.err(C.restore('berita', 'tidak-ada'));
      r.badType = await H.err(C.list('galeri'));
      r.incomplete = await H.err(C.save('pengumuman', { judul: '' }));
      r.badId = await H.err(C.save('pengumuman', { id: 'Bukan ID!', judul: 'A', isi: 'B' }));
      // agenda sorted by mulai, regulasi by jenis group, pustaka by kategori
      await C.save('agenda', { judul: 'Agenda Uji Awal', lokasi: 'Jakarta', mulai: '2026-01-02', selesai: '2026-01-02', jenis: 'Rapat', mode: 'Daring' });
      const ag = await C.list('agenda');
      r.agenda = [ag[0].judul, ag.every((x, i) => i === 0 || ag[i - 1].mulai <= x.mulai)];
      await C.save('regulasi', { jenis: 'SNI', nomor: '0000', tahun: 2026, judul: 'SNI uji', singkatan: 'SNI 0000:2026', instansi: 'BSN', relevansi: 'Uji.' });
      const rg = await C.list('regulasi');
      const iUji = rg.findIndex(x => x.singkatan === 'SNI 0000:2026');
      r.regulasi = [rg[iUji - 1].jenis, rg[iUji + 1] && rg[iUji + 1].jenis, rg.filter(x => x._static).map(x => x.id).join() === PPAPI.data.regulasi.map(x => x.id).join()];
      const pk = await C.save('pustaka', { judul: 'CoP Uji Khusus Anggota', ringkasan: 'Uji tautan privat.', kategori: 'Code of Practice', akses: 'anggota', tautan: 'https://drive.example.com/rahasia.pdf', status: 'Berlaku', tag: 'uji, privat' });
      const pl = await C.list('pustaka');
      r.pustaka = [pk.tautan, pk.berkasAnggota, pk.tag, pl.filter(x => x.kategori === 'Code of Practice').map(x => x.id).pop() === pk.id, pl.every((x, i) => i === 0 || PPAPI.store.PUSTAKA_KATEGORI.indexOf(pl[i - 1].kategori) <= PPAPI.store.PUSTAKA_KATEGORI.indexOf(x.kategori))];
      r.fileAdmin = await PPAPI.store.pustaka.fileUrl(pk);
      r.filesStore = JSON.parse(localStorage.getItem('ppapi_pustaka_files'))[pk.id];
      r.publicDoc = JSON.parse(localStorage.getItem('ppapi_content_pustaka')).find(x => x.id === pk.id).tautan;
      r.pk = pk;
      await PPAPI.auth.signOut();
      r.fileOut = await H.err(PPAPI.store.pustaka.fileUrl(pk));
      r.listOut = (await C.list('pustaka')).length;
      await H.as('citra.tolak@contoh.id');
      await H.tick();
      r.fileDraft = await H.err(PPAPI.store.pustaka.fileUrl(pk));
      await H.as('agus.pemohon@contoh.id');
      await H.tick();
      r.fileActive = await PPAPI.store.pustaka.fileUrl(pk);
      return r;
    });
    eq(CT.base, [9, true, true], 'list(berita) = 9 static items (_static, not _managed), static order');
    eq(CT.newItem, ['rapat-kerja-uji', false, true, 2, '', false, 10, 'rapat-kerja-uji'], 'save(new) → slug id, _managed, isi split into paragraphs, unsafe gambar dropped, sorted newest first');
    eq(CT.override, ['Judul diubah admin', true, true, true, 10], 'save(static id) overrides in place (_static + _managed)');
    eq(CT.hidden, [false, 9, true], 'remove(static) hides it (includeHidden shows hidden:true)');
    eq(CT.restored, [true, false, 10], 'restore(static) drops the override');
    ok(CT.managedGone === false, 'remove(managed) deletes the item');
    eq([CT.restoreBad, CT.badType, CT.incomplete, CT.badId], ['store/not-found', 'store/invalid-type', 'store/content-incomplete', 'store/invalid-id'], 'content guards');
    eq(CT.agenda, ['Agenda Uji Awal', true], 'agenda sorted by mulai ascending');
    eq(CT.regulasi, ['SNI', 'Standar Internasional', true], 'regulasi: new item placed in its jenis group, static order kept');
    eq(CT.pustaka, ['', true, ['uji', 'privat'], true, true], 'pustaka member-only file: public doc tautan "" + berkasAnggota; sorted by kategori');
    eq([CT.fileAdmin, CT.filesStore, CT.publicDoc], ['https://drive.example.com/rahasia.pdf', 'https://drive.example.com/rahasia.pdf', ''], 'member-only link stored separately (ppapi_pustaka_files ≙ Firestore pustaka_files)');
    eq([CT.fileOut, CT.fileDraft, CT.fileActive], ['store/forbidden', 'store/forbidden', 'https://drive.example.com/rahasia.pdf'], 'pustaka.fileUrl: forbidden signed out / non-active, allowed for active member');
    eq(CT.listOut, PPAPI_STATIC_PUSTAKA + 1, `content.list works signed out (public catalogue: ${PPAPI_STATIC_PUSTAKA} static + 1 managed)`);

    sect('Registry lookup (§3.3)');
    const RG = await page.evaluate(async () => {
      const L = PPAPI.store.registry.lookup;
      const pick = r => [r.kind, r.exact && r.exact.kta, r.matches.map(m => m.kta)];
      const a = await L('PPAPI-2026-000123'), b = await L('ppapi 2026 000001'), c = await L('andika'), d = await L('000001'), e = await L('PPAPI-2099-999999'), f = await L('ab'), g = await L('');
      return { a: pick(a), b: pick(b), c: pick(c), d: pick(d), e: pick(e), f: pick(f), g: pick(g), keys: Object.keys(b.exact || {}).sort(), contoh: a.exact && a.exact.contoh };
    });
    eq(RG.a, ['kta', null, []], 'exact KTA not in the registry → no match (static registry.js is empty)');
    eq(RG.b, ['kta', 'PPAPI-2026-000001', ['PPAPI-2026-000001']], 'exact KTA (any spacing/case) → registry entry written on approval');
    eq(RG.c, ['nama', null, []], 'name search (≥3 letters) over an empty static registry → no match');
    ok(RG.d[0] === 'kta-awal' && RG.d[2].includes('PPAPI-2026-000001'), 'digit search matches KTA numbers', RG.d);
    eq([RG.e, RG.f, RG.g], [['kta', null, []], ['nama', null, []], ['kosong', null, []]], 'unknown KTA / too short / empty → no result');
    eq(RG.keys, ['berlakuHingga', 'kategori', 'kompetensi', 'kota', 'kta', 'nama', 'status'], 'lookup returns public fields only');
    eq(RG.contoh, null, 'no static sample record is served');

    sect('ui.drawer (§3.1 shared component)');
    await page.evaluate(() => { const b = document.createElement('button'); b.id = 'dr-open'; b.textContent = 'Buka'; document.getElementById('sandbox').append(b); });
    await page.focus('#dr-open');
    await page.evaluate(() => {
      window.__d = { closed: 0, kept: 0 };
      window.__dr = PPAPI.ui.drawer({
        title: 'Detail <uji>', eyebrow: 'Permohonan', size: 'lg',
        body: '<label for="dr-a">A</label><input id="dr-a" class="field__control"><a href="#x">tautan</a>',
        actions: [{ label: 'Tetap', onClick: () => { window.__d.kept++; return false; } }, { label: 'Tutup', variant: 'primary' }],
        onClose: () => { window.__d.closed++; }
      });
    });
    await page.waitForTimeout(120);
    const DR1 = await page.evaluate(() => {
      const p = document.querySelector('.drawer__panel');
      return { role: p.getAttribute('role'), modal: p.getAttribute('aria-modal'), title: document.getElementById(p.getAttribute('aria-labelledby')).textContent, lg: p.classList.contains('drawer__panel--lg'), focus: document.activeElement.id, lock: document.documentElement.classList.contains('modal-open'), api: ['close', 'setTitle', 'setBody', 'setActions'].every(k => typeof window.__dr[k] === 'function') };
    });
    eq(DR1, { role: 'dialog', modal: 'true', title: 'Detail <uji>', lg: true, focus: 'dr-a', lock: true, api: true }, 'drawer: role=dialog aria-modal, escaped title, size, focus first field, scroll lock, API');
    const trap = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); trap.push(await page.evaluate(() => !!document.activeElement.closest('.drawer__panel'))); }
    ok(trap.every(Boolean), 'focus trapped in the drawer', trap);
    await page.click('.drawer__footer .btn--ghost');
    await page.evaluate(() => { window.__dr.setTitle('Judul baru'); window.__dr.setBody('<p id="dr-new">baru</p>'); window.__dr.setActions([{ label: 'Satu' }]); });
    const DR2 = await page.evaluate(() => ({ kept: window.__d.kept, open: !!document.querySelector('.drawer'), title: document.querySelector('.drawer__title').textContent, body: !!document.getElementById('dr-new'), btns: document.querySelectorAll('.drawer__footer .btn').length }));
    eq(DR2, { kept: 1, open: true, title: 'Judul baru', body: true, btns: 1 }, 'onClick → false keeps it open; setTitle/setBody/setActions');
    await page.evaluate(() => { PPAPI.ui.confirm('Yakin?').then(v => (window.__cv = v)); });
    await page.waitForSelector('.modal__dialog');
    await page.waitForTimeout(80);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const DR3 = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), drawer: !!document.querySelector('.drawer'), cv: window.__cv }));
    eq(DR3, { modal: false, drawer: true, cv: false }, 'confirm over a drawer: Esc closes the confirm first');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const DR4 = await page.evaluate(() => ({ gone: !document.querySelector('.drawer'), closed: window.__d.closed, focus: document.activeElement.id, lock: document.documentElement.classList.contains('modal-open') }));
    eq(DR4, { gone: true, closed: 1, focus: 'dr-open', lock: false }, 'Esc closes the drawer, onClose, focus restored, lock released');

    sect('Header nav (§3.1)');
    const NV = await page.evaluate(() => ({
      links: [...document.querySelectorAll('.site-nav__link')].map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')]),
      foot: [...document.querySelectorAll('.site-footer__links a')].map(a => a.getAttribute('href'))
    }));
    ok(NV.links.some(l => l[0] === 'Pengetahuan' && l[1] === 'pustaka.html' && l[2] === 'true'), 'Pengetahuan → pustaka.html; marked aria-current="true" on the regulasi page (aktifJuga)', NV.links);
    ok(['pustaka.html', 'regulasi.html', 'verifikasi.html', 'pendaftaran.html'].every(h => NV.foot.includes(h)), 'footer links include pustaka, regulasi, verifikasi, pendaftaran');
    await ctx.close();

    /* ------------------------------------------------ idempotent seed + check.mjs --admin compatibility */
    sect('Seed idempotency + check.mjs --admin compatibility (§2)');
    const ctx2 = await newCtx();
    const p2 = await ctx2.newPage();
    watch(p2, 'seed');
    await open(p2, '__v2test_public.html');
    const before = await p2.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    await p2.evaluate(async () => { await window.__h.asAdmin(); await PPAPI.store.admin.approve('demo-contoh-0001', {}); await PPAPI.auth.signOut(); });
    await open(p2, '__v2test_public.html');
    await open(p2, '__v2test_public.html');
    const after = await p2.evaluate(() => ({ seed: localStorage.getItem('ppapi_demo_seed_v2'), s1: JSON.parse(localStorage.getItem('ppapi_member_demo-contoh-0001')).status, s2: localStorage.getItem('ppapi_member_demo-contoh-0002'), users: Object.keys(JSON.parse(localStorage.getItem('ppapi_demo_users'))).length }));
    eq([after.seed, after.s2], [before.ppapi_demo_seed_v2, before['ppapi_member_demo-contoh-0002']], 'reloads do not re-seed (version key + untouched samples)');
    eq(after.s1, 'Aktif', 'admin changes to a seeded sample survive reloads');
    await ctx2.close();

    const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
    for (const variant of ['check.mjs --admin (session + admins only)', 'broken admin hash']) {
      const c = await newCtx();
      await c.addInitScript(({ a, broken }) => {
        try {
          if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
          const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
          if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
          if (broken && !sessionStorage.getItem('__b')) { sessionStorage.setItem('__b', '1'); localStorage.setItem('ppapi_demo_users', JSON.stringify({ 'admin@ppapi.demo': { uid: a.uid, email: a.email, hash: 'x' } })); }
        } catch (e) { /* ignore */ }
      }, { a: ADMIN, broken: variant === 'broken admin hash' });
      const pg = await c.newPage();
      watch(pg, 'admin-preseed');
      await open(pg, '__v2test_admin.html');
      const first = await pg.evaluate(() => ({ path: location.pathname, ready: window.__ready && window.__ready.session.isAdmin }));
      await open(pg, '__v2test_public.html');
      const R = await pg.evaluate(async (first) => {
        const r = Object.assign({}, first);
        const u = JSON.parse(localStorage.getItem('ppapi_demo_users'))['admin@ppapi.demo'];
        r.hash = /^[0-9a-f]{64}$/.test(u.hash);
        await PPAPI.auth.signOut();
        const s = await PPAPI.auth.signInEmail({ email: 'admin@ppapi.demo', password: 'AdminPPAPI2026' });
        r.signIn = s.uid;
        r.samples = !!localStorage.getItem('ppapi_member_demo-contoh-0003');
        return r;
      }, first);
      eq(R, { path: '/__v2test_admin.html', ready: true, hash: true, signIn: 'demo-admin-0001', samples: true }, `${variant}: admin page opens, users entry (re)created with a valid hash, sign-in with AdminPPAPI2026 works, samples seeded`);
      await c.close();
    }

    /* ------------------------------------------------ check.mjs --auth / --status fixtures */
    sect('check.mjs --auth fixtures → session');
    const DEMO_USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
    const fixtures = [
      [{ status: 'Aktif', validUntil: '2029-12-31', application: { submittedAt: '2026-03-15T02:00:00.000Z' } }, ['Aktif', true]],
      [{ status: 'Aktif', validUntil: '2026-06-30', application: { submittedAt: '2026-03-15T02:00:00.000Z' } }, ['Kedaluwarsa', false]],
      [{ status: 'Draf', validUntil: '' }, ['Draf', false]],
      [{ status: 'Menunggu Verifikasi', application: { submittedAt: '2026-03-15T02:00:00.000Z' } }, ['Menunggu Verifikasi', false]],
      [{ status: 'Nonaktif', validUntil: '2029-12-31' }, ['Nonaktif', false]]
    ];
    for (const [m, want] of fixtures) {
      const c = await newCtx();
      await c.addInitScript(({ u, m }) => {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(Object.assign({ uid: u.uid, name: u.name, email: u.email, kta: 'PPAPI-2026-004821', memberType: 'Praktisi' }, m)));
      }, { u: DEMO_USER, m });
      const pg = await c.newPage();
      watch(pg, 'fixture');
      await pg.goto(`${BASE}/__v2test_active.html`, { waitUntil: 'networkidle' });
      await pg.waitForTimeout(400);
      const got = [await pg.evaluate(() => window.PPAPI && PPAPI.session.current().status), url(pg.url()).split('?')[0]];
      eq(got, [want[0], want[1] ? '/__v2test_active.html' : '/dashboard.html'], `member ${m.status}${m.validUntil ? ' (validUntil ' + m.validUntil + ')' : ''} → status ${want[0]}, active page ${want[1] ? 'opens' : 'redirects to dashboard'}`);
      await c.close();
    }

    /* ------------------------------------------------ gating */
    sect('data-auth gating: required / active / admin (§3.1)');
    const c5 = await newCtx();
    const p5 = await c5.newPage();
    watch(p5, 'gating');
    await p5.route('**/assets/js/auth.js', async route => { await new Promise(r => setTimeout(r, 700)); route.continue(); });
    await p5.goto(`${BASE}/__v2test_active.html?x=1#kartu`, { waitUntil: 'commit' });
    await p5.waitForSelector('main', { state: 'attached' });
    await p5.waitForTimeout(200);
    const pend = await p5.evaluate(() => ({ vis: getComputedStyle(document.querySelector('main')).visibility, loader: getComputedStyle(document.body, '::before').content }));
    ok(pend.vis === 'hidden' && /Memverifikasi/.test(pend.loader), 'active page hides <main> + shows the loader before the session resolves', pend);
    await p5.waitForURL(/masuk\.html/, { timeout: 8000 }).catch(() => {});
    eq(url(p5.url()), '/masuk.html?next=__v2test_active.html%3Fx%3D1%23kartu', 'active page signed out → masuk.html?next=…');
    await p5.unroute('**/assets/js/auth.js');
    await p5.goto(`${BASE}/__v2test_admin.html`, { waitUntil: 'networkidle' });
    await p5.waitForURL(/masuk\.html/, { timeout: 5000 }).catch(() => {});
    eq(url(p5.url()), '/masuk.html?next=__v2test_admin.html', 'admin page signed out → masuk.html?next=…');
    // Draf user
    await open(p5, '__v2test_public.html');
    await p5.evaluate(async () => { await window.__h.signUp('Dewi Draf', 'dewi.draf@contoh.id'); });
    await p5.goto(`${BASE}/__v2test_required.html`, { waitUntil: 'networkidle' });
    await p5.waitForTimeout(250);
    eq([url(p5.url()), await p5.evaluate(() => window.__ready && window.__ready.session.status)], ['/__v2test_required.html', 'Draf'], 'required page: Draf member stays; onReady sees PPAPI.session.current()');
    for (const [file, msg] of [['__v2test_active.html', 'Fitur ini khusus anggota berstatus Aktif.'], ['__v2test_admin.html', 'Halaman ini khusus admin PPAPI.']]) {
      await p5.goto(`${BASE}/${file}`, { waitUntil: 'commit' });
      await p5.waitForURL(/dashboard\.html/, { timeout: 6000 }).catch(() => {});
      await p5.waitForSelector('.toast__msg', { timeout: 4000 }).catch(() => {});
      const t = await p5.evaluate(() => [...document.querySelectorAll('.toast__msg')].map(x => x.textContent));
      ok(/\/dashboard\.html$/.test(url(p5.url())) && t.includes(msg), `${file} as Draf member → dashboard.html + toast "${msg}"`, { url: url(p5.url()), t });
    }
    // active member (this context has its own storage: create + approve one)
    await open(p5, '__v2test_public.html');
    await p5.evaluate(async () => {
      const H = window.__h;
      await PPAPI.auth.signOut();
      const u = await H.signUp('Eko Aktif', 'eko.aktif@contoh.id');
      await H.complete(u.uid, 'Eko Aktif');
      await PPAPI.store.submitApplication(u.uid);
      await H.asAdmin();
      await PPAPI.store.admin.approve(u.uid, {});
      await H.as('eko.aktif@contoh.id');
    });
    await p5.goto(`${BASE}/__v2test_active.html`, { waitUntil: 'networkidle' });
    await p5.waitForTimeout(250);
    eq([url(p5.url()), await p5.evaluate(() => [window.__ready.session.isMemberActive, window.__ready.authReady, getComputedStyle(document.querySelector('main')).visibility])], ['/__v2test_active.html', [true, true, 'visible']], 'active page: active member stays, main visible');
    await p5.goto(`${BASE}/__v2test_admin.html`, { waitUntil: 'commit' });
    await p5.waitForURL(/dashboard\.html/, { timeout: 6000 }).catch(() => {});
    ok(/\/dashboard\.html$/.test(url(p5.url())), 'admin page: active (non-admin) member → dashboard.html');
    // admin
    await open(p5, '__v2test_public.html');
    await p5.evaluate(async () => { await window.__h.asAdmin(); });
    for (const file of ['__v2test_active.html', '__v2test_admin.html']) {
      await p5.goto(`${BASE}/${file}`, { waitUntil: 'networkidle' });
      await p5.waitForTimeout(250);
      eq([url(p5.url()), await p5.evaluate(() => window.__ready && [window.__ready.session.isAdmin, window.__ready.session.isActive])], ['/' + file, [true, true]], `${file}: admin (member status Draf) stays`);
    }
    // session change while on an admin page (admin role removed) → leaves
    await p5.evaluate(async () => {
      const A = PPAPI.store.admin;
      const list = await A.listAdmins();
      if (list.length < 2) await A.addAdmin('dewi.draf@contoh.id');
      await A.removeAdmin('demo-admin-0001');
    });
    await p5.waitForURL(/dashboard\.html/, { timeout: 6000 }).catch(() => {});
    ok(/\/dashboard\.html$/.test(url(p5.url())), 'admin page: losing the admin role (session refresh) → dashboard.html');
    // sign out from an active page → index.html
    await open(p5, '__v2test_public.html');
    await p5.evaluate(async () => { await window.__h.as('dewi.draf@contoh.id'); const A = PPAPI.store.admin; await A.addAdmin('admin@ppapi.demo').catch(() => {}); });
    await p5.goto(`${BASE}/__v2test_admin.html`, { waitUntil: 'networkidle' });
    await p5.waitForTimeout(200);
    await p5.click('.account__trigger');
    await p5.click('#account-menu [data-signout]');
    await p5.waitForURL(/index\.html/, { timeout: 5000 }).catch(() => {});
    eq(url(p5.url()), '/index.html', "'Keluar' on an admin page → index.html");
    await c5.close();

    sect('ui.locked for a signed-out visitor');
    const c6 = await newCtx();
    const p6 = await c6.newPage();
    await open(p6, '__v2test_public.html');
    const LK = await p6.evaluate(() => { history.replaceState(null, '', 'pustaka.html?kategori=CoP#katalog'); const html = PPAPI.ui.locked({ title: 'Produk Pengetahuan' }); history.replaceState(null, '', '__v2test_public.html'); return [html, PPAPI.ui.lockedAction()]; });
    ok(/class="locked"/.test(LK[0]) && /href="masuk\.html\?next=pustaka\.html%3Fkategori%3DCoP%23katalog"/.test(LK[0]) && /href="masuk\.html\?next=pendaftaran\.html#daftar"/.test(LK[0]) && /Khusus Anggota Aktif/.test(LK[0]), 'signed out → Masuk (next = this page) + Daftar Anggota (next = pendaftaran)', LK[0]);
    ok(/href="masuk\.html"/.test(LK[1]), 'a page name safeNext rejects → plain masuk.html (no next)', LK[1]);
    await c6.close();

    ok(!pageErrors.length, 'no uncaught page errors / console errors / warnings during the run', pageErrors);
  } finally {
    await browser.close();
    server.close();
    cleanupTestFiles();
    ok(!fs.readdirSync(ROOT).some(f => /^__v2test_/.test(f)), 'throwaway site/__v2test_*.html files deleted');
  }
}

try {
  nodeChecks();
  await browserChecks();
} catch (e) {
  failures.push('FATAL: ' + (e && e.stack || e));
  console.error(e);
} finally {
  cleanupTestFiles();
}
console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.map(f => ' • ' + f).join('\n')); process.exitCode = 1; }
