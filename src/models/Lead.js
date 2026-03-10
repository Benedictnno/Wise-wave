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
    adminNotes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Lead', leadSchema);
