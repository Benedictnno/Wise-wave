require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const CategoryRelationship = require('../models/CategoryRelationship');

// Static cross-category suggestion rules
// key = category name, value = array of related category names
const rules = {
    'Mortgage Broker': ['Conveyancing', 'Insurance', 'Surveyors', 'Life Insurance', 'Estate Agents'],
    'Estate Agents': ['Conveyancing', 'Surveyors', 'EPC', 'Mortgage Broker', 'Lettings'],
    'Lettings': ['Property Management', 'EPC', 'Insurance', 'Trades', 'Estate Agents'],
    'Conveyancing': ['Mortgage Broker', 'Surveyors', 'Estate Agents', 'EPC'],
    'Surveyors': ['Conveyancing', 'Mortgage Broker', 'Estate Agents', 'EPC'],
    'EPC': ['Estate Agents', 'Lettings', 'Surveyors', 'Trades'],
    'Insurance': ['Mortgage Broker', 'Life Insurance', 'Business Insurance', 'Estate Agents'],
    'Life Insurance': ['Insurance', 'Mortgage Broker', 'Independent Financial Adviser'],
    'Independent Financial Adviser': ['Mortgage Broker', 'Insurance', 'Life Insurance', 'Accountancy'],
    'Finance': ['Mortgage Broker', 'Asset Finance', 'Accountancy', 'Business Insurance'],
    'R&D Tax Credits': ['Accountancy', 'Legal Services', 'Finance'],
    'Accountancy': ['Legal Services', 'R&D Tax Credits', 'Business Insurance', 'HR & Employment Law'],
    'Legal Services': ['Conveyancing', 'HR & Employment Law', 'Accountancy'],
    'Trades': ['EPC', 'Plumbing', 'Electrical', 'Roofing', 'Cleaning'],
    'Plumbing': ['Trades', 'Electrical', 'Roofing'],
    'Electrical': ['Trades', 'Plumbing', 'EPC'],
    'Property Management': ['Lettings', 'Trades', 'Insurance', 'EPC'],
    'Business Insurance': ['Insurance', 'Accountancy', 'HR & Employment Law', 'Finance'],
    'Bridging Finance': ['Finance', 'Mortgage Broker', 'Commercial Mortgage'],
    'Commercial Mortgage': ['Bridging Finance', 'Finance', 'Business Insurance'],
};

const seed = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Seed] Connected to MongoDB');

    let created = 0;
    let skipped = 0;

    for (const [sourceName, relatedNames] of Object.entries(rules)) {
        const sourceCategory = await Category.findOne({ name: sourceName });
        if (!sourceCategory) {
            console.warn(`[Seed] Category not found: ${sourceName} — run categorySeed.js first`);
            continue;
        }

        const existing = await CategoryRelationship.findOne({ categoryId: sourceCategory._id });
        if (existing) {
            skipped++;
            continue;
        }

        const relatedDocs = await Category.find({ name: { $in: relatedNames } });
        const relatedIds = relatedDocs.map((d) => d._id);

        await CategoryRelationship.create({ categoryId: sourceCategory._id, relatedCategories: relatedIds });
        created++;
    }

    console.log(`[Seed] Category Relationships — ${created} created, ${skipped} already existed`);
    await mongoose.disconnect();
};

seed().catch((err) => {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
});
