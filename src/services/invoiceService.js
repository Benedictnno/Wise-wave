const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Invoice = require('../models/Invoice');
const Partner = require('../models/Partner');

/**
 * Generates a PDF invoice for a given commission and saves the record.
 * 
 * @param {Object} lead - Mongoose Lead document
 * @param {Object} commission - Mongoose Commission document (contains wisemoveShare)
 * @returns {Object} Invoice document
 */
const generateInvoice = async (lead, commission) => {
    // Only generate an invoice if there is a WiseMove share to collect
    if (!commission.wisemoveShare || commission.wisemoveShare <= 0) {
        console.log(`[Invoice] No WiseMove share for commission ${commission._id}. Skipping invoice.`);
        return null;
    }

    const partner = await Partner.findById(lead.assignedPartnerId);
    if (!partner) throw new Error('Partner not found for invoice generation');

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    const invoicesDir = path.join(__dirname, '../../storage/invoices');
    
    // Ensure directory exists
    if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
    }

    const pdfFilename = `${invoiceNumber}.pdf`;
    const pdfPath = path.join(invoicesDir, pdfFilename);

    // Create PDF Document
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

    // To
    doc.fontSize(12).text('Billed To:');
    doc.fontSize(10).text(`Partner: ${partner.name}`);
    doc.text(`Email: ${partner.email}`);
    doc.text(`Phone: ${partner.phone}`);
    doc.moveDown();

    // Invoice Details
    doc.text(`Invoice Number: ${invoiceNumber}`);
    doc.text(`Date Issued: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Line Items
    doc.fontSize(14).text('Introduction Details', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Lead: ${lead.name}`);
    doc.text(`Postcode: ${lead.postcode}`);
    doc.text(`Category: ${lead.category.name}`);
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

    // Save Invoice to DB
    const invoice = await Invoice.create({
        invoiceNumber,
        leadId: lead._id,
        partnerId: partner._id,
        commissionId: commission._id,
        amount: commission.wisemoveShare,
        pdfPath: `/storage/invoices/${pdfFilename}`, // relative path for public access if needed
        status: 'unpaid'
    });

    console.log(`[Invoice] Generated invoice ${invoiceNumber} for commission ${commission._id}`);
    return invoice;
};

module.exports = { generateInvoice };
