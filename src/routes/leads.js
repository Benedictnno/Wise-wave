const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const Lead = require('../models/Lead');
const Category = require('../models/Category');
const Introducer = require('../models/Introducer');
const { findMatchingPartner } = require('../services/routingEngine');
const { dispatchNotifications, notifyAdminUnassigned } = require('../services/notificationEngine');

/**
 * @openapi
 * /api/leads:
 *   post:
 *     summary: Submit a new lead
 *     description: Receives a new lead from consumer, SME, or introducer forms and triggers the routing engine.
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - postcode
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Jane Smith"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane@example.com"
 *               phone:
 *                 type: string
 *                 example: "07700123456"
 *               postcode:
 *                 type: string
 *                 example: "SW1A 1AA"
 *               category:
 *                 type: string
 *                 description: MongoDB ID of the category
 *                 example: "65f1234567890abcdef12345"
 *               description:
 *                 type: string
 *                 example: "Looking for a mortgage adviser"
 *               introducer_id:
 *                 type: string
 *                 description: Optional MongoDB ID of the introducer
 *                 example: "65f0987654321fedcba09876"
 *     responses:
 *       200:
 *         description: Lead received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Thanks — we'll match you shortly."
 *       400:
 *         description: Invalid input or inactive category
 *       500:
 *         description: Internal server error
 */
// POST /api/leads
router.post(
    '/',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('phone').trim().notEmpty().withMessage('Phone is required'),
        body('postcode').trim().notEmpty().withMessage('Postcode is required'),
        body('category').isMongoId().withMessage('Valid category ID is required'),
        body('description').optional().trim(),
        body('consentAccepted').isBoolean().withMessage('Consent must be accepted'),
        body('formSource').isIn(['category_page', 'request_service']).withMessage('Invalid form source'),
    ],
    validate,
    async (req, res) => {
        try {
            const { name, email, phone, postcode, category, description, introducer_id, consentAccepted, formSource } = req.body;

            // Validate category exists
            const categoryDoc = await Category.findById(category);
            if (!categoryDoc || !categoryDoc.isActive) {
                return res.status(400).json({ error: 'Invalid or inactive category' });
            }

            // Validate introducer if provided
            let validIntroducerId = null;
            if (introducer_id) {
                const introducer = await Introducer.findById(introducer_id);
                if (introducer && introducer.isActive) {
                    validIntroducerId = introducer._id;
                }
            }

            // Store the lead immediately (every lead must be stored — even unassigned)
            const lead = await Lead.create({
                name,
                email,
                phone,
                postcode: postcode.toUpperCase().trim(),
                category: categoryDoc._id,
                description: description || '',
                introducerId: validIntroducerId,
                status: 'unassigned',
                consentAccepted: consentAccepted === true || consentAccepted === 'true',
                consentTimestamp: new Date(),
                formSource: formSource || 'request_service',
            });

            // Run routing engine
            const { v4: uuidv4 } = require('uuid');
            const partner = await findMatchingPartner(categoryDoc._id, postcode);

            if (partner) {
                lead.assignedPartnerId = partner._id;
                lead.status = 'assigned';
                lead.assignedAt = new Date();
                lead.outcomeToken = uuidv4();
                await lead.save();

                // Dispatch notifications (non-blocking — don't fail the response if notifications fail)
                dispatchNotifications(lead, partner, categoryDoc).catch((err) =>
                    console.error('[Notifications] Dispatch error:', err.message)
                );
            } else {
                // No partner — lead stays unassigned, notify admin
                console.log(`[Routing] No partner found for category=${categoryDoc.name} postcode=${postcode}`);
                notifyAdminUnassigned(lead).catch((err) =>
                    console.error('[Admin notify] Error:', err.message)
                );
            }

            // Always return the same confirmation regardless of routing outcome
            return res.status(200).json({ message: "Thanks — we'll match you shortly." });
        } catch (err) {
            console.error('[POST /api/leads]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
