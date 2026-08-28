/**
 * "Daftar Harga Standar Indonesia" — the app's single shared cost-assumption
 * table. Originally lived only inside PRDHub.tsx as a display-only list; it is
 * now the canonical source both PRDHub's "Standard Indonesia Price Sheet" tab
 * AND the ROI/TCO engine (src/lib/roiTcoEngine.ts) read from, so a price
 * changed in one place is correct everywhere.
 *
 * Every row keeps its original display fields (item/rate/unit/category/desc)
 * so PRDHub's table renders exactly as before, plus a machine-readable `key`
 * and numeric `rateUsd` so the engine can compute with it instead of parsing
 * the Indonesian-formatted string. All 9 original rows already divide out to
 * clean USD figures at the app's long-standing FX assumption of Rp 16.000/USD
 * (e.g. Rp 1.200 / 16.000 = $0.075 per 1M tokens — Gemini Flash's real input
 * price) — nothing about the original numbers changed, this only exposes them
 * as numbers instead of strings.
 */

/** The one editable FX rate used to convert every USD-denominated assumption to IDR. */
export const DEFAULT_FX_IDR_PER_USD = 16000;

export type PricingCategory =
  | 'LLM Token'
  | 'Keamanan / Otentikasi'
  | 'Orkestrasi'
  | 'Ekstraksi Dokumen'
  | 'Otomasi Desktop'
  | 'Tenaga Kerja'
  | 'Pemeliharaan & Kepatuhan'
  | 'Pengembangan';

export interface PricingStandardItem {
  /** Stable machine-readable id the ROI/TCO engine references. */
  key: string;
  item: string;
  rate: string; // pre-formatted IDR display string, unchanged behavior for PRDHub
  unit: string;
  category: PricingCategory;
  desc: string;
  /** Numeric USD value backing `rate` — source of truth for calculations. */
  rateUsd: number;
}

export const PRICING_STANDARDS: PricingStandardItem[] = [
  // ---- Existing rows (unchanged values — just annotated with key + rateUsd) ----
  {
    key: 'gemini_flash_input',
    item: 'Google Gemini 1.5 Flash (Input)',
    rate: 'Rp 1.200',
    unit: 'per 1.000.000 tokens',
    category: 'LLM Token',
    desc: 'Sangat hemat untuk ekstraksi data masal dan pencocokan teks terstruktur.',
    rateUsd: 0.075,
  },
  {
    key: 'gemini_flash_output',
    item: 'Google Gemini 1.5 Flash (Output)',
    rate: 'Rp 4.800',
    unit: 'per 1.000.000 tokens',
    category: 'LLM Token',
    desc: 'Digunakan untuk menyusun format jawaban JSON atau draf jurnal akun.',
    rateUsd: 0.3,
  },
  {
    key: 'gemini_pro_input',
    item: 'Google Gemini 1.5 Pro (Input)',
    rate: 'Rp 20.000',
    unit: 'per 1.000.000 tokens',
    category: 'LLM Token',
    desc: 'Ideal untuk analisis finansial mendalam dan penaksiran tren likuiditas.',
    rateUsd: 1.25,
  },
  {
    key: 'gemini_pro_output',
    item: 'Google Gemini 1.5 Pro (Output)',
    rate: 'Rp 80.000',
    unit: 'per 1.000.000 tokens',
    category: 'LLM Token',
    desc: 'Digunakan untuk menyusun komentar varians CAPEX dan narasi rekomendasi CFO.',
    rateUsd: 5,
  },
  {
    key: 'sms_otp',
    item: 'Jasa SMS OTP (Gateway Indonesia)',
    rate: 'Rp 350',
    unit: 'per sukses transaksi',
    category: 'Keamanan / Otentikasi',
    desc: 'Verifikasi keamanan dua langkah (MFA) bagi supervisor sebelum persetujuan.',
    rateUsd: 0.021875,
  },
  {
    key: 'whatsapp_gateway',
    item: 'WhatsApp Business API Gateway',
    rate: 'Rp 450',
    unit: 'per sesi notifikasi',
    category: 'Keamanan / Otentikasi',
    desc: 'Mengirimkan alert verifikasi instan atau draf anomali ke manajer operasional.',
    rateUsd: 0.028125,
  },
  {
    key: 'orchestration_platform',
    item: 'Make.com Workflow Scheduler',
    rate: 'Rp 144.000',
    unit: 'per bulan (Standard)',
    category: 'Orkestrasi',
    desc: 'Mengatur cron-job berkala, webhook trigger, dan sinkronisasi antar-sistem. Digunakan sebagai basis biaya infra/orkestrasi bulanan pada model TCO.',
    rateUsd: 9,
  },
  {
    key: 'ocr_doc_ai',
    item: 'Secure OCR Cloud (PDF.co)',
    rate: 'Rp 784.000',
    unit: 'per bulan',
    category: 'Ekstraksi Dokumen',
    desc: 'Mendigitalkan kuitansi, invoice, atau dokumen cetak beresolusi rendah sebelum diproses AI. Basis biaya infra dokumen-AI/OCR pada model TCO.',
    rateUsd: 49,
  },
  {
    key: 'rpa_runtime_license',
    item: 'RPA Unattended Runner Runtime',
    rate: 'Rp 1.600.000',
    unit: 'per bulan',
    category: 'Otomasi Desktop',
    desc: 'Lisensi bot RPA unattended per bulan (mis. portal DJP PPN, portal vendor bank). Basis biaya lisensi RPA pada perbandingan RPA vs AI.',
    rateUsd: 100,
  },

  // ---- New rows added because the table lacked them (needed for a real TCO/benefit model) ----
  {
    key: 'reviewer_loaded_wage',
    item: 'Finance Reviewer — Loaded Hourly Wage',
    rate: 'Rp 75.000',
    unit: 'per jam (fully-loaded)',
    category: 'Tenaga Kerja',
    // Base direct wage used elsewhere in the app is ~Rp 50.000/hr (server.ts).
    // "Loaded" wage adds employer overhead (BPJS Ketenagakerjaan/Kesehatan,
    // THR accrual, benefits) — a conventional ~1.5x multiplier on direct wage.
    desc: 'Upah dasar dimuati beban perusahaan (BPJS, THR, tunjangan) — dipakai untuk biaya human-in-the-loop review, bukan hanya waktu yang dibebaskan.',
    rateUsd: 4.6875,
  },
  {
    key: 'vision_pdf_token_multiplier',
    item: 'Vision / PDF Token Premium (vs. plain text)',
    rate: '1,4x',
    unit: 'pengali atas tarif input teks',
    category: 'LLM Token',
    // Gemini does not publish a separate per-modality unit price, but a
    // scanned page/image tokenizes into materially more tokens than the same
    // content as clean extracted text (image tiling overhead). Modeled as a
    // multiplier on the text input rate rather than a separate SKU, since
    // that is how the vendor actually prices it.
    desc: 'Dokumen hasil scan/gambar (bukan teks bersih) menghasilkan lebih banyak token per halaman dibanding teks biasa — dimodelkan sebagai pengali atas tarif token input teks.',
    rateUsd: 1.4,
  },
  {
    key: 'prompt_maintenance_monthly',
    item: 'Prompt / Version Upkeep',
    rate: 'Rp 1.500.000',
    unit: 'per bulan, per proses',
    category: 'Pemeliharaan & Kepatuhan',
    // ~2 analyst-hours/month at the loaded wage rate to review drift, retune
    // few-shot examples, and roll forward when the underlying model version
    // changes — a small but real recurring cost naive models omit entirely.
    desc: 'Waktu analis untuk meninjau drift akurasi, memperbarui contoh few-shot, dan migrasi versi model — biaya berulang yang sering diabaikan model ROI naif.',
    rateUsd: 93.75,
  },
  {
    key: 'compliance_audit_monthly',
    item: 'Audit Trail & PDP Compliance Review',
    rate: 'Rp 2.000.000',
    unit: 'per bulan, per proses',
    category: 'Pemeliharaan & Kepatuhan',
    // Covers periodic review against Indonesia's PDP Law (UU No. 27/2022) for
    // any process touching personal/financial data, plus maintaining the
    // audit-log trail an internal/external auditor can inspect.
    desc: 'Peninjauan berkala kepatuhan UU PDP dan pemeliharaan jejak audit (audit trail) yang dapat diperiksa auditor internal/eksternal.',
    rateUsd: 125,
  },
  {
    key: 'blended_integration_dev_rate',
    item: 'Blended Automation Developer Rate',
    rate: 'Rp 400.000',
    unit: 'per jam',
    category: 'Pengembangan',
    // Matches the $25/hr blended dev rate already used by the deployment-plan
    // estimator in server.ts — kept identical so the one-time build/
    // integration cost in the TCO model doesn't silently diverge from the
    // number the roadmap generator already shows.
    desc: 'Tarif blended untuk integrasi ke ERP/sistem sumber (dipakai untuk biaya build satu-kali, diamortisasi selama horizon analisis).',
    rateUsd: 25,
  },
  {
    key: 'rpa_bot_dev_cost',
    item: 'RPA Bot Development — One-Time',
    rate: 'Rp 48.000.000',
    unit: 'per bot (sekali)',
    category: 'Otomasi Desktop',
    // ~120 dev-hours at the blended rate — RPA bots need per-screen selector
    // mapping and are typically costlier to build than a prompt-based flow.
    desc: 'Biaya pengembangan bot RPA sekali di awal (pemetaan selektor layar, penanganan pengecualian) — komponen yang sering dihilangkan pada perbandingan "harga lisensi saja".',
    rateUsd: 3000,
  },
  {
    key: 'rpa_maintenance_monthly',
    item: 'RPA Bot Maintenance',
    rate: 'Rp 3.200.000',
    unit: 'per bulan, per bot',
    category: 'Pemeliharaan & Kepatuhan',
    // RPA bots break whenever a target UI/portal changes layout — budget a
    // recurring ~20% of monthly license cost for selector fixes.
    desc: 'Perbaikan berkala saat tampilan portal/sistem target berubah dan bot RPA gagal (selector break) — biaya berulang yang melekat pada RPA, bukan hanya lisensi.',
    rateUsd: 200,
  },
];

export function findPricingRate(key: string): number {
  const row = PRICING_STANDARDS.find((r) => r.key === key);
  if (!row) throw new Error(`Unknown pricing standard key: ${key}`);
  return row.rateUsd;
}
