// summarise shots/v2lens/axe/*.json + perf/*.json (review only)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots', 'v2lens');
const agg = new Map();
for (const f of fs.readdirSync(path.join(D, 'axe')).filter(f => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(D, 'axe', f), 'utf8'));
  if (j.errors && j.errors.length) console.log('ERRORS', f, j.errors.slice(0, 3).join(' / ').slice(0, 300));
  for (const r of j.runs) {
    if (r.error) { console.log('RUN ERROR', f, r.name, r.error); continue; }
    for (const v of r.violations) {
      if (v.id === 'target-size' && v.nodes.every(n => n.target === '.brand')) continue; // header-hidden false positive
      const k = `${v.impact} ${v.id}`;
      if (!agg.has(k)) agg.set(k, []);
      agg.get(k).push(`${j.id}/${j.vp}/${r.name}: ${v.nodes.map(n => n.target).slice(0, 3).join(' ; ')}`);
    }
  }
}
for (const [k, list] of [...agg].sort()) { console.log(`\n## ${k} (${list.length})`); list.slice(0, 40).forEach(x => console.log('  ' + x)); }
console.log('\n## perf');
const rows = [];
for (const f of fs.readdirSync(path.join(D, 'perf')).filter(f => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(D, 'perf', f), 'utf8'));
  const [a, b] = j.visits;
  rows.push(`${(j.id + '/' + j.vp).padEnd(46)} CLS ${String(a.cls).padEnd(7)} ${String(b.cls).padEnd(7)} gz ${String(Math.round(a.gzBytes / 1024)).padStart(5)}KB req ${String(a.reqs).padStart(3)} long ${a.long.length}/${a.long.reduce((s, x) => s + x.d, 0)}ms max ${a.long.reduce((s, x) => Math.max(s, x.d), 0)} | img ${Math.round((a.byType.image || 0) / 1024)}KB js ${Math.round((a.byType.script || 0) / 1024)}KB css ${Math.round((a.byType.stylesheet || 0) / 1024)}KB font ${Math.round((a.byType.font || 0) / 1024)}KB`);
}
rows.sort().forEach(r => console.log(r));
