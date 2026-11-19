// Guards the workflow docs that run_loop.ps1 and every session depend on.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('required docs exist', () => {
  for (const f of ['CLAUDE.md', 'docs/SPEC.md', 'docs/BACKLOG.md', 'docs/DECISIONS.md',
                   'docs/CHANGELOG.md', 'docs/QUESTIONS.md', 'run_loop.ps1']) {
    assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
});

test('every backlog task has a parseable heading, status and acceptance criteria', () => {
  const lines = read('docs/BACKLOG.md').split(/\r?\n/);
  const ids = [];
  lines.forEach((line, i) => {
    const m = line.match(/^###\s+(T\d+)\s+[—-]+\s+(.+)$/);
    if (!m) return;
    ids.push(m[1]);
    const status = lines.slice(i + 1, i + 4).find((l) => /^Status:/.test(l));
    assert.ok(status, `${m[1]}: no Status line within 3 lines of heading`);
    assert.match(status, /^Status:\s*(todo|done|blocked)\b/, `${m[1]}: bad status "${status}"`);
    const next = lines.findIndex((l, j) => j > i && /^###\s/.test(l));
    const body = lines.slice(i, next === -1 ? undefined : next).join('\n');
    assert.match(body, /^AC:/m, `${m[1]}: missing AC: section`);
  });
  assert.ok(ids.length > 0, 'no tasks found');
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate task IDs');
});

test('run_loop.ps1 is ASCII-only (Windows PowerShell 5.1 reads BOM-less files as ANSI)', () => {
  const buf = fs.readFileSync(path.join(root, 'run_loop.ps1'));
  const bad = buf.findIndex((b) => b > 0x7f);
  assert.strictEqual(bad, -1, `non-ASCII byte at offset ${bad}`);
});
