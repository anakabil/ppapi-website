import { chromium } from 'playwright'; import fs from 'node:fs';
const PW = fs.readFileSync(process.argv[2], 'utf8').trim();
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage();
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async ({ PW }) => {
  const out = [];
  await PPAPI.auth.signInEmail({ email: 'ppapi.indonesia@gmail.com', password: PW });
  const f = await PPAPI.auth._firebase(); const u = f.auth.currentUser; await u.reload(); await u.getIdToken(true);
  const ref = f.db.collection('admins').doc(u.uid);
  const s = await ref.get();
  if (!s.exists) {
    try { await ref.set({ uid: u.uid, name: 'Sekretariat PPAPI', email: 'ppapi.indonesia@gmail.com', addedAt: '2026-10-15', addedBy: 'bootstrap' }); out.push('bootstrap admin: CREATED'); }
    catch (e) { out.push('bootstrap admin: ' + e.code + ' (aturan bootstrap belum aktif?)'); }
  } else out.push('admin doc already exists: ' + JSON.stringify(s.data()));
  PPAPI.auth._clearAdminCache && PPAPI.auth._clearAdminCache();
  out.push('isAdmin: ' + await PPAPI.auth.isAdmin());
  try { const l = await f.db.collection('members').get(); out.push('members (admin list): ' + l.docs.map(d => d.id + ' ' + (d.data().name || '?') + ' [' + d.data().status + ']').join(' | ')); } catch (e) { out.push('members list: ' + e.code); }
  await PPAPI.auth.signOut(); return out;
}, { PW });
console.log(r.join('\n')); await b.close();
