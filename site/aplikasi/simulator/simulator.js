/* ==========================================================================
   Simulator Pemasangan Perancah Tube & Coupler  (aplikasi/simulator/simulator.js)
   --------------------------------------------------------------------------
   Aset aplikasi anggota PPAPI, diporting dari simulator.html lama (satu sumber
   kode; salinan base64 di aplikasi perencanaan lama tidak dipakai lagi).
   Perubahan porting dicatat di aplikasi/CATATAN.md; koreksi geometri & urutan
   (disetujui klien, Oktober 2026) dicatat di aplikasi/KOREKSI-SIMULATOR.md.
   • Tidak ada yang berjalan sebelum gerbang (../gate.js) memastikan anggota
     berstatus Aktif atau admin: gate.js memanggil window.PPAPI_APP_START.
     three.js r128 dimuat SETELAH itu (cdnjs + SRI), adegan 3D dibuat saat
     anggota menekan "Mulai Simulasi".
   • Geometri dikoreksi: menara 2 bay × 2,0 m, lebar 1,2 m, lift 1,95 m;
     top rail 1,0 m, mid rail 0,53 m, toe board 150 mm; bentang papan ≤ 1,2 m;
     outrigger sebelum tinggi > 4 × lebar dasar; setiap lantai kerja punya tangga 4:1 yang
     bersandar & diikat pada top rail yang tetap, di samping pintu yang menutup sendiri.
   • Urutan 20 tahap dikoreksi: persiapan & tag merah → dasar → standard →
     ledger/transom → bracing per lift → outrigger → pelindung tepi sebelum
     lantai dinaiki → tangga & pintu → inspeksi serah terima → tag hijau.
   • Mode inspeksi MENGUKUR model (bukan tanda ✓ tetap): tinggi rail, celah,
     toe board, bentang papan, bracing, rasio stabilitas (hanya outrigger yang
     tersambung), tumpuan & ikatan tangga, pintu, akses tiap lantai; tag diperiksa.
   • Ukuran kanvas mengikuti wadah, render hanya saat ada perubahan, bayangan
     dihitung ulang hanya saat isi adegan berubah, geometri & material dipakai
     bersama, objek sementara dibuang (dispose).
   • Kemajuan latihan disimpan di peramban ini per anggota:
     localStorage 'ppapi_progress_<uid>_simulator' (bukan di data keanggotaan).
   ========================================================================== */
(function (w, d) {
  'use strict';
  var THREE_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var THREE_SRI = 'sha512-dLxUelApnYxpLt6K2iomGngnHO83iUvZytA3YjDUCjT0HDOHKXnVYdf3hU4JjM8uEhxf9nD1/ey98U3t2vZ0qQ==';
  /* versi urutan perakitan: kemajuan dari urutan lama (sebelum koreksi Oktober 2026)
     tidak dapat dipetakan ke urutan baru, sehingga perakitan dimulai ulang */
  var SEQ = 'tc-2026.10-r2';
  var STEP_IDS = ['persiapan', 'alas', 'standard', 'ledger-dasar', 'transom-dasar', 'ledger-l1', 'transom-l1',
    'bracing-l1', 'outrigger', 'sambung', 'pagar-l1', 'lantai-l1', 'ledger-l2', 'transom-l2', 'bracing-l2',
    'pagar-atas', 'lantai-atas', 'tangga', 'inspeksi', 'tag-hijau'];
  var TOTAL = STEP_IDS.length;
  var TOOL_RE = /^(vert|horz|dist|square|edge|stab)$/;
  var USER = null, PKEY = '', prog = null, SIM = null, threeP = null, starting = false;

  function $(id) { return d.getElementById(id); }
  function loadThree() {
    if (w.THREE) return Promise.resolve();
    if (threeP) return threeP;
    threeP = new Promise(function (res, rej) {
      var s = d.createElement('script');
      s.src = THREE_SRC; s.integrity = THREE_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = function () { if (w.THREE) res(); else { threeP = null; rej(new Error('three')); } };
      s.onerror = function () { threeP = null; s.remove(); rej(new Error('three')); };
      d.head.appendChild(s);
    });
    return threeP;
  }
  function webglOK() {
    try {
      var c = d.createElement('canvas');
      return !!(w.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; }
  }

  /* ---------- kemajuan latihan (per anggota, di peramban ini) ---------- */
  function readProgress() {
    try {
      var o = JSON.parse(localStorage.getItem(PKEY) || 'null');
      if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
      var same = o.seq === SEQ, tools = {};
      if (o.tools && typeof o.tools === 'object' && !Array.isArray(o.tools)) {
        Object.keys(o.tools).forEach(function (k) { if (TOOL_RE.test(k) && o.tools[k] === true) tools[k] = true; });
      }
      return {
        v: 2, seq: SEQ, total: TOTAL,
        current: same ? Math.max(0, Math.min(TOTAL, parseInt(o.current, 10) || 0)) : 0,
        completedAt: same && typeof o.completedAt === 'string' ? o.completedAt.slice(0, 40) : '',
        updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt.slice(0, 40) : '',
        tools: tools,
        libSeen: Array.isArray(o.libSeen) ? o.libSeen.filter(function (x) { return typeof x === 'string' && /^[a-z]{2,16}$/.test(x); }).slice(0, 24) : [],
        migrated: !same && (parseInt(o.current, 10) || 0) > 0
      };
    } catch (e) { return null; }
  }
  function writeProgress() {
    try {
      var o = {};
      Object.keys(prog).forEach(function (k) { if (k !== 'migrated') o[k] = prog[k]; });
      localStorage.setItem(PKEY, JSON.stringify(o));
    } catch (e) { /* penyimpanan penuh/diblokir */ }
  }
  function onProgress(ev) {
    if (!prog || !ev) return;
    if (typeof ev.current === 'number') {
      prog.current = Math.max(0, Math.min(TOTAL, ev.current));
      if (prog.current >= TOTAL && !prog.completedAt) prog.completedAt = new Date().toISOString();
    }
    if (ev.tool && TOOL_RE.test(ev.tool)) prog.tools[ev.tool] = true;
    if (ev.lib && /^[a-z]{2,16}$/.test(ev.lib) && prog.libSeen.indexOf(ev.lib) < 0) prog.libSeen.push(ev.lib);
    prog.migrated = false;
    prog.updatedAt = new Date().toISOString();
    writeProgress();
  }

  /* ---------- pesan pengganti adegan 3D ---------- */
  function showMsg(kind) {
    var box = $('sim-msg'), t = $('sim-msg-title'), p = $('sim-msg-text'), b = $('sim-msg-btn');
    if (!box) return;
    var M = {
      nowebgl: ['Tampilan 3D tidak tersedia', 'Peramban atau perangkat ini tidak mendukung WebGL, sehingga simulator 3D tidak dapat ditampilkan. Coba buka di Chrome, Edge, Firefox, atau Safari versi terbaru dan pastikan akselerasi grafis aktif.', false],
      nocdn: ['Mesin 3D tidak dapat dimuat', 'Pustaka tampilan 3D (three.js) gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman.', true],
      error: ['Simulator gagal dimulai', 'Terjadi kendala saat menyiapkan adegan 3D. Silakan muat ulang halaman.', true],
      lost: ['Memulihkan tampilan 3D…', 'Perangkat sedang memulihkan konteks grafis. Tampilan akan kembali dengan sendirinya.', false]
    }[kind];
    t.textContent = M[0]; p.textContent = M[1]; b.hidden = !M[2];
    b.onclick = function () { w.location.reload(); };
    box.classList.toggle('is-soft', kind === 'lost');
    box.hidden = false;
    var intro = $('intro'); if (intro && kind !== 'lost') intro.hidden = true;
  }
  function hideMsg() { var box = $('sim-msg'); if (box) box.hidden = true; }

  /* ---------- layar pembuka ---------- */
  function setupIntro() {
    prog = readProgress() || { v: 2, seq: SEQ, total: TOTAL, current: 0, completedAt: '', updatedAt: '', tools: {}, libSeen: [], migrated: false };
    var start = $('startBtn'), restart = $('restartBtn'), note = $('introResume');
    var n = prog.current;
    if (n > 0) {
      start.innerHTML = (n >= TOTAL ? 'Lihat Perancah Lengkap' : 'Lanjutkan Perakitan') + ' <span aria-hidden="true">→</span>';
      restart.hidden = false;
      note.hidden = false;
      note.textContent = n >= TOTAL
        ? 'Anda telah menyelesaikan seluruh ' + TOTAL + ' tahap perakitan' + (prog.completedAt ? ' pada ' + fmtDate(prog.completedAt) : '') + '.'
        : 'Kemajuan terakhir: ' + n + ' dari ' + TOTAL + ' tahap selesai' + (prog.updatedAt ? ' · ' + fmtDate(prog.updatedAt) : '') + '.';
    } else if (prog.migrated) {
      note.hidden = false;
      note.textContent = 'Urutan perakitan telah diperbarui (Oktober 2026) agar sesuai praktik baik: persiapan dan tag merah di awal, bracing setiap lift, outrigger lebih awal, pelindung tepi sebelum lantai dinaiki, pintu akses yang menutup sendiri, serta inspeksi sebelum tag hijau. Latihan perakitan dimulai kembali dari tahap 1.';
    }
    start.onclick = function () { begin(n > 0 ? 'resume' : 'new', n); };
    restart.onclick = function () { begin('new', 0); };
  }
  function begin(mode, n) {
    if (starting || SIM) return;
    starting = true;
    var start = $('startBtn'), restart = $('restartBtn');
    var label = start.innerHTML;
    start.disabled = true; restart.disabled = true; start.setAttribute('aria-busy', 'true');
    start.textContent = 'Memuat mesin 3D…';
    function restore() { start.innerHTML = label; start.disabled = false; restart.disabled = false; start.removeAttribute('aria-busy'); starting = false; }
    loadThree().then(function () {
      if (!webglOK()) { restore(); showMsg('nowebgl'); return; }
      if (mode === 'new') { prog.current = 0; prog.completedAt = ''; prog.migrated = false; prog.updatedAt = new Date().toISOString(); writeProgress(); }
      try {
        SIM = createSim({ onProgress: onProgress, onContextLost: function (lost) { if (lost) showMsg('lost'); else hideMsg(); } });
      } catch (e) {
        restore();
        if (w.console) console.error('[PPAPI] Simulator gagal dimulai:', e);
        showMsg('error');
        return;
      }
      w.PPAPISim = SIM;
      $('intro').hidden = true;
      if (mode === 'resume' && n > 0) SIM.resume(n); else SIM.switchTab('lib');
      var tab = d.querySelector('#tabs .tab.on'); if (tab) tab.focus();
      starting = false;
    }, function () { restore(); showMsg('nocdn'); });
  }

  /* dipanggil gate.js setelah status keanggotaan Aktif / admin dipastikan */
  w.PPAPI_APP_START = function (u) {
    if (USER) return;
    USER = u || {};
    PKEY = 'ppapi_progress_' + String(USER.uid || 'anon') + '_simulator';
    setupIntro();
    /* pramuat three.js agar "Mulai Simulasi" terasa instan (adegan belum dibuat) */
    setTimeout(function () { loadThree().catch(function () { /* dicoba lagi saat tombol ditekan */ }); }, 900);
  };

/* ==========================================================================
   ADEGAN 3D — dibuat sekali di dalam createSim()
   ========================================================================== */
function createSim(opts){
  opts = opts || {};
  const IS_PHONE = Math.min(screen.width||9999, screen.height||9999) <= 600;
  const REDUCED = (function(){ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } })();
  const report = typeof opts.onProgress==='function' ? opts.onProgress : function(){};
  const panelEl = document.getElementById('panel');
  let MODE = 'lib';                                   /* lib | build | insp — dideklarasikan lebih awal */
  let dirty = true, shadowDirty = true;
  function markDirty(){ dirty = true; shadowDirty = true; }   /* isi adegan berubah: render + bayangan */
  function markView(){ dirty = true; }                        /* hanya kamera: bayangan tidak dihitung ulang */
  const SHARED_MATS = new Set(), SHARED_GEOS = new Set(), GEO_CACHE = new Map();
  function sharedGeo(key, make){ let g=GEO_CACHE.get(key); if(!g){ g=make(); GEO_CACHE.set(key,g); SHARED_GEOS.add(g); } return g; }
  function disposeTree(o){
    if(!o) return;
    o.traverse(function(n){
      if(n.geometry && !SHARED_GEOS.has(n.geometry)) n.geometry.dispose();
      const m=n.material; if(m) (Array.isArray(m)?m:[m]).forEach(function(x){ if(x && !SHARED_MATS.has(x)) x.dispose(); });
    });
  }
const container = document.getElementById('app-main');
const labelLayer = document.getElementById('labels');

/* ---------- renderer / scene / camera ---------- */
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_PHONE?1.5:2));
renderer.setSize(Math.max(1,container.clientWidth), Math.max(1,container.clientHeight));
renderer.domElement.setAttribute('role','img');
renderer.domElement.setAttribute('aria-label','Adegan 3D perancah. Saat terfokus: panah untuk memutar, plus atau minus untuk memperbesar atau memperkecil, Enter untuk memasang komponen berikutnya.');
renderer.domElement.tabIndex=0;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;               /* bayangan hanya dihitung ulang saat isi adegan berubah */
container.insertBefore(renderer.domElement, container.firstChild);

/* Latar studio grafit/baja (selaras dengan hero gelap situs; nilai = --sim-stage di simulator.css).
   Warna fungsional di dalam adegan (pita klem, tag, alat ukur, sorotan) tidak diubah. */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202024);
scene.fog = new THREE.Fog(0x202024, 12, 36);        /* tepi cakram lantai lebur ke latar */

const camera = new THREE.PerspectiveCamera(45, Math.max(1,container.clientWidth)/Math.max(1,container.clientHeight), 0.1, 200);

/* ---------- lights: cahaya studio netral (langit tulang, pantulan lantai baja) ---------- */
scene.add(new THREE.HemisphereLight(0xf4f4f2, 0x5c5c63, 0.95));
const key = new THREE.DirectionalLight(0xfff8ee, 1.25);
key.position.set(6, 11, 5);
key.castShadow = true;
key.shadow.mapSize.set(IS_PHONE?1024:2048, IS_PHONE?1024:2048);
key.shadow.camera.near=1; key.shadow.camera.far=40;
key.shadow.camera.left=-9; key.shadow.camera.right=9;
key.shadow.camera.top=9; key.shadow.camera.bottom=-9;
key.shadow.bias=-0.0004; key.shadow.normalBias=0.02;
scene.add(key);
const fill = new THREE.DirectionalLight(0xc8ccd4, 0.5); fill.position.set(-7,5,-4); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.55); rim.position.set(-3,6,-9); scene.add(rim);

/* ---------- ground + grid: cakram lantai baja gelap dengan kisi perak samar ---------- */
const ground = new THREE.Group(); scene.add(ground);
const floorMat = new THREE.MeshStandardMaterial({color:0x2c2c31, roughness:.96, metalness:.05});
const floor = new THREE.Mesh(new THREE.CircleGeometry(36,72), floorMat);
floor.rotation.x = -Math.PI/2; floor.position.y = -0.05; floor.receiveShadow = true;
ground.add(floor);
const grid = new THREE.GridHelper(40, 80, 0x8B8B92, 0x5C5C63);
grid.position.y = -0.04; grid.material.opacity = .32; grid.material.transparent = true;
ground.add(grid);

/* pedestal for coupler library */
const pedestal = new THREE.Group(); scene.add(pedestal);
const pedDisc = new THREE.Mesh(new THREE.CylinderGeometry(1.55,1.7,0.12,64),
  new THREE.MeshStandardMaterial({color:0x050506, roughness:.95, metalness:0}));   /* warna material tidak dilinierkan (r128) dan dicerahkan output sRGB: tampak ±#4a4a50 di bawah lampu */
pedDisc.position.y=-0.06; pedDisc.receiveShadow=true; pedestal.add(pedDisc);
const pedRing = new THREE.Mesh(new THREE.TorusGeometry(1.5,0.02,8,80),
  new THREE.MeshStandardMaterial({color:0xb9b9bf, emissive:0x8b8b92, emissiveIntensity:.35, metalness:.6, roughness:.4}));
pedRing.rotation.x=Math.PI/2; pedRing.position.y=0.01; pedestal.add(pedRing);
pedestal.visible=false;

/* ---------- materials (dipakai bersama; tidak di-dispose) ---------- */
const M = {
  steel: new THREE.MeshStandardMaterial({color:0xb0bac2, metalness:.5, roughness:.4}),
  steelLight: new THREE.MeshStandardMaterial({color:0xc4ced5, metalness:.45, roughness:.42}),
  darkSteel: new THREE.MeshStandardMaterial({color:0x59636f, metalness:.6, roughness:.4}),
  plate: new THREE.MeshStandardMaterial({color:0x3d4651, metalness:.55, roughness:.5}),
  wood: new THREE.MeshStandardMaterial({color:0xc89a5b, metalness:0, roughness:.85}),
  woodDark: new THREE.MeshStandardMaterial({color:0x8a6233, metalness:0, roughness:.9}),
  post: new THREE.MeshStandardMaterial({color:0x2b2f34, metalness:.2, roughness:.7}),
  tape: new THREE.MeshStandardMaterial({color:0xd0463a, emissive:0x5a120c, emissiveIntensity:.25, roughness:.6}),
  tapeW: new THREE.MeshStandardMaterial({color:0xf2f2f0, roughness:.6}),
  spring: new THREE.MeshStandardMaterial({color:0xE0C341, metalness:.3, roughness:.5}),
  paper: new THREE.MeshStandardMaterial({color:0xffffff, emissive:0xffffff, emissiveIntensity:.15}),
  tie: new THREE.MeshStandardMaterial({color:0x111111}),
  holder: new THREE.MeshStandardMaterial({color:0x20262b, metalness:.4, roughness:.6}),
  tagRed: new THREE.MeshStandardMaterial({color:0xE74C3C, emissive:0xE74C3C, emissiveIntensity:.25, roughness:.5, metalness:.1}),
  tagGreen: new THREE.MeshStandardMaterial({color:0x2ECC71, emissive:0x2ECC71, emissiveIntensity:.25, roughness:.5, metalness:.1}),
};
/* sorotan komponen berikutnya: sedikit lebih pekat agar jelas di latar terang */
const ghostMat = new THREE.MeshStandardMaterial({color:0xF5A623, transparent:true, opacity:.48,
  metalness:.1, roughness:.6, emissive:0xF5A623, emissiveIntensity:.5, depthWrite:false});
/* galvanis cerah (hot-dip) untuk model klem realistis */
const GALV  = new THREE.MeshStandardMaterial({color:0xd6dbe0, metalness:.72, roughness:.33});
const GALV2 = new THREE.MeshStandardMaterial({color:0xb9c0c8, metalness:.7,  roughness:.4});
const BOLT  = new THREE.MeshStandardMaterial({color:0xeef1f4, metalness:.82, roughness:.25});
Object.keys(M).forEach(function(k){ SHARED_MATS.add(M[k]); });
[ghostMat,GALV,GALV2,BOLT].forEach(function(m){ SHARED_MATS.add(m); });

/* ---------- katalog komponen ---------- */
const COUPLER = {
  tube:    {hex:0xb0bac2, color:'#b0bac2', name:'Pipa / Tube (Ø48,3 mm)',
            sudut:'—', beban:'Elemen utama', tebal:'3,2–4,0 mm',
            fungsi:'Pipa baja galvanis Ø48,3 mm — bahan dasar seluruh perancah. Dipakai sebagai standard (vertikal), ledger & transom (horizontal), serta bracing (diagonal). Pipa bengkok, retak, atau berkarat parah dipisahkan dan tidak dipakai.'},
  soleboard:{hex:0xc89a5b, color:'#c89a5b', name:'Sole Board (Papan Alas)',
            sudut:'—', beban:'Distribusi ke tanah', tebal:'Papan kayu (model 225 × 38 mm)',
            fungsi:'Papan alas di bawah base plate. Menyebar beban kaki perancah ke tanah agar tidak amblas. Ukurannya ditentukan dari beban kaki dan daya dukung tanah; pijakan harus rata, kokoh, dan tidak bergeser.'},
  baseplate:{hex:0x3d4651, color:'#3d4651', name:'Base Plate / Jack Dasar',
            sudut:'—', beban:'Tumpuan standard', tebal:'Luas ≥ 150 cm², lebar ≥ 120 mm',
            fungsi:'Pelat dasar penumpu standard (BS EN 12811-1:2003 butir 5.7.1: luas pelat minimal 150 cm² dan lebar minimal 120 mm; butir 5.7.2: base plate baja sesuai EN 74). Versi base jack (ulir) dapat disetel tinggi untuk meratakan struktur pada permukaan miring.'},
  fix:     {hex:0xE8503A, color:'#E8503A', name:'Klem Mati / Right-Angle (Fix)',
            sudut:'90° tetap', beban:'Struktural (load-bearing)', tebal:'Double coupler',
            fungsi:'Menyambung dua pipa tegak lurus 90°. Penyambung struktural utama yang memikul beban — menghubungkan standard dengan ledger, serta ledger dengan transom.'},
  swivel:  {hex:0xF2A33C, color:'#F2A33C', name:'Klem Putar / Swivel (EN 74)',
            sudut:'Bebas (berputar)', beban:'Bracing & outrigger', tebal:'Double coupler',
            fungsi:'Sendi yang berputar ke sudut berapa pun (EN 74). Dipakai untuk bracing diagonal dan outrigger agar struktur kaku dan stabil. Bukan pemikul beban tegak lurus utama — itu tugas klem mati.'},
  sleeve:  {hex:0x3FA7E0, color:'#3FA7E0', name:'Klem Sambung Luar (Sleeve)',
            sudut:'Segaris (lurus)', beban:'Sambungan kuat', tebal:'External joint',
            fungsi:'Menyambung dua pipa ujung-ke-ujung dari luar untuk memperpanjang standard. Lebih kuat menahan momen daripada joint pin. Sambungan standard yang bersebelahan dibuat selang-seling.'},
  jointpin:{hex:0x9B6FE0, color:'#9B6FE0', name:'Joint Pin / Spigot (Sambung Dalam)',
            sudut:'Segaris (lurus)', beban:'Tekan (bukan momen)', tebal:'Internal joint',
            fungsi:'Pin pengembang di dalam pipa untuk menyambung standard. Letakkan di titik tanpa momen lentur; tidak sekuat sleeve untuk tarik.'},
  putlog:  {hex:0x4FB477, color:'#4FB477', name:'Klem Putlog / Single',
            sudut:'90°', beban:'Ringan (non-struktural)', tebal:'Single coupler',
            fungsi:'Klem tunggal untuk memasang putlog (transom antara penumpu papan) ke ledger. Hanya untuk beban ringan — jangan untuk sambungan struktur utama.'},
  board:   {hex:0x2BB6A8, color:'#2BB6A8', name:'Klem Papan / Toe Board',
            sudut:'—', beban:'Pengikat papan', tebal:'Board retainer',
            fungsi:'Mengikat papan pijak atau toe board ke pipa agar tidak bergeser atau terjungkit saat dipijak atau tertendang.'},
  ladder:  {hex:0xE0C341, color:'#E0C341', name:'Tangga Akses (Ladder 4:1)',
            sudut:'±75° (rasio 4:1)', beban:'Akses personel', tebal:'Aluminium / baja',
            fungsi:'Sarana naik-turun perancah. Jarak horizontal kaki tangga ±¼ panjang kerjanya (rasio 4:1, ±75°), ujung atas menonjol minimal 0,9 m (3 ft) di atas lantai pendaratan (OSHA 1926.1053(b)); NASC SG25:20 menganjurkan minimal 1,0 m. Tangga bersandar pada batang yang tetap terpasang dan kedua kakinya diikat di bagian atas. Celah pelindung tepi di titik akses ditutup pintu yang menutup sendiri dan hanya membuka ke dalam.'},
  plank:   {hex:0xCBA15E, color:'#CBA15E', name:'Papan Pijak / Plank (BS 2482)',
            sudut:'—', beban:'Lantai kerja', tebal:'225 × 38 mm',
            fungsi:'Papan pijak kayu BS 2482:2009 lebar 225 mm tebal 38 mm, band baja di kedua ujung. Papan 38 mm ditumpu paling jauh tiap 1,2 m (kelas mutu 1,5 m hanya untuk papan yang dipilah dengan mesin). Ujung papan menonjol minimal 50 mm dari muka tumpuan dan tidak lebih dari 4 × tebal, lalu diikat (NASC TG12; NASC SG25:20 butir 4.1).'},
  beamclamp:{hex:0x8FA0AE, color:'#8FA0AE', name:'Beam Clamp (Klem Balok)',
            sudut:'Jepit flens', beban:'Gantung ke balok baja', tebal:'Drop-forged + ulir',
            fungsi:'Menjepit flens balok baja (I/H-beam) dengan rahang berulir, lalu menyediakan kopling pipa. Untuk menggantung/mengikat perancah ke struktur baja existing.'},
  anchorclamp:{hex:0x7C8B99, color:'#7C8B99', name:'Anchor Clamp / Tie (Jangkar)',
            sudut:'Tie ke dinding', beban:'Menahan tarik/tekan', tebal:'Eye + coupler',
            fungsi:'Pengikat (tie) perancah ke jangkar dinding/struktur lewat eye-bolt. Menahan perancah agar tidak roboh ke luar/dalam; dipasang bertahap seiring kenaikan perancah sesuai desain. Pada menara bebas di simulator, fungsi ini digantikan outrigger.'},
  redtag:  {hex:0xE74C3C, color:'#E74C3C', name:'Tag Merah (Jangan Digunakan)',
            sudut:'—', beban:'Penanda status', tebal:'Kartu + pengikat',
            fungsi:'Tag MERAH: perancah sedang dirakit, diubah, atau dibongkar, atau belum lolos inspeksi — DILARANG digunakan. Dipasang di setiap jalur akses sejak awal perakitan.'},
  greentag:{hex:0x2ECC71, color:'#2ECC71', name:'Tag Hijau (Boleh Digunakan)',
            sudut:'—', beban:'Penanda status', tebal:'Kartu + pengikat',
            fungsi:'Tag HIJAU: perancah telah diinspeksi oleh personel kompeten dan boleh digunakan. Hanya dipasang SETELAH inspeksi serah terima; mencantumkan tanggal, nama pemeriksa, dan batas beban.'},
  ratchet: {hex:0xC0C7CE, color:'#C0C7CE', name:'Kunci Ratchet (Podger)',
            sudut:'—', beban:'Alat kerja', tebal:'Soket 19/22 mm',
            fungsi:'Kunci ratchet perancah dengan soket 19/22 mm dan ujung podger lancip untuk mengencangkan baut klem & meluruskan lubang. Alat utama pemasangan.'},
  levelmeter:{hex:0xF5C518, color:'#F5C518', name:'Level Meter (Waterpass)',
            sudut:'—', beban:'Alat ukur', tebal:'Vial gelembung',
            fungsi:'Waterpass untuk memastikan ledger/transom datar dan standard tegak. Toleransi yang dipakai di simulator: ±20 mm per 2 m (BS EN 12811-1 Lampiran Nasional Inggris, Tabel NA.1).'},
  distancemeter:{hex:0xE0892E, color:'#E0892E', name:'Distance Meter (Meteran)',
            sudut:'—', beban:'Alat ukur', tebal:'Pita / laser',
            fungsi:'Meteran pita (atau laser) untuk mengukur jarak bay, lebar, tinggi lift, tinggi pagar, dan diagonal kesikuan. Bandingkan hasil ukur dengan gambar kerja/desain perancah.'},
};

/* ---------- geometry helpers (geometri & material dipakai bersama) ---------- */
const V = (x,y,z)=>new THREE.Vector3(x,y,z);
const R = 0.024; // jari-jari pipa Ø48,3 mm (dibulatkan)

function tube(a,b,radius,mat){
  const dir = new THREE.Vector3().subVectors(b,a);
  const len = dir.length();
  const geo = sharedGeo('c'+radius.toFixed(4)+'_'+len.toFixed(4), ()=>new THREE.CylinderGeometry(radius,radius,len,radius>=0.02?16:10));
  const m = new THREE.Mesh(geo, mat);
  m.quaternion.setFromUnitVectors(V(0,1,0), dir.clone().normalize());
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.castShadow = true;
  return m;
}
function box(wd,ht,dp,mat){ return new THREE.Mesh(sharedGeo('b'+wd.toFixed(4)+'_'+ht.toFixed(4)+'_'+dp.toFixed(4),()=>new THREE.BoxGeometry(wd,ht,dp)),mat); }
const BAND_MATS = {};
function bandMat(type){
  if(!BAND_MATS[type]){ const h=COUPLER[type].hex; BAND_MATS[type]=new THREE.MeshStandardMaterial({color:h,emissive:h,emissiveIntensity:.18,metalness:.25,roughness:.5}); SHARED_MATS.add(BAND_MATS[type]); }
  return BAND_MATS[type];
}
/* klem pada menara: badan + pita warna jenis klem (baut kecil hanya di model katalog — hemat draw call;
   klem kecil tidak ikut menghitung bayangan) */
function coupler(pos, type, up){
  const g = new THREE.Group();
  const body = new THREE.Mesh(sharedGeo('cplBody',()=>new THREE.BoxGeometry(0.072,0.072,0.072)), M.darkSteel);
  const band = new THREE.Mesh(sharedGeo('cplBand',()=>new THREE.TorusGeometry(0.052,0.014,10,22)), bandMat(type));
  band.rotation.x = up ? 0 : Math.PI/2;
  g.add(body, band);
  g.position.copy(pos);
  g.userData.couplerType = type; g.userData.role = 'coupler';
  return g;
}
/* peran (role) setiap komponen dipakai mode inspeksi untuk MENGUKUR model */
function rl(o,role,extra){ o.userData.role=role; if(extra) Object.assign(o.userData,extra); return o; }
/* objek yang dilepas/diganti pada tahap tertentu (barikade, tag merah, rail penutup sementara) */
const KEYED = {};
function keyed(o,k){ (KEYED[k]=KEYED[k]||[]).push(o); o.userData.key=k; return o; }

/* ============================================================
   GEOMETRI PERANCAH — menara bebas 2 bay × 1 lebar, 2 lift (dikoreksi Oktober 2026)
   X = memanjang (bay) · Z = melintang (lebar) · Y = naik · satuan meter.
   Ukuran ilustratif untuk pelatihan, di dalam batas tabel pedoman (tidak mengikat)
   OSHA 29 CFR 1926 Subpart L Appendix A, tube & coupler light duty: jarak tiang
   ≤ 4 ft × 10 ft (1,22 × 3,05 m), jarak runner vertikal ≤ 6 ft 6 in (1,98 m).
   Bukan desain perancah — konfigurasi nyata wajib dihitung/didesain.
   ============================================================ */
const BAY=2.0, WID=1.2, LZ=WID/2;
const COLS=[-BAY,0,BAY];                                  // 3 kolom standard → 2 bay (4,0 m)
const ROWS=[-LZ,LZ];                                      // 2 baris standard → lebar 1,2 m
const NODES=[]; COLS.forEach(x=>ROWS.forEach(z=>NODES.push([x,z]))); // 6 standard
const corners=[[-BAY,-LZ],[BAY,-LZ],[BAY,LZ],[-BAY,LZ]];
const ON_LEDGER=2*R;                                      // transom/putlog duduk di atas ledger (pusat +48 mm)
const BOARD={w:0.225, t:0.038, L:3.90, n:5};              // papan BS 2482 225 × 38 mm, panjang 3,9 m, 5 baris
const DECK_DY=ON_LEDGER+R+BOARD.t;                        // pusat ledger → permukaan lantai = 0,110 m
/* pelindung tepi: permukaan atas top rail 1,0 m & pusat mid rail 0,53 m di atas lantai pada sisi panjang. Rail dipasang di
   MUKA DALAM standard (sumbu rail 48 mm dari sumbu standard). Rail sisi ujung 75 mm lebih tinggi: di standard sudut rail
   sisi panjang dan sisi ujung bersilang dan dua klem tidak dapat dipasang setinggi pada satu standard. */
const RAIL={top:1.0, mid:0.53, endOff:0.075};
const RAIL_Z=LZ-2*R, RAIL_X=BAY-2*R;                      // sumbu rail sisi panjang (z) dan sisi ujung (x)
const TOE={h:0.15, t:0.025};                              // toe board 150 mm
const Y={ kick:0.15, l1:1.95, l2:3.90,                    // ledger dasar dekat base plate; lift 1,95 m (≤ 1,98 m)
          std0:0.04, stdShort:2.20, stdLong:4.15, stdTop:5.10,   // panjang awal standard berselang-seling, lalu diperpanjang
          outTop:1.80 };                                  // persilangan outrigger dengan standard sudut (di bawah simpul lift-1)
Y.deck1=Y.l1+DECK_DY; Y.deck2=Y.l2+DECK_DY;               // permukaan lantai lift-1 (2,06 m) & lantai atas (4,01 m)
const TRANSOM_X=[-1.86,0.08,1.86];                        // transom dekat standard (≤ 150 mm dari simpul); ujung papan 90 mm dari sumbu, 66 mm dari muka
const PUTLOG_X=[-0.90,0.98];                              // putlog antara → bentang papan ≤ 0,98 m
const LEDGER_X=BAY+0.20;                                  // ujung ledger 0,20 m di luar standard ujung (klem bracing ujung tetap di dalam pipa)
/* titik akses tiap lantai kerja (sisi belakang, z = +LZ): celah pelindung tepi di antara dua puncheon ditutup pintu yang
   menutup sendiri (engsel di puncheon "hinge", menutup ke puncheon "latch"); tangga 4:1 di samping pintu bersandar pada
   top rail yang tetap utuh dan kedua kakinya diikat pada rail itu (pola NASC SG25:20 Gambar 6, langkah ke samping) */
const ACC={
  l1: {id:'l1', T:Y.deck1, ledger:Y.l1, hinge:1.26, latch:0.66, xL:0.12, xR:0.56, tagY:1.25},
  top:{id:'top', T:Y.deck2, ledger:Y.l2, hinge:-1.78, latch:-1.18, xL:-1.08, xR:-0.64, tagY:1.55}
};
/* geometri tangga: sumbu kaki tangga menyinggung top rail (jarak sumbu R + 20 mm) dengan kemiringan 4 : 1 */
function ladderGeom(acc){
  const yR=acc.T+RAIL.top-R, k=Math.sqrt(17), off=R+0.02;
  const py=yR+off/k, pz=RAIL_Z+4*off/k;                  // titik singgung pada sumbu kaki tangga
  const zAt=function(y){ return pz+(py-y)/4; };
  return {xL:acc.xL, xR:acc.xR, xc:(acc.xL+acc.xR)/2, T:acc.T, yR:yR, py:py, pz:pz, yTop:acc.T+1.05, zAt:zAt, zFoot:zAt(0)};
}
const LAD=ladderGeom(ACC.top);
const PLAN={decks:[Y.deck1,Y.deck2], levels:[Y.kick,Y.l1,Y.l2]};
const ACCESS_BAY_L2={s:1, bay:Math.sign((ACC.l1.hinge+ACC.l1.latch)/2)};   // bay akses lantai lift-1 (sisi belakang) di lift-2   // rencana pemasangan: 2 lantai kerja, 3 level ledger

const scaffold=new THREE.Group(); scene.add(scaffold);
const stepGroups=[];

/* ---------- pembentuk komponen ---------- */
function cpl(x,y,z,t,up){return coupler(V(x,y,z),t,up);}
function soleBoard(x,z,alongZ){ const b=rl(box(alongZ?BOARD.w:0.50,BOARD.t,alongZ?0.50:BOARD.w,M.woodDark),'sole'); b.position.set(x,-BOARD.t/2,z); b.castShadow=b.receiveShadow=true; return b; }
function basePlate(x,z){
  const g=new THREE.Group();
  const p=rl(box(0.16,0.035,0.16,GALV2),'baseplate'); p.position.set(x,0.0175,z); p.castShadow=p.receiveShadow=true; g.add(p);
  const sock=new THREE.Mesh(sharedGeo('bpSock',()=>new THREE.CylinderGeometry(0.03,0.03,0.10,14)),GALV); sock.position.set(x,0.085,z); sock.castShadow=true; g.add(sock);
  [[-0.055,-0.055],[0.055,-0.055],[0.055,0.055],[-0.055,0.055]].forEach(dd=>{ const h=new THREE.Mesh(sharedGeo('bpBolt',()=>new THREE.CylinderGeometry(0.011,0.011,0.04,8)),M.darkSteel); h.position.set(x+dd[0],0.018,z+dd[1]); g.add(h); });
  return g;
}
function standardTube(x,z,y0,y1){ return rl(tube(V(x,y0,z),V(x,y1,z),R,M.steel),'standard'); }
/* ledger menerus 2 bay (sumbu X) di kedua baris + klem mati di 6 simpul */
function ledgerLvl(y){ const g=[]; ROWS.forEach(z=>{ g.push(rl(tube(V(-LEDGER_X,y,z),V(LEDGER_X,y,z),R,M.steel),'ledger')); COLS.forEach(x=>g.push(cpl(x,y,z,'fix'))); }); return g; }
/* transom/putlog melintang (sumbu Z) duduk DI ATAS ledger, menonjol 0,10 m di luar ledger */
function bearerLvl(y,xs,role,ctype){ const g=[], yc=y+ON_LEDGER; xs.forEach(x=>{ g.push(rl(tube(V(x,yc,-LZ-0.10),V(x,yc,LZ+0.10),R,M.steelLight),role)); ROWS.forEach(z=>g.push(cpl(x,y+R,z,ctype))); }); return g; }
/* bracing: fasad (kedua sisi panjang, tiap bay, membentuk "∧" per lift) + silang X di kedua ujung */
/* pipa bracing menonjol 40 mm melewati klem putar di kedua ujungnya (klem menjepit di dalam panjang pipa) */
function brace(a,b){ const u=new THREE.Vector3().subVectors(b,a).normalize(); return [rl(tube(a.clone().addScaledVector(u,-0.04),b.clone().addScaledVector(u,0.04),R,M.steel),'brace'), coupler(a,'swivel',true), coupler(b,'swivel',true)]; }
/* free: bay akses yang dibiarkan tanpa diagonal fasad pada lift ini ({s: sisi ±1, bay: -1 kiri / +1 kanan}) — bukaan
   pintu lantai di dasar lift ini tidak boleh terhalang bracing (OSHA 1926.451(e)(1); NASC SG25:20 butir 6.4) */
function liftBrace(y0,y1,free){
  const g=[], off=0.06, skip=(s,b)=>!!free&&free.s===s&&free.bay===b;
  [-1,1].forEach(s=>{ const z=s*(LZ+off);
    if(!skip(s,-1)) brace(V(-BAY,y0,z),V(0,y1,z)).forEach(o=>g.push(o));     // bay kiri  ↗
    if(!skip(s,1)) brace(V(BAY,y0,z),V(0,y1,z)).forEach(o=>g.push(o));       // bay kanan ↖
  });
  [-1,1].forEach(s=>{ const x1=s*(BAY+off), x2=s*(BAY+off+0.05);
    brace(V(x1,y0,-LZ),V(x1,y1,LZ)).forEach(o=>g.push(o));   // ujung: silang X
    brace(V(x2,y0,LZ),V(x2,y1,-LZ)).forEach(o=>g.push(o));
  });
  return g;
}
/* papan lantai: 5 × 225 mm, panjang 3,9 m, ujung menonjol 90 mm dari sumbu transom ujung (66 mm dari muka pipa), dikunci klem papan */
function deckBoards(L){
  const g=[], yb=L+ON_LEDGER+R, yc=yb+BOARD.t/2, half=BOARD.L/2;
  for(let i=0;i<BOARD.n;i++){
    const z=-BOARD.w*BOARD.n/2+(i+0.5)*BOARD.w;
    const pl=rl(box(BOARD.L,BOARD.t,BOARD.w-0.002,M.wood),'board'); pl.position.set(0,yc,z); pl.castShadow=pl.receiveShadow=true; g.push(pl);
    [-half+0.03,half-0.03].forEach(bx=>{ const band=box(0.05,BOARD.t+0.006,BOARD.w+0.004,GALV2); band.position.set(bx,yc,z); band.castShadow=true; g.push(band); });
    [-1,1].forEach(s=>{ const c=rl(box(0.07,0.018,0.11,M.darkSteel),'boardclip'); c.position.set(s*(half-0.10),yb+BOARD.t+0.009,z); g.push(c); });
  }
  return g;
}
/* toe board 150 mm berdiri di tepi lantai (keempat sisi). Toe board sisi panjang melewati standard sudut agar dapat diklem;
   di titik akses toe board terputus dan celahnya ditutup papan kaki pintu. Klem toe board dipasang PADA papan, di standard/puncheon. */
function toeBoards(acc){
  const g=[], T=acc.T, yc=T+TOE.h/2, zc=BOARD.w*BOARD.n/2-TOE.t/2, xe=BOARD.L/2-TOE.t/2, endL=2*(zc-TOE.t/2), xl=BAY+0.03;
  const lo=Math.min(acc.hinge,acc.latch), hi=Math.max(acc.hinge,acc.latch);
  const mk=(x0,x1,z)=>{ const b=rl(box(x1-x0,TOE.h,TOE.t,M.woodDark),'toeboard'); b.position.set((x0+x1)/2,yc,z); b.castShadow=true; return b; };
  g.push(mk(-xl,xl,-zc), mk(-xl,lo+0.03,zc), mk(hi-0.03,xl,zc));
  [-1,1].forEach(s=>{ const b=rl(box(TOE.t,TOE.h,endL,M.woodDark),'toeboard'); b.position.set(s*xe,yc,0); b.castShadow=true; g.push(b); });
  const zClip=zc+TOE.t/2+0.007;                           // di antara muka luar toe board dan muka standard
  COLS.forEach(x=>[-1,1].forEach(s=>g.push(cpl(x,yc,s*zClip,'board',true))));
  [lo,hi].forEach(x=>g.push(cpl(x,yc,zClip,'board',true)));
  return g;
}
/* pelindung tepi di muka dalam standard: top rail (permukaan atas 1,0 m) + mid rail (0,53 m) di sisi panjang; sisi ujung
   +75 mm (rail bersilang di sudut). Di titik akses (sisi belakang) rail terputus di antara dua puncheon; setiap potongan
   rail diklem ke standard/puncheon dan menonjol 60 mm melewati klemnya. Celah ditutup pintu yang menutup sendiri. */
function railRing(acc){
  const g=[], T=acc.T, ext=0.06, lo=Math.min(acc.hinge,acc.latch), hi=Math.max(acc.hinge,acc.latch);
  [['rail-top',T+RAIL.top-R],['rail-mid',T+RAIL.mid]].forEach(function(p){ const role=p[0], y=p[1], ye=y+RAIL.endOff;
    g.push(rl(tube(V(-BAY-ext,y,-RAIL_Z),V(BAY+ext,y,-RAIL_Z),R,M.steel),role));                                   // depan
    g.push(rl(tube(V(-BAY-ext,y,RAIL_Z),V(lo+ext,y,RAIL_Z),R,M.steel),role), rl(tube(V(hi-ext,y,RAIL_Z),V(BAY+ext,y,RAIL_Z),R,M.steel),role));   // belakang
    [-1,1].forEach(s=>g.push(rl(tube(V(s*RAIL_X,ye,-LZ-0.05),V(s*RAIL_X,ye,LZ+0.05),R,M.steel),role)));            // kedua ujung
    COLS.forEach(x=>[-1,1].forEach(s=>g.push(cpl(x,y,s*(LZ-R),'fix'))));                                            // klem rail sisi panjang
    [-1,1].forEach(sx=>[-1,1].forEach(s=>g.push(cpl(sx*(BAY-R),ye,s*LZ,'fix'))));                                   // klem rail ujung
    [lo,hi].forEach(x=>g.push(cpl(x,y,LZ-R,'fix')));                                                                 // klem rail ke puncheon
  });
  return g.concat(accessPosts(acc), [accessGate(acc)]);
}
/* puncheon (tiang pintu) di kedua tepi titik akses: dari 0,15 m di bawah ledger sampai 1,08 m di atas lantai (menonjol melewati klem top rail) */
function accessPosts(acc){
  const g=[]; [acc.hinge,acc.latch].forEach(x=>{ g.push(rl(tube(V(x,acc.ledger-0.15,LZ),V(x,acc.T+RAIL.top+0.08,LZ),R,M.steel),'puncheon'), cpl(x,acc.ledger,LZ,'fix',true)); });
  return g;
}
/* pintu akses yang menutup sendiri (engsel pegas) di sisi dalam rail: daun pintu menumpang 30 mm pada ujung rail tetap di
   kedua sisi sehingga hanya dapat membuka ke dalam (NASC SG25:20 butir 6.4); top bar 1,0 m, mid bar, papan kaki 150 mm */
function accessGate(acc){
  const g=new THREE.Group(), T=acc.T, r=0.017, lo=Math.min(acc.hinge,acc.latch), hi=Math.max(acc.hinge,acc.latch);
  const x0=lo+0.03, x1=hi-0.03, z=RAIL_Z-R-r-0.004, yT=T+RAIL.top-r, yB=T+0.03;
  g.add(rl(tube(V(x0,yT,z),V(x1,yT,z),r,GALV),'gate-top'), rl(tube(V(x0,T+RAIL.mid,z),V(x1,T+RAIL.mid,z),r,GALV),'gate-mid'));
  g.add(tube(V(x0,yB,z),V(x0,yT,z),r,GALV), tube(V(x1,yB,z),V(x1,yT,z),r,GALV));
  const kick=rl(box(x1-x0,TOE.h,0.012,GALV2),'gate-kick'); kick.position.set((x0+x1)/2,T+0.002+TOE.h/2,z); kick.castShadow=true; g.add(kick);
  const xh=acc.hinge>acc.latch?(x1+acc.hinge)/2:(x0+acc.hinge)/2;
  [0.28,0.78].forEach(h=>{ const sp=new THREE.Mesh(sharedGeo('gateSpring',()=>new THREE.CylinderGeometry(0.03,0.03,0.11,12)),M.spring); sp.position.set(xh,T+h,(z+LZ)/2); g.add(sp); });
  return rl(g,'gate',{selfClosing:true, acc:acc.id});
}
/* outrigger (raker) di keempat sudut. Bidangnya bergeser 75 mm ke dalam bay dari standard sudut sehingga outrigger
   bersilang dengan standard dan dijepit klem putar pada +1,80 m; pipa menonjol 0,10 m melewati klem. Kaki 1,0 m keluar
   (arah lebar) di base plate + sole board. Pengikat kaki (kicker) pada +0,30 m bersilang 75 mm dari standard dan dari
   outrigger, dijepit klem di kedua persilangan, menonjol 0,10 m melewati kedua klem. */
function outrigger(i){
  const c=corners[i], sx=Math.sign(c[0]), sz=Math.sign(c[1]), xo=c[0]-sx*0.075, yH=Y.outTop;
  const head=V(xo,yH,c[1]), foot=V(xo,0.04,c[1]+sz*1.0), d=new THREE.Vector3().subVectors(head,foot).normalize();
  const g=[rl(tube(foot,head.clone().addScaledVector(d,0.10),R,M.steel),'outrigger'), basePlate(foot.x,foot.z), soleBoard(foot.x,foot.z,true),
    coupler(V(c[0]-sx*0.0375,yH,c[1]),'swivel',true)];
  const yK=0.30, zB=foot.z+(head.z-foot.z)*((yK-foot.y)/(yH-foot.y));
  const A=new THREE.Vector2(c[0],c[1]), B=new THREE.Vector2(xo,zB), u=B.clone().sub(A).normalize(), n=new THREE.Vector2(-u.y,u.x);
  if(n.x*sx>0) n.negate();                                  // kicker di sisi dalam bay (menjauhi bracing ujung)
  const P0=A.clone().addScaledVector(n,0.075).addScaledVector(u,-0.10), P1=B.clone().addScaledVector(n,0.075).addScaledVector(u,0.10);
  const cA=A.clone().addScaledVector(n,0.0375), cB=B.clone().addScaledVector(n,0.0375);
  g.push(rl(tube(V(P0.x,yK,P0.y),V(P1.x,yK,P1.y),R,M.steelLight),'outrigger-tie'), cpl(cA.x,yK,cA.y,'fix'), cpl(cB.x,yK,cB.y,'swivel',true));
  return g;
}
/* sleeve coupler di sambungan standard */
function sleeveAt(x,z,y){const g=new THREE.Group();const sl=rl(new THREE.Mesh(sharedGeo('slv',()=>new THREE.CylinderGeometry(R+0.013,R+0.013,0.22,16)),GALV2),'sleeve');sl.position.set(x,y,z);sl.castShadow=true;g.add(sl);[-0.06,0.06].forEach(dy=>{const b=new THREE.Mesh(sharedGeo('slvBolt',()=>new THREE.CylinderGeometry(0.008,0.008,0.07,8)),BOLT);b.rotation.z=Math.PI/2;b.position.set(x+R+0.012,y+dy,z);g.add(b);});const tg=new THREE.Mesh(sharedGeo('slvTag',()=>new THREE.TorusGeometry(R+0.022,0.008,8,18)),bandMat('sleeve'));tg.rotation.x=Math.PI/2;tg.position.set(x,y+0.12,z);g.add(tg);return g;}
/* scaffold tag (kartu status) — hijau = boleh digunakan, merah = jangan digunakan */
function scaffTag(pos,green){
  const g=new THREE.Group();
  const card=box(0.24,0.34,0.012,green?M.tagGreen:M.tagRed); g.add(card);
  const hdr=box(0.24,0.08,0.014,M.paper); hdr.position.y=0.13; g.add(hdr);
  const holder=new THREE.Mesh(sharedGeo('tagHolder',()=>new THREE.TorusGeometry(0.035,0.008,8,18)),M.holder); holder.position.y=0.20; g.add(holder);
  const tieM=new THREE.Mesh(sharedGeo('tagTie',()=>new THREE.CylinderGeometry(0.004,0.004,0.16,6)),M.tie); tieM.position.y=0.26; g.add(tieM);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;}); g.position.copy(pos);
  return rl(g,'tag',{color:green?'green':'red'});
}
/* barikade zona eksklusi (tiang + pita) di sekeliling area kerja */
function barrierRig(){
  const g=new THREE.Group();
  const pts=[[-3,-2.3],[-1,-2.3],[1,-2.3],[3,-2.3],[3,0.25],[3,2.8],[1,2.8],[-1,2.8],[-3,2.8],[-3,0.25]];
  pts.forEach(p=>{ const post=new THREE.Mesh(sharedGeo('bPost',()=>new THREE.CylinderGeometry(0.02,0.02,1.0,10)),M.post); post.position.set(p[0],0.5,p[1]); post.castShadow=true; g.add(post);
    const foot=new THREE.Mesh(sharedGeo('bFoot',()=>new THREE.CylinderGeometry(0.14,0.16,0.04,16)),M.post); foot.position.set(p[0],0.0,p[1]); g.add(foot); });
  pts.forEach((p,i)=>{ const q=pts[(i+1)%pts.length], len=Math.hypot(q[0]-p[0],q[1]-p[1]), ang=Math.atan2(q[1]-p[1],q[0]-p[0]);
    [0.95,0.60].forEach((y,j)=>{ const t=box(len,0.05,0.008,j?M.tapeW:M.tape); t.position.set((p[0]+q[0])/2,y,(p[1]+q[1])/2); t.rotation.y=-ang; g.add(t); }); });
  return rl(g,'barrier');
}

/* tangga 4:1 di samping pintu akses: bersandar pada top rail yang tetap utuh, kedua kaki tangga diikat klem tangga pada
   rail itu (pusat klem di antara sumbu rail dan sumbu kaki tangga), ujung atas 1,05 m di atas lantai, anak tangga sejajar
   lantai pendaratan (NASC SG25:20 butir 6.6), kaki tangga di alas papan */
function ladderRig(acc){
  const L=ladderGeom(acc), g=[], r=0.02, n=Math.round(L.T/0.29), s=L.T/n;
  [L.xL,L.xR].forEach(x=>g.push(rl(tube(V(x,0,L.zFoot),V(x,L.yTop,L.zAt(L.yTop)),r,M.steelLight),'ladder-rail')));
  for(let i=1;i*s<L.yTop-0.08;i++){ const y=i*s, z=L.zAt(y); g.push(rl(tube(V(L.xL,y,z),V(L.xR,y,z),0.013,M.steel),'ladder-rung')); }
  [L.xL,L.xR].forEach(x=>g.push(rl(coupler(V(x,(L.yR+L.py)/2,(RAIL_Z+L.pz)/2),'ladder',false),'ladder-tie')));
  const pad=box(0.62,BOARD.t,0.30,M.woodDark); pad.position.set(L.xc,-BOARD.t/2,L.zFoot); pad.receiveShadow=true; g.push(pad);
  return g;
}
function ladderTag(acc,green){ const L=ladderGeom(acc); return scaffTag(V(L.xc,acc.tagY,L.zAt(acc.tagY)+0.06),green); }

/* alat bantu / hint transien */
function waterpass(pos,axis){const g=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.07,0.06),new THREE.MeshStandardMaterial({color:0xF5C518,metalness:.3,roughness:.5,emissive:0x6b5500,emissiveIntensity:.18}));const vial=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.1,12),new THREE.MeshStandardMaterial({color:0x2ECC71,emissive:0x2ECC71,emissiveIntensity:.6}));vial.rotation.z=Math.PI/2;g.add(body,vial);if(axis==='z')g.rotation.y=Math.PI/2;else if(axis==='y')g.rotation.z=Math.PI/2;g.position.copy(pos);return g;}
/* simbol siku 90° kecil di pertemuan ledger/transom dengan standard */
function rightAngle(pos,plane){const mat=new THREE.MeshBasicMaterial({color:0x2ECC71});const s=0.22,g=new THREE.Group();let a,b;if(plane==='xz'){a=new THREE.Mesh(new THREE.BoxGeometry(s,0.012,0.022),mat);a.position.set(s/2,0,0);b=new THREE.Mesh(new THREE.BoxGeometry(0.022,0.012,s),mat);b.position.set(0,0,s/2);}else{a=new THREE.Mesh(new THREE.BoxGeometry(s,0.022,0.012),mat);a.position.set(s/2,0,0);b=new THREE.Mesh(new THREE.BoxGeometry(0.022,s,0.012),mat);b.position.set(0,s/2,0);}g.add(a,b);g.position.copy(pos);return g;}
/* busur sudut bracing (sektor 40–50° = 45° ± 5°) */
function braceArc(pos){const t=new THREE.Mesh(new THREE.TorusGeometry(0.36,0.014,8,24,Math.PI*(10/180)),new THREE.MeshBasicMaterial({color:0xF5A623}));t.rotation.z=Math.PI*(40/180);t.position.copy(pos);return t;}
function squareRuler(x0,z0){const y=Y.kick+ON_LEDGER+0.03,len=0.42,dx=x0<0?1:-1,dz=z0<0?1:-1;const mat=new THREE.MeshStandardMaterial({color:0xF5A623,emissive:0xF5A623,emissiveIntensity:.45,metalness:.2,roughness:.5});const a=new THREE.Mesh(new THREE.BoxGeometry(len,0.014,0.032),mat);a.position.set(x0+dx*len/2,y,z0);const b=new THREE.Mesh(new THREE.BoxGeometry(0.032,0.014,len),mat);b.position.set(x0,y,z0+dz*len/2);const grp=new THREE.Group();grp.add(a,b);return grp;}
/* pandu diagonal per bay untuk kesikuan */
function diagGuide(){const y=Y.kick+0.02,g=[];COLS.slice(0,-1).forEach((x0,bi)=>{const x1=COLS[bi+1];g.push(makeLine(V(x0,y,-LZ),V(x1,y,LZ),0xF5A623),makeLine(V(x1,y,-LZ),V(x0,y,LZ),0xF5A623));});g.push(squareRuler(-BAY,-LZ));return g;}
/* pandu tinggi pelindung tepi: lantai → toe board 0,15 · mid rail 0,53 · top rail 1,0 m */
function heightGuide(x,z,T){const g=new THREE.Group(),c=0x2e9e5b;g.add(makeLine(V(x,T,z),V(x,T+RAIL.top,z),c));[TOE.h,RAIL.mid,RAIL.top].forEach(h=>g.add(makeLine(V(x-0.1,T+h,z),V(x+0.1,T+h,z),c)));return g;}

/* ---------- ilustrasi orang (APD lengkap: helm, rompi hi-vis, sepatu) ---------- */
function limb(len,r,mat){const sub=new THREE.Group();const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r*0.88,len,9),mat);c.position.y=-len/2;c.castShadow=true;sub.add(c);return sub;}
function miniWrench(){const g=new THREE.Group();const h=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.2,8),new THREE.MeshStandardMaterial({color:0x4a525a,metalness:.6,roughness:.4}));g.add(h);const head=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.035,6),new THREE.MeshStandardMaterial({color:0x9aa3ab,metalness:.7,roughness:.35}));head.position.y=0.11;g.add(head);g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function workerFigure(pose){
  const g=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:0xd8a07a,roughness:.75});
  const vest=new THREE.MeshStandardMaterial({color:0xF5A623,roughness:.6,emissive:0x4a3200,emissiveIntensity:.12});
  const pants=new THREE.MeshStandardMaterial({color:0x2b3a47,roughness:.85});
  const hat=new THREE.MeshStandardMaterial({color:pose==='inspect'?0xffffff:0xFFD400,roughness:.5,metalness:.1});
  const legL=limb(0.82,0.058,pants),legR=limb(0.82,0.058,pants);legL.position.set(-0.09,0.85,0);legR.position.set(0.09,0.85,0);
  [legL,legR].forEach(lg=>{const boot=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.07,0.2),new THREE.MeshStandardMaterial({color:0x14181c}));boot.position.set(0,-0.82,0.04);lg.add(boot);});
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.16,0.5,12),vest);torso.position.y=1.1;
  [1.04,1.16].forEach(y=>{const s=new THREE.Mesh(new THREE.TorusGeometry(0.146,0.016,8,20),new THREE.MeshStandardMaterial({color:0xeaf6ff,emissive:0xbfe0ff,emissiveIntensity:.35}));s.rotation.x=Math.PI/2;s.position.y=y;g.add(s);});
  const armL=limb(0.52,0.042,vest),armR=limb(0.52,0.042,vest);armL.position.set(-0.16,1.3,0);armR.position.set(0.16,1.3,0);
  const head=new THREE.Mesh(new THREE.SphereGeometry(0.1,16,12),skin);head.position.y=1.47;
  const dome=new THREE.Mesh(new THREE.SphereGeometry(0.12,16,10,0,Math.PI*2,0,Math.PI/2),hat);dome.position.y=1.53;
  const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.155,0.155,0.02,16),hat);brim.position.y=1.53;
  g.add(legL,legR,torso,armL,armR,head,dome,brim);
  if(pose==='work'){armR.rotation.x=-1.35;armR.rotation.z=-0.15;armL.rotation.x=-0.35;const tool=miniWrench();tool.position.set(0,-0.52,0);tool.rotation.x=1.2;armR.add(tool);}
  else if(pose==='inspect'){armL.rotation.x=-1.05;armR.rotation.x=-0.9;const clip=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.3,0.015),new THREE.MeshStandardMaterial({color:0xf4f4f2,roughness:.7}));clip.position.set(0,-0.5,0.06);clip.rotation.x=1.0;armL.add(clip);}
  else {armL.rotation.x=0.14;armR.rotation.x=-0.14;}
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  return g;
}
function buildWorkers(){const grp=new THREE.Group();
  const w1=workerFigure('work');w1.position.set(0.7,Y.deck2,-0.05);w1.rotation.y=Math.PI*0.42;grp.add(w1);   // pekerja di lantai kerja atas (setelah tag hijau)
  return grp;}

/* ============================================================
   20 TAHAP PERAKITAN (urutan dikoreksi; acuan dicantumkan per tahap)
   ============================================================ */
const isShortStd=(i)=>((Math.floor(i/2)+(i%2))%2)===0;   // panjang awal berselang-seling antar-standard bertetangga
const STEPS = [
  { id:'persiapan', title:'Persiapan: rencana, material, zona eksklusi, tag merah', coupler:'redtag',
    desc:'Sebelum perakitan dimulai, pastikan ada <b>rencana pemasangan</b> dan perakitan <b>diawasi personel kompeten</b>. Periksa setiap komponen — pipa lurus dan tidak retak/berkarat parah, klem utuh, papan tidak pecah — dan pisahkan yang rusak. Siapkan tanah yang <b>rata, padat, dan kokoh</b>, pasang <b>barikade zona eksklusi</b> agar orang yang tidak berkepentingan tidak masuk dan tidak ada yang berada di bawah benda yang mungkin jatuh, lalu gantungkan <b>tag merah "JANGAN DIGUNAKAN"</b> di jalur akses. Tag merah tetap terpasang selama perakitan.',
    checks:['Rencana pemasangan & pengawas kompeten','Komponen rusak dipisahkan, tidak dipakai','Tanah rata, padat, mampu menahan beban','Zona eksklusi + tag merah di jalur akses'],
    ref:'OSHA 1926.451(f)(7), (f)(4), (c)(2) · Permenaker 9/2016 Pasal 31–32 · PER.01/MEN/1980 Pasal 7, 10 & 21',
    build(){ return [keyed(barrierRig(),'barrier'), keyed(scaffTag(V(LAD.xc,0.78,2.82),false),'redtag-barrier')]; } },

  { id:'alas', title:'Sole board dan base plate', coupler:'baseplate',
    desc:'Letakkan <b>sole board</b> di bawah keenam titik standard (3 kolom × 2 baris), lalu pasang <b>base plate</b> di tengah setiap sole board. Sole board menyebarkan beban ke tanah; base plate (luas ≥ 150 cm², lebar ≥ 120 mm) menumpu pangkal standard.',
    checks:['6 titik standard: 3 kolom × 2 baris','Base plate di tengah sole board, rata','Dasar tidak amblas atau miring'],
    ref:'OSHA 1926.451(c)(2) · EN 12811-1 butir 5.7.1',
    build(){ const g=[]; NODES.forEach(c=>{ g.push(soleBoard(c[0],c[1],false), basePlate(c[0],c[1])); }); return g; } },

  { id:'standard', title:'Standard dengan panjang awal berselang-seling', coupler:'tube',
    desc:'Dirikan <b>enam standard</b> di soket base plate. Pakai panjang awal yang <b>berselang-seling</b> (±2,2 m dan ±4,15 m) agar sambungan standard yang bertetangga tidak jatuh pada lift yang sama. Segera kunci dengan ledger dan transom dasar (tahap berikutnya) — standard tidak dibiarkan berdiri bebas.',
    checks:['Pangkal duduk penuh di soket base plate','Tegak: deviasi ≤ 20 mm per 2 m','Panjang awal berselang-seling'],
    ref:'BS EN 12811-1 Lampiran Nasional (UK) Tabel NA.1',
    build(){ return NODES.map((c,i)=>standardTube(c[0],c[1],Y.std0,isShortStd(i)?Y.stdShort:Y.stdLong)); },
    hint(){ return [waterpass(V(-BAY-0.07,1.0,-LZ),'y')]; } },

  { id:'ledger-dasar', title:'Ledger dasar sedekat mungkin ke base plate', coupler:'fix',
    desc:'Pasang <b>ledger dasar</b> (runner) di sisi depan dan belakang dengan <b>klem mati</b>, <b>sedekat mungkin ke base plate</b> (dalam model +0,15 m). Ledger tegak lurus standard dan datar — periksa dengan waterpass.',
    checks:['Sedekat mungkin ke dasar (model +0,15 m)','Sudut ke standard 90°','Datar: ≤ 20 mm per 2 m'],
    ref:'OSHA 1926.452(b)(8) · BS EN 12811-1 NA Tabel NA.1',
    build(){ return ledgerLvl(Y.kick); },
    hint(){ return [waterpass(V(BAY-0.35,Y.kick+0.07,-LZ),'x'),rightAngle(V(-BAY+0.03,Y.kick,-LZ),'xy')]; } },

  { id:'transom-dasar', title:'Transom dasar dan kesikuan', coupler:'fix',
    desc:'Pasang <b>transom dasar</b> di atas ledger, <b>dekat setiap standard</b> (klem mati). Ukur <b>dua diagonal</b> tiap bay — bila sama panjang (±2,33 m), rangka sudah siku 90°.',
    checks:['Transom di atas ledger, ≤ 150 mm dari simpul','Kedua diagonal tiap bay sama','Klem dikencangkan'],
    ref:'OSHA 1926.452(b)(5) · BS EN 12811-1 NA Tabel NA.1',
    build(){ return bearerLvl(Y.kick,TRANSOM_X,'transom','fix'); },
    hint(){ return [waterpass(V(TRANSOM_X[0],Y.kick+ON_LEDGER+0.07,0.25),'z'),rightAngle(V(-BAY,Y.kick+ON_LEDGER,-LZ+0.03),'xz')].concat(diagGuide()); } },

  { id:'ledger-l1', title:'Ledger lift-1 (+1,95 m)', coupler:'fix',
    desc:'Pasang <b>ledger lift-1</b> depan dan belakang pada <b>+1,95 m</b> (klem mati), menerus pada ketiga standard, datar, dan tegak lurus standard. Untuk konfigurasi <i>light duty</i> jarak vertikal antar-ledger tidak melebihi <b>1,98 m (6 ft 6 in)</b>.',
    checks:['Jarak vertikal antar-ledger ≤ 1,98 m','Datar & tegak lurus standard','Menerus pada ketiga standard'],
    ref:'OSHA 1926 Subpart L App. A · 1926.452(b)(7)–(8)',
    build(){ return ledgerLvl(Y.l1); },
    hint(){ return [waterpass(V(BAY-0.35,Y.l1+0.07,-LZ),'x'),rightAngle(V(-BAY+0.03,Y.l1,-LZ),'xy')]; } },

  { id:'transom-l1', title:'Transom lift-1', coupler:'fix',
    desc:'Pasang <b>transom lift-1</b> di atas ledger, dekat setiap standard (klem mati). Transom mengunci lebar menara dan nanti menumpu papan lantai lift-1.',
    checks:['Di atas ledger, dekat standard','Tegak lurus ledger','Menonjol sedikit di luar ledger'],
    ref:'OSHA 1926.452(b)(5)–(6)',
    build(){ return bearerLvl(Y.l1,TRANSOM_X,'transom','fix'); },
    hint(){ return [waterpass(V(TRANSOM_X[2],Y.l1+ON_LEDGER+0.07,0.25),'z')]; } },

  { id:'bracing-l1', title:'Bracing lift-1: fasad dan silang ujung', coupler:'swivel',
    desc:'Bracing dipasang <b>segera setelah lift selesai</b>, sebelum naik ke lift berikutnya: <b>diagonal fasad</b> di kedua sisi panjang pada setiap bay (dua arah, ±42°) dengan <b>klem putar</b> di dekat simpul, serta <b>bracing silang (X)</b> di kedua ujung menara.',
    checks:['Fasad: kedua sisi, setiap bay, dua arah','Sudut ±45° (40–50°)','Ujung: bracing silang X','Klem putar dekat simpul'],
    ref:'OSHA 1926.452(b)(2)–(3) · OSHA 1926 Subpart L App. A (45° ± 5°) · pola per lift: kriteria aplikasi',
    build(){ return liftBrace(Y.kick,Y.l1); },
    hint(){ return [braceArc(V(-BAY,Y.kick,-LZ-0.07))]; } },

  { id:'outrigger', title:'Outrigger sebelum tinggi melewati 4 × lebar dasar', coupler:'swivel',
    desc:'Lebar dasar menara hanya <b>1,2 m</b>, sedangkan tingginya nanti ±5,1 m (rasio ±4,25 : 1). Karena itu <b>outrigger dipasang sekarang</b> — sebelum standard diperpanjang melewati 4 × 1,2 = 4,8 m dan sebelum ada pekerjaan di lift berikutnya. Empat penopang dijepit <b>klem putar</b> pada standard sudut tepat di bawah simpul lift-1 (+1,80 m) dan turun ke tanah 1,0 m keluar, lengkap dengan base plate, sole board, dan <b>pengikat kaki</b> ke standard, sehingga dasar melebar menjadi ±3,2 m. Bila menara berdiri di samping bangunan, pengikatan (tie) ke struktur sesuai desain menjadi alternatif.',
    checks:['Terpasang sebelum tinggi > 4 × lebar dasar','Kaki di base plate + sole board','Dijepit klem putar pada standard sudut','Pengikat kaki ke standard'],
    ref:'OSHA 1926.451(c)(1)',
    build(){ const g=[]; for(let i=0;i<4;i++) outrigger(i).forEach(o=>g.push(o)); return g; } },

  { id:'sambung', title:'Perpanjang standard dengan sleeve', coupler:'sleeve',
    desc:'Perpanjang standard dengan <b>sleeve coupler</b> di dekat simpul ledger, sehingga sambungan standard bertetangga tetap <b>selang-seling</b> (sebagian di atas lift-1, sebagian di atas lift-2). Seluruh standard kini mencapai ±5,1 m — aman karena outrigger sudah terpasang.',
    checks:['Sleeve dekat simpul ledger','Sambungan bertetangga tidak pada lift yang sama','Outrigger sudah terpasang'],
    ref:'Praktik baik — detail sambungan diverifikasi terhadap TG20:21',
    build(){ const g=[]; NODES.forEach((c,i)=>{ const y=isShortStd(i)?Y.stdShort:Y.stdLong; g.push(sleeveAt(c[0],c[1],y), standardTube(c[0],c[1],y,Y.stdTop)); }); return g; } },

  { id:'pagar-l1', title:'Pelindung tepi lift-1 dari posisi terlindungi', coupler:'fix',
    desc:'Sebelum siapa pun berdiri di lift-1, pasang <b>top rail</b> (permukaan atas <b>1,0 m</b> di atas lantai) dan <b>mid rail</b> (0,53 m) di muka dalam standard pada keempat sisi — dari posisi terlindungi, misalnya dengan <b>sistem advance guardrail</b> dari bawah. Rail sisi ujung dipasang 75 mm lebih tinggi karena bersilang dengan rail sisi panjang di standard sudut. Di sisi belakang bay kanan dipasang dua <b>puncheon</b> dan <b>pintu yang menutup sendiri</b> sebagai titik akses lantai ini. Bila perlindungan kolektif belum ada, pekerja wajib memakai <b>full body harness</b> dengan <b>tali pembatas gerak</b> (<i>work restraint</i>) pada angkur yang memadai.',
    checks:['Top rail ≥ 950 mm (model 1,0 m)','Celah vertikal ≤ 470 mm','Menerus di keempat sisi; pintu akses tertutup','Terpasang sebelum lantai dinaiki'],
    ref:'Permenaker 9/2016 Pasal 24–25 · PER.01/MEN/1980 Pasal 13(2) · EN 12811-1 butir 5.5 · NASC SG4:22 · NASC SG25:20',
    build(){ return railRing(ACC.l1); },
    hint(){ return [heightGuide(0.6,-LZ-0.06,Y.deck1)]; } },

  { id:'lantai-l1', title:'Lantai lift-1 dan tangga aksesnya', coupler:'plank',
    desc:'Pasang <b>putlog antara</b> di tengah tiap bay agar bentang papan 38 mm <b>≤ 1,2 m</b> (model: maks. 0,98 m). Gelar <b>5 papan</b> 225 × 38 mm sepanjang 3,9 m secara rapat (celah ≤ 25 mm); ujung papan menonjol <b>≥ 50 mm dari muka tumpuan</b> dan tidak lebih dari 4 × tebal, lalu dikunci klem papan. Pasang <b>toe board 150 mm</b> di keempat sisi. Lantai ini dipakai untuk merakit lift-2 dan nanti untuk membongkar, sehingga <b>tangga aksesnya dipasang sekarang</b>: di samping pintu, kemiringan 4 : 1, anak tangga sejajar lantai, ujung atas 1,05 m di atas lantai, dan kedua kaki tangga diikat pada top rail. Pasang <b>tag merah</b> di kaki tangga.',
    checks:['Bentang papan ≤ 1,2 m; lantai rapat','Ujung papan ≥ 50 mm dari muka tumpuan, dikunci','Toe board ≥ 150 mm, keempat sisi','Tangga 4 : 1 diikat di top rail + tag merah'],
    ref:'BS 2482:2009 · NASC TG12 · OSHA 1926.451(b)(1), (b)(4), (e)(1), (e)(9), (h)(4) · OSHA 1926.1053(b) · NASC SG25:20',
    build(){ return bearerLvl(Y.l1,PUTLOG_X,'putlog','putlog').concat(deckBoards(Y.l1), toeBoards(ACC.l1), ladderRig(ACC.l1), [keyed(ladderTag(ACC.l1,false),'redtag-access1')]); } },

  { id:'ledger-l2', title:'Ledger lift-2 (+3,90 m)', coupler:'fix',
    desc:'Dari lantai lift-1 yang sudah terlindungi — dicapai lewat tangga dan pintu di bay kanan — pasang <b>ledger lift-2</b> pada <b>+3,90 m</b> (klem mati), menerus, datar, dan tegak lurus standard.',
    checks:['Jarak vertikal antar-ledger ≤ 1,98 m','Datar & tegak lurus standard','Dikerjakan dari lantai terlindungi'],
    ref:'OSHA 1926 Subpart L App. A · 1926.452(b)(7)–(8)',
    build(){ return ledgerLvl(Y.l2); },
    hint(){ return [waterpass(V(BAY-0.35,Y.l2+0.07,-LZ),'x'),rightAngle(V(-BAY+0.03,Y.l2,-LZ),'xy')]; } },

  { id:'transom-l2', title:'Transom lift-2', coupler:'fix',
    desc:'Pasang <b>transom lift-2</b> di atas ledger, dekat setiap standard (klem mati) — penumpu lantai kerja atas.',
    checks:['Di atas ledger, dekat standard','Tegak lurus ledger','Klem mati dikencangkan'],
    ref:'OSHA 1926.452(b)(5)–(6)',
    build(){ return bearerLvl(Y.l2,TRANSOM_X,'transom','fix'); },
    hint(){ return [waterpass(V(TRANSOM_X[2],Y.l2+ON_LEDGER+0.07,0.25),'z')]; } },

  { id:'bracing-l2', title:'Bracing lift-2', coupler:'swivel',
    desc:'Lanjutkan bracing pada lift-2 sebelum lantai atas dipasang: <b>diagonal fasad</b> di kedua sisi panjang pada setiap bay (±44°) dan <b>bracing silang (X)</b> di kedua ujung. <b>Kecuali</b> bay kanan sisi belakang: bay itu adalah titik akses lantai lift-1, sehingga diagonalnya akan melintang di depan pintu setinggi 0,6–1,2 m di atas lantai. Bay itu dibiarkan bebas dan tetap dibracing di sisi depan.',
    checks:['Fasad: kedua sisi, setiap bay (kecuali bay akses)','Sudut ±45° (40–50°)','Ujung: bracing silang X','Bukaan pintu lift-1 tidak terhalang'],
    ref:'OSHA 1926.452(b)(2)–(3) · OSHA 1926 Subpart L App. A · OSHA 1926.451(e)(1) · NASC SG25:20 butir 6.4',
    build(){ return liftBrace(Y.l1,Y.l2,ACCESS_BAY_L2); },
    hint(){ return [braceArc(V(-BAY,Y.l1,-LZ-0.07))]; } },

  { id:'pagar-atas', title:'Pelindung tepi lantai atas (advance guardrail)', coupler:'fix',
    desc:'Dari lantai lift-1, pasang <b>top rail 1,0 m</b> dan <b>mid rail 0,53 m</b> di keempat sisi lantai atas dengan <b>sistem advance guardrail</b> — sebelum ada yang naik ke lantai atas. Di sisi belakang bay kiri dipasang dua <b>puncheon</b> dan <b>pintu yang menutup sendiri</b>. Rail di samping pintu tetap utuh karena nanti menjadi tumpuan dan tempat mengikat tangga.',
    checks:['Terpasang sebelum lantai atas dinaiki','Top rail 1,0 m · mid rail 0,53 m','Pintu akses tertutup, membuka ke dalam'],
    ref:'NASC SG4:22 · NASC SG25:20 · Permenaker 9/2016 Pasal 24 · OSHA 1926.451(g)(4)(i), (ii), (iv)',
    build(){ return railRing(ACC.top); },
    hint(){ return [heightGuide(0.6,-LZ-0.06,Y.deck2)]; } },

  { id:'lantai-atas', title:'Lantai kerja atas: putlog, papan, toe board', coupler:'plank',
    desc:'Pasang <b>putlog antara</b> (bentang papan ≤ 1,2 m), gelar <b>5 papan</b> rapat dari lantai lift-1, kunci ujungnya dengan klem papan, lalu pasang <b>toe board 150 mm</b> di keempat sisi dari dalam perlindungan rail yang sudah terpasang.',
    checks:['Bentang papan ≤ 1,2 m','Lantai penuh, celah ≤ 25 mm','Ujung papan ≥ 50 mm dari muka tumpuan, dikunci','Toe board ≥ 150 mm'],
    ref:'BS 2482:2009 · NASC TG12 · OSHA 1926.451(b)(1), (b)(4), (h)(4) · EN 12811-1 butir 5.5.4',
    build(){ return bearerLvl(Y.l2,PUTLOG_X,'putlog','putlog').concat(deckBoards(Y.l2), toeBoards(ACC.top)); } },

  { id:'tangga', title:'Tangga akses lantai atas', coupler:'ladder',
    desc:'Pasang <b>tangga</b> di sisi belakang bay kiri, tepat di samping pintu, dengan kemiringan <b>4 : 1</b> (±76°). Tangga <b>bersandar pada top rail yang tetap terpasang</b>, <b>kedua kakinya diikat</b> klem tangga pada rail itu, ujung atasnya <b>1,05 m</b> di atas lantai atas, dan anak tangga sejajar lantai pendaratan. Pengguna melangkah ke samping melalui pintu yang menutup sendiri dan hanya membuka ke dalam. Pasang <b>tag merah</b> di kaki tangga — perancah belum boleh digunakan.',
    checks:['Kemiringan 4 : 1, kaki di alas yang rata','Menonjol ≥ 1,0 m di atas lantai','Kedua kaki tangga diikat pada top rail','Tag merah di kaki tangga'],
    ref:'OSHA 1926.1053(b)(1), (b)(5)(i), (b)(6) · NASC SG25:20 butir 5, 6.4, 6.6 · PER.01/MEN/1980 Pasal 25',
    build(){ return ladderRig(ACC.top).concat([keyed(ladderTag(ACC.top,false),'redtag-access')]); } },

  { id:'inspeksi', title:'Inspeksi serah terima oleh personel kompeten', coupler:'levelmeter', action:'Catat Hasil Inspeksi →',
    desc:'Personel kompeten memeriksa perancah yang telah lengkap <b>sebelum digunakan</b>: dasar, kelurusan, bracing, stabilitas, lantai kerja, pelindung tepi, akses, dan tag. Simulator menjalankan pemeriksaan yang sama dengan <b>mengukur model</b>; hasilnya dicatat hanya bila semua butir memenuhi.',
    checks:['Semua butir pemeriksaan memenuhi','Temuan diperbaiki sebelum serah terima','Hasil dicatat (register/kartu inspeksi)'],
    ref:'OSHA 1926.451(f)(3) · WAHR 2005 reg. 12 · Permenaker 9/2016 Pasal 31–32',
    build(){ const f=workerFigure('inspect'); f.position.set(-0.35,0,2.30); f.rotation.y=Math.PI; return [keyed(rl(f,'inspector'),'inspector')]; } },

  { id:'tag-hijau', title:'Ganti tag merah dengan tag hijau', coupler:'greentag', action:'Pasang Tag Hijau →', hides:['barrier','redtag-barrier','redtag-access','redtag-access1','inspector'],
    desc:'Setelah inspeksi serah terima memenuhi, <b>ganti tag merah dengan tag hijau "BOLEH DIGUNAKAN"</b> di kedua titik akses. Tag mencantumkan tanggal, nama pemeriksa, dan batas beban; lalu lepas barikade zona eksklusi. Inspeksi diulang sebelum setiap giliran kerja dan setelah kejadian yang dapat memengaruhi kekuatan perancah.',
    checks:['Tag hijau hanya setelah inspeksi memenuhi','Tag merah dilepas di kedua titik akses','Barikade zona eksklusi dilepas'],
    ref:'OSHA 1926.451(f)(3) · WAHR 2005 reg. 12',
    build(){ return [ladderTag(ACC.top,true), ladderTag(ACC.l1,true)]; } },
];
if(STEPS.length!==TOTAL || STEPS.some((s,i)=>s.id!==STEP_IDS[i])) throw new Error('Daftar tahap tidak sinkron');
const INSP_IDX = STEPS.findIndex(s=>s.id==='inspeksi');

/* build all step groups (hidden) */
STEPS.forEach(s=>{
  const grp = new THREE.Group();
  s.build().forEach(o=>grp.add(o));
  grp.visible = false;
  grp.userData.stepId = s.id;
  scaffold.add(grp);
  stepGroups.push(grp);
});

/* pekerja (ilustrasi) — hanya tampil setelah tag hijau (perancah boleh digunakan) */
const workersGroup = buildWorkers(); workersGroup.visible=false; scaffold.add(workersGroup);
let showWorkers = true;
function updateWorkers(){ workersGroup.visible = showWorkers && MODE!=='lib' && state.current >= STEPS.length; markDirty(); }

function setGhost(grp,on){
  grp.traverse(o=>{ if(o.isMesh){
    if(on){ if(!o.userData.solidMat) o.userData.solidMat=o.material; o.material=ghostMat; }
    else { if(o.userData.solidMat) o.material=o.userData.solidMat; }
  }});
}

/* ============================================================
   COUPLER LIBRARY MODELS
   ============================================================ */
const libRig = new THREE.Group(); scene.add(libRig); libRig.visible=false;
const libHolder = new THREE.Group(); libRig.add(libHolder);

function bandRing(hex,r){ const t=new THREE.Mesh(new THREE.TorusGeometry(r||0.07,0.02,12,28),
  new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:.25,metalness:.3,roughness:.45})); return t; }
function clampBlock(){ const b=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.12,0.12),M.darkSteel.clone()); b.castShadow=true; return b; }

/* --- pembentuk klem realistis (drop-forged), orientasi VERTIKAL, pakai LatheGeometry --- */
function vbar(h){return tube(V(0,-h,0),V(0,h,0),0.058,GALV.clone());}
function hbar(L,mat){return tube(V(-L,0,0),V(L,0,0),0.058,mat||GALV2.clone());}
function tag(hex){const t=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.013,8,20),new THREE.MeshStandardMaterial({color:hex,emissive:hex,emissiveIntensity:.5,metalness:.2,roughness:.5}));return t;}
function hexNut(r){const n=new THREE.Mesh(new THREE.CylinderGeometry(r,r,r*0.85,6),BOLT.clone());n.castShadow=true;return n;}
/* badan cup tempa: profil persegi di-lathe ~310° → channel baja pres melingkar pipa (sumbu Y), celah hadap +X */
function saddleY(){
  const p=[new THREE.Vector2(0.062,-0.088),new THREE.Vector2(0.099,-0.088),new THREE.Vector2(0.099,0.088),new THREE.Vector2(0.062,0.088),new THREE.Vector2(0.062,-0.088)];
  const geo=new THREE.LatheGeometry(p,34,0.55,Math.PI*2-1.1);
  const m=new THREE.Mesh(geo,GALV.clone());m.castShadow=true;return m;
}
function ear(){const e=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.17,0.022),GALV2.clone());e.castShadow=true;return e;}
/* T-bolt: shank + ring + mur heksa di atas, pivot pin di bawah (sepanjang Y) */
function tBolt(len){const g=new THREE.Group();
  const sh=new THREE.Mesh(new THREE.CylinderGeometry(0.013,0.013,len,10),BOLT.clone());g.add(sh);
  for(let i=0;i<5;i++){const th=new THREE.Mesh(new THREE.TorusGeometry(0.014,0.0025,6,12),BOLT.clone());th.rotation.x=Math.PI/2;th.position.y=len/2-0.03-i*0.018;g.add(th);}
  const nut=hexNut(0.029);nut.position.y=len/2-0.015;g.add(nut);
  const wsh=new THREE.Mesh(new THREE.CylinderGeometry(0.033,0.033,0.008,14),GALV2.clone());wsh.position.y=len/2-0.04;g.add(wsh);
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.07,10),GALV2.clone());pin.rotation.z=Math.PI/2;pin.position.y=-len/2;g.add(pin);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
/* satu cup tempa lengkap (kanonik: melingkari pipa sepanjang +Y; celah & baut di +X, engsel di -X) */
function forgedCup(){const g=new THREE.Group();
  g.add(saddleY());
  [0.055,-0.055].forEach(z=>{const e=ear();e.position.set(0.094,0,z);g.add(e);});      // telinga sisi baut
  const b=tBolt(0.23);b.position.set(0.112,0.005,0);g.add(b);                            // swing bolt + mur
  const hp=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.205,12),GALV2.clone());hp.position.set(-0.096,0,0);g.add(hp);  // engsel
  [0.045,-0.045].forEach(z=>{const e=ear();e.position.set(-0.094,0,z);e.scale.set(0.65,0.95,1);g.add(e);});
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}
function boss(axis,len){const b=new THREE.Mesh(new THREE.CylinderGeometry(0.052,0.052,len||0.13,18),GALV2.clone());if(axis==='x')b.rotation.z=Math.PI/2;else if(axis==='z')b.rotation.x=Math.PI/2;b.castShadow=true;return b;}

/* cup memeluk pipa MENDATAR (sumbu X): baut ayun + mur menghadap BAWAH, sisi atas bebas untuk aksesori (papan/blade) */
function cupH(){const g=new THREE.Group();
  const sd=saddleY();sd.rotation.z=Math.PI/2;g.add(sd);                                   // channel membungkus pipa sumbu-X
  [0.05,-0.05].forEach(x=>{const e=ear();e.rotation.z=Math.PI/2;e.position.set(x,-0.092,0);g.add(e);}); // telinga baut di bawah
  const b=tBolt(0.2);b.rotation.x=Math.PI;b.position.set(0,-0.12,0);g.add(b);              // baut ayun menghadap bawah, mur+ring di ujung bawah
  const hp=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.2,12),GALV2.clone());hp.rotation.z=Math.PI/2;hp.position.set(0,0.092,0);g.add(hp); // engsel di atas
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});return g;}

function libModel(type){
  const g=new THREE.Group(); const hex=COUPLER[type].hex;
  if(type==='tube'){
    g.add(tube(V(0,-0.82,0),V(0,0.82,0),0.06,GALV.clone()));
    const cap=(y)=>{const c=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.012,10,24),GALV2.clone());c.rotation.x=Math.PI/2;c.position.y=y;g.add(c);};cap(-0.82);cap(0.82);
    for(let i=-3;i<=3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(0.061,0.004,8,20),GALV2.clone());ring.rotation.x=Math.PI/2;ring.position.y=i*0.22;g.add(ring);}
  } else if(type==='soleboard'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(1.3,0.08,0.5),M.wood.clone());b.castShadow=b.receiveShadow=true;b.position.y=0.04;g.add(b);
    for(let i=-2;i<=2;i++){const ln=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.082,0.5),M.woodDark.clone());ln.position.set(i*0.26,0.04,0);g.add(ln);}
  } else if(type==='baseplate'){
    const pl=new THREE.Mesh(new THREE.BoxGeometry(0.64,0.05,0.64),GALV2.clone());pl.position.y=0.025;pl.castShadow=pl.receiveShadow=true;g.add(pl);
    [[-0.23,-0.23],[0.23,-0.23],[0.23,0.23],[-0.23,0.23]].forEach(([x,z])=>{const h=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.07,16),new THREE.MeshStandardMaterial({color:0x20262b,metalness:.5,roughness:.6}));h.position.set(x,0.03,z);g.add(h);});
    const sock=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,0.62,24),GALV.clone());sock.position.y=0.34;sock.castShadow=true;g.add(sock);
    const bore=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.062,0.58,20),new THREE.MeshStandardMaterial({color:0x2a3138,metalness:.5,roughness:.65}));bore.position.y=0.37;g.add(bore);
    const lip=new THREE.Mesh(new THREE.TorusGeometry(0.085,0.014,12,26),GALV2.clone());lip.rotation.x=Math.PI/2;lip.position.y=0.65;g.add(lip);
    const weld=new THREE.Mesh(new THREE.TorusGeometry(0.10,0.02,10,26),GALV2.clone());weld.rotation.x=Math.PI/2;weld.position.y=0.07;g.add(weld);
  } else if(type==='fix'){
    /* GAMBAR 2: double right-angle (klem mati) — 2 cup tempa tegak lurus, masing-masing T-bolt (mur+ring), engsel, boss tempa */
    g.add(vbar(0.82));                                            // pipa vertikal (standard)
    const cz=0.135;
    const hp=hbar(0.72,GALV.clone());hp.position.z=cz;g.add(hp);  // pipa mendatar (ledger) tegak lurus
    const cupV=forgedCup();g.add(cupV);                          // cup pipa vertikal → baut ke bawah
    const cupH2=forgedCup();cupH2.rotation.z=-Math.PI/2;cupH2.position.z=cz;g.add(cupH2); // cup pipa mendatar → baut mendatar
    const bss=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.062,cz+0.02,22),GALV2.clone());bss.rotation.x=Math.PI/2;bss.position.z=cz/2;g.add(bss); // boss tempa penyatu 90°
    const weld=new THREE.Mesh(new THREE.TorusGeometry(0.072,0.012,8,24),GALV2.clone());weld.rotation.x=Math.PI/2;weld.position.z=cz-0.01;g.add(weld);  // jahitan las
    const tg=tag(hex);tg.position.set(0,-0.6,0);g.add(tg);
  } else if(type==='swivel'){
    /* GAMBAR 1: swivel — 2 cup tempa berputar bebas pada HUB & RIVET pusat (sumbu Z); satu cup menyudut */
    g.add(vbar(0.82));
    const ang=Math.PI*0.30, L=0.72, cz=0.16;
    const ax=tube(V(-L*Math.cos(ang),-L*Math.sin(ang),0),V(L*Math.cos(ang),L*Math.sin(ang),0),0.058,GALV.clone());ax.position.z=cz;g.add(ax); // pipa kedua menyudut
    const cupV=forgedCup();g.add(cupV);                          // cup pipa vertikal
    const cupA=forgedCup();cupA.rotation.z=-Math.PI/2+ang;cupA.position.z=cz;g.add(cupA); // cup pipa menyudut (memutar)
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(0.074,0.074,cz+0.02,28),GALV2.clone());hub.rotation.x=Math.PI/2;hub.position.z=cz/2;g.add(hub); // piringan swivel
    const rivet=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,cz+0.08,16),BOLT.clone());rivet.rotation.x=Math.PI/2;rivet.position.z=cz/2;g.add(rivet); // paku keling pusat
    const btn=new THREE.Mesh(new THREE.SphereGeometry(0.028,16,12),BOLT.clone());btn.position.z=cz+0.05;g.add(btn);   // tombol kepala rivet
    const tg=tag(hex);tg.position.set(0,-0.6,0);g.add(tg);
  } else if(type==='sleeve'){
    /* external sleeve — 2 pipa segaris (vertikal) + penutup lengkung pres + 2 baut + lidah */
    g.add(tube(V(0,-0.84,0),V(0,-0.02,0),0.058,GALV.clone()));
    g.add(tube(V(0,0.02,0),V(0,0.84,0),0.058,GALV.clone()));
    const cover=new THREE.Mesh(new THREE.CylinderGeometry(0.086,0.086,0.66,22,1,true,-0.5,Math.PI+1.0),GALV2.clone());
    cover.position.x=0.0;cover.castShadow=true;g.add(cover);
    const plate=new THREE.Mesh(new THREE.BoxGeometry(0.018,0.66,0.17),GALV2.clone());plate.position.x=0.088;g.add(plate);
    const tongue=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.03,0.05),GALV2.clone());tongue.position.set(0.11,0,0.095);g.add(tongue);
    [-0.2,0.2].forEach(y=>{const b=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.22,10),BOLT.clone());b.rotation.z=Math.PI/2;b.position.set(0.09,y,0);g.add(b);const n=hexNut(0.033);n.rotation.z=Math.PI/2;n.position.set(0.185,y,0);g.add(n);});
    const tg=tag(hex);tg.rotation.x=Math.PI/2;tg.position.set(0,0.42,0);g.add(tg);
  } else if(type==='jointpin'){
    /* spigot / expanding joint pin — 2 pipa segaris vertikal + pin internal + baji */
    g.add(tube(V(0,-0.84,0),V(0,-0.16,0),0.062,GALV.clone()));
    g.add(tube(V(0,0.16,0),V(0,0.84,0),0.062,GALV.clone()));
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.42,18),GALV2.clone());pin.castShadow=true;g.add(pin);
    const seg=new THREE.Mesh(new THREE.CylinderGeometry(0.058,0.058,0.16,18),GALV.clone());g.add(seg);
    const wedge=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.044,0.18,14),GALV2.clone());wedge.rotation.z=Math.PI/2;wedge.position.set(0.08,0,0);g.add(wedge);
    const tg=tag(hex);tg.rotation.x=Math.PI/2;tg.position.set(0,0.42,0);g.add(tg);
  } else if(type==='putlog'){
    /* GAMBAR 7: klem putlog — cup memeluk pipa mendatar + BILAH LENGKUNG PRES besar di atas + baut+mur+ring di bawah */
    g.add(hbar(0.8,GALV.clone()));                               // pipa mendatar (ledger)
    g.add(cupH());                                               // cup memeluk pipa, baut menghadap bawah
    const blade=new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.36,30,1,true,Math.PI*0.96,Math.PI*1.18),GALV2.clone());
    blade.rotation.z=Math.PI/2;blade.position.set(0,0.165,0.0);blade.rotation.y=0.0;blade.castShadow=true;g.add(blade); // bilah scoop besar di atas
    const lipb=new THREE.Mesh(new THREE.TorusGeometry(0.18,0.012,8,30,Math.PI*1.18),GALV2.clone());lipb.rotation.y=Math.PI/2;lipb.position.set(0.18,0.165,0);g.add(lipb);
    const rib=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.14,0.22),GALV2.clone());rib.position.set(0,0.1,0);g.add(rib); // rusuk penegar pangkal bilah
    const tg=tag(hex);tg.rotation.x=Math.PI/2;tg.position.set(0.5,0,0);g.add(tg);
  } else if(type==='board'){
    /* GAMBAR 6: klem papan/toe board — cup memeluk pipa mendatar + 2 LIDAH PIPIH menyudut di atas (cradle papan) + baut+mur di bawah */
    g.add(hbar(0.8,GALV.clone()));                               // pipa mendatar (ledger)
    g.add(cupH());                                               // cup memeluk pipa, baut menghadap bawah
    const seat=new THREE.Mesh(new THREE.BoxGeometry(0.17,0.022,0.1),GALV2.clone());seat.position.y=0.115;seat.castShadow=true;g.add(seat); // dudukan puncak cup
    [-1,1].forEach(s=>{const tab=new THREE.Mesh(new THREE.BoxGeometry(0.21,0.02,0.085),GALV2.clone());tab.position.set(0,0.165,s*0.085);tab.rotation.x=-s*0.5;tab.castShadow=true;g.add(tab);}); // 2 lidah pipih menyudut keluar
    const board=new THREE.Mesh(new THREE.BoxGeometry(0.16,0.05,0.34),M.woodDark.clone());board.position.y=0.235;board.castShadow=true;g.add(board); // papan duduk di cradle
    const tg=tag(hex);tg.rotation.x=Math.PI/2;tg.position.set(0.5,0,0);g.add(tg);
  } else if(type==='beamclamp'){
    /* Beam/girder clamp: rahang menjepit sayap profil baja + sekrup penekan + cup pipa scaffold di atas */
    const fM=new THREE.MeshStandardMaterial({color:0x9aa3ab,metalness:.6,roughness:.5});
    const topF=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.03,0.34),fM);topF.position.y=0.12;g.add(topF);   // sayap atas I-beam
    const botF=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.03,0.34),fM);botF.position.y=-0.12;g.add(botF);  // sayap bawah
    const web=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.21,0.03),fM);g.add(web);                          // badan
    [-1,1].forEach(s=>{const jaw=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.18,0.40),GALV2.clone());jaw.position.set(s*0.2,0.12,0);g.add(jaw);
      const lip=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.03,0.40),GALV2.clone());lip.position.set(s*0.2,0.045,0);g.add(lip);});                  // rahang C memeluk sayap
    const scr=new THREE.Mesh(new THREE.CylinderGeometry(0.016,0.016,0.2,10),BOLT.clone());scr.position.set(0.2,-0.04,0);g.add(scr);
    const sn=hexNut(0.032);sn.position.set(0.2,-0.15,0);g.add(sn);                                          // sekrup penekan
    g.add(tube(V(0,0.14,0),V(0,0.72,0),0.058,GALV.clone()));                                                // stub pipa scaffold
    const cup=forgedCup();cup.position.y=0.4;cup.scale.set(0.88,0.88,0.88);g.add(cup);                      // cup penyambung tube
    const tg=tag(hex);tg.rotation.x=Math.PI/2;tg.position.set(0,-0.22,0.2);g.add(tg);
  } else if(type==='anchorclamp'){
    /* Anchor / tie: pelat angkur ke dinding + ring(eye) bolt + pipa tie + cup ke standard */
    const pM=new THREE.MeshStandardMaterial({color:0x8a929a,metalness:.5,roughness:.6});
    const plate=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.5,0.42),pM);plate.position.x=-0.36;plate.castShadow=true;g.add(plate);
    [[0.16,0.13],[-0.16,0.13],[0.16,-0.13],[-0.16,-0.13]].forEach(([yy,zz])=>{const h=new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.028,0.08,14),new THREE.MeshStandardMaterial({color:0x20262b}));h.rotation.z=Math.PI/2;h.position.set(-0.36,yy,zz);g.add(h);}); // lubang baut
    const eye=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.018,12,24),GALV2.clone());eye.rotation.y=Math.PI/2;eye.position.set(-0.24,0,0);g.add(eye); // ring/eye
    const shank=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,0.18,12),BOLT.clone());shank.rotation.z=Math.PI/2;shank.position.set(-0.32,0,0);g.add(shank);
    g.add(tube(V(-0.18,0,0),V(0.52,0,0),0.058,GALV.clone()));                                               // pipa tie mendatar
    const cup=forgedCup();cup.rotation.z=Math.PI/2;cup.position.x=0.36;g.add(cup);                          // cup ke standard
    const tg=tag(hex);tg.rotation.x=Math.PI/2;tg.position.set(0.12,-0.16,0);g.add(tg);
  } else if(type==='redtag'||type==='greentag'){
    /* Scaffold tag (kartu status) — hijau = layak / merah = jangan dipakai */
    const green=(type==='greentag'),col=green?0x2ECC71:0xE74C3C;
    const loop=new THREE.Mesh(new THREE.TorusGeometry(0.07,0.015,10,24),GALV2.clone());loop.position.y=0.6;g.add(loop);
    const tieM=new THREE.Mesh(new THREE.CylinderGeometry(0.006,0.006,0.18,8),new THREE.MeshStandardMaterial({color:0x111}));tieM.position.y=0.49;g.add(tieM);
    const card=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.7,0.02),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.28,roughness:.5,metalness:.05}));card.position.y=0.05;card.castShadow=true;g.add(card);
    const hdr=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.16,0.024),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.2}));hdr.position.set(0,0.33,0.003);g.add(hdr);
    for(let i=0;i<3;i++){const ln=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.03,0.024),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.15}));ln.position.set(0,0.12-i*0.13,0.005);g.add(ln);}
    const mk=new THREE.Mesh(new THREE.TorusGeometry(0.07,0.018,8,22),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xffffff,emissiveIntensity:.3}));mk.position.set(0,-0.27,0.012);g.add(mk);
  } else if(type==='ratchet'){
    /* Kunci ratchet / podger: gagang + kepala ratchet bersoket segi-enam + ujung podger lancip */
    const stl=new THREE.MeshStandardMaterial({color:0x6f777e,metalness:.7,roughness:.4});
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.95,16),stl);handle.rotation.z=Math.PI/2;g.add(handle);
    const grip=new THREE.Mesh(new THREE.CylinderGeometry(0.046,0.042,0.34,16),new THREE.MeshStandardMaterial({color:0x222,roughness:.9}));grip.rotation.z=Math.PI/2;grip.position.x=0.3;g.add(grip);
    const head=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.1,0.07,24),stl);head.rotation.x=Math.PI/2;head.position.x=-0.5;g.add(head);
    const sock=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.09,6),new THREE.MeshStandardMaterial({color:0x33383d,metalness:.6,roughness:.5}));sock.rotation.x=Math.PI/2;sock.position.set(-0.5,0,0.02);g.add(sock);
    const lever=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.03,0.03),stl);lever.position.set(-0.42,0.08,0);g.add(lever);
    const spike=new THREE.Mesh(new THREE.ConeGeometry(0.035,0.26,16),stl);spike.rotation.z=-Math.PI/2;spike.position.x=0.62;g.add(spike);
    const tg=tag(hex);tg.rotation.x=Math.PI/2;tg.position.set(-0.5,0,0.12);g.add(tg);
  } else if(type==='levelmeter'){
    /* Level meter / waterpass: badan + vial gelembung hijau + lubang pegang */
    const body=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.16,0.12),new THREE.MeshStandardMaterial({color:0xF5C518,metalness:.3,roughness:.5,emissive:0x5a4a00,emissiveIntensity:.15}));g.add(body);
    [-0.085,0.085].forEach(yy=>{const fr=new THREE.Mesh(new THREE.BoxGeometry(1.12,0.02,0.13),new THREE.MeshStandardMaterial({color:0x1a1a1a,metalness:.4,roughness:.6}));fr.position.y=yy;g.add(fr);});
    const vh=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.2,16),new THREE.MeshStandardMaterial({color:0x7CFC00,transparent:true,opacity:.55,emissive:0x2ECC71,emissiveIntensity:.5}));vh.rotation.z=Math.PI/2;g.add(vh);
    const bub=new THREE.Mesh(new THREE.SphereGeometry(0.03,14,12),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xeaffea,emissiveIntensity:.6}));g.add(bub);
    const vv=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.13,16),new THREE.MeshStandardMaterial({color:0x7CFC00,transparent:true,opacity:.55,emissive:0x2ECC71,emissiveIntensity:.4}));vv.position.x=-0.4;g.add(vv);
    const hole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.13,18),new THREE.MeshStandardMaterial({color:0x111}));hole.rotation.x=Math.PI/2;hole.position.x=0.34;g.add(hole);
  } else if(type==='distancemeter'){
    /* Distance meter / meteran gulung: casing + pita kuning berskala + hook */
    const cM=new THREE.MeshStandardMaterial({color:0xE0B100,metalness:.3,roughness:.5,emissive:0x4a3a00,emissiveIntensity:.12});
    const edge=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.21,0.24,28),cM);edge.rotation.x=Math.PI/2;edge.position.x=-0.2;edge.castShadow=true;g.add(edge);
    const body=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.42,0.24),cM);body.position.x=-0.28;g.add(body);
    const btn=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.05,0.02),new THREE.MeshStandardMaterial({color:0x222}));btn.position.set(-0.2,0.16,0.13);g.add(btn);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(0.72,0.06,0.012),new THREE.MeshStandardMaterial({color:0xF5D90A,metalness:.2,roughness:.4,emissive:0x6a5d00,emissiveIntensity:.2}));blade.position.set(0.22,-0.04,0);blade.rotation.z=0.04;g.add(blade);
    for(let i=0;i<6;i++){const ln=new THREE.Mesh(new THREE.BoxGeometry(0.008,0.04,0.014),new THREE.MeshStandardMaterial({color:0x111}));ln.position.set(-0.04+i*0.11,-0.04,0.008);g.add(ln);}
    const hook=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.1,0.06),new THREE.MeshStandardMaterial({color:0x9aa3ab,metalness:.6,roughness:.4}));hook.position.set(0.57,-0.04,0);g.add(hook);
  } else if(type==='ladder'){
    const sx=0.17,yB=-0.78,yT=0.78;
    [-sx,sx].forEach(xx=>g.add(tube(V(xx,yB,0),V(xx,yT,0),0.032,GALV.clone())));
    for(let k=0;k<=7;k++){const y=yB+(yT-yB)*k/7;g.add(tube(V(-sx,y,0),V(sx,y,0),0.022,GALV2.clone()));}
    const rr=tag(hex);rr.position.set(0,yT+0.08,0);g.add(rr);
  } else if(type==='plank'){
    const grp=new THREE.Group();
    const bd=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.07,0.45),M.wood.clone());bd.castShadow=bd.receiveShadow=true;grp.add(bd);
    for(let i=-1;i<=1;i++){const ln=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.072,0.006),M.woodDark.clone());ln.position.z=i*0.15;grp.add(ln);}
    [-0.72,0.72].forEach(x=>{const band=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.085,0.47),GALV2.clone());band.position.set(x,0,0);band.castShadow=true;grp.add(band);[-0.16,0,0.16].forEach(z=>{const nail=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,0.02,8),BOLT.clone());nail.position.set(x,0.045,z);grp.add(nail);});});
    grp.rotation.z=0.16;grp.rotation.x=-0.12;g.add(grp);
  }
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  return g;
}

let curLibModel=null;
const LIB_LIFT={tube:0.82,soleboard:0.0,baseplate:0.0,fix:0.82,swivel:0.82,sleeve:0.84,jointpin:0.84,putlog:0.26,board:0.26,plank:0.18,ladder:0.78,beamclamp:0.16,anchorclamp:0.26,redtag:0.36,greentag:0.36,ratchet:0.12,levelmeter:0.1,distancemeter:0.22};
function showLibModel(type){
  if(curLibModel){libHolder.remove(curLibModel); disposeTree(curLibModel);}
  curLibModel=libModel(type); curLibModel.position.y=(LIB_LIFT[type]!=null?LIB_LIFT[type]:0.84);
  libHolder.add(curLibModel); libHolder.rotation.y=0;
  markDirty();
}

/* ============================================================
   3D LABELS
   ============================================================ */
let labels=[];
function addLabel(text,pos,cls){
  const el=document.createElement('div');el.className='lbl '+(cls||'dim');el.textContent=text;
  labelLayer.appendChild(el);const o={el,pos:pos.clone()};labels.push(o);return o;
}
function clearLabels(){labels.forEach(l=>l.el.remove());labels=[];}
function updateLabels(){
  if(!labels.length) return;
  const w=container.clientWidth,h=container.clientHeight;
  for(const l of labels){
    const v=l.pos.clone().project(camera);
    if(v.z>1){l.el.style.display='none';continue;}
    l.el.style.display='block';
    l.el.style.left=((v.x*0.5+0.5)*w)+'px';
    l.el.style.top=((-v.y*0.5+0.5)*h)+'px';
  }
}

/* ============================================================
   ORBIT CAMERA (mouse + touch)
   ============================================================ */
const CAM_HOME={x:0,y:2.4,z:0.3,r:14,theta:0.72,phi:1.02};
const cam = {
  target:V(CAM_HOME.x,CAM_HOME.y,CAM_HOME.z), radius:CAM_HOME.r, theta:CAM_HOME.theta, phi:CAM_HOME.phi,
  tTarget:V(CAM_HOME.x,CAM_HOME.y,CAM_HOME.z), tRadius:CAM_HOME.r, tTheta:CAM_HOME.theta, tPhi:CAM_HOME.phi,
  minR:3, maxR:32
};
function applyCam(){
  const s=Math.sin(cam.phi);
  camera.position.set(
    cam.target.x + cam.radius*s*Math.sin(cam.theta),
    cam.target.y + cam.radius*Math.cos(cam.phi),
    cam.target.z + cam.radius*s*Math.cos(cam.theta));
  camera.lookAt(cam.target);
}
function frame(tx,ty,tz,r,theta,phi){
  cam.tTarget.set(tx,ty,tz);cam.tRadius=fitRadius(r);cam.tTheta=theta;cam.tPhi=phi;
  markView();
}
/* mengembalikan true bila kamera masih bergerak (render diperlukan); instan bila gerak dikurangi */
function dampCam(){
  const k=REDUCED?1:0.12;
  const dT=cam.tTheta-cam.theta, dP=cam.tPhi-cam.phi, dR=cam.tRadius-cam.radius, dX=cam.target.distanceTo(cam.tTarget);
  if(Math.abs(dT)<1e-5 && Math.abs(dP)<1e-5 && Math.abs(dR)<1e-4 && dX<1e-5) return false;
  cam.theta+=dT*k; cam.phi+=dP*k; cam.radius+=dR*k; cam.target.lerp(cam.tTarget,k);
  applyCam();
  return true;
}
const el=renderer.domElement;
let ptrs=new Map(), lastMid=null, lastDist=0, downInfo=null, laserMode=false;
function pXY(e){return {x:e.clientX,y:e.clientY};}
el.addEventListener('pointerdown',e=>{
  el.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId,pXY(e));
  if(ptrs.size===1) downInfo={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId,moved:false,button:e.button};
  if(ptrs.size===2){lastMid=midOf();lastDist=distOf();downInfo=null;}
});
el.addEventListener('pointermove',e=>{
  if(!ptrs.has(e.pointerId))return;
  const prev=ptrs.get(e.pointerId);const cur=pXY(e);ptrs.set(e.pointerId,cur);
  if(ptrs.size===1){
    const dx=cur.x-prev.x,dy=cur.y-prev.y;
    if(downInfo&&Math.hypot(cur.x-downInfo.x,cur.y-downInfo.y)>6)downInfo.moved=true;
    if(downInfo&&(downInfo.button===2||downInfo.button===1)){
      panCamera(dx,dy);                         // klik kanan / tengah = geser
    } else {
      cam.tTheta-=dx*0.006; cam.tPhi=Math.max(0.18,Math.min(1.5,cam.tPhi-dy*0.006));
    }
  } else if(ptrs.size===2){
    const mid=midOf(),dist=distOf();
    if(lastDist){cam.tRadius=Math.max(cam.minR,Math.min(cam.maxR,cam.tRadius*(lastDist/dist)));}
    if(lastMid){ panCamera(mid.x-lastMid.x,mid.y-lastMid.y); }
    lastMid=mid;lastDist=dist;
  }
});
function endPtr(e){
  if(!laserMode && downInfo&&e.pointerId===downInfo.id&&!downInfo.moved&&(performance.now()-downInfo.t)<400
     && downInfo.button===0){
    tryPick(e);
  }
  ptrs.delete(e.pointerId);
  if(ptrs.size<2){lastMid=null;lastDist=0;}
}
el.addEventListener('pointerup',endPtr);
el.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);lastMid=null;lastDist=0;});
function midOf(){const a=[...ptrs.values()];return {x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};}
function distOf(){const a=[...ptrs.values()];return Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}
function panCamera(dx,dy){
  const f=cam.radius*0.0016;
  const right=V(Math.cos(cam.theta),0,-Math.sin(cam.theta));
  cam.tTarget.addScaledVector(right,-dx*f);
  cam.tTarget.addScaledVector(V(0,1,0),dy*f);
}
el.addEventListener('wheel',e=>{e.preventDefault();
  cam.tRadius=Math.max(cam.minR,Math.min(cam.maxR,cam.tRadius*(1+Math.sign(e.deltaY)*0.08)));
},{passive:false});
el.addEventListener('contextmenu',e=>e.preventDefault());
/* keyboard pada kanvas: panah = putar, +/− = zoom, Enter = pasang komponen */
el.addEventListener('keydown',function(e){
  const k=e.key; let used=true;
  if(k==='ArrowLeft') cam.tTheta+=0.12; else if(k==='ArrowRight') cam.tTheta-=0.12;
  else if(k==='ArrowUp') cam.tPhi=Math.max(0.18,cam.tPhi-0.08); else if(k==='ArrowDown') cam.tPhi=Math.min(1.5,cam.tPhi+0.08);
  else if(k==='+'||k==='=') zoomBy(0.9); else if(k==='-'||k==='_') zoomBy(1.1);
  else if(k==='Enter'&&MODE==='build') confirmStep();
  else used=false;
  if(used){ e.preventDefault(); markView(); }
});

/* raycast pick (memasang komponen berikutnya dengan klik/ketuk sorotannya) */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function tryPick(e){
  if(MODE!=='build'||state.current>=STEPS.length)return;
  const rect=el.getBoundingClientRect();
  ndc.x=((e.clientX-rect.left)/rect.width)*2-1;
  ndc.y=-((e.clientY-rect.top)/rect.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObject(stepGroups[state.current],true);
  if(hits.length) confirmStep();
}

document.getElementById('camReset').onclick=()=>{
  if(MODE==='lib') frame(0,0.6,0,4.0,0.62,1.05);
  else frame(CAM_HOME.x,CAM_HOME.y,CAM_HOME.z,CAM_HOME.r,CAM_HOME.theta,CAM_HOME.phi);
};

/* ---- tombol geser (pan) & zoom ---- */
function panBy(dx,dy){
  const f=cam.radius*0.05;
  const right=V(Math.cos(cam.theta),0,-Math.sin(cam.theta));
  cam.tTarget.addScaledVector(right,-dx*f);
  cam.tTarget.addScaledVector(V(0,1,0),dy*f);
}
function zoomBy(k){ cam.tRadius=Math.max(cam.minR,Math.min(cam.maxR,cam.tRadius*k)); }
function holdBtn(id,fn){
  const b=document.getElementById(id); if(!b)return;
  let iv=null;
  const run=()=>{ fn(); markView(); };
  const start=(e)=>{ if(e.button!==undefined&&e.button!==0) return; e.preventDefault(); run(); iv=setInterval(run,80); };
  const stop=()=>{if(iv){clearInterval(iv);iv=null;}};
  b.addEventListener('pointerdown',start);
  ['pointerup','pointerleave','pointercancel'].forEach(ev=>b.addEventListener(ev,stop));
  b.addEventListener('click',e=>{ if(e.detail===0) run(); });   /* Enter/Spasi dari keyboard */
}
holdBtn('u',()=>panBy(0,1));
holdBtn('d',()=>panBy(0,-1));
holdBtn('l',()=>panBy(-1,0));
holdBtn('r',()=>panBy(1,0));
holdBtn('zoomIn',()=>zoomBy(0.95));
holdBtn('zoomOut',()=>zoomBy(1.05));

/* ---- toggle ilustrasi pekerja ---- */
const wkBtn=document.getElementById('workerBtn');
if(wkBtn){ wkBtn.classList.add('on'); wkBtn.setAttribute('aria-pressed','true'); wkBtn.onclick=()=>{ showWorkers=!showWorkers; wkBtn.classList.toggle('on',showWorkers); wkBtn.setAttribute('aria-pressed',showWorkers?'true':'false'); updateWorkers(); toast(showWorkers?'Ilustrasi pekerja ditampilkan (setelah tag hijau)':'Ilustrasi pekerja disembunyikan'); }; }
/* ---- laser pointer ---- */
const laserBtn=document.getElementById('laserBtn');
if(laserBtn) laserBtn.onclick=()=>{
  laserMode=!laserMode; laserBtn.classList.toggle('on',laserMode); laserBtn.setAttribute('aria-pressed',laserMode?'true':'false');
  if(!laserMode){ laserGroup.visible=false; markView(); }
  toast(laserMode?'Mode laser aktif — gerakkan kursor atau ketuk adegan untuk menunjuk':'Mode laser nonaktif');
};
const laserGroup=new THREE.Group(); laserGroup.visible=false; scene.add(laserGroup);
const laserBeam=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,1,10),
  new THREE.MeshBasicMaterial({color:0xff3b3b,transparent:true,opacity:.8})); laserGroup.add(laserBeam);
const laserDot=new THREE.Mesh(new THREE.SphereGeometry(0.055,16,12),
  new THREE.MeshBasicMaterial({color:0xff5a5a})); laserGroup.add(laserDot);
const laserRing=new THREE.Mesh(new THREE.TorusGeometry(0.14,0.014,8,26),
  new THREE.MeshBasicMaterial({color:0xff3b3b,transparent:true,opacity:.7})); laserRing.rotation.x=Math.PI/2; laserGroup.add(laserRing);
function moveLaserTo(p){
  laserGroup.visible=true;
  laserDot.position.copy(p); laserRing.position.copy(p);
  const h=Math.max(0.3,p.y); laserBeam.scale.y=h; laserBeam.position.set(p.x,h/2,p.z);
}
let laserT=null;
function updateLaser(e){
  if(!laserMode){ if(laserGroup.visible){ laserGroup.visible=false; markView(); } return; }
  const rect=el.getBoundingClientRect();
  ndc.x=((e.clientX-rect.left)/rect.width)*2-1;
  ndc.y=-((e.clientY-rect.top)/rect.height)*2+1;
  ray.setFromCamera(ndc,camera);
  const targets=[];
  if(scaffold.visible) targets.push(scaffold);
  if(ground.visible) targets.push(ground);
  if(libRig.visible) targets.push(libRig);
  let hit=null;
  targets.forEach(t=>{const hs=ray.intersectObject(t,true); if(hs.length&&(!hit||hs[0].distance<hit.distance)) hit=hs[0];});
  if(hit) moveLaserTo(hit.point); else laserGroup.visible=false;
  markView();
  clearTimeout(laserT); laserT=setTimeout(function(){ laserGroup.visible=false; markView(); },2000);   /* hilang setelah 2 detik */
}
el.addEventListener('pointermove',updateLaser);
el.addEventListener('pointerdown',function(e){ if(laserMode) updateLaser(e); });   /* ketuk = tunjuk (layar sentuh) */

/* ============================================================
   ASSEMBLY STATE
   ============================================================ */
const state={current:0}; // indeks tahap yang sedang tampil sebagai sorotan (ghost)
const hintGroup = new THREE.Group(); scene.add(hintGroup);
function clearHint(){ while(hintGroup.children.length){ const c=hintGroup.children[0]; hintGroup.remove(c); disposeTree(c); } markDirty(); }
function showHint(){ clearHint(); if(MODE!=='build')return; if(state.current>=STEPS.length)return; const s=STEPS[state.current]; if(s&&s.hint){ try{ s.hint().forEach(o=>hintGroup.add(o)); }catch(err){ if(window.console) console.warn('[PPAPI] hint',err); } } }
/* objek yang dilepas/diganti oleh tahap tertentu (rail penutup, tag merah, barikade) disembunyikan setelah tahap itu dipasang */
function applyRemovals(){ STEPS.forEach((s,i)=>{ if(!s.hides) return; const gone=state.current>i; s.hides.forEach(k=>(KEYED[k]||[]).forEach(o=>{ o.visible=!gone; })); }); }
function showPreview(){
  if(state.current>=STEPS.length)return;
  const g=stepGroups[state.current];
  g.visible=true; setGhost(g,true);
}
function solidifyUpTo(){ // < current: padat; = current: sorotan; > current: tersembunyi
  stepGroups.forEach((g,i)=>{
    if(i<state.current){ g.visible=true; setGhost(g,false); }
    else if(i===state.current){ g.visible=true; setGhost(g,true); }
    else { g.visible=false; }
  });
  applyRemovals();
}
function showBuilt(){ // mode inspeksi: hanya yang sudah terpasang, tanpa sorotan
  stepGroups.forEach((g,i)=>{ g.visible=i<state.current; setGhost(g,false); });
  applyRemovals();
}
function confirmStep(){
  if(state.current>=STEPS.length)return;
  const s=STEPS[state.current];
  if(s.id==='inspeksi'){
    const ev=evaluate();
    if(!ev.ready){ toast('Inspeksi menemukan '+ev.fails.length+' butir yang belum memenuhi. Perbaiki dahulu; tag hijau belum boleh dipasang.'); renderBuildPanel(); return; }
  }
  setGhost(stepGroups[state.current],false);
  state.current++;
  if(state.current<STEPS.length) showPreview();
  applyRemovals(); showHint(); updateWorkers(); renderBuildPanel();
  if(s.id==='inspeksi') toast('Hasil inspeksi serah terima dicatat: semua butir memenuhi.');
  else if(state.current>=STEPS.length) toast('Tag hijau terpasang — perancah boleh digunakan.');
  report({current:state.current}); markDirty();
}
function undoStep(){
  if(state.current<=0)return;
  if(state.current<STEPS.length){ stepGroups[state.current].visible=false; }
  state.current--;
  setGhost(stepGroups[state.current],true);
  stepGroups[state.current].visible=true;
  applyRemovals(); showHint(); updateWorkers(); renderBuildPanel();
  report({current:state.current}); markDirty();
}

/* ============================================================
   INSPEKSI — MENGUKUR MODEL (bukan tanda ✓ tetap)
   Data diambil dari mesh yang benar-benar terpasang (tahap < current dan terlihat):
   ujung pipa dari matriks dunia + panjang geometri, kotak batas papan/toe board.
   ============================================================ */
function fmt(n,dg){ const p=Math.pow(10,dg); let v=Math.round(n*p)/p; if(Object.is(v,-0)||Math.abs(v)<0.5/p) v=0; return v.toFixed(dg).replace('.',','); }
function tubeEnds(m){
  const p=new THREE.Vector3(), q=new THREE.Quaternion(), s=new THREE.Vector3();
  m.matrixWorld.decompose(p,q,s);
  const h=m.geometry.parameters.height*s.y, dir=V(0,1,0).applyQuaternion(q).normalize();
  const a=p.clone().addScaledVector(dir,-h/2), b=p.clone().addScaledVector(dir,h/2);
  return a.y<=b.y ? {a:a,b:b,r:m.geometry.parameters.radiusTop,len:h} : {a:b,b:a,r:m.geometry.parameters.radiusTop,len:h};
}
function boxOf(o){ return new THREE.Box3().setFromObject(o); }
function collect(){
  scaffold.updateMatrixWorld(true);
  const E={};
  const walk=(o)=>{ for(const c of o.children){ if(!c.visible) continue; const r=c.userData.role; if(r) (E[r]=E[r]||[]).push(c); walk(c); } };
  for(let i=0;i<Math.min(state.current,stepGroups.length);i++) walk(stepGroups[i]);
  return E;
}
function uniqSorted(arr,tol){ const s=arr.slice().sort((a,b)=>a-b), out=[]; s.forEach(v=>{ if(!out.length||Math.abs(v-out[out.length-1])>tol) out.push(v); }); return out; }
/* panjang gabungan interval yang menutupi [lo,hi] (toleransi celah kecil di simpul/klem) */
function covers(iv,lo,hi,tol){ const s=iv.slice().sort((a,b)=>a[0]-b[0]); let reach=lo; for(const [a,b] of s){ if(a>reach+tol) break; reach=Math.max(reach,b); } return reach>=hi-tol; }
/* jarak titik ke ruas pipa: d (m) dan s = posisi sepanjang pipa dari ujung a (m) */
function segPt(p,a,b){ const ab=b.clone().sub(a), L2=ab.lengthSq(), t=L2>1e-12?Math.max(0,Math.min(1,p.clone().sub(a).dot(ab)/L2)):0; return {d:a.clone().addScaledVector(ab,t).distanceTo(p), s:t*Math.sqrt(L2)}; }
/* jarak terdekat antara dua ruas (sumbu pipa); pa/pb titik terdekat, sa/sb posisinya sepanjang masing-masing ruas (m) */
function segSeg(p1,q1,p2,q2){
  const d1=q1.clone().sub(p1), d2=q2.clone().sub(p2), r=p1.clone().sub(p2), a=d1.dot(d1), e=d2.dot(d2), f=d2.dot(r);
  let s=0, t=0;
  if(a>1e-12||e>1e-12){
    if(a<=1e-12){ t=Math.min(1,Math.max(0,f/e)); }
    else { const c=d1.dot(r); if(e<=1e-12){ s=Math.min(1,Math.max(0,-c/a)); }
      else { const b=d1.dot(d2), den=a*e-b*b; s=den>1e-12?Math.min(1,Math.max(0,(b*f-c*e)/den)):0; t=(b*s+f)/e;
        if(t<0){ t=0; s=Math.min(1,Math.max(0,-c/a)); } else if(t>1){ t=1; s=Math.min(1,Math.max(0,(b-c)/a)); } } }
  }
  const pa=p1.clone().addScaledVector(d1,s), pb=p2.clone().addScaledVector(d2,t);
  return {d:pa.distanceTo(pb), pa:pa, pb:pb, sa:s*Math.sqrt(a), sb:t*Math.sqrt(e)};
}
/* klem benar-benar menjepit pipa: pusat klem ≤ (r + 30 mm) dari sumbu pipa dan ≥ 36 mm di dalam kedua ujung pipa */
function grips(p,t){ const q=segPt(p,t.a,t.b); return q.d<=t.r+0.03&&q.s>=0.036&&q.s<=t.len-0.036; }
function evaluate(){
  const E=collect(), items=[], m={};
  /* how: 'ukur' = diukur dari geometri model; 'cek' = diperiksa dari keberadaan/jenis komponen; 'ukur+cek' = keduanya */
  const add=(id,grp,label,ok,value,limit,ref,how)=>items.push({id:id,grp:grp,label:label,ok:!!ok,value:value,limit:limit,ref:ref,how:how||'ukur'});
  const tubes=(k)=>(E[k]||[]).map(tubeEnds);
  const boxes=(k)=>(E[k]||[]).map(boxOf);
  const cplPos=(E.coupler||[]).concat(E['ladder-tie']||[]).map(o=>{ const p=new THREE.Vector3(); o.getWorldPosition(p); return p; });

  /* ---- dasar & rangka ---- */
  const colMap=new Map();
  tubes('standard').forEach(t=>{
    const k=t.a.x.toFixed(2)+','+t.a.z.toFixed(2);
    let c=colMap.get(k); if(!c){ c={x:t.a.x,z:t.a.z,base:t.a,top:t.b.y,dev:0,abs:0,n:0}; colMap.set(k,c); }
    if(t.a.y<c.base.y) c.base=t.a;
    c.top=Math.max(c.top,t.b.y); c.n++;
    c.dev=Math.max(c.dev, Math.hypot(t.b.x-t.a.x,t.b.z-t.a.z)/t.len*2000);
  });
  colMap.forEach(c=>{ tubes('standard').forEach(t=>{ if(Math.abs(t.a.x-c.x)<0.05&&Math.abs(t.a.z-c.z)<0.05) c.abs=Math.max(c.abs,Math.hypot(t.b.x-c.base.x,t.b.z-c.base.z)*1000); }); });
  const columns=[...colMap.values()].filter(c=>c.base.y<0.2);
  m.columns=columns;
  const plates=boxes('baseplate'), soles=boxes('sole');
  const under=(p,list)=>list.some(b=>p.x>=b.min.x-0.005&&p.x<=b.max.x+0.005&&p.z>=b.min.z-0.005&&p.z<=b.max.z+0.005);
  const sup=columns.filter(c=>under(c,plates)&&under(c,soles)).length;
  add('dasar','Dasar & rangka','Sole board & base plate di bawah setiap standard', columns.length===NODES.length&&sup===NODES.length,
    columns.length?sup+' dari '+NODES.length+' standard':'belum ada standard','semua standard bertumpu pada base plate dan sole board','OSHA 1926.451(c)(2)');
  const bp=plates.filter(b=>b.max.y<0.1);
  const minArea=bp.length?Math.min(...bp.map(b=>(b.max.x-b.min.x)*(b.max.z-b.min.z)))*1e4:0;
  const minW=bp.length?Math.min(...bp.map(b=>Math.min(b.max.x-b.min.x,b.max.z-b.min.z)))*1000:0;
  add('baseplate','Dasar & rangka','Ukuran base plate', bp.length>0&&minArea>=150&&minW>=120,
    bp.length?fmt(minArea,0)+' cm² · lebar '+fmt(minW,0)+' mm':'belum ada base plate','luas ≥ 150 cm², lebar ≥ 120 mm','EN 12811-1 butir 5.7.1');
  const maxDev=columns.length?Math.max(...columns.map(c=>c.dev)):0, maxAbs=columns.length?Math.max(...columns.map(c=>c.abs)):0;
  add('plumb','Dasar & rangka','Standard tegak', columns.length>0&&maxDev<=20&&maxAbs<=50,
    columns.length?'deviasi maks. '+fmt(maxDev,0)+' mm per 2 m (total '+fmt(maxAbs,0)+' mm)':'belum ada standard','≤ 20 mm per 2 m, total ≤ 50 mm','BS EN 12811-1 NA Tabel NA.1');
  const lvMap=new Map();
  tubes('ledger').forEach(t=>{ const k=t.a.y.toFixed(2); const h=Math.hypot(t.b.x-t.a.x,t.b.z-t.a.z)||1; const dv=(t.b.y-t.a.y)/h*2000; const o=lvMap.get(k)||{y:(t.a.y+t.b.y)/2,dev:0,n:0}; o.dev=Math.max(o.dev,dv); o.n++; lvMap.set(k,o); });
  const levels=[...lvMap.values()].sort((a,b)=>a.y-b.y);
  m.levels=levels;
  const maxLv=levels.length?Math.max(...levels.map(l=>l.dev)):0;
  add('level','Dasar & rangka','Ledger datar', levels.length>0&&maxLv<=20,
    levels.length?'deviasi maks. '+fmt(maxLv,0)+' mm per 2 m ('+levels.length+' level)':'belum ada ledger','≤ 20 mm per 2 m','BS EN 12811-1 NA Tabel NA.1');
  const xs=uniqSorted(columns.map(c=>c.x),0.05), zs=uniqSorted(columns.map(c=>c.z),0.05);
  const bays=[]; for(let i=1;i<xs.length;i++) bays.push(xs[i]-xs[i-1]);
  const width=zs.length>1?zs[zs.length-1]-zs[0]:0;
  m.xs=xs; m.zs=zs; m.bays=bays; m.width=width;
  add('dims','Dasar & rangka','Jarak tiang (bay × lebar)', bays.length>0&&width>0&&Math.max(...bays)<=3.048&&width<=1.219,
    bays.length?'bay '+bays.map(b=>fmt(b,2)).join(' + ')+' m · lebar '+fmt(width,2)+' m':'belum ada standard','light duty: ≤ 10 ft (3,05 m) × 4 ft (1,22 m)','OSHA 1926 Subpart L App. A (pedoman)');
  const lifts=[]; for(let i=1;i<levels.length;i++) lifts.push({y0:levels[i-1].y,y1:levels[i].y,h:levels[i].y-levels[i-1].y});
  m.lifts=lifts;
  const transoms=tubes('transom');
  const lowL=levels.length?levels[0].y:null, lowT=transoms.length?Math.min(...transoms.map(t=>t.a.y)):null;
  add('lift','Dasar & rangka','Ledger terbawah & jarak antar-lift', lifts.length>0&&Math.max(...lifts.map(l=>l.h))<=1.981&&lowL!==null&&lowL<=0.30&&lowT!==null&&lowT<=0.30+ON_LEDGER,
    levels.length?'ledger terbawah +'+fmt(lowL,2)+' m'+(lifts.length?' · lift '+lifts.map(l=>fmt(l.h,2)).join(' / ')+' m':' · belum ada lift'):'belum ada ledger',
    'ledger & transom terbawah sedekat mungkin ke dasar; lift ≤ 6 ft 6 in (1,98 m)','OSHA 1926.452(b)(8) · App. A (pedoman)');
  const diags=[];
  if(zs.length===2) for(let i=1;i<xs.length;i++){ const d1=Math.hypot(xs[i]-xs[i-1],zs[1]-zs[0]), d2=Math.hypot(xs[i]-xs[i-1],zs[0]-zs[1]);
    const c=(x,z)=>columns.find(cc=>Math.abs(cc.x-x)<0.05&&Math.abs(cc.z-z)<0.05);
    const a=c(xs[i-1],zs[0]),b=c(xs[i],zs[1]),e=c(xs[i],zs[0]),f=c(xs[i-1],zs[1]);
    if(a&&b&&e&&f) diags.push({bay:i,x0:xs[i-1],x1:xs[i],d1:Math.hypot(b.base.x-a.base.x,b.base.z-a.base.z),d2:Math.hypot(f.base.x-e.base.x,f.base.z-e.base.z)}); else diags.push({bay:i,d1:d1,d2:d2}); }
  m.diags=diags;
  const sqDiff=diags.length?Math.max(...diags.map(dg=>Math.abs(dg.d1-dg.d2)))*1000:0;
  add('square','Dasar & rangka','Kesikuan tiap bay (uji dua diagonal)', diags.length>0&&sqDiff<=1&&transoms.length>0,
    diags.length?diags.map(dg=>'bay '+dg.bay+': '+fmt(dg.d1,3)+' / '+fmt(dg.d2,3)+' m').join(' · ')+(transoms.length?'':' · transom belum terpasang'):'belum ada rangka',
    'kedua diagonal sama panjang → siku 90°','Prinsip geometri; OSHA 1926.452(b)(5)');
  const sleeves=(E.sleeve||[]).map(o=>{ const p=new THREE.Vector3(); o.getWorldPosition(p); return p; });
  const maxTop=columns.length?Math.max(...columns.map(c=>c.top)):0;
  const liftIdx=(y)=>levels.filter(l=>l.y<y).length;
  const jointOf=(c)=>{ const s=sleeves.find(p=>Math.abs(p.x-c.x)<0.05&&Math.abs(p.z-c.z)<0.05); return s?s.y:null; };
  const extended=columns.length===NODES.length&&columns.every(c=>c.top>=maxTop-0.01)&&columns.every(c=>c.n<2||jointOf(c)!==null);
  let stag=extended&&sleeves.length>0;
  if(stag) columns.forEach(c=>columns.forEach(o=>{ if(o===c) return; const adj=(Math.abs(o.z-c.z)<0.05&&Math.abs(Math.abs(o.x-c.x)-BAY)<0.05)||(Math.abs(o.x-c.x)<0.05&&Math.abs(o.z-c.z)>0.05); const jc=jointOf(c), jo=jointOf(o); if(adj&&jc!==null&&jo!==null&&liftIdx(jc)===liftIdx(jo)) stag=false; }));
  add('joints','Dasar & rangka','Sambungan standard selang-seling', stag,
    !columns.length?'belum ada standard':(!extended?'standard belum diperpanjang (tinggi '+fmt(Math.min(...columns.map(c=>c.top)),2)+'–'+fmt(maxTop,2)+' m)':sleeves.length+' sleeve · '+(stag?'tidak ada sambungan bertetangga pada lift yang sama':'ada sambungan bertetangga pada lift yang sama')),
    'sambungan standard bertetangga tidak pada lift yang sama','Praktik baik (verifikasi TG20:21)');

  /* ---- bracing & stabilitas ---- */
  const brs=tubes('brace');
  let faceOK=lifts.length>0, endOK=lifts.length>0; const faceTxt=[], endTxt=[], angles=[];
  /* bay akses: ada pintu pada lantai di dasar lift ini, di sisi dan bay yang sama (diukur dari posisi top bar pintu) */
  const gateTops=tubes('gate-top');
  const accessBay=(L,s,x0,x1)=>gateTops.some(g=>Math.abs((g.a.y+g.r-RAIL.top)-(L.y0+DECK_DY))<0.02&&Math.sign(g.a.z)===s&&Math.min(g.a.x,g.b.x)>=x0-0.01&&Math.max(g.a.x,g.b.x)<=x1+0.01);
  lifts.forEach((L,li)=>{
    const inLift=brs.filter(t=>t.a.y>=L.y0-0.05&&t.b.y<=L.y1+0.05);
    let fc=0, need=0, free=0; const freeSide={};
    [-1,1].forEach(s=>{ for(let i=1;i<xs.length;i++){
      const hit=inLift.find(t=>Math.abs(t.a.z-t.b.z)<0.01&&Math.sign(t.a.z)===s&&Math.min(t.a.x,t.b.x)<=xs[i-1]+0.05&&Math.max(t.a.x,t.b.x)>=xs[i]-0.05);
      if(hit) angles.push(Math.atan2(hit.b.y-hit.a.y,Math.hypot(hit.b.x-hit.a.x,hit.b.z-hit.a.z))*180/Math.PI);
      if(accessBay(L,s,xs[i-1],xs[i])){ free++; freeSide[s]=true; continue; }   // bay akses: dibiarkan bebas (bukaan diperiksa di butir akses)
      need++; if(hit) fc++; } });
    /* dua arah pada setiap sisi panjang; sisi yang memiliki bay akses cukup satu arah (sisi lain tetap dua arah) */
    const dirOK=[-1,1].every(s=>{ const d=new Set(inLift.filter(t=>Math.abs(t.a.z-t.b.z)<0.01&&Math.sign(t.a.z)===s).map(t=>Math.sign(t.b.x-t.a.x))); return d.size>=2||(freeSide[s]&&d.size>=1); });
    if(fc<need||!dirOK) faceOK=false;
    faceTxt.push('lift '+(li+1)+': '+fc+'/'+need+(free?' (+'+free+' bay akses dibiarkan bebas)':''));
    let ec=0;
    [-1,1].forEach(s=>{ const ends=inLift.filter(t=>Math.abs(t.a.x-t.b.x)<0.01&&Math.sign(t.a.x)===s&&Math.abs(t.a.x)>=BAY-0.01&&Math.abs(t.b.z-t.a.z)>0.5);
      const sl=new Set(ends.map(t=>Math.sign(t.b.z-t.a.z))); if(sl.size===2) ec++; });
    if(ec<2) endOK=false;
    endTxt.push('lift '+(li+1)+': '+ec+'/2 ujung');
  });
  m.braceAngles=angles;
  add('brace-face','Bracing & stabilitas','Bracing fasad setiap lift, kedua sisi', faceOK,
    lifts.length?faceTxt.join(' · ')+' bay-sisi':'belum ada lift','kriteria aplikasi*: setiap lift, kedua sisi panjang, setiap bay, dua arah (dipasang bertahap per lift); bay akses lantai di dasar lift dibiarkan bebas dan tetap dibracing di sisi seberang','OSHA 1926.452(b)(3): dua arah, dekat simpul · pola per lift: kriteria aplikasi');
  const aMin=angles.length?Math.min(...angles):0, aMax=angles.length?Math.max(...angles):0;
  add('brace-angle','Bracing & stabilitas','Sudut bracing fasad', angles.length>0&&aMin>=40&&aMax<=50,
    angles.length?fmt(aMin,1)+'°–'+fmt(aMax,1)+'°':'belum ada bracing','45° ± 5°','OSHA 1926 Subpart L App. A (pedoman)');
  add('brace-end','Bracing & stabilitas','Bracing silang (X) di kedua ujung', endOK,
    lifts.length?endTxt.join(' · '):'belum ada lift','X melintang di kedua ujung; model: setiap lift (OSHA: minimal setiap runner keempat)','OSHA 1926.452(b)(2)');
  /* lebar dasar: kaki standard + kaki outrigger yang BENAR-BENAR tersambung (pipa outrigger berujung di base plate itu dan
     dijepit klem yang juga menjepit standard). Base plate tanpa outrigger yang tersambung tidak dihitung. */
  const stdT=tubes('standard'), outs=tubes('outrigger'), outFeet=[]; let outLoose=0;
  outs.forEach(o=>{
    const plate=plates.find(b=>{ if(b.max.y>0.1) return false; const c=new THREE.Vector3(); b.getCenter(c); return Math.hypot(c.x-o.a.x,c.z-o.a.z)<=0.10; });
    const head=cplPos.some(p=>grips(p,o)&&stdT.some(s=>grips(p,s)));
    if(plate&&head){ const c=new THREE.Vector3(); plate.getCenter(c); outFeet.push(c); } else outLoose++;
  });
  const feet=columns.map(c=>c.base).concat(outFeet);
  const H=Math.max(maxTop,...tubes('puncheon').map(t=>t.b.y),0);
  let stab=null;
  if(feet.length&&H>0){ const fx=feet.map(p=>p.x), fz=feet.map(p=>p.z); const x0=Math.min(...fx),x1=Math.max(...fx),z0=Math.min(...fz),z1=Math.max(...fz); const Bm=Math.max(0.01,Math.min(x1-x0,z1-z0)); stab={H:H,B:Bm,ratio:H/Bm,x0:x0,x1:x1,z0:z0,z1:z1,outriggers:outFeet.length,loose:outLoose}; }
  m.stab=stab;
  add('stab','Bracing & stabilitas','Rasio tinggi : lebar dasar', !!stab&&columns.length>0&&stab.ratio<=4,
    stab&&columns.length?fmt(stab.H,2)+' m : '+fmt(stab.B,2)+' m = '+fmt(stab.ratio,2)+' : 1'+(outFeet.length?' (dengan '+outFeet.length+' outrigger tersambung)':'')+(outLoose?' · '+outLoose+' outrigger tidak tersambung, tidak dihitung':''):'belum ada standard',
    '≤ 4 : 1 (lebar dasar termasuk outrigger yang tersambung ke standard)','OSHA 1926.451(c)(1)');

  /* ---- lantai kerja ---- */
  const boards=boxes('board'), clips=boxes('boardclip');
  const bearers=tubes('transom').concat(tubes('putlog'));
  const deckMap=new Map(); boards.forEach(b=>{ const k=Math.round(b.max.y*100); (deckMap.get(k)||deckMap.set(k,[]).get(k)).push(b); });
  const decks=[...deckMap.values()].map(bs=>({top:Math.max(...bs.map(b=>b.max.y)),boards:bs.sort((a,b)=>a.min.z-b.min.z)})).sort((a,b)=>a.top-b.top);
  decks.forEach((dk,i)=>{ dk.name=(i===decks.length-1&&decks.length>1)?'lantai atas':(dk.top<3?'lantai lift-1':'lantai atas'); });
  m.decks=decks;
  let fullOK=decks.length>0, spanOK=decks.length>0, endBoardOK=decks.length>0; const fullTxt=[]; let maxSpan=0, ovMin=9, ovMax=0, allClip=true;
  decks.forEach(dk=>{
    let gap=0; for(let i=1;i<dk.boards.length;i++) gap=Math.max(gap,dk.boards[i].min.z-dk.boards[i-1].max.z);
    const eg=Math.max(dk.boards[0].min.z-(-LZ+R), (LZ-R)-dk.boards[dk.boards.length-1].max.z);
    const xmin=Math.min(...dk.boards.map(b=>b.min.x)), xmax=Math.max(...dk.boards.map(b=>b.max.x));
    const lenOK=xmin<=-BAY+R+0.06&&xmax>=BAY-R-0.06;
    dk.gap=gap; dk.edgeGap=eg;
    if(!(gap<=0.025&&eg<=0.025&&lenOK)) fullOK=false;
    fullTxt.push(dk.name+': celah '+fmt(gap*1000,0)+' mm, ke tiang '+fmt(eg*1000,0)+' mm');
    dk.boards.forEach(b=>{
      const zc=(b.min.z+b.max.z)/2, t=b.max.y-b.min.y;
      const sp=bearers.filter(s=>Math.abs((s.a.y+s.r)-b.min.y)<0.006&&Math.min(s.a.z,s.b.z)<=b.min.z+0.01&&Math.max(s.a.z,s.b.z)>=b.max.z-0.01&&s.a.x>=b.min.x-0.001&&s.a.x<=b.max.x+0.001).sort((p,q)=>p.a.x-q.a.x);
      const sx=sp.map(s=>s.a.x);
      if(sx.length<2){ spanOK=false; endBoardOK=false; return; }
      for(let i=1;i<sx.length;i++) maxSpan=Math.max(maxSpan,sx[i]-sx[i-1]);
      /* ujung papan diukur dari sumbu tumpuan (o) dan dari MUKA pipa tumpuan (f = o − jari-jari pipa) */
      const o1=sx[0]-b.min.x, o2=b.max.x-sx[sx.length-1], f1=o1-sp[0].r, f2=o2-sp[sp.length-1].r;
      ovMin=Math.min(ovMin,f1,f2); ovMax=Math.max(ovMax,o1,o2);
      const clipAt=(x)=>clips.some(c=>c.min.z<=zc&&c.max.z>=zc&&Math.abs((c.min.x+c.max.x)/2-x)<=0.2&&c.min.y>=b.max.y-0.005&&c.min.y<=b.max.y+0.01);
      if(!(clipAt(b.min.x)&&clipAt(b.max.x))) allClip=false;
      if(f1<0.05||f2<0.05||o1>4*t+0.0005||o2>4*t+0.0005) endBoardOK=false;
    });
  });
  if(maxSpan>1.2) spanOK=false;
  if(!allClip) endBoardOK=false;
  m.deckSpan=maxSpan; m.overhang=[ovMin,ovMax];
  add('deck-full','Lantai kerja','Lantai penuh dan rapat', fullOK, decks.length?fullTxt.join(' · '):'belum ada lantai kerja','celah antar-papan & ke tiang ≤ 25 mm (1 in)','OSHA 1926.451(b)(1) · PER.01/MEN/1980 Pasal 13(1)');
  add('deck-span','Lantai kerja','Bentang papan 38 mm', spanOK, decks.length?'maks. '+fmt(maxSpan,2)+' m':'belum ada lantai kerja','≤ 1,2 m antartumpuan','BS 2482:2009 · OSHA App. A');
  add('deck-end','Lantai kerja','Ujung papan di atas tumpuan', endBoardOK, decks.length?'min. '+fmt(ovMin*1000,0)+' mm dari muka tumpuan · maks. '+fmt(ovMax*1000,0)+' mm dari sumbu tumpuan'+(allClip?', dikunci klem papan':', belum dikunci'):'belum ada lantai kerja','≥ 50 mm dari muka tumpuan; ≤ 4 × tebal (152 mm); papan diikat','NASC TG12 · NASC SG25:20 butir 4.1 · OSHA 1926.451(b)(4)');

  /* ---- pelindung tepi (setiap lantai) ---- */
  const tops=tubes('rail-top').concat(tubes('gate-top')), mids=tubes('rail-mid').concat(tubes('gate-mid'));
  const toes=boxes('toeboard').concat(boxes('gate-kick'));
  const sides=[{n:'depan',ax:'x',c:-LZ,lo:-BAY,hi:BAY},{n:'belakang',ax:'x',c:LZ,lo:-BAY,hi:BAY},{n:'kiri',ax:'z',c:-BAY,lo:-LZ,hi:LZ},{n:'kanan',ax:'z',c:BAY,lo:-LZ,hi:LZ}];
  /* sisi sebuah pipa/kotak: dalam 0,12 m dari garis standard (rail di muka dalam standard: 48 mm; daun pintu: 93 mm) */
  const onSide=(t,sd)=>sd.ax==='x' ? (Math.abs(t.a.z-sd.c)<0.12&&Math.abs(t.b.z-sd.c)<0.12&&Math.abs(t.b.x-t.a.x)>0.2) : (Math.abs(t.a.x-sd.c)<0.12&&Math.abs(t.b.x-sd.c)<0.12&&Math.abs(t.b.z-t.a.z)>0.2);
  const tIv=(t,sd)=>sd.ax==='x'?[Math.min(t.a.x,t.b.x),Math.max(t.a.x,t.b.x)]:[Math.min(t.a.z,t.b.z),Math.max(t.a.z,t.b.z)];
  const boxSide=(b,sd)=>{ if(sd.ax==='x'){ const zc=(b.min.z+b.max.z)/2; return (b.max.x-b.min.x)>0.2&&Math.abs(zc-sd.c)<0.12; } const xc=(b.min.x+b.max.x)/2; return (b.max.z-b.min.z)>0.2&&Math.abs(xc-sd.c)<0.12; };
  const outw=(sd,v)=>sd.c>0?v:-v;                          // koordinat ke arah luar sisi
  let topOK=decks.length>0, gapOK=decks.length>0, toeOK=decks.length>0, perimOK=decks.length>0, toeGapOK=decks.length>0;
  const topTxt=[], gapTxt=[], toeTxt=[], perimTxt=[]; let maxToeGap=0;
  decks.forEach(dk=>{
    const T=dk.top, inBand=(t)=>Math.abs(t.a.y-t.b.y)<0.01&&t.a.y>T&&t.a.y<T+1.3;
    const dT=tops.filter(inBand), dM=mids.filter(inBand), dToe=toes.filter(b=>Math.abs(b.min.y-T)<0.01);
    let full=0, dkTop=Infinity, dkTopMax=0, dkGap=0, dkToe=Infinity; const gapBy={x:0,z:0};
    sides.forEach(sd=>{
      const st=dT.filter(t=>onSide(t,sd)), sm=dM.filter(t=>onSide(t,sd)), so=dToe.filter(b=>boxSide(b,sd));
      const cov=(list,isBox)=>covers(list.map(x=>isBox?(sd.ax==='x'?[x.min.x,x.max.x]:[x.min.z,x.max.z]):tIv(x,sd)),sd.lo+0.06,sd.hi-0.06,0.05);
      if(st.length&&sm.length&&so.length&&cov(st,false)&&cov(sm,false)&&cov(so,true)) full++;
      st.forEach(t=>{ const h=t.a.y+t.r-T; dkTop=Math.min(dkTop,h); dkTopMax=Math.max(dkTopMax,h); });
      const toeTop=so.length?Math.min(...so.map(b=>b.max.y)):T;
      if(so.length) dkToe=Math.min(dkToe,toeTop-T); else dkToe=Math.min(dkToe,0);
      let sg=9;
      if(st.length){ const topUnder=Math.min(...st.map(t=>t.a.y-t.r));
        sg=sm.length?Math.max(Math.min(...sm.map(t=>t.a.y-t.r))-toeTop, topUnder-Math.max(...sm.map(t=>t.a.y+t.r))):topUnder-toeTop;
        /* EN 12811-1 5.5.6: jarak horizontal muka luar toe board → muka dalam rail & komponen tengah (diukur dari posisi nyata) */
        if(so.length){ const toeOut=Math.min(...so.map(b=>sd.ax==='x'?outw(sd,sd.c>0?b.max.z:b.min.z):outw(sd,sd.c>0?b.max.x:b.min.x)));
          st.concat(sm).forEach(t=>{ const inner=outw(sd,sd.ax==='x'?t.a.z:t.a.x)-t.r; maxToeGap=Math.max(maxToeGap,Math.max(0,inner-toeOut)); }); }
      }
      dkGap=Math.max(dkGap,sg); gapBy[sd.ax]=Math.max(gapBy[sd.ax],sg);
    });
    if(!isFinite(dkTop)) dkTop=0;
    dk.topRail=dkTop; dk.topRailMax=dkTopMax; dk.gapMax=dkGap; dk.gapLong=gapBy.x; dk.gapEnd=gapBy.z; dk.toe=dkToe; dk.sidesOK=full;
    if(!(dkTop>=1.0-0.0005&&dkTopMax<=1.143)) topOK=false;
    if(!(dkGap<=0.47)) gapOK=false;
    if(!(dkToe>=0.15-0.0005)) toeOK=false;
    if(full<4) perimOK=false;
    topTxt.push(dk.name+': '+(dkTop?fmt(dkTop,3)+(dkTopMax-dkTop>0.001?'–'+fmt(dkTopMax,3):'')+' m':'belum ada'));
    gapTxt.push(dk.name+': '+(dkGap<9?fmt(gapBy.x,3)+' m sisi panjang, '+fmt(gapBy.z,3)+' m sisi ujung':'tanpa rail'));
    toeTxt.push(dk.name+': '+fmt(Math.max(0,dkToe)*1000,0)+' mm');
    perimTxt.push(dk.name+': '+full+'/4 sisi');
  });
  if(maxToeGap>0.08) toeGapOK=false;
  m.toeGap=maxToeGap;
  const noDeck='belum ada lantai kerja';
  add('rail-top','Pelindung tepi','Tinggi top rail di atas lantai', topOK, decks.length?topTxt.join(' · ')+' (sisi ujung +75 mm: rail bersilang di sudut)':noDeck,'≥ 950 mm (Permenaker) · ≥ 1,0 m (EN 12811-1) · 0,97–1,14 m (OSHA)','Permenaker 9/2016 Pasal 24a · EN 12811-1 5.5.2 · OSHA 1926.451(g)(4)(ii)');
  add('rail-gap','Pelindung tepi','Celah vertikal pelindung tepi', gapOK, decks.length?'celah terbesar — '+gapTxt.join(' · '):noDeck,'≤ 470 mm','Permenaker 9/2016 Pasal 24c · EN 12811-1 5.5.3 · WAHR 2005 Sch. 2');
  add('toe','Pelindung tepi','Tinggi toe board', toeOK, decks.length?toeTxt.join(' · '):noDeck,'≥ 150 mm','EN 12811-1 5.5.4 · Permenaker 9/2016 Pasal 24d · OSHA 1926.451(h)(4)(ii)');
  add('perimeter','Pelindung tepi','Pelindung tepi menerus di semua sisi', perimOK, decks.length?perimTxt.join(' · ')+((E.gate||[]).length?' (daun pintu yang tertutup dihitung)':''):noDeck,'top rail, mid rail, toe board di keempat sisi','OSHA 1926.451(g)(4)(i) · EN 12811-1 5.5.1 · PER.01/MEN/1980 Pasal 13(2)');
  add('toe-gap','Pelindung tepi','Jarak toe board ke pagar', toeGapOK&&decks.length>0, decks.length?'maks. '+fmt(maxToeGap*1000,0)+' mm':noDeck,'≤ 80 mm (muka luar toe board → muka dalam rail)','EN 12811-1 butir 5.5.6');

  /* ---- akses & status: setiap pintu dan setiap tangga DIUKUR dari geometri ---- */
  const roleName={'rail-top':'top rail','rail-mid':'mid rail',ledger:'ledger',transom:'transom',putlog:'putlog',standard:'standard',puncheon:'puncheon'};
  /* pintu: menutup celah dan menumpang pada rail tetap di kedua sisi, seluruh daun di sisi dalam rail (tidak dapat membuka
     ke luar), top bar & papan kaki diukur; "menutup sendiri" diperiksa dari jenis komponen (engsel pegas) */
  const railTops=tubes('rail-top'), gateGroups=(E.gate||[]).map(o=>({o:o,b:boxOf(o)})), gatesM=[];
  decks.forEach(dk=>{ const T=dk.top, band=(t)=>Math.abs(t.a.y-t.b.y)<0.01&&t.a.y>T&&t.a.y<T+1.3;
    tubes('gate-top').filter(band).forEach(gt=>{
      const sd=sides.find(s=>onSide(gt,s)); if(!sd) return;
      const iv=tIv(gt,sd), g0=iv[0], g1=iv[1];
      const rs=railTops.filter(t=>band(t)&&onSide(t,sd)).map(t=>({t:t,iv:tIv(t,sd)}));
      const left=rs.filter(q=>q.iv[0]<g0&&q.iv[1]>g0), right=rs.filter(q=>q.iv[0]<g1&&q.iv[1]>g1);
      const ovL=left.length?Math.max(...left.map(q=>q.iv[1]-g0)):0, ovR=right.length?Math.max(...right.map(q=>g1-q.iv[0])):0;
      const axis=(t)=>sd.ax==='x'?t.a.z:t.a.x, gOut=outw(sd,axis(gt))+gt.r, adj=left.concat(right);
      const inward=adj.length>0&&adj.every(q=>gOut<=outw(sd,axis(q.t))-q.t.r+0.001);
      const kk=boxes('gate-kick').filter(b=>Math.abs(b.min.y-T)<0.01&&boxSide(b,sd)&&(sd.ax==='x'?(b.min.x<g1&&b.max.x>g0):(b.min.z<g1&&b.max.z>g0)));
      const hKick=kk.length?Math.min(...kk.map(b=>b.max.y))-T:0, hTop=gt.a.y+gt.r-T;
      const mid=gt.a.clone().lerp(gt.b,0.5), grp=gateGroups.find(q=>q.b.containsPoint(mid)), selfC=!!(grp&&grp.o.userData.selfClosing);
      const closed=ovL>=0.02&&ovR>=0.02;
      gatesM.push({deck:dk, sd:sd, z:axis(gt), x0:g0, x1:g1, ovL:ovL, ovR:ovR, inward:inward, closed:closed, hTop:hTop, hKick:hKick, selfClosing:selfC,
        ok:closed&&inward&&selfC&&hTop>=1.0-0.0005&&hKick>=0.15-0.0005});
    });
  });
  /* tangga: dua kaki tangga sejajar; tumpuan atas = kontak tertinggi kaki tangga dengan batang struktural yang terpasang;
     ikatan = klem yang menjepit kaki tangga DAN batang tumpuan itu; kemiringan dihitung dari tumpuan atas; langkah ke lantai
     dari sumbu anak tangga setinggi lantai ke tepi lantai di celah pintu */
  const structural=[]; Object.keys(roleName).forEach(k=>tubes(k).forEach(t=>{ t.role=k; structural.push(t); }));
  const ladders=[];
  tubes('ladder-rail').forEach(t=>{ const L=ladders.find(l=>l.s.length<2&&Math.abs(l.s[0].a.y-t.a.y)<0.01&&Math.abs(l.s[0].a.z-t.a.z)<0.02&&Math.abs(l.s[0].a.x-t.a.x)<0.8); if(L) L.s.push(t); else ladders.push({s:[t]}); });
  ladders.forEach(L=>{
    L.s.sort((p,q)=>p.a.x-q.a.x);
    L.xc=L.s.reduce((a,t)=>a+t.a.x,0)/L.s.length;
    L.sup=L.s.map(st=>{ let best=null; structural.forEach(mb=>{ const q=segSeg(st.a,st.b,mb.a,mb.b); if(q.d<=st.r+mb.r+0.006&&q.sb>=0.02&&q.sb<=mb.len-0.02&&q.sa>0.5&&(!best||q.pa.y>best.p.y)) best={p:q.pa,m:mb}; }); return best; });
    L.S=null; L.sup.forEach(q=>{ if(q&&(!L.S||q.p.y>L.S.y)) L.S=q.p; });
    L.deck=L.S?(decks.filter(d=>d.top<L.S.y&&L.S.y-d.top<=1.3).sort((a,b)=>b.top-a.top)[0]||null):null;
    L.ties=L.s.map((st,i)=>{ const q=L.sup[i]; return q?cplPos.filter(p=>grips(p,st)&&grips(p,q.m)).length:0; });
    const st=L.s[0];
    if(L.S&&L.deck){
      const T=L.deck.top, k=(L.S.y-st.a.y)/(st.b.y-st.a.y), S=st.a.clone().lerp(st.b,k);
      L.run=Math.hypot(S.x-st.a.x,S.z-st.a.z); L.wl=S.distanceTo(st.a); L.ratio=L.run/L.wl; L.angle=Math.atan2(S.y-st.a.y,L.run)*180/Math.PI;
      L.ext=Math.min(...L.s.map(t=>t.b.y))-T;
      const kT=(T-st.a.y)/(st.b.y-st.a.y), zT=st.a.z+(st.b.z-st.a.z)*kT;
      const sd=sides.find(s=>s.ax==='x'&&Math.sign(s.c)===Math.sign(st.a.z));
      const edge=sd.c>0?Math.max(...L.deck.boards.map(b=>b.max.z)):Math.min(...L.deck.boards.map(b=>b.min.z));
      L.gate=gatesM.filter(g=>g.deck===L.deck&&g.sd===sd&&Math.min(Math.abs(g.x0-L.xc),Math.abs(g.x1-L.xc))<0.8).sort((a,b)=>Math.abs((a.x0+a.x1)/2-L.xc)-Math.abs((b.x0+b.x1)/2-L.xc))[0]||null;
      if(L.gate){ const dx=Math.max(0,L.gate.x0-L.xc,L.xc-L.gate.x1); L.step=Math.hypot(dx,Math.abs(zT-edge)); L.side=dx>0; }
    }
  });
  m.ladders=ladders;
  const topL=ladders.filter(l=>l.deck&&l.ratio!==undefined).sort((a,b)=>b.deck.top-a.deck.top)[0];
  if(topL) m.ladder={ratio:topL.ratio, ext:topL.ext, step:topL.step};
  const lname=(L)=>L.deck?L.deck.name:'tangga';
  const stepOK=(L)=>L.step!==undefined&&(L.side?(L.step>=0.38&&L.step<=0.51):(L.step>=0.18&&L.step<=0.30));
  const ladOK=ladders.length>0&&ladders.every(L=>L.s.length===2&&L.ratio!==undefined&&L.ratio>=0.22&&L.ratio<=0.28&&L.ext>=0.914&&stepOK(L));
  const ladTxt=ladders.length?ladders.map(L=>L.ratio!==undefined?lname(L)+': kaki '+fmt(L.ratio*100,1)+'% panjang kerja (±'+fmt(L.angle,0)+'°) · menonjol '+fmt(L.ext,2)+' m'+(L.step!==undefined?' · langkah '+(L.side?'ke samping ':'')+fmt(L.step,2)+' m':' · tanpa pintu di dekatnya'):'tangga tanpa tumpuan atas di lantai kerja').join(' · '):'belum ada tangga';
  add('ladder','Akses & status','Tangga akses', ladOK, ladTxt,'kaki ±¼ panjang kerja (4 : 1)*; menonjol ≥ 0,9 m di atas lantai (anjuran NASC ≥ 1,0 m); langkah ke lantai 0,38–0,51 m bila ke samping, 0,18–0,30 m bila lurus*','OSHA 1926.1053(b)(1), (b)(5)(i) · NASC SG25:20 butir 6.4 · OSHA 1910.23(d)(12) (analogi)');
  const tieOK=ladders.length>0&&ladders.every(L=>L.s.length===2&&L.sup.every(Boolean)&&L.ties.every(n=>n>=1));
  const tieTxt=ladders.length?ladders.map(L=>{ const q=L.sup.find(Boolean);
    return lname(L)+': '+(q?'bertumpu pada '+roleName[q.m.role]+' +'+fmt(L.S.y,2)+' m':'tanpa tumpuan atas')+' · '+L.ties.filter(n=>n>=1).length+'/'+L.s.length+' kaki diikat'; }).join(' · '):'belum ada tangga';
  add('ladder-tie','Akses & status','Tangga bertumpu dan diikat di atas', tieOK, tieTxt,'bertumpu pada batang yang tetap terpasang; kedua kaki tangga diikat klem pada batang itu','OSHA 1926.1053(b)(6) · NASC SG25:20 butir 6.6');
  /* bukaan pintu harus bebas dari bracing/batang lain dari 0,10 m sampai 1,75 m di atas lantai (ruang bebas minimum ke transom kelas H1,
     EN 12811-1 butir 5.3), di depan daun pintu sampai 0,30 m di luar garis standard */
  const obstrT=['brace','ledger','transom','putlog','standard','outrigger','outrigger-tie'].reduce((a,k)=>a.concat(tubes(k)),[]);
  const blocked=(g)=>{ const T=g.deck.top, x0=g.x0+0.04, x1=g.x1-0.04, o=(v)=>outw(g.sd,v), zIn=o(g.z)-0.03, zOut=LZ+0.30;
    return obstrT.some(t=>{ for(let k=0;k<=80;k++){ const p=t.a.clone().lerp(t.b,k/80), u=o(g.sd.ax==='x'?p.z:p.x), w=g.sd.ax==='x'?p.x:p.z;
      if(w>=x0-t.r&&w<=x1+t.r&&p.y>=T+0.10-t.r&&p.y<=T+1.75+t.r&&u>=zIn-t.r&&u<=zOut+t.r) return true; } return false; }); };
  let accOK=decks.length>0; const accTxt=[];
  decks.forEach(dk=>{ const L=ladders.find(l=>l.deck===dk); const g=L&&L.gate, bl=!!(g&&blocked(g));
    if(!(L&&g&&g.ok&&!bl)) accOK=false;
    accTxt.push(dk.name+': '+(L?'tangga':'belum ada tangga')+(g?(g.ok?' + pintu':' + pintu belum memenuhi')+(bl?', bukaan terhalang':', bukaan bebas'):(L?', tanpa pintu':''))); });
  add('access','Akses & status','Akses aman ke setiap lantai kerja', accOK, decks.length?accTxt.join(' · '):noDeck,'setiap lantai kerja: tangga + pintu yang menutup sendiri; bukaan bebas setinggi ≥ 1,75 m','OSHA 1926.451(e)(1), (e)(9) · NASC SG25:20 butir 5, 6.4 · EN 12811-1 butir 5.3, 5.8');
  const noGate=ladders.filter(L=>L.deck&&!L.gate);
  const gateOK=gatesM.length>0&&gatesM.every(g=>g.ok)&&!noGate.length;
  const gateTxt=(gatesM.length?gatesM.map(g=>g.deck.name+': '+(g.closed?'tertutup, menumpang '+fmt(Math.min(g.ovL,g.ovR)*1000,0)+' mm pada rail tetap':'celah tidak tertutup')+(g.inward?', membuka ke dalam':', dapat membuka ke luar')+' · top bar '+fmt(g.hTop,2)+' m · papan kaki '+fmt(g.hKick*1000,0)+' mm'+(g.selfClosing?' · engsel pegas':' · bukan pintu menutup sendiri')).join(' · '):'belum ada pintu akses')+noGate.map(L=>' · '+lname(L)+': tidak ada pintu di titik akses').join('');
  add('gate','Akses & status','Pintu akses menutup sendiri', gateOK, gateTxt,'menutup celah dan menumpang pada rail tetap (tidak dapat membuka ke luar); top bar ≥ 1,0 m; papan kaki ≥ 150 mm; engsel pegas','NASC SG25:20 butir 6.4 · Permenaker 9/2016 Pasal 24 · EN 12811-1 butir 5.5 · PER.01/MEN/1980 Pasal 8','ukur+cek');
  /* kesesuaian dengan rencana pemasangan: inspeksi serah terima memeriksa perancah yang dirancang (2 lantai kerja, 3 level ledger) */
  const planDecks=PLAN.decks.filter(T=>decks.some(d=>Math.abs(d.top-T)<0.01)).length, planLv=PLAN.levels.filter(y=>levels.some(l=>Math.abs(l.y-y)<0.01)).length;
  items.unshift({id:'plan', grp:'Dasar & rangka', label:'Perancah sesuai rencana pemasangan', ok:planDecks===PLAN.decks.length&&planLv===PLAN.levels.length,
    value:'lantai kerja '+planDecks+'/'+PLAN.decks.length+' · level ledger '+planLv+'/'+PLAN.levels.length, limit:'jumlah lantai kerja dan level ledger sama dengan rencana (lantai +2,06 m dan +4,01 m; ledger +0,15 / +1,95 / +3,90 m)',
    ref:'OSHA 1926.451(a)(6) · rencana pemasangan (tahap 1)', how:'ukur'});
  const readyCore=items.every(i=>i.ok);
  const tagCols=(E.tag||[]).map(o=>o.userData.color), red=tagCols.indexOf('red')>=0, green=tagCols.indexOf('green')>=0;
  const inspected=state.current>INSP_IDX;
  add('tag','Akses & status','Tag status di akses', green?(inspected&&readyCore&&!red):red,
    green?(red?'tag hijau dan tag merah terpasang bersamaan':'tag hijau "boleh digunakan"'):(red?'tag merah "jangan digunakan"':'belum ada tag status'),
    'merah selama perakitan; hijau hanya setelah inspeksi serah terima','OSHA 1926.451(f)(3) · WAHR 2005 reg. 12','cek');
  const fails=items.filter(i=>!i.ok&&i.id!=='tag');
  return {items:items, m:m, ready:readyCore, inspected:inspected, handedOver:green&&inspected&&readyCore&&!red, red:red, green:green,
    pass:items.filter(i=>i.ok).length, total:items.length, fails:fails};
}

/* ---------- overlay inspeksi: garis & label dari hasil ukur ---------- */
const inspGroups={vert:null,horz:null,dist:null,square:null,edge:null,stab:null};
const inspState={vert:false,horz:false,dist:false,square:false,edge:false,stab:false};
function lineMat(hex,dashed){
  return dashed? new THREE.LineDashedMaterial({color:hex,dashSize:0.08,gapSize:0.06})
               : new THREE.LineBasicMaterial({color:hex});
}
function makeLine(a,b,hex,dashed){
  const geo=new THREE.BufferGeometry().setFromPoints([a,b]);
  const ln=new THREE.Line(geo,lineMat(hex,dashed));
  if(dashed)ln.computeLineDistances();
  return ln;
}
function arrow(at,dir,hex){
  const c=new THREE.Mesh(new THREE.ConeGeometry(0.03,0.1,14),new THREE.MeshBasicMaterial({color:hex}));
  c.position.copy(at);c.quaternion.setFromUnitVectors(V(0,1,0),dir.clone().normalize());return c;
}
function dimension(a,b,hex,labelText,cls){
  const g=new THREE.Group();
  g.add(makeLine(a,b,hex));
  const dir=new THREE.Vector3().subVectors(b,a).normalize();
  g.add(arrow(a,dir,hex)); g.add(arrow(b,dir.clone().negate(),hex));
  addLabel(labelText,a.clone().add(b).multiplyScalar(0.5),cls||'dim');
  return g;
}
const OKC=0x2ECC71, BADC=0xd0463a;
const itemOf=(ev,id)=>ev.items.find(i=>i.id===id)||{ok:false};
const mark=(ok)=>ok?' ✓':' ✗';
function buildVert(ev){
  const g=new THREE.Group();
  ev.m.columns.forEach(c=>{
    const ok=c.dev<=20&&c.abs<=50, hex=ok?OKC:BADC, ox=c.x+0.12, oz=c.z+0.16*Math.sign(c.z||1);
    g.add(makeLine(V(ox,0,oz),V(ox,c.top,oz),hex,true));
    const bob=new THREE.Mesh(new THREE.ConeGeometry(0.035,0.1,12),new THREE.MeshBasicMaterial({color:hex}));
    bob.position.set(ox,0.06,oz); bob.rotation.x=Math.PI; g.add(bob);
    addLabel('Tegak '+fmt(c.dev,0)+' mm/2 m'+mark(ok),V(c.x,c.top+0.18,c.z),ok?'ok':'bad');
  });
  if(!ev.m.columns.length) addLabel('Belum ada standard'+mark(false),V(0,0.6,0),'bad');
  return g;
}
function buildHorz(ev){
  const g=new THREE.Group();
  ev.m.levels.forEach(l=>{ const ok=l.dev<=20, hex=ok?0x3FA7E0:BADC;
    ROWS.forEach(z=>g.add(makeLine(V(-BAY,l.y+0.03,z),V(BAY,l.y+0.03,z),hex)));
    addLabel('Datar +'+fmt(l.y,2)+' m · '+fmt(l.dev,0)+' mm/2 m'+mark(ok),V(-BAY*0.5,l.y+0.12,-LZ),ok?'ok':'bad'); });
  if(!ev.m.levels.length) addLabel('Belum ada ledger'+mark(false),V(0,0.4,-LZ),'bad');
  return g;
}
function buildDist(ev){
  const g=new THREE.Group(), c=0x7cc4ee, m=ev.m, zf=-LZ-0.6;
  const okD=itemOf(ev,'dims').ok, okL=itemOf(ev,'lift').ok;
  m.xs.forEach(x=>g.add(makeLine(V(x,0,-LZ),V(x,0,zf),c,true)));
  for(let i=1;i<m.xs.length;i++) g.add(dimension(V(m.xs[i-1],0.02,zf),V(m.xs[i],0.02,zf),c,'Bay '+fmt(m.xs[i]-m.xs[i-1],2)+' m (≤ 3,05)'+mark(m.xs[i]-m.xs[i-1]<=3.048),m.xs[i]-m.xs[i-1]<=3.048?'ok':'bad'));
  if(m.zs.length>1){ const xw=BAY+0.6; g.add(dimension(V(xw,0.02,m.zs[0]),V(xw,0.02,m.zs[m.zs.length-1]),c,'Lebar '+fmt(m.width,2)+' m (≤ 1,22)'+mark(m.width<=1.219),m.width<=1.219?'ok':'bad')); }
  const xb=-BAY-0.6;
  m.lifts.forEach(L=>{ g.add(makeLine(V(-BAY,L.y1,LZ),V(xb,L.y1,LZ),c,true)); g.add(dimension(V(xb,L.y0,LZ),V(xb,L.y1,LZ),c,'Lift '+fmt(L.h,2)+' m (≤ 1,98)'+mark(L.h<=1.981),L.h<=1.981?'ok':'bad')); });
  if(!m.xs.length) addLabel('Belum ada standard'+mark(false),V(0,0.4,zf),'bad');
  addLabel('Ilustratif · pedoman OSHA App. A light duty'+mark(okD&&okL),V(0,0.06,zf-0.5),'axis');
  return g;
}
function buildSquare(ev){
  const g=new THREE.Group(), c=0xF5A623, y=(ev.m.levels.length?ev.m.levels[0].y:0)+0.01;
  ev.m.diags.forEach((dg,i)=>{ if(dg.x0===undefined) return; const ok=Math.abs(dg.d1-dg.d2)<=0.001;
    g.add(makeLine(V(dg.x0,y,-LZ),V(dg.x1,y,LZ),ok?c:BADC)); g.add(makeLine(V(dg.x1,y,-LZ),V(dg.x0,y,LZ),ok?c:BADC));
    addLabel('Bay '+dg.bay+': '+fmt(dg.d1,3)+' = '+fmt(dg.d2,3)+' m'+mark(ok),V((dg.x0+dg.x1)/2,y+0.12+i*0.14,0),ok?'ok':'bad'); });
  if(!ev.m.diags.length) addLabel('Belum ada rangka'+mark(false),V(0,0.4,0),'bad');
  return g;
}
function buildEdge(ev){
  const g=new THREE.Group(), x=0.55, z=-LZ-0.09;
  ev.m.decks.forEach(dk=>{ const T=dk.top, okT=dk.topRail>=0.9995&&dk.topRail<=1.143, okG=dk.gapMax<=0.47, okE=dk.toe>=0.1495;
    const hex=okT&&okG&&okE?OKC:BADC;
    g.add(makeLine(V(x,T,z),V(x,T+Math.max(dk.topRail,0.05),z),hex));
    [0,Math.max(0,dk.toe),RAIL.mid,dk.topRail].forEach(h=>g.add(makeLine(V(x-0.08,T+h,z),V(x+0.08,T+h,z),hex)));
    addLabel(dk.name+' · top rail '+fmt(dk.topRail,3)+' m'+(dk.topRailMax-dk.topRail>0.001?' (ujung '+fmt(dk.topRailMax,3)+' m)':'')+mark(okT),V(x,T+dk.topRail+0.12,z),okT?'ok':'bad');
    addLabel(dk.gapMax<9?'Celah terbesar '+fmt(dk.gapLong,3)+' m sisi panjang · '+fmt(dk.gapEnd,3)+' m sisi ujung'+mark(okG):'Celah: rail belum lengkap'+mark(false),V(x+0.9,T+0.55,z),okG?'ok':'bad');
    addLabel('Toe board '+fmt(Math.max(0,dk.toe)*1000,0)+' mm'+mark(okE),V(x+0.9,T+0.1,z),okE?'ok':'bad'); });
  if(!ev.m.decks.length) addLabel('Belum ada lantai kerja'+mark(false),V(1.0,2.7,-LZ),'bad');
  return g;
}
function buildStab(ev){
  const g=new THREE.Group(), s=ev.m.stab;
  if(!s){ addLabel('Belum ada standard'+mark(false),V(0,0.6,0),'bad'); return g; }
  const ok=s.ratio<=4, hex=ok?OKC:BADC, y=0.03;
  [[s.x0,s.z0,s.x1,s.z0],[s.x1,s.z0,s.x1,s.z1],[s.x1,s.z1,s.x0,s.z1],[s.x0,s.z1,s.x0,s.z0]].forEach(q=>g.add(makeLine(V(q[0],y,q[1]),V(q[2],y,q[3]),hex,true)));
  g.add(makeLine(V(s.x1+0.3,0,s.z0),V(s.x1+0.3,s.H,s.z0),hex));
  addLabel('H/B = '+fmt(s.H,2)+' / '+fmt(s.B,2)+' = '+fmt(s.ratio,2)+' : 1'+mark(ok)+' (≤ 4 : 1)',V(s.x1+0.3,s.H*0.55,s.z0),ok?'ok':'bad');
  return g;
}
const inspBuilders={vert:buildVert,horz:buildHorz,dist:buildDist,square:buildSquare,edge:buildEdge,stab:buildStab};
function rebuildInspection(){
  Object.keys(inspGroups).forEach(k=>{ if(inspGroups[k]){scene.remove(inspGroups[k]);disposeTree(inspGroups[k]);inspGroups[k]=null;} });
  clearLabels();
  if(Object.keys(inspState).some(k=>inspState[k])){
    const ev=evaluate();
    Object.keys(inspState).forEach(k=>{ if(inspState[k]){ const grp=inspBuilders[k](ev); scene.add(grp); inspGroups[k]=grp; } });
  }
  markView();
}
function toggleInsp(k){
  inspState[k]=!inspState[k];
  rebuildInspection();
  renderInspPanel();
  if(inspState[k]) report({tool:k});
  const b=pBody.querySelector('[data-insp="'+k+'"]'); if(b) b.focus({preventScroll:true});
}

/* ============================================================
   UI RENDERING
   ============================================================ */
const pEyebrow=document.getElementById('pEyebrow'), pTitle=document.getElementById('pTitle'),
      pSub=document.getElementById('pSub'), pBody=document.getElementById('pBody');
let curLibType='fix';

/* legend */
const legendTypes=['fix','swivel','sleeve','jointpin','putlog','board','ladder'];
const legShort={fix:'Klem Mati',swivel:'Klem Putar',sleeve:'Sleeve',jointpin:'Joint Pin',putlog:'Putlog',board:'Klem Papan',ladder:'Klem Tangga'};
document.getElementById('legendItems').innerHTML=legendTypes.map(t=>
  `<div class="it"><span class="d" style="background:${COUPLER[t].color}"></span>${legShort[t]}</div>`).join('');

/* ---- coupler library panel ---- */
const libOrder=['tube','soleboard','baseplate','fix','swivel','sleeve','jointpin','putlog','board','plank','ladder','beamclamp','anchorclamp','ratchet','levelmeter','distancemeter','greentag','redtag'];
const libShort={tube:'Pipa',soleboard:'Sole Board',baseplate:'Base Plate',fix:'Klem Mati',swivel:'Klem Putar',sleeve:'Sleeve',jointpin:'Joint Pin',putlog:'Putlog',board:'Klem Papan',plank:'Plank',ladder:'Tangga',beamclamp:'Beam Clamp',anchorclamp:'Anchor Clamp',ratchet:'Kunci Ratchet',levelmeter:'Level Meter',distancemeter:'Distance Meter',greentag:'Tag Hijau',redtag:'Tag Merah'};
function renderLibPanel(){
  const c=COUPLER[curLibType];
  pBody.innerHTML=`
    <div class="lib-grid" role="group" aria-label="Pilih komponen">
      ${libOrder.map(t=>`<button type="button" class="${t===curLibType?'on':''}" data-lib="${t}" aria-pressed="${t===curLibType}">
        <span class="sw" style="background:${COUPLER[t].color}" aria-hidden="true"></span>${libShort[t]}</button>`).join('')}
    </div>
    <div class="spec">
      <h3>${c.name}</h3>
      <p class="ftn">${c.fungsi}</p>
      <div class="meta">
        <div class="r"><span class="k">Sudut</span><span class="v">${c.sudut}</span></div>
        <div class="r"><span class="k">Peran</span><span class="v">${c.beban}</span></div>
        <div class="r"><span class="k">Tipe</span><span class="v">${c.tebal}</span></div>
      </div>
    </div>`;
  pBody.querySelectorAll('[data-lib]').forEach(b=>b.onclick=()=>{
    curLibType=b.dataset.lib; showLibModel(curLibType); renderLibPanel(); report({lib:curLibType});
    const nb=pBody.querySelector('[data-lib="'+curLibType+'"]'); if(nb) nb.focus({preventScroll:true});
  });
}

/* ---- build panel ---- */
function tagLine(){
  if(state.current<=0) return '<p class="tagline"><span class="tdot" aria-hidden="true"></span>Belum ada perancah di lokasi</p>';
  if(state.current>=STEPS.length) return '<p class="tagline is-green"><span class="tdot" aria-hidden="true"></span>Tag hijau — boleh digunakan (inspeksi serah terima memenuhi)</p>';
  return '<p class="tagline is-red"><span class="tdot" aria-hidden="true"></span>Tag merah — dalam perakitan, jangan digunakan</p>';
}
function renderBuildPanel(){
  const total=STEPS.length, done=Math.min(state.current,total), pct=Math.round(done/total*100);
  const hadFocus=pBody.contains(document.activeElement);
  let html=`<div class="prog"><span class="cnt">${done}/${total}</span>
    <div class="bar" role="progressbar" aria-label="Kemajuan perakitan" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-valuetext="${done} dari ${total} tahap"><div class="fill" style="width:${pct}%"></div></div></div>${tagLine()}`;
  if(state.current<STEPS.length){
    const i=state.current, s=STEPS[i], c=COUPLER[s.coupler];
    const act=(s.action||'Pasang Komponen →').replace(/\s*→\s*$/,'');
    let insp='';
    if(s.id==='inspeksi'){
      const ev=evaluate();
      insp=`<div class="insp-mini ${ev.ready?'ok':'bad'}"><b>Hasil ukur model: ${ev.pass}/${ev.total} butir memenuhi</b>
        ${ev.ready?'<span>Siap dicatat. Tag hijau boleh dipasang setelah hasil ini dicatat.</span>':'<span>Belum memenuhi: '+ev.fails.map(f=>f.label).join('; ')+'.</span>'}</div>`;
    }
    html+=`<div class="stepcard">
      <div class="lead"><span class="stepno" aria-hidden="true">${i+1}</span><h3><span class="sr-only">Tahap ${i+1} dari ${total}: </span>${s.title}</h3></div>
      <p class="desc">${s.desc}</p>
      <span class="chip"><span class="dot" style="background:${c.color}" aria-hidden="true"></span>${c.name}</span>
      <ul class="checks" aria-label="Butir yang diperiksa pada tahap ini">${s.checks.map(ch=>`<li>${ch}</li>`).join('')}</ul>
      ${insp}
      <p class="ref"><span>Acuan</span>${s.ref}</p>
      <div class="row">
        <button type="button" class="btn ghosted" id="undoBtn" aria-label="Mundur satu tahap" title="Mundur satu tahap" ${i===0?'disabled':''}>↶</button>
        <button type="button" class="btn primary" id="placeBtn">${act} <span aria-hidden="true">→</span></button>
      </div>
      <p class="tip">Sorotan kuning menandai komponen berikutnya — klik komponen itu di adegan 3D atau tekan tombol di atas.</p>
    </div>`;
  } else {
    html+=`<div class="done-banner">
      <div class="ic" aria-hidden="true">✓</div>
      <div><h4>Perancah lengkap dan bertag hijau</h4>
      <p>Seluruh ${total} tahap selesai: pelindung tepi penuh, akses dengan pintu menutup sendiri, inspeksi serah terima memenuhi, lalu tag hijau dipasang. Buka <b>Inspeksi</b> untuk melihat hasil ukur setiap butir.</p></div>
    </div>
    <div class="row">
      <button type="button" class="btn" id="undoBtn" aria-label="Bongkar satu tahap">↶ Bongkar</button>
      <button type="button" class="btn primary" id="toInsp">Lihat Hasil Inspeksi <span aria-hidden="true">→</span></button>
    </div>`;
  }
  pBody.innerHTML=html;
  pBody.scrollTop=0;   /* baris progres tidak terpotong */
  const pb=document.getElementById('placeBtn'); if(pb)pb.onclick=confirmStep;
  const ub=document.getElementById('undoBtn'); if(ub)ub.onclick=undoStep;
  const ti=document.getElementById('toInsp'); if(ti)ti.onclick=()=>{ switchTab('insp'); const t=document.getElementById('tab-insp'); if(t) t.focus(); };
  if(hadFocus){ const f=pb||ti||ub; if(f&&!f.disabled) f.focus({preventScroll:true}); }
}

/* ---- inspection panel ---- */
const inspMeta=[
  {k:'vert', c:'var(--ok)', t:'Kelurusan Vertikal', s:'Unting-unting tiap standard.'},
  {k:'horz', c:'var(--info)', t:'Kedataran Ledger', s:'Waterpass tiap level ledger.'},
  {k:'dist', c:'#7cc4ee', t:'Dimensi', s:'Bay, lebar, dan tinggi lift.'},
  {k:'square', c:'var(--amber)', t:'Kesikuan 90°', s:'Dua diagonal tiap bay.'},
  {k:'edge', c:'#5b636c', t:'Pelindung Tepi', s:'Top rail, celah, toe board.'},
  {k:'stab', c:'#2b2b30', t:'Stabilitas', s:'Rasio tinggi : lebar dasar.'},
];
const HOW={ukur:'Diukur dari model', cek:'Diperiksa dari jenis/keberadaan komponen', 'ukur+cek':'Diukur dari model; sifat menutup sendiri diperiksa dari jenis komponen'};
const esc=(s)=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function renderInspPanel(){
  const ev=evaluate(), total=STEPS.length;
  const status=ev.handedOver?'Boleh digunakan':'Jangan digunakan';
  const sub=ev.handedOver?'Tag hijau terpasang setelah inspeksi serah terima.'
    :(state.current<total?`Perakitan ${state.current}/${total} tahap — tag merah.`:'Tag hijau tidak sah: ada butir yang tidak memenuhi.');
  const groups=[]; ev.items.forEach(it=>{ let g=groups.find(x=>x.n===it.grp); if(!g){ g={n:it.grp,items:[]}; groups.push(g);} g.items.push(it); });
  let html=`<div class="insp-status ${ev.handedOver?'is-ok':'is-bad'}">
      <span class="st">${status}</span><span class="sub">${esc(sub)} ${ev.pass}/${ev.total} butir memenuhi.</span></div>
    <div class="insp-tools" role="group" aria-label="Alat ukur inspeksi (tampilkan di adegan 3D)">
    ${inspMeta.map(m=>`<button type="button" class="toggle ${inspState[m.k]?'on':''}" data-insp="${m.k}" aria-pressed="${inspState[m.k]}" style="--c:${m.c}">
      <span class="tg" aria-hidden="true"></span>
      <span class="tlbl"><b>${m.t}</b><small>${m.s}</small></span>
    </button>`).join('')}
    </div>
    <h3 class="insp-h">Hasil ukur model</h3>`;
  groups.forEach(g=>{
    html+=`<p class="insp-grp">${esc(g.n)}</p><ul class="insp-list">${g.items.map(it=>`<li class="${it.ok?'ok':'bad'}" data-check="${it.id}">
      <span class="i" aria-hidden="true">${it.ok?'✓':'✗'}</span>
      <span class="t"><b>${esc(it.label)}<span class="sr-only"> — ${it.ok?'memenuhi':'belum memenuhi'}</span></b>
      <span class="v">${esc(it.value)}</span><span class="lim">Syarat: ${esc(it.limit)}</span><span class="src">${esc(it.ref)}</span><span class="how">${HOW[it.how]||HOW.ukur}</span></span></li>`).join('')}</ul>`;
  });
  const nU=ev.items.filter(i=>i.how==='ukur').length, nUC=ev.items.filter(i=>i.how==='ukur+cek').length, nC=ev.items.filter(i=>i.how==='cek').length;
  html+=`<div class="insp-note"><b>Cara pemeriksaan:</b> ${nU} dari ${ev.total} butir diukur dari geometri model (posisi, panjang, dan sambungan komponen yang terpasang); ${nUC} butir diukur dengan sebagian syarat diperiksa dari jenis komponen; ${nC} butir diperiksa dari keberadaan atau jenis komponen. Tanda * menandai kriteria aplikasi yang bukan nilai standar.</div>`;
  html+=`<div class="insp-note"><b>Konfigurasi ilustratif:</b> 2 bay × 2,0 m, lebar 1,2 m, lift 1,95 m — di dalam batas tabel pedoman (tidak mengikat) OSHA 1926 Subpart L App. A untuk tube &amp; coupler <i>light duty</i> (jarak tiang 4 ft × 10 ft; jarak runner vertikal 6 ft 6 in). Bukan pengganti desain dan perhitungan perancah oleh ahli.</div>`;
  pBody.innerHTML=html;
  pBody.querySelectorAll('[data-insp]').forEach(b=>b.onclick=()=>toggleInsp(b.dataset.insp));
}

function switchTab(tab){
  document.querySelectorAll('.tab').forEach(t=>{ const on=t.dataset.tab===tab; t.classList.toggle('on',on); t.setAttribute('aria-selected',on?'true':'false'); t.tabIndex=on?0:-1; if(on&&panelEl) panelEl.setAttribute('aria-labelledby',t.id); });
  MODE=tab;
  scaffold.visible = (tab!=='lib');
  ground.visible = (tab!=='lib');
  libRig.visible = (tab==='lib');
  pedestal.visible = (tab==='lib');
  document.getElementById('legend').style.display = (tab==='build')? '' : 'none';
  if(tab!=='insp'){
    Object.keys(inspState).forEach(k=>inspState[k]=false);
    Object.keys(inspGroups).forEach(k=>{if(inspGroups[k]){scene.remove(inspGroups[k]);disposeTree(inspGroups[k]);inspGroups[k]=null;}});
    clearLabels();
  }
  if(tab==='lib'){
    pEyebrow.textContent='Modul 01'; pTitle.textContent='Pengenalan Komponen';
    pSub.textContent='Putar model 3D — kenali klem, komponen, tag status, dan alat ukur perancah.';
    showLibModel(curLibType); renderLibPanel();
    frame(0,0.6,0,4.0,0.62,1.05);
    clearLabels(); clearHint();
  } else if(tab==='build'){
    pEyebrow.textContent='Modul 02'; pTitle.textContent='Simulasi Perakitan';
    pSub.textContent='Ikuti urutan pemasangan yang benar, satu komponen per tahap.';
    solidifyUpTo();
    showHint();
    renderBuildPanel();
    frame(CAM_HOME.x,CAM_HOME.y,CAM_HOME.z,CAM_HOME.r,CAM_HOME.theta,CAM_HOME.phi);
    clearLabels();
  } else if(tab==='insp'){
    pEyebrow.textContent='Modul 03'; pTitle.textContent='Inspeksi & Pengukuran';
    pSub.textContent='Hasil diukur dari perancah yang sudah terpasang. Nyalakan alat ukur untuk melihatnya di adegan 3D.';
    clearHint();
    showBuilt();
    renderInspPanel();
    rebuildInspection();
    frame(0,2.3,0.3,15,0.64,1.0);
  }
  updateWorkers();
  markDirty();
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));

/* ============================================================
   TOAST
   ============================================================ */
let toastT=null;
function toast(msg){
  document.getElementById('toastMsg').textContent=msg;
  const tl=document.getElementById('toast'); tl.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>tl.classList.remove('show'),3200);
}

/* ============================================================
   RESIZE + LOOP (ukuran wadah, offset panel, render sesuai kebutuhan)
   ============================================================ */
function isSheet(){ return container.clientWidth <= 760; }
function sheetHeight(){ return (isSheet() && panelEl) ? panelEl.offsetHeight : 0; }
function sideInset(){
  if(isSheet() || !panelEl) return 0;
  const r=panelEl.getBoundingClientRect(), c=container.getBoundingClientRect();
  return Math.max(0, c.right - r.left);
}
/* tinggi bilah tab di atas adegan (tidak tertutup oleh perancah) */
function topInset(){ const t=document.getElementById('top'); return t ? Math.min(t.offsetHeight, container.clientHeight*0.3) : 0; }
/* jarak kamera minimum agar objek muat di area yang tidak tertutup panel/lembar/bilah:
   setengah lebar & tinggi objek (m) dibandingkan dengan sudut pandang area terlihat */
function fitRadius(r){
  const H=Math.max(1,container.clientHeight), W=Math.max(1,container.clientWidth);
  const visW=Math.max(1,W-sideInset()), visH=Math.max(1,H-sheetHeight()-topInset());
  const t=Math.tan(camera.fov*Math.PI/360);
  const tx=visW/H*t, ty=visH/H*t;
  const e=(MODE==='lib') ? [0.95,0.9] : [3.4,2.9];
  const need=Math.max(e[0]*1.1/tx, e[1]*1.15/ty);
  return Math.min(cam.maxR, Math.max(r, need));
}
/* pusat adegan digeser ke area yang tidak tertutup panel (kanan), lembar bawah (ponsel), dan bilah tab */
function applyViewOffset(){
  const w=Math.max(1,container.clientWidth), h=Math.max(1,container.clientHeight);
  const oy=Math.round((sheetHeight()-topInset())/2), ox=Math.round(sideInset()/2);
  camera.aspect=w/h;
  if(ox||oy) camera.setViewOffset(w,h,ox,oy,w,h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--sheet-h', sheetHeight()+'px');
  markView();
}
let lastW=0, lastH=0;
function onResize(){
  const w=Math.max(1,container.clientWidth), h=Math.max(1,container.clientHeight);
  if(w!==lastW||h!==lastH){ lastW=w; lastH=h; renderer.setSize(w,h); }
  applyViewOffset();
}
if(window.ResizeObserver){ const ro=new ResizeObserver(function(){ onResize(); }); ro.observe(container); if(panelEl) ro.observe(panelEl); }
else addEventListener('resize',onResize);

let frames=0;
function loop(){
  requestAnimationFrame(loop);
  if(document.hidden) return;
  const moving=dampCam();
  const spin=(MODE==='lib' && !REDUCED);              /* model katalog tidak berputar bila gerak dikurangi */
  if(spin) libHolder.rotation.y+=0.006;
  if(moving||spin||dirty){
    if(shadowDirty||spin){ renderer.shadowMap.needsUpdate=true; shadowDirty=false; }
    dirty=false; updateLabels(); renderer.render(scene,camera); frames++;
  }
}

/* ============================================================
   INIT (dipanggil saat anggota menekan "Mulai Simulasi")
   ============================================================ */
/* tab modul: panah kiri/kanan, Home/End (pola ARIA tabs) */
const tabsEl=document.getElementById('tabs');
if(tabsEl) tabsEl.addEventListener('keydown',function(e){
  const tabs=[...tabsEl.querySelectorAll('.tab')]; const i=tabs.indexOf(document.activeElement); if(i<0) return;
  let j=-1;
  if(e.key==='ArrowRight') j=(i+1)%tabs.length; else if(e.key==='ArrowLeft') j=(i-1+tabs.length)%tabs.length;
  else if(e.key==='Home') j=0; else if(e.key==='End') j=tabs.length-1;
  if(j<0) return;
  e.preventDefault(); tabs[j].focus(); switchTab(tabs[j].dataset.tab);
});
/* ponsel: lembar panel dapat diciutkan agar adegan 3D terlihat penuh */
const sheetBtn=document.getElementById('sheetToggle');
if(sheetBtn) sheetBtn.onclick=function(){
  const c=panelEl.classList.toggle('is-collapsed');
  sheetBtn.setAttribute('aria-expanded',c?'false':'true');
  sheetBtn.setAttribute('aria-label',c?'Tampilkan panel':'Ciutkan panel');
  onResize();
};
/* ponsel/tablet: kontrol kamera di balik satu tombol (gestur sentuh tetap tersedia) */
const camBtn=document.getElementById('camToggle');
if(camBtn) camBtn.onclick=function(){
  const open=container.classList.toggle('cam-open');
  camBtn.setAttribute('aria-expanded',open?'true':'false');
  camBtn.setAttribute('aria-label',open?'Sembunyikan kontrol kamera':'Tampilkan kontrol kamera');
};
/* konteks WebGL hilang/pulih (mis. memori GPU ponsel penuh) */
el.addEventListener('webglcontextlost',function(e){ e.preventDefault(); if(opts.onContextLost) opts.onContextLost(true); },false);
el.addEventListener('webglcontextrestored',function(){ if(opts.onContextLost) opts.onContextLost(false); markDirty(); },false);

showLibModel(curLibType);
applyViewOffset();
applyCam();
loop();
renderLibPanel();

return {
  switchTab: switchTab,
  resume: function(n){ state.current=Math.max(0,Math.min(STEPS.length,n|0)); switchTab('build'); },
  inspect: function(){ return evaluate(); },
  get mode(){ return MODE; },
  get current(){ return state.current; },
  get frames(){ return frames; },
  steps: STEPS.map(s=>({id:s.id,title:s.title})),
  total: STEPS.length,
  renderer: renderer,
  camera: camera,
  scene: scene
};
}   /* akhir createSim */
})(window, document);
