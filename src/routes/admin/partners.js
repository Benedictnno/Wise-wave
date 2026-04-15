const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Partner = require('../../models/Partner');

router.use(authMiddleware);

/**
 * @openapi
 * /admin/partners:
 *   get:
 *     summary: List partners
 *     description: Returns partners sorted by priority (lower = higher priority).
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Partner list
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
// GET /admin/partners
router.get('/', async (req, res) => {
    try {
        const partners = await Partner.find().sort({ priority: 1 });
        return res.json(partners);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/partners/{id}:
 *   get:
 *     summary: Get single partner details
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Partner details
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
        const partner = await Partner.findById(req.params.id)
            .populate('categories', 'name externalId')
            .populate('subservices', 'name slug');
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        return res.json(partner);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/partners/{id}:
 *   delete:
 *     summary: Permanently delete a partner
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Partner deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message]
 *               properties:
 *                 message: { type: string, example: "Partner deleted successfully" }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/:id', async (req, res) => {
    try {
        const partner = await Partner.findByIdAndDelete(req.params.id);
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        
        // Cleanup PostcodeExclusivity
        const PostcodeExclusivity = require('../../models/PostcodeExclusivity');
        await PostcodeExclusivity.deleteMany({ partnerId: req.params.id });
        
        return res.json({ message: 'Partner deleted successfully' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/partners:
 *   post:
 *     summary: Create a partner
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [companyName, contactName, email, phone, preferredContactMethod, backupDeliveryMethod, priority]
 *             properties:
 *               companyName: { type: string, example: "Acme Finance Ltd" }
 *               contactName: { type: string, example: "John Doe" }
 *               email: { type: string, format: email, example: "john@acmefinance.co.uk" }
 *               phone: { type: string, example: "07700123456" }
 *               whatsappNumber: { type: string, example: "447700123456" }
 *               preferredContactMethod: { type: string, enum: [email, sms, whatsapp], example: "email" }
 *               backupDeliveryMethod: { type: string, enum: [email, sms, whatsapp], example: "sms" }
 *               priority: { type: integer, minimum: 1, example: 10 }
 *               status: { type: string, enum: [active, inactive, pending], example: "active" }
 *     responses:
 *       201:
 *         description: Partner created
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// POST /admin/partners
router.post(
    '/',
    [
        body('companyName').trim().notEmpty(),
        body('contactName').trim().notEmpty(),
        body('email').isEmail().normalizeEmail(),
        body('phone').trim().notEmpty(),
        body('preferredContactMethod').isIn(['email', 'sms', 'whatsapp']),
        body('backupDeliveryMethod').isIn(['email', 'sms', 'whatsapp']),
        body('priority').isInt({ min: 1 }),
    ],
    validate,
    async (req, res) => {
        try {
            const partner = await Partner.create({
                ...req.body,
                agreementAccepted: true,
                agreementTimestamp: new Date()
            });
            return res.status(201).json(partner);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

/**
 * @openapi
 * /admin/partners/{id}:
 *   put:
 *     summary: Update a partner
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Partial partner update payload. Fields are validated by the model where applicable.
 *     responses:
 *       200:
 *         description: Partner updated
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
// PUT /admin/partners/:id
router.put('/:id', async (req, res) => {
    try {
        const partner = await Partner.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after', runValidators: true });
        if (!partner) return res.status(404).json({ error: 'Partner not found' });
        return res.json(partner);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/partners/{id}/status:
 *   patch:
 *     summary: Update partner status
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [active, inactive, pending] }
 *     responses:
 *       200:
 *         description: Status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, partner]
 *               properties:
 *                 message: { type: string, example: "Partner status updated" }
 *                 partner: { type: object }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// PATCH /admin/partners/:id/status
router.patch(
    '/:id/status',
    [
        body('status').isIn(['active', 'inactive', 'pending']).withMessage('Status must be active, inactive, or pending')
    ],
    validate,
    async (req, res) => {
        try {
            const partner = await Partner.findByIdAndUpdate(
                req.params.id,
                { status: req.body.status, updatedAt: new Date() },
                { returnDocument: 'after', runValidators: true }
            );
            if (!partner) return res.status(404).json({ error: 'Partner not found' });
            return res.status(200).json({ message: 'Partner status updated', partner });
        } catch (err) {
            console.error('[PATCH /admin/partners/:id/status]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/**
 * @openapi
 * /admin/partners/{id}/subservices:
 *   get:
 *     summary: View partner subservices (R&D)
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id/subservices', async (req, res) => {
    try {
        const partner = await Partner.findById(req.params.id).populate('subservices', 'name slug');
        if (!partner) return res.status(404).json({ error: 'Not found' });
        return res.json(partner.subservices);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/partners/{id}/subservices:
 *   put:
 *     summary: Edit partner subservices
 *     tags: [Admin Partners]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id/subservices',
    [body('subservices').isArray()],
    validate,
    async (req, res) => {
        try {
            const Subservice = require('../../models/Subservice');
            const valid = await Subservice.find({ _id: { $in: req.body.subservices } });
            
            if (valid.length !== req.body.subservices.length) {
                return res.status(400).json({ error: 'One or more subservice IDs are invalid' });
            }
            
            const partner = await Partner.findByIdAndUpdate(
                req.params.id,
                { subservices: req.body.subservices },
                { returnDocument: 'after' }
            ).populate('subservices', 'name slug');
            
            if (!partner) return res.status(404).json({ error: 'Not found' });
            return res.json(partner);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;
