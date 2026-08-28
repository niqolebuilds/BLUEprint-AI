'use strict';

/**
 * Section registry for the Vendor Production Requirement Specification (VPRS).
 *
 * Each section declares:
 *   key        - the property on the spec object it reads from, and the lookup
 *                key for its title in src/locales.js
 *   appliesTo  - null for universal sections, or an array of Solution Types
 *                for conditional ones (section `ai` is the conditional case)
 *   isEmpty    - returns true when the spec carries no content for this section
 *   render     - (spec, L) => Markdown body, without the H2 heading
 *
 * Sections are numbered at render time, AFTER omission is resolved, so the
 * printed numbering is always contiguous. This is deliberate: a document with
 * a visible gap at "9." tells the vendor something was withheld.
 *
 * Titles and table headers come from the locale bundle, never from literals
 * here — see src/locales.js for why.
 */

const {
  table, bullets, kvGrid, idTable, escapePipes, escapeHtml,
} = require('./markdown-helpers');

/** Solution types recognised by the Blueprint AI classifier. */
const SOLUTION_TYPES = [
  'Accounting / Finance Automation',
  'AI / Agentic AI',
  'RPA Bot',
  'Application / Dashboard',
  'Integration / API',
];

/** Solution types for which the AI / Automation section hydrates. */
const AI_SECTION_TYPES = ['AI / Agentic AI', 'RPA Bot'];

const isEmptyArray = (v) => !Array.isArray(v) || v.length === 0;
const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/** Translate a Must/Should/Could or Critical/High/... token for display. */
const pri = (L, v) => (L.priority[v] || v);
const sev = (L, v) => (L.severity[v] || v);

/** The brief prices the Musts. Should/Could are withheld until award. */
const musts = (arr) => (arr || []).filter((x) => x.priority === 'Must');

/**
 * Acceptance criteria that survive into the brief: those testing at least one
 * Must-priority requirement. A criterion whose only referents were withheld
 * would test something the brief never asked for.
 */
function briefCriteria(spec) {
  const mustIds = new Set([
    ...musts(spec.requirements?.functional),
    ...musts(spec.requirements?.business),
    ...musts(spec.ai?.guardrails),
    ...musts(spec.security?.policies),
  ].map((x) => x.id));
  return (spec.testing || []).filter((t) => {
    if (!t.requirementRef) return true;
    return t.requirementRef.split(/[,\s]+/).some((ref) => mustIds.has(ref));
  });
}

const SECTIONS = [
  // ---------------------------------------------------------------- 1
  {
    key: 'meta',
    appliesTo: null,
    isEmpty: (s) => !s.meta,
    render: (s, L) => {
      const m = s.meta;
      return kvGrid([
        [L.meta.projectId, m.projectId],
        [L.meta.catalogRef, m.catalogRef],
        [L.meta.solutionType, m.solutionType],
        [L.meta.version, m.version],
        [L.meta.status, m.status],
        [L.meta.businessUnit, m.businessUnit],
        [L.meta.processOwner, m.processOwner],
        [L.meta.technicalOwner, m.technicalOwner],
        [L.meta.issueDate, m.issueDate],
        [L.meta.classification, m.classification],
        [L.meta.preparedBy, m.preparedBy],
        [L.meta.readinessScore, m.readinessScore],
      ]);
    },
    renderBrief: (s, L) => {
      const m = s.meta;
      return kvGrid([
        [L.meta.projectId, m.projectId],
        [L.meta.solutionType, m.solutionType],
        [L.meta.version, m.version],
        [L.meta.businessUnit, m.businessUnit],
        [L.meta.processOwner, m.processOwner],
        [L.meta.issueDate, m.issueDate],
      ]);
    },
  },

  // ---------------------------------------------------------------- 2
  {
    key: 'overview',
    appliesTo: null,
    isEmpty: (s) => !s.overview,
    render: (s, L) => {
      const o = s.overview;
      const parts = [];
      if (has(o.problem)) parts.push(`### ${L.sub.problem}\n\n${o.problem}`);
      if (!isEmptyArray(o.objectives)) {
        parts.push(`### ${L.sub.objectives}\n\n${bullets(o.objectives)}`);
      }
      if (has(o.currentState)) parts.push(`### ${L.sub.currentState}\n\n${o.currentState}`);
      if (has(o.targetState)) parts.push(`### ${L.sub.targetState}\n\n${o.targetState}`);
      if (!isEmptyArray(o.volumetrics)) {
        parts.push(`### ${L.sub.volumetrics}\n\n${table(
          [L.th.measure, L.th.value],
          o.volumetrics.map((v) => [v.metric, v.value]),
        )}`);
      }
      return parts.join('\n\n');
    },
    renderBrief: (s, L) => {
      const o = s.overview;
      const parts = [];
      if (has(o.problem)) parts.push(o.problem);
      if (!isEmptyArray(o.objectives)) {
        parts.push(`### ${L.sub.objectives}\n\n${bullets(o.objectives)}`);
      }
      return parts.join('\n\n');
    },
  },

  // ---------------------------------------------------------------- 3
  {
    key: 'solution',
    appliesTo: null,
    isEmpty: (s) => !s.solution,
    render: (s, L) => {
      const sol = s.solution;
      const parts = [];
      if (has(sol.summary)) parts.push(sol.summary);
      const facts = [];
      if (has(sol.autonomyLevel)) facts.push([L.meta.autonomyLevel, sol.autonomyLevel]);
      if (has(sol.agentPattern)) facts.push([L.meta.agentPattern, sol.agentPattern]);
      if (facts.length) parts.push(kvGrid(facts));
      if (!isEmptyArray(sol.components)) {
        parts.push(`### ${L.sub.components}\n\n${table(
          [L.th.component, L.th.responsibility],
          sol.components.map((c) => [c.component, c.responsibility]),
        )}`);
      }
      return parts.join('\n\n');
    },
    renderBrief: (s, L) => {
      const sol = s.solution;
      const parts = [];
      if (has(sol.summary)) parts.push(sol.summary);
      const facts = [];
      if (has(sol.autonomyLevel)) facts.push([L.meta.autonomyLevel, sol.autonomyLevel]);
      if (facts.length) parts.push(kvGrid(facts));
      return parts.join('\n\n');
    },
  },

  // ---------------------------------------------------------------- 4
  {
    key: 'scope',
    appliesTo: null,
    isEmpty: (s) => !s.scope
      || (isEmptyArray(s.scope.inScope) && isEmptyArray(s.scope.outOfScope)),
    render: (s, L) => {
      const inS = s.scope.inScope || [];
      const outS = s.scope.outOfScope || [];
      const rows = [];
      const n = Math.max(inS.length, outS.length);
      for (let i = 0; i < n; i += 1) {
        rows.push([
          inS[i] ? `✔ ${escapePipes(inS[i])}` : '',
          outS[i] ? `✘ ${escapePipes(outS[i])}` : '',
        ]);
      }
      return table([L.th.inScope, L.th.outOfScope], rows, ['scope-in', 'scope-out']);
    },
  },

  // ---------------------------------------------------------------- 5
  {
    key: 'process',
    appliesTo: null,
    isEmpty: (s) => !s.process
      || (!has(s.process.mermaid) && isEmptyArray(s.process.steps)),
    render: (s, L) => {
      const p = s.process;
      const parts = [];
      if (has(p.narrative)) parts.push(p.narrative);
      if (has(p.mermaid)) {
        parts.push(`### ${L.sub.flow}\n`);
        parts.push(['```mermaid', p.mermaid, '```'].join('\n'));
      }
      if (!isEmptyArray(p.steps)) {
        parts.push(`### ${L.sub.steps}\n\n${table(
          [L.th.id, L.th.actor, L.th.step, L.th.output],
          p.steps.map((x) => [x.id, x.actor, x.step, x.output]),
          ['col-id', 'col-actor', '', 'col-output'],
        )}`);
      }
      return parts.join('\n\n');
    },
    // The step table restates the diagram in prose. In the brief the diagram
    // carries it alone.
    renderBrief: (s) => ['```mermaid', s.process.mermaid, '```'].join('\n'),
  },

  // ---------------------------------------------------------------- 6
  {
    key: 'systems',
    appliesTo: null,
    isEmpty: (s) => !s.systems || isEmptyArray(s.systems.integrations),
    render: (s, L) => {
      const rows = s.systems.integrations.map((i) => [
        i.id, i.system, i.role, i.protocol, i.direction, i.frequency,
      ]);
      const parts = [table(
        [L.th.id, L.th.system, L.th.role, L.th.protocol, L.th.direction, L.th.frequency],
        rows,
        ['col-id', '', '', '', 'col-dir', 'col-freq'],
      )];
      const noted = s.systems.integrations.filter((i) => has(i.notes));
      if (noted.length) {
        parts.push(`### ${L.sub.constraints}\n\n${table(
          [L.th.id, L.th.constraint],
          noted.map((i) => [i.id, i.notes]),
          ['col-id', ''],
        )}`);
      }
      return parts.join('\n\n');
    },
    renderBrief: (s, L) => table(
      [L.th.system, L.th.role, L.th.protocol, L.th.direction],
      s.systems.integrations.map((i) => [i.system, i.role, i.protocol, i.direction]),
      ['', '', '', 'col-dir'],
    ),
  },

  // ---------------------------------------------------------------- 7
  {
    key: 'data',
    appliesTo: null,
    isEmpty: (s) => !s.data
      || (isEmptyArray(s.data.entities) && isEmptyArray(s.data.mappings)
          && isEmptyArray(s.data.aiPrompts)),
    render: (s, L) => {
      const d = s.data;
      const parts = [];
      if (!isEmptyArray(d.entities)) {
        parts.push(`### ${L.sub.entities}\n\n${table(
          [L.th.entity, L.th.keyFields, L.th.source, L.th.retention],
          d.entities.map((e) => [e.entity, `\`${e.keyFields}\``, e.source, e.retention]),
        )}`);
      }
      if (!isEmptyArray(d.mappings)) {
        parts.push(`### ${L.sub.mappings}\n\n${table(
          [L.th.field, L.th.source, L.th.target, L.th.transformation],
          d.mappings.map((m) => [m.field, m.source, m.target, m.transformation]),
        )}`);
      }
      if (!isEmptyArray(d.aiPrompts)) {
        parts.push(`### ${L.sub.prompts}\n\n${table(
          [L.th.id, L.th.purpose, L.th.input, L.th.output, L.th.constraint],
          d.aiPrompts.map((p) => [p.id, p.purpose, p.input, p.output, p.constraint]),
          ['col-id', '', '', '', ''],
        )}`);
      }
      return parts.join('\n\n');
    },
  },

  // ---------------------------------------------------------------- 8
  {
    key: 'requirements',
    appliesTo: null,
    isEmpty: (s) => !s.requirements
      || (isEmptyArray(s.requirements.functional) && isEmptyArray(s.requirements.business)),
    render: (s, L) => {
      const r = s.requirements;
      const parts = [];
      if (!isEmptyArray(r.functional)) {
        parts.push(`### ${L.sub.functional}\n\n${idTable(
          [L.th.id, L.th.priority, L.th.requirement],
          r.functional.map((f) => [f.id, pri(L, f.priority), f.requirement]),
        )}`);
      }
      if (!isEmptyArray(r.business)) {
        parts.push(`### ${L.sub.business}\n\n${idTable(
          [L.th.id, L.th.priority, L.th.rule, L.th.rationale],
          r.business.map((b) => [b.id, pri(L, b.priority), b.rule, b.rationale]),
        )}`);
      }
      return parts.join('\n\n');
    },
    renderBrief: (s, L) => {
      const r = s.requirements;
      const parts = [];
      const fr = musts(r.functional);
      const br = musts(r.business);
      if (fr.length) {
        parts.push(`### ${L.sub.functional}\n\n${idTable(
          [L.th.id, L.th.requirement],
          fr.map((f) => [f.id, f.requirement]),
        )}`);
      }
      if (br.length) {
        parts.push(`### ${L.sub.business}\n\n${idTable(
          [L.th.id, L.th.rule],
          br.map((b) => [b.id, b.rule]),
        )}`);
      }
      return parts.join('\n\n');
    },
  },

  // ---------------------------------------------------------------- 9 (conditional)
  {
    key: 'ai',
    appliesTo: AI_SECTION_TYPES,
    isEmpty: (s) => !s.ai
      || (isEmptyArray(s.ai.guardrails) && isEmptyArray(s.ai.humanApprovals)
          && isEmptyArray(s.ai.evaluation)),
    render: (s, L) => {
      const a = s.ai;
      const parts = [];
      if (!isEmptyArray(a.guardrails)) {
        parts.push(`### ${L.sub.guardrails}\n\n${idTable(
          [L.th.id, L.th.priority, L.th.control],
          a.guardrails.map((g) => [g.id, pri(L, g.priority), g.control]),
        )}`);
      }
      if (!isEmptyArray(a.humanApprovals)) {
        parts.push(`### ${L.sub.approvals}\n\n${table(
          [L.th.gate, L.th.approver, L.th.blocking],
          a.humanApprovals.map((h) => [h.gate, h.approver, h.blocking]),
        )}`);
      }
      if (!isEmptyArray(a.evaluation)) {
        parts.push(`### ${L.sub.evaluation}\n\n${table(
          [L.th.metric, L.th.targetValue, L.th.method],
          a.evaluation.map((e) => [e.metric, e.target, e.method]),
        )}`);
      }
      return parts.join('\n\n');
    },
    renderBrief: (s, L) => {
      const a = s.ai;
      const parts = [];
      const g = musts(a.guardrails);
      if (g.length) {
        parts.push(`### ${L.sub.guardrails}\n\n${idTable(
          [L.th.id, L.th.control], g.map((x) => [x.id, x.control]),
        )}`);
      }
      if (!isEmptyArray(a.humanApprovals)) {
        parts.push(`### ${L.sub.approvals}\n\n${table(
          [L.th.gate, L.th.approver],
          a.humanApprovals.map((h) => [h.gate, h.approver]),
        )}`);
      }
      return parts.join('\n\n');
    },
  },

  // ---------------------------------------------------------------- 10
  {
    key: 'exceptions',
    appliesTo: null,
    isEmpty: (s) => !s.exceptions
      || (isEmptyArray(s.exceptions.matrix) && isEmptyArray(s.exceptions.controls)),
    render: (s, L) => {
      const e = s.exceptions;
      const parts = [];
      if (!isEmptyArray(e.matrix)) {
        parts.push(`### ${L.sub.matrix}\n\n${idTable(
          [L.th.id, L.th.condition, L.th.severity, L.th.handling],
          e.matrix.map((x) => [x.id, x.condition, sev(L, x.severity), x.handling]),
        )}`);
      }
      if (!isEmptyArray(e.controls)) {
        parts.push(`### ${L.sub.controls}\n\n${idTable(
          [L.th.id, L.th.control, L.th.framework],
          e.controls.map((c) => [c.id, c.control, c.framework]),
        )}`);
      }
      return parts.join('\n\n');
    },
  },

  // ---------------------------------------------------------------- 11
  {
    key: 'security',
    appliesTo: null,
    isEmpty: (s) => !s.security
      || (isEmptyArray(s.security.roles) && isEmptyArray(s.security.policies)),
    render: (s, L) => {
      const sec = s.security;
      const parts = [];
      if (!isEmptyArray(sec.roles)) {
        parts.push(`### ${L.sub.roles}\n\n${table(
          [L.th.role, L.th.permissions, L.th.sod],
          sec.roles.map((r) => [r.role, r.permissions, r.sod]),
        )}`);
      }
      if (!isEmptyArray(sec.policies)) {
        parts.push(`### ${L.sub.policies}\n\n${idTable(
          [L.th.id, L.th.priority, L.th.policy],
          sec.policies.map((p) => [p.id, pri(L, p.priority), p.policy]),
        )}`);
      }
      return parts.join('\n\n');
    },
    renderBrief: (s, L) => idTable(
      [L.th.id, L.th.policy],
      musts(s.security.policies).map((p) => [p.id, p.policy]),
    ),
  },

  // ---------------------------------------------------------------- 12
  {
    key: 'outputs',
    appliesTo: null,
    isEmpty: (s) => isEmptyArray(s.outputs),
    render: (s, L) => idTable(
      [L.th.id, L.th.output, L.th.format, L.th.audience, L.th.trigger],
      s.outputs.map((o) => [o.id, o.output, o.format, o.audience, o.trigger]),
    ),
    renderBrief: (s, L) => idTable(
      [L.th.id, L.th.output, L.th.format],
      s.outputs.map((o) => [o.id, o.output, o.format]),
    ),
  },

  // ---------------------------------------------------------------- 13
  {
    key: 'testing',
    appliesTo: null,
    isEmpty: (s) => isEmptyArray(s.testing),
    render: (s, L) => s.testing.map((t) => [
      '<div class="ac-block">',
      `<div class="ac-head"><span class="ac-id">${escapeHtml(t.id)}</span>`
        + `<span class="ac-ref">${escapeHtml(t.requirementRef || '')}</span></div>`,
      `<div class="ac-line"><span class="gwt">${L.gwt.given}</span> ${t.given}</div>`,
      `<div class="ac-line"><span class="gwt">${L.gwt.when}</span> ${t.when}</div>`,
      `<div class="ac-line"><span class="gwt">${L.gwt.then}</span> ${t.then}</div>`,
      '</div>',
    ].join('\n')).join('\n\n'),
    // Cards give each criterion a page-safe block, which costs about four
    // pages across twenty criteria. The brief runs them as rows: the same
    // three clauses, one line each, keywords bolded rather than gutter-set.
    //
    // Criteria that test only Should/Could requirements are also dropped —
    // otherwise the brief would test something it does not ask for, which is
    // exactly the kind of inconsistency a vendor prices defensively against.
    renderBrief: (s, L) => idTable(
      [L.th.id, L.th.acceptanceCriterion],
      briefCriteria(s).map((t) => [
        t.id,
        `**${L.gwt.given}** ${t.given}<br/>`
        + `**${L.gwt.when}** ${t.when}<br/>`
        + `**${L.gwt.then}** ${t.then}`,
      ]),
    ),
  },

  // ---------------------------------------------------------------- 14
  {
    key: 'roadmap',
    appliesTo: null,
    isEmpty: (s) => isEmptyArray(s.roadmap),
    render: (s, L) => s.roadmap.map((p, i) => {
      const chips = (p.systems || [])
        .map((x) => `<span class="chip">${escapeHtml(x)}</span>`).join('');
      const actions = (p.actions || [])
        .map((a) => `<li>${escapeHtml(a)}</li>`).join('\n      ');
      return [
        '<div class="phase-block">',
        '  <div class="phase-head">',
        `    <span class="phase-num">${i + 1}</span>`,
        '    <div class="phase-titles">',
        `      <div class="phase-name">${escapeHtml(p.phase)}</div>`,
        `      <div class="phase-theme">${escapeHtml(p.theme || '')}</div>`,
        '    </div>',
        '  </div>',
        p.description ? `  <p class="phase-desc">${escapeHtml(p.description)}</p>` : '',
        chips ? `  <div class="chip-label">${L.roadmap.systems}</div>`
          + `\n  <div class="chip-row">${chips}</div>` : '',
        actions ? `  <div class="chip-label">${L.roadmap.actions}</div>`
          + `\n  <ul class="phase-actions">\n      ${actions}\n  </ul>` : '',
        '</div>',
      ].filter(Boolean).join('\n');
    }).join('\n\n'),
  },

  // ---------------------------------------------------------------- 15
  {
    key: 'deployment',
    appliesTo: null,
    isEmpty: (s) => !s.deployment
      || (isEmptyArray(s.deployment.environments) && isEmptyArray(s.deployment.cutover)),
    render: (s, L) => {
      const d = s.deployment;
      const parts = [];
      if (!isEmptyArray(d.environments)) {
        parts.push(`### ${L.sub.environments}\n\n${table(
          [L.th.environment, L.th.purpose, L.th.data, L.th.access],
          d.environments.map((e) => [e.env, e.purpose, e.data, e.access]),
        )}`);
      }
      if (!isEmptyArray(d.cutover)) {
        parts.push(`### ${L.sub.cutover}\n\n${idTable(
          [L.th.id, L.th.step, L.th.owner],
          d.cutover.map((c) => [c.id, c.step, c.owner]),
        )}`);
      }
      return parts.join('\n\n');
    },
  },

  // ---------------------------------------------------------------- 16
  {
    key: 'documentation',
    appliesTo: null,
    isEmpty: (s) => isEmptyArray(s.documentation),
    render: (s, L) => idTable(
      [L.th.id, L.th.artefact, L.th.detail],
      s.documentation.map((d) => [d.id, d.artefact, d.detail]),
    ),
  },

  // ---------------------------------------------------------------- 17
  {
    key: 'support',
    appliesTo: null,
    isEmpty: (s) => !s.support
      || (!has(s.support.hypercare) && isEmptyArray(s.support.slas)
          && isEmptyArray(s.support.ownership)),
    render: (s, L) => {
      const sp = s.support;
      const parts = [];
      if (has(sp.hypercare)) parts.push(`### ${L.sub.hypercare}\n\n${sp.hypercare}`);
      if (!isEmptyArray(sp.slas)) {
        parts.push(`### ${L.sub.slas}\n\n${table(
          [L.th.severity, L.th.definition, L.th.response, L.th.resolution],
          sp.slas.map((x) => [x.severity, x.definition, x.response, x.resolution]),
        )}`);
      }
      if (!isEmptyArray(sp.ownership)) {
        parts.push(`### ${L.sub.ownership}\n\n${table(
          [L.th.area, L.th.owner, L.th.transfer],
          sp.ownership.map((o) => [o.area, o.owner, o.transfer]),
        )}`);
      }
      return parts.join('\n\n');
    },
  },

  // ---------------------------------------------------------------- 18
  {
    key: 'vendorDeliverables',
    appliesTo: null,
    isEmpty: (s) => isEmptyArray(s.vendorDeliverables),
    render: (s, L) => idTable(
      [L.th.id, L.th.deliverable, L.th.acceptance],
      s.vendorDeliverables.map((v) => [v.id, v.deliverable, v.acceptance]),
    ),
  },

  // ---------------------------------------------------------------- 19
  {
    key: 'assumptions',
    appliesTo: null,
    isEmpty: (s) => isEmptyArray(s.assumptions) && isEmptyArray(s.dependencies)
      && isEmptyArray(s.openQuestions),
    render: (s, L) => {
      const parts = [];
      if (!isEmptyArray(s.assumptions)) {
        parts.push(`### ${L.sub.assumptions}\n\n${idTable(
          [L.th.id, L.th.assumption],
          s.assumptions.map((a) => [a.id, a.item]),
        )}`);
      }
      if (!isEmptyArray(s.dependencies)) {
        parts.push(`### ${L.sub.dependencies}\n\n${idTable(
          [L.th.id, L.th.dependency, L.th.owner, L.th.neededBy],
          s.dependencies.map((d) => [d.id, d.item, d.owner, d.neededBy]),
        )}`);
      }
      if (!isEmptyArray(s.openQuestions)) {
        parts.push(`### ${L.sub.openQuestions}\n\n${idTable(
          [L.th.id, L.th.question, L.th.owner, L.th.due],
          s.openQuestions.map((q) => [q.id, q.question, q.owner, q.due]),
        )}`);
      }
      return parts.join('\n\n');
    },
    // In the brief only the unresolved items matter — they are what a vendor
    // must price around, or refuse to price until answered.
    renderBrief: (s, L) => idTable(
      [L.th.id, L.th.question, L.th.owner],
      (s.openQuestions || []).map((q) => [q.id, q.question, q.owner]),
    ),
  },
];

/**
 * Resolve which sections hydrate for a given spec and profile.
 *
 * A section is omitted when it does not apply to the Solution Type, when the
 * profile excludes it, OR when the spec carries no content for it. Placeholders
 * are never emitted, and numbering is assigned afterwards so it stays
 * contiguous in both profiles.
 *
 * @param {object} spec
 * @param {object} [profile] from src/profiles.js; defaults to full
 */
function resolveSections(spec, profile) {
  const solutionType = spec?.meta?.solutionType;
  const includes = profile?.includes || (() => true);
  const compact = Boolean(profile?.compact);
  const out = [];
  let n = 0;
  for (const section of SECTIONS) {
    const applies = section.appliesTo === null
      || section.appliesTo.includes(solutionType);
    if (!applies) continue;
    if (!includes(section.key)) continue;
    if (section.isEmpty(spec)) continue;
    n += 1;
    const render = compact && section.renderBrief
      ? section.renderBrief : section.render;
    out.push({ section, number: n, render });
  }
  return out;
}

module.exports = {
  SECTIONS, SOLUTION_TYPES, AI_SECTION_TYPES, resolveSections,
};
