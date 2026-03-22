const mongoose = require('mongoose');
const Category = require('../models/Category');
const CommissionRule = require('../models/CommissionRule');
require('dotenv').config();

const categories = [
    // --- Pillar 1: Business Services ---
    { name: 'R&D Tax Credits', externalId: 'BS-001', serviceSlug: 'rd-tax-credits', pillarId: 'Business Services', commissionType: 'tiered', commissionValue: 20, isRegulated: false },
    { name: 'Capital Allowances', externalId: 'BS-002', serviceSlug: 'capital-allowances', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 20, isRegulated: false },
    { name: 'Grants & Funding', externalId: 'BS-003', serviceSlug: 'grants-funding', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 15, isRegulated: false },
    { name: 'HR / HR Consultancy', externalId: 'BS-004', serviceSlug: 'hr-consultancy', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 15, isRegulated: false },
    { name: 'Accountancy / Bookkeeping', externalId: 'BS-005', serviceSlug: 'accountancy-bookkeeping', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'Business Insurance', externalId: 'BS-006', serviceSlug: 'business-insurance', pillarId: 'Business Services', commissionType: 'fixed', commissionValue: 35, isRegulated: true },
    { name: 'Business Exit & Succession', externalId: 'BS-007', serviceSlug: 'business-exit-succession', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 15, isRegulated: false },
    { name: 'Legal Services (Admin Only)', externalId: 'BS-008', serviceSlug: 'legal-services-admin', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'Marketing / Digital Support', externalId: 'BS-009', serviceSlug: 'marketing-digital-support', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'IT / Software / SaaS', externalId: 'BS-010', serviceSlug: 'it-software-saas', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'Business Property / Premises', externalId: 'BS-011', serviceSlug: 'business-property-premises', pillarId: 'Business Services', commissionType: 'fixed', commissionValue: 35, isRegulated: false },
    { name: 'Specialist Advisory (incl. AML/KYC)', externalId: 'BS-012', serviceSlug: 'specialist-advisory', pillarId: 'Business Services', commissionType: 'fixed', commissionValue: 35, isRegulated: false },
    { name: 'Commercial Finance & Loans', externalId: 'BS-013', serviceSlug: 'commercial-finance', pillarId: 'Business Services', commissionType: 'percentage', commissionValue: 1.5, isRegulated: true },

    // --- Pillar 2: Property Services ---
    { name: 'Estate Agent & Lettings Support', externalId: 'PS-001', serviceSlug: 'estate-agent-lettings', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 7.5, isRegulated: false },
    { name: 'Property Legal Support (Admin Only)', externalId: 'PS-002', serviceSlug: 'property-legal-support', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 35, isRegulated: false },
    { name: 'Surveying & Valuation', externalId: 'PS-003', serviceSlug: 'surveying-valuation', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 30, isRegulated: false },
    { name: 'Residential Property Management', externalId: 'PS-004', serviceSlug: 'residential-property-management', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'Commercial Property Management', externalId: 'PS-005', serviceSlug: 'commercial-property-management', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'Marketing & Media', externalId: 'PS-006', serviceSlug: 'marketing-media', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 30, isRegulated: false },
    { name: 'Compliance Support', externalId: 'PS-007', serviceSlug: 'compliance-support', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 35, isRegulated: false },
    { name: 'IT & Systems (Property)', externalId: 'PS-008', serviceSlug: 'it-systems-property', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'Optional Business Services', externalId: 'PS-009', serviceSlug: 'optional-business-services', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'Trades & Property Services', externalId: 'PS-010', serviceSlug: 'trades-property-services', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 20, isRegulated: false },
    { name: 'Tenant & Occupier Services', externalId: 'PS-011', serviceSlug: 'tenant-occupier-services', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 20, isRegulated: false },
    { name: 'Renovation & Improvement Projects', externalId: 'PS-012', serviceSlug: 'renovation-improvement', pillarId: 'Property Services', commissionType: 'percentage', commissionValue: 12, isRegulated: false },
    { name: 'Specialist Property Services', externalId: 'PS-013', serviceSlug: 'specialist-property-services', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 25, isRegulated: false },
    { name: 'Insurance & Risk', externalId: 'PS-014', serviceSlug: 'insurance-risk', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 35, isRegulated: true },
    { name: 'EPC (Energy Performance Certificate)', externalId: 'PS-015', serviceSlug: 'epc', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 25, isRegulated: false },
    { name: 'Conveyancing (Residential)', externalId: 'PS-016', serviceSlug: 'conveyancing-residential', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 50, isRegulated: false },
    { name: 'Conveyancing (Commercial)', externalId: 'PS-017', serviceSlug: 'conveyancing-commercial', pillarId: 'Property Services', commissionType: 'fixed', commissionValue: 75, isRegulated: false },

    // --- Others / Personal Services ---
    { name: 'Mortgage Broker (Introduction Only)', externalId: 'AS-001', serviceSlug: 'mortgage-broker', pillarId: 'Personal Services', commissionType: 'fixed', commissionValue: 50, isRegulated: true },
    { name: 'Independent Financial Adviser', externalId: 'AS-002', serviceSlug: 'ifa', pillarId: 'Personal Services', commissionType: 'percentage', commissionValue: 0.5, isRegulated: true },
    { name: 'Pension & Retirement Planning', externalId: 'AS-003', serviceSlug: 'pension-retirement', pillarId: 'Personal Services', commissionType: 'percentage', commissionValue: 0.5, isRegulated: true },
    { name: 'Private Healthcare Insurance', externalId: 'AS-004', serviceSlug: 'private-healthcare', pillarId: 'Personal Services', commissionType: 'fixed', commissionValue: 40, isRegulated: true },
    { name: 'Wealth Management', externalId: 'AS-005', serviceSlug: 'wealth-management', pillarId: 'Personal Services', commissionType: 'percentage', commissionValue: 0.5, isRegulated: true },
    { name: 'Wills & Trusts', externalId: 'AS-006', serviceSlug: 'wills-trusts', pillarId: 'Personal Services', commissionType: 'fixed', commissionValue: 30, isRegulated: false },
    { name: 'Life Insurance & Protection', externalId: 'AS-007', serviceSlug: 'life-insurance', pillarId: 'Personal Services', commissionType: 'fixed', commissionValue: 50, isRegulated: true },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for Master Seed');

        // Clear existing categories and rules to avoid duplication
        await Category.deleteMany({});
        await CommissionRule.deleteMany({});
        console.log('Cleared existing categories and rules');

        for (const catData of categories) {
            const category = await Category.create(catData);
            
            // Auto-create CommissionRule for each category based on seed data
            await CommissionRule.create({
                categoryId: category._id,
                type: (catData.commissionType === 'fixed' || catData.commissionType === 'tiered') ? 'fixed' : 'percentage',
                fixedAmount: catData.commissionType === 'fixed' ? catData.commissionValue : 0,
                percentage: catData.commissionType === 'percentage' ? catData.commissionValue : 0,
                wisemoveShare: 100,
                introducerShare: 0,
                triggerType: 'won'
            });
            
            console.log(`Seeded: ${catData.name} (${catData.externalId})`);
        }

        console.log(`Successfully seeded ${categories.length} master categories.`);
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err.message);
        process.exit(1);
    }
}

seed();
