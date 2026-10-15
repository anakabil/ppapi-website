// Footer bottom-row close-ups (developer credit) at 1440 / 390 / 320 px. Run from devtools/: node flows/footer-credit-shot.mjs [page] [outDir]
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { startServer, SHOTS } from './qa-lib.mjs';
const pg = process.argv[2] || 'index.html';
const out = process.argv[3] || SHOTS;
fs.mkdirSync(out, { recursive: true });
const { BASE, close } = await startServer();
const b = await chromium.launch();
for (const [w, h, m] of [[1440, 900, false], [390, 844, true], [320, 720, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: m, hasTouch: m, deviceScaleFactor: m ? 2 : 1, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/${pg}`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.site-footer__bottom');
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await p.waitForTimeout(600);
  const el = await p.$('.site-footer__bottom');
  const bb = await el.boundingBox();
  await p.screenshot({ path: path.join(out, `footer-credit-${pg.replace(/[\/.]/g, '_')}-${w}.png`), clip: { x: 0, y: Math.max(0, bb.y - 140), width: w, height: Math.min(bb.height + 180, 600) } });
  await ctx.close();
}
await b.close(); await close();
console.log('footer-credit-shot: saved to ' + out);
