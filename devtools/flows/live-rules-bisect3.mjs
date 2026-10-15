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
  const cases = {
    'type': { type: 'baru' }, 'kategori': { kategori: '' }, 'submittedAt+updatedAt empty': { submittedAt: '', updatedAt: '' },
    'pengalaman+dokumen': { pengalaman: [], dokumen: [] }, 'pasFoto+pasFotoAda': { pasFoto: '', pasFotoAda: false },
    'pembayaran': { pembayaran: A.pembayaran }, 'pernyataan': { pernyataan: A.pernyataan }, 'catatan': { catatan: '' },
    'empty map': {},
  };
  for (const [label, app] of Object.entries(cases)) {
    try { await ref.update({ application: app, updatedAt: ts() }); out.push(label + ': OK'); } catch (e) { out.push(label + ': ' + e.code); }
  }
  return out;
});
console.log(r.join('\n')); await b.close();
