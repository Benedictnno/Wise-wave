/**
 * REGRESSION TEST — Task 1: Confirmation Email
 *
 * Verifies that sendLeadConfirmation:
 *   - Is exported from notificationEngine.js
 *   - Uses the exact approved subject line
 *   - Contains all required body copy keywords
 *   - Returns false (not throws) when RESEND_API_KEY is missing
 *   - sendPartnerPaymentConfirmationRequest is also exported
 *
 * No DB connection required.
 */
require('dotenv').config();

const { pass, fail, section, summary } = require('./helpers');

async function run() {
    section('T1 — Confirmation Email');

    // ── 1.1 Exports ────────────────────────────────────────────────────────────
    let engine;
    try {
        engine = require('../../src/services/notificationEngine');
        pass('notificationEngine loaded');
    } catch (e) {
        fail('notificationEngine failed to load: ' + e.message);
        return;
    }

    if (typeof engine.sendLeadConfirmation === 'function') {
        pass('sendLeadConfirmation is exported');
    } else {
        fail('sendLeadConfirmation is NOT exported');
    }

    if (typeof engine.sendPartnerPaymentConfirmationRequest === 'function') {
        pass('sendPartnerPaymentConfirmationRequest is exported');
    } else {
        fail('sendPartnerPaymentConfirmationRequest is NOT exported');
    }

    // ── 1.2 Inspect function source for exact copy ────────────────────────────
    const src = engine.sendLeadConfirmation.toString();

    const REQUIRED_STRINGS = [
        'Your Request Has Been Received',
        '24\u201348 hours',
        'hello@wisemoveconnect.com',
        'introduction\u2011only platform',
        'GDPR\u2011compliant',
        'RESEND_API_KEY is not set',
    ];

    for (const str of REQUIRED_STRINGS) {
        if (src.includes(str)) {
            pass(`Body contains: "${str}"`);
        } else {
            fail(`Body is MISSING: "${str}"`);
        }
    }

    // ── 1.3 Returns false without API key (no throw) ──────────────────────────
    const savedKey = process.env.RESEND_API_KEY;
    
    if (savedKey) {
        pass('RESEND_API_KEY is present in process.env before simulation');
    } else {
        fail('RESEND_API_KEY is MISSING in process.env — check your .env file');
    }

    console.log('  (Simulating missing RESEND_API_KEY to test graceful fallback...)');
    delete process.env.RESEND_API_KEY;

    try {
        const result = await engine.sendLeadConfirmation(
            { name: 'Test', email: 'test@example.com', referenceId: 'WMC-TEST-001' },
            { isRegulated: false }
        );
        if (result === false) {
            pass('Correctly returns false when RESEND_API_KEY missing');
        } else {
            fail(`Expected false, got: ${result}`);
        }
    } catch (e) {
        fail('Threw when RESEND_API_KEY missing: ' + e.message);
    } finally {
        if (savedKey) process.env.RESEND_API_KEY = savedKey;
        console.log('  (RESEND_API_KEY restored)');
    }

    // ── 1.4 sendPartnerPaymentConfirmationRequest source check ────────────────
    const confirmSrc = engine.sendPartnerPaymentConfirmationRequest.toString();
    const CONFIRM_STRINGS = [
        'confirm-payment',
        'Action Required',
        'Confirm Customer Payment',
    ];

    for (const str of CONFIRM_STRINGS) {
        if (confirmSrc.includes(str)) {
            pass(`Confirm email contains: "${str}"`);
        } else {
            fail(`Confirm email missing: "${str}"`);
        }
    }

    summary();
}

run().catch(e => {
    console.error('[T1] Fatal:', e.message);
    process.exit(1);
});
