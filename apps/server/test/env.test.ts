import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectEnv, projectEnvPath } from '../src/env.js';

test('env: default path is the project root, not the workspace cwd', () => {
  assert.equal(projectEnvPath, fileURLToPath(new URL('../../../.env', import.meta.url)));
});

test('env: loads values, quotes and UTF-8, while preserving existing variables', () => {
  const dir = mkdtempSync(join(tmpdir(), 'samopalka-env-'));
  const keys = ['SAMOPALKA_ENV_TEST_VALUE', 'SAMOPALKA_ENV_TEST_EXISTING', 'SAMOPALKA_ENV_TEST_EMPTY'];
  const old = keys.map(key => process.env[key]);
  try {
    delete process.env[keys[0]];
    process.env[keys[1]] = 'system';
    process.env[keys[2]] = '';
    const file = join(dir, '.env');
    writeFileSync(file, `${keys[0]}="пароль # 123"\r\n${keys[1]}=file\r\n${keys[2]}=file\r\n`);
    loadProjectEnv(file);
    assert.equal(process.env[keys[0]], 'пароль # 123');
    assert.equal(process.env[keys[1]], 'system');
    assert.equal(process.env[keys[2]], '');
  } finally {
    keys.forEach((key, i) => { if (old[i] === undefined) delete process.env[key]; else process.env[key] = old[i]; });
    rmSync(dir, { recursive: true, force: true });
  }
});

test('env: absent file is optional; other I/O errors are not hidden', () => {
  const dir = mkdtempSync(join(tmpdir(), 'samopalka-env-'));
  try {
    assert.doesNotThrow(() => loadProjectEnv(join(dir, '.env')));
    assert.throws(() => loadProjectEnv(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
