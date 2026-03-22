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
 *     responses:
 *       200:
 *         description: Introducer stats payload
 *       404:
 *         description: Invalid token
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
