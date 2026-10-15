// aplikasi-perencanaan-retheme — tangkapan layar & pemeriksaan tema PPAPI Scaffold (Beta) setelah diselaraskan dengan
// sistem desain situs (Oktober 2026): setiap tahap 1–9, beranda, menu tahap (drawer), modal konteks editor gambar,
// daftar periksa dengan jawaban, laporan + pratinjau scaffold tag, admin — desktop 1440 dan ponsel 390.
// Juga memeriksa: tidak ada pita hazard / kuning / Oswald, fokus keyboard terlihat, tanpa overflow mendatar,
// kontras chip status, dan warna status hanya pada komponen status.
// usage (cwd devtools): node flows/aplikasi-perencanaan-retheme.mjs [--only=desktop|mobile]
// Tangkapan: devtools/shots/retheme-pr-<nama>-<viewport>.png
import { startServer, launch, newContext, seedSession, watch, recorder, shot } from './aplikasi-lib.mjs';

const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const T = recorder('aplikasi-perencanaan-retheme');
const { server, BASE } = await startServer();
const browser = await launch();
const PR = `${BASE}/aplikasi/perencanaan/index.html`;
const noIssues = (label, issues) => T.ok(issues.length === 0, `${label}: no console errors / page errors / failed requests`, issues.slice(0, 4));
const gateOk = (page) => page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
const goV = async (page, v) => { await page.evaluate(v => { go(v); window.scrollTo(0, 0); }, v); await page.waitForTimeout(150); };
const lum = (c) => { let [r, g, b, a = 1] = c.match(/[\d.]+/g).map(Number); if (a < 1) { r = r * a + 17 * (1 - a); g = g * a + 17 * (1 - a); b = b * a + 19 * (1 - a); } /* rgba over the ink menu band */ const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

for (const vp of ['desktop', 'mobile']) {
  if (only && only !== vp) continue;
  T.section(`R (${vp}) retheme screenshots & checks`);
  const ctx = await newContext(browser, vp, { reducedMotion: 'no-preference' });
  await seedSession(ctx, { admin: vp === 'desktop' });
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(PR, { waitUntil: 'networkidle' });
  await gateOk(page);
  await page.waitForTimeout(600);   // web fonts
  const full = { fullPage: true };

  // 1. tema: tidak ada hazard / Oswald / kuning hazard
  const theme = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el);
    const fonts = [...document.querySelectorAll('h2.sec, h3, .eyebrow, .btn, .menu-btn, body')].map(e => cs(e).fontFamily);
    const all = [...document.querySelectorAll('body *')].slice(0, 4000);
    const yellow = all.filter(e => { const s = cs(e); return /rgb\(245, 197, 24\)|rgb\(217, 171, 0\)/.test(s.backgroundColor + s.color + s.borderColor + s.backgroundImage); }).length;
    return {
      hazard: document.querySelectorAll('.hazard').length, oswald: fonts.filter(f => /Oswald/i.test(f)).length, yellow,
      h2: cs(document.querySelector('h2.sec')).fontFamily, eyebrow: cs(document.querySelector('.eyebrow')).fontFamily, body: cs(document.body).fontFamily,
      btn: cs(document.querySelector('.hero .btn-pri')).backgroundColor, bodyBg: cs(document.body).backgroundColor,
      chipFg: cs(document.getElementById('head-verdict')).color, chipBg: cs(document.getElementById('head-verdict')).backgroundColor,
      chrome: Math.round(document.querySelector('body > header').getBoundingClientRect().bottom),
    };
  });
  T.ok(theme.hazard === 0 && theme.oswald === 0 && theme.yellow === 0, `${vp}: no hazard stripe, no Oswald, no hazard yellow in computed styles`, theme);
  T.ok(/Cormorant/.test(theme.h2) && /Barlow/.test(theme.eyebrow) && /Inter/.test(theme.body), `${vp}: Cormorant headings, Barlow Condensed eyebrows, Inter body`, theme);
  T.ok(theme.btn === 'rgb(236, 236, 234)' && theme.bodyBg === 'rgb(246, 246, 244)', `${vp}: hero primary button bone-on-black; paper page background`, theme);
  T.ok(ratio(theme.chipFg, theme.chipBg) >= 4.5, `${vp}: "BELUM LENGKAP" chip in the menu band ≥ 4.5:1 (${ratio(theme.chipFg, theme.chipBg).toFixed(1)}:1)`, theme);
  T.ok(theme.chrome <= (vp === 'desktop' ? 110 : 100), `${vp}: portal bar + menu band end at ${theme.chrome} px`, theme.chrome);

  await shot(page, `retheme-pr-beranda-${vp}`, full);

  // 2. menu tahap (drawer)
  await page.click('#menu-btn');
  await page.waitForTimeout(250);
  const drawer = await page.evaluate(() => ({ open: document.getElementById('menu-panel').classList.contains('open'), exp: document.getElementById('menu-btn').getAttribute('aria-expanded'), sw: document.documentElement.scrollWidth - innerWidth }));
  T.ok(drawer.open && drawer.exp === 'true' && drawer.sw <= 1, `${vp}: stage menu opens, aria-expanded, no overflow`, drawer);
  await shot(page, `retheme-pr-menu-${vp}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  if (await page.evaluate(() => document.getElementById('menu-panel').classList.contains('open'))) await page.click('#menu-btn');

  // 3. tahap 1–9 + tentang (+ admin di desktop)
  const stages = ['proyek', 'beban', 'duty', 'gambar', 'material', 'analisis', 'jsa', 'checklist', 'laporan', 'tentang'].concat(vp === 'desktop' ? ['admin'] : []);
  for (const v of stages) {
    await goV(page, v);
    if (v === 'checklist') {
      await page.click('#v-checklist button:has-text("Tandai semua Sesuai")');
      await page.click('#item-0-1 .ab:has-text("Tidak")');
      await page.waitForTimeout(200);
    }
    if (v === 'gambar') {
      await page.evaluate(() => { dwgAdd('pipe', 5, 45, { len: 4, rot: 90 }); dwgAdd('pipe', 7, 45, { len: 4, rot: 90 }); dwgAdd('pipe', 6, 44, { len: 2 }); dwgAdd('pipe', 6, 42, { len: 4, rot: 45 }); });
      await page.waitForTimeout(150);
    }
    if (v === 'laporan') await page.waitForTimeout(300);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    T.ok(ov <= 1, `${vp} ${v}: no horizontal overflow`, ov);
    await shot(page, `retheme-pr-${v}-${vp}`, full);
  }

  // 4. modal konteks editor gambar (klik kanan pada pipa) — desktop saja
  if (vp === 'desktop') {
    await goV(page, 'gambar');
    const box = await page.$eval('#dwg-svg', s => { const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const hit = await page.evaluate(() => { const g = document.querySelector('#dwg-svg g[data-id]'); const r = g.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(hit.x, hit.y, { button: 'right' });
    await page.waitForTimeout(250);
    const ctxOpen = await page.evaluate(() => document.getElementById('dwg-ctx').classList.contains('open'));
    T.ok(ctxOpen, 'desktop: drawing context menu opens on right click', { box, hit });
    await page.screenshot({ path: new URL('../shots/retheme-pr-modal-ctx-desktop.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), clip: { x: 0, y: Math.max(0, box.y - 80), width: 1440, height: Math.min(900, box.h + 200) } });
    await page.keyboard.press('Escape');
  }

  // 5. laporan: verdict banner monokrom dengan aksen status; tag preview penuh warna
  await goV(page, 'laporan');
  const lap = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el);
    const vb = document.querySelector('#ringkasan-root .verdict-banner'), vi = vb.querySelector('.vb-icon'), band = document.querySelector('#tag-preview .tag-band');
    return { vbBg: cs(vb).backgroundColor, vbTop: getComputedStyle(vb, '::before').backgroundColor, icon: cs(vi).backgroundColor, iconFg: cs(vi).color, band: cs(band).backgroundColor, bandFg: cs(band).color, status: document.getElementById('head-verdict').textContent };
  });
  T.ok(lap.vbBg === 'rgb(26, 26, 29)' && lap.icon === 'rgb(201, 154, 46)' && lap.vbTop === 'rgb(201, 154, 46)', `${vp}: KUNING summary banner is graphite with amber icon + top rule (status ${lap.status})`, lap);
  T.ok(lap.band === 'rgb(201, 154, 46)' && ratio(lap.bandFg, lap.band) >= 4.5, `${vp}: scaffold tag keeps its full amber band, ink text ≥ 4.5:1 (${ratio(lap.bandFg, lap.band).toFixed(1)}:1)`, lap);
  const tagEl = await page.$('#tag-preview');
  await tagEl.screenshot({ path: new URL(`../shots/retheme-pr-tag-${vp}.png`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });

  // 6. fokus keyboard terlihat pada tombol & input
  await goV(page, 'proyek');
  await page.focus('#f-proyek');
  await page.waitForTimeout(400);   // border-color transition
  const f1 = await page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { id: e.id, border: s.borderColor, shadow: s.boxShadow }; });
  T.ok(f1.id === 'f-proyek' && f1.border === 'rgb(17, 17, 19)' && /rgba\(17, 17, 19/.test(f1.shadow), `${vp}: focused input has ink border + ring`, f1);
  await page.focus('#v-proyek .btn-pri');
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const f2 = await page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { cls: e.className, outline: s.outlineStyle, w: s.outlineWidth }; });
  T.ok(/btn-pri/.test(f2.cls) && f2.outline === 'solid' && f2.w === '2px', `${vp}: keyboard-focused button shows a 2 px outline`, f2);

  // 7. FAB
  const fab = await page.evaluate(() => { const a = document.querySelector('.fab'); const s = getComputedStyle(a); return { bg: s.backgroundColor, fg: s.color, radius: s.borderRadius, anim: s.animationName, href: a.getAttribute('href') }; });
  T.ok(fab.bg === 'rgb(17, 17, 19)' && fab.anim === 'none' && fab.href === '../simulator/index.html' && ratio(fab.fg, fab.bg) >= 4.5, `${vp}: Simulator 3D pill is dark, no glow animation, links to the simulator`, fab);

  noIssues(`retheme ${vp}`, issues);
  await ctx.close();
}

await browser.close();
server.close();
process.exit(T.done() ? 1 : 0);
