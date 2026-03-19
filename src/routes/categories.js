const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const CategoryRelationship = require('../models/CategoryRelationship');

/**
 * @openapi
 * /api/categories:
 *   get:
 *     summary: Get all active service categories
 *     description: Returns a list of all service categories available for lead matching. Includes FCA disclaimers for regulated categories.
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "65f1234567890abcdef12345"
 *                   name:
 *                     type: string
 *                     example: "Mortgage Broker"
 *                   commissionType:
 *                     type: string
 *                     enum: [percentage, flat]
 *                   description:
 *                     type: string
 *                   isRegulated:
 *                     type: boolean
 *                   disclaimer:
 *                     type: string
 *       500:
 *         description: Internal server error
 */
// GET /api/categories — all active categories
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find({ isActive: true }).sort({ name: 1 });

        const response = categories.map((c) => ({
            _id: c._id,
            name: c.name,
            slug: c.slug,
            commissionType: c.commissionType,
            description: c.description,
            isRegulated: c.isRegulated,
            // FCA disclaimer for regulated categories (mortgage / IFA)
            disclaimer: c.isRegulated
                ? 'WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.'
                : undefined,
            pillarId: c.pillarId,
        }));

        return res.status(200).json(response);
    } catch (err) {
        console.error('[GET /api/categories]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /api/categories/{identifier}:
 *   get:
 *     summary: Get a single active service category
 *     description: Fetches an active category by either its MongoDB _id or its URL-friendly slug.
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: The category's _id or slug
 *     responses:
 *       200:
 *         description: Category details
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
// GET /api/categories/:identifier — single active category by ID or slug
router.get('/:identifier', async (req, res) => {
    try {
        const identifier = req.Params?.identifier || req.params.identifier;
        let query = { isActive: true };
        
        // Check if identifier is a valid MongoDB ObjectId
        if (/^[0-9a-fA-F]{24}$/.test(identifier)) {
            query._id = identifier;
        } else {
            query.slug = identifier;
        }

        const category = await Category.findOne(query);

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        return res.status(200).json({
            _id: category._id,
            name: category.name,
            slug: category.slug,
            commissionType: category.commissionType,
            description: category.description,
            isRegulated: category.isRegulated,
            disclaimer: category.isRegulated
                ? 'WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.'
                : undefined,
            pillarId: category.pillarId,
        });

    } catch (err) {
        console.error('[GET /api/categories/:identifier]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /api/categories/{id}/suggestions:
 *   get:
 *     summary: Get cross-category suggestions
 *     description: Returns 3–5 related categories based on static rules for the given category ID.
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The category ID
 *     responses:
 *       200:
 *         description: List of related categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   isRegulated:
 *                     type: boolean
 *       500:
 *         description: Internal server error
 */
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
