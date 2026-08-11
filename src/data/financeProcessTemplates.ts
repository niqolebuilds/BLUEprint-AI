/**
 * Selectable "finance process" presets for the ROI/TCO engine.
 *
 * These are CONFIG, not code paths — the engine (src/lib/roiTcoEngine.ts)
 * only ever reads doc type / volume / complexity fields off whichever
 * template (or custom edit) the user picks. Adding a 6th process here needs
 * no engine changes — see the "config-only" test in roiTcoEngine.test.ts.
 *
 * Scope: GROUP FINANCE / shared-services processes only. Deliberately no
 * INA-CBG, BPJS, or clinical-claim logic anywhere in this file or the engine.
 */

import { SubFunction } from '../types';

export type FinanceDocType =
  | 'ap_invoice'
  | 'reconciliation_item'
  | 'journal_support_doc'
  | 'management_report'
  | 'tax_compliance_doc'
  | 'other';

export interface FinanceProcessTemplate {
  key: string;
  label: string;
  docType: FinanceDocType;
  description: string;
  /** Existing catalogue lines of work this template is typically filed under — used only to auto-suggest a template when a process is opened, never to gate it. */
  suggestedSubFunctions: SubFunction[];

  // Volume / document shape defaults — all editable in the panel.
  defaultPagesPerDoc: number;
  defaultPassesPerDoc: number; // e.g. 2 = extract pass + validate pass
  visionRequired: boolean; // true = source docs are scans/PDFs, not clean text exports

  // Inference sizing defaults (tokens)
  defaultPromptOverheadTokens: number;
  defaultFewShotTokens: number;
  defaultTokensPerPage: number;
  defaultOutputTokensPerDoc: number;
  defaultRetryRate: number; // 0-1

  // Human-in-the-loop defaults
  defaultReviewMinutesPerDoc: number;
  defaultReviewSharePct: number; // 0-1, share of docs sampled/reviewed by a human

  // Quality / value defaults
  defaultAccuracyRate: number; // 0-1
  defaultCostPerErrorIDR: number;
}

export const FINANCE_PROCESS_TEMPLATES: FinanceProcessTemplate[] = [
  {
    key: 'ap_invoice_processing',
    label: 'AP invoice processing across multiple entities',
    docType: 'ap_invoice',
    description:
      'Multi-entity vendor invoice intake, 3-way match against PO/GRN, and posting-ready coding for AP.',
    suggestedSubFunctions: ['Procurement', 'Transactional Accounting', 'Account Receivable'],
    defaultPagesPerDoc: 2,
    defaultPassesPerDoc: 2, // extract line items, then validate against PO/GRN
    visionRequired: true, // vendor invoices arrive as scans/PDFs
    defaultPromptOverheadTokens: 900,
    defaultFewShotTokens: 600,
    defaultTokensPerPage: 700,
    defaultOutputTokensPerDoc: 350,
    defaultRetryRate: 0.06,
    defaultReviewMinutesPerDoc: 3,
    defaultReviewSharePct: 0.25, // sample-review; low-confidence/high-value invoices routed 100%
    defaultAccuracyRate: 0.96,
    defaultCostPerErrorIDR: 150000, // rework + potential duplicate/late-payment risk
  },
  {
    key: 'intercompany_reconciliation',
    label: 'Intercompany reconciliation',
    docType: 'reconciliation_item',
    description:
      'Matching intercompany balances/transactions across entity ledgers and flagging breaks for resolution.',
    suggestedSubFunctions: ['Financial Controller', 'Transactional Accounting', 'System Accountant'],
    defaultPagesPerDoc: 1, // typically structured export rows, not scanned docs
    defaultPassesPerDoc: 2, // match pass + break-classification pass
    visionRequired: false,
    defaultPromptOverheadTokens: 850,
    defaultFewShotTokens: 500,
    defaultTokensPerPage: 350,
    defaultOutputTokensPerDoc: 300,
    defaultRetryRate: 0.04,
    defaultReviewMinutesPerDoc: 5, // breaks need more judgment than clean matches
    defaultReviewSharePct: 0.35,
    defaultAccuracyRate: 0.95,
    defaultCostPerErrorIDR: 250000, // mis-eliminated IC balance can cascade into consolidation
  },
  {
    key: 'month_end_close_support',
    label: 'Month-end close support (accruals, JE support docs)',
    docType: 'journal_support_doc',
    description:
      'Drafting accrual calculations and journal-entry support packages ready for reviewer sign-off during close.',
    suggestedSubFunctions: ['System Accountant', 'Financial Controller', 'Transactional Accounting'],
    defaultPagesPerDoc: 3,
    defaultPassesPerDoc: 2, // draft calculation + supporting narrative
    visionRequired: false,
    defaultPromptOverheadTokens: 1000,
    defaultFewShotTokens: 700,
    defaultTokensPerPage: 500,
    defaultOutputTokensPerDoc: 450,
    defaultRetryRate: 0.05,
    defaultReviewMinutesPerDoc: 8, // close items always get reviewed, not sampled
    defaultReviewSharePct: 1.0,
    defaultAccuracyRate: 0.94,
    defaultCostPerErrorIDR: 400000, // restatement/close-delay risk is the highest of the five
  },
  {
    key: 'management_report_generation',
    label: 'Financial / management report generation',
    docType: 'management_report',
    description:
      'Compiling variance commentary and management report drafts from ERP/BI extracts ahead of CFO review.',
    suggestedSubFunctions: ['Management Reporting', 'Management Report', 'Financial Analysis', 'Power BI Data Control'],
    defaultPagesPerDoc: 6,
    defaultPassesPerDoc: 1,
    visionRequired: false,
    defaultPromptOverheadTokens: 1200,
    defaultFewShotTokens: 900,
    defaultTokensPerPage: 450,
    defaultOutputTokensPerDoc: 900, // narrative commentary output is larger
    defaultRetryRate: 0.03,
    defaultReviewMinutesPerDoc: 12,
    defaultReviewSharePct: 1.0, // reports always get reviewed before circulation
    defaultAccuracyRate: 0.93,
    defaultCostPerErrorIDR: 300000, // wrong commentary reaching CFO/board is a real cost
  },
  {
    key: 'tax_compliance_docs',
    label: 'Tax & compliance document processing',
    docType: 'tax_compliance_doc',
    description:
      'Structuring source documents (e-Faktur, withholding slips) into filing-ready data for tax submissions.',
    suggestedSubFunctions: ['Tax Management', 'Financial Controller'],
    defaultPagesPerDoc: 2,
    defaultPassesPerDoc: 2,
    visionRequired: true,
    defaultPromptOverheadTokens: 950,
    defaultFewShotTokens: 650,
    defaultTokensPerPage: 650,
    defaultOutputTokensPerDoc: 320,
    defaultRetryRate: 0.05,
    defaultReviewMinutesPerDoc: 6,
    defaultReviewSharePct: 0.5,
    defaultAccuracyRate: 0.97, // tax fields are highly structured, so accuracy runs higher
    defaultCostPerErrorIDR: 500000, // penalty/interest exposure on filing errors
  },
];

export function suggestTemplateForSubFunction(subFunction: string): FinanceProcessTemplate {
  const match = FINANCE_PROCESS_TEMPLATES.find((t) =>
    t.suggestedSubFunctions.some((sf) => sf.toLowerCase() === subFunction.toLowerCase())
  );
  return match ?? FINANCE_PROCESS_TEMPLATES[0];
}
