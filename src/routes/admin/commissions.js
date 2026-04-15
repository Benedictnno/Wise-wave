const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Commission = require('../../models/Commission');
const Lead = require('../../models/Lead');
const Category = require('../../models/Category');
const { calculateCommission, applySplit } = require('../../services/commissionService');

// All routes require JWT auth
router.use(authMiddleware);

/**
 * @openapi
 * /admin/commissions:
 *   get:
 *     summary: List all commissions
 *     description: Returns a list of all recorded commissions with filters for status and partner. Requires admin authentication.
 *     tags: [Admin Commissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [paid, unpaid, reversed] }
 *       - in: query
 *         name: partnerId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: List of commissions
 */
// GET /admin/commissions
router.get('/', async (req, res) => {
    try {
        const { status, partnerId, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.commissionStatus = status;
        if (partnerId) filter.partnerId = partnerId;

        const commissions = await Commission.find(filter)
            .populate('leadId', 'name email postcode')
            .populate('partnerId', 'name email')
            .populate('categoryId', 'name commissionType')
            .populate('introducerId', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Commission.countDocuments(filter);
        return res.status(200).json({ commissions, total, page: Number(page) });
    } catch (err) {
        console.error('[GET /admin/commissions]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/commissions/{id}:
 *   get:
 *     summary: Get commission details
 *     description: Returns detailed information for a specific commission record.
 *     tags: [Admin Commissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Commission details
 *       404:
 *         description: Commission not found
 */
// GET /admin/commissions/:id
router.get('/:id', async (req, res) => {
    try {
        const commission = await Commission.findById(req.params.id)
            .populate('leadId partnerId categoryId introducerId');
        if (!commission) return res.status(404).json({ error: 'Commission not found' });
        return res.status(200).json(commission);
    } catch (err) {
        console.error('[GET /admin/commissions/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/commissions:
 *   post:
 *     summary: Report successful deal and record commission
 *     description: Triggered when a partner reports a deal. Calculates and stores the commission based on category rules.
 *     tags: [Admin Commissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [leadId, partnerId, partnerFee]
 *             properties:
 *               leadId: { type: string }
 *               partnerId: { type: string }
 *               partnerFee: { type: number }
 *               rdTaxYear: { type: integer, minimum: 1, maximum: 2 }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Commission recorded
 *       404:
 *         description: Lead not found
 */
// POST /admin/commissions — partner reports a successful deal
router.post(
    '/',
    [
        body('leadId').isMongoId().withMessage('Valid lead ID required'),
        body('partnerId').isMongoId().withMessage('Valid partner ID required'),
        body('partnerFee').isFloat({ min: 0 }).withMessage('Partner fee must be a non-negative number'),
        body('rdTaxYear').optional().isInt({ min: 1 }).withMessage('R&D Tax year must be a positive integer'),
        body('notes').optional().trim(),
    ],
    validate,
    async (req, res) => {
        try {
            const { leadId, partnerId, partnerFee, rdTaxYear, notes } = req.body;

            const lead = await Lead.findById(leadId).populate('category');
            if (!lead) return res.status(404).json({ error: 'Lead not found' });

            const category = lead.category;
            const CommissionRule = require('../../models/CommissionRule');
            const rule = await CommissionRule.findOne({ categoryId: category._id });
            if (!rule) return res.status(400).json({ error: 'No commission rule configuration for this category.' });

            const total = calculateCommission(rule, Number(partnerFee), rdTaxYear ? Number(rdTaxYear) : null);

            const { calculateShares } = require('../../services/commissionService');
            const { introducerShare, wisemoveShare } = calculateShares(total, !!lead.introducerId);

            const commission = await Commission.create({
                leadId,
                partnerId,
                categoryId: category._id,
                commissionType: rule.type,
                commissionValue: total,
                introducerId: lead.introducerId || null,
                introducerShare,
                wisemoveShare,
                rdTaxYear: rdTaxYear || null,
                notes: notes || 'Admin Manual Creation',
                commissionStatus: 'unpaid'
            });

            // Optional: You could generate an invoice here too using invoiceService
            
            return res.status(201).json(commission);
        } catch (err) {
            console.error('[POST /admin/commissions]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/**
 * @openapi
 * /admin/commissions/{id}:
 *   patch:
 *     summary: Update commission status
 *     description: Updates the payment status of a commission (paid, unpaid, or reversed).
 *     tags: [Admin Commissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [commissionStatus]
 *             properties:
 *               commissionStatus: { type: string, enum: [paid, unpaid, reversed] }
 *     responses:
 *       200:
 *         description: Commission updated
 */
// PATCH /admin/commissions/:id — update status (paid/unpaid/reversed)
router.patch(
    '/:id',
    [body('commissionStatus').isIn(['paid', 'unpaid', 'reversed']).withMessage('Invalid status')],
    validate,
    async (req, res) => {
        try {
            const commission = await Commission.findByIdAndUpdate(
                req.params.id,
                { commissionStatus: req.body.commissionStatus, updatedAt: new Date() },
                { returnDocument: 'after' }
            );
            if (!commission) return res.status(404).json({ error: 'Commission not found' });
            return res.status(200).json({ message: 'Commission updated', commission });
        } catch (err) {
            console.error('[PATCH /admin/commissions/:id]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
