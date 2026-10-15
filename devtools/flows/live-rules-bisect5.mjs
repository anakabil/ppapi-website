import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(async () => {
  const out = [];
  await PPAPI.auth.signInEmail({ email: 'uji-situs-ppapi-820419@example.com', password: 'UjiSitus2026x' });
  const f = await PPAPI.auth._firebase(); const uid = f.auth.currentUser.uid; const ref = f.db.collection('members').doc(uid);
  const ts = () => f.fb.firestore.FieldValue.serverTimestamp();
  const A = PPAPI.store.defaultMember(PPAPI.auth.current()).application;
  const base = () => ({ submittedAt: '', updatedAt: ts() });
  const cases = {
    'base': {}, 'type': { type: 'baru' }, 'kategori': { kategori: '' }, 'pengalaman': { pengalaman: [] }, 'dokumen': { dokumen: [] },
    'pasFoto': { pasFoto: '' }, 'pasFotoAda': { pasFotoAda: false }, 'pembayaran': { pembayaran: A.pembayaran },
    'pernyataan': { pernyataan: A.pernyataan }, 'pernyataan bools only': { pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false } },
    'pernyataan strings only': { pernyataan: { namaTerang: '', tanggal: '' } }, 'catatan': { catatan: '' },
  };
  for (const [label, extra] of Object.entries(cases)) {
    try { await ref.update({ application: Object.assign(base(), extra), updatedAt: ts() }); out.push(label + ': OK'); } catch (e) { out.push(label + ': ' + e.code); }
  }
  return out;
});
console.log(r.join('\n')); await b.close();
