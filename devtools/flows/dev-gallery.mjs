// Galeri komponen untuk pengembang (styleguide.html + pages/styleguide.{css,js}).
// Sejak 2026-10-21 galeri TIDAK lagi berada di site/ (tidak ikut terbit ke ppapi.or.id); berkasnya
// ada di devtools/styleguide/ dengan susunan folder yang sama. Server uji memanggil galleryFile(p)
// sebelum mencari di site/, sehingga /styleguide.html tetap dapat dibuka oleh uji regresi.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GALLERY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'styleguide');

/** absolute path of a gallery file for a URL path ('/styleguide.html', '/assets/js/pages/styleguide.js'), else null */
export function galleryFile(p) {
  const f = path.join(GALLERY, String(p || '').replace(/^\/+/, ''));
  if (!f.startsWith(GALLERY + path.sep)) return null;
  try { return fs.statSync(f).isFile() ? f : null; } catch { return null; }
}
