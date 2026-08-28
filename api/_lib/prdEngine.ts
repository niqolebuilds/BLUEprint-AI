/**
 * PRD Engine domain logic — kept framework/DB-free on purpose so it can be
 * unit tested without a live Postgres connection (see prdEngine.test.ts) and
 * reused unchanged from api/_lib/actions.ts.
 *
 * "Generation" here is a deterministic consolidation heuristic (ported from
 * the client-side logic that used to run entirely in React state — see
 * PRDHub.tsx history): it looks at which catalogue processes aren't yet
 * referenced by any persisted engine's overlappingProcesses, and if any
 * exist, compiles them into one new engine record. It is intentionally
 * isolated behind `generatePrdEngine()` so a real LLM-backed generation step
 * (e.g. the Gemini pattern already used in server.ts's /api/ai/* routes)
 * can be swapped in later without touching the persistence or routing code.
 */

import { randomUUID } from 'crypto';

export interface PrdEngineMetrics {
  volume: string;
  effort: string;
  annualSavings: string;
  payback: string;
}

export interface PrdEngineRecord {
  id: string;
  title: string;
  iconKey: string;
  description: string;
  targetAudience: string;
  masterUsers: string;
  ecosystemApps: string;
  overlappingProcesses: string[];
  capexLogic: string;
  opexLogic: string;
  metrics: PrdEngineMetrics;
  specifications: string[];
  isSeed: boolean;
  createdAt: string;
}

export interface CatalogueProcessRef {
  id?: string;
  title: string;
}

// Convert USD to IDR at 1 USD = Rp 16.000, mirroring the old client-side constant.
const toIDR = (usd: number) => usd * 16000;

const formatIDR = (val: number): string => {
  if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(2)} Miliar`;
  if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)} Juta`;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
};

/** Seeded once into an empty prd_engines table — never re-applied after that. */
export const SEED_PRD_ENGINES: Omit<PrdEngineRecord, 'createdAt'>[] = [
  {
    id: 'engine-claims',
    title: 'AI Claims & Billing Settlement Engine',
    iconKey: 'Users',
    description: 'Unified billing audit and claim verification system bridging HIS patient records and public insurance portals.',
    targetAudience: 'Billing Analysts, Accounts Receivable (AR) Officers, Branch Finance Managers',
    masterUsers: 'AR Admin Staff, BPJS Verification Officers, Supervisor Keuangan Siloam',
    ecosystemApps: 'BPJS e-Claim Portal, KAIROS Hospital Information System (HIS), CIMB Niaga Cash Management, Microsoft Excel, Microsoft Dynamics 365 ERP',
    overlappingProcesses: ['BPJS Claims Submission & Reconciliation', 'Physician Fee (Honorarium) Verification & Reconciliation'],
    capexLogic: 'Penyusunan pipeline integrasi API KAIROS HIS ke endpoint klaim, otentikasi aman gateway BPJS, dan visual audit dashboard gate untuk Supervisor.',
    opexLogic: 'Penggunaan Gemini 1.5 Flash untuk parsing aktivitas pelayanan vs batasan tarif BPJS (berdasarkan token), OTP verifikasi transaksi, serta scheduler bulanan Make.com.',
    metrics: {
      volume: '15.000 klaim & aktivitas dokter / bulan',
      effort: 'Mengurangi beban manual dari 220 jam menjadi 25 jam sebulan',
      annualSavings: formatIDR(toIDR(45000)),
      payback: '2 Bulan',
    },
    specifications: [
      'Konektivitas otomatis ke database lokal HIS (Fetch aktivitas & diagnosa pasien).',
      'Validasi kepatuhan tarif INA-CBG menggunakan LLM berbasis prompt ruleset.',
      'Antarmuka khusus supervisor untuk menyetujui draf honorarium dokter.',
      'Postingan otomatis voucher piutang ke Microsoft Dynamics 365 ERP via REST API.',
    ],
    isSeed: true,
  },
  {
    id: 'engine-ap',
    title: 'Intelligent Invoice & AP Automation Engine',
    iconKey: 'Receipt',
    description: 'Intelligent accounts payable orchestrator processing multi-vendor supply chain invoices with automatic ERP ledger entry.',
    targetAudience: 'Accounts Payable Officers, Procurement Admins, Treasury Leads',
    masterUsers: 'AP Officers, Procurement Managers, Accounting Supervisor',
    ecosystemApps: 'Microsoft Dynamics 365 ERP, Supplier Portal Siloam, Secure OCR Service, Microsoft Excel, Local Bank Transfers',
    overlappingProcesses: ['Vendor Invoice 3-Way Match & AP Voucher Generation', 'AI-as-a-Service Guide Reconciliation & Journaling'],
    capexLogic: 'Konfigurasi schema OCR dinamis untuk berbagai template supplier farmasi, mapping relational PO/GRN database, dan integration module di D365.',
    opexLogic: 'Gemini 1.5 Flash untuk ekstraksi tabel multi-halaman pada invoice fisik (token), langganan API OCR PDF.co, dan trigger otomatis via Make.com.',
    metrics: {
      volume: '8.000 invoice vendor & rekonsiliasi bank / bulan',
      effort: 'Mengurangi beban input manual dari 350 jam menjadi 30 jam sebulan',
      annualSavings: formatIDR(toIDR(62000)),
      payback: '3 Bulan',
    },
    specifications: [
      'Penerimaan berkas invoice digital (PDF) via e-mail webhook atau drop-folder.',
      'Ekstraksi tabel baris-demi-baris (line-items) menggunakan kecerdasan visual Gemini OCR.',
      'Pencocokan 3 arah (3-Way Match) antara Purchase Order, Goods Receipt Note, dan Vendor Invoice.',
      'Pembuatan voucher draf AP di D365 ERP secara real-time.',
    ],
    isSeed: true,
  },
  {
    id: 'engine-treasury',
    title: 'Treasury & Cash Operations Engine',
    iconKey: 'Landmark',
    description: 'Strategic forecasting and liquidity allocation intelligence aggregating balances across 41 operational branch accounts.',
    targetAudience: 'Treasury Managers, Corporate Cash Controllers, CFO (L-1)',
    masterUsers: 'Treasury Staff, Finance GM, Chief Financial Officer',
    ecosystemApps: 'CIMB Niaga Portal, Mandiri Cash Management, Microsoft Excel, D365 General Ledger',
    overlappingProcesses: ['Cash Forecasting & Bank Liquidity Allocation', 'CAPEX Budget Variance Analysis'],
    capexLogic: 'Pembuatan algoritma forecasting model, mapping CAPEX budget ceiling per departemen, serta visual analytics dashboard untuk L-1 & CFO.',
    opexLogic: 'Penggunaan Gemini 1.5 Pro untuk melakukan penalaran tren (chain-of-thought) kas harian, menyusun laporan komentar tertulis varians budget secara otomatis, serta orkestrasi Make.com.',
    metrics: {
      volume: 'Daily forecast across 41 branches & 120 CAPEX categories',
      effort: 'Mengurangi waktu penyusunan laporan dari 4 hari menjadi 15 menit',
      annualSavings: formatIDR(toIDR(38000)),
      payback: '4 Bulan',
    },
    specifications: [
      'Koneksi harian otomatis untuk mengunduh laporan mutasi kas (MT940) via Cash Portal.',
      'Konsolidasi saldo kas cabang Siloam secara real-time.',
      'Analisis deviasi (variance) CAPEX departemen medis terhadap pagu anggaran.',
      'Rekomendasi alokasi likuiditas harian otomatis yang draf-nya dikirim via WhatsApp Secure.',
    ],
    isSeed: true,
  },
  {
    id: 'engine-tax',
    title: 'Tax Compliance Automation Engine',
    iconKey: 'HardDrive',
    description: 'RPA and cognitive hybrid engine automating VAT reconciliation and direct filing to the national DJP Online tax portal.',
    targetAudience: 'Tax Accountants, Tax Managers, Compliance Directors',
    masterUsers: 'Tax Admin, Corporate Tax Supervisor, Audit Liaison',
    ecosystemApps: 'DJP e-Faktur Web Portal, Microsoft Dynamics 365 ERP, DJP Online e-SPT, Excel Reconciliation sheets',
    overlappingProcesses: ['Monthly VAT & PPN Taxation Filing'],
    capexLogic: 'Pengembangan browser automation script untuk navigasi headless portal DJP, pemetaan e-Faktur ledger fields, dan enkripsi sertifikat elektronik pajak.',
    opexLogic: 'Penggunaan RPA Unattended Bot runner license, pemecah Captcha berbasis OCR, dan Gemini 1.5 Flash untuk pemetaan klasifikasi kode pajak masukan.',
    metrics: {
      volume: '5.000 faktur pajak Masukan/Keluaran / bulan',
      effort: 'Mengurangi durasi rekonsiliasi pajak dari 10 hari kerja menjadi 4 jam',
      annualSavings: formatIDR(toIDR(28000)),
      payback: '5 Bulan',
    },
    specifications: [
      'Sinkronisasi berkala data GL pajak dari Dynamics 365 ERP.',
      'Unduh massal berkas XML Faktur Pajak Masukan dari e-Faktur web portal menggunakan robot RPA.',
      'Pencocokan silang otomatis nomor e-Faktur vs voucher ERP.',
      'Pembuatan berkas e-SPT Masa PPN siap lapor secara otomatis.',
    ],
    isSeed: true,
  },
];

/** Which catalogue processes aren't yet covered by any persisted engine. */
export function computeUnmappedProcesses(
  existingEngines: Pick<PrdEngineRecord, 'overlappingProcesses'>[],
  catalogueProcesses: CatalogueProcessRef[]
): CatalogueProcessRef[] {
  const mapped = new Set(existingEngines.flatMap((e) => e.overlappingProcesses));
  return catalogueProcesses.filter((p) => p.title && p.title.trim() !== '' && !mapped.has(p.title));
}

export interface GeneratePrdEngineResult {
  created: boolean;
  engine: PrdEngineRecord | null;
  unmappedCount: number;
}

/**
 * The PRD generation step. Pure and side-effect free — the caller is
 * responsible for persisting `engine` when `created` is true. Accepts
 * injectable `idFactory`/`now` so tests can assert on exact output.
 */
export function generatePrdEngine(
  existingEngines: Pick<PrdEngineRecord, 'overlappingProcesses'>[],
  catalogueProcesses: CatalogueProcessRef[],
  opts: { idFactory?: () => string; now?: () => Date } = {}
): GeneratePrdEngineResult {
  const idFactory = opts.idFactory ?? randomUUID;
  const now = opts.now ?? (() => new Date());

  const unmapped = computeUnmappedProcesses(existingEngines, catalogueProcesses);
  if (unmapped.length === 0) {
    return { created: false, engine: null, unmappedCount: 0 };
  }

  const engine: PrdEngineRecord = {
    id: idFactory(),
    title: 'Custom AI Orchestration Engine',
    iconKey: 'Sparkles',
    description: 'Auto-compiled orchestration engine derived from recently added organizational processes.',
    targetAudience: 'Cross-functional Operations',
    masterUsers: 'Process Owners, Analysts',
    ecosystemApps: 'Internal API Gateway, Cloud Storage, ERP modules',
    overlappingProcesses: unmapped.map((p) => p.title),
    capexLogic: 'Integration hooks for new custom workflows and AI orchestration logic.',
    opexLogic: 'Token consumption for generative analysis and cloud automation execution.',
    metrics: {
      volume: 'Dynamically scaled based on process usage',
      effort: 'Est. 40% reduction in manual tracking',
      annualSavings: formatIDR(toIDR(25000)),
      payback: '6 Bulan',
    },
    specifications: [
      'Dynamic data ingestion from user-defined inputs.',
      'LLM-based categorization and decision routing.',
      'Automated alerting and report generation.',
    ],
    isSeed: false,
    createdAt: now().toISOString(),
  };

  return { created: true, engine, unmappedCount: unmapped.length };
}
