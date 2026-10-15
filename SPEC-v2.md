# PPAPI Website — SPEC v2 (membership lifecycle, admin, knowledge products, member apps)

Extends `SPEC.md` (v1 stays valid unless overridden here) and the implemented foundation in `devtools/FOUNDATION_NOTES.md`.
Today is **2026-10-09**. All UI copy: formal, polished Bahasa Indonesia. Design language unchanged (classy, monochrome, "gagah").

## 0. Client requirements (verbatim intent)
1. **Mekanisme pendaftaran anggota** — a real membership application flow, not just account creation.
2. **Pengelolaan oleh akun admin** — admin (sekretariat) accounts manage applications, members, content and feedback.
3. **Halaman "Produk Pengetahuan"** — the association's knowledge products: Standar, Code of Practice (CoP), Peraturan Perundangan, Petunjuk Teknis, Panduan/Modul Pelatihan, and more.
4. **Aset aplikasi** — the client's own apps (from `devtools/legacy/asosiasi.ppapi-main`): the scaffolding **planning & structural-calculation app** ("PPAPI Scaffold", `index.html`) and the **tube & coupler erection-sequence simulator** (`simulator.html`) become association assets for members. Analysis: `devtools/legacy/ANALISIS_PERENCANAAN.md`, `devtools/legacy/ANALISIS_SIMULATOR.md`.
5. **"Semua fitur yang ada hanya bisa muncul jika status keanggotaan sudah aktif."** Member features (dashboard content, profile/KTA, knowledge-product access, apps) appear only for members whose status is **Aktif** (admins also see everything). Public website pages stay public.

## 1. Membership lifecycle

Stored `member.status` values (Indonesian strings; keep exact spelling):
| status | meaning | who sets it |
|---|---|---|
| `Draf` | account exists, application not yet submitted (NEW default for new accounts) | system |
| `Menunggu Verifikasi` | application submitted, waiting for admin | member (submit) |
| `Perlu Perbaikan` | admin returned the application with a note | admin |
| `Aktif` | approved; KTA assigned; `validUntil` set | admin |
| `Ditolak` | rejected with reason (member may re-apply → back to Draf) | admin |
| `Nonaktif` | frozen/suspended by admin | admin |

Computed **effective status** (`PPAPI.util.effectiveStatus(member)`): `'Kedaluwarsa'` when status is `Aktif` but `validUntil` < today; otherwise `member.status`. Missing `validUntil` on an `Aktif` member = active (backward compatible).
`PPAPI.util.isActiveMember(member)` ⇔ effectiveStatus === 'Aktif'.
Renewal: an expired/Nonaktif member can submit a **perpanjangan** application (application.type = 'perpanjangan') → `Menunggu Verifikasi`.

Backward compatibility: existing records with `status:'Menunggu Verifikasi'` but no `application.submittedAt` are normalised to `Draf`. Records created before v2 with `status:'Aktif'` stay Aktif.

### 1.1 Member shape v2 (additive)
```js
{ ...v1 Member,
  kta: '',                 // '' until approval (v1 records keep their ktaFromUid value)
  validUntil: '',          // 'YYYY-MM-DD' set by admin on approval/extension
  approvedAt: '', approvedBy: '',
  application: {
    type: 'baru'|'perpanjangan', kategori: 'Praktisi'|'Ahli'|'Mitra Korporat'|…(from organisasi.keanggotaan.kategori names),
    submittedAt: '', updatedAt: '',
    pengalaman: [{ id, proyek, peran, tahun, lokasi }],          // ≤ 10
    dokumen: [{ id, jenis /* 'CV'|'Sertifikat'|'Ijazah'|'Surat Rekomendasi'|'Bukti Pembayaran'|'Lainnya' */, label, url /* https only */ }], // ≤ 12
    pasFoto: '',            // optional data URL (JPEG, client-resized ≤ 360×480, ≤ 120 KB)
    pembayaran: { metode, tanggal, buktiUrl },                    // only when config.iuran.aktif
    pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' },
    catatan: ''             // note from applicant (≤ 1000)
  },
  review: { note: '', history: [{ at, by, byName, action, note }] }   // admin-only writes
}
```
`action` ∈ `diajukan | ditarik | perbaikan | disetujui | ditolak | dinonaktifkan | diaktifkan | diperpanjang | kategori-diubah`. (The member's own submit/withdraw is recorded as `application.submittedAt` + an entry appended by the store in `review.history` **only in demo mode**; in Firebase mode the admin UI derives "diajukan" from `application.submittedAt` because members cannot write `review`.)

### 1.2 KTA numbers
Assigned at approval: `PPAPI-YYYY-NNNNNN` sequential per year (Firebase: transaction on `counters/kta-YYYY`; Demo: localStorage counter). Existing KTAs are kept. A member's KTA card, QR verification and registry entry exist only when Aktif.

## 2. Roles
- `member` (default) and `admin` (sekretariat). Admins can access every member feature regardless of their own member status.
- Firebase: a user is admin iff document `admins/{uid}` exists. The FIRST admin is created manually in the Firebase console (README steps); afterwards admins add/remove admins from the admin console (by email of an existing account → look up `members` by email → write `admins/{uid}`).
- Demo mode: an admin account is seeded on first load: **uid `demo-admin-0001`, name `Admin PPAPI (Demo)`, email `admin@ppapi.demo`, kata sandi `AdminPPAPI2026`** (shown in the demo note on masuk.html and in README). Demo admins list in localStorage `ppapi_demo_admins` = JSON array of uids. The seed must be robust to `devtools/check.mjs --admin`, which pre-sets only `ppapi_demo_session` (the admin user object) and `ppapi_demo_admins` before load: the seed then (re)creates the `ppapi_demo_users['admin@ppapi.demo']` entry with the proper password hash if missing or if its hash is not a valid SHA-256 hex. `check.mjs --auth` seeds an ACTIVE member (`validUntil 2029-12-31`); `--auth --status=<status>` overrides the status (`Kedaluwarsa` = Aktif with validUntil in the past).
- Demo seed (once, flagged `contoh:true`): 4 sample applicants/members so the admin console is never empty: one `Menunggu Verifikasi` (kategori Praktisi, with experience + documents), one `Perlu Perbaikan` (with admin note), one `Aktif` (with KTA + validUntil), one `Ditolak`. Names clearly fictional + "(Contoh)".

## 3. Shared API v2 (foundation owns; pages consume)

### 3.1 core.js
- `PPAPI.session.ready()` → Promise<`{ user, member, isAdmin, status /*effective*/, statusLabel, isActive /* member active OR admin */, isMemberActive /* strictly member */ }`>; cached; `PPAPI.session.refresh()`; `PPAPI.session.onChange(cb)` (fires after auth change or refresh).
- `PPAPI.util.effectiveStatus(member)`, `PPAPI.util.isActiveMember(member)`, `PPAPI.util.statusBadge(status)` → html badge (Aktif ok, Menunggu Verifikasi/Perlu Perbaikan warn, Ditolak/Nonaktif/Kedaluwarsa err, Draf muted).
- `body[data-auth]` values: `public` | `guest` | `required` (signed in, any status) | **`active`** (signed in AND (active member OR admin); otherwise redirect to `dashboard.html` with flash toast "Fitur ini khusus anggota berstatus Aktif.") | **`admin`** (admin only; otherwise redirect to `dashboard.html` with toast "Halaman ini khusus admin PPAPI."). Not signed in → `masuk.html?next=…` as before.
- `PPAPI.onReady(fn)` resolves after `session.ready()` (so pages can read `PPAPI.session` synchronously via `PPAPI.session.current()`).
- Header account menu (signed in): name/email + status badge; **Dasbor**; if active: **Profil Anggota**, **Produk Pengetahuan**, **Aplikasi Anggota** (`anggota.html#aplikasi`); if not active: **Formulir Pendaftaran** (`pendaftaran.html`); if admin: **Konsol Admin** (`admin.html`); **Keluar**.
- Generic **locked state** helper: `PPAPI.ui.locked({ title, text, actionHtml })` → html of an elegant "Khusus Anggota Aktif" panel (lock icon, short copy, CTA: not signed in → Masuk/Daftar; signed in non-active → "Lengkapi / Lihat Status Pendaftaran" → pendaftaran.html or dashboard.html).
- Nav (config.nav): Beranda, Profil, Berita, Agenda, **Pengetahuan** (`pustaka.html`, key `pustaka`), Keanggotaan, Kontak. `regulasi.html` remains (linked from pustaka + footer).

### 3.2 auth.js
- `PPAPI.auth.isAdmin()` → Promise<boolean> (cached per uid; Firebase reads `admins/{uid}`; demo reads `ppapi_demo_admins`).
- Demo seed of the admin account + sample members (see §2), idempotent, versioned key `ppapi_demo_seed_v2`.
- After sign-up, default redirect target for pages becomes `pendaftaran.html` (masuk.js decides; expose `PPAPI.auth.postSignUpTarget = 'pendaftaran.html'`).

### 3.3 store.js (whitelists + Firestore rules must agree)
Member (self):
- `ensureMember(user)` → new records get `status:'Draf'`, `kta:''`, `memberType:'Praktisi'` (placeholder until approval), empty `application`/`review`.
- `saveMember(uid, patch)` (v1 whitelist) + **`saveApplication(uid, applicationPatch)`** (draft save; allowed while status ∈ Draf, Perlu Perbaikan, Ditolak, or expired/Nonaktif for perpanjangan; whitelisted + size-limited per §1.1).
- **`submitApplication(uid)`** → validates completeness (required: kategori, ≥1 pengalaman OR experienceYears, pernyataan all true + namaTerang, profile core fields: name, phone, birthDate, province, city, company/position) → status `Menunggu Verifikasi`, `application.submittedAt`. Throws `store/application-incomplete` with `.missing[]` (Indonesian labels).
- **`withdrawApplication(uid)`** → back to `Draf` (only from Menunggu Verifikasi).
Admin (`PPAPI.store.admin.*`, all throw `store/forbidden` for non-admins):
- `listMembers({ status?, q? })` → Member[] (sorted: Menunggu Verifikasi first by submittedAt asc, then others by updatedAt desc).
- `getMember(uid)`; `approve(uid, { memberType, validUntil, note })` → assigns KTA if empty, sets Aktif, approvedAt/By, review history, writes `registry/{kta}` public entry, audit log; `requestRevision(uid, note)`; `reject(uid, note)`; `deactivate(uid, note)`; `reactivate(uid, { validUntil, note })`; `extend(uid, validUntil)`; `setMemberType(uid, type)`.
- `listFeedback()`; `updateFeedback(id, { status /* 'Baru'|'Diproses'|'Selesai' */, catatanAdmin })`.
- `listAdmins()`; `addAdmin(email)` (must match an existing member record email); `removeAdmin(uid)` (cannot remove self if last admin).
- `audit(limit=50)` → recent admin actions.
- `exportMembersCsv(members)` → CSV string (UTF-8 BOM, `;` separator for Excel ID locale).
Content (`PPAPI.store.content.*`):
- `list(type)` → merged list: static `PPAPI_DATA[type]` items + admin-managed items (Firestore `content_<type>` / demo `ppapi_content_<type>`); an admin item with the same `id` overrides the static one; `{id, hidden:true}` hides a static item. Types: `berita`, `pengumuman`, `agenda`, `pustaka`, `regulasi`. Sorted like the static data.
- `save(type, item)` / `remove(type, id)` (admin; remove of a static item stores a hidden override).
Registry (`PPAPI.store.registry.*`):
- `lookup(query)` → `{ exact: Entry|null, matches: Entry[] }` over Firestore `registry` (Firebase) + static `PPAPI_DATA.registry` samples (demo only — hide samples in Firebase mode).
Knowledge files:
- `PPAPI.store.pustaka.fileUrl(item)` → Promise<string|''>: active members/admins only (throws `store/forbidden` otherwise). Firebase: `pustaka_files/{id}.url` (rules: active member or admin), fallback to `item.tautan` for `akses:'publik'`. Demo: `item.tautan`.

### 3.4 Firestore rules v2 (`site/firestore.rules`) — least privilege
- `isAdmin()` = `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
- `isActiveMember()` = `get(/…/members/$(request.auth.uid)).data.status == 'Aktif'`.
- `members/{uid}`: read: owner or admin. create: owner, status `Draf`, kta `''`, no privileged fields. update by owner: only whitelisted keys (`name,email,phone,photoURL,profile,competencies,certificates,application,updatedAt` + `status`) and status transitions ONLY `Draf|Perlu Perbaikan|Ditolak → Menunggu Verifikasi` (with `application.submittedAt` set), `Menunggu Verifikasi → Draf`, and `Aktif(expired)|Nonaktif → Menunggu Verifikasi` when `application.type == 'perpanjangan'`; privileged keys (`kta, memberType, validUntil, approvedAt, approvedBy, review, joinedAt, createdAt, uid`) unchanged. admin: read/write all.
- `admins/{uid}`: get: self or admin; list/write: admin.
- `registry/{kta}`: read: anyone; write: admin.
- `content_berita|content_pengumuman|content_agenda|content_pustaka|content_regulasi/{id}`: read: anyone; write: admin.
- `pustaka_files/{id}`: read: admin or active member; write: admin.
- `feedback/{id}`: create: anyone (v1 validation); read/update: admin; delete: none.
- `counters/{id}`, `audit_log/{id}`: admin only (audit: create + read).

### 3.5 Config additions (`config.js`, Indonesian comments)
- `apps[]` → internal paths: `{ key:'perencanaan', title:'PPAPI Scaffold — Perencanaan & Analisis Struktur', url:'aplikasi/perencanaan/index.html', … }`, `{ key:'simulator', title:'Simulator Pemasangan Perancah Tube & Coupler', url:'aplikasi/simulator/index.html', … }` (descriptions/feature bullets from the analysis docs).
- `iuran: { aktif:false, nominal:'', keterangan:'', rekening:'' }` — when `aktif`, the application wizard shows a payment step (proof link).
- `pustaka: { katalogPublik: true }` — when true, non-active visitors see the knowledge catalog with locked items; when false, they only see a locked panel.
- `masaBerlakuTahun: 3` — default validity proposed in the admin approve dialog (end of year + N years, editable).

## 4. Pages (new + changed)

### 4.1 NEW `pendaftaran.html` — Formulir Pendaftaran Anggota (`data-auth="required"`)
Status-aware:
- `Draf` / `Ditolak` (re-apply) / `Perlu Perbaikan` (admin note shown prominently) / expired-or-Nonaktif (mode perpanjangan) → **multi-step wizard** with a progress rail (desktop: vertical steps left; mobile: compact top stepper), autosave draft (`saveApplication`, debounced + "Tersimpan" indicator), back/next, per-step validation:
  1. **Kategori** — cards from `organisasi.keanggotaan.kategori` (syarat & manfaat), choose one.
  2. **Data Diri** — nama lengkap (sesuai identitas), tempat & tanggal lahir, jenis kelamin, provinsi (38), kota/kabupaten, alamat, nomor HP (normalised), email (from account), optional pas foto (client resize to JPEG ≤120 KB → data URL; preview; remove).
  3. **Data Profesional** — perusahaan/instansi, jabatan, pendidikan terakhir, pengalaman di bidang perancah (tahun), riwayat proyek (repeater ≤10: proyek, peran, tahun, lokasi).
  4. **Kompetensi & Sertifikat** — reuse member competencies/certificates (same shapes as anggota.html; katalog/penerbit from data) — at least one of either recommended (not mandatory).
  5. **Dokumen Pendukung** — link list (jenis, label, https URL — hint Google Drive "siapa saja yang memiliki tautan"); if `config.iuran.aktif`, payment info + proof link.
  6. **Pernyataan** — checkboxes: Kode Etik & AD/ART PPAPI, kebenaran data, Kebijakan Privasi; "Nama terang" typed signature; date auto.
  7. **Tinjau & Kirim** — full read-only summary grouped by step with "Ubah" links; submit → `submitApplication` → success state with timeline.
- `Menunggu Verifikasi` → read-only summary + status timeline + "Tarik pengajuan" (confirm) to edit again.
- `Aktif` → elegant "Anda sudah menjadi anggota aktif" with KTA + links (or "Ajukan perpanjangan" when ≤60 days to validUntil).

### 4.2 NEW `admin.html` — Konsol Admin (`data-auth="admin"`, `<meta name="robots" content="noindex,nofollow">`)
Layout: dark compact band "Konsol Admin PPAPI" + left vertical nav (desktop) / top tabs (mobile), hash-synced sections:
- **Ringkasan** — KPI cards (Menunggu Verifikasi, Perlu Perbaikan, Anggota Aktif, Akan kedaluwarsa ≤60 hari, Umpan balik baru), latest applications, latest audit entries.
- **Permohonan** — queue of `Menunggu Verifikasi` (+ filter Perlu Perbaikan/Ditolak): row → detail drawer/modal with ALL application data (pas foto, data diri, profesional, pengalaman, kompetensi, sertifikat with status, dokumen links, pernyataan, catatan, history) and actions **Setujui** (dialog: kategori, masa berlaku default from config, catatan) / **Minta Perbaikan** (note required) / **Tolak** (reason required); optional "Kirim email" mailto prefilled to the applicant.
- **Anggota** — directory table: search, filter (status, kategori, provinsi), sort; actions: lihat detail, ubah kategori, perpanjang, nonaktifkan/aktifkan; CSV export.
- **Konten** — sub-tabs Berita, Pengumuman, Agenda, Produk Pengetahuan, Regulasi: list (static + managed, badge "Bawaan"/"Dikelola"), create/edit modal forms per SPEC v1 data shapes (+ pustaka shape §4.3), hide/delete. Note in demo: changes only in this browser.
- **Umpan Balik** — list with kategori, rating, status (Baru/Diproses/Selesai), detail, update status + admin note, mailto reply.
- **Admin** — list admins, add by email, remove.
- **Log Aktivitas** — audit list.
All rendered data escaped; destructive actions confirmed; every action → toast + refresh.

### 4.3 NEW `pustaka.html` — Produk Pengetahuan (`data-auth="public"`)
Data: `PPAPI.store.content.list('pustaka')` + regulations (`content.list('regulasi')`) as category "Peraturan Perundangan".
Item shape (`assets/data/pustaka.js`, `PPAPI_DATA.pustaka`):
`{ id, judul, kategori /* 'Standar' | 'Code of Practice' | 'Petunjuk Teknis' | 'Modul Pelatihan' | 'Formulir & Daftar Periksa' | 'Kajian Teknis' | 'Aplikasi' */, kode /* e.g. 'PPAPI-CoP-01' */, versi, tanggal, status /* 'Berlaku'|'Draf'|'Dalam Penyusunan' */, ringkasan, penyusun, format /* 'PDF'|'Aplikasi Web'|'Tautan'… */, halaman, akses /* 'anggota'|'publik' */, tautan /* file/app url or '' */, tag:[], contoh }`
Sections: page-hero; category overview tiles with counts (Standar, CoP, Peraturan Perundangan → links/filters regulasi, Petunjuk Teknis, Modul & Panduan Pelatihan, Formulir & Daftar Periksa, Kajian Teknis, Aplikasi Anggota); toolbar (search, category chips, status, sort); catalog grid/list of document cards (kode, judul, kategori, versi/tanggal, status badge, akses badge, contoh badge); item detail modal; **access**: active member/admin → "Buka Dokumen ↗"/"Buka Aplikasi" (via `store.pustaka.fileUrl`), others → lock + CTA (`ui.locked`). If `config.pustaka.katalogPublik === false` and viewer not active → only a locked hero panel. Featured: the two apps as large cards (category Aplikasi).
Sample items (contoh, status 'Dalam Penyusunan', tautan ''): CoP pemasangan perancah tube & coupler; CoP inspeksi & penandaan (scafftag); Petunjuk teknis perancah pada pekerjaan di ketinggian; Petunjuk teknis perancah sistem (ringlock/cuplock); Modul pelatihan teknisi perancah dasar; Modul inspektur perancah; Panduan penggunaan aplikasi PPAPI Scaffold & simulator; Formulir daftar periksa inspeksi perancah (derived from the app's 10 kategori / 52 butir — this one may be REAL if generated from the app data, then not contoh); Standar kompetensi PPAPI (rancangan). Apps items are real (not contoh).

### 4.4 Member apps (NEW `site/aplikasi/perencanaan/`, `site/aplikasi/simulator/`)
Ported from the legacy files per the analysis integration plans: gated by `site/aplikasi/gate.js` (loads `../../assets/js/config.js`, `core.js`, `auth.js`, `store.js`; hides the app until `session.ready()`; requires active member or admin; otherwise redirects to `../../dashboard.html` (signed-in non-active, toast) or `../../masuk.html?next=…`). Slim fixed **portal bar** on top ("← Portal Anggota PPAPI · <app title> · <name>") in the monochrome style. Planning app: SSO bridge maps the PPAPI member to the app's internal session (role mapping: PPAPI admin → app admin; others → app user), hides/neutralises the app's own login/user-management/Supabase panels where they conflict (keep app functionality), PWA manifest/sw scoped to its folder with a unique cache name (or disabled if risky). Simulator: same gate/bar; optional progress save to `member.profile`? (no — keep store whitelist; store simulator progress in localStorage per uid). Be honest in README: on a public static host the app files are publicly downloadable; gating is access control for the portal UX, not secrecy.

### 4.5 CHANGED pages
- `dashboard.html` (`required`): **non-active view** = status centre: big status card (effective status, statusLabel, admin note for Perlu Perbaikan/Ditolak), timeline (Akun dibuat → Formulir diajukan → Verifikasi sekretariat → Aktif), primary CTA (Lengkapi/Perbaiki/Ajukan ulang/Ajukan perpanjangan → pendaftaran.html; or "Lihat pengajuan"), and a grid of **locked feature teasers** (Kartu Anggota, Produk Pengetahuan, Aplikasi Perencanaan & Analisis, Simulator, Agenda & Regulasi khusus anggota) using `ui.locked`. **Active view** = current dashboard + "Produk Pengetahuan terbaru" + apps launch cards pointing to the internal apps + validity reminder (≤60 days → perpanjangan CTA). Admin: extra "Konsol Admin" card with pending count.
- `anggota.html` → `data-auth="active"`. Profile edits remain; KTA card uses real `validUntil`; Aplikasi tab → internal apps.
- `masuk.html` → after sign-up (no explicit next) go to `pendaftaran.html`; demo note shows the admin demo credentials.
- `keanggotaan.html` → alur pendaftaran reflects the real flow (Buat akun → Isi formulir → Verifikasi → Aktif & KTA → Akses fitur) + CTA "Mulai Pendaftaran" (signed in → pendaftaran.html; else masuk.html#daftar?next=pendaftaran.html).
- `verifikasi.html` → `store.registry.lookup`.
- `index.html`, `berita.html`, `agenda.html`, `dashboard.html` → read news/agenda/pengumuman via `store.content.list` (admin-managed content appears). `regulasi.html` → `store.content.list('regulasi')` + link back to pustaka.
- `index.html` → apps band now points to internal apps (locked CTA for non-active) and adds a "Produk Pengetahuan" highlight.
- `README.md` → admin guide (first admin setup, approving members, managing content & knowledge files, demo admin), new rules, apps section, limitations.

## 5. Definition of done (v2)
All v1 DoD items, plus: `node devtools/check.mjs all` + `--auth` (active member) + `--admin` + `--status=Draf` runs → 0 issues; dedicated Playwright flows for: full application journey (register → wizard → submit → admin approves in the same browser → member sees active features), revision loop, rejection, deactivate → features locked, content CRUD visible on public pages, pustaka locked vs unlocked, apps gate (non-active redirected, active sees app + portal bar, planning app SSO works), Firestore-rules review (static reasoning + `firebase-smoke` style stubs).
