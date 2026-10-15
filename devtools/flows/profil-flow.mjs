// Interaction + rendering flow for profil.html and keanggotaan.html.
// Run from devtools/:  node flows/profil-flow.mjs
// Serves ../site, drives Chromium (reduced motion unless --motion), prints PASS/FAIL per check and
// saves a few interaction screenshots to devtools/shots/flow-profil-*.png / flow-keanggotaan-*.png.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const MOTION = process.argv.includes('--motion');

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
const ORG_JS = fs.readFileSync(path.join(ROOT, 'assets/data/organisasi.js'), 'utf8');

let pass = 0, fail = 0;
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
}

const browser = await chromium.launch();
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

/* v2 (keanggotaan): a member record with a given lifecycle status (same fixture shape as check.mjs --auth --status) */
function memberFixture(status) {
  const m = {
    uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890',
    kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
    approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', profile: { city: 'Balikpapan' }, competencies: [], certificates: [],
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' },
    review: { note: '', history: [] }, updatedAt: '2026-09-30T08:00:00.000Z',
  };
  if (status === 'Kedaluwarsa') m.validUntil = '2026-06-30';
  else if (status && status !== 'Aktif') {
    m.status = status;
    if (status !== 'Nonaktif') { m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = ''; }
    if (status === 'Draf') { m.application.submittedAt = ''; m.application.kategori = ''; m.application.updatedAt = ''; }
  }
  return m;
}

async function open(page, { vp = DESKTOP, orgPatch = '', session = false, member = '', admin = false } = {}) {
  const ctx = await browser.newContext({ ...vp, reducedMotion: MOTION ? 'no-preference' : 'reduce', locale: 'id-ID' });
  if (session || member) {
    await ctx.addInitScript(({ m }) => {
      const u = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
      try {
        if (sessionStorage.getItem('__pf_seeded')) return;
        sessionStorage.setItem('__pf_seeded', '1');
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        if (m) localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
      } catch (e) {}
    }, { m: member ? memberFixture(member) : null });
  }
  if (admin) {
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('ppapi_demo_session', JSON.stringify({ uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' }));
        localStorage.setItem('ppapi_demo_admins', JSON.stringify(['demo-admin-0001']));
      } catch (e) {}
    });
  }
  if (orgPatch) {
    await ctx.route('**/assets/data/organisasi.js', route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: ORG_JS + '\n' + orgPatch }));
  }
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
  p.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.goto(`${BASE}/${page}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => document.body.classList.contains('auth-ready'));
  await p.waitForTimeout(300);
  return { ctx, p, errors };
}
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
async function logoLoaded(p) {
  await p.locator('.logo-sheet__art img').scrollIntoViewIfNeeded();
  return p.waitForFunction(() => { const i = document.querySelector('.logo-sheet__art img'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 8000 }).then(() => true, () => false);
}

/* =============================== PROFIL =============================== */
console.log('\nprofil.html — desktop');
{
  const { ctx, p, errors } = await open('profil.html');
  const r = await p.evaluate(() => {
    const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
    return {
      h1: $$('h1').length,
      quote: !!$('.profil-quote__text p'),
      fakta: $$('[data-fakta] .kv__row').length,
      faktaNote: !$('[data-fakta-note]').hidden,
      visi: ($('.profil-visi__statement') || {}).textContent || '',
      misi: $$('.profil-misi__item').length,
      nilai: $$('.profil-nilai__card').length,
      nilaiIcons: $$('.profil-nilai__icon svg').length,
      sejarah: $$('[data-sejarah] .timeline__item').length,
      sejarahContoh: $$('[data-sejarah] .badge--contoh').length,
      pengurus: $$('.profil-person').length,
      pengurusContoh: $$('.profil-person .badge--contoh').length,
      pengurusSectionBadge: $$('#struktur .eyebrow .badge--contoh').length,
      pengurusPending: $$('.profil-person--pending .profil-person__pending').length,
      pengurusNums: $$('.profil-person__num').map(n => n.textContent).join(','),
      pengurusSampleName: /Nama Pengurus/.test($('[data-pengurus]').textContent),
      pengurusNote: !$('[data-pengurus-note]').hidden,
      legalHidden: $('#legalitas').hidden,
      index: $$('.profil-index__link').map(a => a.textContent.trim()),
      nums: $$('main [data-num]').filter(n => n.textContent).map(n => n.textContent.trim()),
      visiBadge: !!$('#visi-misi .eyebrow .badge--contoh'),
      misiBadge: !!$('#misi .eyebrow .badge--contoh'),
      logoBadge: !!$('#makna-logo .eyebrow .badge--contoh'),
      logoSrc: ($('.logo-sheet__art img') || {}).getAttribute?.('src'),
      notes: $$('.logo-note').length,
      anchored: $$('.logo-note[data-anchor]').length,
      leaders: $$('.logo-sheet__leaders path').length,
      leaderNodes: $$('.logo-sheet__leaders rect').length,
    };
  });
  check('exactly one h1', r.h1 === 1, r.h1);
  check('Tentang pull-quote rendered', r.quote);
  check('fakta card rows from data (4)', r.fakta === 4, r.fakta);
  check('legal/founding note shown while legalitas is empty', r.faktaNote);
  check('visi statement rendered', /rujukan profesi perancah/i.test(r.visi), r.visi);
  check('misi list has 5 items', r.misi === 5, r.misi);
  check('4 nilai cards with icons', r.nilai === 4 && r.nilaiIcons === 4, `${r.nilai}/${r.nilaiIcons}`);
  check('sejarah timeline 4 items, 2 contoh badges', r.sejarah === 4 && r.sejarahContoh === 2, `${r.sejarah}/${r.sejarahContoh}`);
  check('8 pengurus: one section-level contoh badge (none per tile) + placeholder note', r.pengurus === 8 && r.pengurusContoh === 0 && r.pengurusSectionBadge === 1 && r.pengurusNote, `${r.pengurus}/${r.pengurusContoh}/${r.pengurusSectionBadge}/${r.pengurusNote}`);
  check('placeholder pengurus: numeral ring + "Nama menyusul", no sample name shown', r.pengurusPending === 8 && r.pengurusNums === '01,02,03,04,05,06,07,08' && !r.pengurusSampleName, `${r.pengurusPending} ${r.pengurusNums} ${r.pengurusSampleName}`);
  check('legalitas section omitted when empty', r.legalHidden === true);
  check('bagianContoh badges on Visi/Misi/Makna Logo', r.visiBadge && r.misiBadge && r.logoBadge);
  check('index lists the 6 visible chapters', r.index.length === 6 && /Makna Logo/.test(r.index[5]), JSON.stringify(r.index));
  check('chapter numbers 01–06 in order', JSON.stringify(r.nums) === JSON.stringify(['01 —', '02 —', '03 —', '04 —', '05 —', '06 —']), JSON.stringify(r.nums));
  check('original colour logo used in Makna Logo', r.logoSrc === 'assets/img/logo-color.png', r.logoSrc);
  check('4 meanings, all anchored to the logo', r.notes === 4 && r.anchored === 4, `${r.notes}/${r.anchored}`);
  check('4 leader lines (+8 nodes) drawn on desktop', r.leaders === 4 && r.leaderNodes === 8, `${r.leaders}/${r.leaderNodes}`);

  // leader endpoints must lie on the logo artwork and on the note shelves
  const geo = await p.evaluate(() => {
    const sheet = document.querySelector('.logo-sheet').getBoundingClientRect();
    const art = document.querySelector('.logo-sheet__art').getBoundingClientRect();
    return Array.from(document.querySelectorAll('.logo-sheet__leaders path')).map(path => {
      const nums = path.getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number);
      const ax = nums[nums.length - 2] + sheet.left, ay = nums[nums.length - 1] + sheet.top;
      return { inArt: ax >= art.left - 1 && ax <= art.right + 1 && ay >= art.top - 1 && ay <= art.bottom + art.height * 0.06 };
    });
  });
  check('every leader ends on the logo artwork', geo.length === 4 && geo.every(g => g.inArt), JSON.stringify(geo));

  // index link navigates to the section
  await p.click('.profil-index__link[href="#makna-logo"]');
  await p.waitForTimeout(MOTION ? 1200 : 400);
  const nav = await p.evaluate(() => ({ hash: location.hash, top: Math.round(document.getElementById('makna-logo').getBoundingClientRect().top) }));
  check('index link scrolls to Makna Logo', nav.hash === '#makna-logo' && nav.top >= 0 && nav.top < 200, JSON.stringify(nav));
  check('colour logo image loads', await logoLoaded(p));
  await p.waitForTimeout(MOTION ? 2600 : 200);
  await p.locator('.logo-sheet').screenshot({ path: path.join(SHOTS, 'flow-profil-logo-desktop.png') });

  // keyboard: index links are focusable with a visible outline
  await p.evaluate(() => scrollTo(0, 0));
  const focus = await p.evaluate(() => { const a = document.querySelector('.profil-index__link'); a.focus(); const cs = getComputedStyle(a); return { focused: document.activeElement === a, outline: cs.outlineStyle }; });
  check('index link focusable', focus.focused, JSON.stringify(focus));

  // resize → leaders recomputed (1100px) and removed below 1024px
  await p.setViewportSize({ width: 1100, height: 900 });
  await p.waitForTimeout(400);
  const at1100 = await p.evaluate(() => document.querySelectorAll('.logo-sheet__leaders path').length);
  check('leaders recomputed at 1100px', at1100 === 4, at1100);
  await p.setViewportSize({ width: 900, height: 900 });
  await p.waitForTimeout(400);
  const at900 = await p.evaluate(() => ({ paths: document.querySelectorAll('.logo-sheet__leaders path').length, pin: getComputedStyle(document.querySelector('.logo-pin')).opacity }));
  check('leaders removed + numbered pins shown below 1024px', at900.paths === 0 && at900.pin === '1', JSON.stringify(at900));
  check('no horizontal overflow at 900px', (await overflow(p)) <= 1);
  check('no console errors/warnings/failed requests', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\nprofil.html — mobile');
{
  const { ctx, p, errors } = await open('profil.html', { vp: MOBILE });
  check('no horizontal overflow at 390px', (await overflow(p)) <= 1, await overflow(p));
  const r = await p.evaluate(() => ({
    pins: Array.from(document.querySelectorAll('.logo-pin')).filter(x => getComputedStyle(x).opacity === '1').length,
    leaders: document.querySelectorAll('.logo-sheet__leaders path').length,
    figFirst: document.querySelector('.logo-sheet').firstElementChild.classList.contains('logo-sheet__row--top')
      && getComputedStyle(document.querySelector('.logo-sheet__figure')).order === '-1',
    indexScrolls: (() => { const l = document.querySelector('.profil-index__list'); return l.scrollWidth > l.clientWidth && getComputedStyle(l).overflowX === 'auto'; })(),
  }));
  check('mobile: 4 numbered pins, no leader lines', r.pins === 4 && r.leaders === 0, JSON.stringify(r));
  check('mobile: logo shown before the meanings', r.figFirst);
  check('mobile: chapter index scrolls inside its strip', r.indexScrolls);
  const smallP = await p.evaluate(() => Array.from(document.querySelectorAll('main a, main button')).filter(el => {
    const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 43.5 && !el.closest('.breadcrumb');
  }).map(el => el.textContent.trim().slice(0, 30) + ':' + Math.round(el.getBoundingClientRect().height)));
  check('mobile: touch targets ≥44px (main links/buttons)', smallP.length === 0, JSON.stringify(smallP));
  check('mobile: colour logo image loads', await logoLoaded(p));
  const pinClear = await p.evaluate(() => {
    const pin = document.querySelector('.logo-pin--below'), cap = document.querySelector('.logo-sheet__caption');
    if (!pin) return true;
    const a = pin.getBoundingClientRect(), b = cap.getBoundingClientRect();
    return a.bottom <= b.top;
  });
  check('mobile: wordmark pin clears the caption', pinClear);
  await p.locator('.logo-sheet').screenshot({ path: path.join(SHOTS, 'flow-profil-logo-mobile.png') });
  check('no console errors/warnings', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\nprofil.html — data variations (empty sejarah, legalitas present, escaping)');
{
  const patch = `PPAPI_DATA.organisasi.sejarah = [];
PPAPI_DATA.organisasi.legalitas = [{ label: 'Uji <b>label</b>', nilai: 'Nilai <img src=x onerror="window.__xss=1">' }];
PPAPI_DATA.organisasi.pengurus = [{ nama: 'Nama Resmi', jabatan: 'Ketua Umum', foto: '', contoh: false }];`;
  const { ctx, p, errors } = await open('profil.html', { orgPatch: patch });
  const r = await p.evaluate(() => ({
    sejarahHidden: document.getElementById('sejarah').hidden,
    legalShown: !document.getElementById('legalitas').hidden,
    legalText: document.querySelector('[data-legalitas]').textContent,
    legalHasTags: !!document.querySelector('[data-legalitas] b, [data-legalitas] img'),
    xss: !!window.__xss,
    faktaNoteHidden: document.querySelector('[data-fakta-note]').hidden,
    pengurusNoteHidden: document.querySelector('[data-pengurus-note]').hidden,
    pengurusSectionBadge: document.querySelectorAll('#struktur .eyebrow .badge--contoh').length,
    pengurusName: (document.querySelector('.profil-person .person__name') || {}).textContent,
    initials: document.querySelector('.profil-person .person__avatar').textContent,
    index: Array.from(document.querySelectorAll('.profil-index__link')).map(a => a.textContent.trim()),
  }));
  check('sejarah omitted when empty', r.sejarahHidden);
  check('legalitas shown when data present', r.legalShown && /Uji <b>label<\/b>/.test(r.legalText), r.legalText);
  check('data strings are escaped (no injected tags / script)', !r.legalHasTags && !r.xss);
  check('fakta note hidden once legalitas exists', r.faktaNoteHidden);
  check('pengurus note + section badge hidden when no contoh items', r.pengurusNoteHidden && r.pengurusSectionBadge === 0, `${r.pengurusNoteHidden}/${r.pengurusSectionBadge}`);
  check('official pengurus shows the name as title', r.pengurusName === 'Nama Resmi', r.pengurusName);
  check('initials avatar from name', r.initials === 'NR', r.initials);
  check('index renumbers (Sejarah out, Legalitas in)', !r.index.some(t => /Sejarah/.test(t)) && r.index.some(t => /06\s*Legalitas/.test(t)), JSON.stringify(r.index));
  check('no console errors/warnings', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* ============================ KEANGGOTAAN ============================ */
console.log('\nkeanggotaan.html — desktop');
{
  const { ctx, p, errors } = await open('keanggotaan.html');
  const r = await p.evaluate(() => {
    const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
    return {
      h1: $$('h1').length,
      manfaat: $$('.kea-feature').length,
      cats: $$('.kea-cat').map(c => c.querySelector('.kea-cat__title').textContent),
      mine: $$('.kea-cat--mine').length + $$('.kea-cat [data-cat-mine]:not([hidden])').length,
      catNotes: $$('.kea-cat__note').map(n => n.textContent.trim()),
      catContoh: $$('.kea-cat .badge--contoh').length,
      sectionContoh: !!$('#kategori .eyebrow .badge--contoh'),
      syarat: $$('.kea-cat__list--syarat li').length,
      steps: $$('.kea-step').map(s => s.querySelector('.kea-step__title').textContent.replace(/^Langkah \d+: /, '')),
      final: $$('.kea-step--final').length,
      stepTops: $$('.kea-step').map(s => Math.round(s.getBoundingClientRect().top)),
      biaya: ($('.kea-biaya__text') || {}).textContent,
      biayaLink: ($('.kea-biaya a') || {}).getAttribute?.('href'),
      faq: $$('.kea-faq__list .accordion__item').length,
      faqOpen: $$('.kea-faq__list .accordion__trigger[aria-expanded="true"]').length,
      faqNums: $$('.kea-faq__list .accordion__trigger .kea-faq__num[aria-hidden="true"]').map(n => n.textContent).join(','),
      ctas: $$('[data-cta-daftar]').map(a => [a.getAttribute('href'), a.querySelector('span').textContent]),
      verif: $$('a[href="verifikasi.html"]').length,
      nums: $$('main [data-num]').filter(n => n.textContent).map(n => n.textContent.trim()),
      tracked: !!$('.kea-alur--tracked') || $$('.kea-step.is-done, .kea-step.is-current').length,
      aside: ($('[data-alur-aside] a') || {}).getAttribute?.('href'),
      feats: $$('.kea-feat').map(f => f.querySelector('.kea-feat__title').textContent),
      featLocked: $$('.kea-feat .kea-feat__state:not(.is-open)').length,
      featLinks: $$('.kea-feat a').length,
      me: ($('[data-akses-me]') || {}).textContent || '',
      appNote: ($('[data-akses-note]:not([hidden])') || {}).textContent || '',
    };
  });
  check('exactly one h1', r.h1 === 1);
  check('6 manfaat features', r.manfaat === 6, r.manfaat);
  check('4 kategori cards', r.cats.length === 4, JSON.stringify(r.cats));
  check('signed out: no "Kategori Anda / Pilihan Anda" highlight', r.mine === 0, r.mine);
  check('kategori footers: 3 chosen on the form, Kehormatan set by the board', r.catNotes.filter(t => /Dipilih pada formulir/.test(t)).length === 3 && /Ditetapkan pengurus/.test(r.catNotes[3] || ''), JSON.stringify(r.catNotes));
  check('contoh badges on kategori (section + 4 cards)', r.sectionContoh && r.catContoh === 4, r.catContoh);
  check('syarat lists rendered', r.syarat >= 10, r.syarat);
  check('5 alur steps from data.langkah (v2 flow), last is final', r.steps.length === 5 && r.final === 1 && r.steps[0] === 'Buat akun' && r.steps[1] === 'Isi formulir pendaftaran' && r.steps[2] === 'Verifikasi sekretariat' && r.steps[4] === 'Akses fitur anggota', JSON.stringify(r.steps));
  check('alur is horizontal on desktop (same top)', new Set(r.stepTops).size === 1, JSON.stringify(r.stepTops));
  check('signed out: no progress marks; "Sudah punya akun? Masuk" → masuk.html?next=pendaftaran.html', !r.tracked && r.aside === 'masuk.html?next=pendaftaran.html', `${r.tracked} ${r.aside}`);
  check('biaya fallback note + link to umpan-balik', /sekretariat/i.test(r.biaya || '') && r.biayaLink === 'umpan-balik.html', `${r.biaya} ${r.biayaLink}`);
  check('8 membership FAQ items, first open', r.faq === 8 && r.faqOpen === 1, `${r.faq}/${r.faqOpen}`);
  check('FAQ questions carry index numerals 01–08 (decorative)', r.faqNums === '01,02,03,04,05,06,07,08', r.faqNums);
  check('"Mulai Pendaftaran" CTAs (3) → masuk.html?next=pendaftaran.html#daftar', r.ctas.length === 3 && r.ctas.every(([h, t]) => h === 'masuk.html?next=pendaftaran.html#daftar' && t === 'Mulai Pendaftaran'), JSON.stringify(r.ctas));
  check('Verifikasi anggota link present', r.verif >= 1);
  check('chapter numbers 01–06 (Akses Anggota added)', JSON.stringify(r.nums) === JSON.stringify(['01 —', '02 —', '03 —', '04 —', '05 —', '06 —']), JSON.stringify(r.nums));
  check('Akses Anggota: KTA, profil, Produk Pengetahuan + 2 apps from config, all locked, no links', r.feats.length === 5 && /PPAPI Scaffold/.test(r.feats[3]) && /Simulator/.test(r.feats[4]) && r.featLocked === 5 && r.featLinks === 0, JSON.stringify(r.feats) + ' ' + r.featLocked + '/' + r.featLinks);
  check('Akses Anggota: own line invites to register + appNote shown', /membuat akun/.test(r.me) && /indikatif/.test(r.appNote), r.me);

  // accordion: single mode, click + keyboard
  const triggers = p.locator('.kea-faq__list .accordion__trigger');
  await triggers.nth(2).click();
  let acc = await p.evaluate(() => Array.from(document.querySelectorAll('.kea-faq__list .accordion__trigger')).map(t => t.getAttribute('aria-expanded')));
  check('clicking FAQ 3 opens it and closes FAQ 1', acc[2] === 'true' && acc[0] === 'false' && acc.filter(x => x === 'true').length === 1, JSON.stringify(acc));
  const panelText = await p.evaluate(() => { const t = document.querySelectorAll('.kea-faq__list .accordion__trigger')[2]; const panel = document.getElementById(t.getAttribute('aria-controls')); return !panel.hidden && panel.textContent; });
  check('opened panel linked via aria-controls and visible', /sekretariat/i.test(panelText || ''), panelText);
  await triggers.nth(4).focus();
  await p.keyboard.press('Enter');
  acc = await p.evaluate(() => Array.from(document.querySelectorAll('.kea-faq__list .accordion__trigger')).map(t => t.getAttribute('aria-expanded')));
  check('Enter on a focused trigger toggles it', acc[4] === 'true' && acc[2] === 'false', JSON.stringify(acc));
  await p.keyboard.press('Space');
  acc = await p.evaluate(() => Array.from(document.querySelectorAll('.kea-faq__list .accordion__trigger')).map(t => t.getAttribute('aria-expanded')));
  check('Space closes it again', acc[4] === 'false', JSON.stringify(acc));
  await triggers.nth(1).click();
  await p.locator('#faq').screenshot({ path: path.join(SHOTS, 'flow-keanggotaan-faq.png') });

  // hero secondary CTA → #alur
  await p.evaluate(() => scrollTo(0, 0));
  await p.click('.kea-hero a[href="#alur"]');
  await p.waitForTimeout(MOTION ? 1200 : 400);
  const alurTop = await p.evaluate(() => Math.round(document.getElementById('alur').getBoundingClientRect().top));
  check('“Lihat alur pendaftaran” scrolls to the timeline', alurTop >= 0 && alurTop < 160, alurTop);
  await p.locator('#alur').screenshot({ path: path.join(SHOTS, 'flow-keanggotaan-alur-desktop.png') });
  check('no console errors/warnings/failed requests', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\nkeanggotaan.html — mobile');
{
  const { ctx, p, errors } = await open('keanggotaan.html', { vp: MOBILE });
  check('no horizontal overflow at 390px', (await overflow(p)) <= 1, await overflow(p));
  const r = await p.evaluate(() => {
    const steps = Array.from(document.querySelectorAll('.kea-step'));
    const tops = steps.map(s => s.getBoundingClientRect().top);
    const lefts = steps.map(s => Math.round(s.getBoundingClientRect().left));
    return { vertical: tops.every((t, i) => i === 0 || t > tops[i - 1]), sameLeft: new Set(lefts).size === 1,
      cols: getComputedStyle(document.querySelector('.kea-kategori')).gridTemplateColumns.split(' ').length };
  });
  check('alur is vertical on mobile', r.vertical && r.sameLeft, JSON.stringify(r));
  check('kategori cards stack in one column', r.cols === 1, r.cols);
  const small = await p.evaluate(() => Array.from(document.querySelectorAll('main a, main button')).filter(el => {
    const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 43.5 && !el.closest('.breadcrumb');
  }).map(el => el.textContent.trim().slice(0, 30) + ':' + Math.round(el.getBoundingClientRect().height)));
  check('touch targets ≥44px (main links/buttons)', small.length === 0, JSON.stringify(small));
  await p.locator('#alur').screenshot({ path: path.join(SHOTS, 'flow-keanggotaan-alur-mobile.png') });
  check('no console errors/warnings', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\nkeanggotaan.html — signed in + biaya present');
{
  const { ctx, p, errors } = await open('keanggotaan.html', { session: true, orgPatch: `PPAPI_DATA.organisasi.keanggotaan.biaya = 'Iuran tahunan *uji* <script>window.__x=1</script>';` });
  const r = await p.evaluate(() => ({
    ctas: Array.from(document.querySelectorAll('[data-cta-daftar]')).map(a => [a.getAttribute('href'), a.querySelector('span').textContent]),
    biayaHtml: document.querySelector('.kea-biaya__text').innerHTML,
    x: !!window.__x,
  }));
  check('signed in without a member record (Draf): CTAs → pendaftaran.html “Mulai Pendaftaran”', r.ctas.length === 3 && r.ctas.every(([h, t]) => h === 'pendaftaran.html' && t === 'Mulai Pendaftaran'), JSON.stringify(r.ctas));
  check('biaya from data rendered with *emphasis* and escaped', /<em>uji<\/em>/.test(r.biayaHtml) && /&lt;script&gt;/.test(r.biayaHtml) && !r.x, r.biayaHtml);
  // sign out → CTAs revert
  await p.evaluate(() => PPAPI.auth.signOut());
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => Array.from(document.querySelectorAll('[data-cta-daftar]')).map(a => a.getAttribute('href')));
  check('after sign-out the CTAs revert to masuk.html?next=pendaftaran.html#daftar', after.length === 3 && after.every(h => h === 'masuk.html?next=pendaftaran.html#daftar'), JSON.stringify(after));
  check('after sign-out: progress marks + "Status Anda" removed', await p.evaluate(() => !document.querySelector('.kea-alur--tracked, .kea-step.is-current, .kea-mystatus')));
  check('no console errors/warnings', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

/* v2: the page follows the membership status (PPAPI.session) */
const KEA_STATES = [
  { label: 'Draf (draft saved)', member: 'Draf', cta: ['pendaftaran.html', 'Mulai Pendaftaran'], current: 'formulir', done: ['akun'], locked: 5, mineBadge: '' },
  { label: 'Menunggu Verifikasi', member: 'Menunggu Verifikasi', cta: ['dashboard.html', 'Lihat Status Pendaftaran'], current: 'verifikasi', done: ['akun', 'formulir'], locked: 5, mineBadge: 'Pilihan Anda', tone: 'warn' },
  { label: 'Perlu Perbaikan', member: 'Perlu Perbaikan', cta: ['pendaftaran.html', 'Perbaiki Pengajuan'], current: 'formulir', done: ['akun'], locked: 5, mineBadge: 'Pilihan Anda', tone: 'warn' },
  { label: 'Ditolak', member: 'Ditolak', cta: ['pendaftaran.html', 'Ajukan Ulang'], current: 'formulir', done: ['akun'], locked: 5, mineBadge: 'Pilihan Anda', tone: 'err' },
  { label: 'Kedaluwarsa', member: 'Kedaluwarsa', cta: ['pendaftaran.html', 'Ajukan Perpanjangan'], current: 'formulir', done: ['akun'], locked: 5, mineBadge: 'Kategori Anda', tone: 'err' },
  { label: 'Nonaktif', member: 'Nonaktif', cta: ['pendaftaran.html', 'Ajukan Perpanjangan'], current: 'formulir', done: ['akun'], locked: 5, mineBadge: 'Kategori Anda', tone: 'err' },
  { label: 'Aktif', member: 'Aktif', cta: ['dashboard.html', 'Buka Dasbor Anggota'], current: '', done: ['akun', 'formulir', 'verifikasi', 'aktif', 'akses'], locked: 0, mineBadge: 'Kategori Anda' },
  { label: 'admin (own record Draf)', admin: true, cta: ['admin.html', 'Buka Konsol Admin'], current: 'formulir', done: ['akun'], locked: 0, mineBadge: '' },
];
for (const st of KEA_STATES) {
  console.log(`\nkeanggotaan.html — ${st.label}`);
  const { ctx, p, errors } = await open('keanggotaan.html', st.admin ? { admin: true } : { member: st.member });
  const r = await p.evaluate(() => {
    const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
    return {
      ctas: $$('[data-cta-daftar]').map(a => [a.getAttribute('href'), a.querySelector('span').textContent]),
      done: $$('.kea-step.is-done').map(s => s.getAttribute('data-step-key')),
      current: $$('.kea-step.is-current').map(s => s.getAttribute('data-step-key')),
      currentAria: $$('.kea-step[aria-current="step"]').length,
      tone: ($('.kea-step.is-current') || { className: '' }).className,
      stateText: ($('.kea-step.is-current [data-step-state]') || {}).textContent || '',
      status: ($('.kea-mystatus .badge[data-status]') || {}).getAttribute?.('data-status') || '',
      adminBadge: !!$('.kea-mystatus .badge--metal'),
      locked: $$('.kea-feat .kea-feat__state:not(.is-open)').length,
      open: $$('.kea-feat .kea-feat__state.is-open').length,
      links: $$('.kea-feat a.kea-feat__link').map(a => a.getAttribute('href')),
      mine: $$('.kea-cat [data-cat-mine]:not([hidden])').map(b => b.closest('.kea-cat').getAttribute('data-kategori-nama') + ':' + b.textContent),
      me: ($('[data-akses-me]') || {}).textContent || '',
      note: ($('[data-alur-note]:not([hidden])') || {}).textContent || '',
    };
  });
  const expStatus = st.admin ? 'Draf' : st.member;
  check(`${st.label}: CTAs → ${st.cta[0]} “${st.cta[1]}”`, r.ctas.length === 3 && r.ctas.every(([h, t]) => h === st.cta[0] && t === st.cta[1]), JSON.stringify(r.ctas));
  check(`${st.label}: "Status keanggotaan Anda" shows ${expStatus}${st.admin ? ' + Admin badge' : ''}`, r.status === expStatus && r.adminBadge === !!st.admin, `${r.status} ${r.adminBadge}`);
  check(`${st.label}: timeline done=${st.done.join('+')} current=${st.current || '—'}`, JSON.stringify(r.done) === JSON.stringify(st.done) && JSON.stringify(r.current) === JSON.stringify(st.current ? [st.current] : []) && r.currentAria === (st.current ? 1 : 0), JSON.stringify(r));
  if (st.tone) check(`${st.label}: current step tone ${st.tone} + state line`, r.tone.includes('is-' + st.tone) && r.stateText.length > 3, r.tone + ' / ' + r.stateText);
  check(`${st.label}: member features ${st.locked ? 'locked (5)' : 'open (5) with links'}`, st.locked ? (r.locked === 5 && r.links.length === 0) : (r.open === 5 && r.links.length === 5 && r.links.includes('pustaka.html') && r.links.includes('aplikasi/perencanaan/index.html') && r.links.includes('aplikasi/simulator/index.html')), JSON.stringify(r.links) + ' ' + r.locked + '/' + r.open);
  check(`${st.label}: kategori marker ${st.mineBadge || 'none'}`, st.mineBadge ? (r.mine.length === 1 && r.mine[0] === 'Praktisi:' + st.mineBadge) : r.mine.length === 0, JSON.stringify(r.mine));
  if (!st.locked && !st.admin) check(`${st.label}: own line states validity`, /Aktif/.test(r.me) && /31 Desember 2029/.test(r.me), r.me);
  if (st.admin) check(`${st.label}: own line explains admin access`, /admin PPAPI/.test(r.me), r.me);
  if (st.locked) check(`${st.label}: hint next to the CTA`, r.note.length > 10, r.note);
  check(`${st.label}: no console errors/warnings`, errors.length === 0, errors.join(' | '));
  if (st.member === 'Menunggu Verifikasi' || st.member === 'Aktif') {
    await p.locator('#alur').screenshot({ path: path.join(SHOTS, `flow-keanggotaan-alur-${st.member === 'Aktif' ? 'aktif' : 'menunggu'}.png`) });
    await p.locator('#akses').screenshot({ path: path.join(SHOTS, `flow-keanggotaan-akses-${st.member === 'Aktif' ? 'aktif' : 'menunggu'}.png`) });
  }
  await ctx.close();
}

/* profil.html "Bergabung" band follows the session: masuk.html is guest-only, so signed-in viewers never get
   "Daftar sekarang"; non-active statuses get the shared PPAPI.ui.lockedAction step (same label + destination
   as index / pustaka / the locked panels), active -> Dasbor, admin -> Konsol Admin. */
const PROFIL_CTA = [
  { label: 'signed out', opts: {}, first: ['keanggotaan.html', 'Lihat keanggotaan'], second: ['masuk.html?next=pendaftaran.html#daftar', 'Daftar sekarang'], status: '' },
  { label: 'Draf', opts: { member: 'Draf' }, first: ['pendaftaran.html', 'Lengkapi Pendaftaran'], second: ['keanggotaan.html', 'Lihat keanggotaan'], status: 'Draf' },
  { label: 'Menunggu Verifikasi', opts: { member: 'Menunggu Verifikasi' }, first: ['dashboard.html', 'Lihat Status Pendaftaran'], second: ['keanggotaan.html', 'Lihat keanggotaan'], status: 'Menunggu Verifikasi' },
  { label: 'Perlu Perbaikan', opts: { member: 'Perlu Perbaikan' }, first: ['pendaftaran.html', 'Perbaiki Pengajuan'], second: ['keanggotaan.html', 'Lihat keanggotaan'], status: 'Perlu Perbaikan' },
  { label: 'Ditolak', opts: { member: 'Ditolak' }, first: ['pendaftaran.html', 'Ajukan Ulang'], second: ['keanggotaan.html', 'Lihat keanggotaan'], status: 'Ditolak' },
  { label: 'Kedaluwarsa', opts: { member: 'Kedaluwarsa' }, first: ['pendaftaran.html', 'Ajukan Perpanjangan'], second: ['keanggotaan.html', 'Lihat keanggotaan'], status: 'Kedaluwarsa' },
  { label: 'Nonaktif', opts: { member: 'Nonaktif' }, first: ['pendaftaran.html', 'Ajukan Perpanjangan'], second: ['keanggotaan.html', 'Lihat keanggotaan'], status: 'Nonaktif' },
  { label: 'Aktif', opts: { member: 'Aktif' }, first: ['dashboard.html', 'Buka Dasbor Anggota'], second: ['keanggotaan.html', 'Lihat keanggotaan'], status: 'Aktif' },
  { label: 'admin', opts: { admin: true }, first: ['admin.html', 'Buka Konsol Admin'], second: ['keanggotaan.html', 'Lihat keanggotaan'], status: 'Draf' },
];
for (const st of PROFIL_CTA) {
  console.log(`\nprofil.html CTA - ${st.label}`);
  const { ctx, p, errors } = await open('profil.html', st.opts);
  const r = await p.evaluate(() => ({
    links: Array.from(document.querySelectorAll('.profil-cta [data-cta-actions] a')).map(a => [a.getAttribute('href'), a.querySelector('span').textContent.trim(), a.classList.contains('btn--primary')]),
    status: (document.querySelector('[data-cta-status]:not([hidden]) .badge[data-status]') || {}).getAttribute?.('data-status') || '',
    statusShown: !document.querySelector('[data-cta-status]').hidden,
    guestLink: !!document.querySelector('.profil-cta a[href^="masuk.html"]'),
  }));
  const ok = r.links.length === 2 && r.links[0][0] === st.first[0] && r.links[0][1] === st.first[1] && r.links[0][2] && r.links[1][0] === st.second[0] && r.links[1][1] === st.second[1] && !r.links[1][2];
  check(`${st.label}: CTA -> ${st.first[1]} (${st.first[0]}) + ${st.second[1]}`, ok, JSON.stringify(r.links));
  check(`${st.label}: ${st.status ? 'status line shows ' + st.status : 'no status line'}`, st.status ? (r.statusShown && r.status === st.status) : !r.statusShown, `${r.statusShown} ${r.status}`);
  if (st.status) check(`${st.label}: no link to the guest-only masuk.html`, !r.guestLink);
  if (st.label === 'Aktif') {
    await p.evaluate(() => PPAPI.auth.signOut());
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => Array.from(document.querySelectorAll('.profil-cta [data-cta-actions] a')).map(a => a.getAttribute('href')).join(' ') + ' | ' + document.querySelector('[data-cta-status]').hidden);
    check('Aktif -> sign out: band reverts to Lihat keanggotaan + Daftar sekarang, status line hidden', after === 'keanggotaan.html masuk.html?next=pendaftaran.html#daftar | true', after);
  }
  check(`${st.label}: no console errors/warnings`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

console.log('\nnarrow desktop window (390px, no mobile emulation) + sticky columns');
for (const pg of ['profil.html', 'keanggotaan.html']) {
  const { ctx, p, errors } = await open(pg, { vp: { viewport: { width: 390, height: 844 } } });
  // measured right after load: elements waiting for their reveal are still translated
  check(pg + ': no sideways scroll before reveals', (await overflow(p)) <= 1, await overflow(p));
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } });
  check(pg + ': no sideways scroll after scrolling through', (await overflow(p)) <= 1, await overflow(p));
  check(pg + ': no console errors/warnings', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, p } = await open('profil.html');
  const misi = await p.evaluate(async () => {
    const sec = document.getElementById('misi'), head = document.querySelector('.profil-misi__head');
    scrollTo(0, sec.getBoundingClientRect().top + scrollY + 300);
    await new Promise(r => setTimeout(r, 200));
    return { headTop: Math.round(head.getBoundingClientRect().top), secTop: Math.round(sec.getBoundingClientRect().top) };
  });
  check('profil: Misi heading column stays sticky', misi.secTop < 0 && misi.headTop > 60 && misi.headTop < 160, JSON.stringify(misi));
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
