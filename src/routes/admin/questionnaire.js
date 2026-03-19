const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const authMiddleware = require('../../middleware/auth');
const Question = require('../../models/Question');
const QuestionnaireRule = require('../../models/QuestionnaireRule');

router.use(authMiddleware);

// --- Questions ---

router.get('/questions', async (req, res) => {
    try {
        const questions = await Question.find().sort({ order: 1 });
        return res.status(200).json(questions);
    } catch (err) {
        console.error('[GET /admin/questionnaire/questions]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post(
    '/questions',
    [
        body('key').trim().notEmpty().withMessage('Key is required'),
        body('text').trim().notEmpty().withMessage('Text is required'),
        body('options').isArray({ min: 1 }).withMessage('At least one option is required'),
    ],
    validate,
    async (req, res) => {
        try {
            const question = await Question.create(req.body);
            return res.status(201).json(question);
        } catch (err) {
            console.error('[POST /admin/questionnaire/questions]', err.message);
            if (err.code === 11000) {
                return res.status(400).json({ error: 'Question key already exists' });
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

router.put('/questions/:id', async (req, res) => {
    try {
        const question = await Question.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!question) return res.status(404).json({ error: 'Question not found' });
        return res.status(200).json(question);
    } catch (err) {
        console.error('[PUT /admin/questionnaire/questions/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/questions/:id', async (req, res) => {
    try {
        const question = await Question.findByIdAndDelete(req.params.id);
        if (!question) return res.status(404).json({ error: 'Question not found' });
        // Optionally: also delete rules pointing to this questionKey to prevent orphaned rules
        await QuestionnaireRule.deleteMany({ questionKey: question.key });
        return res.status(200).json({ message: 'Question and associated rules deleted' });
    } catch (err) {
        console.error('[DELETE /admin/questionnaire/questions/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Rules ---

router.get('/rules', async (req, res) => {
    try {
        const rules = await QuestionnaireRule.find().populate('categoryId', 'name');
        return res.status(200).json(rules);
    } catch (err) {
        console.error('[GET /admin/questionnaire/rules]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post(
    '/rules',
    [
        body('questionKey').trim().notEmpty().withMessage('Question key is required'),
        body('answerValue').trim().notEmpty().withMessage('Answer value is required'),
        body('categoryId').isMongoId().withMessage('Valid category ID is required'),
    ],
    validate,
    async (req, res) => {
        try {
            const rule = await QuestionnaireRule.create(req.body);
            await rule.populate('categoryId', 'name');
            return res.status(201).json(rule);
        } catch (err) {
            console.error('[POST /admin/questionnaire/rules]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

router.put('/rules/:id', async (req, res) => {
    try {
        const rule = await QuestionnaireRule.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate('categoryId', 'name');
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        return res.status(200).json(rule);
    } catch (err) {
        console.error('[PUT /admin/questionnaire/rules/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/rules/:id', async (req, res) => {
    try {
        const rule = await QuestionnaireRule.findByIdAndDelete(req.params.id);
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        return res.status(200).json({ message: 'Rule deleted' });
    } catch (err) {
        console.error('[DELETE /admin/questionnaire/rules/:id]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
