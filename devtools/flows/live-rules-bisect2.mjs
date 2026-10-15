import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(async () => {
  const out = [];
  // A) update path on account 1 (doc exists)
  await PPAPI.auth.signInEmail({ email: 'uji-situs-ppapi-820419@example.com', password: 'UjiSitus2026x' });
  let f = await PPAPI.auth._firebase(); let uid = f.auth.currentUser.uid; const full = PPAPI.store.defaultMember(PPAPI.auth.current());
  const ts = () => f.fb.firestore.FieldValue.serverTimestamp();
  let ref = f.db.collection('members').doc(uid);
  for (const [label, patch] of [
    ['upd name', { name: full.name, updatedAt: ts() }],
    ['upd profile', { profile: full.profile, updatedAt: ts() }],
    ['upd lists', { competencies: [], certificates: [], updatedAt: ts() }],
    ['upd application', { application: full.application, updatedAt: ts() }],
    ['upd email/phone/photo empty', { email: '', phone: '', photoURL: '', updatedAt: ts() }],
  ]) { try { await ref.update(patch); out.push(label + ': OK'); } catch (e) { out.push(label + ': ' + e.code); } }
  await PPAPI.auth.signOut();
  // B) create path on a fresh account 2
  const EMAIL2 = 'uji-situs-ppapi-2-' + String(Date.now()).slice(-5) + '@example.com';
  await PPAPI.auth.signUpEmail({ name: 'Akun Uji Dua', email: EMAIL2, password: 'UjiSitus2026x' }).catch(e => out.push('signup2 ' + e.code));
  f = await PPAPI.auth._firebase(); uid = f.auth.currentUser.uid; ref = f.db.collection('members').doc(uid);
  const snap = await ref.get().catch(() => null); out.push('acct2 doc after signup: ' + (snap && snap.exists ? 'EXISTS (ensureMember succeeded)' : 'missing'));
  const base = { uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt };
  if (!(snap && snap.exists)) for (const [label, extra] of [
    ['review', { review: { note: '', history: [] } }],
    ['application', { application: full.application }],
    ['profile', { profile: full.profile }],
    ['times', { createdAt: full.createdAt, updatedAt: full.updatedAt }],
    ['strings', { name: 'Akun Uji Dua', email: '', phone: '', photoURL: '', kta: '', validUntil: '', approvedAt: '', approvedBy: '' }],
    ['lists', { competencies: [], certificates: [] }],
  ]) { try { await ref.set(Object.assign({}, base, extra)); out.push('create ' + label + ': CREATED'); break; } catch (e) { out.push('create ' + label + ': ' + e.code); } }
  out.push('ACCOUNT2 ' + EMAIL2 + ' ' + uid);
  return out;
});
console.log(r.join('\n')); await b.close();
