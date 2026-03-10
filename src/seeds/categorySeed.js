require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');

const categories = [
    // ─── Property ──────────────────────────────────────────────────────────────
    { name: 'Estate Agents', commissionType: 'percentage', commissionValue: 10, description: 'Residential property sales introductions', isRegulated: false },
    { name: 'Lettings', commissionType: 'percentage', commissionValue: 10, description: 'Residential lettings and property management', isRegulated: false },
    { name: 'Conveyancing', commissionType: 'flat', commissionValue: 150, description: 'Property conveyancing solicitor introductions', isRegulated: false },
    { name: 'Surveyors', commissionType: 'flat', commissionValue: 100, description: 'RICS surveyors for valuations and surveys', isRegulated: false },
    { name: 'EPC', commissionType: 'flat', commissionValue: 25, description: 'Energy Performance Certificate assessors', isRegulated: false },
    { name: 'Property Management', commissionType: 'percentage', commissionValue: 10, description: 'Block and property management services', isRegulated: false },
    { name: 'New Build Sales', commissionType: 'percentage', commissionValue: 10, description: 'New build developer introductions', isRegulated: false },

    // ─── Finance (Regulated) ──────────────────────────────────────────────────
    {
        name: 'Mortgage Broker',
        commissionType: 'flat',
        commissionValue: 200,
        description: 'Introduction to FCA-regulated mortgage advisers',
        notes: 'WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.',
        isRegulated: true,
    },
    {
        name: 'Independent Financial Adviser',
        commissionType: 'flat',
        commissionValue: 200,
        description: 'Introduction to FCA-regulated independent financial advisers',
        notes: 'WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.',
        isRegulated: true,
    },
    { name: 'Finance', commissionType: 'percentage', commissionValue: 10, description: 'General business finance introductions', isRegulated: false },
    { name: 'Bridging Finance', commissionType: 'flat', commissionValue: 250, description: 'Short-term bridging loan introductions', isRegulated: false },
    { name: 'Asset Finance', commissionType: 'percentage', commissionValue: 8, description: 'Asset and equipment finance introductions', isRegulated: false },
    { name: 'Commercial Mortgage', commissionType: 'flat', commissionValue: 300, description: 'Commercial property mortgage introductions', isRegulated: false },

    // ─── Insurance ─────────────────────────────────────────────────────────────
    { name: 'Insurance', commissionType: 'percentage', commissionValue: 15, description: 'General insurance introductions', isRegulated: false },
    { name: 'Life Insurance', commissionType: 'flat', commissionValue: 150, description: 'Life and critical illness insurance', isRegulated: false },
    { name: 'Business Insurance', commissionType: 'percentage', commissionValue: 12, description: 'Commercial insurance products', isRegulated: false },

    // ─── Business Services ────────────────────────────────────────────────────
    { name: 'R&D Tax Credits', commissionType: 'tiered', commissionValue: 0, description: 'Research and development tax credit specialists', isRegulated: false },
    { name: 'Accountancy', commissionType: 'flat', commissionValue: 100, description: 'Accounting and bookkeeping services', isRegulated: false },
    { name: 'Legal Services', commissionType: 'flat', commissionValue: 150, description: 'General legal services and solicitors', isRegulated: false },
    { name: 'Business Energy', commissionType: 'percentage', commissionValue: 8, description: 'Business energy switching and procurement', isRegulated: false },
    { name: 'Telecoms', commissionType: 'percentage', commissionValue: 8, description: 'Business telecoms and connectivity', isRegulated: false },
    { name: 'HR & Employment Law', commissionType: 'flat', commissionValue: 100, description: 'Human resources and employment law consultants', isRegulated: false },
    { name: 'Marketing', commissionType: 'flat', commissionValue: 100, description: 'Digital and traditional marketing agencies', isRegulated: false },
    { name: 'Web Design', commissionType: 'flat', commissionValue: 75, description: 'Website design and development agencies', isRegulated: false },

    // ─── Trades ────────────────────────────────────────────────────────────────
    { name: 'Trades', commissionType: 'flat', commissionValue: 50, description: 'General tradesperson introductions', isRegulated: false },
    { name: 'Plumbing', commissionType: 'flat', commissionValue: 40, description: 'Plumbing and heating engineer introductions', isRegulated: false },
    { name: 'Electrical', commissionType: 'flat', commissionValue: 40, description: 'Electrician and electrical contractor introductions', isRegulated: false },
    { name: 'Roofing', commissionType: 'flat', commissionValue: 60, description: 'Roofing contractor introductions', isRegulated: false },
    { name: 'Cleaning', commissionType: 'flat', commissionValue: 30, description: 'Commercial and residential cleaning services', isRegulated: false },
    { name: 'Landscaping', commissionType: 'flat', commissionValue: 40, description: 'Garden and landscape design introductions', isRegulated: false },
];

const seed = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Seed] Connected to MongoDB');

    let created = 0;
    let skipped = 0;

    for (const cat of categories) {
        const existing = await Category.findOne({ name: cat.name });
        if (existing) {
            skipped++;
            continue;
        }
        await Category.create(cat);
        created++;
    }

    console.log(`[Seed] Categories — ${created} created, ${skipped} already existed`);
    await mongoose.disconnect();
};

seed().catch((err) => {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
});
