const assert = require('node:assert/strict');
const { pool } = require('../../backend/config/db');
const {
    TABLE_POLICIES,
    TENANT_DERIVED_TABLES,
    TENANT_DIRECT_TABLES,
    TENANT_ROOT_TABLES,
} = require('../../database/tenantTablePolicy');

const runtimeRole = String(process.env.DB_TENANT_RUNTIME_ROLE || 'gymvault_app').trim().toLowerCase();
if (!/^[a-z][a-z0-9_]{0,62}$/.test(runtimeRole)) {
    throw new Error('DB_TENANT_RUNTIME_ROLE must be a valid PostgreSQL role name.');
}

const runtimeRoleIdentifier = `"${runtimeRole.replace(/"/g, '""')}"`;

const beginTenantTransaction = async (client, gymId) => {
    await client.query(`SET LOCAL ROLE ${runtimeRoleIdentifier}`);
    await client.query("SELECT set_config('app.current_gym_id', $1, true)", [String(gymId)]);
};

const rollbackQuietly = async (client) => {
    await client.query('ROLLBACK').catch(() => {});
};

const verifyTenantReads = async (client, gymId) => {
    await beginTenantTransaction(client, gymId);
    const auditVisibility = await client.query(
        'SELECT COUNT(*)::INTEGER AS leaked_rows FROM audit_logs WHERE gym_id <> $1',
        [gymId]
    );
    assert.equal(auditVisibility.rows[0].leaked_rows, 0, `Tenant ${gymId} can read another gym's audit rows.`);

    const gymVisibility = await client.query('SELECT id FROM gyms ORDER BY id');
    assert.deepEqual(gymVisibility.rows.map((row) => row.id), [gymId], `Tenant ${gymId} can read another gym root.`);
    await client.query('RESET ROLE');
};

const main = async () => {
    const client = await pool.connect();
    try {
        const roleResult = await client.query(
            `SELECT rolname, rolcanlogin, rolsuper, rolcreaterole, rolbypassrls
             FROM pg_roles
             WHERE rolname = $1`,
            [runtimeRole]
        );
        assert.equal(roleResult.rows.length, 1, `Runtime role ${runtimeRole} does not exist.`);
        assert.deepEqual(roleResult.rows[0], {
            rolname: runtimeRole,
            rolcanlogin: false,
            rolsuper: false,
            rolcreaterole: false,
            rolbypassrls: false,
        });

        const inventoryResult = await client.query(`
            SELECT
                cls.relname AS table_name,
                cls.relrowsecurity AS rls_enabled,
                EXISTS (
                    SELECT 1
                    FROM pg_attribute attribute
                    WHERE attribute.attrelid = cls.oid
                      AND attribute.attname = 'gym_id'
                      AND attribute.attnum > 0
                      AND NOT attribute.attisdropped
                ) AS has_gym_id,
                has_table_privilege($1, format('%I.%I', 'public', cls.relname), 'SELECT') AS can_select,
                has_table_privilege($1, format('%I.%I', 'public', cls.relname), 'INSERT') AS can_insert,
                has_table_privilege($1, format('%I.%I', 'public', cls.relname), 'UPDATE') AS can_update,
                has_table_privilege($1, format('%I.%I', 'public', cls.relname), 'DELETE') AS can_delete,
                has_table_privilege($1, format('%I.%I', 'public', cls.relname), 'TRUNCATE') AS can_truncate,
                has_table_privilege($1, format('%I.%I', 'public', cls.relname), 'REFERENCES') AS can_reference,
                has_table_privilege($1, format('%I.%I', 'public', cls.relname), 'TRIGGER') AS can_trigger
            FROM pg_class cls
            INNER JOIN pg_namespace namespace ON namespace.oid = cls.relnamespace
            WHERE namespace.nspname = 'public'
              AND cls.relkind IN ('r', 'p')
            ORDER BY cls.relname
        `, [runtimeRole]);
        assert.deepEqual(
            inventoryResult.rows.map((row) => row.table_name),
            Object.keys(TABLE_POLICIES).sort(),
            'The live physical table inventory differs from config/tenantTablePolicy.js.'
        );

        for (const row of inventoryResult.rows) {
            const policy = TABLE_POLICIES[row.table_name];
            const tenantProtected = policy.startsWith('tenant_');
            const expectedPrivileges = {
                can_select: policy !== 'admin_only',
                can_insert: ['tenant_direct', 'tenant_derived'].includes(policy),
                can_update: ['tenant_direct', 'tenant_derived', 'tenant_root'].includes(policy),
                can_delete: ['tenant_direct', 'tenant_derived'].includes(policy),
                can_truncate: false,
                can_reference: false,
                can_trigger: false,
            };
            assert.equal(row.has_gym_id, policy === 'tenant_direct', `${row.table_name} has an invalid gym_id classification.`);
            assert.equal(row.rls_enabled, tenantProtected, `${row.table_name} has an invalid RLS state.`);
            for (const [privilege, expected] of Object.entries(expectedPrivileges)) {
                assert.equal(row[privilege], expected, `${runtimeRole} has an invalid ${privilege} grant on ${row.table_name}.`);
            }
        }

        const protectedTables = [...TENANT_DIRECT_TABLES, ...TENANT_ROOT_TABLES, ...TENANT_DERIVED_TABLES].sort();
        const policiesResult = await client.query(`
            SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
            FROM pg_policies
            WHERE schemaname = 'public'
            ORDER BY tablename, policyname
        `);
        assert.deepEqual(
            policiesResult.rows.map((row) => row.tablename),
            protectedTables,
            'The live RLS policy inventory differs from the declared protected tables.'
        );
        for (const policy of policiesResult.rows) {
            const policyRoles = Array.isArray(policy.roles)
                ? policy.roles
                : String(policy.roles || '').replace(/^\{|\}$/g, '').split(',').filter(Boolean);
            assert.equal(policy.policyname, 'gymvault_tenant_isolation');
            assert.equal(policy.permissive, 'PERMISSIVE');
            assert.deepEqual(policyRoles, [runtimeRole]);
            assert.equal(policy.cmd, 'ALL');
            assert.match(policy.qual, /current_setting\('app\.current_gym_id'/);
            assert.match(policy.with_check, /current_setting\('app\.current_gym_id'/);
            if (TABLE_POLICIES[policy.tablename] === 'tenant_direct') {
                assert.match(policy.qual, /\bgym_id\b/);
                assert.match(policy.with_check, /\bgym_id\b/);
            } else if (TABLE_POLICIES[policy.tablename] === 'tenant_root') {
                assert.match(policy.qual, /\bid\b/);
                assert.match(policy.with_check, /\bid\b/);
            } else {
                assert.match(policy.qual, /pos_sales.*sale_id/s);
                assert.match(policy.with_check, /pos_sales.*sale_id/s);
            }
        }

        await client.query('BEGIN');
        const gymsResult = await client.query('SELECT id FROM gyms ORDER BY id LIMIT 2');
        const gymIds = gymsResult.rows.map((row) => row.id);
        while (gymIds.length < 2) {
            const fixture = await client.query(
                'INSERT INTO gyms (name) VALUES ($1) RETURNING id',
                [`RLS verification fixture ${gymIds.length + 1}`]
            );
            gymIds.push(fixture.rows[0].id);
        }
        const [firstGym, secondGym] = gymIds;

        await client.query(
            `INSERT INTO audit_logs (gym_id, actor_type, action, target_type, details)
             VALUES
                ($1, 'SYSTEM', 'RLS_FIXTURE', 'TENANT_RLS', '{}'::jsonb),
                ($2, 'SYSTEM', 'RLS_FIXTURE', 'TENANT_RLS', '{}'::jsonb)`,
            [firstGym, secondGym]
        );

        await verifyTenantReads(client, firstGym);
        await verifyTenantReads(client, secondGym);

        await beginTenantTransaction(client, firstGym);
        await client.query(
            `INSERT INTO audit_logs (gym_id, actor_type, action, target_type, details)
             VALUES ($1, 'SYSTEM', 'RLS_SELF_TEST', 'TENANT_RLS', '{}'::jsonb)`,
            [firstGym]
        );

        let rejected = false;
        try {
            await client.query(
                `INSERT INTO audit_logs (gym_id, actor_type, action, target_type, details)
                 VALUES ($1, 'SYSTEM', 'RLS_CROSS_TENANT_TEST', 'TENANT_RLS', '{}'::jsonb)`,
                [secondGym]
            );
        } catch (error) {
            rejected = error.code === '42501';
        }
        assert.equal(rejected, true, `Tenant ${firstGym} could insert an audit row for tenant ${secondGym}.`);

        console.log(`Tenant RLS checks passed for role ${runtimeRole} across transaction fixtures ${firstGym} and ${secondGym}.`);
    } finally {
        await rollbackQuietly(client);
        client.release();
        await pool.end();
    }
};

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});