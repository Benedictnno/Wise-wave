require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../src/models/Category');

const verify = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const categories = await Category.find();
        console.log(`Verified ${categories.length} categories.`);

        const types = [...new Set(categories.map(c => c.pillarId))];
        console.log('Unique Category Types found:', types);

        const expectedTypes = ['Property Services', 'Business Services', 'Personal Services'];
        const missing = expectedTypes.filter(t => !types.includes(t));
        
        if (missing.length === 0) {
            console.log('All 3 requested types are present in categories: SUCCESS');
        } else {
            console.warn('Missing types in current categories:', missing);
        }

    } catch (err) {
        console.error('Verification Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
};

verify();
