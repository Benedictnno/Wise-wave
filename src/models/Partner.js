const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema(
    {
        companyName: { type: String, required: true, trim: true },
        contactName: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, required: true, trim: true },
        whatsappNumber: { type: String, trim: true, default: '' },
        preferredContactMethod: { type: String, enum: ['email', 'sms', 'whatsapp'], default: 'email' },
        backupDeliveryMethod: { type: String, enum: ['email', 'sms', 'whatsapp'], default: 'email' },
        categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
        subservices: [{ type: String }], // Array for R&D sub-categories
        postcodes: [{ type: String, trim: true, uppercase: true }],
        priority: { type: Number, required: true, default: 10 },
        status: { type: String, enum: ['active', 'inactive'], default: 'active' },
        agreementAccepted: { type: Boolean, required: true },
        agreementTimestamp: { type: Date, required: true },
        metadata: mongoose.Schema.Types.Mixed
    },
    { timestamps: true }
);

partnerSchema.index({ categories: 1, status: 1, priority: 1 });

module.exports = mongoose.model('Partner', partnerSchema);
