const express = require('express');
const router = express.Router();
const Introducer = require('../models/Introducer');
const Lead = require('../models/Lead');
const Commission = require('../models/Commission');

/**
 * @openapi
 * /api/introducers/{token}/stats:
 *   get:
 *     summary: Get introducer portal statistics
 *     description: Returns lead and commission stats for an introducer based on their 16-byte public token.
 *     tags: [Introducers]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *         example: "6b0a0a6d2b9a4f8c9f2f4c6a1d0b1234"
 *     responses:
 *       200:
 *         description: Introducer stats payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [introducer, stats]
 *               properties:
 *                 introducer:
 *                   type: object
 *                   required: [name, email, id]
 *                   properties:
 *                     name: { type: string, example: "Acme Estates" }
 *                     email: { type: string, format: email, example: "team@acmeestates.co.uk" }
 *                     id: { type: string, example: "65f1234567890abcdef12345" }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     monthlyLeads: { type: integer, example: 12 }
 *                     introducerSplitPercent: { type: integer, example: 30 }
 *                     leadsSubmittedLast30Days: { type: integer, example: 20 }
 *                     commissions:
 *                       type: object
 *                       properties:
 *                         paid:
 *                           type: object
 *                           properties:
 *                             total: { type: number, example: 450.5 }
 *                             count: { type: integer, example: 3 }
 *                         unpaid:
 *                           type: object
 *                           properties:
 *                             total: { type: number, example: 210 }
 *                             count: { type: integer, example: 2 }
 *       404:
 *         description: Invalid token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/:token/stats', async (req, res) => {
    try {
        const introducer = await Introducer.findOne({ publicToken: req.params.token, isActive: true });
        if (!introducer) {
            return res.status(404).json({ error: 'Invalid or expired introducer link' });
        }

        const startOfMonth = new Date();
        startOfMonth.setUTCDate(1);
        startOfMonth.setUTCHours(0, 0, 0, 0);

        const monthlyLeads = await Lead.countDocuments({
            introducerId: introducer._id,
            createdAt: { $gte: startOfMonth },
        });

        const stats = {
            monthlyLeads: monthlyLeads,
            introducerSplitPercent: 30, // always flat 30% per spec
        };

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        stats.leadsSubmittedLast30Days = await Lead.countDocuments({
            introducerId: introducer._id,
            createdAt: { $gte: thirtyDaysAgo },
        });

        const commissions = await Commission.aggregate([
            { $match: { introducerId: introducer._id } },
            {
                $group: {
                    _id: '$commissionStatus',
                    total: { $sum: '$introducerShare' },
                    count: { $sum: 1 },
                },
            },
        ]);

        stats.commissions = {
            paid: { total: 0, count: 0 },
            unpaid: { total: 0, count: 0 },
        };

        commissions.forEach((c) => {
            if (c._id === 'paid') stats.commissions.paid = { total: c.total, count: c.count };
            else if (c._id === 'unpaid') stats.commissions.unpaid = { total: c.total, count: c.count };
        });

        return res.status(200).json({
            introducer: {
                name: introducer.name,
                email: introducer.email,
                id: introducer._id // Sent to be used in client-side lead form
            },
            stats,
        });

    } catch (err) {
        console.error('[GET /api/introducers/:token/stats]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
