const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Partner = require('../models/Partner');
const cloudinary = require('../config/cloudinary');

/**
 * Generate a sequential invoice number of the form INV-00001.
 */
const nextInvoiceNumber = async () => {
    const seq = await Counter.nextSequence('invoice');
    return `INV-${String(seq).padStart(5, '0')}`;
};

/**
 * Build the invoice PDF, create Stripe payment link, and persist.
 */
const generateInvoice = async (lead, commission) => {
    if (!commission.wisemoveShare || commission.wisemoveShare <= 0) {
        return null;
    }

    const partner = await Partner.findById(lead.assignedPartnerId);
    if (!partner) throw new Error('Partner not found for invoice generation');

    const invoiceNumber = await nextInvoiceNumber();

    // ── 1. Create Initial Invoice Record (M-10: needed for redundant ID in Stripe) ──
    const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const invoice = await Invoice.create({
        invoiceNumber,
        leadId: lead._id,
        partnerId: partner._id,
        commissionId: commission._id,
        amount: commission.wisemoveShare,
        status: 'unpaid',
        dueDate,
    });

    // ── 2. Create Payment Link (Removed per No Payment Processing Rule) ──
    const paymentInstructions = "Please pay via direct bank transfer. Bank Details: ...";


    // ── 3. Build PDF ────────────────────────────────────────────────────────────
    const tempInvoicesDir = path.join(__dirname, '../../storage/temp_invoices');
    if (!fs.existsSync(tempInvoicesDir)) fs.mkdirSync(tempInvoicesDir, { recursive: true });

    const pdfPath = path.join(tempInvoicesDir, `${invoiceNumber}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    // Header
    doc.fontSize(20).text('WiseMove Connect', { align: 'right' });
    doc.fontSize(10).text('Invoice & Payment Receipt', { align: 'right' });
    doc.moveDown();

    // Bill To
    doc.fontSize(12).text('Billed To:');
    doc.fontSize(10).text(`Partner: ${partner.companyName}`);
    doc.text(`Contact: ${partner.contactName}`);
    doc.text(`Email: ${partner.email}`);
    doc.moveDown();

    // Details
    doc.text(`Invoice Number: ${invoiceNumber}`);
    doc.text(`Reference ID: ${lead.referenceId}`);
    doc.text(`Issue Date: ${new Date().toLocaleDateString('en-GB')}`);
    doc.text(`Due Date: ${dueDate.toLocaleDateString('en-GB')}`);
    doc.moveDown();

    // Amount
    doc.fontSize(14).text(`Total Amount Due: £${commission.wisemoveShare.toFixed(2)}`, { bold: true });
    doc.moveDown();

    doc.fontSize(12).fillColor('black').text(paymentInstructions);
    doc.moveDown(2);

    doc.fontSize(10).text('Payment is due within 14 days. Thank you.', { align: 'center' });
    doc.end();

    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    // ── 4. Upload to Cloudinary ─────────────────────────────────────────────────
    let cloudinaryResult = await cloudinary.uploader.upload(pdfPath, {
        folder: 'wisemove/invoices',
        public_id: invoiceNumber,
        resource_type: 'raw',
    });
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    // ── 5. Finalize Invoice ──────────────────────────────────────────────────────
    invoice.pdfPath = cloudinaryResult.secure_url;
    // stripePaymentLinkId and url removed
    await invoice.save();

    await sendInvoiceEmail(invoice, partner);
    return invoice;
};

const sendInvoiceEmail = async (invoice, partner) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) return false;

        const body = JSON.stringify({
            from: process.env.EMAIL_FROM || 'noreply@wisemoveconnect.com',
            to: partner.email,
            subject: `WiseMove Connect — Invoice ${invoice.invoiceNumber}`,
            text:
                `Dear ${partner.companyName},\n\n` +
                `Please find attached your invoice ${invoice.invoiceNumber} for £${invoice.amount.toFixed(2)}.\n\n` +
                `Download PDF copy:\n${invoice.pdfPath}\n\n` +
                `Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-GB')}\n\n` +
                `WiseMove Connect`,
        });

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body,
        });
        return response.ok;
    } catch (err) {
        console.error(`[Invoice Email] Error:`, err.message);
        return false;
    }
};

module.exports = { generateInvoice, sendInvoiceEmail };
