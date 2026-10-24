// produksi-bersih — situs produksi (Mode Firebase) bebas istilah demo/uji/contoh/pratinjau (2026-10-21).
// Run from devtools/:  node flows/produksi-bersih.mjs        (perlu internet: SDK Firebase + Firestore ppapi-web)
//
// Server uji menyajikan config.js APA ADANYA (sama dengan PPAPI_REAL_FIREBASE=1 pada check.mjs), jadi halaman
// berjalan persis seperti di https://ppapi.or.id. Untuk setiap halaman publik (+ setiap artikel berita):
//   1. PPAPI.auth.mode harus 'firebase' (kalau tidak, pemeriksaan ini tidak bermakna → gagal);
//   2. document.title + document.body.innerText (teks yang benar-benar terlihat) tidak boleh memuat
//      istilah demo / trial / uji coba / contoh / preview / sampel / sample / dummy / lorem ipsum / placeholder
//      maupun nama/alamat contoh (Nama Pengurus, PT Contoh, contoh.id, example.com, ppapi.demo);
//   3. mesin Mode Demo tidak dirender: pita Mode Demo tersembunyi (html tanpa .has-demo-ribbon), catatan
//      akun admin demo di masuk.html tersembunyi, tidak ada lencana .badge--contoh yang terlihat.
// Hanya membaca; tidak masuk akun dan tidak menulis apa pun ke Firestore. Tidak dipasang di CI.
process.env.PPAPI_REAL_FIREBASE = '1';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { startServer, ROOT } from './qa-lib.mjs';

const TERMS = /\b(demo|demonstrasi|trial|uji[\s-]?coba|contoh|preview|sampel|sample|dummy|lorem ipsum|placeholder)\b|Nama Pengurus|PT Contoh|contoh\.id|example\.com|ppapi\.demo/i;

const SB = { window: {} }; SB.PPAPI_DATA = SB.window.PPAPI_DATA = {}; vm.createContext(SB);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/data/berita.js'), 'utf8'), SB);
const articles = (SB.PPAPI_DATA.berita || []).map(b => 'berita.html?id=' + encodeURIComponent(b.id));

const PAGES = [
  'index.html', 'profil.html', 'berita.html', 'agenda.html', 'agenda.html?tab=telah-berlangsung', 'pustaka.html', 'regulasi.html',
  'instruktur.html', 'toko.html', 'keanggotaan.html', 'verifikasi.html', 'verifikasi.html?kta=PPAPI-2026-000123',
  'sertifikat.html', 'umpan-balik.html', 'kebijakan-privasi.html', 'anggaran-dasar.html', 'masuk.html', 'masuk.html#daftar', '404.html',
  ...articles,
];

let pass = 0; const fails = [];
const ok = (c, label, detail) => {
  if (c) { pass++; console.log('  ✓ ' + label); }
  else {
    fails.push(label); console.log('  ✗ ' + label + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 700) : ''));
    /* di GitHub Actions: kegagalan juga ditulis sebagai anotasi agar terbaca tanpa membuka log lengkap */
    if (process.env.GITHUB_ACTIONS) console.log('::error title=produksi-bersih::' + (label + (detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 500) : '')).replace(/%/g, '%25').replace(/\r?\n/g, '%0A'));
  }
};

const { BASE, close } = await startServer();
const browser = await chromium.launch();
try {
  for (const vp of [{ name: 'desktop', viewport: { width: 1440, height: 900 } }, { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]) {
    console.log(`\n${vp.name}`);
    for (const t of PAGES) {
      const ctx = await browser.newContext({ ...vp, locale: 'id-ID', reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      /* 'load', not 'networkidle': Firestore keeps a listen channel open, so the network never goes idle */
      await page.goto(`${BASE}/${t}`, { waitUntil: 'load', timeout: 60000 }).catch(e => errors.push('goto: ' + e.message));
      await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 30000 }).catch(() => errors.push('PPAPI not ready'));
      await page.waitForTimeout(2500);   // Firestore reads (instruktur, toko, agenda/kegiatan, konten admin)
      const r = await page.evaluate((src) => {
        const re = new RegExp(src, 'i');
        const vis = e => !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length));
        const text = document.title + '\n' + document.body.innerText;
        const lines = text.split('\n').filter(l => re.test(l)).map(l => l.trim().slice(0, 160));
        const rib = document.querySelector('[data-demo-ribbon]');
        return {
          mode: window.PPAPI && PPAPI.auth ? PPAPI.auth.mode : '(no auth)',
          hits: lines,
          ribbon: document.documentElement.classList.contains('has-demo-ribbon') || (rib && !rib.hidden && vis(rib)),
          demoNote: [...document.querySelectorAll('[data-demo-note], [data-demo-admin], [data-demo-only]')].some(e => !e.hidden && vis(e)),
          contohBadges: [...document.querySelectorAll('.badge--contoh')].filter(vis).length,
        };
      }, TERMS.source).catch(e => ({ mode: '(evaluate failed: ' + e.message + ')', hits: [], ribbon: false, demoNote: false, contohBadges: 0 }));
      const tag = `${vp.name} ${t}`;
      ok(r.mode === 'firebase', `${tag}: Mode Firebase`, r.mode);
      ok(r.hits.length === 0, `${tag}: no demo/trial/contoh/preview wording in visible text`, r.hits);
      ok(!r.ribbon && !r.demoNote && r.contohBadges === 0, `${tag}: no demo ribbon / demo note / Contoh badge rendered`, r);
      ok(errors.length === 0, `${tag}: no page errors`, errors);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  await close();
}
console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
