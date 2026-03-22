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

module.exports = router;
