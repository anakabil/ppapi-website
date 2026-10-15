import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(async () => {
  const out = [];
  await PPAPI.auth.signInEmail({ email: 'uji-situs-ppapi-820419@example.com', password: 'UjiSitus2026x' });
  const f = await PPAPI.auth._firebase(); const uid = f.auth.currentUser.uid; const ref = f.db.collection('members').doc(uid);
  const ts = () => f.fb.firestore.FieldValue.serverTimestamp();
  // Does the FIELD NAME matter? write the same empty map under other allowed keys vs 'application'
  for (const [label, patch] of [
    ['profile: {}', { profile: {}, updatedAt: ts() }],
    ['application: {} (no updatedAt)', { application: {} }],
    ['application: {updatedAt: serverTs}', { application: { updatedAt: ts() }, updatedAt: ts() }],
    ['application: {submittedAt: "", updatedAt: serverTs}', { application: { submittedAt: '', updatedAt: ts() }, updatedAt: ts() }],
    ['application.kategori via dot path', { 'application.kategori': 'Praktisi', updatedAt: ts() }],
  ]) { try { await ref.update(patch); out.push(label + ': OK'); } catch (e) { out.push(label + ': ' + e.code); } }
  const s = await ref.get(); out.push('doc now: ' + JSON.stringify(s.data()).slice(0, 400));
  return out;
});
console.log(r.join('\n')); await b.close();
