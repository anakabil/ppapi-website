import { chromium } from 'playwright'; import fs from 'node:fs';
const PW = fs.readFileSync(process.argv[2], 'utf8').trim();
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage();
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async ({ PW }) => {
  const out = {};
  await PPAPI.auth.signInEmail({ email: 'ppapi.indonesia@gmail.com', password: PW });
  const f = await PPAPI.auth._firebase(); const u = f.auth.currentUser; await u.reload();
  out.emailVerified = u.emailVerified;
  try { const s = await f.db.collection('admins').doc(u.uid).get(); out.adminDoc = s.exists ? s.data() : 'TIDAK ADA'; } catch (e) { out.adminDoc = 'ERR ' + e.code; }
  out.isAdmin = await PPAPI.auth.isAdmin();
  try { const m = await PPAPI.store.ensureMember(PPAPI.auth.current()); out.memberDoc = m.status; } catch (e) { out.memberDoc = 'ERR ' + e.code; }
  try { await f.db.collection('members').doc(u.uid).set({ profile: { city: 'Jakarta' }, updatedAt: f.fb.firestore.FieldValue.serverTimestamp() }, { merge: true }); out.rulesV3 = 'aktif'; } catch (e) { out.rulesV3 = 'belum (' + e.code + ')'; }
  try { const l = await f.db.collection('members').get(); out.membersVisibleToAdmin = l.docs.map(d => d.id + ':' + (d.data().name || '?')); } catch (e) { out.membersVisibleToAdmin = 'ERR ' + e.code; }
  await PPAPI.auth.signOut();
  return out;
}, { PW });
console.log(JSON.stringify(r, null, 1)); await b.close();
