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

// GET /admin/leads/:id
router.get('/:id', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate('category', 'name')
            .populate('assignedPartnerId', 'companyName email status')
            .populate('introducerId', 'name email');
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        return res.json(lead);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

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
        lead.postcode = lead.postcode.substring(0, 4).trim() + '***';
        
        await lead.save();
        return res.json({ message: 'Lead personal data has been erased per GDPR' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// PATCH /admin/leads/:id/notes
router.patch('/:id/notes',
    [body('adminNotes').trim().notEmpty().isLength({ max: 2000 })],
    validate,
    async (req, res) => {
        try {
            const lead = await Lead.findByIdAndUpdate(
                req.params.id,
                { adminNotes: req.body.adminNotes },
                { new: true }
            );
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            return res.json(lead);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

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

// GET /admin/leads
router.get('/', async (req, res) => {
    try {
        const { status, category, outcome, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (category) filter.category = category;
        if (outcome) filter.outcome = outcome;
        
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
                { new: true }
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

// PATCH /admin/leads/:id/notes
router.patch(
    '/:id/notes',
    [body('adminNotes').trim().notEmpty()],
    validate,
    async (req, res) => {
        try {
            const lead = await Lead.findByIdAndUpdate(req.params.id, { adminNotes: req.body.adminNotes }, { new: true });
            return res.json(lead);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;
