const mongoose = require('mongoose');

/**
 * Question model — represents a single qualifying question shown to the SME user.
 *
 * Each question has a set of answer options. One or more answers can be selected
 * (some questions are single-select, others multi-select).
 *
 * The questionnaire engine evaluates answers against QuestionnaireRules to determine
 * which service categories should be activated for a given submission.
 */
const answerOptionSchema = new mongoose.Schema({
    value: { type: String, required: true, trim: true },  // Machine key, e.g. 'limited_company'
    label: { type: String, required: true, trim: true },  // User-facing text, e.g. 'Limited Company'
}, { _id: false });

const questionSchema = new mongoose.Schema({
    // Short identifier for use in rule conditions — e.g. 'business_structure'
    key: { type: String, required: true, unique: true, trim: true },

    // User-facing question text
    text: { type: String, required: true, trim: true },

    // Optional explanatory subtext
    hint: { type: String, default: '' },

    // Whether the user can select multiple answers
    multiSelect: { type: Boolean, default: false },

    // Ordered list of answer options
    options: { type: [answerOptionSchema], required: true },

    // Display order in the questionnaire flow (lower = shown first)
    order: { type: Number, default: 0 },

    // Whether this question is shown in the current questionnaire
    isActive: { type: Boolean, default: true },

    // Which pillar this question belongs to (affects display routing)
    pillar: {
        type: String,
        enum: ['Business Services', 'Property Services', 'Both'],
        default: 'Business Services',
    },

    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Question', questionSchema);
