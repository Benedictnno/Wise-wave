require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const CommissionRule = require('../models/CommissionRule');

const MASTER_CATEGORIES = [
    { externalId: 1, name: 'Estate Agents (7.5% Model)', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 25, introducerSplit: 30, notes: 'High-margin' },
    { externalId: 2, name: 'Lettings / Property Management', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Standard' },
    { externalId: 3, name: 'Trades', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 10, introducerSplit: 30, notes: 'Low-margin' },
    { externalId: 4, name: 'EPC', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 10, introducerSplit: 30, notes: 'Low-margin' },
    { externalId: 5, name: 'Floorplans', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 10, introducerSplit: 30, notes: 'Low-margin' },
    { externalId: 6, name: 'Surveyors', pillarId: 'Property Services', commissionType: 'flat', commissionValue: 25, introducerSplit: 30, notes: 'Low-margin' },
    { externalId: 7, name: 'Removals', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 20, introducerSplit: 30, notes: 'Low-margin' },
    { externalId: 8, name: 'Cleaning', pillarId: 'Personal Services', commissionType: 'flat', commissionValue: 10, introducerSplit: 30, notes: 'Low-margin' },
    { externalId: 9, name: 'Commercial Property Services', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Standard' },
    { externalId: 10, name: 'Solicitors / Conveyancing', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Standard' },
    { externalId: 11, name: 'Wills & Estate Planning', pillarId: 'Personal Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Standard' },
    { externalId: 12, name: 'AML / KYC', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 25, introducerSplit: 30, notes: 'High-margin' },
    { externalId: 13, name: 'HR Services', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Standard' },
    { externalId: 14, name: 'Home Insurance', pillarId: 'Personal Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Standard' },
    { externalId: 15, name: 'Business Insurance', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Regulated introduction' },
    { externalId: 16, name: 'PPI / SME Insurance', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Standard' },
    { externalId: 17, name: 'Life / Protection', pillarId: 'Personal Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Standard' },
    { externalId: 18, name: 'Commercial Finance – Introduction Only', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Regulated introduction' },
    { externalId: 19, name: 'Business Loans – Introduction Only', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Non-regulated' },
    { externalId: 20, name: 'Asset Finance – Introduction Only', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Non-regulated' },
    { externalId: 21, name: 'Invoice Finance – Introduction Only', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Non-regulated' },
    { externalId: 22, name: 'Development Finance – Introduction Only', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Non-regulated' },
    { externalId: 23, name: 'Bridging Finance – Introduction Only', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Non-regulated' },
    { externalId: 24, name: 'Auction Finance – Introduction Only', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Non-regulated' },
    { externalId: 25, name: 'R&D Tax Credits (Year 1)', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Tiered' },
    { externalId: 26, name: 'R&D Tax Credits (Year 2)', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 10, introducerSplit: 30, notes: 'Tiered' },
    { externalId: 27, name: 'R&D Tax Credits (Year 3+)', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 0, introducerSplit: 0, notes: 'No commission' },
    { externalId: 28, name: 'Mortgage Broker – Introduction Only', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Regulated: Introduction Only' },
    { externalId: 29, name: 'Independent Financial Adviser – Introduction Only', pillarId: 'Personal Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Regulated: Introduction Only' },
    { externalId: 30, name: 'Business Coaching / Consultancy', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, introducerSplit: 30, notes: 'Unregulated' },
];

const COMPLIANCE_TEXT = 'WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.';

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[Seed] Connected to MongoDB');

        // Purge existing
        await Category.deleteMany({});
        await CommissionRule.deleteMany({});
        console.log('[Seed] Purged existing categories and rules');

        for (const catData of MASTER_CATEGORIES) {
            let complianceText = '';
            let isRegulated = false;

            if (catData.externalId === 28 || catData.externalId === 29) {
                complianceText = COMPLIANCE_TEXT;
                isRegulated = true;
            }

            const category = await Category.create({
                ...catData,
                complianceText,
                isRegulated,
                isActive: true
            });

            await CommissionRule.create({
                categoryId: category._id,
                type: category.commissionType === 'flat' ? 'fixed' : 'percentage',
                fixedAmount: category.commissionType === 'flat' ? category.commissionValue : 0,
                percentage: category.commissionType === 'percentage' ? category.commissionValue : 0,
                introducerShare: category.introducerSplit,
                wisemoveShare: 100 - category.introducerSplit,
                triggerType: 'won'
            });
        }

        console.log(`[Seed] Successfully created ${MASTER_CATEGORIES.length} categories and rules.`);
    } catch (err) {
        console.error('[Seed] Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
};

seed();
