#!/usr/bin/env node
'use strict';

const path = require('path');
const { generate, validateSpec } = require('../src/index');

const USAGE = `
blueprint-pdf — Vendor Production Requirement Specification generator

  Usage:
    blueprint-pdf <spec.json> [options]

  Options:
    -p, --profile <name>  full (default) or brief
    -o, --out <dir>       Output directory              (default: ./out)
    -n, --name <stem>     Output filename stem          (default: derived)
        --no-md           Skip the Markdown output
        --no-html         Skip the HTML output
        --no-pdf          Skip the PDF output
        --no-defaults     Do not merge Group boilerplate (src/defaults.js)
        --logo <path>     Brand mark for the cover and page header
                          (default: src/theme/logo.png)
        --manifest        Print the section hydration manifest
        --validate-only   Validate the spec and exit
        --chromium <path> Chromium executable override
    -h, --help            Show this message

  Exit codes:
    0  success
    1  schema validation failed
    2  render failed
`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  const specPath = argv.find((a) => !a.startsWith('-'));
  if (!specPath) {
    process.stderr.write('error: no spec file given\n');
    process.exit(1);
  }

  const opt = (long, short) => {
    const i = argv.findIndex((a) => a === long || a === short);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const outDir = path.resolve(opt('--out', '-o') || './out');
  const spec = require(path.resolve(specPath));

  if (argv.includes('--validate-only')) {
    const { valid, errors } = validateSpec(spec);
    if (valid) {
      process.stdout.write('✔ spec is valid\n');
      process.exit(0);
    }
    process.stderr.write(`✘ spec is invalid:\n  - ${errors.join('\n  - ')}\n`);
    process.exit(1);
  }

  try {
    const res = await generate({
      spec,
      outDir,
      profile: opt('--profile', '-p'),
      defaults: !argv.includes('--no-defaults'),
      basename: opt('--name', '-n'),
      emitMarkdown: !argv.includes('--no-md'),
      emitHtml: !argv.includes('--no-html'),
      emitPdf: !argv.includes('--no-pdf'),
      logoPath: opt('--logo') ? path.resolve(opt('--logo')) : undefined,
      executablePath: opt('--chromium'),
    });

    if (argv.includes('--manifest')) {
      process.stdout.write(`\nSection hydration manifest — profile: ${res.profile}\n`);
      process.stdout.write(`${'-'.repeat(78)}\n`);
      for (const row of res.manifest) {
        const mark = row.status === 'RENDERED' ? '✔' : '·';
        process.stdout.write(
          `${mark} ${row.title.padEnd(42)} ${row.status.padEnd(9)} ${row.reason}\n`,
        );
      }
      process.stdout.write('\n');
    }

    for (const k of ['markdown', 'html', 'pdf']) {
      if (res[k]) process.stdout.write(`✔ ${k.padEnd(8)} ${res[k]}\n`);
    }
    process.exit(0);
  } catch (err) {
    if (err.validationErrors) {
      process.stderr.write(`✘ ${err.message}\n`);
      process.exit(1);
    }
    process.stderr.write(`✘ render failed: ${err.stack || err.message}\n`);
    process.exit(2);
  }
}

main();
