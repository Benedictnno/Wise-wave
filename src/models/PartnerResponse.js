const mongoose = require('mongoose');

const partnerResponseSchema = new mongoose.Schema({
    introductionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Introduction', required: true, unique: true },
    status: { type: String, enum: ['won', 'lost', 'not_suitable'], required: true },
    respondedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('PartnerResponse', partnerResponseSchema);
