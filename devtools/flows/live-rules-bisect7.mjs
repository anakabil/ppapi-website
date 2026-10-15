import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const out = [];
  await PPAPI.auth.signInEmail({ email: 'uji-situs-ppapi-2-54581@example.com', password: 'UjiSitus2026x' });
  const u = PPAPI.auth.current(); const f = await PPAPI.auth._firebase(); const ref = f.db.collection('members').doc(u.uid);
  const ts = () => f.fb.firestore.FieldValue.serverTimestamp();
  const t = async (label, patch) => { try { await ref.set(patch, { merge: false === true ? false : true }); out.push(label + ': OK'); } catch (e) { out.push(label + ': ' + e.code); } };
  // shrink application to minimal (allowed), then retry profile
  await t('shrink application', { application: { submittedAt: '', updatedAt: ts() }, updatedAt: ts() });
  await t('profile city after shrink', { profile: { city: 'Balikpapan' }, updatedAt: ts() });
  await t('profile full after shrink', { profile: PPAPI.store.defaultMember(u).profile, updatedAt: ts() });
  // now grow application back fully and retry a tiny profile change
  await t('application full again', { application: Object.assign(PPAPI.store.defaultMember(u).application, { updatedAt: ts() }), updatedAt: ts() });
  await t('profile city with full app', { profile: { city: 'Samarinda' }, updatedAt: ts() });
  await t('name with full app', { name: 'Akun Uji Dua', updatedAt: ts() });
  return out;
});
console.log(r.join('\n')); await b.close();
