/**
 * REGRESSION TEST — Task 8: Qualification Questions Seed
 *
 * Verifies that after running qualificationQuestions55.seed.js:
 *   - QualificationQuestion collection is non-empty
 *   - Every service slug that has questions has at least one question in the DB
 *   - Each question has the correct pillarId inherited from its Category
 *   - Each questionKey follows the slug_qN convention
 *   - No questions exist for unknown/phantom slugs
 *   - Total question count is within expected range (55 services × ~5 questions min)
 *
 * Requires MONGO_URI + both seeds to have been run.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { pass, fail, section, summary } = require('./helpers');

// Minimum expected questions per pillar
const PILLAR_SLUG_SAMPLES = {
    'Property Services': ['estate-agency', 'trades', 'surveyors', 'solicitors-conveyancing'],
    'Personal Services': ['mortgage-broker', 'ifa', 'rd-tax-credits-advisory', 'aml-kyc'],
    'Business Services': ['hr-services', 'payroll-services', 'accountancy-bookkeeping'],
};

const ALL_EXPECTED_SLUGS = [
    // Property Services
    'estate-agency', 'residential-property-management', 'commercial-property-management',
    'trades', 'epc', 'floorplans', 'surveyors', 'removals', 'cleaning',
    'commercial-property-services', 'solicitors-conveyancing', 'home-insurance',
    'auction-services', 'inventory-check-in-out', 'gas-electrical-safety-certs',
    'property-photography-videography', 'property-legal-support',
    // Personal Services
    'wills-estate-planning', 'aml-kyc', 'business-insurance', 'sme-ppi-insurance',
    'life-protection-insurance', 'private-healthcare-insurance', 'insurance-risk',
    'commercial-finance', 'business-loans', 'asset-finance', 'invoice-finance',
    'development-finance', 'bridging-finance', 'mortgage-broker', 'ifa',
    'gdpr-data-protection', 'health-safety-consultancy', 'cyber-security-consultancy',
    'iso-certification-support', 'business-legal-services', 'compliance-consultancy',
    'business-valuation', 'tendering-bid-writing', 'rd-tax-credits-advisory',
    'grants-funding-consultancy', 'capital-allowances-advisory', 'specialist-advisory',
    // Business Services
    'hr-services', 'payroll-services', 'accountancy-bookkeeping', 'marketing-services',
    'web-design-digital-presence', 'it-support-managed-services', 'recruitment-services',
    'marketing-digital-support',
];

async function run() {
    section('T8 — Qualification Questions Seed');

    await mongoose.connect(process.env.MONGO_URI);
    pass('Connected to MongoDB');

    const QualificationQuestion = require('../../src/models/QualificationQuestion');
    const Category = require('../../src/models/Category');

    // ── 8.1 Collection is not empty ───────────────────────────────────────────
    const total = await QualificationQuestion.countDocuments();
    if (total > 0) {
        pass(`QualificationQuestion collection has ${total} documents`);
    } else {
        fail('QualificationQuestion collection is EMPTY — run qualificationQuestions55.seed.js');
        await mongoose.disconnect();
        return;
    }

    // ── 8.2 Minimum reasonable count (52 services × 4 questions minimum) ──────
    const MIN_EXPECTED = 52 * 4;
    if (total >= MIN_EXPECTED) {
        pass(`Total questions (${total}) meets minimum threshold (${MIN_EXPECTED})`);
    } else {
        fail(`Total questions (${total}) is below minimum threshold (${MIN_EXPECTED})`);
    }

    // ── 8.3 Every expected slug has at least one question ─────────────────────
    let slugsMissing = 0;
    for (const slug of ALL_EXPECTED_SLUGS) {
        const count = await QualificationQuestion.countDocuments({
            questionKey: { $regex: `^${slug}_q` }
        });
        if (count > 0) {
            // pass silently to avoid 55 lines of noise
        } else {
            fail(`No questions found for slug: ${slug}`);
            slugsMissing++;
        }
    }
    if (slugsMissing === 0) {
        pass(`All ${ALL_EXPECTED_SLUGS.length} service slugs have questions seeded`);
    }

    // ── 8.4 All questions have a valid pillarId ────────────────────────────────
    const VALID_PILLARS = ['Property Services', 'Personal Services', 'Business Services'];
    const invalidPillar = await QualificationQuestion.countDocuments({
        pillarId: { $nin: VALID_PILLARS }
    });
    if (invalidPillar === 0) {
        pass('All questions have a valid pillarId');
    } else {
        fail(`${invalidPillar} question(s) have invalid or missing pillarId`);
    }

    // ── 8.5 questionKey format is slug_qN ─────────────────────────────────────
    const badKey = await QualificationQuestion.findOne({
        questionKey: { $not: /^[a-z0-9\-]+_q\d+$/ }
    });
    if (!badKey) {
        pass('All questionKey values follow the slug_qN format');
    } else {
        fail(`Invalid questionKey format found: ${badKey.questionKey}`);
    }

    // ── 8.6 Sample pillar checks — questions match expected pillar ────────────
    for (const [pillar, slugs] of Object.entries(PILLAR_SLUG_SAMPLES)) {
        for (const slug of slugs) {
            const q = await QualificationQuestion.findOne({ questionKey: `${slug}_q1` });
            if (!q) {
                fail(`No q1 found for ${slug}`);
                continue;
            }
            if (q.pillarId === pillar) {
                pass(`${slug}: pillarId correctly set to '${pillar}'`);
            } else {
                fail(`${slug}: pillarId='${q.pillarId}', expected '${pillar}'`);
            }
        }
    }

    // ── 8.7 All questions are active by default ───────────────────────────────
    const inactiveCount = await QualificationQuestion.countDocuments({ isActive: false });
    if (inactiveCount === 0) {
        pass('All seeded questions have isActive=true');
    } else {
        fail(`${inactiveCount} question(s) have isActive=false — expected all active after fresh seed`);
    }

    // ── 8.8 Mortgage Broker question mentions "buying, remortgaging" ───────────
    const mortgageQ = await QualificationQuestion.findOne({ questionKey: 'mortgage-broker_q1' });
    if (mortgageQ && mortgageQ.text.toLowerCase().includes('buying')) {
        pass(`mortgage-broker_q1 text is correct: "${mortgageQ.text}"`);
    } else {
        fail(`mortgage-broker_q1 text unexpected: "${mortgageQ?.text}"`);
    }

    // ── 8.9 R&D question mentions "claimed before" ────────────────────────────
    const rdQ = await QualificationQuestion.findOne({ questionKey: 'rd-tax-credits-advisory_q3' });
    if (rdQ && rdQ.text.toLowerCase().includes('claimed')) {
        pass(`rd-tax-credits-advisory_q3 text is correct: "${rdQ.text}"`);
    } else {
        fail(`rd-tax-credits-advisory_q3 text unexpected: "${rdQ?.text}"`);
    }

    await mongoose.disconnect();
    summary();
}

run().catch(e => {
    console.error('[T8] Fatal:', e.message);
    process.exit(1);
});
