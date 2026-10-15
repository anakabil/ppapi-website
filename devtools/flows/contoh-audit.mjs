// Contoh audit (2026-10-15, after the sample content was removed on the client's instruction).
// Run from devtools/:  node flows/contoh-audit.mjs
//
//   A  static data: no contoh:true item remains in berita / pengumuman / agenda / registry / pustaka / organisasi
//      lists; the ONLY provisional flags left are organisasi.bagianContoh (visi, misi, nilai, maknaLogo, keanggotaan)
//      and keanggotaan.kategori[].contoh — wording the client has not yet made official, kept so the pages are not
//      empty but still labelled "Contoh"; sample lists (agenda, registry, pengumuman) are empty; pustaka holds only
//      the two real apps; berita holds only editorial articles (no contoh flag at all).
//   B  source: no sample strings reach the public pages (placeholder names, "Data contoh", sample notices).
//   C  browser: every rendered Contoh badge sits inside one of the flagged sections (profil visi/misi/nilai/makna
//      logo, keanggotaan kategori, pendaftaran category note) and no other page shows a Contoh badge or sample text.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { startServer, ROOT, seedAuth, DEMO_MEMBER } from './qa-lib.mjs';

let pass = 0; const fails = [];
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fails.push(label); console.log('  ✗ ' + label + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 600) : '')); }
  return !!cond;
};
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ------------------------------------------------------------------ A · static data */
console.log('\nA · static data (assets/data/*.js)');
const SB = { window: {} }; SB.PPAPI_DATA = SB.window.PPAPI_DATA = {}; SB.PPAPI_CONFIG = {}; vm.createContext(SB);
for (const f of ['berita', 'agenda', 'registry', 'pustaka', 'organisasi', 'regulasi', 'kompetensi']) vm.runInContext(read(`assets/data/${f}.js`), SB);
const D = SB.PPAPI_DATA;
const flagged = (arr, kind) => (arr || []).filter(x => x && x.contoh).map(x => kind + ':' + (x.id || x.judul || x.nama || x.jabatan || x.label));
const leftovers = [
  ...flagged(D.berita, 'berita'), ...flagged(D.pengumuman, 'pengumuman'), ...flagged(D.agenda, 'agenda'), ...flagged(D.registry, 'registry'),
  ...flagged(D.pustaka, 'pustaka'), ...flagged(D.organisasi.sejarah, 'sejarah'), ...flagged(D.organisasi.pengurus, 'pengurus'),
  ...flagged(D.organisasi.stats, 'stats'), ...flagged(D.organisasi.layanan, 'layanan'), ...flagged(D.organisasi.nilai, 'nilai'),
  ...flagged(D.organisasi.maknaLogo, 'maknaLogo'), ...flagged(D.organisasi.faq, 'faq'), ...flagged(D.regulasi, 'regulasi'),
];
ok(leftovers.length === 0, 'no contoh:true item remains in any content list', leftovers);
ok(Array.isArray(D.agenda) && D.agenda.length === 0, 'agenda.js: no activities yet ([])', D.agenda.length);
ok(Array.isArray(D.pengumuman) && D.pengumuman.length === 0, 'berita.js: pengumuman empty ([])', D.pengumuman.length);
ok(Array.isArray(D.registry) && D.registry.length === 0, 'registry.js: static public list empty ([]) — approvals feed the registry', D.registry.length);
ok(D.pustaka.length === 2 && D.pustaka.every(p => p.kategori === 'Aplikasi' && p.contoh === false), 'pustaka.js: only the two real member apps', D.pustaka.map(p => p.id));
ok(D.berita.length >= 8 && D.berita.every(b => !('contoh' in b) && b.penulis === 'Redaksi PPAPI' && Array.isArray(b.isi) && b.isi.includes('## Daftar Pustaka')), `berita.js: ${D.berita.length} editorial articles, no contoh flag, each with a Daftar Pustaka`, D.berita.map(b => b.id));
ok(D.berita.filter(b => b.sorot).length === 1 && D.berita.every((b, i) => i === 0 || b.tanggal <= D.berita[i - 1].tanggal) && D.berita[0].tanggal <= '2026-10-15' && D.berita[D.berita.length - 1].tanggal >= '2026-07-01', 'berita.js: one sorot, newest first, dated 2026-07 … 2026-10-15', D.berita.map(b => b.tanggal));
ok(D.organisasi.sejarah.length === 0 && D.organisasi.pengurus.length === 0 && D.organisasi.legalitas.length === 0, 'organisasi.js: sejarah / pengurus / legalitas empty until official data exists');
const BC = D.organisasi.bagianContoh || {};
ok(['visi', 'misi', 'nilai', 'maknaLogo', 'keanggotaan'].every(k => BC[k] === true) && Object.keys(BC).length === 5, 'organisasi.bagianContoh: visi, misi, nilai, maknaLogo, keanggotaan still flagged (provisional wording kept, labelled)', BC);
ok(D.organisasi.keanggotaan.kategori.length === 4 && D.organisasi.keanggotaan.kategori.every(k => k.contoh === true), 'keanggotaan.kategori: 4 categories still flagged contoh (wording awaiting the board)', D.organisasi.keanggotaan.kategori.map(k => k.nama));
ok(D.organisasi.stats.length === 4 && D.organisasi.stats.map(s => s.angka).join() === [D.regulasi.length, D.kompetensi.katalog.length, 9, 10].join(), 'organisasi.stats are factual counts (regulasi, kompetensi, app stages, inspection categories)', D.organisasi.stats.map(s => s.angka));

/* ------------------------------------------------------------------ B · source scan */
console.log('\nB · source scan');
const SAMPLE = /Nama Pengurus|PT Contoh|Data contoh untuk demonstrasi|contoh:\s*true|Coba nomor contoh|Konten contoh|agenda contoh/;
const hits = [];
for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && f !== 'styleguide.html')) { const m = read(f).match(SAMPLE); if (m) hits.push(f + ': ' + m[0]); }
// data files: comments explain the flag, so strip /* … */ and // comments before looking for a live contoh: true
// (organisasi.js keeps keanggotaan.kategori[].contoh = true on purpose — see A)
for (const f of fs.readdirSync(path.join(ROOT, 'assets/data')).filter(f => f !== 'organisasi.js')) {
  const code = read('assets/data/' + f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const m = code.match(/contoh:\s*true/); if (m) hits.push('assets/data/' + f + ': ' + m[0]);
}
ok(hits.length === 0, 'no sample string in page markup or data files (styleguide.html is the component gallery and exempt)', hits);
ok(/PPAPI_DATA\.registry = \[\];/.test(read('assets/data/registry.js')) && /PPAPI_DATA\.agenda = \[\];/.test(read('assets/data/agenda.js')) && /PPAPI_DATA\.pengumuman = \[\];/.test(read('assets/data/berita.js')), 'empty lists are literal [] (easy for the secretariat to fill)');
ok(!/data-vf="sample"/.test(read('verifikasi.html')), 'verifikasi.html: sample-data notice block removed');

/* ------------------------------------------------------------------ C · rendered pages */
console.log('\nC · rendered pages (Mode Demo)');
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const ALLOWED = {
  'profil.html': ['#visi-misi', '#misi', '#nilai', '#makna-logo'],
  'keanggotaan.html': ['#kategori'],
  'pendaftaran.html': ['.daf-cat-note', '[data-form="kategori"]'],
};
const TEXT = /Nama menyusul|Nama Pengurus|Konten contoh|Data contoh|agenda contoh|rancangan PPAPI \(contoh\)|bertanda Contoh/;
const targets = [
  ['index.html', false], ['berita.html', false], ['berita.html?id=' + D.berita[0].id, false], ['berita.html?id=' + D.berita[D.berita.length - 1].id, false],
  ['agenda.html', false], ['agenda.html?tab=telah-berlangsung', false], ['profil.html', false], ['keanggotaan.html', false], ['pustaka.html', false],
  ['verifikasi.html', false], ['verifikasi.html?kta=PPAPI-2026-000123', false], ['umpan-balik.html', false], ['regulasi.html', false],
  ['dashboard.html', true], ['anggota.html', true], ['pendaftaran.html', 'draf'], ['pustaka.html', true],
];
// a new applicant still on the category step (the category note carries the only Contoh badge of the form)
const DRAF = Object.assign({}, DEMO_MEMBER, { status: 'Draf', kta: '', validUntil: '', approvedAt: '', approvedBy: '', application: Object.assign({}, DEMO_MEMBER.application, { submittedAt: '', kategori: '' }) });
for (const [t, auth] of targets) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
  if (auth === 'draf') await seedAuth(ctx, { member: DRAF }); else if (auth) await seedAuth(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${BASE}/${t}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(800);
  const file = t.split('?')[0];
  const r = await page.evaluate((allowed) => {
    const vis = e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    const badges = [...document.querySelectorAll('.badge--contoh')].filter(vis);
    const outside = badges.filter(b => !allowed.some(sel => b.closest(sel))).map(b => (b.closest('section, article, li, div') || b).className);
    const text = document.body.innerText;
    return { badges: badges.length, outside, sample: (text.match(/Nama menyusul|Nama Pengurus|Konten contoh|Data contoh|agenda contoh|rancangan PPAPI \(contoh\)|bertanda Contoh/) || [null])[0] };
  }, ALLOWED[file] || []);
  const label = `${t}${auth === 'draf' ? ' (Draf)' : auth ? ' (Aktif)' : ''}: ${r.badges} Contoh badge(s)`;
  if (ALLOWED[file]) ok(r.badges > 0 && r.outside.length === 0, label + ' — all inside the flagged sections', r);
  else ok(r.badges === 0, label + ' — none expected', r);
  ok(r.sample === null, `${t}: no sample text visible`, r.sample);
  ok(errors.length === 0, `${t}: no page errors`, errors);
  await ctx.close();
}
await browser.close();
await close();
console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
