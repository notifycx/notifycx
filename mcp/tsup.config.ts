import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true
  // Shebang lives in src/index.ts only; do not add banner.js or output gets two lines.
});
