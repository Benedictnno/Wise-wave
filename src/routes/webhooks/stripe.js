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
        if (session.payment_status === 'paid') {
            await handlePaymentSucceeded(session.metadata?.invoiceNumber);
        }
    } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        console.warn(`[Stripe Webhook] Payment failed for Intent: ${paymentIntent.id}`);
    } else if (event.type === 'charge.refunded') {
        const charge = event.data.object;
        console.log(`[Stripe Webhook] Charge refunded: ${charge.id}`);
    }

    res.json({ received: true });
});

const handlePaymentSucceeded = async (invoiceNumber) => {
    if (!invoiceNumber) return;
    
    const invoice = await Invoice.findOne({ invoiceNumber }).populate('commissionId');
    if (!invoice || invoice.status === 'paid') return;

    invoice.status = 'paid';
    invoice.paidAt = new Date();
    await invoice.save();

    // Update commission status
    if (invoice.commissionId) {
        const commission = await Commission.findById(invoice.commissionId);
        if (commission) {
            commission.commissionStatus = 'paid';
            await commission.save();
            
            // Apply potential splits (handled in commissionService.applySplit)
            const { applySplit } = require('../../services/commissionService');
            await applySplit(commission);
        }
    }
    
    console.log(`[Stripe Webhook] Invoice ${invoiceNumber} marked as PAID`);
};

module.exports = router;
