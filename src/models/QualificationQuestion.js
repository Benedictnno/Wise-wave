const mongoose = require('mongoose');

/**
 * Stores questions for the multi-step qualification flow.
 * Each answer can trigger the activation of specific services (via externalId).
 */
const qualificationQuestionSchema = new mongoose.Schema({
    questionKey: { type: String, required: true, unique: true },
    text: { type: String, required: true },
    type: { type: String, enum: ['select', 'multiselect', 'boolean'], default: 'select' },
    options: [{
        value: { type: String, required: true },
        label: { type: String, required: true },
        activatesServices: [{ type: String }], // Array of Category externalIds (e.g. ['BS-001', 'BS-004'])
    }],
    priority: { type: Number, default: 0 },
    pillarId: { type: String, enum: ['Property Services', 'Business Services', 'Personal Services'], required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('QualificationQuestion', qualificationQuestionSchema);
