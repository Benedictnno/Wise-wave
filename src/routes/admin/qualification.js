const express = require('express');
const router = express.Router();
const QualificationQuestion = require('../../models/QualificationQuestion');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

/**
 * GET /admin/qualification
 */
router.get('/', async (req, res) => {
    try {
        const questions = await QualificationQuestion.find().sort({ priority: 1 });
        return res.json(questions);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /admin/qualification
 * Create/Update questions
 */
router.post('/', async (req, res) => {
    try {
        const { questionKey, text, type, options, priority, pillarId, isActive } = req.body;
        const questionData = { questionKey, text, type, options, priority, pillarId, isActive };
        const question = await QualificationQuestion.create(questionData);
        return res.status(201).json(question);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /admin/qualification/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        await QualificationQuestion.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Question deleted' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
