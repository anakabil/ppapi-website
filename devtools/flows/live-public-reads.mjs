// live-public-reads — read-only probe of the LIVE site https://ppapi.or.id (2026-10-21).
// Run from devtools/:  node flows/live-public-reads.mjs
// Opens the production pages (signed out) and calls the site's own public read APIs; each must resolve
// (list / empty / null), never with permission-denied. Writes nothing, signs in to nothing.
import { chromium } from 'playwright';

const SITE = process.env.LIVE_URL || 'https://ppapi.or.id';
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: 'id-ID' });
const page = await ctx.newPage();
const out = [];
async function probe(file, label, fnSrc) {
  await page.goto(`${SITE}/${file}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 30000 });
  const r = await page.evaluate(async (src) => {
    const mode = PPAPI.auth.mode, user = PPAPI.auth.current();
    try {
      const CALLS = {   /* no eval: the site's CSP forbids it */
        products: () => PPAPI.toko.listProducts(), settings: () => PPAPI.toko.getSettings(),
        instructors: () => PPAPI.instruktur.list(), events: () => PPAPI.kegiatan.listPublished(),
        certificate: () => PPAPI.kegiatan.verify('PPAPI/SERT/2026/WEB1025/0001'),
        /* raw Firestore reads (the store wrappers may soften a denial, e.g. listPublished) */
        rawProducts: async () => (await firebase.firestore().collection('products').where('aktif', '==', true).get()).docs.map(d => d.id),
        rawSettings: async () => { const d = await firebase.firestore().collection('shop_settings').doc('main').get(); return { exists: d.exists }; },
        rawInstructors: async () => (await firebase.firestore().collection('instructors').where('published', '==', true).limit(50).get()).docs.map(d => d.id),
        rawEvents: async () => (await firebase.firestore().collection('events').where('status', '==', 'terbit').get()).docs.map(d => d.id),
        rawCertificate: async () => { const d = await firebase.firestore().collection('certificates').doc(PPAPI.kegiatan.certDocId('PPAPI/SERT/2026/WEB1025/0001')).get(); return { exists: d.exists }; },
      };
      const v = await CALLS[src]();
      const summary = Array.isArray(v) ? { type: 'array', length: v.length } : v && 'exists' in v ? v : v === null || v === undefined ? { type: String(v) } : { type: typeof v, keys: Object.keys(v).slice(0, 12) };
      return { ok: true, mode, signedIn: !!user, summary };
    } catch (e) { return { ok: false, mode, signedIn: !!user, code: e && e.code, message: e && e.message }; }
  }, fnSrc);
  out.push({ label, ...r });
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${label} — ${JSON.stringify(r)}`);
}
try {
  await probe('toko.html', 'products (aktif) · PPAPI.toko.listProducts()', 'products');
  await probe('toko.html', 'shop_settings/main · PPAPI.toko.getSettings()', 'settings');
  await probe('instruktur.html', 'instructors (published) · PPAPI.instruktur.list()', 'instructors');
  await probe('agenda.html', 'events (published) · PPAPI.kegiatan.listPublished()', 'events');
  await probe('sertifikat.html', 'certificates lookup · PPAPI.kegiatan.verify("PPAPI/SERT/2026/WEB1025/0001")', 'certificate');
  await probe('toko.html', 'RAW products where aktif == true', 'rawProducts');
  await probe('toko.html', 'RAW shop_settings/main get', 'rawSettings');
  await probe('instruktur.html', 'RAW instructors where published == true', 'rawInstructors');
  await probe('agenda.html', 'RAW events where status == terbit', 'rawEvents');
  await probe('sertifikat.html', 'RAW certificates/{id} get', 'rawCertificate');
} finally {
  await browser.close();
}
const bad = out.filter(x => !x.ok || /permission/i.test(String(x.code || '') + String(x.message || '')));
console.log(`\n${out.length - bad.length}/${out.length} public reads OK`);
process.exit(bad.length ? 1 : 0);
