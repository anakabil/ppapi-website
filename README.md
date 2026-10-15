# Situs PPAPI — repositori pengembangan

Situs resmi **Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)**, tayang di
<https://anakabil.github.io/ppapi-website/>.

Repositori ini adalah **satu-satunya sumber kebenaran**: kode situs, alat uji, dan spesifikasi
ada di sini, sehingga pengembangan dapat dilanjutkan dari komputer mana pun (atau sesi
Claude Code di cloud) tanpa bergantung pada satu PC.

## Struktur

| Folder/berkas | Isi |
|---|---|
| `site/` | Situs yang diterbitkan apa adanya ke GitHub Pages (HTML/CSS/JS, data konten, aplikasi anggota, `firestore.rules`). **Panduan pengelolaan untuk sekretariat: [`site/README.md`](site/README.md).** |
| `devtools/` | Alat uji: `check.mjs` (pemuatan halaman di Chromium headless), `flows/*.mjs` (uji alur Playwright, uji kontrak, cermin aturan Firestore, pagar label), catatan teknis (`FOUNDATION_NOTES.md`, `RELEASE_NOTES*.md`, `AUDIT*.md`), riset (`research/`), analisis aplikasi lama (`legacy/`). |
| `SPEC.md`, `SPEC-v2.md` | Spesifikasi desain & arsitektur (kontrak yang dipakai saat membangun). |
| `.github/workflows/pages.yml` | CI: setiap push ke `main` → pemeriksaan otomatis → terbit ke GitHub Pages. Bila ada pemeriksaan gagal, situs tidak diterbitkan. |

## Alur kerja pengembangan

```bash
git clone https://github.com/anakabil/ppapi-website.git
cd ppapi-website/devtools && npm ci && npx playwright install chromium
cd ..
node devtools/check.mjs all                 # memuat semua halaman (desktop + mobile), 0 masalah = lolos
node devtools/check.mjs dashboard --auth    # sesi anggota aktif (Mode Demo); --auth --status="Draf" dsb.; --admin
cd devtools && node flows/contract-v2.mjs   # uji kontrak; flows lain: masuk-flow, pendaftaran-flow, admin-flow, journey-v2 …
```

- Server uji menyajikan `config.js` dengan `apiKey` kosong (Mode Demo) agar uji tidak menyentuh
  proyek Firebase; gunakan `PPAPI_REAL_FIREBASE=1` untuk menguji mode Firebase sungguhan.
- Aturan klien yang dijaga otomatis (`flows/branding-guard.mjs`, `flows/release-v2-client-rules.mjs`):
  tidak ada label atribusi lama; kredit pengembang hanya `mrezahuzain@2026`; judul aplikasi
  perencanaan memuat "(Beta)"; `siteUrl` tetap kosong di sumber (CI menyisipkannya saat terbit).
- Terbitkan: cukup `git push` ke `main`. CI menjalankan semua pemeriksaan lalu men-deploy `site/`.
  Pantau di tab **Actions**.

## Firebase

Proyek `ppapi-web`. Konfigurasi web ada di `site/assets/js/config.js` (bukan rahasia; keamanan
data diatur `site/firestore.rules`). Setiap perubahan `firestore.rules` harus **ditempel ulang
dan di-Publish** di Firebase Console → Firestore → Rules (CI tidak menerbitkan aturan).
Lihat `site/README.md` bagian 6, 10, dan 11.
