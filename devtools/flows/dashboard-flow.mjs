// Dasbor Anggota (v2) — interaction / data flow test.
// Run from devtools/:   node flows/dashboard-flow.mjs [--headed]
// Clock frozen at 2026-10-08 10:00 WIB (Asia/Jakarta) so expiry maths and the greeting are deterministic.
//
// SPEC v2 §4.5: two views chosen from PPAPI.session.
//   A  ACTIVE member (record of check.mjs --auth, validUntil 2029-12-31): hero, KPIs, apps band (internal
//      aplikasi/… links, same tab), agenda, Produk Pengetahuan terbaru (store.content.list('pustaka')), berita,
//      regulasi, pengumuman, reminder, nudge, quick actions, a11y, bfcache refresh, no status centre
//   B  ACTIVE member with validity ≤ 60 days → renewal reminder → pendaftaran.html#perpanjangan
//   C  brand-new demo account (auth.signUpEmail → ensureMember = Draf) → STATUS CENTRE: status card, kelengkapan
//      pengajuan (rows → pendaftaran.html#<langkah>), status-track, locked teasers (ui.locked), no member content
//   D  every other non-active status (Menunggu Verifikasi · Perlu Perbaikan · Ditolak · Nonaktif · Kedaluwarsa):
//      status, tone, statusLabel, admin note, CTA, side block, track states, no member content / app links
//   E  ADMIN (seeded demo admin, own membership Draf): active view + Konsol Admin card (pending counts, links)
//   F  live session change: Draf → (record approved elsewhere) → session.refresh() → active view, no reload
//   G  stored XSS: review.note / name with markup render as text
//   H  signed out → masuk.html?next=dashboard.html
//   I  motion enabled: every reveal ends visible (active + status view)
//   J  profile completeness % identical on dashboard.html and anggota.html (shared 15-item definition)
//   K  content managed by the admin (store.content.save) appears on the dashboard; hidden static items vanish
// Screenshots: devtools/shots/dashboard-flow-<scenario>-<viewport>.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const HEADED = process.argv.includes('--headed');
const NOW = new Date('2026-10-08T10:00:00+07:00');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': MIME['.html'] });
    return res.end('<!doctype html><title>404</title><p>Not found</p>');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
// same record as check.mjs --auth (ACTIVE, validUntil 2029-12-31)
const MEMBER = {
  uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah dengan pengalaman proyek kilang dan gedung bertingkat.' },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }, { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' }],
  certificates: [
    { id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' },
    { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' },
  ],
  updatedAt: '2026-09-30T08:00:00.000Z',
  application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' },
  review: { note: '', history: [] },
};
const clone = o => JSON.parse(JSON.stringify(o));
/* the same status fixtures as check.mjs --auth --status=… */
function withStatus(st) {
  const m = clone(MEMBER);
  if (st === 'Kedaluwarsa') { m.validUntil = '2026-06-30'; return m; }
  m.status = st;
  const unapproved = () => { m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = ''; };
  if (st === 'Draf') { unapproved(); m.application.submittedAt = ''; }
  if (st === 'Menunggu Verifikasi') unapproved();
  if (st === 'Perlu Perbaikan') { m.kta = ''; m.validUntil = ''; m.review = { note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'perbaikan', note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.' }] }; }
  if (st === 'Ditolak') { m.kta = ''; m.validUntil = ''; m.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'ditolak', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.' }] }; }
  if (st === 'Nonaktif') { m.review = { note: 'Dinonaktifkan sementara atas permintaan anggota.', history: [{ at: '2026-09-02T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'dinonaktifkan', note: 'Dinonaktifkan sementara atas permintaan anggota.' }] }; }
  return m;
}

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name); console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}

const browser = await chromium.launch({ headless: !HEADED });
const VPS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

async function newCtx(vp, { member, motion = false, session = true, admin = false } = {}) {
  const ctx = await browser.newContext({ ...VPS[vp], locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: motion ? 'no-preference' : 'reduce' });
  await ctx.clock.setFixedTime(NOW);
  if (admin) {
    await ctx.addInitScript(({ a }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
      } catch (e) { /* ignore */ }
    }, { a: ADMIN });
  } else if (session) {
    await ctx.addInitScript(({ u, m }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session') && !sessionStorage.getItem('__flow_seeded')) {
          sessionStorage.setItem('__flow_seeded', '1');
          localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
          const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
          users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
          localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
          if (m) localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        }
      } catch (e) { /* ignore */ }
    }, { u: USER, m: member || null });
  }
  return ctx;
}

function watch(page) {
  const issues = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => issues.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) issues.push('HTTP ' + r.status() + ' ' + r.url()); });
  return issues;
}
async function openDash(ctx, view = 'active') {
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(BASE + '/dashboard.html', { waitUntil: 'networkidle' });
  await page.waitForSelector(`body[data-dash-view="${view}"]`, { timeout: 8000 }).catch(() => {});
  if (view === 'active') await page.waitForSelector('#dash-kpis:not([aria-busy])', { timeout: 8000 }).catch(() => {});
  else if (view === 'status') await page.waitForSelector('#dash-teasers:not(:empty)', { timeout: 8000 }).catch(() => {});
  return { page, issues };
}

const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
const count = (page, sel) => page.$$eval(sel, els => els.length);
const visible = (page, sel) => page.$eval(sel, el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)).catch(() => false);
const kpi = (page, i) => page.$eval(`#dash-kpis > .dash-kpi:nth-child(${i})`, el => ({
  label: el.querySelector('.stat__label')?.textContent.trim(),
  value: (el.querySelector('.stat__num .sr-only, .dash-kpi__status') || el.querySelector('.stat__num') || {}).textContent?.trim(),
  note: el.querySelector('.dash-kpi__note')?.textContent.trim(),
  noteCls: el.querySelector('.dash-kpi__note')?.className,
  statusCls: el.querySelector('.dash-kpi__status')?.className || '',
}));
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const trackStates = page => page.$$eval('#dash-sc .status-track__step', ls => ls.map(l => (l.className.match(/is-(done|current|warn|error)/) || [, ''])[1]));
const headingOrderOk = page => page.evaluate(() => {
  const hs = [...document.querySelectorAll('main h1, main h2, main h3')].filter(h => h.offsetParent !== null || h.closest('.sr-only') || h.classList.contains('sr-only')).map(h => +h.tagName[1]);
  return hs.every((l, i) => i === 0 || l - hs[i - 1] <= 1);
});

for (const vp of ['desktop', 'mobile']) {
  /* ------------------------------------------------------------ A */
  console.log(`\n[${vp}] A · active member — full dashboard`);
  {
    const ctx = await newCtx(vp, { member: MEMBER });
    const { page, issues } = await openDash(ctx, 'active');
    check('active view shown, status centre hidden', await page.$eval('#dash-active-view', el => !el.hidden) && await page.$eval('#dash-status-view', el => el.hidden));
    check('h1 greeting with first name', (await txt(page, '#dash-title')) === 'Selamat pagi, Rahmat', await txt(page, '#dash-title'));
    check('exactly one h1', (await count(page, 'h1')) === 1);
    check('eyebrow "Dasbor Anggota"', (await txt(page, '#dash-eyebrow')) === 'Dasbor Anggota');
    const meta = await txt(page, '#dash-meta');
    check('meta: weekday date', meta.includes('Kamis, 8 Oktober 2026'), meta);
    check('meta: KTA + memberType', meta.includes('PPAPI-2026-004821') && meta.includes('Praktisi'), meta);
    check('meta: effective status badge (ok, data-status=Aktif)', (await count(page, '#dash-meta .badge--ok[data-status="Aktif"]')) === 1);
    check('meta: no admin badge for a member', (await count(page, '#dash-meta .badge--metal')) === 0);
    check('avatar initials', (await txt(page, '#dash-avatar')) === 'RH');
    const acts = await page.$$eval('#dash-hero-actions a', as => as.map(a => a.textContent.trim() + '|' + a.getAttribute('href')));
    check('hero actions: Profil Anggota + Produk Pengetahuan', acts.join() === 'Profil Anggota|anggota.html,Produk Pengetahuan|pustaka.html', acts);

    const k1 = await kpi(page, 1), k2 = await kpi(page, 2), k3 = await kpi(page, 3), k4 = await kpi(page, 4);
    check('KPI status = Aktif (ok) + validity note', k1.value === 'Aktif' && /--ok/.test(k1.noteCls) && k1.note === 'Berlaku hingga 31 Des 2029', k1);
    check('KPI sertifikat aktif = 2 of 2', k2.value === '2' && k2.note.includes('dari 2'), k2);
    check('KPI segera kedaluwarsa = 1 (warn)', k3.value === '1' && /--warn/.test(k3.noteCls), k3);
    check('KPI kelengkapan = 67 % (matches anggota)', k4.value === '67%' && k4.note.includes('5 dari 15'), k4);
    const bar = await page.$eval('#dash-kpis [role=progressbar]', el => ({ now: el.getAttribute('aria-valuenow'), v: el.style.getPropertyValue('--value') }));
    check('progressbar aria + --value', bar.now === '67' && bar.v.trim() === '67', bar);
    check('no renewal reminder (validity > 60 days)', await page.$eval('#dash-renew', el => el.hidden));

    // apps band — internal assets, same tab
    const apps = await page.$$eval('#dash-apps .dash-launch', cs => cs.map(c => ({
      kicker: c.querySelector('.dash-launch__kicker')?.textContent.trim(), t: c.querySelector('.dash-launch__title a')?.textContent.trim(),
      href: c.querySelector('.dash-launch__title a')?.getAttribute('href'), target: c.querySelector('.dash-launch__title a')?.target, feats: c.querySelectorAll('.dash-launch__feats li').length,
    })));
    check('apps: 2 launch cards → aplikasi/perencanaan + aplikasi/simulator, same tab', apps.length === 2 &&
      apps[0].href === 'aplikasi/perencanaan/index.html' && apps[1].href === 'aplikasi/simulator/index.html' && apps.every(a => a.target === '' && a.feats === 2), apps);
    // client rule 2026-10-10: the planning app title carries "(Beta)" (intentional change)
    check('apps: titles from config (kicker "PPAPI Scaffold (Beta)")', apps[0]?.kicker === 'PPAPI Scaffold (Beta)' && apps[0]?.t === 'Perencanaan & Analisis Struktur' && apps[1]?.t === 'Simulator Pemasangan Perancah Tube & Coupler', apps);
    check('apps: whole card clickable (stretched title link)', await page.$eval('#dash-apps .dash-launch__title a', a => getComputedStyle(a, '::after').position === 'absolute'));
    check('apps: appNote shown', /indikatif/.test(await txt(page, '#dash-apps .dash-apps__note') || ''));
    if (vp === 'desktop') {
      const r = await page.$$eval('#dash-apps .dash-launch', cs => cs.map(c => Math.round(c.getBoundingClientRect().top)));
      check('apps: side by side on desktop', r.length === 2 && r[0] === r[1], r);
    }

    /* 2026-10-15: no activities yet (agenda.js empty) → calm empty state with a link to the agenda page */
    check('agenda: no rows (no activities yet)', (await count(page, '#dash-agenda .event-row')) === 0);
    check('agenda: calm empty state "Belum ada agenda terdekat" + link to agenda.html', /Belum ada agenda terdekat/.test(await txt(page, '#dash-agenda .empty-state') || '') &&
      (await count(page, '#dash-agenda .empty-state a[href="agenda.html"]')) === 1);

    // Produk Pengetahuan terbaru
    const docs = await page.$$eval('#dash-pustaka .doc-card', cs => cs.map(c => ({
      kind: c.querySelector('.doc-card__kind')?.textContent.trim(), code: c.querySelector('.doc-card__code')?.textContent.trim(),
      href: c.querySelector('.doc-card__title a')?.getAttribute('href'), contoh: !!c.querySelector('.badge--contoh'), status: c.querySelector('.badge')?.textContent.trim(),
    })));
    /* 2026-10-15: sample documents removed → the catalogue holds only the two apps (shown in their own band) */
    check('pustaka: no doc cards (no PPAPI documents published yet); apps not listed here', docs.length === 0 && (await count(page, '#dash-pustaka .doc-card')) === 0, docs);
    check('pustaka: calm empty state + "Buka katalog" link', /Katalog belum berisi dokumen/.test(await txt(page, '#dash-pustaka .empty-state') || '') && (await count(page, '#dash-pustaka .empty-state a[href="pustaka.html"]')) === 1);
    check('pustaka: "Katalog lengkap" + empty-state "Buka katalog" → pustaka.html', (await count(page, 'section[aria-labelledby="dash-h-pustaka"] a[href="pustaka.html"]')) === 2);

    check('berita: 3 newest cards (editorial articles, newest first)', (await page.$$eval('#dash-berita .news-card time', ts => ts.map(t => t.getAttribute('datetime')).join())) === '2026-10-14,2026-10-07,2026-09-30');
    check('berita: no Contoh badge on the editorial articles', (await count(page, '#dash-berita .badge--contoh')) === 0);
    check('berita: links berita.html?id=', (await page.$$eval('#dash-berita .news-card__title a', as => as.every(a => /^berita\.html\?id=[a-z0-9-]+$/.test(a.getAttribute('href'))))));
    check('berita: grayscale thumbs with size attrs', (await page.$$eval('#dash-berita img', is => is.length === 3 && is.every(i => i.classList.contains('img-mono') && i.getAttribute('width') && i.getAttribute('loading') === 'lazy'))));

    check('regulasi: 6 kunci items', (await count(page, '#dash-regulasi .dash-reg')) === 6);
    check('regulasi: singkatan first = UU 1/1970', (await txt(page, '#dash-regulasi .dash-reg:first-child .dash-reg__code')) === 'UU 1/1970');
    check('regulasi: external links new tab + noopener', await page.$$eval('#dash-regulasi a[target=_blank]', as => as.length === 5 && as.every(a => a.rel.includes('noopener') && /^https:\/\//.test(a.href))));
    check('regulasi: item without tautan → pustaka link', (await count(page, '#dash-regulasi .dash-reg__link a[href="regulasi.html"]')) === 1);

    check('pengumuman: none yet → calm empty state', (await count(page, '#dash-pengumuman .dash-notice')) === 0 && /Belum ada pengumuman/.test(await txt(page, '#dash-pengumuman .empty-state') || ''));
    check('pengumuman: count label empty', (await txt(page, '#dash-pengumuman-count')) === '');

    check('pengingat: one reminder, 43 hari lagi', (await count(page, '#dash-pengingat .dash-reminder')) === 1 && (await txt(page, '#dash-pengingat .dash-reminder__days')) === '43 hari lagi');
    check('admin card hidden for a member', await page.$eval('#dash-admin', el => el.hidden));

    check('nudge visible', await page.$eval('#dash-nudge', el => !el.hidden));
    const missing = await page.$$eval('#dash-nudge .dash-missing a', as => as.map(a => a.textContent.trim() + '|' + a.getAttribute('href')));
    check('nudge: 5 missing profile items → anggota.html?isi=<key>#profil', missing.join() === 'Tempat lahir|anggota.html?isi=birthPlace#profil,Tanggal lahir|anggota.html?isi=birthDate#profil,Jenis kelamin|anggota.html?isi=gender#profil,Alamat|anggota.html?isi=address#profil,Tautan LinkedIn|anggota.html?isi=linkedin#profil', missing);
    {
      const p2 = await ctx.newPage();
      await p2.goto(BASE + '/anggota.html?isi=address#profil', { waitUntil: 'networkidle' });
      await p2.waitForFunction(() => document.activeElement && document.activeElement.id === 'f-address', null, { timeout: 4000 }).catch(() => {});
      const st = await p2.evaluate(() => ({ active: document.activeElement && document.activeElement.id, tab: document.querySelector('#tab-profil') && document.querySelector('#tab-profil').getAttribute('aria-selected'), url: location.search + location.hash }));
      check('nudge link anggota.html?isi=address#profil → #f-address focused on the Profil tab, URL cleaned', st.active === 'f-address' && st.tab === 'true' && st.url === '#profil', st);
      await p2.close();
    }

    const actions = await page.$$eval('.dash-view--active .dash-actions a', as => as.map(a => a.getAttribute('href')));
    check('aksi cepat: 4 targets', actions.join() === 'anggota.html#sertifikat,anggota.html#kartu,pustaka.html,umpan-balik.html', actions);

    check('no element left aria-busy', (await count(page, '[aria-busy="true"]')) === 0);
    check('every visible h2 has a labelled section', await page.$$eval('#dash-active-view h2', hs => hs.filter(h => !h.closest('[hidden]')).every(h => h.id && document.querySelector(`[aria-labelledby="${h.id}"]`))));
    check('heading order (no level skipped)', await headingOrderOk(page));
    check('links with target=_blank all have rel=noopener', await page.$$eval('a[target=_blank]', as => as.every(a => a.rel.includes('noopener'))));
    check('no horizontal overflow', (await overflow(page)) <= 1, await overflow(page));

    await page.keyboard.press('Tab');
    check('skip link is first focus', (await page.evaluate(() => document.activeElement.className)) === 'skip-link');
    await page.focus('#dash-apps .dash-launch__title a');
    const fo = await page.$eval('#dash-apps .dash-launch', el => getComputedStyle(el).outlineStyle);
    check('focus ring on the app launch card (focus-within)', fo === 'solid', fo);
    await page.focus('.dash-view--active .dash-actions a');
    check('focus-visible outline on quick action', (await page.$eval('.dash-view--active .dash-actions a', a => getComputedStyle(a).outlineStyle)) === 'solid');

    // bfcache return: member changed elsewhere → pageshow(persisted) refreshes the session + personal blocks
    await page.evaluate(() => {
      const k = 'ppapi_member_demo-uji-0001';
      const m = JSON.parse(localStorage.getItem(k));
      m.profile.birthPlace = 'Samarinda'; m.profile.birthDate = '1988-04-12';
      localStorage.setItem(k, JSON.stringify(m));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await page.waitForFunction(() => /80%/.test(document.querySelector('#dash-kpis .dash-kpi:nth-child(4)').textContent), null, { timeout: 4000 }).catch(() => {});
    check('pageshow(persisted) refreshes KPIs (80 %)', ((await kpi(page, 4)).value) === '80%', await kpi(page, 4));
    check('nudge now lists 3 items', (await count(page, '#dash-nudge .dash-missing a')) === 3);

    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, `dashboard-flow-A-${vp}.png`) });
    check('no console errors / warnings / failed requests', issues.length === 0, issues);
    await ctx.close();
  }

  /* ------------------------------------------------------------ B */
  console.log(`\n[${vp}] B · active member, validity ends in 30 days → renewal reminder`);
  {
    const m = clone(MEMBER); m.validUntil = '2026-11-07';
    const ctx = await newCtx(vp, { member: m });
    const { page, issues } = await openDash(ctx, 'active');
    check('renewal reminder visible', await page.$eval('#dash-renew', el => !el.hidden));
    check('reminder: "berakhir dalam 30 hari" + date', /berakhir dalam 30 hari/i.test(await txt(page, '#dash-renew-title')) && /7 November 2026/.test(await txt(page, '#dash-renew')), await txt(page, '#dash-renew'));
    check('reminder: warns that features pause during verification', /ditangguhkan sementara/.test(await txt(page, '#dash-renew')));
    check('reminder: CTA → pendaftaran.html#perpanjangan', (await page.$eval('#dash-renew a.btn--primary', a => a.getAttribute('href') + '|' + a.textContent.trim())) === 'pendaftaran.html#perpanjangan|Ajukan Perpanjangan');
    check('reminder: region labelled by its heading', (await page.$eval('#dash-renew [role=region]', el => el.getAttribute('aria-labelledby'))) === 'dash-renew-title');
    const k1 = await kpi(page, 1);
    check('KPI status warn: "Berakhir dalam 30 hari · 7 Nov 2026"', /--warn/.test(k1.noteCls) && k1.note === 'Berakhir dalam 30 hari · 7 Nov 2026' && /--warn/.test(k1.statusCls), k1);
    check('still active: apps band shown', (await count(page, '#dash-apps .dash-launch')) === 2);
    check('no horizontal overflow', (await overflow(page)) <= 1);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, `dashboard-flow-B-${vp}.png`) });
    check('no console errors', issues.length === 0, issues);
    await ctx.close();
  }

  /* ------------------------------------------------------------ C */
  console.log(`\n[${vp}] C · brand-new demo account (sign-up → Draf) → status centre`);
  {
    const ctx = await browser.newContext({ ...VPS[vp], locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
    await ctx.clock.setFixedTime(NOW);
    const boot = await ctx.newPage();
    const bootIssues = [];
    boot.on('pageerror', e => bootIssues.push(e.message));
    await boot.goto(BASE + '/styleguide.html', { waitUntil: 'networkidle' });
    const signed = await boot.evaluate(async () => {
      await PPAPI.auth.ready();
      const u = await PPAPI.auth.signUpEmail({ name: 'Sari Wulandari', email: 'sari.uji' + Date.now() + '@contoh.id', password: 'Perancah2026' });
      return { uid: u.uid, current: !!PPAPI.auth.current() };
    });
    check('demo sign-up succeeded', !!signed.uid && signed.current, signed);
    await boot.close();

    const { page, issues } = await openDash(ctx, 'status');
    check('status centre shown, member dashboard hidden', await page.$eval('#dash-status-view', el => !el.hidden) && await page.$eval('#dash-active-view', el => el.hidden));
    check('greeting uses new name', (await txt(page, '#dash-title')) === 'Selamat pagi, Sari');
    const meta = await txt(page, '#dash-meta');
    check('meta: no KTA for a Draf member', !/PPAPI-\d{4}-\d{6}/.test(meta), meta);
    check('meta: Draf badge (muted)', (await count(page, '#dash-meta .badge--muted[data-status="Draf"]')) === 1, meta);
    check('status heading "Draf" (muted tone) labels the card', (await txt(page, '#dash-sc-title')) === 'Status keanggotaan: Draf' && (await count(page, '.dash-sc__status--muted')) === 1 &&
      (await count(page, 'section[aria-labelledby="dash-sc-title"]')) === 1);
    check('statusLabel sentence', (await txt(page, '.dash-sc__label')) === 'Formulir pendaftaran belum diajukan');
    check('primary CTA → pendaftaran.html "Lengkapi Formulir Pendaftaran"', (await page.$eval('.dash-sc__actions a.btn--primary', a => a.textContent.trim() + '|' + a.getAttribute('href'))) === 'Lengkapi Formulir Pendaftaran|pendaftaran.html');
    check('secondary link → keanggotaan.html', (await count(page, '.dash-sc__actions a[href="keanggotaan.html"]')) === 1);
    const req = await page.evaluate(() => ({
      val: document.querySelector('.dash-req__val')?.textContent.trim(), of: document.querySelector('.dash-req__of')?.textContent.trim(),
      pb: document.querySelector('.dash-req [role=progressbar]')?.getAttribute('aria-valuenow'),
      rows: [...document.querySelectorAll('.dash-req__row')].map(a => a.querySelector('.dash-req__step').textContent.trim() + '|' + a.getAttribute('href')),
    }));
    check('kelengkapan: 1 dari 13 (name only), 8 %', req.of === 'dari 13 persyaratan wajib terisi' && req.val === '1' && req.pb === '8', req);
    check('kelengkapan: rows grouped per step → pendaftaran.html#<langkah>', req.rows.join() === 'Kategori|pendaftaran.html#kategori,Data Diri|pendaftaran.html#data-diri,Data Profesional|pendaftaran.html#profesional,Pernyataan|pendaftaran.html#pernyataan', req.rows);
    check('track: Akun dibuat done · Formulir diajukan current · 2 todo', (await trackStates(page)).join() === 'done,current,,', await trackStates(page));
    check('track: exactly one aria-current="step"', (await count(page, '#dash-sc [aria-current="step"]')) === 1);
    check('track: state spoken (sr-only "(selesai)")', /\(selesai\)/.test(await txt(page, '#dash-sc .status-track__step:first-child')));
    check('track: account date "8 Okt 2026"', (await txt(page, '#dash-sc .status-track__step:first-child .status-track__meta')) === '8 Okt 2026');
    // locked teasers
    check('teasers: KTA veil + 4 locked cards', (await count(page, '#dash-teasers .locked-veil')) === 1 && (await count(page, '#dash-teasers .dash-teaser .locked')) === 4);
    check('teasers: veil preview is aria-hidden + inert', await page.$eval('#dash-teasers .locked-veil__content', el => el.getAttribute('aria-hidden') === 'true' && el.hasAttribute('inert')));
    const tt = await page.$$eval('#dash-teasers .locked__title', ts => ts.map(t => t.textContent.trim()));
    check('teasers: KTA, Produk Pengetahuan, both apps, dashboard digest', tt.join('|') === 'Kartu Tanda Anggota digital|Standar, CoP & modul pelatihan|Perencanaan & Analisis Struktur|Simulator Tube & Coupler|Agenda, regulasi & pengingat', tt);
    check('teasers: "Terkunci" tags', (await count(page, '.dash-teaser__lock')) === 4);
    /* v2 fix round (dashboard): teaser cards carry no links (uniform grid); the public catalog link sits in the help row */
    check('teasers: no links in the small cards; catalog link → pustaka.html in the help row', (await count(page, '#dash-teasers .dash-teaser a')) === 0 && (await count(page, '#dash-help-links a[href="pustaka.html"]')) === 1);
    check('no member feature exposed: no app links, no agenda/berita digest rendered', (await count(page, 'main a[href^="aplikasi/"]')) === 0 && (await count(page, '#dash-agenda .event-row, #dash-berita .news-card, #dash-pustaka .doc-card')) === 0);
    check('help row: 4 public links', (await page.$$eval('#dash-help-links a', as => as.map(a => a.getAttribute('href')).join())) === 'keanggotaan.html,pustaka.html,agenda.html,umpan-balik.html?kategori=pertanyaan');
    check('hero action: "Syarat & Kategori" → keanggotaan.html', (await page.$$eval('#dash-hero-actions a', as => as.map(a => a.getAttribute('href')).join())) === 'keanggotaan.html');
    check('heading order (no level skipped)', await headingOrderOk(page));
    check('no horizontal overflow', (await overflow(page)) <= 1);
    await page.screenshot({ path: path.join(SHOTS, `dashboard-flow-C-${vp}.png`), fullPage: true });
    check('no console errors / warnings', issues.length === 0 && bootIssues.length === 0, issues.concat(bootIssues));
    await ctx.close();
  }

  /* ------------------------------------------------------------ D */
  const CASES = {
    'Menunggu Verifikasi': { tone: 'warn', cta: 'Lihat Pengajuan|pendaftaran.html', side: 'Ringkasan pengajuan', track: 'done,done,current,', note: null, text: /diterima pada 15 Maret 2026/ },
    'Perlu Perbaikan': { tone: 'warn', cta: 'Perbaiki Pengajuan|pendaftaran.html', side: 'Kelengkapan pengajuan', track: 'done,done,warn,', note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', text: /meminta beberapa perbaikan/ },
    'Ditolak': { tone: 'err', cta: 'Ajukan Ulang|pendaftaran.html', side: 'Kelengkapan pengajuan', track: 'done,done,error,', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', text: /belum dapat disetujui/, ghost: 'umpan-balik.html?kategori=pertanyaan' },
    'Nonaktif': { tone: 'err', cta: 'Ajukan Perpanjangan|pendaftaran.html', side: 'Data keanggotaan', track: 'done,done,done,error', note: 'Dinonaktifkan sementara atas permintaan anggota.', text: /dinonaktifkan sekretariat/, ghost: 'umpan-balik.html?kategori=pertanyaan', kta: true },
    'Kedaluwarsa': { tone: 'err', cta: 'Ajukan Perpanjangan|pendaftaran.html', side: 'Data keanggotaan', track: 'done,done,done,error', note: null, text: /berakhir pada 30 Juni 2026/, kta: true },
  };
  for (const [st, ex] of Object.entries(CASES)) {
    console.log(`\n[${vp}] D · ${st}`);
    const ctx = await newCtx(vp, { member: withStatus(st) });
    const { page, issues } = await openDash(ctx, 'status');
    check(`${st}: status centre shown`, await page.$eval('#dash-status-view', el => !el.hidden) && await page.$eval('#dash-active-view', el => el.hidden));
    check(`${st}: heading + tone`, (await txt(page, '#dash-sc-title')) === 'Status keanggotaan: ' + st && (await count(page, `.dash-sc__status--${ex.tone}`)) === 1, await txt(page, '#dash-sc-title'));
    check(`${st}: hero badge data-status`, (await count(page, `#dash-meta .badge--${ex.tone}[data-status="${st}"]`)) === 1);
    check(`${st}: explanation`, ex.text.test(await txt(page, '.dash-sc__text')), await txt(page, '.dash-sc__text'));
    check(`${st}: CTA ${ex.cta}`, (await page.$eval('.dash-sc__actions a.btn--primary', a => a.textContent.trim() + '|' + a.getAttribute('href'))) === ex.cta);
    if (ex.ghost) check(`${st}: "Hubungi Sekretariat" → ${ex.ghost}`, (await count(page, `.dash-sc__actions a[href="${ex.ghost}"]`)) === 1);
    check(`${st}: side block "${ex.side}"`, (await txt(page, '.dash-sc__side-title')) === ex.side, await txt(page, '.dash-sc__side-title'));
    if (ex.note) check(`${st}: admin note shown with date`, (await txt(page, '.dash-sc__note-text')) === ex.note && /Sekretariat PPAPI · \d+ \w+ 2026/.test(await txt(page, '.dash-sc__note-meta')), await txt(page, '.dash-sc__note'));
    else check(`${st}: no note block`, (await count(page, '.dash-sc__note')) === 0);
    check(`${st}: track ${ex.track}`, (await trackStates(page)).join() === ex.track, await trackStates(page));
    const meta = await txt(page, '#dash-meta');
    check(`${st}: KTA ${ex.kta ? 'shown (approved before)' : 'not shown'}`, ex.kta ? meta.includes('PPAPI-2026-004821') : !/PPAPI-\d{4}-\d{6}/.test(meta), meta);
    if (st === 'Menunggu Verifikasi') {
      const kv = await page.$$eval('.dash-sc__kv .kv__row', rs => rs.map(r => r.querySelector('dt').textContent.trim() + '=' + r.querySelector('dd').textContent.trim()));
      check(`${st}: summary rows`, kv[0] === 'Jenis pengajuan=Pendaftaran anggota baru' && kv[1] === 'Kategori diajukan=Praktisi' && /^Tanggal pengajuan=15 Maret 2026 · /.test(kv[2]), kv);
      check(`${st}: veil without a CTA (status is on this page)`, (await count(page, '#dash-teasers .locked-veil .locked__actions')) === 0);
    }
    if (st === 'Kedaluwarsa') check(`${st}: track meta "30 Jun 2026"`, (await txt(page, '#dash-sc .status-track__step:last-child .status-track__meta')) === '30 Jun 2026');
    check(`${st}: no member features exposed`, (await count(page, 'main a[href^="aplikasi/"]')) === 0 && (await count(page, '#dash-agenda .event-row')) === 0);
    check(`${st}: no horizontal overflow`, (await overflow(page)) <= 1);
    await page.screenshot({ path: path.join(SHOTS, `dashboard-flow-D-${st.replace(/\s+/g, '').toLowerCase().slice(0, 8)}-${vp}.png`) });
    check(`${st}: no console errors`, issues.length === 0, issues);
    await ctx.close();
  }

  /* ------------------------------------------------------------ D2 */
  console.log(`\n[${vp}] D2 · renewal (perpanjangan) waiting for verification`);
  {
    const m = clone(MEMBER);
    Object.assign(m, { status: 'Menunggu Verifikasi', validUntil: '2026-06-30' });
    Object.assign(m.application, { type: 'perpanjangan', submittedAt: '2026-10-02T03:00:00.000Z' });
    const ctx = await newCtx(vp, { member: m });
    const { page, issues } = await openDash(ctx, 'status');
    check('renewal: heading Menunggu Verifikasi', (await txt(page, '#dash-sc-title')) === 'Status keanggotaan: Menunggu Verifikasi');
    check('renewal: explanation mentions perpanjangan', /perpanjangan keanggotaan Anda diterima pada 2 Oktober 2026/.test(await txt(page, '.dash-sc__text')), await txt(page, '.dash-sc__text'));
    const labels = await page.$$eval('#dash-sc .status-track__label', ls => ls.map(l => l.firstChild.textContent.trim()));
    check('renewal: track Anggota sejak → Perpanjangan diajukan → Verifikasi → Aktif kembali', labels.join('|') === 'Anggota sejak|Perpanjangan diajukan|Verifikasi sekretariat|Aktif kembali', labels);
    check('renewal: track title', (await page.$eval('#dash-sc .status-track', el => el.getAttribute('aria-label'))) === 'Tahapan perpanjangan');
    check('renewal: summary says Perpanjangan keanggotaan', /Jenis pengajuan\s*Perpanjangan keanggotaan/.test(await txt(page, '.dash-sc__kv')));
    check('renewal: the approved KTA stays visible in the hero', (await txt(page, '#dash-meta')).includes('PPAPI-2026-004821'));
    check('renewal: member features locked meanwhile', (await count(page, 'main a[href^="aplikasi/"]')) === 0);
    check('no console errors', issues.length === 0, issues);
    await ctx.close();
  }

  /* ------------------------------------------------------------ E */
  console.log(`\n[${vp}] E · admin (own membership Draf) → active view + Konsol Admin card`);
  {
    const ctx = await newCtx(vp, { admin: true });
    const { page, issues } = await openDash(ctx, 'active');
    await page.waitForSelector('#dash-admin-body:not([aria-busy])', { timeout: 6000 }).catch(() => {});
    check('admin sees the member dashboard (isActive)', await page.$eval('#dash-active-view', el => !el.hidden));
    check('eyebrow "Dasbor Admin" + metal badge, no own status badge', (await txt(page, '#dash-eyebrow')) === 'Dasbor Admin' && (await count(page, '#dash-meta .badge--metal')) === 1 && (await count(page, '#dash-meta [data-status]')) === 0);
    /* v2 fix round (dashboard): no personal KPI row for an admin whose own membership is not Aktif — one #dash-self line instead */
    check('no personal KPI row (grid hidden + empty)', await page.$eval('#dash-kpis', el => el.hidden && !el.children.length));
    const self = await page.$eval('#dash-self', el => ({ shown: !el.hidden, label: el.querySelector('.dash-self__label')?.textContent.trim(), status: el.querySelector('[data-status]')?.getAttribute('data-status'), href: el.querySelector('.dash-self__act a')?.getAttribute('href') }));
    check('#dash-self: "Keanggotaan pribadi" + Draf badge + next step → pendaftaran.html', self.shown && self.label === 'Keanggotaan pribadi' && self.status === 'Draf' && self.href === 'pendaftaran.html', self);
    check('hero actions: Profil Anggota + Konsol Admin', (await page.$$eval('#dash-hero-actions a', as => as.map(a => a.getAttribute('href')).join())) === 'anggota.html,admin.html');
    check('admin card visible', await page.$eval('#dash-admin', el => !el.hidden));
    const stats = await page.$$eval('#dash-admin .dash-admin__stat', as => as.map(a => a.querySelector('.dash-admin__label').textContent.trim() + '=' + a.querySelector('.dash-admin__num').textContent.trim() + '>' + a.getAttribute('href')));
    check('admin card: seeded queue (1 menunggu, 1 perbaikan) with section links', stats.join() === 'Menunggu verifikasi=1>admin.html#permohonan,Perlu perbaikan=1>admin.html#permohonan,Berakhir ≤ 60 hari=0>admin.html#anggota,Umpan balik baru=0>admin.html#umpan-balik', stats);
    check('admin card: lead sentence', (await txt(page, '.dash-admin__lead')) === '1 pengajuan keanggotaan menunggu verifikasi Anda.');
    check('admin card: CTA → admin.html', (await count(page, '#dash-admin a.dash-admin__cta[href="admin.html"]')) === 1);
    check('admin card: warn tone on pending count', (await count(page, '.dash-admin__stat--warn')) === 1);
    check('no renewal reminder for an admin without membership', await page.$eval('#dash-renew', el => el.hidden));
    check('no horizontal overflow', (await overflow(page)) <= 1);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, `dashboard-flow-E-${vp}.png`) });
    check('no console errors', issues.length === 0, issues);
    await ctx.close();
  }

  /* ------------------------------------------------------------ H */
  console.log(`\n[${vp}] H · signed out → login redirect`);
  {
    const ctx = await newCtx(vp, { session: false });
    const page = await ctx.newPage();
    await page.goto(BASE + '/dashboard.html', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/masuk\.html/, { timeout: 8000 }).catch(() => {});
    check('redirected to masuk.html?next=dashboard.html', /\/masuk\.html\?next=dashboard\.html$/.test(page.url()), page.url());
    await ctx.close();
  }
}

/* ------------------------------------------------------------ F */
console.log('\n[desktop] F · live session change: Draf → approved → active view without reload');
{
  const ctx = await newCtx('desktop', { member: withStatus('Menunggu Verifikasi') });
  const { page, issues } = await openDash(ctx, 'status');
  check('starts in status centre (Menunggu Verifikasi)', (await txt(page, '#dash-sc-title')) === 'Status keanggotaan: Menunggu Verifikasi');
  await page.evaluate(async () => {
    const k = 'ppapi_member_demo-uji-0001';
    const m = JSON.parse(localStorage.getItem(k));
    Object.assign(m, { status: 'Aktif', kta: 'PPAPI-2026-000777', validUntil: '2029-12-31', approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    localStorage.setItem(k, JSON.stringify(m));
    await PPAPI.session.refresh();
  });
  await page.waitForSelector('body[data-dash-view="active"]', { timeout: 6000 }).catch(() => {});
  await page.waitForSelector('#dash-agenda .empty-state, #dash-agenda .event-row', { timeout: 6000 }).catch(() => {});
  check('switched to the active dashboard', await page.$eval('#dash-active-view', el => !el.hidden) && await page.$eval('#dash-status-view', el => el.hidden));
  check('hero now shows the new KTA', (await txt(page, '#dash-meta')).includes('PPAPI-2026-000777'));
  check('member content rendered after the switch (agenda empty state + 2 app cards)', (await count(page, '#dash-agenda .empty-state')) === 1 && (await count(page, '#dash-apps .dash-launch')) === 2);
  check('no console errors', issues.length === 0, issues);
  await ctx.close();
}

/* ------------------------------------------------------------ G */
console.log('\n[desktop] G · stored markup renders as text');
{
  const m = withStatus('Perlu Perbaikan');
  m.name = 'Rahmat <img src=x onerror="window.__xss=1">';
  m.review.note = '<script>window.__xss=2</script><b>tebal</b> & "kutip"';
  m.application.kategori = '<i>Praktisi</i>';
  const ctx = await newCtx('desktop', { member: m });
  const { page, issues } = await openDash(ctx, 'status');
  check('note shown literally', (await txt(page, '.dash-sc__note-text')) === '<script>window.__xss=2</script><b>tebal</b> & "kutip"');
  check('no injected elements / script ran', (await page.evaluate(() => window.__xss === undefined && !document.querySelector('main img[src="x"], main b, .dash-sc__note script'))));
  check('greeting escaped', (await txt(page, '#dash-title')).startsWith('Selamat pagi, Rahmat'));
  check('no console errors', issues.filter(i => !/x$/.test(i)).length === 0, issues);
  await ctx.close();
}

/* ------------------------------------------------------------ I */
console.log('\n[desktop] I · motion enabled');
for (const [label, member, view] of [['active', MEMBER, 'active'], ['status centre', withStatus('Draf'), 'status']]) {
  const ctx = await newCtx('desktop', { member, motion: true });
  const { page, issues } = await openDash(ctx, view);
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
  await page.waitForTimeout(1800);
  const hidden = await page.$$eval('[data-reveal], [data-reveal-stagger]', els => els.filter(e => !e.closest('[hidden]') && !e.classList.contains('is-visible')).length);
  check(`${label}: all reveals visible after scroll`, hidden === 0, hidden);
  const op = await page.$$eval('[data-reveal-stagger] > *', els => els.filter(e => !e.closest('[hidden]') && getComputedStyle(e).opacity !== '1').length);
  check(`${label}: stagger children fully opaque`, op === 0, op);
  if (view === 'active') {
    const pct = await page.$eval('#dash-kpis .dash-kpi:nth-child(4) .count__value', el => el.textContent).catch(() => null);
    check('active: counter settled at 67%', pct === '67%', pct);
  }
  check(`${label}: no console errors`, issues.length === 0, issues);
  await ctx.close();
}

/* ------------------------------------------------------------ J */
console.log('\n[desktop] J · completeness identical on dasbor and Profil Anggota');
for (const [label, mutate] of [
  ['seeded member', m => m],
  ['name only, no kompetensi/sertifikat', m => { m.profile = {}; m.competencies = []; m.certificates = []; m.email = ''; return m; }],
  ['complete except contact (phone-less Google account)', m => { Object.assign(m.profile, { birthPlace: 'Samarinda', birthDate: '1988-04-12', gender: 'Laki-laki', address: 'Jl. Contoh No. 1', linkedin: 'https://www.linkedin.com/in/contoh' }); m.phone = ''; return m; }],
]) {
  const ctx = await newCtx('desktop', { member: mutate(clone(MEMBER)) });
  const { page, issues } = await openDash(ctx, 'active');
  const dash = (await kpi(page, 4)).value;
  await page.goto(BASE + '/anggota.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('#agt-complete [data-count]', { timeout: 8000 }).catch(() => {});
  const agt = await page.$eval('#agt-complete [data-count]', el => el.getAttribute('data-count') + '%').catch(() => null);
  check(`${label}: dasbor ${dash} = anggota ${agt}`, !!dash && dash === agt, { dash, agt });
  check(`${label}: no console errors`, issues.length === 0, issues);
  await ctx.close();
}

/* ------------------------------------------------------------ K */
console.log('\n[desktop] K · admin-managed content appears on the dashboard');
{
  const ctx = await newCtx('desktop', { admin: true });
  const { page, issues } = await openDash(ctx, 'active');
  await page.evaluate(async () => {
    await PPAPI.store.content.save('pengumuman', { judul: 'Rapat anggota tahunan diumumkan', isi: 'Undangan resmi akan dikirim melalui email.', tanggal: '2026-10-08', penting: true });
    await PPAPI.store.content.save('pustaka', { judul: 'Petunjuk Teknis Uji Beban Perancah', kategori: 'Petunjuk Teknis', kode: 'PPAPI-PT-09', versi: 'Revisi 1', tanggal: '2026-10-01', status: 'Berlaku', ringkasan: 'Uji coba konten kelolaan.', akses: 'anggota' });
    await PPAPI.store.content.remove('berita', (await PPAPI.store.content.list('berita'))[0].id);
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('#dash-pustaka .doc-card', { timeout: 6000 }).catch(() => {});
  check('managed pengumuman listed first (penting, newest)', (await txt(page, '#dash-pengumuman .dash-notice:first-child .dash-notice__title')) === 'Rapat anggota tahunan diumumkan');
  check('managed pengumuman has no Contoh badge', (await count(page, '#dash-pengumuman .dash-notice:first-child .badge--contoh')) === 0);
  check('managed pustaka item (dated) is the newest doc card', (await txt(page, '#dash-pustaka .doc-card:first-child .doc-card__code')) === 'PPAPI-PT-09' &&
    (await page.$eval('#dash-pustaka .doc-card:first-child .badge', b => b.className)).includes('badge--ok'));
  check('hidden static berita no longer listed', (await page.$$eval('#dash-berita .news-card time', ts => ts.map(t => t.getAttribute('datetime')).join())) === '2026-10-07,2026-09-30,2026-09-23');
  check('no console errors', issues.length === 0, issues);
  await ctx.close();
}

/* ------------------------------------------------------------ L */
console.log('\n[widths] L · 360–1440 px: no horizontal overflow in either view');
for (const [label, opts, view] of [['active', { member: MEMBER }, 'active'], ['status', { member: withStatus('Perlu Perbaikan') }, 'status'], ['admin', { admin: true }, 'active']]) {
  for (const width of [360, 600, 768, 900, 1024, 1180, 1280]) {
    const c2 = await browser.newContext({ viewport: { width, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
    await c2.clock.setFixedTime(NOW);
    if (opts.admin) {
      await c2.addInitScript(({ a }) => { try { localStorage.setItem('ppapi_demo_session', JSON.stringify(a)); localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid])); } catch (e) {} }, { a: ADMIN });
    } else {
      await c2.addInitScript(({ u, m }) => { try { if (!sessionStorage.getItem('__w')) { sessionStorage.setItem('__w', '1'); localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: USER, m: opts.member });
    }
    const { page, issues } = await openDash(c2, view);
    const over = await overflow(page);
    check(`${label} @${width}px: no horizontal overflow`, over <= 1 && issues.length === 0, { over, issues });
    if (width === 768 || width === 1024) await page.screenshot({ path: path.join(SHOTS, `dashboard-flow-L-${label}-${width}.png`), fullPage: true });
    await c2.close();
  }
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed${fail ? '\n  - ' + failures.join('\n  - ') : ''}`);
process.exit(fail ? 1 : 0);
