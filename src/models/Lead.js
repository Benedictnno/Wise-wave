const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    postcode: { type: String, required: true, trim: true, uppercase: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    description: { type: String, default: '' },
    introducerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Introducer', default: null },
    assignedPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    status: { type: String, enum: ['assigned', 'unassigned'], default: 'unassigned' },
    assignedAt: { type: Date, default: null },
    outcomeToken: { type: String, unique: true, sparse: true },
    outcome: { type: String, enum: ['won', 'lost', 'not_suitable', null], default: null },
    partnerFee: { type: Number, default: 0 },
    adminNotes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Lead', leadSchema);
