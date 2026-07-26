const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(workspaceRoot, '.env') });

const { adminPool } = require('../../backend/config/db');
const {
    routeRequestSchema,
    strictBody,
    validateBodyField,
    validateQueryValue,
    validateRouteParamValue,
} = require('../../backend/middleware/strictRequest');

const routesDirectory = path.join(workspaceRoot, 'backend', 'routes');
const routeFiles = fs.readdirSync(routesDirectory)
    .filter((entry) => entry.endsWith('.js'))
    .sort();
const FLEXIBLE_PROVIDER_BODIES = new Set([
    'settings.js POST /platform/whatsapp-delivery/webhook',
]);
const MUTATION_METHODS = new Set(['DELETE', 'PATCH', 'POST', 'PUT']);

const invokeMiddleware = (middleware, req) => {
    let nextCalled = false;
    const response = {
        statusCode: 200,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
            return this;
        },
    };
    middleware(req, response, () => {
        nextCalled = true;
    });
    return { nextCalled, response };
};

const testValidationPrimitives = () => {
    assert.equal(validateBodyField('member_ids', [1, 2]), true);
    assert.equal(validateBodyField('member_ids', '1,2'), false);
    assert.equal(validateBodyField('member_id', '12'), true);
    assert.equal(validateBodyField('member_id', '12x'), false);
    assert.equal(validateBodyField('enabled', 'true'), true);
    assert.equal(validateBodyField('enabled', 'sometimes'), false);
    assert.equal(validateBodyField('legal_acceptance', true), true);
    assert.equal(validateBodyField('legal_acceptance', 'yes'), false);
    assert.equal(validateBodyField('email', 'owner@example.com'), true);
    assert.equal(validateBodyField('email', 'owner@invalid'), false);
    assert.equal(validateBodyField('keys', { p256dh: 'public-key', auth: 'auth-key' }), true);
    assert.equal(validateBodyField('keys', { p256dh: 'public-key', auth: 'auth-key', secret: 'unexpected' }), false);
    assert.equal(validateBodyField('items', [{ product_id: 1, quantity: 2 }]), true);
    assert.equal(validateBodyField('items', [{ product_id: '1x', quantity: 2 }]), false);
    assert.equal(validateBodyField('branch_directory', [{ id: 'branch-1', name: 'Main', address: '', phone: '' }]), true);
    assert.equal(validateBodyField('branch_directory', [{ id: 'branch-1', name: 'Main', executable: true }]), false);
    assert.equal(validateBodyField('member_ids', [1, '2']), true);
    assert.equal(validateBodyField('member_ids', [1, '2x']), false);
    assert.equal(validateBodyField('feature_flags', { attendance: true }), true);
    assert.equal(validateBodyField('feature_flags', { attendance: 'enabled' }), false);
    assert.equal(validateBodyField('advanced_rules', { booking_window_days: 14 }), true);
    assert.equal(validateBodyField('repeat_days', [1, '3', 5]), true);
    assert.equal(validateBodyField('repeat_days', [1, 7]), false);
    assert.equal(validateQueryValue('limit', '50'), true);
    assert.equal(validateQueryValue('limit', '50x'), false);
    assert.equal(validateQueryValue('branch_id', 'branch-1'), true);
    assert.equal(validateQueryValue('branch_id', 'all'), true);
    assert.equal(validateQueryValue('branch_id', 'branch/1'), false);
    assert.equal(validateQueryValue('refresh', 'true'), true);
    assert.equal(validateQueryValue('refresh', 'sometimes'), false);
    assert.equal(validateRouteParamValue('id', '42'), true);
    assert.equal(validateRouteParamValue('id', '42x'), false);

    const typedBody = strictBody(['member_id', 'enabled', 'email']);
    const invalidBodyResult = invokeMiddleware(typedBody, {
        method: 'POST',
        originalUrl: '/schema-check',
        body: { member_id: '12x', enabled: 'sometimes', email: 'invalid' },
        headers: {},
        socket: {},
    });
    assert.equal(invalidBodyResult.nextCalled, false);
    assert.equal(invalidBodyResult.response.statusCode, 400);
    assert.equal(invalidBodyResult.response.payload.code, 'REQUEST_SCHEMA_INVALID');

    const requiredBody = strictBody(['email', 'password'], {
        requiredFields: ['email', 'password'],
        fieldRules: {
            email: { type: 'string', format: 'email', maxLength: 254 },
            password: { type: 'string', minLength: 1, maxLength: 256 },
        },
    });
    const missingRequiredResult = invokeMiddleware(requiredBody, {
        method: 'POST',
        originalUrl: '/schema-check',
        body: { email: 'owner@example.com' },
        headers: {},
        socket: {},
    });
    assert.equal(missingRequiredResult.nextCalled, false);
    assert.equal(missingRequiredResult.response.statusCode, 400);
    assert.equal(missingRequiredResult.response.payload.code, 'REQUEST_SCHEMA_INVALID');

    const explicitScalarBody = strictBody(['stock_qty'], {
        requiredFields: ['stock_qty'],
        fieldRules: { stock_qty: { type: 'number', min: 0, max: 1000000 } },
    });
    const explicitScalarResult = invokeMiddleware(explicitScalarBody, {
        method: 'POST',
        originalUrl: '/schema-check',
        body: { stock_qty: 12 },
        headers: {},
        socket: {},
    });
    assert.equal(explicitScalarResult.nextCalled, true);

    const enumArrayBody = strictBody(['scopes'], {
        requiredFields: ['scopes'],
        fieldRules: {
            scopes: {
                type: 'array',
                minItems: 1,
                maxItems: 5,
                items: { type: 'string', enum: ['members:read', 'payments:read'] },
            },
        },
    });
    assert.equal(invokeMiddleware(enumArrayBody, {
        method: 'POST',
        originalUrl: '/schema-check',
        body: { scopes: ['members:read'] },
        headers: {},
        socket: {},
    }).nextCalled, true);
    assert.equal(invokeMiddleware(enumArrayBody, {
        method: 'POST',
        originalUrl: '/schema-check',
        body: { scopes: ['admin:all'] },
        headers: {},
        socket: {},
    }).nextCalled, false);

    const routeSchema = routeRequestSchema('/items/:id', 'get', [function handler(req) {
        return req.query.limit;
    }]);
    const validRouteResult = invokeMiddleware(routeSchema, {
        method: 'GET',
        originalUrl: '/items/42?limit=25',
        body: {},
        query: { limit: '25' },
        params: { id: '42' },
        headers: {},
        socket: {},
    });
    assert.equal(validRouteResult.nextCalled, true);

    for (const request of [
        { query: { unknown: 'value' }, params: { id: '42' } },
        { query: { limit: ['10', '20'] }, params: { id: '42' } },
        { query: { limit: '25' }, params: { id: '../42' } },
    ]) {
        const result = invokeMiddleware(routeSchema, {
            method: 'GET',
            originalUrl: '/items/schema-check',
            body: {},
            headers: {},
            socket: {},
            ...request,
        });
        assert.equal(result.nextCalled, false);
        assert.equal(result.response.statusCode, 400);
        assert.equal(result.response.payload.code, 'REQUEST_SCHEMA_INVALID');
    }

    const paymentListSchema = routeRequestSchema('/', 'get', [function handler(req) {
        return req.query.filter;
    }]);
    assert.equal(invokeMiddleware(paymentListSchema, {
        method: 'GET',
        baseUrl: '/api/payments',
        originalUrl: '/api/payments?filter=pending&limit=200',
        body: {},
        query: { filter: 'pending', limit: '200' },
        params: {},
        headers: {},
        socket: {},
    }).nextCalled, true);
    assert.equal(invokeMiddleware(paymentListSchema, {
        method: 'GET',
        baseUrl: '/api/payments',
        originalUrl: '/api/payments?filter=unknown',
        body: {},
        query: { filter: 'unknown' },
        params: {},
        headers: {},
        socket: {},
    }).nextCalled, false);

    const oauthCallbackSchema = routeRequestSchema('/google/callback', 'get', []);
    assert.equal(invokeMiddleware(oauthCallbackSchema, {
        method: 'GET',
        baseUrl: '/api/auth',
        originalUrl: '/api/auth/google/callback?state=signup&iss=https%3A%2F%2Faccounts.google.com&code=provider-code&scope=email+profile&authuser=0&prompt=consent',
        body: {},
        query: {
            state: 'signup',
            iss: 'https://accounts.google.com',
            code: 'provider-code',
            scope: 'email profile',
            authuser: '0',
            prompt: 'consent',
        },
        params: {},
        headers: {},
        socket: {},
    }).nextCalled, true);
    assert.equal(invokeMiddleware(oauthCallbackSchema, {
        method: 'GET',
        baseUrl: '/api/auth',
        originalUrl: '/api/auth/google/callback?state=signup&iss=https%3A%2F%2Fevil.example&code=provider-code',
        body: {},
        query: { state: 'signup', iss: 'https://evil.example', code: 'provider-code' },
        params: {},
        headers: {},
        socket: {},
    }).nextCalled, false);
    assert.equal(invokeMiddleware(oauthCallbackSchema, {
        method: 'GET',
        baseUrl: '/api/auth',
        originalUrl: '/api/auth/google/callback?state=signed-state',
        body: {},
        query: { state: 'signed-state' },
        params: {},
        headers: {},
        socket: {},
    }).nextCalled, false);

    const customRangeSchema = routeRequestSchema('/records', 'get', []);
    assert.equal(invokeMiddleware(customRangeSchema, {
        method: 'GET',
        baseUrl: '/api/attendance',
        originalUrl: '/api/attendance/records?range=custom',
        body: {},
        query: { range: 'custom' },
        params: {},
        headers: {},
        socket: {},
    }).nextCalled, false);

    const campaignAliasSchema = strictBody(['segment', 'template_key'], {
        requiredFields: ['template_key'],
        fieldRules: {
            segment: { type: 'string', enum: ['ALL', 'ACTIVE', 'EXPIRING_7_DAYS', 'EXPIRING', 'EXPIRED', 'GHOSTS', 'HIGH_CHURN', 'HIGHCHURN', 'CUSTOM'], caseInsensitive: true },
            template_key: { type: 'string', minLength: 1, maxLength: 60 },
        },
    });
    for (const segment of ['Expiring', 'HighChurn']) {
        assert.equal(invokeMiddleware(campaignAliasSchema, {
            method: 'POST',
            originalUrl: '/api/notifications/campaign/run',
            body: { segment, template_key: 'RENEWAL_REMINDER' },
            query: {},
            params: {},
            headers: { 'content-type': 'application/json' },
            socket: {},
        }).nextCalled, true);
    }
};

const inspectRouteCoverage = () => {
    const violations = [];
    let endpointCount = 0;
    const methodCounts = new Map();

    for (const routeFile of routeFiles) {
        let router;
        try {
            router = require(path.join(routesDirectory, routeFile));
        } catch (error) {
            violations.push(`${routeFile}: failed to load (${error.message})`);
            continue;
        }
        if (!router?.usesValidatedRequests) {
            violations.push(`${routeFile}: router was not created with createValidatedRouter()`);
            continue;
        }

        for (const layer of router.stack || []) {
            if (!layer.route) continue;
            const routePath = String(layer.route.path);
            const schemas = (layer.route.stack || [])
                .map((entry) => entry.handle?.requestSchema)
                .filter(Boolean);
            const routeSchema = schemas.find((schema) => schema.query && schema.params);
            const bodySchema = schemas.find((schema) => schema.body);

            for (const [method, enabled] of Object.entries(layer.route.methods || {})) {
                if (!enabled) continue;
                endpointCount += 1;
                const normalizedMethod = method.toUpperCase();
                methodCounts.set(normalizedMethod, (methodCounts.get(normalizedMethod) || 0) + 1);
                const routeKey = `${routeFile} ${normalizedMethod} ${routePath}`;

                if (!routeSchema) {
                    violations.push(`${routeKey}: missing query/parameter schema`);
                } else {
                    const declaredParams = Array.from(routePath.matchAll(/:([A-Za-z_$][\w$]*)/g), (match) => match[1]);
                    assert.deepEqual(routeSchema.params.fields, declaredParams, `${routeKey}: route parameters do not match schema metadata`);
                }

                if (
                    MUTATION_METHODS.has(normalizedMethod)
                    && !bodySchema
                    && !FLEXIBLE_PROVIDER_BODIES.has(routeKey)
                ) {
                    violations.push(`${routeKey}: missing body schema`);
                }
            }
        }
    }

    assert.equal(endpointCount > 0, true, 'No API endpoints were discovered.');
    assert.deepEqual(violations, [], `Request schema coverage violations:\n${violations.join('\n')}`);
    return { endpointCount, methodCounts };
};

const run = async () => {
    try {
        testValidationPrimitives();
        const { endpointCount, methodCounts } = inspectRouteCoverage();
        const counts = [...methodCounts.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([method, count]) => `${method}=${count}`)
            .join(', ');
        console.log(`Request schema coverage passed for ${endpointCount} endpoints (${counts}).`);
    } finally {
        await adminPool.end().catch(() => {});
    }
};

run()
    .catch((error) => {
        console.error(error.message || error);
        process.exitCode = 1;
    })
    .finally(() => {
        process.exit(process.exitCode || 0);
    });
