import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const EMAIL = 'uji-situs-ppapi-820419@example.com', PASS = 'UjiSitus2026x';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(async ({ EMAIL, PASS }) => {
  const out = [];
  await PPAPI.auth.signInEmail({ email: EMAIL, password: PASS });
  const f = await PPAPI.auth._firebase(); const uid = f.auth.currentUser.uid;
  const full = PPAPI.store.defaultMember(PPAPI.auth.current());
  const ref = f.db.collection('members').doc(uid);
  try { const a = await f.db.collection('admins').doc(uid).get(); out.push('admins self get: ' + (a.exists ? 'exists' : 'missing (allowed)')); } catch (e) { out.push('admins self get: ERR ' + e.code); }
  const variants = [
    ['minimal', { uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt }],
    ['+strings', { uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt, name: full.name, email: '', phone: '', photoURL: '', kta: '', validUntil: '', approvedAt: '', approvedBy: '' }],
    ['+times', { uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt, createdAt: full.createdAt, updatedAt: full.updatedAt }],
    ['+profile', { uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt, profile: full.profile }],
    ['+lists', { uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt, competencies: [], certificates: [] }],
    ['+review', { uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt, review: { note: '', history: [] } }],
    ['+application', { uid, memberType: 'Praktisi', status: 'Draf', joinedAt: full.joinedAt, application: full.application }],
    ['full', full],
  ];
  for (const [label, doc] of variants) {
    try { await ref.set(doc); out.push(label + ': CREATED'); break; } catch (e) { out.push(label + ': ' + e.code); }
  }
  return out;
}, { EMAIL, PASS });
console.log(r.join('\n')); await b.close();
