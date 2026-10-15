// PPAPI v2 lens — keyboard-only operation & focus management (REVIEW ONLY; never writes to site/).
// Covers: pendaftaran wizard (radio group, Lanjut, error summary, stepper, repeaters, modals),
// admin console (section nav, row → drawer, focus trap, nested dialog, Esc/return, table filters),
// pustaka toolbar (search, chips, view switch, "Tampilkan lainnya", detail modal), header account menu,
// anggota tabs, app portal bar.  Only the keyboard is used to operate the UI (no mouse clicks).
// Usage (cwd devtools/): node flows/v2lens-keyboard.mjs [--vp=desktop|mobile]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, recorder } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'v2lens', 'kbd');
fs.mkdirSync(OUT, { recursive: true });
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));

const DEMO_USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const baseMember = () => ({
  uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: '' },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }], certificates: [], updatedAt: '2026-09-30T08:00:00.000Z',
  application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' },
  review: { note: '', history: [] },
});
const DEMO_ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };

async function seedMember(ctx, m) {
  await ctx.addInitScript(({ u, m }) => {
    if (!localStorage.getItem('ppapi_demo_session')) {
      localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
      const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
      users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
      localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
      localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
    }
  }, { u: DEMO_USER, m });
}
async function seedAdmin(ctx) {
  await ctx.addInitScript(({ a }) => {
    if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
    const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
    if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
  }, { a: DEMO_ADMIN });
}
const active = page => page.evaluate(() => {
  const el = document.activeElement; if (!el || el === document.body) return { sel: 'BODY', text: '' };
  let s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  const dlg = el.closest('.drawer__panel') ? 'drawer' : el.closest('.modal__dialog') ? 'modal' : el.closest('#site-header') ? 'header' : el.closest('main') ? 'main' : el.closest('#site-footer') ? 'footer' : 'other';
  const r = el.getBoundingClientRect();
  return { sel: s, text: (el.getAttribute('aria-label') || el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 60), where: dlg, data: Object.assign({}, el.dataset), inView: r.bottom > 0 && r.top < innerHeight, fv: el.matches(':focus-visible'), rect: [r.x, r.y, r.width, r.height].map(Math.round) };
});
async function tabTo(page, test, max = 120, key = 'Tab') {
  for (let i = 1; i <= max; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(25);
    if (await page.evaluate(test)) return i;
  }
  return -1;
}
async function ready(page) {
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(700);
}

const { BASE, close } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const VPS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }].filter(v => !flags.vp || v.name === flags.vp);
const R = recorder('v2lens-keyboard');
const notes = [];
const note = (k, v) => { notes.push({ k, v }); R.info(k, typeof v === 'string' ? v : JSON.stringify(v)); };

for (const vp of VPS) {
  const mk = async (seedFn) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
    await seedFn(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', e => R.ok(`[${vp.name}] no pageerror`, false, e.message));
    page.on('dialog', d => d.dismiss());
    return { ctx, page };
  };
  const P = s => `[${vp.name}] ${s}`;

  /* ================= K1 — pendaftaran wizard (Draf, empty application) ================= */
  {
    const m = baseMember();
    Object.assign(m, { status: 'Draf', kta: '', validUntil: '', approvedAt: '', approvedBy: '' });
    m.application = { type: 'baru', kategori: '', submittedAt: '', updatedAt: '', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' }, catatan: '' };
    const { ctx, page } = await mk(c => seedMember(c, m));
    await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
    await ready(page);
    await page.waitForSelector('.daf-foot__next', { timeout: 10000 }).catch(() => {});
    await page.keyboard.press('Tab');
    const f1 = await active(page);
    R.ok(P('K1.1 first Tab = skip link'), /skip-link/.test(f1.sel), f1.sel + ' ' + f1.text);
    await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    R.ok(P('K1.2 skip link moves focus to <main>'), (await active(page)).sel.startsWith('main#main'), (await active(page)).sel);
    const nRadio = await tabTo(page, () => document.activeElement && (document.activeElement.name === 'kategori' || document.activeElement.classList.contains('daf-foot__next')), 80);
    const aR = await active(page);
    note(P('K1 tabs from main to first category control / next'), `${nRadio} → ${aR.sel} "${aR.text}"`);
    // Lanjut without choosing
    if (/kategori/.test(JSON.stringify(aR)) || aR.sel.includes('input')) {
      // try arrow key selection
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200);
      const chk = await page.evaluate(() => [...document.querySelectorAll('input[name="kategori"]')].map(i => i.checked));
      R.ok(P('K1.3 ArrowDown in category radio group selects an option'), chk.some(Boolean), JSON.stringify(chk));
      await page.keyboard.press('ArrowUp'); await page.waitForTimeout(200);
    }
    const nNext = await tabTo(page, () => document.activeElement && document.activeElement.classList.contains('daf-foot__next'), 60);
    note(P('K1 tabs from category to "Lanjut"'), String(nNext));
    await page.keyboard.press('Enter'); await page.waitForTimeout(700);
    const afterNext = await active(page);
    const hash1 = await page.evaluate(() => location.hash);
    R.ok(P('K1.4 Enter on Lanjut → step 2 + focus on step title'), hash1 === '#data-diri' && afterNext.sel.includes('daf-step-title'), hash1 + ' ' + afterNext.sel);
    R.ok(P('K1.4b focused step title is in view'), afterNext.inView, JSON.stringify(afterNext.rect));
    // error path: go to Lanjut directly (fields empty except name)
    const nNext2 = await tabTo(page, () => document.activeElement && document.activeElement.classList.contains('daf-foot__next'), 80);
    note(P('K1 tabs through step 2 (Data Diri) to Lanjut'), String(nNext2));
    await page.keyboard.press('Enter'); await page.waitForTimeout(700);
    const errF = await active(page);
    const errSum = await page.evaluate(() => { const e = document.getElementById('daf-errsum'); return e && !e.hidden ? { role: e.getAttribute('role'), tabindex: e.getAttribute('tabindex'), items: e.querySelectorAll('li').length, text: e.innerText.slice(0, 200) } : null; });
    R.ok(P('K1.5 invalid step → error summary shown'), !!errSum, JSON.stringify(errSum));
    /* Release QA 2026-10-09: the wizard keeps its design — the summary is announced (role="alert") and focus goes to the
       FIRST invalid field (aria-invalid + aria-describedby → message). Either pattern satisfies WCAG 3.3.1 / 3.3.3. */
    const firstInvalid = await page.evaluate(() => { const a = document.activeElement; return !!a && a.getAttribute('aria-invalid') === 'true' && !!document.querySelector('#daf-errsum[role="alert"]:not([hidden])'); });
    R.ok(P('K1.6 focus moves to error summary or to the first invalid field (summary announced)'), /errsum/.test(errF.sel) || firstInvalid || (errF.where === 'main' && /daf-errsum/.test(await page.evaluate(() => document.activeElement.closest('#daf-errsum') ? 'daf-errsum' : ''))), errF.sel + ' ' + errF.text);
    await page.keyboard.press('Tab'); await page.waitForTimeout(80);
    const e1 = await active(page);
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    const e2 = await active(page);
    R.ok(P('K1.7 error-summary link → focuses the invalid field'), /^(input|select|textarea)/.test(e2.sel), `${e1.sel} "${e1.text}" → ${e2.sel}`);
    const inv = await page.evaluate(() => { const el = document.activeElement; return { invalid: el.getAttribute('aria-invalid'), desc: (el.getAttribute('aria-describedby') || '').split(' ').map(id => document.getElementById(id)?.innerText || '#' + id).join(' | ') }; });
    R.ok(P('K1.8 focused field has aria-invalid + described error'), inv.invalid === 'true' && inv.desc.length > 3, JSON.stringify(inv));
    // stepper: shift-tab back to the stepper rail and jump to step 4
    const nStep = await tabTo(page, () => document.activeElement && document.activeElement.matches('[data-step]'), 80, 'Shift+Tab');
    const st = await active(page);
    note(P('K1 Shift+Tab from field to stepper item'), `${nStep} → ${st.sel} "${st.text}"`);
    const stepperInfo = await page.evaluate(() => ({ current: document.querySelector('[aria-current="step"]')?.innerText.replace(/\s+/g, ' ').slice(0, 60) || null, items: [...document.querySelectorAll('[data-step]')].length, tag: document.querySelector('[data-step]')?.tagName }));
    R.ok(P('K1.9 stepper marks current step with aria-current="step"'), !!stepperInfo.current, JSON.stringify(stepperInfo));
    if (nStep > 0) {
      await page.evaluate(() => {}); // noop
      // move to step 4 (kompetensi) item via Tab/Shift+Tab within the stepper
      let guard = 0;
      while (guard++ < 10) { const ds = await page.evaluate(() => document.activeElement.getAttribute('data-step')); if (ds === '3') break; await page.keyboard.press(+ds > 3 ? 'Shift+Tab' : 'Tab'); await page.waitForTimeout(30); }
      await page.keyboard.press('Enter'); await page.waitForTimeout(700);
      const s4 = await active(page);
      R.ok(P('K1.10 Enter on stepper item → step changes + focus on step title'), (await page.evaluate(() => location.hash)) === '#kompetensi' && s4.sel.includes('daf-step-title'), (await page.evaluate(() => location.hash)) + ' ' + s4.sel);
    }
    // add competency via keyboard → modal focus
    const nAdd = await tabTo(page, () => document.activeElement && document.activeElement.matches('[data-action="komp-add"]'), 40);
    if (nAdd > 0) {
      await page.keyboard.press('Enter'); await page.waitForTimeout(500);
      const inM = await active(page);
      R.ok(P('K1.11 "Tambah kompetensi" opens a dialog with focus inside'), inM.where === 'modal' || inM.where === 'drawer', inM.sel + ' ' + inM.where);
      // trap check
      let out = 0; for (let i = 0; i < 25; i++) { await page.keyboard.press('Tab'); const a = await active(page); if (!['modal', 'drawer'].includes(a.where)) out++; }
      R.ok(P('K1.12 Tab stays inside the dialog (25 presses)'), out === 0, 'escaped ' + out);
      await page.keyboard.press('Escape'); await page.waitForTimeout(500);
      const back = await active(page);
      R.ok(P('K1.13 Esc closes dialog, focus returns to the trigger'), back.data && back.data.action === 'komp-add', back.sel + ' ' + JSON.stringify(back.data));
    } else R.ok(P('K1.11 reach "Tambah kompetensi" by Tab'), false, 'not reached');
    // repeater on step 3 (profesional)
    await page.evaluate(() => { location.hash = '#profesional'; }); await page.waitForTimeout(700);
    await page.evaluate(() => { document.getElementById('daf-step-title')?.focus(); });
    const nPeng = await tabTo(page, () => document.activeElement && document.activeElement.matches('[data-action="peng-add"]'), 40);
    if (nPeng > 0) {
      await page.keyboard.press('Enter'); await page.waitForTimeout(500);
      const pa = await active(page);
      R.ok(P('K1.14 "Tambah proyek" moves focus into the new row'), /peng-proyek/.test(pa.sel) || /input/.test(pa.sel), pa.sel);
      // remove row via keyboard → focus not lost to <body>
      const nDel = await tabTo(page, () => document.activeElement && /peng-(del|remove|hapus)/.test(document.activeElement.getAttribute('data-action') || ''), 12);
      if (nDel > 0) {
        await page.keyboard.press('Enter'); await page.waitForTimeout(500);
        const dlg = await page.$('.modal__dialog'); if (dlg) { await page.keyboard.press('Enter'); await page.waitForTimeout(500); }
        const pd = await active(page);
        R.ok(P('K1.15 after removing the row focus is not lost'), pd.sel !== 'BODY', pd.sel);
      } else note(P('K1 remove-row button'), 'not found within 12 tabs');
    } else R.ok(P('K1.14 reach "Tambah proyek" by Tab'), false, 'not reached');
    // pernyataan: checkbox Space
    await page.evaluate(() => { location.hash = '#pernyataan'; }); await page.waitForTimeout(700);
    await page.evaluate(() => { document.getElementById('daf-step-title')?.focus(); });
    const nCb = await tabTo(page, () => document.activeElement && document.activeElement.type === 'checkbox', 30);
    if (nCb > 0) { await page.keyboard.press('Space'); await page.waitForTimeout(150); R.ok(P('K1.16 Space toggles a declaration checkbox'), await page.evaluate(() => document.activeElement.checked)); }
    await page.screenshot({ path: path.join(OUT, `k1-${vp.name}.png`) });
    await ctx.close();
  }

  /* ================= K2 — admin console ================= */
  {
    const { ctx, page } = await mk(seedAdmin);
    await page.goto(`${BASE}/admin.html`, { waitUntil: 'networkidle' });
    await page.waitForSelector('html[data-admin-ready]', { timeout: 20000 });
    await page.waitForTimeout(400);
    const nNav = await tabTo(page, () => document.activeElement && document.activeElement.matches('.adm-nav__link[data-section="permohonan"]'), 80);
    note(P('K2 tabs from top to "Permohonan" nav link'), String(nNav));
    R.ok(P('K2.1 section nav reachable by Tab'), nNav > 0);
    await page.keyboard.press('Enter'); await page.waitForTimeout(600);
    const h = await active(page);
    R.ok(P('K2.2 Enter on section link → focus on section heading'), h.sel.includes('h-permohonan'), h.sel);
    const nRow = await tabTo(page, () => document.activeElement && document.activeElement.matches('#pq-list .adm-act, #pq-list [data-open]'), 40);
    const row = await active(page);
    note(P('K2 tabs from heading to first row action'), `${nRow} → ${row.sel} "${row.text}"`);
    await page.keyboard.press('Enter'); await page.waitForSelector('.drawer__panel', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400);
    const inD = await active(page);
    R.ok(P('K2.3 Enter on row → drawer opens with focus inside'), inD.where === 'drawer', inD.sel + ' "' + inD.text + '"');
    let esc = 0; const seen = new Set();
    for (let i = 0; i < 60; i++) { await page.keyboard.press('Tab'); const a = await active(page); seen.add(a.sel + a.text); if (a.where !== 'drawer') esc++; }
    R.ok(P('K2.4 focus trapped in drawer (60 Tabs)'), esc === 0, `escaped ${esc}, distinct stops ${seen.size}`);
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Shift+Tab'); const a = await active(page); if (a.where !== 'drawer') esc++; }
    R.ok(P('K2.5 Shift+Tab also trapped'), esc === 0);
    const nAp = await tabTo(page, () => document.activeElement && document.activeElement.id === 'act-approve', 80);
    if (nAp > 0) {
      await page.keyboard.press('Enter'); await page.waitForSelector('.modal__dialog', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400);
      const inM = await active(page);
      R.ok(P('K2.6 Setujui dialog: focus inside modal'), inM.where === 'modal', inM.sel + ' "' + inM.text + '"');
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      const bk = await active(page);
      R.ok(P('K2.7 Esc closes only the dialog; focus back on Setujui inside the drawer'), bk.sel.includes('act-approve') && !!(await page.$('.drawer__panel')), bk.sel);
    } else R.ok(P('K2.6 reach Setujui by Tab'), false);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const rt = await active(page);
    R.ok(P('K2.8 Esc closes drawer; focus returns to the row trigger'), /adm-act/.test(rt.sel) || (rt.data && rt.data.open === 'member'), rt.sel + ' ' + JSON.stringify(rt.data));
    // Anggota: search + selects via keyboard
    await page.evaluate(() => { location.hash = '#anggota'; }); await page.waitForTimeout(700);
    await page.evaluate(() => document.getElementById('h-anggota')?.focus());
    const nQ = await tabTo(page, () => document.activeElement && document.activeElement.id === 'aq-q', 20);
    R.ok(P('K2.9 search box reachable'), nQ > 0, String(nQ));
    await page.keyboard.type('dimas', { delay: 40 }); await page.waitForTimeout(500);
    R.ok(P('K2.10 typing filters rows, focus stays in search'), (await page.$$eval('#aq-list tbody tr', r => r.length)) === 1 && (await active(page)).sel.includes('aq-q'));
    const ann = await page.evaluate(() => document.getElementById('adm-announce')?.textContent || '');
    note(P('K2 live announcement after search'), ann || '(empty)');
    await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.waitForTimeout(400);
    const nS = await tabTo(page, () => document.activeElement && document.activeElement.id === 'aq-status', 10);
    if (nS > 0) {
      const before = await page.$eval('#aq-status', s => s.value);
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({ v: document.getElementById('aq-status')?.value, f: document.activeElement.id, ann: document.getElementById('adm-announce')?.textContent || '' }));
      R.ok(P('K2.11 status filter operable by arrow key; focus stays on select'), after.v !== before && after.f === 'aq-status', JSON.stringify({ before, ...after }));
    }
    const sortable = await page.evaluate(() => ({ ariaSort: document.querySelectorAll('#aq-list th[aria-sort]').length, thButtons: document.querySelectorAll('#aq-list th button').length, caption: document.querySelector('#aq-list caption')?.textContent }));
    note(P('K2 table: column-header sort controls / caption'), sortable);
    // Konten tabs
    await page.evaluate(() => { location.hash = '#konten'; }); await page.waitForTimeout(800);
    const tabs = await page.evaluate(() => { const t = [...document.querySelectorAll('#sec-konten [role="tab"]')]; return { n: t.length, sel: t.map(x => x.getAttribute('aria-selected')).join(','), list: !!document.querySelector('#sec-konten [role="tablist"]') }; });
    note(P('K2 konten sub-tabs semantics'), tabs);
    if (tabs.n) {
      await page.focus('#sec-konten [role="tab"][aria-selected="true"]');
      await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
      const at = await page.evaluate(() => ({ f: document.activeElement.getAttribute('role'), txt: document.activeElement.textContent.trim().slice(0, 30), sel: document.activeElement.getAttribute('aria-selected'), hash: location.hash }));
      R.ok(P('K2.12 konten tablist: ArrowRight moves to next tab'), at.f === 'tab' && /Pengumuman|pengumuman/.test(at.txt + at.hash), JSON.stringify(at));
    }
    await ctx.close();
  }

  /* ================= K3 — pustaka toolbar ================= */
  {
    const { ctx, page } = await mk(c => seedMember(c, baseMember()));
    await page.goto(`${BASE}/pustaka.html`, { waitUntil: 'networkidle' });
    await ready(page);
    const nQ = await tabTo(page, () => document.activeElement && document.activeElement.id === 'pk-q', 120);
    note(P('K3 tabs from top to catalogue search'), String(nQ));
    R.ok(P('K3.1 search reachable by Tab'), nQ > 0);
    await page.keyboard.type('perancah', { delay: 30 }); await page.waitForTimeout(600);
    R.ok(P('K3.2 focus stays in search while results update'), (await active(page)).sel.includes('pk-q'));
    const cnt = await page.evaluate(() => { const c = document.querySelector('[data-pk="count"]'); return c ? { text: c.innerText, live: c.getAttribute('aria-live') || c.closest('[aria-live]')?.getAttribute('aria-live') || null, role: c.getAttribute('role') } : null; });
    R.ok(P('K3.3 result count is announced (aria-live/status)'), !!cnt && (!!cnt.live || cnt.role === 'status'), JSON.stringify(cnt));
    await page.keyboard.press('Control+A'); await page.keyboard.press('Backspace'); await page.waitForTimeout(400);
    const nChip = await tabTo(page, () => document.activeElement && document.activeElement.matches('[data-pk="chips"] .chip') && document.activeElement.getAttribute('data-kat') !== '', 30);
    if (nChip > 0) {
      const k = await page.evaluate(() => document.activeElement.getAttribute('data-kat'));
      await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      const a = await page.evaluate(() => ({ kat: document.activeElement.getAttribute('data-kat'), pressed: document.activeElement.getAttribute('aria-pressed'), url: location.search }));
      R.ok(P('K3.4 Enter on a category chip filters, focus stays on that chip (aria-pressed=true)'), a.kat === k && a.pressed === 'true', JSON.stringify({ k, ...a }));
      await page.keyboard.press('Space'); await page.waitForTimeout(500);
      note(P('K3 Space on pressed chip'), await page.evaluate(() => ({ pressed: document.activeElement.getAttribute('aria-pressed'), url: location.search })));
    } else R.ok(P('K3.4 reach chips'), false);
    // reset filters via URL
    await page.goto(`${BASE}/pustaka.html`, { waitUntil: 'networkidle' }); await ready(page);
    const nView = await tabTo(page, () => document.activeElement && document.activeElement.matches('[data-pk="view"] .segmented__option'), 140);
    if (nView > 0) {
      const nextOpt = await page.evaluate(() => document.activeElement.getAttribute('aria-pressed') === 'true');
      if (nextOpt) { await page.keyboard.press('Tab'); }
      await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      const v = await page.evaluate(() => ({ cls: document.activeElement.className, pressed: document.activeElement.getAttribute('aria-pressed'), val: document.activeElement.getAttribute('data-value') }));
      R.ok(P('K3.5 view switch operable; focus stays on the option'), v.pressed === 'true', JSON.stringify(v));
    }
    await page.goto(`${BASE}/pustaka.html`, { waitUntil: 'networkidle' }); await ready(page);
    const nMore = await tabTo(page, () => document.activeElement && document.activeElement.matches('[data-pk-more]'), 200);
    if (nMore > 0) {
      await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      const mo = await active(page);
      R.ok(P('K3.6 "Tampilkan lainnya" → focus moves to first newly shown item'), mo.sel !== 'BODY' && !/data-pk-more/.test(JSON.stringify(mo.data)), mo.sel + ' "' + mo.text + '"');
    } else note(P('K3 "Tampilkan lainnya"'), 'no button within 200 tabs (all shelves short?)');
    // open detail with Enter
    await page.goto(`${BASE}/pustaka.html`, { waitUntil: 'networkidle' }); await ready(page);
    const nOpen = await tabTo(page, () => document.activeElement && document.activeElement.hasAttribute('data-pk-open'), 200);
    if (nOpen > 0) {
      const key = await page.evaluate(() => document.activeElement.getAttribute('data-pk-open'));
      await page.keyboard.press('Enter'); await page.waitForSelector('.modal__dialog', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400);
      const m1 = await active(page);
      R.ok(P('K3.7 Enter on a title opens the detail dialog with focus inside'), m1.where === 'modal', m1.sel);
      const title = await page.evaluate(() => document.title);
      note(P('K3 document.title while detail open'), title);
      await page.keyboard.press('Escape'); await page.waitForTimeout(800);
      const m2 = await page.evaluate(() => document.activeElement.getAttribute('data-pk-open'));
      R.ok(P('K3.8 Esc returns focus to the same title'), m2 === key, `${key} vs ${m2}`);
    }
    await ctx.close();
  }

  /* ================= K4 — header account menu + anggota tabs + portal bar ================= */
  {
    const { ctx, page } = await mk(c => seedMember(c, baseMember()));
    await page.goto(`${BASE}/anggota.html`, { waitUntil: 'networkidle' });
    await ready(page);
    if (vp.name === 'desktop') {
      const nAcc = await tabTo(page, () => document.activeElement && document.activeElement.closest('[data-account]') && document.activeElement.getAttribute('aria-haspopup'), 40);
      if (nAcc > 0) {
        await page.keyboard.press('Enter'); await page.waitForTimeout(300);
        const seq = [];
        for (let i = 0; i < 8; i++) { const a = await active(page); seq.push(a.text.split(' ')[0] + (a.text.split(' ')[1] ? ' ' + a.text.split(' ')[1] : '')); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(60); }
        note(P('K4 account menu ArrowDown sequence'), seq.join(' → '));
        const wraps = seq.indexOf(seq[0], 1) > 0 || seq.slice(1).includes('Dasbor');
        R.ok(P('K4.1 account menu ArrowDown wraps from last item to first'), wraps, seq.join(' → '));
        await page.keyboard.press('Escape'); await page.waitForTimeout(200);
        R.ok(P('K4.2 Esc closes menu, focus back on the account button'), !!(await page.evaluate(() => document.activeElement.getAttribute('aria-haspopup'))));
      } else R.ok(P('K4.1 account button reachable'), false);
    }
    const tl = await page.evaluate(() => { const t = [...document.querySelectorAll('[role="tab"]')]; return t.map(x => x.textContent.trim().replace(/\s+/g, ' ').slice(0, 20) + ':' + x.getAttribute('aria-selected') + ':' + x.getAttribute('tabindex')).join(' | '); });
    note(P('K4 anggota tabs'), tl || '(no role=tab)');
    const firstTab = await page.$('[role="tab"][aria-selected="true"]');
    if (firstTab) {
      await firstTab.focus(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
      const t2 = await page.evaluate(() => ({ role: document.activeElement.getAttribute('role'), sel: document.activeElement.getAttribute('aria-selected'), txt: document.activeElement.textContent.trim().slice(0, 30) }));
      R.ok(P('K4.3 anggota tabs: ArrowRight moves + selects next tab'), t2.role === 'tab' && t2.sel === 'true', JSON.stringify(t2));
    }
    // portal bar
    await page.goto(`${BASE}/aplikasi/simulator/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.documentElement.classList.contains('app-gate-pending'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const seq = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(40); const a = await active(page); seq.push(`${a.sel}"${a.text.slice(0, 25)}"${a.fv ? '' : '(no :focus-visible)'}`); }
    note(P('K4 simulator: first 6 tab stops'), seq.join(' → '));
    R.ok(P('K4.4 app page: first Tab stop is a skip link'), /skip/i.test(seq[0]), seq[0]);
    await ctx.close();
  }
}
const failed = R.summary();
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results: R.results, notes }, null, 1));
await browser.close();
await close();
process.exitCode = failed ? 1 : 0;
