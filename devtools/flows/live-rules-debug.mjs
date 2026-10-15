import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const EMAIL = 'uji-situs-ppapi-820419@example.com', PASS = 'UjiSitus2026x';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
const r = await page.evaluate(async ({ EMAIL, PASS }) => {
  const out = {};
  try { await PPAPI.auth.signInEmail({ email: EMAIL, password: PASS }); out.signIn = 'ok'; } catch (e) { out.signIn = e.code + ' ' + e.message; }
  const f = await PPAPI.auth._firebase(); const u = f.auth.currentUser; out.uid = u && u.uid; out.emailVerified = u && u.emailVerified;
  const ref = f.db.collection('members').doc(u.uid);
  try { const s = await ref.get(); out.get = s.exists ? 'exists: ' + JSON.stringify(s.data()).slice(0, 300) : 'missing'; } catch (e) { out.get = 'ERR ' + e.code + ' ' + e.message; }
  try { const m = await PPAPI.store.getMember(u.uid); out.storeGet = m ? 'member ' + m.status : 'null'; } catch (e) { out.storeGet = 'ERR ' + e.code + ' ' + e.message; }
  try { const m = await PPAPI.store.ensureMember(PPAPI.auth.current()); out.ensure = 'ok ' + m.status; } catch (e) { out.ensure = 'ERR ' + e.code + ' ' + e.message + ' ' + (e.cause && e.cause.code); }
  out.defaultMember = PPAPI.store.defaultMember ? JSON.stringify(PPAPI.store.defaultMember(PPAPI.auth.current())).slice(0, 600) : 'n/a';
  return out;
}, { EMAIL, PASS });
console.log(JSON.stringify(r, null, 1)); await b.close();
