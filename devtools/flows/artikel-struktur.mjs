// Pemeriksa artikel berita PPAPI.
// Pakai (dari devtools/): node flows/artikel-struktur.mjs [berita.js] [berita-asli.js]
//  (a) enam subjudul wajib berurutan  (b) tidak ada kata kaku  (c) sitasi (Penulis, Tahun) <-> Daftar Pustaka
//  (d) entri Daftar Pustaka identik dengan versi asli (bila diberikan)  (e) 700–1100 kata sebelum Daftar Pustaka
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

function load(file) {
  const sb = { window: {} }; sb.PPAPI_DATA = sb.window.PPAPI_DATA = {};
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(file, 'utf8').replace('window.PPAPI_DATA = window.PPAPI_DATA || {};', ''), sb);
  return sb.PPAPI_DATA.berita;
}
const [file = fileURLToPath(new URL('../../site/assets/data/berita.js', import.meta.url)), orig] = process.argv.slice(2);
const B = load(file);
const O = orig ? Object.fromEntries(load(orig).map(b => [b.id, b])) : null;

const HEADS = ['Latar Belakang', 'Masalah yang Sering Terjadi', 'Penjelasan dan Penyelesaian Berdasarkan Referensi', 'Solusi dan Kontribusi PPAPI', 'Penutup', 'Daftar Pustaka'];
const KAKU = ['lazim', 'simpulan', 'kerap', 'guna', 'kendati', 'niscaya', 'acap kali', 'senantiasa', 'sedemikian', 'termaktub', 'adapun', 'yakni',
  'lantas', 'galib', 'tatkala', 'sebagaimana dimaksud', 'dalam hal', 'implikasi', 'implikasinya', 'mitigasi', 'kontinu', 'eksisting', 'signifikan', 'krusial', 'fundamental'];
const kakuRe = new RegExp('(?<![\\p{L}\\p{N}])(' + KAKU.map(k => k.replace(/ /g, '\\s+')).join('|') + ')(?![\\p{L}\\p{N}])', 'giu');

const yr = String.raw`(\d{4}[a-z]?|t\.t\.(?:-[a-z])?)`;
function entryKey(e) {
  const m = e.match(/^(.+?)\.\s\((\d{4}[a-z]?|t\.t\.(?:-[a-z])?)[,)]/);
  if (!m) return null;
  let a = m[1];
  // penulis perorangan: "Halperin, K. M., & McCann, M" -> "Halperin"
  if (/^[^,]+, [A-Z]/.test(a)) a = a.split(',')[0];
  return { author: a.trim(), year: m[2] };
}
function citeCandidates(a) {
  a = a.trim().replace(/^(lihat|mis\.)\s+/i, '');
  const c = new Set([a]);
  const noEt = a.replace(/\s+et al\.?$/, '').trim(); c.add(noEt);
  c.add(noEt.split(/\s+(?:&|dan)\s+/)[0].trim());
  return [...c];
}

let fail = 0;
const report = [];
for (const b of B) {
  const isi = b.isi;
  const problems = [];
  const heads = isi.filter(t => /^##\s/.test(t)).map(t => t.replace(/^##\s+/, ''));
  if (heads.join('|') !== HEADS.join('|')) problems.push('(a) subjudul: ' + heads.join(' | '));
  const di = isi.indexOf('## Daftar Pustaka');
  const body = isi.slice(0, di);
  const refs = isi.slice(di + 1);
  const textAll = [b.judul, b.ringkasan, ...body].join('\n');
  const kaku = [...textAll.matchAll(kakuRe)].map(m => m[0]);
  if (kaku.length) problems.push('(b) kata kaku: ' + kaku.join(', '));
  // sitasi
  const keys = refs.map(entryKey);
  if (keys.some(k => !k)) problems.push('(c) entri tak terbaca: ' + refs.filter((r, i) => !keys[i]).join(' || '));
  const cites = [];
  const bodyText = body.join('\n');
  for (const m of bodyText.matchAll(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    for (const seg of m[1].split(';')) {
      const mm = seg.trim().match(new RegExp('^(.+?),\\s*' + yr + '(?:,|$)'));
      if (mm && /^[A-ZÀ-Ž]/.test(mm[1].trim())) cites.push({ a: mm[1], y: mm[2], raw: seg.trim() });
    }
  }
  for (const m of bodyText.matchAll(new RegExp(String.raw`([A-ZÀ-Ž][\p{L}\-]+(?:\s+et al\.)?(?:\s+(?:dan|&)\s+[A-ZÀ-Ž][\p{L}\-]+)?)\s\(` + yr + String.raw`\)`, 'gu'))) cites.push({ a: m[1], y: m[2], raw: m[0] });
  const used = new Set();
  for (const c of cites) {
    const cand = citeCandidates(c.a);
    const i = keys.findIndex(k => k && k.year === c.y && cand.includes(k.author));
    if (i < 0) problems.push('(c) sitasi tanpa entri: ' + c.raw); else used.add(i);
  }
  keys.forEach((k, i) => { if (k && !used.has(i)) problems.push('(c) entri tidak disitasi: ' + k.author + ' ' + k.year); });
  // (d) daftar pustaka asli
  if (O && O[b.id]) {
    const od = O[b.id].isi; const oref = od.slice(od.indexOf('## Daftar Pustaka') + 1);
    if (oref.join('\n') !== refs.join('\n')) problems.push('(d) Daftar Pustaka berbeda dari asli');
  }
  // (e) jumlah kata
  const words = body.join(' ').replace(/^##\s+/gm, '').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
  if (words < 700 || words > 1100) problems.push('(e) jumlah kata ' + words);
  if (problems.length) fail++;
  report.push({ id: b.id, judul: b.judul, kata: words, referensi: refs.length, sitasi: cites.length, ok: !problems.length, problems });
}
for (const r of report) {
  console.log(`${r.ok ? 'LULUS' : 'GAGAL'}  ${r.id}  | ${r.kata} kata | ${r.referensi} referensi | ${r.sitasi} sitasi dalam teks`);
  r.problems.forEach(p => console.log('   - ' + p));
}
console.log(`\n${B.length} artikel, ${B.length - fail} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
