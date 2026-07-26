const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { getRequestCookie, MEMBER_AUTH_COOKIE } = require('../utils/authCookies');
const { runWithTenantDbContext } = require('../utils/tenantDbContext');
const { recordSecurityEvent } = require('../utils/runtimeTelemetry');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'secret' || process.env.JWT_SECRET === 'gymvault_dev_secret_2026') {
    throw new Error('FATAL: JWT_SECRET is missing or insecure.');
}

module.exports = async (req, res, next) => {
    const headerToken = req.header('x-auth-token');
    const authHeader = req.header('authorization');
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const cookieToken = getRequestCookie(req, MEMBER_AUTH_COOKIE);
    const token = headerToken || bearerToken || cookieToken;
    const tokenSource = headerToken ? 'header' : bearerToken ? 'bearer' : cookieToken ? 'cookie' : '';

    if (!token) {
        void recordSecurityEvent(req, {
            eventType: 'JWT_MISSING',
            message: 'Member request rejected because authentication was missing.',
            statusCode: 401,
            metadata: { actor_type: 'member' },
        });
        return res.status(401).json({ message: 'No token, access denied' });
    }

    if (!SAFE_METHODS.has(req.method) && tokenSource === 'cookie') {
        void recordSecurityEvent(req, {
            eventType: 'JWT_HEADER_REQUIRED',
            message: 'Member mutation rejected because only cookie authentication was supplied.',
            statusCode: 401,
            metadata: { actor_type: 'member', token_source: tokenSource },
        });
        return res.status(401).json({ message: 'Refresh your session and try again.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.member?.id || !decoded?.member?.gym_id) {
            void recordSecurityEvent(req, {
                eventType: 'JWT_REJECTED',
                message: 'Member authentication token claims were invalid.',
                statusCode: 401,
                metadata: { actor_type: 'member', reason: 'invalid_claims', token_source: tokenSource },
            });
            return res.status(401).json({ message: 'Invalid member token.' });
        }

        const memberResult = await pool.query(
            `SELECT id, gym_id, status
             FROM members
             WHERE id = $1 AND gym_id = $2 AND deleted_at IS NULL
             LIMIT 1`,
            [decoded.member.id, decoded.member.gym_id]
        );

        if (memberResult.rows.length === 0) {
            void recordSecurityEvent(req, {
                eventType: 'TENANT_DENIED',
                message: 'Member identity did not match an active tenant record.',
                statusCode: 401,
                metadata: { actor_type: 'member', reason: 'member_not_found', token_source: tokenSource },
            });
            return res.status(401).json({ message: 'Member account is no longer available.' });
        }

        const memberRow = memberResult.rows[0];

        req.member = {
            ...decoded.member,
            id: memberRow.id,
            gym_id: memberRow.gym_id,
            status: memberRow.status,
        };
        req.user = {
            id: memberRow.id,
            gym_id: memberRow.gym_id,
            role: 'MEMBER',
        };
        req.memberAuthToken = token;
        req.memberAuthTokenSource = tokenSource;
        return runWithTenantDbContext({
            gymId: memberRow.gym_id,
            actorId: memberRow.id,
            actorRole: 'MEMBER',
        }, next);
    } catch (err) {
        void recordSecurityEvent(req, {
            eventType: 'JWT_REJECTED',
            message: 'Member authentication token verification failed.',
            statusCode: 401,
            metadata: { actor_type: 'member', reason: err?.name || 'verification_failed', token_source: tokenSource },
        });
        return res.status(401).json({ message: 'Token is not valid.' });
    }
};