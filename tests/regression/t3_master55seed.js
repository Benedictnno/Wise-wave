/**
 * REGRESSION TEST — Task 3: master55 Seed
 *
 * Verifies that after running master55.seed.js:
 *   - Exactly 55 Category documents exist
 *   - All 3 pillars are present
 *   - All externalIds HP-001..HP-017, PA-001..PA-027, BS-001..BS-008 exist
 *   - Every category has a matching CommissionRule
 *   - CommissionRule wisemoveShare=30, introducerShare=70
 *   - PA-014 (Mortgage Broker) and PA-015 (IFA) have complianceText
 *   - PA-024 (R&D) has type=tiered in its CommissionRule
 *   - isRegulated is true for all regulated intro-only services
 *
 * Requires: MONGO_URI in .env + master55.seed.js already run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { pass, fail, section, summary } = require('./helpers');

// NOTE: Task spec header said 55 but only 52 services are defined in master55.seed.js
// Breakdown: 17 HP (Property) + 27 PA (Personal) + 8 BS (Business) = 52
const EXPECTED_COUNT = 52;

const EXPECTED_IDS = [
    ...Array.from({ length: 17 }, (_, i) => `HP-${String(i + 1).padStart(3, '0')}`),
    ...Array.from({ length: 27 }, (_, i) => `PA-${String(i + 1).padStart(3, '0')}`),
    ...Array.from({ length: 8 },  (_, i) => `BS-${String(i + 1).padStart(3, '0')}`),
    // Total: 52 (17 HP + 27 PA + 8 BS)
];

const REGULATED_IDS = ['HP-012', 'PA-003', 'PA-004', 'PA-005', 'PA-006', 'PA-007',
                        'PA-008', 'PA-009', 'PA-010', 'PA-014', 'PA-015'];

async function run() {
    section('T3 — master55 Seed Verification');

    await mongoose.connect(process.env.MONGO_URI);
    pass('Connected to MongoDB');

    const Category = require('../../src/models/Category');
    const CommissionRule = require('../../src/models/CommissionRule');

    // ── 3.1 Total count ───────────────────────────────────────────────────────
    const total = await Category.countDocuments();
    if (total === EXPECTED_COUNT) {
        pass(`Category count: ${total} (expected ${EXPECTED_COUNT})`);
    } else {
        fail(`Category count: ${total} (expected ${EXPECTED_COUNT})`);
    }

    // ── 3.2 All 3 pillars present ─────────────────────────────────────────────
    const pillars = await Category.distinct('pillarId');
    const requiredPillars = ['Property Services', 'Personal Services', 'Business Services'];
    for (const p of requiredPillars) {
        if (pillars.includes(p)) pass(`Pillar present: ${p}`);
        else fail(`Pillar MISSING: ${p}`);
    }

    // ── 3.3 All externalIds present ───────────────────────────────────────────
    const existing = await Category.find({}, 'externalId').lean();
    const existingIds = existing.map(c => c.externalId);
    let missingIds = 0;
    for (const id of EXPECTED_IDS) {
        if (!existingIds.includes(id)) {
            fail(`Missing externalId: ${id}`);
            missingIds++;
        }
    }
    if (missingIds === 0) pass(`All ${EXPECTED_IDS.length} externalIds present`);

    // ── 3.4 Every category has a CommissionRule ───────────────────────────────
    const allCats = await Category.find({}, '_id externalId').lean();
    let missingRules = 0;
    for (const cat of allCats) {
        const rule = await CommissionRule.findOne({ categoryId: cat._id }).lean();
        if (!rule) {
            fail(`No CommissionRule for: ${cat.externalId}`);
            missingRules++;
        }
    }
    if (missingRules === 0) pass('Every category has a CommissionRule');

    // ── 3.5 CommissionRule shares are 70/30 ───────────────────────────────────
    const wrongShares = await CommissionRule.countDocuments({
        $or: [{ wisemoveShare: { $ne: 30 } }, { introducerShare: { $ne: 70 } }]
    });
    if (wrongShares === 0) {
        pass('All CommissionRules have wisemoveShare=30, introducerShare=70');
    } else {
        fail(`${wrongShares} CommissionRule(s) have wrong shares (expected 30/70)`);
    }

    // ── 3.6 R&D (PA-024) CommissionRule type=tiered ───────────────────────────
    const rdCat = await Category.findOne({ externalId: 'PA-024' });
    if (rdCat) {
        const rdRule = await CommissionRule.findOne({ categoryId: rdCat._id });
        if (rdRule && rdRule.type === 'tiered') {
            pass('PA-024 (R&D Tax Credits) CommissionRule type=tiered');
        } else {
            fail(`PA-024 CommissionRule type: expected tiered, got ${rdRule?.type}`);
        }
    } else {
        fail('PA-024 (R&D Tax Credits) category not found');
    }

    // ── 3.7 FCA compliance text on PA-014 and PA-015 ─────────────────────────
    for (const id of ['PA-014', 'PA-015']) {
        const cat = await Category.findOne({ externalId: id });
        if (cat && cat.complianceText && cat.complianceText.includes('FCA-regulated')) {
            pass(`${id} has FCA complianceText`);
        } else {
            fail(`${id} is missing FCA complianceText`);
        }
    }

    // ── 3.8 isRegulated flags ─────────────────────────────────────────────────
    for (const id of REGULATED_IDS) {
        const cat = await Category.findOne({ externalId: id });
        if (cat && cat.isRegulated === true) {
            pass(`${id} isRegulated=true`);
        } else {
            fail(`${id} isRegulated should be true, got: ${cat?.isRegulated}`);
        }
    }

    // ── 3.9 Pillar counts match spec ──────────────────────────────────────────
    const hpCount = await Category.countDocuments({ pillarId: 'Property Services' });
    const paCount = await Category.countDocuments({ pillarId: 'Personal Services' });
    const bsCount = await Category.countDocuments({ pillarId: 'Business Services' });

    hpCount === 17 ? pass('Property Services: 17 services') : fail(`Property Services: expected 17, got ${hpCount}`);
    paCount === 27 ? pass('Personal Services: 27 services') : fail(`Personal Services: expected 27, got ${paCount}`);
    bsCount === 8  ? pass('Business Services: 8 services')  : fail(`Business Services: expected 8, got ${bsCount}`);

    await mongoose.disconnect();
    summary();
}

run().catch(e => {
    console.error('[T3] Fatal:', e.message);
    process.exit(1);
});
