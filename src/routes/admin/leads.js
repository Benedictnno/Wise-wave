const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Lead = require('../../models/Lead');
const Partner = require('../../models/Partner');
const { dispatchNotifications } = require('../../services/notificationEngine');
const { v4: uuidv4 } = require('uuid');

router.use(authMiddleware);

/**
 * @openapi
 * /admin/leads/unassigned:
 *   get:
 *     summary: List unassigned leads
 *     description: Returns paginated leads with status `unassigned`.
 *     tags: [Admin Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
 *     responses:
 *       200:
 *         description: Paginated unassigned leads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [leads, total, page, limit]
 *               properties:
 *                 leads:
 *                   type: array
 *                   items: { type: object }
 *                 total: { type: integer, example: 25 }
 *                 page: { type: integer, example: 1 }
 *                 limit: { type: integer, example: 50 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /admin/leads/unassigned
router.get('/unassigned', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const leads = await Lead.find({ status: 'unassigned' })
            .populate('category', 'name')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));
        
        const total = await Lead.countDocuments({ status: 'unassigned' });
        return res.json({ leads, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/leads/{id}:
 *   get:
 *     summary: Get lead details (including answers/files/events)
 *     tags: [Admin Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead detail payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [lead, answers, files, events]
 *               properties:
 *                 lead: { type: object }
 *                 answers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       question_key: { type: string, example: "propertyValue" }
 *                       question_label: { type: string, example: "propertyValue" }
 *                       answer_value: { example: 450000 }
 *                 files:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       file_name: { type: string, example: "payslip.pdf" }
 *                       file_type: { type: string, example: "application/pdf" }
 *                       file_size: { type: integer, example: 123456 }
 *                       file_url: { type: string, example: "https://files.example.com/payslip.pdf" }
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       event_type: { type: string, example: "created" }
 *                       created_at: { type: string, format: date-time }
 *                       event_data: { type: object, additionalProperties: true }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /admin/leads/:id
router.get('/:id', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate('category', 'name')
            .populate('assignedPartnerId', 'companyName email status')
            .populate('current_partner_id', 'companyName email status')
            .populate('user_id')
            .populate('introducerId', 'name email');
            
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        
        const LeadServiceAnswer = require('../../models/LeadServiceAnswer');
        const File = require('../../models/File');
        const LeadEvent = require('../../models/LeadEvent');
        
        const answers = await LeadServiceAnswer.find({ lead_id: lead._id });
        const files = await File.find({ lead_id: lead._id });
        const events = await LeadEvent.find({ lead_id: lead._id }).sort({ created_at: -1 });

        return res.json({ 
            lead, 
            answers, 
            files, 
            events 
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/leads/{id}:
 *   delete:
 *     summary: GDPR hard delete (anonymize lead PII)
 *     description: Anonymizes personal fields but retains the lead record for operational/commission tracking.
 *     tags: [Admin Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead anonymized
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message]
 *               properties:
 *                 message: { type: string, example: "Lead personal data has been erased per GDPR" }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// DELETE /admin/leads/:id - GDPR Hard Delete (Anonymize)
router.delete('/:id', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        
        // GDPR approach: Anonymize data but keep the record for commission tracking
        lead.name = 'GDPR Deleted';
        lead.email = 'deleted@deleted.invalid';
        lead.phone = '00000000000';
        lead.companyName = '';
        lead.description = '[Erased per GDPR request]';
        lead.qualificationAnswers = [];
        lead.postcode = 'REDACTED';
        
        await lead.save();
        return res.json({ message: 'Lead personal data has been erased per GDPR' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * @openapi
 * /admin/leads/{id}/notes:
 *   patch:
 *     summary: Update admin notes on a lead
 *     tags: [Admin Leads]
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
 *             required: [adminNotes]
 *             properties:
 *               adminNotes: { type: string, maxLength: 2000, example: "Spoke to lead, warm transfer expected." }
 *     responses:
 *       200:
 *         description: Updated lead document
 *         content:
 *           application/json:
 *             schema: { type: object }
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
// PATCH /admin/leads/:id/notes
router.patch('/:id/notes',
    [body('adminNotes').trim().notEmpty().isLength({ max: 2000 })],
    validate,
    async (req, res) => {
        try {
            const lead = await Lead.findByIdAndUpdate(
                req.params.id,
                { adminNotes: req.body.adminNotes },
                { returnDocument: 'after' }
            );
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            return res.json(lead);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

/**
 * @openapi
 * /admin/leads/{id}/outcome:
 *   patch:
 *     summary: Set outcome on a lead (admin override)
 *     description: Applies the same outcome processing as the partner secure link flow.
 *     tags: [Admin Leads]
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
 *             required: [outcome]
 *             properties:
 *               outcome: { type: string, enum: [won, lost, not_suitable] }
 *               partnerFee: { type: number, example: 2500 }
 *               notes: { type: string, example: "Admin manual conversion" }
 *     responses:
 *       200:
 *         description: Outcome applied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, data]
 *               properties:
 *                 message: { type: string, example: "Outcome set" }
 *                 data: { type: object }
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
// PATCH /admin/leads/:id/outcome
router.patch('/:id/outcome',
    [
        body('outcome').isIn(['won', 'lost', 'not_suitable']),
        body('partnerFee').optional().isFloat({ min: 0 }),
        body('notes').optional().trim(),
    ],
    validate,
    async (req, res) => {
        try {
            const lead = await Lead.findById(req.params.id).populate('category');
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            
            const { processPartnerResponse } = require('../../services/partnerResponseService');
            const result = await processPartnerResponse(
                lead, 
                req.body.outcome, 
                req.body.partnerFee,
                req.body.notes || 'Admin manual conversion'
            );
            return res.json({ message: 'Outcome set', data: result });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

/**
 * @openapi
 * /admin/leads:
 *   get:
 *     summary: List leads (with filters)
 *     tags: [Admin Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string, description: "Category MongoDB id" }
 *       - in: query
 *         name: outcome
 *         schema: { type: string, enum: [won, lost, not_suitable] }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, minimum: 1, maximum: 200 }
 *     responses:
 *       200:
 *         description: Paginated leads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [leads, total, page, limit]
 *               properties:
 *                 leads: { type: array, items: { type: object } }
 *                 total: { type: integer }
 *                 page: { type: integer }
 *                 limit: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /admin/leads
router.get('/', async (req, res) => {
    try {
        const { status, category, outcome, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (typeof status === 'string') filter.status = status;
        if (typeof category === 'string') filter.category = category;
        if (typeof outcome === 'string') filter.outcome = outcome;
        
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
            if (dateTo) filter.createdAt.$lte = new Date(dateTo);
        }

        const leads = await Lead.find(filter)
            .populate('category', 'name')
            .populate('assignedPartnerId', 'companyName email')
            .populate('introducerId', 'name email')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));

        const total = await Lead.countDocuments(filter);
        return res.json({ leads, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /admin/leads/:id/assign
 * Manually assign or RE-ASSIGN a lead to a partner.
 * Resets outcome token and sets a fresh 7-day expiry.
 */
/**
 * @openapi
 * /admin/leads/{id}/assign:
 *   patch:
 *     summary: Assign (or reassign) a lead to a partner
 *     description: Sets assigned partner, resets outcome, and generates a new 7-day outcome token.
 *     tags: [Admin Leads]
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
 *             required: [partnerId]
 *             properties:
 *               partnerId: { type: string, example: "65f1234567890abcdef77777" }
 *     responses:
 *       200:
 *         description: Lead assigned and notification dispatched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message, lead]
 *               properties:
 *                 message: { type: string, example: "Lead assigned and notified" }
 *                 lead: { type: object }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Lead or partner not found
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
    '/:id/assign',
    [body('partnerId').isMongoId().withMessage('Valid partner ID required')],
    validate,
    async (req, res) => {
        try {
            const partner = await Partner.findById(req.body.partnerId);
            if (!partner) return res.status(404).json({ error: 'Partner not found' });

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 7);

            const lead = await Lead.findByIdAndUpdate(
                req.params.id,
                { 
                    assignedPartnerId: partner._id, 
                    status: 'assigned',
                    assignedAt: new Date(),
                    outcomeToken: uuidv4(),
                    outcomeTokenExpiry: expiryDate,
                    outcome: null // reset outcome if re-assigning
                },
                { returnDocument: 'after' }
            ).populate('category');

            if (!lead) return res.status(404).json({ error: 'Lead not found' });

            // Trigger notification to the NEW partner
            dispatchNotifications(lead, partner, lead.category).catch(e => console.error(e));

            return res.json({ message: 'Lead assigned and notified', lead });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

/**
 * POST /admin/leads/:id/resend
 * Manually trigger a resend of the introduction notification.
 */
/**
 * @openapi
 * /admin/leads/{id}/resend:
 *   post:
 *     summary: Resend the partner introduction notification
 *     tags: [Admin Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Resend triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message]
 *               properties:
 *                 message: { type: string, example: "Resend triggered" }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:id/resend', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate('category')
            .populate('subservices', 'name');
        if (!lead || !lead.assignedPartnerId) {
            return res.status(400).json({ error: 'Lead must be assigned to a partner to resend' });
        }

        const partner = await Partner.findById(lead.assignedPartnerId);
        if (!partner) return res.status(404).json({ error: 'Assigned partner no longer exists' });

        // Trigger dispatch logic (handles retries/backups internally)
        dispatchNotifications(lead, partner, lead.category).catch(e => console.error(e));

        return res.json({ message: 'Resend triggered' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
