# PPAPI website — release notes v2.0 (release QA 2026-10-09, final pass 2026-10-10)

Static site for **Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)**: plain HTML, CSS and JavaScript, no build
step, published from `site/` to GitHub Pages. Login and data run on Firebase (Auth + Firestore, compat SDK 12.4.0) once
`assets/js/config.js` holds a Firebase config; until then the site runs in **Mode Demo** (accounts and data only in the
visitor's browser). v2 adds the real membership application flow, the secretariat console, the knowledge-product
catalogue and the two member apps (Beta), and locks every member feature to members whose status is **Aktif**.

**Live address:** <https://anakabil.github.io/ppapi-website/> (public repository `anakabil/ppapi-website`, GitHub Pages,
branch `main`, root). It is published by `devtools/deploy.sh` from `site/`: the script runs the branding guard and the
client-rules check, copies `site/` into the public copy (`deploy-repo/`, separate history), fills `siteUrl` in the PUBLIC
copy only (the source keeps `siteUrl: ''`), runs `check.mjs` on the copy and pushes. **The live copy is older than this
release**: it was last published on 9 October 2026, 20:18 WIB (public commit `39ce0e9`), before the v2 fix round, the
release QA and this final pass. Publish with `bash devtools/deploy.sh "Rilis v2"` once the client has reviewed it.

The maintainer guide (Indonesian) is `site/README.md`; developer notes are `devtools/FOUNDATION_NOTES.md` (§9 = v2,
§9.15 = release QA, §9.16 = final pass). v1 notes: `devtools/RELEASE_NOTES.md`.

## 1. Pages

| Page | File | Access | What it is |
| --- | --- | --- | --- |
| Beranda | `index.html` | public | Hero, about, figures, service pillars (04 = Aplikasi Anggota), Produk Pengetahuan highlight, member apps band (locked CTA for non-active viewers), latest news/notices/agenda from the content store, regulations, gallery, join CTA. |
| Profil | `profil.html` | public | About, vision/mission, values, history, board posts (names pending), logo meaning; CTA follows the session. |
| Berita & Kegiatan | `berita.html` (`?id=`) | public | Featured story, notices, filterable archive; article view. Admin-managed items included. |
| Agenda | `agenda.html` (`?id=`) | public | Upcoming/past events, filters, detail dialog, `.ics`; skeleton list, no layout shift on deep links. |
| **Produk Pengetahuan** | `pustaka.html` (`?id=`, `?kategori=`) | public catalogue, files for Aktif/admin | Standar, CoP, Peraturan Perundangan (from `regulasi.js`), Petunjuk Teknis, Modul Pelatihan, Formulir & Daftar Periksa, Kajian Teknis, Aplikasi; locked items explain the next step. |
| Regulasi & Standar | `regulasi.html` | public | 28 verified regulations and standards (verified 2026-10-08), links back to the catalogue. |
| Keanggotaan | `keanggotaan.html` | public | Benefits, categories (sample wording), the real 5-step flow, FAQ; CTA by session state. |
| Verifikasi Anggota | `verifikasi.html` (`?kta=`) | public | Registry lookup by KTA or name (Firebase: server-side, ≤ 20 results). |
| Kontak & Umpan Balik | `umpan-balik.html` | public | Feedback form (5 categories), secretariat card (hidden while empty). |
| Kebijakan Privasi | `kebijakan-privasi.html` | public | UU 27/2022 policy, updated 9 Oktober 2026 for v2 data, admin access and the apps. |
| Masuk & Daftar | `masuk.html` (`#daftar`, `?next=`) | guests | E-mail, phone OTP, Google; new accounts go to the application form. Demo note shows the demo admin. |
| **Formulir Pendaftaran** | `pendaftaran.html` | signed in | 7-step wizard with autosave (kategori, data diri, data profesional, kompetensi & sertifikat, dokumen, pernyataan, tinjau & kirim); status views for every state; renewal mode. |
| Dasbor | `dashboard.html` | signed in | Non-active: status centre (status card, timeline, next step, locked teasers). Aktif/admin: KPIs, renewal reminder, apps, agenda/news/knowledge/regulations, certificate reminders, Konsol Admin band. Firebase: e-mail verification notice. |
| Profil Anggota | `anggota.html` (`#profil` `#kompetensi` `#sertifikat` `#kartu` `#aplikasi`) | Aktif / admin | Profile (identity locked after approval), competencies, certificates, digital KTA with QR (name from the registry), app launchers. |
| **Konsol Admin** | `admin.html` (`#ringkasan` `#permohonan` `#anggota` `#konten` `#umpan-balik` `#admin` `#log`) | admin | Queue + decisions (approve / revision / reject), member directory (kategori, extend, deactivate/reactivate, CSV), content CRUD for 5 types, feedback, admins, audit log. |
| PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur | `aplikasi/perencanaan/index.html` | Aktif / admin | Planning & indicative structural analysis v2.4.0, 9 stages, PDF report, scaffold tag. |
| Simulator (Beta) | `aplikasi/simulator/index.html` | Aktif / admin | 3D tube & coupler erection, 20 corrected steps, measured handover inspection, red → green tag. |
| 404 | `404.html` | public | Works at any depth; noindex. |
| Sistem Desain | `styleguide.html` | noindex, not in menus | Internal component gallery (safe to delete before launch). |

## 2. Features (v2)

- **Membership lifecycle**: Draf → Menunggu Verifikasi → (Perlu Perbaikan | Ditolak | **Aktif**) → Nonaktif;
  *Kedaluwarsa* computed from `validUntil`; renewal (*perpanjangan*) for expired, expiring (≤ 60 days) and Nonaktif
  members. KTA `PPAPI-YYYY-NNNNNN` assigned at approval (sequential per year, collision-safe), registry entry written,
  every decision audited. Rejected/returned renewals restore the previous membership state.
- **Data integrity**: reviewed data frozen while an application is pending; the approved **name is locked** afterwards
  (rules + store); the public registry keeps the **approved snapshot** (name, competencies, city) — later admin actions
  only change kategori, validity and status; only Praktisi / Ahli / Mitra Korporat can be self-selected; server
  timestamps; JPEG-only pas foto in its own collection; https-only links; verified e-mail only (admins are added by
  verified e-mail); registry not bulk-downloadable.
- **Gating**: `data-auth` public / guest / required / active / admin; header account menu by role and status; locked
  panels with the right next step everywhere (pustaka, dashboard, index, apps gate).
- **Secretariat console** with KPIs, queue, drawers, dialogs, CSV export (Excel-ID friendly, formula-safe), content
  management (static items can be overridden, hidden and restored), feedback workflow, admin management, audit log.
- **Knowledge products** with per-item access (`publik` / `anggota`); member-only file links live in Firestore
  `pustaka_files` (Aktif/admin only), never in the public data files.
- **Member apps (Beta)** behind a shared gate with a portal bar and SSO; per-member local data; jsPDF and three.js from
  cdnjs with SRI; calculation method and simulator geometry corrected and documented for the Komite Teknis
  (`site/aplikasi/KOREKSI-PERHITUNGAN.md`, `KOREKSI-SIMULATOR.md`, `CATATAN.md`).
- **Client rules (9–10 October 2026)**: the old attribution labels never appear on the site or in the apps (guarded
  by `flows/branding-guard.mjs` on every file and `flows/release-v2-client-rules.mjs` on the rendered text of every
  page); the only developer credit is "Dikembangkan oleh mrezahuzain@2026" — a small condensed grey line under the
  copyright in the bottom row of the main footer on every page (404 included) and in the footers of both apps; the
  planning app is titled "PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur" in `config.apps` and the catalogue.
- **Security & quality**: CSP meta on every page, SRI on all CDN scripts (Firebase SDK, jsPDF, three.js), escaping of
  all data, safe `next` redirects, Firestore rules v2 with a JavaScript mirror under test, axe-clean pages, no layout
  shift on deep links, monochrome design system across all pages and states, desktop and phone.

## 3. Demo accounts (Mode Demo only)

| Account | Credentials | Notes |
| --- | --- | --- |
| Admin | `admin@ppapi.demo` / `AdminPPAPI2026` | Seeded on first load (key `ppapi_demo_seed_v2`); shown in the demo note on masuk.html. |
| Sample applicants/members | records only (no login) | Bagus Pratama (Contoh) — Menunggu Verifikasi · Sari Wulandari (Contoh) — Perlu Perbaikan · Dimas Haryanto (Contoh) — Aktif, KTA PPAPI-2025-000318 · Andi Saputra (Contoh) — Ditolak. |
| Any new member | sign up on masuk.html | Starts as Draf; approve it from the console in the same browser to see the Aktif features. Phone OTP in demo: `123456`; Google sign-in is simulated. |

Demo data lives only in that browser (clear site data to start over). Mode Demo is not a security boundary.

## 4. What the client must fill in or decide before launch

Nothing below was invented; the fields are empty or marked `contoh`.

1. **Firebase** (README §10): project, `firebase` block in `config.js`, providers (Email/Password, Google, optional
   Phone on Blaze), Firestore in `asia-southeast2`, **publish `firestore.rules`** (the v2 rules were exercised through
   a JavaScript mirror; Google's parser confirms them on publish), authorised domains, e-mail verification template
   language, optional App Check (`appCheckSiteKey`).
2. **First admin** (README §6.2): the person signs up, verifies the e-mail, then `admins/{uid}` is created once in the
   Firebase console; further admins from Konsol Admin › Admin.
3. **Kode Etik and AD/ART documents.** The application's declaration step asks applicants to agree to them, but the
   site has no copy yet (the step says so and points to Kontak). Provide the official documents; publish them as
   public items in Produk Pengetahuan (or another public link) and link them from the declaration text.
4. **Membership policy**: category descriptions and requirements (now sample wording in `organisasi.js`), validity
   period (`masaBerlakuTahun`, default 3 years to 31 December), fees (`iuran.aktif`, `nominal`, `keterangan`,
   `rekening` — the payment step appears only when `aktif: true`), and whether non-members may see the catalogue
   (`pustaka.katalogPublik`).
5. **Developer credit and app attribution.** Settled by the client (9–10 October 2026): the only credit is
   "Dikembangkan oleh mrezahuzain@2026" (site footer and both apps). Still open: whether the `penyusun` field of the two
   app items in `assets/data/pustaka.js` (deliberately empty, so no "Penyusun" row is shown) should carry it.
6. **Komite Teknis PPAPI review** of `site/aplikasi/KOREKSI-PERHITUNGAN.md` (open questions §17, §19: Q14–Q16) and
   `site/aplikasi/KOREKSI-SIMULATOR.md` (§7), and the criteria for removing the **Beta** label. Until then results stay
   "indikatif".
7. **Knowledge-product files**: replace the 10 sample catalogue items (`contoh: true`) with real documents; member-only
   files go through Konsol Admin › Konten (stored in `pustaka_files`), public PDFs may go in a `pustaka/` folder.
8. v1 items still open (see `devtools/RELEASE_NOTES.md` §3): secretariat contacts and social links, board
   names, legal status, official wording (vision, mission, values, history), real news/notices/events (all 10 + 4 + 10
   are samples), the public registry samples in `registry.js` (6 fictional, hidden in Firebase mode), photos.
9. **Domain.** The site runs on the project address above; `siteUrl` is filled automatically in the published copy.
   If PPAPI moves to its own domain: set the custom domain in GitHub Pages, change `SITE_URL` in `devtools/deploy.sh`,
   add the domain to Firebase › Authorized domains, and (optionally) add a sitemap + `Sitemap:` line.
10. Optional: delete `styleguide.html`;
   set `SITE_ROOT` in `404.html` for a user site; extend the CSP meta on every page if another third-party service is
   added (README §10).

## 5. Known limitations

- **Static hosting**: pages, data files and app code are downloadable by anyone with the URL. "Aktif only" gates the
  portal experience; the protected assets are the Firestore data (members, member-only file links, feedback, audit).
- **Mode Demo** keeps everything in localStorage of one browser; content changes made in the demo console are not
  seen by other visitors.
- **Firestore rules** were verified with a JavaScript mirror (stub flows), not with the Firebase emulator; publish
  them in the console to let Google's parser confirm the file.
- **Early renewal** of an Aktif member moves the member to Menunggu Verifikasi (features locked until approval);
  withdrawing returns to Draf. The secretariat should prefer **Perpanjang** for members who are still Aktif.
- **Name corrections after approval** are made by the secretariat in the Firebase console (`members/{uid}.name` and
  `registry/{kta}.nama`); the console has no name editor.
- **Member apps are Beta**; calculations are indicative and need review by a competent person; app data stays in the
  member's browser (no sync between devices). PDF export and the 3D simulator need internet (cdnjs).
- **No file uploads** (Cloud Storage needs Blaze): documents are https links, the pas foto is a small JPEG in Firestore.
- **Phone OTP** needs the Blaze plan and cannot be tested from localhost.
- **axe "target-size" on the header logo** after scrolling (header slides away; known false positive from v1).
- **Sample dates go stale** (events Oct 2026 – Jan 2027); the regulation library was verified on 2026-10-08.
- `robots.txt` only works at a domain root. On the current project address (`anakabil.github.io/ppapi-website/`) it
  is not read: the `noindex` tags still keep member pages, the console, the apps, 404 and the style guide out of
  search results, but the support files (`README.md`, `aplikasi/*.md`, `firestore.rules`) may be indexed (they hold no
  secrets). The rule takes effect as soon as the site has its own domain.
- **The live copy lags the source** until `deploy.sh` is run (see the top of this file).

## 6. Test matrix (release QA 2026-10-09)

_Filled in after the final run — see below._

## 7. Changes made during release QA

**Release QA (2026-10-09)** — details in `devtools/FOUNDATION_NOTES.md` §9.15: deferred items of the fix groups closed
(identity lock after approval in store + rules, registry snapshot kept through admin actions, `kategoriAllowed` rule,
e-mail verification UI, CSP on every page, logo masters, deferred `#fragment` jump without layout shift) and the v1/v2
test suite brought to the v2 expectations.

**Final pass (2026-10-10)** — details in §9.16:

- Client rules: footer credit "Dikembangkan oleh mrezahuzain@2026" on every page (core.js + main.css); "(Beta)" in the
  planning app title (`config.apps`, catalogue item, style-guide sample); README updated for the live address, the
  deploy script and the credit; `deploy.sh` now also runs `flows/release-v2-client-rules.mjs` before copying anything.
- Header avatar: only an `https:` photo is rendered (any other scheme falls back to initials), like the dashboard and
  the member page already did (found by `sec-v2-xss`: a `javascript:` URL reached an `<img src>`; it could not run, but
  the attribute is now never written).
- Placeholders that were cut off (new `flows/placeholder-fit.mjs`): pustaka "Saring" is an icon button below 400 px;
  umpan-balik e-mail/phone stack at 1024–1279 px (a typed number was clipped too); shorter placeholders on umpan-balik
  Subjek, berita search and the LinkedIn field.
- Style guide: the sample external link no longer points to the client's previous app.
- Tests repaired at the root: `pendaftaran-flow` (clock frozen for the "42 hari" check), `aplikasi-perencanaan-temuan`
  and `-koreksi` (the PDF is parsed in a CSP-free page; pdf.js's blob worker was refused by the app's CSP),
  `sec-v2-app-import` (the app's own Tahap 5 handlers whitelisted), `verify-eng-simulator` (hand references re-derived
  for revision 2 of `KOREKSI-SIMULATOR.md`; gate leaf and walkway headroom measured correctly → 43/43; §6 of that
  document updated), and the "(Beta)" title in beranda/dashboard/anggota/contract-v2.
