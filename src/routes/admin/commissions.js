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
            const total = calculateCommission(category, Number(partnerFee), rdTaxYear ? Number(rdTaxYear) : null);
            const { introducerShare, wisemoveShare } = applySplit(total, lead.introducerId);

            const commission = await Commission.create({
                leadId,
                partnerId,
                categoryId: category._id,
                commissionType: category.commissionType,
                commissionValue: total,
                introducerId: lead.introducerId || null,
                introducerShare,
                wisemoveShare,
                rdTaxYear: rdTaxYear || null,
                notes: notes || '',
            });

            return res.status(201).json(commission);
        } catch (err) {
            console.error('[POST /admin/commissions]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

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
                { new: true }
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
