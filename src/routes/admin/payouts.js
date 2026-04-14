const express = require('express');
const router = express.Router();
const IntroducerPayout = require('../../models/IntroducerPayout');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

/**
 * GET /admin/payouts
 * List all payouts to introducers
 */
/**
 * @openapi
 * /admin/payouts:
 *   get:
 *     summary: List introducer payouts
 *     tags: [Admin Payouts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payout list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
/**
 * @openapi
 * /admin/payouts/{id}/mark-paid:
 *   patch:
 *     summary: Mark payout as paid
 *     tags: [Admin Payouts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated payout document
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
