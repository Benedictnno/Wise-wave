const QuestionnaireRule = require('../models/QuestionnaireRule');
const Category = require('../models/Category');

/**
 * Questionnaire Engine
 * Parses user answers and maps them to activated categories using DB-driven rules.
 *
 * @param {Array<{ questionKey: string, answerValues: string[] }>} answers
 * @returns {Promise<Array<Object>>} Unique array of fully populated Category documents
 */
const evaluateAnswers = async (answers) => {
    if (!answers || !Array.isArray(answers) || answers.length === 0) {
        return [];
    }

    // Load all active rules
    const activeRules = await QuestionnaireRule.find({ isActive: true });

    // We'll collect category IDs in a Set to ensure we don't activate the same category twice
    const activatedCategoryIds = new Set();

    for (const ans of answers) {
        if (!ans.questionKey || !Array.isArray(ans.answerValues)) continue;

        // Find rules matching this question
        const questionRules = activeRules.filter((r) => r.questionKey === ans.questionKey);

        for (const userVal of ans.answerValues) {
            // Find rules matching the specific answer
            const matchedRules = questionRules.filter((r) => r.answerValue === userVal);
            for (const rule of matchedRules) {
                activatedCategoryIds.add(rule.categoryId.toString());
            }
        }
    }

    if (activatedCategoryIds.size === 0) return [];

    // Fetch the actual Category documents for the activated IDs
    const categories = await Category.find({ _id: { $in: Array.from(activatedCategoryIds) }, isActive: true });

    return categories;
};

module.exports = { evaluateAnswers };
