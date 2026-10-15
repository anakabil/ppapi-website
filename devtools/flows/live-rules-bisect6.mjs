import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const out = [];
  await PPAPI.auth.signInEmail({ email: 'uji-situs-ppapi-2-54581@example.com', password: 'UjiSitus2026x' });
  const u = PPAPI.auth.current(); const f = await PPAPI.auth._firebase(); const ref = f.db.collection('members').doc(u.uid);
  const ts = () => f.fb.firestore.FieldValue.serverTimestamp();
  const d = (await ref.get()).data(); out.push('doc keys: ' + Object.keys(d).sort().join(',') + ' | profile=' + JSON.stringify(d.profile) + ' | app.updatedAt type=' + typeof d.application.updatedAt + ' submittedAt=' + JSON.stringify(d.application.submittedAt));
  for (const [label, patch] of [
    ['phone empty', { phone: '', updatedAt: ts() }],
    ['profile city (set merge)', { profile: { city: 'Balikpapan' }, updatedAt: ts() }],
    ['profile full', { profile: PPAPI.store.defaultMember(u).profile, updatedAt: ts() }],
    ['profile birthDate', { profile: { birthDate: '1990-01-01' }, updatedAt: ts() }],
    ['name', { name: 'Akun Uji Dua', updatedAt: ts() }],
  ]) { try { await ref.set(patch, { merge: true }); out.push(label + ': OK'); } catch (e) { out.push(label + ': ' + e.code); } }
  try { const m = await PPAPI.store.saveMember(u.uid, { profile: { city: 'Balikpapan' } }); out.push('store.saveMember profile only: OK'); } catch (e) { out.push('store.saveMember profile only: ' + e.code); }
  try { const m = await PPAPI.store.saveMember(u.uid, { phone: '' }); out.push('store.saveMember phone: OK'); } catch (e) { out.push('store.saveMember phone: ' + e.code); }
  return out;
});
console.log(r.join('\n')); await b.close();
