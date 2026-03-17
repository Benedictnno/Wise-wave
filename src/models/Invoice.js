const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    commissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commission', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['paid', 'unpaid', 'reversed'], default: 'unpaid' },
    pdfPath: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
});

module.exports = mongoose.model('Invoice', invoiceSchema);
