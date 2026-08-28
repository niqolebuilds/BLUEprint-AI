'use strict';

/**
 * Markdown emit helpers.
 *
 * Everything the section registry produces goes through here, so table
 * escaping and column-class conventions live in exactly one place.
 */

/** Pipes inside a GFM table cell break the row. Escape them. */
function escapePipes(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br/>');
}

/**
 * A GFM table.
 * @param {string[]} headers
 * @param {Array<Array<string>>} rows
 * @param {string[]} [colClasses] optional per-column class, emitted as a
 *        colgroup marker consumed by src/html.js so print widths can be tuned.
 */
function table(headers, rows, colClasses) {
  const head = `| ${headers.map(escapePipes).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((r) => `| ${r.map(escapePipes).join(' | ')} |`)
    .join('\n');
  const marker = colClasses && colClasses.length
    ? `\n<!--cols:${colClasses.join(',')}-->`
    : '';
  return `${marker}\n${head}\n${sep}\n${body}`.trim();
}

/**
 * A requirement table. Identical to `table` but wraps IDs in a styled span so
 * FR-/BR-/EX- identifiers read as identifiers rather than as prose.
 */
function idTable(headers, rows) {
  const styled = rows.map((r) => {
    const [first, ...rest] = r;
    return [`<span class="req-id">${escapePipes(first)}</span>`, ...rest];
  });
  const classes = headers.map((h, i) => {
    if (i === 0) return 'col-id';
    if (/^priority$/i.test(h) || /^severity$/i.test(h)) return 'col-priority';
    if (/^owner$/i.test(h) || /^due$/i.test(h) || /needed by/i.test(h)) return 'col-owner';
    return '';
  });
  return table(headers, styled, classes);
}

/**
 * A key/value metadata grid.
 *
 * Two columns by default. When any value runs long — a paragraph of prose
 * rather than a field value — the grid drops to one column, because side-by-side
 * cells of unequal prose produce a ragged, hard-to-scan block.
 */
function kvGrid(pairs) {
  const kept = pairs.filter(
    ([, v]) => v !== undefined && v !== null && String(v).trim() !== '',
  );
  const longest = kept.reduce((n, [, v]) => Math.max(n, String(v).length), 0);
  const cls = longest > 90 ? 'meta-grid meta-grid--single' : 'meta-grid';
  const rows = kept.map(([k, v]) => `<div class="kv"><dt>${escapeHtml(k)}</dt>`
    + `<dd>${escapeHtml(v)}</dd></div>`);
  return `<div class="${cls}">\n${rows.join('\n')}\n</div>`;
}

function bullets(items) {
  return items.map((i) => `- ${i}`).join('\n');
}

function defList(pairs) {
  return pairs.map(([k, v]) => `**${k}** — ${v}`).join('\n\n');
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  table, idTable, kvGrid, bullets, defList, escapePipes, escapeHtml,
};
