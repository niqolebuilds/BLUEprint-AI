import { Sparkles, Users, Receipt, Landmark, HardDrive, LucideIcon } from 'lucide-react';
import { PrdEngineRecord } from '../lib/blueprintApi';

/** Maps the icon key persisted on each engine record to its lucide component. */
export const PRD_ENGINE_ICONS: Record<string, LucideIcon> = {
  Users,
  Receipt,
  Landmark,
  HardDrive,
  Sparkles,
};

// Convert USD to IDR at 1 USD = Rp 16.000
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

/**
 * Seed content for local-only mode (VITE_ENABLE_REMOTE_AUTH unset — no Postgres
 * backend). Mirrors api/_lib/prdEngine.ts's SEED_PRD_ENGINES exactly, kept as a
 * separate copy since src/ and api/ are bundled independently (Vite vs.
 * esbuild/Vercel) and shouldn't import across that boundary.
 */
export const SEED_PRD_ENGINES: PrdEngineRecord[] = [
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
    createdAt: new Date(0).toISOString(),
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
    createdAt: new Date(0).toISOString(),
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
    createdAt: new Date(0).toISOString(),
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
    createdAt: new Date(0).toISOString(),
  },
];
