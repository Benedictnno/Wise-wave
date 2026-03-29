const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    commissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commission', required: true },
    amount: { type: Number, required: true },
    status: { 
        type: String, 
        enum: ['paid', 'unpaid', 'reversed', 'failed'], 
        default: 'unpaid' 
    },
    pdfPath: { type: String, default: null },
    stripePaymentLinkId: { type: String, default: null }, // for stripe checkout links
    stripePaymentUrl: { type: String, default: null },    // actual link for partner
    issuedAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    metadata: mongoose.Schema.Types.Mixed
});

module.exports = mongoose.model('Invoice', invoiceSchema);
