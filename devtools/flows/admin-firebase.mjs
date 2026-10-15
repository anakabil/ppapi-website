// Konsol Admin in FIREBASE mode, without a real project or network.
// Run from devtools/:   node flows/admin-firebase.mjs
// Reuses (read-only) the in-memory compat-SDK stub + JavaScript mirror of site/firestore.rules from
// flows/firebase-v2-stub.mjs: config.js is served with a fake apiKey, the stub is installed before the
// page scripts, and every Firestore read/write the console makes is checked by the rules mirror
// (a denied call throws permission-denied → the console would show an error and this flow fails).
// Seed ("Firebase console" writes, bypassing rules): admin account + admins/{uid}, one applicant
// (Menunggu Verifikasi, history WITHOUT a "diajukan" entry; ISO strings as the store writes them), one active member,
// one feedback document with a Timestamp createdAt.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const stubFile = fs.readFileSync(path.join(__dirname, 'firebase-v2-stub.mjs'), 'utf8');
const s0 = stubFile.indexOf('const STUB = () => {');
const endM = s0 < 0 ? null : /\r?\n\};\r?\n/.exec(stubFile.slice(s0));   /* the file may use CRLF */
const s1 = endM ? s0 + endM.index : -1;
if (s0 < 0 || s1 < 0) { console.error('Stub not found in firebase-v2-stub.mjs'); process.exit(2); }
const STUB_SRC = '(' + stubFile.slice(s0 + 'const STUB = '.length, s1) + '\n})();';

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/assets/js/config.js') body = body.toString('utf8').replace("apiKey: ''", "apiKey: 'AIzaSyFAKE-stub-key-000000000000000000'").replace("projectId: ''", "projectId: 'ppapi-stub'");
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const SEED = () => {
  const F = window.__fstub, TS = window.firebase.firestore.Timestamp, now = Date.now(), DAY = 86400000;
  firebase.auth().createUserWithEmailAndPassword('sekretariat@contoh.id', 'Perancah2026');   /* signs in synchronously in the stub */
  const me = F.uid();
  F.console.set('admins/' + me, { uid: me, name: 'Sekretariat Uji', email: 'sekretariat@contoh.id', addedAt: '2026-10-01T02:00:00.000Z', addedBy: 'console' });
  const app = { type: 'baru', kategori: 'Praktisi', submittedAt: new Date(now - 2 * DAY).toISOString(), updatedAt: new Date(now - 2 * DAY).toISOString(), pengalaman: [{ id: 'p1', proyek: 'Gedung uji', peran: 'Mandor', tahun: '2025', lokasi: 'Bekasi' }], dokumen: [{ id: 'd1', jenis: 'CV', label: 'CV', url: 'https://example.com/cv.pdf' }], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Fajar Firebase', tanggal: '2026-10-07' }, catatan: '' };
  const prof = { birthPlace: 'Bekasi', birthDate: '1993-05-05', gender: 'Laki-laki', city: 'Bekasi', province: 'Jawa Barat', address: '', company: 'PT Firebase Uji', position: 'Mandor', experienceYears: 6, education: 'Diploma III (D3)', bio: '', linkedin: '' };
  F.console.set('members/' + me, { uid: me, name: 'Sekretariat Uji', email: 'sekretariat@contoh.id', phone: '', photoURL: '', kta: '', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-10-01', validUntil: '', approvedAt: '', approvedBy: '', profile: {}, competencies: [], certificates: [], application: {}, review: { note: '', history: [] }, createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z' });
  F.console.set('members/fb-pemohon-1', { uid: 'fb-pemohon-1', name: 'Fajar Firebase', email: 'fajar@contoh.id', phone: '+6281299990001', photoURL: '', kta: '', memberType: 'Praktisi', status: 'Menunggu Verifikasi', joinedAt: '2026-10-05', validUntil: '', approvedAt: '', approvedBy: '', profile: prof, competencies: [], certificates: [], application: app, review: { note: '', history: [] }, createdAt: new Date(now - 4 * DAY).toISOString(), updatedAt: new Date(now - 2 * DAY).toISOString() });
  F.console.set('members/fb-anggota-1', { uid: 'fb-anggota-1', name: 'Gita Aktif', email: 'gita@contoh.id', phone: '+6281299990002', photoURL: '', kta: 'PPAPI-2026-000050', memberType: 'Ahli', status: 'Aktif', joinedAt: '2026-02-01', validUntil: '2026-11-20', approvedAt: '2026-02-01T02:00:00.000Z', approvedBy: me, profile: Object.assign({}, prof, { city: 'Bogor' }), competencies: [], certificates: [], application: Object.assign({}, app, { kategori: 'Ahli' }), review: { note: '', history: [] }, createdAt: '2026-01-20T02:00:00.000Z', updatedAt: '2026-02-01T02:00:00.000Z' });
  F.console.set('registry/PPAPI-2026-000050', { kta: 'PPAPI-2026-000050', nama: 'Gita Aktif', kategori: 'Ahli', kompetensi: [], kota: 'Bogor', berlakuHingga: '2026-11-20', status: 'Aktif' });
  F.console.set('feedback/fb-ub-1', { kategori: 'Pertanyaan', nama: 'Hana', email: 'hana@contoh.id', phone: '', subjek: 'Jadwal pelatihan', pesan: 'Kapan pelatihan berikutnya dibuka?', rating: 5, anonim: false, uid: null, halaman: 'umpan-balik.html', createdAt: new TS(now - DAY) });
};

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name); console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(new Date('2026-10-09T10:00:00+07:00'));
  await ctx.addInitScript({ content: STUB_SRC });
  await ctx.addInitScript(SEED);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('html[data-admin-ready]', { timeout: 15000 });
  await page.waitForTimeout(200);
  const denied = () => page.evaluate(() => window.__fstub.log.filter(l => l[2] === false).map(l => l[0] + ' ' + l[1]));

  console.log('\nFirebase mode — Konsol Admin');
  check('1 mode firebase, admin session, stays on admin.html', await page.evaluate(() => PPAPI.auth.mode === 'firebase' && PPAPI.session.current().isAdmin) && page.url().endsWith('/admin.html'));
  check('2 hero badge "Firebase", no demo notice in the rail', await page.evaluate(() => /Firebase/.test(document.getElementById('adm-meta').textContent) && /Terhubung ke Firebase/.test(document.getElementById('adm-nav-foot').textContent)));
  const kpis = await page.$$eval('.adm-kpi .kpi__value', els => els.map(e => e.textContent.trim().split(/\s/)[0]));
  check('3 KPIs: 1 menunggu · 0 perbaikan · 1 aktif · 1 berakhir ≤60 hari · 0 · 1 umpan balik', kpis.join() === '1,0,1,1,0,1', kpis);
  await page.click('.adm-nav__link[data-section="permohonan"]');
  await page.waitForFunction(() => !document.getElementById('sec-permohonan').hidden);
  await page.click('#pq-list .adm-act');
  await page.waitForSelector('.drawer__panel');
  check('4 submission date rendered (Diajukan)', await page.evaluate(() => /7 Oktober 2026/.test(document.querySelector('.drawer__body').textContent)));
  check('5 "Formulir diajukan" derived from submittedAt (no history entry in Firebase)', await page.evaluate(() => /Formulir diajukan/.test(document.querySelector('.adm-track').textContent)));
  await page.click('#act-approve');
  await page.waitForSelector('.modal__dialog');
  await page.click('#dlg-approve-ok');
  await page.waitForSelector('#adm-kta-result', { timeout: 8000 });
  const kta = await page.$eval('.adm-kta__num', e => e.textContent.trim());
  const st = await page.evaluate(k => { const F = window.__fstub; return { m: F.console.get('members/fb-pemohon-1'), reg: F.console.get('registry/' + k), cnt: F.console.get('counters/kta-2026'), audit: Array.from(F.docs.keys()).filter(x => x.startsWith('audit_log/')).length, tx: F.transactions }; }, kta);
  check('6 approve in ONE rules-checked transaction: member Aktif + KTA + registry + counter + audit', st.m.status === 'Aktif' && st.m.kta === kta && !!st.reg && st.reg.status === 'Aktif' && st.cnt && st.cnt.value >= 1 && st.audit === 1 && st.tx >= 1, { kta, status: st.m.status, audit: st.audit });
  check('7 no permission-denied so far', (await denied()).length === 0, await denied());
  await page.click('.modal__footer .btn:last-child');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.drawer', { state: 'detached' });

  await page.click('.adm-nav__link[data-section="umpan-balik"]');
  await page.waitForFunction(() => !document.getElementById('sec-umpan-balik').hidden);
  check('8 feedback Timestamp createdAt shown', await page.evaluate(() => /8 Okt 2026/.test(document.getElementById('fb-list').textContent)));
  await page.click('#fb-list .adm-act');
  await page.waitForSelector('.drawer__panel');
  await page.click('.drawer input[name="status"][value="Selesai"] + .segmented__option');
  await page.fill('.drawer textarea[name="catatanAdmin"]', 'Dijawab via email.');
  await page.click('#fb-save');
  await page.waitForSelector('.drawer', { state: 'detached' });
  await page.waitForTimeout(150);
  const fb = await page.evaluate(() => window.__fstub.console.get('feedback/fb-ub-1'));
  check('9 feedback update allowed by rules (status, note, updatedBy = admin)', fb.status === 'Selesai' && fb.catatanAdmin === 'Dijawab via email.' && typeof fb.updatedBy === 'string' && fb.updatedBy.startsWith('fb-'), fb);

  await page.click('.adm-nav__link[data-section="konten"]');
  await page.waitForSelector('#kt-list tbody tr');
  check('10 no demo notice in Konten (Firebase)', await page.evaluate(() => !/Mode Demo/.test(document.getElementById('konten-body').textContent)));
  await page.click('#kt-add');
  await page.waitForSelector('.modal__dialog');
  await page.fill('.modal [name="judul"]', 'Berita dari Konsol Firebase');
  await page.fill('.modal [name="ringkasan"]', 'Ringkasan berita uji Firebase.');
  await page.click('#dlg-content-ok');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForTimeout(200);
  check('11 content_berita document written', await page.evaluate(() => Array.from(window.__fstub.docs.keys()).some(k => k.startsWith('content_berita/berita-dari-konsol-firebase'))));
  check('12 new item listed (Dikelola)', await page.evaluate(() => /Berita dari Konsol Firebase/.test(document.getElementById('kt-list').textContent)));

  await page.click('.adm-nav__link[data-section="admin"]');
  await page.waitForFunction(() => !document.getElementById('sec-admin').hidden);
  check('13 admin list shows the console-created admin with its date', await page.evaluate(() => /sekretariat@contoh\.id/.test(document.getElementById('admin-body').textContent) && /1 Okt 2026/.test(document.getElementById('admin-body').textContent)));
  await page.fill('#adm-add-email', 'gita@contoh.id');
  await page.click('#adm-add-check');
  await page.click('#adm-add-confirm');
  await page.waitForSelector('.modal__dialog');
  await page.click('.modal__footer .btn:last-child');
  await page.waitForFunction(() => document.querySelectorAll('#admin-body tbody tr').length === 2, null, { timeout: 5000 }).catch(() => {});
  check('14 addAdmin → admins/fb-anggota-1 written', await page.evaluate(() => !!window.__fstub.console.get('admins/fb-anggota-1')));
  await page.click('.adm-nav__link[data-section="log"]');
  await page.waitForFunction(() => !document.getElementById('sec-log').hidden);
  check('15 log reads audit_log (≥ 4 entries)', await page.evaluate(() => document.querySelectorAll('#log-list .adm-feed__item').length >= 4));
  check('16 no permission-denied for any console call', (await denied()).length === 0, await denied());
  await page.screenshot({ path: path.join(SHOTS, 'admin-firebase-log.png') });
  await ctx.close();
} catch (err) {
  fail++; failures.push('EXCEPTION: ' + err.message); console.error(err);
}
check('no page errors / console errors', errors.length === 0, errors.slice(0, 6));
await browser.close();
server.close();
console.log(`\nadmin-firebase: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n - ' + failures.join('\n - '));
process.exit(fail ? 1 : 0);
