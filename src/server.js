require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// ─── Route Imports ────────────────────────────────────────────────────────────
const leadsRoute = require('./routes/leads');
const categoriesRoute = require('./routes/categories');
const partnersRoute = require('./routes/partners');
const questionnaireRoute = require('./routes/questionnaire');
const introducersRoute = require('./routes/introducers');
const adminAuthRoute = require('./routes/admin/auth');
const adminPartnersRoute = require('./routes/admin/partners');
const adminLeadsRoute = require('./routes/admin/leads');
const adminCategoriesRoute = require('./routes/admin/categories');
const adminCommissionsRoute = require('./routes/admin/commissions');
const adminInvoicesRoute = require('./routes/admin/invoices');
const adminReportsRoute = require('./routes/admin/reports');
const adminSettingsRoute = require('./routes/admin/settings');
const adminQuestionnaireRoute = require('./routes/admin/questionnaire');
const { swaggerUi, swaggerSpec, uiOptions } = require('./config/swagger');

const app = express();

// ─── Connect Database ─────────────────────────────────────────────────────────
connectDB();

// ─── Cron Jobs ────────────────────────────────────────────────────────
const { initCronJobs } = require('./services/reportService');
initCronJobs();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        const allowed = process.env.ALLOWED_ORIGINS || '*';
        if (allowed === '*') return callback(null, true);
        
        const origins = allowed.split(',').map(o => o.trim());
        if (origins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const leadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many lead submissions — please try again later' },
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { error: 'Too many requests — please try again later' },
});

// ─── Body Parsing & Logging ───────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Public Routes ────────────────────────────────────────────────────────────
app.use('/api/leads', leadLimiter, leadsRoute);
app.use('/api/partners', leadLimiter, partnersRoute);
app.use('/api/partner-response', require('./routes/partnerResponse'));
app.use('/api/categories', categoriesRoute);
app.use('/api/questionnaire', questionnaireRoute);
app.use('/api/introducers', introducersRoute);

// ─── Admin Routes (all JWT-protected within their routers) ───────────────────
app.use('/admin/auth', adminLimiter, adminAuthRoute);
app.use('/admin/partners', adminLimiter, adminPartnersRoute);
app.use('/admin/leads', adminLimiter, adminLeadsRoute);
app.use('/admin/commissions', adminLimiter, adminCommissionsRoute);
app.use('/admin/reports', adminLimiter, adminReportsRoute);
app.use('/admin/categories', adminLimiter, adminCategoriesRoute);
app.use('/admin/invoices', adminLimiter, adminInvoicesRoute);
app.use('/admin/settings', adminLimiter, adminSettingsRoute);
app.use('/admin/questionnaire', adminLimiter, adminQuestionnaireRoute);

// ─── API Documentation ────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, uiOptions));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'WiseMove Connect API', timestamp: new Date().toISOString() });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[Error]', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`[Server] WiseMove Connect API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
