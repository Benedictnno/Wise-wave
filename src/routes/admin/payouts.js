const express = require('express');
const router = express.Router();
const IntroducerPayout = require('../../models/IntroducerPayout');

/**
 * GET /admin/payouts
 * List all payouts to introducers
 */
router.get('/', async (req, res) => {
    try {
        const payouts = await IntroducerPayout.find()
            .populate('introducerId', 'name email companyName')
            .populate('invoiceId', 'invoiceNumber amount')
            .sort({ createdAt: -1 });
        return res.json(payouts);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /admin/payouts/:id/mark-paid
 * Admin marks a payout as processed
 */
router.patch('/:id/mark-paid', async (req, res) => {
    try {
        const payout = await IntroducerPayout.findById(req.params.id);
        if (!payout) return res.status(404).json({ error: 'Payout record not found' });
        
        payout.payoutStatus = 'paid';
        payout.paidAt = new Date();
        await payout.save();
        
        return res.json(payout);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
