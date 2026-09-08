'use strict';

const { resolveSections, SECTIONS } = require('./sections');
const { resolveLocale } = require('./locales');
const { resolveProfile } = require('./profiles');

/**
 * Render a validated VPRS spec object to Markdown.
 *
 * The Markdown is a first-class deliverable in its own right: it is what the
 * vendor reviews in a pull request, what diffs cleanly between versions, and
 * what the HTML/PDF stage consumes. Nothing in the PDF exists that is not in
 * this Markdown.
 *
 * @param {object} spec
 * @param {string} [profileName] 'full' (default) or 'brief'
 * @returns {string} Markdown
 */
function specToMarkdown(spec, profileName) {
  const m = spec.meta || {};
  const L = resolveLocale(m.language);
  const profile = resolveProfile(profileName);
  const out = [];

  out.push(`# ${L.docTitle}`);
  out.push(`## ${m.title || ''}`);

  for (const { section, number, render } of resolveSections(spec, profile)) {
    out.push(`## ${number}. ${L.sections[section.key]}`);
    out.push(render(spec, L));
  }

  return `${out.join('\n\n')}\n`;
}

/**
 * The section manifest for a spec — which sections hydrated, which were
 * omitted, and why. Emitted by the CLI with --manifest so the reader can see
 * that omission was a decision rather than an oversight.
 */
function sectionManifest(spec, profileName) {
  const solutionType = spec?.meta?.solutionType;
  const L = resolveLocale(spec?.meta?.language);
  const profile = resolveProfile(profileName);
  const rows = [];
  let n = 0;
  for (const section of SECTIONS) {
    const applies = section.appliesTo === null
      || section.appliesTo.includes(solutionType);
    let status;
    let reason;
    if (!applies) {
      status = 'OMITTED';
      reason = `Not applicable to Solution Type "${solutionType}"`;
    } else if (!profile.includes(section.key)) {
      status = 'OMITTED';
      reason = `Not in the "${profile.name}" profile`;
    } else if (section.isEmpty(spec)) {
      status = 'OMITTED';
      reason = 'No content supplied for this section';
    } else {
      n += 1;
      status = 'RENDERED';
      reason = profile.compact && section.renderBrief
        ? `Printed as section ${n} (compact)`
        : `Printed as section ${n}`;
    }
    rows.push({
      key: section.key, title: L.sections[section.key], status, reason,
    });
  }
  return rows;
}

module.exports = { specToMarkdown, sectionManifest };
