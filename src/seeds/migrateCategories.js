require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Partner = require('../models/Partner');
const CommissionRule = require('../models/CommissionRule');

const newCategories = [
    // ─── Pillar 1 — Property Services ──────────────────────────────────────────
    { name: 'Estate Agency & Lettings', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 10, isRegulated: false, complianceText: '' },
    { name: 'Property Management (Residential)', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 10, isRegulated: false, complianceText: '' },
    { name: 'Property Management (Commercial)', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 10, isRegulated: false, complianceText: '' },
    { name: 'Property Surveys', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Conveyancing Services', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 150, isRegulated: false, complianceText: '' },
    { name: 'Mortgage Introductions', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 200, isRegulated: true, complianceText: 'Introduction‑only service. No advice, no recommendations, no financial promotions. Users are introduced to an authorised partner who provides their own regulated service independently.' },
    { name: 'IFA / Financial Planning Introductions', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 200, isRegulated: true, complianceText: 'Introduction‑only service. No advice, no recommendations, no financial promotions. Users are introduced to an authorised partner who provides their own regulated service independently.' },
    { name: 'Architectural Services', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Planning Consultants', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Property Photography & Floorplans', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 25, isRegulated: false, complianceText: '' },

    // ─── Pillar 2 — Business Services ──────────────────────────────────────────
    { name: 'Accountancy & Tax', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Bookkeeping', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 50, isRegulated: false, complianceText: '' },
    { name: 'Commercial Finance Introductions', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 250, isRegulated: true, complianceText: 'Introduction‑only service. No advice, no recommendations, no financial promotions. Users are introduced to an authorised partner who provides their own regulated service independently.' },
    { name: 'HR & Employment Law', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Health & Safety Compliance', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'R&D Tax Credits', pillarId: 'Business Services', commissionType: 'tiered', commissionValue: 0, isRegulated: false, complianceText: '' },
    { name: 'Business Insurance Introductions', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 12, isRegulated: true, complianceText: 'Introduction‑only service. No advice, no recommendations, no financial promotions. Users are introduced to an authorised partner who provides their own regulated service independently.' },
    { name: 'IT Support & Cybersecurity', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Web Design & Digital Services', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Marketing & Branding', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Virtual Assistants & Admin Support', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 50, isRegulated: false, complianceText: '' },
    { name: 'Business Coaching & Consultancy', pillarId: 'Business Services', commissionType: 'flat', commissionValue: 150, isRegulated: false, complianceText: '' },

    // ─── Pillar 3 — Personal Services ──────────────────────────────────────────
    { name: 'Will Writing & Estate Planning', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Funeral Plans', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 150, isRegulated: true, complianceText: 'Introduction‑only service. No advice, no recommendations, no financial promotions. Users are introduced to an authorised partner who provides their own regulated service independently.' },
    { name: 'Trades & Home Services', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 50, isRegulated: false, complianceText: '' },
    { name: 'Cleaning Services', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 30, isRegulated: false, complianceText: '' },
    { name: 'Removals & Storage', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 100, isRegulated: false, complianceText: '' },
    { name: 'Personal Coaching', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 75, isRegulated: false, complianceText: '' },
];

const categoryMapping = {
    'Estate Agents': 'Estate Agency & Lettings',
    'Lettings': 'Estate Agency & Lettings',
    'Conveyancing': 'Conveyancing Services',
    'Surveyors': 'Property Surveys',
    'EPC': 'Trades & Home Services',
    'Property Management': 'Property Management (Residential)',
    'New Build Sales': 'Estate Agency & Lettings',
    'Mortgage Broker': 'Mortgage Introductions',
    'Independent Financial Adviser': 'IFA / Financial Planning Introductions',
    'Finance': 'Commercial Finance Introductions',
    'Bridging Finance': 'Commercial Finance Introductions',
    'Asset Finance': 'Commercial Finance Introductions',
    'Commercial Mortgage': 'Commercial Finance Introductions',
    'Insurance': 'Business Insurance Introductions',
    'Life Insurance': 'Business Insurance Introductions',
    'Business Insurance': 'Business Insurance Introductions',
    'R&D Tax Credits': 'R&D Tax Credits',
    'Accountancy': 'Accountancy & Tax',
    'Legal Services': 'HR & Employment Law', // Approx mapping
    'Business Energy': 'Trades & Home Services', // Approx mapping
    'Telecoms': 'IT Support & Cybersecurity', // Approx mapping
    'HR & Employment Law': 'HR & Employment Law',
    'Marketing': 'Marketing & Branding',
    'Web Design': 'Web Design & Digital Services',
    'Trades': 'Trades & Home Services',
    'Plumbing': 'Trades & Home Services',
    'Electrical': 'Trades & Home Services',
    'Roofing': 'Trades & Home Services',
    'Cleaning': 'Cleaning Services',
    'Landscaping': 'Trades & Home Services'
};

const migrate = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Migration] Connected to MongoDB');

    const newCategoryMap = new Map();

    // 1. Create or ensure the new categories exist
    console.log('[Migration] Creating new categories and commission rules...');
    for (const catData of newCategories) {
        let cat = await Category.findOne({ name: catData.name });
        if (!cat) {
            cat = await Category.create(catData);
        } else {
            Object.assign(cat, catData);
            await cat.save();
        }
        newCategoryMap.set(cat.name, cat._id);

        // Seed CommissionRule for this category
        let rule = await CommissionRule.findOne({ categoryId: cat._id });
        const ruleType = cat.commissionType === 'tiered' ? 'split' : cat.commissionType;
        if (!rule) {
            await CommissionRule.create({
                categoryId: cat._id,
                type: ruleType,
                fixedAmount: cat.commissionType === 'flat' ? cat.commissionValue : 0,
                percentage: cat.commissionType === 'percentage' ? cat.commissionValue : 0,
                wisemoveShare: 70,    // Default 70/30 split logic
                introducerShare: 30,  // Or 100/0 if no introducer
                triggerType: 'won'
            });
        }
    }

    // 2. Map existing partners to new categories
    console.log('[Migration] Migrating old partner categories...');
    const partners = await Partner.find().populate('categories');
    for (const partner of partners) {
        let updatedCategories = new Set();
        let changed = false;

        for (const oldCat of partner.categories) {
            const newName = categoryMapping[oldCat.name];
            if (newName) {
                const newId = newCategoryMap.get(newName);
                if (newId) {
                    updatedCategories.add(newId.toString());
                    changed = true;
                }
            }
        }

        if (changed) {
            partner.categories = Array.from(updatedCategories);
            await partner.save();
            console.log(`[Migration] Updated partner: ${partner._id} (${partner.companyName || 'Unknown'})`);
        }
    }

    // 3. Delete old categories that aren't in the new 28 list
    console.log('[Migration] Removing old unsupported categories...');
    const validNames = newCategories.map(c => c.name);
    const result = await Category.deleteMany({ name: { $nin: validNames } });
    console.log(`[Migration] Deleted ${result.deletedCount} old categories.`);

    console.log('[Migration] Complete!');
    await mongoose.disconnect();
};

migrate().catch((err) => {
    console.error('[Migration] Error:', err.message);
    process.exit(1);
});
