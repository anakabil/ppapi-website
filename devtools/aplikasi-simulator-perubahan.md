# Simulator — catatan perubahan antarmuka (11 Oktober 2026)

Untuk pemilik `site/aplikasi/gate.css` + `gate.js` dan `devtools/flows/aplikasi-flow.mjs`.
Instruksi klien: *"ubah user interface aplikasi (simulator pemasangan dan perhitungan beban) agar selaras dengan tema website"* — bagian simulator.

## 1. Perubahan pada bilah portal / gate — TIDAK ADA

Simulator hanya memakai token `--pp-*` dan `--pbar-h` dari `gate.css` apa adanya. Tidak ada permintaan perubahan pada `gate.css` / `gate.js`.

## 2. Selektor / teks yang diases `aplikasi-flow.mjs` — TIDAK BERUBAH

Semua id/kelas yang dipakai bagian **A4**, **C8**, **D**, dan **E** tetap: `#startBtn`, `#tab-lib/#tab-build/#tab-insp`, `#placeBtn`, `#undoBtn`, `.prog .cnt`, `.prog .bar[aria-valuenow]`, `[data-insp]`, `[data-lib]`, `#labels .lbl`, `.toggle .tlbl`, `#camToggle`, `#sheetToggle`, `#sim-msg`, `#sim-msg-btn`, `#toast[role=status]`, `#toastMsg`, judul bilah `Simulator Pemasangan Perancah Tube & Coupler`, kunci `localStorage ppapi_progress_<uid>_simulator`.
Dijalankan ulang setelah perubahan: `node flows/aplikasi-flow.mjs --only=D,E` → 72/72 lulus (D 43/43 · E 29/29).

Satu perubahan markup yang mungkin relevan bila nanti ada ases baru: isi `#sim-msg .box` kini `svg + div(h2, p, button)` (gaya `.alert` situs); teks dan id tidak berubah. Tombol `#sim-msg-btn` membungkus labelnya dalam `<span>` (sapuan kilau tombol primer).

## 3. Ringkasan perubahan (milik simulator)

- `simulator.css` ditulis ulang: adegan berlatar grafit/baja (`--sim-stage: #202024`, sama dengan `scene.background`), panel/kartu kertas (`--pp-paper`) dengan garis logam, eyebrow bergaris + simpul klem, tab modul kaca gelap dengan tab aktif tulang, tombol pola `.btn` situs (kondensasi kapital, kilau logam pada primer, isi geser pada ghost), sakelar inspeksi monokrom (warna alat ukur hanya sebagai swatch legenda), status/alert memakai tint pudar situs (`#46604e` / `#86443e` / `#6b5726` = `--c-ok-ink` dst. di main.css), legenda & kontrol kamera kaca gelap, label 3D keping kertas, pesan cadangan bergaya `.alert`, `prefers-reduced-motion` mematikan kilau/transisi.
- `simulator.js`: hanya blok latar/lampu/lantai/pedestal (`scene.background`/`fog` → 0x202024, cakram lantai 0x2c2c31 r=36, kisi perak 0x8B8B92/0x5C5C63 α .32, lampu studio netral). Warna fungsional (pita klem, tag, alat ukur, sorotan) tidak diubah; geometri, urutan, inspeksi tidak disentuh.
- `index.html`: ikon pada `#sim-msg`, salinan layar pembuka: "pengaku diagonal (bracing)", "label status (tag)", "papan kaki (toe board)" pada penyebutan pertama.
- Perbaikan bug: `#sim-msg-btn[hidden]` dulu tetap tampak (`.btn{display:inline-flex}` menimpa `[hidden]`) → kini `#sim-msg .btn[hidden]{display:none}`.
- Flow baru: `node flows/retheme-simulator-shots.mjs [--only=desktop,mobile,tablet,landscape,fallback] [--steps=all]` → `shots/retheme-sim-*.png`.
