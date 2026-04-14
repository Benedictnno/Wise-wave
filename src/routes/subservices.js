const express = require('express');
const router = express.Router();
const Subservice = require('../models/Subservice');
const Category = require('../models/Category');

/**
 * GET /api/subservices?categorySlug=rd-tax-credits
 * Returns subservices for a given parent category slug.
 */
/**
 * @openapi
 * /api/subservices:
 *   get:
 *     summary: List subservices for a category
 *     description: Returns active subservices for a category, identified by category slug.
 *     tags: [Subservices]
 *     parameters:
 *       - in: query
 *         name: categorySlug
 *         required: true
 *         schema: { type: string, example: "rd-tax-credits" }
 *         description: The parent category's `serviceSlug`.
 *     responses:
 *       200:
 *         description: List of active subservices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string, example: "65f1234567890abcdef12345" }
 *                   categoryId: { type: string, example: "65f1234567890abcdef99999" }
 *                   name: { type: string, example: "Software Development" }
 *                   slug: { type: string, example: "software-development" }
 *                   description: { type: string, example: "R&D claim support for software teams." }
 *                   isActive: { type: boolean, example: true }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
/**
 * @openapi
 * /api/subservices/{slug}:
 *   get:
 *     summary: Get a subservice by slug
 *     tags: [Subservices]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string, example: "software-development" }
 *     responses:
 *       200:
 *         description: Subservice
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id: { type: string }
 *                 categoryId: { type: string }
 *                 name: { type: string }
 *                 slug: { type: string }
 *                 description: { type: string }
 *                 isActive: { type: boolean }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
