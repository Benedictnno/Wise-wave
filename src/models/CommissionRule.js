const mongoose = require('mongoose');

const commissionRuleSchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, unique: true },
    type: { type: String, enum: ['fixed', 'percentage'], required: true },
    fixedAmount: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    wisemoveShare: { type: Number, default: 100 },
    introducerShare: { type: Number, default: 0 },
    triggerType: { type: String, enum: ['won', 'instruction', 'booking', 'acceptance'], default: 'won' },
});

module.exports = mongoose.model('CommissionRule', commissionRuleSchema);
