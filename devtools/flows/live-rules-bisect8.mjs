import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const out = [];
  async function run(email, label0) {
    await PPAPI.auth.signInEmail({ email, password: 'UjiSitus2026x' });
    const u = PPAPI.auth.current(); const f = await PPAPI.auth._firebase(); const ref = f.db.collection('members').doc(u.uid);
    const ts = () => f.fb.firestore.FieldValue.serverTimestamp();
    const d = (await ref.get()).data(); out.push(label0 + ' keys: ' + Object.keys(d).sort().join(','));
    for (const [label, patch] of [
      ['profile {}', { profile: {}, updatedAt: ts() }],
      ["profile {city:''}", { profile: { city: '' }, updatedAt: ts() }],
      ["profile {city:'x'}", { profile: { city: 'x' }, updatedAt: ts() }],
      ['profile {experienceYears:null}', { profile: { experienceYears: null }, updatedAt: ts() }],
      ['profile {experienceYears:5}', { profile: { experienceYears: 5 }, updatedAt: ts() }],
    ]) { try { await ref.set(patch, { merge: true }); out.push('  ' + label + ': OK'); } catch (e) { out.push('  ' + label + ': ' + e.code); } }
    await PPAPI.auth.signOut();
  }
  await run('uji-situs-ppapi-2-54581@example.com', 'acct2');
  await run('uji-situs-ppapi-820419@example.com', 'acct1');
  return out;
});
console.log(r.join('\n')); await b.close();
