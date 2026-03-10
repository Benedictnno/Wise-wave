const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const CategoryRelationship = require('../models/CategoryRelationship');

// GET /api/categories — all active categories
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ name: 1 });

        const response = categories.map((c) => ({
            _id: c._id,
            name: c.name,
            commissionType: c.commissionType,
            description: c.description,
            isRegulated: c.isRegulated,
            // FCA disclaimer for regulated categories (mortgage / IFA)
            disclaimer: c.isRegulated
                ? 'WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.'
                : undefined,
        }));

        return res.status(200).json(response);
    } catch (err) {
        console.error('[GET /api/categories]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/categories/:id/suggestions — static cross-category suggestions
router.get('/:id/suggestions', async (req, res) => {
    try {
        const relationship = await CategoryRelationship.findOne({ categoryId: req.params.id }).populate(
            'relatedCategories',
            'name description isRegulated'
        );

        if (!relationship) {
            return res.status(200).json([]);
        }

        return res.status(200).json(relationship.relatedCategories);
    } catch (err) {
        console.error('[GET /api/categories/:id/suggestions]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
