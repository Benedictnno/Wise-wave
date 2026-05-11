/**
 * REGRESSION TEST — Task 6: 30-Day Payment Reminder Cron
 *
 * Verifies that:
 *   - sendAwaitingPaymentReminders is exported from reportService
 *   - initCronJobs, generateMonthlyReport, sendOverdueInvoiceReminders still exported
 *   - The cron schedule '0 10 * * *' appears in reportService source
 *   - sendAwaitingPaymentReminders queries the correct status and date fields
 *   - Function runs without throwing when no matching leads exist
 *
 * No DB connection required for most checks.
 * Lightweight DB check at end: creates no documents.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pass, fail, section, summary } = require('./helpers');

async function run() {
    section('T6 — 30-Day Payment Reminder Cron');

    // ── 6.1 Exports ───────────────────────────────────────────────────────────
    let svc;
    try {
        svc = require('../../src/services/reportService');
        pass('reportService loaded');
    } catch (e) {
        fail('reportService failed to load: ' + e.message);
        return;
    }

    const REQUIRED_EXPORTS = [
        'initCronJobs',
        'generateMonthlyReport',
        'sendOverdueInvoiceReminders',
        'sendAwaitingPaymentReminders',
    ];

    for (const fn of REQUIRED_EXPORTS) {
        if (typeof svc[fn] === 'function') {
            pass(`Exported: ${fn}`);
        } else {
            fail(`NOT exported: ${fn}`);
        }
    }

    // ── 6.2 Source code contains correct cron schedule ────────────────────────
    const src = fs.readFileSync(
        path.join(__dirname, '../../src/services/reportService.js'), 'utf8'
    );

    if (src.includes("'0 10 * * *'")) {
        pass("Cron schedule '0 10 * * *' (daily 10:00) found in source");
    } else {
        fail("Cron schedule '0 10 * * *' NOT found — daily payment reminders won't fire");
    }

    // ── 6.3 Function queries correct fields ────────────────────────────────────
    const fnSrc = svc.sendAwaitingPaymentReminders.toString();

    const REQUIRED_IN_FN = [
        'awaiting_partner_payment',
        'won_date',
        'last_reminder_sent_at',
        'thirtyDaysAgo',
        'last_reminder_sent_at',
        'confirm-payment',
    ];

    for (const token of REQUIRED_IN_FN) {
        if (fnSrc.includes(token)) {
            pass(`sendAwaitingPaymentReminders references: '${token}'`);
        } else {
            fail(`sendAwaitingPaymentReminders is MISSING reference to: '${token}'`);
        }
    }

    // ── 6.4 Function does not throw when no leads match (safe to call) ────────
    try {
        // RESEND_API_KEY absent = early return, no throws
        const savedKey = process.env.RESEND_API_KEY;
        delete process.env.RESEND_API_KEY;

        // We need mongoose connected for the Lead.find() inside
        const mongoose = require('mongoose');
        await mongoose.connect(process.env.MONGO_URI);

        await svc.sendAwaitingPaymentReminders();
        pass('sendAwaitingPaymentReminders() ran without throwing');

        await mongoose.disconnect();
        if (savedKey) process.env.RESEND_API_KEY = savedKey;
    } catch (e) {
        fail('sendAwaitingPaymentReminders threw: ' + e.message);
    }

    // ── 6.5 last_reminder_sent_at is updated after sending ────────────────────
    // (Source-level check — the function saves the lead after sending)
    if (fnSrc.includes('last_reminder_sent_at = now')) {
        pass('Function updates last_reminder_sent_at after sending reminder');
    } else {
        fail('Function does NOT update last_reminder_sent_at — reminders would repeat every day');
    }

    // ── 6.6 Existing cron jobs still registered ───────────────────────────────
    const EXISTING_SCHEDULES = [
        "'0 8 1 * *'",   // monthly report
        "'0 9 * * *'",   // overdue invoice check
        "'*/15 * * * *'", // delivery recovery
        "'0 * * * *'",   // SLA monitor
    ];

    for (const schedule of EXISTING_SCHEDULES) {
        if (src.includes(schedule)) {
            pass(`Existing cron schedule still present: ${schedule}`);
        } else {
            fail(`Existing cron schedule MISSING: ${schedule} — may have been accidentally removed`);
        }
    }

    summary();
}

run().catch(e => {
    console.error('[T6] Fatal:', e.message);
    process.exit(1);
});
