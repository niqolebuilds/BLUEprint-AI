'use strict';

/**
 * Group boilerplate.
 *
 * Roughly a fifth of every hydrated spec is not about the process at all — it
 * is the Siloam Group's standing position on security roles, documentation
 * artefacts, support SLAs, vendor deliverables, environment paths and audit
 * controls. Those blocks were byte-identical across catalogue entries, which
 * meant the model was paying to retype the Group's own policy every time.
 *
 * They live here instead. `applyDefaults` deep-merges them into a spec before
 * rendering, so Blueprint AI emits them only when a process genuinely departs
 * from the standard. Output is unchanged; the generation cost is not.
 *
 * Merge rules, chosen so an override is never ambiguous:
 *   - A key the spec does not define takes the default.
 *   - A list whose every entry carries an `id` merges BY id: the spec's `SEC-005`
 *     replaces the default's `SEC-005`, defaults with no counterpart are kept,
 *     and the result sorts by id. This is what lets a spec add `AI-001` without
 *     having to restate `AI-003..007` alongside it.
 *   - Any other array is REPLACED wholesale. Without ids there is no way to say
 *     which entry overrides which, and half-inheriting a list is worse than
 *     either inheriting or restating it — no reader can tell which happened.
 *   - `extends: false` on a spec section opts out of defaults entirely.
 *
 * Anything here is a Group-level commitment. Changing it changes every future
 * vendor pack, so it belongs under the same review as any other policy text.
 */

const id = {
  security: {
    roles: [
      { role: 'Petugas Pajak Unit', permissions: 'Membuat dan melihat kasus unit sendiri, mengonfirmasi header hasil penguraian, mengunggah dokumen', sod: 'Tidak dapat menyetujui pada lapis mana pun' },
      { role: 'Unit Financial Controller', permissions: 'Melihat kasus unit sendiri, reviu dan persetujuan lapis pertama, menganotasi', sod: 'Tidak dapat melakukan persetujuan lapis kedua' },
      { role: 'Group Tax Manager', permissions: 'Seluruh unit, klasifikasi manual, persetujuan lapis kedua, kurasi preseden, konfigurasi ambang', sod: 'Tidak dapat melakukan persetujuan lapis pertama pada kasus yang sama' },
      { role: 'System Accountant', permissions: 'Pemeliharaan tabel pemetaan, konfigurasi konektor', sod: 'Tanpa hak persetujuan kasus; tanpa akses ke narasi draf' },
      { role: 'Internal Audit', permissions: 'Hanya-baca atas seluruh kasus dan log audit lengkap', sod: 'Tanpa akses tulis di mana pun' },
      { role: 'Dukungan Vendor', permissions: 'Akses break-glass berbatas waktu dan tertaut tiket, hanya pada lingkungan non-produksi', sod: 'Tanpa akses produksi permanen — lihat SEC-004' },
    ],
    policies: [
      { id: 'SEC-001', priority: 'Must', policy: 'Autentikasi melalui SSO Grup (Microsoft Entra ID) dengan MFA wajib. Tidak ada akun aplikasi lokal untuk pengguna manusia.' },
      { id: 'SEC-002', priority: 'Must', policy: 'Kontrol akses berbasis peran dengan pembatasan entitas pada tingkat baris. Peran unit hanya melihat kasus entitasnya sendiri.' },
      { id: 'SEC-003', priority: 'Must', policy: 'Seluruh kredensial sistem sumber disimpan dalam secret store terkelola dengan rotasi otomatis. Tidak ada kredensial di berkas konfigurasi, kode sumber, maupun prompt agen.' },
      { id: 'SEC-004', priority: 'Must', policy: 'Personel vendor tidak memiliki akses produksi permanen. Akses dukungan bersifat break-glass, berbatas waktu, tertaut tiket, disetujui pemilik teknis, dan tercatat sepenuhnya.' },
      { id: 'SEC-005', priority: 'Must', policy: 'Solusi tidak memproses data yang dapat mengidentifikasi pasien. Hal ini ditegakkan pada konektor sumber melalui allow-list pada tingkat field, bukan melalui penyaringan di hilir.' },
      { id: 'SEC-006', priority: 'Must', policy: 'Data saat tersimpan dienkripsi dan berada dalam batas residensi data yang disetujui. Data dalam transit menggunakan TLS 1.2 atau lebih tinggi.' },
      { id: 'SEC-007', priority: 'Must', policy: 'Penetration test diselesaikan dan diremediasi sebelum go-live produksi.' },
      { id: 'SEC-008', priority: 'Should', policy: 'Reviu akses pengguna triwulanan dilaksanakan oleh pemilik proses, dengan bukti disimpan untuk Internal Audit.' },
    ],
  },

  exceptions: {
    controls: [
      { id: 'CTL-01', control: 'Pemisahan tugas antara persetujuan lapis pertama dan lapis kedua ditegakkan oleh sistem, bukan oleh kebiasaan.', framework: 'Setara SOX / Kontrol Internal Grup' },
      { id: 'CTL-02', control: 'Log audit tidak dapat diubah dan hanya-tambah, mencakup setiap tindakan otomatis dan setiap keputusan manusia.', framework: 'Jejak audit' },
      { id: 'CTL-03', control: 'Penegakan hanya-baca diverifikasi pada tingkat izin akun layanan dan diuji ulang pada setiap rilis.', framework: 'Manajemen perubahan' },
      { id: 'CTL-04', control: 'Reviu kontrol triwulanan oleh Internal Audit atas sampel kasus tertutup, menelusuri setiap angka yang dinyatakan hingga ke sumbernya.', framework: 'Program Internal Audit' },
    ],
  },

  deployment: {
    environments: [
      { env: 'Development', purpose: 'Pembangunan oleh vendor', data: 'Sintetis saja', access: 'Vendor' },
      { env: 'UAT', purpose: 'Pengujian penerimaan Grup', data: 'Ekstrak produksi termasker — tanpa data pasien, pengenal ditokenisasi', access: 'Pemilik proses, Internal Audit, vendor (terawasi)' },
      { env: 'Production', purpose: 'Operasi langsung', data: 'Produksi', access: 'Personel Grup saja; break-glass vendor sesuai SEC-004' },
    ],
  },

  documentation: [
    { id: 'DOC-01', artefact: 'Dokumen arsitektur solusi', detail: 'Diagram komponen, aliran data, dan jaringan; topologi penerapan; inventaris teknologi beserta versinya.' },
    { id: 'DOC-02', artefact: 'Spesifikasi integrasi', detail: 'Per konektor: endpoint, autentikasi, skema payload, kode kesalahan, semantik retry, dan batas laju.' },
    { id: 'DOC-05', artefact: 'Runbook operasional', detail: 'Start/stop, pemantauan, respons alert, mode kegagalan umum beserta langkah remediasi, pencadangan dan pemulihan.' },
    { id: 'DOC-06', artefact: 'Panduan pengguna', detail: 'Berbasis peran, dalam Bahasa Indonesia dan Inggris, mencakup seluruh siklus hidup dengan tangkapan layar.' },
    { id: 'DOC-07', artefact: 'Narasi kontrol untuk Internal Audit', detail: 'Setiap kontrol dipetakan ke implementasinya dan ke bukti yang menunjukkan kontrol tersebut berjalan.' },
    { id: 'DOC-08', artefact: 'Paket bukti pengujian', detail: 'Skrip uji yang telah dieksekusi beserta hasilnya untuk setiap kriteria penerimaan, ditandatangani test lead Grup.' },
  ],

  support: {
    hypercare: '60 hari kalender sejak go-live Fase 1. Insinyur vendor bernama tersedia pada jam kerja Jakarta dengan komitmen respons 2 jam, ditambah kehadiran pada reviu mingguan bersama pemilik proses.',
    slas: [
      { severity: 'P1 — Kritis', definition: 'Solusi tidak tersedia, atau proses yang mendekati pelanggaran SLA tidak dapat dilanjutkan', response: '1 jam', resolution: '4 jam' },
      { severity: 'P2 — Tinggi', definition: 'Konektor atau mesin perhitungan gagal; pekerjaan dapat dimulai namun tidak dapat diselesaikan', response: '2 jam', resolution: '1 hari kerja' },
      { severity: 'P3 — Sedang', definition: 'Fungsi menurun namun tersedia workaround', response: '1 hari kerja', resolution: '5 hari kerja' },
      { severity: 'P4 — Rendah', definition: 'Defect kosmetik atau dokumentasi', response: '3 hari kerja', resolution: 'Rilis berikutnya' },
    ],
  },

  vendorDeliverables: [
    { id: 'VD-01', deliverable: 'Solusi berfungsi, terpasang di Development, UAT, dan Production', acceptance: 'Terpasang, dapat diakses, dan lolos smoke test di setiap lingkungan' },
    { id: 'VD-02', deliverable: 'Kode sumber lengkap dan infrastructure-as-code', acceptance: 'Diserahkan ke repositori Grup; Grup memegang hak abadi untuk menggunakan dan memodifikasi' },
    { id: 'VD-04', deliverable: 'Seluruh artefak dokumentasi yang tercantum pada bagian Dokumentasi', acceptance: 'Direviu dan ditandatangani oleh pemilik Grup masing-masing' },
    { id: 'VD-05', deliverable: 'Bukti pengujian tereksekusi untuk setiap kriteria penerimaan', acceptance: 'Ditandatangani test lead Grup; nol defect P1 dan P2 terbuka' },
    { id: 'VD-06', deliverable: 'Laporan penetration test beserta bukti remediasi', acceptance: 'Diterima Group IT Security' },
    { id: 'VD-07', deliverable: 'Penyelenggaraan pelatihan — dua sesi per peran, terekam', acceptance: 'Kehadiran tercatat; rekaman diserahkan kepada Grup' },
    { id: 'VD-08', deliverable: 'Hypercare 60 hari dengan kehadiran pada reviu mingguan', acceptance: 'Reviu penutup ditandatangani pemilik proses' },
  ],
};

/** Boilerplate that hydrates only for AI / RPA solution types. */
const idAI = {
  ai: {
    guardrails: [
      { id: 'AI-003', priority: 'Must', control: 'Agen beroperasi di atas himpunan perkakas tertutup. Agen tidak memiliki akses web umum, tidak dapat mengeksekusi kode, dan tidak dapat memanggil sistem yang tidak tercantum pada bagian Sistem & Integrasi.' },
      { id: 'AI-004', priority: 'Must', control: 'Endpoint inferensi harus zero-retention secara kontraktual, tidak boleh menggunakan data Grup untuk pelatihan model, dan harus di-hosting di Indonesia atau di wilayah yang disetujui secara tertulis oleh pemilik Perlindungan Data Grup.' },
      { id: 'AI-005', priority: 'Must', control: 'Setiap langkah agen — prompt, panggilan perkakas, respons perkakas, keluaran model — dicatat beserta ID kasus, disimpan selama masa retensi, dan dapat direproduksi untuk keperluan audit.' },
      { id: 'AI-006', priority: 'Must', control: 'Versi model dan prompt dipatok per kasus. Kasus yang dibuka pada satu versi diselesaikan pada versi tersebut. Identitas versi tercantum pada rekaman kasus dan di dalam paket bukti.' },
      { id: 'AI-007', priority: 'Must', control: 'Pertahanan terhadap prompt injection: konten yang diekstraksi dari dokumen masuk diperlakukan secara ketat sebagai data. Instruksi yang tertanam dalam dokumen tidak boleh mengubah perilaku agen, dan batas ini wajib diuji sebagai bagian dari UAT.' },
    ],
  },
};

const DEFAULTS = { id, 'id:ai': idAI };

/** Solution types that also receive the AI guardrail defaults. */
const AI_TYPES = new Set(['AI / Agentic AI', 'RPA Bot']);

/**
 * Merge Group boilerplate into a spec.
 *
 * @param {object} spec  as hydrated by Blueprint AI
 * @returns {object} a new spec; the input is not mutated
 */
function applyDefaults(spec) {
  const lang = spec?.meta?.language || 'id';
  const base = DEFAULTS[lang];
  if (!base) return spec; // no boilerplate curated for this language yet

  let merged = mergeSection(base, spec);
  if (AI_TYPES.has(spec?.meta?.solutionType) && DEFAULTS[`${lang}:ai`]) {
    merged = mergeSection(DEFAULTS[`${lang}:ai`], merged);
  }
  return merged;
}

/**
 * Deep-merge `over` onto `base`. See the merge rules above: id'd lists merge
 * by id and sort; everything else is replaced.
 */
function mergeSection(base, over) {
  if (over === undefined || over === null) return clone(base);
  if (Array.isArray(base) && Array.isArray(over)) {
    if (allHaveIds(base) && allHaveIds(over)) return mergeById(base, over);
    return clone(over);
  }
  if (Array.isArray(base) || Array.isArray(over)) return clone(over);
  if (typeof base !== 'object' || typeof over !== 'object') return clone(over);
  if (over.extends === false) {
    const out = clone(over);
    delete out.extends;
    return out;
  }
  const out = clone(over);
  for (const [k, v] of Object.entries(base)) {
    out[k] = k in over ? mergeSection(v, over[k]) : clone(v);
  }
  return out;
}

const allHaveIds = (arr) => arr.length > 0
  && arr.every((x) => x && typeof x === 'object' && typeof x.id === 'string');

/**
 * Union two id'd lists: `over` wins on a shared id, defaults with no
 * counterpart survive, and the result is sorted by id so FR-001 precedes
 * FR-010 and a merged list reads in the same order as a hand-written one.
 */
function mergeById(base, over) {
  const byId = new Map();
  for (const item of base) byId.set(item.id, clone(item));
  for (const item of over) byId.set(item.id, clone(item));
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Which top-level areas a spec may omit and still render identically. */
const COVERED = [
  'security.roles', 'security.policies', 'exceptions.controls',
  'deployment.environments', 'documentation', 'support', 'vendorDeliverables',
  'ai.guardrails (AI-003..007)',
];

module.exports = { applyDefaults, DEFAULTS, COVERED };
