const mongoose = require('mongoose');

const leadServiceAnswerSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    question_key: { type: String, required: true },
    question_label: { type: String, required: true },
    answer_value: { type: mongoose.Schema.Types.Mixed, required: true }
});

module.exports = mongoose.model('LeadServiceAnswer', leadServiceAnswerSchema);
