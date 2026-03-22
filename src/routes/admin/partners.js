const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Partner = require('../../models/Partner');

router.use(authMiddleware);

// GET /admin/partners
router.get('/', async (req, res) => {
    try {
        const partners = await Partner.find().sort({ priority: 1 });
        return res.json(partners);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// POST /admin/partners
router.post(
    '/',
    [
        body('companyName').trim().notEmpty(),
        body('contactName').trim().notEmpty(),
        body('email').isEmail().normalizeEmail(),
        body('phone').trim().notEmpty(),
        body('preferredContactMethod').isIn(['email', 'sms', 'whatsapp']),
        body('backupDeliveryMethod').isIn(['email', 'sms', 'whatsapp']),
        body('priority').isInt({ min: 1 }),
    ],
    validate,
    async (req, res) => {
        try {
            const partner = await Partner.create({
                ...req.body,
                agreementAccepted: true,
                agreementTimestamp: new Date()
            });
            return res.status(201).json(partner);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

// PUT /admin/partners/:id
router.put('/:id', async (req, res) => {
    try {
        const partner = await Partner.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        return res.json(partner);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /admin/partners/:id/status
router.patch(
    '/:id/status',
    [
        body('status').isIn(['active', 'inactive', 'pending']).withMessage('Status must be active, inactive, or pending')
    ],
    validate,
    async (req, res) => {
        try {
            const partner = await Partner.findByIdAndUpdate(
                req.params.id,
                { status: req.body.status, updatedAt: new Date() },
                { new: true, runValidators: true }
            );
            if (!partner) return res.status(404).json({ error: 'Partner not found' });
            return res.status(200).json({ message: 'Partner status updated', partner });
        } catch (err) {
            console.error('[PATCH /admin/partners/:id/status]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/**
 * @openapi
 * /admin/partners/{id}/subservices:
 *   get:
 *     summary: View partner subservices (R&D)
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/subservices', async (req, res) => {
    try {
        const partner = await Partner.findById(req.params.id).populate('subservices', 'name slug');
        if (!partner) return res.status(404).json({ error: 'Not found' });
        return res.json(partner.subservices);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/partners/{id}/subservices:
 *   put:
 *     summary: Edit partner subservices
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/subservices',
    [body('subservices').isArray()],
    validate,
    async (req, res) => {
        try {
            const Subservice = require('../../models/Subservice');
            const valid = await Subservice.find({ _id: { $in: req.body.subservices } });
            
            if (valid.length !== req.body.subservices.length) {
                return res.status(400).json({ error: 'One or more subservice IDs are invalid' });
            }
            
            const partner = await Partner.findByIdAndUpdate(
                req.params.id,
                { subservices: req.body.subservices },
                { new: true }
            ).populate('subservices', 'name slug');
            
            if (!partner) return res.status(404).json({ error: 'Not found' });
            return res.json(partner);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;
