// Persistent stale-while-revalidate snapshot of a page's derived state.
// Lets a page repaint instantly from the last successful load when it remounts
// after navigation, then quietly revalidate in the background.

const SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const store = new Map();

const buildSessionScope = (currentUser) => {
  const gymId = Number(currentUser?.gym_id);
  const userId = Number(currentUser?.id);
  return Number.isInteger(gymId) && Number.isInteger(userId) ? `${gymId}:${userId}` : '';
};

export const buildPageStateKey = ({ page, currentUser, branchScopeValue, signature = '' } = {}) => {
  const scope = buildSessionScope(currentUser);
  if (!scope || !page) return '';
  return ['page-state', scope, String(branchScopeValue || 'all').toLowerCase(), page, signature].join(':');
};

export const readPageStateSnapshot = (key) => {
  if (!key) return null;
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.data;
};

export const writePageStateSnapshot = (key, data) => {
  if (!key || data === undefined) return;
  store.set(key, { data, expiresAt: Date.now() + SNAPSHOT_TTL_MS });
};

export const clearPageStateSnapshots = (prefix = '') => {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

export { SNAPSHOT_TTL_MS };
