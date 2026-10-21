# PPAPI — Foundation notes for page authors

> **v2 (2026-10-09)** — membership lifecycle, admin role, managed content, knowledge products and member
> apps: read **§9 at the end of this file** (exact API, CSS components, gating, demo accounts, Firestore
> paths, and the list of v1 test expectations that changed). Sections 1–8 still apply unless §9 says otherwise.

What the foundation actually implements (read with `SPEC.md`). Shared files are READ-ONLY for
page tasks: `site/assets/css/main.css`, `site/assets/js/{config,core,auth,store}.js`,
`site/assets/data/*.js`, `site/styleguide.html` (+ its `pages/styleguide.*`), `site/README.md`,
`site/firestore.rules`. Visual reference: open `styleguide.html` (every component, light + dark).

Verification tooling (run from `devtools/`):
- From the workspace root: `node devtools/check.mjs <page> [--auth] [--full] [--motion]`.
- `node flows/fullshot.mjs <page> [--auth] [--mobile|--desktop] [--motion]` — full-page screenshot that **scrolls first**,
  so `loading="lazy"` images far below the fold are loaded (they show as empty grey boxes in `check.mjs --full`).
  Output: `devtools/shots/<page>-<vp>-scrolled.png`.
- `node flows/contract.mjs` (248 checks) — **the SPEC contract test**: every SPEC §2.2 function/property (util, icon, ui, auth,
  store, layout, gating), every §2.5 class, every §2.4 data rule, config vs research. Creates throwaway `site/__test_*.html`
  pages and deletes them. Clock frozen at 2026-10-08 10:00 WIB. Run it after any shared-file change.
- `node flows/auth-demo.mjs` (53 checks) and `node flows/foundation-ui.mjs` (30 checks) — foundation regression tests.
  Both include tiny in-memory pages, so they run before your pages exist.
- `node flows/firebase-smoke.mjs` (7 checks, needs internet) — rewrites config.js on the fly with a FAKE apiKey to exercise the
  Firebase path: SDK 12.4.0 loads app → auth → firestore, `ready()` resolves, errors map to Indonesian (`auth/invalid-api-key`).
- `node flows/firebase-phone.mjs` (17 checks, needs internet) — real compat SDK + fake key, with a grecaptcha stub that throws
  "already rendered" like the real one and stubbed identitytoolkit replies: fail → retry → resend with the SAME button, wrong OTP,
  overlapping calls; plus 3 real-network attempts. (Fails 8/17 on the pre-2026-10-08 auth.js — it reproduces the old bug.)
- `node flows/foundation-fixes.mjs` (62 checks, desktop 1280 + mobile 390, motion on) — measured regression test for every
  changelog item below, on an in-memory test page (nothing written to `site/`). Fails 48/62 on the pre-fix foundation.

---

## 1. Page skeleton & boot order

Use SPEC §2.1 verbatim. Script order matters: `config.js` → `data/*.js` → `core.js` → `auth.js` → `store.js` → `pages/<key>.js`
(all `defer`). Boot happens on `DOMContentLoaded`:

1. core injects header (`#site-header`) and footer (`#site-footer`), wires menus, hydrates `[data-icon]` /
   `[data-scaffold]` / `[data-tabs]` / `[data-accordion]` / `.marquee`, registers reveals.
2. `await PPAPI.auth.ready()` (demo: instant; Firebase: loads SDK).
3. Gating: `data-auth="required"` + no user → `location.replace('masuk.html?next=' + encodeURIComponent(file + search + hash))`;
   `data-auth="guest"` + user → `location.replace(util.safeNext(qs('next'), 'dashboard.html'))`.
4. `body.auth-ready` is added, account area rendered, then every `PPAPI.onReady(fn)` runs (sequentially, errors caught → console.error + toast).

**Put all page logic inside `PPAPI.onReady(async () => { … })`.** Inside it, `PPAPI.auth.current()` is reliable.

While gated, `<main>` and `#site-footer` are `visibility:hidden` with a centred spinner + "Memverifikasi sesi…"
(CSS hides main for `body[data-auth="required"]` immediately, so there is no flash before JS runs).

`<body data-header="solid">` forces the solid header from the top (use when the page has no full-bleed dark hero
under the header, e.g. masuk split layout).

Reserved ids: `site-header`, `site-footer`, `main`, `mobile-menu`, `account-menu`, `ppapi-recaptcha`.
Reserved storage keys: `ppapi_demo_users`, `ppapi_demo_session`, `ppapi_member_<uid>`, `ppapi_feedback`,
`ppapi_demo_ribbon_dismissed` (localStorage), `ppapi_flash` (sessionStorage).
z-index scale: header 120 · mobile menu 110 · modal 250 · toast 300 · skip link 400.

---

## 2. JavaScript API (exact signatures)

### `PPAPI` root
| Member | Notes |
| --- | --- |
| `PPAPI.config` | `window.PPAPI_CONFIG` (see §5) |
| `PPAPI.data` | `window.PPAPI_DATA` (`{}` when no data file loaded) |
| `PPAPI.onReady(fn)` | fn may be async |
| `PPAPI.isReady()` | boolean |
| `PPAPI.icon(name, {size=20, cls='', label})` | inline SVG **string** (stroke `currentColor`, 1.5, 24 viewBox, `aria-hidden` unless `label` → `role="img" aria-label`). Class `icon icon--<name> <cls>`. Unknown name → `''` + console.warn. |
| `PPAPI.icons` | array of all icon names |
| `PPAPI.layout.renderAccount()`, `.closeMenu()`, `.closeAccountMenu()` | rarely needed |
| `PPAPI.motion.prefersReduced()` | boolean |

Icon names: `arrow-right arrow-left arrow-up-right arrow-down arrow-up external menu close user users user-plus mail phone
lock eye eye-off calendar clock map-pin file-text download upload search filter check check-circle x-circle
alert-triangle info help-circle shield shield-check award certificate hard-hat layers settings logout edit plus minus
trash link chevron-down chevron-up chevron-right chevron-left building book scale message send star star-filled grid
compass wrench ruler activity bell bookmark briefcase globe home id-card qr-code printer share copy refresh quote
instagram linkedin youtube facebook whatsapp google` (`google` = official 4-colour G, the only coloured icon).

Static HTML icons: `<span data-icon="arrow-right" data-icon-size="18" data-icon-class="btn__icon"></span>`
(optional `data-icon-label="…"` for meaningful icons). Hydrated at boot and by `PPAPI.ui.reveal(root)`.

### `PPAPI.util`
| Function | Result |
| --- | --- |
| `$(sel, root?)`, `$$(sel, root?)` | element / **array** |
| `h(str)` | HTML-escape (`& < > " ' \``); null/undefined → `''`. **Escape every data/user string you put in innerHTML.** |
| `emphasis(str)` / `plain(str)` | escape + `*kata*` → `<em>kata</em>` / strip asterisks (config.tagline uses `*…*`) |
| `parseDate(v)` | `'YYYY-MM-DD'` parsed as LOCAL date; also ISO, Date, ms, Firestore Timestamp; invalid → `null` |
| `formatDate(iso, {weekday, short, time, noYear})` | `"7 Oktober 2026"`, short `"7 Okt 2026"`, weekday `"Kamis, 8 Oktober 2026"` |
| `formatDateRange(a, b, {short})` | `"21–23 Oktober 2026"`, `"30 Oktober – 2 November 2026"`, cross-year full dates |
| `relativeTime(iso)` | `"baru saja"`, `"5 menit lalu"`, `"kemarin"`, `"3 hari lalu"`, `"dalam 2 minggu"` … |
| `daysUntil(iso)` | int (negative = past) or `null` |
| `todayIso()` | local `'YYYY-MM-DD'` |
| `qs(name)` | query param or `null` |
| `debounce(fn, ms=200)`, `sleep(ms)` | |
| `slugify(s)`, `initials(name)` (max 2, first letters of first two words), `pad(n, len=2)` | |
| `greeting(date?)` | `Selamat pagi/siang/sore/malam` (05–11/11–15/15–18/18–05) |
| `normalizePhoneID(s)` | Indonesian **mobile** → `'+628…'` or `null` (accepts `08…`, `8…`, `628…`, `+628…`, spaces/dashes/dots) |
| `formatPhoneID(e164)` / `maskPhone(e164)` | `"+62 812-3456-7890"` / `"+62 812-••••-7890"` |
| `isEmail(s)`, `uid(prefix)` | |
| `profileCompleteness(member)` / `PROFILE_FIELDS` | `{pct, total:15, done, items[{key, group, label, short, focus, ok, href}], missing[], comp, cert}` — the ONE completeness definition shared by dashboard.js and anggota.js (13 editable profile fields + ≥1 kompetensi + ≥1 sertifikat; email/HP not scored). Field `href` = `anggota.html?isi=<key>#profil`; anggota.js focuses `#f-<focus>` for `?isi=` and then drops the query. |
| `storage.get(key, fallback)`, `.set(key, val)`, `.remove(key)` | JSON + try/catch |
| `ktaFromUid(uid, year)` | `"PPAPI-YYYY-NNNNNN"` (deterministic FNV-1a) |
| `certStatus(expiresIso)` | `{key:'aktif'|'segera'|'kedaluwarsa'|'tanpa-batas', label, days, tone:'ok'|'warn'|'err'}` (segera ≤ 90 days; `''` = tanpa batas, tone ok). Use `badge--${tone}`. |
| `contohBadge(item)` | `'<span class="badge badge--contoh">Contoh</span>'` or `''` |
| `formatNumber(n, decimals=0)` | id-ID (`1.250`, `4,8`) |
| `fileName()` | current file, e.g. `"anggota.html"` |
| `safeNext(value, fallback='dashboard.html')` | only same-site relative `*.html` (+?query/#hash); rejects `http:`, `//`, `javascript:`, `..`, `masuk.html` |
| `siteUrl(path)` | absolute URL — `config.siteUrl` as base when it is a valid http(s) URL (scheme-less `user.github.io/repo` is accepted; the repo subfolder is kept, a leading `/` in `path` is ignored), otherwise the address the page is opened at (`document.baseURI`, so `<base>` on 404.html is honoured). Use for the KTA QR (`siteUrl('verifikasi.html?kta=' + encodeURIComponent(kta))`) and share links |
| `siteBase()` | the normalised `config.siteUrl` (`'https://user.github.io/repo/'`) or `''` when empty/invalid |
| `passwordStrength(pw)` | `{score 0–4, label '', 'Lemah','Sedang','Kuat','Sangat kuat', valid}` (valid = ≥ 8 chars with a letter and a digit — same rule auth enforces) |
| `copyText(text)` | Promise<boolean> (Clipboard API with fallback) |
| `img(src, {alt, cls, sizes, eager, small})` | `<img>` HTML with width/height, srcset for `-sm` variants, lazy/async (`eager` → `fetchpriority="high"`; `small` → use the -sm file only) |
| `images` | map of known images → `{w, h, sm, smw, smh}` |
| `MONTHS`, `MONTHS_SHORT` | Indonesian month names (`Jan … Agu … Des`) |

### `PPAPI.ui`
```js
ui.toast(message, { type: 'info'|'success'|'error'|'warn', timeout: 4200 /* 0 = sticky */ }) // → {el, close}; message is TEXT (escaped)
                                   // the role=status aria-live region exists from boot (first toast is announced)
ui.flash(message, opts)            // toast shown on the NEXT page load (use before redirects)
ui.modal({ title, eyebrow?, body /* html string (NOT escaped) or Node */, size: 'sm'|'md'|'lg',
           actions: [{ label, variant: 'primary'|'ghost'|'danger'|'link', autofocus?, onClick(close, {el, button}) }],
           onOpen(el), onClose(), cls? })   // → { el /* .modal root */, dialog, body, close }
//   onClick: return false (or Promise resolving false) to keep the modal open; Promise → button shows spinner;
//   thrown/rejected error → error toast, modal stays open. Action without onClick just closes.
//   Esc / backdrop / × close it. Focus: [data-autofocus] → first input in body → first action → dialog.
ui.confirm(message, { title: 'Konfirmasi', okLabel: 'Ya, lanjutkan', cancelLabel: 'Batal', danger: false }) // → Promise<boolean>
ui.setLoading(button, isLoading, loadingLabel = 'Memproses…') // disables + spinner; restores the ORIGINAL innerHTML (listeners on inner nodes are lost)
ui.reveal(root = document)        // call after EVERY dynamic render (see §4); also processes root itself
                                  // an EMPTY .split-lines is left pending and split/animated once it has content
ui.tabs(rootEl)                   // → { select(key|tabId|panelId), current, el }  (auto for [data-tabs])
ui.accordion(rootEl)              // → { open(i), close(i), toggle(i), el }      (auto for [data-accordion]; "single" mode: data-accordion="single")
                                  // re-scans on every call: items rendered later into the same accordion are wired then
ui.otp(rootEl, { length: 6, onComplete(code), onChange(value) }) // → { value(), clear(), focus(), setInvalid(bool), disable(bool), inputs }
ui.emptyState({ icon: 'search', title, text, actionHtml }) // → html
ui.skeleton(lines = 3)            // → html (role=status, "Memuat…")
ui.scaffoldSVG({ cols: 6, rows: 4, braces: true, nodes: true, cls: '' }) // → html of absolutely-positioned self-drawing SVG
```
Tabs fire `tabs:change` (bubbles, `detail: {key, tab, panel}`) on the `.tabs` root. With `data-tab-hash` the key is
synced to `location.hash` via `history.replaceState` (and `hashchange` selects). The key is the tab's `data-tab`
attribute (fallback: panel id). **Use `data-tab="profil"` + panel `id="panel-profil"`** so the browser does not jump-scroll
to an element whose id equals the hash.

Delegated behaviours (work on dynamic content, no init needed):
- `.password-toggle__btn` toggles the sibling input type, `aria-pressed`, label and eye icon.
- `[data-segmented] > button.segmented__option` → sets `aria-pressed` and dispatches `segmented:change`
  (`detail: {value: data-value || text, option}`) on the `[data-segmented]` element.
- `.search-box__clear` clears the input and dispatches `input`.
- `[data-scroll-top]` scrolls to top; `[data-copy="text"]` copies + toast (`data-copy-message` optional).
- `[data-signout]` signs out (used by the account menu).

### `PPAPI.auth`
```js
auth.mode            // 'demo' | 'firebase'   (also auth.isDemo, auth.demoOtp === '123456' in demo)
auth.ready()         // Promise<User|null>
auth.current()       // User|null (a copy)  { uid, name, email, phone, photoURL, provider: 'password'|'phone'|'google', createdAt }
auth.onChange(cb)    // → unsubscribe; cb(User|null) after sign-in/out/profile changes
auth.signUpEmail({ name, email, password, remember? })   // name ≥ 3 chars; password ≥ 8 with letter + digit
auth.signInEmail({ email, password, remember = true })    // remember:false → session-only
auth.resetPassword(email)                                 // always resolves true for valid email (no account enumeration)
auth.signInGoogle()          // call DIRECTLY inside the click handler, with no await before it (popup activation)
auth.startPhone({ phone, buttonEl })   // any ID format → { phone: '+62…', masked }. Callable repeatedly (retry / "Kirim ulang"):
                                       // each attempt renders the invisible reCAPTCHA into a FRESH slot inside #ppapi-recaptcha and
                                       // disposes the previous one; buttonEl is accepted for compatibility (no longer the widget host)
auth.confirmPhone({ code, name?, remember? })  // name used for new users
auth.signOut()
auth.updateName(name)       // also renames the member record (store) — use this to rename, not saveMember({name})
auth.errorMessage(code)      // Indonesian message for a code
```
All methods return Promises (signInGoogle too). Errors are `Error` with Indonesian `.message` and `.code`:
`auth/email-already-in-use, invalid-email, missing-email, weak-password, missing-password, invalid-credential
(also wrong-password/user-not-found), user-disabled, too-many-requests, network-request-failed, popup-closed-by-user,
cancelled-popup-request, popup-blocked, invalid-phone-number, missing-phone-number, invalid-verification-code,
missing-verification-code, missing-verification-id, code-expired, quota-exceeded, captcha-check-failed,
operation-not-allowed, unauthorized-domain, requires-recent-login, account-exists-with-different-credential,
billing-not-enabled, operation-not-supported-in-this-environment, invalid-api-key, missing-name, no-current-user,
sdk-load-failed` + generic fallback. **Show `err.message` in an `.alert--err` (aria-live) region** — it is already user-facing.
After every successful sign-in/up, auth calls `PPAPI.store.ensureMember(user)` (failures only console.warn).

Demo specifics: OTP is always `123456` (a toast says so); `signInGoogle()` opens a modal "Simulasi Masuk dengan Google"
(name + Gmail) and rejects with `auth/popup-closed-by-user` when dismissed; passwords are stored as SHA-256 hex.
The account dropdown "Keluar" on a `required` page redirects to `index.html` (flash toast).

### `PPAPI.store`
```js
store.getMember(uid)            // Promise<Member|null>  (normalised: every key present, profile has all 12 keys)
store.ensureMember(user)        // creates default if missing (kta = ktaFromUid, 'Praktisi', 'Menunggu Verifikasi', joinedAt today,
                                // createdAt/updatedAt ISO); fills empty name/email/phone/photoURL from the account
store.saveMember(uid, patch)    // → merged Member. `profile` is MERGED (partial patch ok); arrays REPLACE; updatedAt stamped.
                                // Protected keys are IGNORED: uid, kta, status, memberType, joinedAt, createdAt (secretariat-managed;
                                // Firestore rules enforce the same). Competency/certificate items are sanitised to the SPEC shape
                                // (missing ids generated; level ∉ Dasar/Menengah/Mahir/Ahli → 'Dasar'; since → number|null).
                                // WHITELIST (same in Demo and Firebase): only name(≤120) email(≤200) phone(≤24) photoURL(≤1000)
                                // profile competencies certificates are written; profile keeps only the 12 SPEC keys
                                // (experienceYears → integer|null). Anything else is dropped with ONE console.warn —
                                // check.mjs reports warnings, so a warning means your form sends a field outside the contract.
store.submitFeedback(data)      // → { id } ; demo id looks like "UB-20261008-7K3Q" (show it as the reference number)
store.mode                      // 'local' | 'firebase'
store.MEMBER_TYPES, STATUSES, LEVELS, FEEDBACK_KATEGORI, PROTECTED_FIELDS
store.defaultMember(user)       // shape helper
```
`submitFeedback` keeps only `kategori, nama, email, phone, subjek, pesan, rating, anonim, uid, halaman` (unknown keys dropped);
`kategori` ∈ Kritik/Saran/Pertanyaan/Pengaduan/Apresiasi; `pesan` 10–4000 chars; `rating` int 1–5 or null; `anonim:true`
blanks nama/email/phone and uid; `uid` is always taken from the signed-in user (not from the argument); `halaman` defaults
to the current file. Validation errors: `store/invalid-category`, `store/message-too-short`, `store/message-too-long`.
Firestore errors map to Indonesian messages (`store/permission-denied`, …).

---

## 3. CSS reference (main.css)

### Tokens
Primitive: `--c-black --c-ink --c-graphite --c-steel --c-iron --c-slate --c-gray --c-silver --c-mist --c-bone --c-paper --c-white`,
status `--c-ok --c-warn --c-err` (+ text inks `--c-ok-ink/-soft` etc.), `--metal`, `--metal-line` (horizontal sheen),
fonts `--f-display --f-cond --f-body`, `--radius-sm/--radius/--radius-lg`, `--shadow-1/-2`, `--ease --ease-in-out --dur`,
`--header-h` (76 / 64 mobile), `--ribbon-h` (40 when demo ribbon visible), **`--header-offset`** (= header + ribbon — use it
for the top padding of any custom hero), `--container` 1240, `--container-narrow` 820, `--gutter`, `--section-y`, `--noise` (grain image).

Semantic (auto-switch in dark contexts — ALWAYS prefer these in page CSS):
`--bg --surface --surface-2 --text --text-strong --muted --faint --line --line-strong --em (italic emphasis colour)
--btn-bg --btn-fg --focus --focus-ring --field-bg --field-border --hover-bg --scaffold-stroke --shadow-hover
--ok-fg --warn-fg --err-fg --ok-bg --warn-bg --err-bg`.
Dark contexts: `.theme-dark`, `.section--dark`, `.section--graphite`, `.page-hero`, `.card--dark`, header, footer, mobile menu,
toast, ribbon. `.theme-light` re-lights an island inside a dark context.

### Layout
```html
<section class="section [section--tight|--dark|--graphite|--bone|--paper|--white|--rule|--flush-top]">
  <div class="container [container--narrow|--wide]">
    <header class="section-head [section-head--center]">
      <div class="section-head__text">
        <p class="eyebrow">Tentang PPAPI</p>
        <h2 class="h2">Membangun <em>standar</em></h2>
        <p class="lead muted">…</p>
      </div>
      <a class="btn btn--link" href="profil.html"><span>Selengkapnya</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>
    </header>
    <div class="grid grid--3"> … </div>
  </div>
</section>
```
- `.grid` + `--2` (2 cols ≥768) · `--3` (2 ≥768, 3 ≥1024) · `--4` (2 ≥360, 4 ≥1024) · `--rule` (hairline cells). Gap via `--grid-gap`.
- `.split` (2 cols ≥1024) + `--top`, `--wide-left` (7/5), `--wide-right` (5/7). `.stack` (+`--sm|--lg`, gap `--stack-gap`). `.cluster` (+`--between|--end|--lg`).
- `.sr-only` / `.visually-hidden`, `.skip-link`.

### Type
`.display` (hero headline), `.h1 .h2 .h3 .h4`, `.lead`, `.muted`, `.serif`, `.cond`, `.upper`, `.small`, `.link`,
`.eyebrow` (+`--plain`, `--center`), `.index-num` (`<span class="index-num">01 <span>/ 06</span></span>`, `--lg`),
`.prose` (long-form: h2/h3/ul squares/ol/blockquote/figure/table). `<em>` inside headings → italic serif in `--em` colour.

### Buttons
```html
<a class="btn btn--primary" href="masuk.html#daftar"><span>Bergabung</span><span data-icon="arrow-right" data-icon-class="btn__icon"></span></a>
<a class="btn btn--ghost btn--sm" href="profil.html"><span>Kenali PPAPI</span></a>
<a class="btn btn--link" href="berita.html"><span>Semua berita</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>
<a class="btn btn--primary" href="https://ppapiid.vercel.app/" target="_blank" rel="noopener"><span>Buka Aplikasi</span><span data-icon="arrow-up-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>
<button class="icon-btn [icon-btn--ghost|--round|--sm]" aria-label="Cetak"><span data-icon="printer"></span></button>
<button class="btn-google" type="button"><span data-icon="google"></span><span>Lanjutkan dengan Google</span></button>
```
Variants `--primary` (auto light-on-dark / dark-on-light, metal sheen on hover), `--ghost` (fill wipes in), `--link`,
`--danger`, `--light`; sizes `--sm` (44px) / default 52 / `--lg` 60; `--block`. The last `.btn__icon` slides 4px on hover
(arrow-up-right/external slide diagonally). In JS use `PPAPI.icon('arrow-right', {cls:'btn__icon', size:18})`.

### Cards & content
```html
<article class="card card--hover card--link">               <!-- + card--dark | --nodes | --metal | --flat | --tight | --lg -->
  <div class="card__media">${util.img(src,{small:true, cls:'img-mono'})}</div>
  <div class="card__meta"><span class="tag">Edukasi</span><time datetime="2026-09-12">12 Sep 2026</time>${contohBadge}</div>
  <h3 class="card__title"><a href="…">Judul</a></h3>          <!-- card--link makes the whole card clickable -->
  <div class="card__body"><p>…</p></div>
  <div class="card__footer [card__footer--rule]">…</div>
</article>

<article class="feature">
  <div class="feature__head"><span class="index-num">01 <span>/ 06</span></span><span class="feature__icon" data-icon="award" data-icon-size="22"></span></div>
  <h3 class="feature__title">…</h3><p class="feature__text">…</p>
</article>

<div class="stat [stat--card]"><span class="stat__num" data-count="28" data-count-suffix="+">28+</span><span class="stat__label">…</span></div>

<article class="news-card [news-card--row]">
  <div class="news-card__media">…img.img-mono…</div>
  <div class="news-card__meta"><span class="tag">Kegiatan</span><time datetime="…">…</time>${contohBadge}</div>
  <h3 class="news-card__title"><a href="berita.html?id=…">…</a></h3>   <!-- link stretches over the card -->
  <p class="news-card__excerpt">…</p>                                   <!-- clamped to 3 lines -->
</article>

<article class="event-row [is-past]">
  <div class="date-block [date-block--range|--dark]"><span class="date-block__day">21–23</span><span class="date-block__month">Okt</span><span class="date-block__year">2026</span></div>
  <div class="event-row__body">
    <div class="event-row__meta"><span class="tag">Pelatihan</span><span class="badge badge--outline">Luring</span>${contohBadge}</div>
    <h3 class="event-row__title"><a href="…">…</a></h3>
    <p class="event-row__info"><span>${icon('clock',{size:16})}08.00 – 16.00 WIB</span><span>${icon('map-pin',{size:16})}Jakarta</span></p>
  </div>
  <div class="event-row__aside"><button class="btn btn--ghost btn--sm">…</button></div>
</article>

<ul class="list-rule [list-rule--compact|--nodes|--plain]"><li>…</li></ul>
<dl class="kv [kv--stacked]"><div class="kv__row"><dt>Nomor KTA</dt><dd>…</dd></div></dl>
<ol class="timeline [timeline--center]"><li class="timeline__item"><p class="timeline__year">2026</p><h3 class="timeline__title">…</h3><p class="timeline__text">…</p></li></ol>
<div class="person [person--center]"><span class="person__avatar">NP</span><p class="person__name">…</p><p class="person__role">…</p></div>
<span class="avatar [avatar--md|--lg]">RH</span>            <!-- initials circle with metal ring (or <img>) -->
```

### Feedback
`.badge` + `--ok --warn --err` (dot) `--muted --outline --solid --metal --contoh`; `.tag` (+`--boxed`);
`.alert` + `--info --ok --warn --err` (`<div class="alert alert--err" role="alert"><span data-icon="alert-triangle"></span><div><p class="alert__title">…</p><p>…</p></div></div>`;
an empty `.alert` is `display:none`, handy for an aria-live error slot);
`.spinner` (`--lg`), `.skeleton` + `.skeleton__line` / `.skeleton__block`, `.empty-state`, `.progress` (`style="--value:72"`, `--metal`, `--thin`; add role=progressbar + aria-valuenow yourself).

### Forms
```html
<form class="form" novalidate>
  <div class="form__row form__row--2"> … two .field … </div>
  <div class="field [is-invalid]">
    <label class="field__label" for="f-email">Email <span class="opt">(opsional)</span></label>
    <div class="input-icon"><span data-icon="mail" data-icon-size="18"></span><input class="field__control" id="f-email" type="email" aria-describedby="f-email-err"></div>
    <p class="field__hint">…</p>
    <p class="field__error" id="f-email-err">Format alamat email tidak valid.</p>   <!-- visible only when .field.is-invalid -->
  </div>
  <div class="input-group"><span class="input-group__prefix">+62</span><input class="field__control" type="tel" inputmode="tel"></div>
  <div class="password-toggle"><input class="field__control" type="password"><button type="button" class="password-toggle__btn" aria-label="Tampilkan kata sandi" aria-pressed="false"><span data-icon="eye"></span></button></div>
  <div class="strength" data-level="0"><div class="strength__bars" aria-hidden="true"><span></span><span></span><span></span><span></span></div><span class="strength__label" aria-live="polite"></span></div>
  <div class="otp" aria-label="Kode OTP"></div>        <!-- PPAPI.ui.otp(el, {onComplete}) creates 6 .otp__input boxes; .otp.is-invalid -->
  <label class="check"><input type="checkbox"><span class="check__box"></span><span class="check__label">Ingat saya</span></label>   <!-- radio: same markup with type=radio -->
  <fieldset class="rating"><legend class="field__label">Penilaian</legend><div class="rating__stars">
    <!-- DESCENDING order 5→1: --><input type="radio" id="r5" name="rating" value="5"><label for="r5"><span data-icon="star" data-icon-size="26"></span><span class="sr-only">5 bintang</span></label> …
  </div></fieldset>
  <!-- below 600px a .segmented wraps into rows (5 feedback categories fit a phone); add .segmented--scroll to keep one scrolling row -->
  <div class="segmented [segmented--block]" data-segmented role="group" aria-label="Metode"><button type="button" class="segmented__option" aria-pressed="true" data-value="email">Email</button>…</div>
  <!-- or radio variant: <div class="segmented" role="radiogroup"><label><input type="radio" name="k" value="Kritik" checked><span class="segmented__option">Kritik</span></label>…</div> -->
  <div class="search-box"><span data-icon="search" data-icon-size="18"></span><input class="field__control" type="search" aria-label="Cari"><button type="button" class="search-box__clear" aria-label="Hapus pencarian"><span data-icon="close" data-icon-size="16"></span></button></div>
  <div class="filter-chips" role="group" aria-label="Filter"><button type="button" class="chip" aria-pressed="true">Semua <span class="chip__count">28</span></button>…</div>
  <div class="form__actions"><button class="btn btn--primary" type="submit"><span>Kirim</span></button></div>
</form>
```
Also `.field__counter` (+`.is-over`) for "120 / 2.000" (place inside `.field__label` → right-aligned; `.field__aside` does the
same for any other right-hand item), `.form__section-title`. Everything else inside `.field__label` sits next to the label text
("Email (opsional)"). Required marker: `<label class="field__label" for="x">Nama lengkap <span class="field__req" aria-hidden="true">*</span></label>`
(+ `required`/`aria-required` on the control and a "Kolom bertanda * wajib diisi" note). `.field` never stretches its label away from
its control when a neighbouring field in `.form__row--2` is taller.
`.check`: the transparent input covers the whole 20px box column, so clicks/taps on the box (also in a 44px centred row) hit the input
and `page.check('#id')` works in tests. `.segmented` radio variant and `.rating`: each transparent input lies exactly over its option /
star (anchor positioning) with `pointer-events:none` — in tests click the VISIBLE option/label (`input[value=X] + .segmented__option`,
`label[for=r4]`), or use `{force:true}` on the input. Rating: ←/→ move in the visual direction (→ = more stars), ↑/↓ stay native.
`.otp` boxes share the container width (max 56px each), so six fit any card ≥ ~260px.
Set `aria-invalid="true"` on invalid controls yourself; focus the first invalid control.

### Navigation
```html
<div class="tabs" data-tabs data-tab-hash>
  <div class="tabs__list" role="tablist" aria-label="…">
    <button class="tabs__tab" role="tab" id="tab-profil" data-tab="profil" aria-controls="panel-profil" aria-selected="true"><span data-icon="user" data-icon-size="16"></span>Profil Diri</button> …
  </div>
  <div class="tabs__panel" role="tabpanel" id="panel-profil" aria-labelledby="tab-profil">…</div>
  <div class="tabs__panel" … hidden>…</div>
</div>
<div class="accordion" data-accordion="single">
  <div class="accordion__item"><h3><button class="accordion__trigger" aria-expanded="false">Pertanyaan?</button></h3><div class="accordion__panel" hidden><p>…</p></div></div>
</div>
<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="index.html">Beranda</a></li><li aria-current="page">Profil</li></ol></nav>
<nav class="pagination" aria-label="Halaman"><a class="pagination__item" aria-current="page">1</a>…</nav>
```
Accordion icon (+/−) is injected automatically. Tabs list scrolls horizontally on mobile.

### Table (stacked cards below 768px)
```html
<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Jenis</th>…</tr></thead>
<tbody><tr><td data-label="Jenis">…</td><td data-label="Judul">… <span class="table__muted">relevansi…</span></td>…</tr></tbody></table></div>
```
Cells without `data-label` render full-width in the stacked layout. In the stacked layout the label is a 96px column and
EVERYTHING else in the cell (text, `.table__muted`, badges, links, buttons) flows in the value column at its natural width.

### Decor & motion
- `.divider` (hairline + square coupler node; `--left --right --metal --flush`), `.rule`, `.metal-rule`.
- `.scaffold-draw` via `PPAPI.ui.scaffoldSVG()` or a slot `<div data-scaffold data-cols="7" data-rows="4" [data-braces="false"] [data-nodes="false"]></div>`
  (slot is `position:absolute; inset:0` — the parent must be positioned; heroes already are). Stroke colour = `--scaffold-stroke`
  (override with `color:` on the svg). Draws itself (2.4s) when visible; static under reduced motion.
- `.img-mono` (grayscale → colour hint + scale on hover of itself / parent `a` / `.card--hover` / `.news-card` / `.img-frame`),
  `.img-frame` (+`--portrait 4/5`, `--landscape 3/2`, `--square`), `.offset-frame` (+`--left`) hairline frame behind an image.
- `.marquee > .marquee__track > .marquee__item (+--serif) + .marquee__sep` — core gives the container `role="marquee"` (unless you set
  a role) so an `aria-label` on it is valid, and duplicates items as `aria-hidden` + `inert` clones (ids stripped);
  speed `--marquee-duration` (48s), `.marquee--reverse`; pauses on hover; static under reduced motion.
- `.grain` (film grain overlay via `::after`; children lifted above with zero specificity — `[data-scaffold]`, `.scaffold-draw`,
  `.hero-media` children keep `position:absolute`). `.metal-text` (metal gradient text).
- `<main>` has `overflow-x: clip`: off-canvas reveal pre-states (`data-reveal="left|right"`) can't cause sideways scroll; sticky still works.
- Component titles (`.card__title .feature__title .news-card__title .event-row__title .timeline__title .person__name .empty-state__title
  .modal__title`) look the same on any element — choose h2/h3/h4 for the outline only.
- `.date-block__day` never wraps; a day containing a dash ("21–23") gets `.date-block--range` automatically (smaller numeral on phones).
- `.breadcrumb` current item (plain text, `<span>`-wrapped, or `<a aria-current>`) ends in an ellipsis within the row.
- `.table`: `th[colspan]`, `th[scope=colgroup|rowgroup]` and any `th` in `tbody` wrap; a row holding one spanning `th` is a group
  heading (no hover; in the stacked mobile layout a heading above the cards, not a card).
- Reveal: `data-reveal` (`up` default | `fade` | `left` | `right` | `scale`), `data-reveal-delay="120"`, `data-reveal-stagger` on a
  container (children stagger 80ms). Counters: `data-count="1250" [data-count-suffix="+"] [data-count-prefix="Rp "]` (decimals ok: `"4.8"` → `4,8`).
  Split headline: `<h1 class="display split-lines">Membangun <em>standar</em>,<br>menjaga <em>keselamatan</em>.</h1>` — lines are
  split on `<br>` only (each becomes `span.line > span`, 90ms stagger).
- Utilities: `mt-0…mt-6`, `mb-0…mb-6` (0, 8, 16, 24, 32, 48, 64 px), `text-center`, `text-right`, `w-100`, `nowrap`, `hide-mobile`
  (<768), `show-mobile` (≥768 hidden), `text-ok/-warn/-err`, `print-only`, `no-print`.

### Hero patterns
Inner-page hero (`.page-hero`, min-height ~58vh, content bottom-aligned, grain + gradient built in):
```html
<section class="page-hero [page-hero--compact|--center|--full]">
  <div class="hero-media" aria-hidden="true">${util.img('assets/img/facade-bw.webp',{eager:true, sizes:'100vw'})}</div>  <!-- Ken Burns -->
  <div data-scaffold data-cols="7" data-rows="4"></div>
  <div class="container page-hero__inner">
    <nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="index.html">Beranda</a></li><li aria-current="page">Profil</li></ol></nav>
    <p class="eyebrow">Profil Asosiasi</p>
    <h1 class="display split-lines">Perkumpulan Praktisi<br>dan Ahli <em>Perancah</em></h1>
    <p class="lead">…</p>
    <div class="page-hero__actions">…buttons…</div>
    <div class="page-hero__meta"><span>…</span></div>
  </div>
</section>
```
Alternative background without `<img>`: **`data-hero-img="assets/img/facade-bw.webp"`** on the `.page-hero` (core converts it to an
absolute `--hero-img`; Ken Burns applies too) and `--hero-pos` for object/background position. **Do NOT write
`style="--hero-img:url('assets/img/…')"`** — Chromium resolves a relative `url()` inside a custom property against `main.css`
(→ 404 `assets/css/assets/img/…`, verified). An absolute URL in `--hero-img` is fine. `.page-hero--compact` = graphite band
(min-height header-offset + 220px) for dashboard/anggota headers. For a fully custom hero (e.g. homepage 100svh) reuse `.hero-media`
+ `.hero-media--shade` (adds the dark gradient + grain), add `position:relative; isolation:isolate; overflow:hidden; background:var(--c-black)`
on your section, and pad the top with `calc(var(--header-offset) + …)`. Add class `theme-dark` (or use `.section--dark`) for dark tokens.

### Images (real intrinsic sizes — SPEC lists slightly different numbers)
| file | size | `-sm.webp` |
| --- | --- | --- |
| `facade-bw.webp` | 1153×1920 | 432×720 |
| `stage-silhouette.webp` | 1281×1920 | 480×720 |
| `stair-tower.webp` | 1920×1280 | 720×480 |
| `ringlock-pattern.webp` | 1000×1500 | 480×720 |
| `tower-heritage.webp` | 1125×1500 | 540×720 |
| `og-image.jpg` | 1200×630 | — |
| `logo-color.png` / `logo-light.png` / `logo-mono-dark.png` | 1200×418 | — |
Plus `favicon.svg` and `apple-touch-icon.png` (180×180). `PPAPI.util.img()` fills width/height/srcset for you.

---

## 4. Dynamic rendering checklist
1. Build HTML strings with `PPAPI.util.h()` around every data/user value (attributes too: `href="${h(url)}"`).
2. Use `PPAPI.util.contohBadge(item)` next to titles/dates of sample items.
3. Insert, then call `PPAPI.ui.reveal(container)` — it hydrates `[data-icon]`, `[data-scaffold]`, `.marquee`, `[data-tabs]`,
   `[data-accordion]`, prepares `.split-lines`, counters and `data-reveal*`. Safe to call repeatedly.
4. Do not nest `data-reveal` inside a `data-reveal-stagger` container's direct children.
5. Hover lifts use the CSS `translate` property and image zoom uses `scale` (so they compose with reveal `transform`) — don't
   override `translate`/`scale` on cards in page CSS unless intended.
6. Never put `.grain` on `.page-hero` (both use `::after`).
7. The checker runs with `prefers-reduced-motion: reduce` → everything visible immediately, counters final. Run `--motion` once.

---

## 5. Config & data (what is actually there)
`PPAPI_CONFIG`: `shortName`, `fullName`, `tagline` (`'Membangun *standar*, menjaga *keselamatan*.'` → render with `util.emphasis`,
or `util.plain` for meta), `description`, `siteUrl` (''), `simulatorUrl`, `apps[{key:'simulator'|'analisis', title, desc, url, fitur[]}]`
(both URLs are `https://ppapiid.vercel.app/` — the app has no per-feature deep links), `appNote` (app accounts are managed by
Admin PPAPI; results indicative), `firebaseSdkVersion '12.4.0'`, `firebase{…}` (empty → demo), `contact{address, city, mapsQuery,
phone, whatsapp, email, hours[]}` — **all empty (nothing verified)** → show fallbacks ("Alamat sekretariat akan segera diperbarui."),
`social{instagram, linkedin, youtube, facebook}` — all empty, `nav[]` (7 items), `footerLinks{ 'Group title': [{label, href}] }`.

`PPAPI_DATA` (**2026-10-15: all sample content removed on the client's instruction** — see Changelog):
- `berita` (9 editorial articles by `penulis:'Redaksi PPAPI'`, 2026-07-29 … 2026-10-14, newest first, **no `contoh` key**, one
  `sorot:true`; kategori Edukasi 6 / Regulasi 2 / Organisasi 1; each `isi[]` ends with `'## Daftar Pustaka'` + APA-7 reference
  paragraphs; `*text*` inside `isi` renders as `<em>` and paragraphs after that heading get `p.berita-ref` — renderer in
  `pages/berita.js renderIsi()`, styles in `pages/berita.css`). `pengumuman` is `[]`.
- `agenda` is `[]` (no activities yet) → agenda.html hides the next-event panel + hero meta and shows the calm empty state;
  index/berita/dashboard show their empty states. Tests seed managed agendas through `ppapi_content_agenda` instead.
- `regulasi` (28 verified items; 6 `kunci`; `status` Berlaku / Berlaku (diubah) / Dicabut; `tautan` may be `''`; extra `sumber[]`;
  international standards use `jenis:'Standar Internasional'`). No `contoh` flags (factual).
- `organisasi`: `tentang[]` (verified), `fakta[{label,nilai}]`, `visi`, `misi[]`, `nilai[{judul,teks,ikon}]`, `layanan[{ikon,judul,teks}]` (6),
  `sejarah: []` and `pengurus: []` (both sections hidden by profil.js until official data exists), `legalitas: []` (omit the section),
  `maknaLogo[{judul,teks}]`, `stats[{angka,akhiran,label}]` (factual counts of site/app content: 28, 16, 9, 10),
  `faq[{kelompok:'umum'|'keanggotaan', q, a}]`, `keanggotaan{kategori[{nama,ringkas,syarat[],manfaat[],contoh:true}],
  manfaatUmum[{ikon,judul,teks}], langkah[{judul,teks}] (5), biaya:''}`, and **`bagianContoh{visi,misi,nilai,maknaLogo,keanggotaan}`**
  → show a contoh badge for those sections with `util.contohBadge({contoh: org.bagianContoh.visi})`. These five flags and
  `keanggotaan.kategori[].contoh` are the ONLY contoh flags left in the data (provisional wording the client has not replaced);
  `flows/contoh-audit.mjs` enforces that.
- `kompetensi{katalog[{kode,nama,kelompok,deskripsi,sumber[]}] (16; kelompok: Pelaksana, Pengawas, Inspeksi, Perencanaan & Desain, K3),
  level[4], penerbit[5]}`.
- `registry` is `[]` (the public list comes from approvals: `ppapi_registry` in demo / Firestore `registry`). Shape when filled by hand:
  `{kta,nama,kategori,kompetensi[],kota,berlakuHingga,status}`. verifikasi.html no longer carries the sample-data notice block;
  flows seed fixture entries into `ppapi_registry` (regulasi-verifikasi-flow, verifikasi-v2-flow).
- `pustaka` holds only the two real app items (`aplikasi-perencanaan` "(Beta)", `aplikasi-simulator`, `contoh:false`); the ten sample
  drafts were removed — pustaka-flow seeds them as admin-managed `ppapi_content_pustaka` to keep exercising the catalogue UI, and also
  checks the empty catalogue (tiles 9/0/19/0/0/0/0/2, "Belum ada dokumen", no Contoh note).

check.mjs `--auth` seeds user `demo-uji-0001` / member `PPAPI-2026-004821` (Aktif) as an approval leaves it, including its
`ppapi_registry` entry (updated 2026-10-09; one shared fixture, see §9.6).

---

## 6. Deviations from SPEC (intentional)
1. **Desktop nav breakpoint is 1120px** (not 1024): 7 links + account buttons don't fit at 1024. Below 1120 the hamburger + full-screen
   menu is used; the Masuk/Daftar header buttons show from 768px (always available inside the mobile menu).
2. `.grid--4` becomes 2 columns from 360px (stats/KPIs pair up on phones).
3. `.grain` uses an inline SVG-turbulence data URI token (`--noise`) instead of a CSS gradient (still no external file).
4. `contact.hours` is `[]` (the SPEC example hours were not verified); all contact/social values empty.
5. `apps[].url` both point to the app root (no deep links exist); extra `fitur[]` + `appNote`.
6. Extra data fields: `organisasi.bagianContoh`, `organisasi.fakta`, `faq[].kelompok`, `manfaatUmum` as objects; `regulasi[].sumber`,
   `kompetensi.katalog[].sumber`. 28 regulations (all research-verified) instead of a smaller list.
7. Password rule (≥ 8 chars with a letter and a digit) is enforced by `auth.signUpEmail` in both modes; extra error codes listed above.
8. `next=` includes `location.hash` (so `anggota.html#aplikasi` deep links survive login).
9. `saveMember` ignores protected fields; members also get `createdAt`.
10. Sign-out from a `required` page navigates to `index.html` (flash toast) instead of bouncing to masuk.
11. Many additive helpers (listed in §2) — nothing in the SPEC contract was renamed or removed.
12. (audit) `ui.reveal()` has a MutationObserver safety net: nodes inserted after boot are registered automatically, so content
    rendered without a `reveal()` call no longer stays at opacity 0. Still call `ui.reveal(container)` (immediate, idempotent).
13. (audit) `store.saveMember` whitelists the Member shape (see §2) and `auth.updateName` also updates the member record.
14. (audit) Touch screens (`pointer: coarse`): breadcrumb links, footer links and the brand get ≥44px hit areas; disabled buttons
    render at 40% opacity.
15. (audit) `firestore.rules` create: `memberType == 'Praktisi'`, KTA must match `PPAPI-YYYY-NNNNNN`, `joinedAt` `YYYY-MM-DD`.

## 7. Gotchas
- Header & footer use relative URLs (`index.html`, `assets/img/logo-light.png`). **404.html** served at nested paths must set
  `<base href>` (to the site root) before the stylesheet so these resolve.
- `ui.modal` body HTML is NOT escaped (you control it) — escape data inside it.
- Firebase mode: `signInGoogle()` must be called synchronously in the click handler; `startPhone` can be called again with the same
  button for a retry or "Kirim ulang" (the reCAPTCHA lives in its own fresh slot under `#ppapi-recaptcha`, not in the button; swapping
  the button for a clone, as masuk.js does, is harmless); real phone auth cannot be tested on localhost (`flows/firebase-phone.mjs`
  covers the SDK path with stubs).
- `site/robots.txt` allows everything except `dashboard.html`, `anggota.html`, `styleguide.html` (patterns `/*name.html`, valid at the
  domain root or under `/<repo>/`); no sitemap until the final address is known. Canonical/og:url are added by core.js (see §8).
- `hidden` attribute is `display:none !important` globally.
- The demo ribbon shows only on `data-auth="guest|required"` pages in demo mode and adds `html.has-demo-ribbon` (`--ribbon-h:40px`),
  which `--header-offset` already includes.
- `--full` screenshots: lazy images below ~3000px look empty → use `flows/fullshot.mjs`.

## 8. Changelog

- **2026-10-15 — sample content removed, editorial articles added.** Client instruction: "hapus semua konten contoh … buatkan artikel
  baru … APA style … untuk kegiatan hapus seluruh kontennya." `berita.js` → 9 APA-cited articles (no `contoh`), `pengumuman []`;
  `agenda.js []`; `registry.js []`; `pustaka.js` → 2 apps only; `organisasi.js` → `sejarah []`, `pengurus []` (bagianContoh +
  keanggotaan.kategori contoh flags kept on purpose). `pages/berita.js renderIsi()` gained `*em*` + `## Daftar Pustaka` reference
  styling (`.berita-ref`, hanging indent in `pages/berita.css`); `verifikasi.html` sample notice removed (`pages/verifikasi.js`
  keeps a no-op branch). Flows updated: contoh-audit (rewritten), beranda, berita-agenda (agenda tests now run on managed agendas),
  dashboard, pustaka (managed DOCS fixture + empty-catalogue checks), regulasi-verifikasi, verifikasi-v2 (registry fixture),
  profil, contract-v2, journey-v2. README §4 updated.

### 2026-10-08 — shared-foundation fixes after the 13 pages were built
Gaps that page authors had worked around inside their own files are now fixed at the source. All fixes are additive/compatible:
every existing page workaround keeps working (they are simply redundant now) and no page file was edited.

| # | File | Fix |
| --- | --- | --- |
| 1 | main.css | `.grain > *` lift now has zero specificity (`:where(.grain) > :where(*)`), so `[data-scaffold]`, `.scaffold-draw`, `.hero-media` children stay `position:absolute; inset:0` (they sit under the grain, content above). |
| 2 | main.css | Component titles (`.card__title`, `.feature__title`, `.news-card__title`, `.event-row__title`, `.timeline__title`, `.person__name`, `.empty-state__title`, `.modal__title`) set `letter-spacing:-.01em; text-transform:none` — the base `h4` style no longer leaks in when an `h4` carries them. |
| 3 | core.js | Marquee container gets `role="marquee"` unless the page set a role (so `aria-label` on it is valid); clones are `aria-hidden="true"` + `inert` + `data-marquee-clone`, ids stripped. |
| 4 | auth.js | Firebase phone flow: every `startPhone()` disposes the previous verifier (`clear()` + remove its slot) and renders the invisible reCAPTCHA into a fresh slot inside `#ppapi-recaptcha`; also disposed after a successful `confirmPhone()`. Retry/resend with the same `buttonEl` works; overlapping calls are safe. `buttonEl` is kept for API compatibility. Verified by `flows/firebase-phone.mjs` (17/17; the old auth.js fails 8/17 = reproduces the "already rendered" bug). |
| 5 | main.css | `.otp__input` is `flex:1 1 0; min-width:0; max-width:56px` — six boxes share the container width (300px card at 390px fits). |
| 6 | main.css | `.check > input` covers the full 20px box column (`top:0; bottom:0`, `appearance:none`), so it is under the box in any alignment (incl. 44px centred rows) and receives the hit; links in `.check__label` unaffected. `.segmented` radio variant + `.rating`: inputs are anchored exactly over their option/star (CSS anchor positioning, `anchor-scope`; old 1px fallback without support) with `pointer-events:none`, `.segmented` / `.rating__stars` are positioned. |
| 7 | main.css | `.field { align-content:start }` — label and control stay together when a neighbour in `.form__row--2`/a grid is taller. |
| 8 | main.css | `.field__label` lays its pieces out left to right (`justify-content:flex-start`, wraps); only `.field__counter` and new `.field__aside` go right (`margin-left:auto`). New `.field__req` (also `.field__label > .req`) for the "*" marker. Note: `.opt` "(opsional)" now also sits next to the label text instead of the far right. |
| 9 | main.css | `main { overflow-x: clip }` — reveal pre-states `left` / `right` (and any other off-canvas transform) can't cause sideways scroll on phones; `clip` keeps `position:sticky` working. |
| 10 | main.css | `.index-num > span`: opacity .55 → 1, weight 400, colour `color-mix(currentColor 40%, --muted)` (= `--muted` by default): ≥ 4.5:1 on paper, bone, white, black, graphite. |
| 11 | core.js | `ui.accordion()` re-scans on every call and before `open/close/toggle`; an accordion empty at boot (or getting more items later) is wired when items arrive — via `ui.reveal()` or the MutationObserver safety net (which now also refreshes the enclosing `[data-accordion]` of inserted `.accordion__item`s). `.split-lines` is marked split only once it had content; an empty one is not observed/revealed and is split + animated when filled (reveal() or safety net). |
| 12 | main.css | `.skip-link` has no box-shadow until focused. |
| 13 | core.js + main.css | Rating: delegated keydown remaps ←/→ on `.rating__stars` radios to the visual neighbour (→ = more stars) whenever the visual order is reversed (row-reverse; RTL-aware); uses `radio.click()` so `input`/`change` fire like the native key. ↑/↓ unchanged. DOM order 5→1 and the `label:hover ~ label` trick are kept. |
| 14 | main.css + core.js | `.date-block__day { white-space:nowrap }`; ranges get `.date-block--range` automatically (dash detected), range numeral 1.5rem below 768px. |
| 15 | main.css | Breadcrumb current item ellipsis: text-only `li[aria-current]` becomes a block box (separator stays inline), wrapped child (`span`, `a[aria-current]`) ellipsises; item may shrink to the row (`min(48ch,100%)`). Uses `:has()`; without it the old clipping remains. |
| 16 | main.css | `.table`: `th[colspan]`, `th[scope=colgroup/rowgroup]`, `tbody th` wrap; single-`th[colspan]` group rows have no hover and, in the stacked mobile layout, render as a heading (rules use `:where()` so page rules such as regulasi's win). |
| 17 | config.js + core.js | `siteUrl` comment rewritten (Indonesian: isi dengan alamat situs setelah online, mis. `https://<user>.github.io/<repo>/`). `util.siteUrl` validates the value (http/https only, scheme-less accepted, subfolder kept) and otherwise falls back to `document.baseURI`; new `util.siteBase()`. Boot adds `<link rel="canonical">` + `og:url` (from siteUrl, else the current address; only `?id=` kept) and makes a relative `og:image` absolute; skipped on `noindex` pages and never overrides tags a page wrote. |
| — | site/robots.txt | New: `Allow: /`, `Disallow: /*dashboard.html`, `/*anggota.html`, `/*styleguide.html`; no sitemap (domain not known yet). |
| — | devtools | New `flows/foundation-fixes.mjs` (62 checks; 48 fail on the pre-fix foundation) and `flows/firebase-phone.mjs`. |

Page workarounds that are now redundant (safe to delete in a later page pass, not required): index.css own noise layer + h4 override
+ `role="marquee"`; masuk.js button cloning, masuk.css OTP flex + check re-centring; anggota.css `.field{align-content:start}` + wrapped
required markers; profil/keanggotaan `.index-num > span{opacity:.9}` + `main > section{overflow-x:clip}` + dynamic accordion/visi
creation; umpan-balik/kebijakan-privasi/404 `.skip-link:not(:focus){box-shadow:none}` + `.form__row > .field{align-content:start}`;
agenda/berita h4 title reset, date-block nowrap, berita breadcrumb span; regulasi group-row `white-space:normal`.

Also: styleguide.html form demo now shows `.field__req` ("Nama lengkap *") and an `.opt` label.

Verification after the change (2026-10-08): `check.mjs all` 0 issues (28 runs, desktop + mobile), `--motion` 0, `dashboard anggota --auth` 0;
contract 248/248, auth-demo 53/53, foundation-ui 30/30, foundation-fixes 62/62, firebase-smoke 7/7, firebase-phone 17/17; page flows
beranda 71/71, masuk 107/107, dashboard 141/141, anggota 81/81, profil 75/75, umpan-balik 132/132, berita-agenda 124/124,
regulasi-verifikasi 138/138 (identical to the pre-change baseline).

### 2026-10-09 — release QA

- core.js: new `util.profileCompleteness(member)` + `util.PROFILE_FIELDS` (see §2); dashboard.js and anggota.js both use it
  (the duplicated PROFILE_CHECK / CHECK lists are gone). anggota.js focuses `#f-<field>` for `anggota.html?isi=<key>#profil`.
- main.css + every pages/*.css: `font-variant-numeric: lining-nums` appended after each `font:` shorthand that uses
  `var(--f-display)` (the shorthand resets the numeric variant, so the global lining rule was lost there — e.g. agenda month
  years, regulasi/anggota titles). Rule of thumb: if you set `font:` on serif text, re-add `lining-nums`.
- main.css: `.event-row__info > span` aligns its icon to the first text line (`align-items:flex-start` + `1lh` offset).
- Landmarks: no `<aside>` nested inside other landmarks (umpan-balik sekretariat → `<section>`, privacy TOC → `<div>`).
- See devtools/RELEASE_NOTES.md for the full release summary.

### 2026-10-09 — release QA v2

- Deferred items of the v2 fix round closed (identity lock after approval, registry snapshot, `kategoriAllowed` rule,
  e-mail verification UI, CSP on every page, logo masters) and the v1/v2 test suite brought to the v2 expectations —
  details in **§9.15**; release summary, client to-do list and test matrix in `devtools/RELEASE_NOTES_V2.md`.

### 2026-10-10 — release QA v2, final pass (client rules of 9–10 October)

- Footer credit "Dikembangkan oleh mrezahuzain@2026" in the bottom row of every page (core.js `renderFooter`),
  "(Beta)" in the planning app title (`config.apps`, catalogue item), placeholder fixes, deploy gate — **§9.16**.

---

## 9. v2 — membership lifecycle, admin, content, knowledge products (2026-10-09)

Contract: `SPEC-v2.md` §1–§3. Everything below is implemented in the shared files and covered by
`flows/contract-v2.mjs` (175 checks, demo mode) and `flows/firebase-v2-stub.mjs` (32 checks, Firebase code
path against an in-memory compat-SDK stub + a JavaScript mirror of `firestore.rules`). The v1 API is unchanged
except for the deliberate changes listed in §9.12.

Shared files touched: `assets/js/{core,auth,store,config}.js`, `assets/css/main.css`, `assets/data/pustaka.js`
(new), `assets/data/organisasi.js`, `firestore.rules`, `README.md`, `styleguide.html` (+ `pages/styleguide.js`).
New devtools: `flows/contract-v2.mjs`, `flows/firebase-v2-stub.mjs`, `flows/styleguide-v2-shots.mjs`
(screenshots `shots/sgv2-*.png`).

### 9.1 Lifecycle & gating semantics

Stored `member.status`: `Draf` · `Menunggu Verifikasi` · `Perlu Perbaikan` · `Aktif` · `Ditolak` · `Nonaktif`.
The effective status adds `Kedaluwarsa` (= `Aktif` with `validUntil` before today; an empty `validUntil` means still
active). A record with `Menunggu Verifikasi` **without** `application.submittedAt` (a v1 account) counts as `Draf`.
That rule applies when the record is read, and `ensureMember` also writes `Draf` back on the next sign-in.
An unknown status becomes `Draf`.

`body[data-auth]`:

| value | signed out | signed in, not allowed | allowed |
| --- | --- | --- | --- |
| `public` | stays | — | everyone |
| `guest` | stays | → `next` / dashboard (v1) | signed out |
| `required` | → `masuk.html?next=…` | — | any signed-in user (any status) |
| **`active`** | → `masuk.html?next=…` | → `dashboard.html` + flash toast **"Fitur ini khusus anggota berstatus Aktif."** | effective `Aktif` member **or admin** |
| **`admin`** | → `masuk.html?next=…` | → `dashboard.html` + flash toast **"Halaman ini khusus admin PPAPI."** | admin |

Boot order: header/footer → `await auth.ready()` → signed-out redirects → **`await PPAPI.session.ready()`**
→ active/admin redirects → `body.auth-ready` → account menu → `PPAPI.onReady` callbacks. Inside `onReady`,
`PPAPI.session.current()` is already resolved. On `required|active|admin` pages, `main` and the footer stay
hidden (CSS loader "Memverifikasi sesi…") until that point.

After boot, a `session.onChange` can make the page disallowed, for example when the admin role is removed, or
when the membership is deactivated and the session is then refreshed. The page then leaves for
`dashboard.html` the same way. Signing out from any of the three gated kinds goes to `index.html` (the v1
behaviour, now for all three). The demo ribbon shows on `guest|required|active|admin` pages.

### 9.2 `PPAPI.session` (core.js)

```js
PPAPI.session.ready()      // Promise<Session> — cached; core awaits it before onReady callbacks
PPAPI.session.current()    // Session (a copy). Before resolution: the empty session below
PPAPI.session.refresh()    // Promise<Session> — re-reads member + admin role (clears the admin cache), notifies
PPAPI.session.onChange(cb) // → unsubscribe; cb(Session) after every auth change (sign in/out/updateName) and refresh
PPAPI.session.isResolved() // boolean
// Session = { user, member, isAdmin, status, statusLabel, isActive, isMemberActive }
//   status         effective status ('' signed out; 'Draf' when signed in without a member record)
//   statusLabel    util.statusLabel(status) — Indonesian sentence
//   isActive       member Aktif OR admin   (use for "may see member features")
//   isMemberActive strictly the member's own status === 'Aktif' (use for KTA / registry wording)
// Empty: { user:null, member:null, isAdmin:false, status:'', statusLabel:'', isActive:false, isMemberActive:false }
```
Store mutations that change the CURRENT user's status or role call `session.refresh()` themselves:
`submitApplication`, `withdrawApplication`, admin decisions on one's own record, and adding or removing admins.

### 9.3 `PPAPI.util` additions

| Function / value | Result |
| --- | --- |
| `effectiveStatus(member)` | `'Kedaluwarsa'` \| stored status (normalised) \| `''` for null |
| `isActiveMember(member)` | `effectiveStatus === 'Aktif'` |
| `memberStatus(member)` | normalised STORED status (no Kedaluwarsa) |
| `statusBadge(status)` | `<span class="badge badge--ok\|warn\|err\|muted" data-status="…">…</span>` (escaped; `''` for empty). Aktif ok · Menunggu Verifikasi/Perlu Perbaikan warn · Ditolak/Nonaktif/Kedaluwarsa err · Draf muted |
| `statusTone(status)`, `statusLabel(status)` | tone key / Indonesian description |
| `STATUS_INFO`, `MEMBER_STATUSES` (6), `RENEWAL_DAYS` (60) | |
| `canRenew(member)` | Kedaluwarsa, Nonaktif, or Aktif with ≤ 60 days left |
| `validityDays(member)` | `daysUntil(validUntil)` or `null` |
| `defaultValidUntil()` | `'YYYY-12-31'` of this year + `config.masaBerlakuTahun` (3) → `'2029-12-31'` in 2026 |
| `PROVINSI` (38, sorted id), `PENDIDIKAN` (10), `GENDER` | shared option lists (the same values anggota.js uses) |

### 9.4 `PPAPI.ui` additions

```js
ui.locked({ title, text, actionHtml, eyebrow = 'Khusus Anggota Aktif', icon = 'lock', compact, cls }) // → html
//   title/text escaped; actionHtml raw. Without actionHtml the CTA follows the session (ui.lockedAction):
//   signed out → "Masuk" (masuk.html?next=<this page>) + "Daftar Anggota" (masuk.html?next=pendaftaran.html#daftar)
//   Draf → "Lengkapi Pendaftaran" · Perlu Perbaikan → "Perbaiki Pengajuan" · Ditolak → "Ajukan Ulang"
//   Kedaluwarsa/Nonaktif → "Ajukan Perpanjangan"   (all → pendaftaran.html)
//   Menunggu Verifikasi → "Lihat Status Pendaftaran" (→ dashboard.html) · active/admin → no CTA
//   The default text adapts to signed-out / pending / other status. Extra classes: 'locked--center', 'locked--flat'.
ui.lockedAction({ compact })   // → the CTA html alone ('' for active/admin)
ui.drawer({ title, eyebrow, body /* html (NOT escaped) or Node */, actions, size: 'sm'|'md'|'lg', onOpen, onClose, cls })
//   → { el, panel, body, footer, close, setTitle(text), setBody(html|Node), setActions(actions) }
//   Same action contract as ui.modal (return false keeps it open; Promise → spinner; error → toast).
//   Focus trap, Esc, backdrop click, focus restore, scroll lock. Shares the dialog stack with ui.modal,
//   so a ui.confirm() opened from a drawer is on top and Esc closes the confirm first. setBody() runs ui.reveal().
```
Modal and drawer action buttons also accept `id`.

### 9.5 Header account menu & nav

The signed-in dropdown head shows the avatar, name, email or phone, and badges: a metal `Admin` badge for
admins, plus the status badge (left out for an admin whose own membership is not Aktif). Items:

| viewer | items |
| --- | --- |
| member not active (Draf … Kedaluwarsa) | Dasbor · **Formulir Pendaftaran** (`pendaftaran.html`) · Kegiatan Saya · Pesanan Saya · Keluar |
| active member | Dasbor · **Profil Anggota** (`anggota.html`) · **Produk Pengetahuan** (`pustaka.html`) · **Aplikasi Anggota** (`anggota.html#aplikasi`) · Kegiatan Saya · Pesanan Saya · Keluar |
| admin (any own status) | Dasbor · Profil Anggota · Produk Pengetahuan · Aplikasi Anggota · Kegiatan Saya · Pesanan Saya · **Konsol Admin** (`admin.html`) · Keluar |

(Since 2026-10-21 — §9.17: **Kegiatan Saya** = `dashboard.html#kegiatan-saya`, **Pesanan Saya** = `pesanan.html`.)
| signed in, session not yet resolved (a few ms) | Dasbor · Keluar |

The v1 external "Simulator ↗" item is gone. The mobile menu foot is unchanged (Dasbor + Keluar).

Nav: `Pengetahuan → pustaka.html` replaces `Regulasi`. The config field `nav[].aktifJuga: ['regulasi']` marks
Pengetahuan with `aria-current="true"` on `regulasi.html` (Keanggotaan likewise on `pendaftaran`). CSS styles any
`[aria-current]` on `.site-nav__link` / `.mobile-menu__link`. Footer groups: Organisasi · Anggota (+ Formulir
Pendaftaran) · **Pengetahuan** (Produk Pengetahuan, Regulasi & Standar, Kebijakan Privasi).

### 9.6 `PPAPI.auth` additions

```js
auth.isAdmin()          // Promise<boolean>, cached per uid. Firebase: admins/{uid} exists · Demo: uid in ppapi_demo_admins
auth.postSignUpTarget   // 'pendaftaran.html' — masuk.js: after SIGN-UP without an explicit ?next=
auth.demoAdmin          // demo: { email:'admin@ppapi.demo', password:'AdminPPAPI2026', name:'Admin PPAPI (Demo)' } · Firebase: null
auth._clearAdminCache() // internal (session.refresh calls it)
```
Firebase `signInEmail()` and `signOut()` now notify listeners immediately, so the header and the session no longer
wait for `onAuthStateChanged`.

**Demo seed.** It runs before `auth.ready()` resolves, and `signInEmail` awaits it. It runs once per browser,
under the versioned key `ppapi_demo_seed_v2`:

| account / record | uid | status | notes |
| --- | --- | --- | --- |
| **Admin PPAPI (Demo)** — `admin@ppapi.demo` / **`AdminPPAPI2026`** | `demo-admin-0001` | own member record `Draf` | in `ppapi_demo_admins` |
| Bagus Pratama (Contoh) | `demo-contoh-0001` | Menunggu Verifikasi | Praktisi, 2 pengalaman, 2 dokumen (example.com) |
| Sari Wulandari (Contoh) | `demo-contoh-0002` | Perlu Perbaikan | admin note + history |
| Dimas Haryanto (Contoh) | `demo-contoh-0003` | Aktif | KTA `PPAPI-2025-000318`, validUntil 2028-12-31, registry entry |
| Andi Saputra (Contoh) | `demo-contoh-0004` | Ditolak | reason + history |

- The samples are `contoh:true` (member key `contoh`, admin-only). Their emails end in `@ppapi.demo` and their
  phones are `+62800…`, which are not real mobile numbers.
- The seed is robust to `check.mjs --admin`, which pre-sets only the session and the admins list. On **every load**,
  independent of the seed key, the admin's `ppapi_demo_users` entry is (re)created if it is missing, belongs to
  another uid, or its hash is not valid SHA-256 hex. The admin member record is handled the same way.
- Once the key exists, the samples are never seeded again, so admin changes to them survive.
- check.mjs `--auth` seeds an ACTIVE member (validUntil 2029-12-31). `--auth --status=X` sets the other states
  (Draf · Menunggu Verifikasi · Perlu Perbaikan · Aktif · Ditolak · Nonaktif · Kedaluwarsa).
- Test fixture (updated 2026-10-09): one shared active member, `flows/qa-lib.mjs` `DEMO_USER` / `DEMO_MEMBER`, seeded the
  way an approval leaves it — `validUntil 2029-12-31`, `approvedAt/approvedBy`, a submitted v2 `application`, empty
  `review` — **plus** `ppapi_registry['PPAPI-2026-004821']` built by `registryEntryFor()` (mirrors `store.js registryEntry()`:
  kta, nama, kategori, kompetensi ≤ 5, kota, berlakuHingga, status, search keys namaCari / namaKata / ktaNomor, updatedAt). Users: `check.mjs --auth`,
  `flows/fullshot.mjs --auth`, `flows/clip-shot.mjs --auth`, `seedAuth()` (journey.mjs, crawl.mjs). `--status` follows store.js: Draf / Menunggu
  Verifikasi / Perlu Perbaikan / Ditolak are never-approved applicants (no KTA, validUntil, approvedAt → no registry entry);
  Nonaktif keeps them (registry status `Nonaktif`); Kedaluwarsa = validUntil 2026-06-30 (registry berlakuHingga follows).
  `flows/aplikasi-lib.mjs` (member apps) seeds the registry entry for its approved members the same way.
  The member's own deep links (`verifikasi.html?kta=PPAPI-2026-004821`) therefore take the registry path, not the
  "KTA Anda" own-record fallback.

### 9.7 `PPAPI.store` v2 (exact)

Member shape v2 (normalised — every key present):
```js
{ uid, name, email, phone, photoURL, kta /* '' until approval */, memberType, status, joinedAt,
  validUntil /* 'YYYY-MM-DD' | '' */, approvedAt /* ISO | '' */, approvedBy, contoh /* bool, demo samples */,
  profile{12 keys}, competencies[], certificates[],
  application: { type:'baru'|'perpanjangan', kategori, submittedAt, updatedAt,
                 pengalaman:[{id, proyek, peran, tahun, lokasi}] /* ≤10 */, dokumen:[{id, jenis, label, url}] /* ≤12, https only */,
                 pasFoto /* data:image/jpeg;base64 ≤120 KB or '' (JPEG only — §9.14) */, pasFotoAda /* bool */, pembayaran:{metode, tanggal, buktiUrl},
                 pernyataan:{kodeEtik, kebenaranData, privasi, namaTerang, tanggal}, catatan /* ≤1000 */ },
  review: { note, history:[{at, by, byName, action, note}] }, createdAt, updatedAt }
```
- `dokumen.jenis` ∈ `store.DOC_TYPES` = CV, Sertifikat, Ijazah, Surat Rekomendasi, Bukti Pembayaran, Lainnya.
- `history.action` ∈ diajukan · ditarik · perbaikan · disetujui · ditolak · dinonaktifkan · diaktifkan · diperpanjang ·
  kategori-diubah.
- The store writes `diajukan`/`ditarik` in **demo mode only**. In Firebase, derive "diajukan" from
  `application.submittedAt`.
- `joinedAt` is the account date until the FIRST approval, which sets it to the approval date.

Member (self):
```js
store.ensureMember(user)        // NEW: status 'Draf', kta '', empty application/review (v1: Menunggu Verifikasi + ktaFromUid)
store.saveMember(uid, patch)    // v1 whitelist; v2 privileged keys + application/review/contoh are IGNORED silently.
                                // (audit) signed in as ANOTHER non-admin user → store/forbidden. `email` is kept only
                                // when '' or equal to the signed-in account's own email (rules: ownEmailOk) — anything
                                // else is dropped with one console.warn. photoURL: http(s) or a raster data URL only.
store.saveApplication(uid, patch) // owner only (store/forbidden); allowed in Draf, Perlu Perbaikan, Ditolak, or canRenew
                                  // (Kedaluwarsa, Nonaktif, Aktif ≤60 d) — else store/application-locked.
                                  // Partial patch merged + sanitised (limits above); type set automatically:
                                  // 'perpanjangan' when Kedaluwarsa/Nonaktif/Aktif (or a returned renewal), else 'baru'.
                                  // Errors: store/invalid-photo, store/photo-too-large. Returns the normalised member.
store.submitApplication(uid)    // → 'Menunggu Verifikasi', submittedAt, pernyataan.tanggal (today if empty).
                                // Incomplete → store/application-incomplete with err.missing (Indonesian labels) and
                                // err.fields [{key, step, label}] (step ∈ kategori|data-diri|profesional|dokumen|pernyataan).
                                // Wrong state → store/invalid-transition.
store.withdrawApplication(uid)  // only from 'Menunggu Verifikasi' → 'Draf' (submittedAt cleared)
store.applicationMissing(member) // [{key, step, label}] — the same rules submit uses (for the review step)
                                // (audit) application.kategori ∈ APPLY_TYPES (+ the member's current memberType for a
                                // renewal of an approved member); saveApplication stores '' for anything else (Kehormatan).
store.canEditApplication(member), store.applicationType(member), store.normalizeMember(raw)
store.APPLY_TYPES               // getter: kategori names from organisasi with bisaDiajukan !== false (Kehormatan excluded)
```
Required to submit:
- `kategori` ∈ APPLY_TYPES;
- `name` (≥3 characters) and `phone` (a valid Indonesian mobile number, saved with `saveMember({phone})`);
- profile `birthDate`, `province`, `city`, `company` and `position`;
- at least one `application.pengalaman` entry, **or** `profile.experienceYears` set (0 counts);
- all three `pernyataan` booleans true, plus `namaTerang` (≥3 characters);
- when `config.iuran.aktif` is on, also `pembayaran.buktiUrl`.

**Renewal caveat**: an Aktif member who renews early (≤60 days) becomes `Menunggu Verifikasi` and loses member
features until the renewal is approved. pendaftaran.html should say so before submitting. Admins can instead use
`admin.extend()` directly.

Admin (`store.admin.*`). For non-admins or signed-out users, every function throws **`store/forbidden`**
("Tindakan ini khusus admin PPAPI."):
```js
listMembers({ status?, q? })   // status = EFFECTIVE status (string or array; 'Aktif' excludes expired, 'Kedaluwarsa' lists them);
                               // q = words matched in name/email/HP/KTA/company/city/province/kategori.
                               // Sorted: Menunggu Verifikasi first (submittedAt asc), then updatedAt desc.
getMember(uid)
approve(uid, { memberType?, validUntil?, note? })   // not if effective Aktif. memberType default = application.kategori;
                               // validUntil default util.defaultValidUntil(); assigns KTA PPAPI-YYYY-NNNNNN if empty
                               // (sequential per year, skipping numbers already in the registry / static samples);
                               // writes registry/{kta}; first approval sets joinedAt. (audit) A never-approved v1
                               // KTA (ktaFromUid) that another member / the registry already holds is replaced by a
                               // fresh sequential KTA (no more overwriting someone else's public entry). Also allowed
                               // from Draf on purpose: Kehormatan members are designated, they do not apply.
requestRevision(uid, note)     // from Menunggu Verifikasi|Perlu Perbaikan; note ≥5 chars (store/note-required)
reject(uid, note)              // from Menunggu Verifikasi|Perlu Perbaikan|Draf; reason ≥5 chars
deactivate(uid, note?)         // stored Aktif (incl. expired) → Nonaktif; registry status Nonaktif
reactivate(uid, { validUntil?, note? }) // Nonaktif → Aktif (keeps a future validUntil, else default); KTA if missing
extend(uid, validUntil, note?) // stored Aktif only; date ≥ today (store/invalid-date)
setMemberType(uid, type)       // store/invalid-type for unknown types; registry kategori when Aktif
listFeedback()                 // newest first; status default 'Baru'; catatanAdmin
updateFeedback(id, { status?: 'Baru'|'Diproses'|'Selesai', catatanAdmin? })
listAdmins()                   // [{uid, name, email, addedAt, addedBy}]
addAdmin(email)                // existing account email (case-insensitive) → store/not-found | store/already-admin | store/invalid-email
                               // | store/ambiguous-email (several records share the address — never guessed). The admin
                               // page should show the matching member (listMembers({q: email})) and ask to confirm.
removeAdmin(uid)               // store/last-admin when only one admin is left
audit(limit = 50)              // [{id, at, by, byName, action, label, targetType, targetId, targetName, note}] newest first
summary()                      // {total, draf, menunggu, perbaikan, aktif, ditolak, nonaktif, kedaluwarsa, akanKedaluwarsa (≤60 d), umpanBalikBaru}
exportMembersCsv(members)      // string: '﻿' + ';'-separated, CRLF, formula cells neutralised ("'="…, also TAB/CR and the
                               // full-width ＝＋－＠), cells with ; , " or newlines quoted, phone as 08…
```
Each decision:
- appends to `review.history` (`{at, by, byName, action, note}`);
- sets `review.note` (the note of approve, revision, reject, deactivate or reactivate);
- writes an audit entry. `store.AUDIT_LABELS` maps each action to an Indonesian label.

Errors: `store/invalid-transition`, `store/note-required`, `store/invalid-date`, `store/invalid-type`, `store/not-found`.

Content (`store.content.*`; reads public, writes admin):
```js
content.list(type, { includeHidden?, fresh? }) // type ∈ berita|pengumuman|agenda|pustaka|regulasi (else store/invalid-type)
//   static PPAPI_DATA[type] merged with managed items; each item gets _static / _managed (and hidden with includeHidden).
//   Sorting: berita/pengumuman tanggal desc · agenda mulai asc · pustaka/regulasi keep the FILE ORDER of static items,
//   a new managed item goes right after the last static item of its kategori/jenis.
content.get(type, id)          // incl. hidden
content.save(type, item)       // create (id from slug of judul, -2, -3 …) or override (same id as a static item).
//   Sanitised to the SPEC v1 shapes + pustaka §4.3 shape (+ app); unsafe URLs dropped; store/content-incomplete,
//   store/invalid-id. PUSTAKA: akses 'anggota' + tautan (not an aplikasi/ path) → the link goes to the private file
//   store (Firestore pustaka_files/{id} · demo ppapi_pustaka_files), the public item gets tautan '' + berkasAnggota:true;
//   pass hapusBerkas:true to drop it. Returns the merged item.
content.remove(type, id)       // static → hidden override; managed-only → deleted (+ its private file)
content.restore(type, id)      // static only: drop the override
```
Registry: `store.registry.lookup(query)` → `{ exact, matches, kind: 'kta'|'kta-awal'|'nama'|'kosong', query }`.
- Input rules are the same as verifikasi.js: a full KTA in any spacing or case → exact match; ≥4 digits → contains;
  ≥3 letters → name search.
- Entries carry public fields only: `kta, nama, kategori, kompetensi, kota, berlakuHingga, status`, and `contoh`.
- Sources:
  - Firestore `registry` in Firebase mode. An exact lookup is one document read; other lookups list the collection
    once per page.
  - `ppapi_registry` in demo mode.
  - The static `PPAPI_DATA.registry`: every entry in demo mode, only the non-`contoh` ones in Firebase mode.

Knowledge files: `store.pustaka.fileUrl(item)` → Promise<url|''>.
- Unless the viewer is an active member or an admin, it throws `store/forbidden` ("Dokumen ini khusus anggota
  berstatus Aktif.").
- Firebase: `akses:'publik'` → `item.tautan`; otherwise `pustaka_files/{id}.url` || `item.tautan`.
- Demo: the private map || `item.tautan`.
- App items return their `aplikasi/…` path.

Constants: `MEMBER_TYPES, APPLY_TYPES, STATUSES (6), LEVELS, DOC_TYPES, FEEDBACK_KATEGORI, FEEDBACK_STATUS,
PROTECTED_FIELDS, CONTENT_TYPES, PUSTAKA_KATEGORI, PUSTAKA_STATUS, HISTORY_ACTIONS, AUDIT_LABELS, LIMITS
{pengalaman:10, dokumen:12, pasFotoKB:120, catatan:1000, note:2000}`, `store.version === 2`.

### 9.8 Firestore paths (Firebase) ↔ demo storage

| Firebase | Demo (localStorage) | Rules (site/firestore.rules) |
| --- | --- | --- |
| `members/{uid}` | `ppapi_member_{uid}` | owner get + whitelisted update + limited status transitions + email only '' or the account's token email (audit); admin read/list/write; create = Draf, kta '' |
| `admins/{uid}` `{uid,name,email,addedAt,addedBy}` | `ppapi_demo_admins` (uid array) | get self/admin; list/write admin |
| `registry/{kta}` `{kta,nama,kategori,kompetensi,kota,berlakuHingga,status,namaCari,updatedAt,contoh?}` | `ppapi_registry` (map) | read anyone; write admin (keys whitelisted) |
| `counters/kta-YYYY` `{value,updatedAt}` (transaction) | `ppapi_counters` `{'kta-2026': n}` | admin |
| `audit_log/{auto}` | `ppapi_audit_log` (≤500) | admin create (by == auth.uid) + read; no update/delete |
| `feedback/{auto}` (+ `status, catatanAdmin, updatedAt, updatedBy`) | `ppapi_feedback` | create anyone; read/update admin (only those 4 keys, updatedBy == the acting admin — audit); no delete |
| `content_berita\|pengumuman\|agenda\|pustaka\|regulasi/{id}` | `ppapi_content_<type>` | read anyone; write admin |
| `pustaka_files/{id}` `{url,updatedAt,updatedBy}` | `ppapi_pustaka_files` (map) | read admin OR active member (status Aktif + validUntil not past); write admin |
| — | `ppapi_demo_seed_v2`, `ppapi_demo_users` | — |

- Each admin decision runs in ONE transaction (member + counter + registry + audit).
- No composite indexes are needed. The queries are `members where email ==`, `feedback orderBy createdAt` and
  `audit_log orderBy at`.
- Static check of the rules: braces and parentheses balance. The semantics are exercised by
  `firebase-v2-stub.mjs` (through the mirror).
- Publishing the rules in the Firebase console is the only way to confirm that Google's parser accepts the file
  (README §10).

### 9.9 Config & data

`config.js`:
- `apps[]` holds two entries:
  - `{key:'perencanaan', title:'PPAPI Scaffold — Perencanaan & Analisis Struktur', short, desc, url:'aplikasi/perencanaan/index.html', ikon:'ruler', fitur[4]}`
  - `{key:'simulator', title:'Simulator Pemasangan Perancah Tube & Coupler', short, desc, url:'aplikasi/simulator/index.html', ikon:'layers', fitur[4]}`
- The app texts follow `devtools/legacy/ANALISIS_PERENCANAAN.md` §0–§1 (9 stages, checklist 10 kategori / 52 butir /
  21 kritis) and, for the simulator, `site/aplikasi/KOREKSI-SIMULATOR.md` §3–§4 (18 catalogue items, 20 stages from
  preparation/red tag to handover inspection/green tag, 24 measured inspection items) — updated 2026-10-09 (§9.14). The analyses'
  caveats (simplified calculation method, attribution to be harmonised) are reflected only in the neutral
  `appNote` ("hasil … indikatif") — no claims beyond what the apps do.
- **The URLs are RELATIVE internal paths.** Pages must no longer filter apps with an `http(s)` test. Open them in
  the same tab; the app's portal bar links back.
- `simulatorUrl` = the simulator path. `appNote` is updated.
- New keys: `masaBerlakuTahun: 3`, `iuran:{aktif:false, nominal:'', keterangan:'', rekening:''}`,
  `pustaka:{katalogPublik:true}`. `nav` and `footerLinks` are updated (see §9.5).

`data/pustaka.js` (`PPAPI_DATA.pustaka`, 12 items):
- 10 sample documents: `contoh:true`, `status:'Dalam Penyusunan'`, `tautan:''`, penyusun "Tim Penyusun PPAPI".
  They cover every kategori, with codes `PPAPI-STD-01`, `PPAPI-CoP-01/02`, `PPAPI-PT-01/02`, `PPAPI-MP-01/02/03`,
  `PPAPI-FR-01` and `PPAPI-KT-01`.
- Two REAL app items, `aplikasi-perencanaan` and `aplikasi-simulator`: `contoh:false`, `akses:'anggota'`,
  `app:'perencanaan'|'simulator'`, `tautan` = the app path.
- The file order follows the kategori order.
- Regulations come from `content.list('regulasi')` and appear on pustaka.html under "Peraturan Perundangan".

`data/organisasi.js`:
- `keanggotaan.langkah` = Buat akun → Isi formulir pendaftaran → Verifikasi sekretariat → Aktif & KTA digital → Akses
  fitur anggota.
- `kategori[Kehormatan].bisaDiajukan = false`.
- The `manfaat` texts now point to the internal apps and Produk Pengetahuan.
- FAQ: the answers to "Bagaimana cara mendaftar?", "Kapan … Aktif?" and the app-access question are rewritten. A new
  item, "Fitur apa saja yang terbuka setelah keanggotaan Aktif?", brings the keanggotaan FAQ to 8 items.

### 9.10 New CSS components (main.css §17b; all in styleguide.html section 08, light + dark)

```html
<!-- locked panel (or PPAPI.ui.locked()) -->
<div class="locked [locked--compact|--center|--flat]">
  <span class="locked__icon">{icon lock}</span><p class="locked__eyebrow">Khusus Anggota Aktif</p>
  <p class="locked__title">…</p><p class="locked__text">…</p><div class="locked__actions">…buttons…</div>
</div>
<!-- blurred teaser with the panel on top (grid-stacked: never overflows) -->
<div class="locked-veil"><div class="locked-veil__content" aria-hidden="true" inert>…preview…</div>{ui.locked({compact:true, cls:'locked--center'})}</div>

<!-- status timeline: horizontal ≥640px, vertical below (or always with --vertical) -->
<ol class="status-track [status-track--vertical]" aria-label="Tahapan pendaftaran">
  <li class="status-track__step is-done"><span class="status-track__node" aria-hidden="true"></span>
    <span class="status-track__label">Akun dibuat</span><span class="status-track__meta">28 Sep 2026</span></li>
  <li class="status-track__step is-current" aria-current="step">…</li>   <!-- is-warn / is-error too; todo = no class -->
</ol>

<!-- wizard progress: vertical rail ≥1024px; compact header + bar + numbered squares below -->
<nav class="stepper" aria-label="Langkah formulir">
  <p class="stepper__compact" aria-hidden="true"><span class="stepper__count">Langkah 3 dari 7</span><span class="stepper__current">Data Profesional</span></p>
  <div class="stepper__bar" style="--value:43" aria-hidden="true"></div>
  <ol class="stepper__list"><li class="stepper__item is-done|is-current|is-error"><button type="button" class="stepper__btn" [aria-current="step"] [disabled]>
    <span class="stepper__num">01</span><span class="stepper__text"><span class="stepper__label">Kategori</span><span class="stepper__hint">Praktisi</span></span>
  </button></li>…</ol>
</nav>

<!-- KPI tile (div or a.kpi link; tones colour the dot + note) -->
<div class="kpi [kpi--ok|--warn|--err|--accent|--dark]"><div class="kpi__head"><span class="kpi__label">Menunggu verifikasi</span>
  <span class="kpi__icon">{icon}</span></div><p class="kpi__value">4 <small>orang</small></p><p class="kpi__note">…</p></div>

<!-- knowledge-product card (folded corner); title link/button stretches over the card -->
<article class="doc-card [doc-card--locked]">
  <div class="doc-card__top"><span class="doc-card__kind">{icon}Code of Practice</span><span class="doc-card__code">PPAPI-CoP-01</span></div>
  <h3 class="doc-card__title"><button type="button">…</button></h3><p class="doc-card__summary">… (3-line clamp)</p>
  <div class="doc-card__meta"><span>Rancangan</span><span>PDF</span></div>
  <div class="doc-card__foot">{statusBadge}{contohBadge}<span class="doc-card__access">{icon lock|arrow-up-right}Terkunci</span></div>
</article>
<!-- featured (apps): media left 5/12 from 768px; the photo fills the text's height -->
<article class="doc-card doc-card--feature"><div class="doc-card__media">{img}</div><div class="doc-card__body">…same inner parts…</div></article>
```
- `ui.drawer` generates the drawer markup. Inside it, use `.drawer__section` + `.drawer__section-title` blocks; a
  trailing `.kv` loses its last rule.
- `.account-menu__status` holds the badges in the account menu.
- The hover lifts of `.doc-card` and `a.kpi` are off under reduced motion, and `.drawer` is hidden in print.
- KPI icons are hidden below 480px.

### 9.11 Notes for page authors

- Read news, agenda, announcements, regulations and pustaka through `await PPAPI.store.content.list(type)`, so
  admin-managed items appear and hidden ones disappear. Show `util.contohBadge(item)` as before; managed items are
  `contoh:false` unless the admin kept the flag.
- Gate member features with `PPAPI.session.current().isActive` (admins included), and use `ui.locked()` for teasers.
  Set `anggota.html` → `data-auth="active"`, `admin.html` → `data-auth="admin"` + `noindex`, and
  `pendaftaran.html` → `required`.
- Wizard:
  - Autosave with `saveApplication` (debounced). Profile fields go through `saveMember`; the name goes through
    `auth.updateName`.
  - Use `store.applicationMissing(member)` for per-step errors and for the review step. After a failed submit, map
    `err.fields[].step` to the wizard steps.
  - Offer only `store.APPLY_TYPES`.
  - Pas foto: resize to JPEG ≤360×480 and ≤120 KB in the browser before calling `saveApplication({pasFoto})`.
- After sign-up with no `?next=`, masuk.js should go to `PPAPI.auth.postSignUpTarget`.
- `aplikasi/gate.js` (apps agent): load `../../assets/js/config.js`, `core.js`, `auth.js` and `store.js`, then
  `await PPAPI.session.ready()` and allow only when `session.isActive`. Core still boots without `#site-header`. Flash
  toasts set with `PPAPI.ui.flash()` before redirecting to `../../dashboard.html` appear on that page.
- Simulator / planning-app progress stays in localStorage per uid (SPEC-v2 §4.4 — no member-record writes); use a
  key such as `ppapi_progress_<uid>_<appKey>` so it never collides with the portal's keys.
- §9.8 lists every demo storage key. For the console's "Konten" note: in demo mode, changes live in this browser
  only.
- Run `flows/contract-v2.mjs` and `flows/audit-v2.mjs` after any shared-file change. They create and then delete
  `site/__v2test_*.html` / `site/__v2audit_*.html`, names that do not clash with contract.mjs's `__test_*` cleanup.

### 9.12 v1 test expectations that changed INTENTIONALLY (update these flows)

Verified: apart from the expectations listed below, every check of every v1 flow still passes.
- Foundation flows:
  - contract: 241/248;
  - auth-demo: stops at the first of its two changed expectations, and gives 53/53 with both patched;
  - foundation-ui 30/30, foundation-fixes 62/62, firebase-smoke 7/7, firebase-phone 17/17.
- Page flows: berita-agenda 124/124, masuk 131/131, regulasi-verifikasi 138/138, umpan-balik 132/132,
  security-lens 55/55, security-lens-2 XSS 0, contoh-audit 0 missing badges.
- `check.mjs all`, `--auth`, `--admin`, every `--status` and `--motion`: 0 issues.

| Flow | Check | Old expectation → v2 |
| --- | --- | --- |
| contract.mjs | config.nav = SPEC 7 items | `…,regulasi,…` → `…,pustaka,…` (label Pengetahuan) |
| contract.mjs | config app URLs equal researched app URL; apps keys `simulator,analisis` | keys `perencanaan,simulator`, urls `aplikasi/perencanaan/index.html`, `aplikasi/simulator/index.html`; `simulatorUrl` = `aplikasi/simulator/index.html` |
| contract.mjs | sign-up → ensureMember (kta, Praktisi, Menunggu Verifikasi) | `status:'Draf'`, `kta:''` |
| contract.mjs | ensureMember: kta = util.ktaFromUid(uid) | `kta:''` until approval (idempotent still true) |
| contract.mjs | saveMember … ignores status → 'Menunggu Verifikasi' | → `'Draf'` |
| contract.mjs | account dropdown: Dasbor, Halaman Anggota, Simulator ↗, Keluar | new (Draf) account: `Dasbor, Formulir Pendaftaran, Keluar`; active: `Dasbor, Profil Anggota, Produk Pengetahuan, Aplikasi Anggota, Keluar`; admin adds `Konsol Admin` |
| auth-demo.mjs (l.102) | ensureMember created default member record | `status === 'Draf' && kta === ''` |
| auth-demo.mjs (l.172) | saveMember ignores protected fields → status 'Menunggu Verifikasi' | → `'Draf'` |
| journey.mjs S1 | dashboard: KTA shown; status "Menunggu Verifikasi" for a new member | a new member is `Draf` with no KTA (status centre instead) |
| journey.mjs S1 | menu item "Halaman Anggota" click (→ exception, rest of S1 skipped) | not in a Draf member's menu; the active label is "Profil Anggota" (anggota.html becomes `data-auth="active"`) |
| journey.mjs S3 | ArrowDown/ArrowUp cycle `Halaman Anggota\|Simulator (tab baru)\|Keluar\|Dasbor` | `Profil Anggota\|Produk Pengetahuan\|Aplikasi Anggota\|Keluar\|Dasbor` (active fixture) |
| beranda-flow.mjs | signed in: app buttons open app URL in a new tab; clicking opens the app in a new tab | internal relative URLs (`aplikasi/…`), same tab per SPEC-v2 §4.4 (index.js must also lock them for non-active viewers) |
| dashboard-flow.mjs | apps: simulator + analisis, new tab (×2 viewports) | dashboard.js filters apps by http(s), so the list is now empty; use the internal `aplikasi/…` URLs |
| dashboard-flow.mjs | new member: KTA from ensureMember; Menunggu Verifikasi (warn); KPI status text (×2) | a new member is `Draf` with no KTA → the non-active status-centre view (SPEC-v2 §4.5) |
| anggota-flow.mjs | aplikasi: 2 launch cards; links open app in new tab; features listed | anggota.js filters by http(s) and opens a new tab → use the internal app paths |
| profil-flow.mjs (keanggotaan) | 5 alur steps, last `KTA digital terbit` | steps: Buat akun · Isi formulir pendaftaran · Verifikasi sekretariat · Aktif & KTA digital · Akses fitur anggota |
| profil-flow.mjs (keanggotaan) | 7 membership FAQ items / numerals 01–07 | 8 items, 01–08 |
| crawl.mjs | 0 broken internal refs | until the pages exist: `pustaka.html` (nav), `pendaftaran.html` (footer), `aplikasi/perencanaan/index.html`, `aplikasi/simulator/index.html` (styleguide + index) |

The v1 flows were not edited, because they belong to their authors. `flows/contract.mjs` and
`flows/auth-demo.mjs` stay as the v1 record; `contract-v2.mjs` is the v2 contract.

### 9.13 Contract audit v2 (2026-10-09) — what changed, what pages can rely on

Full report: `devtools/AUDIT_V2.md`. New test `flows/audit-v2.mjs` (53 checks, demo; 34 passed / 19 failed on the
foundation as first delivered, 53/53 now); `flows/firebase-v2-stub.mjs` gained 2 checks (34/34) and its rules mirror
follows the two rules changes below. `contract-v2.mjs` 175/175 (one expectation updated: a `Kehormatan` kategori is no
longer stored by `saveApplication`).

Pages can now rely on (shared files only, no page edits):
- **Read-side sanitising.** Every member object the store returns (`getMember`, `admin.*`, `session.current().member`)
  has the exact v2 shape with string fields: `application.dokumen[].url` and `pembayaran.buktiUrl` are `https://` or
  `''`; `certificates[].link` https or `''` (§9.14); `photoURL` http(s)/raster data URL or `''`; `pasFoto` a JPEG
  data URL or `''` (§9.14); list items are objects with string fields (missing ids → stable `p-1`, `d-1` …). Managed content
  (`content.list`) re-checks `tautan`, `gambar`, `tautanDaftar`, `sumber`; `pustaka.fileUrl` only returns http(s) or a
  safe relative path. Firestore rules only bound list sizes, so this blocks stored XSS against admins through direct
  SDK writes. **Still escape every string with `util.h()`** — sanitising covers links and types, not HTML.
- **Prototype-safe ids**: content ids such as `constructor` / `tostring` list normally; `util.statusTone/statusLabel`
  use own keys only (`'constructor'` → `muted` / `''`).
- **KTA uniqueness**: see `approve` above. **CSV**: see `exportMembersCsv` above.
- **Mobile drawer footer** (< 600px): the primary action (last in `actions`) spans the first row; the other actions
  share the next row — three console actions take two rows. Order your `actions` as `[secondary…, primary]`.

Known behaviours (documented, not changed — product decisions):
- An **early renewal** (Aktif ≤ 60 days) moves the member to `Menunggu Verifikasi` → member features locked until the
  admin approves; **withdrawing** it returns to `Draf` (rules allow only Menunggu Verifikasi → Draf), not to Aktif.
  (Superseded in part by §9.14: REJECTING or RETURNING a renewal now restores the previous membership state.)
  pendaftaran.html must say both before submitting / withdrawing; for members who are still Aktif the secretariat
  should prefer `admin.extend()`. Rejecting / returning a renewal leaves the public registry entry as it was
  (`Aktif` + the old `berlakuHingga`), which stays truthful for the period already approved.
- Rules `validityOk` compares `validUntil` 00:00 **UTC** + 1 day with `request.time`, so in WIB the rules keep an
  expiring member active up to 7 hours longer than the client's `effectiveStatus` (never shorter).
- Demo mode is not a security boundary (localStorage is editable); signed-out `saveMember` stays possible in demo
  only (v1 tests use it; Firebase refuses it).
- Firebase does not verify e-mail ownership for e-mail/password accounts: before `addAdmin`, the console should show
  the matching record and the README tells the secretariat to let the person sign up themselves first.
  (Superseded by §9.14: only a VERIFIED account email reaches `member.email`.)

### 9.14 Shared fixes after the v2 security / journey / design review (2026-10-09)

Verified by `flows/firebase-v2-stub.mjs` (46/46; its `STUB` = the compat-SDK stub + rules mirror, updated for every
rule below — keep it in step with `firestore.rules`), `flows/sec-v2-firebase-attacks.mjs` (78/78; now reads that
`STUB` source like masuk-flow, admin-firebase 17/17 and verifikasi-v2-flow 54/54 do, instead of a stale copy),
`flows/contract-v2.mjs` (175/175), `flows/audit-v2.mjs` (53/53), `flows/foundation-fixes.mjs` (62/62; robots
expectation updated), `flows/journey-v2-edges.mjs` (19/19),
`flows/shared-fixes-verify.mjs` (14/14, screenshots `shots/qa/shared-*.png`) and `check.mjs` (all pages, signed out,
`--auth`, every `--status`, `--admin`: 0 issues).

**Data & rules**
- **Reviewed data frozen while `Menunggu Verifikasi`.** Rules (`reviewedDataKept`): the owner cannot change `name`,
  `phone`, `photoURL`, `profile`, `competencies`, `certificates` (nor the application / pas foto) while a submitted
  application is pending; withdrawing (→ Draf) reopens everything. `store.saveMember` throws
  **`store/application-locked`** for a non-admin when such a field would CHANGE (identical values pass);
  `ensureMember` no longer syncs those fields while pending (only a verified email).
- **Verified e-mail only.** Rules accept a non-empty `members.email` only when it equals `request.auth.token.email`
  AND `email_verified == true` (create and update). Firebase `signUpEmail` sends the verification mail; the member
  record gets the email once the account is verified (`ensureMember`/`saveMember` use the verified address only).
  `auth.current()` now has **`emailVerified`** (demo accounts: true). New: **`auth.sendEmailVerification()`**
  (Firebase: resend; errors `auth/email-already-verified`, `auth/no-email`, `auth/too-many-requests`) and
  **`auth.refreshUser()`** (reloads the account; when it became verified: refreshes the ID token, fills
  member.email, notifies). Firebase `ready()` runs `refreshUser()` quietly for an unverified email account.
  `admin.addAdmin()` finds members by that verified email only → an address squatted by an unverified account is
  `store/not-found`; a record without email → `store/email-unverified`.
- **Server time.** Owner writes in Firebase set `updatedAt`, `application.updatedAt`, `application.submittedAt`
  with `FieldValue.serverTimestamp()`; rules require `== request.time` (or unchanged; submittedAt may become '' on
  withdraw). The store writes the application with FIELD PATHS (`'application.kategori'` …) so server times are never
  rewritten from a local copy. Read side: `normalize()` turns Timestamps into ISO strings (also inside
  `admin.*` results). Rules accept string OR timestamp for these fields (older data).
- **Complete submissions only.** The owner transitions to `Menunggu Verifikasi` also require kategori ∈ Praktisi /
  Ahli / Mitra Korporat (or the member's own approved kategori on renewal), name ≥ 3, `pernyataan.kodeEtik`,
  `kebenaranData`, `privasi` true and `namaTerang` ≥ 3 (the rule-checkable part of `applicationMissing`).
- **Pas foto: JPEG only** (`^data:image/jpeg;base64,…`, store + rules); message "Pas foto harus berupa gambar JPEG."
- **Pas foto out of the member document (Firebase).** `saveApplication({pasFoto})` writes
  **`member_photos/{uid}`** `{uid, data, updatedAt}` (rules: owner while the application is editable, admin; get
  owner/admin; no list) and stores `application.pasFoto: ''` + **`application.pasFotoAda: true`**. An inline photo
  of an older record moves there on the next `saveApplication`. Read API:
  - `getMember(uid)` / `admin.getMember(uid)` → with the image (cached per uid + application.updatedAt);
    `getMember(uid, { pasFoto: false })` → without (the SESSION uses this: no image on every page);
  - `admin.listMembers({ …, pasFoto })`: `'antrian'` (default) = image only for stored status Menunggu Verifikasi /
    Perlu Perbaikan; `false` = none; `true` = all (one read each — avoid);
  - **`store.pasFoto(uid)`** → data URL or '' (owner or admin).
  Demo keeps the photo inline but returns the same shapes (rows outside the queue: `pasFoto ''`, flag true).
  `admin.summary()` reads member documents only (now without photos; the compat SDK 12.4.0 has no count()).
- **Certificate links https only** (`cleanCertificates`, write + read). Pages: validate `https://` like dokumen.
- **Registry: no bulk download.** Rules: `allow get: if true; allow list: if request.query.limit <= 20;`.
  `registry.lookup()` in Firebase: full KTA → `get()`; "PPAPI-YYYY…"/digits → prefix range on `kta` (year) or on
  the new **`ktaNomor`** (6-digit number); names → prefix range on `namaCari` + `array-contains` on the new
  **`namaKata`** (whole words of the folded name); all `limit(20)`; then the same filters as demo. Registry docs
  written by approve/extend/… carry `namaKata`, `ktaNomor`; older docs gain them on the next admin write. Demo
  still searches its local copy in full (contains). Firebase name search = name prefix or a whole word (not a
  fragment inside a word).
- **Rejected / returned RENEWAL keeps the membership.** `reject()` / `requestRevision()` on an application of type
  `perpanjangan` from a member who held a KTA: status goes back to the state before the renewal, read from the
  admin-written history (`disetujui`/`diaktifkan`/`diperpanjang` → **Aktif**, `dinonaktifkan` → **Nonaktif**;
  no history but `approvedAt` → Aktif). KTA, validUntil and registry stay; the `ditolak`/`perbaikan` history entry
  and `review.note` are written as before (audit note adds "[Perpanjangan; keanggotaan kembali …]"). An expired
  member returns to Aktif = effective **Kedaluwarsa** (renewable again), not Ditolak. New applications: unchanged.
- **CSV**: formula characters are neutralised also behind leading whitespace / NBSP / zero-width / BOM / ideographic
  space / other invisible characters, and the small/full-width forms ﹦﹢﹣﹫＝＋－＠ and − (U+2212).

**UI (core.js / main.css)**
- `ui.modal` / `ui.drawer`: while the body overflows it gets `tabindex="0"`, `role="region"`,
  `aria-labelledby` = the dialog title and class `is-scrollable` (focus outline inset). Re-checked on content /
  viewport changes (ResizeObserver + MutationObserver). Initial focus is unchanged.
- `ui.lockedAction` (signed out): second CTA label **"Daftar Menjadi Anggota"** (href unchanged).
- Phones (≤ 479 px) with a dialog/drawer open (`html.modal-open`): `.toast-region` moves to the top.
- Button hover fills (`.btn--primary/ghost/danger/light/link:hover`, icon nudges) only under
  `@media (hover: hover) and (pointer: fine)`; `:active` gives press feedback without a fill.

**Content**: homepage pillar 04 "Aplikasi Anggota"; FAQ "Profil Anggota"; berita sample "situs resmi" rewritten for
v2 and "Halaman Anggota" → "Profil Anggota"; `config.apps[simulator]` and `pustaka` app summary follow the
corrected simulator (`aplikasi/KOREKSI-SIMULATOR.md` §3–§4: preparation + red tag … handover inspection of 24
measured items + green tag); app items `penyusun: ''` until the client confirms the attribution.
`styleguide.html` sample links to member pages are `href="#"`. `robots.txt`: comment lists every noindex page;
`Disallow` for README.md, `aplikasi/*.md`, `firestore.rules`.

### 9.15 Release QA v2 (2026-10-09) — deferred items closed, test suite brought to v2

Verified by the new **`flows/release-v2-deferred.mjs`** (demo + Firebase stub, see the release notes for the count)
and by the full flow/check matrix in `devtools/RELEASE_NOTES_V2.md` §6.

**Data & rules**
- **Identity lock after approval.** Once `approvedAt` is set and the stored `name` has ≥ 3 characters, the owner can no
  longer change `name` (it is printed on the KTA and published in the registry). Rules: new `identityKept()` in
  `ownerUpdate`. Store: `saveMember` throws **`store/identity-locked`** for a non-admin when the name would CHANGE
  (identical values pass; an empty name may still be filled; admins may correct it). `auth.updateName()` still renames
  the ACCOUNT; its member-record sync ignores `store/identity-locked` silently (no console warning).
  pendaftaran.html (renewal of an approved member) shows `#f-name` and a filled `#f-birthDate` read-only with a lock
  hint linking to Kontak — the same rule as anggota.html.
- **Registry snapshot.** New `registryWrite(m, spec, prev)` in store.js: `approve()` (spec `true`) publishes a fresh
  snapshot of the reviewed data; `extend()`, `setMemberType()`, `deactivate()` and `reactivate()` (spec = object)
  update only `kategori` (= memberType), `berlakuHingga` (= validUntil) and `status`, and keep `nama`, `kompetensi`,
  `kota` (+ search keys rebuilt from that `nama`) of the existing entry. No existing entry → built from the member as
  before. Firebase: the transaction reads `registry/{kta}` before any write. Consequence for the secretariat: a name
  correction is made in `members/{uid}.name` AND `registry/{kta}.nama` (README §5).
- **Kategori rule.** New `kategoriAllowed()` in `ownerUpdate`: an owner write may carry `application.kategori` ∈
  '' / Praktisi / Ahli / Mitra Korporat, or the member's own `memberType` (Kehormatan holder renewing), or the unchanged
  value; `create` accepts only '' / Praktisi / Ahli / Mitra Korporat. The stub mirror in `flows/firebase-v2-stub.mjs`
  carries both new functions (keep it in step with the rules).

**UI**
- **E-mail verification (Firebase only).** dashboard.html has `#dash-verify` inside the hero: shown when
  `auth.mode === 'firebase'` and `user.email && user.emailVerified === false`; actions "Saya Sudah Memverifikasi"
  (`auth.refreshUser()` → `session.refresh()`, toast) and "Kirim Ulang Tautan" (`auth.sendEmailVerification()`); status
  line `#dash-verify-status` (role=status). Demo accounts count as verified → never shown. pendaftaran Data Diri: the
  e-mail hint says the address is not verified yet. Konsol Admin › Admin: copy now says only VERIFIED e-mail accounts
  can be made admin (the old "situs tidak memverifikasi" note was wrong after §9.14).
- **Content-Security-Policy** meta (the index.html policy) on EVERY page; the two app pages add
  `https://cdnjs.cloudflare.com` to `script-src`. New pages must copy it right after the viewport meta.
- **Deferred #fragment jump** (core.js `deferredHashScroll()`, runs after every `onReady` callback): cross-page
  links such as `berita.html?kategori=…#arsip`, `pustaka.html?kategori=…#katalog`, `pustaka.html#aplikasi` and
  `keanggotaan.html#alur` made the browser jump to the target BEFORE the data-rendered sections existed, which then
  pushed it away (CLS 1.0 measured on desktop with reduced motion). berita.html, pustaka.html and keanggotaan.html
  now carry a head snippet that removes a listed fragment early (`window.__ppHash`); after render + web fonts (≤ 1 s)
  core.js scrolls to it unless the visitor already scrolled, then puts the fragment back (CLS ≤ 0.003, same landing
  position). A new data-rendered page that is a link target copies the snippet with its own section ids.
- **Logos:** no page requests the 1200 px PNG masters on screen any more (simulator gate → `logo-light-mark.webp`;
  dashboard KTA teaser, masuk visual, umpan-balik office card → `logo-light-sm.webp` 480×167). The PNG stays only in the
  footer `srcset` (never chosen at ≤ 3× for 127 px) and on the printable KTA card.

**Tests brought to v2** (expectations changed intentionally; each edit is commented in the flow)
- `contract.mjs` (v1 record): the 9 v2 differences of §9.12 + `emailVerified` → 248/248; `auth-demo.mjs` → 53/53
  (guest `next` now tested with a public page, because anggota.html is `data-auth="active"`).
- `dashboard-flow.mjs`: teaser cards carry no links (catalog link is in the help row); admin without own Aktif
  membership gets `#dash-self` instead of the KPI row.
- `umpan-balik-flow.mjs`: privacy policy date 9 Oktober 2026. `aplikasi-simulator-flow.mjs`: two green tags (one per
  access point). `v2lens-keyboard.mjs` K1.6 accepts focus on the first invalid field while the summary is announced
  (`role="alert"`). `verify-eng-perencanaan.mjs`: part B compares screen values with the v2.3.0 model, so it runs only
  for app version 2.3.0 (or `--b`); v2.4.0 is covered by `aplikasi-perencanaan-temuan.mjs` / `-koreksi.mjs`.
- `contrast-sample.mjs` now samples viewport by viewport in the real layout (a fullPage capture re-laid vh-sized parts
  out, which produced false footer failures on every mobile page).

### 9.16 Release QA v2, final pass (2026-10-10) — client rules, last fixes

The site is LIVE at <https://anakabil.github.io/ppapi-website/> (public repo `anakabil/ppapi-website`), published by
`devtools/deploy.sh` from `site/` (separate public history; `siteUrl` is injected into the PUBLIC copy only — keep
`siteUrl: ''` in source). Verified by the new **`flows/release-v2-client-rules.mjs`** (also run by `deploy.sh` before
anything is copied) and the full matrix in `devtools/RELEASE_NOTES_V2.md` §6.

**Client rules (mandatory)**
- Never show the old attribution labels (the names are listed in `flows/branding-guard.mjs` only — do not write them
  anywhere under `site/`). `branding-guard.mjs` scans every text file of `site/`; `release-v2-client-rules.mjs` also
  scans the RENDERED text of every page (signed out + Aktif).
- The only developer credit is exactly **"mrezahuzain@2026"**. core.js `renderFooter()` now writes the bottom row as
  `.site-footer__legal` = copyright line + **`.site-footer__credit`** "Dikembangkan oleh
  <span translate="no">mrezahuzain@2026</span>" (main.css: Barlow Condensed 500 .74rem, `--c-gray`, letter-spacing
  .06em — 5.8:1 on the footer black). Every page, 404 at any depth included, gets it from core.js; the two apps
  carry the same sentence in their own footers. Do not add another credit or brand.
- `config.apps[perencanaan].title` = **'PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur'** (and the
  `aplikasi-perencanaan` catalogue item `judul`). The "Brand — Name" split used by dashboard.js / anggota.js makes
  the kicker/eyebrow "PPAPI Scaffold (Beta)". `short` is unchanged. Remove "(Beta)" together with the in-app Beta
  marks once the Komite Teknis has reviewed `aplikasi/KOREKSI-PERHITUNGAN.md`.

**Fixes**
- Placeholders that were cut off (new `flows/placeholder-fit.mjs`, 9 widths × 3 states): pustaka "Saring" becomes a
  48 px icon button below 400 px (`.pk-toolbar__label` visually hidden, name kept) so the search keeps room at 320–
  360 px; umpan-balik email/phone stack between 1024 and 1279 px (a typed "812-3456-7890" was clipped too);
  shorter placeholders for umpan-balik Subjek ("Ringkasan pesan Anda"), berita search ("Cari judul, ringkasan…") and
  anggota LinkedIn ("https://linkedin.com/in/…").
- core.js `avatarHtml()` (header + mobile menu) renders `user.photoURL` only when it is an `https:` URL, otherwise the
  initials — the same rule dashboard.js and anggota.js already applied (`sec-v2-xss` found a `javascript:` value in an
  `<img src>`; not executable, but never written now).
- styleguide.html: the sample external link points to an official regulation page instead of the client's previous app.
- Tests made date-independent where the real clock had moved past the authoring date (pendaftaran-flow D: clock
  frozen at 2026-10-09 10:00 WIB for the "42 hari" renewal prompt).

**Tests repaired at the root** (each edit is commented in the flow)
- `aplikasi-perencanaan-temuan.mjs` F10 and `-koreksi.mjs` K6: the downloaded PDF is parsed in a separate CSP-free page.
  Injected into the app page, pdf.js starts a `blob:` worker that the app's CSP (correctly) refuses → console error of
  the TEST.
- `sec-v2-app-import.mjs`: `addMat` / `autoMaterial` / `confirmMat` (the app's own constant Tahap 5 handlers from the
  v2.4.0 fix round) added to the handler whitelist.
- `verify-eng-simulator.mjs`: hand references re-derived for revision 2 of `aplikasi/KOREKSI-SIMULATOR.md` (end rails
  1.075 / gaps 0.431–0.398, end transoms ±1.86 → overhang 0.09, 7 facade diagonals, ladder ties on the top rail only,
  84 materials); a rail gap counts as closed only when a gate leaf laps both rail ends by ≥ 30 mm; headroom is measured
  over the walkway (edge protection along a deck edge is excluded) = 1.864 m, plus the clear height over the lift-1 gate
  = 1.816 m (≥ 1.75 m H1) → 43/43. KOREKSI-SIMULATOR §6 updated.

**Tests changed intentionally**: beranda-flow, dashboard-flow, anggota-flow and contract-v2 expect the "(Beta)" title.
New: `release-v2-client-rules.mjs`, `placeholder-fit.mjs`, `footer-credit-shot.mjs` (footer close-ups),
`shot-overview.mjs` (one overview sheet per full-page screenshot, for the visual pass).

### 9.17 Integration of Instruktur · Kegiatan · Toko · Data aplikasi (2026-10-21)

Four features were built in parallel without touching shared files; this pass wires them in.

- **Konsol Admin** — `admin.js` mounts every `window.PPAPI_ADMIN_SECTIONS` entry
  `{ key, label, icon, title (trusted HTML, may hold <em>), lead, render(container, sub) → Promise?, badge() → Promise<number> | count() → number, countLabel? }`
  (`mountExtraSections()`, called first in the admin boot): nav item appended (number = position in `K.SECTIONS`),
  section shell `#sec-<key>` / `#h-<key>` / `#<key>-body` like the built-in ones, route `#key` and `#key/sub`, render on
  open, on "Muat Ulang Data" and after `K.after()`; a returned promise that rejects shows `K.errorBox`. Nav counts:
  `K.renderExtraCount(key)` (called from `K.renderCounts()`). Built-in keys cannot be overwritten. Instruktur keeps its
  static markup in admin.html (08) and is only registered; Kegiatan (09) and Toko (10) are mounted. LOG_GROUPS gained
  Instruktur and Kegiatan (`sertifikat.*` → Kegiatan). The mobile tab strip ends with a gutter spacer and re-aligns the
  active tab after web fonts load. Konten › Agenda carries a note "Agenda sederhana (lama)" linking to #kegiatan.
- **Header** — 9 items: … Pengetahuan · **Instruktur** · Keanggotaan · **Toko** (`aktifJuga: keranjang, pesanan`) ·
  Kontak. No dropdown needed: between 1120 and 1279 px the row uses gap 15 px / letter-spacing .11em; measured by
  `flows/nav-fit.mjs` (1120/1180/1280/1440, signed out and in: one row, ≥ 48 px clear after the logo — 125 px signed
  out at 1120). Footer: Organisasi + Direktori Instruktur, Toko PPAPI; Anggota + Verifikasi Sertifikat.
- **Dasbor** — `#kegiatan-saya` (store-kegiatan.js + kegiatan-saya.js) is moved by dashboard.js into the visible
  view (Aktif: before `.dash-body`; status view: before `.dash-help`) and rendered once
  (`PPAPI.kegiatanSaya.render(el, { next, headingId: 'dash-h-kegiatan' })`; new option `headingId`). Published kegiatan
  are merged into the Beranda and Dasbor agenda strips through `PPAPI.kegiatan.asAgendaItems()` (same id → kegiatan
  wins), as agenda.js already did. index.html now loads store-kegiatan.js.
- **CSP** — admin.html + dashboard.html: `https://cdnjs.cloudflare.com` in script-src (jsPDF), `https://docs.google.com`
  in frame-src; admin.html also `https://cdn.jsdelivr.net` (pdf-lib fallback, as pesanan.html).
- **firestore.rules** — the four fragments merged verbatim before the closing deny-all (58 KB; 60 unique functions).
  The fragments in `devtools/rules-fragments/` stay the source of the feature stubs (toko-rules, appdata-firebase-stub,
  kegiatan-flow K10); contract-v2 checks that each is merged verbatim, every new collection precedes the deny-all,
  names are unique, brackets balance and size < 256 KB. **The client must Publish the rules again.**
- **robots** — keranjang/pesanan noindex (listed in robots.txt comments); toko, instruktur, sertifikat indexable.

**Tests changed intentionally**: contract-v2 (nav 9 items, account menus, merged-rules checks), journey-v2 (menus),
kegiatan-flow K10 (fragment merged exactly once instead of "no clash with the main file"), instruktur-flow (serves the
real files; the in-memory admin integration was removed), admin-flow (A4 10 nav links; A62/A67 follow the real
articles — contoh content was removed on 15 Oct; the test server appends one static pengumuman/agenda/pustaka fixture
for the content-CRUD scenario). New: `flows/integrasi-flow.mjs`, `flows/nav-fit.mjs`.
