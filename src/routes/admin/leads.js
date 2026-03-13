const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Lead = require('../../models/Lead');

// All routes require JWT auth
router.use(authMiddleware);

/**
 * @openapi
 * /admin/leads:
 *   get:
 *     summary: List all leads with filters
 *     description: Returns a paginated list of leads. Supports filtering by status and category. Requires admin authentication.
 *     tags: [Admin Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [assigned, unassigned] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated leads list
 */
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

/**
 * @openapi
 * /admin/leads/unassigned:
 *   get:
 *     summary: Get unassigned leads
 *     description: Returns only leads that haven't been assigned to a partner yet.
 *     tags: [Admin Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of unassigned leads
 */
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

/**
 * @openapi
 * /admin/leads/{id}:
 *   get:
 *     summary: Get lead details
 *     description: Returns full details of a lead, including populated category and partner info.
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
 *         description: Lead details
 *       404:
 *         description: Lead not found
 */
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

/**
 * @openapi
 * /admin/leads/{id}/assign:
 *   patch:
 *     summary: Manually assign lead to partner
 *     description: Assigns a lead to a specific partner ID. Changes status to 'assigned'.
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
 *               partnerId: { type: string }
 *     responses:
 *       200:
 *         description: Lead assigned
 */
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

/**
 * @openapi
 * /admin/leads/{id}/notes:
 *   patch:
 *     summary: Update admin notes on lead
 *     description: Adds or updates internal administration notes for a lead.
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
 *               adminNotes: { type: string }
 *     responses:
 *       200:
 *         description: Notes updated
 */
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

/**
 * @openapi
 * /admin/leads/{id}:
 *   delete:
 *     summary: Delete lead (GDPR)
 *     description: Permanently deletes a lead for GDPR compliance.
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
 *         description: Lead deleted
 */
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
