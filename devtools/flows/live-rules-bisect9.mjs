import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const out = [];
  await PPAPI.auth.signInEmail({ email: 'uji-situs-ppapi-820419@example.com', password: 'UjiSitus2026x' });
  const u = PPAPI.auth.current(); const f = await PPAPI.auth._firebase(); const ref = f.db.collection('members').doc(u.uid);
  const ts = () => f.fb.firestore.FieldValue.serverTimestamp();
  const t = async (label, patch) => { try { await ref.set(patch, { merge: true }); out.push(label + ': OK'); } catch (e) { out.push(label + ': ' + e.code); } };
  await t('acct1 name (profile {} + full app present)', { name: 'Akun Uji Situs', updatedAt: ts() });
  await t('acct1 phone', { phone: '', updatedAt: ts() });
  await t('acct1 competencies []', { competencies: [], updatedAt: ts() });
  await t('acct1 application minimal', { application: { submittedAt: '', updatedAt: ts() }, updatedAt: ts() });
  await t('acct1 name after app minimal', { name: 'Akun Uji Situs', updatedAt: ts() });
  await t('acct1 profile {} after app minimal', { profile: {}, updatedAt: ts() });
  return out;
});
console.log(r.join('\n')); await b.close();
