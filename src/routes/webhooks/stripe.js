const express = require('express');
const router = express.Router();
const stripe = require('../../config/stripe');
const Invoice = require('../../models/Invoice');
const Commission = require('../../models/Commission');
const { applySplit } = require('../../services/commissionService');

router.post('/', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`[Stripe Webhook] Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Stripe Webhook] Received event type: ${event.type}`);

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        // Find invoice using metadata
        const invoiceNumber = session.metadata?.invoiceNumber;
        if (invoiceNumber) {
            const invoice = await Invoice.findOne({ invoiceNumber }).populate('commissionId');
            if (invoice && invoice.status !== 'paid') {
                invoice.status = 'paid';
                invoice.paidAt = new Date();
                await invoice.save();

                // Update commission status
                if (invoice.commissionId) {
                    const commission = await Commission.findById(invoice.commissionId);
                    if (commission) {
                        commission.commissionStatus = 'paid';
                        await commission.save();
                        
                        // PHASE 4: Apply potential splits (handled in commissionService.applySplit)
                        await applySplit(commission);
                    }
                }
                
                console.log(`[Stripe Webhook] Invoice ${invoiceNumber} marked as PAID`);
            }
        }
    } else if (event.type === 'payment_intent.payment_failed') {
        const intent = event.data.object;
        console.log(`[Stripe Webhook] Payment failed for intent: ${intent.id}`);
        // Optional: Notify partner or admin
    } else if (event.type === 'charge.refunded') {
        const charge = event.data.object;
        // Optional: Handle partial or full refunds
    }

    res.json({ received: true });
});

module.exports = router;
