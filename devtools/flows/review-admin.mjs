// review-admin — admin console: every section, drawer, approve/revise/reject dialogs, content form, CSV.
//   node flows/review-admin.mjs      → shots/review-tampilan/adm-*.png (+ adm-anggota.csv)
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, makeCtx, open, shot, overflow, safe, report, finish, OUT } from './review-lib.mjs';

const { BASE, close } = await startServer();
const browser = await launch();
const SECTIONS = ['ringkasan', 'permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log'];

async function ready(page) { await page.waitForSelector('html[data-admin-ready]', { timeout: 20000 }); await page.waitForTimeout(300); }
async function nav(page, s) {
  const link = page.locator(`.adm-nav__link[data-section="${s}"]`).first();
  await link.scrollIntoViewIfNeeded().catch(() => {});
  await link.click();
  await page.waitForFunction(x => { const e = document.getElementById('sec-' + x); return e && !e.hidden; }, s, { timeout: 8000 });
  await page.waitForTimeout(350);
  await page.evaluate(() => scrollTo(0, 0));
}

for (const vp of ['desktop', 'mobile', 'laptop', 'tablet']) {
  console.log(`\n[${vp}]`);
  await safe(`admin sections ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'admin' });
    const page = await open(ctx, BASE, 'admin.html', { wait: 800 });
    await ready(page);
    await shot(page, `adm-ringkasan-${vp}-fold`);
    const secs = vp === 'desktop' || vp === 'mobile' ? SECTIONS : ['ringkasan', 'permohonan', 'anggota', 'konten'];
    for (const s of secs) {
      await nav(page, s);
      if (s === 'konten') await page.waitForSelector('#kt-list tbody tr', { timeout: 8000 }).catch(() => {});
      await shot(page, `adm-${s}-${vp}-full`, { full: true, scroll: true });
      const ov = await overflow(page); if (ov > 1) console.log(`  ! admin ${s} ${vp}: overflow ${ov}px`);
    }
    // permohonan drawer + dialogs
    await nav(page, 'permohonan');
    const openBtn = page.locator('#pq-list [data-open="member"].adm-act').first();
    await openBtn.scrollIntoViewIfNeeded(); await openBtn.click();
    await page.waitForSelector('.drawer__panel', { timeout: 6000 }); await page.waitForTimeout(500);
    await shot(page, `adm-drawer-permohonan-${vp}`);
    await shot(page, `adm-drawer-permohonan-${vp}-panel`, { el: '.drawer__panel' });
    for (const [act, id] of [['approve', '#act-approve'], ['revise', '#act-revise'], ['reject', '#act-reject']]) {
      const b = page.locator(id).first();
      if (!(await b.count())) { console.log('  (no ' + id + ')'); continue; }
      await b.scrollIntoViewIfNeeded(); await b.click();
      await page.waitForSelector('.modal__dialog', { timeout: 6000 }); await page.waitForTimeout(400);
      if (act === 'revise') { const t = page.locator('.modal [data-template="0"]'); if (await t.count()) await t.click(); await page.waitForTimeout(200); }
      if (act === 'reject' || act === 'approve') { await page.locator(`#dlg-${act}-ok`).click().catch(() => {}); await page.waitForTimeout(400); }
      await shot(page, `adm-dialog-${act}-${vp}`);
      await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {}); await page.waitForTimeout(200);
      if (!(await page.locator('.drawer__panel').count())) { await openBtn.click(); await page.waitForSelector('.drawer__panel', { timeout: 6000 }); await page.waitForTimeout(300); }
    }
    await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }).catch(() => {});
    // anggota drawer (active member) + search + CSV
    await nav(page, 'anggota');
    const a1 = page.locator('#aq-list .adm-act').first();
    if (await a1.count()) { await a1.scrollIntoViewIfNeeded(); await a1.click(); await page.waitForSelector('.drawer__panel', { timeout: 6000 }); await page.waitForTimeout(500); await shot(page, `adm-drawer-anggota-${vp}`); await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }).catch(() => {}); }
    await page.fill('#aq-q', 'zzzz'); await page.waitForTimeout(500);
    await shot(page, `adm-anggota-empty-${vp}`, { el: '#sec-anggota' });
    await page.fill('#aq-q', ''); await page.waitForTimeout(400);
    if (vp === 'desktop') {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.click('#aq-export')]);
      const dest = path.join(OUT, 'adm-anggota.csv'); await dl.saveAs(dest);
      console.log('  csv:', dl.suggestedFilename(), fs.readFileSync(dest, 'utf8').split('\n').slice(0, 3).join(' ⏎ ').slice(0, 400));
      await page.waitForTimeout(400); await shot(page, `adm-anggota-aftercsv-${vp}`);
    }
    // konten: add dialog (berita), agenda list, pustaka list + add
    await nav(page, 'konten');
    await page.waitForSelector('#kt-list tbody tr', { timeout: 8000 }).catch(() => {});
    await page.click('#kt-add'); await page.waitForSelector('.modal__dialog', { timeout: 6000 }); await page.waitForTimeout(400);
    await shot(page, `adm-dialog-konten-berita-${vp}`);
    await page.click('#dlg-content-ok').catch(() => {}); await page.waitForTimeout(400);
    await shot(page, `adm-dialog-konten-berita-errors-${vp}`, { el: '.modal__dialog' });
    await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {});
    for (const t of ['agenda', 'pustaka', 'regulasi', 'pengumuman']) {
      const l = page.locator(`.adm-subnav__link[data-type="${t}"]`);
      if (!(await l.count())) continue;
      await l.click(); await page.waitForSelector('#kt-list tbody tr', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(300);
      await shot(page, `adm-konten-${t}-${vp}`, { el: '#sec-konten' });
      if (t === 'pustaka' || t === 'agenda') { await page.click('#kt-add'); await page.waitForSelector('.modal__dialog', { timeout: 6000 }); await page.waitForTimeout(400); await shot(page, `adm-dialog-konten-${t}-${vp}`); await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {}); }
    }
    // umpan balik: open one item
    await nav(page, 'umpan-balik');
    const ub = page.locator('#sec-umpan-balik .adm-act, #sec-umpan-balik [data-open]').first();
    if (await ub.count()) { await ub.scrollIntoViewIfNeeded(); await ub.click(); await page.waitForTimeout(600); await shot(page, `adm-umpan-balik-open-${vp}`); await page.keyboard.press('Escape'); }
    report(page, `admin ${vp}`);
    await page.close(); await ctx.close();
  });
}
// non-admin member visiting admin → redirect + flash toast
await safe('admin as member', async () => {
  const ctx = await makeCtx(browser, 'desktop', { auth: 'Aktif' });
  const page = await open(ctx, BASE, 'admin.html', { wait: 1200 });
  await shot(page, 'adm-as-member-redirect-desktop');
  await page.close(); await ctx.close();
});

await browser.close(); await close();
finish('review-admin');
