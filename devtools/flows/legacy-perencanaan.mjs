// Analisis (read-only) aplikasi legacy "PPAPI Scaffold" (index.html) — klik semua tahap, desktop + mobile.
// Usage (cwd = devtools): node flows/legacy-perencanaan.mjs [outJson]
// Tidak mengubah apa pun di legacy/ atau site/. Screenshot -> shots/legacy-pr-*.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'legacy', 'asosiasi.ppapi-main');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const OUT = process.argv[2] || path.resolve(__dirname, '..', 'shots', 'legacy-pr-result.json.tmp');
const DL = path.join(path.dirname(OUT), 'legacy-pr-downloads');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(DL, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.toml': 'text/plain', '.md': 'text/plain' };
// Serves the legacy folder at "/" AND under "/aplikasi/perencanaan/" (simulasi hosting sub-path situs PPAPI);
// "/" also serves a tiny portal stub page at /__portal.html (pretend PPAPI site page on the same origin).
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__portal.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>portal</title><p>portal stub</p>'); return; }
  if (u.startsWith('/aplikasi/perencanaan/')) u = '/' + u.slice('/aplikasi/perencanaan/'.length);
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, path.normalize(u));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  (String(f).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(f, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(f).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const R = { base: BASE, desktop: {}, mobile: {}, subpath: {}, bypass: {}, console: [], pageErrors: [], failed: [], external: new Set(), dialogs: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify({ ...R, external: [...R.external] }, null, 2));

function wire(page, tag) {
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') R.console.push(`[${tag}] ${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', e => R.pageErrors.push(`[${tag}] ${String(e.message || e).slice(0, 300)}`));
  page.on('requestfailed', r => R.failed.push(`[${tag}] ${r.method()} ${r.url().slice(0, 160)} — ${r.failure()?.errorText}`));
  page.on('request', r => { const u = new URL(r.url()); if (!/^127\.0\.0\.1$/.test(u.hostname) && u.protocol.startsWith('http')) R.external.add(u.origin + u.pathname.slice(0, 60)); });
  page.on('dialog', async d => { R.dialogs.push(`[${tag}] ${d.type()}: ${d.message().slice(0, 200)}`); await d.accept(d.type() === 'prompt' ? (d.defaultValue() || 'catatan uji') : undefined).catch(() => {}); });
}

const shot = async (page, name, full = true) => { const f = path.join(SHOTS, `legacy-pr-${name}.png`); await page.screenshot({ path: f, fullPage: full }); return path.basename(f); };
const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+\n/g, '\n').trim() : null; }, sel);

async function login(page, user = 'admin', pass = 'admin123') {
  await page.fill('#lg-user', user);
  await page.fill('#lg-pass', pass);
  await page.click('#login-screen button.btn-pri');
  await page.waitForTimeout(400);
}
async function goView(page, v) {
  await page.click('#menu-btn');
  await page.waitForTimeout(150);
  await page.click(`#menu-panel .tab[data-v="${v}"]`);
  await page.waitForTimeout(700); // smooth scroll + render
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
}
const overflow = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, over: document.documentElement.scrollWidth > innerWidth + 1,
  wide: [...document.querySelectorAll('main *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).slice(0, 6).map(e => e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') + '#' + e.id + ' r=' + Math.round(e.getBoundingClientRect().right)) }));

const VIEWS = ['beranda', 'proyek', 'beban', 'duty', 'gambar', 'material', 'analisis', 'jsa', 'checklist', 'laporan', 'tentang', 'admin'];

const browser = await chromium.launch();

/* =========================== DESKTOP =========================== */
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await ctx.newPage(); wire(page, 'D');
  const D = R.desktop;
  const t0 = Date.now();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  D.loadMs = Date.now() - t0;
  await page.waitForTimeout(600);
  D.title = await page.title();
  D.lockedBeforeLogin = await page.evaluate(() => document.body.classList.contains('locked'));
  D.mainTextVisibleBeforeLogin = await page.evaluate(() => document.querySelector('main').innerText.length);
  D.shots = [await shot(page, 'd-00-login', false)];
  // wrong password
  await login(page, 'admin', 'salah');
  D.loginErr = await txt(page, '#lg-err');
  await login(page);
  D.loggedIn = await page.evaluate(() => ({ user: CURRENT_USER, role: CURRENT_ROLE, key: KEY, chip: document.getElementById('user-name').textContent }));

  // Beranda
  D.shots.push(await shot(page, 'd-01-beranda'));
  D.berandaSteps = await page.evaluate(() => [...document.querySelectorAll('.steps8 button')].map(b => b.innerText.replace(/\s+/g, ' ')));
  D.berandaH2 = await page.evaluate(() => [...document.querySelectorAll('#v-beranda h2')].map(h => h.innerText));
  // menu open
  await page.click('#menu-btn'); await page.waitForTimeout(200);
  D.shots.push(await shot(page, 'd-01b-menu', false));
  D.menuItems = await page.evaluate(() => [...document.querySelectorAll('#menu-panel .tab')].map(b => b.dataset.v + ':' + b.innerText.replace(/\s+/g, ' ').trim()));
  await page.click('#menu-btn');

  // Tahap 1 — Data Proyek
  await goView(page, 'proyek');
  await page.fill('#f-proyek', 'Pemeliharaan Tangki T-101');
  await page.fill('#f-lokasi', 'Area Utilitas, Plant 2');
  await page.fill('#f-kontraktor', 'PT Uji Coba');
  await page.fill('#f-tinggi', '8');
  await page.fill('#f-lift', '4');
  await page.fill('#f-tag', 'SC-2026-014');
  await page.fill('#f-inspektor', 'Inspektor Uji');
  await page.fill('#f-nbay', '4');
  D.shots.push(await shot(page, 'd-02-proyek'));
  D.proyekBanner = await txt(page, '#banner-proyek');

  // Tahap 2 — Beban hidup
  await goView(page, 'beban');
  D.llStats = await txt(page, '#ll-stats');
  D.llStatus = await txt(page, '#ll-status');
  D.anBayAfterProyek = await page.evaluate(() => document.getElementById('an-bay').value); // apakah f-nbay=4 ikut? (tidak)
  D.shots.push(await shot(page, 'd-03-beban'));
  // skenario: 4 pekerja + 300 kg material
  await page.fill('#ll-org', '4'); await page.fill('#ll-mat', '300');
  D.llScenario = await txt(page, '#ll-status');
  await page.click('#v-beban button.btn-pri'); // Terapkan Kelas Duty (alert)
  D.kelasAfterApply = await page.evaluate(() => document.getElementById('an-kelas').value);

  // Tahap 3 — Duty & stabilitas (independent)
  await goView(page, 'duty');
  D.dutyStats = await txt(page, '#duty-stats');
  D.dutyNote = await txt(page, '#an-dutynote');
  D.dutyFxLive = await txt(page, '#fx-live');
  D.dutyChecksSta = await txt(page, '#an-checks-sta');
  D.shots.push(await shot(page, 'd-04-duty-independent'));
  // model suspended
  await goView(page, 'proyek'); await page.selectOption('#f-model', 'suspended');
  await goView(page, 'duty');
  D.dutySuspended = await txt(page, '#an-checks-sta');
  D.shots.push(await shot(page, 'd-04b-duty-suspended'));
  await goView(page, 'analisis');
  D.analisisSuspended = { cap: await txt(page, '#fx-cap'), checks: await txt(page, '#an-checks') };
  // model mobile
  await goView(page, 'proyek'); await page.selectOption('#f-model', 'mobile');
  await goView(page, 'duty');
  D.dutyMobile = await txt(page, '#an-checks-sta');
  D.shots.push(await shot(page, 'd-04c-duty-mobile'));
  await goView(page, 'proyek'); await page.selectOption('#f-model', 'independent');

  // Tahap 4 — Gambar rencana (interaksi UI nyata + bangun rangka uji)
  await goView(page, 'gambar');
  const box = await page.locator('#dwg-svg').boundingBox();
  D.dwgBox = box;
  await page.click('.pal-chip[data-t="base"]');
  await page.mouse.click(box.x + box.width * 0.30, box.y + box.height * 0.85);
  await page.click('.pal-chip[data-t="pipe"][data-len="2"]');
  await page.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.55);
  D.toolbarVisible = await page.evaluate(() => document.getElementById('dwg-toolbar').classList.contains('show'));
  if (D.toolbarVisible) { await page.click('#dwg-toolbar button[data-act="rot90"]'); }
  D.dwgAfterUi = await page.evaluate(() => DWG.depan.map(i => ({ t: i.t, x: i.x, y: i.y, len: i.len, rot: i.rot })));
  // keyboard shortcut test (P arms pipe)
  await page.mouse.click(box.x + 5, box.y + 5); // klik area kosong
  await page.keyboard.press('Escape');
  await page.keyboard.press('p');
  D.hintAfterP = await txt(page, '#pal-hint');
  await page.keyboard.press('Escape');
  // programmatic small frame (2 bay elevation) to exercise the rule checker
  D.ruleCheck = await page.evaluate(() => {
    DWG.depan = []; dwgSeq = 1; const G = DWG_GY;
    const add = (t, x, y, o) => dwgAdd(t, x, y, Object.assign({ exact: true }, o || {}));
    [2, 4.4, 6.8].forEach(x => { add('base', x, G); add('pipe', x, G - 3, { len: 6, rot: 90 }); });
    [0.3, 2.3, 4.3].forEach(h => add('pipe', 4.4, G - h, { len: 5.0, rot: 0 })); // ledger overhang 0.1 m each end
    [0.3, 2.3].forEach(h => [2, 4.4, 6.8].forEach(x => add('fix', x, G - h)));   // ledger at 4.3 m left without clamps
    add('pipe', 3.2, G - 1.3, { len: Math.hypot(2.4, 2), rot: -39.8 });            // bracing w/o swivel
    add('sleeve', 2, G - 3.0);                                                     // sleeve far from node
    dwgSel = null; return dwgCheck();
  });
  await page.waitForTimeout(400);
  D.dwgWarn = await txt(page, '#dwg-warn');
  D.shots.push(await shot(page, 'd-05-gambar'));
  // fullscreen
  await page.click('#v-gambar .btn-row .btn-dark'); await page.waitForTimeout(300);
  D.shots.push(await shot(page, 'd-05b-gambar-fullscreen', false));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);

  // Tahap 5 — Material
  await goView(page, 'material');
  D.matDefault = await txt(page, '#mat-stats');
  await page.click('#v-material .btn-row .btn-pri'); // Estimasi otomatis
  await page.waitForTimeout(300);
  D.matAuto = await page.evaluate(() => matRows.map(r => `${r.n} | ${r.q} x ${r.w} kg = ${(r.q * r.w).toFixed(1)}`));
  D.matStats = await txt(page, '#mat-stats');
  D.glStats = await txt(page, '#gl-stats');
  D.shots.push(await shot(page, 'd-06-material'));

  // Tahap 6 — Analisis struktur
  await goView(page, 'analisis');
  D.anDead = await txt(page, '#an-dead');
  D.anStats = await txt(page, '#an-stats');
  D.fxCap = await txt(page, '#fx-cap');
  D.fxKlem = await txt(page, '#fx-klem');
  D.anChecks = await txt(page, '#an-checks');
  D.anVerdict = await txt(page, '#an-verdict');
  D.anInputs = await page.evaluate(() => Object.fromEntries(['an-fk', 'an-tiang', 'an-kaptiang', 'an-dukung', 'an-plate', 'an-klemcls', 'an-nklem', 'an-bay', 'an-lantai', 'an-kelas'].map(id => [id, document.getElementById(id).value])));
  D.analisisData = await page.evaluate(() => { const A = analisisData(); return { dead: A.dead, live: A.live, fact: A.fact, perT: A.perT, perTkN: A.perTkN, bearing: A.bearing, udl: A.udl, kgBay: A.kgBay, klemKN: A.X.klemKN, H: A.H, Bmin: A.Bmin, ok: A.ok, nStdGeom: (Number(document.getElementById('f-nbay').value) + 1) * 2 }; });
  D.shots.push(await shot(page, 'd-07-analisis'));

  // Tahap 7 — JSA
  await goView(page, 'jsa');
  D.jsaRows = await page.evaluate(() => document.querySelectorAll('#jsa-body tr').length);
  D.shots.push(await shot(page, 'd-08-jsa'));

  // Tahap 8 — Checklist
  await goView(page, 'checklist');
  D.checklistBefore = await txt(page, '#prog-txt');
  await page.click('#v-checklist button:has-text("Tandai semua Sesuai")');
  D.verdictAllOk = await txt(page, '#head-verdict');
  await page.click('#item-0-0 .ab:nth-child(2)'); // ADM item kritis -> Tidak
  D.verdictCritFail = await txt(page, '#head-verdict');
  await page.click('#item-0-0 .ab:nth-child(1)'); // kembali Sesuai
  await page.click('#item-0-1 .ab:nth-child(2)'); // non-kritis -> Tidak
  D.verdictNonCrit = await txt(page, '#head-verdict');
  // foto bukti
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQKAD7mP8F9V1+3AAAAAElFTkSuQmCC', 'base64');
  const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null), page.click('#item-1-3 .photo-btn')]);
  if (fc) { await fc.setFiles({ name: 'bukti.png', mimeType: 'image/png', buffer: png }); await page.waitForTimeout(800); }
  D.photoCount = await page.evaluate(() => Object.keys(state.photos).length);
  D.shots.push(await shot(page, 'd-09-checklist'));

  // Tahap 9 — Laporan & Tagging
  await goView(page, 'laporan');
  D.ringkasanRootLen = await page.evaluate(() => document.getElementById('ringkasan-root').innerHTML.length);
  await page.click('#v-laporan button:has-text("Buat Otomatis")');
  D.kesimpulan = await page.evaluate(() => document.getElementById('f-kesimpulan').value);
  D.tagText = await txt(page, '#tag-preview');
  D.shots.push(await shot(page, 'd-10-laporan'));
  // PDF
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }).catch(e => ({ err: e.message })), page.click('#v-laporan .card button.btn-dark:has-text("Buat Laporan PDF")')]);
  if (dl && dl.saveAs) {
    const f = path.join(DL, dl.suggestedFilename()); await dl.saveAs(f);
    D.pdf = { name: dl.suggestedFilename(), size: fs.statSync(f).size };
    try {
      execFileSync('pdftotext', ['-layout', path.basename(f), 'pdf.txt'], { cwd: DL });
      const t = fs.readFileSync(path.join(DL, 'pdf.txt'), 'utf8');
      D.pdf.pages = (t.match(/\f/g) || []).length + 1;
      D.pdf.head = t.slice(0, 2500);
      D.pdf.suspicious = t.split('\n').filter(l => /[^\x00-\x7F -ÿ]|Ø|þ|ÿ|�/.test(l)).slice(0, 15);
      D.pdf.footer = t.split('\n').filter(l => /Hal \d+\/\d+/.test(l)).slice(0, 2);
    } catch (e) { D.pdf.textErr = String(e.message).slice(0, 200); }
  } else D.pdf = dl;
  // JSON export
  const [dj] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), page.click('#v-laporan button:has-text("Ekspor Data")')]);
  if (dj) { const f = path.join(DL, dj.suggestedFilename()); await dj.saveAs(f); const j = JSON.parse(fs.readFileSync(f, 'utf8')); D.jsonExport = { name: dj.suggestedFilename(), size: fs.statSync(f).size, keys: Object.keys(j) }; }
  // print tag (window.print stub)
  await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await page.click('#v-laporan button:has-text("Cetak Scaffold Tag")');
  D.printCalled = await page.evaluate(() => window.__printed);
  await page.emulateMedia({ media: 'print' });
  D.shots.push(await shot(page, 'd-10b-print-tag'));
  await page.emulateMedia({ media: 'screen' });

  // Simpan proyek + arsip
  await goView(page, 'proyek');
  await page.click('#v-proyek button:has-text("Simpan Proyek")');
  D.projList = await txt(page, '#proj-list');

  // Tentang & Admin
  await goView(page, 'tentang');
  D.version = await txt(page, '#ver-tag');
  D.shots.push(await shot(page, 'd-11-tentang'));
  await goView(page, 'admin');
  D.admStats = await txt(page, '#adm-stats');
  D.admUsers = await txt(page, '#user-rows');
  D.shots.push(await shot(page, 'd-12-admin'));
  // tambah pengguna (hanya di localStorage peramban ini)
  await page.fill('#nu-user', 'inspektor01'); await page.fill('#nu-pass', 'uji123'); await page.fill('#nu-nama', 'Inspektor Satu');
  await page.click('#nu-save');
  D.usersAfterAdd = await page.evaluate(() => Object.keys(getUsers()));

  // Simulator FAB (blob iframe)
  await page.click('.fab'); await page.waitForTimeout(2500);
  D.sim = await page.evaluate(() => { const f = document.getElementById('sim-frame'); let sameOrigin = false, ls = null; try { sameOrigin = !!f.contentWindow.document; ls = f.contentWindow.localStorage.getItem('ppapi_session'); } catch (e) {} return { src: f.src.slice(0, 40), sameOrigin, canReadParentSessionKey: ls }; });
  D.shots.push(await shot(page, 'd-13-simulator-modal', false));
  await page.keyboard.press('Escape');

  // XSS probes (self/stored) — tag preview & project list & checklist photo
  await goView(page, 'proyek');
  await page.fill('#f-proyek', '<img src=x onerror="window.__xss=(window.__xss||0)+1">');
  await goView(page, 'laporan');
  await page.waitForTimeout(300);
  D.xssTag = await page.evaluate(() => window.__xss || 0);
  await goView(page, 'proyek');
  await page.click('#v-proyek button:has-text("Simpan Proyek")');
  await page.waitForTimeout(300);
  D.xssAfterProjList = await page.evaluate(() => window.__xss || 0);
  await page.fill('#f-proyek', 'Pemeliharaan Tangki T-101');

  // Penyimpanan & service worker
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(1500);
  D.afterReloadLoggedIn = await page.evaluate(() => !document.body.classList.contains('locked'));
  D.storage = await page.evaluate(() => Object.keys(localStorage).sort().map(k => k + ' (' + localStorage.getItem(k).length + ' ch)'));
  D.sw = await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); const keys = await caches.keys(); const out = {}; for (const k of keys) { const c = await caches.open(k); out[k] = (await c.keys()).map(r => r.url.replace(location.origin, '')).slice(0, 40); } return { scope: reg && reg.scope, controlled: !!navigator.serviceWorker.controller, caches: out }; });
  // resetAll leftovers
  await goView(page, 'laporan');
  await page.click('#v-laporan button:has-text("Proyek Baru")');
  D.afterResetAll = await page.evaluate(() => ({ photos: Object.keys(state.photos).length, plans: (state.plans || []).length, dwgItems: DWG.depan.length, mats: matRows.length, answers: Object.keys(state.answers).filter(k => state.answers[k]).length }));
  // a11y quick
  D.a11y = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    h1: [...document.querySelectorAll('h1')].map(h => h.innerText),
    labelsNotLinked: [...document.querySelectorAll('.field label')].filter(l => !l.htmlFor && !l.querySelector('input,select,textarea')).length,
    inputsTotal: document.querySelectorAll('input,select,textarea').length,
    inputsNoName: [...document.querySelectorAll('input:not([type=file]),select,textarea')].filter(i => !i.labels?.length && !i.getAttribute('aria-label') && !i.title).length,
    menuBtnAria: document.getElementById('menu-btn').getAttribute('aria-expanded'),
    onclickCount: document.querySelectorAll('[onclick]').length,
    tabsRole: document.querySelectorAll('[role=tab],[role=menu],[role=menuitem]').length,
    focusOutline: getComputedStyle(document.querySelector('.field input')).outlineStyle,
    svgCanvasTabindex: document.getElementById('dwg-svg').getAttribute('tabindex'),
  }));
  save();
  await ctx.close();
}

/* =========================== MOBILE =========================== */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  const page = await ctx.newPage(); wire(page, 'M');
  const M = R.mobile; M.shots = []; M.overflow = {};
  await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await page.waitForTimeout(500);
  M.shots.push(await shot(page, 'm-00-login', false));
  await login(page);
  M.headerH = await page.evaluate(() => Math.round(document.querySelector('header').getBoundingClientRect().height));
  await page.click('#menu-btn'); await page.waitForTimeout(200);
  M.shots.push(await shot(page, 'm-00b-menu', false));
  M.menuPanel = await page.evaluate(() => { const r = document.getElementById('menu-panel').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; });
  await page.click('#menu-btn');
  let i = 1;
  for (const v of VIEWS) {
    await goView(page, v);
    if (v === 'material') { await page.click('#v-material .btn-row .btn-pri'); await page.waitForTimeout(200); }
    if (v === 'gambar') {
      await page.evaluate(() => { DWG.depan = []; dwgSeq = 1; const G = DWG_GY; [2, 4.4].forEach(x => { dwgAdd('base', x, G, { exact: true }); dwgAdd('pipe', x, G - 2, { len: 4, rot: 90, exact: true }); }); dwgAdd('pipe', 3.2, G - 0.3, { len: 2.8, exact: true }); dwgSel = null; dwgRender(); dwgCheck(); });
      M.dwgSvgBox = await page.evaluate(() => { const r = document.getElementById('dwg-svg').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
    }
    M.overflow[v] = await overflow(page);
    const n = String(i).padStart(2, '0');
    M.shots.push(await shot(page, `m-${n}-${v}`, false));
    M.shots.push(await shot(page, `m-${n}-${v}-full`, true));
    i++;
  }
  // checklist item layout on phone
  await goView(page, 'checklist');
  M.checkItemBtnSize = await page.evaluate(() => { const b = document.querySelector('#item-0-0 .ab').getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; });
  M.progWrapTop = await page.evaluate(() => getComputedStyle(document.querySelector('.prog-wrap')).top);
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(300);
  M.shots.push(await shot(page, 'm-09b-checklist-scrolled', false));
  save();
  await ctx.close();
}

/* ============ SUB-PATH hosting + service-worker cache-eviction risk ============ */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); wire(page, 'S');
  const S = R.subpath;
  // 1) a "portal" page on the same origin creates its own cache (as a future site-wide SW/PWA would)
  await page.goto(BASE + '/__portal.html');
  await page.evaluate(async () => { const c = await caches.open('ppapi-site-v1'); await c.put('/__portal.html', new Response('portal')); });
  S.cachesBefore = await page.evaluate(() => caches.keys());
  // 2) open the legacy app hosted under a sub-path, log in so initApp() registers sw.js
  await page.goto(BASE + '/aplikasi/perencanaan/index.html', { waitUntil: 'load' });
  await login(page);
  await page.waitForTimeout(2500);
  S.reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? { scope: r.scope, active: !!r.active } : null; });
  S.manifestHref = await page.evaluate(() => document.querySelector('link[rel=manifest]').href);
  S.assets404 = R.failed.filter(f => f.startsWith('[S]'));
  await page.goto(BASE + '/__portal.html'); await page.waitForTimeout(500);
  S.cachesAfter = await page.evaluate(() => caches.keys());
  S.portalCacheDeleted = !S.cachesAfter.includes('ppapi-site-v1');
  save();
  await ctx.close();
}

/* ============ Gate bypass: forged session without password ============ */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ppapi_session', JSON.stringify({ m: 'local', id: 'admin' })); } catch (e) {} });
  const page = await ctx.newPage(); wire(page, 'B');
  await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await page.waitForTimeout(500);
  R.bypass.forgedLocalSession = await page.evaluate(() => ({ locked: document.body.classList.contains('locked'), user: CURRENT_USER, role: CURRENT_ROLE, adminTabVisible: getComputedStyle(document.getElementById('tab-admin')).display !== 'none' }));
  // Supabase-mode forged session (role taken from storage, token never validated)
  await page.evaluate(() => { localStorage.setItem('ppapi_backend', JSON.stringify({ on: true, url: 'https://contoh.supabase.co', key: 'x' })); localStorage.setItem('ppapi_session', JSON.stringify({ m: 'sb', e: 'siapa@contoh.id', r: 'admin', t: 'palsu' })); });
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(500);
  R.bypass.forgedSupabaseSession = await page.evaluate(() => ({ locked: document.body.classList.contains('locked'), user: CURRENT_USER, role: CURRENT_ROLE }));
  R.bypass.shot = await shot(page, 'd-14-bypass-forged-session', false);
  save();
  await ctx.close();
}

await browser.close();
server.close();
save();
console.log('OK ->', OUT);
console.log(JSON.stringify({ pageErrors: R.pageErrors, console: R.console.slice(0, 20), failed: R.failed.slice(0, 20), external: [...R.external] }, null, 1));
