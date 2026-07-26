const TERMS_VERSION = '2026-04-15';
const PRIVACY_VERSION = '2026-04-15';

const validateLegalAcceptance = (body = {}) => (
    body.legal_acceptance === true
    && String(body.terms_version || '') === TERMS_VERSION
    && String(body.privacy_version || '') === PRIVACY_VERSION
);

const recordLegalConsent = async (db, {
    userId,
    gymId,
    email,
    source,
    request,
}) => {
    await db.query(
        `INSERT INTO legal_consents (
            user_id, gym_id, email, terms_version, privacy_version,
            acceptance_source, accepted_ip, user_agent
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            userId,
            gymId,
            email,
            TERMS_VERSION,
            PRIVACY_VERSION,
            source,
            String(request?.ip || request?.socket?.remoteAddress || '').slice(0, 80) || null,
            String(request?.get?.('user-agent') || '').slice(0, 500) || null,
        ]
    );
};

module.exports = {
    PRIVACY_VERSION,
    TERMS_VERSION,
    recordLegalConsent,
    validateLegalAcceptance,
};