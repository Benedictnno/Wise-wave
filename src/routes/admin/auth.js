const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const Admin = require('../../models/Admin');
const authMiddleware = require('../../middleware/auth');

/**
 * @openapi
 * /admin/auth/register:
 *   post:
 *     summary: Create a new admin
 *     description: Creates a new admin account. Requires a valid JWT token from an existing admin.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin created successfully
 *       400:
 *         description: Username already exists or validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
// POST /admin/auth/register
router.post(
    '/register',
    authMiddleware,
    [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    ],
    validate,
    async (req, res) => {
        try {
            const { username, password } = req.body;

            // Check if user already exists
            const existingAdmin = await Admin.findOne({ username });
            if (existingAdmin) {
                return res.status(400).json({ error: 'Username already exists' });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // Create new admin
            const newAdmin = await Admin.create({
                username,
                passwordHash
            });

            return res.status(201).json({
                message: 'Admin created successfully',
                admin: {
                    id: newAdmin._id,
                    username: newAdmin.username,
                    createdAt: newAdmin.createdAt
                }
            });
        } catch (err) {
            console.error('[POST /admin/auth/register]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/**
 * @openapi
 * /admin/auth/login:
 *   post:
 *     summary: Admin login
 *     description: Authenticates an admin user and returns a JWT token.
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
// POST /admin/auth/login
router.post(
    '/login',
    [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    validate,
    async (req, res) => {
        try {
            const { username, password } = req.body;
            const admin = await Admin.findOne({ username });
            if (!admin) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const match = await bcrypt.compare(password, admin.passwordHash);
            if (!match) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: admin._id, username: admin.username },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
            );

            return res.status(200).json({ token });
        } catch (err) {
            console.error('[POST /admin/auth/login]', err.message);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

module.exports = router;
