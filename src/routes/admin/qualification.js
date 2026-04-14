const express = require('express');
const router = express.Router();
const QualificationQuestion = require('../../models/QualificationQuestion');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../../middleware/auth');

router.use(authMiddleware);

/**
 * GET /admin/qualification
 */
/**
 * @openapi
 * /admin/qualification:
 *   get:
 *     summary: List qualification questions
 *     tags: [Admin Qualification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Qualification question list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { type: object }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
/**
 * @openapi
 * /admin/qualification:
 *   post:
 *     summary: Create a qualification question
 *     tags: [Admin Qualification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionKey, text, type, options, pillarId]
 *             properties:
 *               questionKey: { type: string, example: "business_stage" }
 *               text: { type: string, example: "What stage is your business at?" }
 *               type: { type: string, enum: [select, multiselect, boolean], example: "select" }
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [value, label]
 *                   properties:
 *                     value: { type: string, example: "startup" }
 *                     label: { type: string, example: "Startup" }
 *                     activatesServices:
 *                       type: array
 *                       items: { type: string, example: "svc_025" }
 *               priority: { type: integer, example: 10 }
 *               pillarId: { type: string, enum: [Property Services, Business Services, Personal Services], example: "Business Services" }
 *               isActive: { type: boolean, example: true }
 *     responses:
 *       201:
 *         description: Question created
 *         content:
 *           application/json:
 *             schema: { type: object }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
/**
 * @openapi
 * /admin/qualification/{id}:
 *   delete:
 *     summary: Delete a qualification question
 *     tags: [Admin Qualification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [message]
 *               properties:
 *                 message: { type: string, example: "Question deleted" }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/TooManyRequests'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
