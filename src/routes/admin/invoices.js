const express = require('express');
const router = express.Router();
const path = require('path');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Invoice = require('../../models/Invoice');
const Partner = require('../../models/Partner');
const { sendInvoiceEmail } = require('../../services/invoiceService');
const fs = require('fs');

// All routes require JWT auth
router.use(authMiddleware);

/**
 * @openapi
 * /admin/invoices:
 *   get:
 *     summary: List all invoices
 *     description: Returns a paginated list of all invoices. Requires admin authentication.
 *     tags: [Admin Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [paid, unpaid, reversed] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated invoices list
 */
router.get('/', async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;

        const invoices = await Invoice.find(filter)
            .populate('leadId', 'name postcode')
            .populate('partnerId', 'companyName email')
            .sort({ issuedAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Invoice.countDocuments(filter);
        return res.status(200).json({ invoices, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        console.error('[GET /admin/invoices]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/invoices/{id}:
 *   get:
 *     summary: Get single invoice details
 *     description: Returns detailed information for a specific invoice.
 *     tags: [Admin Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice details
 */
router.get('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('leadId', 'name postcode email phone referenceId')
            .populate('partnerId', 'companyName contactName email phone status')
            .populate({
                path: 'commissionId',
                select: 'commissionStatus commissionValue commissionType'
            });
        
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        return res.status(200).json(invoice);
    } catch (err) {
        console.error('[GET /admin/invoices/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/invoices/{id}/download:
 *   get:
 *     summary: Download invoice PDF
 *     description: Serves the PDF file for a specific invoice.
 *     tags: [Admin Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: PDF file stream
 *       404:
 *         description: Invoice or file not found
 */
router.get('/:id/download', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        // Since pdfPath now stores the full Cloudinary URL, we can redirect to it
        // Note: For private files, we would generate a signed URL here, 
        // but for current requirement, a simple redirect to the secure_url is sufficient.
        if (!invoice.pdfPath || !invoice.pdfPath.startsWith('http')) {
            return res.status(404).json({ error: 'Invoice PDF path is invalid or local (migrate legacy files manually)' });
        }

        return res.redirect(invoice.pdfPath);
    } catch (err) {
        console.error('[GET /admin/invoices/:id/download]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/invoices/{id}/status:
 *   patch:
 *     summary: Update invoice status
 *     description: Marks an invoice as paid, unpaid, or reversed.
 *     tags: [Admin Invoices]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [paid, unpaid, reversed] }
 *     responses:
 *       200:
 *         description: Invoice status updated
 */
router.patch(
    '/:id/status',
    [body('status').isIn(['paid', 'unpaid', 'reversed']).withMessage('Invalid status')],
    validate,
    async (req, res) => {
        try {
            const updateData = { status: req.body.status };
            if (req.body.status === 'paid') updateData.paidAt = new Date();

            const invoice = await Invoice.findByIdAndUpdate(
                req.params.id,
                updateData,
                { returnDocument: 'after' }
            );

            if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

            // Sync with related commission
            const Commission = require('../../models/Commission');
            await Commission.findByIdAndUpdate(invoice.commissionId, { 
                commissionStatus: req.body.status,
                updatedAt: new Date()
            });

            return res.status(200).json({ message: 'Invoice status updated', invoice });
        } catch (err) {
            console.error('[PATCH /admin/invoices/:id/status]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/**
 * @openapi
 * /admin/invoices/{id}/resend:
 *   post:
 *     summary: Resend invoice email to partner
 *     description: Re-emails the invoice PDF link to the partner's registered email address.
 *     tags: [Admin Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice email resent
 *       404:
 *         description: Invoice or partner not found
 */
router.post('/:id/resend', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const partner = await Partner.findById(invoice.partnerId);
        if (!partner) return res.status(404).json({ error: 'Partner not found for this invoice' });

        const sent = await sendInvoiceEmail(invoice, partner);
        if (!sent) {
            return res.status(500).json({ error: 'Failed to resend invoice email — check email configuration' });
        }

        return res.status(200).json({ message: `Invoice ${invoice.invoiceNumber} resent to ${partner.email}` });
    } catch (err) {
        console.error('[POST /admin/invoices/:id/resend]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
