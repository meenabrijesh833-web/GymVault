process.env.DB_TENANT_RLS_ENFORCE = 'true';

const assert = require('node:assert/strict');
const { pool, adminPool } = require('../../backend/config/db');
const { runWithTenantDbContext } = require('../../backend/utils/tenantDbContext');

const runtimeRole = String(process.env.DB_TENANT_RUNTIME_ROLE || 'gymvault_app').trim().toLowerCase();

const assertTenantSession = (row, gymId) => {
    assert.equal(row.current_user, runtimeRole);
    assert.equal(row.gym_id, String(gymId));
};

const main = async () => {
    assert.ok(adminPool.options.max <= 8, 'The runtime pool must stay below the hosted session limit.');
    assert.ok(adminPool.options.min <= 1, 'The runtime pool must reserve hosted sessions for deploys and operations.');

    const adminResult = await pool.query(
        "SELECT current_user, current_setting('app.current_gym_id', true) AS gym_id"
    );
    assert.notEqual(adminResult.rows[0].current_user, runtimeRole);
    assert.ok(!adminResult.rows[0].gym_id);

    await runWithTenantDbContext({ gymId: 101, actorId: 1, actorRole: 'OWNER' }, async () => {
        const queryResult = await pool.query(
            "SELECT current_user, current_setting('app.current_gym_id', true) AS gym_id"
        );
        assertTenantSession(queryResult.rows[0], 101);

        const client = await pool.connect();
        try {
            const clientResult = await client.query(
                "SELECT current_user, current_setting('app.current_gym_id', true) AS gym_id"
            );
            assertTenantSession(clientResult.rows[0], 101);
        } finally {
            await client.release();
        }

        const concurrentResults = await Promise.all(Array.from({ length: 20 }, () => pool.query(
            "SELECT current_user, current_setting('app.current_gym_id', true) AS gym_id"
        )));
        concurrentResults.forEach((result) => assertTenantSession(result.rows[0], 101));
    });

    const resetResult = await pool.query(
        "SELECT current_user, current_setting('app.current_gym_id', true) AS gym_id"
    );
    assert.notEqual(resetResult.rows[0].current_user, runtimeRole);
    assert.ok(!resetResult.rows[0].gym_id);

    console.log(`Tenant database context checks passed for role ${runtimeRole}.`);
};

main()
    .catch((error) => {
        console.error(error.message || error);
        process.exitCode = 1;
    })
    .finally(() => pool.end().catch(() => {}));