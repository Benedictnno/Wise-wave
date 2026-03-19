const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Lead = require('../../models/Lead');
const Commission = require('../../models/Commission');
const Partner = require('../../models/Partner');
const { AsyncParser } = require('json2csv');

// All routes require JWT auth
router.use(authMiddleware);

/**
 * @openapi
 * /admin/reports/stats:
 *   get:
 *     summary: Get dashboard overview stats
 *     description: Returns key metrics for the admin dashboard, including lead counts, active partners, conversion rates, and 30-day trends.
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
// GET /admin/reports/stats
router.get('/stats', async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // helper for trend strings
        const getTrend = (current, previous) => {
            if (previous === 0) return current > 0 ? `+${100}%` : '0%';
            const change = ((current - previous) / previous) * 100;
            return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
        };

        // --- 1. Total Leads ---
        const totalLeads = await Lead.countDocuments();
        const leadsCurrent = await Lead.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
        const leadsPrevious = await Lead.countDocuments({ 
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } 
        });
        const leadsTrend = getTrend(leadsCurrent, leadsPrevious);

        // --- 2. Active Partners ---
        const activePartners = await Partner.countDocuments({ status: 'active' });
        const partnersCurrent = await Partner.countDocuments({ 
            status: 'active', 
            createdAt: { $gte: thirtyDaysAgo } 
        });
        const partnersPrevious = await Partner.countDocuments({ 
            status: 'active', 
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } 
        });
        const partnersTrend = getTrend(partnersCurrent, partnersPrevious);

        // --- 3. Conversion Rate ---
        const wonLeadsTotal = await Lead.countDocuments({ outcome: 'won' });
        const conversionRate = totalLeads > 0 ? (wonLeadsTotal / totalLeads) * 100 : 0;

        // Current period conversion
        const leadsLast30 = await Lead.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
        const wonLast30 = await Lead.countDocuments({ outcome: 'won', updatedAt: { $gte: thirtyDaysAgo } });
        const convCurrent = leadsLast30 > 0 ? (wonLast30 / leadsLast30) * 100 : 0;

        // Previous period conversion
        const leadsPrev30 = await Lead.countDocuments({ 
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } 
        });
        const wonPrev30 = await Lead.countDocuments({ 
            outcome: 'won', 
            updatedAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } 
        });
        const convPrev = leadsPrev30 > 0 ? (wonPrev30 / leadsPrev30) * 100 : 0;
        
        const conversionTrend = getTrend(convCurrent, convPrev);

        // --- 4. Total Revenue (paid WiseMove commission share) ---
        const revenueAgg = await Commission.aggregate([
            { $match: { commissionStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$wisemoveShare' } } },
        ]);
        const totalRevenue = revenueAgg.length > 0 ? +revenueAgg[0].total.toFixed(2) : 0;

        return res.status(200).json({
            totalLeads,
            activePartners,
            conversionRate: +conversionRate.toFixed(1),
            totalRevenue,
            leadsTrend,
            partnersTrend,
            conversionTrend
        });
    } catch (err) {
        console.error('[GET /admin/reports/stats]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Helper: stream CSV response ─────────────────────────────────────────────
const sendCSV = async (res, data, filename) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const parser = new AsyncParser();
    const csv = await parser.parse(data).promise();
    return res.status(200).send(csv);
};

/**
 * @openapi
 * /admin/reports/partners:
 *   get:
 *     summary: Get partner performance report
 *     description: Returns aggregated data for partners, including total leads, conversion rates, and revenue generated. Requires admin authentication.
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Partner performance data
 */
// GET /admin/reports/partners
router.get('/partners', async (req, res) => {
    try {
        const partners = await Lead.aggregate([
            { $match: { assignedPartnerId: { $ne: null } } },
            {
                $group: {
                    _id: '$assignedPartnerId',
                    totalLeads: { $sum: 1 },
                },
            },
            {
                $lookup: {
                    from: 'partners',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'partner',
                },
            },
            { $unwind: '$partner' },
            {
                $lookup: {
                    from: 'commissions',
                    localField: '_id',
                    foreignField: 'partnerId',
                    as: 'commissions',
                },
            },
            {
                $project: {
                    partnerId: '$_id',
                    partnerName: '$partner.companyName',
                    partnerEmail: '$partner.email',
                    totalLeads: 1,
                    paidCommissions: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$commissions',
                                        as: 'c',
                                        cond: { $eq: ['$$c.commissionStatus', 'paid'] },
                                    },
                                },
                                as: 'pc',
                                in: '$$pc.wisemoveShare',
                            },
                        },
                    },
                    totalCommissions: {
                        $sum: '$commissions.wisemoveShare',
                    },
                    dealsReported: { $size: '$commissions' },
                },
            },
            {
                $addFields: {
                    conversionRate: {
                        $cond: [
                            { $gt: ['$totalLeads', 0] },
                            {
                                $multiply: [
                                    { $divide: ['$dealsReported', '$totalLeads'] },
                                    100,
                                ],
                            },
                            0,
                        ],
                    },
                },
            },
            { $sort: { totalLeads: -1 } },
        ]);

        return res.status(200).json(partners);
    } catch (err) {
        console.error('[GET /admin/reports/partners]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/reports/categories:
 *   get:
 *     summary: Get category performance report
 *     description: Returns aggregated data for each category, showing lead distribution and revenue. Requires admin authentication.
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category performance data
 */
// GET /admin/reports/categories
router.get('/categories', async (req, res) => {
    try {
        const data = await Lead.aggregate([
            {
                $group: {
                    _id: '$category',
                    totalLeads: { $sum: 1 },
                    assignedLeads: { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } },
                },
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category',
                },
            },
            { $unwind: '$category' },
            {
                $lookup: {
                    from: 'commissions',
                    localField: '_id',
                    foreignField: 'categoryId',
                    as: 'commissions',
                },
            },
            {
                $project: {
                    categoryId: '$_id',
                    categoryName: '$category.name',
                    totalLeads: 1,
                    assignedLeads: 1,
                    totalRevenue: { $sum: '$commissions.wisemoveShare' },
                    paidRevenue: {
                        $sum: {
                            $map: {
                                input: {
                                    $filter: {
                                        input: '$commissions',
                                        as: 'c',
                                        cond: { $eq: ['$$c.commissionStatus', 'paid'] },
                                    },
                                },
                                as: 'pc',
                                in: '$$pc.wisemoveShare',
                            },
                        },
                    },
                },
            },
            { $sort: { totalLeads: -1 } },
        ]);

        return res.status(200).json(data);
    } catch (err) {
        console.error('[GET /admin/reports/categories]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/reports/postcodes:
 *   get:
 *     summary: Get postcode distribution report
 *     description: Returns aggregated lead counts and assignment status per postcode. Requires admin authentication.
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Postcode distribution data
 */
// GET /admin/reports/postcodes
router.get('/postcodes', async (req, res) => {
    try {
        const data = await Lead.aggregate([
            {
                $group: {
                    _id: '$postcode',
                    totalLeads: { $sum: 1 },
                    assignedLeads: { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } },
                    unassignedLeads: { $sum: { $cond: [{ $eq: ['$status', 'unassigned'] }, 1, 0] } },
                },
            },
            {
                $lookup: {
                    from: 'commissions',
                    localField: '_id',
                    foreignField: 'partnerId', // approximate postcode revenue via lead postcode
                    as: 'commissions',
                },
            },
            {
                $project: {
                    postcode: '$_id',
                    totalLeads: 1,
                    assignedLeads: 1,
                    unassignedLeads: 1,
                },
            },
            { $sort: { totalLeads: -1 } },
        ]);

        return res.status(200).json(data);
    } catch (err) {
        console.error('[GET /admin/reports/postcodes]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/reports/export:
 *   get:
 *     summary: Export reports to CSV
 *     description: Streams a CSV file containing the requested report data. Requires admin authentication.
 *     tags: [Admin Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [partners, categories, postcodes] }
 *     responses:
 *       200:
 *         description: CSV file stream
 *         content:
 *           text/csv:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Invalid report type
 */
// GET /admin/reports/export?type=partners|categories|postcodes
router.get('/export', async (req, res) => {
    try {
        const { type } = req.query;
        const validTypes = ['partners', 'categories', 'postcodes'];
        if (!type || !validTypes.includes(type)) {
            return res.status(400).json({ error: 'type query param must be partners, categories, or postcodes' });
        }

        // Reuse same aggregate logic
        let data;
        if (type === 'partners') {
            data = await Lead.aggregate([
                { $match: { assignedPartnerId: { $ne: null } } },
                { $group: { _id: '$assignedPartnerId', totalLeads: { $sum: 1 } } },
                { $lookup: { from: 'partners', localField: '_id', foreignField: '_id', as: 'partner' } },
                { $unwind: '$partner' },
                { $lookup: { from: 'commissions', localField: '_id', foreignField: 'partnerId', as: 'commissions' } },
                {
                    $project: {
                        _id: 0,
                        Partner: '$partner.companyName',
                        Email: '$partner.email',
                        'Total Leads': '$totalLeads',
                        'Deals Reported': { $size: '$commissions' },
                        'Total Revenue (£)': { $sum: '$commissions.wisemoveShare' },
                    },
                },
                { $sort: { 'Total Leads': -1 } },
            ]);
        } else if (type === 'categories') {
            data = await Lead.aggregate([
                { $group: { _id: '$category', totalLeads: { $sum: 1 } } },
                { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
                { $unwind: '$category' },
                { $lookup: { from: 'commissions', localField: '_id', foreignField: 'categoryId', as: 'commissions' } },
                {
                    $project: {
                        _id: 0,
                        Category: '$category.name',
                        'Total Leads': '$totalLeads',
                        'Total Revenue (£)': { $sum: '$commissions.wisemoveShare' },
                    },
                },
                { $sort: { 'Total Leads': -1 } },
            ]);
        } else {
            data = await Lead.aggregate([
                { $group: { _id: '$postcode', totalLeads: { $sum: 1 }, assigned: { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } } } },
                { $project: { _id: 0, Postcode: '$_id', 'Total Leads': '$totalLeads', 'Assigned': '$assigned' } },
                { $sort: { 'Total Leads': -1 } },
            ]);
        }

        return await sendCSV(res, data, `wisemove_${type}_report.csv`);
    } catch (err) {
        console.error('[GET /admin/reports/export]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
