const QualificationQuestion = require('../models/QualificationQuestion');

/**
 * Evaluates user answers against activation rules and returns 
 * a unique array of activated service externalIds.
 * 
 * @param {Array} answers - [{ questionKey, answerValues: [] }]
 * @returns {Promise<Array>} unique externalIds
 */
const evaluateQualification = async (answers) => {
    if (!answers || !Array.isArray(answers)) return [];
    
    const activatedIds = new Set();
    
    for (const ans of answers) {
        const question = await QualificationQuestion.findOne({ 
            questionKey: ans.questionKey,
            isActive: true 
        });
        
        if (!question) continue;
        
        for (const val of ans.answerValues) {
            const option = question.options.find(opt => opt.value === val);
            if (option && option.activatesServices) {
                option.activatesServices.forEach(id => activatedIds.add(id));
            }
        }
    }
    
    return Array.from(activatedIds);
};

module.exports = { evaluateQualification };
