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

/**
 * Tiered introducer split table (B2B leads only).
 * Based on monthly lead volume introduced.
 *
 * | Monthly Leads | Introducer Share | WiseMove Share |
 * |---------------|-----------------|----------------|
 * | 1–5           | 30%             | 70%            |
 * | 6–10          | 32%             | 68%            |
 * | 11–15         | 34%             | 66%            |
 * | 16+           | 35%             | 65%            |
 *
 * Attribution window: 12 months from introduction date.
 */
introducerSchema.statics.getTieredSplitPercent = function (monthlyLeadCount) {
    if (monthlyLeadCount >= 16) return 35;
    if (monthlyLeadCount >= 11) return 34;
    if (monthlyLeadCount >= 6)  return 32;
    return 30; // 1–5 leads (default)
};

module.exports = mongoose.model('Introducer', introducerSchema);
