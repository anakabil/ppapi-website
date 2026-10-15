// PPAPI foundation — CONTRACT test (SPEC §2.2 JS API, §2.4 data, §2.5 CSS classes, §2.1 gating).
// Run from devtools/:  node flows/contract.mjs            (needs no internet; fonts may 404 offline — ignored)
//
// What it does
//  • Node side: every SPEC §2.5 class exists in main.css; data files parse and match SPEC §2.4
//    (unique ids, ISO dates, agenda upcoming/past split relative to 2026-10-08, gambar files exist,
//    regulasi fields complete + cross-checked with devtools/research/regulasi.json, icon names valid,
//    config.contact/social only contain values verified in devtools/research/ppapi.json).
//  • Browser side (Chromium, clock frozen at 2026-10-08 10:00 WIB, Asia/Jakarta):
//    every PPAPI.util / icon / ui / auth / store member from SPEC §2.2 exists and behaves as specified,
//    on styleguide.html and on throwaway pages site/__test_*.html (created here and DELETED at the end).
//  • Gating: data-auth="required" → masuk.html?next=…, data-auth="guest" + session → next / dashboard.html.
//
// Exit code 1 when any check fails; every failure is listed at the end.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV = path.resolve(__dirname, '..');
const ROOT = path.resolve(DEV, '..', 'site');
const TODAY = '2026-10-08';
const FIXED_NOW = new Date('2026-10-08T10:00:00+07:00');

/* ------------------------------------------------------------------ report */
let passed = 0;
const failures = [];
let section = '';
function sect(name) { section = name; console.log(`\n── ${name}`); }
function ok(cond, msg, detail) {
  if (cond) { passed++; console.log('  ✓ ' + msg); return true; }
  failures.push(`[${section}] ${msg}` + (detail !== undefined ? `  → ${JSON.stringify(detail)}` : ''));
  console.log('  ✗ ' + msg + (detail !== undefined ? `\n      ${JSON.stringify(detail)}` : ''));
  return false;
}
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), msg, JSON.stringify(a) === JSON.stringify(b) ? undefined : { got: a, want: b });

/* ------------------------------------------------------------- SPEC lists */
const SPEC_ICONS = `arrow-right arrow-up-right arrow-left external menu close user users user-plus mail phone lock eye eye-off calendar clock map-pin file-text download search filter check check-circle alert-triangle info shield shield-check award certificate hard-hat layers settings logout edit plus trash upload link chevron-down chevron-right chevron-left chevron-up building book scale message send star star-filled grid compass wrench ruler activity bell bookmark briefcase globe home id-card qr-code printer share copy refresh instagram linkedin youtube facebook whatsapp google`.split(/\s+/);
const SPEC_CLASSES = `container container--narrow section section--tight section--dark section--bone grid grid--2 grid--3 grid--4 stack stack--sm stack--lg cluster split sr-only skip-link
eyebrow display h1 h2 h3 h4 lead muted serif cond prose index-num
page-hero page-hero--compact hero-media breadcrumb
btn btn--primary btn--ghost btn--link btn--sm btn--lg btn--block btn--danger icon-btn btn__icon
card card--hover card--dark card__media card__meta card__title card__body card__footer feature stat stat__num stat__label news-card event-row date-block list-rule kv timeline person
badge badge--ok badge--warn badge--err badge--muted badge--outline badge--contoh tag alert alert--info alert--ok alert--warn alert--err toast-region modal spinner skeleton empty-state progress
form field field__label field__control field__hint field__error is-invalid input-icon input-group check otp password-toggle strength rating segmented search-box filter-chips chip
tabs tabs__list tabs__tab tabs__panel accordion accordion__item accordion__trigger accordion__panel breadcrumb pagination
divider scaffold-draw img-mono marquee grain metal-text
mt-0 mt-1 mt-2 mt-3 mt-4 mt-5 mt-6 mb-0 mb-1 mb-2 mb-3 mb-4 mb-5 mb-6 text-center w-100 hide-mobile show-mobile visually-hidden
theme-dark is-visible auth-pending auth-ready`.split(/\s+/).filter(Boolean);
const SPEC_AUTH_CODES = ['email-already-in-use', 'invalid-email', 'weak-password', 'invalid-credential', 'wrong-password', 'user-not-found', 'too-many-requests', 'network-request-failed', 'popup-closed-by-user', 'popup-blocked', 'invalid-phone-number', 'invalid-verification-code', 'code-expired', 'missing-phone-number', 'quota-exceeded', 'operation-not-allowed', 'unauthorized-domain'].map(c => 'auth/' + c);

/* ================================================================ NODE SIDE */
function nodeChecks() {
  sect('CSS contract (SPEC §2.5)');
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/main.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const have = new Set((css.match(/\.[A-Za-z_][\w-]*/g) || []).map(s => s.slice(1)));
  const missing = SPEC_CLASSES.filter(c => !have.has(c));
  ok(!missing.length, `all ${SPEC_CLASSES.length} SPEC §2.5 class names exist in main.css`, missing.length ? missing : undefined);
  const tokens = ['--c-black:#0a0a0b', '--c-ink:#111113', '--c-graphite:#1a1a1d', '--c-steel:#26262a', '--c-iron:#3a3a3f', '--c-slate:#5c5c63', '--c-gray:#8b8b92', '--c-silver:#b9b9bf', '--c-mist:#dcdcdf', '--c-bone:#ececea', '--c-paper:#f6f6f4', '--c-white:#ffffff', '--c-ok:#7f9a86', '--c-warn:#b39b67', '--c-err:#b0706a', '--radius-sm:2px', '--radius:4px', '--radius-lg:10px', '--dur:.6s', '--header-h:76px', '--container:1240px'];
  const flat = css.replace(/\s+/g, '');
  const badTok = tokens.filter(t => !flat.includes(t));
  ok(!badTok.length, 'SPEC §1.1 primitive tokens defined with the exact values', badTok.length ? badTok : undefined);
  ok(/--hero-img/.test(css) && /--value/.test(css), '.page-hero uses --hero-img and .progress uses --value');

  sect('Data files (SPEC §2.4)');
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const files = ['berita', 'agenda', 'regulasi', 'organisasi', 'kompetensi', 'registry'];
  for (const f of files) {
    const src = fs.readFileSync(path.join(ROOT, `assets/data/${f}.js`), 'utf8');
    try { vm.runInContext(src, sandbox, { filename: f + '.js' }); ok(true, `${f}.js parses and runs as a classic script`); }
    catch (e) { ok(false, `${f}.js parses`, e.message); }
    ok(/^\/\*[\s\S]*?(CARA|contoh)[\s\S]*?\*\//.test(src), `${f}.js has an Indonesian how-to header`);
  }
  const D = sandbox.PPAPI_DATA || {};
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const validIso = s => ISO.test(s) && !isNaN(new Date(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
  const uniq = arr => new Set(arr).size === arr.length;
  const imgExists = p => typeof p === 'string' && p.startsWith('assets/img/') && fs.existsSync(path.join(ROOT, p));
  const iconNames = new Set(SPEC_ICONS.concat(['arrow-down', 'arrow-up', 'x-circle', 'help-circle', 'minus', 'quote']));

  // berita
  const B = D.berita || [];
  ok(B.length >= 8 && B.length <= 10, `berita: 8–10 items (${B.length})`);
  const BK = ['id', 'judul', 'kategori', 'tanggal', 'ringkasan', 'isi', 'gambar', 'penulis', 'sorot', 'contoh'];
  ok(B.every(b => BK.every(k => k in b)), 'berita: every item has all SPEC fields');
  ok(uniq(B.map(b => b.id)) && B.every(b => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.id)), 'berita: ids unique slugs');
  ok(B.every(b => ['Kegiatan', 'Pengumuman', 'Edukasi', 'Regulasi', 'Organisasi'].includes(b.kategori)), 'berita: kategori in SPEC enum');
  ok(B.every(b => validIso(b.tanggal) && b.tanggal >= '2026-03-01' && b.tanggal <= TODAY), 'berita: valid ISO dates within Mar–8 Oct 2026', B.map(b => b.tanggal));
  ok(B.every((b, i) => i === 0 || B[i - 1].tanggal >= b.tanggal), 'berita: newest first');
  ok(B.every(b => Array.isArray(b.isi) && b.isi.length && b.isi.every(p => typeof p === 'string' && p.trim())), 'berita: isi is a non-empty array of strings');
  const badImg = B.filter(b => !imgExists(b.gambar)).map(b => b.gambar);
  ok(!badImg.length, 'berita: every gambar path exists', badImg.length ? badImg : undefined);
  ok(B.every(b => b.contoh === true) && B.filter(b => b.sorot === true).length >= 1, 'berita: all contoh:true; ≥1 sorot');
  const P = D.pengumuman || [];
  ok(P.length >= 3 && P.length <= 4 && P.every(p => ['id', 'judul', 'isi', 'tanggal', 'penting', 'contoh'].every(k => k in p) && validIso(p.tanggal) && p.contoh === true) && uniq(P.map(p => p.id)), `pengumuman: 3–4 complete items (${P.length})`);

  // agenda
  const A = D.agenda || [];
  ok(A.length >= 8 && A.length <= 10, `agenda: 8–10 items (${A.length})`);
  const AK = ['id', 'judul', 'jenis', 'mulai', 'selesai', 'waktu', 'lokasi', 'mode', 'kuota', 'deskripsi', 'tautanDaftar', 'contoh'];
  ok(A.every(a => AK.every(k => k in a)), 'agenda: every item has all SPEC fields');
  ok(uniq(A.map(a => a.id)), 'agenda: ids unique');
  ok(A.every(a => validIso(a.mulai) && validIso(a.selesai) && a.selesai >= a.mulai), 'agenda: valid ISO mulai/selesai, selesai ≥ mulai');
  ok(A.every(a => ['Pelatihan', 'Sertifikasi', 'Seminar', 'Webinar', 'Rapat', 'Kunjungan Teknis'].includes(a.jenis)), 'agenda: jenis in SPEC enum');
  ok(A.every(a => ['Luring', 'Daring', 'Hybrid'].includes(a.mode)), 'agenda: mode in SPEC enum');
  ok(A.every(a => a.kuota === null || (Number.isInteger(a.kuota) && a.kuota > 0)), 'agenda: kuota integer or null');
  ok(A.every(a => a.tautanDaftar === '' || /^https:\/\//.test(a.tautanDaftar)), "agenda: tautanDaftar '' or https URL");
  ok(A.every(a => a.contoh === true), 'agenda: all contoh:true');
  const upcoming = A.filter(a => a.mulai >= '2026-10-09' && a.mulai <= '2027-01-31');
  const past = A.filter(a => a.selesai < TODAY);
  ok(upcoming.length >= 5 && upcoming.length <= 7, `agenda: ~6 upcoming between 2026-10-09 and 2027-01-31 (${upcoming.length})`);
  ok(past.length >= 3 && past.length <= 5, `agenda: ~4 past relative to ${TODAY} (${past.length})`);
  ok(upcoming.length + past.length === A.length, 'agenda: nothing straddles today / outside the window');

  // regulasi
  const R = D.regulasi || [];
  const RK = ['id', 'jenis', 'nomor', 'tahun', 'judul', 'singkatan', 'instansi', 'status', 'relevansi', 'tautan', 'kunci'];
  ok(R.length > 0, `regulasi: ${R.length} items`);
  const incomplete = R.filter(r => !RK.every(k => k in r) || !r.id || !r.nomor || !r.judul || !r.singkatan || !r.instansi || !r.relevansi).map(r => r.id);
  ok(!incomplete.length, 'regulasi: every item has all SPEC fields (non-empty text fields)', incomplete.length ? incomplete : undefined);
  ok(uniq(R.map(r => r.id)), 'regulasi: ids unique');
  ok(R.every(r => ['Undang-Undang', 'Peraturan Pemerintah', 'Peraturan Menteri', 'Keputusan Menteri', 'Surat Edaran', 'SNI', 'Standar Internasional'].includes(r.jenis)), 'regulasi: jenis in SPEC enum', R.filter(r => !['Undang-Undang', 'Peraturan Pemerintah', 'Peraturan Menteri', 'Keputusan Menteri', 'Surat Edaran', 'SNI', 'Standar Internasional'].includes(r.jenis)).map(r => r.jenis));
  ok(R.every(r => ['Berlaku', 'Berlaku (diubah)', 'Dicabut'].includes(r.status)), 'regulasi: status in SPEC enum');
  ok(R.every(r => Number.isInteger(r.tahun) && r.tahun >= 1900 && r.tahun <= 2026), 'regulasi: tahun is an integer year ≤ 2026');
  ok(R.every(r => typeof r.kunci === 'boolean') && R.some(r => r.kunci), 'regulasi: kunci boolean, ≥1 kunci');
  ok(R.every(r => r.tautan === '' || /^https?:\/\//.test(r.tautan)), "regulasi: tautan '' or URL");
  ok(R.every(r => !('contoh' in r)), 'regulasi: no contoh flags (factual)');
  ok(R.every(r => r.relevansi.split(/(?<=[.!?])\s+/).length <= 3), 'regulasi: relevansi ≈1–2 sentences', R.filter(r => r.relevansi.split(/(?<=[.!?])\s+/).length > 3).map(r => r.id));
  try {
    const research = JSON.parse(fs.readFileSync(path.join(DEV, 'research/regulasi.json'), 'utf8')).regulasi;
    const key = r => `${r.singkatan}`;
    const rmap = new Map(research.map(r => [key(r), r]));
    const notResearched = R.filter(r => !rmap.has(key(r))).map(r => r.singkatan);
    ok(!notResearched.length, 'regulasi: every item exists in research/regulasi.json', notResearched.length ? notResearched : undefined);
    const unverified = research.filter(r => r.verified === false).map(r => r.singkatan).filter(s => R.some(x => x.singkatan === s));
    ok(!unverified.length, 'regulasi: no item marked verified:false in research', unverified.length ? unverified : undefined);
    const linkDiff = R.filter(r => rmap.has(key(r)) && (rmap.get(key(r)).tautan || '') !== r.tautan).map(r => ({ id: r.id, site: r.tautan, research: rmap.get(key(r)).tautan }));
    ok(!linkDiff.length, 'regulasi: tautan identical to the researched URL', linkDiff.length ? linkDiff : undefined);
    const fieldDiff = R.filter(r => rmap.has(key(r))).flatMap(r => ['jenis', 'nomor', 'tahun', 'judul', 'instansi', 'status', 'kunci'].filter(k => String(rmap.get(key(r))[k]) !== String(r[k])).map(k => `${r.id}.${k}`));
    ok(!fieldDiff.length, 'regulasi: jenis/nomor/tahun/judul/instansi/status/kunci identical to research', fieldDiff.length ? fieldDiff : undefined);
  } catch (e) { ok(false, 'regulasi: research cross-check ran', e.message); }

  // organisasi
  const O = D.organisasi || {};
  const OK = ['tentang', 'visi', 'misi', 'nilai', 'layanan', 'sejarah', 'pengurus', 'legalitas', 'maknaLogo', 'stats', 'faq', 'keanggotaan'];
  ok(OK.every(k => k in O), 'organisasi: all SPEC keys present', OK.filter(k => !(k in O)));
  ok(Array.isArray(O.tentang) && typeof O.visi === 'string' && Array.isArray(O.misi), 'organisasi: tentang[], visi string, misi[]');
  ok((O.nilai || []).every(n => n.judul && n.teks && iconNames.has(n.ikon)), 'organisasi.nilai: {judul,teks,ikon} with valid icon names');
  ok((O.layanan || []).every(n => n.judul && n.teks && iconNames.has(n.ikon)), 'organisasi.layanan: {ikon,judul,teks} with valid icon names');
  ok((O.sejarah || []).every(s => 'tahun' in s && s.judul && s.teks), 'organisasi.sejarah: {tahun,judul,teks}');
  ok((O.pengurus || []).length > 0 && O.pengurus.every(p => p.contoh === true && p.jabatan && 'nama' in p && 'foto' in p && (!p.foto || imgExists(p.foto))), 'organisasi.pengurus: placeholders flagged contoh, foto exists when set');
  ok(Array.isArray(O.legalitas) && O.legalitas.length === 0, 'organisasi.legalitas: empty (nothing verified)');
  ok((O.maknaLogo || []).every(m => m.judul && m.teks), 'organisasi.maknaLogo: {judul,teks}');
  ok((O.stats || []).every(s => typeof s.angka === 'number' && 'akhiran' in s && s.label), 'organisasi.stats: {angka:number, akhiran, label}');
  const st = Object.fromEntries((O.stats || []).map(s => [s.label, s.angka]));
  const regStat = (O.stats || []).find(s => /regulasi/i.test(s.label));
  const kompStat = (O.stats || []).find(s => /kompetensi/i.test(s.label));
  ok(!regStat || regStat.angka === R.length, `organisasi.stats regulasi count matches data (${regStat && regStat.angka} vs ${R.length})`);
  ok(!kompStat || kompStat.angka === ((D.kompetensi || {}).katalog || []).length, `organisasi.stats kompetensi count matches data`);
  void st;
  ok((O.faq || []).length > 0 && O.faq.every(f => f.q && f.a), 'organisasi.faq: {q,a}');
  const K = O.keanggotaan || {};
  ok(Array.isArray(K.kategori) && K.kategori.every(k => k.nama && k.ringkas && Array.isArray(k.syarat) && Array.isArray(k.manfaat)), 'organisasi.keanggotaan.kategori: {nama,ringkas,syarat[],manfaat[]}');
  ok(eqSet(K.kategori.map(k => k.nama), ['Praktisi', 'Ahli', 'Mitra Korporat', 'Kehormatan']), 'organisasi.keanggotaan.kategori names = store.MEMBER_TYPES');
  ok(Array.isArray(K.manfaatUmum) && Array.isArray(K.langkah) && K.langkah.every(l => l.judul && l.teks) && 'biaya' in K, 'organisasi.keanggotaan: manfaatUmum[], langkah[{judul,teks}], biaya');
  ok((K.manfaatUmum || []).every(m => typeof m === 'string' || iconNames.has(m.ikon)), 'organisasi.keanggotaan.manfaatUmum: valid icon names');

  // kompetensi
  const KP = D.kompetensi || {};
  ok(Array.isArray(KP.katalog) && KP.katalog.length > 0 && KP.katalog.every(k => k.kode && k.nama && k.kelompok && k.deskripsi), 'kompetensi.katalog: {kode,nama,kelompok,deskripsi}');
  ok(uniq((KP.katalog || []).map(k => k.kode)), 'kompetensi.katalog: kode unique');
  eq(KP.level, ['Dasar', 'Menengah', 'Mahir', 'Ahli'], 'kompetensi.level equals SPEC');
  eq(KP.penerbit, ['BNSP / LSP', 'Kemnaker RI', 'LPJK / Kementerian PU', 'Lembaga Internasional (CISRS, dll.)', 'Lainnya'], 'kompetensi.penerbit equals SPEC');

  // registry
  const G = D.registry || [];
  ok(G.length >= 5 && G.length <= 6, `registry: 5–6 entries (${G.length})`);
  ok(G.every(g => ['kta', 'nama', 'kategori', 'kompetensi', 'kota', 'berlakuHingga', 'status', 'contoh'].every(k => k in g) && g.contoh === true), 'registry: all SPEC fields, contoh:true');
  ok(G.every(g => /^PPAPI-\d{4}-\d{6}$/.test(g.kta)) && uniq(G.map(g => g.kta)), 'registry: kta format PPAPI-YYYY-NNNNNN, unique');
  ok(G.every(g => validIso(g.berlakuHingga) && ['Aktif', 'Nonaktif', 'Menunggu Verifikasi'].includes(g.status) && ['Praktisi', 'Ahli', 'Mitra Korporat', 'Kehormatan'].includes(g.kategori) && Array.isArray(g.kompetensi)), 'registry: valid dates / status / kategori / kompetensi[]');
  ok(G.every(g => !('email' in g) && !('phone' in g) && !('alamat' in g)), 'registry: no private fields (email/phone/alamat)');

  // config vs research
  sect('Config vs research (no invented facts)');
  const cs = { window: {} }; cs.window = cs; vm.createContext(cs);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8'), cs);
  const C = cs.PPAPI_CONFIG;
  const research = JSON.parse(fs.readFileSync(path.join(DEV, 'research/ppapi.json'), 'utf8'));
  const contactKeys = ['address', 'city', 'phone', 'whatsapp', 'email'];
  const invented = contactKeys.filter(k => (C.contact[k] || '') !== (research.contact[k] || ''));
  ok(!invented.length, 'config.contact address/city/phone/whatsapp/email equal research (all empty)', invented.length ? invented.map(k => ({ k, config: C.contact[k], research: research.contact[k] })) : undefined);
  ok(!C.contact.mapsQuery && Array.isArray(C.contact.hours) && C.contact.hours.length === 0, 'config.contact.mapsQuery empty and hours [] (SPEC example hours not verified)');
  const socialInvented = Object.keys(C.social).filter(k => (C.social[k] || '') !== (research.social[k] || ''));
  ok(!socialInvented.length, 'config.social equals research (all empty)');
  ok(C.fullName === 'Perkumpulan Praktisi dan Ahli Perancah Indonesia' && C.shortName === 'PPAPI', 'config names match research');
  /* v2 (SPEC-v2 §3.5, FOUNDATION_NOTES §9.12): the member apps are internal pages, not the researched external URL */
  ok(C.simulatorUrl === 'aplikasi/simulator/index.html' && C.apps.map(a => a.url).join() === 'aplikasi/perencanaan/index.html,aplikasi/simulator/index.html', 'config app URLs = internal aplikasi/… pages (v2)');
  ok(C.firebaseSdkVersion === '12.4.0' && C.firebase && C.firebase.apiKey === '', "config: firebaseSdkVersion '12.4.0', apiKey '' (demo)");
  ok(Array.isArray(C.nav) && C.nav.length === 7 && C.nav.map(n => n.key).join() === 'beranda,profil,berita,agenda,pustaka,keanggotaan,umpan-balik', 'config.nav = 7 items in order (v2: regulasi → pustaka "Pengetahuan")');
  ok(C.apps.map(a => a.key).join() === 'perencanaan,simulator', "config.apps keys 'perencanaan','simulator' (v2)");
}
function eqSet(a, b) { return a.length === b.length && a.every(x => b.includes(x)); }

/* ============================================================= BROWSER SIDE */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const FONTS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@300;400;500;600;700&display=swap';
const TEST_FILES = [];
function writeTestPage(name, { key = 'beranda', auth = 'public', header = '', main = '', data = [], inline = '' }) {
  const html = `<!doctype html>
<html lang="id" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Uji Kontrak — PPAPI</title>
  <meta name="description" content="Halaman uji sementara (dihapus otomatis).">
  <meta name="robots" content="noindex">
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${FONTS}">
  <link rel="stylesheet" href="assets/css/main.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
</head>
<body data-page="${key}" data-auth="${auth}"${header ? ` data-header="${header}"` : ''}>
  <a class="skip-link" href="#main">Lewati ke konten utama</a>
  <div id="site-header"></div>
  <main id="main" tabindex="-1">${main}</main>
  <div id="site-footer"></div>
  ${inline ? `<script>${inline}</script>` : ''}
  <script src="assets/js/config.js" defer></script>
  ${data.map(d => `<script src="assets/data/${d}.js" defer></script>`).join('\n  ')}
  <script src="assets/js/core.js" defer></script>
  <script src="assets/js/auth.js" defer></script>
  <script src="assets/js/store.js" defer></script>
</body>
</html>`;
  const file = path.join(ROOT, name);
  fs.writeFileSync(file, html);
  TEST_FILES.push(file);
}
function cleanupTestFiles() {
  for (const f of fs.readdirSync(ROOT)) if (/^__test_.*\.html$/.test(f)) { try { fs.unlinkSync(path.join(ROOT, f)); } catch (e) { /* ignore */ } }
}

const SESSION = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const LOG_INLINE = `window.__log=[];document.addEventListener('DOMContentLoaded',function(){
  PPAPI.onReady(async function(){ await new Promise(r=>setTimeout(r,20)); window.__log.push({n:1, header:!!document.querySelector('.site-header'), footer:!!document.querySelector('.site-footer'), ready:PPAPI.isReady(), user:PPAPI.auth.current(), authReady: document.body.classList.contains('auth-ready')}); });
  PPAPI.onReady(function(){ window.__log.push({n:2}); throw new Error('uji error'); });
  PPAPI.onReady(function(){ window.__log.push({n:3}); });
});`;

async function browserChecks() {
  cleanupTestFiles();
  writeTestPage('__test_public.html', { key: 'berita', auth: 'public', inline: LOG_INLINE, data: ['berita', 'agenda'], main: `<section class="page-hero"><div class="container page-hero__inner"><h1 class="display">Uji</h1></div></section><section class="section"><div class="container" id="sandbox"><p>Konten publik</p></div></section>` });
  writeTestPage('__test_required.html', { key: 'dashboard', auth: 'required', inline: LOG_INLINE, main: `<section class="page-hero page-hero--compact"><div class="container page-hero__inner"><h1 class="h1">Dasbor uji</h1></div></section>` });
  writeTestPage('__test_guest.html', { key: 'masuk', auth: 'guest', header: 'solid', main: `<section class="section"><div class="container"><h1 class="h2">Masuk uji</h1></div></section>` });

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end('<!doctype html><title>404</title><p>nf</p>'); }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const BASE = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const pageErrors = [];
  async function newCtx(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce', ...opts });
    await ctx.clock.setFixedTime(FIXED_NOW);
    return ctx;
  }
  function watch(page, label) {
    page.on('pageerror', e => pageErrors.push(`${label}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|uji error|Kesalahan pada skrip halaman/.test(m.text())) pageErrors.push(`${label}: console.error ${m.text()}`); });
  }
  const url = p => p.replace(BASE, '');
  try {
    /* -------------------------------------------------- styleguide: util */
    const ctx = await newCtx();
    const page = await ctx.newPage();
    watch(page, 'styleguide');
    const warns = [];
    page.on('console', m => { if (m.type() === 'warning') warns.push(m.text()); });
    await page.goto(`${BASE}/styleguide.html?uji=nilai%20a&x=1`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());

    sect('PPAPI root');
    const root = await page.evaluate(() => ({
      config: PPAPI.config === window.PPAPI_CONFIG, data: PPAPI.data === window.PPAPI_DATA,
      dataKeys: Object.keys(PPAPI.data).sort(), onReady: typeof PPAPI.onReady, util: typeof PPAPI.util, icon: typeof PPAPI.icon, ui: typeof PPAPI.ui,
      auth: typeof PPAPI.auth, store: typeof PPAPI.store
    }));
    ok(root.config, 'PPAPI.config === window.PPAPI_CONFIG');
    ok(root.data, 'PPAPI.data === window.PPAPI_DATA');
    eq(root.dataKeys, ['agenda', 'berita', 'kompetensi', 'organisasi', 'pengumuman', 'registry', 'regulasi'], 'PPAPI.data exposes all data collections');
    ok(root.onReady === 'function' && root.util === 'object' && root.icon === 'function' && root.ui === 'object' && root.auth === 'object' && root.store === 'object', 'PPAPI.onReady/util/icon/ui/auth/store exist');

    sect('PPAPI.util (SPEC §2.2)');
    const U = await page.evaluate(async () => {
      const u = PPAPI.util, o = {};
      const SPEC = ['$', '$$', 'h', 'formatDate', 'formatDateRange', 'relativeTime', 'daysUntil', 'todayIso', 'qs', 'debounce', 'slugify', 'initials', 'greeting', 'normalizePhoneID', 'formatPhoneID', 'isEmail', 'uid', 'ktaFromUid', 'certStatus', 'contohBadge'];
      o.missing = SPEC.filter(k => typeof u[k] !== 'function');
      o.storage = ['get', 'set', 'remove'].every(k => u.storage && typeof u.storage[k] === 'function');
      o.$ = u.$('#main') === document.getElementById('main');
      o.$root = u.$('.tabs__tab', document.querySelector('.tabs')) === document.querySelector('.tabs .tabs__tab');
      const all = u.$$('section'); o.$$ = Array.isArray(all) && all.length > 3;
      o.h = u.h(`<a href="x">'&\``); o.hNull = u.h(null) + '|' + u.h(undefined) + '|' + u.h(0);
      o.fd = [u.formatDate('2026-10-08'), u.formatDate('2026-10-07'), u.formatDate('2026-10-08', { short: true }), u.formatDate('2026-10-08', { weekday: true }), u.formatDate(''), u.formatDate('bukan tanggal'), u.formatDate('2026-10-08T23:30:00+07:00'), u.formatDate('2026-01-01')];
      o.fdr = [u.formatDateRange('2026-10-21', '2026-10-23'), u.formatDateRange('2026-10-30', '2026-11-02'), u.formatDateRange('2026-12-30', '2027-01-02'), u.formatDateRange('2026-10-21', '2026-10-21'), u.formatDateRange('2026-10-21', '')];
      o.rel = [u.relativeTime('2026-10-05'), u.relativeTime('2026-10-07'), u.relativeTime('2026-10-08'), u.relativeTime('2026-10-09'), u.relativeTime('2026-10-22'), u.relativeTime('2026-07-08')];
      o.days = [u.daysUntil('2026-10-10'), u.daysUntil('2026-10-01'), u.daysUntil('2026-10-08'), u.daysUntil('')];
      o.today = u.todayIso();
      o.qs = [u.qs('uji'), u.qs('x'), u.qs('tidak-ada')];
      let calls = 0, lastArg = null; const db = u.debounce(a => { calls++; lastArg = a; }, 40); db(1); db(2); db(3);
      await new Promise(r => setTimeout(r, 120)); o.debounce = [calls, lastArg];
      o.slug = [u.slugify('Pelatihan & Sertifikasi K3 — Ångka'), u.slugify('  Rapat  Anggota 2027 ')];
      o.init = [u.initials('Rahmat Hidayat Saputra'), u.initials('rahmat'), u.initials(''), u.initials('  siti   rahma ')];
      const at = (h, m) => u.greeting(new Date(2026, 9, 8, h, m));
      o.greet = [at(5, 0), at(10, 59), at(11, 0), at(14, 59), at(15, 0), at(17, 59), at(18, 0), at(4, 59), at(0, 0)];
      o.greetNow = u.greeting();
      o.phone = ['0812-3456-7890', '6281234567890', '+62 812 3456 7890', '+6281234567890', '(0812) 3456.7890', '81234567890', '12345', '', null, '+1 650 555 1234', '021-5551234', '08abc'].map(x => u.normalizePhoneID(x));
      o.fphone = u.formatPhoneID('+6281234567890');
      o.email = [u.isEmail('nama@contoh.id'), u.isEmail('a@b'), u.isEmail('a b@c.id'), u.isEmail(''), u.isEmail('x@y.co')];
      const a = u.uid('k'), b = u.uid('k'); o.uid = [/^k-/.test(a), a !== b, typeof a];
      o.st = [u.storage.set('__uji', { a: 1, b: [2] }), JSON.stringify(u.storage.get('__uji')), u.storage.get('__tidak_ada', 'fb'), u.storage.get('__tidak_ada')];
      localStorage.setItem('__rusak', '{oops'); o.st.push(u.storage.get('__rusak', 'fallback'));
      o.st.push(u.storage.remove('__uji'), u.storage.get('__uji'));
      localStorage.removeItem('__rusak');
      o.kta = [u.ktaFromUid('demo-uji-0001', 2026), u.ktaFromUid('demo-uji-0001', 2026), u.ktaFromUid('demo-uji-0002', 2026), u.ktaFromUid('demo-uji-0001'), u.ktaFromUid('x', 2025)];
      const many = new Set(); for (let i = 0; i < 500; i++) many.add(u.ktaFromUid('uid-' + i, 2026)); o.ktaSpread = many.size;
      o.cert = ['2026-10-01', '2026-10-08', '2027-01-06', '2027-01-07', '2029-12-31', ''].map(x => u.certStatus(x));
      o.contoh = [u.contohBadge({ contoh: true }), u.contohBadge({}), u.contohBadge(null), u.contohBadge({ contoh: false }), u.contohBadge(undefined)];
      return o;
    });
    ok(!U.missing.length && U.storage, 'every SPEC util function exists (incl. storage.get/set/remove)', U.missing);
    ok(U.$ && U.$root, '$(sel, root) returns the first match (scoped by root)');
    ok(U.$$, '$$(sel) returns a real Array');
    eq(U.h, '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#96;', "h() escapes & < > \" ' `");
    eq(U.hNull, '||0', 'h(null/undefined) → "", h(0) → "0"');
    eq(U.fd[0], '8 Oktober 2026', "formatDate('2026-10-08') === '8 Oktober 2026'");
    eq(U.fd[1], '7 Oktober 2026', "formatDate('2026-10-07') === '7 Oktober 2026' (SPEC example)");
    eq(U.fd[2], '8 Okt 2026', 'formatDate short → "8 Okt 2026"');
    eq(U.fd[3], 'Kamis, 8 Oktober 2026', 'formatDate weekday → "Kamis, 8 Oktober 2026"');
    eq([U.fd[4], U.fd[5]], ['', ''], 'formatDate(empty/invalid) → ""');
    eq(U.fd[6], '8 Oktober 2026', 'formatDate(ISO datetime) uses local (WIB) date');
    eq(U.fd[7], '1 Januari 2026', "formatDate('2026-01-01') — no UTC shift");
    eq(U.fdr[0], '21–23 Oktober 2026', "formatDateRange('2026-10-21','2026-10-23') === '21–23 Oktober 2026'");
    eq(U.fdr[1], '30 Oktober – 2 November 2026', 'formatDateRange across months');
    eq(U.fdr[2], '30 Desember 2026 – 2 Januari 2027', 'formatDateRange across years');
    eq([U.fdr[3], U.fdr[4]], ['21 Oktober 2026', '21 Oktober 2026'], 'formatDateRange same day / missing end → single date');
    eq(U.rel, ['3 hari lalu', 'kemarin', 'hari ini', 'besok', 'dalam 2 minggu', '3 bulan lalu'], 'relativeTime → "3 hari lalu", "kemarin", "hari ini", "besok", "dalam 2 minggu", "3 bulan lalu"');
    eq(U.days, [2, -7, 0, null], 'daysUntil → int (negative if past), null if invalid');
    eq(U.today, TODAY, "todayIso() === '2026-10-08'");
    eq(U.qs, ['nilai a', '1', null], 'qs(name) reads (decoded) query params, null when absent');
    eq(U.debounce, [1, 3], 'debounce(fn, ms) fires once with the last args');
    eq(U.slug, ['pelatihan-dan-sertifikasi-k3-angka', 'rapat-anggota-2027'], 'slugify strips accents/symbols');
    eq(U.init, ['RH', 'R', '', 'SR'], 'initials(name) → max 2 letters');
    eq(U.greet, ['Selamat pagi', 'Selamat pagi', 'Selamat siang', 'Selamat siang', 'Selamat sore', 'Selamat sore', 'Selamat malam', 'Selamat malam', 'Selamat malam'], 'greeting() boundaries 05–11 pagi / 11–15 siang / 15–18 sore / 18–05 malam');
    eq(U.greetNow, 'Selamat pagi', 'greeting() with no argument uses the current time (10:00 WIB → pagi)');
    eq(U.phone, ['+6281234567890', '+6281234567890', '+6281234567890', '+6281234567890', '+6281234567890', '+6281234567890', null, null, null, null, null, null], "normalizePhoneID('0812-3456-7890') === '+6281234567890' (+ 628…, +62 …, brackets/dots; invalid → null)");
    eq(U.fphone, '+62 812-3456-7890', "formatPhoneID('+6281234567890') === '+62 812-3456-7890'");
    eq(U.email, [true, false, false, false, true], 'isEmail');
    eq(U.uid, [true, true, 'string'], 'uid(prefix) → unique "prefix-…" strings');
    eq(U.st, [true, '{"a":1,"b":[2]}', 'fb', null, 'fallback', true, null], 'storage.get/set/remove: JSON round-trip, fallback, corrupt JSON → fallback');
    ok(U.kta[0] === U.kta[1] && /^PPAPI-2026-\d{6}$/.test(U.kta[0]), 'ktaFromUid deterministic, format PPAPI-YYYY-NNNNNN', U.kta[0]);
    ok(U.kta[0] !== U.kta[2] && U.kta[3] === U.kta[0] && /^PPAPI-2025-\d{6}$/.test(U.kta[4]), 'ktaFromUid: different uid → different no.; default year = current year', U.kta);
    ok(U.ktaSpread >= 498, `ktaFromUid spreads (≥498 unique of 500; got ${U.ktaSpread})`);
    eq(U.cert.map(c => [c.key, c.days]), [['kedaluwarsa', -7], ['segera', 0], ['segera', 90], ['aktif', 91], ['aktif', 1180], ['tanpa-batas', null]], "certStatus: past → kedaluwarsa, ≤90 d → segera, >90 → aktif, '' → tanpa-batas");
    ok(U.cert.every(c => typeof c.label === 'string' && c.label.length > 0 && ['ok', 'warn', 'err'].includes(c.tone)), 'certStatus returns {key,label,days,tone}', U.cert.map(c => c.label));
    eq(U.contoh, ['<span class="badge badge--contoh">Contoh</span>', '', '', '', ''], 'contohBadge(item) exact markup / ""');

    sect('PPAPI.icon (SPEC §2.2)');
    const I = await page.evaluate(names => {
      const res = { missing: [], badSvg: [], notHidden: [], stroke: [] };
      names.forEach(n => {
        const s = PPAPI.icon(n);
        if (!s) { res.missing.push(n); return; }
        const div = document.createElement('div'); div.innerHTML = s;
        const svg = div.firstElementChild;
        if (!svg || svg.tagName.toLowerCase() !== 'svg' || div.children.length !== 1 || !/^<svg[\s>]/.test(s)) res.badSvg.push(n);
        if (svg && svg.getAttribute('aria-hidden') !== 'true') res.notHidden.push(n);
        if (n !== 'google' && svg && !(svg.getAttribute('stroke') === 'currentColor' && svg.getAttribute('stroke-width') === '1.5' && svg.getAttribute('viewBox') === '0 0 24 24' && svg.getAttribute('fill') === 'none')) res.stroke.push(n);
      });
      const g = PPAPI.icon('google');
      res.google = /#4285F4/i.test(g) && /#EA4335/i.test(g) && /#FBBC05/i.test(g) && /#34A853/i.test(g);
      const lab = PPAPI.icon('check', { size: 32, cls: 'x-uji', label: 'Selesai "ok"' });
      const d = document.createElement('div'); d.innerHTML = lab; const sv = d.firstElementChild;
      res.opts = [sv.getAttribute('width'), sv.getAttribute('height'), sv.getAttribute('class'), sv.getAttribute('role'), sv.getAttribute('aria-label'), sv.hasAttribute('aria-hidden')];
      res.def = (() => { const e = document.createElement('div'); e.innerHTML = PPAPI.icon('menu'); return e.firstElementChild.getAttribute('width'); })();
      res.unknown = PPAPI.icon('tidak-ada-ikon');
      res.list = Array.isArray(PPAPI.icons) && names.every(n => PPAPI.icons.includes(n));
      return res;
    }, SPEC_ICONS);
    ok(!I.missing.length, `all ${SPEC_ICONS.length} SPEC icon names return an SVG string`, I.missing.length ? I.missing : undefined);
    ok(!I.badSvg.length, 'every icon string parses to exactly one <svg> element', I.badSvg.length ? I.badSvg : undefined);
    ok(!I.notHidden.length, 'icons are aria-hidden by default', I.notHidden.length ? I.notHidden : undefined);
    ok(!I.stroke.length, 'stroke currentColor, width 1.5, viewBox 0 0 24 24, fill none (all but google)', I.stroke.length ? I.stroke : undefined);
    ok(I.google, "'google' is the official 4-colour G");
    eq(I.opts, ['32', '32', 'icon icon--check x-uji', 'img', 'Selesai "ok"', false], 'icon(name,{size,cls,label}) → size, class, role=img + aria-label (escaped), not aria-hidden');
    eq(I.def, '20', 'default size 20');
    eq(I.unknown, '', "unknown icon → ''");
    ok(I.list, 'PPAPI.icons lists every SPEC icon');
    ok(warns.filter(w => /Ikon tidak dikenal/.test(w)).length === 1, 'unknown icon logs exactly one console.warn (check.mjs reports warnings — never pass unknown names)');

    sect('PPAPI.ui — toast / modal / confirm / setLoading');
    const missingUi = await page.evaluate(() => ['toast', 'modal', 'confirm', 'setLoading', 'reveal', 'tabs', 'accordion', 'emptyState', 'skeleton', 'scaffoldSVG'].filter(k => typeof PPAPI.ui[k] !== 'function'));
    ok(!missingUi.length, 'every SPEC ui function exists', missingUi);
    const T = await page.evaluate(async () => {
      const preRegion = document.querySelector('.toast-region');
      const t = PPAPI.ui.toast('<b>Pesan</b> & uji', { type: 'success', timeout: 0 });
      const region = document.querySelector('.toast-region');
      const r = {
        preRegion: !!preRegion, api: !!(t && t.el && typeof t.close === 'function'), inRegion: region && region.contains(t.el),
        live: region && region.getAttribute('aria-live'), role: region && region.getAttribute('role'),
        text: t.el.querySelector('.toast__msg').textContent, html: t.el.querySelector('.toast__msg').innerHTML,
        type: t.el.classList.contains('toast--success'), closeBtn: !!t.el.querySelector('button.toast__close[aria-label]')
      };
      t.close(); await new Promise(res => setTimeout(res, 50)); r.closed = !document.body.contains(t.el);
      const types = ['info', 'success', 'error', 'warn'].map(ty => { const x = PPAPI.ui.toast('x', { type: ty, timeout: 0 }); const c = x.el.className; x.close(); return c; });
      r.types = types;
      const auto = PPAPI.ui.toast('auto', { timeout: 300 });
      await new Promise(res => setTimeout(res, 1700)); r.auto = !document.body.contains(auto.el);
      return r;
    });
    ok(T.api && T.inRegion, 'toast() returns {el, close} and renders inside .toast-region');
    ok(T.live === 'polite' && T.role === 'status', 'toast region is role=status aria-live=polite');
    ok(T.preRegion, 'aria-live toast region exists BEFORE the first toast (so screen readers announce the first message)');
    ok(T.text === '<b>Pesan</b> & uji' && !/<b>/.test(T.html), 'toast message is inserted as text (escaped)');
    ok(T.type && T.closeBtn && T.closed, 'toast type class, labelled close button, close() removes it');
    ok(T.types.every((c, i) => c.includes('toast--' + ['info', 'success', 'error', 'warn'][i])), 'toast types info/success/error/warn');
    ok(T.auto, 'toast auto-dismisses after timeout');

    // modal
    await page.evaluate(() => {
      const b = document.createElement('button'); b.id = 'uji-opener'; b.textContent = 'Buka'; b.className = 'btn';
      document.querySelector('#main').prepend(b);
    });
    await page.focus('#uji-opener');
    await page.evaluate(() => {
      window.__m = { closed: 0, opened: 0, kept: 0 };
      const node = document.createElement('div');
      node.innerHTML = '<label for="m-a">A</label><input id="m-a" class="field__control"><a href="#x" id="m-link">tautan</a>';
      window.__modal = PPAPI.ui.modal({
        title: 'Judul <uji>', body: node, size: 'lg',
        actions: [{ label: 'Tetap', variant: 'ghost', onClick: () => { window.__m.kept++; return false; } }, { label: 'Simpan', variant: 'primary', onClick: c => { window.__m.saved = true; } }],
        onOpen: el => { window.__m.opened++; window.__m.openEl = el.classList.contains('modal'); }, onClose: () => { window.__m.closed++; }
      });
    });
    await page.waitForTimeout(150);
    const M1 = await page.evaluate(() => {
      const dlg = document.querySelector('.modal .modal__dialog');
      return {
        api: !!(window.__modal.el && typeof window.__modal.close === 'function'), dialog: dlg && dlg.getAttribute('role'), modal: dlg && dlg.getAttribute('aria-modal'),
        labelled: dlg && document.getElementById(dlg.getAttribute('aria-labelledby')).textContent, size: dlg && dlg.classList.contains('modal__dialog--lg'),
        focusIn: !!document.activeElement.closest('.modal__dialog'), focusId: document.activeElement.id, opened: window.__m.opened, openEl: window.__m.openEl,
        btns: [...document.querySelectorAll('.modal__footer .btn')].map(b => b.className)
      };
    });
    ok(M1.api && M1.dialog === 'dialog' && M1.modal === 'true', 'modal() → {el, close}; role=dialog aria-modal=true');
    eq(M1.labelled, 'Judul <uji>', 'modal title rendered as text and referenced by aria-labelledby');
    ok(M1.size, "modal size 'lg' applied");
    ok(M1.focusIn && M1.focusId === 'm-a', 'modal moves focus to the first field inside the dialog', M1.focusId);
    ok(M1.opened === 1 && M1.openEl, 'onOpen(el) called once with the .modal root');
    ok(M1.btns[0].includes('btn--ghost') && M1.btns[1].includes('btn--primary'), 'action variants map to .btn--ghost/.btn--primary');
    const trapped = [];
    for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); trapped.push(await page.evaluate(() => !!document.activeElement.closest('.modal__dialog'))); }
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Shift+Tab'); trapped.push(await page.evaluate(() => !!document.activeElement.closest('.modal__dialog'))); }
    ok(trapped.every(Boolean), 'focus is trapped inside the modal (Tab and Shift+Tab)', trapped);
    await page.click('.modal__footer .btn--ghost');
    ok(await page.evaluate(() => !!document.querySelector('.modal') && window.__m.kept === 1), 'action onClick returning false keeps the modal open');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
    const M2 = await page.evaluate(() => ({ gone: !document.querySelector('.modal'), closed: window.__m.closed, focus: document.activeElement.id, lock: document.documentElement.classList.contains('modal-open') }));
    ok(M2.gone && M2.closed === 1 && !M2.lock, 'Esc closes the modal, onClose() called, scroll lock released');
    eq(M2.focus, 'uji-opener', 'focus returns to the element that opened the modal');
    await page.evaluate(() => { window.__bk = 0; PPAPI.ui.modal({ title: 'Latar', body: '<p>html string</p>', onClose: () => window.__bk++ }); });
    await page.waitForTimeout(150);
    ok(await page.evaluate(() => document.querySelector('.modal__body').innerHTML === '<p>html string</p>'), 'modal body accepts an HTML string');
    await page.mouse.click(15, 450);
    await page.waitForTimeout(350);
    ok(await page.evaluate(() => !document.querySelector('.modal') && window.__bk === 1), 'backdrop click closes the modal');
    await page.evaluate(() => { window.__mc = PPAPI.ui.modal({ title: 'API', body: 'x' }); });
    await page.evaluate(() => window.__mc.close());
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => !document.querySelector('.modal')), 'modal().close() closes programmatically');

    // confirm
    await page.evaluate(() => { window.__c1 = PPAPI.ui.confirm('Hapus <data> ini?', { title: 'Hapus?', okLabel: 'Ya, hapus', cancelLabel: 'Tidak', danger: true }).then(v => (window.__c1v = v)); });
    await page.waitForSelector('.modal__footer .btn--danger');
    const C1 = await page.evaluate(() => ({ title: document.querySelector('.modal__title').textContent, body: document.querySelector('.modal__body').textContent, labels: [...document.querySelectorAll('.modal__footer .btn')].map(b => b.textContent.trim()) }));
    eq(C1, { title: 'Hapus?', body: 'Hapus <data> ini?', labels: ['Tidak', 'Ya, hapus'] }, 'confirm(message, {title, okLabel, cancelLabel, danger}) renders escaped message + labels');
    await page.click('.modal__footer .btn--danger');
    await page.waitForTimeout(50);
    eq(await page.evaluate(() => window.__c1v), true, 'confirm → true on OK');
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__c2 = PPAPI.ui.confirm('Lanjutkan?').then(v => (window.__c2v = v)); });
    await page.waitForSelector('.modal__footer .btn--ghost');
    const C2 = await page.evaluate(() => ({ title: document.querySelector('.modal__title').textContent, labels: [...document.querySelectorAll('.modal__footer .btn')].map(b => b.textContent.trim()), primary: !!document.querySelector('.modal__footer .btn--primary') }));
    eq(C2, { title: 'Konfirmasi', labels: ['Batal', 'Ya, lanjutkan'], primary: true }, "confirm defaults: 'Konfirmasi', 'Ya, lanjutkan', 'Batal', primary button");
    await page.click('.modal__footer .btn--ghost');
    await page.waitForTimeout(50);
    eq(await page.evaluate(() => window.__c2v), false, 'confirm → false on cancel');
    await page.waitForTimeout(300);
    await page.evaluate(() => { PPAPI.ui.confirm('Esc?').then(v => (window.__c3v = v)); });
    await page.waitForSelector('.modal__dialog');
    await page.waitForTimeout(80);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(80);
    eq(await page.evaluate(() => window.__c3v), false, 'confirm → false on Esc');
    await page.waitForTimeout(300);

    // setLoading
    const L = await page.evaluate(() => {
      const b = document.createElement('button'); b.className = 'btn btn--primary'; b.innerHTML = '<span>Kirim</span>'; document.querySelector('#main').append(b);
      PPAPI.ui.setLoading(b, true);
      const on = { dis: b.disabled, spin: !!b.querySelector('.spinner'), text: b.textContent.trim(), busy: b.getAttribute('aria-busy') };
      PPAPI.ui.setLoading(b, false);
      const off = { dis: b.disabled, html: b.innerHTML, busy: b.hasAttribute('aria-busy') };
      PPAPI.ui.setLoading(b, true, 'Menyimpan…'); const custom = b.textContent.trim(); PPAPI.ui.setLoading(b, false);
      b.remove();
      return { on, off, custom };
    });
    eq(L.on, { dis: true, spin: true, text: 'Memproses…', busy: 'true' }, "setLoading(btn, true) disables, shows spinner + 'Memproses…'");
    eq(L.off, { dis: false, html: '<span>Kirim</span>', busy: false }, 'setLoading(btn, false) restores label and state');
    eq(L.custom, 'Menyimpan…', 'setLoading custom loadingLabel');

    sect('PPAPI.ui — tabs / accordion / emptyState / skeleton / scaffoldSVG');
    const autoTabs = await page.evaluate(() => { const t = document.querySelector('[data-tabs]'); return !!t && t.querySelector('[role=tab][aria-selected=true]').tabIndex === 0 && [...t.querySelectorAll('[role=tab]')].filter(x => x.tabIndex === -1).length === 3; });
    ok(autoTabs, '[data-tabs] auto-initialised on load (roving tabindex)');
    await page.evaluate(() => {
      const w = document.createElement('div');
      w.innerHTML = `<div class="tabs" id="uji-tabs" data-tab-hash><div class="tabs__list" role="tablist" aria-label="Uji">
        <button class="tabs__tab" role="tab" id="ut-a" data-tab="satu" aria-controls="panel-satu" aria-selected="true">Satu</button>
        <button class="tabs__tab" role="tab" id="ut-b" data-tab="dua" aria-controls="panel-dua" aria-selected="false">Dua</button>
        <button class="tabs__tab" role="tab" id="ut-c" data-tab="tiga" aria-controls="panel-tiga" aria-selected="false">Tiga</button></div>
        <div class="tabs__panel" role="tabpanel" id="panel-satu">1</div><div class="tabs__panel" role="tabpanel" id="panel-dua" hidden>2</div><div class="tabs__panel" role="tabpanel" id="panel-tiga" hidden>3</div></div>`;
      document.querySelector('#main').append(w);
      window.__tabEvents = [];
      w.firstElementChild.addEventListener('tabs:change', e => window.__tabEvents.push(e.detail.key));
      window.__tabs = PPAPI.ui.tabs(w.firstElementChild);
    });
    const TB = await page.evaluate(() => {
      const api = window.__tabs; const r = { api: !!api && typeof api.select === 'function', same: PPAPI.ui.tabs(document.getElementById('uji-tabs')) === api };
      r.sel = api.select('dua');
      r.state = ['satu', 'dua', 'tiga'].map(k => [document.getElementById('panel-' + k).hidden, document.querySelector(`[data-tab="${k}"]`).getAttribute('aria-selected')]);
      r.hash = location.hash; r.byPanel = api.select('panel-tiga'); r.cur = api.current;
      return r;
    });
    ok(TB.api && TB.same, 'tabs(rootEl) returns {select} and is idempotent');
    eq(TB.state, [[true, 'false'], [false, 'true'], [true, 'false']], 'tabs.select(key) shows only the chosen panel, aria-selected updated');
    eq(TB.hash, '#dua', 'data-tab-hash syncs location.hash');
    ok(TB.byPanel === true && TB.cur === 'tiga', 'tabs.select(panelId) also works; .current returns key');
    await page.focus('#ut-c');
    await page.keyboard.press('ArrowRight');
    const k1 = await page.evaluate(() => [document.activeElement.id, document.getElementById('panel-satu').hidden]);
    await page.keyboard.press('ArrowLeft');
    const k2 = await page.evaluate(() => document.activeElement.id);
    await page.keyboard.press('End');
    const k3 = await page.evaluate(() => document.activeElement.id);
    await page.keyboard.press('Home');
    const k4 = await page.evaluate(() => [document.activeElement.id, location.hash]);
    eq([k1, k2, k3, k4], [['ut-a', false], 'ut-c', 'ut-c', ['ut-a', '#satu']], 'tabs keyboard: ArrowRight wraps, ArrowLeft, End, Home (selects + focuses)');
    ok((await page.evaluate(() => window.__tabEvents)).includes('dua'), "tabs dispatch 'tabs:change' with detail.key");
    await page.evaluate(() => history.replaceState(null, '', location.pathname + location.search));

    const AC = await page.evaluate(() => {
      const w = document.createElement('div');
      w.innerHTML = `<div class="accordion" id="uji-acc"><div class="accordion__item"><h3><button class="accordion__trigger" aria-expanded="false">Satu?</button></h3><div class="accordion__panel" hidden><p>1</p></div></div>
        <div class="accordion__item"><h3><button class="accordion__trigger" aria-expanded="false">Dua?</button></h3><div class="accordion__panel" hidden><p>2</p></div></div></div>`;
      document.querySelector('#main').append(w);
      const api = PPAPI.ui.accordion(w.firstElementChild);
      const tr = w.querySelectorAll('.accordion__trigger'), pn = w.querySelectorAll('.accordion__panel');
      const r = { api: !!api && ['open', 'close', 'toggle'].every(k => typeof api[k] === 'function'), ctrl: tr[0].getAttribute('aria-controls') === pn[0].id, region: pn[0].getAttribute('role') };
      tr[0].click(); r.open1 = [tr[0].getAttribute('aria-expanded'), pn[0].hidden];
      tr[1].click(); r.multi = [tr[0].getAttribute('aria-expanded'), tr[1].getAttribute('aria-expanded')];
      tr[0].click(); r.close1 = [tr[0].getAttribute('aria-expanded'), pn[0].hidden];
      const s = document.createElement('div');
      s.innerHTML = `<div class="accordion" data-accordion="single"><div class="accordion__item"><button class="accordion__trigger">A</button><div class="accordion__panel" hidden>a</div></div><div class="accordion__item"><button class="accordion__trigger">B</button><div class="accordion__panel" hidden>b</div></div></div>`;
      document.querySelector('#main').append(s);
      const sa = PPAPI.ui.accordion(s.firstElementChild); sa.open(0); sa.open(1);
      r.single = [...s.querySelectorAll('.accordion__trigger')].map(t => t.getAttribute('aria-expanded'));
      r.icon = !!w.querySelector('.accordion__icon');
      return r;
    });
    ok(AC.api && AC.ctrl && AC.region === 'region', 'accordion(rootEl) → {open,close,toggle}; trigger aria-controls panel; panel role=region');
    eq([AC.open1, AC.multi, AC.close1], [['true', false], ['true', 'true'], ['false', true]], 'accordion trigger toggles aria-expanded + hidden (multi mode)');
    eq(AC.single, ['false', 'true'], 'data-accordion="single" keeps one panel open');

    const ES = await page.evaluate(() => {
      const e = PPAPI.ui.emptyState({ icon: 'search', title: 'Tidak <ada>', text: 'Coba "kata" lain', actionHtml: '<a class="btn" href="#">Reset</a>' });
      const sk = PPAPI.ui.skeleton(4), sk0 = PPAPI.ui.skeleton();
      const sv = PPAPI.ui.scaffoldSVG({ cols: 5, rows: 3, braces: false, cls: 'k-uji' }), svb = PPAPI.ui.scaffoldSVG();
      const d = document.createElement('div'); d.innerHTML = e; const d2 = document.createElement('div'); d2.innerHTML = sk; const d3 = document.createElement('div'); d3.innerHTML = sv; const d4 = document.createElement('div'); d4.innerHTML = svb;
      return {
        es: [typeof e, !!d.querySelector('.empty-state svg'), d.querySelector('.empty-state__title') && d.querySelector('.empty-state__title').textContent, e.includes('&lt;ada&gt;'), !!d.querySelector('.empty-state a.btn')],
        sk: [typeof sk, d2.querySelectorAll('.skeleton__line').length, d2.firstElementChild.getAttribute('role'), (sk0.match(/skeleton__line/g) || []).length],
        sv: [typeof sv, d3.firstElementChild.tagName.toLowerCase(), d3.firstElementChild.getAttribute('class'), d3.querySelectorAll('.sd-line:not(.sd-brace)').length, d3.querySelectorAll('.sd-brace').length, d3.firstElementChild.getAttribute('aria-hidden')],
        svb: [d4.querySelectorAll('.sd-line:not(.sd-brace)').length, d4.querySelectorAll('.sd-brace').length > 0, d4.querySelectorAll('.sd-node').length]
      };
    });
    eq(ES.es, ['string', true, 'Tidak <ada>', true, true], 'emptyState({icon,title,text,actionHtml}) → html string (title/text escaped, actionHtml raw)');
    eq(ES.sk, ['string', 4, 'status', 3], 'skeleton(lines=3) → html string with N lines, role=status');
    eq(ES.sv, ['string', 'svg', 'scaffold-draw k-uji', 8, 0, 'true'], 'scaffoldSVG({cols,rows,braces:false,cls}) → aria-hidden svg.scaffold-draw, cols+rows lines');
    eq(ES.svb, [10, true, 24], 'scaffoldSVG() defaults cols=6 rows=4 braces + nodes');

    sect('Layout (header / footer / account)');
    const LY = await page.evaluate(() => ({
      header: !!document.querySelector('#site-header .site-header'), footer: !!document.querySelector('#site-footer .site-footer'),
      nav: document.querySelectorAll('.site-nav__link').length, cfgNav: PPAPI.config.nav.length,
      masuk: (() => { const a = document.querySelector('[data-account] a[href="masuk.html"]'); return a && a.classList.contains('btn--ghost') && a.textContent.trim(); })(),
      daftar: (() => { const a = document.querySelector('[data-account] a[href="masuk.html#daftar"]'); return a && a.classList.contains('btn--primary') && a.textContent.trim(); })(),
      ribbon: !document.querySelector('[data-demo-ribbon]') || document.querySelector('[data-demo-ribbon]').hidden,
      skip: document.querySelector('.skip-link').getAttribute('href'), mobile: !!document.querySelector('#mobile-menu .mobile-menu__link')
    }));
    ok(LY.header && LY.footer && LY.mobile, 'header, footer and mobile menu injected');
    eq(LY.nav, LY.cfgNav, 'nav links come from PPAPI_CONFIG.nav');
    eq([LY.masuk, LY.daftar], ['Masuk', 'Daftar'], "signed out → 'Masuk' (ghost) + 'Daftar' (solid → masuk.html#daftar)");
    ok(LY.ribbon, 'no demo ribbon on data-auth="public" pages');
    await ctx.close();

    /* ------------------------------------------- public page: onReady, signed-in header */
    sect('onReady + auth/store (demo) on a public page');
    const c2 = await newCtx();
    const p2 = await c2.newPage();
    watch(p2, 'public');
    await p2.goto(`${BASE}/__test_public.html`, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(400);
    const OR = await p2.evaluate(() => ({ log: window.__log, errToast: !!document.querySelector('.toast--error'), active: (document.querySelector('.site-nav__link[aria-current="page"]') || {}).textContent }));
    eq(OR.log.map(l => l.n), [1, 2, 3], 'onReady callbacks run in order; a throwing callback does not stop the next');
    ok(OR.log[0].header && OR.log[0].footer && OR.log[0].ready && OR.log[0].authReady && OR.log[0].user === null, 'onReady runs after header/footer injection and auth.ready() (async fn awaited)', OR.log[0]);
    ok(OR.errToast, 'errors thrown in onReady are caught → error toast');
    eq(OR.active, 'Berita', 'active nav link marked from body[data-page] (aria-current="page")');
    eq(await p2.evaluate(() => new Promise(r => PPAPI.onReady(() => r('late')))), 'late', 'onReady after boot still runs');

    const AU = await p2.evaluate(async (codes) => {
      const a = PPAPI.auth, r = {};
      r.missing = ['ready', 'current', 'onChange', 'signUpEmail', 'signInEmail', 'resetPassword', 'signInGoogle', 'startPhone', 'confirmPhone', 'signOut', 'updateName'].filter(k => typeof a[k] !== 'function');
      r.mode = a.mode;
      r.readyP = a.ready() instanceof Promise;
      r.cur0 = a.current();
      const seen = []; const unsub = a.onChange(u => seen.push(u ? u.uid : null)); r.unsub = typeof unsub === 'function';
      const err = async (p) => { try { await p; return 'NO ERROR'; } catch (e) { return [e instanceof Error, e.code, typeof e.message === 'string' && e.message.length > 10]; } };
      r.weak = await err(a.signUpEmail({ name: 'Budi Santoso', email: 'budi@contoh.id', password: 'pendek' }));
      r.badMail = await err(a.signUpEmail({ name: 'Budi Santoso', email: 'budi@', password: 'Perancah2026' }));
      const u = await a.signUpEmail({ name: 'Budi Santoso', email: 'Budi@Contoh.id', password: 'Perancah2026' });
      r.user = u && Object.keys(u).sort().join(); r.provider = u.provider; r.email = u.email;
      r.dup = await err(a.signUpEmail({ name: 'Budi Santoso', email: 'budi@contoh.id', password: 'Perancah2026' }));
      const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
      r.hash = users['budi@contoh.id'] && /^[0-9a-f]{64}$/.test(users['budi@contoh.id'].hash);
      r.session = !!localStorage.getItem('ppapi_demo_session');
      r.member = JSON.parse(localStorage.getItem('ppapi_member_' + u.uid) || 'null');
      r.headerAvatar = (document.querySelector('.account__trigger .avatar') || {}).textContent;
      r.menu = [...document.querySelectorAll('#account-menu [role=menuitem]')].map(x => [x.textContent.trim(), x.getAttribute('href'), x.getAttribute('target')]);
      await a.signOut(); r.afterOut = a.current(); r.headerOut = !!document.querySelector('[data-account] a[href="masuk.html"]');
      r.wrongPw = await err(a.signInEmail({ email: 'budi@contoh.id', password: 'Salah12345' }));
      r.noUser = await err(a.signInEmail({ email: 'tidakada@contoh.id', password: 'Salah12345' }));
      await a.signInEmail({ email: 'budi@contoh.id', password: 'Perancah2026', remember: false });
      r.sessOnly = [!!sessionStorage.getItem('ppapi_demo_session'), !!localStorage.getItem('ppapi_demo_session')];
      r.upd = (await a.updateName('Budi S. Santoso')).name;
      r.updMember = (await PPAPI.store.getMember(a.current().uid)).name;
      r.reset = await a.resetPassword('siapa@contoh.id');
      await a.signOut();
      r.badPhone = await err(a.startPhone({ phone: '12345' }));
      r.noPhone = await err(a.startPhone({ phone: '' }));
      const sp = await a.startPhone({ phone: '0812-3456-7890' });
      r.sp = sp; r.otpToast = [...document.querySelectorAll('.toast__msg')].some(x => /123456/.test(x.textContent));
      r.badCode = await err(a.confirmPhone({ code: '000000' }));
      const pu = await a.confirmPhone({ code: '123456', name: 'Sari Dewi' });
      r.phoneUser = [pu.provider, pu.phone, pu.name];
      await a.signOut();
      r.seen = seen.length >= 4 && seen.includes(null); unsub();
      r.msgs = codes.filter(c => a.errorMessage(c) === a.errorMessage('tidak-ada'));
      return r;
    }, SPEC_AUTH_CODES);
    ok(!AU.missing.length, 'every SPEC auth method exists', AU.missing);
    eq([AU.mode, AU.readyP, AU.cur0, AU.unsub], ['demo', true, null, true], "auth.mode 'demo' (empty apiKey), ready() → Promise, current() null, onChange → unsubscribe fn");
    eq(AU.weak, [true, 'auth/weak-password', true], 'signUpEmail weak password → Error auth/weak-password (Indonesian message)');
    eq(AU.badMail, [true, 'auth/invalid-email', true], 'signUpEmail invalid email → auth/invalid-email');
    eq([AU.user, AU.provider, AU.email], ['createdAt,email,emailVerified,name,phone,photoURL,provider,uid', 'password', 'budi@contoh.id'], 'signUpEmail → User {uid,name,email,emailVerified,phone,photoURL,provider,createdAt} (v2 §9.14: emailVerified)');
    eq(AU.dup, [true, 'auth/email-already-in-use', true], 'duplicate email → auth/email-already-in-use');
    ok(AU.hash && AU.session, 'demo stores SHA-256 hex hash in ppapi_demo_users + session in ppapi_demo_session');
    ok(AU.member && AU.member.kta === '' && AU.member.memberType === 'Praktisi' && AU.member.status === 'Draf' && AU.member.joinedAt === TODAY, 'sign-up → store.ensureMember (v2: no KTA until approval, Praktisi, Draf, joinedAt today)', AU.member && { kta: AU.member.kta, t: AU.member.memberType, s: AU.member.status, j: AU.member.joinedAt });
    eq(AU.headerAvatar, 'BS', 'header re-renders on onChange: avatar initials');
    eq(AU.menu, [['Dasbor', 'dashboard.html', null], ['Formulir Pendaftaran', 'pendaftaran.html', null], ['Keluar', null, null]], 'account dropdown of a new (Draf) account: Dasbor, Formulir Pendaftaran, Keluar (v2 §3.1)');
    ok(AU.afterOut === null && AU.headerOut, 'signOut() → current() null, header back to Masuk/Daftar');
    eq([AU.wrongPw, AU.noUser], [[true, 'auth/invalid-credential', true], [true, 'auth/invalid-credential', true]], 'wrong password / unknown user → auth/invalid-credential');
    eq(AU.sessOnly, [true, false], 'signInEmail remember:false → sessionStorage only');
    eq(AU.upd, 'Budi S. Santoso', 'updateName(name) updates current user');
    eq(AU.updMember, 'Budi S. Santoso', 'updateName(name) also renames the member record (store)');
    eq(AU.reset, true, 'resetPassword(email) resolves true');
    eq([AU.badPhone, AU.noPhone], [[true, 'auth/invalid-phone-number', true], [true, 'auth/missing-phone-number', true]], 'startPhone invalid/missing → Indonesian errors');
    eq(AU.sp, { phone: '+6281234567890', masked: '+62 812-••••-7890' }, "startPhone accepts any ID format → {phone:'+62…', masked}");
    ok(AU.otpToast, "demo toast tells the OTP '123456'");
    eq(AU.badCode, [true, 'auth/invalid-verification-code', true], 'confirmPhone wrong code → auth/invalid-verification-code');
    eq(AU.phoneUser, ['phone', '+6281234567890', 'Sari Dewi'], "confirmPhone('123456', name) signs in a phone user");
    ok(AU.seen, 'onChange callback receives sign-in/sign-out events');
    ok(!AU.msgs.length, 'every SPEC Firebase error code has a specific Indonesian message', AU.msgs);

    // Google demo modal
    await p2.evaluate(() => { window.__g = PPAPI.auth.signInGoogle().then(u => (window.__gu = u), e => (window.__ge = e.code)); });
    await p2.waitForSelector('.modal__dialog');
    const gTitle = await p2.evaluate(() => document.querySelector('.modal__title').textContent);
    eq(gTitle, 'Simulasi Masuk dengan Google', "demo signInGoogle() opens the 'Simulasi Masuk dengan Google' modal");
    await p2.fill('#dg-name', 'Rina Putri');
    await p2.fill('#dg-email', 'rina.putri@gmail.com');
    await p2.click('.modal__footer .btn--primary');
    await p2.waitForFunction(() => window.__gu || window.__ge, null, { timeout: 4000 });
    eq(await p2.evaluate(() => window.__gu && [window.__gu.provider, window.__gu.email, window.__gu.name]), ['google', 'rina.putri@gmail.com', 'Rina Putri'], 'demo Google sign-in → provider google');
    await p2.evaluate(() => PPAPI.auth.signOut());
    await p2.waitForTimeout(300);
    await p2.evaluate(() => { PPAPI.auth.signInGoogle().then(u => (window.__gu2 = u), e => (window.__ge2 = e.code)); });
    await p2.waitForSelector('.modal__dialog');
    await p2.keyboard.press('Escape');
    await p2.waitForFunction(() => window.__ge2, null, { timeout: 3000 });
    eq(await p2.evaluate(() => window.__ge2), 'auth/popup-closed-by-user', 'dismissing the demo Google modal → auth/popup-closed-by-user');

    const ST = await p2.evaluate(async () => {
      const s = PPAPI.store, r = {};
      r.missing = ['getMember', 'saveMember', 'ensureMember', 'submitFeedback'].filter(k => typeof s[k] !== 'function');
      const user = { uid: 'uji-store-1', name: 'Agus Wijaya', email: 'agus@contoh.id', phone: '', photoURL: '' };
      r.none = await s.getMember('uji-store-1');
      const m = await s.ensureMember(user);
      r.shape = ['uid', 'name', 'email', 'phone', 'photoURL', 'kta', 'memberType', 'status', 'joinedAt', 'profile', 'competencies', 'certificates', 'updatedAt'].filter(k => !(k in m));
      r.profileKeys = Object.keys(m.profile).sort().join();
      r.kta = m.kta === '';   /* v2: the KTA is assigned at approval, not derived from the uid */
      r.again = (await s.ensureMember(user)).kta === m.kta;
      const before = m.updatedAt;
      await new Promise(res => setTimeout(res, 5));
      const saved = await s.saveMember('uji-store-1', { profile: { city: 'Bandung', nik: '3171000000000001', experienceYears: '7' }, kta: 'PPAPI-0000-000000', status: 'Aktif', memberType: 'Ahli', warnaFavorit: 'hitam', name: 'X'.repeat(300), competencies: [{ code: 'SCF-04', name: 'Operator Scaffolding', level: 'Mahir', since: '2020' }] });
      r.whitelist = [!('warnaFavorit' in saved), !('nik' in saved.profile), saved.profile.experienceYears, saved.name.length];
      r.saved = [saved.profile.city, saved.profile.company, saved.kta === m.kta, saved.status, saved.memberType, saved.competencies[0].level, saved.competencies[0].since, !!saved.competencies[0].id, typeof saved.updatedAt];
      r.stored = (await s.getMember('uji-store-1')).profile.city;
      r.ls = !!localStorage.getItem('ppapi_member_uji-store-1');
      const n0 = (JSON.parse(localStorage.getItem('ppapi_feedback') || '[]')).length;
      const fb = await s.submitFeedback({ kategori: 'Saran', nama: 'Agus', email: 'agus@contoh.id', subjek: 'Uji', pesan: 'Pesan uji coba kontrak yang cukup panjang.', rating: 5, extra: 'dibuang' });
      const list = JSON.parse(localStorage.getItem('ppapi_feedback') || '[]');
      r.fb = [typeof fb.id, list.length - n0, 'extra' in list[list.length - 1], list[list.length - 1].kategori];
      try { await s.submitFeedback({ kategori: 'Lain', pesan: 'Pesan uji coba kontrak.' }); r.badCat = 'NO ERROR'; } catch (e) { r.badCat = e.code; }
      try { await s.submitFeedback({ kategori: 'Kritik', pesan: 'pendek' }); r.short = 'NO ERROR'; } catch (e) { r.short = e.code; }
      localStorage.removeItem('ppapi_member_uji-store-1');
      return r;
    });
    ok(!ST.missing.length, 'every SPEC store method exists', ST.missing);
    eq(ST.none, null, 'getMember(unknown) → null');
    ok(!ST.shape.length && ST.profileKeys === 'address,bio,birthDate,birthPlace,city,company,education,experienceYears,gender,linkedin,position,province', 'ensureMember → full SPEC Member shape (12 profile keys)', ST.shape);
    ok(ST.kta && ST.again, "ensureMember: kta '' until approval (v2), idempotent");
    eq(ST.saved, ['Bandung', '', true, 'Draf', 'Praktisi', 'Mahir', 2020, true, 'string'], 'saveMember merges profile, ignores kta/status/memberType (v2 status Draf), sanitises competencies, stamps updatedAt');
    eq([ST.stored, ST.ls], ['Bandung', true], 'saveMember persists to localStorage ppapi_member_{uid}');
    eq(ST.whitelist, [true, true, 7, 120], 'saveMember drops keys outside the Member shape (as firestore.rules would), coerces experienceYears, caps name at 120');
    eq(ST.fb, ['string', 1, false, 'Saran'], 'submitFeedback → {id}; stored in ppapi_feedback; unknown keys dropped');
    eq([ST.badCat, ST.short], ['store/invalid-category', 'store/message-too-short'], 'submitFeedback validates kategori and message length');
    await c2.close();

    /* ------------------------------------------- reveal (motion on) */
    sect('ui.reveal() on dynamically inserted nodes');
    const c3 = await newCtx({ reducedMotion: 'no-preference' });
    const p3 = await c3.newPage();
    watch(p3, 'reveal');
    await p3.goto(`${BASE}/__test_public.html`, { waitUntil: 'networkidle' });
    await p3.waitForTimeout(300);
    const DYN = `<div style="height:1600px"></div><div id="dyn"><p data-reveal id="r1">A</p><p data-reveal="left" data-reveal-delay="120" id="r2">B</p>
      <ul data-reveal-stagger id="r3"><li>1</li><li>2</li><li>3</li></ul><span data-count="1250" data-count-suffix="+" id="r4">0</span>
      <h2 class="h2 split-lines" id="r5">Baris satu<br>baris <em>dua</em></h2><span data-icon="check" id="r6"></span>
      <div style="position:relative;height:160px"><div data-scaffold data-cols="5" data-rows="3" id="r7"></div></div></div>`;
    const RV0 = await p3.evaluate(html => {
      const box = document.getElementById('sandbox'); box.insertAdjacentHTML('beforeend', html);
      PPAPI.ui.reveal(box);
      const op = getComputedStyle(document.getElementById('r1')).opacity;
      return { visibleBefore: document.getElementById('r1').classList.contains('is-visible'), op, icon: !!document.querySelector('#r6 svg'), scaffold: !!document.querySelector('#r7 svg.scaffold-draw'), lines: document.querySelectorAll('#r5 .line').length, count: document.querySelector('#r4 .count__value') && document.querySelector('#r4 .count__value').textContent };
    }, DYN);
    ok(!RV0.visibleBefore && RV0.op === '0', 'off-screen [data-reveal] stays hidden until scrolled into view (IntersectionObserver)', RV0);
    ok(RV0.icon && RV0.scaffold && RV0.lines === 2, 'reveal(root) hydrates [data-icon], fills [data-scaffold], splits .split-lines on <br>');
    eq(RV0.count, '0+', 'counter prepared at 0 before it is visible');
    await p3.evaluate(() => document.getElementById('dyn').scrollIntoView({ block: 'start' }));
    await p3.waitForTimeout(2300);
    const RV1 = await p3.evaluate(() => ({
      vis: ['r1', 'r2', 'r3', 'r5'].map(id => document.getElementById(id).classList.contains('is-visible')),
      op: getComputedStyle(document.getElementById('r1')).opacity,
      count: document.querySelector('#r4 .count__value').textContent, sr: document.querySelector('#r4 .sr-only').textContent,
      stagger: getComputedStyle(document.querySelector('#r3 li:nth-child(3)')).getPropertyValue('--i').trim(),
      scaffoldVis: document.querySelector('#r7 svg').classList.contains('is-visible')
    }));
    eq(RV1.vis, [true, true, true, true], 'dynamically inserted [data-reveal], [data-reveal-stagger], .split-lines get .is-visible when scrolled into view');
    eq(RV1.op, '1', 'revealed element is fully opaque');
    eq([RV1.count, RV1.sr], ['1.250+', '1.250+'], 'counter animates to final id-ID value (with sr-only final text)');
    eq(RV1.stagger, '2', 'stagger children get --i index');
    ok(RV1.scaffoldVis, 'scaffold SVG gets .is-visible (draws)');
    // safety net: content inserted WITHOUT calling reveal()
    await p3.evaluate(() => { document.getElementById('sandbox').insertAdjacentHTML('beforeend', '<p data-reveal id="forgot">Lupa reveal</p><span data-icon="star" id="forgot-icon"></span>'); document.getElementById('forgot').scrollIntoView({ block: 'center' }); });
    await p3.waitForTimeout(1800);
    const FG = await p3.evaluate(() => ({ vis: document.getElementById('forgot').classList.contains('is-visible'), op: getComputedStyle(document.getElementById('forgot')).opacity, icon: !!document.querySelector('#forgot-icon svg') }));
    ok(FG.vis && FG.op === '1' && FG.icon, 'safety net: [data-reveal]/[data-icon] inserted without calling reveal() still become visible/hydrated', FG);
    await c3.close();

    const c3b = await newCtx();
    const p3b = await c3b.newPage();
    await p3b.goto(`${BASE}/__test_public.html`, { waitUntil: 'networkidle' });
    const RR = await p3b.evaluate(html => {
      const box = document.getElementById('sandbox'); box.insertAdjacentHTML('beforeend', html); PPAPI.ui.reveal(box);
      return { vis: document.getElementById('r1').classList.contains('is-visible'), count: document.querySelector('#r4 .count__value').textContent, op: getComputedStyle(document.getElementById('r1')).opacity };
    }, DYN);
    eq(RR, { vis: true, count: '1.250+', op: '1' }, 'reduced motion: reveal() shows content immediately, counters final');
    const SELF = await p3b.evaluate(() => {
      const box = document.getElementById('sandbox');
      const ic = document.createElement('span'); ic.setAttribute('data-icon', 'award'); box.append(ic); PPAPI.ui.reveal(ic);
      const sc = document.createElement('div'); sc.setAttribute('data-scaffold', ''); sc.style.cssText = 'position:relative;height:80px'; box.append(sc); PPAPI.ui.reveal(sc);
      return [!!ic.querySelector('svg.icon--award'), !!sc.querySelector('svg.scaffold-draw')];
    });
    eq(SELF, [true, true], 'reveal(el) also processes el itself ([data-icon] / [data-scaffold] on the root)');
    await c3b.close();

    /* ------------------------------------------- gating */
    sect('Auth gating (SPEC §2.1)');
    const c4 = await newCtx();
    const p4 = await c4.newPage();
    watch(p4, 'gating');
    await p4.route('**/assets/js/auth.js', async route => { await new Promise(r => setTimeout(r, 900)); route.continue(); });
    const nav = p4.goto(`${BASE}/__test_required.html?a=1&b=dua`, { waitUntil: 'commit' });
    await nav;
    await p4.waitForSelector('main', { state: 'attached' });
    await p4.waitForTimeout(250);
    const pend = await p4.evaluate(() => ({ vis: getComputedStyle(document.querySelector('main')).visibility, loader: getComputedStyle(document.body, '::before').content }));
    ok(pend.vis === 'hidden' && /Memverifikasi/.test(pend.loader), 'required page hides <main> and shows the loader before auth resolves', pend);
    await p4.waitForURL(/masuk\.html/, { timeout: 8000 }).catch(() => {});
    eq(url(p4.url()), '/masuk.html?next=__test_required.html%3Fa%3D1%26b%3Ddua', "data-auth=required without user → location.replace('masuk.html?next=' + encodeURIComponent(file + search))");
    await p4.unroute('**/assets/js/auth.js');
    await p4.goto(`${BASE}/__test_required.html#aplikasi`, { waitUntil: 'networkidle' }).catch(() => {});
    await p4.waitForURL(/masuk\.html/, { timeout: 5000 }).catch(() => {});
    eq(url(p4.url()), '/masuk.html?next=__test_required.html%23aplikasi', 'next= keeps the #hash (deep links such as anggota.html#aplikasi survive login)');
    // guest without user stays
    await p4.goto(`${BASE}/__test_guest.html?next=anggota.html`, { waitUntil: 'networkidle' });
    await p4.waitForTimeout(300);
    const G0 = await p4.evaluate(() => ({ path: location.pathname, solid: document.querySelector('.site-header').classList.contains('is-solid'), ribbon: !document.querySelector('[data-demo-ribbon]').hidden, ribbonText: document.querySelector('[data-demo-ribbon]').textContent, active: (document.querySelector('.site-nav__link[aria-current]') || {}).textContent || null }));
    ok(G0.path === '/__test_guest.html', 'data-auth=guest without user → stays');
    ok(G0.solid, 'body[data-header="solid"] forces the solid header at the top');
    ok(G0.ribbon && /Mode Demo/.test(G0.ribbonText) && /hanya tersimpan di peramban/.test(G0.ribbonText) && !/README|Firebase/.test(G0.ribbonText), 'demo ribbon shown on guest pages in demo mode (visitor copy, no developer hint)');
    await p4.click('[data-ribbon-close]');
    await p4.reload({ waitUntil: 'networkidle' });
    await p4.waitForTimeout(200);
    ok(await p4.evaluate(() => document.querySelector('[data-demo-ribbon]').hidden && !document.documentElement.classList.contains('has-demo-ribbon')), 'demo ribbon dismissal remembered in localStorage');
    await p4.evaluate(s => localStorage.setItem('ppapi_demo_session', JSON.stringify(s)), SESSION);
    const guestCases = [
      /* v2: anggota.html is data-auth="active" — a Draf session ends on dashboard.html; a public page tests that query + hash survive */
      ['?next=keanggotaan.html%3Fx%3D1%23alur', '/keanggotaan.html?x=1#alur'],
      ['', '/dashboard.html'],
      ['?next=https%3A%2F%2Fevil.example%2F', '/dashboard.html'],
      ['?next=javascript%3Aalert(1)', '/dashboard.html'],
      ['?next=%2F%2Fevil.example%2Fx.html', '/dashboard.html']
    ];
    for (const [q, want] of guestCases) {
      await p4.goto(`${BASE}/__test_guest.html${q}`, { waitUntil: 'commit' });
      await p4.waitForURL(u => !u.pathname.includes('__test_guest'), { timeout: 5000 }).catch(() => {});
      await p4.waitForTimeout(150);
      eq(url(p4.url()), want, `data-auth=guest + user ${q || '(no next)'} → ${want}`);
    }
    // required with user
    await p4.goto(`${BASE}/__test_required.html`, { waitUntil: 'networkidle' });
    await p4.waitForTimeout(300);
    const RQ = await p4.evaluate(() => ({ path: location.pathname, ready: document.body.classList.contains('auth-ready'), pending: document.body.classList.contains('auth-pending'), vis: getComputedStyle(document.querySelector('main')).visibility, log: window.__log.map(l => l.n), user: window.__log[0] && window.__log[0].user && window.__log[0].user.uid, ribbon: !document.querySelector('[data-demo-ribbon]').hidden }));
    eq(RQ, { path: '/__test_required.html', ready: true, pending: false, vis: 'visible', log: [1, 2, 3], user: 'demo-uji-0001', ribbon: false }, 'data-auth=required with user → stays, main visible, onReady sees auth.current() (ribbon stays dismissed)');
    // sign out from the account menu on a required page
    await p4.click('.account__trigger');
    await p4.click('#account-menu [data-signout]');
    await p4.waitForURL(/index\.html/, { timeout: 5000 }).catch(() => {});
    eq(url(p4.url()), '/index.html', "'Keluar' on a required page → index.html");
    await c4.close();

    ok(!pageErrors.length, 'no uncaught page errors / console errors during the run', pageErrors);
  } finally {
    await browser.close();
    server.close();
    cleanupTestFiles();
    ok(!fs.readdirSync(ROOT).some(f => /^__test_/.test(f)), 'throwaway site/__test_*.html files deleted');
  }
}

try {
  nodeChecks();
  await browserChecks();
} catch (e) {
  failures.push('FATAL: ' + (e && e.stack || e));
  console.error(e);
} finally {
  cleanupTestFiles();
}
console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) { console.log('\nFAILURES:\n' + failures.map(f => ' • ' + f).join('\n')); process.exitCode = 1; }
