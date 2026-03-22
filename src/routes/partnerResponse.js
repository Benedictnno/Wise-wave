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
            .populate('category', 'name externalId commissionType _id')
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
            const lead = await Lead.findOne({ outcomeToken: req.params.token }).populate('category', 'name externalId commissionType _id');
            
            if (!lead) return res.status(404).json({ error: 'Invalid or missing outcome link' });
            
            // Enforce 7-day token expiry
            if (lead.outcomeTokenExpiry && new Date() > lead.outcomeTokenExpiry) {
                return res.status(410).json({ error: 'This secure outcome link has expired (7-day window exceeded).' });
            }

            if (lead.outcome) return res.status(400).json({ error: 'Outcome has already been reported for this lead' });

            const result = await processPartnerResponse(lead, outcome, partnerFee, notes);
            
            // C-4: One-time use link
            lead.outcomeToken = null;
            lead.outcomeTokenExpiry = null;
            await lead.save();

            return res.status(200).json({ message: 'Outcome recorded successfully', data: result });
        } catch (err) {
            console.error('[POST /api/partner-response/:token]', err.message);
            return res.status(400).json({ error: err.message });
        }
    }
);

/**
 * @openapi
 * /api/partner-response/{id}/revenue:
 *   post:
 *     summary: Submit R&D revenue later, triggering calculation and invoice.
 */
router.post(
    '/:id/revenue',
    [
        body('revenueAmount').isFloat({ min: 1 }).withMessage('Revenue amount must be greater than 0'),
        body('revenueDate').isISO8601().withMessage('Valid date is required'),
        body('yearNumber').optional().isInt({ min: 1, max: 10 }),
    ],
    validate,
    async (req, res) => {
        try {
            const { revenueAmount, revenueDate, yearNumber } = req.body;
            const lead = await Lead.findById(req.params.id).populate('category', 'name externalId commissionType _id');
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            if (lead.category.externalId !== 'BS-001') {
                return res.status(400).json({ error: 'Revenue triggers only apply to R&D Tax Credits' });
            }

            const { calculateCommission } = require('../services/commissionService');
            const { generateInvoice } = require('../services/invoiceService');
            const CommissionRule = require('../models/CommissionRule');
            const Commission = require('../models/Commission');

            const rule = await CommissionRule.findOne({ categoryId: lead.category._id });
            if (!rule) return res.status(400).json({ error: 'No commission rule configuration for R&D.' });

            lead.partnerFeeTotal = (lead.partnerFeeTotal || 0) + revenueAmount;
            lead.rdTaxYear = yearNumber || 1;
            await lead.save();

            const totalCommissionAmount = calculateCommission(rule, revenueAmount, lead.rdTaxYear);

            const commission = await Commission.create({
                leadId: lead._id,
                partnerId: lead.assignedPartnerId,
                categoryId: lead.category._id,
                commissionType: rule.type,
                commissionValue: totalCommissionAmount,
                introducerId: lead.introducerId || null,
                introducerShare: 0,
                wisemoveShare: totalCommissionAmount,
                notes: `R&D Year ${lead.rdTaxYear} Revenue Report`,
                commissionStatus: 'unpaid'
            });

            const invoice = await generateInvoice(lead, commission);

            return res.status(200).json({ message: 'Revenue submitted and invoiced successfully.', invoice, commission });
        } catch (err) {
            console.error('[POST /api/partner-response/:id/revenue]', err.message);
            return res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;
