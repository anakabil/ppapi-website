// Menarik tarif JNE dari halaman resmi Cek Ongkir (jne.co.id/shipping-fee) untuk asal Bekasi ke ibu kota
// tiap provinsi, berat 1 kg, lalu menulis site/assets/data/ongkir-jne.js (dipakai keranjang untuk ongkir otomatis).
// Jalankan dari root repo: node devtools/ongkir/tarik-jne.mjs   (dipanggil juga oleh workflow terjadwal)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'site', 'assets', 'data', 'ongkir-jne.js');
const ASAL = { kode: 'BKI10000', nama: 'Bekasi' };
const UA = 'Mozilla/5.0 (compatible; PPAPI-ongkir/1.0; +https://ppapi.or.id)';
// provinsi → [kota acuan (ibu kota; Maluku Utara: Ternate karena Sofifi tidak ada di JNE), kata kunci pencarian JNE, kode JNE tetap bila
// nama kota tidak dapat dicocokkan otomatis]
const KOTA = {
  'Aceh': ['Banda Aceh', 'banda aceh'], 'Bali': ['Denpasar', 'denpasar'], 'Banten': ['Serang', 'serang'],
  'Bengkulu': ['Bengkulu', 'bengkulu'], 'Daerah Istimewa Yogyakarta': ['Yogyakarta', 'yogyakarta'],
  'DKI Jakarta': ['Jakarta', 'jakarta'], 'Gorontalo': ['Gorontalo', 'gorontalo'], 'Jambi': ['Jambi', 'jambi'],
  'Jawa Barat': ['Bandung', 'bandung'], 'Jawa Tengah': ['Semarang', 'semarang'], 'Jawa Timur': ['Surabaya', 'surabaya'],
  'Kalimantan Barat': ['Pontianak', 'pontianak'], 'Kalimantan Selatan': ['Banjarbaru', 'banjarbaru'],
  'Kalimantan Tengah': ['Palangka Raya', 'palangkaraya'], 'Kalimantan Timur': ['Samarinda', 'samarinda'],
  'Kalimantan Utara': ['Tanjung Selor', 'tanjung', 'TRK20100'], 'Kepulauan Bangka Belitung': ['Pangkalpinang', 'pangkal', 'PGK10000'],
  'Kepulauan Riau': ['Tanjungpinang', 'tanjung pinang'], 'Lampung': ['Bandar Lampung', 'bandar lampung'],
  'Maluku': ['Ambon', 'ambon'], 'Maluku Utara': ['Ternate', 'ternate', 'TTE10000'], 'Nusa Tenggara Barat': ['Mataram', 'mataram'],
  'Nusa Tenggara Timur': ['Kupang', 'kupang'], 'Papua': ['Jayapura', 'jayapura'], 'Papua Barat': ['Manokwari', 'manokwari'],
  'Papua Barat Daya': ['Sorong', 'sorong'], 'Papua Pegunungan': ['Wamena', 'wamena', 'DJJ20700'], 'Papua Selatan': ['Merauke', 'merauke'],
  'Papua Tengah': ['Nabire', 'nabire', 'DJJ20500'], 'Riau': ['Pekanbaru', 'pekanbaru'], 'Sulawesi Barat': ['Mamuju', 'mamuju', 'UPG20700'],
  'Sulawesi Selatan': ['Makassar', 'makassar', 'UPG10015'], 'Sulawesi Tengah': ['Palu', 'palu'], 'Sulawesi Tenggara': ['Kendari', 'kendari'],
  'Sulawesi Utara': ['Manado', 'manado'], 'Sumatera Barat': ['Padang', 'padang'], 'Sumatera Selatan': ['Palembang', 'palembang'],
  'Sumatera Utara': ['Medan', 'medan']
};
const tidur = (ms) => new Promise(r => setTimeout(r, ms));
async function get(url, json) {
  // curl dipakai (bukan fetch) agar mengikuti proxy HTTPS_PROXY di lingkungan yang memakainya
  for (let i = 0; i < 3; i++) {
    try {
      const out = execFileSync('curl', ['-sS', '-f', '-m', '30', '-A', UA, '-H', 'X-Requested-With: XMLHttpRequest', url], { encoding: 'utf8', maxBuffer: 8 << 20 });
      return json ? JSON.parse(out) : out;
    } catch { /* ulangi */ }
    await tidur(1500 * (i + 1));
  }
  throw new Error('gagal: ' + url);
}
const norm = (s) => String(s).toUpperCase().replace(/[^A-Z]/g, '');
async function kodeTujuan(cari, nama, tetap) {
  const d = await get('https://jne.co.id/api-destination?search=' + encodeURIComponent(cari), true);
  const list = Array.isArray(d && d.data) ? d.data : [];
  if (tetap) return list.find(x => x.code === tetap) || null;
  // utamakan label yang sama persis dengan nama kota (kode induk xxx10000)
  return list.find(x => norm(x.label) === norm(nama)) || list.find(x => norm(x.label) === norm(cari)) || list.find(x => /10000$/.test(x.code)) || null;
}
function bacaTarif(html) {
  const t = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
  const out = {};
  for (const m of t.matchAll(/\b(REG|YES|JTR|OKE|SPS)\s+(?:Document\/Paket|Paket|Document)\s+IDR\s+([\d.]+)\s+([\d-]+\s*[DH])/g)) {
    if (!out[m[1]]) out[m[1]] = { tarif: Number(m[2].replace(/\./g, '')), etd: m[3].replace(/\s+/g, ' ') };
  }
  return out;
}
const hasil = {}, gagal = [];
for (const [prov, [nama, cari, tetap]] of Object.entries(KOTA)) {
  try {
    const k = await kodeTujuan(cari, nama, tetap);
    if (!k) { gagal.push(prov + ' (kode kota tidak ditemukan)'); continue; }
    await tidur(700);
    const html = await get(`https://jne.co.id/shipping-fee?origin=${ASAL.kode}&destination=${k.code}&weight=1`);
    const t = bacaTarif(html);
    if (!t.REG) { gagal.push(prov + ' (REG tidak tersedia)'); continue; }
    hasil[prov] = { kota: nama, kode: k.code, label: k.label, reg: t.REG.tarif, etd: t.REG.etd, yes: t.YES ? t.YES.tarif : null };
    console.log(prov.padEnd(28), k.code, k.label.padEnd(26), 'REG', t.REG.tarif, t.REG.etd);
    await tidur(700);
  } catch (e) { gagal.push(prov + ' (' + e.message + ')'); }
}
if (Object.keys(hasil).length < 30) { console.error('Terlalu sedikit tarif terbaca (' + Object.keys(hasil).length + '); berkas tidak diubah.', gagal); process.exit(1); }
const data = { kurir: 'JNE', layanan: 'REG', asal: ASAL, sumber: 'https://jne.co.id/shipping-fee', diambil: new Date().toISOString().slice(0, 10), beratAcuanKg: 1, tarif: hasil, gagal };
fs.writeFileSync(OUT, '/* Dibuat otomatis oleh devtools/ongkir/tarik-jne.mjs dari jne.co.id (Cek Ongkir). Jangan diubah manual. */\n' +
  'window.PPAPI = window.PPAPI || {}; window.PPAPI.data = window.PPAPI.data || {};\nwindow.PPAPI.data.ongkirJne = ' + JSON.stringify(data, null, 1) + ';\n');
console.log('\nTersimpan', Object.keys(hasil).length, 'provinsi →', path.relative(ROOT, OUT), gagal.length ? '\nGagal: ' + gagal.join('; ') : '');
