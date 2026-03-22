const express = require('express');
const router = express.Router();
const QualificationQuestion = require('../../models/QualificationQuestion');
const { body, validationResult } = require('express-validator');

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
        const question = await QualificationQuestion.create(req.body);
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
