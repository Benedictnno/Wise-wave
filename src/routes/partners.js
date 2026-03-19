const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const Partner = require('../models/Partner');
const Category = require('../models/Category');

/**
 * @openapi
 * /api/partners/onboard:
 *   post:
 *     summary: Partner self-onboarding
 *     description: >
 *       Public endpoint allowing service providers to register themselves as a partner.
 *       On submission the partner is auto-activated, a welcome email is queued, and admin is notified.
 *       No login or portal is required — all future communication occurs via email/SMS/WhatsApp.
 *     tags: [Partners]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *               - contactName
 *               - email
 *               - phone
 *               - categories
 *               - postcodes
 *               - agreementAccepted
 *             properties:
 *               companyName:
 *                 type: string
 *               contactName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               whatsappNumber:
 *                 type: string
 *               preferredContactMethod:
 *                 type: string
 *                 enum: [email, sms, whatsapp]
 *               categories:
 *                 type: array
 *                 description: Array of Category MongoDB IDs
 *                 items: { type: string }
 *               postcodes:
 *                 type: array
 *                 description: Array of UK postcode districts (e.g. SW1A, E1)
 *                 items: { type: string }
 *               agreementAccepted:
 *                 type: boolean
 *                 description: Partner must explicitly accept the terms
 *     responses:
 *       201:
 *         description: Partner registered successfully
 *       400:
 *         description: Validation error or partner email already registered
 *       500:
 *         description: Internal server error
 */
router.post(
    '/onboard',
    [
        body('companyName').trim().notEmpty().withMessage('Company name is required'),
        body('contactName').trim().notEmpty().withMessage('Contact name is required'),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('phone').trim().notEmpty().withMessage('Phone number is required'),
        body('categories').isArray({ min: 1 }).withMessage('At least one service category is required'),
        body('categories.*').isMongoId().withMessage('Each category must be a valid ID'),
        body('postcodes').isArray({ min: 1 }).withMessage('At least one postcode is required'),
        body('agreementAccepted').isBoolean().withMessage('Agreement acceptance is required'),
        body('preferredContactMethod')
            .optional()
            .isIn(['email', 'sms', 'whatsapp'])
            .withMessage('preferredContactMethod must be email, sms, or whatsapp'),
    ],
    validate,
    async (req, res) => {
        try {
            const {
                companyName,
                contactName,
                email,
                phone,
                whatsappNumber,
                preferredContactMethod,
                categories,
                postcodes,
                agreementAccepted,
            } = req.body;

            // Require explicit agreement
            if (!agreementAccepted) {
                return res.status(400).json({ error: 'You must accept the terms to register as a partner' });
            }

            // Prevent duplicate registrations
            const existing = await Partner.findOne({ email: email.toLowerCase() });
            if (existing) {
                return res.status(400).json({ error: 'A partner with this email address is already registered' });
            }

            // Validate all supplied category IDs are real active categories
            const validCategories = await Category.find({ _id: { $in: categories }, isActive: true });
            if (validCategories.length !== categories.length) {
                return res.status(400).json({ error: 'One or more category IDs are invalid or inactive' });
            }

            // Create partner — auto-activated, priority defaults to 10 (lower = higher priority, admin can adjust)
            const partner = await Partner.create({
                companyName: companyName.trim(),
                contactName: contactName.trim(),
                email: email.toLowerCase(),
                phone: phone.trim(),
                whatsappNumber: whatsappNumber ? whatsappNumber.trim() : '',
                preferredContactMethod: preferredContactMethod || 'email',
                categories: validCategories.map((c) => c._id),
                postcodes: postcodes.map((p) => p.toUpperCase().trim()),
                priority: 10, // Default — admin should review and adjust
                status: 'active',
                agreementAccepted: true,
                agreementTimestamp: new Date(),
            });

            // Fire-and-forget: welcome email to partner + admin notification
            sendPartnerWelcome(partner).catch((err) =>
                console.error('[Partner Onboard] Welcome email error:', err.message)
            );
            notifyAdminNewPartner(partner).catch((err) =>
                console.error('[Partner Onboard] Admin notify error:', err.message)
            );

            console.log(`[Partner Onboard] New partner registered: ${partner.companyName} (${partner.email})`);

            return res.status(201).json({
                message: 'Thank you! Your partner registration has been received. We will be in touch shortly.',
                partnerId: partner._id,
            });
        } catch (err) {
            console.error('[POST /api/partners/onboard]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// ─── Internal Email Helpers ───────────────────────────────────────────────────

const sendPartnerWelcome = async (partner) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
            to: partner.email,
            subject: 'Welcome to WiseMove Connect — Partner Registration Confirmed',
            text:
                `Dear ${partner.companyName},\n\n` +
                `Thank you for registering as a partner with WiseMove Connect.\n\n` +
                `Your account is now active and you will begin receiving lead introductions in your registered ` +
                `service areas shortly. Introductions will be sent via ${partner.preferredContactMethod}.\n\n` +
                `You do not need to create an account or log in. When a lead is matched to you, you will receive ` +
                `a secure link to update the outcome (Won / Lost / Not Suitable).\n\n` +
                `If you need to update your details or service areas, please contact us directly.\n\n` +
                `WiseMove Connect`,
        }),
    });
};

const notifyAdminNewPartner = async (partner) => {
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!apiKey || !adminEmail) return;

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
            to: adminEmail,
            subject: '[WiseMove] New Partner Self-Registration',
            text:
                `A new partner has self-registered and is now active.\n\n` +
                `Company: ${partner.companyName}\n` +
                `Contact: ${partner.contactName}\n` +
                `Email: ${partner.email}\n` +
                `Phone: ${partner.phone}\n` +
                `Preferred Contact: ${partner.preferredContactMethod}\n\n` +
                `Please review their priority and postcode coverage in the admin dashboard.\n\n` +
                `Admin Dashboard: ${process.env.ADMIN_URL || 'http://localhost:3000/admin'}`,
        }),
    });
};

module.exports = router;
