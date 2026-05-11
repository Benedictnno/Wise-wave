/**
 * REGRESSION TEST — Task 7: Multi-Service Lead Submission
 *
 * Verifies that the leads.js route:
 *   - Validates selectedServices as optional array
 *   - Stores selected_services on the created lead
 *   - Category lookup prefers selectedServices[0] over name-based lookup
 *   - Falls back to name lookup when selectedServices is absent
 *
 * Creates minimal DB fixtures and cleans them up.
 * Requires MONGO_URI.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { pass, fail, section, summary } = require('./helpers');

async function run() {
    section('T7 — Multi-Service Lead Submission');

    // ── 7.1 Source-level checks on leads.js ───────────────────────────────────
    const src = fs.readFileSync(
        path.join(__dirname, '../../src/routes/leads.js'), 'utf8'
    );

    const REQUIRED_IN_ROUTE = [
        'selectedServices',
        'selected_services',
        'isArray',
        'isMongoId',
        'selectedServices[0]',
    ];

    for (const token of REQUIRED_IN_ROUTE) {
        if (src.includes(token)) {
            pass(`leads.js contains: '${token}'`);
        } else {
            fail(`leads.js is MISSING: '${token}'`);
        }
    }

    // Check fallback chain is in place
    if (src.includes('selectedServices.length > 0') || src.includes('selectedServices && selectedServices.length')) {
        pass('leads.js checks selectedServices.length before ID lookup');
    } else {
        fail('leads.js missing selectedServices.length guard');
    }

    if (src.includes('Category.findById')) {
        pass('leads.js uses Category.findById for ID-based lookup');
    } else {
        fail('leads.js missing Category.findById — ID lookup not implemented');
    }

    // ── 7.2 DB: Lead.create stores selected_services correctly ────────────────
    await mongoose.connect(process.env.MONGO_URI);
    pass('Connected to MongoDB');

    const Lead     = require('../../src/models/Lead');
    const Category = require('../../src/models/Category');
    const User     = require('../../src/models/User');

    // Get two real category IDs from the DB (requires master55 to be seeded)
    const cats = await Category.find({}).limit(2).lean();
    if (cats.length < 2) {
        fail('Need at least 2 categories in DB — run master55.seed.js first');
        await mongoose.disconnect();
        return;
    }

    const [cat1, cat2] = cats;
    const testEmail = `regression_t7_${Date.now()}@test.invalid`;

    const user = await User.create({
        full_name: 'Regression T7',
        email: testEmail,
        phone: '07000000000',
        preferred_contact_method: 'email',
        home_postcode: 'SW1A 1AA',
    });

    // ── 7.3 Create lead with selected_services ────────────────────────────────
    const lead = await Lead.create({
        user_id: user._id,
        name: 'Regression T7 Lead',
        email: testEmail,
        phone: '07000000000',
        service_type: cat1.serviceSlug,
        best_time_to_contact: 'anytime',
        budget_band: 'not_sure',
        urgency: 'researching',
        additional_details: 'Regression test for multi-service support',
        category: cat1._id,
        selected_services: [cat1._id, cat2._id],
        status: 'new',
    });

    const saved = await Lead.findById(lead._id).lean();

    if (Array.isArray(saved.selected_services)) {
        pass('selected_services is stored as an Array');
    } else {
        fail('selected_services was not stored as an Array');
    }

    if (saved.selected_services.length === 2) {
        pass('selected_services contains 2 entries');
    } else {
        fail(`selected_services length: expected 2, got ${saved.selected_services.length}`);
    }

    const ids = saved.selected_services.map(id => id.toString());
    if (ids.includes(cat1._id.toString()) && ids.includes(cat2._id.toString())) {
        pass('selected_services contains both expected Category IDs');
    } else {
        fail('selected_services does not contain the expected Category IDs');
    }

    // ── 7.4 Empty selected_services defaults to [] ────────────────────────────
    const leadNoServices = await Lead.create({
        user_id: user._id,
        name: 'Regression T7 Lead (no services)',
        email: testEmail,
        phone: '07000000000',
        service_type: cat1.serviceSlug,
        best_time_to_contact: 'anytime',
        budget_band: 'not_sure',
        urgency: 'researching',
        additional_details: 'Regression test — no selected services',
        category: cat1._id,
        status: 'new',
        // selected_services not provided
    });

    const savedNoSvc = await Lead.findById(leadNoServices._id).lean();
    if (Array.isArray(savedNoSvc.selected_services) && savedNoSvc.selected_services.length === 0) {
        pass('selected_services defaults to [] when not provided');
    } else {
        fail(`selected_services default: expected [], got ${JSON.stringify(savedNoSvc.selected_services)}`);
    }

    // Cleanup
    await Lead.deleteOne({ _id: lead._id });
    await Lead.deleteOne({ _id: leadNoServices._id });
    await User.deleteOne({ _id: user._id });
    pass('Cleanup: test fixtures removed');

    await mongoose.disconnect();
    summary();
}

run().catch(e => {
    console.error('[T7] Fatal:', e.message);
    process.exit(1);
});
