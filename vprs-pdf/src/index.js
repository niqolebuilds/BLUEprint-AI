'use strict';

const fs = require('fs');
const path = require('path');

const { validateSpec } = require('./validate');
const { specToMarkdown, sectionManifest } = require('./markdown');
const { markdownToHtml } = require('./html');
const { htmlToPdf } = require('./pdf');
const { resolveSections, SOLUTION_TYPES } = require('./sections');
const { resolveProfile, PROFILES } = require('./profiles');
const { applyDefaults } = require('./defaults');

/**
 * Generate the Vendor Production Requirement Specification pack.
 *
 * Pipeline:  spec (JSON)  →  validate  →  Markdown  →  HTML  →  PDF
 *
 * Each stage is separately callable, because they have different consumers:
 * Blueprint AI's web app wants the HTML, the vendor's repo wants the Markdown,
 * and procurement wants the PDF.
 *
 * @param {object} args
 * @param {object|string} args.spec        spec object, or path to a .json file
 * @param {string} args.outDir             directory for the outputs
 * @param {string} [args.profile]          'full' (default) or 'brief'
 * @param {boolean} [args.defaults]        merge Group boilerplate (default true)
 * @param {string} [args.basename]         output filename stem
 * @param {boolean} [args.emitMarkdown]    also write the .md  (default true)
 * @param {boolean} [args.emitHtml]        also write the .html (default true)
 * @param {boolean} [args.emitPdf]         write the .pdf       (default true)
 * @param {string[]} [args.diagramCaptions]
 * @param {string} [args.executablePath]   Chromium override
 * @param {string[]} [args.launchArgs]     Chromium launch flags override — for
 *   serverless Chromium builds (e.g. @sparticuz/chromium) that need their own
 *   flag set instead of the two this launches with locally.
 * @returns {Promise<{pdf?:string, html?:string, markdown?:string, manifest:object[]}>}
 */
async function generate(args) {
  const supplied = typeof args.spec === 'string'
    ? JSON.parse(fs.readFileSync(args.spec, 'utf8'))
    : args.spec;

  // Group boilerplate is merged in before validation, so a spec that omits it
  // is still a complete document — and a spec that overrides it still wins.
  const spec = args.defaults === false ? supplied : applyDefaults(supplied);

  const { valid, errors } = validateSpec(spec);
  if (!valid) {
    const err = new Error(
      `Spec failed schema validation:\n  - ${errors.join('\n  - ')}`,
    );
    err.validationErrors = errors;
    throw err;
  }

  const outDir = args.outDir || process.cwd();
  fs.mkdirSync(outDir, { recursive: true });

  const profile = resolveProfile(args.profile);

  const stem = args.basename
    || slug(`${spec.meta.projectId}-${spec.meta.title}`)
      + (profile.name === 'full' ? '' : `-${profile.name}`);

  const markdown = specToMarkdown(spec, profile.name);
  const html = markdownToHtml(markdown, spec, {
    profile: profile.name,
    logoPath: args.logoPath,
    diagramCaptions: args.diagramCaptions
      || (spec.process && spec.process.figureCaption
        ? [spec.process.figureCaption] : []),
  });

  const result = { manifest: sectionManifest(spec, profile.name), profile: profile.name };

  if (args.emitMarkdown !== false) {
    result.markdown = path.join(outDir, `${stem}.md`);
    fs.writeFileSync(result.markdown, markdown, 'utf8');
  }
  if (args.emitHtml !== false) {
    result.html = path.join(outDir, `${stem}.html`);
    fs.writeFileSync(result.html, html, 'utf8');
  }
  if (args.emitPdf !== false) {
    result.pdf = path.join(outDir, `${stem}.pdf`);
    await htmlToPdf({
      html,
      outPath: result.pdf,
      meta: spec.meta,
      logoPath: args.logoPath,
      executablePath: args.executablePath,
      launchArgs: args.launchArgs,
    });
  }

  return result;
}

function slug(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

module.exports = {
  generate,
  PROFILES,
  applyDefaults,
  validateSpec,
  specToMarkdown,
  sectionManifest,
  markdownToHtml,
  htmlToPdf,
  resolveSections,
  SOLUTION_TYPES,
};
