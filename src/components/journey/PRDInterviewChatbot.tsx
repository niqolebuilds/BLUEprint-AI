import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Check, ChevronRight, MessageSquareCode } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
}

interface PRDData {
  targetUser: string;
  ecosystemApps: string;
  monthlyVolume: string;
  staffHours: string;
  errorRisk: string;
  verificationRequired: string;
  partnerships: string;
  customNotes: string;
}

const QUESTIONS = [
  {
    key: 'targetUser',
    question: 'Siapakah **Target User utama** (peran/jabatan staf) yang menjalankan proses manual ini sehari-hari?',
    placeholder: 'Contoh: AP Officer, Finance Admin, Tax Accountant, billing staff...'
  },
  {
    key: 'ecosystemApps',
    question: 'Apa saja **sistem, portal web, atau aplikasi existing** (e.g., Microsoft Dynamics 365 ERP, CIMB Niaga, DJP e-Faktur, HIS, atau Excel) yang wajib diakses dalam proses ini?',
    placeholder: 'Contoh: Dynamics 365, e-Faktur DJP, CIMB Cash Portal, Excel...'
  },
  {
    key: 'monthlyVolume',
    question: 'Berapa perkiraan **volume transaksi atau dokumen** (e.g., jumlah klaim BPJS, invoice vendor, atau SPT pajak) yang diproses dalam satu bulan?',
    placeholder: 'Contoh: 1.500 klaim per bulan, 500 invoices per bulan...'
  },
  {
    key: 'staffHours',
    question: 'Berapa banyak **orang** yang saat ini memproses ini, dan kira-kira **berapa jam** total waktu yang dihabiskan untuk proses ini dalam sebulan?',
    placeholder: 'Contoh: 2 orang, menghabiskan sekitar 80 jam sebulan...'
  },
  {
    key: 'errorRisk',
    question: 'Apa risiko terbesar jika terjadi kesalahan input manual? (Contoh: klaim ditolak BPJS, denda pajak PPN dari DJP, atau double payment vendor).',
    placeholder: 'Contoh: Terjadi denda keterlambatan e-Faktur, billing bocor/selisih...'
  },
  {
    key: 'verificationRequired',
    question: 'Dalam rancangan sistem baru, apakah diperlukan **Validation Gate (Persetujuan Supervisor/Manager)** sebelum AI langsung melakukan posting otomatis?',
    placeholder: 'Contoh: Ya, butuh supervisor approval untuk transaksi di atas Rp 10 juta...'
  },
  {
    key: 'partnerships',
    question: 'Apakah ada **departemen internal atau pihak eksternal** yang harus diajak bermitra? (Contoh: Tim IT Security, Tim BPJS Center, Vendor Bank Gateway).',
    placeholder: 'Contoh: IT Security & Network, Bank Niaga Portal Team...'
  },
  {
    key: 'customNotes',
    question: 'Ada catatan tambahan atau instruksi khusus lainnya untuk cetak biru sistem baru ini?',
    placeholder: 'Contoh: Harus support scan PDF OCR beresolusi rendah...'
  }
];

export default function PRDInterviewChatbot({
  processTitle,
  onConfirmPRD,
  onBack,
}: {
  processTitle: string;
  onConfirmPRD: (summaryText: string) => void;
  onBack: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Halo! Saya adalah **AI Systems Architect** pendamping Anda. Mari kita susun rancangan **Product Requirement Documentation (PRD)** yang matang untuk proses **"${processTitle}"** agar siap diotomatisasi secara komprehensif.

Pertama-tama, **siapakah Target User utama** (peran/jabatan staf) yang menjalankan proses manual ini sehari-hari?`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [prdData, setPrdData] = useState<PRDData>({
    targetUser: '',
    ecosystemApps: '',
    monthlyVolume: '',
    staffHours: '',
    errorRisk: '',
    verificationRequired: '',
    partnerships: '',
    customNotes: '',
  });
  const [showSummary, setShowSummary] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();
    const currentKey = QUESTIONS[currentStep].key;

    // Update PRD Data object
    setPrdData((prev) => ({
      ...prev,
      [currentKey]: userText,
    }));

    // Add user message
    const updatedMessages = [
      ...messages,
      { id: `user-${currentStep}`, sender: 'user' as const, text: userText }
    ];
    setMessages(updatedMessages);
    setInputValue('');

    const nextStep = currentStep + 1;
    if (nextStep < QUESTIONS.length) {
      setCurrentStep(nextStep);
      // Add bot's next question
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${nextStep}`,
            sender: 'bot',
            text: QUESTIONS[nextStep].question,
          }
        ]);
      }, 500);
    } else {
      // Completed all questions
      setTimeout(() => {
        setShowSummary(true);
      }, 600);
    }
  };

  const handleSkipAll = () => {
    // Skip remaining and show summary with whatever gathered
    setShowSummary(true);
  };

  const handleConfirm = () => {
    // Format gathered answers into a beautiful text payload for the Mining endpoint
    const summaryText = `
### PRODUCT REQUIREMENT DOCUMENTATION (PRD) SURVEY RESULTS
- **Process Title**: ${processTitle}
- **Target User Personas**: ${prdData.targetUser || 'Staf Operasional Keuangan / Finance Staff'}
- **Existing System Ecosystem**: ${prdData.ecosystemApps || 'Microsoft Excel, Microsoft Dynamics 365, internal finance logs'}
- **Estimated Monthly Transaction Volume**: ${prdData.monthlyVolume || 'Sekitar 100-1000 transaksi per bulan'}
- **Current Staff Labor & Effort**: ${prdData.staffHours || 'Menghabiskan sekitar 40-120 jam manual per bulan'}
- **Manual Input Error Risks & Cost Impact**: ${prdData.errorRisk || 'Kebocoran data, klaim ditolak, denda ketidakpatuhan, denda audit'}
- **Validation Gates Required**: ${prdData.verificationRequired || 'Ya, dibutuhkan supervisor approval gate sebelum posting otomatis'}
- **Key External/Internal Partnerships**: ${prdData.partnerships || 'Tim IT Infra, Bank Gateway, Vendor Integrasi Portal'}
- **Additional Functional Specifications**: ${prdData.customNotes || 'Otomasi end-to-end dengan verifikasi data real-time'}
    `.trim();

    onConfirmPRD(summaryText);
  };

  return (
    <div className="animate-fade-up max-w-2xl mx-auto">
      {!showSummary ? (
        <div className="bg-white border border-line rounded-3xl overflow-hidden shadow-lift flex flex-col h-[520px]">
          {/* Header */}
          <div className="bg-ink text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-citron text-ink grid place-items-center shrink-0">
                <MessageSquareCode size={16} />
              </div>
              <div>
                <h3 className="text-xs font-semibold">AI Architect: PRD Interview</h3>
                <p className="text-[10px] text-mute">Pertanyaan {currentStep + 1} dari {QUESTIONS.length} (Max 10 Turns)</p>
              </div>
            </div>
            <button
              onClick={handleSkipAll}
              className="text-[10px] bg-white/10 hover:bg-white/20 text-white font-medium py-1 px-2.5 rounded-full transition-all cursor-pointer"
              title="Skip remaining questions and generate the blueprint directly"
            >
              Skip &amp; Confirm PRD
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-canvas-soft">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[85%] ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
                    m.sender === 'user' ? 'bg-citron text-ink' : 'bg-ink text-white'
                  }`}
                >
                  {m.sender === 'user' ? <User size={13} /> : <Bot size={13} />}
                </div>
                <div
                  className={`rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-ink text-white rounded-tr-none'
                      : 'bg-white border border-line text-ink rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-line bg-white flex gap-2 items-center">
            <input
              type="text"
              className="field flex-1 !py-2.5 !px-4 text-xs !h-auto rounded-full"
              placeholder={QUESTIONS[currentStep]?.placeholder || 'Ketik jawaban Anda di sini...'}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="w-10 h-10 rounded-full bg-ink hover:bg-citron-deep text-white hover:text-ink disabled:bg-veil disabled:text-faint grid place-items-center cursor-pointer transition-all shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-3xl p-6 shadow-lift space-y-5 animate-fade-up">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center shrink-0 mt-0.5">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold tracking-tight">Review &amp; Confirm PRD Requirements</h3>
              <p className="text-xs text-mute mt-0.5">Konfirmasi ringkasan data di bawah ini sebelum Agent memproses cetak biru Anda.</p>
            </div>
          </div>

          <div className="border border-line/60 rounded-2xl overflow-hidden bg-canvas-soft divide-y divide-line/40 text-xs">
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span className="font-semibold text-mute">Target User Persona</span>
              <span className="sm:col-span-2 text-ink">{prdData.targetUser || <em className="text-faint">Default: Finance Operations Staff</em>}</span>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span className="font-semibold text-mute">Aplikasi Existing</span>
              <span className="sm:col-span-2 text-ink">{prdData.ecosystemApps || <em className="text-faint">Default: Excel, ERP, local portals</em>}</span>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1 text-ink">
              <span className="font-semibold text-mute">Estimasi Volume</span>
              <span className="sm:col-span-2">{prdData.monthlyVolume || <em className="text-faint">Default: 500-2,500 transactions/month</em>}</span>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span className="font-semibold text-mute">Beban Kerja Saat Ini</span>
              <span className="sm:col-span-2 text-ink">{prdData.staffHours || <em className="text-faint">Default: ~80 hours manual effort/month</em>}</span>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span className="font-semibold text-mute">Risiko Kesalahan Manual</span>
              <span className="sm:col-span-2 text-ink">{prdData.errorRisk || <em className="text-faint">Default: Claim denials, delays, accounting audit risks</em>}</span>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span className="font-semibold text-mute">Validation Gates</span>
              <span className="sm:col-span-2 text-ink">{prdData.verificationRequired || <em className="text-faint">Default: Supervisor confirmation required</em>}</span>
            </div>
            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span className="font-semibold text-mute">Kemitraan Departemen</span>
              <span className="sm:col-span-2 text-ink">{prdData.partnerships || <em className="text-faint">Default: IT Security & Vendor Gateway Teams</em>}</span>
            </div>
            {prdData.customNotes && (
              <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-1">
                <span className="font-semibold text-mute">Catatan Khusus</span>
                <span className="sm:col-span-2 text-ink">{prdData.customNotes}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => {
                setShowSummary(false);
                setCurrentStep(0);
                setMessages([
                  {
                    id: 'welcome',
                    sender: 'bot',
                    text: `Halo! Saya adalah **AI Systems Architect** pendamping Anda. Mari kita ulangi rancangan PRD ini agar lebih akurat.`
                  }
                ]);
              }}
              className="btn-ghost !py-2 !px-4 text-xs cursor-pointer"
            >
              Restart Chat
            </button>
            <button
              onClick={handleConfirm}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 !py-2 !px-5 text-xs rounded-full cursor-pointer transition-all shadow-md"
            >
              <Check size={13} /> Confirm &amp; Auto-Mine Process
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
