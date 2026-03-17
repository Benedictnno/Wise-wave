require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const CategoryRelationship = require('../models/CategoryRelationship');

const MASTER_RELATIONSHIPS = {
    'Mortgage Broker – Introduction Only': [
        'Solicitors / Conveyancing',
        'Home Insurance',
        'Surveyors',
        'Life / Protection',
        'Estate Agents (7.5% Model)'
    ],
    'Estate Agents (7.5% Model)': [
        'Solicitors / Conveyancing',
        'Surveyors',
        'EPC',
        'Mortgage Broker – Introduction Only',
        'Lettings / Property Management'
    ],
    'Lettings / Property Management': [
        'Cleaning',
        'Trades',
        'EPC',
        'Home Insurance',
        'Estate Agents (7.5% Model)'
    ],
    'Solicitors / Conveyancing': [
        'Mortgage Broker – Introduction Only',
        'Surveyors',
        'Estate Agents (7.5% Model)',
        'EPC'
    ],
    'Surveyors': [
        'Solicitors / Conveyancing',
        'Mortgage Broker – Introduction Only',
        'Estate Agents (7.5% Model)',
        'EPC'
    ],
    'EPC': [
        'Estate Agents (7.5% Model)',
        'Lettings / Property Management',
        'Surveyors',
        'Trades'
    ],
    'Business Insurance': [
        'Home Insurance',
        'AML / KYC',
        'HR Services',
        'Commercial Finance – Introduction Only'
    ],
    'Commercial Finance – Introduction Only': [
        'Business Insurance',
        'AML / KYC',
        'HR Services',
        'Business Loans – Introduction Only'
    ],
    'R&D Tax Credits (Year 1)': [
        'AML / KYC',
        'HR Services',
        'Commercial Finance – Introduction Only'
    ],
    'Trades': [
        'EPC',
        'Cleaning',
        'Removals'
    ]
};

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[Seed] Connected to MongoDB');

        // Purge existing relationships to ensure clean slate
        await CategoryRelationship.deleteMany({});
        console.log('[Seed] Purged existing category relationships');

        let createdCount = 0;

        for (const [sourceName, relatedNames] of Object.entries(MASTER_RELATIONSHIPS)) {
            const sourceCategory = await Category.findOne({ name: sourceName });
            if (!sourceCategory) {
                console.warn(`[Seed] Source Category not found: "${sourceName}"`);
                continue;
            }

            const relatedCategories = await Category.find({ 
                name: { $in: relatedNames } 
            });

            if (relatedCategories.length === 0) {
                console.warn(`[Seed] No related categories found for "${sourceName}"`);
                continue;
            }

            await CategoryRelationship.create({
                categoryId: sourceCategory._id,
                relatedCategories: relatedCategories.map(c => c._id)
            });
            createdCount++;
        }

        console.log(`[Seed] Successfully created ${createdCount} category relationships.`);
    } catch (err) {
        console.error('[Seed] Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
};

seed();
