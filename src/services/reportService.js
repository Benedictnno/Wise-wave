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

        let pendingPayouts = 0;
        try {
            const IntroducerPayout = require('../models/IntroducerPayout');
            const payoutAgg = await IntroducerPayout.aggregate([
                { $match: { payoutStatus: 'pending' } },
                { $group: { _id: null, total: { $sum: '$amount' } } },
            ]);
            pendingPayouts = payoutAgg[0]?.total ?? 0;
        } catch { /* if model not ready */ }

        return { totalLeads, successfulDeals, revenue, unpaidInvoices, pendingPayouts };
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
                <li><strong>Pending Introducer Payouts:</strong> £${reportData.pendingPayouts.toFixed(2)}</li>
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

// ─── 30-Day Awaiting Payment Reminders ──────────────────────────────────────────────
const sendAwaitingPaymentReminders = async () => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Leads awaiting payment where no reminder sent, or last reminder was 30+ days ago
        const leads = await Lead.find({
            status: 'awaiting_partner_payment',
            won_date: { $lte: thirtyDaysAgo },
            $or: [
                { last_reminder_sent_at: null },
                { last_reminder_sent_at: { $lte: thirtyDaysAgo } }
            ]
        });

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey || leads.length === 0) return;

        const frontendUrl = process.env.FRONTEND_URL || 'https://wisemoveconnect.com';

        for (const lead of leads) {
            const partner = await Partner.findById(lead.assignedPartnerId);
            if (!partner || !partner.email) continue;

            const daysSinceWon = Math.floor((now - new Date(lead.won_date)) / (1000 * 60 * 60 * 24));
            const confirmUrl = `${frontendUrl}/outcome/${lead.outcomeToken}/confirm-payment`;

            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                    to: partner.email,
                    subject: `Reminder — Please Confirm Customer Payment | WiseMove Connect`,
                    text:
                        `Dear ${partner.companyName},\n\n` +
                        `This is a reminder regarding lead ${lead.referenceId}.\n\n` +
                        `It has been ${daysSinceWon} days since you marked this lead as Won. ` +
                        `We have not yet received confirmation that the customer has paid you.\n\n` +
                        `Once you have received payment, please click the link below:\n` +
                        `${confirmUrl}\n\n` +
                        `If you have any questions, please contact us at hello@wisemoveconnect.com\n\n` +
                        `WiseMove Connect`,
                }),
            });

            lead.last_reminder_sent_at = now;
            await lead.save();

            console.log(`[Reminder] Sent 30-day payment reminder for lead ${lead.referenceId} to ${partner.email}`);
        }
    } catch (err) {
        console.error('[Reminder] Error in sendAwaitingPaymentReminders:', err.message);
    }
};

const recoverPendingDeliveries = async () => {
    try {
        const Introduction = require('../models/Introduction');
        const { dispatchNotifications } = require('./notificationEngine');
        
        const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
        const pendingIntros = await Introduction.find({
            deliveryStatus: 'pending',
            updatedAt: { $lt: tenMinsAgo }
        }).populate({
            path: 'leadId',
            populate: { path: 'category' }
        }).populate('partnerId');

        for (const intro of pendingIntros) {
            if (!intro.leadId || !intro.partnerId) continue;
            
            const nextAttempt = intro.deliveryAttempts.length + 1;
            console.log(`[Recovery] Attempting to recover delivery for lead ${intro.leadId.referenceId}. Attempt ${nextAttempt}`);
            
            dispatchNotifications(intro.leadId, intro.partnerId, intro.leadId.category, nextAttempt)
                .catch(err => console.error('[Recovery] failed to dispatch', err.message));
        }
    } catch (err) {
        console.error('[Recovery Error]', err.message);
    }
};

const monitorSLAExpiry = async () => {
    try {
        const LeadPartnerAssignment = require('../models/LeadPartnerAssignment');
        const Lead = require('../models/Lead');
        const { fallbackRouteLead } = require('./routingEngine');

        // Check assigned leads older than 24 hours
        const slaThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const expiredAssignments = await LeadPartnerAssignment.find({
            assignment_status: 'assigned',
            assigned_at: { $lt: slaThreshold }
        });

        for (const assignment of expiredAssignments) {
            const lead = await Lead.findById(assignment.lead_id);
            if (lead && lead.status === 'assigned') {
                console.log(`[SLA] Lead ${lead.referenceId} SLA expired. Falling back.`);
                await fallbackRouteLead(lead, assignment._id, 'expired_sla');
            } else {
                // If the lead was somehow manually resolved but the assignment wasn't updated
                assignment.assignment_status = 'expired';
                await assignment.save();
            }
        }
    } catch (err) {
        console.error('[SLA Monitor Error]', err.message);
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

    // Recovery job every 15 minutes for lost retries
    cron.schedule('*/15 * * * *', async () => {
        await recoverPendingDeliveries();
    });

    // SLA Monitoring every hour
    cron.schedule('0 * * * *', async () => {
        await monitorSLAExpiry();
    });

    // Daily 30-day payment reminder check — runs at 10:00 every day
    cron.schedule('0 10 * * *', async () => {
        await sendAwaitingPaymentReminders();
    });

    console.log('[Cron] reporting, overdue reminders, regenerators, SLA, recovery and payment reminder jobs scheduled');
};

module.exports = { initCronJobs, generateMonthlyReport, sendOverdueInvoiceReminders, sendAwaitingPaymentReminders };
