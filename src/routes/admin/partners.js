const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Partner = require('../../models/Partner');

// All routes require JWT auth
router.use(authMiddleware);

/**
 * @openapi
 * /admin/partners:
 *   get:
 *     summary: List all partners
 *     description: Returns a complete list of partners sorted by priority. Requires admin authentication.
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of partners
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
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

/**
 * @openapi
 * /admin/partners/{id}:
 *   get:
 *     summary: Get partner by ID
 *     description: Returns details of a single partner. Requires admin authentication.
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner details
 *       404:
 *         description: Partner not found
 */
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

/**
 * @openapi
 * /admin/partners:
 *   post:
 *     summary: Create a new partner
 *     description: Creates a new service provider partner. Requires admin authentication.
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, categories, postcodes, priority]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               whatsappNumber:
 *                 type: string
 *               categories:
 *                 type: array
 *                 items: { type: string }
 *               postcodes:
 *                 type: array
 *                 items: { type: string }
 *               priority:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       201:
 *         description: Partner created
 *       400:
 *         description: Validation error
 */
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

/**
 * @openapi
 * /admin/partners/{id}:
 *   put:
 *     summary: Update a partner
 *     description: Updates an existing partner's details. Requires admin authentication.
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Partner updated
 *       404:
 *         description: Partner not found
 */
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

/**
 * @openapi
 * /admin/partners/{id}/status:
 *   patch:
 *     summary: Update partner status
 *     description: Activates or deactivates a partner. Requires admin authentication.
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Status updated
 */
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

/**
 * @openapi
 * /admin/partners/{id}:
 *   delete:
 *     summary: Delete a partner
 *     description: Permanently deletes a partner from the system. Requires admin authentication.
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Partner deleted
 */
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
