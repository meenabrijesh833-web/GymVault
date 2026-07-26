const { recordRuntimeEvent } = require('../utils/runtimeTelemetry');

const ARRAY_BODY_FIELDS = new Set([
    'allowed_days', 'branch_directory', 'completion_photos', 'events', 'features',
    'items', 'member_ids', 'permissions', 'repeat_days', 'roles', 'scopes', 'tags', 'templates',
]);
const OBJECT_BODY_FIELDS = new Set([
    'advanced_rules', 'automation_settings', 'billing_config', 'bulk_channels', 'extra', 'feature_flags',
    'filters', 'keys', 'member_payments', 'plan_setup', 'support_profile',
]);
const BOOLEAN_BODY_FIELDS = /^(allow_|auto_|blocked$|bulk_enabled$|compact$|dry_run$|enabled$|include_|interface_|is_|legal_acceptance$|maintenance_mode$|onboarding_complete$|remove_|send_|today$)/i;
const INTEGER_BODY_FIELDS = new Set([
    'assigned_to', 'branches_count', 'days', 'duration_days', 'duration_months',
    'grace_days', 'member_id', 'membership_id', 'migration_plan_id', 'pay_day',
    'payment_id', 'plan_id', 'primary_member_id', 'session_id', 'target_gym_id',
    'trainer_user_id', 'transfer_to_member_id', 'user_id',
]);
const NUMERIC_BODY_FIELDS = /(^amount|_amount$|^price$|_price$|^base_pay$|^adjustment$|^latitude$|^longitude$|^gym_radius_meters$|^discount_|^quantity$|^addon_extra_)/i;
const EMAIL_BODY_FIELDS = /(^|_)email$/i;
const PHONE_BODY_FIELDS = /(^|_)(phone|mobile|whatsapp|number)$/i;
const DATE_BODY_FIELDS = /(^|_)(date|at)$/i;
const URL_BODY_FIELDS = /^(url|website|avatar_url|receipt_url)$/i;
const INTEGER_QUERY_FIELDS = /(^id$|_id$|^page$|^limit$|^days$|^authuser$)/i;
const BOOLEAN_QUERY_FIELDS = /^(compact|include_|paginate|refresh|today)/i;
const DATE_QUERY_FIELDS = /^(from|to|dateFrom|dateTo)$/;
const PROVIDER_QUERY_FIELDS = {
    '/google/callback': ['authuser', 'code', 'error', 'error_description', 'error_uri', 'iss', 'prompt', 'scope', 'state'],
    '/razorpay-connect-callback': ['code', 'error', 'error_description', 'state'],
    '/platform/whatsapp-delivery/webhook': ['token'],
};
const ROUTE_QUERY_SCHEMAS = {
    'GET /api/auth/google': {
        fieldRules: { mode: { type: 'string', enum: ['login', 'signup'], caseInsensitive: true } },
    },
    'GET /api/auth/google/callback': {
        requiredFields: ['state'],
        exactlyOneOf: ['code', 'error'],
        fieldRules: {
            state: { type: 'string', minLength: 1, maxLength: 4096 },
            code: { type: 'string', minLength: 1, maxLength: 2048 },
            error: { type: 'string', minLength: 1, maxLength: 120 },
            error_description: { type: 'string', maxLength: 4096 },
            error_uri: { type: 'string', format: 'url', maxLength: 2048 },
            iss: { type: 'string', enum: ['https://accounts.google.com'], maxLength: 128 },
            prompt: { type: 'string', maxLength: 120 },
            scope: { type: 'string', maxLength: 4096 },
            authuser: { type: 'integer', min: 0 },
        },
    },
    'GET /api/payments/': {
        fieldRules: {
            filter: { type: 'string', enum: ['ALL', 'PENDING', 'CASH', 'ONLINE'], caseInsensitive: true },
            limit: { type: 'integer', min: 1, max: 200 },
        },
    },
    'GET /api/payments/renewal-context/:member_id': {
        requiredFields: ['plan_id'],
        fieldRules: { plan_id: { type: 'integer', min: 1 } },
    },
    'GET /api/payments/stats': {
        fieldRules: { days: { type: 'integer', enum: ['7', '30'] } },
    },
    'GET /api/payments/chart': {
        fieldRules: { days: { type: 'integer', enum: ['7', '30'] } },
    },
    'GET /api/members/': {
        fieldRules: {
            status: { type: 'string', enum: ['ALL', 'ACTIVE', 'INACTIVE', 'EXPIRING SOON', 'EXPIRED', 'UNPAID', 'FROZEN'], caseInsensitive: true },
            limit: { type: 'integer', min: 1, max: 200 },
        },
    },
    'GET /api/leads/': {
        fieldRules: {
            status: { type: 'string', enum: ['ALL', 'NEW', 'CONTACTED', 'FOLLOW_UP', 'TRIAL_BOOKED', 'WON', 'LOST'], caseInsensitive: true },
            limit: { type: 'integer', min: 1, max: 200 },
        },
    },
    'GET /api/attendance/search': {
        fieldRules: { limit: { type: 'integer', min: 1, max: 100 } },
    },
    'GET /api/attendance/rfid/events': {
        fieldRules: {
            limit: { type: 'integer', min: 1, max: 100 },
            status: { type: 'string', maxLength: 40 },
        },
    },
    'GET /api/attendance/feed': {
        fieldRules: { limit: { type: 'integer', min: 1, max: 100 } },
    },
    'GET /api/attendance/records': {
        requiredWhen: [{ field: 'range', equals: 'custom', requiredFields: ['from', 'to'], caseInsensitive: true }],
        fieldRules: {
            range: { type: 'string', enum: ['today', 'yesterday', 'custom'], caseInsensitive: true },
            limit: { type: 'integer', min: 1, max: 200 },
        },
    },
    'GET /api/attendance/heatmap': {
        fieldRules: { days: { type: 'integer', min: 7, max: 365 } },
    },
    'GET /api/attendance/peak-hours': {
        fieldRules: { days: { type: 'integer', min: 1, max: 90 } },
    },
    'GET /api/attendance/inactive': {
        fieldRules: { days: { type: 'integer', min: 1, max: 120 } },
    },
    'GET /api/attendance/leaderboard': {
        fieldRules: {
            days: { type: 'integer', min: 7, max: 180 },
            limit: { type: 'integer', min: 3, max: 50 },
        },
    },
    'GET /api/finance/overview': {
        requiredWhen: [{ field: 'period', equals: 'custom', requiredFields: ['from', 'to'], caseInsensitive: true }],
        fieldRules: { period: { type: 'string', enum: ['30d', 'custom', 'all'], caseInsensitive: true } },
    },
    'GET /api/insights/overview': {
        fieldRules: { range: { type: 'string', enum: ['1M', '3M', '6M', '1Y'], caseInsensitive: true } },
    },
    'GET /api/insights/franchise': {
        fieldRules: { range: { type: 'string', enum: ['1M', '3M', '6M', '1Y'], caseInsensitive: true } },
    },
    'GET /api/notifications/campaign/segments': {
        fieldRules: {
            segment: { type: 'string', enum: ['ALL', 'ACTIVE', 'EXPIRING_7_DAYS', 'EXPIRED', 'GHOSTS', 'HIGH_CHURN', 'CUSTOM'], caseInsensitive: true },
            limit: { type: 'integer', min: 1, max: 500 },
        },
    },
    'GET /api/notifications/campaign/logs': {
        fieldRules: { limit: { type: 'integer', min: 1, max: 200 } },
    },
    'GET /api/classes/schedule': {
        fieldRules: {
            from: { type: 'string', maxLength: 60 },
            to: { type: 'string', maxLength: 60 },
        },
    },
    'GET /api/trainers/assignments': {
        fieldRules: { trainer_id: { type: 'integer', min: 1 } },
    },
    'GET /api/trainers/tasks': {
        fieldRules: { status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], caseInsensitive: true } },
    },
    'GET /api/users/tasks': {
        fieldRules: {
            limit: { type: 'integer', min: 1, max: 100 },
            assigned_to: { type: 'integer', min: 1 },
        },
    },
    'GET /api/superadmin/activities': {
        fieldRules: { limit: { type: 'integer', min: 1, max: 200 } },
    },
    'GET /api/superadmin/gyms': {
        fieldRules: {
            status: { type: 'string', enum: ['ACTIVE', 'BLOCKED', 'SUSPENDED'], caseInsensitive: true },
            plan: { type: 'string', enum: ['test', 'basic', 'growth', 'pro'], caseInsensitive: true },
        },
    },
    'GET /api/superadmin/users': {
        fieldRules: { status: { type: 'string', enum: ['ACTIVE', 'BLOCKED'], caseInsensitive: true } },
    },
    'GET /api/superadmin/support/tickets': {
        fieldRules: {
            status: { type: 'string', enum: ['OPEN', 'PENDING', 'CLOSED'], caseInsensitive: true },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], caseInsensitive: true },
        },
    },
    'GET /api/superadmin/runtime-events': {
        fieldRules: {
            limit: { type: 'integer', min: 1, max: 200 },
            event_type: { type: 'string', maxLength: 40 },
            severity: { type: 'string', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'], caseInsensitive: true },
        },
    },
    'GET /api/memberships/online/connect/callback': {
        requiredFields: ['state'],
        exactlyOneOf: ['code', 'error'],
        fieldRules: {
            state: { type: 'string', minLength: 1, maxLength: 4096 },
            code: { type: 'string', minLength: 1, maxLength: 2048 },
            error: { type: 'string', minLength: 1, maxLength: 120 },
            error_description: { type: 'string', maxLength: 4096 },
        },
    },
    'POST /api/settings/platform/whatsapp-delivery/webhook': {
        fieldRules: { token: { type: 'string', maxLength: 256 } },
    },
};
const STRING_ARRAY_FIELDS = new Set(['allowed_days', 'events', 'features', 'permissions', 'roles', 'scopes', 'tags']);
const INTEGER_ARRAY_FIELDS = new Set(['member_ids']);
const MAX_NESTED_DEPTH = 8;
const MAX_NESTED_KEYS = 80;
const MAX_NESTED_ARRAY_ITEMS = 200;

const isPlainObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const rejectSchema = (req, res, reason, unknownFields = [], location = 'body') => {
    void recordRuntimeEvent({
        eventType: 'REQUEST_SCHEMA_REJECT',
        severity: 'WARN',
        source: 'security',
        message: `${req.method} ${req.originalUrl || req.path || '/'} rejected by request schema`,
        route: req.originalUrl || req.path,
        method: req.method,
        statusCode: 400,
        gymId: req.user?.gym_id,
        userId: req.user?.id,
        actorRole: req.user?.role,
        metadata: {
            reason,
            location,
            unknown_fields: unknownFields.slice(0, 20),
            client_ip: String(req.ip || req.socket?.remoteAddress || '').slice(0, 80),
        },
    });

    return res.status(400).json({
        success: false,
        code: 'REQUEST_SCHEMA_INVALID',
        error: `Request ${location} does not match the expected schema.`,
    });
};

const isStrictNumber = (value, { integer = false, min = null, max = null } = {}) => {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) return false;
    } else if (typeof value === 'string') {
        const pattern = integer ? /^-?\d+$/ : /^-?(?:\d+|\d*\.\d+)$/;
        if (!pattern.test(value.trim())) return false;
    } else {
        return false;
    }

    const parsed = Number(value);
    if (min !== null && parsed < min) return false;
    if (max !== null && parsed > max) return false;
    return true;
};

const isStrictBoolean = (value) => (
    typeof value === 'boolean'
    || value === 0
    || value === 1
    || ['true', 'false', '0', '1'].includes(String(value).trim().toLowerCase())
);

const hasOnlyKeys = (value, allowedFields) => (
    isPlainObject(value) && Object.keys(value).every((field) => allowedFields.has(field))
);

const isBoundedJson = (value, depth = 0) => {
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') {
        return value.length <= 10000 && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
    }
    if (depth >= MAX_NESTED_DEPTH) return false;
    if (Array.isArray(value)) {
        return value.length <= MAX_NESTED_ARRAY_ITEMS && value.every((entry) => isBoundedJson(entry, depth + 1));
    }
    if (!isPlainObject(value)) return false;
    const entries = Object.entries(value);
    return entries.length <= MAX_NESTED_KEYS
        && entries.every(([key, entry]) => (
            key.length <= 80
            && !['__proto__', 'prototype', 'constructor'].includes(key)
            && isBoundedJson(entry, depth + 1)
        ));
};

const isBoundedString = (value, max) => typeof value === 'string' && value.length <= max;

const validateFieldRule = (value, rule = {}) => {
    if (value === undefined || value === null || value === '') return true;

    if (rule.type === 'string' && typeof value !== 'string') return false;
    if (rule.type === 'integer' && !isStrictNumber(value, { integer: true, min: rule.min, max: rule.max })) return false;
    if (rule.type === 'number' && !isStrictNumber(value, { min: rule.min, max: rule.max })) return false;
    if (rule.type === 'boolean' && !isStrictBoolean(value)) return false;
    if (rule.type === 'array' && !Array.isArray(value)) return false;
    if (rule.type === 'object' && !isPlainObject(value)) return false;

    if (typeof value === 'string') {
        const normalized = value.trim();
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) return false;
        if (rule.minLength !== undefined && normalized.length < rule.minLength) return false;
        if (rule.maxLength !== undefined && normalized.length > rule.maxLength) return false;
        if (rule.pattern && !rule.pattern.test(normalized)) return false;
        if (rule.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
        if (rule.format === 'phone' && !/^[+\d][\d\s().-]{7,29}$/.test(normalized)) return false;
        if (rule.format === 'url') {
            try {
                if (!['http:', 'https:'].includes(new URL(normalized).protocol.toLowerCase())) return false;
            } catch (_error) {
                return false;
            }
        }
    }

    if (Array.isArray(value)) {
        if (rule.minItems !== undefined && value.length < rule.minItems) return false;
        if (rule.maxItems !== undefined && value.length > rule.maxItems) return false;
        if (rule.items && !value.every((entry) => validateFieldRule(entry, rule.items))) return false;
    }

    if (Array.isArray(rule.enum)) {
        const candidate = rule.caseInsensitive && typeof value === 'string' ? value.trim().toUpperCase() : value;
        const allowedValues = rule.caseInsensitive
            ? rule.enum.map((entry) => typeof entry === 'string' ? entry.toUpperCase() : entry)
            : rule.enum;
        if (!allowedValues.includes(candidate)) return false;
    }

    return true;
};

const validateNestedField = (field, value) => {
    if (field === 'repeat_days') {
        return value.length <= 7 && value.every((item) => isStrictNumber(item, { integer: true, min: 0, max: 6 }));
    }
    if (STRING_ARRAY_FIELDS.has(field)) {
        return value.length <= 200 && value.every((item) => isBoundedString(item, 240));
    }
    if (INTEGER_ARRAY_FIELDS.has(field)) {
        return value.length <= 200 && value.every((item) => isStrictNumber(item, { integer: true, min: 1 }));
    }
    if (field === 'completion_photos') {
        return value.length <= 4 && value.every((item) => isBoundedString(item, 2_800_000) && /^data:image\//i.test(item));
    }
    if (field === 'branch_directory') {
        const allowed = new Set(['address', 'id', 'name', 'phone']);
        return value.length <= 25 && value.every((item) => (
            hasOnlyKeys(item, allowed)
            && isBoundedString(item.id ?? '', 60)
            && isBoundedString(item.name ?? '', 120)
            && isBoundedString(item.address ?? '', 240)
            && isBoundedString(item.phone ?? '', 30)
        ));
    }
    if (field === 'items') {
        const allowed = new Set(['product_id', 'quantity']);
        return value.length > 0 && value.length <= 100 && value.every((item) => (
            hasOnlyKeys(item, allowed)
            && isStrictNumber(item.product_id, { integer: true, min: 1 })
            && isStrictNumber(item.quantity, { integer: true, min: 1, max: 10000 })
        ));
    }
    if (field === 'templates') {
        const allowed = new Set([
            'is_active', 'sms_text', 'template_key', 'title', 'whatsapp_template_category',
            'whatsapp_template_error', 'whatsapp_template_language', 'whatsapp_template_name',
            'whatsapp_template_status', 'whatsapp_text',
        ]);
        return value.length <= 50 && value.every((item) => (
            hasOnlyKeys(item, allowed)
            && isBoundedString(item.template_key ?? '', 60)
            && isBoundedString(item.title ?? '', 120)
            && isBoundedString(item.whatsapp_text ?? '', 4000)
            && isBoundedString(item.sms_text ?? '', 4000)
            && (item.is_active === undefined || isStrictBoolean(item.is_active))
            && Object.entries(item).every(([key, entry]) => (
                key === 'is_active' || entry === null || entry === undefined || typeof entry === 'string'
            ))
        ));
    }
    return value.length <= MAX_NESTED_ARRAY_ITEMS && value.every((item) => isBoundedJson(item, 1));
};

const validateNestedObject = (field, value) => {
    if (field === 'keys') {
        return hasOnlyKeys(value, new Set(['auth', 'p256dh']))
            && isBoundedString(value.auth, 512)
            && isBoundedString(value.p256dh, 512)
            && Boolean(value.auth && value.p256dh);
    }
    if (field === 'plan_setup') {
        return hasOnlyKeys(value, new Set(['branches_count', 'distribution_mode']))
            && (value.branches_count === undefined || isStrictNumber(value.branches_count, { integer: true, min: 1, max: 25 }))
            && (value.distribution_mode === undefined || ['balanced', 'flexible'].includes(String(value.distribution_mode).toLowerCase()));
    }
    if (field === 'bulk_channels') {
        return hasOnlyKeys(value, new Set(['sms', 'whatsapp']))
            && Object.values(value).every(isStrictBoolean);
    }
    if (field === 'member_payments') {
        const allowed = new Set(['connect_mode', 'enabled', 'razorpay_key_id', 'razorpay_key_secret', 'upi_id']);
        return hasOnlyKeys(value, allowed)
            && (value.enabled === undefined || isStrictBoolean(value.enabled))
            && (value.connect_mode === undefined || ['MANUAL', 'PARTNER'].includes(String(value.connect_mode).toUpperCase()))
            && isBoundedString(value.razorpay_key_id ?? '', 120)
            && isBoundedString(value.razorpay_key_secret ?? '', 240)
            && isBoundedString(value.upi_id ?? '', 120);
    }
    if (field === 'feature_flags') {
        return Object.keys(value).length <= 100 && Object.values(value).every(isStrictBoolean);
    }
    return isBoundedJson(value);
};

const validateBodyField = (field, value) => {
    if (value === undefined || value === null || value === '') return true;
    if (ARRAY_BODY_FIELDS.has(field)) return Array.isArray(value) && validateNestedField(field, value);
    if (OBJECT_BODY_FIELDS.has(field)) return isPlainObject(value) && validateNestedObject(field, value);
    if (field === 'expirationTime') return isStrictNumber(value, { integer: true, min: 0 });
    if (BOOLEAN_BODY_FIELDS.test(field)) return isStrictBoolean(value);
    if (INTEGER_BODY_FIELDS.has(field)) {
        return isStrictNumber(value, { integer: true });
    }
    if (NUMERIC_BODY_FIELDS.test(field)) {
        return isStrictNumber(value);
    }
    if (typeof value !== 'string') return false;

    const normalized = value.trim();
    if (EMAIL_BODY_FIELDS.test(field)) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    if (PHONE_BODY_FIELDS.test(field)) return /^[+\d][\d\s().-]{7,29}$/.test(normalized);
    if (DATE_BODY_FIELDS.test(field)) return normalized.length <= 60 && !Number.isNaN(new Date(normalized).getTime());
    if (URL_BODY_FIELDS.test(field)) {
        try {
            return ['http:', 'https:'].includes(new URL(normalized).protocol.toLowerCase());
        } catch (_error) {
            return false;
        }
    }
    return normalized.length <= 500000 && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized);
};

const strictBody = (allowedFields, { allowEmpty = false, requiredFields = [], fieldRules = {} } = {}) => {
    const allowed = new Set(allowedFields);
    const required = new Set(requiredFields);

    const undeclaredRequiredFields = [...required].filter((field) => !allowed.has(field));
    if (undeclaredRequiredFields.length > 0) {
        throw new Error(`Required request fields must also be allowed: ${undeclaredRequiredFields.join(', ')}`);
    }

    const middleware = (req, res, next) => {
        if (!isPlainObject(req.body)) {
            if (allowEmpty && (req.body === undefined || req.body === null)) return next();
            return rejectSchema(req, res, 'body_not_plain_object');
        }

        const fields = Object.keys(req.body);
        if (!allowEmpty && fields.length === 0) {
            return rejectSchema(req, res, 'body_empty');
        }

        const unknownFields = fields.filter((field) => !allowed.has(field));
        if (unknownFields.length > 0) {
            return rejectSchema(req, res, 'unknown_fields', unknownFields);
        }

        const missingRequiredFields = [...required].filter((field) => (
            !Object.prototype.hasOwnProperty.call(req.body, field)
            || req.body[field] === undefined
            || req.body[field] === null
            || (typeof req.body[field] === 'string' && req.body[field].trim() === '')
        ));
        if (missingRequiredFields.length > 0) {
            return rejectSchema(req, res, 'missing_required_fields', missingRequiredFields);
        }

        const invalidFields = fields.filter((field) => {
            const rule = fieldRules[field];
            const explicitScalarRule = ['boolean', 'integer', 'number', 'string'].includes(rule?.type);
            const baseFieldValid = explicitScalarRule || validateBodyField(field, req.body[field]);
            return !baseFieldValid || !validateFieldRule(req.body[field], rule);
        });
        if (invalidFields.length > 0) {
            return rejectSchema(req, res, 'invalid_field_type_or_format', invalidFields);
        }

        return next();
    };

    middleware.requestSchema = {
        body: {
            allowedFields: [...allowed],
            requiredFields: [...required],
            fieldRules,
            allowEmpty,
        },
    };
    return middleware;
};

const collectQueryFields = (routePath, handlers = []) => {
    const allowed = new Set(['branch_id']);
    const source = handlers.map((handler) => String(handler)).join('\n');
    const dotPattern = /\breq(?:\?\.)?\.query(?:\?\.)?\.([A-Za-z_$][\w$]*)/g;
    const bracketPattern = /\breq(?:\?\.)?\.query\s*\[\s*['"]([^'"]+)['"]\s*\]/g;
    let match;
    while ((match = dotPattern.exec(source))) allowed.add(match[1]);
    while ((match = bracketPattern.exec(source))) allowed.add(match[1]);
    for (const field of PROVIDER_QUERY_FIELDS[routePath] || []) allowed.add(field);
    return allowed;
};

const validateQueryValue = (field, value) => {
    if (Array.isArray(value) || isPlainObject(value) || value === undefined || value === null) return false;
    const raw = String(value);
    if (raw.length > 4096 || /[\u0000-\u001F\u007F]/.test(raw)) return false;

    if (field === 'branch_id') {
        return raw.toLowerCase() === 'all' || /^[a-z0-9][a-z0-9_-]{0,59}$/i.test(raw);
    }
    if (INTEGER_QUERY_FIELDS.test(field)) {
        const max = field === 'limit' ? 500 : field === 'days' ? 3650 : Number.MAX_SAFE_INTEGER;
        return isStrictNumber(raw, { integer: true, min: field === 'authuser' ? 0 : 1, max });
    }
    if (BOOLEAN_QUERY_FIELDS.test(field)) {
        return ['true', 'false', '0', '1', 'yes', 'no'].includes(raw.trim().toLowerCase());
    }
    if (DATE_QUERY_FIELDS.test(field)) {
        return raw.length <= 60 && !Number.isNaN(new Date(raw).getTime());
    }
    if (['q', 'search'].includes(field)) return raw.length <= 200;
    return raw.length <= 4096;
};

const validateRouteParamValue = (field, value) => {
    const raw = String(value ?? '');
    if (!raw || raw.length > 120 || /[\u0000-\u001F\u007F]/.test(raw)) return false;
    if (/^(id|mid|did|nid|.*Id|.*_id)$/i.test(field)) {
        return /^[1-9]\d*$/.test(raw) && Number(raw) <= Number.MAX_SAFE_INTEGER;
    }
    return /^[A-Za-z0-9._~-]+$/.test(raw);
};

const routeRequestSchema = (routePath, method, handlers = []) => {
    const allowedQueryFields = collectQueryFields(routePath, handlers);
    const paramFields = Array.from(String(routePath).matchAll(/:([A-Za-z_$][\w$]*)/g), (match) => match[1]);
    const middleware = (req, res, next) => {
        const mountedRoutePath = `${req.baseUrl || ''}${routePath}`;
        const routeKey = `${String(method || '').toUpperCase()} ${mountedRoutePath}`;
        const querySchema = ROUTE_QUERY_SCHEMAS[routeKey] || {};
        const routeAllowedQueryFields = new Set([
            ...allowedQueryFields,
            ...Object.keys(querySchema.fieldRules || {}),
            ...(querySchema.requiredFields || []),
            ...(querySchema.exactlyOneOf || []),
            ...(querySchema.requiredWhen || []).flatMap((condition) => [condition.field, ...(condition.requiredFields || [])]),
        ]);
        const query = req.query || {};
        if (!isPlainObject(query)) {
            return rejectSchema(req, res, 'query_not_plain_object', [], 'query');
        }
        const queryFields = Object.keys(query);
        const unknownQueryFields = queryFields.filter((field) => !routeAllowedQueryFields.has(field));
        if (unknownQueryFields.length > 0) {
            return rejectSchema(req, res, 'unknown_query_fields', unknownQueryFields, 'query');
        }
        const invalidQueryFields = queryFields.filter((field) => !validateQueryValue(field, query[field]));
        if (invalidQueryFields.length > 0) {
            return rejectSchema(req, res, 'invalid_query_type_or_format', invalidQueryFields, 'query');
        }

        const invalidSemanticQueryFields = queryFields.filter((field) => (
            querySchema.fieldRules?.[field]
            && !validateFieldRule(query[field], querySchema.fieldRules[field])
        ));
        if (invalidSemanticQueryFields.length > 0) {
            return rejectSchema(req, res, 'invalid_query_semantics', invalidSemanticQueryFields, 'query');
        }

        const hasQueryValue = (field) => query[field] !== undefined && query[field] !== null && String(query[field]).trim() !== '';
        const missingRequiredQueryFields = (querySchema.requiredFields || []).filter((field) => !hasQueryValue(field));
        if (missingRequiredQueryFields.length > 0) {
            return rejectSchema(req, res, 'missing_required_query_fields', missingRequiredQueryFields, 'query');
        }

        if (Array.isArray(querySchema.exactlyOneOf)) {
            const presentFields = querySchema.exactlyOneOf.filter(hasQueryValue);
            if (presentFields.length !== 1) {
                return rejectSchema(req, res, 'query_requires_exactly_one_field', querySchema.exactlyOneOf, 'query');
            }
        }

        const failedConditionalFields = (querySchema.requiredWhen || []).flatMap((condition) => {
            const actual = String(query[condition.field] || '');
            const expected = String(condition.equals || '');
            const matches = condition.caseInsensitive
                ? actual.toLowerCase() === expected.toLowerCase()
                : actual === expected;
            return matches ? (condition.requiredFields || []).filter((field) => !hasQueryValue(field)) : [];
        });
        if (failedConditionalFields.length > 0) {
            return rejectSchema(req, res, 'missing_conditional_query_fields', failedConditionalFields, 'query');
        }

        const invalidParamFields = paramFields.filter((field) => !validateRouteParamValue(field, req.params?.[field]));
        if (invalidParamFields.length > 0) {
            return rejectSchema(req, res, 'invalid_route_parameter', invalidParamFields, 'parameters');
        }
        return next();
    };

    middleware.requestSchema = {
        method: String(method || '').toUpperCase(),
        routePath,
        query: { allowedFields: [...allowedQueryFields], hasRouteSpecificRules: true },
        params: { fields: paramFields },
    };
    return middleware;
};

module.exports = {
    strictBody,
    routeRequestSchema,
    validateBodyField,
    validateQueryValue,
    validateRouteParamValue,
};