const express = require('express');
const router = express.Router();

// M-9: Inbound Resend webhooks
const { Webhook } = require('svix');

router.post('/inbound', async (req, res) => {
    try {
        const payloadString = req.body.toString();
        const svixId = req.headers['svix-id'];
        const svixTimestamp = req.headers['svix-timestamp'];
        const svixSignature = req.headers['svix-signature'];

        if (!svixId || !svixTimestamp || !svixSignature) {
            return res.status(400).send('Missing Svix headers');
        }

        const wh = new Webhook(process.env.RESEND_WEBHOOK_SECRET || 'fallback_for_testing_purposes');
        let payload;
        try {
            payload = wh.verify(payloadString, {
                'svix-id': svixId,
                'svix-timestamp': svixTimestamp,
                'svix-signature': svixSignature
            });
        } catch (err) {
            console.error('[Resend Webhook] Signature verification failed');
            return res.status(400).send('Invalid signature');
        }

        console.log('[Resend Webhook] Inbound email received and verified');

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
        res.status(500).send('Internal Error');
    }
});

module.exports = router;
