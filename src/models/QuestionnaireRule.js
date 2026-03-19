const mongoose = require('mongoose');

/**
 * QuestionnaireRule model.
 * Maps a specific answer to a specific category activation.
 * The rule engine evaluates an array of { questionKey, answerValue } against these rules.
 */
const ruleSchema = new mongoose.Schema({
    // The short key of the Question being evaluated (e.g., 'business_challenge')
    questionKey: { type: String, required: true, trim: true },

    // The specific answer value that triggers this rule (e.g., 'need_funding')
    answerValue: { type: String, required: true, trim: true },

    // The Category ID to activate when this rule matches
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },

    // Whether this rule is currently in effect
    isActive: { type: Boolean, default: true },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('QuestionnaireRule', ruleSchema);
