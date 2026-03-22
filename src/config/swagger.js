const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WiseMove Connect API',
            version: '1.0.0',
            description: 'Automated Lead Introduction Platform Backend API Documentation',
        },
        servers: [
            {
                url: process.env.BACKEND_URL || 'http://localhost:5000',
                description: 'API Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/routes/*.js', './src/routes/admin/*.js'], // files containing annotations
};

const swaggerSpec = swaggerJsdoc(options);

const uiOptions = {
    customSiteTitle: 'WiseMove Connect API Documentation',
    customfavIcon: '/favicon.ico', // Placeholder if needed
};

module.exports = { swaggerUi, swaggerSpec, uiOptions };
