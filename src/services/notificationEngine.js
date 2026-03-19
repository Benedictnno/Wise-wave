const Introduction = require('../models/Introduction');

// ─── Token Cache ─────────────────────────────────────────────────────────────
let sendPulseToken = null;
let tokenExpiry = 0;

const getSendPulseToken = async () => {
    try {
        if (sendPulseToken && Date.now() < tokenExpiry) {
            return sendPulseToken;
        }

        const clientId = process.env.SENDPULSE_CLIENT_ID;
        const clientSecret = process.env.SENDPULSE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.warn('[SendPulse] Credentials not configured');
            return null;
        }

        const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error_description || 'Failed to get token');

        sendPulseToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // Buffer of 60s
        return sendPulseToken;
    } catch (err) {
        console.error('[SendPulse] Token retrieval failed:', err.message);
        return null;
    }
};

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

const sendEmail = async (partner, lead, category) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn('[Email] Resend API key not configured — skipping email send');
            return false;
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                to: partner.email,
                subject: 'New WiseMove Connect Introduction',
                text: buildMessage(lead, category),
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Resend error: ${response.status}`);
        }

        console.log(`[Email] Sent to ${partner.email} via Resend. ID: ${data.id}`);
        return true;
    } catch (err) {
        console.error(`[Email] Failed for lead ${lead._id}:`, err.message);
        return false;
    }
};

// ─── SMS (SendPulse) ──────────────────────────────────────────────────────────
const sendSMS = async (partner, lead, category) => {
    try {
        if (!partner.phone) {
            console.warn(`[SMS] Partner has no phone number`);
            return false;
        }

        const token = await getSendPulseToken();
        if (!token) return false;

        const response = await fetch('https://api.sendpulse.com/sms/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                sender: process.env.SENDPULSE_SMS_SENDER || 'WiseMove',
                phones: [partner.phone],
                body: buildMessage(lead, category).substring(0, 1600), // SMS length limits usually apply
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'SMS send failed');

        console.log(`[SMS] Sent to ${partner.phone} via SendPulse`);
        return true;
    } catch (err) {
        console.error(`[SMS] Failed for lead ${lead._id}:`, err.message);
        return false;
    }
};

// ─── WhatsApp (SendPulse Chatbot) ─────────────────────────────────────────────
const sendWhatsApp = async (partner, lead, category) => {
    try {
        const to = partner.whatsappNumber || partner.phone;
        if (!to) {
            console.warn(`[WhatsApp] Partner has no phone number or whatsapp number`);
            return false;
        }

        const botId = process.env.SENDPULSE_WHATSAPP_BOT_ID;
        if (!botId) {
            console.warn('[WhatsApp] Bot ID not configured — skipping');
            return false;
        }

        const token = await getSendPulseToken();
        if (!token) return false;

        // Note: SendPulse WhatsApp often requires templates for first message.
        // For simplicity, we use the sendByPhone endpoint which works if the user has messaged before,
        // or if the bot is configured to allow direct messages.
        const response = await fetch(`https://api.sendpulse.com/chatbots/whatsapp/contacts/sendByPhone`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                bot_id: botId,
                phone: to,
                message: {
                    type: 'text',
                    text: { body: buildMessage(lead, category) }
                }
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'WhatsApp send failed');

        console.log(`[WhatsApp] Sent to ${to} via SendPulse`);
        return true;
    } catch (err) {
        console.error(`[WhatsApp] Failed for lead ${lead._id}:`, err.message);
        return false;
    }
};

// ─── Admin Alert (Resend) ────────────────────────────────────────────────────
const notifyAdminUnassigned = async (lead) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!apiKey || !adminEmail) return;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                to: adminEmail,
                subject: '[WiseMove] Unassigned Lead Alert',
                text: `A new lead could not be matched to a partner.\n\nLead ID: ${lead._id}\nName: ${lead.name}\nPostcode: ${lead.postcode}\nCategory: ${lead.category}\n\nPlease log in to the admin dashboard to assign manually.`,
            }),
        });
        console.log('[Admin] Unassigned lead notification sent via Resend');
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

// ─── Confirmation Email to Lead Submitter ─────────────────────────────────────
/**
 * Send a GDPR-compliant confirmation email to the person who submitted the lead.
 * Sent after lead is stored regardless of routing outcome.
 *
 * @param {Object} lead     - Mongoose Lead document
 * @param {Object} category - Mongoose Category document
 * @returns {Promise<boolean>}
 */
const sendLeadConfirmation = async (lead, category) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn('[Lead Confirm] Resend API key not configured — skipping confirmation email');
            return false;
        }

        const isRegulated = category && category.isRegulated;
        const regulatedDisclaimer = isRegulated
            ? '\n\nPlease note: WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.'
            : '';

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                to: lead.email,
                subject: 'We received your enquiry — WiseMove Connect',
                text:
                    `Hi ${lead.name},\n\n` +
                    `Thank you for reaching out to WiseMove Connect. We have received your enquiry for ` +
                    `${category ? category.name : 'our services'} and will match you with a specialist shortly.\n\n` +
                    `What happens next:\n` +
                    `A trusted specialist will contact you directly at ${lead.phone} or ${lead.email}.\n\n` +
                    `If you have any questions in the meantime, please do not hesitate to get in touch.` +
                    `${regulatedDisclaimer}\n\n` +
                    `WiseMove Connect`,
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || `Resend error ${response.status}`);

        console.log(`[Lead Confirm] Confirmation sent to ${lead.email}`);
        return true;
    } catch (err) {
        console.error(`[Lead Confirm] Failed for lead ${lead._id}:`, err.message);
        return false;
    }
};

module.exports = { dispatchNotifications, notifyAdminUnassigned, sendLeadConfirmation };

