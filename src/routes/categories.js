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
