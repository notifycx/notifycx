import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const distPath = join(dirname(fileURLToPath(import.meta.url)), '../dist/index.js');

function countShebangLines(content: string): number {
  return content
    .split('\n')
    .filter((line) => line.trim() === '#!/usr/bin/env node').length;
}

describe('notifycx-mcp dist/index.js', () => {
  it('has exactly one shebang line', () => {
    const content = readFileSync(distPath, 'utf8');
    assert.equal(
      countShebangLines(content),
      1,
      'CLI entry must have a single #!/usr/bin/env node line'
    );
  });

  it('parses without syntax error', () => {
    const result = spawnSync(process.execPath, ['--check', distPath], {
      encoding: 'utf8'
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || 'node --check failed'
    );
  });

  it('starts without a syntax error (stdio MCP server)', () => {
    const result = spawnSync(process.execPath, [distPath], {
      env: { ...process.env, NOTIFY_API_KEY: 'nk_dummy_test_key' },
      encoding: 'utf8',
      timeout: 1500
    });
    const combined = `${result.stderr ?? ''}${result.stdout ?? ''}`;
    assert.ok(
      !combined.includes('SyntaxError'),
      `unexpected syntax error: ${combined}`
    );
  });
});
