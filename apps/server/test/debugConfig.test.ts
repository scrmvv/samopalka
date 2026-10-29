import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDebugToolsEnabled } from '../src/debugConfig.js';

test('закрытая бета: тестовая панель включена по умолчанию', () => {
  assert.equal(isDebugToolsEnabled(undefined), true);
  assert.equal(isDebugToolsEnabled('1'), true);
});

test('для публичного запуска DEBUG_TOOLS=0 выключает панель', () => {
  assert.equal(isDebugToolsEnabled('0'), false);
});
