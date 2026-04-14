const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const validate = require('../middleware/validate');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Category = require('../models/Category');
const LeadServiceAnswer = require('../models/LeadServiceAnswer');
const File = require('../models/File');
const LeadEvent = require('../models/LeadEvent');
const { scoreLead } = require('../services/scoringEngine');
const { routeLead } = require('../services/routingEngine');
const { sendLeadConfirmation } = require('../services/notificationEngine');
const { generateReferenceId } = require('../services/referenceId');
const { v4: uuidv4 } = require('uuid');

/**
 * @openapi
 * /api/leads:
 *   post:
 *     summary: Submit a lead
 *     description: >
 *       Creates (or reuses) a user, stores a lead submission, scores it, and attempts routing to a partner.
 *       This endpoint is rate-limited.
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LeadSubmissionRequest'
 *           examples:
 *             basic:
 *               summary: Typical lead submission
 *               value:
 *                 fullName: "Jane Smith"
 *                 email: "jane@example.com"
 *                 phone: "07700123456"
 *                 preferredContactMethod: "either"
 *                 homePostcode: "SW1A 1AA"
 *                 propertyPostcode: "SW1A 2AA"
 *                 bestTimeToContact: "anytime"
 *                 serviceType: "Mortgage Broker"
 *                 serviceSpecificQuestions:
 *                   hasExistingMortgage: true
 *                   propertyValue: 450000
 *                 additionalDetails: "Looking for advice on a remortgage in the next 4–8 weeks."
 *                 intentSignals:
 *                   page: "mortgage"
 *                   source: "google"
 *                 budget: "not_sure"
 *                 urgency: "1_2_months"
 *                 howDidYouHear: "google"
 *                 fileUpload:
 *                   - fileName: "payslip.pdf"
 *                     fileType: "application/pdf"
 *                     fileSize: 123456
 *                     fileUrl: "https://files.example.com/payslip.pdf"
 *                 understandIntroducer: true
 *                 consentToShare: true
 *                 agreePrivacyPolicy: true
 *                 honeypot: ""
 *     responses:
 *       201:
 *         description: Lead created and queued for matching
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LeadSubmissionResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
    '/',
    [
        // A.1 User Details
        body('fullName').trim().notEmpty().withMessage('Full name is required'),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('phone').trim().notEmpty().withMessage('Phone number is required'),
        body('preferredContactMethod').isIn(['phone', 'email', 'either']).withMessage('Invalid contact method'),
        body('homePostcode').trim().notEmpty().withMessage('Postcode is required'),
        body('bestTimeToContact').isIn(['morning', 'afternoon', 'evening', 'anytime']),
        
        // A.2 Service
        body('serviceType').trim().notEmpty().withMessage('Valid service type is required'),
        body('serviceSpecificQuestions').optional().isObject(),
        
        // A.3 Additional Info
        body('additionalDetails').isString().isLength({ min: 5 }).withMessage('Must be at least 5 characters'),
        body('budget').isIn(['5000_plus', '1000_4999', '500_999', '1_499', 'not_sure']),
        body('urgency').isIn(['asap', '48_hours', '1_week', '1_2_months', '3_plus_months', 'researching']),
        body('howDidYouHear').isIn(['estate_agent', 'google', 'social', 'referral', 'other']),
        body('fileUpload').optional().isArray(),

        // A.4 Compliance
        body('understandIntroducer').isBoolean().custom(v => v === true).withMessage('Must understand introducer model'),
        body('consentToShare').isBoolean().custom(v => v === true).withMessage('Consent is required'),
        body('agreePrivacyPolicy').isBoolean().custom(v => v === true).withMessage('Privacy policy agreement is required'),
        
        // QA G.4 bot protection
        body('honeypot').custom(val => !val || val === '').withMessage('Bot detected'),
        body('recaptchaToken').optional().isString() // Assume verified by middleware later
    ],
    validate,
    async (req, res) => {
        try {
            const {
                fullName, email, phone, preferredContactMethod, homePostcode, propertyPostcode, bestTimeToContact, // Step 1
                serviceType, serviceSpecificQuestions, // Step 2
                additionalDetails, intentSignals, budget, urgency, howDidYouHear, fileUpload, // Step 3
                understandIntroducer, consentToShare, agreePrivacyPolicy // Step 4
            } = req.body;

            // STEP 1 - Form Submission

            // Create or find User
            let user = await User.findOne({ email: email.toLowerCase() });
            if (!user) {
                user = await User.create({
                    full_name: fullName,
                    email: email,
                    phone: phone,
                    preferred_contact_method: preferredContactMethod,
                    home_postcode: homePostcode
                });
            }

            // Verify Category ID / Service ID alignment (stubbed lookup if needed)
            // Some old logic expects lead.category to be set to the ObjectId of Category
            let catObj = await Category.findOne({ name: serviceType });
            if (!catObj) catObj = await Category.findOne(); // Fallback if name mapping fails

            // 3. Generate Reference ID
            const referenceId = await generateReferenceId('WMC');

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7);

            // Create Lead
            const lead = await Lead.create({
                user_id: user._id,
                referenceId: referenceId,
                name: fullName,       // Mapping legacy
                email: email,         // Mapping legacy
                phone: phone,         // Mapping legacy
                category: catObj ? catObj._id : null,
                description: additionalDetails, // Mapping legacy
                service_type: serviceType,
                property_postcode: propertyPostcode || homePostcode || '',
                best_time_to_contact: bestTimeToContact,
                budget_band: budget,
                urgency: urgency,
                additional_details: additionalDetails,
                how_did_you_hear: howDidYouHear,
                status: 'new',
                outcomeToken: uuidv4(),
                outcomeTokenExpiry: expiryDate
            });

            // Create LeadServiceAnswers
            if (serviceSpecificQuestions && typeof serviceSpecificQuestions === 'object') {
                const answers = Object.keys(serviceSpecificQuestions).map(key => ({
                    lead_id: lead._id,
                    question_key: key,
                    question_label: key, // Can map to actual human readable strings here later
                    answer_value: serviceSpecificQuestions[key]
                }));
                if (answers.length > 0) {
                    await LeadServiceAnswer.insertMany(answers);
                }
            }

            // Create Files
            if (fileUpload && Array.isArray(fileUpload) && fileUpload.length > 0) {
                const files = fileUpload.map(f => ({
                    lead_id: lead._id,
                    file_name: f.fileName,
                    file_type: f.fileType || 'application/octet-stream',
                    file_size: f.fileSize || 0,
                    file_url: f.fileUrl
                }));
                await File.insertMany(files);
            }

            // Log Event
            await LeadEvent.create({
                lead_id: lead._id,
                event_type: 'created',
                event_data: { 
                    intentSignals, 
                    understandIntroducer, 
                    consentToShare, 
                    agreePrivacyPolicy 
                }
            });

            // STEP 2 - Scoring
            const scoreResult = await scoreLead(lead, req.body);
            lead.lead_score = scoreResult.leadScore;
            lead.lead_category = scoreResult.leadCategory;
            lead.red_flags = scoreResult.redFlags;
            if (scoreResult.redFlags && scoreResult.redFlags.length > 0) {
                lead.status = 'manual_review';
            }
            await lead.save();
            await LeadEvent.create({ lead_id: lead._id, event_type: 'scored', event_data: scoreResult });

            // STEP 3 - Routing
            if (lead.status !== 'manual_review') {
                await routeLead(lead);

                // Send confirmation to the customer
                sendLeadConfirmation(lead, catObj).catch(err => 
                    console.error(`[Submitter Confirm] Email error for ${referenceId}:`, err.message)
                );
            }

            return res.status(201).json({
                message: "Thanks — we'll match you shortly.",
                leadId: lead._id,
                referenceId: lead.referenceId,
                status: lead.status
            });

        } catch (err) {
            console.error('[POST /api/leads] Error:', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
