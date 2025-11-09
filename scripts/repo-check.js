#!/usr/bin/env node

/**
 * Repository Hygiene Checker
 * Enforces file placement rules for IndianWalls monorepo.
 * Fails CI if violations are detected.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
let violations = [];

// Get all tracked files from git
function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch (error) {
    console.error('Error getting tracked files:', error.message);
    process.exit(1);
  }
}

// Check for markdown files outside /docs (except root README.md)
function checkMarkdownPlacement(files) {
  const invalidMarkdown = files.filter(file => {
    return (
      file.endsWith('.md') &&
      file !== 'README.md' &&
      !file.startsWith('docs/')
    );
  });

  if (invalidMarkdown.length > 0) {
    violations.push({
      rule: 'Markdown files must be in /docs/** (except root README.md)',
      files: invalidMarkdown,
    });
  }
}

// Check for backend code outside /apps/worker
function checkBackendPlacement(files) {
  const backendPatterns = [
    /^(?!apps\/worker\/).*\/(pipeline|jobs|workers|queue|fetchers)\//,
    /^(?!apps\/worker\/).*worker.*\.ts$/,
  ];

  const invalidBackend = files.filter(file => {
    return backendPatterns.some(pattern => pattern.test(file));
  });

  if (invalidBackend.length > 0) {
    violations.push({
      rule: 'Backend code must be in /apps/worker/**',
      files: invalidBackend,
    });
  }
}

// Check for frontend code outside /apps/web
function checkFrontendPlacement(files) {
  const frontendPatterns = [
    /^(?!apps\/web\/).*\/(components|app|pages|styles)\//,
  ];

  const invalidFrontend = files.filter(file => {
    return frontendPatterns.some(pattern => pattern.test(file));
  });

  if (invalidFrontend.length > 0) {
    violations.push({
      rule: 'Frontend code must be in /apps/web/**',
      files: invalidFrontend,
    });
  }
}

// Check for generated files that shouldn't be tracked
function checkGeneratedFiles(files) {
  const generatedFiles = files.filter(file => {
    return file.startsWith('generated/');
  });

  if (generatedFiles.length > 0) {
    violations.push({
      rule: 'Generated files in /generated/** must never be committed',
      files: generatedFiles,
    });
  }
}

// Check for config files at wrong locations
function checkConfigPlacement(files) {
  const configPatterns = [
    '.eslintrc',
    '.prettierrc',
    'jest.config',
    'vitest.config',
  ];

  const invalidConfig = files.filter(file => {
    const basename = path.basename(file);
    return (
      configPatterns.some(pattern => basename.includes(pattern)) &&
      !file.startsWith('config/') &&
      !file.startsWith('apps/') &&
      file !== basename // Allow at root for workspace-level configs
    );
  });

  if (invalidConfig.length > 0) {
    violations.push({
      rule: 'Config files should be in /config/** or at workspace root',
      files: invalidConfig,
    });
  }
}

// Main execution
function main() {
  console.log('🔍 Running repository hygiene checks...\n');

  const files = getTrackedFiles();

  checkMarkdownPlacement(files);
  checkBackendPlacement(files);
  checkFrontendPlacement(files);
  checkGeneratedFiles(files);
  checkConfigPlacement(files);

  if (violations.length === 0) {
    console.log('✅ All repository hygiene checks passed!\n');
    process.exit(0);
  } else {
    console.error('❌ Repository hygiene violations detected:\n');
    violations.forEach(({ rule, files }) => {
      console.error(`\n📋 Rule: ${rule}`);
      console.error(`   Violating files (${files.length}):`);
      files.forEach(file => console.error(`     - ${file}`));
    });
    console.error('\n💡 Fix these violations before committing.\n');
    process.exit(1);
  }
}

main();
