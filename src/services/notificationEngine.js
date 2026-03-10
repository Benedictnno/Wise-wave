const nodemailer = require('nodemailer');
const twilio = require('twilio');
const DeliveryLog = require('../models/DeliveryLog');

// ─── Message Template ────────────────────────────────────────────────────────
const buildMessage = (lead, category) => {
    return (
        `New WiseMove Connect introduction:\n\n` +
        `Category: ${category.name}\n\n` +
        `Postcode: ${lead.postcode}\n\n` +
        `Customer Name: ${lead.name}\n\n` +
        `Customer Phone: ${lead.phone}\n\n` +
        `Customer Email: ${lead.email}\n\n` +
        `Details: ${lead.description || 'No additional details provided.'}\n\n` +
        `Please contact the customer directly. Reply to this message if you need support.`
    );
};

// ─── Email ────────────────────────────────────────────────────────────────────
const sendEmail = async (partner, lead, category, log) => {
    try {
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('[Email] SMTP credentials not configured — skipping email send');
            log.emailError = 'SMTP credentials not configured';
            return;
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: partner.email,
            subject: 'New WiseMove Connect Introduction',
            text: buildMessage(lead, category),
        });

        log.emailSent = true;
        log.emailTimestamp = new Date();
        console.log(`[Email] Sent to ${partner.email}`);
    } catch (err) {
        log.emailError = err.message;
        console.error(`[Email] Failed for lead ${lead._id}:`, err.message);
    }
};

// ─── SMS ──────────────────────────────────────────────────────────────────────
const sendSMS = async (partner, lead, category, log) => {
    try {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.warn('[SMS] Twilio credentials not configured — skipping SMS send');
            log.smsError = 'Twilio credentials not configured';
            return;
        }

        if (!partner.phone) {
            log.smsError = 'Partner has no phone number';
            return;
        }

        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body: buildMessage(lead, category),
            from: process.env.TWILIO_FROM_NUMBER,
            to: partner.phone,
        });

        log.smsSent = true;
        log.smsTimestamp = new Date();
        console.log(`[SMS] Sent to ${partner.phone}`);
    } catch (err) {
        log.smsError = err.message;
        console.error(`[SMS] Failed for lead ${lead._id}:`, err.message);
    }
};

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
const sendWhatsApp = async (partner, lead, category, log) => {
    try {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.warn('[WhatsApp] Twilio credentials not configured — skipping WhatsApp send');
            log.whatsappError = 'Twilio credentials not configured';
            return;
        }

        const to = partner.whatsappNumber || partner.phone;
        if (!to) {
            log.whatsappError = 'Partner has no WhatsApp/phone number';
            return;
        }

        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body: buildMessage(lead, category),
            from: process.env.TWILIO_WHATSAPP_FROM,
            to: `whatsapp:${to}`,
        });

        log.whatsappSent = true;
        log.whatsappTimestamp = new Date();
        console.log(`[WhatsApp] Sent to ${to}`);
    } catch (err) {
        log.whatsappError = err.message;
        console.error(`[WhatsApp] Failed for lead ${lead._id}:`, err.message);
    }
};

// ─── Admin Alert (unassigned leads) ──────────────────────────────────────────
const notifyAdminUnassigned = async (lead) => {
    try {
        if (!process.env.SMTP_HOST || !process.env.ADMIN_EMAIL) return;

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        });

        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: process.env.ADMIN_EMAIL,
            subject: '[WiseMove] Unassigned Lead Alert',
            text: `A new lead could not be matched to a partner.\n\nLead ID: ${lead._id}\nName: ${lead.name}\nPostcode: ${lead.postcode}\nCategory: ${lead.category}\n\nPlease log in to the admin dashboard to assign manually.`,
        });
        console.log('[Admin] Unassigned lead notification sent');
    } catch (err) {
        console.error('[Admin] Failed to send unassigned alert:', err.message);
    }
};

// ─── Main Dispatch ────────────────────────────────────────────────────────────
/**
 * Send lead introduction to partner via all three channels simultaneously.
 * Creates a DeliveryLog with per-channel results.
 */
const dispatchNotifications = async (lead, partner, category) => {
    const log = new DeliveryLog({ leadId: lead._id });

    // All three channels fire simultaneously
    await Promise.all([
        sendEmail(partner, lead, category, log),
        sendSMS(partner, lead, category, log),
        sendWhatsApp(partner, lead, category, log),
    ]);

    await log.save();
    console.log(`[Notifications] Delivery log saved for lead ${lead._id}`);
    return log;
};

module.exports = { dispatchNotifications, notifyAdminUnassigned };
