# PPAPI website — release notes (v1.0, release QA 2026-10-09)

Static site for **Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)**. Plain HTML, CSS and JavaScript, no build
step, deployed from the `site/` folder to GitHub Pages. Member login and storage run on Firebase when it is configured;
until then the site runs in **Mode Demo**, where accounts are kept only in the visitor's browser.
The maintainer guide, in Indonesian, is `site/README.md`.

## 1. Pages

| Page | File | What it is |
| --- | --- | --- |
| Beranda | `index.html` | Photo hero, about PPAPI, figures, six service pillars, member apps, latest news with the next 3 events, key regulations, gallery and a join CTA. |
| Profil | `profil.html` | About, vision and mission, values, history timeline, board of officers (posts only, names pending) and the meaning of the logo. |
| Berita & Kegiatan | `berita.html` (`?id=` = article) | Featured story, secretariat notices, filterable and searchable archive with "load more". Article view has share links, related posts and previous/next. |
| Agenda | `agenda.html` (`?id=` = detail) | Next event with countdown, upcoming and past tabs, filters by type and mode, events grouped by month, detail modal and `.ics` calendar download. |
| Regulasi & Standar | `regulasi.html` | 6 key-regulation cards and a library of 28 verified documents: search, type and status filters, sorting, summaries and links to the official texts. |
| Keanggotaan | `keanggotaan.html` | Benefits, member categories and requirements, 5-step sign-up flow, fees note and numbered FAQ. |
| Verifikasi Anggota | `verifikasi.html` (`?kta=`) | Public lookup by KTA number or name. Shows a limited record, or "Belum tercantum" for a well-formed number that is not yet in the list. |
| Kontak & Umpan Balik | `umpan-balik.html` (`?kategori=`) | Feedback form with 5 categories, anonymous option, rating and validation; secretariat card (fields hidden while empty) and FAQ. |
| Kebijakan Privasi | `kebijakan-privasi.html` | Privacy policy under UU 27/2022 (PDP), 13 sections, sticky table of contents with scroll-spy. |
| Masuk & Daftar | `masuk.html` (`#daftar`, `?next=`) | Email + password, phone OTP and Google sign-in or sign-up. New accounts without a name get a "Lengkapi profil" step with privacy consent. `next` redirects are safe. |
| Dasbor Anggota | `dashboard.html` (login required) | Greeting and KTA, 4 KPIs, upcoming events, news, notices, key regulations, member apps, certificate reminders, profile-completeness nudge and quick actions. |
| Halaman Anggota | `anggota.html` (login required; `#profil` `#kompetensi` `#sertifikat` `#kartu` `#aplikasi`) | Profile form with unsaved-changes guard, competencies and certificates (CRUD), digital KTA with a self-generated QR code and print view, and app links. |
| 404 | `404.html` | Styled "not found" page that also works at nested paths on project sites, user sites and custom domains. |
| Sistem Desain | `styleguide.html` (noindex, not in the menu) | Internal component gallery, light and dark. Safe to delete before launch. |

## 2. Features

- One shared design system (`assets/css/main.css`): monochrome black, graphite and bone palette, Cormorant Garamond titles
  with lining figures, Barlow Condensed labels, Inter body text, scaffold line-art motifs and restrained motion. Motion
  is turned off under `prefers-reduced-motion`.
- Header, mobile menu (focus trap), account menu, modals, tabs, accordions, toasts and the demo ribbon all work with the
  keyboard. Skip link on every page, visible focus rings, AA contrast, including text over hero photos.
- Content comes from editable data files (`assets/data/*.js`) and `assets/js/config.js`. Each one starts with
  instructions in Indonesian. Sample items carry `contoh: true` and show a "Contoh" badge.
- Authentication (`auth.js`): Firebase compat SDK 12.4.0 (email/password, phone OTP with invisible reCAPTCHA, Google
  popup), with automatic fallback to Mode Demo (OTP is always `123456`, simulated Google sign-in). Optional App Check
  (reCAPTCHA v3).
- Storage (`store.js`): member profile, competencies and certificates in Firestore `members/{uid}`; feedback in
  `feedback/{id}`. `firestore.rules` is owner-only with field validation, and staff-managed fields are locked.
- Profile completeness: one definition in `PPAPI.util.profileCompleteness()` (15 items), shared by the dashboard and the
  member page. Each "missing field" link opens `anggota.html?isi=<field>#profil` and focuses that field.
- The KTA QR code points to `verifikasi.html?kta=…`. The encoder is built in (ISO/IEC 18004, level M), so the page loads
  no third-party QR library.
- SEO: page titles and descriptions, Open Graph tags, canonical and `og:url` built from `siteUrl`, `noindex` on member,
  404 and styleguide pages, and `robots.txt`.
- Security: every data and user string is HTML-escaped, `next` redirects are restricted to same-site pages, and every
  `target=_blank` link has `rel=noopener`.

## 3. What the client must fill in before launch

All of the values below are intentionally empty or marked as samples. Nothing was invented.

1. **Secretariat contacts** in `assets/js/config.js` → `contact`: `address`, `city`, `mapsQuery` (turns on the map),
   `phone`, `whatsapp`, `email` and `hours`. Also `social`: `instagram`, `linkedin`, `youtube` and `facebook`.
2. **`siteUrl`** in `config.js`: the final address, e.g. `https://<user>.github.io/<repo>/`. The KTA QR codes, share
   links and canonical tags use it. Add it to the Firebase authorized domains. Optionally set `SITE_ROOT` in `404.html`
   and add a sitemap line to `robots.txt`.
3. **Firebase config** in `config.js` → `firebase` (apiKey, authDomain, projectId, storageBucket, messagingSenderId and
   appId), then follow README §6:
   - turn on the Email, Google and (optionally) Phone sign-in providers;
   - create the Firestore database in `asia-southeast2`;
   - publish `firestore.rules`;
   - optionally set `appCheckSiteKey`.
   Phone OTP requires the Blaze billing plan.
4. **Board of officers** in `assets/data/organisasi.js` → `pengurus`: fill in `nama`, an optional `foto` and set
   `contoh: false`. The positions shown now are only placeholders.
5. **Legal status** in `organisasi.js` → `legalitas`: add the deed of establishment and Kemenkumham numbers, only if
   official. The section stays hidden while the list is empty.
6. **Official wording** in `organisasi.js`: vision, mission, values, meaning of the logo, member categories and fees,
   and the founding history and date. Then set the matching `bagianContoh` flags and item `contoh` flags to `false`.
7. **Real news, notices and events**: `assets/data/berita.js` (10 sample articles and 4 sample notices) and
   `assets/data/agenda.js` (10 sample events). Replace them or delete the samples.
8. **Public verification list** in `assets/data/registry.js`: 6 fictional sample members today. Replace them with real
   limited records (name, KTA, category, main competencies, city, expiry and status), or empty the list.
9. Optional: replace the gallery and hero photos (`assets/img/`, WebP plus a `-sm` variant), and delete
   `styleguide.html`.

## 4. Known limitations

- **Mode Demo is not secure.** Accounts and data live in that browser's `localStorage`. Use it only for demonstration
  until Firebase is configured.
- **No admin panel.** The secretariat verifies members by editing `status` in the Firebase Console. The public
  verification list (`registry.js`) is a static file edited by hand, so a newly registered member shows as
  "Belum tercantum" on Verifikasi until they are added.
- **No certificate file uploads.** Cloud Storage now requires the paid Blaze plan, so certificates are stored as data
  plus an optional document link.
- **Phone OTP** needs the Blaze plan and cannot be tested from `localhost`. Email and Google sign-in work on the free
  Spark plan.
- **Both member-app buttons open the same address** (`https://ppapiid.vercel.app/`), because the PPAPI Scaffold app has
  no direct link to each feature. App accounts are managed by the PPAPI admin, not by this site.
- **Sample dates go stale.** The upcoming/past split and the countdowns use the visitor's clock. The sample events
  (October 2026 to January 2027) will move to "Telah berlangsung" as time passes.
- **The regulation library was verified on 2026-10-08.** Status changes after that date must be maintained by hand.
  PER.01/MEN/1980 has no official online text, so it has no link.
- **External dependencies:**
  - Google Fonts in every mode.
  - The Firebase SDK and reCAPTCHA in Firebase mode, and a Google Maps embed only when `contact.mapsQuery` is set, all disclosed in the privacy policy.
  - No other third-party scripts.
- **404 on a `<user>.github.io` user site** makes one deliberate 404 request while it detects the site root. Setting
  `SITE_ROOT` in `404.html` avoids it.
- **`robots.txt` only works at a domain root.** On a project site (`/<repo>/`) the `noindex` tags still apply. No
  sitemap is shipped yet, because the final domain is not known.
- **axe "target-size" on the logo.** After the page scrolls (e.g. an opened agenda modal or a verification result), axe
  flags the header logo. The header slides out of view on scroll-down and comes back on scroll-up or keyboard focus, so
  this is a false positive. Every other axe rule passes on all pages and states.
- **Older browsers.** Breadcrumb ellipsis uses `:has()`, and one icon-alignment rule uses the `lh` unit with a
  fallback. Older browsers get a slightly simpler layout but stay functional.

## 5. Release QA (2026-10-09)

| Check | Result |
| --- | --- |
| `node --check` on all 22 JS files (`assets/js`, `assets/data`) | 22/22 OK |
| `check.mjs all` (14 pages × desktop + mobile) | 0 issues |
| `check.mjs dashboard anggota --auth` | 0 issues |
| `check.mjs index masuk --motion` | 0 issues |
| contract | 248/248 |
| auth-demo | 53/53 |
| foundation-ui | 30/30 |
| foundation-fixes | 62/62 |
| firebase-smoke | 7/7 |
| firebase-phone | 17/17 |
| journey (S1–S6) | 182/182 |
| beranda-flow | 71/71 |
| berita-agenda-flow | 124/124 |
| dashboard-flow | 153/153 |
| anggota-flow | 82/82 |
| masuk-flow | 131/131 |
| profil-flow | 78/78 |
| regulasi-verifikasi-flow | 138/138 |
| umpan-balik-flow | 132/132 |
| security-lens (XSS via query / stored data, open redirect, rel audit) | 55/55 |
| security-lens-2 | XSS 0, dialogs 0 |
| contoh-audit | 0 missing badges |
| crawl (45 signed-out + 48 signed-in URLs, 468 anchors) | 0 broken refs, 0 missing anchors, 0 bad hrefs, 0 broken images, 0 HTTP ≥ 400, 0 console errors |
| a11y-perf-seo-audit (all pages + auth, desktop + mobile) | axe 0 violations (serious, critical or moderate) |
| a11y-states | only the header-logo target-size false positive (§4) |
| cls-probe (index, agenda, berita, dashboard) | CLS ≤ 0.012 |

Full-page screenshots of every page were reviewed on desktop and mobile (`devtools/shots/*-scrolled-adrel.png`, sliced
in `devtools/shots/ad/`).

### Changes made during release QA

- **Deferred items closed:**
  - `util.profileCompleteness()` is now shared, and `?isi=` focuses the field.
  - The umpan-balik FAQ numerals use `--muted`, share the keanggotaan metrics and are `aria-hidden`.
  - Removed the redundant keanggotaan hero-button override.
  - journey `check404` takes a list of expected failed requests.
  - README §8 now has the `SITE_ROOT` note.
- **Lining numerals everywhere.** Page CSS that set the font with the `font:` shorthand reset `font-variant-numeric`, so
  some serif text still had dipping old-style figures ("2026" in month titles, "K3", regulation and certificate titles).
  Added `lining-nums` after all 55 serif shorthands. A scan now finds no serif digits left without lining figures.
- **Event meta icons** (date, time, place) now line up with the first line when a long place name wraps.
- **Accessibility:**
  - The Kontak secretariat `<aside>` and the privacy-policy TOC `<aside>` were nested inside landmarks
    (`landmark-complementary-is-top-level`). Changed them to a labelled `<section>` and a `<div>`.
  - The styleguide dark twins now get unique landmark and region names.
- **Labels:** the dashboard button now reads "Halaman Anggota", matching the account menu. The nudge count reads
  "x dari 15 isian terisi".
- **Styleguide:** placeholder `href="#"` links now point to real pages, so the crawl reports 0 bad hrefs.
- **Tests updated to match intended changes:**
  - journey uses the account-menu label "Halaman Anggota".
  - dashboard-flow expects the `?isi=` links, adds 2 focus checks and fixes a regex that matched "birtHPlace".
