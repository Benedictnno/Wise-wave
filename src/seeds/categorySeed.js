require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
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


const seed = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Seed] Connected to MongoDB');

    let createdCategories = 0;
    let skippedCategories = 0;
    let createdRules = 0;
    
    // Purge old categories completely to enforce strict new categories list
    await Category.deleteMany({});
    console.log('[Seed] Purged existing categories enforce new spec');

    await CommissionRule.deleteMany({});
    console.log('[Seed] Purged existing commission rules');

    for (const catData of newCategories) {
        const cat = await Category.create(catData);
        createdCategories++;
        
        const ruleType = cat.commissionType === 'tiered' ? 'split' : cat.commissionType;
        
        await CommissionRule.create({
            categoryId: cat._id,
            type: ruleType,
            fixedAmount: cat.commissionType === 'flat' ? cat.commissionValue : 0,
            percentage: cat.commissionType === 'percentage' ? cat.commissionValue : 0,
            wisemoveShare: 70,    // Default 70/30 split logic
            introducerShare: 30,  
            triggerType: 'won'
        });
        createdRules++;
    }

    console.log(`[Seed] Categories — ${createdCategories} created.`);
    console.log(`[Seed] Commission Rules — ${createdRules} created.`);
    
    await mongoose.disconnect();
};

seed().catch((err) => {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
});
