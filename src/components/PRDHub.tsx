import { useState } from 'react';
import { Sparkles, FileText, Table, Users, Landmark, Layers, ArrowRight, Download, CheckCircle, Receipt, HardDrive, RefreshCw, X } from 'lucide-react';
import { Process } from '../types';

// Convert USD to IDR at 1 USD = Rp 16.000
const toIDR = (usd: number) => usd * 16000;

const formatIDR = (val: number) => {
  if (val >= 1000000000) {
    return `Rp ${(val / 1000000000).toFixed(2)} Miliar`;
  }
  if (val >= 1000000) {
    return `Rp ${(val / 1000000).toFixed(1)} Juta`;
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val);
};

// Pricing standards basis (in IDR)
const PRICING_STANDARDS = [
  { item: 'Google Gemini 1.5 Flash (Input)', rate: 'Rp 1.200', unit: 'per 1.000.000 tokens', category: 'LLM Token', desc: 'Sangat hemat untuk ekstraksi data masal dan pencocokan teks terstruktur.' },
  { item: 'Google Gemini 1.5 Flash (Output)', rate: 'Rp 4.800', unit: 'per 1.000.000 tokens', category: 'LLM Token', desc: 'Digunakan untuk menyusun format jawaban JSON atau draf jurnal akun.' },
  { item: 'Google Gemini 1.5 Pro (Input)', rate: 'Rp 20.000', unit: 'per 1.000.000 tokens', category: 'LLM Token', desc: 'Ideal untuk analisis finansial mendalam dan penaksiran tren likuiditas.' },
  { item: 'Google Gemini 1.5 Pro (Output)', rate: 'Rp 80.000', unit: 'per 1.000.000 tokens', category: 'LLM Token', desc: 'Digunakan untuk menyusun komentar varians CAPEX dan narasi rekomendasi CFO.' },
  { item: 'Jasa SMS OTP (Gateway Indonesia)', rate: 'Rp 350', unit: 'per sukses transaksi', category: 'Keamanan / Otentikasi', desc: 'Verifikasi keamanan dua langkah (MFA) bagi supervisor sebelum persetujuan.' },
  { item: 'WhatsApp Business API Gateway', rate: 'Rp 450', unit: 'per sesi notifikasi', category: 'Keamanan / Otentikasi', desc: 'Mengirimkan alert verifikasi instan atau draf anomali ke manajer operasional.' },
  { item: 'Make.com Workflow Scheduler', rate: 'Rp 144.000', unit: 'per bulan (Standard)', category: 'Orkestrasi', desc: 'Mengatur cron-job berkala, webhook trigger, dan sinkronisasi antar-sistem.' },
  { item: 'Secure OCR Cloud (PDF.co)', rate: 'Rp 784.000', unit: 'per bulan', category: 'Ekstraksi Dokumen', desc: 'Mendigitalkan kuitansi, klaim medis, atau cetakan invoice beresolusi rendah.' },
  { item: 'RPA Unattended Runner Runtime', rate: 'Rp 1.600.000', unit: 'per bulan', category: 'Otomasi Desktop', desc: 'Melakukan klik otomatis pada portal DJP PPN atau portal e-Claim BPJS.' },
];

const BASE_ENGINES = [
  {
    id: 'engine-claims',
    title: 'AI Claims & Billing Settlement Engine',
    icon: Users,
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
      annualSavings: formatIDR(toIDR(45000)), // dynamic and structured
      payback: '2 Bulan',
    },
    specifications: [
      'Konektivitas otomatis ke database lokal HIS (Fetch aktivitas & diagnosa pasien).',
      'Validasi kepatuhan tarif INA-CBG menggunakan LLM berbasis prompt ruleset.',
      'Antarmuka khusus supervisor untuk menyetujui draf honorarium dokter.',
      'Postingan otomatis voucher piutang ke Microsoft Dynamics 365 ERP via REST API.'
    ]
  },
  {
    id: 'engine-ap',
    title: 'Intelligent Invoice & AP Automation Engine',
    icon: Receipt,
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
      'Pembuatan voucher draf AP di D365 ERP secara real-time.'
    ]
  },
  {
    id: 'engine-treasury',
    title: 'Treasury & Cash Operations Engine',
    icon: Landmark,
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
      'Rekomendasi alokasi likuiditas harian otomatis yang draf-nya dikirim via WhatsApp Secure.'
    ]
  },
  {
    id: 'engine-tax',
    title: 'Tax Compliance Automation Engine',
    icon: HardDrive,
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
      'Pembuatan berkas e-SPT Masa PPN siap lapor secara otomatis.'
    ]
  }
];

interface PRDHubProps {
  processes: Process[];
  isAdmin?: boolean;
}

export default function PRDHub({ processes, isAdmin }: PRDHubProps) {
  const [engines, setEngines] = useState(BASE_ENGINES);
  const [activeEngine, setActiveEngine] = useState<string>('engine-claims');
  const [activeSubTab, setActiveSubTab] = useState<'prd' | 'pricing'>('prd');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  
  const [deletingEngine, setDeletingEngine] = useState<typeof BASE_ENGINES[0] | null>(null);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setRefreshSuccess(false);

    setTimeout(() => {
      // Find processes that are not currently mapped in any BASE_ENGINES
      const mappedProcessTitles = new Set(
        BASE_ENGINES.flatMap(e => e.overlappingProcesses)
      );
      
      const unmappedProcesses = processes.filter(p => !mappedProcessTitles.has(p.title) && p.title.trim() !== '');

      if (unmappedProcesses.length > 0) {
        const newEngine = {
          id: 'engine-dynamic-' + Date.now(),
          title: 'Custom AI Orchestration Engine',
          icon: Sparkles,
          description: 'Auto-compiled orchestration engine derived from recently added organizational processes.',
          targetAudience: 'Cross-functional Operations',
          masterUsers: 'Process Owners, Analysts',
          ecosystemApps: 'Internal API Gateway, Cloud Storage, ERP modules',
          overlappingProcesses: unmappedProcesses.map(p => p.title),
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
            'Automated alerting and report generation.'
          ]
        };
        setEngines([...BASE_ENGINES, newEngine]);
      } else {
        setEngines(BASE_ENGINES);
      }

      setIsRefreshing(false);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
    }, 1200);
  };

  const handleExportPRD = (engineId: string) => {
    const eng = engines.find(e => e.id === engineId);
    if (!eng) return;

    const prdContent = `
PRODUCT REQUIREMENT DOCUMENTATION (PRD) - CONSOLIDATED ENGINE
============================================================
Engine Name: ${eng.title}
Status: Proposed / Blueprint Validated
Target Audience: ${eng.targetAudience}
Master Users & Personas: ${eng.masterUsers}

1. EXECUTIVE SUMMARY & OVERVIEW
----------------------------------
${eng.description}

2. OVERLAPPING PROCESS CATALOGUE
----------------------------------
This engine consolidates and eliminates functional redundancy for:
${eng.overlappingProcesses.map(p => `- ${p}`).join('\n')}

3. EXISTING APP ECOSYSTEM & INTEGRATIONS
----------------------------------
- Mapped Integrations: ${eng.ecosystemApps}

4. CAPEX & OPEX COSTING LOGIC
----------------------------------
- CAPEX Logic: ${eng.capexLogic}
- OPEX Logic: ${eng.opexLogic}

5. UNIT PRICING STANDARD (IDR BASIS)
----------------------------------
Google Gemini 1.5 Flash Input: Rp 1.200 / million tokens
Google Gemini 1.5 Flash Output: Rp 4.800 / million tokens
Jasa SMS OTP Gateway: Rp 350 / transaction
WhatsApp Notification Session: Rp 450 / session
Make.com Scheduler: Rp 144.000 / month

6. FINANCIAL & OPERATIONAL TARGETS
----------------------------------
- Transactional Scale: ${eng.metrics.volume}
- Operational Effort Release: ${eng.metrics.effort}
- Dynamic Annual Savings Estimate: ${eng.metrics.annualSavings}
- Break-Even Payback Period: ${eng.metrics.payback}
    `;

    const blob = new Blob([prdContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PRD_Siloam_${eng.title.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentEngine = engines.find(e => e.id === activeEngine) || engines[0];

  return (
    <div className="space-y-6 animate-fade-up" id="prd-hub-view">
      {/* Introduction Card */}
      <div className="bg-white border border-line rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ink text-citron grid place-items-center">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">Consolidated PRD &amp; Engine Hub</h2>
              <p className="text-xs text-mute mt-0.5">Automated overlap analysis across processes with unified backend architectures, costing rules, and Indonesian standard pricing.</p>
            </div>
          </div>
          
          {refreshSuccess ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-xs font-semibold animate-fade-in">
              <CheckCircle size={14} />
              <span>Synced!</span>
            </div>
          ) : (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-outline flex items-center gap-1.5 !px-3 !py-1.5 !text-xs cursor-pointer hover:bg-canvas transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync New Processes'}</span>
            </button>
          )}
        </div>

        {/* View togglers */}
        <div className="flex border-b border-line gap-4 pt-1 text-xs print:hidden">
          <button
            onClick={() => setActiveSubTab('prd')}
            className={`pb-2.5 font-semibold transition-all relative cursor-pointer ${
              activeSubTab === 'prd' ? 'text-ink' : 'text-faint hover:text-mute'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileText size={14} />
              <span>Engine Blueprints &amp; PRD</span>
            </div>
            {activeSubTab === 'prd' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-ink" />}
          </button>
          <button
            onClick={() => setActiveSubTab('pricing')}
            className={`pb-2.5 font-semibold transition-all relative cursor-pointer ${
              activeSubTab === 'pricing' ? 'text-ink' : 'text-faint hover:text-mute'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Table size={14} />
              <span>Standard Indonesia Price Sheet</span>
            </div>
            {activeSubTab === 'pricing' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-ink" />}
          </button>
        </div>
      </div>

      {activeSubTab === 'prd' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar Engines List */}
          <div className="lg:col-span-4 space-y-3 print:hidden">
            <span className="text-[10px] font-bold text-mute tracking-wider uppercase px-1">Unified Architectures</span>
            <div className="space-y-2">
              {engines.map((e) => {
                const IconComp = e.icon;
                const isSelected = e.id === activeEngine;
                return (
                  <button
                    key={e.id}
                    onClick={() => setActiveEngine(e.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-3 ${
                      isSelected
                        ? 'bg-ink border-ink text-white shadow-lift'
                        : 'bg-white border-line hover:border-ink/40 text-ink'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                      isSelected ? 'bg-citron text-ink' : 'bg-veil text-ink'
                    }`}>
                      <IconComp size={15} />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-xs font-bold truncate">{e.title}</h4>
                      <p className={`text-[10px] line-clamp-1 ${isSelected ? 'text-mute' : 'text-faint'}`}>{e.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4.5 bg-emerald-50 border border-emerald-100 rounded-2xl space-y-2.5">
              <span className="text-[10px] font-bold text-emerald-800 tracking-wider uppercase block">Overlap Analytics Summary</span>
              <p className="text-[11px] text-emerald-900 leading-relaxed">
                By grouping these <strong className="text-emerald-900">7 individual process mappings</strong> into <strong className="text-emerald-900">4 core backend automation engines</strong>, Siloam Finance Directorate avoids redundant software licenses, streamlines supervisor gate reviews, and achieves a unified, cohesive application ecosystem.
              </p>
            </div>
          </div>

          {/* Engine PRD Details Sheet */}
          {currentEngine ? (
          <div className="lg:col-span-8 bg-white border border-line rounded-3xl p-6 shadow-sm space-y-6 print:col-span-12 print:border-none print:shadow-none print:p-0">
            <div className="flex justify-between items-start gap-4 flex-wrap pb-4 border-b border-line">
              <div className="space-y-1">
                <span className="chip bg-citron-soft border-transparent text-citron-deep">PRD (Product Requirement Documentation)</span>
                <h3 className="font-display text-xl font-bold text-ink">{currentEngine.title}</h3>
                <p className="text-xs text-mute">{currentEngine.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setDeletingEngine(currentEngine);
                    }}
                    className="btn-outline flex items-center gap-1.5 !text-xs !py-2 !px-4 shrink-0 cursor-pointer print:hidden text-rose-500 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                    title="Erase Architecture"
                  >
                    <X size={13} /> Erase
                  </button>
                )}
                <button
                  onClick={() => handleExportPRD(currentEngine.id)}
                  className="btn-dark flex items-center gap-1.5 !text-xs !py-2 !px-4 shrink-0 cursor-pointer print:hidden"
                >
                  <Download size={13} /> Export PRD File
                </button>
              </div>
            </div>

            {/* Core Section: Target Audience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:break-inside-avoid">
              <div className="border border-line/60 rounded-2xl p-4 space-y-1 bg-canvas-soft">
                <span className="text-[9px] uppercase tracking-wider text-mute font-bold block">Target Audience &amp; CFO Viewers</span>
                <p className="text-xs font-semibold text-ink leading-tight">{currentEngine.targetAudience}</p>
              </div>
              <div className="border border-line/60 rounded-2xl p-4 space-y-1 bg-canvas-soft">
                <span className="text-[9px] uppercase tracking-wider text-mute font-bold block">Master Users / Executors</span>
                <p className="text-xs font-semibold text-ink leading-tight">{currentEngine.masterUsers}</p>
              </div>
            </div>

            {/* Connected Systems */}
            <div className="space-y-2 print:break-inside-avoid">
              <span className="text-[10px] font-bold text-mute tracking-wider uppercase">Connected Application Ecosystem</span>
              <div className="p-4 border border-line rounded-2xl bg-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 grid place-items-center shrink-0">
                  <Landmark size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink leading-normal">{currentEngine.ecosystemApps}</p>
                  <p className="text-[10px] text-faint mt-0.5">Fully mapped API schemas and user authentication flows.</p>
                </div>
              </div>
            </div>

            {/* Overlapping processes */}
            <div className="space-y-2 print:break-inside-avoid">
              <span className="text-[10px] font-bold text-mute tracking-wider uppercase">Consolidated Catalog Processes (Eliminating Redundancy)</span>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {currentEngine.overlappingProcesses.map((p) => (
                  <div key={p} className="p-3 bg-canvas-soft border border-line/55 rounded-xl flex items-center gap-2">
                    <CheckCircle size={13} className="text-emerald-600 shrink-0" />
                    <span className="text-xs font-medium text-ink truncate">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Costing Logic */}
            <div className="space-y-3.5 pt-2 border-t border-line/60 print:break-inside-avoid">
              <span className="text-[10px] font-bold text-mute tracking-wider uppercase block">Costing Logic per Engine</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-ink-soft block">CAPEX Logic (Development / Setup)</span>
                  <p className="text-[11px] text-mute leading-relaxed">{currentEngine.capexLogic}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-bold text-emerald-800 block">OPEX Logic (Ongoing / Subscriptions)</span>
                  <p className="text-[11px] text-mute leading-relaxed">{currentEngine.opexLogic}</p>
                </div>
              </div>
            </div>

            {/* Functional Specifications */}
            <div className="space-y-2.5 pt-2 border-t border-line/60 print:break-inside-avoid">
              <span className="text-[10px] font-bold text-mute tracking-wider uppercase block">Functional Specifications</span>
              <ul className="space-y-2 text-[11px] text-mute pl-1">
                {currentEngine.specifications.map((spec, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-ink font-bold shrink-0">{i + 1}.</span>
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ROI targets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-4 border-t border-line bg-canvas-soft/40 -mx-6 -mb-6 p-6 rounded-b-3xl print:break-inside-avoid print:mx-0 print:mb-0 print:border-line print:rounded-2xl">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-mute font-bold block">Transactional Scale</span>
                <span className="text-xs font-bold text-ink block leading-snug">{currentEngine.metrics.volume}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-mute font-bold block">Effort Released</span>
                <span className="text-xs font-bold text-ink block leading-snug">{currentEngine.metrics.effort}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-emerald-800 font-bold block">Est. Annual Savings</span>
                <span className="text-xs font-bold text-emerald-700 block leading-snug">{currentEngine.metrics.annualSavings}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase tracking-wider text-mute font-bold block">Break-Even Period</span>
                <span className="text-xs font-bold text-ink block leading-snug">{currentEngine.metrics.payback}</span>
              </div>
            </div>
          </div>
          ) : (
            <div className="lg:col-span-8 bg-white border border-line rounded-3xl p-12 shadow-sm flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 bg-canvas rounded-full flex items-center justify-center text-mute mb-2">
                <Layers size={20} />
              </div>
              <h4 className="font-semibold text-ink">No Architectures Found</h4>
              <p className="text-xs text-mute max-w-sm">There are no unified architectures available. You can click 'Sync New Processes' to generate architectures based on documented workflows.</p>
            </div>
          )}
        </div>
      ) : (
        /* Standard Indonesia Unit Price Sheet */
        <div className="bg-white border border-line rounded-3xl p-6 shadow-sm space-y-5 animate-fade-up">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <h3 className="font-display text-xl font-bold">Standard Indonesia Unit Price Sheet</h3>
              <p className="text-xs text-mute mt-0.5">Grounding AI &amp; RPA costing logic in standard local vendor billing rates and Gemini token cost models (RAG Cost Basis).</p>
            </div>
          </div>

          <div className="border border-line rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-ink text-white border-b border-line">
                  <th className="p-3.5 font-semibold">Nama Item Layanan</th>
                  <th className="p-3.5 font-semibold">Kategori</th>
                  <th className="p-3.5 font-semibold">Harga Satuan (IDR)</th>
                  <th className="p-3.5 font-semibold">Satuan Pengukuran (UoM)</th>
                  <th className="p-3.5 font-semibold">Fungsi &amp; Kegunaan Teknis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 bg-white">
                {PRICING_STANDARDS.map((p, index) => (
                  <tr key={index} className="hover:bg-canvas-soft/40 transition-colors">
                    <td className="p-3.5 font-bold text-ink leading-tight">{p.item}</td>
                    <td className="p-3.5">
                      <span className={`chip text-[10px] font-semibold ${
                        p.category.includes('LLM') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        p.category.includes('Keamanan') ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-canvas text-mute border-line'
                      }`}>{p.category}</span>
                    </td>
                    <td className="p-3.5 font-mono text-ink font-semibold">{p.rate}</td>
                    <td className="p-3.5 text-mute font-semibold">{p.unit}</td>
                    <td className="p-3.5 text-mute leading-relaxed max-w-xs">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-teal-50 border border-teal-100 rounded-2xl space-y-1 text-xs">
            <span className="font-bold text-teal-800 block">Bagaimana Cara Kerja Costing Model Ini?</span>
            <p className="text-teal-900 leading-relaxed">
              Kami memisahkan beban Capex (satu kali pengerjaan pengembangan sistem / set up integration) dengan beban Opex (biaya berjalan bulanan). OPEX kami murni berbasis konsumsi (consumption-based) menggunakan API Key Server-Side. Untuk orkestrasi, Make.com bertindak sebagai integrator visual yang menghubungkan service account Anda.
            </p>
          </div>
        </div>
      )}

      {/* Delete Architecture Confirm Modal */}
      {deletingEngine && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white border border-line rounded-3xl p-6 shadow-2xl w-full max-w-sm animate-fade-up space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 grid place-items-center mx-auto mb-2">
              <X size={24} />
            </div>
            <h3 className="font-display font-semibold text-lg text-ink">Erase Architecture?</h3>
            <p className="text-sm text-mute">
              Are you sure you want to completely delete the architecture <span className="font-semibold text-ink">"{deletingEngine.title}"</span>? This action cannot be undone.
            </p>
            
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => setDeletingEngine(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-mute hover:bg-canvas transition-colors cursor-pointer w-full"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const newEngines = engines.filter(e => e.id !== deletingEngine.id);
                  setEngines(newEngines);
                  if (newEngines.length > 0) setActiveEngine(newEngines[0].id);
                  setDeletingEngine(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-500 text-white hover:bg-rose-600 transition-colors cursor-pointer w-full"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
