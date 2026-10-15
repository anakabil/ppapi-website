// Security lens v2 — approved member renames themself after approval: KTA card vs public registry,
// and a pending applicant edits reviewed profile data while "Menunggu Verifikasi" (demo store).
// Run from devtools/:  node flows/sec-v2-kta-name.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { BASE, close } = await startServer();
const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const MEMBER = { uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', profile: { city: 'Balikpapan' }, competencies: [], certificates: [], application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z' } };
const REG = { 'PPAPI-2026-004821': { kta: 'PPAPI-2026-004821', nama: 'Rahmat Hidayat', kategori: 'Praktisi', kompetensi: [], kota: 'Balikpapan', berlakuHingga: '2029-12-31', status: 'Aktif' } };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(s => { try { if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1'); localStorage.setItem('ppapi_demo_seed_v2', '{"v":2}'); localStorage.setItem('ppapi_demo_session', JSON.stringify(s.u)); localStorage.setItem('ppapi_member_' + s.u.uid, JSON.stringify(s.m)); localStorage.setItem('ppapi_registry', JSON.stringify(s.r)); } catch (e) {} }, { u: USER, m: MEMBER, r: REG });
const page = await ctx.newPage();
await page.goto(`${BASE}/anggota.html#kartu`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const before = await page.evaluate(() => (document.querySelector('.agt-kta__name') || {}).textContent);
/* release QA 2026-10-09: the store now refuses the rename (store/identity-locked; rules: identityKept) */
const saved = await page.evaluate(async () => { try { return (await PPAPI.store.saveMember(PPAPI.auth.current().uid, { name: 'Ir. Budi Santoso, M.T.' })).name; } catch (e) { return e.code; } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const after = await page.evaluate(() => (document.querySelector('.agt-kta__name') || {}).textContent);
await page.screenshot({ path: path.resolve(__dirname, '..', 'shots', 'sec-v2-kta-renamed.png') });
const reg = await page.evaluate(async () => (await PPAPI.store.registry.lookup('PPAPI-2026-004821')).exact.nama);
console.log('KTA card name before:', before, '| saveMember(name) →', saved, '| KTA card after:', after, '| public registry name:', reg);
/* pending applicant edits reviewed data */
const r2 = await page.evaluate(async () => {
  const uid = PPAPI.auth.current().uid;
  const m = JSON.parse(localStorage.getItem('ppapi_member_' + uid));
  m.status = 'Menunggu Verifikasi'; m.kta = ''; m.approvedAt = ''; m.validUntil = ''; m.application.submittedAt = '2026-10-08T01:00:00Z';
  localStorage.setItem('ppapi_member_' + uid, JSON.stringify(m));
  const out = {};
  try { out.app = (await PPAPI.store.saveApplication(uid, { catatan: 'x' })).status; } catch (e) { out.app = e.code; }
  try { const x = await PPAPI.store.saveMember(uid, { name: 'Nama Diganti', profile: { company: 'Perusahaan Lain', experienceYears: 30 }, certificates: [{ title: 'Ahli K3 Utama', issuer: 'Kemnaker' }] }); out.profile = [x.status, x.name, x.profile.company, x.profile.experienceYears, x.certificates.length]; } catch (e) { out.profile = e.code; }
  return out;
});
console.log('While Menunggu Verifikasi: saveApplication →', r2.app, '| saveMember(name/profile/certificates) →', JSON.stringify(r2.profile));
await browser.close(); await close();
