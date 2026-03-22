const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Invoice = require('../models/Invoice');
const Counter = require('../models/Counter');
const Partner = require('../models/Partner');
const cloudinary = require('../config/cloudinary');
const stripe = require('../config/stripe');

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

    // ── 1. Create Stripe Payment Link ─────────────────────────────────────────
    let paymentLink;
    try {
        // Create a one-time product for this invoice
        const product = await stripe.products.create({
            name: `WiseMove Connect Invoice ${invoiceNumber}`,
            description: `Lead: ${lead.referenceId} | Category: ${lead.category ? lead.category.name : 'N/A'}`,
        });

        const price = await stripe.prices.create({
            unit_amount: Math.round(commission.wisemoveShare * 100), // convert to pence
            currency: 'gbp',
            product: product.id,
        });

        paymentLink = await stripe.paymentLinks.create({
            line_items: [{ price: price.id, quantity: 1 }],
            after_completion: { type: 'redirect', redirect: { url: process.env.STRIPE_SUCCESS_URL || 'https://wisemoveconnect.com/payment-success' } },
            metadata: {
                invoiceNumber,
                leadId: lead._id.toString(),
                partnerId: partner._id.toString(),
                commissionId: commission._id.toString()
            }
        });
    } catch (err) {
        console.error('[Stripe] Failed to create payment link:', err.message);
        throw new Error('Payment gateway integration failed');
    }

    // ── 2. Build PDF ────────────────────────────────────────────────────────────
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
    doc.text(`Due Date: ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}`);
    doc.moveDown();

    // Amount
    doc.fontSize(14).text(`Total Amount Due: £${commission.wisemoveShare.toFixed(2)}`, { bold: true });
    doc.moveDown();

    // Payment Link
    doc.fontSize(12).fillColor('blue').text('Click here to pay securely via Stripe:', { underline: true });
    doc.fontSize(10).text(paymentLink.url, { link: paymentLink.url });
    doc.fillColor('black');
    doc.moveDown(2);

    doc.fontSize(10).text('Payment is due within 14 days. Thank you.', { align: 'center' });
    doc.end();

    await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });

    // ── 3. Upload to Cloudinary ─────────────────────────────────────────────────
    let cloudinaryResult = await cloudinary.uploader.upload(pdfPath, {
        folder: 'wisemove/invoices',
        public_id: invoiceNumber,
        resource_type: 'raw',
    });
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

    // ── 4. Persist ──────────────────────────────────────────────────────────────
    const invoice = await Invoice.create({
        invoiceNumber,
        leadId: lead._id,
        partnerId: partner._id,
        commissionId: commission._id,
        amount: commission.wisemoveShare,
        pdfPath: cloudinaryResult.secure_url,
        stripePaymentLinkId: paymentLink.id,
        stripePaymentUrl: paymentLink.url,
        status: 'unpaid',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

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
                `Pay securely online here:\n${invoice.stripePaymentUrl}\n\n` +
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
