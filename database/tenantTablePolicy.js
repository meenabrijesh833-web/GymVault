const TABLE_POLICIES = Object.freeze({
    access_policies: 'tenant_direct',
    api_keys: 'tenant_direct',
    attendance: 'tenant_direct',
    audit_logs: 'tenant_direct',
    billing_coupon_redemptions: 'tenant_direct',
    broadcast_logs: 'tenant_direct',
    class_bookings: 'tenant_direct',
    class_sessions: 'tenant_direct',
    class_types: 'tenant_direct',
    expenses: 'tenant_direct',
    family_groups: 'tenant_direct',
    gym_message_templates: 'tenant_direct',
    gym_support_profiles: 'tenant_direct',
    gyms: 'tenant_root',
    leads: 'tenant_direct',
    legal_consents: 'tenant_direct',
    member_badges: 'tenant_direct',
    member_documents: 'tenant_direct',
    member_notes: 'tenant_direct',
    member_notification_automation_log: 'tenant_direct',
    member_streaks: 'tenant_direct',
    member_waivers: 'tenant_direct',
    members: 'tenant_direct',
    memberships: 'tenant_direct',
    notification_automation_log: 'tenant_direct',
    notifications: 'tenant_direct',
    operational_archives: 'admin_only',
    password_reset_otps: 'admin_only',
    payment_collections: 'tenant_direct',
    payment_retry_schedule: 'tenant_direct',
    payments: 'tenant_direct',
    payroll_auto_config: 'tenant_direct',
    payroll_entries: 'tenant_direct',
    payroll_payout_settings: 'tenant_direct',
    payroll_staff_destinations: 'tenant_direct',
    plans: 'tenant_direct',
    platform_settings: 'shared_read',
    pos_products: 'tenant_direct',
    pos_sale_items: 'tenant_derived',
    pos_sales: 'tenant_direct',
    push_subscriptions: 'tenant_direct',
    rfid_devices: 'tenant_direct',
    rfid_events: 'tenant_direct',
    saved_reports: 'tenant_direct',
    schema_migrations: 'admin_only',
    staff_tasks: 'tenant_direct',
    support_ticket_messages: 'tenant_direct',
    support_tickets: 'tenant_direct',
    system_runtime_events: 'tenant_direct',
    trainer_assignments: 'tenant_direct',
    trainer_tasks: 'tenant_direct',
    user_login_otps: 'admin_only',
    users: 'tenant_direct',
    webhooks: 'tenant_direct',
    whatsapp_delivery_logs: 'tenant_direct',
    whatsapp_inbound_logs: 'tenant_direct',
});

const VALID_TABLE_POLICIES = new Set([
    'admin_only',
    'shared_read',
    'tenant_derived',
    'tenant_direct',
    'tenant_root',
]);

const tablesForPolicy = (policy) => Object.freeze(
    Object.entries(TABLE_POLICIES)
        .filter(([, tablePolicy]) => tablePolicy === policy)
        .map(([tableName]) => tableName)
);

for (const [tableName, policy] of Object.entries(TABLE_POLICIES)) {
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(tableName) || !VALID_TABLE_POLICIES.has(policy)) {
        throw new Error(`Invalid physical table policy inventory entry: ${tableName}.`);
    }
}

module.exports = {
    TABLE_POLICIES,
    ADMIN_ONLY_TABLES: tablesForPolicy('admin_only'),
    SHARED_READ_TABLES: tablesForPolicy('shared_read'),
    TENANT_DERIVED_TABLES: tablesForPolicy('tenant_derived'),
    TENANT_DIRECT_TABLES: tablesForPolicy('tenant_direct'),
    TENANT_ROOT_TABLES: tablesForPolicy('tenant_root'),
};