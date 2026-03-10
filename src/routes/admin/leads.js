const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Lead = require('../../models/Lead');

// All routes require JWT auth
router.use(authMiddleware);

// GET /admin/leads — all leads
router.get('/', async (req, res) => {
    try {
        const { status, category, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (category) filter.category = category;

        const leads = await Lead.find(filter)
            .populate('category', 'name')
            .populate('assignedPartnerId', 'name email')
            .populate('introducerId', 'name email')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Lead.countDocuments(filter);
        return res.status(200).json({ leads, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error('[GET /admin/leads]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/leads/unassigned
router.get('/unassigned', async (req, res) => {
    try {
        const leads = await Lead.find({ status: 'unassigned' })
            .populate('category', 'name')
            .sort({ createdAt: -1 });
        return res.status(200).json(leads);
    } catch (err) {
        console.error('[GET /admin/leads/unassigned]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /admin/leads/:id
router.get('/:id', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id)
            .populate('category', 'name commissionType commissionValue isRegulated')
            .populate('assignedPartnerId', 'name email phone')
            .populate('introducerId', 'name email');
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        return res.status(200).json(lead);
    } catch (err) {
        console.error('[GET /admin/leads/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /admin/leads/:id/assign — manually assign a partner
router.patch(
    '/:id/assign',
    [body('partnerId').isMongoId().withMessage('Valid partner ID required')],
    validate,
    async (req, res) => {
        try {
            const lead = await Lead.findByIdAndUpdate(
                req.params.id,
                { assignedPartnerId: req.body.partnerId, status: 'assigned' },
                { new: true }
            ).populate('assignedPartnerId', 'name email');
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            return res.status(200).json({ message: 'Lead assigned', lead });
        } catch (err) {
            console.error('[PATCH /admin/leads/:id/assign]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// PATCH /admin/leads/:id/notes — add admin notes
router.patch(
    '/:id/notes',
    [body('adminNotes').trim().notEmpty().withMessage('Notes are required')],
    validate,
    async (req, res) => {
        try {
            const lead = await Lead.findByIdAndUpdate(
                req.params.id,
                { adminNotes: req.body.adminNotes },
                { new: true }
            );
            if (!lead) return res.status(404).json({ error: 'Lead not found' });
            return res.status(200).json({ message: 'Notes updated', lead });
        } catch (err) {
            console.error('[PATCH /admin/leads/:id/notes]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// DELETE /admin/leads/:id — GDPR deletion
router.delete('/:id', async (req, res) => {
    try {
        const lead = await Lead.findByIdAndDelete(req.params.id);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        return res.status(200).json({ message: 'Lead deleted (GDPR)' });
    } catch (err) {
        console.error('[DELETE /admin/leads/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
