// fixer probe (berita+agenda): Chromium semantics of history.scrollRestoration — when must 'manual' be set,
// and does it affect same-document fragment Back? Self-contained server with synthetic pages.
import { chromium } from 'playwright';
import http from 'node:http';
const page = (mode) => `<!doctype html><html><head><meta charset=utf-8><title>t</title>
<script>window.__y0 = null; ${mode === 'head' ? "history.scrollRestoration='manual';" : ''}</script></head>
<body style="margin:0"><a id=go href="#far">far</a><div style="height:3000px;background:linear-gradient(#eee,#999)"></div><h2 id=far>far</h2><div style="height:2000px"></div>
<script>
document.addEventListener('DOMContentLoaded', () => { window.__y0 = scrollY; });
${mode === 'always' ? "history.scrollRestoration='manual';" : ''}
${mode === 'pagehide' ? "addEventListener('pagehide', () => { history.scrollRestoration='manual'; });" : ''}
${mode === 'ph-replace-first' ? "addEventListener('pagehide', () => { history.replaceState({y: scrollY}, ''); history.scrollRestoration='manual'; });" : ''}
${mode === 'ph-mode-first' ? "addEventListener('pagehide', () => { history.scrollRestoration='manual'; history.replaceState({y: scrollY}, ''); });" : ''}
${mode === 'beforeunload' ? "addEventListener('beforeunload', () => { history.scrollRestoration='manual'; });" : ''}
${mode === 'scroll' ? "let t; addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => { history.scrollRestoration = scrollY > 0 ? 'manual' : 'auto'; }, 200); }, { passive: true });" : ''}
addEventListener('load', () => setTimeout(() => { window.__yl = scrollY; window.__sr = history.scrollRestoration; window.__st = JSON.stringify(history.state); }, 300));
</script></body></html>`;
const srv = http.createServer((req, res) => { const m = new URL(req.url, 'http://x').searchParams.get('m') || 'none'; res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' }); res.end(page(m)); });
await new Promise(r => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch();
for (const m of ['none', 'always', 'pagehide', 'beforeunload', 'scroll', 'ph-replace-first', 'ph-mode-first']) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const p = await ctx.newPage();
  await p.goto(base + '?m=' + m); await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(400);
  await p.reload(); await p.waitForTimeout(700);
  const r1 = await p.evaluate(() => ({ y0: window.__y0, yl: window.__yl, sr: window.__sr, st: window.__st }));
  // same-document fragment: from y=0 click #far, then Back
  await p.goto(base + '?m=' + m + '&b=1'); await p.waitForTimeout(300);
  await p.evaluate(() => scrollTo(0, 200)); await p.waitForTimeout(400);
  await p.click('#go'); await p.waitForTimeout(400);
  const yFar = await p.evaluate(() => scrollY);
  await p.goBack(); await p.waitForTimeout(500);
  const yBack = await p.evaluate(() => scrollY);
  console.log(m.padEnd(13), `reload: y@DCL ${r1.y0} y@load ${r1.yl} (mode now ${r1.sr}, state ${r1.st})`, `| fragment: 200 -> #far ${yFar} -> Back ${yBack}`);
  await ctx.close();
}
await browser.close(); srv.close();
