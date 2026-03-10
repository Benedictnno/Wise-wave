const mongoose = require('mongoose');

const deliveryLogSchema = new mongoose.Schema({
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true },
    emailSent: { type: Boolean, default: false },
    emailTimestamp: { type: Date, default: null },
    emailError: { type: String, default: null },
    smsSent: { type: Boolean, default: false },
    smsTimestamp: { type: Date, default: null },
    smsError: { type: String, default: null },
    whatsappSent: { type: Boolean, default: false },
    whatsappTimestamp: { type: Date, default: null },
    whatsappError: { type: String, default: null },
});

module.exports = mongoose.model('DeliveryLog', deliveryLogSchema);
