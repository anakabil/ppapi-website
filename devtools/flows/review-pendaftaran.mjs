// review-pendaftaran — wizard steps 1–7 + review, submitted, Perlu Perbaikan, Ditolak, Aktif, perpanjangan.
//   node flows/review-pendaftaran.mjs      → shots/review-tampilan/daf-*.png
import { startServer, launch, makeCtx, open, shot, overflow, safe, report, finish, withStatus } from './review-lib.mjs';

const { BASE, close } = await startServer();
const browser = await launch();
const KEYS = ['kategori', 'data-diri', 'profesional', 'kompetensi', 'dokumen', 'pernyataan', 'tinjau'];

async function ready(page) {
  await page.waitForFunction(() => { const r = document.getElementById('daf-root'); return r && r.getAttribute('aria-busy') !== 'true'; }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
}
async function goStep(page, i) {
  const b = page.locator(`[data-step="${i}"]`).first();
  await b.scrollIntoViewIfNeeded().catch(() => {});
  await b.click(); await page.waitForTimeout(450);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(150);
}

/* fresh Draf: a brand-new account with an empty application (what a new visitor sees) */
function freshDraf() {
  const m = withStatus('Draf');
  m.profile = { city: '', province: '', company: '', position: '', experienceYears: '', education: '', bio: '' };
  m.competencies = []; m.certificates = [];
  m.application = { type: 'baru', kategori: '', submittedAt: '', updatedAt: '', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' }, catatan: '' };
  return m;
}

for (const vp of ['desktop', 'mobile', 'laptop', 'tablet']) {
  console.log(`\n[${vp}]`);
  await safe(`wizard fresh ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'Draf', member: freshDraf() });
    const page = await open(ctx, BASE, 'pendaftaran.html', { wait: 800 });
    await ready(page);
    const steps = vp === 'desktop' || vp === 'mobile' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 3, 6];
    for (const i of steps) {
      await goStep(page, i);
      if (i === 0) await shot(page, `daf-step${i + 1}-${KEYS[i]}-${vp}-fold`);
      await shot(page, `daf-step${i + 1}-${KEYS[i]}-${vp}-full`, { full: true, scroll: true });
      const ov = await overflow(page); if (ov > 1) console.log(`  ! step ${i + 1} ${vp}: overflow ${ov}px`);
    }
    if (vp === 'desktop' || vp === 'mobile') {
      // validation errors on step 2
      await goStep(page, 1);
      await page.click('.daf-foot__next'); await page.waitForTimeout(500);
      await page.evaluate(() => scrollTo(0, 0));
      await shot(page, `daf-step2-errors-${vp}-full`, { full: true });
      // repeater rows on step 3 + modal on step 4
      await goStep(page, 2);
      await page.click('[data-action="peng-add"]'); await page.waitForTimeout(300);
      await shot(page, `daf-step3-repeater-${vp}`, { el: '.daf-panel' });
      await goStep(page, 3);
      await page.click('[data-action="komp-add"]'); await page.waitForSelector('#mk-kode', { timeout: 5000 }); await page.waitForTimeout(400);
      await shot(page, `daf-step4-modal-${vp}`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      await goStep(page, 4);
      await page.click('[data-action="dok-add"]'); await page.waitForTimeout(300);
      await shot(page, `daf-step5-dokrow-${vp}`, { el: '.daf-panel' });
      await goStep(page, 6);
      await page.click('.daf-foot__next'); await page.waitForTimeout(600);
      await page.evaluate(() => scrollTo(0, 0));
      await shot(page, `daf-review-incomplete-${vp}-full`, { full: true });
    }
    report(page, `wizard fresh ${vp}`);
    await page.close(); await ctx.close();
  });
  // partially filled Draf fixture (has profile + competencies): review step with data
  if (vp === 'desktop' || vp === 'mobile') await safe(`wizard filled review ${vp}`, async () => {
    const m = withStatus('Draf');
    m.application.pengalaman = [{ id: 'p1', proyek: 'Perancah fasad gedung kantor 18 lantai', peran: 'Supervisor perancah', tahun: '2023–2024', lokasi: 'Balikpapan' }];
    m.application.dokumen = [{ id: 'd1', jenis: 'cv', label: 'CV terbaru 2026', url: 'https://drive.google.com/file/d/cv-budi/view' }];
    m.application.pembayaran = { metode: 'transfer', tanggal: '2026-10-05', buktiUrl: 'https://drive.google.com/file/d/bukti/view' };
    m.profile = Object.assign(m.profile, { birthPlace: 'Samarinda', birthDate: '1990-05-17', gender: 'Laki-laki', address: 'Jl. Contoh No. 1' });
    const ctx = await makeCtx(browser, vp, { auth: 'Draf', member: m });
    const page = await open(ctx, BASE, 'pendaftaran.html', { wait: 800 });
    await ready(page);
    await goStep(page, 2);
    await shot(page, `daf-step3-filled-${vp}-full`, { full: true, scroll: true });
    await goStep(page, 3);
    await shot(page, `daf-step4-filled-${vp}-full`, { full: true, scroll: true });
    await goStep(page, 6);
    await shot(page, `daf-review-filled-${vp}-full`, { full: true, scroll: true });
    await page.close(); await ctx.close();
  });
  // status views
  for (const st of ['Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak', 'Aktif', 'Kedaluwarsa', 'Nonaktif']) {
    if (!(vp === 'desktop' || vp === 'mobile') && st !== 'Perlu Perbaikan') continue;
    await safe(`status ${st} ${vp}`, async () => {
      const ctx = await makeCtx(browser, vp, { auth: st });
      const page = await open(ctx, BASE, 'pendaftaran.html' + (st === 'Kedaluwarsa' ? '#perpanjangan' : ''), { wait: 800 });
      await ready(page);
      await shot(page, `daf-status-${st.toLowerCase().replace(/\s+/g, '-')}-${vp}-full`, { full: true, scroll: true });
      if (st === 'Aktif') {
        const b = page.locator('[data-action="start-renew"]');
        if (await b.count() && await b.isVisible()) { await b.click(); await page.waitForTimeout(400); await shot(page, `daf-status-aktif-renew-${vp}`, { el: '.daf-notices' }); }
      }
      if (st === 'Menunggu Verifikasi') {
        const w = page.locator('[data-action="withdraw"]').first();
        if (await w.count()) { await w.scrollIntoViewIfNeeded(); await w.click(); await page.waitForSelector('.modal', { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400); await shot(page, `daf-status-withdraw-confirm-${vp}`); await page.keyboard.press('Escape'); }
      }
      report(page, `status ${st} ${vp}`);
      await page.close(); await ctx.close();
    });
  }
  // perpanjangan (Kedaluwarsa) — the renewal wizard: step 1 and the review step
  if (vp === 'desktop' || vp === 'mobile') await safe(`perpanjangan ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'Kedaluwarsa' });
    const page = await open(ctx, BASE, 'pendaftaran.html', { wait: 800 });
    await ready(page);
    await shot(page, `daf-perpanjangan-${vp}-fold`);
    await goStep(page, 5);
    await shot(page, `daf-perpanjangan-pernyataan-${vp}-full`, { full: true, scroll: true });
    await goStep(page, 6);
    await shot(page, `daf-perpanjangan-review-${vp}-full`, { full: true, scroll: true });
    await page.close(); await ctx.close();
  });
  // signed out → masuk?next=
  if (vp === 'desktop') await safe('signed out', async () => {
    const ctx = await makeCtx(browser, vp);
    const page = await open(ctx, BASE, 'pendaftaran.html', { wait: 800 });
    await shot(page, `daf-signedout-${vp}-fold`);
    await page.close(); await ctx.close();
  });
}

await browser.close(); await close();
finish('review-pendaftaran');
