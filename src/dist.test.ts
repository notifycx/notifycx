import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';

function countShebangLines(content: string): number {
  return content
    .split('\n')
    .filter((line) => line.trim() === '#!/usr/bin/env node').length;
}

describe('notifycx library dist', () => {
  for (const file of ['dist/index.js', 'dist/index.mjs'] as const) {
    it(`${file} has no shebang (library, not a CLI)`, () => {
      assert.ok(existsSync(file), `${file} missing; run npm run build first`);
      const content = readFileSync(file, 'utf8');
      assert.equal(
        countShebangLines(content),
        0,
        `${file} must not include a shebang`
      );
    });
  }
});
