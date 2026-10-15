import { chromium } from 'playwright'; import fs from 'node:fs';
const PW = fs.readFileSync(process.argv[2], 'utf8').trim();
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage();
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async ({ PW }) => {
  const out = [];
  await PPAPI.auth.signInEmail({ email: 'ppapi.indonesia@gmail.com', password: PW });
  const u = PPAPI.auth.current(); const f = await PPAPI.auth._firebase(); const ref = f.db.collection('members').doc(u.uid);
  const ts = () => f.fb.firestore.FieldValue.serverTimestamp();
  const full = PPAPI.store.defaultMember(u);
  const s0 = await ref.get(); out.push('member doc exists: ' + s0.exists);
  if (!s0.exists) {
    for (const [label, doc] of [['full default (store shape)', full], ['minimal', { uid: u.uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt }]]) {
      try { await ref.set(doc); out.push('create ' + label + ': CREATED'); break; } catch (e) { out.push('create ' + label + ': ' + e.code); }
    }
  }
  for (const [label, patch] of [
    ['update application full', { application: Object.assign({}, full.application, { updatedAt: ts() }), updatedAt: ts() }],
    ['update profile full (v3 marker)', { profile: full.profile, updatedAt: ts() }],
    ['update competencies+certificates', { competencies: [], certificates: [], updatedAt: ts() }],
    ['update name', { name: 'Sekretariat PPAPI', updatedAt: ts() }],
  ]) { try { await ref.set(patch, { merge: true }); out.push(label + ': OK'); } catch (e) { out.push(label + ': ' + e.code); } }
  try { const a = await f.db.collection('admins').doc(u.uid).get(); out.push('admins/' + u.uid + ': ' + (a.exists ? JSON.stringify(a.data()) : 'tidak ada')); } catch (e) { out.push('admins get: ' + e.code); }
  await PPAPI.auth.signOut(); return out;
}, { PW });
console.log(r.join('\n')); await b.close();
