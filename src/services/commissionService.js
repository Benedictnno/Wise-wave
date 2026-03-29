const Introducer = require('../models/Introducer');
const IntroducerPayout = require('../models/IntroducerPayout');
const Invoice = require('../models/Invoice');

/**
 * Basic commission calculation based on rule type.
 */
const calculateCommission = (rule, partnerFee = 0) => {
    switch (rule.type) {
        case 'fixed':
            return rule.fixedAmount;
        case 'percentage':
            return partnerFee * (rule.percentage / 100);
        case 'tiered':
            // R&D Tax logic would go here
            return partnerFee * 0.20; // default 20% for year 1
        default:
            return 0;
    }
};

/**
 * Calculate the 30/70 split.
 */
const calculateShares = (totalValue, hasIntroducer) => {
    if (!hasIntroducer) {
        return { introducerShare: 0, wisemoveShare: totalValue };
    }
    const introducerShare = Number((totalValue * 0.30).toFixed(2));
    const wisemoveShare = Number((totalValue - introducerShare).toFixed(2));
    return { introducerShare, wisemoveShare };
};

/**
 * Apply the introducer split to a PAID commission.
 * Called by the Stripe Webhook when an invoice is fully paid.
 */
const applySplit = async (commission) => {
    if (!commission.introducerId) return { introducerShare: 0, wisemoveShare: commission.commissionValue };

    // 1. Get the introducer
    const introducer = await Introducer.findById(commission.introducerId);
    if (!introducer) return { introducerShare: 0, wisemoveShare: commission.commissionValue };

    // Use shared calculation helper for 30/70
    const { introducerShare, wisemoveShare } = calculateShares(commission.commissionValue, true);
    
    // 3. Update the commission record with actual shares calculated at payout time
    commission.introducerShare = introducerShare;
    commission.wisemoveShare = wisemoveShare;
    await commission.save();

    // 4. Create an IntroducerPayout record (the ledger)
    const invoice = await Invoice.findOne({ commissionId: commission._id, status: 'paid' });
    if (!invoice) return { introducerShare, wisemoveShare };

    await IntroducerPayout.create({
        introducerId: commission.introducerId,
        commissionId: commission._id,
        invoiceId: invoice._id,
        amount: introducerShare,
        payoutStatus: 'pending'
    });

    console.log(`[Commission Service] Applied async split and created payout record for INV: ${invoice.invoiceNumber}`);
    return { introducerShare, wisemoveShare };
};

module.exports = { applySplit, calculateCommission, calculateShares };
