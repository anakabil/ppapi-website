// Smoke test of the Firebase code path WITHOUT a real project.
// Run from devtools/:  node flows/firebase-smoke.mjs   (needs internet access to www.gstatic.com)
// config.js is rewritten on the fly with a FAKE apiKey, so PPAPI.auth switches to 'firebase' mode:
// checks that the compat SDK (v12.4.0) loads in order, ready() resolves (signed out), the UI keeps
// working, and a backend error from the fake key is mapped to an Indonesian Error (no crash).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/assets/js/config.js') {
    body = body.toString('utf8')
      .replace(/apiKey:\s*'[^']*'/, "apiKey: 'AIzaSyFAKE-key-for-smoke-test-000000000'")
      .replace("authDomain: ''", "authDomain: 'ppapi-smoke-test.firebaseapp.com'")
      .replace(/projectId:\s*'[^']*'/, "projectId: 'ppapi-smoke-test'")
      .replace("appId: ''", "appId: '1:000000000000:web:0000000000000000000000'");
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
const ok = (c, m, x) => { if (!c) { console.error('✗ ' + m + (x !== undefined ? '\n    ' + JSON.stringify(x) : '')); process.exitCode = 1; throw new Error(m); } passed++; console.log('✓ ' + m); };
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  const sdk = [];
  page.on('response', r => { if (r.url().includes('gstatic.com/firebasejs')) sdk.push(r.status() + ' ' + r.url().split('/').pop()); });
  await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 30000 });
  const st = await page.evaluate(async () => ({ mode: PPAPI.auth.mode, store: PPAPI.store.mode, user: await PPAPI.auth.ready(), ver: window.firebase && firebase.SDK_VERSION, apps: window.firebase ? firebase.apps.length : 0, guest: !!document.querySelector('.account__guest'), err: PPAPI.auth.error && PPAPI.auth.error.code }));
  ok(st.mode === 'firebase' && st.store === 'firebase', 'apiKey present → auth/store in firebase mode', st);
  ok(sdk.length === 3 && sdk.every(s => s.startsWith('200')) && /app-compat/.test(sdk[0]) && /auth-compat/.test(sdk[1]) && /firestore-compat/.test(sdk[2]), 'compat SDK loaded sequentially: app → auth → firestore', sdk);
  ok(st.ver === '12.4.0' && st.apps === 1 && !st.err, 'firebase.SDK_VERSION 12.4.0 initialised once', st);
  ok(st.user === null && st.guest, 'ready() resolves null and header shows Masuk/Daftar');
  const e = await page.evaluate(async () => {
    try { await PPAPI.auth.signInEmail({ email: 'uji@contoh.id', password: 'Perancah2026' }); return 'NO ERROR'; }
    catch (err) { return { code: err.code, message: err.message, isError: err instanceof Error }; }
  });
  console.log('   mapped:', JSON.stringify(e));
  ok(e && e.isError && e.code === 'auth/invalid-api-key' && e.message === 'Konfigurasi layanan masuk tidak valid. Mohon hubungi pengelola situs.', 'backend error (fake key) mapped to an Indonesian Error (auth/invalid-api-key)', e);
  const v = await page.evaluate(async () => { try { await PPAPI.auth.signUpEmail({ name: 'Uji', email: 'x@contoh.id', password: 'pendek' }); } catch (err) { return err.code; } });
  ok(v === 'auth/weak-password', 'client-side validation runs before any network call in firebase mode', v);
  ok(pageErrors.length === 0, 'no uncaught page errors', pageErrors);
  console.log(`\nAll ${passed} firebase smoke checks passed.`);
} catch (err) {
  if (!process.exitCode) { console.error(err); process.exitCode = 1; }
} finally {
  await browser.close();
  server.close();
}
