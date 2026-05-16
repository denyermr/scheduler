#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const RED = '\x1b[31m';
const RESET = '\x1b[0m';

function listStagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /\.(ts|tsx)$/.test(s))
    .filter((p) => existsSync(p));
}

const ANY_TOKEN = /(^|[^A-Za-z0-9_$])any([^A-Za-z0-9_$]|$)/;
const ANY_TYPE_CTX = /[:<,(](\s*)any(\s*)([>),\[\]|&;=]|$)|as\s+any(\s|$|;|\))/;
const DISABLE_RE = /\/\/\s*eslint-disable-next-line[^\n]*--\s*\S+/;

function findViolations(file) {
  const errors = [];
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (/(^|[^A-Za-z0-9_$])console\.log\s*\(/.test(line)) {
      errors.push(`${file}:${lineNo}: console.log is not allowed`);
    }

    if (ANY_TOKEN.test(line) && ANY_TYPE_CTX.test(line)) {
      const codeBefore = line.split('//')[0];
      if (!ANY_TYPE_CTX.test(codeBefore)) continue;

      const prev = i > 0 ? lines[i - 1] : '';
      if (DISABLE_RE.test(prev)) continue;

      errors.push(
        `${file}:${lineNo}: bare \`any\` requires \`// eslint-disable-next-line <rule> -- <reason>\` on the line above`,
      );
    }
  }

  return errors;
}

const files = listStagedFiles();
const allErrors = files.flatMap(findViolations);

if (allErrors.length > 0) {
  console.error(`${RED}pre-commit guard failed:${RESET}`);
  for (const e of allErrors) console.error(`  ${e}`);
  process.exit(1);
}
