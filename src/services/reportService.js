const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
const Commission = require('../models/Commission');
const Invoice = require('../models/Invoice');
const Partner = require('../models/Partner');

// ─── Monthly Report ───────────────────────────────────────────────────────────
const generateMonthlyReport = async () => {
    try {
        console.log('[ReportService] Generating monthly report...');
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const totalLeads = await Lead.countDocuments({ createdAt: { $gte: startOfMonth } });
        const successfulDeals = await Lead.countDocuments({ outcome: 'won', createdAt: { $gte: startOfMonth } });

        const commissions = await Commission.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, totalRevenue: { $sum: '$wisemoveShare' } } },
        ]);
        const revenue = commissions.length > 0 ? commissions[0].totalRevenue : 0;

        const unpaidInvoices = await Invoice.countDocuments({ status: 'unpaid' });

        return { totalLeads, successfulDeals, revenue, unpaidInvoices };
    } catch (err) {
        console.error('[ReportService] Error generating report data:', err.message);
        return null;
    }
};

const sendReportEmail = async (reportData) => {
    try {
        if (!process.env.SMTP_HOST || !process.env.ADMIN_EMAIL) {
            console.warn('[ReportService] SMTP or ADMIN_EMAIL missing — skipping report email');
            return;
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        const htmlContent = `
            <h2>WiseMove Connect - Monthly Report</h2>
            <p>Here is the automated monthly report for the current month.</p>
            <ul>
                <li><strong>Total Leads:</strong> ${reportData.totalLeads}</li>
                <li><strong>Successful Deals:</strong> ${reportData.successfulDeals}</li>
                <li><strong>Expected Revenue (WiseMove Share):</strong> £${reportData.revenue.toFixed(2)}</li>
                <li><strong>Unpaid Invoices (All Time):</strong> ${reportData.unpaidInvoices}</li>
            </ul>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: process.env.ADMIN_EMAIL,
            subject: 'WiseMove Connect - Monthly Automated Report',
            html: htmlContent,
        });

        console.log('[ReportService] Monthly report sent to admin');
    } catch (err) {
        console.error('[ReportService] Error sending email:', err.message);
    }
};

// ─── Overdue Invoice Reminders ────────────────────────────────────────────────
/**
 * Finds unpaid invoices past their due date and sends an overdue reminder email to
 * each partner via the Resend API. Called daily at 09:00.
 */
const sendOverdueInvoiceReminders = async () => {
    try {
        const now = new Date();
        const overdueInvoices = await Invoice.find({
            status: 'unpaid',
            dueDate: { $lt: now },
        }).populate('partnerId');

        if (overdueInvoices.length === 0) {
            console.log('[Overdue] No overdue invoices found.');
            return;
        }

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn('[Overdue] Resend API key not configured — skipping overdue reminders');
            return;
        }

        for (const invoice of overdueInvoices) {
            const partner = invoice.partnerId; // populated
            if (!partner || !partner.email) continue;

            const daysOverdue = Math.floor((now - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));

            try {
                const response = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                        to: partner.email,
                        subject: `[Overdue] Invoice ${invoice.invoiceNumber} — WiseMove Connect`,
                        text:
                            `Dear ${partner.companyName},\n\n` +
                            `This is a reminder that invoice ${invoice.invoiceNumber} for £${invoice.amount.toFixed(2)} ` +
                            `was due on ${new Date(invoice.dueDate).toLocaleDateString('en-GB')} and is now ${daysOverdue} day(s) overdue.\n\n` +
                            `Please arrange payment at your earliest convenience. You can download your invoice here:\n` +
                            `${invoice.pdfPath}\n\n` +
                            `If you have already made payment, please disregard this message and contact us to confirm.\n\n` +
                            `WiseMove Connect`,
                    }),
                });

                if (response.ok) {
                    console.log(`[Overdue] Reminder sent to ${partner.email} for invoice ${invoice.invoiceNumber}`);
                } else {
                    const data = await response.json();
                    console.error(`[Overdue] Failed to send to ${partner.email}:`, data.message);
                }
            } catch (emailErr) {
                console.error(`[Overdue] Email error for invoice ${invoice.invoiceNumber}:`, emailErr.message);
            }
        }
    } catch (err) {
        console.error('[Overdue] Error scanning overdue invoices:', err.message);
    }
};

// ─── Cron Initialisation ──────────────────────────────────────────────────────
const initCronJobs = () => {
    // Monthly report — 1st of every month at 08:00 AM
    cron.schedule('0 8 1 * *', async () => {
        console.log('[Cron] Running monthly reporting job...');
        const reportData = await generateMonthlyReport();
        if (reportData) await sendReportEmail(reportData);
    });

    // Overdue invoice reminders — every day at 09:00 AM
    cron.schedule('0 9 * * *', async () => {
        console.log('[Cron] Running overdue invoice reminder job...');
        await sendOverdueInvoiceReminders();
    });

    console.log('[Cron] Monthly report and overdue invoice reminder jobs scheduled');
};

module.exports = { initCronJobs, generateMonthlyReport, sendOverdueInvoiceReminders };
