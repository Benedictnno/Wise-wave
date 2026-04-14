const express = require('express');
const router = express.Router();
const PostcodeExclusivity = require('../../models/PostcodeExclusivity');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

/**
 * GET /admin/exclusivity
 * List all exclusivity records
 */
/**
 * @openapi
 * /admin/exclusivity:
 *   get:
 *     summary: List postcode exclusivity records
 *     tags: [Admin Exclusivity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Exclusivity record list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
 * GET /admin/exclusivity/:id
 */
/**
 * @openapi
 * /admin/exclusivity/{id}:
 *   get:
 *     summary: Get postcode exclusivity record
 *     tags: [Admin Exclusivity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Exclusivity record
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:id', async (req, res) => {
    try {
        const record = await PostcodeExclusivity.findById(req.params.id)
            .populate('partnerId', 'name email companyName')
            .populate('categoryId', 'name externalId');
        if (!record) return res.status(404).json({ error: 'Record not found' });
        return res.json(record);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /admin/exclusivity
 * Create a new exclusivity record
 */
/**
 * @openapi
 * /admin/exclusivity:
 *   post:
 *     summary: Create postcode exclusivity record
 *     description: Grants a partner exclusivity for a category within a postcode level (Area/District/Sector).
 *     tags: [Admin Exclusivity]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [partnerId, categoryId, postcode, level]
 *             properties:
 *               partnerId: { type: string, example: "65f1234567890abcdef77777" }
 *               categoryId: { type: string, example: "65f1234567890abcdef99999" }
 *               postcode: { type: string, example: "NW1" }
 *               level: { type: string, enum: [Area, District, Sector], example: "District" }
 *               notes: { type: string, example: "Exclusive agreement signed 2026-04-01." }
 *     responses:
 *       201:
 *         description: Exclusivity record created
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         description: Validation error, partner/category mismatch, or exclusivity already exists
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - { $ref: '#/components/schemas/ValidationErrorsResponse' }
 *                 - { $ref: '#/components/schemas/ErrorResponse' }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
/**
 * @openapi
 * /admin/exclusivity/{id}:
 *   delete:
 *     summary: Delete postcode exclusivity record
 *     tags: [Admin Exclusivity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message]
 *               properties:
 *                 message: { type: string, example: "Exclusivity record deleted" }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
