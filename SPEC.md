# PPAPI Website — Build Specification (single source of truth)

Client: **Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)** — Indonesian scaffolding (perancah) practitioners & experts association.
All UI copy is in **formal, polished Bahasa Indonesia** (EYD). Code comments may be Indonesian or English; comments inside `assets/data/*.js` and `assets/js/config.js` MUST be Indonesian because the client edits those files.

Workspace layout (paths relative to the session working directory):
- `site/` — the website = the git repo root, deployed to **GitHub Pages** as-is (no build step).
- `devtools/` — test tooling (NOT deployed). `node devtools/check.mjs <page...> [--auth] [--mobile|--desktop] [--full] [--motion] [--query=a=b] [--eval="expr"]` serves `site/` over HTTP, loads pages in headless Chromium, prints console errors / page errors / failed requests / horizontal overflow, and saves screenshots to `devtools/shots/`. Read the PNGs to visually verify. `--auth` seeds a demo signed-in session + member record (see the script for the exact objects). For interactive flows (form submit, tabs, modals) write a throwaway Playwright script in `devtools/flows/` (import `{ chromium } from 'playwright'`; serve via the same approach as check.mjs or reuse its server code).
- `SPEC.md` — this file.

Already present: `site/assets/img/` → `logo-color.png` (original yellow/dark logo, transparent bg, 1200w), `logo-light.png` (white letters + silver ellipse — for DARK backgrounds), `logo-mono-dark.png` (dark letters + gray ellipse — for LIGHT backgrounds), `og-image.jpg` (1200×630), photos (each also has a `-sm.webp` ≤720px variant): `tower-heritage.webp` (1125×1500 portrait, old tower wrapped in scaffolding, workers in orange), `stage-silhouette.webp` (1334×2000 portrait, B&W, workers silhouetted on a huge stage scaffold), `facade-bw.webp` (1201×2000 portrait, B&W tube-and-coupler scaffold on building facade, dark sky), `stair-tower.webp` (2000×1333 landscape, galvanized stair tower, blue sky), `ringlock-pattern.webp` (1000×1500 portrait, abstract ringlock system scaffold pattern, blue-ish). Logo aspect ratio ≈ 2.87:1.

Existing app by the client: **https://ppapiid.vercel.app/** — scaffolding simulator & structural analysis. Members reach it from the member page/dashboard.

---

## 1. Concept & visual language — "classy, elegant, gagah, berkarakter"

Monochrome only: black, graphite, steel grays, silver, bone, white. **No accent hue** except: (a) the original color logo shown once in the "Makna Logo" section of `profil.html`, (b) tiny desaturated status tints (ok/warn/err), (c) the official multicolor Google "G" mark on the Google sign-in button.

Mood: architectural, engineered, premium — like a high-end engineering firm or a luxury watch brand. Large serif display type, tight condensed uppercase labels with wide tracking, hairline 1px rules that evoke scaffold tubes, coupler "nodes" (small squares/circles at line intersections), generous whitespace, grayscale photography with slow motion, dark hero sections alternating with paper-white content sections.

Signature motifs (use consistently, don't overdo):
1. **Scaffold grid lines** — an SVG of verticals (standards), horizontals (ledgers) and diagonal braces that *draws itself* (stroke-dashoffset) in hero sections, low opacity (0.08–0.18) silver strokes.
2. **Coupler nodes** — `.divider` hairline with a small square node; eyebrow labels preceded by a 40px hairline.
3. **Index numerals** — section/feature numbering in condensed type ("01 / 06").
4. **Metal sheen** — `--metal` gradient used sparingly on the member card (KTA) and on a few thin accent rules.

### 1.1 Design tokens (define in `:root` in `assets/css/main.css`; page CSS must use tokens, never new hex values except rgba of existing tokens)

```
--c-black:#0a0a0b; --c-ink:#111113; --c-graphite:#1a1a1d; --c-steel:#26262a; --c-iron:#3a3a3f;
--c-slate:#5c5c63; --c-gray:#8b8b92; --c-silver:#b9b9bf; --c-mist:#dcdcdf; --c-bone:#ececea;
--c-paper:#f6f6f4; --c-white:#ffffff;
--c-ok:#7f9a86; --c-warn:#b39b67; --c-err:#b0706a;        /* desaturated, used only for status */
--metal: linear-gradient(135deg,#f4f4f5 0%,#c4c4c9 30%,#8e8e94 52%,#dadade 72%,#9a9aa0 100%);
--f-display:"Cormorant Garamond", Georgia, "Times New Roman", serif;
--f-cond:"Barlow Condensed", "Arial Narrow", Arial, sans-serif;
--f-body:"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--radius-sm:2px; --radius:4px; --radius-lg:10px;          /* mostly sharp — engineered feel */
--shadow-1:0 1px 2px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.06);
--shadow-2:0 2px 6px rgba(0,0,0,.12),0 24px 60px rgba(0,0,0,.18);
--ease:cubic-bezier(.2,.7,.1,1); --ease-in-out:cubic-bezier(.65,0,.35,1);
--dur:.6s; --header-h:76px; --container:1240px; --gutter:clamp(16px,4vw,40px);
```
Semantic tokens switch per context: light sections (`--bg:var(--c-paper); --surface:var(--c-white); --text:var(--c-ink); --muted:var(--c-slate); --line:rgba(17,17,19,.12)`) and `.theme-dark` sections (`--bg:var(--c-black); --surface:var(--c-graphite); --text:var(--c-bone); --muted:var(--c-gray); --line:rgba(255,255,255,.12)`). Components consume semantic tokens so they work in both.

Google Fonts (single link on every page):
`https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@300;400;500;600;700&display=swap`

Type scale: display `clamp(2.6rem,6.2vw,5.6rem)`/1.02, serif 600, letter-spacing -.01em; h2 `clamp(2rem,4vw,3.4rem)`/1.08 serif; h3 1.5rem serif 600; h4 condensed 600 uppercase .95rem tracking .14em; body 1rem/1.7 Inter 400; lead 1.15–1.3rem/1.6 Inter 300; eyebrow condensed 600 .78rem tracking .28em uppercase with leading hairline; numerals (stats, dates) condensed 500–600. Italic serif (`<em>` inside display headings) used for elegant emphasis words, e.g. "Membangun *standar*, menjaga *keselamatan*."

### 1.2 Motion (tasteful, "secukupnya")
- Page enter: `body` fades in (.5s). Header slides down subtly.
- Scroll reveal: elements with `data-reveal` (`up` default | `fade` | `left` | `right` | `scale`) get `.is-visible` via IntersectionObserver (threshold .15, once). Optional `data-reveal-delay="120"` (ms). Containers with `data-reveal-stagger` stagger children by 80ms.
- Hero: Ken Burns (scale 1.08→1 over 14s ease-out) on grayscale photo; headline lines rise from a mask (`.split-lines` → each line wrapped `span.line > span`) with 90ms stagger; scaffold SVG draws over 2.4s.
- Counters: `[data-count="1250"]` (+ optional `data-count-suffix="+"`) animate from 0 when visible (1.6s easeOutCubic), format `id-ID`.
- Hover: cards lift 4px + border brighten; photos `.img-mono` (grayscale(1) contrast(1.05)) → grayscale(.2) + scale 1.04 over .8s; buttons: arrow icon slides 4px; nav links underline grows from left.
- Header: transparent over dark hero; after 40px scroll → solid `rgba(10,10,11,.86)` + `backdrop-filter: blur(14px)` + bottom hairline; hides on scroll-down past 400px, reappears on scroll-up.
- Marquee: slow infinite horizontal ticker of condensed uppercase words separated by "◆"/"—" (homepage).
- **`prefers-reduced-motion: reduce`** → no transforms/animations; reveals visible immediately; counters show final value. (The checker runs with reduced motion by default — pages must look complete in that mode.)
- Never animate layout-heavy properties in loops; only transform/opacity/stroke-dashoffset.

### 1.3 Layout & responsiveness
Mobile-first. Breakpoints: 480, 768, 1024, 1280. Container `max-width:var(--container)` + `padding-inline:var(--gutter)`. No horizontal overflow at 390px. Touch targets ≥44px. Header height 76px (64px mobile); content under fixed header must not be hidden (heroes include top padding).

### 1.4 Accessibility & quality
Semantic landmarks, one `h1` per page, logical heading order, `alt` text, `aria-*` for tabs/menus/modals/accordions, visible `:focus-visible` (2px outline, offset 3px, color contrasting with context), skip link, AA contrast, forms with `<label>`, inline error text with `aria-describedby`, `aria-live="polite"` toast region, Esc closes modal/menu, focus trap in modal & mobile menu, `lang="id"`. Images: `width`/`height` attributes, `loading="lazy"` (except hero), `decoding="async"`, use `-sm.webp` via `srcset` where appropriate. **Escape all user/data strings** inserted with innerHTML via `PPAPI.util.h()`.

---

## 2. Architecture (static site, no build step, classic scripts — works on GitHub Pages and even via file://)

```
site/
  index.html            Beranda (public landing)
  masuk.html            Masuk & Daftar — email / nomor HP (OTP) / Google      data-auth="guest"
  dashboard.html        Dasbor anggota                                          data-auth="required"
  anggota.html          Halaman Anggota: profil, kompetensi, sertifikat, KTA digital, aplikasi   data-auth="required"
  profil.html           Profil Asosiasi
  umpan-balik.html      Umpan Balik (kritik & saran) + info Sekretariat + FAQ
  berita.html           Berita & Kegiatan (list; detail via ?id=<id>)
  agenda.html           Agenda Kegiatan (pelatihan, sertifikasi, seminar …)
  regulasi.html         Pustaka Regulasi & Standar (search/filter)
  keanggotaan.html      Keanggotaan: kategori, manfaat, syarat, alur pendaftaran
  verifikasi.html       Verifikasi Anggota/KTA (public lookup; ?kta=<no>)
  kebijakan-privasi.html Kebijakan Privasi (UU 27/2022 PDP)
  styleguide.html       Internal component gallery (noindex; not in nav)
  404.html              Not found (GitHub Pages uses it automatically)
  .nojekyll
  README.md             Indonesian maintenance guide
  firestore.rules       Firestore security rules
  assets/
    css/main.css        tokens, reset, base, layout, ALL shared components, header/footer, utilities, animations, print
    css/pages/<key>.css page-specific styles (owned by the page author)
    js/config.js        window.PPAPI_CONFIG (editable by client)
    js/core.js          PPAPI namespace: util, icon, ui, layout (header/footer/nav), motion, onReady
    js/auth.js          PPAPI.auth — Firebase (compat SDK, loaded on demand) or Demo mode
    js/store.js         PPAPI.store — Firestore or localStorage
    js/pages/<key>.js   page-specific logic (owned by the page author)
    data/berita.js data/agenda.js data/regulasi.js data/organisasi.js data/kompetensi.js data/registry.js
    img/…  (favicon.svg created by foundation)
```

### 2.1 Page skeleton (every page uses exactly this head/body scaffolding)
```html
<!doctype html>
<html lang="id" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{Judul} — PPAPI</title>
  <meta name="description" content="{deskripsi 140–160 karakter}">
  <meta name="theme-color" content="#0a0a0b">
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{Judul} — PPAPI">
  <meta property="og:description" content="{deskripsi}">
  <meta property="og:image" content="assets/img/og-image.jpg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{GOOGLE FONTS URL}">
  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/pages/{key}.css">   <!-- only if it exists -->
  <script>document.documentElement.classList.replace('no-js','js')</script>
</head>
<body data-page="{key}" data-auth="public|guest|required">
  <a class="skip-link" href="#main">Lewati ke konten utama</a>
  <div id="site-header"></div>
  <main id="main" tabindex="-1"> … </main>
  <div id="site-footer"></div>
  <script src="assets/js/config.js" defer></script>
  <script src="assets/data/{needed}.js" defer></script>          <!-- only the data files this page uses -->
  <script src="assets/js/core.js" defer></script>
  <script src="assets/js/auth.js" defer></script>
  <script src="assets/js/store.js" defer></script>
  <script src="assets/js/pages/{key}.js" defer></script>         <!-- if needed -->
</body>
</html>
```
`data-page` keys: `beranda` (index.html), `masuk`, `dashboard`, `anggota`, `profil`, `umpan-balik`, `berita`, `agenda`, `regulasi`, `keanggotaan`, `verifikasi`, `kebijakan-privasi`, `styleguide`, `404`. CSS/JS page files are named by the HTML file name: `pages/index.css|js` for the homepage, `pages/masuk.css`, etc.
- `data-auth="required"`: core hides `<main>` (class `auth-pending` on body shows a centered loader) until `PPAPI.auth.ready()` resolves; if no user → `location.replace('masuk.html?next=' + encodeURIComponent(current file + search))`.
- `data-auth="guest"` (masuk): if a user is signed in → redirect to `next` param or `dashboard.html`.
- Header always has dark styling (every page begins with a dark hero/band). `<body data-header="solid">` forces the solid state from the top (used by masuk/dashboard/anggota if they lack a full-bleed hero).

### 2.2 Global JS API (implemented in core/auth/store by the foundation; page authors only CONSUME it; never edit shared files from a page task)

`window.PPAPI` (created by core.js):
- `PPAPI.config` = `window.PPAPI_CONFIG`; `PPAPI.data` = `window.PPAPI_DATA || {}`.
- `PPAPI.onReady(fn)` — runs `fn()` after DOM ready + header/footer injected + `PPAPI.auth.ready()` resolved (fn may be async; errors are caught and logged + toast). Page scripts wrap everything in this.
- `PPAPI.util`: `$(sel, root)`, `$$(sel, root)` (array), `h(str)` escape HTML, `formatDate(iso, {weekday?, short?})` → "7 Oktober 2026" (Intl id-ID; short → "7 Okt 2026"), `formatDateRange(startIso, endIso)` → "21–23 Oktober 2026", `relativeTime(iso)` → "3 hari lalu", `daysUntil(iso)` (int, negative if past), `todayIso()`, `qs(name)` query param, `debounce(fn, ms)`, `slugify(s)`, `initials(name)` (max 2), `greeting()` → "Selamat pagi/siang/sore/malam" (05–11/11–15/15–18/18–05), `normalizePhoneID(s)` → E.164 "+62…" or null (accepts 08…, 628…, +628…, spaces/dashes), `formatPhoneID(e164)` → "+62 812-3456-7890", `isEmail(s)`, `uid(prefix)`, `storage.get(key, fallback)` / `storage.set(key, val)` / `storage.remove(key)` (JSON, try/catch), `ktaFromUid(uid, year)` → "PPAPI-YYYY-NNNNNN" deterministic, `certStatus(expiresIso)` → `{key:'aktif'|'segera'|'kedaluwarsa'|'tanpa-batas', label, days}` (segera = ≤90 days), `contohBadge(item)` → `'<span class="badge badge--contoh">Contoh</span>'` when `item && item.contoh`, else ''.
- `PPAPI.icon(name, {size=20, cls='', label})` → inline SVG string (stroke `currentColor`, 1.5 width, 24 viewBox; `aria-hidden` unless label). Names: `arrow-right arrow-up-right arrow-left external menu close user users user-plus mail phone lock eye eye-off calendar clock map-pin file-text download search filter check check-circle alert-triangle info shield shield-check award certificate hard-hat layers settings logout edit plus trash upload link chevron-down chevron-right chevron-left chevron-up building book scale message send star star-filled grid compass wrench ruler activity bell bookmark briefcase globe home id-card qr-code printer share copy refresh instagram linkedin youtube facebook whatsapp google` (`google` = official 4-color G, the only colored icon).
- `PPAPI.ui`:
  - `toast(message, {type:'info'|'success'|'error'|'warn', timeout=4200})`
  - `modal({title, body /*html string or Node*/, actions:[{label, variant:'primary'|'ghost'|'danger', onClick(close) /*return false to keep open*/}], size:'sm'|'md'|'lg', onOpen(el), onClose()})` → `{el, close}`; focus trap, Esc, backdrop click closes.
  - `confirm(message, {title='Konfirmasi', okLabel='Ya, lanjutkan', cancelLabel='Batal', danger=false})` → Promise<boolean>.
  - `setLoading(button, isLoading, loadingLabel='Memproses…')` — disables + spinner, restores label.
  - `reveal(root=document)` — register new `[data-reveal]` / `[data-count]` / `.scaffold-draw` / `.split-lines` elements after dynamic rendering. **Call after every dynamic render.**
  - `tabs(rootEl)` — ARIA tabs for markup `.tabs > .tabs__list[role=tablist] > button.tabs__tab[role=tab][aria-controls]` + `.tabs__panel[role=tabpanel]`; arrow-key nav; supports `data-tab-hash` to sync with location.hash. Auto-initialised for `[data-tabs]` on load; returns `{select(id)}`.
  - `accordion(rootEl)` — `.accordion > .accordion__item > button.accordion__trigger + .accordion__panel`; auto-init `[data-accordion]`.
  - `emptyState({icon, title, text, actionHtml})` → html string.
  - `skeleton(lines=3)` → html string.
  - `scaffoldSVG({cols=6, rows=4, braces=true, cls=''})` → html string of the self-drawing scaffold grid SVG (class `scaffold-draw`), absolutely positionable.
- Layout (internal to core): injects header & footer from `PPAPI_CONFIG.nav`; marks active link via `data-page`; mobile menu (full-screen dark overlay, large serif links staggered in, focus trap); account area: signed out → `Masuk` (ghost) + `Daftar` (solid, → `masuk.html#daftar`); signed in → avatar (initials) button with dropdown: name/email header, Dasbor, Profil Anggota, Simulator ↗ (config.simulatorUrl, new tab), Keluar. Re-renders on `PPAPI.auth.onChange`.
- Demo-mode ribbon: when `PPAPI.auth.mode === 'demo'`, pages with `data-auth` = guest/required show a slim dismissible bar under the header: "Mode Demo — akun & data tersimpan hanya di peramban ini. Hubungkan Firebase (lihat README) untuk mengaktifkan login sebenarnya." Dismissal remembered in localStorage.

`PPAPI.auth` (auth.js):
- `mode` — `'firebase'` when `PPAPI_CONFIG.firebase.apiKey` is non-empty, else `'demo'`.
- `ready()` → Promise<User|null> (resolves once initial state known; in firebase mode loads compat SDK v`PPAPI_CONFIG.firebaseSdkVersion` from `https://www.gstatic.com/firebasejs/{v}/firebase-{app,auth,firestore}-compat.js` sequentially, then `onAuthStateChanged`).
- `current()` → User|null. User shape: `{uid, name, email, phone, photoURL, provider:'password'|'phone'|'google', createdAt}`.
- `onChange(cb)` → unsubscribe fn.
- `signUpEmail({name, email, password})`, `signInEmail({email, password, remember})`, `resetPassword(email)`, `signInGoogle()`, `startPhone({phone /*any ID format*/, buttonEl /*for invisible reCAPTCHA*/})` → sends OTP, `confirmPhone({code, name /*optional, for new users*/})`, `signOut()`, `updateName(name)`. All return Promises; errors are thrown as `Error` with Indonesian `.message` (mapped from Firebase codes: email-already-in-use, invalid-email, weak-password, invalid-credential/wrong-password/user-not-found, too-many-requests, network-request-failed, popup-closed-by-user, popup-blocked, invalid-phone-number, invalid-verification-code, code-expired, missing-phone-number, quota-exceeded, operation-not-allowed (provider not enabled), unauthorized-domain) and `.code`.
- Demo mode: users in localStorage `ppapi_demo_users` (keyed by email or phone), session in `ppapi_demo_session` (User JSON). Passwords stored as SHA-256 hex (`crypto.subtle` when available, else a simple fallback hash). Phone OTP is always **123456** and a toast tells the user ("Mode demo: kode OTP Anda 123456"). `signInGoogle()` in demo opens a `PPAPI.ui.modal` "Simulasi Masuk dengan Google" asking name + Gmail address, explaining that production opens Google's window. `remember=false` → session in sessionStorage instead.
- After successful sign-up/sign-in: ensure a member record exists via `PPAPI.store.ensureMember(user)`.

`PPAPI.store` (store.js):
- `getMember(uid)` → Member|null; `saveMember(uid, patch)` → merged Member (sets `updatedAt`); `ensureMember(user)` → creates default record if missing (kta via `util.ktaFromUid`, `memberType:'Praktisi'`, `status:'Menunggu Verifikasi'`, `joinedAt: todayIso()`), returns Member.
- `submitFeedback(data)` → `{id}`. Firebase: collection `feedback` (`createdAt` serverTimestamp). Demo: localStorage `ppapi_feedback` array.
- Firebase: Firestore `members/{uid}`; demo: localStorage `ppapi_member_{uid}`.
- Member shape:
```js
{ uid, name, email, phone, photoURL,
  kta, memberType /* 'Praktisi'|'Ahli'|'Mitra Korporat'|'Kehormatan' */, status /* 'Aktif'|'Menunggu Verifikasi'|'Nonaktif' */, joinedAt,
  profile: { birthPlace, birthDate, gender, city, province, address, company, position, experienceYears, education, bio, linkedin },
  competencies: [{ id, code, name, level /* 'Dasar'|'Menengah'|'Mahir'|'Ahli' */, since /* year */, notes }],
  certificates: [{ id, title, number, issuer, issuedAt, expiresAt /* '' = tanpa batas */, link }],
  updatedAt }
```

### 2.3 Config (`assets/js/config.js`, Indonesian comments)
```js
window.PPAPI_CONFIG = {
  shortName:'PPAPI', fullName:'Perkumpulan Praktisi dan Ahli Perancah Indonesia',
  tagline:'…', description:'…',
  simulatorUrl:'https://ppapiid.vercel.app/',
  apps:[ {key:'simulator', title:'Simulator Perancah', desc:'…', url:'https://ppapiid.vercel.app/'}, {key:'analisis', title:'Analisis Struktur Perancah', desc:'…', url:'https://ppapiid.vercel.app/…'} ],
  firebaseSdkVersion:'12.4.0',
  firebase:{ apiKey:'', authDomain:'', projectId:'', storageBucket:'', messagingSenderId:'', appId:'' },  // kosong = Mode Demo
  contact:{ address:'', city:'', mapsQuery:'', phone:'', whatsapp:'', email:'', hours:[{hari:'Senin – Jumat', jam:'08.00 – 16.00 WIB'}] },
  social:{ instagram:'', linkedin:'', youtube:'', facebook:'' },   // empty → icon hidden
  nav:[ {key:'beranda',label:'Beranda',href:'index.html'}, {key:'profil',label:'Profil',href:'profil.html'}, {key:'berita',label:'Berita',href:'berita.html'}, {key:'agenda',label:'Agenda',href:'agenda.html'}, {key:'regulasi',label:'Regulasi',href:'regulasi.html'}, {key:'keanggotaan',label:'Keanggotaan',href:'keanggotaan.html'}, {key:'umpan-balik',label:'Kontak',href:'umpan-balik.html'} ],
  footerLinks:{ … },
}
```
Contact values must be REAL only if found by research with a source; otherwise leave empty strings and UI shows a tasteful fallback (e.g. "Alamat sekretariat akan segera diperbarui") — never invent addresses, phone numbers, emails, names of officials, founding dates or legal numbers.

### 2.4 Content data (`assets/data/*.js`) — pattern: `window.PPAPI_DATA = window.PPAPI_DATA || {}; PPAPI_DATA.x = [...]`
Every illustrative/sample item carries `contoh: true`, and the UI renders `PPAPI.util.contohBadge(item)` next to its title/date so visitors know it's placeholder content. Factual items (verified regulations) have no `contoh` flag. File headers explain in Indonesian how to add/edit/remove items and what `contoh` means.
- `berita.js` → `PPAPI_DATA.berita = [{ id /*slug*/, judul, kategori /* 'Kegiatan'|'Pengumuman'|'Edukasi'|'Regulasi'|'Organisasi' */, tanggal /*YYYY-MM-DD*/, ringkasan, isi /* array of paragraphs; a string starting with '## ' = subheading; '- ' = bullet */, gambar /* assets/img/… */, penulis, sorot /*featured bool*/, contoh }]` (8–10 items, dates spread Mar–Oct 2026, newest first) and `PPAPI_DATA.pengumuman = [{ id, judul, isi, tanggal, penting, contoh }]` (3–4).
- `agenda.js` → `PPAPI_DATA.agenda = [{ id, judul, jenis /* 'Pelatihan'|'Sertifikasi'|'Seminar'|'Webinar'|'Rapat'|'Kunjungan Teknis' */, mulai, selesai, waktu /* '08.00 – 16.00 WIB' */, lokasi, mode /* 'Luring'|'Daring'|'Hybrid' */, kuota, deskripsi, tautanDaftar /* '' → hubungi sekretariat */, contoh }]` (8–10 items; ~6 upcoming between 2026-10-09 and 2027-01-31, ~4 past). Today is **2026-10-08**.
- `regulasi.js` → `PPAPI_DATA.regulasi = [{ id, jenis /* 'Undang-Undang'|'Peraturan Pemerintah'|'Peraturan Menteri'|'Keputusan Menteri'|'Surat Edaran'|'SNI'|'Standar Internasional' */, nomor, tahun, judul, singkatan /* 'UU 1/1970' */, instansi, status /* 'Berlaku'|'Berlaku (diubah)'|'Dicabut' */, relevansi /* 1–2 sentences: why it matters for scaffolding */, tautan /* verified official URL or '' */, kunci /* bool: core list shown on dashboard */ }]` — ONLY research-verified items.
- `organisasi.js` → `PPAPI_DATA.organisasi = { tentang:[…], visi, misi:[…], nilai:[{judul,teks,ikon}], layanan:[{ikon,judul,teks}], sejarah:[{tahun,judul,teks,contoh}], pengurus:[{nama,jabatan,foto,contoh}], legalitas:[{label,nilai}] /* empty unless verified */, maknaLogo:[{judul,teks}], stats:[{angka,akhiran,label,contoh}], faq:[{q,a}], keanggotaan:{ kategori:[{nama,ringkas,syarat:[…],manfaat:[…]}], manfaatUmum:[…], langkah:[{judul,teks}], biaya } }` — use verified facts where research found them; otherwise neutral, non-specific copy and `contoh:true` placeholders (e.g. pengurus names "Nama Pengurus" with real role titles).
- `kompetensi.js` → `PPAPI_DATA.kompetensi = { katalog:[{kode,nama,kelompok,deskripsi}], level:['Dasar','Menengah','Mahir','Ahli'], penerbit:['BNSP / LSP','Kemnaker RI','LPJK / Kementerian PU','Lembaga Internasional (CISRS, dll.)','Lainnya'] }` — catalog of scaffolding-related competencies/qualifications (research-informed).
- `registry.js` → `PPAPI_DATA.registry = [{ kta, nama, kategori, kompetensi:[…], kota, berlakuHingga, status, contoh:true }]` (5–6 clearly sample entries) — public verification list maintained by the secretariat.

### 2.5 Shared CSS components (class names are the contract; foundation implements all, page authors reuse)
Layout: `.container`, `.container--narrow` (820px), `.section` (padding-block clamp(72px,10vw,140px)), `.section--tight`, `.section--dark` (= `.theme-dark` + bg), `.section--bone`, `.grid` + `.grid--2|3|4` (responsive auto-collapse), `.stack` (+ `--sm|--lg`), `.cluster` (flex wrap gap), `.split` (2-col 1fr/1fr → 1 col <1024), `.sr-only`, `.skip-link`.
Type: `.eyebrow`, `.display`, `.h1 .h2 .h3 .h4`, `.lead`, `.muted`, `.serif`, `.cond`, `.prose` (long-form article typography), `.index-num` ("01").
Hero: `.page-hero` (dark inner-page hero: grayscale bg photo via `--hero-img` CSS var with dark gradient overlay, scaffold SVG slot, eyebrow, h1, lead, `.breadcrumb`; min-height ~56vh desktop), `.page-hero--compact` (dashboard/anggota band ~ 260px), `.hero-media` (Ken Burns img wrapper).
Controls: `.btn` + `.btn--primary` (light on dark / dark on light automatically via tokens), `.btn--ghost` (1px line), `.btn--link` (text + arrow), `.btn--sm|--lg|--block`, `.btn--danger`, `.icon-btn`; button content pattern `<span>Label</span>{icon arrow-right}` with `.btn__icon`.
Cards: `.card` (surface, 1px line, radius-sm, padding 28px), `.card--hover`, `.card--dark`, `.card__media` (img-mono), `.card__meta`, `.card__title`, `.card__body`, `.card__footer`; `.feature` (numbered feature block with index numeral + icon), `.stat` (`.stat__num` condensed huge + `.stat__label`), `.news-card`, `.event-row` (date block `.date-block` with day numeral + month), `.list-rule` (hairline-separated list), `.kv` (definition list key/value rows), `.timeline`, `.person` (initials avatar circle + name + role).
Feedback: `.badge` + `--ok|--warn|--err|--muted|--outline|--contoh`, `.tag`, `.alert` + `--info|--ok|--warn|--err`, `.toast-region`, `.modal`, `.spinner`, `.skeleton`, `.empty-state`, `.progress` (thin bar, `--value` var).
Forms: `.form`, `.field`, `.field__label`, `.field__control` (input/select/textarea), `.field__hint`, `.field__error` (shown when `.field.is-invalid`), `.input-icon` (icon inside input), `.input-group` (prefix "+62"), `.check` (custom checkbox/radio), `.otp` (6 boxes), `.password-toggle`, `.strength` meter, `.rating` (stars radio), `.segmented` (pill segmented control for method switching), `.search-box`, `.filter-chips` (`.chip[aria-pressed]`).
Navigation: `.tabs` family, `.accordion` family, `.breadcrumb`, `.pagination`.
Decor: `.divider` (hairline with coupler node), `.scaffold-draw`, `.img-mono`, `.marquee`, `.grain` (subtle noise overlay via CSS gradient — no external file), `.metal-text` (background-clip text with --metal).
Utilities: spacing `mt-0..mt-6`, `mb-*`, `text-center`, `w-100`, `hide-mobile`, `show-mobile`, `visually-hidden`.

### 2.6 Firebase specifics
Compat SDK v12.4.0 (verified reachable). Email/Password, Phone (invisible reCAPTCHA via `new firebase.auth.RecaptchaVerifier(buttonEl, {size:'invisible'})`), Google (`signInWithPopup(new firebase.auth.GoogleAuthProvider())`). Firestore for members & feedback. No Firebase Storage (needs Blaze) — certificates store metadata + optional external link. README documents: create project, enable providers, add `<user>.github.io` to Authorized domains, create Firestore, publish `firestore.rules`, paste config, phone-auth billing/quotas & test numbers.
`firestore.rules`: `members/{uid}` read/write only when `request.auth.uid == uid` (validate types/sizes loosely); `feedback/{id}` create allowed for anyone with field validation (message 10–4000 chars, category in allowed list), no read/update/delete from clients.

---

## 3. Page briefs (summary — each page task gets its detailed brief)
- **index.html** Beranda: full-viewport dark hero (grayscale `stage-silhouette` Ken Burns + scaffold draw + split-line serif headline + 2 CTAs + scroll cue) → marquee of values → "Tentang" intro split with photo + counters → 6 layanan/pilar features (numbered) → dark feature band for the simulator & structural analysis apps (ringlock-pattern image, CTA: if signed in → app url new tab, else → masuk.html?next=anggota.html%23aplikasi) → latest 3 news + next 3 agenda → regulation highlight strip (3–4 key regs, link to regulasi) → photo mosaic (tower-heritage, facade-bw, stair-tower) → CTA band "Bergabung" → footer.
- **masuk.html**: split screen; left dark visual panel (stair-tower grayscale, logo-light, quote, scaffold draw; hidden on mobile → compact top band); right form panel on paper. Tabs **Masuk | Daftar** (hash `#daftar` opens Daftar). `.segmented` method switch **Email | Nomor HP**. Email sign-in (+ "Ingat saya", "Lupa kata sandi?" modal). Email sign-up (nama lengkap, email, kata sandi + strength meter + toggle, konfirmasi, setuju Kebijakan Privasi). Phone flow (nama for Daftar, nomor with +62 prefix → Kirim OTP → 6-box OTP with resend countdown 60s → Verifikasi). Divider "atau" + "Lanjutkan dengan Google" button. Inline validation, loading states, Indonesian errors, success → redirect to `next` or dashboard.
- **dashboard.html**: compact dark band with greeting + name + KTA + status badge + today's date; KPI row (status keanggotaan, sertifikat aktif, segera kedaluwarsa, kelengkapan profil % with progress); quick actions; "Update Kegiatan" (upcoming agenda), "Berita Terbaru", "Peraturan Perundangan" (kunci regs), "Pengumuman", app launch cards (simulator & analisis), certificate expiry reminders, profile completeness nudge.
- **anggota.html**: profile header (avatar initials, name, KTA, memberType, status, joined); tabs **Profil Diri | Kompetensi | Sertifikat | Kartu Anggota | Aplikasi** (hash-synced, `#aplikasi` etc.). Editable profile form; competencies CRUD (from katalog + level + year); certificates CRUD with status badges & expiry; KTA digital: premium black metal card (front/back flip, logo-light, name, KTA, kategori, berlaku hingga, QR → `verifikasi.html?kta=`; print button); Aplikasi: two large cards → simulator & structural analysis (new tab).
- **profil.html**: hero; Tentang; Visi & Misi; Nilai; Sejarah timeline; Struktur Organisasi (pengurus grid); Makna Logo (color logo); Legalitas (if any); CTA.
- **keanggotaan.html**: hero; kategori cards; manfaat; syarat; alur 5 langkah (timeline); biaya; FAQ; CTA daftar; link verifikasi.
- **umpan-balik.html**: hero; feedback form (kategori segmented: Kritik, Saran, Pertanyaan, Pengaduan, Apresiasi; nama, email, HP opsional, subjek, pesan with counter, rating, kirim anonim) → store.submitFeedback → success state; Sekretariat card (alamat, telepon, WhatsApp, email, jam layanan, map embed if mapsQuery else stylized placeholder); FAQ accordion.
- **berita.html**: hero; featured story; filter chips by kategori + search; grid; detail view when `?id=` (article layout with prose, meta, share/copy link, related). **agenda.html**: hero; upcoming/past toggle; filter by jenis; month-grouped event rows with date blocks; detail modal; add-to-calendar (.ics download) button.
- **regulasi.html**: hero; search + filter chips (jenis) + sort (tahun); responsive table/list with status badges, relevansi, source link; "Regulasi Kunci" highlight. **verifikasi.html**: hero; lookup form (KTA/nama); result card (valid/not found); reads `?kta=`; sample-data notice.
- **kebijakan-privasi.html**: long-form prose policy aligned with UU No. 27 Tahun 2022 (PDP). **404.html**: dark full-screen with scaffold motif, "Halaman tidak ditemukan", links home.

## 4. Definition of done (every task)
1. `node --check` passes on every JS file you wrote.
2. `node devtools/check.mjs <your pages>` (and `--auth` for auth pages) → **0 issues** on desktop and mobile; screenshots reviewed (Read the PNGs, both viewports; use `--full` for full-page review) and the design looks premium, aligned, uncluttered, consistent with the styleguide.
3. Interactive behaviour exercised with a Playwright flow script where relevant.
4. No invented facts (addresses, phones, names, legal numbers, founding dates). Sample content flagged `contoh:true`.
5. You only edited files you own.
