import assert from 'node:assert/strict';
import { isRenderProfilingEnabled, recordRenderProfile } from '../src/utils/renderProfiler.js';

const stored = new Map();
globalThis.window = {
  location: { search: '?profile_renders=1' },
  sessionStorage: {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: (key) => stored.delete(key),
  },
};

assert.equal(isRenderProfilingEnabled(), true);
recordRenderProfile('page:members', 'mount', 12.5, 20, 1, 15);
recordRenderProfile('page:members', 'update', 3.5, 20, 20, 24);
assert.deepEqual(globalThis.window.__gymvaultRenderProfile.pages['page:members'], {
  commits: 2,
  mounts: 1,
  updates: 1,
  totalActualDurationMs: 16,
  maxActualDurationMs: 12.5,
  lastActualDurationMs: 3.5,
  lastBaseDurationMs: 20,
  lastStartTimeMs: 20,
  lastCommitTimeMs: 24,
  lastPhase: 'update',
});

globalThis.window.location.search = '?profile_renders=0';
assert.equal(isRenderProfilingEnabled(), false);
console.log('Render profiler enablement and aggregate metrics checks passed.');