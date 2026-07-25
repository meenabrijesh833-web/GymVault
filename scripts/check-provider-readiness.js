const nodemailer = require('nodemailer');
const { pool } = require('../config/db');

require('dotenv').config({ quiet: true });

const results = [];

const record = (status, name, detail) => {
    results.push({ status, name, detail });
    console.log(`${status.toUpperCase()} ${name}: ${detail}`);
};

const run = async (name, check, { optional = false } = {}) => {
    try {
        record('pass', name, await check());
    } catch (error) {
        record(optional ? 'warn' : 'fail', name, error?.message || String(error));
    }
};

const requireValues = (names) => {
    const missing = names.filter((name) => !String(process.env[name] || '').trim());
    if (missing.length > 0) {
        throw new Error(`missing ${missing.join(', ')}`);
    }
};

const checkDatabase = async () => {
    const response = await pool.query('SELECT 1 AS ok');
    if (Number(response.rows[0]?.ok) !== 1) {
        throw new Error('unexpected database response');
    }
    return 'connection accepted';
};

const checkSmtp = async () => {
    requireValues(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_EMAIL']);

    const secure = String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true';
    const transporter = nodemailer.createTransport({
        host: String(process.env.SMTP_HOST).trim(),
        port: Number.parseInt(process.env.SMTP_PORT, 10) || (secure ? 465 : 587),
        secure,
        auth: {
            user: String(process.env.SMTP_USER).trim(),
            pass: String(process.env.SMTP_PASS),
        },
    });

    await transporter.verify();
    return `authenticated as ${String(process.env.SMTP_USER).trim()}`;
};

const checkGoogleOauth = async () => {
    requireValues(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'APP_URL', 'FRONTEND_URL']);

    const redirectUri = new URL(String(process.env.GOOGLE_REDIRECT_URI).trim());
    if (redirectUri.protocol !== 'https:' || !redirectUri.pathname.endsWith('/api/auth/google/callback')) {
        throw new Error('GOOGLE_REDIRECT_URI must be HTTPS and end with /api/auth/google/callback');
    }

    return `callback ${redirectUri.origin}${redirectUri.pathname}`;
};

const checkRazorpay = async () => {
    requireValues(['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']);

    const keyId = String(process.env.RAZORPAY_KEY_ID).trim();
    const response = await fetch('https://api.razorpay.com/v1/payments?count=1', {
        headers: {
            authorization: `Basic ${Buffer.from(`${keyId}:${process.env.RAZORPAY_KEY_SECRET}`, 'utf8').toString('base64')}`,
        },
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error?.description || payload?.error?.code || `HTTP ${response.status}`);
    }

    const environment = keyId.toLowerCase().startsWith('rzp_live_') ? 'live' : 'test';
    return `${environment} credentials accepted`;
};

const collectIntegratedNumbers = (value, numbers = new Set(), seen = new Set()) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return numbers;
    seen.add(value);

    if (Array.isArray(value)) {
        value.forEach((entry) => collectIntegratedNumbers(entry, numbers, seen));
        return numbers;
    }

    const candidate = value.integrated_number
        || value.number
        || value.mobile
        || value.phone_number
        || value.whatsapp_number;
    if (candidate) numbers.add(String(candidate));

    Object.values(value).forEach((entry) => collectIntegratedNumbers(entry, numbers, seen));
    return numbers;
};

const checkMsg91WhatsApp = async () => {
    requireValues(['MSG91_WHATSAPP_AUTH_KEY']);

    const response = await fetch('https://control.msg91.com/api/v5/whatsapp/whatsapp-activation/', {
        headers: {
            accept: 'application/json',
            authkey: String(process.env.MSG91_WHATSAPP_AUTH_KEY).trim(),
        },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
    }

    const numbers = collectIntegratedNumbers(payload);
    if (numbers.size === 0) {
        throw new Error('credentials accepted, but no integrated WhatsApp number was found');
    }

    return `${numbers.size} integrated number(s) found`;
};

const checkMsg91Otp = async () => {
    requireValues(['MSG91_OTP_AUTH_KEY', 'MSG91_OTP_TEMPLATE_ID']);
    const mode = String(process.env.MSG91_OWNER_LOGIN_OTP_MODE || process.env.MSG91_OTP_MODE || '').trim().toLowerCase();
    if (mode !== 'msg91') {
        throw new Error('credentials/template present but OTP mode is not msg91');
    }
    return 'configuration present; sending requires a real test recipient';
};

const main = async () => {
    await run('Supabase PostgreSQL', checkDatabase);
    await run('Zoho SMTP', checkSmtp);
    await run('Google OAuth', checkGoogleOauth, { optional: true });
    await run('Razorpay platform account', checkRazorpay);
    await run('MSG91 WhatsApp', checkMsg91WhatsApp, { optional: true });
    await run('MSG91 phone OTP', checkMsg91Otp, { optional: true });

    await pool.end().catch(() => {});

    const failures = results.filter((entry) => entry.status === 'fail').length;
    const warnings = results.filter((entry) => entry.status === 'warn').length;
    console.log(`\nSummary: ${results.length - failures - warnings} passed, ${warnings} warnings, ${failures} failed.`);
    if (failures > 0) process.exitCode = 1;
};

main().catch(async (error) => {
    console.error(`FATAL ${error?.message || error}`);
    await pool.end().catch(() => {});
    process.exitCode = 1;
});