const mongoose = require('mongoose');

/**
 * Stores granular service types within a category (e.g. for R&D Tax: Software Development, 
 * Manufacturing, Engineering). Used for more precise partner matching and reporting.
 */
const subserviceSchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Subservice', subserviceSchema);
