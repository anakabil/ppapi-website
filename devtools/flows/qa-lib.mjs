// Shared helpers for the functional-QA flows (crawl.mjs, journey.mjs).
// Static server that behaves like GitHub Pages for this repo:
//   • "/"           → index.html
//   • "/x/"         → x/index.html
//   • missing path  → 404.html with HTTP 404 (any depth, e.g. /a/b/c)
// Optional prefix (e.g. "/ppapi") simulates a project site https://<user>.github.io/ppapi/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryFile, GALLERY } from './dev-gallery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..', 'site');
export const SHOTS = path.resolve(__dirname, '..', 'shots', 'qa');
fs.mkdirSync(SHOTS, { recursive: true });

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.rules': 'text/plain; charset=utf-8', '.ics': 'text/calendar; charset=utf-8',
};

export async function startServer({ prefix = '' } = {}) {
  const log = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    log.push(p);
    if (prefix) {
      if (p === prefix) { res.writeHead(301, { location: prefix + '/' }); return res.end(); }
      if (!p.startsWith(prefix + '/')) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end('<!doctype html><title>404</title>GitHub 404'); }
      p = p.slice(prefix.length);
    }
    if (p.endsWith('/')) p += 'index.html';
    let file = galleryFile(p) || path.join(ROOT, p);
    // GitHub Pages also serves "/berita" as "/berita.html"
    if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file = file + '.html';
    if (!(file.startsWith(ROOT) || file.startsWith(GALLERY)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const nf = path.join(ROOT, '404.html');
      res.writeHead(404, { 'content-type': MIME['.html'] });
      return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}${prefix}`;
  return { server, BASE, log, close: () => new Promise(r => server.close(r)) };
}

// Same seeded session as check.mjs --auth: an ACTIVE v2 member as an admin approval leaves it
// (validUntil, approvedAt/By, a submitted v2 application, empty review) PLUS its public registry entry.
export const DEMO_USER = {
  uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890',
  provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z',
};
export const DEMO_MEMBER = {
  uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone,
  kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
  approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah dengan pengalaman proyek kilang dan gedung bertingkat.' },
  competencies: [
    { id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' },
    { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' },
  ],
  certificates: [
    { id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' },
    { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' },
  ],
  updatedAt: '2026-09-30T08:00:00.000Z',
  application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: DEMO_USER.name, tanggal: '2026-03-15' }, catatan: '' },
  review: { note: '', history: [] },
};

/* store.js search keys of a registry entry: fold() → namaCari (lowercase, accent-free), words() → namaKata (whole
   words), ktaNomor() → the 6-digit number part of the KTA. Unknown keys are ignored by the demo lookup. */
const fold = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const words = (s) => fold(s).split(/[^a-z0-9]+/).filter(Boolean).slice(0, 10);
const ktaNomor = (kta) => { const x = /^PPAPI-\d{4}-(\d{6})$/.exec(String(kta || '')); return x ? x[1] : ''; };
/**
 * The public registry entry an admin decision writes for a member (mirrors store.js registryEntry():
 * approve / extend / deactivate / setMemberType). Only a member that was actually approved has one —
 * a KTA and approvedAt — so Draf / Menunggu Verifikasi / Perlu Perbaikan / Ditolak fixtures return null.
 */
export function registryEntryFor(m) {
  if (!m || !m.kta || !m.approvedAt) return null;
  return {
    kta: m.kta, nama: m.name, kategori: m.memberType,
    kompetensi: (m.competencies || []).map(c => c && c.name).filter(Boolean).slice(0, 5),
    kota: (m.profile && m.profile.city) || '', berlakuHingga: m.validUntil || '',
    status: m.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
    namaCari: fold(m.name), namaKata: words(m.name), ktaNomor: ktaNomor(m.kta), updatedAt: m.approvedAt,
  };
}
export const DEMO_REGISTRY_ENTRY = registryEntryFor(DEMO_MEMBER);

/** Seed a signed-in member once per tab (as after an approval): session, demo user, member record and,
 *  for an approved member, ppapi_registry[kta]. `member` overrides the fixture (e.g. a pending state). */
export async function seedAuth(context, { user = DEMO_USER, member = DEMO_MEMBER } = {}) {
  await context.addInitScript(({ u, m, r }) => {
    try {
      if (!localStorage.getItem('ppapi_demo_session') && !sessionStorage.getItem('__qa_seeded')) {
        sessionStorage.setItem('__qa_seeded', '1');
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
        users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
        localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        if (r) {
          let reg = JSON.parse(localStorage.getItem('ppapi_registry') || '{}');
          if (!reg || typeof reg !== 'object' || Array.isArray(reg)) reg = {};
          reg[r.kta] = r;
          localStorage.setItem('ppapi_registry', JSON.stringify(reg));
        }
      }
    } catch (e) {}
  }, { u: user, m: member, r: registryEntryFor(member) });
}

/** Freeze Date at 2026-10-08 10:00 WIB (03:00Z) but let it tick. */
export async function freezeClock(context, iso = '2026-10-08T03:00:00.000Z') {
  await context.addInitScript((fixed) => {
    const real = Date; const start = real.now(); const base = new real(fixed).getTime();
    class FakeDate extends real {
      constructor(...a) { if (a.length) super(...a); else super(base + (real.now() - start)); }
      static now() { return base + (real.now() - start); }
    }
    FakeDate.UTC = real.UTC; FakeDate.parse = real.parse;
    // eslint-disable-next-line no-global-assign
    window.Date = FakeDate;
  }, iso);
}

export async function waitReady(page, timeout = 15000) {
  try {
    await page.waitForFunction(() => window.PPAPI && typeof window.PPAPI.isReady === 'function' && window.PPAPI.isReady(), null, { timeout });
  } catch (e) { /* page may have no PPAPI (e.g. robots.txt) or redirected */ }
  await page.waitForTimeout(250);
}

/** Tiny assertion recorder. */
export function recorder(name) {
  const results = [];
  return {
    results,
    ok(label, cond, detail = '') {
      results.push({ pass: !!cond, label, detail: String(detail || '') });
      console.log(`${cond ? '  PASS' : '  FAIL'}  ${label}${detail ? '  — ' + String(detail).slice(0, 300) : ''}`);
      return !!cond;
    },
    info(label, detail = '') { console.log(`  INFO  ${label}${detail ? '  — ' + String(detail).slice(0, 400) : ''}`); },
    summary() {
      const f = results.filter(r => !r.pass);
      console.log(`\n${name}: ${results.length - f.length}/${results.length} passed, ${f.length} failed`);
      if (f.length) console.log('Failures:\n' + f.map(r => '  - ' + r.label + (r.detail ? ' — ' + r.detail.slice(0, 300) : '')).join('\n'));
      return f.length;
    },
  };
}

export function attachIssueLog(page, sink, tag = '') {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) sink.push(`${tag}console.${m.type()}: ${m.text().slice(0, 300)} @ ${page.url()}`); });
  page.on('pageerror', e => sink.push(`${tag}pageerror: ${e.message.slice(0, 300)} @ ${page.url()}`));
  page.on('requestfailed', r => {
    const u = r.url();
    if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return; // offline-tolerant
    sink.push(`${tag}requestfailed: ${u} (${r.failure()?.errorText}) @ ${page.url()}`);
  });
}
