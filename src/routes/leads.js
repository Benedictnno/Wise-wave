const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const Lead = require('../models/Lead');
const Category = require('../models/Category');
const Introducer = require('../models/Introducer');
const { findMatchingPartner } = require('../services/routingEngine');
const { dispatchNotifications, notifyAdminUnassigned, sendLeadConfirmation } = require('../services/notificationEngine');
const { incrementIntroducerMonthlyCount } = require('../services/commissionService');
const { evaluateAnswers } = require('../services/questionnaireEngine');
const { v4: uuidv4 } = require('uuid');

/**
 * @openapi
 * /api/leads:
 *   post:
 *     summary: Submit a new lead
 *     description: Receives a new lead and triggers the routing engine. Supports direct category ID or questionnaire answers.
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, postcode]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               postcode:
 *                 type: string
 *               category:
 *                 type: string
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionKey: { type: string }
 *                     answerValues: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Lead received successfully
 */
router.post(
    '/',
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('phone').trim().notEmpty().withMessage('Phone is required'),
        body('postcode').trim().notEmpty().withMessage('Postcode is required'),
        body('category').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Valid category ID is required'),
        body('answers').optional({ nullable: true }).isArray(),
        body('description').optional().trim(),
        body('consentAccepted').isBoolean().withMessage('Consent must be accepted'),
        body('formSource').optional().isIn(['category_page', 'request_service']).withMessage('Invalid form source'),
    ],
    validate,
    async (req, res) => {
        try {
            const { name, email, phone, postcode, category, answers, description, introducer_id, consentAccepted, formSource } = req.body;

            if (!category && (!answers || answers.length === 0)) {
                return res.status(400).json({ error: 'Must provide either a category or questionnaire answers' });
            }

            let categoriesToProcess = [];

            if (category) {
                const categoryDoc = await Category.findById(category);
                if (!categoryDoc || !categoryDoc.isActive) {
                    return res.status(400).json({ error: 'Invalid or inactive category' });
                }
                categoriesToProcess.push(categoryDoc);
            }

            if (answers && answers.length > 0) {
                const generatedCategories = await evaluateAnswers(answers);
                for (const genCat of generatedCategories) {
                    if (!categoriesToProcess.find((c) => c._id.toString() === genCat._id.toString())) {
                        categoriesToProcess.push(genCat);
                    }
                }
            }

            if (categoriesToProcess.length === 0) {
                return res.status(400).json({ error: 'Answers did not match any active service categories' });
            }

            // Validate introducer if provided
            let validIntroducerId = null;
            if (introducer_id) {
                const introducer = await Introducer.findById(introducer_id);
                if (introducer && introducer.isActive) {
                    validIntroducerId = introducer._id;
                }
            }

            // Provide one monthly increment per submission
            if (validIntroducerId) {
                incrementIntroducerMonthlyCount(validIntroducerId).catch((err) =>
                    console.error('[Introducer Counter] Error:', err.message)
                );
            }

            const leadsCreated = [];
            for (const categoryDoc of categoriesToProcess) {
                // Determine form source — fallback if neither provided
                let source = formSource;
                if (!source) source = (answers && answers.length > 0) ? 'request_service' : 'category_page';

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
                    formSource: source,
                });
                leadsCreated.push({ lead, categoryDoc });
            }

            // Route all leads independently
            for (const { lead, categoryDoc } of leadsCreated) {
                const partner = await findMatchingPartner(categoryDoc._id, postcode);

                if (partner) {
                    lead.assignedPartnerId = partner._id;
                    lead.status = 'assigned';
                    lead.assignedAt = new Date();
                    lead.outcomeToken = uuidv4();
                    await lead.save();

                    dispatchNotifications(lead, partner, categoryDoc).catch((err) =>
                        console.error('[Notifications] Dispatch error:', err.message)
                    );
                } else {
                    console.log(`[Routing] No partner found for category=${categoryDoc.name} postcode=${postcode}`);
                    notifyAdminUnassigned(lead).catch((err) =>
                        console.error('[Admin notify] Error:', err.message)
                    );
                }
            }

            // Only send one confirmation email for the overall submission.
            // Using the first category/lead generated to pass to the email context 
            const primaryLeadInfo = leadsCreated[0];
            if (primaryLeadInfo) {
                sendLeadConfirmation(primaryLeadInfo.lead, primaryLeadInfo.categoryDoc).catch((err) =>
                    console.error('[Lead Confirm] Error:', err.message)
                );
            }

            return res.status(200).json({ message: "Thanks — we'll match you shortly." });
        } catch (err) {
            console.error('[POST /api/leads]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
