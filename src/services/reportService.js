const cron = require('node-cron');
const Lead = require('../models/Lead');
const Commission = require('../models/Commission');
const Invoice = require('../models/Invoice');
const Partner = require('../models/Partner');

// ─── Monthly Report ───────────────────────────────────────────────────────────
const generateMonthlyReport = async () => {
    try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const totalLeads = await Lead.countDocuments({ createdAt: { $gte: startOfMonth } });
        const successfulDeals = await Lead.countDocuments({ outcome: 'won', createdAt: { $gte: startOfMonth } });

        const commissions = await Commission.aggregate([
            { $match: { createdAt: { $gte: startOfMonth }, commissionStatus: 'paid' } },
            { $group: { _id: null, totalRevenue: { $sum: '$wisemoveShare' } } },
        ]);
        const revenue = commissions.length > 0 ? commissions[0].totalRevenue : 0;

        // Fix: correctly filter for really unpaid (not failed or reversed)
        const unpaidInvoices = await Invoice.countDocuments({ status: 'unpaid' });

        return { totalLeads, successfulDeals, revenue, unpaidInvoices };
    } catch (err) {
        console.error('[Report] Error:', err.message);
        return null;
    }
};

const sendReportEmail = async (reportData) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!apiKey || !adminEmail) return;

        const htmlContent = `
            <h2>WiseMove Connect - Monthly Report</h2>
            <ul>
                <li><strong>Total Leads:</strong> ${reportData.totalLeads}</li>
                <li><strong>Successful Deals:</strong> ${reportData.successfulDeals}</li>
                <li><strong>Actual Revenue (Paid):</strong> £${reportData.revenue.toFixed(2)}</li>
                <li><strong>Unpaid Invoices:</strong> ${reportData.unpaidInvoices}</li>
            </ul>
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                to: adminEmail,
                subject: 'WiseMove Connect - Monthly Automated Report',
                html: htmlContent,
            }),
        });
    } catch (err) {
        console.error('[Report Email] Error:', err.message);
    }
};

// ─── Overdue Invoice Reminders ────────────────────────────────────────────────
const sendOverdueInvoiceReminders = async () => {
    try {
        const now = new Date();
        const overdueInvoices = await Invoice.find({
            status: 'unpaid',
            dueDate: { $lt: now },
        }).populate('partnerId');

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey || overdueInvoices.length === 0) return;

        for (const invoice of overdueInvoices) {
            const partner = invoice.partnerId;
            if (!partner || !partner.email) continue;

            const daysOverdue = Math.floor((now - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));

            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                    to: partner.email,
                    subject: `[Overdue] Invoice ${invoice.invoiceNumber} — WiseMove Connect`,
                    text:
                        `Dear ${partner.companyName},\n\n` +
                        `Reminder: Invoice ${invoice.invoiceNumber} (£${invoice.amount.toFixed(2)}) is ${daysOverdue} day(s) overdue.\n\n` +
                        `Pay securely online here:\n${invoice.stripePaymentUrl}\n\n` +
                        `Download PDF:\n${invoice.pdfPath}\n\n` +
                        `WiseMove Connect`,
                }),
            });
            console.log(`[Overdue] Reminder sent for INV: ${invoice.invoiceNumber}`);
        }
    } catch (err) {
        console.error('[Overdue] Error:', err.message);
    }
};

const initCronJobs = () => {
    // Monthly report — 1st of every month at 08:00
    cron.schedule('0 8 1 * *', async () => {
        const data = await generateMonthlyReport();
        if (data) await sendReportEmail(data);
    });

    // Daily overdue check — 09:00
    cron.schedule('0 9 * * *', async () => {
        await sendOverdueInvoiceReminders();
    });

    console.log('[Cron] reporting & overdue reminders scheduled');
};

module.exports = { initCronJobs, generateMonthlyReport, sendOverdueInvoiceReminders };
