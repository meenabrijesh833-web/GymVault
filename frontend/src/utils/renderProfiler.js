const PROFILE_QUERY_KEY = 'profile_renders';
const PROFILE_SESSION_KEY = 'gymvault:profile-renders';

const getSessionStorage = () => {
  try {
    return globalThis.window?.sessionStorage || null;
  } catch {
    return null;
  }
};

export const isRenderProfilingEnabled = () => {
  if (!globalThis.window) return false;

  const storage = getSessionStorage();
  const queryValue = new URLSearchParams(globalThis.window.location?.search || '').get(PROFILE_QUERY_KEY);
  if (queryValue === '1') storage?.setItem(PROFILE_SESSION_KEY, '1');
  if (queryValue === '0') storage?.removeItem(PROFILE_SESSION_KEY);
  return queryValue === '1' || (queryValue !== '0' && storage?.getItem(PROFILE_SESSION_KEY) === '1');
};

export const recordRenderProfile = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  if (!isRenderProfilingEnabled()) return;

  const root = globalThis.window;
  const profile = root.__gymvaultRenderProfile || { startedAt: new Date().toISOString(), pages: {} };
  const previous = profile.pages[id] || {
    commits: 0,
    mounts: 0,
    updates: 0,
    totalActualDurationMs: 0,
    maxActualDurationMs: 0,
  };
  const normalizedActualDuration = Math.max(0, Number(actualDuration) || 0);

  profile.pages[id] = {
    ...previous,
    commits: previous.commits + 1,
    mounts: previous.mounts + (phase === 'mount' ? 1 : 0),
    updates: previous.updates + (phase === 'update' ? 1 : 0),
    totalActualDurationMs: previous.totalActualDurationMs + normalizedActualDuration,
    maxActualDurationMs: Math.max(previous.maxActualDurationMs, normalizedActualDuration),
    lastActualDurationMs: normalizedActualDuration,
    lastBaseDurationMs: Math.max(0, Number(baseDuration) || 0),
    lastStartTimeMs: Math.max(0, Number(startTime) || 0),
    lastCommitTimeMs: Math.max(0, Number(commitTime) || 0),
    lastPhase: String(phase || ''),
  };
  root.__gymvaultRenderProfile = profile;
};