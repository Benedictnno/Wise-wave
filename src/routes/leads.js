const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const Lead = require('../models/Lead');
const Category = require('../models/Category');
const Introducer = require('../models/Introducer');
const { findMatchingPartner } = require('../services/routingEngine');
const { dispatchNotifications, notifyAdminUnassigned } = require('../services/notificationEngine');

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
        body('introducer_id').optional().isMongoId().withMessage('Invalid introducer ID'),
    ],
    validate,
    async (req, res) => {
        try {
            const { name, email, phone, postcode, category, description, introducer_id } = req.body;

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
            });

            // Run routing engine
            const partner = await findMatchingPartner(categoryDoc._id, postcode);

            if (partner) {
                lead.assignedPartnerId = partner._id;
                lead.status = 'assigned';
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
