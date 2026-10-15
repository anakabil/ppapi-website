import { chromium } from 'playwright'; import fs from 'node:fs';
const PW = fs.readFileSync(process.argv[2], 'utf8').trim();
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage();
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async ({ PW }) => {
  const out = [];
  // 1) delete the two test auth accounts (self-delete; member docs are removed later by the admin)
  for (const email of ['uji-situs-ppapi-820419@example.com', 'uji-situs-ppapi-2-54581@example.com']) {
    try {
      await PPAPI.auth.signInEmail({ email, password: 'UjiSitus2026x' });
      const f = await PPAPI.auth._firebase(); const uid = f.auth.currentUser.uid;
      await f.auth.currentUser.delete(); out.push('deleted auth user ' + email + ' (uid ' + uid + ')');
    } catch (e) { out.push('delete ' + email + ': ' + (e.code || e.message)); }
    try { await PPAPI.auth.signOut(); } catch (e) {}
  }
  // 2) create the admin account
  try {
    await PPAPI.auth.signUpEmail({ name: 'Sekretariat PPAPI', email: 'ppapi.indonesia@gmail.com', password: PW });
    const f = await PPAPI.auth._firebase(); const u = f.auth.currentUser;
    out.push('admin account created: ' + u.email + ' uid=' + u.uid + ' emailVerified=' + u.emailVerified);
    try { await u.sendEmailVerification(); out.push('verification email sent'); } catch (e) { out.push('verification email: ' + (e.code || e.message)); }
    try { const m = await PPAPI.store.ensureMember(PPAPI.auth.current()); out.push('member doc: ' + m.status); } catch (e) { out.push('member doc: ' + (e.code || e.message)); }
    await PPAPI.auth.signOut();
  } catch (e) { out.push('admin signup: ' + (e.code || e.message)); }
  return out;
}, { PW });
console.log(r.join('\n')); await b.close();
