const express = require('express');
const router = express.Router();

// M-9: Inbound Resend webhooks
const { Webhook } = require('svix');

/**
 * @openapi
 * /api/webhooks/resend/inbound:
 *   post:
 *     summary: Resend inbound webhook (email replies)
 *     description: >
 *       Validates Svix signature headers and forwards the inbound email to the configured admin email.
 *       This endpoint expects the raw request body (configured in server middleware).
 *     tags: [Webhooks]
 *     parameters:
 *       - in: header
 *         name: svix-id
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: svix-timestamp
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: svix-signature
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *           examples:
 *             example:
 *               value:
 *                 from: "partner@example.com"
 *                 subject: "Re: New WiseMove Connect Introduction"
 *                 text: "Thanks — we can take this on."
 *     responses:
 *       200:
 *         description: Webhook accepted
 *         content:
 *           text/plain:
 *             schema: { type: string, example: "OK" }
 *       400:
 *         description: Missing Svix headers or invalid signature
 *         content:
 *           text/plain:
 *             schema: { type: string, example: "Invalid signature" }
 *       500:
 *         description: Internal error
 *         content:
 *           text/plain:
 *             schema: { type: string, example: "Internal Error" }
 */
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
