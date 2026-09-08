# Blueprint AI — VPRS PDF Generator

> **Vendored.** This package was delivered as a standalone `@blueprint-ai/vprs-pdf`
> module and lives here unmodified except for one small addition: `launchArgs`
> support on `generate()`/`htmlToPdf()` so the app can hand it a serverless
> Chromium's launch flags on Vercel (see `../api/_lib/vprsPdf.ts`, which is
> the actual integration point — Process + AI Deployment Roadmap → spec →
> this pipeline). Its own test suite (`npm test` from this directory, 32
> assertions, plain `node:assert`) is independent of the root `vitest` suite;
> run it directly if you change anything under `src/` here.

Turns a **Vendor Production Requirement Specification** (VPRS) — the structured
output of Blueprint AI's *Prepare for Production* flow — into a print-ready PDF,
plus the Markdown and HTML from which it was built.

```
spec.json  ──validate──▶  Markdown  ──▶  HTML  ──▶  PDF
             (AJV)         (.md)        (.html)     (.pdf)
```

Each stage is a separate export because each has a different consumer: the
Markdown diffs cleanly in a repository, the HTML embeds in the Blueprint AI web
app, and the PDF goes to procurement and the vendor.

---

## Quick start

```bash
npm install
npm test                       # 32 assertions, no framework
npm run example                # full profile — the contract annex (26 pp)
npm run example:brief          # brief profile — the quotation pack (13 pp)
npm run example:en             # the same spec in English, to prove the locale layer
```

Or directly:

```bash
node bin/blueprint-pdf.js examples/unit-tax-sp2dk.id.json --out ./out --manifest
```

Output lands in `./out/` as `.md`, `.html` and `.pdf`.

### CLI

```
blueprint-pdf <spec.json> [options]

  -o, --out <dir>       Output directory              (default: ./out)
  -n, --name <stem>     Output filename stem          (default: derived)
      --no-md           Skip the Markdown output
      --no-html         Skip the HTML output
      --no-pdf          Skip the PDF output
  -p, --profile <name>  full (default) or brief
      --logo <path>     Brand mark for cover + page header
      --manifest        Print the section hydration manifest
      --validate-only   Validate the spec and exit
      --chromium <path> Chromium executable override
```

Exit codes: `0` success · `1` schema validation failed · `2` render failed.
Both non-zero codes are safe to gate a CI job on.

### Library

```js
const { generate } = require('@blueprint-ai/vprs-pdf');

const { pdf, html, markdown, manifest } = await generate({
  spec: specObject,          // or a path to a .json file
  outDir: '/tmp/packs',
  emitHtml: false,           // PDF only
});
```

---

## Generation cost

Rendering costs **zero tokens** — it is deterministic Node.js. The token cost of
this feature is entirely in Blueprint AI's *hydration* step: the model writing
the spec JSON. So that is where the savings are, and the measurements below are
of the spec, not the renderer.

Reference spec, measured at ~3.7 chars/token:

| | tokens | |
|---|---:|---|
| Indented, every block written by the model | 17,400 | baseline |
| Boilerplate moved to `src/defaults.js` | 14,900 | −14% |
| …and emitted minified | **13,900** | **−20%** |
| Brief-only (full annex never generated) | 10,500 | −40% |

**Where the 20% came from.** About a fifth of every spec was not about the
process at all — security roles and policies, the documentation checklist,
support SLAs, vendor deliverables, environment paths, audit controls, and the
generic AI guardrails. Those blocks were byte-identical across catalogue
entries, so the model was paying to retype Group policy every time. They now
live in `src/defaults.js` and are merged in before rendering. Output is
unchanged; a spec that omits them still produces the same document.

The remaining 7% is JSON indentation. Ask the model for minified JSON.

**The brief-only path.** If a catalogue entry only ever needs the quotation
pack, the model can skip what only the full profile prints — the step table,
data requirements, the exception matrix, cutover steps, and every Should/Could
requirement. That is a 40% saving, at the cost of a second generation later if
someone does want the annex. Worth it when most entries never reach contract.

**The biggest lever is not in this repo.** The system prompt, the schema and the
defaults are identical on every call; only the catalogue entry changes. Putting
the static part behind prompt caching cuts input cost by roughly an order of
magnitude on repeat generations, and it is a change to how Blueprint AI calls
the API, not to the renderer.

### Group defaults

`src/defaults.js` holds the Group's standing position. Merge rules:

- A key the spec does not define takes the default.
- **A list whose every entry has an `id` merges by id and sorts by id.** The
  spec's `SEC-005` replaces the default's; defaults with no counterpart survive.
  This is what lets a spec add `DOC-03` without restating `DOC-01..08`.
- Any other array is replaced wholesale — without ids there is no way to say
  which entry overrides which.
- `extends: false` on a section opts out of defaults entirely.

`--no-defaults` renders a spec exactly as given. Anything in `defaults.js` is a
Group-level commitment: changing it changes every future vendor pack, so it
belongs under the same review as any other policy text.

## Profiles — one spec, two documents

`--profile full` (default) and `--profile brief` render the same hydrated spec
at two lengths. They are not two documents kept in step by hand; the brief is a
projection of the full one, so a requirement cannot change in one and not the
other. A test asserts that property directly.

| | `full` | `brief` |
|---|---|---|
| Reader | Internal Audit, Legal, the signed agreement | The vendor pricing the work; the sponsor approving it |
| Reference output | 26 pp | 13 pp |
| Requirements | Must + Should + Could, with rationale | Must only, no rationale |
| Acceptance criteria | Given-When-Then cards | Rows; only those testing a Must |
| Process | narrative + diagram + 12-row step table | diagram alone |

**What the brief drops, and why.** Each of these was genuine duplication in the
full document, not detail that was merely inconvenient:

- **Data requirements** — entity and field tables describe an internal design
  the vendor produces anyway.
- **Exceptions & controls** — every Critical exception restates the business
  rule it enforces (`EX-006` is `BR-006`; `EX-002` is `BR-007`). The rule is the
  source; the exception is a second telling.
- **Deployment** — the cutover list and the roadmap's action items cover the
  same ground from two angles. The roadmap is the more useful angle, so the
  cutover goes and the roadmap stays.
- **Documentation** — `DOC-01..08` reappear wholesale as vendor deliverable
  `VD-04`.
- **Post-production & support** — contract terms, not build scope.

**One consistency rule worth knowing.** Dropping the Should/Could requirements
would otherwise leave dangling references: an acceptance criterion testing a
requirement the brief never prints, or a roadmap action citing an invisible ID.
So the brief also drops acceptance criteria whose every referent was withheld,
and a test fails the build if any surviving citation points at an ID the brief
does not print. A withheld requirement may still be *mentioned* in a roadmap
action, but only where the text says it is outside the priced scope.

## Language

`meta.language` (`id` | `en`, default `id`) selects a locale bundle in
`src/locales.js`. The split it enforces is the important part:

- **The renderer owns** section titles, table headers, Given/When/Then keywords,
  the cover boilerplate, and the Must/Should/Could and Critical/High labels.
- **The spec owns** everything the document actually *says*.

So Blueprint AI hydrates a spec in whatever language the unit works in, and the
chrome around it follows without the generator knowing the subject matter. The
priority words are translated at render time (`Must` → `Wajib`), which is why
`applyPriorityClasses` in `src/html.js` matches against the *localised* word —
colour-coding would silently stop working otherwise. A test asserts that no
untranslated `Must` leaks into an Indonesian table.

Adding a language is one new key in `src/locales.js`. An unrecognised code falls
back to Indonesian rather than throwing.

## Branding

The Siloam mark is bundled at `src/theme/logo.png` and appears in two places:
the running page header on every page, and the cover's signature block. Override
per-run with `--logo <path>`, or per-spec with `meta.logoPath`. With no image
available, `meta.organisation` prints as a wordmark instead.

The logo is embedded as a `data:` URI, never linked — a linked image prints as a
broken-image box on a cover going to a vendor when the reader is behind a proxy.
A test asserts the embedding.

One constraint worth knowing before you redesign the cover: **Chromium draws the
running header on page 1 too, and there is no `:first` escape for header
templates.** `@page :first { margin-top: 0 }` does not suppress it, and passing
`margin` to `page.pdf()` makes it worse by overriding the stylesheet's `@page`
rules entirely (which is why `src/pdf.js` sets margins in CSS and passes
`preferCSSPageSize` instead). So the cover does not put a second mark at the top
— the large logo sits in the signature block above the cover footer, where it
reads as deliberate rather than duplicated.

## The nineteen sections

`src/sections.js` is the single source of truth for document structure. Each
entry declares the spec property it reads, its heading, whether it is universal
or conditional, an `isEmpty` predicate, and a `render` function returning
Markdown.

| # | Section | Hydration |
|---|---|---|
| 1 | Document Control | Universal |
| 2 | Project Overview | Universal |
| 3 | Solution Overview | Universal |
| 4 | Scope | Universal |
| 5 | Process & Functional Flow | Universal |
| 6 | Systems & Integration | Universal |
| 7 | Data Requirements | Universal |
| 8 | Requirements & Business Rules | Universal |
| 9 | AI / Automation Requirements | **Conditional** — `AI / Agentic AI`, `RPA Bot` |
| 10 | Exceptions & Controls | Universal |
| 11 | Security & Access | Universal |
| 12 | Outputs & Reports | Universal |
| 13 | Testing & Acceptance Criteria | Universal |
| 14 | Implementation Roadmap | Universal |
| 15 | Deployment | Universal |
| 16 | Documentation | Universal |
| 17 | Post-Production & Support | Universal |
| 18 | Vendor Deliverables | Universal |
| 19 | Assumptions, Dependencies & Open Questions | Universal |

Section 14 (roadmap) and section 15 (deployment) are deliberately separate: the
roadmap is the **build plan** — phases, systems touched, action checklists —
while deployment is the **cutover**. Collapsing them hides the fact that a
vendor can finish the build and still not be ready to go live.

**Omission rule.** A section is dropped when it does not apply to the Solution
Type, *or* when the spec carries no content for it. Nothing is ever emitted as a
placeholder. Numbering is assigned after omission is resolved, so the printed
sequence is always contiguous — a document with a visible gap at "9." would tell
a vendor that something was withheld, which is exactly the wrong signal.

Run with `--manifest` to see what hydrated, what was dropped, and why.

### Adding a section

1. Add the property to `schema/vprs.schema.json`.
2. Append an entry to the `SECTIONS` array in `src/sections.js`, in print order.
3. Add a case to `test/render.test.js` covering its omission behaviour.

No other file needs to change. The renderer, the manifest and the numbering all
derive from the registry.

---

## The spec contract

`schema/vprs.schema.json` (JSON Schema draft-07) is the boundary between
Blueprint AI's hydration step and this renderer. The renderer trusts the spec
completely, which is why the schema — not a downstream `try/catch` — is where
malformed generation output gets caught.

Enforced today:

- `meta.solutionType` must be one of the five recognised values. This drives
  Section 9's conditional hydration, so a typo here silently changes the
  document; the enum makes it a hard failure instead.
- `FR-###`, `BR-###`, `EX-###`, `AI-###`, `AC-###` identifier patterns.
- `priority` ∈ `Must | Should | Could`; `severity` ∈ `Critical | High | Medium | Low`.
- Acceptance criteria require all three of `given`, `when`, `then`.
- `meta.language` ∈ `id | en`; roadmap phase ids match `FASE-#` / `PHASE-#`.

Validate without rendering:

```bash
node bin/blueprint-pdf.js myspec.json --validate-only
```

---

## Rendering notes

Things in here that look fussy and are not:

**Self-contained HTML.** No CDN, no webfont fetch, no external script. The HTML
is opened on machines behind an enterprise proxy; anything remote either blocks
or silently renders wrong. Mermaid is injected at render time from
`node_modules`. `test/render.test.js` asserts there are zero external references
in the output.

**Mermaid is rendered, then measured.** Chromium will happily print an empty
`<pre>` if you ask it to print before the diagram is drawn, so `src/pdf.js`
waits for one `svg` per `pre.mermaid` before calling `page.pdf()`. It then
measures each figure and, where one exceeds roughly half a page, moves a
page-break onto the *heading above it* rather than onto the figure — breaking on
the figure alone strands its heading at the foot of the previous page.

**Narrow participant boxes make diagram text bigger.** Counter-intuitive, but a
sequence diagram is scaled to fit the page width; a wide diagram scaled to 0.5
prints its 17px labels at about 6pt. Shrinking the participant boxes shrinks the
natural width, which raises the fit-to-page scale factor, which raises the
*effective* font size on paper. Keep participant names short and put the detail
in the step table and the figure caption.

**Escaping.** Table cells are escaped for pipes and newlines
(`src/markdown-helpers.js`), and mermaid fences are lifted out before Markdown
parsing — `marked` would otherwise turn `->>` into entities that mermaid cannot
parse.

**Chromium discovery.** `src/pdf.js` looks under `PLAYWRIGHT_BROWSERS_PATH`,
then `/opt/pw-browsers`, then the usual system locations, before falling back to
playwright's own default. Set `BLUEPRINT_CHROMIUM` or pass `--chromium` to
override. This avoids requiring `npx playwright install` on a build agent that
already has a Chromium at a different revision.

---

## Styling

`src/theme/print.css` is the whole visual system. Enterprise Navy (`#1e3a8a`),
A4, 22/16/20/16 mm margins.

Deliberate choices worth keeping:

- `thead { display: table-header-group }` so a long table repeats its header
  across pages, and `tr { break-inside: avoid }` so no row is cut in half.
- `h2, h3 { break-after: avoid-page }` so a heading never ends a page alone.
- Acceptance criteria are `.ac-block` cards rather than table rows —
  Given/When/Then reads as three lines, not three cells, and the block never
  splits across a page.
- Priority and severity words are colour-coded (`Must` red, `Should` amber,
  `Could` grey) by `applyPriorityClasses` in `src/html.js`. In a vendor
  negotiation those words carry the weight; the styling matches.
- The Scope table tints In-Scope green and Out-of-Scope red so the two columns
  read as opposites at a glance.

Colours are CSS custom properties at the top of the file. To rebrand, change the
`:root` block and nothing else.

---

## Files

```
bin/blueprint-pdf.js        CLI
src/index.js                public API — generate()
src/validate.js             AJV validation against the schema
src/sections.js             ⬅ the 18-section registry (start here)
src/markdown.js             spec → Markdown, plus the section manifest
src/markdown-helpers.js     table/grid emitters and escaping
src/html.js                 Markdown → self-contained HTML, cover page
src/pdf.js                  HTML → PDF, mermaid rendering, page breaks
src/theme/print.css         the print stylesheet
schema/vprs.schema.json     the spec contract
src/profiles.js             full / brief section selection
src/defaults.js             Group boilerplate merged into every spec
src/locales.js              renderer-owned strings, id + en
src/theme/logo.png          bundled brand mark
examples/unit-tax-sp2dk.id.json  reference spec (Agentic AI, Bahasa Indonesia)
examples/unit-tax-sp2dk.en.json  the same spec in English
test/render.test.js         smoke and contract tests
```

## Requirements

Node ≥ 18. A Chromium binary (bundled via `playwright-core`, or discovered — see
above). No network access is needed at render time.
