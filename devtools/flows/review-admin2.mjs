// review-admin2 — approve / revise / reject dialogs BEFORE confirming (fresh context each), + empty-note error states.
//   node flows/review-admin2.mjs      → shots/review-tampilan/adm-dialog-*.png
import { startServer, launch, makeCtx, open, shot, safe, finish } from './review-lib.mjs';

const { BASE, close } = await startServer();
const browser = await launch();
async function ready(page) { await page.waitForSelector('html[data-admin-ready]', { timeout: 20000 }); await page.waitForTimeout(300); }
async function nav(page, s) { await page.click(`.adm-nav__link[data-section="${s}"]`); await page.waitForFunction(x => { const e = document.getElementById('sec-' + x); return e && !e.hidden; }, s, { timeout: 8000 }); await page.waitForTimeout(350); }

for (const vp of ['desktop', 'mobile']) {
  for (const [act, id, okId] of [['approve', '#act-approve', '#dlg-approve-ok'], ['revise', '#act-revise', '#dlg-revise-ok'], ['reject', '#act-reject', '#dlg-reject-ok']]) {
    await safe(`${act} ${vp}`, async () => {
      const ctx = await makeCtx(browser, vp, { auth: 'admin' });
      const page = await open(ctx, BASE, 'admin.html#permohonan', { wait: 800 });
      await ready(page); await nav(page, 'permohonan');
      const openBtn = page.locator('#pq-list [data-open="member"].adm-act').first();
      await openBtn.scrollIntoViewIfNeeded(); await openBtn.click();
      await page.waitForSelector('.drawer__panel', { timeout: 6000 }); await page.waitForTimeout(400);
      const b = page.locator(id).first(); await b.scrollIntoViewIfNeeded(); await b.click();
      await page.waitForSelector('.modal__dialog', { timeout: 6000 }); await page.waitForTimeout(400);
      await shot(page, `adm-dialog-${act}-${vp}`);
      if (act !== 'approve') {
        await page.click(okId).catch(() => {}); await page.waitForTimeout(400);
        await shot(page, `adm-dialog-${act}-error-${vp}`, { el: '.modal__dialog' });
        if (act === 'revise') { const t = page.locator('.modal [data-template="0"]'); if (await t.count()) { await t.click(); await page.waitForTimeout(250); await shot(page, `adm-dialog-revise-template-${vp}`, { el: '.modal__dialog' }); } }
      }
      await page.close(); await ctx.close();
    });
  }
  // deactivate / extend / change-type dialogs on an active member
  await safe(`anggota dialogs ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'admin' });
    const page = await open(ctx, BASE, 'admin.html#anggota', { wait: 800 });
    await ready(page); await nav(page, 'anggota');
    await page.selectOption('#aq-status', 'Aktif').catch(() => {}); await page.waitForTimeout(400);
    const a1 = page.locator('#aq-list .adm-act').first(); await a1.scrollIntoViewIfNeeded(); await a1.click();
    await page.waitForSelector('.drawer__panel', { timeout: 6000 }); await page.waitForTimeout(400);
    for (const [act, id] of [['deactivate', '#act-deactivate'], ['extend', '#act-extend'], ['type', '#act-type']]) {
      const b = page.locator(id).first(); if (!(await b.count())) { console.log('  (no ' + id + ')'); continue; }
      await b.scrollIntoViewIfNeeded(); await b.click();
      await page.waitForSelector('.modal__dialog', { timeout: 6000 }); await page.waitForTimeout(400);
      await shot(page, `adm-dialog-${act}-${vp}`);
      await page.keyboard.press('Escape'); await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {}); await page.waitForTimeout(200);
    }
    await page.close(); await ctx.close();
  });
}
await browser.close(); await close();
finish('review-admin2');
