const express = require('express');
const router = express.Router();
const QualificationQuestion = require('../models/QualificationQuestion');
const Category = require('../models/Category');
const { evaluateQualification } = require('../services/qualificationEngine');

/**
 * GET /api/qualify/questions?pillarId=Business Services
 * Returns active questions for the flow.
 */
/**
 * @openapi
 * /api/qualify/questions:
 *   get:
 *     summary: Get qualification questions
 *     description: Returns active questions for the multi-step qualification flow, optionally filtered by pillar.
 *     tags: [Qualification]
 *     parameters:
 *       - in: query
 *         name: pillarId
 *         required: false
 *         schema:
 *           type: string
 *           enum: [Property Services, Business Services, Personal Services]
 *         description: Filters questions to a pillar flow.
 *     responses:
 *       200:
 *         description: List of qualification questions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string, example: "65f1234567890abcdef12345" }
 *                   questionKey: { type: string, example: "business_stage" }
 *                   text: { type: string, example: "What stage is your business at?" }
 *                   type: { type: string, enum: [select, multiselect, boolean] }
 *                   options:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         value: { type: string, example: "startup" }
 *                         label: { type: string, example: "Startup" }
 *                         activatesServices:
 *                           type: array
 *                           items: { type: string, example: "svc_025" }
 *                   priority: { type: integer, example: 10 }
 *                   pillarId: { type: string, example: "Business Services" }
 *                   isActive: { type: boolean, example: true }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
/**
 * @openapi
 * /api/qualify:
 *   post:
 *     summary: Evaluate qualification answers
 *     description: >
 *       Evaluates a set of answers and returns matched active categories. The client should send one entry per
 *       answered question, keyed by `questionKey`. The engine maps answers to category `externalId`s.
 *     tags: [Qualification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [questionKey, answer]
 *                   properties:
 *                     questionKey: { type: string, example: "business_stage" }
 *                     answer:
 *                       oneOf:
 *                         - { type: string, example: "startup" }
 *                         - { type: boolean, example: true }
 *                         - { type: array, items: { type: string }, example: ["startup", "growth"] }
 *           examples:
 *             simple:
 *               value:
 *                 answers:
 *                   - questionKey: "business_stage"
 *                     answer: "growth"
 *                   - questionKey: "needs_funding"
 *                     answer: true
 *     responses:
 *       200:
 *         description: Matched categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [count, matches]
 *               properties:
 *                 count: { type: integer, example: 2 }
 *                 matches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, example: "65f1234567890abcdef12345" }
 *                       name: { type: string, example: "R&D Tax Credits" }
 *                       externalId: { type: string, example: "svc_025" }
 *                       serviceSlug: { type: string, example: "rd-tax-credits" }
 *                       isRegulated: { type: boolean, example: false }
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
