const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Lead = require('../models/Lead');
const LeadServiceAnswer = require('../models/LeadServiceAnswer');
const File = require('../models/File');
const LeadEvent = require('../models/LeadEvent');
const { scoreLead } = require('../services/scoringEngine');
const { routeLead } = require('../services/routingEngine');

router.post('/', async (req, res) => {
    try {
        const {
            fullName, email, phone, preferredContactMethod, homePostcode, propertyPostcode, bestTimeToContact, // Step 1
            serviceType, serviceSpecificQuestions, // Step 2
            additionalDetails, intentSignals, budget, urgency, howDidYouHear, fileUpload, // Step 3
            understandIntroducer, consentToShare, agreePrivacyPolicy // Step 4
        } = req.body;

        // Basic validation implementation (to be expanded in middleware)
        if (!fullName || !email || !phone || !serviceType || !consentToShare) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

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

        // Create Lead
        const lead = await Lead.create({
            user_id: user._id,
            service_type: serviceType,
            property_postcode: propertyPostcode || '',
            best_time_to_contact: bestTimeToContact,
            budget_band: budget,
            urgency: urgency,
            additional_details: additionalDetails,
            how_did_you_hear: howDidYouHear,
            status: 'new'
        });

        // Create LeadServiceAnswers
        if (serviceSpecificQuestions && typeof serviceSpecificQuestions === 'object') {
            const answers = Object.keys(serviceSpecificQuestions).map(key => ({
                lead_id: lead._id,
                question_key: key,
                question_label: key, // We can improve label mapping later
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
        }

        return res.status(201).json({
            message: "Thanks — we'll match you shortly.",
            leadId: lead._id,
            status: lead.status
        });

    } catch (err) {
        console.error('[POST /api/leads] Error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;