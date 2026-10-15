/* ==========================================================================
   DATA KOMPETENSI  (assets/data/kompetensi.js)
   --------------------------------------------------------------------------
   Katalog kualifikasi/jabatan kerja yang berkaitan dengan perancah. Dipakai
   di Halaman Anggota (tab Kompetensi) sebagai pilihan saat anggota menambah
   kompetensi. Isi katalog disusun dari sumber resmi per 8 Oktober 2026
   (SKKNI/Kepmenaker, Keputusan Dirjen Bina Konstruksi 114/KPTS/Dk/2024,
   daftar LSP berekomendasi Ditjen Migas, Permenaker 9/2016, dan CISRS) —
   lihat isian "sumber" pada tiap butir.

   CARA MENAMBAH KOMPETENSI
   Salin satu blok { … } di dalam "katalog", lalu ubah:
     kode      : kode unik singkat, contoh 'SCF-17'
     nama      : nama kualifikasi/jabatan kerja
     kelompok  : 'Pelaksana', 'Pengawas', 'Inspeksi', 'Perencanaan & Desain', 'K3'
                 (boleh kelompok baru — akan tampil sebagai grup tersendiri)
     deskripsi : penjelasan singkat
     sumber    : daftar alamat rujukan (opsional)
   "level" dan "penerbit" adalah pilihan isian pada formulir anggota.
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};
PPAPI_DATA.kompetensi = {
  katalog: [
    {
      kode: "SCF-01",
      nama: "Tukang Pasang Perancah dan Acuan/Cetakan Beton",
      kelompok: "Pelaksana",
      deskripsi: "Jabatan kerja SKK Konstruksi jenjang 1 (subklasifikasi Gedung) untuk pemasangan perancah serta acuan/cetakan beton, mengacu SKKNI 54-2015.",
      sumber: ["https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf", "https://jdih.kemnaker.go.id/peraturan/detail/1055/keputusan-menaker-nomor-54-tahun-2015"]
    },
    {
      kode: "SCF-02",
      nama: "Kepala Tukang Pasang Perancah dan Acuan/Cetakan Beton",
      kelompok: "Pelaksana",
      deskripsi: "Jabatan kerja SKK Konstruksi jenjang 2 (subklasifikasi Gedung) yang memimpin regu pemasangan perancah serta acuan/cetakan beton, mengacu SKKNI 54-2015.",
      sumber: ["https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf", "https://jdih.kemnaker.go.id/peraturan/detail/1055/keputusan-menaker-nomor-54-tahun-2015"]
    },
    {
      kode: "SCF-03",
      nama: "Operator Pemula Scaffolding",
      kelompok: "Pelaksana",
      deskripsi: "Kualifikasi operator SKK Konstruksi jenjang 2 pada subklasifikasi Alat Berat (klasifikasi Mekanikal) untuk pekerjaan scaffolding, mengacu SKKNI 46-2022.",
      sumber: ["https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf", "https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022"]
    },
    {
      kode: "SCF-04",
      nama: "Operator Scaffolding",
      kelompok: "Pelaksana",
      deskripsi: "Kualifikasi operator SKK Konstruksi jenjang 3 pada subklasifikasi Alat Berat untuk pemasangan dan pembongkaran scaffolding, mengacu SKKNI 46-2022.",
      sumber: ["https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf", "https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022"]
    },
    {
      kode: "SCF-05",
      nama: "Teknisi Scaffolding",
      kelompok: "Pelaksana",
      deskripsi: "Kualifikasi teknisi/analis SKK Konstruksi jenjang 4 pada subklasifikasi Alat Berat untuk pekerjaan scaffolding, mengacu SKKNI 46-2022.",
      sumber: ["https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf", "https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022"]
    },
    {
      kode: "SCF-06",
      nama: "Pengawas Scaffolding",
      kelompok: "Pengawas",
      deskripsi: "Kualifikasi teknisi/analis SKK Konstruksi jenjang 5 untuk pengawasan pekerjaan scaffolding (SKKNI 46-2022); skema serupa juga tersedia pada LSP sektor migas.",
      sumber: ["https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf", "https://migas.esdm.go.id/cms/uploads/informasi-publik/DAFTAR%20SERTIFIKASI%20LSP/Daftar%20Lembaga%20Sertifikasi%20Profesi%20Juli.pdf"]
    },
    {
      kode: "SCF-07",
      nama: "Operator Scaffolding Dasar / Lanjut (Basic / Advanced Scaffolder)",
      kelompok: "Pelaksana",
      deskripsi: "Skema sertifikasi LSP yang memperoleh rekomendasi Ditjen Migas untuk pemasang scaffolding tingkat dasar dan lanjut di sektor minyak dan gas bumi.",
      sumber: ["https://migas.esdm.go.id/cms/uploads/informasi-publik/DAFTAR%20SERTIFIKASI%20LSP/Daftar%20Lembaga%20Sertifikasi%20Profesi%20Juli.pdf", "https://migas.esdm.go.id/cms/uploads/informasi-publik/DAFTAR%20SERTIFIKASI%20LSP/1cc57b491582ac74f5d07b27abf0a422.pdf"]
    },
    {
      kode: "SCF-08",
      nama: "Perancang Scaffolding",
      kelompok: "Perencanaan & Desain",
      deskripsi: "Skema sertifikasi LSP sektor migas bagi personel yang merancang konfigurasi scaffolding sebelum dipasang.",
      sumber: ["https://migas.esdm.go.id/cms/uploads/informasi-publik/DAFTAR%20SERTIFIKASI%20LSP/Daftar%20Lembaga%20Sertifikasi%20Profesi%20Juli.pdf", "https://migas.esdm.go.id/cms/uploads/informasi-publik/DAFTAR%20SERTIFIKASI%20LSP/1cc57b491582ac74f5d07b27abf0a422.pdf"]
    },
    {
      kode: "SCF-09",
      nama: "Inspektur Scaffolding",
      kelompok: "Inspeksi",
      deskripsi: "Skema sertifikasi LSP sektor migas bagi personel yang memeriksa kelaikan scaffolding sebelum dan selama digunakan.",
      sumber: ["https://migas.esdm.go.id/cms/uploads/informasi-publik/DAFTAR%20SERTIFIKASI%20LSP/Daftar%20Lembaga%20Sertifikasi%20Profesi%20Juli.pdf", "https://migas.esdm.go.id/cms/uploads/informasi-publik/DAFTAR%20SERTIFIKASI%20LSP/1cc57b491582ac74f5d07b27abf0a422.pdf"]
    },
    {
      kode: "SCF-10",
      nama: "Tenaga Kerja Bangunan Tinggi (TKBT) Tingkat 1 dan 2",
      kelompok: "K3",
      deskripsi: "Kategori tenaga kerja berlisensi K3 menurut Permenaker 9/2016 yang bekerja pada lantai kerja tetap dan/atau sementara serta bergerak pada struktur bangunan; relevan bagi pekerja di platform perancah.",
      sumber: ["https://peraturan.bpk.go.id/Download/252144/Kemnaker%20No.%209%20Tahun%202016.pdf", "https://peraturan.bpk.go.id/Details/146109/permenaker-no-9-tahun-2016"]
    },
    {
      kode: "SCF-11",
      nama: "Tenaga Kerja pada Ketinggian (TKPK) Tingkat 1, 2, dan 3",
      kelompok: "K3",
      deskripsi: "Kategori tenaga kerja berlisensi K3 menurut Permenaker 9/2016 dengan kewenangan berjenjang mulai dari membuat angkur, pertolongan darurat, hingga menyusun perencanaan sistem keselamatan kerja di ketinggian.",
      sumber: ["https://peraturan.bpk.go.id/Download/252144/Kemnaker%20No.%209%20Tahun%202016.pdf", "https://jdih.kemnaker.go.id/peraturan/detail/1993/keputusan-menteri-ketenagakerjaan-nomor-393-tahun-2020"]
    },
    {
      kode: "SCF-12",
      nama: "Petugas K3 Konstruksi",
      kelompok: "K3",
      deskripsi: "Jabatan kerja SKK Konstruksi jenjang 3 (subklasifikasi Keselamatan Konstruksi) yang mengacu SKKNI 13-2024 sebagaimana diubah Kepmenaker 77/2024.",
      sumber: ["https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf", "https://jdih.kemnaker.go.id/peraturan/detail/2475/keputusan-menteri-ketenagakerjaan-nomor-77-tahun-2024"]
    },
    {
      kode: "SCF-13",
      nama: "Ahli K3 Konstruksi (Muda, Madya, Utama)",
      kelompok: "K3",
      deskripsi: "Jabatan kerja SKK Konstruksi jenjang 7–9 (subklasifikasi Keselamatan Konstruksi) mengacu SKKNI 350-2014, yang berperan menyusun dan meninjau Analisis Keselamatan Konstruksi untuk pekerjaan perancah.",
      sumber: ["https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf", "https://peraturan.go.id/files/bn286-2021.pdf"]
    },
    {
      kode: "SCF-14",
      nama: "CISRS Scaffolder dan Advanced Scaffolder",
      kelompok: "Pelaksana",
      deskripsi: "Kartu kompetensi pemasang perancah dari skema CISRS (Inggris), tersedia untuk tube & fitting maupun system scaffold; di luar Inggris diselenggarakan melalui program OSTS Level 1–3.",
      sumber: ["https://cisrs.org.uk/training/cisrs-cards/scaffolder-system.html", "https://cisrs.org.uk/cisrs-overseas-scaffolder-training-scheme"]
    },
    {
      kode: "SCF-15",
      nama: "CISRS Basic dan Advanced Scaffold Inspection",
      kelompok: "Inspeksi",
      deskripsi: "Kualifikasi CISRS untuk pemeriksaan perancah sederhana (basic) dan kompleks (advanced), juga ditawarkan pada program internasional OSTS.",
      sumber: ["https://cisrs.org.uk/training/cisrs-cards/scaffolder-system.html", "https://cisrs.org.uk/cisrs-overseas-scaffolder-training-scheme"]
    },
    {
      kode: "SCF-16",
      nama: "CISRS Scaffolding Supervisor",
      kelompok: "Pengawas",
      deskripsi: "Kualifikasi CISRS bagi pemegang kartu scaffolder atau manajer/pengawas konstruksi yang mengelola operasi perancah (kartu Manager & Supervisor).",
      sumber: ["https://www.citb.co.uk/national-construction-college/scaffolding-and-access/CISRS-Scaffolding-Supervisor/", "https://cisrs.org.uk/training/cisrs-cards/scaffolder-system.html"]
    }
  ],
  level: ['Dasar', 'Menengah', 'Mahir', 'Ahli'],
  penerbit: ['BNSP / LSP', 'Kemnaker RI', 'LPJK / Kementerian PU', 'Lembaga Internasional (CISRS, dll.)', 'Lainnya']
};
