// Element screenshots of the Instruktur feature with two seeded profiles (Mode Demo).
// Run from the workspace root: node devtools/flows/instruktur-shots.mjs  → devtools/shots/insshot-*.png
// Reuses the in-memory admin integration of instruktur-flow.mjs by importing nothing: it seeds
// localStorage directly and only shoots the public page (admin views are shot by instruktur-flow --shots).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  if (file.replace(/\\/g, '/').endsWith('assets/js/config.js')) return res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''"));
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const SEED = {
  'ins-budi-santoso-ab12': { nama: 'Budi Santoso', gelar: 'Inspektur Scaffolding · Instruktur K3', foto: '', kompetensi: ['SCF-09', 'SCF-05', 'SCF-06'], sertifikasi: [{ nama: 'Inspektur Scaffolding', penerbit: 'BNSP / LSP', berlakuHingga: '2028-06-30' }, { nama: 'CISRS Scaffolding Supervisor', penerbit: 'Lembaga Internasional (CISRS, dll.)', berlakuHingga: '2026-12-01' }], pengalamanTahun: 12, wilayah: ['Kalimantan Timur', 'Jawa Barat', 'DKI Jakarta'], bahasa: ['Indonesia', 'Inggris'], metode: ['Luring', 'Daring'], materi: ['Inspeksi harian dan scafftag', 'Pemasangan perancah tube & coupler'], bio: 'Dua belas tahun menginspeksi perancah di proyek gedung tinggi dan kilang minyak.', kta: 'PPAPI-2026-004821', published: true, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' },
  'ins-sri-lestari-cd34': { nama: 'Sri Lestari', gelar: 'Ahli K3 Konstruksi Madya', foto: '', kompetensi: ['SCF-13'], sertifikasi: [], pengalamanTahun: 8, wilayah: ['Seluruh Indonesia'], bahasa: ['Indonesia'], metode: ['Daring'], materi: [], bio: 'Instruktur K3 konstruksi untuk pekerjaan di ketinggian.', kta: '', published: true, createdAt: '2026-10-20T01:00:00Z', updatedAt: '2026-10-20T01:00:00Z' },
};
const browser = await chromium.launch();
for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844, m: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m, deviceScaleFactor: vp.m ? 2 : 1, reducedMotion: 'reduce', locale: 'id-ID' });
  await ctx.addInitScript((s) => { localStorage.setItem('ppapi_instructors', JSON.stringify(s)); }, SEED);
  const page = await ctx.newPage();
  await page.goto(BASE + '/instruktur.html');
  await page.waitForSelector('.in-card');
  await page.locator('#direktori').screenshot({ path: path.join(SHOTS, `insshot-${vp.n}-direktori.png`) });
  await page.locator('#permintaan').screenshot({ path: path.join(SHOTS, `insshot-${vp.n}-permintaan.png`) });
  await page.locator('.in-card__open').first().click();
  await page.waitForSelector('.modal .in-profile');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, `insshot-${vp.n}-modal.png`) });
  await ctx.close();
}
await browser.close();
server.close();
console.log('shots saved');
