const crypto = require('crypto');
const { recordSecurityEvent } = require('./runtimeTelemetry');

const paymentSignatureMatches = (expectedSignature, providedSignature) => {
    const expected = Buffer.from(String(expectedSignature || ''), 'utf8');
    const provided = Buffer.from(String(providedSignature || ''), 'utf8');
    return expected.length > 0
        && expected.length === provided.length
        && crypto.timingSafeEqual(expected, provided);
};

const recordPaymentSignatureRejection = (req, verificationFlow) => recordSecurityEvent(req, {
    eventType: 'PAYMENT_SIGNATURE_INVALID',
    severity: 'WARN',
    message: 'Razorpay payment signature verification failed.',
    statusCode: 400,
    metadata: {
        provider: 'razorpay',
        verification_flow: String(verificationFlow || 'unknown').slice(0, 80),
    },
});

module.exports = {
    paymentSignatureMatches,
    recordPaymentSignatureRejection,
};