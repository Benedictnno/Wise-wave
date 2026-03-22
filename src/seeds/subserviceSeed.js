const mongoose = require('mongoose');
const Category = require('../models/Category');
const Subservice = require('../models/Subservice');
require('dotenv').config();

const subservices = [
    { name: 'Software Development', slug: 'rd-software-development', description: 'Technological advancements in codebases and algorithms.' },
    { name: 'Manufacturing & Engineering', slug: 'rd-manufacturing-engineering', description: 'Process improvements in production lines and mechanical designs.' },
    { name: 'Scientific Research', slug: 'rd-scientific-research', description: 'Laboratory-based experimentation and testing.' },
    { name: 'Biotech & Life Sciences', slug: 'rd-biotech-life-sciences', description: 'Innovation in biological products or medical devices.' },
    { name: 'Electronics & Hardware', slug: 'rd-electronics-hardware', description: 'Developing new circuit designs or physical technology components.' },
    { name: 'Digital & Creative Tech', slug: 'rd-digital-creative-tech', description: 'Advanced rendering, AR/VR engineering, or data science tools.' },
    { name: 'Specialist Advisory (Other)', slug: 'rd-specialist-advisory', description: 'R&D projects falling outside of common sector buckets.' },
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected for Subservice Seed');

        const rdCategory = await Category.findOne({ serviceSlug: 'rd-tax-credits' });
        if (!rdCategory) {
            console.error('Master RD category not found. Seed master categories first.');
            process.exit(1);
        }

        await Subservice.deleteMany({ categoryId: rdCategory._id });
        console.log('Cleared existing R&D subservices');

        for (const s of subservices) {
            await Subservice.create({ 
                ...s, 
                categoryId: rdCategory._id 
            });
            console.log(`Seeded R&D Subservice: ${s.name}`);
        }

        console.log('Successfully seeded 7 subservices.');
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err.message);
        process.exit(1);
    }
}

seed();
