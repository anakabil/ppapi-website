import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage();
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  await PPAPI.auth.signInEmail({ email: 'uji-situs-ppapi-2-54581@example.com', password: 'UjiSitus2026x' });
  const u = PPAPI.auth.current(); const f = await PPAPI.auth._firebase();
  try { await f.db.collection('members').doc(u.uid).set({ profile: { city: 'Balikpapan' }, updatedAt: f.fb.firestore.FieldValue.serverTimestamp() }, { merge: true }); return 'v3 LIVE (profile write OK)'; } catch (e) { return 'rules v3 not live yet: ' + e.code; }
});
console.log(r); await b.close();
