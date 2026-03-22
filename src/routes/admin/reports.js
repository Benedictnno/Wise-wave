const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Lead = require('../../models/Lead');
const Commission = require('../../models/Commission');
const Partner = require('../../models/Partner');
const Introducer = require('../../models/Introducer');
const IntroducerPayout = require('../../models/IntroducerPayout');
const { AsyncParser } = require('json2csv');

router.use(authMiddleware);

// GET /admin/reports/stats
router.get('/stats', async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const totalLeads = await Lead.countDocuments();
        const leadsLast30 = await Lead.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
        const activePartners = await Partner.countDocuments({ status: 'active' });
        const wonLeadsTotal = await Lead.countDocuments({ outcome: 'won' });
        const conversionRate = totalLeads > 0 ? (wonLeadsTotal / totalLeads) * 100 : 0;

        const revenueAgg = await Commission.aggregate([
            { $match: { commissionStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$wisemoveShare' } } },
        ]);
        const totalRevenue = revenueAgg.length > 0 ? +revenueAgg[0].total.toFixed(2) : 0;

        return res.json({
            totalLeads,
            leadsLast30,
            activePartners,
            conversionRate: +conversionRate.toFixed(1),
            totalRevenue
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /admin/reports/partners
router.get('/partners', async (req, res) => {
    try {
        const partners = await Lead.aggregate([
            { $match: { assignedPartnerId: { $ne: null } } },
            { $group: { _id: '$assignedPartnerId', totalLeads: { $sum: 1 } } },
            { $lookup: { from: 'partners', localField: '_id', foreignField: '_id', as: 'partner' } },
            { $unwind: '$partner' },
            { $lookup: { from: 'commissions', localField: '_id', foreignField: 'partnerId', as: 'commissions' } },
            {
                $project: {
                    partnerId: '$_id',
                    partnerName: '$partner.companyName',
                    totalLeads: 1,
                    wonDeals: { $size: { $filter: { input: '$commissions', as: 'c', cond: { $eq: ['$$c.commissionStatus', 'paid'] } } } },
                    totalRevenue: { $sum: '$commissions.wisemoveShare' }
                }
            },
            { $sort: { totalLeads: -1 } }
        ]);
        return res.json(partners);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /admin/reports/introducers
router.get('/introducers', async (req, res) => {
    try {
        const data = await Lead.aggregate([
            { $match: { introducerId: { $ne: null } } },
            { $group: { _id: '$introducerId', totalLeads: { $sum: 1 } } },
            { $lookup: { from: 'introducers', localField: '_id', foreignField: '_id', as: 'introducer' } },
            { $unwind: '$introducer' },
            { $lookup: { from: 'introducerpayouts', localField: '_id', foreignField: 'introducerId', as: 'payouts' } },
            {
                $project: {
                    introducerId: '$_id',
                    name: '$introducer.name',
                    company: '$introducer.companyName',
                    totalLeads: 1,
                    totalEarned: { $sum: '$payouts.amount' },
                    paidOut: { $sum: { $map: { input: { $filter: { input: '$payouts', as: 'p', cond: { $eq: ['$$p.payoutStatus', 'paid'] } } }, as: 'pp', in: '$$pp.amount' } } }
                }
            },
            { $sort: { totalLeads: -1 } }
        ]);
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

const sendCSV = async (res, data, filename) => {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const parser = new AsyncParser();
    const csv = await parser.parse(data).promise();
    return res.send(csv);
};

// GET /admin/reports/export?type=partners|categories|postcodes|payouts
router.get('/export', async (req, res) => {
    try {
        const { type } = req.query;
        let data = [];
        if (type === 'partners') {
            data = await Partner.find().select('companyName email phone status');
        } else if (type === 'payouts') {
            data = await IntroducerPayout.find().populate('introducerId', 'name companyName').populate('invoiceId', 'invoiceNumber');
            data = data.map(p => ({
                Introducer: p.introducerId?.name,
                Company: p.introducerId?.companyName,
                Invoice: p.invoiceId?.invoiceNumber,
                Amount: p.amount,
                Status: p.payoutStatus,
                Date: p.createdAt
            }));
        } else if (type === 'postcodes') {
            data = await Lead.aggregate([
                { $group: { _id: '$postcode', count: { $sum: 1 } } },
                { $project: { _id: 0, Postcode: '$_id', Leads: '$count' } },
                { $sort: { Leads: -1 } }
            ]);
        }
        return await sendCSV(res, data, `wisemove_${type}_report.csv`);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
