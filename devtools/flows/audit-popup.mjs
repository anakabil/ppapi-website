// Audit tampilan pop-up (modal & laci) di laptop dan ponsel: setiap pemicu yang aman diklik, lalu elemen di dalam
// dialog diperiksa — (1) terpotong: melewati tepi dialog/layar tanpa wadah gulir; (2) geser: wadah yang perlu
// digulir mendatar. Jalankan dari devtools/: node flows/audit-popup.mjs   (opsional: AUDIT_ONLY=admin,toko)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, seedSession, DEMO_ADMIN, DEMO_USER, demoMember } from './aplikasi-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'shots', 'audit-popup');
fs.mkdirSync(SHOTS, { recursive: true });
const ONLY = (process.env.AUDIT_ONLY || '').split(',').filter(Boolean);
const VIEWPORTS = { laptop: { width: 1280, height: 720 }, ponsel: { width: 375, height: 740 } };
const SKIP = /hapus|tolak|batal|keluar|nonaktif|unduh|cetak|kirim|simpan|setujui|tandai|impor|pilih foto|ganti|unggah|salin|perpanj|aktifkan|tetapkan|konfirmasi|ubah status|terbitkan|reset|bawaan|whatsapp|beli|tambah ke keranjang/i;
const { server, BASE } = await startServer();
const browser = await chromium.launch();
const temuan = [];

async function seed(page) {
  return page.evaluate(async () => {
    const K = PPAPI.kegiatan, T = PPAPI.toko, d = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const ev = await K.admin.save({ judul: 'Webinar: Collapse Prevention Through Temporary Platforms Using Structural Analysis', jenis: 'Webinar', mulaiTanggal: d(5), mulaiJam: '19:00', selesaiJam: '21:00', mode: 'Daring', link: 'https://zoom.us/j/1234567890', sertifikat: true, status: 'terbit', deskripsi: 'Pembahasan pencegahan runtuhnya perancah.\n\n- Analisis struktur\n- Studi kasus' });
    const names = ['Noni Widayanti', 'Muhammad Afiq Ihsan', 'Mohamad Reza Huzain', 'Nia Nurhayati Asman', 'Rizky Febrian Aulia', 'Angga Trilaksono Putro', 'Bagus Prasetyo Wicaksono Adiningrat'];
    const map = {}; names.forEach((n, i) => { map['u' + i] = { nama: n, email: n.toLowerCase().replace(/[^a-z]+/g, '.') + '@gmail.com', kta: i === 5 ? 'PPAPI-2026-000004' : '', statusAnggota: ['Menunggu Verifikasi', 'Draf', 'Draf', 'Draf', 'Draf', 'Aktif', 'Draf'][i], at: Date.now() - i * 60000 }; });
    localStorage.setItem('ppapi_event_participants_' + ev.id, JSON.stringify(map));
    await T.admin.saveProduct({ nama: 'Kaos PPAPI Rise Up Edisi Panjang Sekali Untuk Menguji Tampilan', kategori: 'Pakaian', kode: 'KAOS_005', ringkasan: 'Kaos hitam katun combed 30s, sablon rubber.', deskripsi: 'Spesifikasi\n- Bahan: katun combed 30s\n- Ukuran: S, M, L, XL, XXL', harga: 120000, berat: 200, varian: [{ nama: 'Ukuran', opsi: ['S', 'M', 'L', 'XL', 'XXL +5000'] }], stok: 50 }, { foto: [] });
    await T.admin.saveProduct({ nama: 'Pedoman Praktik Perancah PPAPI-CoP-01:2026 (Seri Lengkap 8 Bagian, Dwibahasa)', kategori: 'Produk Pengetahuan', kode: 'PPAPI-CoP-01:2026', ringkasan: 'Seri lengkap CoP.', deskripsi: 'Isi seri\n1. Bagian 1\n2. Bagian 2', harga: 150000, format: { soft: true, cetak: true }, hargaCetak: 200000, berat: 600 }, { foto: [] });
    await T.saveSettings ? null : null;
    await T.admin.saveSettings({ rekening: [{ bank: 'Bank Mandiri', nomor: '1234567890123', atasNama: 'Perkumpulan Praktisi dan Ahli Perancah Indonesia' }] });
    const c = T.cart; await c.clear();
    const ps = await T.listProducts();
    await c.add({ productId: ps[0].id, format: ps[0].kategori === 'Pakaian' ? 'fisik' : 'soft', varian: ps[0].kategori === 'Pakaian' ? { Ukuran: 'XXL' } : {}, qty: 2 });
    await c.add({ productId: ps[1].id, format: ps[1].kategori === 'Pakaian' ? 'fisik' : 'soft', varian: ps[1].kategori === 'Pakaian' ? { Ukuran: 'L' } : {}, qty: 1 });
    const o = await T.createOrder({ alamat: { nama: 'Budi Santoso Wicaksono', telepon: '081234567890', alamat: 'Jl. Melati Raya No. 5, RT 01/RW 02, Kelurahan Sukajadi, Kecamatan Sukasari', kota: 'Kota Bandung', provinsi: 'Jawa Barat', kodePos: '40162', catatan: '' }, ongkir: { kurir: 'JNE', layanan: 'REG', ongkir: 12000 } });
    return { ev: ev.id, order: o.id };
  });
}

async function auditDialogs(page, label) {
  const res = await page.evaluate(() => {
    const out = [], vw = document.documentElement.clientWidth;
    const dialogs = [...document.querySelectorAll('.modal__dialog, .drawer__panel, .modal [role=dialog], .drawer [role=dialog]')].filter(d => { const r = d.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    const uniq = [...new Set(dialogs)];
    const desc = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"');
    uniq.forEach(dlg => {
      const dr = dlg.getBoundingClientRect();
      const title = (dlg.querySelector('.modal__title, .drawer__title') || {}).textContent || '';
      if (dr.left < -1 || dr.right > vw + 1) out.push({ jenis: 'dialog-melebihi-layar', dialog: title.trim(), el: desc(dlg), lebar: Math.round(dr.width), layar: vw });
      dlg.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width < 3 || r.height < 3) return;
        if (cs.position === 'fixed') return;
        // wadah gulir mendatar
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 40) {
          out.push({ jenis: 'perlu-geser', dialog: title.trim(), el: desc(el), lebar: el.clientWidth, isi: el.scrollWidth });
          return;
        }
        // terpotong: melewati tepi kanan/kiri dialog, dan tidak berada di wadah gulir
        if (r.right > dr.right + 1 || r.left < dr.left - 1) {
          let p = el.parentElement, inScroll = false;
          while (p && p !== dlg) { const pc = getComputedStyle(p); if (pc.overflowX === 'auto' || pc.overflowX === 'scroll') { inScroll = true; break; } p = p.parentElement; }
          if (!inScroll && !el.closest('.sr-only')) out.push({ jenis: 'terpotong', dialog: title.trim(), el: desc(el), kanan: Math.round(r.right), batas: Math.round(dr.right) });
        }
      });
    });
    return { n: uniq.length, out };
  });
  if (res.out.length) {
    // ringkas: satu temuan per (jenis, dialog, elemen teratas)
    const seen = new Set();
    res.out.forEach(t => { const k = t.jenis + '|' + t.dialog + '|' + t.el.split(' "')[0]; if (!seen.has(k)) { seen.add(k); temuan.push({ label, ...t }); } });
    await page.screenshot({ path: path.join(SHOTS, label.replace(/[^a-z0-9]+/gi, '-').slice(0, 80) + '.png') });
  }
  return res.n;
}

async function closeAll(page) {
  for (let i = 0; i < 4; i++) { if (!(await page.locator('.modal, .drawer').count())) break; await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
}

async function crawl(page, vp, pageName, triggers, extra) {
  for (const sel of triggers) {
    const n = Math.min(await page.locator(sel).count(), 3);
    for (let i = 0; i < n; i++) {
      const t = page.locator(sel).nth(i);
      if (!(await t.isVisible().catch(() => false))) continue;
      const txt = ((await t.textContent().catch(() => '')) || '').trim().replace(/\s+/g, ' ');
      if (SKIP.test(txt) && !/kelola|lihat|detail|ubah|tambah produk|tambah kegiatan|penanda|ringkasan pdf|tambahkan ke kalender/i.test(txt)) continue;
      await t.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      const open = await auditDialogs(page, `${vp} ${pageName} ${sel} [${txt.slice(0, 30)}]`);
      if (open && extra) await extra(page, vp, pageName, txt);
      await closeAll(page);
    }
  }
}

for (const [vp, size] of Object.entries(VIEWPORTS)) {
  const ctx = await browser.newContext({ viewport: size, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await seedSession(ctx, { user: DEMO_ADMIN, admin: true });
  const m = demoMember(DEMO_USER, 'Menunggu Verifikasi');
  await ctx.addInitScript(([uid, rec]) => { if (!localStorage.getItem('ppapi_member_' + uid)) localStorage.setItem('ppapi_member_' + uid, JSON.stringify(rec)); }, [DEMO_USER.uid, m]);
  const page = await ctx.newPage();
  await page.goto(BASE + '/admin.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  const ids = await seed(page);

  // ---- ADMIN: tiap bagian konsol
  if (!ONLY.length || ONLY.includes('admin')) {
    const sections = await page.$$eval('[data-admin-nav], .adm-nav a, nav a[href^="#"]', as => [...new Set(as.map(a => (a.getAttribute('href') || '').replace(/^.*#/, '')).filter(Boolean))]);
    for (const s of sections) {
      await page.goto(BASE + '/admin.html#' + s, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
      await crawl(page, vp, 'admin#' + s, ['[data-kga="manage"]', '[data-kga="new"]', '[data-kga="signer"]', '[data-open]', '[data-order]', '[data-edit]', '[data-atk="new"]', '[data-atk="ringkasan"]', '[data-action^="open"]', '[data-action^="edit"]', '[data-action^="add"]', '[data-action="new"]', 'button[data-id]'],
        async (pg, v, pn, txt) => {
          // laci kelola kegiatan: buka setiap tab
          const tabs = await pg.locator('.drawer [role=tab], .modal [role=tab]').count();
          for (let i = 0; i < tabs; i++) { const tb = pg.locator('.drawer [role=tab], .modal [role=tab]').nth(i); const tt = (await tb.textContent()).trim(); await tb.click().catch(() => {}); await pg.waitForTimeout(600); await auditDialogs(pg, `${v} ${pn} [${txt.slice(0, 20)}] tab ${tt}`); }
        });
      // tab di dalam bagian (mis. toko: pesanan/produk/pengaturan)
      const inner = await page.locator('[data-atk-tab]').count();
      for (let i = 0; i < inner; i++) {
        await page.locator('[data-atk-tab]').nth(i).click().catch(() => {}); await page.waitForTimeout(700);
        await crawl(page, vp, 'admin#' + s + ' tab' + i, ['[data-order]', '[data-edit]', '[data-atk="new"]', '[data-atk="ringkasan"]']);
      }
    }
  }
  // ---- SEMUA HALAMAN: luapan mendatar di tingkat halaman
  if (!ONLY.length || ONLY.includes('halaman')) {
    const files = fs.readdirSync(path.resolve(__dirname, '..', '..', 'site')).filter(f => f.endsWith('.html'));
    const sub = fs.readdirSync(path.resolve(__dirname, '..', '..', 'site', 'aplikasi')).filter(f => f.endsWith('.html')).map(f => 'aplikasi/' + f);
    for (const f of [...files, ...sub, 'pesanan.html?id=' + ids.order]) {
      await page.goto(BASE + '/' + f, { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(900);
      const r = await page.evaluate(() => {
        const out = [], vw = document.documentElement.clientWidth;
        if (document.documentElement.scrollWidth > vw + 1) out.push({ jenis: 'halaman-melebar', el: 'html', isi: document.documentElement.scrollWidth, lebar: vw });
        const desc = (el) => (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + ' "' + (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40) + '"');
        document.querySelectorAll('main *').forEach(el => {
          const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
          if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 40 && !el.matches('.tabs__list, [data-allow-scroll], pre, code')) out.push({ jenis: 'perlu-geser', el: desc(el), isi: el.scrollWidth, lebar: el.clientWidth });
          const rr = el.getBoundingClientRect(); if (rr.width < 3) return;
          if (rr.right > vw + 1 || rr.left < -1) {
            let q = el.parentElement, clip = false; while (q && q !== document.body) { const qc = getComputedStyle(q); if (qc.overflowX !== 'visible') { clip = true; break; } q = q.parentElement; }
            if (!clip) out.push({ jenis: 'terpotong', el: desc(el), kanan: Math.round(rr.right), batas: vw });
          }
        });
        return out;
      });
      const seen = new Set();
      r.forEach(t => { const k = t.jenis + t.el.split(' "')[0]; if (!seen.has(k) && seen.size < 6) { seen.add(k); temuan.push({ label: `${vp} ${f}`, dialog: '', ...t }); } });
      if (r.length) await page.screenshot({ path: path.join(SHOTS, (vp + '-' + f).replace(/[^a-z0-9]+/gi, '-') + '.png'), fullPage: false });
    }
  }
  // ---- PUBLIK & ANGGOTA
  if (!ONLY.length || ONLY.includes('publik')) {
    const pages = [
      ['toko.html', ['.tk-card__title button']],
      ['toko.html?produk=' + 'x', []],
      ['keranjang.html', []],
      ['pesanan.html', []],
      ['pesanan.html?id=' + ids.order, ['[data-ps="invoice"] ~ x', '[data-ps-lihat]']],
      ['agenda.html', ['[data-agenda-open]', '[data-agenda-ics]']],
      ['dashboard.html', ['[data-kg]', '[data-action]']],
      ['anggota.html', ['[data-action^="edit"]', '[data-action^="add"]']],
      ['pendaftaran.html', ['[data-action^="add"]', '[data-action^="edit"]']],
      ['instruktur.html', ['[data-open]', '.ins-card button']],
      ['berita.html', ['[data-open]', 'article button']],
    ];
    for (const [url, trig] of pages) {
      await page.goto(BASE + '/' + url, { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(1000);
      await auditDialogs(page, `${vp} ${url} (awal)`);
      await crawl(page, vp, url, trig, async (pg, v, pn, txt) => {
        // pilihan kalender dari modal agenda
        const ics = pg.locator('.modal [data-agenda-ics]');
        if (await ics.count()) { await ics.first().click().catch(() => {}); await pg.waitForTimeout(600); await auditDialogs(pg, `${v} ${pn} kalender`); }
      });
    }
  }
  await ctx.close();
}
await browser.close(); server.close();
const out = path.join(SHOTS, 'temuan.json');
fs.writeFileSync(out, JSON.stringify(temuan, null, 1));
console.log(temuan.length ? temuan.map(t => `${t.jenis.padEnd(20)} ${t.label}\n    ${t.dialog} :: ${t.el} ${t.kanan ? '(kanan ' + t.kanan + ' > ' + t.batas + ')' : ''}${t.isi ? '(isi ' + t.isi + ' > ' + t.lebar + ')' : ''}${t.layar ? '(' + t.lebar + ' > layar ' + t.layar + ')' : ''}`).join('\n') : 'Tidak ada temuan.');
console.log('\n' + temuan.length + ' temuan');
