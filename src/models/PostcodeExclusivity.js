const mongoose = require('mongoose');

/**
 * Stores exclusivity agreements where a single partner owns all leads 
 * for a specific category in a specific postcode (at Area, District, or Sector level).
 */
const postcodeExclusivitySchema = new mongoose.Schema({
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    postcode: { type: String, required: true, trim: true, uppercase: true }, // e.g. "NW", "NW1", "NW1 1"
    level: { 
        type: String, 
        enum: ['Area', 'District', 'Sector'], 
        required: true 
    },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});

// Ensure a category/postcode combination can only have ONE exclusive partner
postcodeExclusivitySchema.index({ categoryId: 1, postcode: 1 }, { unique: true });

module.exports = mongoose.model('PostcodeExclusivity', postcodeExclusivitySchema);
