const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Category = require('../../models/Category');
const CategoryRelationship = require('../../models/CategoryRelationship');

// All routes require JWT auth
router.use(authMiddleware);

// GET /admin/categories
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find().sort({ name: 1 });
        return res.status(200).json(categories);
    } catch (err) {
        console.error('[GET /admin/categories]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /admin/categories
router.post(
    '/',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('commissionType').isIn(['percentage', 'flat', 'tiered']).withMessage('Invalid commission type'),
        body('commissionValue').isFloat({ min: 0 }).withMessage('Commission value must be >= 0'),
    ],
    validate,
    async (req, res) => {
        try {
            const { name, commissionType, commissionValue, introducerSplit, description, notes, isRegulated } = req.body;
            const category = await Category.create({
                name,
                commissionType,
                commissionValue,
                introducerSplit: introducerSplit ?? 30,
                description: description || '',
                notes: notes || '',
                isRegulated: isRegulated || false,
            });
            return res.status(201).json(category);
        } catch (err) {
            console.error('[POST /admin/categories]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// PUT /admin/categories/:id
router.put('/:id', async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        return res.status(200).json(category);
    } catch (err) {
        console.error('[PUT /admin/categories/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/categories/:id/relationships
router.get('/:id/relationships', async (req, res) => {
    try {
        const rel = await CategoryRelationship.findOne({ categoryId: req.params.id })
            .populate('relatedCategories', 'name');
        if (!rel) return res.status(200).json({ relatedCategories: [] });
        return res.status(200).json(rel);
    } catch (err) {
        console.error('[GET /admin/categories/:id/relationships]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /admin/categories/:id/relationships — update cross-category suggestions
router.put(
    '/:id/relationships',
    [body('relatedCategories').isArray().withMessage('relatedCategories must be an array')],
    validate,
    async (req, res) => {
        try {
            const rel = await CategoryRelationship.findOneAndUpdate(
                { categoryId: req.params.id },
                { categoryId: req.params.id, relatedCategories: req.body.relatedCategories },
                { new: true, upsert: true }
            ).populate('relatedCategories', 'name');
            return res.status(200).json(rel);
        } catch (err) {
            console.error('[PUT /admin/categories/:id/relationships]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
