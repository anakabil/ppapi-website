// Interaction flow for anggota.html (Halaman Anggota) — run from devtools/:
//   node flows/anggota-flow.mjs [--headed]
// Seeds the same demo session as check.mjs --auth, then exercises:
//   profile edit + dirty state + beforeunload guard + save persists after reload (incl. rename),
//   competency add / validate / edit / delete, certificate add (expiry in 30 days → "Segera kedaluwarsa"),
//   validation (dates, https link), no-expiry + document link, sorting & summary counts,
//   tab hash deep links, KTA flip (click + keyboard), QR render, copy link, print media, apps links.
// Screenshots: devtools/shots/anggota-flow-*.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const headed = process.argv.includes('--headed');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// same seeded session as check.mjs --auth
const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const M = { uid: U.uid, name: U.name, email: U.email, phone: U.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah dengan pengalaman proyek kilang dan gedung bertingkat.' },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }, { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' }],
  certificates: [{ id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' }, { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' }],
  updatedAt: '2026-09-30T08:00:00.000Z' };

const results = [];
const issues = [];
function ok(name, cond, extra = '') { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); }
const isoOffset = days => { const d = new Date(); d.setDate(d.getDate() + days); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const shot = async (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, `anggota-flow-${name}.png`), ...opts });

const browser = await chromium.launch({ headless: !headed });

async function newContext(extra = {}, member = M) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', reducedMotion: 'reduce', ...extra });
  await ctx.addInitScript(({ u, m }) => {
    try {
      if (!localStorage.getItem('ppapi_demo_session')) {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
        users[u.email] = { ...u, hash: 'x' };
        localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
      }
    } catch (e) {}
  }, { u: U, m: member });
  return ctx;
}
/* v2 fixtures (same transformations as check.mjs --auth --status=…) */
const clone = o => JSON.parse(JSON.stringify(o));
const APP = { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' };
function memberWith(st, extra = {}) {
  const m = Object.assign(clone(M), { validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', application: clone(APP), review: { note: '', history: [] } }, extra);
  if (st === 'Kedaluwarsa') { m.validUntil = '2026-06-30'; return m; }
  m.status = st;
  if (['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak'].includes(st)) { m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = ''; }
  if (st === 'Draf') m.application.submittedAt = '';
  return m;
}
const ADMIN_U = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
function watch(page, label) {
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) issues.push(`[${label}] console.${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', err => issues.push(`[${label}] pageerror: ${err.message}`));
  page.on('requestfailed', r => issues.push(`[${label}] requestfailed: ${r.url()} (${r.failure()?.errorText})`));
}
async function ready(page) {
  await page.waitForSelector('body.auth-ready');
  await page.waitForFunction(() => document.querySelector('#agt-meta') && !document.querySelector('#agt-meta').hasAttribute('aria-busy'));
}
async function toastText(page) {
  try { await page.waitForSelector('.toast', { timeout: 5000 }); }
  catch (e) { await page.screenshot({ path: path.join(SHOTS, 'anggota-flow-FAIL.png') }); const errs = await page.locator('.field__error').allTextContents(); throw new Error('toast missing; visible errors: ' + errs.filter(Boolean).join(' | ')); }
  return (await page.locator('.toast__msg').allTextContents()).join(' | ');
}
async function clearToasts(page) { await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); }
async function modalPrimary(page) { return page.locator('.modal .modal__footer .btn').last(); }

try {
  /* ================= A. Desktop, reduced motion ================= */
  const ctx = await newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  watch(page, 'desktop');
  await page.goto(`${BASE}/anggota.html`, { waitUntil: 'networkidle' });
  await ready(page);

  // ---- Hero
  ok('hero: name', (await page.locator('#agt-name').innerText()).includes('Rahmat Hidayat'));
  const meta = await page.locator('#agt-meta').innerText();
  ok('hero: KTA + type + status + joined', /PPAPI-2026-004821/.test(meta) && /Praktisi/i.test(meta) && /Aktif/i.test(meta) && /14 Maret 2026/i.test(meta), meta.replace(/\s+/g, ' '));
  ok('hero: contact chips (email + formatted phone)', (await page.locator('#agt-chips').innerText()).includes('+62 812-3456-7890'));
  ok('tabs: counts', (await page.locator('#count-kompetensi').innerText()).trim().startsWith('2') || (await page.locator('#count-kompetensi').textContent()).includes('2'));

  // ---- Profil: dirty state, validation, save, persistence
  ok('profil: clean state on load', (await page.locator('#profil-status').innerText()).toLowerCase().includes('tersimpan') && await page.locator('#profil-save').isDisabled());
  ok('profil: 38 provinces', (await page.locator('#f-province option').count()) === 39);
  ok('profil: legacy education kept', (await page.locator('#f-education').inputValue()) === 'D3 Teknik Sipil');
  await page.fill('#f-birthPlace', 'Samarinda');
  await page.fill('#f-birthDate', '1988-04-12');
  await page.check('#f-gender-l');
  await page.fill('#f-address', 'Jl. Contoh Raya No. 1');
  await page.fill('#f-name', 'Rahmat Hidayat Saputra');
  await page.fill('#f-linkedin', 'https://example.com/rahmat');
  await page.fill('#f-bio', 'Supervisor perancah tube & coupler dan sistem ringlock untuk proyek kilang serta gedung bertingkat.');
  const dirtyText = await page.locator('#profil-status').innerText();
  ok('profil: dirty indicator', /belum disimpan/i.test(dirtyText) && await page.locator('#profil-savebar').evaluate(el => el.classList.contains('is-dirty')), dirtyText);
  ok('profil: bio counter', /\d+ \/ 1\.000/.test(await page.locator('#f-bio-count').innerText()));
  const guard = await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  ok('profil: beforeunload guard while dirty', guard === true);
  let dialogType = null;
  page.once('dialog', d => { dialogType = d.type(); d.dismiss().catch(() => {}); });
  await page.evaluate(() => { setTimeout(() => location.reload(), 0); });
  await page.waitForTimeout(1200);
  ok('profil: browser shows leave-page dialog (beforeunload)', dialogType === 'beforeunload', `dialog=${dialogType}`);
  ok('profil: still on page with edits after cancelled reload', (await page.inputValue('#f-birthPlace')) === 'Samarinda');
  await shot(page, 'profil-dirty', { clip: { x: 0, y: 0, width: 1440, height: 900 } });

  await page.click('#profil-save');
  await page.waitForTimeout(200);
  const liErr = await page.locator('#f-linkedin-err').innerText().catch(() => '');
  ok('profil: invalid LinkedIn blocked with inline error', /LinkedIn/i.test(liErr) && (await page.getAttribute('#f-linkedin', 'aria-invalid')) === 'true', liErr);
  await clearToasts(page);
  await page.fill('#f-linkedin', 'linkedin.com/in/rahmat-hidayat');
  await page.click('#profil-save');
  const t1 = await toastText(page);
  ok('profil: save toast', /berhasil disimpan/i.test(t1), t1);
  await page.waitForFunction(() => /tersimpan/i.test(document.querySelector('#profil-status').textContent));
  ok('profil: clean after save', await page.locator('#profil-save').isDisabled());
  ok('profil: hero renamed', (await page.locator('#agt-name').innerText()).includes('Rahmat Hidayat Saputra'));
  await page.reload({ waitUntil: 'networkidle' });
  await ready(page);
  ok('persist: birthPlace after reload', (await page.inputValue('#f-birthPlace')) === 'Samarinda');
  ok('persist: birthDate + gender', (await page.inputValue('#f-birthDate')) === '1988-04-12' && await page.isChecked('#f-gender-l'));
  ok('persist: name (auth + member)', (await page.inputValue('#f-name')) === 'Rahmat Hidayat Saputra' && (await page.locator('.account__name').innerText()).toLowerCase() === 'rahmat');
  ok('persist: LinkedIn normalised to https', (await page.inputValue('#f-linkedin')) === 'https://linkedin.com/in/rahmat-hidayat');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_member_demo-uji-0001')));
  ok('persist: store whitelist shape (12 profile keys)', Object.keys(stored.profile).length === 12 && stored.name === 'Rahmat Hidayat Saputra');
  ok('profil: completeness updated', /\d+/.test(await page.locator('.agt-complete__num').innerText()));

  // ---- Tab hash sync
  await page.click('#tab-kompetensi');
  ok('hash: tab click updates hash', (await page.evaluate(() => location.hash)) === '#kompetensi');

  // ---- Kompetensi: add (katalog), validation, Lainnya, edit, delete
  ok('kompetensi: 2 seeded cards', (await page.locator('.agt-comp').count()) === 2);
  await page.click('#panel-kompetensi .agt-panel-head [data-action="add-kompetensi"]');
  await page.waitForSelector('.modal #mk-kode'); await page.waitForTimeout(120); // let the modal's autofocus settle
  ok('kompetensi modal: optgroups by kelompok', (await page.locator('.modal #mk-kode optgroup').count()) >= 5);
  await (await modalPrimary(page)).click();
  ok('kompetensi modal: empty submit shows error', /Pilih kompetensi/i.test(await page.locator('#mk-kode-err').innerText().catch(() => '')));
  await page.selectOption('.modal #mk-kode', 'SCF-06');
  ok('kompetensi modal: katalog description shown', /SCF-06/.test(await page.locator('#mk-desc').innerText()));
  await page.selectOption('.modal #mk-level', 'Ahli');
  await page.fill('.modal #mk-since', '2015');
  await page.fill('.modal #mk-notes', 'Pengawasan perancah tube & coupler pada proyek kilang.');
  await shot(page, 'kompetensi-modal');
  await (await modalPrimary(page)).click();
  const t2 = await toastText(page);
  ok('kompetensi: add toast', /ditambahkan/i.test(t2), t2);
  await page.waitForSelector('.modal', { state: 'detached' });
  ok('kompetensi: 3 cards', (await page.locator('.agt-comp').count()) === 3);
  const firstTitle = await page.locator('.agt-comp .agt-comp__title').first().innerText();
  ok('kompetensi: sorted by level (Ahli first)', firstTitle === 'Pengawas Scaffolding', firstTitle);
  ok('kompetensi: level meter 4 steps (Ahli = 4/4)', (await page.locator('.agt-comp').first().locator('.agt-level__bars .is-on').count()) === 4);
  await clearToasts(page);

  await page.click('#panel-kompetensi .agt-panel-head [data-action="add-kompetensi"]');
  await page.waitForSelector('.modal #mk-kode'); await page.waitForTimeout(120); // let the modal's autofocus settle
  await page.selectOption('.modal #mk-kode', '__lain');
  ok('kompetensi modal: "Lainnya" reveals free-text field', await page.locator('.modal #mk-nama').isVisible());
  await page.fill('.modal #mk-nama', 'Perancah Gantung');
  await page.fill('.modal #mk-since', '2031');
  await (await modalPrimary(page)).click();
  ok('kompetensi modal: year validation', /tahun antara/i.test(await page.locator('#mk-since-err').innerText().catch(() => '')));
  await page.fill('.modal #mk-since', '2020');
  await (await modalPrimary(page)).click();
  await toastText(page);
  await page.waitForSelector('.modal', { state: 'detached' });
  ok('kompetensi: free-text item added', (await page.locator('.agt-comp__title', { hasText: 'Perancah Gantung' }).count()) === 1);
  await clearToasts(page);

  await page.locator('.agt-comp', { hasText: 'Inspektur Perancah' }).locator('[data-action="edit-kompetensi"]').click();
  await page.waitForSelector('.modal #mk-level'); await page.waitForTimeout(120); // let the modal's autofocus settle
  ok('kompetensi edit: prefilled (non-katalog → Lainnya)', (await page.inputValue('.modal #mk-kode')) === '__lain' && (await page.inputValue('.modal #mk-nama')) === 'Inspektur Perancah');
  await page.selectOption('.modal #mk-level', 'Mahir');
  await (await modalPrimary(page)).click();
  ok('kompetensi edit: toast', /diperbarui/i.test(await toastText(page)));
  await page.waitForSelector('.modal', { state: 'detached' });
  ok('kompetensi edit: level updated', (await page.locator('.agt-comp', { hasText: 'Inspektur Perancah' }).locator('.agt-level__labels .is-current').innerText()).toLowerCase() === 'mahir');
  await clearToasts(page);

  await page.locator('.agt-comp', { hasText: 'Perancah Gantung' }).locator('[data-action="delete-kompetensi"]').click();
  await page.waitForSelector('.modal .modal__title');
  ok('kompetensi delete: confirm dialog', /Hapus kompetensi/i.test(await page.locator('.modal .modal__title').innerText()));
  await shot(page, 'kompetensi-confirm', { clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await (await modalPrimary(page)).click();
  ok('kompetensi delete: toast', /dihapus/i.test(await toastText(page)));
  await page.waitForTimeout(300);
  ok('kompetensi delete: removed', (await page.locator('.agt-comp').count()) === 3 && (await page.locator('.agt-comp__title', { hasText: 'Perancah Gantung' }).count()) === 0);
  ok('kompetensi: tab count updated', (await page.locator('#count-kompetensi').textContent()).includes('3'));
  await shot(page, 'kompetensi', { fullPage: false });
  await clearToasts(page);

  // ---- Sertifikat
  await page.click('#tab-sertifikat');
  ok('sertifikat: 2 seeded rows', (await page.locator('.agt-cert-table tbody tr').count()) === 2);
  ok('sertifikat: soonest expiry first', (await page.locator('.agt-cert-table tbody tr').first().locator('.agt-cert__title').innerText()) === 'Ahli K3 Umum');
  await page.click('#panel-sertifikat .agt-panel-head [data-action="add-sertifikat"]');
  await page.waitForSelector('.modal #mc-title'); await page.waitForTimeout(120); // let the modal's autofocus settle
  await page.fill('.modal #mc-title', 'Pengawas Scaffolding');
  await page.fill('.modal #mc-number', 'UJI/2024/0099');
  await page.selectOption('.modal #mc-issuer', 'BNSP / LSP');
  await page.fill('.modal #mc-issued', isoOffset(-700));
  await page.fill('.modal #mc-expires', isoOffset(-800));
  await page.fill('.modal #mc-link', 'http://drive.google.com/file/x');
  await (await modalPrimary(page)).click();
  ok('sertifikat modal: expiry before issue rejected', /setelah tanggal terbit/i.test(await page.locator('#mc-expires-err').innerText().catch(() => '')));
  ok('sertifikat modal: non-https link rejected', /https/i.test(await page.locator('#mc-link-err').innerText().catch(() => '')));
  await shot(page, 'sertifikat-modal-errors');
  await page.fill('.modal #mc-expires', isoOffset(30));
  await page.fill('.modal #mc-link', '');
  await (await modalPrimary(page)).click();
  const t3 = await toastText(page);
  ok('sertifikat: add toast mentions 30 days', /30 hari/.test(t3), t3);
  await page.waitForSelector('.modal', { state: 'detached' });
  const firstRow = page.locator('.agt-cert-table tbody tr').first();
  ok('sertifikat: new (30 days) row sorted first', (await firstRow.locator('.agt-cert__title').innerText()) === 'Pengawas Scaffolding');
  const badge = await firstRow.locator('.badge').innerText();
  ok('sertifikat: "Segera kedaluwarsa (30 hari)" badge', /segera kedaluwarsa \(30 hari\)/i.test(badge), badge);
  await clearToasts(page);

  await page.click('#panel-sertifikat .agt-panel-head [data-action="add-sertifikat"]');
  await page.waitForSelector('.modal #mc-title'); await page.waitForTimeout(120); // let the modal's autofocus settle
  await page.fill('.modal #mc-title', 'Ahli K3 Konstruksi Muda');
  await page.fill('.modal #mc-number', 'UJI/K3/2023/12');
  await page.selectOption('.modal #mc-issuer', 'Lainnya');
  ok('sertifikat modal: "Lainnya" reveals issuer field', await page.locator('.modal #mc-other').isVisible());
  await page.fill('.modal #mc-other', 'Lembaga Uji Contoh');
  await page.fill('.modal #mc-issued', '2023-05-02');
  await page.check('.modal #mc-noexp');
  ok('sertifikat modal: no-expiry disables date', await page.locator('.modal #mc-expires').isDisabled());
  await page.fill('.modal #mc-link', 'https://drive.google.com/file/d/contoh/view');
  await (await modalPrimary(page)).click();
  await toastText(page);
  await page.waitForSelector('.modal', { state: 'detached' });
  const lastRow = page.locator('.agt-cert-table tbody tr').last();
  ok('sertifikat: tanpa batas sorted last', (await lastRow.locator('.agt-cert__title').innerText()) === 'Ahli K3 Konstruksi Muda');
  ok('sertifikat: "Tanpa batas" status', /tanpa batas/i.test(await lastRow.locator('.badge').innerText()));
  const docLink = lastRow.locator('a.agt-doclink');
  ok('sertifikat: document link (new tab, noopener)', (await docLink.getAttribute('target')) === '_blank' && /noopener/.test(await docLink.getAttribute('rel')) && /Lihat dokumen/i.test(await docLink.innerText()));
  const sums = await page.locator('.agt-sum__num .count__value').allTextContents();
  ok('sertifikat: summary counts (4 total, 2 segera)', sums[0].trim() === '4' && sums[2].trim() === '2', sums.join(','));
  ok('sertifikat: expiry alert shown', /90 hari/.test(await page.locator('#sertifikat-alert').innerText()));
  await clearToasts(page);
  await shot(page, 'sertifikat', { fullPage: true });
  await page.locator('.agt-cert-table tbody tr', { hasText: 'Ahli K3 Konstruksi Muda' }).locator('[data-action="delete-sertifikat"]').click();
  await page.waitForSelector('.modal .modal__title');
  await (await modalPrimary(page)).click();
  ok('sertifikat delete', /dihapus/i.test(await toastText(page)));
  await page.waitForTimeout(300);
  ok('sertifikat: 3 rows after delete', (await page.locator('.agt-cert-table tbody tr').count()) === 3);
  await clearToasts(page);

  // ---- Hero "Kartu Anggota" button → #kartu
  await page.evaluate(() => scrollTo(0, 0));
  await page.click('.agt-hero [data-goto-tab="kartu"]');
  await page.waitForTimeout(300);
  ok('hero button selects Kartu tab', (await page.getAttribute('#tab-kartu', 'aria-selected')) === 'true' && (await page.evaluate(() => location.hash)) === '#kartu');

  // ---- KTA: QR, flip (click + keyboard), copy, print media
  await page.waitForFunction(() => { const b = document.querySelector('#kta-qr'); return b && /ready|fallback/.test(b.getAttribute('data-state') || ''); }, null, { timeout: 20000 });
  const qrState = await page.getAttribute('#kta-qr', 'data-state');
  ok('KTA: QR rendered as SVG', qrState === 'ready' && (await page.locator('#kta-qr svg path').count()) > 0, `state=${qrState}`);
  const qrUrl = await page.getAttribute('#kta-qr', 'data-url');
  ok('KTA: QR encodes absolute verification URL', qrUrl === `${BASE}/verifikasi.html?kta=PPAPI-2026-004821`, qrUrl);
  const kta = await page.locator('.agt-kta__name').innerText();
  ok('KTA: holder name on card', kta === 'Rahmat Hidayat Saputra', kta);
  // No invented validity term: the seeded KTA is not in the official registry and config sets no term,
  // so the card shows the real join date and the info list says the term is set by the secretariat.
  const facts = await page.locator('.agt-kta__facts').innerText();
  const termRow = await page.locator('.agt-kta-info .kv__row', { hasText: /berlaku hingga/i }).innerText();
  ok('KTA: no invented "berlaku hingga" date', /anggota sejak\s+14 Mar 2026/i.test(facts) && !/berlaku hingga/i.test(facts) && /ditetapkan oleh sekretariat/i.test(termRow), `${facts.replace(/\s+/g, ' ')} | ${termRow.replace(/\s+/g, ' ')}`);
  ok('KTA: QR generated locally (no third-party script)', await page.evaluate(() => !document.querySelector('script[src^="http"]:not([src*="' + location.host + '"])')));
  await shot(page, 'kartu-front', { clip: await page.locator('.agt-kta-stage').boundingBox() });
  await page.click('#kta');
  ok('KTA flip: click', await page.locator('#kta').evaluate(el => el.classList.contains('is-flipped')) && /belakang/.test(await page.getAttribute('#kta', 'aria-label')));
  ok('KTA flip: toggle label', /sisi depan/i.test(await page.locator('#kta-flip').innerText()));
  await page.waitForTimeout(150);
  await shot(page, 'kartu-back', { clip: await page.locator('.agt-kta-stage').boundingBox() });
  await page.focus('#kta');
  await page.keyboard.press('Enter');
  ok('KTA flip: keyboard Enter', !(await page.locator('#kta').evaluate(el => el.classList.contains('is-flipped'))));
  await page.click('#kta-flip');
  ok('KTA flip: toggle button', await page.locator('#kta').evaluate(el => el.classList.contains('is-flipped')));
  await page.click('#kta-flip');
  await page.click('[data-copy][data-copy-message]');
  const t4 = await toastText(page);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('KTA: copy verification link', /disalin/i.test(t4) && clip === qrUrl, clip);
  await clearToasts(page);
  await page.emulateMedia({ media: 'print' });
  const printInfo = await page.evaluate(() => ({
    hero: getComputedStyle(document.querySelector('.agt-hero')).display,
    tabs: getComputedStyle(document.querySelector('.agt-tabs__bar')).display,
    info: getComputedStyle(document.querySelector('.agt-kta-info')).display,
    faces: [...document.querySelectorAll('.agt-kta__face')].map(f => { const s = getComputedStyle(f); return s.visibility + '/' + s.opacity + '/' + Math.round(f.getBoundingClientRect().width); })
  }));
  ok('print: only the card (both sides) is printed', printInfo.hero === 'none' && printInfo.tabs === 'none' && printInfo.info === 'none' && printInfo.faces.every(f => f.startsWith('visible/1')), JSON.stringify(printInfo));
  await page.pdf({ path: path.join(SHOTS, 'anggota-flow-print.pdf'), format: 'A4', printBackground: false }).catch(e => issues.push('pdf: ' + e.message));
  await shot(page, 'print', { fullPage: true });
  await page.emulateMedia({ media: 'screen' });

  // ---- Aplikasi (v2: internal member apps aplikasi/…, same tab — SPEC-v2 §4.4/§4.5)
  await page.click('#tab-aplikasi');
  const appLinks = page.locator('.agt-app a.btn');
  ok('aplikasi: 2 launch cards', (await page.locator('.agt-app').count()) === 2);
  const hrefs = await appLinks.evaluateAll(as => as.map(a => [a.getAttribute('href'), a.target, a.rel]));
  ok('aplikasi: internal app paths, same tab', hrefs.length === 2 && hrefs[0][0] === 'aplikasi/perencanaan/index.html' && hrefs[1][0] === 'aplikasi/simulator/index.html' && hrefs.every(([, t]) => t === ''), JSON.stringify(hrefs));
  const appHeads = await page.locator('.agt-app').evaluateAll(cs => cs.map(c => c.querySelector('.eyebrow').textContent.trim() + '|' + c.querySelector('.agt-app__title').textContent.trim()));
  // client rule 2026-10-10: the planning app title carries "(Beta)" (intentional change)
  ok('aplikasi: brand as eyebrow, name as title', appHeads.join() === 'PPAPI Scaffold (Beta)|Perencanaan & Analisis Struktur,Simulator 3D pelatihan K3|Simulator Pemasangan Perancah Tube & Coupler', appHeads.join());
  ok('aplikasi: features listed (4 + 4)', (await page.locator('.agt-app__features li').count()) === 8);
  ok('aplikasi: "Khusus anggota Aktif" note, no new-tab wording', /khusus anggota aktif/i.test(await page.locator('.agt-app__note').first().innerText()) && !/tab baru/i.test(await page.locator('#aplikasi-area').innerText()));
  ok('aplikasi: portal note + appNote', /bilah portal/i.test(await page.locator('.agt-apps-note').innerText()) && /indikatif/.test(await page.locator('.agt-apps-note').innerText()));
  await ctx.close();

  /* ================= B. Deep links (fresh context) ================= */
  const ctx2 = await newContext();
  const p2 = await ctx2.newPage();
  watch(p2, 'deeplink');
  for (const key of ['kompetensi', 'sertifikat', 'kartu', 'aplikasi', 'profil']) {
    await p2.goto(`${BASE}/anggota.html#${key}`, { waitUntil: 'networkidle' });
    await ready(p2);
    const sel = await p2.getAttribute(`#tab-${key}`, 'aria-selected');
    const vis = await p2.locator(`#panel-${key}`).isVisible();
    ok(`deep link #${key}`, sel === 'true' && vis);
  }
  await p2.goto(`${BASE}/anggota.html#kartu`, { waitUntil: 'networkidle' });
  await ready(p2);
  await p2.evaluate(() => { location.hash = '#sertifikat'; });
  await p2.waitForTimeout(200);
  ok('hashchange selects tab', (await p2.getAttribute('#tab-sertifikat', 'aria-selected')) === 'true');
  await ctx2.close();

  /* ================= C. Motion: 3D flip (no reduced motion) ================= */
  const ctx3 = await newContext({ reducedMotion: 'no-preference' });
  const p3 = await ctx3.newPage();
  watch(p3, 'motion');
  await p3.goto(`${BASE}/anggota.html#kartu`, { waitUntil: 'networkidle' });
  await ready(p3);
  await p3.waitForFunction(() => /ready|fallback/.test(document.querySelector('#kta-qr')?.getAttribute('data-state') || ''), null, { timeout: 20000 });
  await p3.locator('.agt-kta-stage').scrollIntoViewIfNeeded();
  await p3.waitForTimeout(1500);
  await p3.click('#kta');
  await p3.waitForTimeout(450);
  await shot(p3, 'kartu-flip-mid', { clip: await p3.locator('.agt-kta-stage').boundingBox() });
  await p3.waitForTimeout(1100);
  const tr = await p3.locator('.agt-kta__inner').evaluate(el => getComputedStyle(el).transform);
  ok('motion: 3D rotateY flip applied', tr && tr !== 'none', tr);
  await shot(p3, 'kartu-flip-motion', { clip: await p3.locator('.agt-kta-stage').boundingBox() });
  await ctx3.close();

  /* ================= D. Mobile modal + card ================= */
  const ctx4 = await newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p4 = await ctx4.newPage();
  watch(p4, 'mobile');
  await p4.goto(`${BASE}/anggota.html#sertifikat`, { waitUntil: 'networkidle' });
  await ready(p4);
  await p4.click('#panel-sertifikat .agt-panel-head [data-action="add-sertifikat"]');
  await p4.waitForSelector('.modal #mc-title'); await p4.waitForTimeout(120); // let the modal's autofocus settle
  await p4.waitForTimeout(200);
  await shot(p4, 'mobile-sertifikat-modal');
  const over = await p4.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('mobile: no horizontal overflow with modal open', over <= 1, `overflow=${over}`);
  await p4.keyboard.press('Escape');
  await p4.waitForTimeout(300);
  ok('mobile: Esc closes modal', (await p4.locator('.modal').count()) === 0);
  await p4.click('#tab-kartu');
  await p4.waitForFunction(() => /ready|fallback/.test(document.querySelector('#kta-qr')?.getAttribute('data-state') || ''), null, { timeout: 20000 });
  await p4.click('#kta-flip');
  await p4.waitForTimeout(150);
  await shot(p4, 'mobile-kartu-back', { clip: await p4.locator('.agt-kta-stage').boundingBox() });
  await ctx4.close();

  /* ================= E. v2: KTA uses the real validUntil set at approval ================= */
  {
    const ctx5 = await newContext({}, memberWith('Aktif'));
    const p5 = await ctx5.newPage();
    watch(p5, 'v2-validity');
    await p5.goto(`${BASE}/anggota.html#kartu`, { waitUntil: 'networkidle' });
    await ready(p5);
    const heroMeta = (await p5.locator('#agt-meta').innerText()).replace(/\s+/g, ' ');
    ok('v2 hero: KTA + kategori + Aktif badge + "Berlaku hingga 31 Desember 2029"', /PPAPI-2026-004821/.test(heroMeta) && /berlaku hingga 31 desember 2029/i.test(heroMeta) && (await p5.locator('#agt-meta .badge--ok[data-status="Aktif"]').count()) === 1, heroMeta);
    const facts = (await p5.locator('.agt-kta__facts').innerText()).replace(/\s+/g, ' ');
    ok('v2 KTA front: "Berlaku hingga 31 Des 2029" (member.validUntil)', /berlaku hingga 31 des 2029/i.test(facts) && /aktif/i.test(facts), facts);
    const term = (await p5.locator('.agt-kta-info .kv__row', { hasText: /berlaku hingga/i }).innerText()).replace(/\s+/g, ' ');
    ok('v2 KTA details: Berlaku hingga 31 Desember 2029', /31 desember 2029/i.test(term), term);
    ok('v2 KTA details: status badge from effective status', (await p5.locator('.agt-kta-info .badge[data-status="Aktif"]').count()) === 1);
    ok('v2 KTA: no renewal alert while > 60 days', (await p5.locator('.agt-renew').count()) === 0);
    ok('v2 page title "Profil Anggota — PPAPI"', (await p5.title()) === 'Profil Anggota — PPAPI');
    await ctx5.close();
  }

  /* ================= F. v2: renewal reminder on the card (≤ 60 days) ================= */
  {
    const ctx6 = await newContext({}, memberWith('Aktif', { validUntil: isoOffset(30) }));
    const p6 = await ctx6.newPage();
    watch(p6, 'v2-renew');
    await p6.goto(`${BASE}/anggota.html#kartu`, { waitUntil: 'networkidle' });
    await ready(p6);
    const alertText = (await p6.locator('.agt-renew').innerText().catch(() => '')).replace(/\s+/g, ' ');
    ok('v2 renewal alert: "berakhir dalam 30 hari" + pause warning', /berakhir dalam 30 hari/i.test(alertText) && /ditangguhkan sementara/i.test(alertText), alertText);
    ok('v2 renewal CTA → pendaftaran.html#perpanjangan', (await p6.locator('.agt-renew a.btn').getAttribute('href').catch(() => '')) === 'pendaftaran.html#perpanjangan');
    await shot(p6, 'v2-renew', { clip: await p6.locator('#kartu-area').boundingBox() });
    await ctx6.close();
  }

  /* ================= G. v2 gate: data-auth="active" — non-active members go to the dashboard ================= */
  for (const st of ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak', 'Nonaktif', 'Kedaluwarsa']) {
    const c = await newContext({}, memberWith(st));
    const pg = await c.newPage();
    watch(pg, 'v2-gate-' + st);
    await pg.goto(`${BASE}/anggota.html#kartu`, { waitUntil: 'networkidle' });
    await pg.waitForURL(/dashboard\.html/, { timeout: 8000 }).catch(() => {});
    await pg.waitForSelector('.toast__msg', { timeout: 5000 }).catch(() => {});
    const toast = (await pg.locator('.toast__msg').allTextContents()).join(' | ');
    ok(`v2 gate (${st}): redirected to dashboard.html with toast`, /\/dashboard\.html$/.test(pg.url()) && /Fitur ini khusus anggota berstatus Aktif\./.test(toast), `${pg.url()} · ${toast}`);
    ok(`v2 gate (${st}): no KTA / QR rendered`, (await pg.locator('#kta, #kta-qr').count()) === 0);
    await c.close();
  }

  /* ================= H. v2: admin whose own membership is not Aktif ================= */
  {
    const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', reducedMotion: 'reduce' });
    await c.addInitScript(({ a }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
      } catch (e) {}
    }, { a: ADMIN_U });
    const pg = await c.newPage();
    watch(pg, 'v2-admin');
    await pg.goto(`${BASE}/anggota.html#kartu`, { waitUntil: 'networkidle' });
    await ready(pg);
    ok('v2 admin: page allowed (stays on anggota.html)', /\/anggota\.html#kartu$/.test(pg.url()), pg.url());
    const heroMeta = (await pg.locator('#agt-meta').innerText()).replace(/\s+/g, ' ');
    ok('v2 admin hero: Admin badge, no KTA, no own status badge', /admin ppapi/i.test(heroMeta) && !/PPAPI-\d{4}-\d{6}/.test(heroMeta) && (await pg.locator('#agt-meta [data-status]').count()) === 0, heroMeta);
    ok('v2 admin: no card / QR issued', (await pg.locator('#kta, #kta-qr').count()) === 0);
    const panel = (await pg.locator('.agt-nocard').innerText().catch(() => '')).replace(/\s+/g, ' ');
    ok('v2 admin: explanatory locked panel (status Draf)', /belum terbit/i.test(panel) && /sebagai admin PPAPI/.test(panel) && /saat ini: Draf/.test(panel), panel);
    const links = await pg.locator('.agt-nocard a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    ok('v2 admin: panel links → pendaftaran.html + admin.html', links.join() === 'pendaftaran.html,admin.html', links.join());
    await pg.click('#tab-aplikasi');
    ok('v2 admin: apps tab available', (await pg.locator('.agt-app a.btn[href^="aplikasi/"]').count()) === 2);
    await shot(pg, 'v2-admin-kartu', { fullPage: false });
    await c.close();
  }

  /* ================= I. v2 mobile: card, renewal alert and apps fit 390 px ================= */
  {
    const c = await newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, memberWith('Aktif', { validUntil: isoOffset(20) }));
    const pg = await c.newPage();
    watch(pg, 'v2-mobile');
    for (const tab of ['kartu', 'aplikasi', 'profil']) {
      await pg.goto(`${BASE}/anggota.html#${tab}`, { waitUntil: 'networkidle' });
      await ready(pg);
      const over = await pg.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(`v2 mobile #${tab}: no horizontal overflow`, over <= 1, `overflow=${over}`);
    }
    await pg.goto(`${BASE}/anggota.html#kartu`, { waitUntil: 'networkidle' });
    await ready(pg);
    await shot(pg, 'v2-mobile-kartu', { fullPage: true });
    await c.close();
  }

  /* ================= J. v2: stored markup on an ACTIVE record renders as text on every tab =================
     (security-lens.mjs seeds a v1 record that is no longer Aktif, so it now stops at the gate) */
  {
    const X = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';
    const m = memberWith('Aktif', {
      name: 'Rahmat ' + X, memberType: 'Praktisi',
      profile: Object.assign(clone(M.profile), { city: X, company: '"><svg onload="window.__xss=1">', bio: X }),
      competencies: [{ id: 'k1', code: '', name: 'Kompetensi ' + X, level: 'Ahli', since: 2019, notes: X }],
      certificates: [{ id: 'c1', title: 'Sertifikat ' + X, number: X, issuer: X, issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: 'javascript:alert(1)' }],
    });
    const c = await newContext({}, m);
    const pg = await c.newPage();
    let dialogs = 0;
    pg.on('dialog', d => { dialogs++; d.dismiss().catch(() => {}); });
    for (const tab of ['profil', 'kompetensi', 'sertifikat', 'kartu', 'aplikasi']) {
      await pg.goto(`${BASE}/anggota.html#${tab}`, { waitUntil: 'networkidle' });
      await ready(pg);
      await pg.waitForTimeout(150);
      const r = await pg.evaluate(() => ({
        xss: window.__xss || 0,
        injected: document.querySelectorAll('main img[src="x"], main svg[onload], main [onerror]').length,
        jsHref: [...document.querySelectorAll('main a[href]')].filter(a => /^\s*javascript:/i.test(a.getAttribute('href'))).length,
        onKta: /^\/anggota\.html/.test(location.pathname),
      }));
      ok(`v2 XSS #${tab}: rendered as text, no script / javascript: link`, r.onKta && r.xss === 0 && r.injected === 0 && r.jsHref === 0 && dialogs === 0, JSON.stringify(r));
    }
    ok('v2 XSS: name shown literally in the hero', (await pg.locator('#agt-name').innerText()).includes('<img src=x'));
    await c.close();
  }
} catch (e) {
  console.error(e);
  ok('flow completed without exception', false, e.message.split('\n')[0]);
}

await browser.close();
server.close();
const failed = results.filter(r => !r.pass);
if (issues.length) { console.log('\nConsole / page issues:'); issues.forEach(i => console.log('  ! ' + i)); }
console.log(`\n${results.length - failed.length}/${results.length} checks passed, ${issues.length} console/page issue(s).`);
process.exit(failed.length || issues.length ? 1 : 0);
