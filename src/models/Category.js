const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    pillarId: { type: String, enum: ['Property Services', 'Business Services', 'Personal Services'], required: true },
    commissionType: {
        type: String,
        enum: ['percentage', 'flat', 'tiered'],
        required: true,
    },
    commissionValue: { type: Number, default: 0 }, // percentage (e.g. 10) or flat amount in £
    introducerSplit: { type: Number, default: 30 }, // % that goes to introducer
    description: { type: String, default: '' },
    complianceText: { type: String, default: '' },
    isRegulatedAdjacent: { type: Boolean, default: false }, // triggers FCA disclaimer
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Category', categorySchema);
