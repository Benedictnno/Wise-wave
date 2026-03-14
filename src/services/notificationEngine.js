const nodemailer = require('nodemailer');
const twilio = require('twilio');
const Introduction = require('../models/Introduction');

// ─── Message Template ────────────────────────────────────────────────────────
const buildMessage = (lead, category) => {
    const backendUrl = process.env.BACKEND_URL || 'https://api.wisemove.connect';
    const frontendUrl = process.env.FRONTEND_URL || 'https://wisemove.connect';
    
    return (
        `New WiseMove Connect introduction:\n\n` +
        `Category: ${category.name}\n\n` +
        `Postcode: ${lead.postcode}\n\n` +
        `Customer Name: ${lead.name}\n\n` +
        `Customer Phone: ${lead.phone}\n\n` +
        `Customer Email: ${lead.email}\n\n` +
        `Details: ${lead.description || 'No additional details provided.'}\n\n` +
        `Please contact the customer directly. Reply to this message if you need support.\n\n` +
        `Update Lead Outcome:\n` +
        `Please use the secure link below to update the outcome of this introduction (Won/Lost) so we can track the progress.\n` +
        `${frontendUrl}/outcome/${lead.outcomeToken}`
    );
};

// ─── Email ────────────────────────────────────────────────────────────────────
const sendEmail = async (partner, lead, category) => {
    try {
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('[Email] SMTP credentials not configured — skipping email send');
            return false;
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

        console.log(`[Email] Sent to ${partner.email}`);
        return true;
    } catch (err) {
        console.error(`[Email] Failed for lead ${lead._id}:`, err.message);
        return false;
    }
};

// ─── SMS ──────────────────────────────────────────────────────────────────────
const sendSMS = async (partner, lead, category) => {
    try {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.warn('[SMS] Twilio credentials not configured — skipping SMS send');
            return false;
        }

        if (!partner.phone) {
            console.warn(`[SMS] Partner has no phone number`);
            return false;
        }

        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body: buildMessage(lead, category),
            from: process.env.TWILIO_FROM_NUMBER,
            to: partner.phone,
        });

        console.log(`[SMS] Sent to ${partner.phone}`);
        return true;
    } catch (err) {
        console.error(`[SMS] Failed for lead ${lead._id}:`, err.message);
        return false;
    }
};

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
const sendWhatsApp = async (partner, lead, category) => {
    try {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.warn('[WhatsApp] Twilio credentials not configured — skipping WhatsApp send');
            return false;
        }

        const to = partner.whatsappNumber || partner.phone;
        if (!to) {
            console.warn(`[WhatsApp] Partner has no phone number or whatsapp number`);
            return false;
        }

        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body: buildMessage(lead, category),
            from: process.env.TWILIO_WHATSAPP_FROM,
            to: `whatsapp:${to}`,
        });

        console.log(`[WhatsApp] Sent to ${to}`);
        return true;
    } catch (err) {
        console.error(`[WhatsApp] Failed for lead ${lead._id}:`, err.message);
        return false;
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
 * Send lead introduction to partner preferring their preferredContactMethod.
 * Implements fallback to email if SMS/WhatsApp fails.
 * Log to Introduction model.
 */
const dispatchNotifications = async (lead, partner, category) => {
    const method = partner.preferredContactMethod || 'email';
    let status = 'sent';
    let fallbackUsed = false;
    let actualMethod = method;

    if (method === 'whatsapp') {
        const success = await sendWhatsApp(partner, lead, category);
        if (!success) {
            fallbackUsed = true;
            actualMethod = 'email';
            const emailSuccess = await sendEmail(partner, lead, category);
            status = emailSuccess ? 'sent' : 'failed';
        }
    } else if (method === 'sms') {
        const success = await sendSMS(partner, lead, category);
        if (!success) {
            fallbackUsed = true;
            actualMethod = 'email';
            const emailSuccess = await sendEmail(partner, lead, category);
            status = emailSuccess ? 'sent' : 'failed';
        }
    } else {
        const success = await sendEmail(partner, lead, category);
        status = success ? 'sent' : 'failed';
    }

    const intro = await Introduction.create({
        leadId: lead._id,
        partnerId: partner._id,
        deliveryMethod: actualMethod,
        deliveryStatus: status,
        fallbackUsed
    });

    console.log(`[Notifications] Introduction logged for lead ${lead._id} using ${actualMethod}`);
    return intro;
};

module.exports = { dispatchNotifications, notifyAdminUnassigned };
