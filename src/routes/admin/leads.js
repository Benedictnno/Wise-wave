const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Lead = require('../../models/Lead');
const Commission = require('../../models/Commission');
const Invoice = require('../../models/Invoice');

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
            .populate('assignedPartnerId', 'companyName email')
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
            .populate('assignedPartnerId', 'companyName email phone')
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
            ).populate('assignedPartnerId', 'companyName email');
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
 * /admin/leads/{id}/erase:
 *   patch:
 *     summary: GDPR right to erasure — anonymise lead personal data
 *     description: >
 *       Anonymises personal identifiers on a lead (name, email, phone) to comply with
 *       GDPR right-to-erasure requests. The lead row is retained for audit and commission
 *       integrity. Commission and Invoice records are not altered since they contain no PII.
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
 *         description: Lead anonymised
 *       404:
 *         description: Lead not found
 */
// PATCH /admin/leads/:id/erase — GDPR right to erasure
router.patch('/:id/erase', async (req, res) => {
    try {
        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        // Anonymise PII fields in place — preserve the record for audit trail
        lead.name = '[REDACTED]';
        lead.email = `redacted-${lead._id}@wisemove.internal`;
        lead.phone = '[REDACTED]';
        lead.description = '[REDACTED]';
        lead.consentAccepted = false;
        lead.adminNotes = (lead.adminNotes || '') + '\n[GDPR erasure applied]';
        await lead.save();

        console.log(`[GDPR] Lead ${lead._id} personal data anonymised.`);
        return res.status(200).json({ message: 'Lead personal data erased (GDPR)', leadId: lead._id });
    } catch (err) {
        console.error('[PATCH /admin/leads/:id/erase]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/leads/{id}:
 *   delete:
 *     summary: Hard-delete a lead record
 *     description: Permanently removes a lead from the database. Use /erase for GDPR erasure which preserves audit trails.
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
// DELETE /admin/leads/:id — hard delete (admin only)
router.delete('/:id', async (req, res) => {
    try {
        const lead = await Lead.findByIdAndDelete(req.params.id);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });
        return res.status(200).json({ message: 'Lead deleted' });
    } catch (err) {
        console.error('[DELETE /admin/leads/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
