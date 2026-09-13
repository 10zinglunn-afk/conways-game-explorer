import test from 'node:test';
import assert from 'node:assert/strict';
import { createPendingActionStore, validateAccountFields } from './account-flow.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
}

test('account validation covers signup, recovery, and destructive confirmation', () => {
  assert.equal(validateAccountFields({ mode: 'sign-up', email: 'bad', password: 'short' }).valid, false);
  assert.equal(validateAccountFields({ mode: 'recover', email: 'a@b.test', password: 'long-enough-password' }).issues.recoveryKey, 'Enter your recovery key.');
  assert.equal(validateAccountFields({ mode: 'delete', email: 'a@b.test', password: 'long-enough-password', confirmation: 'DELETE' }).valid, true);
});

test('a pending action can be claimed exactly once and explicitly retried', () => {
  const pending = createPendingActionStore(memoryStorage());
  const saved = pending.set({ type: 'comment', body: 'Hello' });
  assert.equal(pending.markAttempted(saved.token).body, 'Hello');
  assert.equal(pending.markAttempted(saved.token), null);
  assert.equal(pending.retry(saved.token).attempted, false);
  assert.ok(pending.markAttempted(saved.token));
  assert.equal(pending.clear(saved.token), true);
  assert.equal(pending.get(), null);
});
