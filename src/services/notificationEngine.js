const Introduction = require('../models/Introduction');
const { scheduleRetry } = require('./deliveryQueue');

// ─── Token Cache for SendPulse ────────────────────────────────────────────────
let sendPulseToken = null;
let tokenExpiry = 0;

const getSendPulseToken = async () => {
    try {
        if (sendPulseToken && Date.now() < tokenExpiry) return sendPulseToken;

        const clientId = process.env.SENDPULSE_CLIENT_ID;
        const clientSecret = process.env.SENDPULSE_CLIENT_SECRET;
        if (!clientId || !clientSecret) return null;

        const response = await fetch('https://api.sendpulse.com/oauth/access_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error_description || 'Failed to get token');

        sendPulseToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        return sendPulseToken;
    } catch (err) {
        console.error('[SendPulse] Token retrieval failed:', err.message);
        return null;
    }
};

// ─── Message Template ─────────────────────────────────────────────────────────
const buildMessage = (lead, category, method) => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://wisemoveconnect.com';
    let subservicesText = '';
    if (lead.subservices && lead.subservices.length > 0) {
        subservicesText = `\nR&D Subservices Selected:\n` + lead.subservices.map(sub => `  - ${sub.name || sub}`).join('\n') + `\n`;
    }

    let fileUrlsText = '';
    if (lead.files && lead.files.length > 0) {
        fileUrlsText = `\nAttached Files:\n` + lead.files.map(f => `  - ${f.file_url}`).join('\n') + `\n`;
    }

    const outcomeLinkText = method === 'email' 
        ? `Update Lead Outcome (7-day link):\n${frontendUrl}/outcome/${lead.outcomeToken}`
        : `Please check your registered email for the secure link to update the outcome.`;

    return (
        `New WiseMove Connect introduction:\n\n` +
        `Category: ${category.name}\n` +
        `Postcode: ${lead.postcode}\n` +
        `Reference ID: ${lead.referenceId}\n` +
        `Customer Name: ${lead.name}\n` +
        `Customer Phone: ${lead.phone}\n` +
        `Customer Email: ${lead.email}\n` +
        `Urgency: ${lead.urgency || 'Not specified'}\n` +
        `Budget: ${lead.budget_band || 'Not specified'}\n` +
        `Details: ${lead.description || 'N/A'}\n` +
        subservicesText +
        fileUrlsText +
        `\nPlease contact the customer directly. Reply to this message if you need support.\n\n` +
        outcomeLinkText
    );
};

// ─── Core Delivery Methods ────────────────────────────────────────────────────
const deliverByEmail = async (partner, body) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
            to: partner.email,
            subject: 'New WiseMove Connect Introduction',
            text: body,
        }),
    });
    return response.ok;
};

const deliverBySMS = async (partner, body) => {
    const token = await getSendPulseToken();
    if (!token || !partner.phone) return false;
    const response = await fetch('https://api.sendpulse.com/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ sender: process.env.SENDPULSE_SMS_SENDER || 'WiseMove', phones: [partner.phone], body: body.substring(0, 1500) }),
    });
    return response.ok;
};

const deliverByWhatsApp = async (partner, body) => {
    const token = await getSendPulseToken();
    const botId = process.env.SENDPULSE_WHATSAPP_BOT_ID;
    if (!token || !botId || !partner.whatsappNumber) return false;
    const to = partner.whatsappNumber;
    const response = await fetch(`https://api.sendpulse.com/chatbots/whatsapp/contacts/sendByPhone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ bot_id: botId, phone: to, message: { type: 'text', text: { body } } }),
    });
    return response.ok;
};

// ─── Dispatch Engine with Retry Logic ─────────────────────────────────────────
const dispatchNotifications = async (lead, partner, category, attempt = 1) => {
    // Check if files are attached. If not loaded on the lead object, load them now
    if (!lead.files) {
        const File = require('../models/File');
        lead.files = await File.find({ lead_id: lead._id }).lean();
    }
    
    const method = (attempt === 1) ? partner.preferredContactMethod : partner.backupDeliveryMethod || 'email';
    const message = buildMessage(lead, category, method);
    
    let success = false;
    try {
        if (method === 'whatsapp') success = await deliverByWhatsApp(partner, message);
        else if (method === 'sms') success = await deliverBySMS(partner, message);
        else success = await deliverByEmail(partner, message);
    } catch (err) {
        console.error(`Attempt ${attempt} failed:`, err.message);
    }

    // Upsert Introduction record with attempt history
    let intro = await Introduction.findOne({ leadId: lead._id, partnerId: partner._id });
    if (!intro) {
        intro = await Introduction.create({
            leadId: lead._id,
            partnerId: partner._id,
            deliveryMethod: method,
            deliveryStatus: 'pending',
            deliveryAttempts: []
        });
    }

    intro.deliveryAttempts.push({
        method,
        status: success ? 'sent' : 'failed',
        timestamp: new Date(),
        errorMessage: success ? null : `Attempt ${attempt} failed`
    });

    if (success) {
        intro.deliveryStatus = 'sent';
        intro.deliveryMethod = method;
        intro.sentAt = new Date();
    } else if (attempt < 3) {
        // Schedule retry with exponential backoff (e.g., immediate, 30s, 5min)
        const delay = attempt === 1 ? 30000 : 300000;
        scheduleRetry(() => dispatchNotifications(lead, partner, category, attempt + 1), delay, `Lead ${lead.referenceId} retry ${attempt+1}`);
        intro.deliveryStatus = 'pending';
    } else {
        intro.deliveryStatus = 'failed';
        notifyAdminFailed(lead, partner);
    }

    await intro.save();
    return intro;
};

// ─── Admin Notification Helpers ────────────────────────────────────────────────
const notifyAdminUnassigned = async (lead) => {
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!apiKey || !adminEmail) return;

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
            to: adminEmail,
            subject: '[WiseMove] Unassigned Lead Alert',
            text: `A new lead could not be matched: ${lead.referenceId}\nName: ${lead.name}\nPostcode: ${lead.postcode}\nLog in to assign.`,
        }),
    });
};

const notifyAdminFailed = async (lead, partner) => {
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!apiKey || !adminEmail) return;

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
            to: adminEmail,
            subject: '[WiseMove] CRITICAL: Delivery Failed',
            text: `Delivery failed for lead ${lead.referenceId} after 3 attempts.\nPartner: ${partner.companyName}\nEmail: ${partner.email}\nPlease contact them manually.`,
        }),
    });
};

// ─── Lead Submitter Confirmation ──────────────────────────────────────────────
const sendLeadConfirmation = async (lead, category) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error('[Confirmation Email] RESEND_API_KEY is not set — email skipped');
        return false;
    }

    const subject = 'Your Request Has Been Received — WiseMove Connect';

    const body =
        `Hi ${lead.name},\n\n` +
        `Thank you — your request has been submitted.\n\n` +
        `A trusted specialist partner will contact you directly using your preferred contact method.\n\n` +
        `What happens next:\n` +
        `• Your request has been securely shared with the most suitable partner.\n` +
        `• They will contact you within 24–48 hours depending on availability.\n` +
        `• WiseMove Connect is an introduction‑only platform — we do not provide advice or recommendations.\n\n` +
        `Need to update your request?\n` +
        `Email us at hello@wisemoveconnect.com\n\n` +
        `Your information is secure\n` +
        `Your details are protected using industry‑standard security and GDPR‑compliant processes.\n\n` +
        `Thank you,\n` +
        `WiseMove Connect`;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                to: lead.email,
                subject,
                text: body,
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[Confirmation Email] Resend API error:', err);
            return false;
        }

        console.log(`[Confirmation Email] Sent to ${lead.email} for lead ${lead.referenceId}`);
        return true;
    } catch (err) {
        console.error('[Confirmation Email] Exception:', err.message);
        return false;
    }
};

// ─── Partner Payment Confirmation Request ─────────────────────────────────────
const sendPartnerPaymentConfirmationRequest = async (lead, partner) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const frontendUrl = process.env.FRONTEND_URL || 'https://wisemoveconnect.com';
    const confirmUrl = `${frontendUrl}/outcome/${lead.outcomeToken}/confirm-payment`;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                to: partner.email,
                subject: `Action Required — Confirm Customer Payment | WiseMove Connect`,
                text:
                    `Dear ${partner.companyName},\n\n` +
                    `Thank you for updating the outcome on lead ${lead.referenceId}.\n\n` +
                    `Once you have received payment from the customer, please click the link below to confirm.\n` +
                    `This will trigger your invoice from WiseMove Connect.\n\n` +
                    `Confirm payment received:\n${confirmUrl}\n\n` +
                    `If you have not yet received payment, please ignore this email until you have.\n\n` +
                    `WiseMove Connect`,
            }),
        });
        return response.ok;
    } catch (err) {
        console.error('[PaymentConfirm Email] Exception:', err.message);
        return false;
    }
};

module.exports = { dispatchNotifications, notifyAdminUnassigned, sendLeadConfirmation, sendPartnerPaymentConfirmationRequest };
