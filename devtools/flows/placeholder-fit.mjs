// placeholder-fit — every VISIBLE input/textarea placeholder fits inside its field (no clipped hint text),
// signed out and as an Aktif member / Draf applicant, at 9 widths from 1440 to 320 px.
// Run from devtools/:  node flows/placeholder-fit.mjs
import { chromium } from 'playwright';
import { startServer, DEMO_USER, DEMO_MEMBER, registryEntryFor } from './qa-lib.mjs';

const { BASE, close } = await startServer();
const b = await chromium.launch();
const draf = structuredClone(DEMO_MEMBER);
Object.assign(draf, { status: 'Draf', kta: '', validUntil: '', approvedAt: '', approvedBy: '' });
draf.application.submittedAt = '';
const STATES = {
  guest: { m: null, pages: ['index.html', 'masuk.html', 'masuk.html#daftar', 'verifikasi.html', 'berita.html', 'agenda.html', 'regulasi.html', 'pustaka.html', 'umpan-balik.html'] },
  aktif: { m: DEMO_MEMBER, pages: ['anggota.html', 'pustaka.html', 'umpan-balik.html'] },
  draf: { m: draf, pages: ['pendaftaran.html#data-diri', 'pendaftaran.html#profesional', 'pendaftaran.html#kompetensi', 'pendaftaran.html#dokumen', 'pendaftaran.html#pernyataan'] },
};
const bad = [];
let checked = 0;
for (const w of [1440, 1280, 1024, 900, 768, 600, 390, 360, 320]) {
  for (const [st, cfg] of Object.entries(STATES)) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 768, hasTouch: w < 768, reducedMotion: 'reduce' });
    if (cfg.m) {
      await ctx.addInitScript(({ u, m, r }) => {
        try {
          if (!localStorage.getItem('ppapi_demo_session')) {
            localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
            localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
            if (r) { const reg = {}; reg[r.kta] = r; localStorage.setItem('ppapi_registry', JSON.stringify(reg)); }
          }
        } catch (e) {}
      }, { u: DEMO_USER, m: cfg.m, r: registryEntryFor(cfg.m) });
    }
    for (const target of cfg.pages) {
      const p = await ctx.newPage();
      await p.goto(`${BASE}/${target}`, { waitUntil: 'networkidle' }).catch(() => {});
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => [...document.querySelectorAll('input[placeholder], textarea[placeholder]')].filter(q => q.offsetWidth > 0 && q.placeholder).map(q => {
        const cs = getComputedStyle(q);
        const avail = q.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const c = document.createElement('canvas').getContext('2d');
        c.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        if (q.tagName === 'TEXTAREA') {   // wraps: only a single word longer than the line would clip
          const longest = Math.max(...q.placeholder.split(/\s+/).map(t => c.measureText(t).width));
          return { id: q.id || q.name, ok: longest <= avail + 1, need: Math.round(longest), avail: Math.round(avail), ph: q.placeholder };
        }
        const need = c.measureText(q.placeholder).width;
        return { id: q.id || q.name, ok: need <= avail + 1, need: Math.round(need), avail: Math.round(avail), ph: q.placeholder };
      }));
      checked += r.length;
      r.filter(x => !x.ok).forEach(x => bad.push(`${w}px ${st} ${target} #${x.id} "${x.ph}" ${x.need}>${x.avail}`));
      await p.close();
    }
    await ctx.close();
  }
}
await b.close(); await close();
if (bad.length) console.log('  FAIL  clipped placeholders:\n' + bad.map(x => '    ' + x).join('\n'));
else console.log(`  PASS  all ${checked} visible placeholders fit their fields (9 widths × 3 states)`);
console.log(`\nplaceholder-fit: ${bad.length ? 0 : 1}/1 passed, ${bad.length ? 1 : 0} failed`);
if (bad.length) process.exitCode = 1;
