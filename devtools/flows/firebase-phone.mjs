// Firebase PHONE-AUTH lifecycle test (no real project) — run from devtools/:  node flows/firebase-phone.mjs
// Needs internet access to www.gstatic.com (the real compat SDK 12.4.0 is loaded, like firebase-smoke.mjs).
//
// Part A (deterministic): config.js gets a FAKE apiKey; the reCAPTCHA script (www.google.com/recaptcha/api.js)
//   is replaced by a stub that behaves like the real grecaptcha where it matters — render() THROWS
//   "reCAPTCHA has already been rendered in this element" when an element is rendered into twice — and the
//   identitytoolkit endpoints are stubbed (recaptchaParams → site key, sendVerificationCode → fail / ok,
//   signInWithPhoneNumber → INVALID_CODE). The real SDK code path runs end to end:
//   startPhone fails → retry with the SAME buttonEl → succeeds → "Kirim ulang" with the same button → succeeds.
// Part B (real network, fake key): repeated startPhone calls with the same button against the real reCAPTCHA
//   loader all reject with the mapped Indonesian auth/invalid-api-key error and leave no widget slots behind.
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
      .replace(/apiKey:\s*'[^']*'/, "apiKey: 'AIzaSyFAKE-key-for-phone-test-0000000'")
      .replace("authDomain: ''", "authDomain: 'ppapi-phone-test.firebaseapp.com'")
      .replace(/projectId:\s*'[^']*'/, "projectId: 'ppapi-phone-test'")
      .replace("appId: ''", "appId: '1:000000000000:web:0000000000000000000000'");
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let passed = 0, failed = 0;
const ok = (c, m, x) => { if (c) { passed++; console.log('✓ ' + m); } else { failed++; process.exitCode = 1; console.error('✗ ' + m + (x !== undefined ? '\n    ' + JSON.stringify(x) : '')); } };

/* grecaptcha stub: same contract as the real v2 API for what Firebase uses */
const GRECAPTCHA_STUB = `(function () {
  var src = (document.currentScript && document.currentScript.src) || '';
  var m = /[?&]onload=([^&]+)/.exec(src);
  var widgets = [];
  window.__rc = { renders: 0, executes: 0, already: 0, onButtons: 0 };
  window.grecaptcha = {
    render: function (el, params) {
      if (typeof el === 'string') el = document.getElementById(el);
      if (!el) throw new Error('reCAPTCHA placeholder element must be an element or id');
      if (el.__rcRendered) { window.__rc.already++; throw new Error('reCAPTCHA has already been rendered in this element'); }
      el.__rcRendered = true;
      el.setAttribute('data-rc-rendered', '');
      if (el.tagName === 'BUTTON') window.__rc.onButtons++;
      var badge = document.createElement('div'); badge.className = 'grecaptcha-badge'; badge.style.cssText = 'position:fixed;right:0;bottom:14px;width:70px;height:60px';
      if (el.tagName !== 'BUTTON') el.appendChild(badge);
      widgets.push({ el: el, params: params || {}, token: '' });
      window.__rc.renders++;
      return widgets.length - 1;
    },
    execute: function (id) {
      var wd = widgets[id]; window.__rc.executes++;
      setTimeout(function () { wd.token = 'stub-token-' + id + '-' + window.__rc.executes; if (typeof wd.params.callback === 'function') wd.params.callback(wd.token); }, 5);
    },
    getResponse: function (id) { return (widgets[id] || {}).token || ''; },
    reset: function (id) { if (widgets[id]) widgets[id].token = ''; },
    ready: function (cb) { cb(); }
  };
  if (m && typeof window[decodeURIComponent(m[1])] === 'function') window[decodeURIComponent(m[1])]();
})();`;

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const json = (route, status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const apiErr = (route, message) => json(route, 400, { error: { code: 400, message, errors: [{ message, domain: 'global', reason: 'invalid' }] } });

const browser = await chromium.launch();
try {
  /* ---------------- Part A: stubbed reCAPTCHA + identitytoolkit ---------------- */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    const calls = { send: 0, params: 0 };
    let sendMode = 'fail';
    await page.route(/www\.google\.com\/recaptcha\/(api|enterprise)\.js/, r => r.fulfill({ status: 200, headers: { 'content-type': 'text/javascript' }, body: GRECAPTCHA_STUB }));
    await page.route(/identitytoolkit\.googleapis\.com/, async route => {
      const req = route.request(), url = req.url();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      if (url.includes('/recaptchaParams')) { calls.params++; return json(route, 200, { kind: 'identitytoolkit#GetRecaptchaParamResponse', recaptchaSiteKey: 'stub-site-key' }); }
      if (url.includes('/recaptchaConfig')) return apiErr(route, 'CONFIGURATION_NOT_FOUND');
      if (url.includes('accounts:sendVerificationCode')) {
        calls.send++;
        const body = JSON.parse(req.postData() || '{}');
        calls.lastToken = body.recaptchaToken || '';
        return sendMode === 'ok' ? json(route, 200, { sessionInfo: 'stub-session-' + calls.send }) : apiErr(route, 'TOO_MANY_ATTEMPTS_TRY_LATER');
      }
      if (url.includes('accounts:signInWithPhoneNumber')) return apiErr(route, 'INVALID_CODE');
      return apiErr(route, 'API_KEY_INVALID');
    });

    await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 30000 });
    ok(await page.evaluate(() => PPAPI.auth.mode === 'firebase'), 'fake apiKey → auth in firebase mode (real compat SDK)');
    await page.evaluate(() => {
      const b = document.createElement('button'); b.type = 'button'; b.id = 'uji-otp-btn'; b.className = 'btn btn--primary'; b.textContent = 'Kirim Kode OTP';
      document.querySelector('#main').prepend(b);
    });
    const attempt = () => page.evaluate(async () => {
      const btn = document.getElementById('uji-otp-btn');
      try { const r = await PPAPI.auth.startPhone({ phone: '0812-3456-7890', buttonEl: btn }); return { ok: true, r }; }
      catch (e) { return { ok: false, code: e.code, message: e.message, isError: e instanceof Error }; }
    });
    const state = () => page.evaluate(() => ({
      slots: document.querySelectorAll('#ppapi-recaptcha > *').length,
      hostInBody: !!document.querySelector('body > #ppapi-recaptcha'),
      btnRendered: document.getElementById('uji-otp-btn').hasAttribute('data-rc-rendered'),
      rc: window.__rc ? { ...window.__rc } : null
    }));

    sendMode = 'fail';
    const a1 = await attempt(); const s1 = await state();
    ok(!a1.ok && a1.isError && a1.code === 'auth/too-many-requests' && /Terlalu banyak percobaan/i.test(a1.message), '1st attempt: backend error mapped to Indonesian Error (auth/too-many-requests)', a1);
    ok(s1.rc && s1.rc.renders === 1 && s1.rc.executes === 1 && calls.params >= 1 && /^stub-token-/.test(calls.lastToken), 'reCAPTCHA rendered + executed once; token sent with sendVerificationCode', { rc: s1.rc, calls });
    ok(s1.slots === 0 && s1.hostInBody && !s1.btnRendered, 'after a failure the verifier slot is removed; the button itself never hosts the widget', s1);

    sendMode = 'ok';
    const a2 = await attempt(); const s2 = await state();
    ok(a2.ok && a2.r.phone === '+6281234567890' && /\+62 812-/.test(a2.r.masked), 'retry with the SAME buttonEl after a failure succeeds (no "already rendered")', a2);
    ok(s2.rc.already === 0 && s2.rc.renders === 2 && s2.slots === 1, 'second attempt rendered into a fresh slot (renders=2, one live slot)', s2);

    const a3 = await attempt(); const s3 = await state();
    ok(a3.ok, '"Kirim ulang" with the same button after a success succeeds', a3);
    ok(s3.rc.already === 0 && s3.rc.renders === 3 && s3.slots === 1 && calls.send === 3, 'resend: previous verifier disposed, new widget + token (renders=3, sends=3, one slot)', { s3, calls });

    const c1 = await page.evaluate(async () => { try { await PPAPI.auth.confirmPhone({ code: '000000' }); return 'NO ERROR'; } catch (e) { return { code: e.code, message: e.message }; } });
    ok(c1 && c1.code === 'auth/invalid-verification-code' && /Kode OTP tidak sesuai/i.test(c1.message), 'confirmPhone with a wrong code → auth/invalid-verification-code (Indonesian)', c1);

    sendMode = 'fail';
    const a4 = await attempt(); const s4 = await state();
    ok(!a4.ok && a4.code === 'auth/too-many-requests' && s4.slots === 0, 'failure after a success: mapped error, slot cleaned up', { a4, s4 });
    sendMode = 'ok';
    const a5 = await attempt(); const s5 = await state();
    ok(a5.ok && s5.rc.already === 0 && s5.rc.onButtons === 0 && s5.slots === 1, 'and the next attempt with the same button works again (5 attempts, 0 re-render errors)', { a5, s5 });

    /* page swaps the button (masuk.js workaround) — still fine */
    await page.evaluate(() => { const b = document.getElementById('uji-otp-btn'); const c = b.cloneNode(true); b.replaceWith(c); });
    const a6 = await attempt();
    ok(a6.ok, 'a page that replaces the button with a clone (masuk.js workaround) keeps working', a6);
    const many = await page.evaluate(async () => {
      const btn = document.getElementById('uji-otp-btn');
      const res = await Promise.allSettled([PPAPI.auth.startPhone({ phone: '081234567890', buttonEl: btn }), PPAPI.auth.startPhone({ phone: '081234567890', buttonEl: btn })]);
      return { statuses: res.map(r => r.status), slots: document.querySelectorAll('#ppapi-recaptcha > *').length };
    });
    ok(many.slots <= 1 && many.statuses.includes('fulfilled'), 'two overlapping startPhone calls leave at most one live slot', many);
    ok(pageErrors.length === 0, 'no uncaught page errors (part A)', pageErrors);
    await ctx.close();
  }

  /* ---------------- Part B: real reCAPTCHA loader, fake key, no stubs ---------------- */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 30000 });
    const res = await page.evaluate(async () => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Kirim Kode OTP'; document.querySelector('#main').prepend(btn);
      const out = [];
      for (let i = 0; i < 3; i++) {
        try { await PPAPI.auth.startPhone({ phone: '081234567890', buttonEl: btn }); out.push('NO ERROR'); }
        catch (e) { out.push(e.code); }
      }
      return { out, slots: document.querySelectorAll('#ppapi-recaptcha > *').length, grecaptcha: typeof window.grecaptcha };
    });
    console.log('   real-network attempts:', JSON.stringify(res));
    ok(res.out.length === 3 && res.out.every(c => c === res.out[0] && /^auth\//.test(c) && c !== 'auth/argument-error' && c !== 'auth/internal-error'),
      'real SDK + fake key: 3 attempts with the same button give the same mapped error each time (no re-render failure)', res);
    ok(res.slots === 0, 'no reCAPTCHA slots left behind after failures', res);
    ok(pageErrors.length === 0, 'no uncaught page errors (part B)', pageErrors);
    await ctx.close();
  }
} catch (err) {
  failed++; process.exitCode = 1; console.error(err);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failed} failed.`);
