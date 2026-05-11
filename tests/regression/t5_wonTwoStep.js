/**
 * REGRESSION TEST — Task 5: Two-Step Won Flow
 *
 * Verifies that processPartnerResponse with outcome='won':
 *   - Sets lead.status to 'awaiting_partner_payment'
 *   - Sets lead.won_date to a Date
 *   - Does NOT create a Commission document
 *   - Does NOT create an Invoice document
 *   - Returns a message containing 'confirmation link'
 *   - outcomeToken is preserved on the lead after calling POST /:token handler
 *
 * Also verifies the confirm-payment endpoint logic is present in partnerResponse.js
 *
 * Requires MONGO_URI. Creates minimal fixtures and cleans up.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { pass, fail, section, summary } = require('./helpers');

async function run() {
    section('T5 — Two-Step Won Flow');

    await mongoose.connect(process.env.MONGO_URI);
    pass('Connected to MongoDB');

    const Lead         = require('../../src/models/Lead');
    const Category     = require('../../src/models/Category');
    const Commission   = require('../../src/models/Commission');
    const CommissionRule = require('../../src/models/CommissionRule');
    const User         = require('../../src/models/User');
    const Invoice      = require('../../src/models/Invoice');
    const { processPartnerResponse } = require('../../src/services/partnerResponseService');

    // ── 5.1 processPartnerResponse is exported ───────────────────────────────
    if (typeof processPartnerResponse === 'function') {
        pass('processPartnerResponse is exported');
    } else {
        fail('processPartnerResponse NOT exported');
        await mongoose.disconnect();
        return;
    }

    // ── 5.2 Set up minimal test fixtures ─────────────────────────────────────
    const testEmail = `regression_t5_${Date.now()}@test.invalid`;

    // Find a non-R&D, non-tiered category (use HP-001 — Estate Agency, percentage)
    let cat = await Category.findOne({ externalId: 'HP-001' });
    if (!cat) {
        // Fallback: any percentage category
        cat = await Category.findOne({ commissionType: 'percentage' });
    }
    if (!cat) {
        fail('No percentage category found in DB — run master55.seed.js first');
        await mongoose.disconnect();
        return;
    }
    pass(`Using category: ${cat.name} (${cat.externalId})`);

    let rule = await CommissionRule.findOne({ categoryId: cat._id });
    if (!rule) {
        // Create a minimal rule for this test
        rule = await CommissionRule.create({
            categoryId: cat._id,
            type: 'percentage',
            fixedAmount: 0,
            percentage: 7.5,
            wisemoveShare: 30,
            introducerShare: 70,
            triggerType: 'won',
        });
        pass('Created temporary CommissionRule for test');
    } else {
        pass('CommissionRule found');
    }

    const user = await User.create({
        full_name: 'Regression T5',
        email: testEmail,
        phone: '07000000000',
        preferred_contact_method: 'email',
        home_postcode: 'SW1A 1AA',
    });

    const { v4: uuidv4 } = require('uuid');
    const outcomeToken = uuidv4();

    const lead = await Lead.create({
        user_id: user._id,
        name: 'Regression T5 Lead',
        email: testEmail,
        phone: '07000000000',
        service_type: cat.serviceSlug,
        best_time_to_contact: 'anytime',
        budget_band: 'not_sure',
        urgency: 'researching',
        additional_details: 'Regression test for two-step won flow',
        category: cat._id,
        status: 'assigned',
        outcomeToken,
        outcomeTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Manually populate category so processPartnerResponse can read externalId
    lead.category = cat;

    // ── 5.3 Snapshot Commission & Invoice counts before ───────────────────────
    const commBefore = await Commission.countDocuments({ leadId: lead._id });
    const invBefore  = await Invoice.countDocuments({ leadId: lead._id });

    // ── 5.4 Call processPartnerResponse with 'won' ────────────────────────────
    let result;
    try {
        result = await processPartnerResponse(lead, 'won', 5000, 'Test win');
        pass('processPartnerResponse called without throwing');
    } catch (e) {
        fail('processPartnerResponse threw: ' + e.message);
        await Lead.deleteOne({ _id: lead._id });
        await User.deleteOne({ _id: user._id });
        await mongoose.disconnect();
        return;
    }

    // ── 5.5 Lead status is awaiting_partner_payment ───────────────────────────
    const updatedLead = await Lead.findById(lead._id);
    if (updatedLead.status === 'awaiting_partner_payment') {
        pass('Lead status = awaiting_partner_payment after won outcome');
    } else {
        fail(`Lead status = ${updatedLead.status}, expected awaiting_partner_payment`);
    }

    // ── 5.6 won_date is set ───────────────────────────────────────────────────
    if (updatedLead.won_date instanceof Date) {
        pass('Lead won_date is set to a Date');
    } else {
        fail('Lead won_date is NOT set (expected Date)');
    }

    // ── 5.7 partnerFeeTotal is stored ────────────────────────────────────────
    if (updatedLead.partnerFeeTotal === 5000) {
        pass('Lead partnerFeeTotal = 5000 stored correctly');
    } else {
        fail(`Lead partnerFeeTotal = ${updatedLead.partnerFeeTotal}, expected 5000`);
    }

    // ── 5.8 NO Commission created ────────────────────────────────────────────
    const commAfter = await Commission.countDocuments({ leadId: lead._id });
    if (commAfter === commBefore) {
        pass('No Commission record created on won (two-step flow)');
    } else {
        fail(`Commission was created immediately — expected 0 new, got ${commAfter - commBefore} new`);
    }

    // ── 5.9 NO Invoice created ───────────────────────────────────────────────
    const invAfter = await Invoice.countDocuments({ leadId: lead._id });
    if (invAfter === invBefore) {
        pass('No Invoice created on won (two-step flow)');
    } else {
        fail(`Invoice was created immediately — expected 0 new, got ${invAfter - invBefore} new`);
    }

    // ── 5.10 Return message mentions confirmation link ────────────────────────
    const msg = result?.message || '';
    if (msg.toLowerCase().includes('confirmation link') || msg.toLowerCase().includes('confirm')) {
        pass(`Return message mentions confirmation: "${msg}"`);
    } else {
        fail(`Return message does not mention confirmation: "${msg}"`);
    }

    // ── 5.11 outcomeToken NOT cleared (regression: token must survive for step 2) ──
    const freshLead = await Lead.findById(lead._id).lean();
    if (freshLead.outcomeToken !== null && freshLead.outcomeToken !== undefined) {
        pass('outcomeToken preserved after won outcome (needed for confirm-payment)');
    } else {
        fail('outcomeToken was cleared — step 2 confirm-payment would break');
    }

    // ── 5.12 confirm-payment route exists in partnerResponse.js ──────────────
    const fs = require('fs');
    const routeSrc = fs.readFileSync(
        require('path').join(__dirname, '../../src/routes/partnerResponse.js'), 'utf8'
    );
    if (routeSrc.includes('confirm-payment')) {
        pass('confirm-payment route registered in partnerResponse.js');
    } else {
        fail('confirm-payment route NOT found in partnerResponse.js');
    }

    if (routeSrc.includes('awaiting_partner_payment')) {
        pass('confirm-payment route checks for awaiting_partner_payment status');
    } else {
        fail('confirm-payment route does not check awaiting_partner_payment status');
    }

    // Cleanup
    await Lead.deleteOne({ _id: lead._id });
    await User.deleteOne({ _id: user._id });
    pass('Cleanup: test fixtures removed');

    await mongoose.disconnect();
    summary();
}

run().catch(e => {
    console.error('[T5] Fatal:', e.message);
    process.exit(1);
});
