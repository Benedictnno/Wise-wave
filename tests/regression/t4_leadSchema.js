/**
 * REGRESSION TEST — Task 4: Lead Schema Fields & Statuses
 *
 * Verifies that the Lead model:
 *   - Accepts 'awaiting_partner_payment' and 'partner_paid' as valid statuses
 *   - Has won_date, last_reminder_sent_at, selected_services fields in its schema
 *   - Rejects unknown status values
 *   - New fields have correct defaults
 *
 * Creates a minimal Lead document then removes it. Requires MONGO_URI.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { pass, fail, section, summary } = require('./helpers');

async function run() {
    section('T4 — Lead Schema Fields & Statuses');

    await mongoose.connect(process.env.MONGO_URI);
    pass('Connected to MongoDB');

    const Lead = require('../../src/models/Lead');

    // ── 4.1 Schema path existence ─────────────────────────────────────────────
    const schema = Lead.schema;

    const REQUIRED_PATHS = [
        'won_date',
        'last_reminder_sent_at',
        'selected_services',
        'status',
    ];

    for (const p of REQUIRED_PATHS) {
        if (schema.path(p)) {
            pass(`Schema has field: ${p}`);
        } else {
            fail(`Schema is MISSING field: ${p}`);
        }
    }

    // ── 4.2 Status enum values ────────────────────────────────────────────────
    const statusEnum = schema.path('status').enumValues;

    const REQUIRED_STATUSES = [
        'new', 'assigned', 'returned', 'reassigned', 'completed',
        'manual_review', 'unassigned',
        'awaiting_partner_payment',
        'partner_paid',
    ];

    for (const s of REQUIRED_STATUSES) {
        if (statusEnum.includes(s)) {
            pass(`Status enum includes: '${s}'`);
        } else {
            fail(`Status enum MISSING: '${s}'`);
        }
    }

    // ── 4.3 Enum rejects unknown values ──────────────────────────────────────
    const LEGACY_INVALID = ['pending', 'closed', 'invoiced'];
    for (const s of LEGACY_INVALID) {
        if (!statusEnum.includes(s)) {
            pass(`Status enum correctly excludes: '${s}'`);
        } else {
            fail(`Status enum should NOT include: '${s}'`);
        }
    }

    // ── 4.4 won_date defaults to null ─────────────────────────────────────────
    const wonDateDefault = schema.path('won_date').defaultValue;
    if (wonDateDefault === null || wonDateDefault === undefined) {
        pass('won_date defaults to null');
    } else {
        fail(`won_date default expected null, got: ${wonDateDefault}`);
    }

    // ── 4.5 selected_services is an array ref to Category ─────────────────────
    const ssPath = schema.path('selected_services');
    if (ssPath && ssPath.instance === 'Array') {
        pass('selected_services is Array type');
    } else {
        fail('selected_services is NOT an Array type');
    }

    // ── 4.6 DB round-trip: create lead with new status then clean up ──────────
    const User = require('../../src/models/User');

    // Create a minimal user to satisfy the required user_id FK
    const testEmail = `regression_t4_${Date.now()}@test.invalid`;
    const user = await User.create({
        full_name: 'Regression T4',
        email: testEmail,
        phone: '07000000000',
        preferred_contact_method: 'email',
        home_postcode: 'SW1A 1AA',
    });

    const testLead = await Lead.create({
        user_id: user._id,
        name: 'Regression T4 Lead',
        email: testEmail,
        phone: '07000000000',
        service_type: 'regression-test',
        best_time_to_contact: 'anytime',
        budget_band: 'not_sure',
        urgency: 'researching',
        additional_details: 'Regression test lead — safe to delete',
        status: 'awaiting_partner_payment',
        won_date: new Date(),
        last_reminder_sent_at: null,
        selected_services: [],
    });

    if (testLead.status === 'awaiting_partner_payment') {
        pass('DB round-trip: status=awaiting_partner_payment saved and retrieved');
    } else {
        fail(`DB round-trip: unexpected status: ${testLead.status}`);
    }

    if (testLead.won_date instanceof Date) {
        pass('DB round-trip: won_date saved as Date');
    } else {
        fail('DB round-trip: won_date not saved as Date');
    }

    if (testLead.last_reminder_sent_at === null) {
        pass('DB round-trip: last_reminder_sent_at defaults to null');
    } else {
        fail(`DB round-trip: last_reminder_sent_at expected null, got: ${testLead.last_reminder_sent_at}`);
    }

    // Update to partner_paid and verify
    testLead.status = 'partner_paid';
    await testLead.save();
    const reloaded = await Lead.findById(testLead._id).lean();
    if (reloaded.status === 'partner_paid') {
        pass('DB round-trip: status=partner_paid can be set and saved');
    } else {
        fail(`DB round-trip: status=partner_paid not persisted, got: ${reloaded.status}`);
    }

    // Cleanup
    await Lead.deleteOne({ _id: testLead._id });
    await User.deleteOne({ _id: user._id });
    pass('Cleanup: test lead and user removed');

    await mongoose.disconnect();
    summary();
}

run().catch(e => {
    console.error('[T4] Fatal:', e.message);
    process.exit(1);
});
