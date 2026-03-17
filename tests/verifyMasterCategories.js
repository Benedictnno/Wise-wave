require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category');
const CommissionRule = require('../src/models/CommissionRule');
const CategoryRelationship = require('../src/models/CategoryRelationship');

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const categories = await Category.find().sort({ externalId: 1 });
        console.log(`Categories found: ${categories.length}`);

        if (categories.length !== 30) {
            console.error(`Verification FAILED: Expected 30 categories, found ${categories.length}`);
        } else {
            console.log('Category count: OK');
        }

        // Check specific category logic (e.g., Cat 28: Mortgage)
        const mortgage = categories.find(c => c.externalId === 28);
        if (mortgage && mortgage.isRegulated && mortgage.complianceText.includes('FCA-regulated')) {
            console.log('Category 28 (Mortgage) compliance: OK');
        } else {
            console.error('Category 28 (Mortgage) compliance: FAILED');
        }

        // Check commission rule for Cat 1 (Estate Agents - 25%)
        const eaCategory = categories.find(c => c.externalId === 1);
        const eaRule = await CommissionRule.findOne({ categoryId: eaCategory._id });
        if (eaRule && eaRule.percentage === 25 && eaRule.introducerShare === 30) {
            console.log('Category 1 Commission Rule: OK');
        } else {
            console.error('Category 1 Commission Rule: FAILED');
        }

        // Check relationships for Cat 28
        const rel = await CategoryRelationship.findOne({ categoryId: mortgage._id }).populate('relatedCategories', 'name');
        if (rel && rel.relatedCategories.length >= 3) {
            console.log(`Category 28 Relationships: OK (${rel.relatedCategories.length} found)`);
            console.log('Related:', rel.relatedCategories.map(r => r.name).join(', '));
        } else {
            console.error('Category 28 Relationships: FAILED');
        }

    } catch (err) {
        console.error('Verification Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
};

verify();
