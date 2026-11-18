import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceDir = join(__dirname, '..', 'src');

const forbiddenImports = [
  '@nestjs/',
  'react',
  'react-dom',
  'express',
  'node:http',
  'node:https',
  'node:fs',
  'node:path',
  'node:sqlite',
];

function sourceFiles(): string[] {
  return readdirSync(sourceDir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(sourceDir, file));
}

describe('@cbr/core isolation', () => {
  it('imports neither HTTP/browser frameworks nor filesystem or SQLite modules', () => {
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      for (const forbidden of forbiddenImports) {
        expect(source, `${file} must not import ${forbidden}`).not.toContain(`from '${forbidden}`);
      }
    }
  });

  it('does not reference browser globals', () => {
    for (const file of sourceFiles()) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${file} must not use document`).not.toMatch(/\bdocument\./);
      expect(source, `${file} must not use window`).not.toMatch(/\bwindow\./);
    }
  });
});
