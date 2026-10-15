import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + 'masuk.html', { waitUntil: 'load' }); await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const out = [];
  // account 2 has no member doc yet → ensureMember must now CREATE the full default doc
  await PPAPI.auth.signInEmail({ email: 'uji-situs-ppapi-2-54581@example.com', password: 'UjiSitus2026x' });
  const u = PPAPI.auth.current();
  const f = await PPAPI.auth._firebase(); const ref = f.db.collection('members').doc(u.uid);
  const s0 = await ref.get(); out.push('acct2 doc before: ' + (s0.exists ? 'exists ' + Object.keys(s0.data()).length + ' keys' : 'missing'));
  if (s0.exists && Object.keys(s0.data()).length < 10) { try { await ref.update({ application: PPAPI.store.defaultMember(u).application, updatedAt: f.fb.firestore.FieldValue.serverTimestamp() }); out.push('update full application: OK'); } catch (e) { out.push('update full application: ' + e.code); } }
  try { const m = await PPAPI.store.ensureMember(u); out.push('ensureMember: OK ' + m.status); } catch (e) { out.push('ensureMember: ERR ' + e.code + ' ' + e.message); }
  try { const m = await PPAPI.store.saveApplication(u.uid, { kategori: 'Praktisi', pengalaman: [{ id: 'p1', proyek: 'Proyek Uji', peran: 'Supervisor', tahun: 2024, lokasi: 'Balikpapan' }], pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Akun Uji Dua', tanggal: '2026-10-15' } }); out.push('saveApplication: OK kategori=' + m.application.kategori); } catch (e) { out.push('saveApplication: ERR ' + e.code + ' ' + e.message); }
  try { const m = await PPAPI.store.saveMember(u.uid, { phone: '', profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Uji', position: 'Supervisor', birthDate: '1990-01-01' } }); out.push('saveMember: OK city=' + m.profile.city); } catch (e) { out.push('saveMember: ERR ' + e.code + ' ' + e.message); }
  try { await PPAPI.store.submitApplication(u.uid); const m = await PPAPI.store.getMember(u.uid); out.push('submitApplication: ' + m.status + ' submittedAt=' + String(m.application.submittedAt).slice(0, 25)); } catch (e) { out.push('submitApplication: ERR ' + e.code + ' ' + e.message + ' missing=' + JSON.stringify(e.missing || [])); }
  try { await PPAPI.store.withdrawApplication(u.uid); const m = await PPAPI.store.getMember(u.uid); out.push('withdrawApplication: ' + m.status); } catch (e) { out.push('withdrawApplication: ERR ' + e.code + ' ' + e.message); }
  // attack: owner tries to self-approve
  try { await ref.update({ status: 'Aktif', kta: 'PPAPI-2026-999999', updatedAt: f.fb.firestore.FieldValue.serverTimestamp() }); out.push('ATTACK self-approve: ALLOWED (BUG)'); } catch (e) { out.push('attack self-approve: denied ✓'); }
  try { await f.db.collection('members').doc('1Ec0vqDWlxf4vGWWmiQ4wGrHHAK2').get(); out.push('ATTACK read other member: ALLOWED (BUG)'); } catch (e) { out.push('attack read other member: denied ✓'); }
  return out;
});
console.log(r.join('\n')); await b.close();
