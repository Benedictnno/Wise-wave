const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const Lead = require('../models/Lead');
const Category = require('../models/Category');
const { findMatchingPartner } = require('../services/routingEngine');
const { dispatchNotifications, notifyAdminUnassigned, sendLeadConfirmation } = require('../services/notificationEngine');
const { v4: uuidv4 } = require('uuid');

/**
 * @openapi
 * /api/leads:
 *   post:
 *     summary: Submit a new service request lead
 *     description: >
 *       Receives user contact info and service requirements, finds the best matching partner,
 *       and triggers the notification engine.
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, postcode, category, consentAccepted]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               postcode: { type: string }
 *               category: { type: string, description: "Category MongoDB ID" }
 *               subservices: { type: array, items: { type: string }, description: "Array of Subservice IDs" }
 *               description: { type: string }
 *               introducerId: { type: string, description: "Introducer MongoDB ID (optional)" }
 *               consentAccepted: { type: boolean }
 *               formSource: { type: string, enum: ['category_page', 'request_service', 'introducer_form', 'qualification_flow'] }
 *     responses:
 *       201:
 *         description: Lead received successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 referenceId: { type: string }
 *       400:
 *         description: Validation error or missing data
 *       500:
 *         description: Server error
 */
router.post(
    '/',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('phone').trim().notEmpty().withMessage('Phone number is required'),
        body('postcode').trim().notEmpty().withMessage('Postcode is required'),
        body('category').isMongoId().withMessage('Valid category ID is required'),
        body('subservices').optional().isArray(),
        body('consentAccepted').isBoolean().custom(val => val === true).withMessage('Consent must be accepted'),
        body('formSource').optional().isIn(['category_page', 'request_service', 'introducer_form', 'qualification_flow']),
    ],
    validate,
    async (req, res) => {
        try {
            const { name, email, phone, postcode, category: categoryId, subservices, description, introducerId, formSource } = req.body;

            // 1. Verify Category
            const category = await Category.findById(categoryId);
            if (!category || !category.isActive) {
                return res.status(400).json({ error: 'Invalid or inactive category' });
            }

            // 2. Duplicate Check (H-7: Prevent same person submitting same category within 24h)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const duplicate = await Lead.findOne({
                email: email.toLowerCase(),
                category: categoryId,
                createdAt: { $gte: twentyFourHoursAgo }
            });

            if (duplicate) {
                return res.status(200).json({ 
                    message: "Thanks — we’ll match you shortly.", 
                    referenceId: duplicate.referenceId,
                    note: 'Duplicate submission caught within 24h window'
                });
            }

            // 3. Generate Reference ID
            const crypto = require('crypto');
            const referenceId = `WM-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

            // 4. Partner Matching
            const partner = await findMatchingPartner(category, postcode, subservices);

            // 5. Create Lead Record
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7);

            const leadData = {
                referenceId,
                name,
                email,
                phone,
                postcode: postcode.toUpperCase().trim(),
                category: categoryId,
                subservices: subservices || [],
                description,
                introducerId: introducerId || null,
                consentAccepted: true,
                consentTimestamp: new Date(),
                formSource: formSource || 'request_service',
                status: partner ? 'assigned' : 'unassigned',
                assignedPartnerId: partner ? partner._id : null,
                assignedAt: partner ? new Date() : null,
                outcomeToken: uuidv4(),
                outcomeTokenExpiry: expiryDate
            };

            const lead = await Lead.create(leadData);

            // 6. Trigger Notifications (Fire & Forget)
            if (partner) {
                dispatchNotifications(lead, partner, category).catch(err => 
                    console.error(`[Lead Notification] Error for ${referenceId}:`, err.message)
                );
            } else {
                notifyAdminUnassigned(lead).catch(err => 
                    console.error(`[Admin Notify] Unassigned lead alert error for ${referenceId}:`, err.message)
                );
            }

            // 7. Submitter Confirmation Email
            sendLeadConfirmation(lead, category).catch(err => 
                console.error(`[Submitter Confirm] Email error for ${referenceId}:`, err.message)
            );

            return res.status(201).json({
                message: "Thanks — we’ll match you shortly.",
                referenceId
            });

        } catch (err) {
            console.error('[POST /api/leads] Error:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;