// probe: does "Lupa kata sandi?" open its modal? (fresh page, and after a duplicate sign-up attempt)
import { startServer, launch, newContext, watch, open } from './review-fungsi-lib.mjs';
const srv = await startServer(); const BASE = srv.BASE; const browser = await launch();
const ctx = await newContext(browser, { vp: 'desktop' }); const page = await ctx.newPage(); const issues = watch(page);
page.on('console', m => console.log('console:', m.type(), m.text().slice(0, 200)));
await open(page, `${BASE}/masuk.html`);
await page.fill('#m-email', 'bukan-email');
await page.click('[data-forgot]'); await page.waitForTimeout(500);
console.log('A fresh:', await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), title: window.__rv.txt('.modal__title'), prefill: document.getElementById('fp-email')?.value })));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.fill('#m-email', 'valid@contoh.id');
await page.click('[data-forgot]'); await page.waitForTimeout(500);
console.log('B valid prefill:', await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), prefill: document.getElementById('fp-email')?.value })));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
// after switching tabs daftar → masuk via the in-panel link
await page.click('[data-switch="daftar"]'); await page.waitForTimeout(300);
await page.click('[data-switch="masuk"]'); await page.waitForTimeout(300);
await page.click('[data-forgot]'); await page.waitForTimeout(500);
console.log('C after tab switch:', await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), hash: location.hash })));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
// after a duplicate sign-up attempt (alert with Masuk button)
await page.click('[data-switch="daftar"]'); await page.waitForTimeout(200);
await page.fill('#d-name', 'Dup'); await page.fill('#d-email', 'dup@contoh.id'); await page.fill('#d-pass', 'Perancah2026!'); await page.fill('#d-pass2', 'Perancah2026!'); await page.check('#d-agree');
await page.click('[data-form="daftar-email"] button[type="submit"]'); await page.waitForURL(/pendaftaran/, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(500);
console.log('signed up ->', page.url().replace(BASE, ''));
await open(page, `${BASE}/index.html`); await page.click('.account__trigger'); await page.waitForTimeout(150); await page.click('#account-menu [data-signout]'); await page.waitForTimeout(600);
await open(page, `${BASE}/masuk.html#daftar`);
await page.fill('#d-name', 'Dup2'); await page.fill('#d-email', 'dup@contoh.id'); await page.fill('#d-pass', 'Perancah2026!'); await page.fill('#d-pass2', 'Perancah2026!'); await page.check('#d-agree');
await page.click('[data-form="daftar-email"] button[type="submit"]'); await page.waitForTimeout(900);
console.log('dup alert:', await page.evaluate(() => window.__rv.txt('#panel-daftar [data-alert]')));
await page.click('[data-switch="masuk"]'); await page.waitForTimeout(300);
console.log('tab now:', await page.evaluate(() => ({ masukSel: document.getElementById('tab-masuk').getAttribute('aria-selected'), masukVisible: window.__rv.vis(document.getElementById('panel-masuk')), forgotVis: window.__rv.vis(document.querySelector('[data-forgot]')), hash: location.hash })));
await page.fill('#m-email', 'bukan-email');
await page.click('[data-forgot]'); await page.waitForTimeout(600);
console.log('D after dup+switch:', await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), modals: document.querySelectorAll('.modal').length, html: document.body.className })));
console.log('issues:', issues);
await browser.close(); await srv.close();
