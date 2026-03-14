const mongoose = require('mongoose');

const introductionSchema = new mongoose.Schema({
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    deliveryMethod: { type: String, enum: ['email', 'sms', 'whatsapp'], required: true },
    deliveryStatus: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    fallbackUsed: { type: Boolean, default: false },
});

module.exports = mongoose.model('Introduction', introductionSchema);
