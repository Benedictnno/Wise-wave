const express = require('express');
const router = express.Router();

// M-9: Stub for inbound Resend webhooks
router.post('/inbound', async (req, res) => {
    try {
        // Resend sends a webhook payload containing the email details.
        // We will forward the message to the ADMIN_EMAIL so support can respond.
        console.log('[Resend Webhook] Inbound email received');

        // Note: For this to work in production, you must verify the signature
        // of the incoming webhook from Resend to ensure authenticity.

        const payload = req.body;
        const apiKey = process.env.RESEND_API_KEY;
        const adminEmail = process.env.ADMIN_EMAIL;

        if (apiKey && adminEmail && payload && payload.from) {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
                    to: adminEmail,
                    reply_to: payload.from,
                    subject: `[Support Request] Fwd: ${payload.subject || 'Partner Reply'}`,
                    text: `Forwarded message from ${payload.from}:\n\n${payload.text || payload.html || 'No content provided.'}`,
                }),
            });
            console.log(`[Resend Webhook] Forwarded partner reply to admin`);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('[Resend Webhook Error]', err.message);
        res.status(500).send('Webhook Error');
    }
});

module.exports = router;
