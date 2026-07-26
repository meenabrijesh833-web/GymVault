const assert = require('node:assert/strict');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..', '..');
require('dotenv').config({ path: path.join(workspaceRoot, '.env') });

const { adminPool, pool } = require('../../backend/config/db');
const { recordSecurityEvent, runtimeTelemetryMiddleware } = require('../../backend/utils/runtimeTelemetry');
const { paymentSignatureMatches, recordPaymentSignatureRejection } = require('../../backend/utils/paymentSecurity');
const { runWithTenantDbContext } = require('../../backend/utils/tenantDbContext');

const run = async () => {
    const marker = crypto.randomUUID();
    const insertedIds = [];
    let fixtureGymId = null;

    try {
        await recordSecurityEvent({
            method: 'POST',
            originalUrl: '/internal/security-event-check',
            ip: '127.0.0.1',
            headers: { 'user-agent': 'GymVault security-event check' },
        }, {
            eventType: 'TEST',
            severity: 'INFO',
            message: `Security event persistence check ${marker}`,
            statusCode: 401,
            metadata: {
                marker,
                authorization: 'Bearer fake-header.fake-payload.fake-signature',
                password: 'fake-password-value',
                email: 'fixture@example.com',
                phone: '+91 98765 43210',
                nested: {
                    token: 'fake-provider-token',
                    note: 'secret=fake-inline-secret',
                },
            },
        });

        const result = await adminPool.query(
            `SELECT id, event_type, source, status_code, metadata
             FROM system_runtime_events
             WHERE event_type = 'SECURITY_TEST'
               AND metadata->>'marker' = $1
             ORDER BY id DESC
             LIMIT 1`,
            [marker]
        );
        const event = result.rows[0];
        assert.ok(event, 'Security event was not persisted.');
        insertedIds.push(event.id);
        assert.equal(event.event_type, 'SECURITY_TEST');
        assert.equal(event.source, 'security');
        assert.equal(event.status_code, 401);
        assert.equal(event.metadata.authorization, '[REDACTED]');
        assert.equal(event.metadata.password, '[REDACTED]');
        assert.equal(event.metadata.email, '[REDACTED]');
        assert.equal(event.metadata.phone, '[REDACTED]');
        assert.equal(event.metadata.nested.token, '[REDACTED]');
        assert.match(event.metadata.nested.note, /secret=\[REDACTED\]/i);
        assert.doesNotMatch(
            JSON.stringify(event.metadata),
            /fake-password-value|fixture@example\.com|98765|fake-provider-token|fake-inline-secret/i
        );

        assert.equal(paymentSignatureMatches('expected-signature', 'expected-signature'), true);
        assert.equal(paymentSignatureMatches('expected-signature', 'invalid-signature'), false);
        const signatureRoute = `/internal/security-event-check/payment-signature/${marker}`;
        await recordPaymentSignatureRejection({
            method: 'POST',
            originalUrl: signatureRoute,
            ip: '127.0.0.1',
            headers: { 'user-agent': 'GymVault security-event check' },
        }, 'security_event_check');
        const signatureResult = await adminPool.query(
            `SELECT id, event_type, metadata
             FROM system_runtime_events
             WHERE event_type = 'SECURITY_PAYMENT_SIGNATURE_INVALID'
               AND route = $1
             ORDER BY id DESC
             LIMIT 1`,
            [signatureRoute]
        );
        const signatureEvent = signatureResult.rows[0];
        assert.ok(signatureEvent, 'Payment signature rejection event was not persisted.');
        insertedIds.push(signatureEvent.id);
        assert.deepEqual(signatureEvent.metadata.provider, 'razorpay');
        assert.deepEqual(signatureEvent.metadata.verification_flow, 'security_event_check');
        assert.doesNotMatch(JSON.stringify(signatureEvent), /expected-signature|invalid-signature/);

        const handledRoute = `/internal/security-event-check/handled-500/${marker}`;
        const handledRequest = {
            method: 'GET',
            originalUrl: handledRoute,
            path: handledRoute,
            query: {},
        };
        const handledResponse = new EventEmitter();
        handledResponse.statusCode = 200;
        handledResponse.status = function status(code) {
            this.statusCode = code;
            return this;
        };
        runtimeTelemetryMiddleware(handledRequest, handledResponse, () => {});
        handledResponse.status(500);
        handledResponse.emit('finish');

        let handledEvent = null;
        const handledDeadline = Date.now() + 3000;
        while (!handledEvent && Date.now() < handledDeadline) {
            const handledResult = await adminPool.query(
                `SELECT id, event_type, metadata
                 FROM system_runtime_events
                 WHERE event_type = 'REQUEST_ERROR'
                   AND route = $1
                 ORDER BY id DESC
                 LIMIT 1`,
                [handledRoute]
            );
            handledEvent = handledResult.rows[0] || null;
            if (!handledEvent) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
        }
        assert.ok(handledEvent, 'Handled 5xx event was not persisted.');
        insertedIds.push(handledEvent.id);
        assert.equal(handledEvent.metadata.stack_kind, 'response_status_callsite');
        assert.match(handledEvent.metadata.stack, /Handled server error response/);
        assert.doesNotMatch(handledEvent.metadata.stack, new RegExp(workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

        let gymResult = await adminPool.query('SELECT id FROM gyms ORDER BY id LIMIT 1');
        if (!gymResult.rows[0]) {
            gymResult = await adminPool.query(
                'INSERT INTO gyms (name) VALUES ($1) RETURNING id',
                [`Security event check ${marker}`]
            );
            fixtureGymId = Number(gymResult.rows[0].id);
        }
        const gymId = Number(gymResult.rows[0].id);
        const denialStartedAt = new Date();
        let denialError = null;
        try {
            await runWithTenantDbContext({ gymId, actorRole: 'OWNER' }, () => pool.query(
                `INSERT INTO audit_logs (gym_id, actor_type, action, target_type, details)
                 VALUES ($1, 'SYSTEM', 'SECURITY_EVENT_CHECK', 'TENANT_RLS', '{}'::jsonb)`,
                [gymId + 1000000]
            ));
        } catch (error) {
            denialError = error;
        }
        assert.equal(denialError?.code, '42501', 'Cross-tenant write was not denied by PostgreSQL RLS.');

        let denialEvent = null;
        const denialDeadline = Date.now() + 3000;
        while (!denialEvent && Date.now() < denialDeadline) {
            const denialResult = await adminPool.query(
                `SELECT id, event_type, source, status_code, gym_id, metadata
                 FROM system_runtime_events
                 WHERE event_type = 'SECURITY_DATABASE_ACCESS_DENIED'
                   AND gym_id = $1
                   AND created_at >= $2
                 ORDER BY id DESC
                 LIMIT 1`,
                [gymId, denialStartedAt]
            );
            denialEvent = denialResult.rows[0] || null;
            if (!denialEvent) {
                await new Promise((resolve) => setTimeout(resolve, 25));
            }
        }

        assert.ok(denialEvent, 'Database access denial event was not persisted.');
        insertedIds.push(denialEvent.id);
        assert.equal(denialEvent.source, 'security');
        assert.equal(denialEvent.status_code, 403);
        assert.equal(denialEvent.gym_id, gymId);
        assert.equal(denialEvent.metadata.database_error_code, '42501');
        assert.doesNotMatch(JSON.stringify(denialEvent.metadata), /INSERT INTO|SECURITY_EVENT_CHECK|1000000/);

        console.log('Security event persistence, redaction, and database denial checks passed.');
    } finally {
        if (insertedIds.length > 0) {
            await adminPool.query('DELETE FROM system_runtime_events WHERE id = ANY($1::INTEGER[])', [insertedIds]).catch(() => {});
        }
        if (fixtureGymId) {
            const cleanupClient = await adminPool.connect().catch(() => null);
            if (cleanupClient) {
                try {
                    await cleanupClient.query('BEGIN');
                    await cleanupClient.query("SELECT set_config('app.allow_gym_hard_delete', 'on', true)");
                    await cleanupClient.query('DELETE FROM gyms WHERE id = $1', [fixtureGymId]);
                    await cleanupClient.query('COMMIT');
                } catch (_error) {
                    await cleanupClient.query('ROLLBACK').catch(() => {});
                } finally {
                    cleanupClient.release();
                }
            }
        }
        await adminPool.end().catch(() => {});
    }
};

run().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
