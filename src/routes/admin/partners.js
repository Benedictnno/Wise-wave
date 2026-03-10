const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Partner = require('../../models/Partner');

// All routes require JWT auth
router.use(authMiddleware);

// GET /admin/partners
router.get('/', async (req, res) => {
    try {
        const partners = await Partner.find()
            .populate('categories', 'name')
            .sort({ priority: 1 });
        return res.status(200).json(partners);
    } catch (err) {
        console.error('[GET /admin/partners]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/partners/:id
router.get('/:id', async (req, res) => {
    try {
        const partner = await Partner.findById(req.params.id).populate('categories', 'name');
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        return res.status(200).json(partner);
    } catch (err) {
        console.error('[GET /admin/partners/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/partners
router.post(
    '/',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('phone').trim().notEmpty().withMessage('Phone is required'),
        body('categories').isArray({ min: 1 }).withMessage('At least one category is required'),
        body('postcodes').isArray({ min: 1 }).withMessage('At least one postcode is required'),
        body('priority').isInt({ min: 1 }).withMessage('Priority must be a positive integer'),
    ],
    validate,
    async (req, res) => {
        try {
            const { name, email, phone, whatsappNumber, categories, postcodes, priority, status } = req.body;
            const partner = await Partner.create({
                name,
                email,
                phone,
                whatsappNumber: whatsappNumber || '',
                categories,
                postcodes: postcodes.map((p) => p.toUpperCase().trim()),
                priority,
                status: status || 'active',
            });
            return res.status(201).json(partner);
        } catch (err) {
            console.error('[POST /admin/partners]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// PUT /admin/partners/:id
router.put('/:id', async (req, res) => {
    try {
        const updates = { ...req.body };
        if (updates.postcodes) {
            updates.postcodes = updates.postcodes.map((p) => p.toUpperCase().trim());
        }
        const partner = await Partner.findByIdAndUpdate(req.params.id, updates, {
            new: true,
            runValidators: true,
        }).populate('categories', 'name');
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        return res.status(200).json(partner);
    } catch (err) {
        console.error('[PUT /admin/partners/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /admin/partners/:id/status — activate or deactivate
router.patch(
    '/:id/status',
    [body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive')],
    validate,
    async (req, res) => {
        try {
            const partner = await Partner.findByIdAndUpdate(
                req.params.id,
                { status: req.body.status },
                { new: true }
            );
            if (!partner) return res.status(404).json({ error: 'Partner not found' });
            return res.status(200).json({ message: `Partner ${req.body.status}`, partner });
        } catch (err) {
            console.error('[PATCH /admin/partners/:id/status]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// DELETE /admin/partners/:id
router.delete('/:id', async (req, res) => {
    try {
        const partner = await Partner.findByIdAndDelete(req.params.id);
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        return res.status(200).json({ message: 'Partner deleted' });
    } catch (err) {
        console.error('[DELETE /admin/partners/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
