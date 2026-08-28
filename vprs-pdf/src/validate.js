'use strict';

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const SCHEMA_PATH = path.join(__dirname, '..', 'schema', 'vprs.schema.json');

/**
 * Validate a spec object against the VPRS contract.
 *
 * This is the boundary between Blueprint AI's generation step and the document
 * renderer. The renderer trusts the spec completely, so the schema has to be
 * where malformed AI output is caught — not a try/catch further downstream.
 *
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateSpec(spec) {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(spec);
  const errors = (validate.errors || []).map(
    (e) => `${e.instancePath || '(root)'} ${e.message}`
      + (e.params && e.params.allowedValues
        ? ` — allowed: ${e.params.allowedValues.join(', ')}` : ''),
  );
  return { valid, errors };
}

module.exports = { validateSpec, SCHEMA_PATH };
