// appdata-flow — "data aplikasi melekat ke akun" (2026-10-21), Mode Demo.
// usage (cwd devtools): node flows/appdata-flow.mjs [--no-net]
//   A planning app: create an inspection → autosave to the account → reload → still there; second browser context of
//     the same account opens it; last-write-wins conflict keeps this device's version as a copy; rename, duplicate,
//     delete (UI); file too large for the account stays local with a warning; "Mulai Proyek Baru"; mobile layout.
//   B one-time migration of existing localStorage data: asked first (nothing sent before consent), "Nanti saja",
//     "Simpan ke akun".
//   C simulator: progress saved to the account and resumed in another browser context.
//   D axe-core on Proyek Saya (needs cdnjs; skipped with --no-net) + no console errors.
// In Mode Demo the "account" is the localStorage area 'ppapi_appdata/<uid>/…' (store-apps.js). A second browser
// context starts EMPTY and receives only those account keys — exactly what Firestore would hold — never the
// working copy (ppapi_app_perencanaan_v1_…). The Firebase path itself is covered by flows/appdata-firebase-stub.mjs.
import { startServer, launch, newContext, seedSession, watch, recorder, shot, DEMO_USER, DEMO_USER_B } from './aplikasi-lib.mjs';

const NET = !process.argv.includes('--no-net');
const T = recorder('appdata-flow');
const { server, BASE } = await startServer();
const browser = await launch();
const PR = `${BASE}/aplikasi/perencanaan/index.html`;
const SIM = `${BASE}/aplikasi/simulator/index.html`;
const UID = DEMO_USER.uid;
const KEY = 'ppapi_app_perencanaan_v1_u_' + UID;
const gateOk = (page) => page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const savedInd = (page) => txt(page, '#saved-ind');
const waitSaved = (page, t = 15000) => page.waitForFunction(() => /^Tersimpan ke akun · \d{2}\.\d{2}$/.test(document.getElementById('saved-ind').textContent.trim()), null, { timeout: t });
const noIssues = (label, issues) => T.ok(issues.length === 0, `${label}: no console errors / page errors / failed requests`, issues.slice(0, 4));
async function setVal(page, id, v) {
  await page.evaluate(({ id, v }) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, { id, v });
}
/* account store (Mode Demo) */
const accountKeys = (page, uid = UID) => page.evaluate((u) => Object.keys(localStorage).filter(k => k.indexOf('ppapi_appdata/' + u + '/') === 0).sort(), uid);
const exportAccount = (page, uid = UID) => page.evaluate((u) => { const o = {}; Object.keys(localStorage).forEach(k => { if (k.indexOf('ppapi_appdata/' + u + '/') === 0) o[k] = localStorage.getItem(k); }); return o; }, uid);
const importAccount = (page, data, uid = UID) => page.evaluate(({ d, u }) => { Object.keys(localStorage).forEach(k => { if (k.indexOf('ppapi_appdata/' + u + '/') === 0) localStorage.removeItem(k); }); Object.keys(d).forEach(k => localStorage.setItem(k, d[k])); }, { d: data, u: uid });
const mainDocs = (page) => page.evaluate((u) => Object.keys(localStorage).filter(k => k.indexOf('ppapi_appdata/' + u + '/perencanaan/') === 0).map(k => ({ id: k.split('/').pop(), ...JSON.parse(localStorage.getItem(k)) })), UID);
const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const issuesAll = [];
let accountAfterA = null;

/* ======================================================================
   A. planning app
   ====================================================================== */
{
  T.section('A1 new inspection → autosave to the account');
  const ctx = await newContext(browser, 'desktop');
  await seedSession(ctx, { user: DEMO_USER });
  const page = await ctx.newPage();
  const issues = watch(page); issuesAll.push(['A device 1', issues]);
  await page.goto(PR, { waitUntil: 'networkidle' });
  await gateOk(page);
  await page.evaluate(() => go('proyek'));
  await page.waitForFunction(() => !/Memuat proyek/.test(document.getElementById('proj-list').textContent));
  T.ok(/Belum ada proyek di akun Anda/.test(await txt(page, '#proj-list')) && (await accountKeys(page)).length === 0, 'fresh account: "Belum ada proyek di akun Anda", nothing stored');
  T.ok(/Proyek Saya/.test(await txt(page, '#proyek-saya h2')), 'Data Proyek has the "Proyek Saya" card');
  await setVal(page, 'f-proyek', 'Inspeksi Tangki T-101');
  await setVal(page, 'f-lokasi', 'Area Utilitas, Plant 2');
  await setVal(page, 'f-tag', 'SC-2026-014');
  await setVal(page, 'f-tanggal', '2026-10-20');
  await page.evaluate(({ JPEG, PNG }) => {
    state.answers['0-0'] = 'ok'; state.answers['0-1'] = 'no'; save();
    state.photos['0-1'] = JPEG; savePhotos();
    state.plans = [{ name: 'denah.png', type: 'image/png', data: PNG, ts: 11 }]; savePlans();
    go('gambar'); dwgAdd('pipe', 5, 45, { len: 2 }); go('proyek');
  }, { JPEG, PNG });
  const t0 = Date.now();
  await waitSaved(page);
  const waited = Date.now() - t0;
  const keys = await accountKeys(page);
  const docs = await mainDocs(page);
  const d0 = docs[0] ? JSON.parse(docs[0].data) : {};
  T.ok(docs.length === 1 && keys.filter(k => /perencanaan_media/.test(k)).length === 2, 'account: 1 project document + 2 media documents (photo, upload)', keys);
  T.ok(docs[0] && docs[0].meta.name === 'Inspeksi Tangki T-101' && docs[0].meta.lokasi === 'Area Utilitas, Plant 2' && docs[0].meta.tanggal === '2026-10-20' && docs[0].meta.status === 'BELUM LENGKAP', 'project meta: name, location, inspection date, verdict', docs[0] && docs[0].meta);
  T.ok(d0.answers && d0.answers['0-1'] === 'no' && d0.fields['f-tag'] === 'SC-2026-014' && d0.dwg && d0.dwg.depan.length === 1 && /__ph_0-1_/.test(d0.photos['0-1']) && d0.plans[0].mid, 'project document: fields, answers, drawing; photo/upload referenced by media id', { photos: d0.photos, plans: d0.plans });
  T.ok(waited < 8000, `debounced autosave (≈2,5 s after the last change; waited ${waited} ms)`);
  T.ok(/^Tersimpan ke akun · \d{2}\.\d{2}$/.test(await savedInd(page)), 'menu band: "Tersimpan ke akun · HH.MM"', await savedInd(page));
  await page.waitForFunction(() => /Inspeksi Tangki T-101/.test(document.getElementById('proj-list').textContent));
  const row = await txt(page, '#proj-list .proj-item');
  T.ok(/Inspeksi Tangki T-101 · SC-2026-014/.test(row) && /Area Utilitas, Plant 2/.test(row) && /Inspeksi 20 Okt 2026/.test(row) && /Sedang dibuka/.test(row) && /BELUM LENGKAP/.test(row), 'Proyek Saya row: name · tag, location, inspection date, "Sedang dibuka", verdict', row);
  await shot(page, 'appdata-proyek-saya-desktop', { fullPage: false });

  T.section('A2 reload → still there');
  await page.reload({ waitUntil: 'networkidle' });
  await gateOk(page);
  await page.evaluate(() => go('proyek'));
  await page.waitForFunction(() => document.querySelector('#proj-list .proj-item'));
  const r = await page.evaluate(() => ({ proj: document.getElementById('f-proyek').value, ans: state.answers['0-1'], photo: !!state.photos['0-1'], plans: state.plans.length, dwg: DWG.depan.length, saved: document.getElementById('saved-ind').textContent.trim(), list: document.getElementById('proj-list').textContent }));
  T.ok(r.proj === 'Inspeksi Tangki T-101' && r.ans === 'no' && r.photo && r.plans === 1 && r.dwg === 1, 'after reload: fields, answers, photo, upload and drawing are there', r);
  T.ok(/^Tersimpan ke akun · \d{2}\.\d{2}$/.test(r.saved) && /Sedang dibuka/.test(r.list), 'after reload: "Tersimpan ke akun", project still open', r.saved);
  accountAfterA = await exportAccount(page);

  T.section('A3 second browser context, same account (only the account store is shared)');
  const ctx2 = await newContext(browser, 'desktop');
  await seedSession(ctx2, { user: DEMO_USER });
  const p2 = await ctx2.newPage();
  const issues2 = watch(p2); issuesAll.push(['A device 2', issues2]);
  await p2.goto(PR, { waitUntil: 'networkidle' });
  await importAccount(p2, accountAfterA);
  await p2.reload({ waitUntil: 'networkidle' });
  await gateOk(p2);
  await p2.evaluate(() => go('proyek'));
  await p2.waitForFunction(() => /Inspeksi Tangki T-101/.test(document.getElementById('proj-list').textContent));
  const e2 = await p2.evaluate((K) => ({ proj: document.getElementById('f-proyek').value, work: localStorage.getItem(K + '_photos') }), KEY);
  T.ok(e2.proj === '' && !e2.work, 'device 2: empty screen, no working copy; project listed in Proyek Saya', e2);
  await p2.click('#proj-list .proj-item button:has-text("Buka")');
  await p2.waitForFunction(() => document.getElementById('f-proyek').value === 'Inspeksi Tangki T-101');
  const o2 = await p2.evaluate(() => ({ lok: document.getElementById('f-lokasi').value, ans: [state.answers['0-0'], state.answers['0-1']], photo: state.photos['0-1'] === undefined ? '' : state.photos['0-1'].slice(0, 22), plan: (state.plans[0] || {}).name, dwg: DWG.depan.length, list: document.getElementById('proj-list').textContent, toast: (document.querySelector('.toast-region') || document.body).textContent }));
  T.ok(o2.lok === 'Area Utilitas, Plant 2' && o2.ans.join() === 'ok,no' && o2.photo === 'data:image/jpeg;base64' && o2.plan === 'denah.png' && o2.dwg === 1, 'device 2 "Buka": fields, answers, photo, upload and drawing restored', o2);
  T.ok(/Sedang dibuka/.test(o2.list) && /dibuka/.test(o2.toast), 'device 2: project marked open + notice', o2.toast.slice(0, 120));

  T.section('A4 last-write-wins: newer account version wins, this device\'s edit kept as a copy');
  await page.evaluate(() => { const e = document.getElementById('f-kontraktor'); e.value = 'PT Perangkat Satu'; e.dispatchEvent(new Event('input', { bubbles: true })); clearTimeout(syncT); syncT = null; });
  await p2.waitForTimeout(20);
  await setVal(p2, 'f-catatan', 'Ditambahkan dari perangkat kedua');
  await p2.evaluate(() => saveProject());
  await importAccount(page, await exportAccount(p2));        // the account now holds device 2's newer version
  await page.evaluate(() => doSync());
  await page.waitForFunction(() => /perangkat lain/.test((document.querySelector('.toast-region') || document.body).textContent));
  await page.waitForFunction(() => /salinan perangkat ini/.test(document.getElementById('proj-list').textContent));
  const c = await page.evaluate(() => ({ cat: document.getElementById('f-catatan').value, kon: document.getElementById('f-kontraktor').value, list: document.getElementById('proj-list').textContent }));
  const docsC = await mainDocs(page);
  const copy = docsC.find(d => /salinan perangkat ini/.test(d.meta.name));
  T.ok(c.cat === 'Ditambahkan dari perangkat kedua' && c.kon === '', 'device 1 now shows the newer account version (device 2)', c);
  T.ok(copy && JSON.parse(copy.data).fields['f-kontraktor'] === 'PT Perangkat Satu' && docsC.length === 2, 'device 1\'s own edit preserved as "… (salinan perangkat ini)" in the account', docsC.map(d => d.meta.name));

  T.section('A5 rename, duplicate, delete (Proyek Saya UI)');
  await page.click('#proj-list .proj-item.is-open button:has-text("Ganti nama")');
  await page.fill('#proj-list .pi-ren input', 'Tangki T-101 — Inspeksi Oktober');
  await page.click('#proj-list .pi-ren button[type="submit"]');
  await page.waitForFunction(() => /Tangki T-101 — Inspeksi Oktober/.test(document.getElementById('proj-list').textContent));
  const rn = await page.evaluate(() => document.getElementById('f-proyek').value);
  const docsR = await mainDocs(page);
  T.ok(rn === 'Tangki T-101 — Inspeksi Oktober' && docsR.some(d => d.meta.name === 'Tangki T-101 — Inspeksi Oktober' && JSON.parse(d.data).fields['f-proyek'] === 'Tangki T-101 — Inspeksi Oktober'), 'rename the open project: field, list and account updated', docsR.map(d => d.meta.name));
  const copyRow = page.locator('#proj-list .proj-item', { hasText: 'salinan perangkat ini' });
  await copyRow.locator('button:has-text("Ganti nama")').click();
  await page.fill('#proj-list .pi-ren input', 'Salinan perangkat satu');
  await page.press('#proj-list .pi-ren input', 'Enter');
  await page.waitForFunction(() => /Salinan perangkat satu/.test(document.getElementById('proj-list').textContent));
  T.ok((await mainDocs(page)).some(d => d.meta.name === 'Salinan perangkat satu') && (await page.evaluate(() => document.getElementById('f-proyek').value)) === 'Tangki T-101 — Inspeksi Oktober', 'rename a closed project (Enter): account updated, open project untouched');
  const openId = await page.evaluate(() => SYNC.pid);
  await page.locator('#proj-list .proj-item.is-open button:has-text("Gandakan")').click();
  await page.waitForFunction(() => /Tangki T-101 — Inspeksi Oktober \(salinan\)/.test(document.getElementById('proj-list').textContent));
  const docsD = await mainDocs(page);
  const dup = docsD.find(d => / \(salinan\)$/.test(d.meta.name));
  const dupMedia = (await accountKeys(page)).filter(k => dup && k.indexOf('/perencanaan_media/' + dup.id + '__') > 0);
  T.ok(dup && dup.id !== openId && JSON.parse(dup.data).answers['0-1'] === 'no' && dupMedia.length === 2 && JSON.parse(dup.data).photos['0-1'].indexOf(dup.id) === 0, 'duplicate: new project with the same answers and its own copies of the media', { dup: dup && dup.meta.name, dupMedia });
  page.once('dialog', d => d.accept());
  await page.locator('#proj-list .proj-item', { hasText: '(salinan)' }).locator('button:has-text("Hapus")').click();
  await page.waitForFunction(() => !/\(salinan\)/.test(document.getElementById('proj-list').textContent));
  const afterDel = await accountKeys(page);
  T.ok(dup && !afterDel.some(k => k.indexOf(dup.id) >= 0) && (await mainDocs(page)).length === 2, 'delete (confirmed): project and all its media removed from the account', afterDel);
  page.once('dialog', d => d.dismiss());
  await page.locator('#proj-list .proj-item', { hasText: 'Salinan perangkat satu' }).locator('button:has-text("Hapus")').click();
  await page.waitForTimeout(300);
  T.ok((await mainDocs(page)).length === 2, 'delete cancelled in the dialog → nothing removed');

  T.section('A6 file too large for the account: kept on this device, member warned');
  await page.evaluate(() => {
    const big = 'data:application/pdf;base64,' + 'A'.repeat(900000);
    state.plans.push({ name: 'gambar-kerja-besar.pdf', type: 'application/pdf', data: big, ts: 22 }); savePlans(); renderPlans();
  });
  await page.waitForFunction(() => /terlalu besar untuk disimpan ke akun/.test((document.querySelector('.toast-region') || document.body).textContent), null, { timeout: 15000 });
  await waitSaved(page);
  const big = await page.evaluate(() => ({ toast: (document.querySelector('.toast-region') || document.body).textContent, local: state.plans.length, saved: document.getElementById('saved-ind').textContent.trim() }));
  const docBig = (await mainDocs(page)).find(d => d.id === openId);
  const planMeta = docBig ? JSON.parse(docBig.data).plans : [];
  T.ok(/gambar-kerja-besar\.pdf/.test(big.toast) && big.local === 2, 'warning names the file; the upload stays in the working copy', big.toast.slice(0, 200));
  const maxDoc = await page.evaluate((u) => Math.max(...Object.keys(localStorage).filter(k => k.indexOf('ppapi_appdata/' + u + '/') === 0).map(k => JSON.parse(localStorage.getItem(k)).size)), UID);
  T.ok(planMeta.length === 2 && planMeta[1].local === true && !planMeta[1].mid && docBig.meta.lokal === 1 && maxDoc <= 800000, `account: rest of the project saved; the large file is marked "local" (largest document ${maxDoc} bytes)`, planMeta);
  await page.waitForFunction(() => /hanya di perangkat asal/.test(document.getElementById('proj-list').textContent));
  T.ok(/1 berkas hanya di perangkat asal/.test(await txt(page, '#proj-list .proj-item.is-open')), 'Proyek Saya flags "1 berkas hanya di perangkat asal"');

  T.section('A7 "Mulai Proyek Baru" keeps the open project in the account; reopen');
  page.once('dialog', d => d.accept());
  await page.click('#proyek-saya button:has-text("Mulai Proyek Baru")');
  await page.waitForFunction(() => document.getElementById('f-proyek').value === '' && !document.querySelector('#proj-list .proj-item.is-open'));
  const nb = await page.evaluate(() => ({ ans: Object.keys(state.answers).length, list: document.getElementById('proj-list').textContent, pid: SYNC.pid }));
  T.ok(nb.ans === 0 && nb.pid === '' && /Tangki T-101 — Inspeksi Oktober/.test(nb.list), 'screen cleared for a new project; previous project still in Proyek Saya', nb);
  await page.waitForTimeout(3200);
  T.ok((await mainDocs(page)).length === 2, 'an untouched new project is not saved (no empty documents)');
  await page.locator('#proj-list .proj-item', { hasText: 'Tangki T-101 — Inspeksi Oktober' }).locator('button:has-text("Buka")').click();
  await page.waitForFunction(() => document.getElementById('f-proyek').value === 'Tangki T-101 — Inspeksi Oktober');
  const ro = await page.evaluate(() => ({ plans: state.plans.map(p => p.name), cat: document.getElementById('f-catatan').value }));
  T.ok(ro.plans.join() === 'denah.png,gambar-kerja-besar.pdf' && ro.cat === 'Ditambahkan dari perangkat kedua', 'reopened on the same device: the local-only file is restored from this device\'s stash', ro);

  T.section('A8 mobile 390: Proyek Saya fits without horizontal scroll');
  const ctxM = await newContext(browser, 'mobile');
  await seedSession(ctxM, { user: DEMO_USER });
  const pm = await ctxM.newPage();
  const issuesM = watch(pm); issuesAll.push(['A mobile', issuesM]);
  await pm.goto(PR, { waitUntil: 'networkidle' });
  await importAccount(pm, await exportAccount(page));
  await pm.reload({ waitUntil: 'networkidle' });
  await gateOk(pm);
  await pm.evaluate(() => openMyProjects());
  await pm.waitForFunction(() => document.querySelectorAll('#proj-list .proj-item').length === 2);
  const mob = await pm.evaluate(() => {
    const rows = [...document.querySelectorAll('#proj-list .proj-item')];
    const btns = [...document.querySelectorAll('#proj-list .pi-act button')];
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, rowsInside: rows.every(r => r.getBoundingClientRect().right <= innerWidth + 1), minBtn: Math.min(...btns.map(b => b.getBoundingClientRect().height)) };
  });
  T.ok(mob.overflow <= 0 && mob.rowsInside, 'mobile: no horizontal overflow, rows inside the viewport', mob);
  T.ok(mob.minBtn >= 34, `mobile: row actions ≥ 34 px tall (${mob.minBtn}px)`, mob);
  await pm.evaluate(() => document.getElementById('proyek-saya').scrollIntoView());
  await shot(pm, 'appdata-proyek-saya-mobile');
  if (NET) {
    T.section('D axe-core on Proyek Saya (desktop + mobile)');
    for (const [label, pg] of [['desktop', page], ['mobile', pm]]) {
      await pg.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
      const v = await pg.evaluate(async () => (await axe.run({ include: ['#proyek-saya', '#saved-ind'] }, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => ({ id: x.id, n: x.nodes.length, t: x.nodes.slice(0, 2).map(n => n.target.join(' ')) })));
      T.ok(v.length === 0, `axe Proyek Saya (${label}): 0 serious/critical`, v);
    }
  }
  await ctxM.close(); await ctx2.close(); await ctx.close();
}

/* ======================================================================
   B. one-time migration of existing localStorage data
   ====================================================================== */
{
  T.section('B1 legacy data in this browser → asked before importing; nothing sent before consent');
  const ctx = await newContext(browser, 'desktop');
  await seedSession(ctx, { user: DEMO_USER_B });
  const K = 'ppapi_app_perencanaan_v1_u_' + DEMO_USER_B.uid;
  await ctx.addInitScript(({ K, PK, JPEG }) => {
    try {
      if (sessionStorage.getItem('__seed_mig')) return;
      sessionStorage.setItem('__seed_mig', '1');
      localStorage.setItem(K, JSON.stringify({ v: 4, answers: { '0-0': 'ok' }, naNote: {}, fields: { 'f-proyek': 'Isian Lama Menara A', 'f-lokasi': 'Dermaga 3' }, ts: 1759300000000 }));
      localStorage.setItem(PK, JSON.stringify([{ id: 5, name: 'Gudang Lama', tag: 'GL-1', status: 'HIJAU', fields: { 'f-proyek': 'Gudang Lama', 'f-lokasi': 'Cikarang', 'f-tanggal': '2026-09-01' }, answers: { '1-0': 'ok' }, photos: { '1-0': JPEG }, plans: [], ts: 1756700000000 }]));
    } catch (e) {}
  }, { K, PK: 'ppapi_app_perencanaan_projects_u_' + DEMO_USER_B.uid, JPEG });
  const page = await ctx.newPage();
  const issues = watch(page); issuesAll.push(['B migration', issues]);
  await page.goto(PR, { waitUntil: 'networkidle' });
  await gateOk(page);
  const toast = await page.waitForFunction(() => /belum tersimpan ke akun/.test((document.querySelector('.toast-region') || document.body).textContent), null, { timeout: 8000 }).then(() => true).catch(() => false);
  T.ok(toast, 'a notice on opening: data in this browser not yet saved to the account');
  await page.evaluate(() => go('proyek'));
  await page.waitForSelector('#mig-panel .mig-box');
  const mp = await txt(page, '#mig-panel');
  T.ok(/Data lama di peramban ini/.test(mp) && /Gudang Lama · GL-1/.test(mp) && /Isian yang sedang terbuka \(Isian Lama Menara A\)/.test(mp), 'Proyek Saya shows the migration panel listing the archive item and the open draft', mp);
  T.ok(/^Tersimpan di peramban · \d{2}\.\d{2}$/.test(await savedInd(page)), 'menu band: "Tersimpan di peramban · HH.MM" while not in the account', await savedInd(page));
  await setVal(page, 'f-catatan', 'diubah sebelum persetujuan');
  await page.waitForTimeout(3500);
  T.ok((await accountKeys(page, DEMO_USER_B.uid)).length === 0, 'no data sent to the account before the member agrees (even after edits + autosave delay)');
  await page.click('#mig-panel button:has-text("Nanti saja")');
  await page.waitForFunction(() => document.getElementById('mig-panel').hidden);
  await page.reload({ waitUntil: 'networkidle' }); await gateOk(page); await page.evaluate(() => go('proyek'));
  await page.waitForTimeout(300);
  T.ok(await page.evaluate(() => document.getElementById('mig-panel').hidden), '"Nanti saja" hides the panel for this session');
  await page.evaluate((K) => sessionStorage.removeItem(K + '_mig_later'), K);
  await page.reload({ waitUntil: 'networkidle' }); await gateOk(page); await page.evaluate(() => go('proyek'));
  await page.waitForSelector('#mig-panel .mig-box');
  T.ok(true, 'next session: asked again');

  T.section('B2 "Simpan ke akun" → legacy archive + open draft become account projects');
  await page.click('#mig-panel button:has-text("Simpan ke akun")');
  await page.waitForFunction(() => /kini tersimpan ke akun/.test((document.querySelector('.toast-region') || document.body).textContent), null, { timeout: 15000 });
  const docs = await page.evaluate((u) => Object.keys(localStorage).filter(k => k.indexOf('ppapi_appdata/' + u + '/perencanaan/') === 0).map(k => JSON.parse(localStorage.getItem(k))), DEMO_USER_B.uid);
  const names = docs.map(d => d.meta.name).sort();
  T.ok(names.join('|') === 'Gudang Lama|Isian Lama Menara A', 'account now holds both projects', names);
  const gl = docs.find(d => d.meta.name === 'Gudang Lama');
  T.ok(gl && gl.meta.status === 'HIJAU' && gl.meta.lokasi === 'Cikarang' && gl.updatedAt === 1756700000000 && JSON.parse(gl.data).photos['1-0'], 'archived project keeps its verdict, location, original date and photo', gl && gl.meta);
  const isi = docs.find(d => d.meta.name === 'Isian Lama Menara A');
  T.ok(isi && JSON.parse(isi.data).fields['f-catatan'] === 'diubah sebelum persetujuan', 'the open draft (with the edit made before consent) is saved too', isi && JSON.parse(isi.data).fields);
  const after = await page.evaluate(() => ({ hidden: document.getElementById('mig-panel').hidden, list: document.getElementById('proj-list').textContent, saved: document.getElementById('saved-ind').textContent.trim() }));
  T.ok(after.hidden && /Isian Lama Menara A/.test(after.list) && /Sedang dibuka/.test(after.list) && /Gudang Lama/.test(after.list), 'panel gone; both listed; the draft is the open project', after);
  await page.reload({ waitUntil: 'networkidle' }); await gateOk(page); await page.evaluate(() => go('proyek'));
  await page.waitForFunction(() => document.querySelectorAll('#proj-list .proj-item').length === 2);
  const again = await page.evaluate(() => ({ hidden: document.getElementById('mig-panel').hidden, n: document.querySelectorAll('#proj-list .proj-item').length }));
  T.ok(again.hidden && again.n === 2 && (await page.evaluate((u) => Object.keys(localStorage).filter(k => k.indexOf('ppapi_appdata/' + u + '/perencanaan/') === 0).length, DEMO_USER_B.uid)) === 2, 'after reload: not asked again, no duplicate import', again);
  await ctx.close();
}

/* ======================================================================
   C. simulator progress per account
   ====================================================================== */
{
  T.section('C simulator: progress saved to the account and resumed in another browser context');
  const ctx = await newContext(browser, 'desktop');
  await seedSession(ctx, { user: DEMO_USER });
  await ctx.addInitScript((u) => { try { if (!sessionStorage.getItem('__seed_sim')) { sessionStorage.setItem('__seed_sim', '1'); localStorage.setItem('ppapi_progress_' + u + '_simulator', JSON.stringify({ v: 2, seq: 'tc-2026.10-r2', total: 20, current: 5, completedAt: '', updatedAt: new Date().toISOString(), tools: { vert: true }, libSeen: ['fix'] })); } } catch (e) {} }, UID);
  const page = await ctx.newPage();
  const issues = watch(page); issuesAll.push(['C simulator 1', issues]);
  await page.goto(SIM, { waitUntil: 'networkidle' });
  await gateOk(page);
  await page.waitForFunction((u) => !!localStorage.getItem('ppapi_appdata/' + u + '/simulator/progress'), UID, { timeout: 10000 });
  const doc = await page.evaluate((u) => JSON.parse(localStorage.getItem('ppapi_appdata/' + u + '/simulator/progress')), UID);
  const data = JSON.parse(doc.data);
  T.ok(data.current === 5 && data.tools.vert === true && doc.meta.current === 5 && doc.meta.total === 20 && doc.size < 2000, 'progress (5/20, tools) saved to the account as one small document', doc.meta);
  const acc = await exportAccount(page);
  const ctx2 = await newContext(browser, 'desktop');
  await seedSession(ctx2, { user: DEMO_USER });
  const p2 = await ctx2.newPage();
  const issues2 = watch(p2); issuesAll.push(['C simulator 2', issues2]);
  await p2.goto(SIM, { waitUntil: 'networkidle' });
  await importAccount(p2, acc);
  await p2.reload({ waitUntil: 'networkidle' });
  await gateOk(p2);
  await p2.waitForFunction(() => /5 dari 20/.test(document.getElementById('introResume').textContent), null, { timeout: 10000 });
  const intro = await p2.evaluate((u) => ({ note: document.getElementById('introResume').textContent, btn: document.getElementById('startBtn').textContent, local: JSON.parse(localStorage.getItem('ppapi_progress_' + u + '_simulator') || 'null') }), UID);
  T.ok(/Lanjutkan Perakitan/.test(intro.btn) && intro.local && intro.local.current === 5, 'other context: intro offers "Lanjutkan Perakitan" at 5 of 20 (from the account)', intro);
  await ctx2.close(); await ctx.close();
}

T.section('D no console errors');
for (const [label, iss] of issuesAll) noIssues(label, iss);
await browser.close();
server.close();
process.exit(T.done() ? 1 : 0);
