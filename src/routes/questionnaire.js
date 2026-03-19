const express = require('express');
const router = express.Router();
const Question = require('../models/Question');

/**
 * @openapi
 * /api/questionnaire:
 *   get:
 *     summary: Get all active questionnaire questions
 *     description: Returns a list of all active questions and their options, ordered by their defined order.
 *     tags: [Questionnaire]
 *     parameters:
 *       - in: query
 *         name: pillar
 *         schema:
 *           type: string
 *           enum: [Business Services, Property Services, Both]
 *         description: Optional filter by pillar
 *     responses:
 *       200:
 *         description: List of active questions
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
    try {
        const filter = { isActive: true };
        if (req.query.pillar) {
            filter.pillar = { $in: [req.query.pillar, 'Both'] };
        }

        const questions = await Question.find(filter)
            .sort({ order: 1 })
            .select('-__v');

        return res.status(200).json(questions);
    } catch (err) {
        console.error('[GET /api/questionnaire]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
