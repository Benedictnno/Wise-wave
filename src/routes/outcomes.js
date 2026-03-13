const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const Lead = require('../models/Lead');
const { processOutcome } = require('../services/outcomeService');

/**
 * @openapi
 * /api/outcomes/{token}:
 *   get:
 *     summary: Get lead details for outcome reporting
 *     description: Returns limited lead details for a partner to report the outcome using their secure token.
 *     tags: [Outcomes]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead details
 *       404:
 *         description: Invalid or expired token
 */
router.get('/:token', async (req, res) => {
    try {
        const lead = await Lead.findOne({ outcomeToken: req.params.token })
            .populate('category', 'name commissionType commissionValue')
            .select('name postcode description createdAt outcome partnerFee');
        
        if (!lead) return res.status(404).json({ error: 'Invalid or expired outcome link' });
        
        return res.status(200).json(lead);
    } catch (err) {
        console.error('[GET /api/outcomes/:token]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /api/outcomes/{token}:
 *   post:
 *     summary: Submit lead outcome
 *     description: Partner marks the lead as won, lost, or not suitable. If won, triggers commission.
 *     tags: [Outcomes]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [outcome]
 *             properties:
 *               outcome:
 *                 type: string
 *                 enum: [won, lost, not_suitable]
 *               partnerFee:
 *                 type: number
 *                 description: Required if outcome is 'won' and category is percentage/tiered
 *               rdTaxYear:
 *                 type: integer
 *                 description: Only used if category is tiered (R&D Tax)
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Outcome recorded successfully
 */
router.post(
    '/:token',
    [
        body('outcome').isIn(['won', 'lost', 'not_suitable']).withMessage('Invalid outcome status'),
        body('partnerFee').optional().isFloat({ min: 0 }).withMessage('Partner fee must be a valid number'),
        body('rdTaxYear').optional().isInt({ min: 1 }),
        body('notes').optional().trim(),
    ],
    validate,
    async (req, res) => {
        try {
            const { outcome, partnerFee, rdTaxYear, notes } = req.body;
            const lead = await Lead.findOne({ outcomeToken: req.params.token }).populate('category');
            
            if (!lead) return res.status(404).json({ error: 'Invalid or expired outcome link' });
            if (lead.outcome) return res.status(400).json({ error: 'Outcome has already been reported for this lead' });

            const result = await processOutcome(lead, outcome, partnerFee, rdTaxYear, notes);
            
            return res.status(200).json({ message: 'Outcome recorded successfully', data: result });
        } catch (err) {
            console.error('[POST /api/outcomes/:token]', err.message);
            return res.status(400).json({ error: err.message });
        }
    }
);

module.exports = router;
