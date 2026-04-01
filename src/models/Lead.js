const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    referenceId: { type: String, unique: true, required: true },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true, default: '' },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    postcode: { type: String, required: true, trim: true, uppercase: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    subservices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subservice' }], // Array for R&D sub-categories
    description: { type: String, default: '' },
    urgency: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    budgetRange: { type: String, default: '' },
    preferredContactTime: { type: String, enum: ['anytime', 'morning', 'afternoon', 'evening'], default: 'anytime' },
    introducerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Introducer', default: null },
    assignedPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    status: { type: String, enum: ['assigned', 'unassigned'], default: 'unassigned' },
    assignedAt: { type: Date, default: null },
    consentAccepted: { type: Boolean, required: true },
    consentTimestamp: { type: Date, required: true },
    formSource: { type: String, enum: ['category_page', 'request_service', 'introducer_form', 'qualification_flow'], required: true },
    outcomeToken: { type: String, unique: true, sparse: true },
    outcomeTokenExpiry: { type: Date, default: null },
    revenueToken: { type: String, unique: true, sparse: true },
    outcome: { type: String, enum: ['won', 'lost', 'not_suitable', null], default: null },
    partnerFeeTotal: { type: Number, default: 0 },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    paymentStatus: {
        type: String,
        enum: ['not_invoiced', 'invoiced', 'paid', 'reversed'],
        default: 'not_invoiced',
    },
    createdAt: { type: Date, default: Date.now },
});


leadSchema.index({ email: 1, category: 1, createdAt: -1 }); // For H-7 duplicate check
leadSchema.index({ status: 1, createdAt: -1 }); // L-3 fix
leadSchema.index({ assignedPartnerId: 1 }); // L-3 fix

module.exports = mongoose.model('Lead', leadSchema);
