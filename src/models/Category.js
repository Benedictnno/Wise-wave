const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    externalId: { type: Number, unique: true, sparse: true },
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, index: true },
    pillarId: { type: String, enum: ['Property Services', 'Business Services', 'Personal Services'], required: true },
    commissionType: {
        type: String,
        enum: ['percentage', 'flat', 'tiered'],
        required: true,
    },
    commissionValue: { type: Number, default: 0 }, // percentage (e.g. 10) or flat amount in £
    introducerSplit: { type: Number, default: 30 }, // % that goes to introducer
    description: { type: String, default: '' },
    notes: { type: String, default: '' },
    complianceText: { type: String, default: '' },
    isRegulated: { type: Boolean, default: false }, // triggers FCA disclaimer
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});

// Auto-generate slug from name before saving if not provided
categorySchema.pre('save', function() {
    if ((this.isModified('name') || this.isNew) && !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphen
            .replace(/(^-|-$)+/g, '');   // trim trailing/leading hyphens
    }
});

module.exports = mongoose.model('Category', categorySchema);
