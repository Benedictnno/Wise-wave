const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    externalId: { type: String, unique: true, required: true },
    serviceSlug: { type: String, unique: true, required: true },
    name: { type: String, required: true, trim: true },
    pillarId: { type: String, enum: ['Property Services', 'Business Services', 'Personal Services'], required: true },
    isExclusivity: { type: Boolean, default: false },
    commissionType: {
        type: String,
        enum: ['fixed', 'percentage', 'tiered'],
        required: true,
    },
    commissionValue: { type: Number, default: 0 },
    introducerSplit: { type: Number, default: 30 },
    description: { type: String, default: '' },
    notes: { type: String, default: '' },
    complianceText: { type: String, default: '' },
    isRegulated: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Category', categorySchema);
