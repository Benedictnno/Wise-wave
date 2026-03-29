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
        await handleChargeRefunded(charge);
    }

    res.json({ received: true });
});

const handleChargeRefunded = async (charge) => {
    let invoiceNumber = null;

    if (charge.payment_intent) {
        try {
            // Look up the session that created this payment intent to find metadata securely
            const sessions = await stripe.checkout.sessions.list({
                payment_intent: charge.payment_intent,
                limit: 1,
            });
            invoiceNumber = sessions.data[0]?.metadata?.invoiceNumber;
        } catch (err) {
            console.error('[Stripe Webhook] Error fetching session for refund:', err.message);
        }
    }

    if (!invoiceNumber) {
        console.warn(`[Stripe Webhook] charge.refunded (${charge.id}) — could not resolve invoiceNumber`);
        return;
    }

    const invoice = await Invoice.findOne({ invoiceNumber }).populate('commissionId');
    if (invoice && invoice.status !== 'reversed') {
        invoice.status = 'reversed';
        await invoice.save();

        if (invoice.commissionId) {
            const commission = await Commission.findById(invoice.commissionId);
            if (commission) {
                commission.commissionStatus = 'reversed';
                await commission.save();
            }
        }
        console.log(`[Stripe Webhook] Invoice ${invoiceNumber} marked as REVERSED due to refund`);
    }
};

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

    // Update Lead paymentStatus (H-6)
    const Lead = require('../../models/Lead');
    await Lead.findOneAndUpdate(
        { _id: invoice.leadId },
        { paymentStatus: 'paid' }
    );
    
    console.log(`[Stripe Webhook] Invoice ${invoiceNumber} marked as PAID`);
};

module.exports = router;
