const express = require('express');
const router = express.Router();
const Subservice = require('../models/Subservice');
const Category = require('../models/Category');

/**
 * GET /api/subservices?categorySlug=rd-tax-credits
 * Returns subservices for a given parent category slug.
 */
router.get('/', async (req, res) => {
    try {
        const { categorySlug } = req.query;
        if (!categorySlug) return res.status(400).json({ error: 'categorySlug query param required' });
        
        const category = await Category.findOne({ serviceSlug: categorySlug });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        
        const subservices = await Subservice.find({ categoryId: category._id, isActive: true });
        return res.json(subservices);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/subservices/:slug
 */
router.get('/:slug', async (req, res) => {
    try {
        const subservice = await Subservice.findOne({ slug: req.params.slug, isActive: true });
        if (!subservice) return res.status(404).json({ error: 'Subservice not found' });
        return res.json(subservice);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
