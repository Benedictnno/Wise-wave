require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const QualificationQuestion = require('../models/QualificationQuestion');

// Map: serviceSlug → array of question strings
const SERVICE_QUESTIONS = {
    'estate-agency': [
        'Are you selling, buying, or both?',
        'What is the full property address?',
        'What type of property is it?',
        'What is the estimated property value?',
        'Have you had a valuation already?',
        'Is the property currently occupied?',
        'Do you have a mortgage on the property?',
        'What is your target timescale?',
        'Have you chosen a solicitor yet?',
    ],
    'residential-property-management': [
        'What type of property requires management?',
        'What is the full property address?',
        'Is the property currently tenanted?',
        'Do you require full management or tenant-find only?',
        'Do you require rent collection?',
        'Do you require maintenance handling?',
        'Do you have existing compliance certificates?',
        'What is your target start date?',
    ],
    'commercial-property-management': [
        'What type of commercial property is this?',
        'What is the full property address?',
        'Is the property single or multi-let?',
        'Do you require full FM (facilities management)?',
        'Do you require rent collection?',
        'Do you require service charge management?',
        'Do you have existing compliance documentation?',
        'What is your target start date?',
    ],
    'trades': [
        'What type of trade service do you need?',
        'What is the full property address?',
        'Is this a repair, installation, or renovation?',
        'Is this urgent?',
        'Do you require materials supplied?',
        'Do you have drawings or measurements?',
        'What is your estimated budget?',
        'What is your target timescale?',
    ],
    'epc': [
        'What type of property is this for?',
        'What is the full property address?',
        'Is the property occupied?',
        'Do you require an EPC only or EPC + floorplan?',
        'What is your target timescale?',
    ],
    'floorplans': [
        'What type of property is this for?',
        'What is the full property address?',
        'Do you require 2D, 3D, or both?',
        'Approximate property size?',
        'Do you require measurements included?',
        'What is your target timescale?',
    ],
    'surveyors': [
        'What type of survey do you require?',
        'What is the full property address?',
        'Approximate age of the property?',
        'Is the property occupied?',
        'Any known issues?',
        'What is your target timescale?',
    ],
    'removals': [
        'What type of move is this?',
        'What is the collection address?',
        'What is the destination address?',
        'Approximate number of rooms/items?',
        'Do you require packing services?',
        'Do you require storage?',
        'What is your target move date?',
    ],
    'cleaning': [
        'What type of cleaning do you require?',
        'What is the full property address?',
        'Is this a one-off or ongoing service?',
        'Approximate property size?',
        'Do you require materials supplied?',
        'What is your target date?',
    ],
    'commercial-property-services': [
        'What type of commercial service do you require?',
        'What is the full property address?',
        'Is this a one-off or ongoing requirement?',
        'Do you have existing compliance documentation?',
        'What is your target timescale?',
    ],
    'solicitors-conveyancing': [
        'Are you buying, selling, or both?',
        'What is the full property address?',
        'Is the property freehold or leasehold?',
        'Do you have a mortgage?',
        'Have you accepted an offer?',
        'What is your target completion date?',
    ],
    'home-insurance': [
        'Are you renewing or switching?',
        'What type of property is this for?',
        'Approximate rebuild value?',
        'Do you require contents cover?',
        'Any previous claims?',
        'What is your target start date?',
    ],
    'auction-services': [
        'Are you buying or selling at auction?',
        'What is the full property address?',
        'Have you viewed the property?',
        'Do you require legal pack review?',
        'Do you require valuation support?',
        'What is your target auction date?',
    ],
    'inventory-check-in-out': [
        'What type of inventory service do you need?',
        'What is the full property address?',
        'Is the property furnished?',
        'Number of bedrooms?',
        'What is your target date?',
    ],
    'gas-electrical-safety-certs': [
        'Do you require CP12, EICR, or both?',
        'What is the full property address?',
        'Is the property occupied?',
        'Number of bedrooms?',
        'What is your target date?',
    ],
    'property-photography-videography': [
        'What type of media do you require?',
        'What is the full property address?',
        'Internal, external, or both?',
        'Do you require drone footage?',
        'What is your target date?',
    ],
    'property-legal-support': [
        'What type of legal support do you require?',
        'What is the full property address?',
        'Do you have existing documents?',
        'Is this urgent?',
        'What is your target timescale?',
    ],
    'wills-estate-planning': [
        'Do you require a new will or update?',
        'Do you require trust planning?',
        'Do you have existing documents?',
        'Are there children or dependents?',
        'What is your target timescale?',
    ],
    'aml-kyc': [
        'What type of AML/KYC support do you need?',
        'Business size?',
        'Do you have existing processes?',
        'What is your target timescale?',
    ],
    'business-insurance': [
        'What type of business insurance do you need?',
        'Business size?',
        'Industry sector?',
        'Renewal or new policy?',
        'What is your target start date?',
    ],
    'sme-ppi-insurance': [
        'What type of cover do you need?',
        'Business size?',
        'Renewal or new policy?',
        'What is your target start date?',
    ],
    'life-protection-insurance': [
        'What type of protection do you need?',
        'Cover amount?',
        'Any existing policies?',
        'Any health conditions?',
        'What is your target start date?',
    ],
    'private-healthcare-insurance': [
        'Individual or family cover?',
        'Any existing policy?',
        'Any pre-existing conditions?',
        'What is your target start date?',
    ],
    'insurance-risk': [
        'What type of risk support do you need?',
        'Business size?',
        'Existing policies?',
        'What is your target timescale?',
    ],
    'commercial-finance': [
        'What type of finance do you need?',
        'Approximate amount required?',
        'Business size?',
        'What is your target timescale?',
    ],
    'business-loans': [
        'What type of loan do you need?',
        'Approximate amount required?',
        'Business size?',
        'What is your target timescale?',
    ],
    'asset-finance': [
        'What type of asset?',
        'Approximate value?',
        'Business size?',
        'What is your target timescale?',
    ],
    'invoice-finance': [
        'Monthly turnover?',
        'Average invoice value?',
        'Do you have existing finance?',
        'What is your target timescale?',
    ],
    'development-finance': [
        'What type of development project?',
        'GDV (if known)?',
        'Loan amount required?',
        'What is your target timescale?',
    ],
    'bridging-finance': [
        'Purpose of the bridge?',
        'Loan amount required?',
        'Property address?',
        'What is your target timescale?',
    ],
    'mortgage-broker': [
        'Are you buying, remortgaging, or investing?',
        'Property value?',
        'Deposit amount?',
        'Employment status?',
        'What is your target timescale?',
    ],
    'ifa': [
        'What type of financial advice do you need?',
        'Approximate investable amount?',
        'Any existing adviser?',
        'What is your target timescale?',
    ],
    'gdpr-data-protection': [
        'What type of GDPR support do you need?',
        'Business size?',
        'Do you have existing policies?',
        'What is your target timescale?',
    ],
    'health-safety-consultancy': [
        'What type of H&S support do you need?',
        'Business size?',
        'Do you have existing documentation?',
        'What is your target timescale?',
    ],
    'cyber-security-consultancy': [
        'What type of cyber support do you need?',
        'Business size?',
        'Existing protections?',
        'What is your target timescale?',
    ],
    'iso-certification-support': [
        'Which ISO standard do you need support with?',
        'Business size?',
        'Do you have existing documentation?',
        'What is your target timescale?',
    ],
    'business-legal-services': [
        'What type of legal support do you need?',
        'Business size?',
        'Do you have documents ready?',
        'What is your target timescale?',
    ],
    'compliance-consultancy': [
        'What type of compliance support do you need?',
        'Business size?',
        'Existing policies?',
        'What is your target timescale?',
    ],
    'business-valuation': [
        'Purpose of valuation?',
        'Business size?',
        'Industry sector?',
        'What is your target timescale?',
    ],
    'tendering-bid-writing': [
        'What type of tender support do you need?',
        'Business size?',
        'Do you have existing documents?',
        'What is your target timescale?',
    ],
    'rd-tax-credits-advisory': [
        'Business size?',
        'Industry sector?',
        'Have you claimed before?',
        'What is your target timescale?',
    ],
    'grants-funding-consultancy': [
        'What type of funding do you need?',
        'Business size?',
        'Have you applied before?',
        'What is your target timescale?',
    ],
    'capital-allowances-advisory': [
        'Property or asset type?',
        'Approximate value?',
        'Do you have existing reports?',
        'What is your target timescale?',
    ],
    'specialist-advisory': [
        'What type of specialist support do you need?',
        'Business size?',
        'Existing documentation?',
        'What is your target timescale?',
    ],
    'hr-services': [
        'What HR support do you need?',
        'Business size?',
        'Do you have existing HR policies?',
        'Do you use HR software?',
        'What is your target timescale?',
    ],
    'payroll-services': [
        'How many employees?',
        'Weekly or monthly payroll?',
        'Do you use payroll software?',
        'Do you require pension processing?',
        'What is your target start date?',
    ],
    'accountancy-bookkeeping': [
        'What type of accounting support do you need?',
        'Business size?',
        'Do you use accounting software?',
        'Do you require VAT returns?',
        'What is your target timescale?',
    ],
    'marketing-services': [
        'What type of marketing support do you need?',
        'Do you have existing branding?',
        'Do you require content creation?',
        'What is your target timescale?',
    ],
    'web-design-digital-presence': [
        'What type of website do you need?',
        'Do you have branding?',
        'Do you require e-commerce?',
        'What is your target timescale?',
    ],
    'it-support-managed-services': [
        'What type of IT support do you need?',
        'Business size?',
        'Do you have existing systems?',
        'What is your target timescale?',
    ],
    'recruitment-services': [
        'What role(s) do you need to fill?',
        'Business size?',
        'Permanent, temporary, or contract?',
        'What is your target start date?',
    ],
    'marketing-digital-support': [
        'What type of digital support do you need?',
        'Do you have existing campaigns?',
        'Do you require content creation?',
        'What is your target timescale?',
    ],
};

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[QSeed] Connected to MongoDB');

        await QualificationQuestion.deleteMany({});
        console.log('[QSeed] Cleared existing qualification questions');

        let priority = 1;
        let totalSeeded = 0;

        for (const [slug, questions] of Object.entries(SERVICE_QUESTIONS)) {
            const category = await Category.findOne({ serviceSlug: slug });

            if (!category) {
                console.warn(`[QSeed] ⚠ Category not found for slug: ${slug} — run master55.seed.js first`);
                continue;
            }

            for (let i = 0; i < questions.length; i++) {
                await QualificationQuestion.create({
                    questionKey: `${slug}_q${i + 1}`,
                    text: questions[i],
                    type: 'select',
                    options: [],   // Options can be filled via admin panel
                    priority: priority++,
                    pillarId: category.pillarId,
                    isActive: true,
                });
                totalSeeded++;
            }

            console.log(`[QSeed] ✓ ${questions.length} questions seeded for: ${category.name} (${slug})`);
        }

        console.log(`\n[QSeed] Done. ${totalSeeded} qualification questions seeded across ${Object.keys(SERVICE_QUESTIONS).length} services.`);
        process.exit(0);
    } catch (err) {
        console.error('[QSeed] Error:', err.message);
        process.exit(1);
    }
}

seed();
