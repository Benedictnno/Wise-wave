const express = require('express');
const router = express.Router();
const PostcodeExclusivity = require('../../models/PostcodeExclusivity');
const { body, validationResult } = require('express-validator');

/**
 * GET /admin/exclusivity
 * List all exclusivity records
 */
router.get('/', async (req, res) => {
    try {
        const records = await PostcodeExclusivity.find()
            .populate('partnerId', 'name email')
            .populate('categoryId', 'name externalId');
        return res.json(records);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /admin/exclusivity
 * Create a new exclusivity record
 */
router.post(
    '/',
    [
        body('partnerId').isMongoId(),
        body('categoryId').isMongoId(),
        body('postcode').trim().notEmpty(),
        body('level').isIn(['Area', 'District', 'Sector']),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        try {
            const Partner = require('../../models/Partner');
            const partner = await Partner.findById(req.body.partnerId);
            if (!partner) return res.status(404).json({ error: 'Partner not found' });
            
            // M-7: Check if partner covers this service
            if (!partner.categories.includes(req.body.categoryId)) {
                return res.status(400).json({ error: 'Cannot grant exclusivity: Partner does not cover this service category.' });
            }

            const record = await PostcodeExclusivity.create(req.body);
            return res.status(201).json(record);
        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({ error: 'This category/postcode already has an exclusive partner.' });
            }
            return res.status(500).json({ error: err.message });
        }
    }
);

/**
 * DELETE /admin/exclusivity/:id
 * Remove record
 */
router.delete('/:id', async (req, res) => {
    try {
        await PostcodeExclusivity.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Exclusivity record deleted' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
