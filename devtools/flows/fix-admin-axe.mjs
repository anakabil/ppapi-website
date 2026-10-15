// Fixer "admin" — axe-core 4.10.2 (cdnjs; WCAG 2.2 A/AA + best practice) on the console states changed
// by the density / directory / kategori fixes: compact section heads, Permohonan inline toolbar (no Status
// column), Anggota with the phone filter disclosure (collapsed + expanded, active-filter count), paging
// ("Tampilkan … lainnya"), Umpan Balik icon actions, Ringkasan empty line, approve dialog with the kategori
// notice + attention field. Desktop 1440 and phone 390. Usage (cwd devtools/): node flows/fix-admin-axe.mjs
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
import { gen } from './fix-admin-probe.mjs';

const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
let AXE = '';
try { AXE = await (await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js')).text(); } catch (e) { console.log('axe-core tidak dapat diunduh — dilewati'); process.exit(0); }
const members = gen(120);
const renew = JSON.parse(JSON.stringify(members[0]));
Object.assign(renew, { uid: 'ax-renew', name: 'Uji Perpanjangan Ahli', email: 'ax-renew@contoh.id', status: 'Menunggu Verifikasi', memberType: 'Ahli', kta: 'PPAPI-2025-000990', approvedAt: '2025-06-01T02:00:00.000Z', validUntil: '2026-06-30', updatedAt: '2026-10-08T02:00:00.000Z' });
Object.assign(renew.application, { type: 'perpanjangan', kategori: 'Praktisi', submittedAt: '2026-10-08T02:00:00.000Z' });
members.push(renew);

const { BASE, close } = await startServer();
const browser = await chromium.launch();
let pass = 0, fail = 0;
for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, mobile: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  await ctx.addInitScript(({ a, ms }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true'); localStorage.setItem('ppapi_demo_session', JSON.stringify(a)); localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid])); for (const m of ms) localStorage.setItem('ppapi_member_' + m.uid, JSON.stringify(m)); } } catch (e) {} }, { a: ADMIN, ms: members });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(BASE + '/admin.html#ringkasan', { waitUntil: 'networkidle' });
  await page.waitForSelector('html[data-admin-ready]');
  await page.evaluate(() => PPAPI.store.submitFeedback({ kategori: 'Saran', nama: 'Penguji Aksesibilitas', email: 'a11y.penguji.panjang@perusahaan-contoh.co.id', subjek: 'Uji axe konsol', pesan: 'Pesan untuk pengujian aksesibilitas konsol admin.', rating: 4 }));
  await page.evaluate(async () => { await PPAPI_KONSOL.load('all'); PPAPI_KONSOL.renderCounts(); PPAPI_KONSOL.renderCurrent(); });
  const scan = async (label) => {
    await page.waitForTimeout(350);
    if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => {
      /* #site-header excluded only while scrolled (shared .brand target-size false positive while the header hides
         on scroll — same rule as flows/axe-v2-states.mjs) */
      const r = await axe.run(scrollY > 0 ? { exclude: [['#site-header']] } : document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
      return r.violations.filter(x => ['serious', 'critical', 'moderate'].includes(x.impact)).map(x => `${x.id} (${x.impact}) ×${x.nodes.length}: ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`);
    });
    v.length ? fail++ : pass++;
    console.log(`${v.length ? 'FAIL' : 'PASS'} ${vp.name} ${label}${v.length ? '  — ' + v.join(' ;; ') : ''}`);
  };
  const go = async (hash) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(400); };
  await scan('Ringkasan');
  await go('permohonan'); await scan('Permohonan (inline toolbar, no Status column)');
  await go('anggota'); await scan('Anggota (filters ' + (vp.mobile ? 'collapsed' : 'shown') + ')');
  if (vp.mobile) {
    await page.click('#aq-filter-toggle');
    await page.selectOption('#aq-status', 'Aktif');
    await scan('Anggota (filters expanded, 1 active)');
    await page.selectOption('#aq-status', '');
  }
  await page.click('#aq-more'); await scan('Anggota (after "Tampilkan lainnya")');
  await go('umpan-balik'); await scan('Umpan Balik (icon action)');
  await go('konten'); await scan('Konten (demo note ' + (vp.mobile ? 'shown' : 'hidden') + ')');
  await go('permohonan');
  await page.click('#pq-list .adm-act[data-id="ax-renew"]'); await page.waitForSelector('.drawer__panel');
  await scan('Drawer perpanjangan (kategori notice)');
  await page.click('#act-approve'); await page.waitForSelector('.modal [name="memberType"]');
  await scan('Approve dialog (attention field)');
  console.log(`${errs.length ? 'FAIL' : 'PASS'} ${vp.name} no console/page errors${errs.length ? '  — ' + errs.join(' | ') : ''}`);
  errs.length ? fail++ : pass++;
  await ctx.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); await close();
process.exit(fail ? 1 : 0);
