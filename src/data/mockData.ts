import { Process, User, SubFunction, ImprovementItem, SystemItem, UserNotification, NotificationLog } from '../types';

export const MOCK_USERS: User[] = [
  {
    id: 'user-cfo',
    name: 'Roy Widya, MBA',
    email: 'roy.widya@siloam.com',
    level: 'L1',
    subFunction: 'All',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Roy'
  },
  {
    id: 'user-cfo-1-fp',
    name: 'Aris Wijaya',
    email: 'aris.wijaya@siloam.com',
    level: 'L2',
    subFunction: 'Financial Planning and Corporate Analysis',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aris'
  },
  {
    id: 'user-cfo-1-acc',
    name: 'Lisa Natalia',
    email: 'lisa.natalia@siloam.com',
    level: 'L2',
    subFunction: 'Transactional Accounting',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lisa'
  },
  {
    id: 'user-cfo-2-tax',
    name: 'Dewi Kartika',
    email: 'dewi.kartika@siloam.com',
    level: 'L3',
    subFunction: 'Tax Management',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DewiK'
  },
  {
    id: 'user-cfo-2-bill',
    name: 'Agus Salim',
    email: 'agus.salim@siloam.com',
    level: 'L3',
    subFunction: 'Account Receivable',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Agus'
  },
  {
    id: 'user-cfo-3-ar',
    name: 'Budi Santoso',
    email: 'budi.santoso@siloam.com',
    level: 'L4',
    subFunction: 'Account Receivable',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Budi'
  },
  {
    id: 'user-cfo-3-ap',
    name: 'Siti Rahma',
    email: 'siti.rahma@siloam.com',
    level: 'L4',
    subFunction: 'Procurement',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Siti'
  },
  {
    id: 'user-cfo-3-tax',
    name: 'Dewi Pratama',
    email: 'dewi.pratama@siloam.com',
    level: 'L4',
    subFunction: 'Tax Management',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DewiP'
  },
  {
    id: 'user-cfo-3-fpa',
    name: 'Anwar Hakim',
    email: 'anwar.hakim@siloam.com',
    level: 'L4',
    subFunction: 'Financial Planning and Corporate Analysis',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Anwar'
  },
  {
    id: 'user-admin',
    name: 'Jessica Tan',
    email: 'jessica.tan@siloam.com',
    level: 'Admin',
    subFunction: 'All',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jessica'
  }
];

// Canonical System Used Map — keep in sync with SYSTEM_MAP in server.ts.
export const MOCK_SYSTEMS: SystemItem[] = [
  {
    id: 'sys-kairos',
    name: 'KAIROS (Hospital Information System)',
    category: 'Clinical Data Layer',
    processCount: 4,
    description: 'Main hospital database containing patient registration, billing transactions, medical procedures, and electronic health records. Has a legacy SOAP API but mostly accessed via web UI.',
  },
  {
    id: 'sys-emr',
    name: 'EMR (Electronic Medical Record)',
    category: 'Clinical Data Layer',
    processCount: 2,
    description: 'Stores digital charts, doctor prescription notes, lab test orders, and diagnostic results. Primarily secure clinical read-only database with HL7 FHIR integrations.',
  },
  {
    id: 'sys-d365',
    name: 'Microsoft Dynamics 365 (ERP)',
    category: 'Enterprise Resource Planning (Financial Core)',
    processCount: 6,
    description: 'Core ERP financial ledger, general ledger accounting, accounts payable/receivable, inventory management. Supports standard REST APIs, Power Automate flows, and Webhooks.',
  },
  {
    id: 'sys-pr',
    name: 'Purchase Request (PR) & Vendor Portal',
    category: 'Procurement E-System',
    processCount: 2,
    description: 'Custom web tool used for raising purchasing requests, routing multi-stage manager approvals, and managing external vendor bids and purchase orders.',
  },
  {
    id: 'sys-djp',
    name: 'DJP Online e-Faktur',
    category: 'Tax Compliance Portal',
    processCount: 3,
    description: 'Government tax compliance portal for uploading tax invoices, downloading monthly withholding tax statements, and filing VAT returns. Extremely rules-bound XML formats.',
  },
  {
    id: 'sys-bpjs',
    name: 'BPJS e-Claim Portal',
    category: 'Insurance / Reinsurance Portal',
    processCount: 2,
    description: 'National insurance claim submission portal. Highly repetitive multi-step PDF uploads and manual eligibility checks. Requires manual CAPTCHA and has no official API.',
  },
  {
    id: 'sys-cimb',
    name: 'CIMB Niaga Cash Management',
    category: 'Corporate Banking Platform',
    processCount: 3,
    description: 'Corporate banking system for executing bulk vendor wire transfers, checking current cash balances, and pulling daily bank statement files (MT940/CSV). Supports host-to-host SFTP.',
  },
  {
    id: 'sys-powerbi',
    name: 'Microsoft Power BI',
    category: 'Analytics & Presentation Layer',
    processCount: 5,
    description: 'Business intelligence dashboards for financial analysis, operational KPI reporting, and departmental spend breakdowns. Connects directly to ERP database views.',
  },
  {
    id: 'sys-excel',
    name: 'Microsoft Excel',
    category: 'Analytics & Presentation Layer',
    processCount: 8,
    description: 'Local spreadsheet manipulation used for data formatting, ad-hoc pivot tables, journal entry preparations, and manual reconciliation of discordant source exports.',
  },
  {
    id: 'sys-ppt',
    name: 'Microsoft PowerPoint',
    category: 'Analytics & Presentation Layer',
    processCount: 3,
    description: 'Presentation deck builder for monthly business reviews, board meetings, and executive summaries. High manual compilation effort.',
  },
];

export const MOCK_PROCESSES: Process[] = [
  {
    id: 'proc-ai-reconciliation',
    title: 'AI-as-a-Service Guide Reconciliation & Journaling',
    description: 'Automated retrieval and intelligent matching of unmapped bank transactions and ledger entries against the corporate accounting guide rules. Employs AI-as-a-Service APIs to classify entries, reconcile ledger deviations, and automatically draft structured General Ledger journal postings in D365 ERP.',
    subFunction: 'Transactional Accounting',
    ownerName: 'Nicole Celia',
    ownerEmail: 'nicolecelia.work@gmail.com',
    ownerLevel: 'L4',
    status: 'Approved',
    lastUpdated: '2026-07-14T03:00:00Z',
    completenessScore: 100,
    gaps: [],
    isShared: true,
    taggedUsers: ['budi.santoso@siloam.com', 'siti.rahma@siloam.com'],
    effortRating: 4,
    repetitivenessRating: 5,
    volumeRating: 5,
    errorSensitivityRating: 3,
    automationSuitability: 95,
    steps: [
      {
        id: 'proc-ai-reconciliation-step-1',
        order: 1,
        name: 'Retrieve unmapped transaction files',
        description: 'Download daily raw bank statements, bank ledger advice files, and suspense account logs from CIMB Niaga Cash Management portal to identify outstanding unmatched transactions.',
        inputs: ['Bank statement file (.CSV)', 'CIMB Niaga daily ledger advice'],
        outputs: ['Suspense items ledger report'],
        decisionPoints: ['Are all statement balance totals matched with CIMB dashboard summaries?'],
        systems: ['CIMB Niaga Cash Management', 'Microsoft Excel'],
        handOffs: ['If transaction data is corrupt, request CIMB technical support.'],
        aiClassification: 'automation',
        aiRationale: 'Routine data retrieval, file downloading, and opening standard ledger spreadsheets. Highly procedural.'
      },
      {
        id: 'proc-ai-reconciliation-step-2',
        order: 2,
        name: 'AI-as-a-Service Guide matching and account proposal',
        description: 'Run the suspense entries through the AI-as-a-Service endpoint. Gemini analyzes the description, invoice references, and payee details against the corporate Accounting Guide rules to propose the appropriate cost center, debit ledger, and credit ledger accounts.',
        inputs: ['Suspense items ledger report', 'Corporate Accounting Guide (PDF)'],
        outputs: ['AI proposed ledger maps (.JSON)'],
        decisionPoints: ['Does the AI classification confidence score exceed 85%?'],
        systems: ['Microsoft Dynamics 365 (ERP)', 'Microsoft Excel'],
        handOffs: ['If confidence score is below 85%, route to General Ledger Analyst for manual review.'],
        aiClassification: 'agentic-ai',
        aiRationale: 'Intelligently mapping unstructured bank narration texts onto complex corporate chart of accounts by reading and reasoning with pdf instructions. High-cognitive reasoning.'
      },
      {
        id: 'proc-ai-reconciliation-step-3',
        order: 3,
        name: 'Verify ledger alignment and resolve exceptions',
        description: 'Validate proposed matches against historical postings and ledger balances. Correct any false classifications and enrich missing transaction identifiers or voucher codes.',
        inputs: ['AI proposed ledger maps (.JSON)', 'Historical GL ledger logs'],
        outputs: ['Validated GL journal draft'],
        decisionPoints: ['Are there unresolved anomalies or mismatched currencies?'],
        systems: ['Microsoft Dynamics 365 (ERP)', 'Microsoft Excel'],
        handOffs: ['Escalate unresolved accounting exceptions exceeding $10,000 to the Accounting Manager.'],
        aiClassification: 'agentic-ai',
        aiRationale: 'Resolving edge-case ledger disputes and currency mismatch anomalies requires contextual understanding of historical vendor behaviors and tax rules.'
      },
      {
        id: 'proc-ai-reconciliation-step-4',
        order: 4,
        name: 'Draft and post GL journal batch',
        description: 'Compile the validated ledger records into general ledger journal templates and transmit the data to Microsoft Dynamics 365. Execute batch postings to lock the journal records in the general ledger.',
        inputs: ['Validated GL journal draft'],
        outputs: ['Posted GL Journal Voucher receipt', 'Updated general ledger balance sheet'],
        decisionPoints: ['Did Microsoft Dynamics 365 throw posting validation errors?'],
        systems: ['Microsoft Dynamics 365 (ERP)'],
        handOffs: ['Submit posted journal logs and system receipts to Treasury Team.'],
        aiClassification: 'automation',
        aiRationale: 'Automated entry and batch submission of structured journal fields into the core ERP via REST APIs or integration adapters.'
      }
    ]
  }
];

export const MOCK_NOTIFICATIONS: UserNotification[] = [];

export const MOCK_NOTIFICATION_LOGS: NotificationLog[] = [];

export const MOCK_IMPROVEMENT_ITEMS: ImprovementItem[] = [];

export const SUBFUNCTIONS_LIST: SubFunction[] = [
  'Procurement',
  'Financial Planning and Corporate Analysis',
  'System Accountant',
  'Power BI Data Control',
  'Financial Controller',
  'Tax Management',
  'Transactional Accounting',
  'Management Reporting',
  'Financial Analysis',
  'Management Report',
  'Account Receivable',
  'Corporate Finance',
  'Internal Audit',
  'Investment',
  'Revenue Assurance',
  'OPEX Optimisation',
  'CAPEX Control and Capital Investment',
  'Profitablity and Productivity',
];
