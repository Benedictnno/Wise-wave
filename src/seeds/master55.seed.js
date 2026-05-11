require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const CommissionRule = require('../models/CommissionRule');

const services = [

    // ── PILLAR 1: PROPERTY SERVICES (17 services) ─────────────────────────────
    {
        name: 'Estate Agency',
        externalId: 'HP-001', serviceSlug: 'estate-agency',
        pillarId: 'Property Services', commissionType: 'percentage',
        commissionValue: 7.5, isRegulated: false,
        description: 'Professional support for property sales, purchases, and market guidance.'
    },
    {
        name: 'Residential Property Management',
        externalId: 'HP-002', serviceSlug: 'residential-property-management',
        pillarId: 'Property Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'Day to day management services for residential landlords and tenants.'
    },
    {
        name: 'Commercial Property Management',
        externalId: 'HP-003', serviceSlug: 'commercial-property-management',
        pillarId: 'Property Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'Operational management services for commercial buildings and occupiers.'
    },
    {
        name: 'Trades',
        externalId: 'HP-004', serviceSlug: 'trades',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 20, isRegulated: false,
        description: 'Skilled tradespeople for repairs, maintenance, and property works.'
    },
    {
        name: 'EPC',
        externalId: 'HP-005', serviceSlug: 'epc',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 25, isRegulated: false,
        description: 'Accredited assessors providing Energy Performance Certificates for properties.'
    },
    {
        name: 'Floorplans',
        externalId: 'HP-006', serviceSlug: 'floorplans',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 20, isRegulated: false,
        description: 'Professional floorplan creation for sales, lettings, and marketing.'
    },
    {
        name: 'Surveyors',
        externalId: 'HP-007', serviceSlug: 'surveyors',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 30, isRegulated: false,
        description: 'Qualified surveyors for property inspections, reports, and valuations.'
    },
    {
        name: 'Removals',
        externalId: 'HP-008', serviceSlug: 'removals',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 20, isRegulated: false,
        description: 'Professional moving and relocation services for homes and businesses.'
    },
    {
        name: 'Cleaning',
        externalId: 'HP-009', serviceSlug: 'cleaning',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 15, isRegulated: false,
        description: 'Specialist cleaning services for residential and commercial properties.'
    },
    {
        name: 'Commercial Property Services',
        externalId: 'HP-010', serviceSlug: 'commercial-property-services',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 25, isRegulated: false,
        description: 'Support services for commercial buildings, occupiers, and landlords.'
    },
    {
        name: 'Solicitors / Conveyancing',
        externalId: 'HP-011', serviceSlug: 'solicitors-conveyancing',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 50, isRegulated: false,
        description: 'Legal support for property sales, purchases, and transfers.'
    },
    {
        name: 'Home Insurance (Intro Only)',
        externalId: 'HP-012', serviceSlug: 'home-insurance',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: true,
        description: 'Introductions to home insurance specialists for property protection.'
    },
    {
        name: 'Auction Services',
        externalId: 'HP-013', serviceSlug: 'auction-services',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 25, isRegulated: false,
        description: 'Property auction support for buyers, sellers, and investors.'
    },
    {
        name: 'Inventory & Check In / Check Out',
        externalId: 'HP-014', serviceSlug: 'inventory-check-in-out',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 15, isRegulated: false,
        description: 'Independent inventory and tenancy check services for landlords and agents.'
    },
    {
        name: 'Gas Safety & Electrical Safety Certificates',
        externalId: 'HP-015', serviceSlug: 'gas-electrical-safety-certs',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 15, isRegulated: false,
        description: 'Certified engineers providing CP12 and EICR safety checks.'
    },
    {
        name: 'Property Photography / Videography / Virtual Tours',
        externalId: 'HP-016', serviceSlug: 'property-photography-videography',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 20, isRegulated: false,
        description: 'Professional media services for property marketing.'
    },
    {
        name: 'Property Legal Support (Admin Only)',
        externalId: 'HP-017', serviceSlug: 'property-legal-support',
        pillarId: 'Property Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Administrative legal support for property related documentation and processes.'
    },

    // ── PILLAR 2: PERSONAL & ADVISORY SERVICES (30 services) ─────────────────
    {
        name: 'Wills & Estate Planning',
        externalId: 'PA-001', serviceSlug: 'wills-estate-planning',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 30, isRegulated: false,
        description: 'Specialist advice on wills, trusts, and estate planning.'
    },
    {
        name: 'AML / KYC',
        externalId: 'PA-002', serviceSlug: 'aml-kyc',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Anti money laundering and identity verification advisory services.'
    },
    {
        name: 'Business Insurance (Intro Only)',
        externalId: 'PA-003', serviceSlug: 'business-insurance',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: true,
        description: 'Introductions to business insurance specialists for commercial cover.'
    },
    {
        name: 'SME / PPI Insurance (Intro Only)',
        externalId: 'PA-004', serviceSlug: 'sme-ppi-insurance',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: true,
        description: 'Introductions to SME and PPI insurance providers.'
    },
    {
        name: 'Life / Protection Insurance (Intro Only)',
        externalId: 'PA-005', serviceSlug: 'life-protection-insurance',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 50, isRegulated: true,
        description: 'Introductions to life and protection insurance specialists.'
    },
    {
        name: 'Private Healthcare Insurance (Intro Only)',
        externalId: 'PA-006', serviceSlug: 'private-healthcare-insurance',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 40, isRegulated: true,
        description: 'Introductions to private healthcare insurance providers.'
    },
    {
        name: 'Insurance & Risk (Intro Only)',
        externalId: 'PA-007', serviceSlug: 'insurance-risk',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: true,
        description: 'Introductions to insurance and risk management specialists.'
    },
    {
        name: 'Commercial Finance (Intro Only)',
        externalId: 'PA-008', serviceSlug: 'commercial-finance',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 1.5, isRegulated: true,
        description: 'Introductions to commercial finance providers for business funding.'
    },
    {
        name: 'Business Loans (Intro Only)',
        externalId: 'PA-009', serviceSlug: 'business-loans',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 1.5, isRegulated: true,
        description: 'Introductions to lenders offering business loan solutions.'
    },
    {
        name: 'Asset Finance (Intro Only)',
        externalId: 'PA-010', serviceSlug: 'asset-finance',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 1.5, isRegulated: true,
        description: 'Introductions to asset finance providers for equipment and vehicles.'
    },
    {
        name: 'Invoice Finance (Intro Only)',
        externalId: 'PA-011', serviceSlug: 'invoice-finance',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 1.5, isRegulated: false,
        description: 'Introductions to invoice finance specialists for cashflow support.'
    },
    {
        name: 'Development Finance (Intro Only)',
        externalId: 'PA-012', serviceSlug: 'development-finance',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 1.5, isRegulated: false,
        description: 'Introductions to development finance lenders for property projects.'
    },
    {
        name: 'Bridging Finance (Intro Only)',
        externalId: 'PA-013', serviceSlug: 'bridging-finance',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 1.5, isRegulated: false,
        description: 'Introductions to bridging finance providers for short term funding.'
    },
    {
        name: 'Mortgage Broker (Intro Only)',
        externalId: 'PA-014', serviceSlug: 'mortgage-broker',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 50, isRegulated: true,
        description: 'Introductions to mortgage brokers for residential and commercial lending.',
        complianceText: 'WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.'
    },
    {
        name: 'Independent Financial Adviser (Intro Only)',
        externalId: 'PA-015', serviceSlug: 'ifa',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 0.5, isRegulated: true,
        description: 'Introductions to IFAs for financial planning and investment advice.',
        complianceText: 'WiseMove Connect provides introductions only and does not offer mortgage or financial advice. All regulated activity is handled directly by the FCA-regulated adviser.'
    },
    {
        name: 'GDPR / Data Protection Consultancy',
        externalId: 'PA-016', serviceSlug: 'gdpr-data-protection',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Advisory support on GDPR compliance and data protection practices.'
    },
    {
        name: 'Health & Safety Consultancy',
        externalId: 'PA-017', serviceSlug: 'health-safety-consultancy',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Specialist consultancy on workplace health and safety requirements.'
    },
    {
        name: 'Cyber Security Consultancy',
        externalId: 'PA-018', serviceSlug: 'cyber-security-consultancy',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Advisory services for cyber security risk and protection.'
    },
    {
        name: 'ISO Certification Support',
        externalId: 'PA-019', serviceSlug: 'iso-certification-support',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Guidance and support for achieving ISO standards and accreditation.'
    },
    {
        name: 'Business Legal Services',
        externalId: 'PA-020', serviceSlug: 'business-legal-services',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'Legal support for commercial contracts, disputes, and business matters.'
    },
    {
        name: 'Compliance Consultancy (Non FCA)',
        externalId: 'PA-021', serviceSlug: 'compliance-consultancy',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Advisory support on regulatory and operational compliance.'
    },
    {
        name: 'Business Valuation Services',
        externalId: 'PA-022', serviceSlug: 'business-valuation',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Professional business valuation for planning, sale, or investment.'
    },
    {
        name: 'Tendering & Bid Writing Support',
        externalId: 'PA-023', serviceSlug: 'tendering-bid-writing',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 10, isRegulated: false,
        description: 'Specialist support for tender submissions and bid writing.'
    },
    {
        name: 'R&D Tax Credits Advisory',
        externalId: 'PA-024', serviceSlug: 'rd-tax-credits-advisory',
        pillarId: 'Personal Services', commissionType: 'tiered',
        commissionValue: 20, isRegulated: false,
        description: 'Advisory support for R&D tax credit claims and eligibility.'
    },
    {
        name: 'Grants & Funding Consultancy',
        externalId: 'PA-025', serviceSlug: 'grants-funding-consultancy',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 15, isRegulated: false,
        description: 'Guidance on business grants, funding options, and applications.'
    },
    {
        name: 'Capital Allowances Advisory',
        externalId: 'PA-026', serviceSlug: 'capital-allowances-advisory',
        pillarId: 'Personal Services', commissionType: 'percentage',
        commissionValue: 20, isRegulated: false,
        description: 'Specialist advice on capital allowances and tax relief opportunities.'
    },
    {
        name: 'Specialist Advisory (incl. AML/KYC)',
        externalId: 'PA-027', serviceSlug: 'specialist-advisory',
        pillarId: 'Personal Services', commissionType: 'fixed',
        commissionValue: 35, isRegulated: false,
        description: 'Niche advisory services covering specialist regulatory and operational areas.'
    },

    // ── PILLAR 3: BUSINESS SUPPORT SERVICES (8 services) ─────────────────────
    {
        name: 'HR Services',
        externalId: 'BS-001', serviceSlug: 'hr-services',
        pillarId: 'Business Services', commissionType: 'percentage',
        commissionValue: 15, isRegulated: false,
        description: 'HR support for people management, policies, and workplace processes.'
    },
    {
        name: 'Payroll Services',
        externalId: 'BS-002', serviceSlug: 'payroll-services',
        pillarId: 'Business Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'Payroll processing and compliance support for businesses.'
    },
    {
        name: 'Accountancy & Bookkeeping',
        externalId: 'BS-003', serviceSlug: 'accountancy-bookkeeping',
        pillarId: 'Business Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'Accounting, bookkeeping, and financial record keeping services.'
    },
    {
        name: 'Marketing Services / Marketing & Media',
        externalId: 'BS-004', serviceSlug: 'marketing-services',
        pillarId: 'Business Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'Marketing, branding, and media support for business growth.'
    },
    {
        name: 'Web Design & Digital Presence',
        externalId: 'BS-005', serviceSlug: 'web-design-digital-presence',
        pillarId: 'Business Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'Website design and digital presence services for SMEs.'
    },
    {
        name: 'IT Support & Managed Services',
        externalId: 'BS-006', serviceSlug: 'it-support-managed-services',
        pillarId: 'Business Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'IT support, systems management, and technical assistance.'
    },
    {
        name: 'Recruitment Services',
        externalId: 'BS-007', serviceSlug: 'recruitment-services',
        pillarId: 'Business Services', commissionType: 'percentage',
        commissionValue: 15, isRegulated: false,
        description: 'Recruitment support for hiring permanent, temporary, or specialist roles.'
    },
    {
        name: 'Marketing / Digital Support',
        externalId: 'BS-008', serviceSlug: 'marketing-digital-support',
        pillarId: 'Business Services', commissionType: 'percentage',
        commissionValue: 12, isRegulated: false,
        description: 'Digital marketing and online growth services for SMEs.'
    },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[Seed] Connected to MongoDB');

        await Category.deleteMany({});
        await CommissionRule.deleteMany({});
        console.log('[Seed] Cleared existing categories and commission rules');

        for (const svc of services) {
            const cat = await Category.create({
                externalId: svc.externalId,
                serviceSlug: svc.serviceSlug,
                name: svc.name,
                pillarId: svc.pillarId,
                commissionType: svc.commissionType,
                commissionValue: svc.commissionValue,
                isRegulated: svc.isRegulated || false,
                description: svc.description || '',
                complianceText: svc.complianceText || '',
                isActive: true,
            });

            await CommissionRule.create({
                categoryId: cat._id,
                type: svc.commissionType === 'percentage' ? 'percentage' : svc.commissionType === 'tiered' ? 'tiered' : 'fixed',
                fixedAmount: svc.commissionType === 'fixed' ? svc.commissionValue : 0,
                percentage: (svc.commissionType === 'percentage' || svc.commissionType === 'tiered') ? svc.commissionValue : 0,
                wisemoveShare: 30,
                introducerShare: 70,
                triggerType: 'won',
            });

            console.log(`[Seed] ✓ ${svc.externalId} — ${svc.name}`);
        }

        console.log(`\n[Seed] Done. ${services.length} services seeded.`);
        process.exit(0);
    } catch (err) {
        console.error('[Seed] Error:', err.message);
        process.exit(1);
    }
}

seed();
