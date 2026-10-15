import { chromium } from 'playwright'; import fs from 'node:fs';
const PW = fs.readFileSync(process.argv[2], 'utf8').trim();
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const issues = []; page.on('pageerror', e => issues.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') issues.push('console ' + m.text().slice(0, 160)); });
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async ({ PW }) => {
  const out = []; const S = PPAPI.store;
  const TEST_EMAIL = 'uji-siklus-' + String(Date.now()).slice(-5) + '@example.com', TEST_PW = 'UjiSiklus2026x';
  // --- 0) admin: purge leftover test member docs
  await PPAPI.auth.signInEmail({ email: 'ppapi.indonesia@gmail.com', password: PW });
  let f = await PPAPI.auth._firebase();
  for (const id of ['TMvNvGhywIStU57xxWzTerkudzJ3', '1Ec0vqDWlxf4vGWWmiQ4wGrHHAK2']) {
    try { const s = await f.db.collection('members').doc(id).get(); if (s.exists) { await f.db.collection('members').doc(id).delete(); out.push('purged members/' + id); } } catch (e) { out.push('purge ' + id + ': ' + e.code); }
  }
  await PPAPI.auth.signOut();
  // --- 1) new member registers, fills, submits
  await PPAPI.auth.signUpEmail({ name: 'Anggota Uji Siklus', email: TEST_EMAIL, password: TEST_PW });
  const mu = PPAPI.auth.current(); f = await PPAPI.auth._firebase();
  try { await S.ensureMember(mu); out.push('member created: Draf'); } catch (e) { out.push('ensureMember: ' + e.code); }
  try { await S.saveMember(mu.uid, { phone: '+6281200000001', profile: { birthDate: '1990-05-05', birthPlace: 'Samarinda', gender: 'Laki-laki', province: 'Kalimantan Timur', city: 'Balikpapan', address: 'Jl. Uji No. 1', company: 'PT Uji Siklus', position: 'Supervisor Perancah', experienceYears: 8, education: 'D3' } }); out.push('profile saved'); } catch (e) { out.push('saveMember: ' + e.code + ' ' + e.message); }
  try { await S.saveApplication(mu.uid, { kategori: 'Praktisi', pengalaman: [{ id: 'p1', proyek: 'Proyek Uji', peran: 'Supervisor', tahun: 2024, lokasi: 'Balikpapan' }], pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Anggota Uji Siklus', tanggal: '2026-10-15' } }); out.push('application saved'); } catch (e) { out.push('saveApplication: ' + e.code + ' ' + e.message); }
  try { await S.submitApplication(mu.uid); const m = await S.getMember(mu.uid); out.push('submitted: ' + m.status); } catch (e) { out.push('submit: ' + e.code + ' ' + e.message + ' ' + JSON.stringify(e.missing || [])); }
  const memberUid = mu.uid; await PPAPI.auth.signOut();
  // --- 2) admin approves
  await PPAPI.auth.signInEmail({ email: 'ppapi.indonesia@gmail.com', password: PW }); f = await PPAPI.auth._firebase();
  try { const q = await S.admin.listMembers({ status: 'Menunggu Verifikasi' }); out.push('queue: ' + q.map(m => m.name).join(', ')); } catch (e) { out.push('listMembers: ' + e.code); }
  let kta = '';
  try { const m = await S.admin.approve(memberUid, { memberType: 'Praktisi', validUntil: '2029-12-31', note: 'Uji siklus' }); kta = m.kta; out.push('approved: ' + m.status + ' KTA=' + m.kta); } catch (e) { out.push('approve: ' + e.code + ' ' + e.message); }
  try { const r = await S.registry.lookup(kta); out.push('registry lookup: ' + (r.exact ? r.exact.nama + ' ' + r.exact.status : 'tidak ditemukan')); } catch (e) { out.push('registry: ' + e.code); }
  try { const a = await S.admin.audit(5); out.push('audit entries: ' + a.length); } catch (e) { out.push('audit: ' + e.code); }
  await PPAPI.auth.signOut();
  // --- 3) member sees active features
  await PPAPI.auth.signInEmail({ email: TEST_EMAIL, password: TEST_PW });
  const sess = await PPAPI.session.refresh(); out.push('member session: status=' + sess.status + ' isActive=' + sess.isActive);
  try { const url = await S.pustaka.fileUrl({ id: 'x', akses: 'anggota', tautan: 'https://example.com/doc.pdf' }); out.push('pustaka fileUrl for active member: ' + (url ? 'OK' : 'kosong')); } catch (e) { out.push('pustaka: ' + e.code); }
  // --- 4) cleanup: member deletes own auth user; admin deletes member doc + registry entry
  f = await PPAPI.auth._firebase(); await f.auth.currentUser.delete(); out.push('test auth user deleted');
  await PPAPI.auth.signInEmail({ email: 'ppapi.indonesia@gmail.com', password: PW }); f = await PPAPI.auth._firebase();
  try { await f.db.collection('members').doc(memberUid).delete(); out.push('members doc deleted'); } catch (e) { out.push('delete member doc: ' + e.code); }
  try { if (kta) { await f.db.collection('registry').doc(kta).delete(); out.push('registry entry deleted'); } } catch (e) { out.push('delete registry: ' + e.code); }
  try { const l = await f.db.collection('members').get(); out.push('members remaining: ' + l.docs.map(d => d.data().name + ' [' + d.data().status + ']').join(', ')); } catch (e) {}
  await PPAPI.auth.signOut(); return out;
}, { PW });
console.log(r.join('\n')); console.log(issues.length ? 'ISSUES:\n  ' + issues.join('\n  ') : 'no console/page errors');
// admin console page in the browser
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1200);
await page.evaluate(async ({ PW }) => { await PPAPI.auth.signInEmail({ email: 'ppapi.indonesia@gmail.com', password: PW }); }, { PW });
await page.goto(BASE + 'admin.html', { waitUntil: 'load' }); await page.waitForTimeout(4000);
await page.screenshot({ path: 'shots/live-admin-console.png' });
console.log('admin.html →', page.url().replace(BASE, '/'), '| h1:', await page.locator('h1').first().textContent().catch(() => '?'));
await page.evaluate(() => PPAPI.auth.signOut()); await b.close();
