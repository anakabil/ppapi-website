// End-to-end on the LIVE site in Firebase mode: register (email) → dashboard Draf → autosave step 1 of the wizard →
// reload persists → sign out → sign in → dashboard. Creates ONE real test account (reported) that the client can delete.
import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const stamp = String(Date.now()).slice(-6);
const EMAIL = `uji-situs-ppapi-${stamp}@example.com`, PASS = 'UjiSitus2026x', NAME = 'Akun Uji Situs';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage(); const issues = [];
page.on('pageerror', e => issues.push('pageerror ' + e.message));
page.on('console', m => { if (m.type() === 'error') issues.push('console ' + m.text().slice(0, 160)); });
const log = (...a) => console.log(...a);
await page.goto(BASE + 'masuk.html#daftar', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const daftar = page.locator('[role=tab]', { hasText: /daftar/i }).first(); if (await daftar.count()) await daftar.click();
await page.waitForTimeout(300);
await page.fill('#d-name', NAME); await page.fill('#d-email', EMAIL); await page.fill('#d-pass', PASS); await page.fill('#d-pass2', PASS);
await page.setChecked('#d-agree', true, { force: true });
await page.locator('#d-pass2').press('Enter');
await page.waitForURL(/pendaftaran\.html|dashboard\.html/, { timeout: 30000 }).catch(() => {});
log('after sign-up →', page.url().replace(BASE, '/'));
const err = await page.locator('.alert--err:visible').first().textContent().catch(() => null); if (err) log('  ! alert:', err.trim().slice(0, 200));
// wizard step 1: pick a category (autosave) if we are on pendaftaran
if (/pendaftaran/.test(page.url())) {
  await page.waitForTimeout(1500);
  const kat = page.locator('input[name=kategori], input[type=radio]').first(); if (await kat.count()) { await kat.check({ force: true }); await page.waitForTimeout(2500); }
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const checked = await page.locator('input[type=radio]:checked').count();
  log('autosave persisted after reload:', checked > 0 ? 'yes' : 'no');
}
await page.goto(BASE + 'dashboard.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
const st = await page.evaluate(() => { const s = PPAPI.session.current(); return { mode: PPAPI.auth.mode, status: s && s.status, name: s && s.user && s.user.name, uid: s && s.user && s.user.uid }; });
log('dashboard session:', JSON.stringify(st));
await page.evaluate(() => PPAPI.auth.signOut()); await page.waitForTimeout(1500);
await page.goto(BASE + 'masuk.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
await page.fill('#m-email, input[type=email]:visible', EMAIL); await page.fill('#m-pass, input[type=password]:visible', PASS); await page.locator('input[type=password]:visible').first().press('Enter');
await page.waitForURL(/dashboard\.html|pendaftaran\.html/, { timeout: 30000 }).catch(() => {});
log('after sign-in →', page.url().replace(BASE, '/'));
log(issues.length ? '  ! ' + issues.join('\n  ! ') : 'no console/page errors');
log('TEST ACCOUNT:', EMAIL, 'uid:', st.uid);
await b.close();
