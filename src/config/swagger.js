const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WiseMove Connect API",
      version: "1.0.0",
      description:
        "Backend API documentation for WiseMove Connect.\n\n" +
        "Auth:\n" +
        "- Admin endpoints require `Authorization: Bearer <jwt>`.\n" +
        "- Obtain a JWT via `POST /admin/auth/login`.\n\n" +
        "Error format:\n" +
        '- Most errors return `{ "error": "message" }`.\n' +
        '- Validation errors return `{ "errors": [ { "msg": "...", "path": "...", ... } ] }`.',
    },
    servers: [
      {
        url: process.env.BACKEND_URL || "http://localhost:5000",
        description: "API Server",
      },
    ],
    tags: [
      { name: "Health", description: "Service health checks" },
      { name: "Leads", description: "Public lead intake endpoints" },
      { name: "Categories", description: "Public service category endpoints" },
      { name: "Subservices", description: "Public subservice endpoints" },
      {
        name: "Qualification",
        description: "Public qualification flow endpoints",
      },
      {
        name: "Partners",
        description: "Public partner onboarding and partner actions",
      },
      { name: "Introducers", description: "Introducer portal endpoints" },
      { name: "Webhooks", description: "Inbound webhook endpoints" },
      { name: "Admin Auth", description: "Admin authentication" },
      { name: "Admin Leads", description: "Admin lead management" },
      { name: "Admin Partners", description: "Admin partner management" },
      { name: "Admin Categories", description: "Admin category management" },
      { name: "Admin Commissions", description: "Admin commission management" },
      { name: "Admin Invoices", description: "Admin invoice management" },
      { name: "Admin Reports", description: "Admin reporting and exports" },
      {
        name: "Admin Exclusivity",
        description: "Admin postcode exclusivity rules",
      },
      { name: "Admin Payouts", description: "Admin introducer payouts" },
      {
        name: "Admin Qualification",
        description: "Admin qualification question management",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string", example: "Internal server error" },
          },
        },
        ValidationError: {
          type: "object",
          properties: {
            type: { type: "string", example: "field" },
            msg: { type: "string", example: "Valid email is required" },
            path: { type: "string", example: "email" },
            location: { type: "string", example: "body" },
            value: { example: "not-an-email" },
          },
        },
        ValidationErrorsResponse: {
          type: "object",
          required: ["errors"],
          properties: {
            errors: {
              type: "array",
              items: { $ref: "#/components/schemas/ValidationError" },
            },
          },
        },
        PaginationMeta: {
          type: "object",
          required: ["total", "page", "limit"],
          properties: {
            total: { type: "integer", example: 123 },
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 50 },
          },
        },
        LeadSubmissionRequest: {
          type: "object",
          required: [
            "fullName",
            "email",
            "phone",
            "preferredContactMethod",
            "homePostcode",
            "bestTimeToContact",
            "serviceType",
            "additionalDetails",
            "budget",
            "urgency",
            "howDidYouHear",
            "understandIntroducer",
            "consentToShare",
            "agreePrivacyPolicy",
          ],
          properties: {
            fullName: { type: "string", example: "Jane Smith" },
            email: {
              type: "string",
              format: "email",
              example: "jane@example.com",
            },
            phone: { type: "string", example: "07700123456" },
            preferredContactMethod: {
              type: "string",
              enum: ["phone", "email", "either"],
              example: "either",
            },
            homePostcode: { type: "string", example: "SW1A 1AA" },
            propertyPostcode: { type: "string", example: "SW1A 2AA" },
            bestTimeToContact: {
              type: "string",
              enum: ["morning", "afternoon", "evening", "anytime"],
              example: "anytime",
            },
            serviceType: { type: "string", example: "Mortgage Broker" },
            serviceSpecificQuestions: {
              type: "object",
              additionalProperties: true,
              example: { propertyValue: "450000", hasExistingMortgage: true },
            },
            additionalDetails: {
              type: "string",
              example:
                "Looking for advice on a remortgage in the next 4–8 weeks.",
            },
            intentSignals: {
              type: "object",
              additionalProperties: true,
              example: { page: "mortgage", source: "google" },
            },
            budget: {
              type: "string",
              enum: ["5000_plus", "1000_4999", "500_999", "1_499", "not_sure"],
              example: "not_sure",
            },
            urgency: {
              type: "string",
              enum: [
                "asap",
                "48_hours",
                "1_week",
                "1_2_months",
                "3_plus_months",
                "researching",
              ],
              example: "1_2_months",
            },
            howDidYouHear: {
              type: "string",
              enum: ["estate_agent", "google", "social", "referral", "other"],
              example: "google",
            },
            fileUpload: {
              type: "array",
              items: {
                type: "object",
                required: ["fileName", "fileUrl"],
                properties: {
                  fileName: { type: "string", example: "payslip.pdf" },
                  fileType: { type: "string", example: "application/pdf" },
                  fileSize: { type: "integer", example: 123456 },
                  fileUrl: {
                    type: "string",
                    example: "https://files.example.com/payslip.pdf",
                  },
                },
              },
            },
            understandIntroducer: { type: "boolean", example: true },
            consentToShare: { type: "boolean", example: true },
            agreePrivacyPolicy: { type: "boolean", example: true },
            honeypot: { type: "string", example: "" },
            recaptchaToken: { type: "string", example: "03AFcWeA..." },
          },
        },
        LeadSubmissionResponse: {
          type: "object",
          required: ["message", "leadId", "referenceId", "status"],
          properties: {
            message: {
              type: "string",
              example: "Thanks — we'll match you shortly.",
            },
            leadId: { type: "string", example: "65f1234567890abcdef12345" },
            referenceId: { type: "string", example: "WMC-000123" },
            status: { type: "string", example: "assigned" },
          },
        },
      },
      responses: {
        BadRequest: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        ValidationError: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ValidationErrorsResponse" },
            },
          },
        },
        Unauthorized: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        NotFound: {
          description: "Not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        TooManyRequests: {
          description: "Rate limit exceeded",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        InternalServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
  },
  apis: [
    "./src/server.js",
    "./src/routes/*.js",
    "./src/routes/admin/*.js",
    "./src/routes/webhooks/*.js",
  ],
};

const swaggerSpec = swaggerJsdoc(options);

const uiOptions = {
  customSiteTitle: "WiseMove Connect API Documentation",
  customfavIcon: "/favicon.ico", // Placeholder if needed
};

module.exports = { swaggerUi, swaggerSpec, uiOptions };
