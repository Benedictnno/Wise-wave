const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, required: true, trim: true },
        whatsappNumber: { type: String, trim: true, default: '' },
        categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
        postcodes: [{ type: String, trim: true, uppercase: true }],
        priority: { type: Number, required: true, default: 10 },
        status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    },
    { timestamps: true }
);

// Index for fast routing queries (MongoDB allows at most one array field per compound index)
partnerSchema.index({ categories: 1, status: 1, priority: 1 });

module.exports = mongoose.model('Partner', partnerSchema);
