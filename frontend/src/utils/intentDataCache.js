const DEFAULT_INTENT_TTL_MS = 15000;

const intentDataCache = new Map();

export const getIntentData = (key, loader, { ttlMs = DEFAULT_INTENT_TTL_MS } = {}) => {
  if (!key || typeof loader !== 'function') {
    return Promise.resolve().then(loader);
  }

  const now = Date.now();
  const cached = intentDataCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = Promise.resolve().then(loader);
  const entry = {
    promise,
    expiresAt: now + Math.max(1000, Number(ttlMs) || DEFAULT_INTENT_TTL_MS),
  };
  intentDataCache.set(key, entry);

  promise.catch(() => {
    if (intentDataCache.get(key) === entry) {
      intentDataCache.delete(key);
    }
  });

  return promise;
};

export const invalidateIntentData = (keyPrefix = '') => {
  const normalizedPrefix = String(keyPrefix || '');
  if (!normalizedPrefix) {
    intentDataCache.clear();
    return;
  }

  for (const key of intentDataCache.keys()) {
    if (key.startsWith(normalizedPrefix)) {
      intentDataCache.delete(key);
    }
  }
};

export { DEFAULT_INTENT_TTL_MS };
