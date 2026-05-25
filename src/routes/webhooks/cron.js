const express = require('express');
const router = express.Router();
const {
    generateMonthlyReport,
    sendReportEmail,
    sendOverdueInvoiceReminders,
    sendAwaitingPaymentReminders,
    recoverPendingDeliveries,
    monitorSLAExpiry
} = require('../../services/reportService');

// Simple security check using a secret key
const verifyCronKey = (req, res, next) => {
    const cronKey = process.env.CRON_SECRET;
    // Check both header and query param (query param is easier for simple cron services)
    const providedKey = req.headers['x-cron-secret'] || req.query.secret;
    
    // If CRON_SECRET is not set in environment, we should ideally block or require it.
    // However, to avoid breaking current deployments if they don't have it set yet, we allow a fallback for testing, 
    // but in production it's highly recommended to set process.env.CRON_SECRET
    const validKey = cronKey || 'default_cron_secret';
    
    if (!providedKey || providedKey !== validKey) {
        return res.status(401).json({ error: 'Unauthorized. Invalid or missing cron secret.' });
    }
    next();
};

router.use(verifyCronKey);

// 1. Monthly Report
// e.g. POST /api/cron/monthly-report?secret=YOUR_SECRET
router.post('/monthly-report', async (req, res) => {
    try {
        const data = await generateMonthlyReport();
        if (data) {
            await sendReportEmail(data);
        }
        res.status(200).json({ message: 'Monthly report job executed successfully.', data });
    } catch (err) {
        console.error('[Cron Webhook] Error in monthly-report:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Overdue Invoice Reminders
router.post('/overdue-reminders', async (req, res) => {
    try {
        await sendOverdueInvoiceReminders();
        res.status(200).json({ message: 'Overdue invoice reminders job executed successfully.' });
    } catch (err) {
        console.error('[Cron Webhook] Error in overdue-reminders:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Awaiting Payment Reminders (30-day)
router.post('/payment-reminders', async (req, res) => {
    try {
        await sendAwaitingPaymentReminders();
        res.status(200).json({ message: 'Payment reminders job executed successfully.' });
    } catch (err) {
        console.error('[Cron Webhook] Error in payment-reminders:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 4. Recover Pending Deliveries
router.post('/recover-deliveries', async (req, res) => {
    try {
        await recoverPendingDeliveries();
        res.status(200).json({ message: 'Recover deliveries job executed successfully.' });
    } catch (err) {
        console.error('[Cron Webhook] Error in recover-deliveries:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 5. Monitor SLA Expiry
router.post('/monitor-sla', async (req, res) => {
    try {
        await monitorSLAExpiry();
        res.status(200).json({ message: 'Monitor SLA expiry job executed successfully.' });
    } catch (err) {
        console.error('[Cron Webhook] Error in monitor-sla:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
