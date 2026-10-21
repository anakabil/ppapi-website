// Bangun PDF sertifikat dengan templat bawaan (tanpa desain unggahan) → shots/flow-kegiatan-default.pdf
// Dijalankan di agenda.html karena CSP halaman itu mengizinkan cdnjs (jsPDF).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srv = await startServer();
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(srv.BASE + '/agenda.html', { waitUntil: 'networkidle' });
const b64 = await p.evaluate(async () => {
  const K = PPAPI.kegiatan;
  const ev = K.normEvent({ id: 'kg-x', judul: 'Seminar Nasional Keselamatan Pekerjaan Perancah di Ketinggian dan Konstruksi Bangunan Gedung', jenis: 'Seminar', mulaiAt: '2026-11-03T01:00:00Z', selesaiAt: '2026-11-04T09:00:00Z', status: 'terbit' });
  const doc = await K.buildPdf(ev, K.defaultDesign(), { nama: 'Siti Rahmawati', no: 'PPAPI-SERT-2026-SEM1103-0012', verifyUrl: K.verifyUrl('PPAPI-SERT-2026-SEM1103-0012') });
  return doc.output('datauristring').split(',')[1];
});
fs.writeFileSync(path.resolve(__dirname, '..', 'shots', 'flow-kegiatan-default.pdf'), Buffer.from(b64, 'base64'));
await b.close(); await srv.close();
