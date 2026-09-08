'use strict';

/**
 * Output profiles.
 *
 * The same hydrated spec produces two documents with different jobs:
 *
 *   full   — the contract annex. Everything: data entities, exception matrix,
 *            role/SoD table, documentation checklist, cutover steps. This is
 *            what Internal Audit and Legal read, and what gets attached to the
 *            signed agreement.
 *
 *   brief  — the quotation pack. What a vendor needs to price the work and what
 *            a sponsor needs to approve it. Roughly a third the length.
 *
 * Two documents from one spec, never hand-maintained separately, so they cannot
 * drift apart. If a requirement changes, both change.
 *
 * What `brief` drops, and why — each of these is genuine duplication in `full`,
 * not detail that was merely inconvenient:
 *
 *   data          Entity/field tables describe an internal design the vendor
 *                 will produce anyway. The mappings that carry real tax logic
 *                 are already implied by the business rules.
 *   exceptions    Every Critical exception restates a business rule it enforces
 *                 (EX-006 is BR-006; EX-002 is BR-007). The rule is the source.
 *   deployment    The cutover list and the roadmap's action items cover the same
 *                 ground from two angles. The roadmap is the more useful angle.
 *   documentation DOC-01..08 reappear wholesale as vendor deliverable VD-04.
 *   support       Hypercare and ownership transfer are contract terms, not
 *                 build scope. The SLA table survives; the prose does not.
 *
 * And what `brief` compresses rather than drops: Should/Could requirements are
 * withheld (a vendor prices the Musts), rationale columns are cut, the step
 * table folds into the diagram, and acceptance criteria render as rows instead
 * of cards.
 */

/** Sections that appear in the brief, in print order. */
const BRIEF_SECTIONS = new Set([
  'meta',
  'overview',
  'solution',
  'scope',
  'process',
  'systems',
  'requirements',
  'ai',
  'security',
  'outputs',
  'testing',
  'roadmap',
  'vendorDeliverables',
  'assumptions',
]);

const PROFILES = {
  full: {
    name: 'full',
    includes: () => true,
    compact: false,
  },
  brief: {
    name: 'brief',
    includes: (key) => BRIEF_SECTIONS.has(key),
    compact: true,
  },
};

function resolveProfile(name) {
  return PROFILES[name] || PROFILES.full;
}

module.exports = { PROFILES, BRIEF_SECTIONS, resolveProfile };
