// Branding guard — fails if forbidden attribution labels appear anywhere in the deployable site.
// Client rule (2026-10-09): never use the three old attribution labels (see FORBIDDEN) on the website;
// the only developer credit allowed is "mrezahuzain@2026".
// Usage (cwd devtools): node flows/branding-guard.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'site');
const FORBIDDEN = [new RegExp('trus'+'tie','i'), new RegExp('nusa[ ]*'+'rendra','i'), new RegExp('rendra[ ]*'+'jayatama','i'), new RegExp('nusa[ ]*'+'safety','i'), new RegExp('nusa'+'safety','i')];
const TEXT_EXT = new Set(['.html', '.js', '.css', '.md', '.json', '.txt', '.svg', '.webmanifest', '.rules', '.xml']);

const hits = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!TEXT_EXT.has(path.extname(name).toLowerCase()) && name !== '.nojekyll') continue;
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const re of FORBIDDEN) if (re.test(line)) hits.push(`${path.relative(ROOT, p)}:${i + 1}: ${line.trim().slice(0, 160)}`);
    });
  }
})(ROOT);

if (hits.length) {
  console.log(`FAIL — ${hits.length} forbidden attribution label(s) found:\n` + hits.map(h => '  ' + h).join('\n'));
  process.exit(1);
}
console.log('PASS — no forbidden attribution labels in site/ (allowed developer credit: mrezahuzain@2026)');
