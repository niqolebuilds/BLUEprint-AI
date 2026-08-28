'use strict';

/**
 * Smoke and contract tests. No framework — `node test/render.test.js`.
 * These are the tests the vendor must keep green.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  generate, validateSpec, specToMarkdown, sectionManifest, markdownToHtml,
  applyDefaults,
} = require('../src/index');

const EXAMPLES = path.join(__dirname, '..', 'examples');
const load = (f) => JSON.parse(fs.readFileSync(path.join(EXAMPLES, f), 'utf8'));

/** The Indonesian spec is the primary reference; the English one proves i18n. */
const spec = load('unit-tax-sp2dk.id.json');       // lean, as Blueprint AI emits it
const merged = applyDefaults(spec);                 // what actually renders
const specEn = load('unit-tax-sp2dk.en.json');
const mergedEn = applyDefaults(specEn);

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write(`  ✔ ${name}\n`);
  } catch (err) {
    process.stdout.write(`  ✘ ${name}\n    ${err.message}\n`);
    process.exitCode = 1;
  }
}

process.stdout.write('\nvprs-pdf\n');

test('the reference spec validates against the schema', () => {
  const { valid, errors } = validateSpec(spec);
  assert.ok(valid, errors.join('; '));
});

test('the English spec also validates', () => {
  const { valid, errors } = validateSpec(specEn);
  assert.ok(valid, errors.join('; '));
});

test('locale drives section titles and Given-When-Then keywords', () => {
  const mdId = specToMarkdown(merged);
  const mdEn = specToMarkdown(mergedEn);
  assert.ok(mdId.includes('Ruang Lingkup'), 'Indonesian section title missing');
  assert.ok(mdId.includes('DIBERIKAN') && mdId.includes('MAKA'),
    'Indonesian Given-When-Then keywords missing');
  assert.ok(mdEn.includes('Scope'), 'English section title missing');
  assert.ok(mdEn.includes('GIVEN') && mdEn.includes('THEN'),
    'English Given-When-Then keywords missing');
});

test('priority words are localised in the rendered table', () => {
  const md = specToMarkdown(merged);
  assert.ok(md.includes('| Wajib |'), 'Must was not localised to Wajib');
  assert.ok(!/\|\s*Must\s*\|/.test(md), 'untranslated Must leaked into the table');
});

test('an unknown language code falls back rather than throwing', () => {
  const odd = JSON.parse(JSON.stringify(merged));
  odd.meta.language = 'fr';
  assert.doesNotThrow(() => specToMarkdown(odd));
});

test('the roadmap renders phases, system chips and a checklist', () => {
  const md = specToMarkdown(merged);
  assert.ok(md.includes('Roadmap Implementasi'), 'roadmap section missing');
  assert.ok(md.includes('class="phase-num"'), 'phase number badge missing');
  assert.ok(md.includes('Microsoft Dynamics 365 (ERP)</span>'), 'system chip missing');
  assert.ok(md.includes('class="phase-actions"'), 'action checklist missing');
});

test('the roadmap is omitted when the spec carries no phases', () => {
  const thin = JSON.parse(JSON.stringify(merged));
  delete thin.roadmap;
  const row = sectionManifest(thin).find((r) => r.key === 'roadmap');
  assert.strictEqual(row.status, 'OMITTED');
  assert.ok(!specToMarkdown(thin).includes('Roadmap Implementasi'));
});

test('the brief drops the sections the full profile duplicates', () => {
  const rows = sectionManifest(merged, 'brief');
  for (const key of ['data', 'exceptions', 'deployment', 'documentation', 'support']) {
    const row = rows.find((r) => r.key === key);
    assert.strictEqual(row.status, 'OMITTED', `${key} should not be in the brief`);
    assert.match(row.reason, /brief/);
  }
});

test('the brief keeps everything a vendor needs to quote', () => {
  const rows = sectionManifest(merged, 'brief');
  for (const key of ['scope', 'systems', 'requirements', 'testing',
    'roadmap', 'vendorDeliverables']) {
    assert.strictEqual(
      rows.find((r) => r.key === key).status, 'RENDERED',
      `${key} must survive into the brief`,
    );
  }
});

test('the brief prices the Musts and withholds the rest', () => {
  const md = specToMarkdown(merged, 'brief');
  const musts = spec.requirements.functional.filter((r) => r.priority === 'Must');
  const others = spec.requirements.functional.filter((r) => r.priority !== 'Must');
  const asRow = (id) => md.includes(`<span class="req-id">${id}</span>`);
  assert.ok(musts.every((r) => asRow(r.id)), 'a Must requirement was dropped');
  assert.ok(others.every((r) => !asRow(r.id)),
    'a Should/Could requirement was printed as a requirement in the brief');
  // A withheld requirement may still be *mentioned* — a roadmap action can
  // reference one — but only where the text says it is out of the priced
  // scope. A bare citation would send the reader to an ID that is not there.
  for (const r of others) {
    if (!md.includes(r.id)) continue;
    const line = md.split('\n').find((l) => l.includes(r.id));
    assert.match(line, /Sebaiknya|Opsional|Should|Could|versi lengkap|full version/,
      `${r.id} is cited in the brief without saying it is out of scope`);
  }
});

test('the brief tests only what the brief asks for', () => {
  const md = specToMarkdown(merged, 'brief');
  const printed = new Set(
    [...md.matchAll(/\b((?:FR|BR|AI|SEC)-\d{3})\b/g)].map((m) => m[1]),
  );
  // Every ID a surviving acceptance criterion cites must also be printed as a
  // requirement somewhere in the same document.
  for (const [, cited] of md.matchAll(/<span class="req-id">(AC-\d{3})<\/span>/g)) {
    const ac = spec.testing.find((t) => t.id === cited);
    const refs = (ac.requirementRef || '').split(/[,\s]+/).filter(Boolean);
    const dangling = refs.filter((r) => /^(FR|BR|AI|SEC)-/.test(r) && !printed.has(r));
    assert.strictEqual(dangling.length, 0,
      `${cited} cites ${dangling.join(', ')}, which the brief does not print`);
  }
});

test('brief numbering is contiguous despite the omissions', () => {
  const md = specToMarkdown(merged, 'brief');
  const nums = [...md.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepStrictEqual(nums, nums.map((_, i) => i + 1),
    `numbering had a gap: ${nums.join(',')}`);
});

test('brief and full are the same document, not two documents', () => {
  // Every requirement in the brief must appear verbatim in the full version.
  // This is the property that stops the two drifting apart.
  const brief = specToMarkdown(merged, 'brief');
  const full = specToMarkdown(merged, 'full');
  for (const r of spec.requirements.business.filter((x) => x.priority === 'Must')) {
    if (!brief.includes(r.rule)) continue;
    assert.ok(full.includes(r.rule), `${r.id} differs between profiles`);
  }
  assert.ok(full.length > brief.length * 1.4, 'brief is not meaningfully shorter');
});

test('an unknown profile falls back to full', () => {
  const md = specToMarkdown(merged, 'nonsense');
  assert.ok(md.includes('Kebutuhan Data'), 'fallback did not render the full profile');
});

test('Group boilerplate is supplied by defaults, not by the spec', () => {
  // The shipped example omits these entirely; they must still reach the page.
  assert.ok(!spec.support, 'example should not carry boilerplate support terms');
  assert.ok(!spec.security?.policies, 'example should not carry boilerplate policies');
  assert.strictEqual(merged.security.policies.length, 8);
  assert.ok(merged.support.slas.length === 4);
  assert.ok(specToMarkdown(merged).includes('SEC-001'));
});

test('id lists merge by id and sort, so a spec extends rather than replaces', () => {
  // Spec contributes DOC-03/04; defaults contribute the rest; order is restored.
  assert.deepStrictEqual(
    merged.documentation.map((d) => d.id),
    ['DOC-01', 'DOC-02', 'DOC-03', 'DOC-04', 'DOC-05', 'DOC-06', 'DOC-07', 'DOC-08'],
  );
  assert.deepStrictEqual(
    merged.ai.guardrails.map((g) => g.id),
    ['AI-001', 'AI-002', 'AI-003', 'AI-004', 'AI-005', 'AI-006', 'AI-007',
      'AI-008', 'AI-009'],
  );
});

test('a spec overrides a default of the same id', () => {
  const override = JSON.parse(JSON.stringify(spec));
  override.security = { policies: [{ id: 'SEC-001', priority: 'Must', policy: 'KHUSUS UNIT' }] };
  const out = applyDefaults(override);
  assert.strictEqual(out.security.policies.length, 8, 'override should not drop siblings');
  assert.strictEqual(
    out.security.policies.find((p) => p.id === 'SEC-001').policy, 'KHUSUS UNIT',
  );
});

test('extends:false opts a section out of defaults entirely', () => {
  const opted = JSON.parse(JSON.stringify(spec));
  opted.support = { extends: false, hypercare: 'Tanpa hypercare.' };
  const out = applyDefaults(opted);
  assert.strictEqual(out.support.slas, undefined);
  assert.strictEqual(out.support.extends, undefined, 'the marker must not render');
});

test('no hard-coded section numbers in cross-references', () => {
  // "Bagian 6" is correct in the full profile and wrong in the brief, where
  // numbering shifts and some sections are absent. Refer to sections by name.
  for (const profile of ['full', 'brief']) {
    const md = specToMarkdown(applyDefaults(spec), profile);
    const hits = md.match(/\bBagian \d+|\bSection \d+/g) || [];
    assert.deepStrictEqual(hits, [],
      `${profile} contains hard-coded section numbers: ${hits.join(', ')}`);
  }
});

test('the brand logo is embedded, not linked', () => {
  const html = markdownToHtml(specToMarkdown(merged), merged);
  assert.ok(html.includes('class="brand-logo" src="data:image/png;base64,'),
    'logo is not embedded as a data URI');
});

test('a bad Solution Type is rejected', () => {
  const bad = JSON.parse(JSON.stringify(merged));
  bad.meta.solutionType = 'Magic';
  assert.strictEqual(validateSpec(bad).valid, false);
});

test('a malformed requirement ID is rejected', () => {
  const bad = JSON.parse(JSON.stringify(merged));
  bad.requirements.functional[0].id = 'FR1';
  assert.strictEqual(validateSpec(bad).valid, false);
});

test('a priority outside Must/Should/Could is rejected', () => {
  const bad = JSON.parse(JSON.stringify(merged));
  bad.requirements.functional[0].priority = 'Nice to have';
  assert.strictEqual(validateSpec(bad).valid, false);
});

test('section 9 hydrates for AI / Agentic AI', () => {
  const rows = sectionManifest(merged);
  const ai = rows.find((r) => r.key === 'ai');
  assert.strictEqual(ai.status, 'RENDERED');
});

test('section 9 is omitted for a non-AI Solution Type', () => {
  const app = JSON.parse(JSON.stringify(merged));
  app.meta.solutionType = 'Application / Dashboard';
  const ai = sectionManifest(app).find((r) => r.key === 'ai');
  assert.strictEqual(ai.status, 'OMITTED');
  assert.match(ai.reason, /Not applicable/);
});

test('omitting a section keeps the printed numbering contiguous', () => {
  const app = JSON.parse(JSON.stringify(merged));
  app.meta.solutionType = 'Application / Dashboard';
  const md = specToMarkdown(app);
  const numbers = [...md.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
  assert.deepStrictEqual(
    numbers,
    numbers.map((_, i) => i + 1),
    `numbering had a gap: ${numbers.join(',')}`,
  );
});

test('an empty section emits no placeholder', () => {
  const thin = JSON.parse(JSON.stringify(merged));
  delete thin.documentation;
  const md = specToMarkdown(thin);
  assert.ok(!md.includes('Documentation'), 'omitted section leaked a heading');
  // Word-bounded: "dan/atau" in Indonesian prose must not read as "n/a".
  assert.ok(
    !/(^|[\s(|])(TBD|TODO|N\/A|placeholder|Lorem)([\s).,|]|$)/i.test(md),
    'placeholder text leaked',
  );
});

test('every Must requirement is covered by an acceptance criterion', () => {
  const musts = [
    ...spec.requirements.functional.filter((r) => r.priority === 'Must'),
    ...spec.requirements.business.filter((r) => r.priority === 'Must'),
  ].map((r) => r.id);
  const refs = spec.testing.map((t) => t.requirementRef || '').join(' ');
  const uncovered = musts.filter((id) => !refs.includes(id));
  assert.strictEqual(
    uncovered.length, 0,
    `Must requirements with no acceptance criterion: ${uncovered.join(', ')}`,
  );
});

test('table cells containing pipes do not break the row', () => {
  const piped = JSON.parse(JSON.stringify(merged));
  piped.outputs[0].format = 'PDF | DOCX | XLSX';
  const md = specToMarkdown(piped);
  const row = md.split('\n').find((l) => l.includes('PDF \\| DOCX'));
  assert.ok(row, 'pipe was not escaped');
  assert.strictEqual((row.match(/(?<!\\)\|/g) || []).length, 6,
    'escaped row has the wrong column count');
});

test('mermaid source survives markdown parsing unescaped', () => {
  const md = specToMarkdown(merged);
  const html = markdownToHtml(md, spec);
  assert.ok(html.includes('<pre class="mermaid">'), 'no mermaid block emitted');
  assert.ok(html.includes('sequenceDiagram'), 'diagram source lost');
  assert.ok(!html.includes('&amp;gt;&amp;gt;'), 'arrow syntax double-escaped');
});

test('the HTML is self-contained — no external requests', () => {
  const html = markdownToHtml(specToMarkdown(merged), merged);
  const external = html.match(/(?:src|href)\s*=\s*["'](https?:)?\/\//gi) || [];
  assert.strictEqual(external.length, 0,
    `found external references: ${external.join(', ')}`);
});

test('full pipeline produces a non-trivial PDF', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vprs-test-'));
  const res = await generate({ spec, outDir: dir, basename: 'smoke' });
  const size = fs.statSync(res.pdf).size;
  assert.ok(size > 50000, `PDF suspiciously small: ${size} bytes`);
  const head = fs.readFileSync(res.pdf).subarray(0, 5).toString();
  assert.strictEqual(head, '%PDF-');
  fs.rmSync(dir, { recursive: true, force: true });
});

// The async test above needs a moment; report after the event loop drains.
process.on('beforeExit', () => {
  if (!process.exitCode) {
    process.stdout.write(`\n${passed} passing\n\n`);
  }
});
