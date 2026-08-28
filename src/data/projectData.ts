import {
  ManagedProject,
  TeamMember,
  MeetingTranscript,
  MeetingNote,
  GanttTask,
  ProjectOKR,
} from '../types';

export const INITIAL_MANAGED_PROJECTS: ManagedProject[] = [
  {
    id: 'proj-bank-recon',
    title: 'Bank Reconciliation & Auto-GL Posting Engine',
    targetStatement: 'Automate end-to-end bank reconciliation & GL posting to cut month-end close by 3 days and eliminate Rp 1.2B in unposted variance.',
    linkedProcessId: 'proc-ai-reconciliation',
    linkedEngineTitle: 'AI-Powered Bank Statement & GL Reconciliation',
    ownerName: 'Nicole Celia',
    ownerEmail: 'nicolecelia.work@gmail.com',
    stage: '5: Tracked Execution',
    progressPercent: 68,
    targetDate: '2026-09-30',
    rice: {
      reach: 41, // finance staff across all Siloam hospital units touched by month-end close
      impact: 100_000_000, // Rp 100.000.000/mo in eliminated unposted variance + faster close
      impactUnit: 'IDR',
      confidence: 80,
      effort: 6, // person-weeks to complete remaining phases
    },
  },
];

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    projectId: 'proj-bank-recon',
    name: 'Nicole Celia',
    email: 'nicolecelia.work@gmail.com',
    role: 'Lead',
    addedBy: 'System',
  },
  {
    id: 'tm-2',
    projectId: 'proj-bank-recon',
    name: 'Hendra Wijaya',
    email: 'hendra.w@siloamhospitals.com',
    role: 'Contributor',
    addedBy: 'Nicole Celia',
  },
  {
    id: 'tm-3',
    projectId: 'proj-bank-recon',
    name: 'Anita Rahayu',
    email: 'anita.r@siloamhospitals.com',
    role: 'Stakeholder',
    addedBy: 'Nicole Celia',
  },
  {
    id: 'tm-4',
    projectId: 'proj-bank-recon',
    name: 'Budi Santoso',
    email: 'budi.s@siloamhospitals.com',
    role: 'Contributor',
    addedBy: 'Nicole Celia',
  },
];

export const INITIAL_TRANSCRIPTS: MeetingTranscript[] = [
  {
    id: 'tr-1',
    projectId: 'proj-bank-recon',
    date: '2026-07-21',
    title: 'Sprint 4 — Bank Matching Exception Rules',
    participants: ['Nicole Celia', 'Hendra Wijaya', 'Budi Santoso'],
    source: 'upload',
    rawText: `Sprint 4 Alignment — Bank Recon Automation
Date: July 21, 2026
Attendees: Nicole Celia (Lead), Hendra Wijaya (Contributor), Budi Santoso (Contributor)

Key discussion:
We reviewed 12 mismatched bank deposit entries from the CIMB host-to-host feed. Most mismatches occurred because hospital unit codes in payment memos contained slight variations (e.g., "SLM-TBG" vs "TBG-01").
Agreed: We decided to lower the fuzzy match score threshold from 0.92 to 0.85 for unit code aliases, and escalate unmapped codes to L3 unit manager within 24 hours.
Question: Will DJP e-Faktur tax numbers be included in CIMB bank statement memo fields by Q3? Hendra will confirm with bank gateway team.
Todo: Hendra Wijaya to update Python reconciliation alias dictionary by Aug 5 (email: hendra.w@siloamhospitals.com).
Todo: Budi Santoso to verify Dynamics 365 GL API OAuth permissions by Aug 2 (email: budi.s@siloamhospitals.com).`,
    fileName: 'cimb_sprint4_transcript.txt',
  },
];

export const INITIAL_MEETING_NOTES: MeetingNote[] = [
  {
    id: 'mn-1',
    projectId: 'proj-bank-recon',
    transcriptId: 'tr-1',
    summary: 'Reviewed 12 mismatched bank deposit entries from the CIMB host-to-host feed. Agreed to lower the fuzzy matching threshold for hospital unit code aliases to 0.85 and escalate unmapped hospital codes directly to L3 unit managers within 24 hours.',
    decisions: [
      'Lower fuzzy match score threshold to 0.85 for unit code aliases.',
      'Escalate unmapped hospital codes directly to L3 unit manager within 24 hours.',
    ],
    openQuestions: [
      'Will DJP e-Faktur tax numbers be included in CIMB bank statement memo fields by Q3?',
    ],
    actionItems: [
      {
        id: 'ai-1',
        meetingNoteId: 'mn-1',
        description: 'Configure unit code alias dictionary in Python reconciliation service',
        assigneeName: 'Hendra Wijaya',
        assigneeEmail: 'hendra.w@siloamhospitals.com',
        dueDate: '2026-08-05',
        status: 'sent',
      },
      {
        id: 'ai-2',
        meetingNoteId: 'mn-1',
        description: 'Verify Dynamics 365 GL API OAuth scope for automated batch posting',
        assigneeName: 'Budi Santoso',
        assigneeEmail: 'budi.s@siloamhospitals.com',
        dueDate: '2026-08-02',
        status: 'acknowledged',
      },
    ],
    isFinalized: true,
    createdAt: '2026-07-21T10:30:00Z',
  },
];

export const INITIAL_GANTT_TASKS: GanttTask[] = [
  // Project 1
  {
    id: 'gt-1',
    projectId: 'proj-bank-recon',
    label: 'Phase 1: CIMB & Mandiri API Handshake',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    progress: 100,
    owner: 'Nicole Celia',
    deliverableUrl: 'https://drive.google.com/drive/folders/cimb-mandiri-api-handshake',
    notes: 'Completed host-to-host API sandbox verification and OAuth key exchange.',
  },
  {
    id: 'gt-2',
    projectId: 'proj-bank-recon',
    label: 'Phase 2: Fuzzy Matching Engine & Unit Aliases',
    startDate: '2026-07-01',
    endDate: '2026-08-15',
    dependsOnId: 'gt-1',
    progress: 75,
    owner: 'Hendra Wijaya',
    deliverableUrl: 'https://github.com/siloam-finance/reconciliation-engine',
    notes: 'Configured Levenshtein 0.85 matching rules for hospital unit alias lookup.',
  },
  {
    id: 'gt-3',
    projectId: 'proj-bank-recon',
    label: 'Phase 3: Dynamics 365 Auto-GL Journal Posting',
    startDate: '2026-08-10',
    endDate: '2026-09-15',
    dependsOnId: 'gt-2',
    progress: 30,
    owner: 'Budi Santoso',
    deliverableUrl: 'https://siloam-internal.sharepoint.com/finance/d365-gl-specs',
    notes: 'Building automated journal voucher batch endpoint.',
  },
  {
    id: 'gt-4',
    projectId: 'proj-bank-recon',
    label: 'Phase 4: CFO Exception Dashboard & Realised Savings Signoff',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    dependsOnId: 'gt-3',
    progress: 0,
    owner: 'Nicole Celia',
    deliverableUrl: 'https://figma.com/file/cfo-recon-dashboard-spec',
    notes: 'Exception workflow UI mockup and CFO sign-off document.',
  },
];

export const INITIAL_PROJECT_OKRS: ProjectOKR[] = [
  {
    id: 'okr-1',
    projectId: 'proj-bank-recon',
    objective: 'Achieve zero-delay daily bank-to-GL reconciliation across all 41 Siloam hospital units.',
    parentOkrLabel: 'Contributes to: Make Finance Directorate an AI-native organization',
    keyResults: [
      { id: 'kr-1', label: 'Automated statement matching rate', current: 82, target: 95, unit: '%' },
      { id: 'kr-2', label: 'Month-end close reduction', current: 2, target: 3, unit: 'days' },
      { id: 'kr-3', label: 'Unreconciled bank variance', current: 24, target: 5, unit: 'items' },
    ],
  },
];
