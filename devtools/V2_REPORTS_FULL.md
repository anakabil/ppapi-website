## FOUNDATION
Foundation v2 (SPEC-v2 §1–§3) is in place in the shared files. The new tests pass, and every v1 test still passes except for the expectations v2 changes on purpose (listed below). One limit: nothing here can run Google's rules engine offline, so `firestore.rules` is only checked by a test that mirrors the rules in JavaScript. Publishing it in the Firebase console is the real syntax check (README §10).

**Test results**
- `flows/contract-v2.mjs` (new, demo mode): 175/175. It covers:
  - the status helpers, demo data and `check.mjs --admin` compatibility;
  - session values by role and status, and the account menu;
  - the full membership flow, including KTA numbers PPAPI-2026-000001 onwards, revision, rejection and re-applying, deactivate/reactivate/extend, and expired → renewal;
  - admin-only guards, feedback, admins, audit log, CSV export;
  - content merging, registry lookup, member-only file links;
  - `ui.locked`, `ui.drawer`, and the `active`/`admin` page gates.
  - Its throwaway test pages are `site/__v2test_*.html`, and it deletes them. The prefix avoids `contract.mjs`'s cleanup; the first name collided when both ran at once.
- `flows/firebase-v2-stub.mjs` (new): 32/32. It runs the store in Firebase mode against a fake compat SDK and a JS copy of `firestore.rules`. Every store call is allowed for the right role, and 13 deliberately malicious writes and reads are refused.
- `node devtools/check.mjs` reports 0 issues for `all`, `--auth`, `--admin`, every `--status=` value and `--motion`. `node --check` passes on all JS.
- Unchanged and fully passing: foundation-ui 30/30, foundation-fixes 62/62, firebase-smoke 7/7, firebase-phone 17/17, berita-agenda, masuk, regulasi-verifikasi, umpan-balik, security-lens, contoh-audit.
- auth-demo passes 53/53 once its two "new account" expectations are updated.

**What was built**
- **Status rules:** `util.effectiveStatus` and related helpers; a v1 "Menunggu Verifikasi" record without a submitted form counts as Draf.
- **`PPAPI.session`:** `ready`, `current`, `refresh`, `onChange`. `onReady` now runs after the session is known.
- **Page gates:** `data-auth="active"` and `"admin"` redirect to `dashboard.html` with the toast messages from the spec.
- **Account menu:** items depend on status and role.
- **Shared UI:** `ui.locked()` and `ui.drawer()`. Navigation now shows "Pengetahuan" (`pustaka.html`), and the footer has the new links.
- **auth.js:** `isAdmin()`, `postSignUpTarget = 'pendaftaran.html'`, and the demo admin `admin@ppapi.demo` / `AdminPPAPI2026` plus 4 sample members.
- **store.js:**
  - the member's own application: save, submit (missing fields listed in Indonesian), withdraw;
  - the admin console API in `store.admin.*`, with KTA numbers assigned in a Firestore transaction;
  - `store.content.*`, `store.registry.lookup`, `store.pustaka.fileUrl`. Member-only file links are stored separately in `pustaka_files`.
- **firestore.rules:** rewritten per §3.4, commented in Indonesian.
- **Config:** the two apps now point to `aplikasi/…`. App texts come from the two `ANALISIS_*.md` files. Also added: `iuran`, `pustaka.katalogPublik`, `masaBerlakuTahun`.
- **Data:** new `pustaka.js` (10 sample documents plus the 2 real apps). In `organisasi.js`, the 5 membership steps follow the real flow, and Kehormatan cannot be applied for.
- **CSS and docs:** `main.css` §17b adds `.locked`, `.status-track`, `.stepper`, `.drawer`, `.kpi` and `.doc-card`, all shown in `styleguide.html` section 08. I checked the screenshots at desktop and phone width, light and dark. The README has the new sections, and FOUNDATION_NOTES §9 documents everything.

**Behaviour to know about**
- **Early renewal locks the member out:** an Aktif member who renews within 60 days becomes "Menunggu Verifikasi" and loses member features until approved. `pendaftaran.html` should warn before submitting; admins can use "Perpanjang" directly instead.
- **App links are now internal relative paths:** `dashboard.js`, `anggota.js` and `index.js` currently only show http(s) links, so their app sections render empty until the page authors update them.

**v1 test expectations that changed on purpose** (exact list per test in FOUNDATION_NOTES §9.12):
- **contract.mjs:** 7 checks, covering the navigation, app keys and URLs, new accounts starting as `Draf` with no KTA, and the account-menu items.
- **auth-demo:** 2 checks; new accounts start as `Draf`.
- **journey S1/S3:** 5 checks.
- **beranda:** 2 checks.
- **dashboard:** 8 checks.
- **anggota:** 3 checks.
- **profil/keanggotaan:** 3 checks; the new steps and 8 FAQ items.
- **crawl:** reports links to `pustaka.html`, `pendaftaran.html` and the `aplikasi/…` pages until those pages exist.

I did not edit any page files or any v1 test files.

Files are in `scratch-2026-10-07-3ab25b/`:
- site/assets/js/core.js
- site/assets/js/auth.js
- site/assets/js/store.js
- site/assets/js/config.js
- site/assets/css/main.css
- site/assets/data/pustaka.js
- site/assets/data/organisasi.js
- site/firestore.rules
- site/README.md
- site/styleguide.html
- site/assets/js/pages/styleguide.js
- devtools/FOUNDATION_NOTES.md
- devtools/flows/contract-v2.mjs
- devtools/flows/firebase-v2-stub.mjs
- devtools/flows/styleguide-v2-shots.mjs (screenshots in devtools/shots/sgv2-*.png)

## AUDIT
I found 12 problems in the shared files (3 high severity) and fixed all of them. Every test and check run is green; the Firestore rules have only been checked by hand and by the JavaScript copy of the rules, not by Google's engine. No page files were edited.

**Test results after the fixes**
- New `flows/audit-v2.mjs`: 53/53. On the foundation as delivered it failed 19 of 53, which confirmed the problems below.
- `firebase-v2-stub` 34/34 (two new checks), `contract-v2` 175/175 (one expectation updated for fix 5).
- v1 flows: `contract` 241/248, and the 7 failures are the same ones the foundation author already listed. `auth-demo` passes 53/53 once its 2 documented expectations are patched. foundation-ui 30/30, foundation-fixes 62/62, firebase-smoke 7/7.
- Page flows: masuk 131, umpan-balik 132, regulasi-verifikasi 138, berita-agenda 124, security-lens 55, security-lens-2 found no XSS, contoh-audit clean.
- `check.mjs`: 0 issues for `all`, `all --auth`, `all --admin`, the Draf, Menunggu Verifikasi, Kedaluwarsa and Nonaktif statuses on dashboard/anggota (plus styleguide for the first three), and `--motion`. Only the 14 existing pages were covered; the new v2 pages don't exist yet.
- The Firebase emulator could not run (Java is not installed), so `firestore.rules` was reviewed line by line instead. Publishing it in the Firebase console is still the real syntax check.

**Problems found and fixed**

| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | High | A member could put someone else's e-mail in their record. Admins are added by e-mail, so this could make the wrong person admin. | Rules: new `ownEmailOk` check, so the e-mail can only be empty or the signed-in account's own. Store: other values are ignored. README warns that Firebase does not verify e-mail ownership for e-mail/password accounts. |
| 2 | High | A member writing directly to Firestore could store `javascript:` links or non-text values in their documents, certificates, payment proof or photo. The admin console would show them as clickable links. | The store now cleans member data every time it is read, so pages always get safe links and plain text fields. |
| 3 | High | Approving an old v1 member kept their unofficial KTA number even when another member already held it, overwriting that member's public verification entry. | A never-approved KTA that is already taken is replaced with the next number, in both demo and Firebase. |
| 4 | Medium | In demo, a signed-in member could change another member's record. | Now refused with `store/forbidden`, matching Firebase. Signed-out writes still work in demo only, because the v1 tests rely on them. |
| 5 | Medium | `saveApplication` stored `Kehormatan`, a category nobody can apply for. | Only categories open for application are stored, plus the member's current category when renewing. |
| 6 | Medium | Content with ids like `constructor` or `tostring` vanished from lists, and `pustaka.fileUrl` returned a function. A title such as "Constructor" produces this id automatically. | Fixed the internal lookups. |
| 7 | Medium | Adding an admin silently picked one record when several shared the e-mail. | Now refused with `store/ambiguous-email`. |
| 8 | Medium | Content edited outside the site (Firebase console, old data) could carry unsafe links. | Links are re-checked when content is read; `fileUrl` only returns http(s) or safe relative paths. |
| 9 | Low | The member CSV export missed full-width formula characters and didn't quote cells containing commas. | Fixed. |
| 10 | Low | `statusTone`/`statusLabel` returned `undefined` for names like `constructor`. | Fixed. |
| 11 | Low | Rules didn't tie a feedback update to the admin making it. | Rules now require `updatedBy` to be that admin. |
| 12 | Low | On phones, the drawer stacked three full-width buttons, about 200px. | The main action now spans the first row and the others share the next row. I checked the new screenshot. |

**Behaviour I left as it is; page authors should handle it**
- An early renewal (Aktif with 60 days or less left) moves the member to Menunggu Verifikasi, so they lose member features until approved. Withdrawing it puts them at **Draf**, not back to Aktif, and the rules only allow that. `pendaftaran.html` should warn about both. For members still Aktif, admins should use Perpanjang (`admin.extend`) instead.
- Admins can approve a Draf member on purpose, because Kehormatan members are designated, not applied for.
- In WIB, the rules keep an expiring member active up to 7 hours longer than the website does; never shorter.
- The admin page should show the matching member and ask for confirmation before adding an admin.

**API cheat sheet v2**
```
session.ready()/current()/refresh()/onChange(cb)/isResolved()
  → {user, member, isAdmin, status (effective), statusLabel, isActive (member Aktif OR admin), isMemberActive}
util.effectiveStatus | isActiveMember | memberStatus | statusBadge | statusTone | statusLabel | canRenew
  | validityDays | defaultValidUntil | PROVINSI | PENDIDIKAN | GENDER | RENEWAL_DAYS=60
ui.locked({title,text,actionHtml,eyebrow,icon,compact,cls}) · ui.lockedAction({compact})
ui.drawer({title,eyebrow,body,actions:[secondary…, primary],size,onOpen,onClose,cls})
  → {el,panel,body,footer,close,setTitle,setBody,setActions}
body[data-auth]: public | guest | required | active | admin
  (denied → dashboard.html + toast; signed out → masuk.html?next=)
auth.isAdmin() · auth.postSignUpTarget='pendaftaran.html' · auth.demoAdmin (admin@ppapi.demo / AdminPPAPI2026)
store.getMember · ensureMember(new = Draf, kta '') · normalizeMember (sanitised on read)
store.saveMember(uid, patch)       owner or admin; email only '' or the account's own
store.saveApplication(uid, patch)  Draf / Perlu Perbaikan / Ditolak / canRenew; else store/application-locked
store.submitApplication(uid)       → Menunggu Verifikasi; store/application-incomplete {missing[], fields[{key,step,label}]}
store.withdrawApplication(uid)     Menunggu Verifikasi → Draf
store.applicationMissing(m) · canEditApplication(m) · applicationType(m) · APPLY_TYPES
store.admin.* (else store/forbidden):
  listMembers({status,q}) · getMember · approve(uid,{memberType,validUntil,note}) · requestRevision(uid,note)
  · reject(uid,note) · deactivate(uid,note) · reactivate(uid,{validUntil,note}) · extend(uid,date,note)
  · setMemberType · listFeedback · updateFeedback(id,{status,catatanAdmin}) · listAdmins · addAdmin(email)
  · removeAdmin(uid) · audit(n) · summary() · exportMembersCsv(list)
  errors: store/invalid-transition | note-required | invalid-date | invalid-type | not-found
          | already-admin | last-admin | ambiguous-email | invalid-email
store.content.list(type,{includeHidden,fresh}) / get / save / remove / restore
  types: berita | pengumuman | agenda | pustaka | regulasi; items carry _static / _managed
store.registry.lookup(q) → {exact, matches, kind, query}   (public fields only)
store.pustaka.fileUrl(item)   active member or admin, else store/forbidden; safe URL or ''
```

Shared files changed: `store.js`, `core.js` and `main.css` (under `site/assets/`), plus `site/firestore.rules` and `site/README.md`. Run `flows/contract-v2.mjs` and `flows/audit-v2.mjs` (from `devtools/`) after any further shared-file change.

Files are in `C:/Users/mreza/AppData/Roaming/Claude/scratch-workspaces/0d05c4b6-d00e-4d02-8c51-b670e22791eb/9df56f33-af98-4be8-96f7-7046b594b3f2/scratch-2026-10-07-3ab25b/devtools/`:
- AUDIT_V2.md — full report
- FOUNDATION_NOTES.md — §9.7 and §9.8 annotated, new §9.13
- flows/audit-v2.mjs
- flows/firebase-v2-stub.mjs
- flows/contract-v2.mjs

## pendaftaran
The pendaftaran page is finished and every check is green: 0 issues from `check.mjs` in all 9 states on desktop and mobile, and `pendaftaran-flow.mjs` passes 207 of 207. I only touched the four files I own.

**Files**
- `C:/Users/mreza/AppData/Roaming/Claude/scratch-workspaces/0d05c4b6-d00e-4d02-8c51-b670e22791eb/9df56f33-af98-4be8-96f7-7046b594b3f2/scratch-2026-10-07-3ab25b/site/pendaftaran.html` (`data-auth="required"`, `noindex`)
- `.../site/assets/css/pages/pendaftaran.css` (prefix `daf-`, scoped to `body[data-page="pendaftaran"]`, design tokens only)
- `.../site/assets/js/pages/pendaftaran.js`
- `.../devtools/flows/pendaftaran-flow.mjs`

**What the page does, by status (SPEC-v2 §4.1)**
- **Draf, Perlu Perbaikan, Ditolak, Kedaluwarsa, Nonaktif:** a 7-step form.
  - Progress: vertical step list on desktop, compact numbered row on phones.
  - Saving: automatic, about 0.65 s after typing stops. Writes go out one at a time and show "Tersimpan · HH.MM". A failed save shows "Coba lagi" and one toast; the unsaved change is kept and retried.
  - Validation: each step is checked on "Lanjut", with an error list at the top that clears as fields are fixed. The step list marks steps left incomplete.
  - Pas foto: cropped to 3:4, at most 360×480, saved as JPEG ≤120 KB.
  - Riwayat proyek (max 10) and documents (max 12, https links only; "drive.google.com/…" gets `https://` added automatically).
  - Kompetensi and sertifikat use the same data as anggota.html.
  - Pernyataan has a signature preview and warns if the typed name differs from the full name.
  - The review step lists missing items. Submitting an incomplete form shows the store's missing list with links that jump to each field.
- **Perlu Perbaikan / Ditolak:** the admin's note is quoted at the top. The button reads "Kirim Perbaikan" or "Ajukan Ulang".
- **Kedaluwarsa / Nonaktif (renewal):** the current category is preselected. The old declarations are cleared once (one draft write) so the member confirms them again.
- **Menunggu Verifikasi:** a "terkirim" banner right after submitting, a 4-step status timeline, a read-only summary, history, and "Tarik pengajuan" with a confirmation. For a renewal, the confirmation says the status becomes Draf, not Aktif.
- **Aktif:** a member card (KTA, category, validity) and four links. With 60 days or less left it shows "Ajukan perpanjangan"; before submitting, it warns that member features are locked during verification and asks for confirmation.
- **Admins** see their own form plus a note linking to `admin.html`.

**Verification**

| Check | Result |
|---|---|
| `node --check` on page JS and flow | OK |
| `check.mjs pendaftaran --full`, desktop + mobile: signed out (goes to `masuk.html?next=pendaftaran.html`), `--auth`, `--admin`, `--status=` Draf / Menunggu Verifikasi / Perlu Perbaikan / Ditolak / Nonaktif / Kedaluwarsa | 0 issues each |
| `--motion` for Draf, Menunggu Verifikasi, Aktif | 0 issues |
| `pendaftaran-flow.mjs` (sections A–N) | 207/207 |
| `contract-v2` / `audit-v2` | 175/175 and 53/53, unchanged |

The flow covers:
- the full journey: sign-up, form, incomplete submit, complete submit, pending, reload, withdraw, resubmit, then an admin approves through the store and the member sees the Aktif view;
- the revision, renewal and early-renewal cases;
- Ditolak, Nonaktif, admin and signed-out views;
- a mobile pass (no overflow, all targets 44 px or more, submit button not clipped);
- keyboard use;
- iuran switched on through a route-modified config;
- an autosave failure and retry;
- XSS attempts in all three views;
- axe (WCAG 2.2 AA plus best practice), 22 runs on both viewports.

I read all the screenshots and fixed what they showed: the category cards became full-width rows, the long mobile submit label was clipped, and on phones the action cards now come before the summary in the pending view.

**Workarounds and decisions**
- I used `<div>` instead of `<aside>` for the side panel and the pending-view actions. axe flags `<aside>` nested inside `<main>`, as the foundation notes warn.
- My axe runs leave out `#site-header`. It has a shared `.brand` target-size violation whenever the header hides on scroll; I reproduced it on keanggotaan.html and umpan-balik.html at scrollY 700.
- Deep links other pages can use: `pendaftaran.html#kategori|data-diri|profesional|kompetensi|dokumen|pernyataan|tinjau`, and `#perpanjangan`, which opens the renewal form directly when renewal is allowed.
- The browser's leave-page warning appears only in Firebase mode, when a save is pending or still running. In demo mode the save finishes before the page unloads.

**Open issues for the foundation**
1. The header `.brand` target-size violation above.
2. `robots.txt` doesn't disallow `pendaftaran.html`. The page has a noindex meta, but adding `Disallow: /*pendaftaran.html` would be consistent with the other member pages.
3. No Kode Etik or AD/ART document exists yet, so that declaration has no link. Link it once one is published, for example on the Pustaka page.
4. In Firebase mode members can't write `review.history`. The "Riwayat pengajuan" card will only show entries the admin has written.

## admin
The admin console (`admin.html`) is finished. Every check comes back clean: 0 issues from `check.mjs` in every state, 149/149 on the main flow, and 17/17 on a second flow that runs the console in Firebase mode against the foundation's rules stub. I didn't edit any shared files.

**Files (all mine)**
- `site/admin.html`: noindex, gated to admins.
- `site/assets/css/pages/admin.css`
- `site/assets/js/pages/admin.js`: core, routing, Ringkasan, Umpan Balik, Admin, Log Aktivitas.
- `site/assets/js/pages/admin-anggota.js`: Permohonan, Anggota, the detail panel and the decision dialogs.
- `site/assets/js/pages/admin-konten.js`: Konten.
- `devtools/flows/admin-flow.mjs`: the main flow.
- `devtools/flows/admin-firebase.mjs`: extra Firebase-mode flow. It reuses the stub and rules mirror from `firebase-v2-stub.mjs` without changing that file.

**What the console does**
- **Layout:** dark compact band with a demo notice, then a left menu on desktop that becomes a scrolling tab strip below 1200px. Every section has its own address (e.g. `#permohonan`, `#konten/agenda`); Back/Forward work and close any open detail panel.
- **Ringkasan:** six summary tiles that link to filtered lists, latest applications, a status breakdown, and recent activity.
- **Permohonan:** queue (oldest first) with filters for Perlu Perbaikan and Ditolak, plus a completeness indicator. The detail panel shows every application field (pas foto, personal and professional data, projects, competencies, certificates, documents, declarations, applicant's note, history) and an email link prefilled for the applicant.
  - **Setujui** asks for category, validity date (proposed from config) and an optional note, then shows the new KTA number.
  - **Minta Perbaikan** requires a note and offers quick-insert phrases.
  - **Tolak** requires a reason.
- **Anggota:** search, filters (status including "ending within 60 days", category, province), sorting, and CSV export of the filtered list. The detail panel offers ubah kategori, perpanjang, nonaktifkan and aktifkan kembali. Admin accounts carry an "Admin" badge.
- **Konten:** five tabs; each item is marked Bawaan, Bawaan · Diubah, Dikelola or Disembunyikan. Built-in items can be edited, restored to the original, hidden or shown again; new items can be deleted. Members-only knowledge files keep their link private, and the edit form prefills it.
- **Umpan Balik:** filter by status, mark Baru/Diproses/Selesai with an internal note, reply by email. Saving with no changes writes nothing.
- **Admin:** list of admins. Adding one shows the matching account for you to check, then asks for confirmation. The last admin cannot be removed.
- **Log Aktivitas:** grouped by day, filterable by type.

**Verification**

| Check | Result |
|---|---|
| `node --check` on the three scripts and two flows | all OK |
| `check.mjs admin`, desktop + mobile, full page: `--admin`, signed out (→ masuk), `--auth` and each of the 7 statuses (→ dashboard), `--admin --motion` | 0 issues |
| `admin-flow.mjs` | 149/149 |
| `admin-firebase.mjs` (no permission-denied on any console call) | 17/17 |

The main flow covers the brief's scenarios plus extras:
- **Approve:** the seeded "Menunggu Verifikasi" sample member gets a new KTA, and the registry lookup finds it.
- **Revise and reject:** both work, including inline validation.
- **Deactivate, reactivate, extend, change category:** each updates the public registry.
- **Directory and CSV:** search, filter and sort work; the CSV file is checked (encoding, `;` separator, header).
- **Content:** created items appear through `store.content.list`.
- **Feedback, admins, log:** status updates, add/remove admin with the last-admin guard, and log filtering all work.
- **Security and keyboard:** an injected malicious record executes nothing; keyboard navigation and focus return are correct.
- **Gating:** a non-admin is sent to the dashboard with the "Halaman ini khusus admin PPAPI." message; a signed-out visitor goes to masuk with the section kept in `next`.
- **Accessibility:** an axe scan of every section, panel and dialog on desktop and mobile shows 0 problems.

I reviewed the screenshots (`devtools/shots/admin-flow-*.png`) for both screen sizes and polished from them.

**Workarounds inside my files (worth fixing in the shared files)**
- Visually hidden screen-reader labels inside sideways-scrolling strips stretched the page wider than the screen on phones. `check.mjs` can't detect this, because phone emulation widens the window along with the content. I fixed it in my CSS by making those scroll areas the reference box for such labels. Suggested shared fix: give `.table-wrap` and similar scroll areas `position: relative` in `main.css`, and have `check.mjs` compare the page width against `clientWidth`.
- Feedback records aren't cleaned by the store when read, so I check the email address before building a reply link and escape everything.
- The log entry for "restore built-in content" stores only the item's id as its name; the console looks up the title instead.

**Open issues (outside my files)**
- `robots.txt` doesn't list `admin.html`. The page's own noindex tag covers it.
- If someone edits a member's submission date in the Firebase console as a timestamp type rather than text, the store treats that member as Draf. The site itself always writes text dates, so only manual edits are affected.
- Anggota loads the whole members collection at once. That's fine at association scale; it would need paging at many thousands of members.
- In the shared scratchpad I accidentally overwrote an existing `slice.py`, then moved my version to `scratchpad/adm/`. If another agent relied on the old file, they will need to recreate it.

## pustaka+regulasi
I built `pustaka.html` (Produk Pengetahuan) as specified in §4.3 and updated `regulasi.html`. Every check is green: `check.mjs` reports 0 issues in all 11 states on both viewports, `pustaka-flow` passes 292/292 and `regulasi-verifikasi-flow` passes 160/160. No shared files were edited.

**Files**
- New: `site/pustaka.html`, `site/assets/js/pages/pustaka.js`, `site/assets/css/pages/pustaka.css`, `devtools/flows/pustaka-flow.mjs`
- Changed: `site/regulasi.html`, `site/assets/js/pages/regulasi.js`, `site/assets/css/pages/regulasi.css`, `devtools/flows/regulasi-verifikasi-flow.mjs` (regulasi section only; verifikasi checks untouched)

**pustaka.html**
- **Hero:** counts of documents, regulations and apps, plus the viewer's access level.
- **Collection tiles:** eight tiles with counts and a ruled, card-catalogue look. Seven of them filter the catalogue; "Aplikasi Anggota" jumps to the apps section.
- **Access bar:**
  - Signed out or not Aktif: a `ui.locked` panel whose call to action follows the member's status.
  - Active member: an "Akses penuh" strip showing the validity date.
  - Admin: an "Akses admin" strip linking to `admin.html#konten`.
- **Toolbar:** search, collection chips with counts, status, sort, and a "Kartu / Daftar" view switch. All of it is kept in the URL (`?q=&kategori=&status=&urut=&tampilan=&id=`). On phones the chips scroll sideways in one row.
- **Catalogue:** one shelf per collection, showing 6, 4 or 3 cards (desktop, tablet, phone) with "Tampilkan N lainnya". Key regulations come first. Searching highlights matches.
- **Detail modal:** opens from any title or from `?id=`.
  - Active member or admin: "Buka Dokumen" comes from `store.pustaka.fileUrl`. A document with no file yet shows an honest "Berkas belum tersedia".
  - Everyone else: a `ui.locked` panel.
  - Regulations: a link to the official text and to `regulasi.html?q=…`.
- **Apps:** both are large cards on a dark band. Active members get same-tab links to `aplikasi/…`; everyone else gets a locked card with the status call to action. The `appNote` disclaimer is shown.
- **Closing banner:** "Kirim usulan" for active members, the unlock call to action for others.
- **`katalogPublik: false`:** visitors who are not Aktif see only the hero and one locked panel.
- The page re-renders when the session changes, so signing out locks it in place without a reload.

**regulasi.html**
- Now reads `store.content.list('regulasi')`, so regulations the admin adds or hides take effect. It falls back to the static data if the store can't be read.
- Links back to Produk Pengetahuan from the breadcrumb (shortened to "Pengetahuan" on phones), the library heading and the closing banner.

**Verification**

| Check | Result |
|---|---|
| `node --check` on all 4 JS/MJS files | ok |
| `check.mjs pustaka regulasi --full`, desktop + mobile: signed out, `--auth`, `--admin`, every `--status` (Draf, Menunggu Verifikasi, Perlu Perbaikan, Ditolak, Nonaktif, Kedaluwarsa), `--motion`, `--auth --motion` | 0 issues in all 11 |
| `pustaka-flow --axe --widths` | 292/292, including axe-core with 0 violations in 6 states × 2 viewports, and no overflow at 360/480/800/1024/1180 in both views |
| `regulasi-verifikasi-flow` / with `--widths` | 160/160 / 166/166 (adds 11 v2 regulasi checks per viewport) |
| `security-lens` 55/55, `security-lens-2` no XSS, `contoh-audit` clean | pass |

I checked screenshots of every state on desktop and mobile, plus the modals and the list view, and fixed what I found along the way.

**Deviations and workarounds**
1. **Regulations are split across two collections.** The spec puts all regulations under "Peraturan Perundangan". I placed SNI and the international standards under **Standar**, because they are standards, not legislation. "Peraturan Perundangan" holds the 19 national instruments (UU, PP, Permen, Kepmen, SE). This is a one-line change in `fromReg` if the spec should be followed literally.
2. **Apps are not in the catalogue grid.** Items in the "Aplikasi" category appear only in the featured apps section. A search that matches an app shows a link to it.
3. **"Publik" documents with a link open for everyone.** They use the item's own link, because `fileUrl` refuses non-active viewers even for public items. No public file exists yet.
4. **Card labels rely on the `berkasAnggota` flag.** Cards say "Dapat dibuka" when a member file exists, without a `fileUrl` read per card. That read happens only when the modal opens.
5. **New browser storage key:** `ppapi_pustaka_tampilan` remembers the list/card view. It should be added to the reserved-keys list in `FOUNDATION_NOTES`.
6. **Flaky focus check fixed.** One focus-return assertion failed once under load, so it now waits up to 2.5 s for focus instead of a fixed 400 ms (both flows).

**Open issues and notes for other agents**
- Other pages can link straight to a document with `pustaka.html?id=<id>`; this also works for regulation ids and app items.
- All 10 sample documents have no file, so active members see "Belum terbit" until the secretariat attaches files via Konsol Admin › Konten.
- `crawl.mjs` was not re-run, because other agents' pages are still changing. `admin.html#konten`, `pendaftaran.html` and both `aplikasi/*/index.html` exist now.

## aplikasi
I've integrated both legacy apps as member-only assets, behind a shared gate and portal bar. Every check I ran is green: `check.mjs` reports 0 issues in all states and my flow passes 201/201.

**How they behave now**
- **Gate:** a signed-out visitor goes to the sign-in page and comes back to the app after signing in. A member who is not Aktif (all six other statuses) is sent to the dashboard with the toast "Fitur ini khusus anggota berstatus Aktif.". An Aktif member or an admin gets the app, and nothing shows before that decision is made.
- **Portal bar:** "← Portal Anggota · app title · name + Aktif/Admin badge · Keluar". It is a labelled nav with a skip link, works from the keyboard, and the app layout is shifted down so the bar covers nothing.
- **Planning app:** its own login, the default `admin`/`admin123` account, user management and the Supabase/Upstash panels are gone. The member's portal account is used directly (PPAPI admin → app admin, others → app user), and their name and KTA appear in the app and pre-fill the inspector field. Data is kept per member in this browser, and a member can delete their own data from a shared device. The "Simulator 3D" button now opens the simulator app.
- **Simulator:** three.js only loads after the gate passes, and the 3D scene is built when the member presses "Mulai Simulasi". Training progress is saved per member in the browser and can be resumed. The interface uses the site's monochrome style; the warning colours (clamp colours, green/red tags, measuring lines) are kept inside the 3D view only.

**Bugs fixed** (each with before/after in `site/aplikasi/CATATAN.md`):
- Calculations and constants are unchanged. The reference values from the analysis (645 kg, 1346 kg, 2609 kg, 10869 kg/m², 5.18 kN, and so on) are checked automatically and match.
- **Security:** all user input is now escaped, imported JSON is validated, the old service worker is not installed, and the embedded base64 copy of the simulator is removed.
- **Planning app:**
  - the report summary now appears;
  - the conclusion no longer says "undefined/52";
  - the default date uses local time, not UTC;
  - stage 2/3/5/6 inputs survive a reload;
  - "Proyek Baru" now clears everything;
  - the PDF drops from about 10 MB to about 0.5 MB, and its labels no longer overlap the values;
  - failed checks now show ">" instead of always "≤";
  - the floating button no longer prints on the tag.
- **Simulator:** the inspection toggle labels stay inside the panel, the toast is readable, and the camera controls are no longer hidden behind the panel. The tower now fits on a portrait phone, memory no longer leaks, and the keyboard works throughout. Browsers without WebGL get a clear message.
- **Accessibility:** colour contrast was adjusted to pass the automated accessibility scan; the status meaning of the colours is unchanged.

**Workarounds** (no shared files were edited):
- The app pages don't use `data-auth`, because the site core's redirects are relative and would point to missing pages from the `aplikasi/` subfolder. `gate.js` does the redirects instead.
- The apps don't load `main.css`, because the old app CSS clashes with it. `gate.css` copies the site's colour values and toast styles.
- `check.mjs` starts the browser without the software-WebGL flag, which causes "GPU stall" warnings. Because the 3D scene is only built after "Mulai Simulasi", `check.mjs` never creates it; my own flows use that flag.

**Still open:**
- **Technical review (Komite Teknis):** the calculation-method points E1–E14 (for example, load split evenly across all standards, the buckling capacity being a fixed input, clamp capacity 6.3/9.4 kN vs TG20 6.1/9.1 kN). Also, the reference "KEP-74/PPK/XII/2013" could not be found in public sources. On the simulator side, the content points in the analysis (top rail height, the green tag fitted before inspection, the 2.4 m width) are also untouched; the intro now says the tower layout is illustrative only.
- **Attribution:** the credits are inconsistent across the old apps ("[atribusi lama, dihapus]", "[atribusi lama, dihapus]", "[atribusi lama, dihapus]"). I kept "Dikembangkan oleh [atribusi lama, dihapus]" and removed "[atribusi lama, dihapus]"; the client should confirm the wording.
- **Data and libraries:** app data stays in each member's browser with no cloud sync; moving data from the old app is by JSON export then import. jsPDF 2.5.1 is loaded from cdnjs without an integrity hash (three.js r128 has one).
- **README:** the README owner could add a link to `aplikasi/CATATAN.md`.

**Checks run:**

| Check | Result |
|---|---|
| `node --check` on all my JS files | OK |
| `check.mjs` on both apps, desktop + mobile, `--full`: signed out | redirects to sign-in, 0 issues |
| `--auth`, `--status=Aktif`, `--admin` | app opens, 0 issues |
| `--status` Draf, Menunggu Verifikasi, Perlu Perbaikan, Ditolak, Nonaktif, Kedaluwarsa | redirects to dashboard, 0 issues |
| `--motion` | 0 issues |
| `aplikasi-flow.mjs` (gate, bar, sign-in/out, revoked status, SSO, per-member data, 9 stages, reference values, each bug fix, XSS/import, print, PDF, simulator desktop + mobile, no-WebGL, accessibility scan) | 201/201 |
| Accessibility scan (axe), all planning views + simulator, desktop + mobile | 0 serious/critical |
| `crawl.mjs` (existing site crawler; reaches both apps signed in) | 0 broken links, 0 page errors |
| Widths 390, 480, 768, 844 landscape, 1024, 1280, 1440 | no sideways scroll; screenshots reviewed |

I did not commit anything.

Files are in `C:/Users/mreza/AppData/Roaming/Claude/scratch-workspaces/0d05c4b6-d00e-4d02-8c51-b670e22791eb/9df56f33-af98-4be8-96f7-7046b594b3f2/scratch-2026-10-07-3ab25b/`:
- site/aplikasi/gate.js
- site/aplikasi/gate.css
- site/aplikasi/CATATAN.md
- site/aplikasi/perencanaan/index.html
- site/aplikasi/perencanaan/app.css
- site/aplikasi/perencanaan/app.js
- site/aplikasi/simulator/index.html
- site/aplikasi/simulator/simulator.css
- site/aplikasi/simulator/simulator.js
- devtools/flows/aplikasi-flow.mjs
- devtools/flows/aplikasi-lib.mjs
- devtools/flows/aplikasi-probe.mjs

## dashboard+anggota
Dashboard and anggota are done for v2. Every relevant state gives 0 issues in `check.mjs` on desktop and mobile, and both flows pass (dashboard-flow 405/405, anggota-flow 119/119). One gap: axe was not re-run on the new views, because it needs axe-core downloaded from cdnjs and I didn't fetch it without your permission.

**Files changed** (all under the workspace root)
- `site/dashboard.html`, `site/assets/js/pages/dashboard.js`, `site/assets/css/pages/dashboard.css`
- `site/anggota.html`, `site/assets/js/pages/anggota.js`, `site/assets/css/pages/anggota.css`
- `devtools/flows/dashboard-flow.mjs`, `devtools/flows/anggota-flow.mjs` (both rewritten or extended for v2)

**What changed**
- **Dashboard, not yet Aktif** (status centre):
  - A status card showing:
    - the effective status and its label, with an explanation per status;
    - the secretariat's note for Perlu Perbaikan, Ditolak and Nonaktif;
    - the main action for that status (Lengkapi, Lihat Pengajuan, Perbaiki, Ajukan Ulang or Ajukan Perpanjangan), plus "Hubungi Sekretariat" where it helps.
  - A side panel that depends on the status: application checklist from `store.applicationMissing`, application summary while waiting, or membership data for Nonaktif and Kedaluwarsa. Each checklist row opens its step at `pendaftaran.html#<langkah>`.
  - A `status-track` timeline with a separate renewal version, and locked teasers (a blurred card preview plus four `ui.locked` cards).
  - No member content or app links are shown.
- **Dashboard, Aktif member or admin:**
  - KPIs, now including validity.
  - A renewal banner when 60 days or fewer remain. It points to `pendaftaran.html#perpanjangan` and warns that member features pause while the renewal is checked.
  - App cards for the two internal apps, opening in the same tab.
  - Agenda, the latest Produk Pengetahuan, news, regulations and announcements, all from `store.content.list`.
  - Certificate reminders, profile nudge and quick actions.
  - For admins, a Konsol Admin band under the KPIs with the four queue counts linking into `admin.html`.
- **Live updates:** the dashboard switches view without a reload when the session changes, and refreshes when you return with the Back button.
- **anggota.html** is now active-members-only. The KTA card shows the real `validUntil` and effective status, with a renewal alert when 60 days or fewer remain. An admin whose own membership isn't Aktif gets an explanation panel instead of a card, with no QR. The Aplikasi tab links to the internal apps. Profile, competency and certificate editing is unchanged. The page title is now "Profil Anggota — PPAPI".

**Verification**

| Check | Result |
|---|---|
| `node --check` on all 4 JS/MJS files | pass |
| `check.mjs dashboard anggota --full` (desktop + mobile): signed out (→ masuk), `--auth`, every `--status` (7), `--admin` | 0 issues each. On anggota, the 6 non-active statuses go to the dashboard. |
| `--motion` (auth, admin, Ditolak) | 0 issues |
| dashboard-flow | 405/405 |
| anggota-flow | 119/119 |
| security-lens | 55/55 (see caveat below) |
| security-lens-2 | 0 XSS |
| contoh-audit | 15 sample badges on the dashboard |

- **What dashboard-flow covers:** every status, the renewal-pending case, admin, live session switch, stored-markup rendering, motion, profile-completeness match with anggota, admin-managed content, and widths from 360 to 1280px.
- **What anggota-flow covers:** validity, renewal alert, the gate for all 6 non-active statuses, the admin panel, mobile layout, and stored markup on every tab.
- **Screenshots I read and polished:** both views at 390, 768, 1024 and 1440px, each status card, the admin band, the KTA and Aplikasi tabs, and the renewal states.

**Workarounds and dependencies**
- **Admin queue counts:** these come from `store.admin.summary()` (one read of all members), falling back to `listMembers`.
- **Deep links into other agents' pages:** checked against their current code:
  - `pustaka.html?id=`
  - `pendaftaran.html#<langkah>` and `#perpanjangan`
  - `admin.html#permohonan`, `#anggota` and `#umpan-balik`
- **Old v1 KTA numbers:** the provisional number is hidden until a member has actually been approved.

**Open issues (not in my files)**
- **`journey.mjs` is 133/139.** The 6 failures:
  - Five match the intended changes documented in the v2 foundation notes: sign-up now leads to `pendaftaran.html`, and new accounts can't open `anggota.html#aplikasi`.
  - The sixth, "S3 account menu ArrowDown cycles items and wraps", does not match those notes. The menu cycle ends at "Keluar" and never wraps back to "Dasbor", although the notes expect it to. That menu belongs to the shared `core.js`, so whoever owns it should check whether it's a bug.
- **`security-lens.mjs` no longer really tests anggota.** Its stored-data fixture isn't Aktif, so the anggota checks stop at the gate and pass without testing anything. Its owner should seed an Aktif fixture. Until then, anggota-flow scenario J covers this.
- **`masuk.js`** still labels `next=anggota.html` as "Halaman Anggota"; the menu now says "Profil Anggota".

## masuk+keanggotaan+verifikasi
Masuk, keanggotaan and verifikasi now follow the v2 membership flow, and every check below is green. I only edited files I own, plus two new flow files of my own (`verifikasi-v2-flow.mjs` and a screenshot helper).

**Masuk**
- A brand-new account goes to `pendaftaran.html` (`PPAPI.auth.postSignUpTarget`) when there is no `?next=`. This covers email sign-up, phone or Google sign-up on either tab, and a new account that didn't finish the "Lengkapi profil" step earlier. The welcome toast adds a line inviting them to fill in the form.
- Existing accounts keep the old behaviour: `?next=` if given, otherwise the dashboard.
- One choice of mine to confirm: if `?next=` points to a page only active members can open (`anggota.html`, `admin.html`, `aplikasi/…`), a new account still goes to the form. A new account is always Draf, so it would only bounce to the dashboard. A public `?next=` page is honoured.
- The "Silakan masuk untuk melanjutkan ke …" note now changes with the tab and names more pages. The Daftar tab shows three stages: Buat akun → Isi formulir → Verifikasi.
- In Mode Demo, the demo note now shows the admin demo account (admin@ppapi.demo / AdminPPAPI2026). Each value has its own copy button, and a third button fills the Masuk form. In Firebase mode the whole note is hidden and the password never appears on the page.
- The dark side panel's benefits now say they open for active members: KTA digital, member apps, and Produk Pengetahuan.

**Keanggotaan**
- The registration timeline now comes from the v2 `data.langkah` steps. The "Mulai Pendaftaran" button goes to `masuk.html?next=pendaftaran.html#daftar` when signed out and `pendaftaran.html` when signed in.
- When signed in, the button label follows the member's status (Lanjutkan, Lihat Status Pengajuan, Perbaiki, Ajukan Ulang, Ajukan Perpanjangan). Active members get the dashboard and admins get the Konsol Admin.
- The timeline marks where a signed-in visitor is, and a small card shows their current status.
- A new dark section, "Akses Anggota", explains that member features open only after verification. It lists KTA, profile, Produk Pengetahuan and the two apps from config: locked for non-active visitors, open with links for active members and admins.
- Category cards now say whether a category is chosen on the form or set by the board (Kehormatan). The member's own or chosen category is marked.

**Verifikasi**
- All lookups go through `store.registry.lookup`. The v1 behaviour is kept: `?kta=`, name and number search, expired state, "Belum tercantum".
- Members approved in demo become verifiable; the seeded sample and members approved from the console were both tested.
- The "your own record" card appears only for an active member whose KTA is not in the list yet. Expired or deactivated members see the public result plus a note about renewal. A v1 Draf account's old unofficial number is never treated as a KTA.
- I added handling for a failed lookup (error card with "Coba lagi"), a slow lookup (loading state), and a fast second search overtaking a slow first one.
- Sample data and its notice are hidden in Firebase mode.

**Verification**
| Check | Result |
|---|---|
| `node --check` on the 3 page scripts and 4 flow files | OK |
| `check.mjs` on all 3 pages, desktop + mobile `--full`: signed out, `--auth`, `--admin`, `--motion`, plus `verifikasi?kta=` | 0 issues |
| `check.mjs` keanggotaan + verifikasi, every status (Draf, Menunggu Verifikasi, Perlu Perbaikan, Ditolak, Nonaktif, Kedaluwarsa) | 0 issues |
| `masuk-flow.mjs` (updated; includes a Firebase-mode section) | 156/156 |
| `profil-flow.mjs` (keanggotaan parts updated, 8 status states added) | 144/144 |
| `verifikasi-v2-flow.mjs` (new; includes Firebase mode against the stub and its rules mirror) | 54/54 |
| `regulasi-verifikasi-flow.mjs` (shared, not edited) | 160/160 |
| security-lens 55/55, security-lens-2, contoh-audit | no XSS, no missing badges |
| crawl | 0 broken refs (3 failed requests were another agent's temporary `__v2audit_*` test pages) |
| axe, signed out and signed in | no violations, apart from the known header-logo false positive after scrolling |

I read the screenshots at 390, 768, 820, 1024, 1280×720 and 1440 widths.

**Workarounds**
- Opening `verifikasi.html?kta=` had a layout shift score (CLS) of 0.48 on desktop. The demo seed now hashes a password before page scripts run, so the result is inserted after the first paint. A small inline script in `verifikasi.html` hides the notes below the result until it renders (with a 4-second fallback); the score is now 0.
- My flows load the Firebase stub by reading `firebase-v2-stub.mjs` as text; that file is not modified. If it is restructured, both flows report a clear failure.

**Open issues (owned by others)**
- `journey.mjs` is at 133/139. S1 and S2 expected sign-up to land on the dashboard and now land on `pendaftaran.html`. S3's account-menu labels changed in v2, as already listed in FOUNDATION_NOTES §9.12. The owner needs to update these expectations.
- The seed's hashing delay probably affects other pages that draw visible content during page start-up. The foundation owner may want to look at it.
- Plain `verifikasi.html` still shifts slightly on desktop (0.020), because the sample notice appears after start-up in demo mode. That is well under the 0.1 threshold.

Files are in `C:/Users/mreza/AppData/Roaming/Claude/scratch-workspaces/0d05c4b6-d00e-4d02-8c51-b670e22791eb/9df56f33-af98-4be8-96f7-7046b594b3f2/scratch-2026-10-07-3ab25b/`:
- `site/masuk.html`
- `site/assets/js/pages/masuk.js`
- `site/assets/css/pages/masuk.css`
- `site/keanggotaan.html`
- `site/assets/js/pages/keanggotaan.js`
- `site/assets/css/pages/keanggotaan.css`
- `site/verifikasi.html`
- `site/assets/js/pages/verifikasi.js`
- `site/assets/css/pages/verifikasi.css`
- `devtools/flows/masuk-flow.mjs`
- `devtools/flows/profil-flow.mjs`
- `devtools/flows/verifikasi-v2-flow.mjs` (new)
- `devtools/flows/mkv-shot.mjs` (new screenshot helper; output in `devtools/shots/mkv/`)

## beranda+berita+agenda
The homepage, Berita and Agenda pages are updated for v2 and every check passes. That covers all session states on desktop and mobile, the updated v1 flows, the accessibility audit and the link crawl. I only edited files I own and found no gaps in the shared files.

**What changed**
- **Beranda (`index.html`, `index.css`, `index.js`)**
  - All four content types (berita, agenda, regulasi, pustaka) now come through `store.content.list`. Items added by an admin appear, and built-in items an admin hid disappear. If the store fails, the page falls back to the static data and logs one warning per type.
  - New section "03 — Produk Pengetahuan" with 8 category tiles. Each tile shows a count and a "Contoh" badge when all its documents are samples. A note below the tiles changes with membership status, with buttons to `pustaka.html`.
  - The apps band is now "04 — Aplikasi Anggota", built from `config.apps` with 4 features each:
    - Aktif member or admin: "Buka Aplikasi" opens `aplikasi/…/index.html` in the same tab.
    - Signed in but not Aktif: the button leads to the next membership step.
    - Signed out: "Masuk untuk mengakses" goes to `masuk.html?next=aplikasi%2F…%2Findex.html`.
  - The hero button and the CTA band ("Mulai Pendaftaran") change with status. The CTA band now has a 5-step membership track; once signed in it marks done, current, warning and error steps, with screen-reader text. Everything updates live when the status refreshes or the user signs out.
  - Agenda rows now link to `agenda.html?id=…`, which opens the event detail. Remaining sections are renumbered 05–07, and the regulasi block links to the Peraturan Perundangan collection.
- **`berita.js` / `agenda.js`**: all v1 behaviour is kept (filters, search, URL sync, detail view, countdown, `.ics`, deep links). On the Berita page, news, announcements and the agenda strip all come from `content.list`.
- **`agenda.html`, `agenda.css`**: added a third link card, "Materi pelatihan", pointing to the training-module collection. The cards sit in three columns from 1024px wide and stack below that.

**Decisions for you**
- **Button labels by status:** for members who aren't Aktif I used the same per-status labels as the shared locked panel, not a flat "Lengkapi pendaftaran". Draf gets "Lengkapi Pendaftaran", Perlu Perbaikan "Perbaiki Pengajuan", Ditolak "Ajukan Ulang", and Kedaluwarsa/Nonaktif "Ajukan Perpanjangan", all pointing to `pendaftaran.html`. Menunggu Verifikasi gets "Lihat Status Pendaftaran" to `dashboard.html`, because "complete your registration" would be wrong for someone already waiting.
- **Tiles follow `pustaka.js`:** I copied the current grouping and links from the Produk Pengetahuan page (built in parallel). SNI and international standards count under Standar (10 documents) and the other 19 regulations under Peraturan Perundangan. Links use `pustaka.html?kategori=<slug>#katalog`, and the apps tile goes to `#aplikasi`. If that page changes its grouping, the homepage counts will drift.

**Verification**

| Check | Result |
|---|---|
| `node --check` on the 3 page scripts and 3 flow scripts | OK |
| `check.mjs index berita agenda --full`, desktop + mobile: signed out, `--auth`, `--status=` Draf, Menunggu Verifikasi, Perlu Perbaikan, Ditolak, Nonaktif, Kedaluwarsa, `--admin`, `--motion` | 0 issues each |
| `check.mjs` on article detail, event detail, unknown article, past-events tab | 0 issues |
| `beranda-flow.mjs` (rewritten for v2) | 171/171 |
| `berita-agenda-flow.mjs` (kept all 124 v1 checks, added admin-content, cross-link and fallback sections) | 147/147 |
| `contoh-audit` | no missing badges |
| `security-lens` | 55/55 |
| `security-lens-2` | XSS 0 |
| `crawl` | 0 broken links, anchors or errors |
| axe audit, signed out and signed in | no violations; focus visible at every tab stop; CLS ≤ 0.011 |

I reviewed screenshots at 390, 1024, 1280 and 1440px in the guest, Aktif, Draf, Perlu Perbaikan, Ditolak and admin states. Two layout problems turned up and are fixed: tile footers didn't line up when a badge was present, and tile numbers wrapped at 1024px.

**Open issues**
- In Firebase mode the homepage reads four content collections per visit. The news list shows a brief skeleton while they load.
- `beranda-flow` stubs the `aplikasi/…` pages so it doesn't depend on the apps agent's work. The crawl showed the real app and pustaka pages now exist.

**Files** (paths relative to the scratch workspace root `C:/Users/mreza/AppData/Roaming/Claude/scratch-workspaces/0d05c4b6-d00e-4d02-8c51-b670e22791eb/9df56f33-af98-4be8-96f7-7046b594b3f2/scratch-2026-10-07-3ab25b`):
- `site/index.html`
- `site/assets/css/pages/index.css`
- `site/assets/js/pages/index.js`
- `site/assets/js/pages/berita.js`
- `site/agenda.html`
- `site/assets/css/pages/agenda.css`
- `site/assets/js/pages/agenda.js`
- `devtools/flows/beranda-flow.mjs`
- `devtools/flows/berita-agenda-flow.mjs`
- `devtools/flows/beranda-shots.mjs` (new helper: element screenshots in a chosen login/status state)