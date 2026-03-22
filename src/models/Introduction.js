const mongoose = require('mongoose');

const deliveryAttemptSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    method: { type: String, enum: ['email', 'sms', 'whatsapp'], required: true },
    status: { type: String, required: true }, // 'sent', 'failed'
    errorCode: { type: String, default: null },
    errorMessage: { type: String, default: null }
}, { _id: false });

const introductionSchema = new mongoose.Schema({
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    deliveryMethod: { type: String, enum: ['email', 'sms', 'whatsapp'], required: true },
    deliveryStatus: { type: String, enum: ['sent', 'failed', 'pending'], default: 'pending' },
    deliveryAttempts: [deliveryAttemptSchema],
    sentAt: { type: Date, default: Date.now },
    fallbackUsed: { type: Boolean, default: false },
});

module.exports = mongoose.model('Introduction', introductionSchema);
