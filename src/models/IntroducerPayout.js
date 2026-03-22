const mongoose = require('mongoose');

/**
 * Payout ledger record for Introducers.
 * Created automatically when a partner pays an invoice for a lead 
 * that was referred by an introducer.
 */
const introducerPayoutSchema = new mongoose.Schema({
    introducerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Introducer', required: true },
    commissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commission', required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    amount: { type: Number, required: true }, // introducer's share of the paid invoice
    payoutStatus: { 
        type: String, 
        enum: ['pending', 'paid', 'reversed'], 
        default: 'pending' 
    },
    paidAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('IntroducerPayout', introducerPayoutSchema);
