const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const Lead = require('../models/Lead');
const { processPartnerResponse } = require('../services/partnerResponseService');

/**
 * @openapi
 * /api/partner-response/{token}:
 *   get:
 *     summary: Get lead details for outcome reporting
 */
router.get('/:token', async (req, res) => {
    try {
        const lead = await Lead.findOne({ outcomeToken: req.params.token })
            .populate('category', 'name')
            .select('name postcode description createdAt outcome partnerFee outcomeTokenExpiry');
        
        if (!lead) return res.status(404).json({ error: 'Invalid or missing outcome link' });
        
        // Enforce 7-day token expiry
        if (lead.outcomeTokenExpiry && new Date() > lead.outcomeTokenExpiry) {
            return res.status(410).json({ error: 'This secure outcome link has expired (7-day window exceeded). Please contact WiseMove support if you still need to report this lead.' });
        }
        
        return res.status(200).json(lead);
    } catch (err) {
        console.error('[GET /api/partner-response/:token]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /api/partner-response/{token}:
 *   post:
 *     summary: Submit lead outcome
 */
router.post(
    '/:token',
    [
        body('outcome').isIn(['won', 'lost', 'not_suitable']).withMessage('Invalid outcome status'),
        body('partnerFee').optional().isFloat({ min: 0 }).withMessage('Partner fee must be a valid number'),
        body('notes').optional().trim(),
    ],
    validate,
    async (req, res) => {
        try {
            const { outcome, partnerFee, notes } = req.body;
            const lead = await Lead.findOne({ outcomeToken: req.params.token }).populate('category');
            
            if (!lead) return res.status(404).json({ error: 'Invalid or missing outcome link' });
            
            // Enforce 7-day token expiry
            if (lead.outcomeTokenExpiry && new Date() > lead.outcomeTokenExpiry) {
                return res.status(410).json({ error: 'This secure outcome link has expired (7-day window exceeded).' });
            }

            if (lead.outcome) return res.status(400).json({ error: 'Outcome has already been reported for this lead' });

            const result = await processPartnerResponse(lead, outcome, partnerFee, notes);
            
            return res.status(200).json({ message: 'Outcome recorded successfully', data: result });
        } catch (err) {
            console.error('[POST /api/partner-response/:token]', err.message);
            return res.status(400).json({ error: err.message });
        }
    }
);

module.exports = router;
