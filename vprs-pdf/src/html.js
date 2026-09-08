'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { escapeHtml } = require('./markdown-helpers');
const { resolveLocale } = require('./locales');

const CSS_PATH = path.join(__dirname, 'theme', 'print.css');
const DEFAULT_LOGO = path.join(__dirname, 'theme', 'logo.png');

/**
 * Read a logo file and return a data URI, or null when there is none.
 *
 * The logo is embedded rather than linked for the same reason everything else
 * is: this HTML gets opened behind an enterprise proxy, and a linked image
 * either blocks or prints as a broken-image box on the cover of a document
 * going to a vendor.
 *
 * @param {string} [logoPath] override; defaults to the bundled brand mark
 * @returns {string|null} `data:image/...;base64,...`
 */
function loadLogo(logoPath) {
  const p = logoPath || DEFAULT_LOGO;
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).toLowerCase();
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[ext];
  if (!mime) return null;
  return `data:${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

/**
 * Convert the VPRS Markdown to a single self-contained HTML document.
 */
function markdownToHtml(markdown, spec, opts = {}) {
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const m = spec.meta || {};
  const L = resolveLocale(m.language);
  const logo = loadLogo(opts.logoPath || m.logoPath);

  // Pull fenced mermaid blocks out before Markdown parsing. marked would
  // escape the arrow syntax into entities that mermaid then fails to parse.
  const diagrams = [];
  const withPlaceholders = markdown.replace(
    /```mermaid\n([\s\S]*?)```/g,
    (_, code) => {
      const i = diagrams.length;
      diagrams.push(code.trim());
      return `<!--MERMAID:${i}-->`;
    },
  );

  marked.setOptions({ gfm: true, breaks: false, mangle: false, headerIds: false });
  let body = marked.parse(withPlaceholders);

  // The Markdown opens with the document title and subtitle so that it stands
  // alone as a file. In the PDF the cover already carries both, so strip that
  // opening pair rather than printing the title twice.
  body = body.replace(/^\s*<h1>[\s\S]*?<\/h1>\s*<h2>[\s\S]*?<\/h2>\s*/, '');

  body = restoreDiagrams(body, diagrams, opts.diagramCaptions || []);
  body = applyColgroups(body);
  body = applyPriorityClasses(body, L);
  body = tagScopeSection(body, L);

  return `<!doctype html>
<html lang="${escapeHtml(L.code)}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(m.projectId || 'VPRS')} — ${escapeHtml(m.title || '')}</title>
<style>
${css}
</style>
</head>
<body>
${renderCover(m, L, logo, opts.profile)}
${body}
</body>
</html>`;
}

function renderCover(m, L, logo, profile) {
  const pairs = [
    [L.meta.projectId, m.projectId],
    [L.meta.version, m.version],
    [L.meta.businessUnit, m.businessUnit],
    [L.meta.issueDate, m.issueDate],
    [L.meta.processOwner, m.processOwner],
    [L.meta.classification, m.classification],
  ].filter(([, v]) => v);

  // The brand mark sits in the cover's signature block, not at the top of the
  // page. Chromium draws the running header on page 1 as well — there is no
  // `:first` escape for header templates — so a second mark at the top would
  // read as a duplicate. Down here it reads as a signature.
  const brand = logo
    ? `<img class="brand-logo" src="${logo}" alt="${escapeHtml(m.organisation || '')}">`
    : `<div class="brand-wordmark">${escapeHtml(m.organisation || '')}</div>`;

  return `<section class="cover">
  <div class="cover-brand">
    <div class="cover-eyebrow">${escapeHtml(L.eyebrow)}</div>
  </div>
  <div class="cover-rule"></div>
  <h1>${escapeHtml(L.docTitle)}</h1>
  <h2>${escapeHtml(m.title || '')}</h2>
  <div class="cover-type">${escapeHtml(m.solutionType || '')}${
    profile === 'brief' ? ` <span class="cover-type-sub">· ${escapeHtml(L.briefLabel)}</span>` : ''}</div>
  <div class="meta-grid">
${pairs.map(([k, v]) => `    <div class="kv"><dt>${escapeHtml(k)}</dt>`
    + `<dd>${escapeHtml(v)}</dd></div>`).join('\n')}
  </div>
  <p class="note">${profile === 'brief' ? L.coverNoteBrief : L.coverNote}</p>
  <div class="cover-sign">
    ${brand}
    <div class="cover-org">${escapeHtml(m.organisation || '')}</div>
  </div>
  <div class="cover-foot">
    <div><strong>${escapeHtml(L.meta.preparedBy)}</strong>${escapeHtml(m.preparedBy || '')}</div>
    <div><strong>${escapeHtml(L.meta.technicalOwner)}</strong>${escapeHtml(m.technicalOwner || '')}</div>
    <div><strong>${escapeHtml(L.meta.catalogRef)}</strong>${escapeHtml(m.catalogRef || '')}</div>
  </div>
</section>`;
}

/** Replace the mermaid placeholders with figure elements mermaid.js will fill. */
function restoreDiagrams(html, diagrams, captions) {
  return html.replace(/<!--MERMAID:(\d+)-->/g, (_, i) => {
    const idx = Number(i);
    const caption = captions[idx]
      ? `<figcaption>${escapeHtml(captions[idx])}</figcaption>` : '';
    return `<figure class="mermaid-figure">
  <pre class="mermaid">${escapeHtml(diagrams[idx])}</pre>
  ${caption}
</figure>`;
  });
}

/** Turn `<!--cols:a,b-->` markers into a real <colgroup> on the next table. */
function applyColgroups(html) {
  return html.replace(
    /<!--cols:([^>]*?)-->\s*(<table>)/g,
    (_, classes, tableTag) => {
      const cols = classes.split(',')
        .map((c) => `<col${c ? ` class="${c}"` : ''}>`).join('');
      return `${tableTag}<colgroup>${cols}</colgroup>`;
    },
  ).replace(/<p><!--cols:[^>]*?--><\/p>\s*/g, '');
}

/**
 * Colour priority and severity so they are visible at a glance.
 * Matching is done against the *localised* words, since that is what is in the
 * rendered table by this point.
 */
function applyPriorityClasses(html, L) {
  const map = new Map([
    [L.priority.Must, 'prio-must'],
    [L.priority.Should, 'prio-should'],
    [L.priority.Could, 'prio-could'],
    [L.severity.Critical, 'sev-critical'],
    [L.severity.High, 'sev-high'],
  ]);
  return html.replace(/<td>([^<]{2,12})<\/td>/g, (whole, word) => {
    const cls = map.get(word.trim());
    return cls ? `<td class="${cls}">${word}</td>` : whole;
  });
}

/** Wrap the Scope table so its two columns can be tinted in/out. */
function tagScopeSection(html, L) {
  const title = L.sections.scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(<h2>\\d+\\.\\s*${title}</h2>\\s*)(<table>)`);
  if (!re.test(html)) return html;
  return html
    .replace(re, '$1<div class="section-scope">$2')
    .replace(/(<div class="section-scope"><table>[\s\S]*?<\/table>)/, '$1</div>');
}

module.exports = { markdownToHtml, loadLogo };
