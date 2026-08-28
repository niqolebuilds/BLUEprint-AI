'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright-core');

const { loadLogo } = require('./html');
const { resolveLocale } = require('./locales');

const MERMAID_JS = require.resolve('mermaid/dist/mermaid.min.js');

/**
 * Render an HTML string to a PDF file.
 *
 * Two things this does that a naive html->pdf does not:
 *   1. Waits for mermaid to finish drawing before printing. Chromium will
 *      happily print an empty <pre> if you don't.
 *   2. Measures each rendered diagram and, when one is taller than roughly
 *      half a page, forces it onto its own page. Otherwise Chromium either
 *      splits the diagram or leaves a large white gap above it.
 *
 * @param {object} args
 * @param {string} args.html      complete HTML document
 * @param {string} args.outPath   destination .pdf path
 * @param {object} args.meta      spec.meta, used for the running footer
 * @param {string} [args.executablePath] override Chromium binary
 */
async function htmlToPdf({
  html, outPath, meta = {}, executablePath, logoPath, launchArgs,
}) {
  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'bp-pdf-')),
    'doc.html',
  );
  fs.writeFileSync(tmp, html, 'utf8');

  // launchArgs lets a caller merge in the flags a serverless Chromium build
  // needs (e.g. @sparticuz/chromium's recommended args on Vercel) without
  // this module knowing anything about the hosting environment. Defaults to
  // the same two flags this always launched with.
  const launchOpts = { args: launchArgs || ['--no-sandbox', '--font-render-hinting=none'] };
  const resolved = executablePath
    || process.env.BLUEPRINT_CHROMIUM
    || discoverChromium();
  if (resolved) launchOpts.executablePath = resolved;

  const browser = await chromium.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.goto(`file://${tmp}`, { waitUntil: 'load' });

    const hasDiagrams = await page.locator('pre.mermaid').count();
    if (hasDiagrams > 0) {
      await page.addScriptTag({ path: MERMAID_JS });
      await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        window.mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          fontFamily: 'Inter, Segoe UI, Helvetica, Arial, sans-serif',
          themeVariables: {
            primaryColor: '#eef2ff',
            primaryTextColor: '#111827',
            primaryBorderColor: '#1e3a8a',
            lineColor: '#475569',
            secondaryColor: '#f3f4f6',
            tertiaryColor: '#ffffff',
            fontSize: '17px',
            actorBkg: '#eef2ff',
            actorBorder: '#1e3a8a',
            actorTextColor: '#172554',
            signalColor: '#334155',
            signalTextColor: '#111827',
            labelBoxBkgColor: '#f3f4f6',
            labelBoxBorderColor: '#cbd5e1',
            noteBkgColor: '#fffbeb',
            noteBorderColor: '#b45309',
          },
          // Narrower participant boxes shrink the diagram's natural width,
          // which raises the fit-to-page scale factor and so raises the
          // *effective* font size on paper. Counter-intuitive but decisive:
          // a wide diagram scaled to 0.5 prints its 17px label at ~6pt.
          sequence: {
            useMaxWidth: true,
            wrap: true,
            width: 145,
            boxMargin: 8,
            actorMargin: 34,
            messageFontSize: 15,
            actorFontSize: 15,
            noteFontSize: 14,
          },
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
        });
        // eslint-disable-next-line no-undef
        await window.mermaid.run({ querySelector: 'pre.mermaid' });
      });
      await page.waitForFunction(
        () => document.querySelectorAll('pre.mermaid svg').length
          === document.querySelectorAll('pre.mermaid').length,
        null,
        { timeout: 30000 },
      );

      // A4 content height at the configured margins is ~255mm ≈ 964px @96dpi.
      // A diagram taller than half a page starts its own page — but the break
      // goes on the heading above it, not on the figure. Breaking on the
      // figure alone strands the heading at the foot of the previous page.
      await page.evaluate(() => {
        const PAGE_PX = 964;
        document.querySelectorAll('.mermaid-figure').forEach((fig) => {
          if (fig.getBoundingClientRect().height <= PAGE_PX * 0.55) return;
          const prev = fig.previousElementSibling;
          if (prev && /^H[23]$/.test(prev.tagName)) prev.classList.add('tall-lead');
          else fig.classList.add('tall');
        });
      });
    }

    await page.emulateMedia({ media: 'print' });

    const logo = loadLogo(logoPath || meta.logoPath);
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: buildHeader(meta, logo),
      footerTemplate: buildFooter(meta, resolveLocale(meta.language)),
      // Margins are NOT set here. Passing them to page.pdf() overrides the
      // stylesheet's @page rules, which kills `@page :first` — and that rule is
      // what suppresses the running header on the cover, where the page carries
      // its own larger brand block. Margins live in src/theme/print.css.
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }

  return outPath;
}

/**
 * Find a usable Chromium without requiring `playwright install`.
 *
 * Enterprise build agents often have a Chromium already on disk under a
 * different revision than the one playwright-core expects. Rather than fail
 * with playwright's "just installed or updated" banner, look for one.
 * Order: PLAYWRIGHT_BROWSERS_PATH tree, then the usual system locations.
 */
function discoverChromium() {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers']
    .filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root)
      .filter((d) => d.startsWith('chromium'))
      .sort()
      .reverse();
    for (const d of dirs) {
      for (const rel of [
        'chrome-linux/chrome',
        'chrome-linux/headless_shell',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        'chrome-win/chrome.exe',
      ]) {
        const p = path.join(root, d, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  for (const p of [
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return undefined; // let playwright-core try its own default
}

/*
 * Running header and footer.
 *
 * Chromium renders these templates in an isolated context with no access to the
 * page's stylesheet, so everything is inline and every length is absolute.
 * Images must be data URIs — a file:// or http src prints blank.
 *
 * Two rules keep them tidy, both learned the hard way:
 *
 *   1. Say each thing once. The header carries identity (mark, project ID,
 *      classification); the footer carries position (title, page). Repeating
 *      the version and classification in the footer made two dense blocks that
 *      collided in the middle of the line.
 *   2. The page number must never wrap. It is the one element whose width is
 *      fixed and whose meaning breaks when it folds, so it gets `nowrap` and
 *      `flex:0 0 auto`, and the title beside it truncates with an ellipsis
 *      instead of pushing it.
 *
 * The rule is on an inner element so it aligns to the text margin rather than
 * running edge to edge behind the page padding.
 */

const CHROME = 'font-family:Inter,\'Segoe UI\',Helvetica,Arial,sans-serif';

function buildHeader(meta, logo) {
  const mark = logo
    ? `<img src="${logo}" style="height:6.5mm;width:auto;display:block">`
    : `<span style="font-weight:700;color:#1e3a8a;font-size:8pt">${
      esc(meta.organisation || '')}</span>`;
  const right = [meta.projectId, meta.classification].filter(Boolean)
    .map(esc).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  return `<div style="${CHROME};width:100%;padding:0 16mm;font-size:7.5pt;
      color:#9ca3af;display:flex;justify-content:space-between;
      align-items:center;gap:8mm">
    <span style="flex:0 0 auto">${mark}</span>
    <span style="flex:0 1 auto;white-space:nowrap;overflow:hidden;
        text-overflow:ellipsis">${right}</span>
  </div>`;
}

function buildFooter(meta, L) {
  const label = L?.page || 'Page';
  return `<div style="${CHROME};width:100%;padding:0 16mm;font-size:7.5pt;
      color:#9ca3af">
    <div style="border-top:1px solid #e5e7eb;padding-top:2.5mm;display:flex;
        justify-content:space-between;align-items:baseline;gap:10mm">
      <span style="flex:0 1 auto;white-space:nowrap;overflow:hidden;
          text-overflow:ellipsis">${esc(meta.title || '')}</span>
      <span style="flex:0 0 auto;white-space:nowrap">${esc(label)}
        <span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span></span>
    </div>
  </div>`;
}

function esc(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = { htmlToPdf };
