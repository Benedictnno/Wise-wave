const express = require('express');
const router = express.Router();
const QualificationQuestion = require('../models/QualificationQuestion');
const Category = require('../models/Category');
const { evaluateQualification } = require('../services/qualificationEngine');

/**
 * GET /api/qualify/questions?pillarId=Business Services
 * Returns active questions for the flow.
 */
router.get('/questions', async (req, res) => {
    try {
        const { pillarId } = req.query;
        const filter = { isActive: true };
        if (pillarId) filter.pillarId = pillarId;
        
        const questions = await QualificationQuestion.find(filter)
            .sort({ priority: 1 });
        return res.json(questions);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/qualify
 * Evaluates a set of answers and returns the matched categories.
 */
router.post('/', async (req, res) => {
    try {
        const { answers } = req.body;
        if (!answers || !Array.isArray(answers)) return res.status(400).json({ error: 'Answers array required' });
        
        const activatedIds = await evaluateQualification(answers);
        
        // Fetch full category docs for these IDs
        const categories = await Category.find({ 
            externalId: { $in: activatedIds },
            isActive: true 
        });
        
        return res.json({
            count: categories.length,
            matches: categories.map(c => ({
                id: c._id,
                name: c.name,
                externalId: c.externalId,
                serviceSlug: c.serviceSlug,
                isRegulated: c.isRegulated
            }))
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
