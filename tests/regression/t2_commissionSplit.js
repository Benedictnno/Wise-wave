/**
 * REGRESSION TEST — Task 2: Commission Split (70/30)
 *
 * Verifies that calculateShares:
 *   - Returns 70% to introducer and 30% to WiseMove when hasIntroducer=true
 *   - Returns 0/100 when no introducer
 *   - Handles floating point rounding correctly
 *   - applySplit is still exported
 *
 * No DB connection required.
 */
require('dotenv').config();

const { pass, fail, section, summary } = require('./helpers');

function approxEqual(a, b) {
    return Math.abs(a - b) < 0.001;
}

function run() {
    section('T2 — Commission Split (70/30)');

    let svc;
    try {
        svc = require('../../src/services/commissionService');
        pass('commissionService loaded');
    } catch (e) {
        fail('commissionService failed to load: ' + e.message);
        return;
    }

    const { calculateShares, calculateCommission, applySplit } = svc;

    if (typeof calculateShares === 'function') pass('calculateShares exported');
    else fail('calculateShares NOT exported');

    if (typeof calculateCommission === 'function') pass('calculateCommission exported');
    else fail('calculateCommission NOT exported');

    if (typeof applySplit === 'function') pass('applySplit exported');
    else fail('applySplit NOT exported');

    // ── 2.1 No introducer — all to WiseMove ───────────────────────────────────
    const noIntro = calculateShares(100, false);
    if (noIntro.introducerShare === 0 && noIntro.wisemoveShare === 100) {
        pass('No introducer: wisemoveShare=100, introducerShare=0');
    } else {
        fail(`No introducer: got wisemoveShare=${noIntro.wisemoveShare}, introducerShare=${noIntro.introducerShare}`);
    }

    // ── 2.2 With introducer — 70% to introducer ───────────────────────────────
    const withIntro = calculateShares(100, true);
    if (approxEqual(withIntro.introducerShare, 70)) {
        pass('With introducer: introducerShare=70');
    } else {
        fail(`With introducer: expected introducerShare=70, got ${withIntro.introducerShare}`);
    }
    if (approxEqual(withIntro.wisemoveShare, 30)) {
        pass('With introducer: wisemoveShare=30');
    } else {
        fail(`With introducer: expected wisemoveShare=30, got ${withIntro.wisemoveShare}`);
    }

    // ── 2.3 Shares must sum to total ──────────────────────────────────────────
    const total = 1234.56;
    const result = calculateShares(total, true);
    const sum = Number((result.introducerShare + result.wisemoveShare).toFixed(2));
    if (approxEqual(sum, total)) {
        pass(`Shares sum to total (${sum} ≈ ${total})`);
    } else {
        fail(`Shares do NOT sum correctly: ${result.introducerShare} + ${result.wisemoveShare} = ${sum}, expected ${total}`);
    }

    // ── 2.4 Verify NOT the old 30/70 split (regression guard) ────────────────
    const old = calculateShares(100, true);
    if (old.introducerShare === 30) {
        fail('REGRESSION: still using old 30% split for introducer — expected 70%');
    } else {
        pass('Regression guard: old 30% split is NOT in use');
    }

    // ── 2.5 calculateCommission — fixed ───────────────────────────────────────
    const fixedResult = calculateCommission({ type: 'fixed', fixedAmount: 50, percentage: 0 }, 0);
    if (fixedResult === 50) {
        pass('calculateCommission fixed: returns fixedAmount');
    } else {
        fail(`calculateCommission fixed: expected 50, got ${fixedResult}`);
    }

    // ── 2.6 calculateCommission — percentage ──────────────────────────────────
    const pctResult = calculateCommission({ type: 'percentage', fixedAmount: 0, percentage: 7.5 }, 1000);
    if (approxEqual(pctResult, 75)) {
        pass('calculateCommission percentage: 7.5% of 1000 = 75');
    } else {
        fail(`calculateCommission percentage: expected 75, got ${pctResult}`);
    }

    // ── 2.7 calculateCommission — tiered Year 1 (20%) ────────────────────────
    const tieredY1 = calculateCommission({ type: 'tiered', fixedAmount: 0, percentage: 20 }, 50000, 1);
    if (approxEqual(tieredY1, 10000)) {
        pass('calculateCommission tiered Year 1: 20% of 50000 = 10000');
    } else {
        fail(`calculateCommission tiered Year 1: expected 10000, got ${tieredY1}`);
    }

    // ── 2.8 calculateCommission — tiered Year 2 (10%) ────────────────────────
    const tieredY2 = calculateCommission({ type: 'tiered', fixedAmount: 0, percentage: 20 }, 50000, 2);
    if (approxEqual(tieredY2, 5000)) {
        pass('calculateCommission tiered Year 2: 10% of 50000 = 5000');
    } else {
        fail(`calculateCommission tiered Year 2: expected 5000, got ${tieredY2}`);
    }

    // ── 2.9 calculateCommission — tiered Year 3+ (0%) ────────────────────────
    const tieredY3 = calculateCommission({ type: 'tiered', fixedAmount: 0, percentage: 20 }, 50000, 3);
    if (tieredY3 === 0) {
        pass('calculateCommission tiered Year 3+: 0% = 0');
    } else {
        fail(`calculateCommission tiered Year 3+: expected 0, got ${tieredY3}`);
    }

    summary();
}

run();
