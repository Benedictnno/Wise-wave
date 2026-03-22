const mongoose = require('mongoose');
const crypto = require('crypto');

const introducerSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    publicToken: {
        type: String,
        unique: true,
        default: () => crypto.randomBytes(16).toString('hex'),
    },
    isActive: { type: Boolean, default: true },
    // Rolling 12-month lead count — used to calculate tiered introducer split.
    // Updated atomically each time a lead is attributed to this introducer.
    leadsThisMonth: { type: Number, default: 0 },
    leadsMonthReset: { type: Date, default: () => new Date() },
    createdAt: { type: Date, default: Date.now },
});


module.exports = mongoose.model('Introducer', introducerSchema);
