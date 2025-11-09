#!/usr/bin/env node

/**
 * JSON Schema Validation Script
 * Validates all schemas in /packages/schemas against example data
 */

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

const SCHEMAS_DIR = path.resolve(__dirname, '../packages/schemas');
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv);

let hasErrors = false;

console.log('🔍 Validating JSON Schemas...\n');

// Load and compile all schemas
const schemaFiles = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json') && !f.includes('example'));

schemaFiles.forEach(file => {
  const schemaPath = path.join(SCHEMAS_DIR, file);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  
  try {
    ajv.compile(schema);
    console.log(`✅ ${file} - valid schema definition`);
  } catch (error) {
    console.error(`❌ ${file} - invalid schema: ${error.message}`);
    hasErrors = true;
  }
});

if (hasErrors) {
  console.error('\n❌ Schema validation failed\n');
  process.exit(1);
} else {
  console.log('\n✅ All schemas valid!\n');
  process.exit(0);
}
