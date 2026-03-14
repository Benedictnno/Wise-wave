const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
const Commission = require('../models/Commission');
const Invoice = require('../models/Invoice');
const Partner = require('../models/Partner');

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
            { $group: { _id: null, totalRevenue: { $sum: '$wisemoveShare' } } }
        ]);
        const revenue = commissions.length > 0 ? commissions[0].totalRevenue : 0;

        const unpaidInvoices = await Invoice.countDocuments({ status: 'pending' });

        return {
            totalLeads,
            successfulDeals,
            revenue,
            unpaidInvoices
        };
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

const initCronJobs = () => {
    // Schedule for the 1st of every month at 08:00 AM
    cron.schedule('0 8 1 * *', async () => {
        console.log('[Cron] Running monthly reporting job...');
        const reportData = await generateMonthlyReport();
        if (reportData) {
            await sendReportEmail(reportData);
        }
    });
    console.log('[Cron] Monthly reporting job scheduled');
};

module.exports = { initCronJobs, generateMonthlyReport };
