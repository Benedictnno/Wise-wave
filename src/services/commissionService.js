const Introducer = require('../models/Introducer');
const IntroducerPayout = require('../models/IntroducerPayout');
const Invoice = require('../models/Invoice');

/**
 * Get the tiered split percentage based on an introducer's monthly lead volume.
 */
const getTieredSplitPercent = (monthlyCount) => {
    if (monthlyCount >= 16) return 35;
    if (monthlyCount >= 11) return 34;
    if (monthlyCount >= 6) return 32;
    return 30; // base (1-5 leads)
};

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
 * Apply the introducer split to a PAID commission.
 * Called by the Stripe Webhook when an invoice is fully paid.
 */
const applySplit = async (commission) => {
    if (!commission.introducerId) return;

    // 1. Get current monthly volume for the introducer
    const introducer = await Introducer.findById(commission.introducerId);
    if (!introducer) return;

    // Use current month's lead volume to determine split tier
    const splitPercent = getTieredSplitPercent(introducer.leadsThisMonth || 1);
    
    // 2. Calculate £ amount for the introducer share
    const introducerShareAmount = Number((commission.commissionValue * (splitPercent / 100)).toFixed(2));
    const wisemoveShareAmount = Number((commission.commissionValue - introducerShareAmount).toFixed(2));

    // 3. Update the commission record with actual shares calculated at payout time
    commission.introducerShare = introducerShareAmount;
    commission.wisemoveShare = wisemoveShareAmount;
    await commission.save();

    // 4. Create an IntroducerPayout record (the ledger)
    const invoice = await Invoice.findOne({ commissionId: commission._id, status: 'paid' });
    if (!invoice) return;

    await IntroducerPayout.create({
        introducerId: commission.introducerId,
        commissionId: commission._id,
        invoiceId: invoice._id,
        amount: introducerShareAmount,
        payoutStatus: 'pending'
    });

    console.log(`[Commission Service] Applied async split and created payout record for INV: ${invoice.invoiceNumber}`);
};

module.exports = { applySplit, getTieredSplitPercent, calculateCommission };
