const { AsyncLocalStorage } = require('node:async_hooks');

const tenantContextStorage = new AsyncLocalStorage();

const normalizePositiveInteger = (value) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const runWithTenantDbContext = (context, callback) => {
    const gymId = normalizePositiveInteger(context?.gymId);
    if (!gymId) {
        throw new TypeError('A valid gymId is required for tenant database context.');
    }

    const tenantContext = Object.freeze({
        gymId,
        actorId: normalizePositiveInteger(context?.actorId),
        actorRole: String(context?.actorRole || '').trim().toUpperCase(),
    });

    return tenantContextStorage.run(tenantContext, callback);
};

const getTenantDbContext = () => tenantContextStorage.getStore() || null;

module.exports = {
    getTenantDbContext,
    runWithTenantDbContext,
};