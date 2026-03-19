const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Partner = require('../models/Partner');
const cloudinary = require('../config/cloudinary');

/**
 * Generate a sequential invoice number of the form INV-00001.
 * Uses an atomic MongoDB counter to guarantee uniqueness.
 * @returns {Promise<string>}
 */
const nextInvoiceNumber = async () => {
    const seq = await Counter.nextSequence('invoice');
    return `INV-${String(seq).padStart(5, '0')}`;
};

/**
 * Build the invoice PDF in memory, upload to Cloudinary, and persist the Invoice record.
 *
 * @param {Object} lead       - Mongoose Lead document (must have category populated)
 * @param {Object} commission - Mongoose Commission document (contains wisemoveShare)
 * @returns {Object|null} Invoice document, or null when wisemoveShare is 0
 */
const generateInvoice = async (lead, commission) => {
    // Only generate an invoice if there is a WiseMove share to collect
    if (!commission.wisemoveShare || commission.wisemoveShare <= 0) {
        console.log(`[Invoice] No WiseMove share for commission ${commission._id}. Skipping invoice.`);
        return null;
    }

    const partner = await Partner.findById(lead.assignedPartnerId);
    if (!partner) throw new Error('Partner not found for invoice generation');

    const invoiceNumber = await nextInvoiceNumber();
    const tempInvoicesDir = path.join(__dirname, '../../storage/temp_invoices');

    // Ensure temporary directory exists
    if (!fs.existsSync(tempInvoicesDir)) {
        fs.mkdirSync(tempInvoicesDir, { recursive: true });
    }

    const pdfFilename = `${invoiceNumber}.pdf`;
    const pdfPath = path.join(tempInvoicesDir, pdfFilename);

    // ── Build PDF ────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Header
    doc.fontSize(20).text('WiseMove Connect', { align: 'right' });
    doc.fontSize(10).text('Invoice', { align: 'right', underline: true });
    doc.moveDown();

    // From
    doc.text('WiseMove Connect Ltd.');
    doc.text('123 Introducer Street');
    doc.text('London, LDN 1AA');
    doc.moveDown();

    // To (use companyName — the actual field on the Partner schema)
    doc.fontSize(12).text('Billed To:');
    doc.fontSize(10).text(`Partner: ${partner.companyName}`);
    doc.text(`Contact: ${partner.contactName}`);
    doc.text(`Email: ${partner.email}`);
    doc.text(`Phone: ${partner.phone}`);
    doc.moveDown();

    // Invoice Details
    doc.text(`Invoice Number: ${invoiceNumber}`);
    doc.text(`Date Issued: ${new Date().toLocaleDateString('en-GB')}`);
    doc.text(`Due Date: ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}`);
    doc.moveDown();

    // Line Items
    doc.fontSize(14).text('Introduction Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Customer: ${lead.name}`);
    doc.text(`Postcode: ${lead.postcode}`);
    doc.text(`Category: ${lead.category ? lead.category.name : 'N/A'}`);
    doc.moveDown();

    doc.fontSize(12).text(`Total Commission amount due: £${commission.wisemoveShare.toFixed(2)}`);
    doc.moveDown(2);

    // Footer
    doc.fontSize(10).text('Payment is due within 14 days of receipt.', { align: 'center' });
    doc.text('Thank you for your partnership.', { align: 'center' });

    doc.end();

    // Wait for the file stream to finish writing
    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    // ── Upload to Cloudinary ─────────────────────────────────────────────────
    let cloudinaryResult;
    try {
        cloudinaryResult = await cloudinary.uploader.upload(pdfPath, {
            folder: 'wisemove/invoices',
            public_id: invoiceNumber,
            resource_type: 'raw',
        });
        console.log(`[Invoice] Uploaded ${invoiceNumber} to Cloudinary: ${cloudinaryResult.secure_url}`);
    } catch (err) {
        console.error(`[Invoice] Cloudinary upload failed for ${invoiceNumber}:`, err.message);
        throw err;
    } finally {
        // Clean up temporary local file
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    }

    // ── Persist Invoice record ───────────────────────────────────────────────
    const invoice = await Invoice.create({
        invoiceNumber,
        leadId: lead._id,
        partnerId: partner._id,
        commissionId: commission._id,
        amount: commission.wisemoveShare,
        pdfPath: cloudinaryResult.secure_url,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
    });

    console.log(`[Invoice] Generated and stored invoice ${invoiceNumber} for commission ${commission._id}`);
    return invoice;
};

/**
 * Send an invoice email to the partner via Resend.
 * Called on initial generation and on admin "resend" action.
 *
 * @param {Object} invoice  - Mongoose Invoice document
 * @param {Object} partner  - Mongoose Partner document
 * @returns {Promise<boolean>} true if sent successfully
 */
const sendInvoiceEmail = async (invoice, partner) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn('[Invoice Email] Resend API key not configured — skipping');
            return false;
        }

        const body = JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
            to: partner.email,
            subject: `WiseMove Connect — Invoice ${invoice.invoiceNumber}`,
            text:
                `Dear ${partner.companyName},\n\n` +
                `Please find attached your invoice ${invoice.invoiceNumber} for £${invoice.amount.toFixed(2)}.\n\n` +
                `Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-GB')}\n\n` +
                `You can download your invoice here:\n${invoice.pdfPath}\n\n` +
                `If you have any questions, please reply to this email.\n\n` +
                `WiseMove Connect`,
        });

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || `Resend error ${response.status}`);

        console.log(`[Invoice Email] Sent invoice ${invoice.invoiceNumber} to ${partner.email}`);
        return true;
    } catch (err) {
        console.error(`[Invoice Email] Failed for invoice ${invoice.invoiceNumber}:`, err.message);
        return false;
    }
};

module.exports = { generateInvoice, sendInvoiceEmail };
