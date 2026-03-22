const QualificationQuestion = require('../models/QualificationQuestion');
const Category = require('../models/Category');

/**
 * H-8: Rule evaluation for qualification rules.
 * Corrected 'in' logic: any of the user's answers are in rule.value.
 */
const evaluateRule = (operator, ruleValue, userAnswer) => {
    switch (operator) {
        case 'in':
            if (!Array.isArray(ruleValue)) return false;
            if (Array.isArray(userAnswer)) {
                // Return true if any selected answer is in the rule values
                return userAnswer.some(a => ruleValue.includes(a));
            }
            return ruleValue.includes(userAnswer);
        case 'equals':
            return userAnswer === ruleValue;
        default:
            return false;
    }
};

/**
 * Unified Qualification Engine (Phase 6 Master)
 * Maps user answers to activated Category documents.
 */
const evaluateQualification = async (answers) => {
    if (!answers || !Array.isArray(answers)) return [];
    
    const activatedIds = new Set();
    
    for (const ans of answers) {
        if (!ans.questionKey || !Array.isArray(ans.answerValues)) continue;

        const question = await QualificationQuestion.findOne({ 
            questionKey: ans.questionKey,
            isActive: true 
        });
        
        if (!question) continue;
        
        for (const val of ans.answerValues) {
            // Find option for this value
            const option = question.options.find(opt => opt.value === val);
            if (option && option.activatesServices) {
                option.activatesServices.forEach(id => activatedIds.add(id));
            }
        }
    }
    
    if (activatedIds.size === 0) return [];

    // Return full Category docs for integration with leads.js
    return await Category.find({ 
        externalId: { $in: Array.from(activatedIds) },
        isActive: true 
    });
};

module.exports = { evaluateQualification };
