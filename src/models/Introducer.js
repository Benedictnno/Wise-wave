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
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Introducer', introducerSchema);
