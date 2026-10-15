# PPAPI v2 — Contract audit (SPEC-v2 §1–§3)

Date: 2026-10-09. Scope: the shared foundation files (core.js, auth.js, store.js, config.js, main.css, data/pustaka.js,
data/organisasi.js, firestore.rules, README.md, styleguide). I did not edit any page files.

## 1. How it was tested

| Test | Result before → after | What it covers |
| --- | --- | --- |
| `flows/audit-v2.mjs` (new, demo, clock 2026-10-09 10:00 WIB) | **34 / 53 → 53 / 53** | Whitelist holes, cross-account writes, admin guard (19 calls × member and signed out), status-transition matrix (8 states × save/submit/withdraw), session across sign-in/out/approve/deactivate on ONE page, gating chains with no loops, XSS in `ui.locked`/`statusBadge`/`drawer`/`modal`, CSV injection, registry privacy, KTA collisions, read-side sanitising, prototype-named ids, ambiguous admin email, seed duplicates, rules markers. |
| `flows/firebase-v2-stub.mjs` (Firebase code path + JS mirror of the rules) | 32 → **34 / 34** | The mirror follows the two rules changes. New checks: the member email rule, and a forged `updatedBy` on feedback. |
| `flows/contract-v2.mjs` | **175 / 175** | One expectation updated: `saveApplication({kategori:'Kehormatan'})` now stores `''`. |
| v1 foundation flows | unchanged | contract 241/248 (the same 7 documented v2 changes), auth-demo 53/53 with its 2 documented expectations patched, foundation-ui 30/30, foundation-fixes 62/62. |
| `node devtools/check.mjs` | see §5 | Page smoke test in demo mode with the `--auth`, `--admin`, `--status` and `--motion` options. |

**Firestore emulator:** not run. Java is not installed, and `firebase-tools` would have to be downloaded. Instead,
the rules were reviewed line by line by hand (§3) and exercised through the stub's JavaScript mirror. To confirm
that Google's parser accepts the file, publish it in the Firebase console (README §10).

## 2. Findings and fixes

Severity: **H** = security or data integrity · **M** = behaviour or contract gap · **L** = robustness or cosmetic.

| # | Sev | Finding | Fix (file) |
| --- | --- | --- | --- |
| E1 | **H** | A member could write any address into `member.email`, both through `saveMember` and through a direct SDK update, because the rules whitelist allowed it. `addAdmin(email)` finds members by e-mail, so a member who copied the e-mail of the person the secretariat meant to promote would be made admin instead. | rules: new `ownEmailOk` in `ownerUpdate` (the e-mail may only be `''` or `request.auth.token.email`). store: `saveMember` keeps `email` only when it is `''` or the caller's own account e-mail; otherwise it is dropped with one warning. README §6.2 warns that Firebase does not verify e-mail ownership for e-mail/password accounts. |
| E2 | **H** | Stored XSS path against admins. The rules only limit list *sizes*, so a member writing directly through the SDK could store `dokumen[].url`, `certificates[].link`, `pembayaran.buktiUrl` or `photoURL` as `javascript:…`/`data:text/html`, or store non-string list items. The admin drawer renders these as links, and escaping with `h()` does not neutralise a `javascript:` href. | store `normalize()` sanitises on read: exact v2 shape, string fields, `https://` for documents and proofs, http(s) for certificate links, raster images only for photos, stable item ids. Write paths share the same item cleaners. |
| E3 | **H** | **KTA collision.** Approving a v1 record that still carried its unofficial `ktaFromUid` number kept that number even when another member already held it in the registry. Reproduced in demo: the static sample `PPAPI-2026-000123` was overwritten by the new member. | store `adminMutate` (demo and Firebase transaction): a never-approved KTA that is already taken (static sample, registry document, or another member's record) is replaced by the next sequential KTA. A free v1 KTA is still kept, as SPEC requires. |
| E4 | M | In demo, `saveMember(otherUid, …)` by a signed-in member changed someone else's record. Firebase refuses this, so demo behaved differently. | store: a signed-in non-admin writing another uid gets `store/forbidden`. A signed-out call remains possible in demo only, because v1 `contract.mjs` relies on it. |
| E5 | M | `saveApplication` stored `kategori:'Kehormatan'`, a category nobody can apply for; `submitApplication` only failed later. | store `allowedKategori(m)`: `APPLY_TYPES`, plus the member's current `memberType` when an approved member renews. The same list is used by `applicationMissing`. |
| E6 | M | Content ids that are `Object.prototype` names (`constructor`, or `toString`, which slugifies to `tostring`) disappeared from `content.list`, and `content.save` returned `null`. `pustaka.fileUrl({id:'constructor'})` returned a *function*. A judul such as "Constructor" produces that id automatically. | store: `Object.create(null)` maps and own-property lookups (`contentList`, `fileUrl`, `cleanPatch`'s `EDITABLE`, the `warned` map, demo users). |
| E7 | M | `addAdmin(email)` silently picked one record when several records shared the e-mail (Firebase `limit(1)`). | store: collects every match, including case variants; more than one → `store/ambiguous-email`. |
| E8 | M | Managed content written outside the site (Firestore console or old data) was returned unchecked, for example `tautan:'javascript:…'`. | store `safeManaged()` re-checks `tautan`, `gambar`, `tautanDaftar` and `sumber` on read; `fileUrl` returns only http(s) or a safe relative path. |
| E9 | L | CSV: the full-width formula characters `＝＋－＠` were not neutralised, and cells containing `,` were not quoted, which breaks files opened with a comma-separator locale. | store `exportMembersCsv`. |
| E10 | L | `util.statusTone('constructor')` returned `undefined`, which produced `badge--undefined`; `statusLabel` had the same problem. | core: own-key lookup. |
| E11 | L | Rules: feedback `updatedBy` was not tied to the admin making the change. | rules: `request.resource.data.updatedBy == request.auth.uid`. The store already sends that value. |
| E12 | L | Phone-width drawer: three console actions were stacked as three full-width bars, about 200 px, so a quarter of the screen was buttons. | main.css: below 600 px the primary (last) action spans the first row and the others share the next row(s). Screenshot `shots/sgv2-drawer-mobile.png` checked. |

## 3. firestore.rules — manual review (SPEC-v2 §3.4)

Collection names, field names, status strings and timestamp types match the store in every case:

- Members, audit and history fields use ISO strings.
- `feedback.createdAt` is a server timestamp, and the rule requires `== request.time`.
- Counters use an integer `value`.

| Scenario | Rule path | Outcome |
| --- | --- | --- |
| Owner create (sign-up) | `isOwner`, `validMember`, `contactMatchesAccount`; `status 'Draf'`, `memberType 'Praktisi'`; `kta`/`validUntil`/`approvedAt`/`approvedBy` empty; no `contoh`; empty `review`; not submitted; ISO `joinedAt` | allowed; matches `defaultMember()` exactly |
| Owner submit (Draf, Perlu Perbaikan or Ditolak → Menunggu Verifikasi) | `ownerTransition` clause 1 + `submitted(after)`; `applicationEditable(before)` | allowed |
| Owner renewal (Aktif with ≤ 60 days left, expired, or Nonaktif) | `renewable(before)` + `type == 'perpanjangan'` | allowed. The rules window is 61 days, the client's 60; the rules are only more lenient. |
| Owner sets `status:'Aktif'`, `kta`, `validUntil`, `review` or `memberType` | `affectedKeys().hasOnly` / `ownerTransition` | denied (stub "evil" checks) |
| Owner edits application while Menunggu Verifikasi | `applicationEditable`: allowed only together with withdraw → Draf, or when the record is a v1 one without `submittedAt` | denied |
| Owner changes `email` to someone else's | `ownEmailOk` (new) | denied; `''` and the token e-mail are allowed |
| Admin approve (one transaction) | `members` update `isAdmin && validMember`; `counters` keys `value`/`updatedAt` with an integer value; `registry` whitelisted keys with `kta == id`; `audit_log` create with `by == auth.uid` | allowed. `isAdmin()` reads the same document for every write, which counts as one access. |
| Public registry read | `allow read: if true` (get and list; name search lists the collection) | allowed; public fields only, no e-mail, phone or uid |
| Draf member reads `pustaka_files` | `isAdmin() \|\| isActiveMember()` | denied; the store refuses before reading |
| Feedback create with extra fields | `validFeedback` `hasOnly` | denied |

Residual notes, all documented:

- `validityOk` compares 00:00 UTC + 1 day against `request.time`. In WIB the rules therefore keep an expiring member active up to 7 hours longer than the client does, never shorter.
- The last-admin guard exists only in the client.
- Rules cannot check the content of list items. E2 covers this on the client.

## 4. Behaviour confirmed (no change)

- **Gating:**
  - Signed out → `masuk.html?next=…`.
  - A Draf member on an `active` page, or a member on an `admin` page, goes to `dashboard.html` with the SPEC toast and stays there.
  - The chain `masuk.html?next=admin` → admin page → dashboard ends after these steps; there is no loop.
  - An admin whose own membership is Draf opens `active` pages.
  - A session change after boot (role removed, deactivated) makes the page leave.
- **Session:**
  - After sign-out the session is empty.
  - When the next user signs in on the same page, no admin flag from the previous user remains.
  - Approve and deactivate are reflected at the next sign-in.
  - `session.current()` returns a copy.
- **Seed:** reloads, and removing `ppapi_demo_seed_v2`, never duplicate admins, sample records, registry keys or the admin account, and never overwrite a sample the admin changed. The `check.mjs --admin` preset works.
- **Product decisions to surface to page authors, documented in FOUNDATION_NOTES §9.13 and README §5:**
  - An early renewal locks member features until it is approved.
  - Withdrawing a renewal returns the member to **Draf**, not Aktif.
  - For members who are still Aktif, the secretariat should use **Perpanjang** (`admin.extend`).
  - `approve` is allowed from Draf on purpose, because Kehormatan members are designated rather than applying.

## 5. Final regression run (after the fixes)

- **`node devtools/check.mjs`**: 0 issues in every run.
  - All pages: plain, `--auth` and `--admin`.
  - `dashboard`, `anggota` and `styleguide` with `--auth --status=` Draf, Menunggu Verifikasi and Kedaluwarsa.
  - `dashboard` and `anggota` with `--auth --status=Nonaktif`.
  - `styleguide` and `index` with `--motion`.
  - The 14 v1 pages were checked; the v2 pages did not exist yet when this ran.
- **Foundation flows:**
  - `audit-v2` 53/53, `contract-v2` 175/175, `firebase-v2-stub` 34/34.
  - `contract` 241/248, with the same 7 documented changes.
  - `auth-demo` 53/53 with its 2 documented expectations patched.
  - `foundation-ui` 30/30, `foundation-fixes` 62/62, `firebase-smoke` 7/7.
- **Page flows:**
  - masuk 131/131, umpan-balik 132/132, regulasi-verifikasi 138/138, berita-agenda 124/124.
  - security-lens 55/55; security-lens-2 found no XSS; contoh-audit ran clean.
- **Styleguide screenshots** (`flows/styleguide-v2-shots.mjs`, `shots/sgv2-*.png`, desktop and phone, light and dark) were inspected:
  - The status badges, status track, stepper, KPI tiles, document cards, feature card, locked panel, locked veil, drawer and admin account menu render cleanly.
  - There is no horizontal overflow and no console error.
  - The header and skip link that appear inside the tall section screenshots come from Playwright's element capture. On the live page the skip link sits off-screen at y = −47 px until it receives focus.
