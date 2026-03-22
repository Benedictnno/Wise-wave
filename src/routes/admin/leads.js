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

// GET /admin/leads
router.get('/', async (req, res) => {
    try {
        const { status, category, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (category) filter.category = category;

        const leads = await Lead.find(filter)
            .populate('category', 'name')
            .populate('assignedPartnerId', 'companyName email')
            .populate('introducerId', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
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
        const lead = await Lead.findById(req.params.id).populate('category');
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
