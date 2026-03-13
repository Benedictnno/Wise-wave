const Lead = require('../models/Lead');
const Commission = require('../models/Commission');
const { calculateCommission, applySplit } = require('./commissionService');
const { generateInvoice } = require('./invoiceService');

/**
 * Processes a partner's outcome submission.
 * Validates the fee for 'won' deals, computes commission, updates lead, and generates invoice.
 *
 * @param {Object} lead - Mongoose Lead document populated with category
 * @param {String} outcome - 'won', 'lost', 'not_suitable'
 * @param {Number} partnerFee - Reported fee (required if won and category uses fee)
 * @param {Number} rdTaxYear - Year for tiered commission
 * @param {String} notes - Optional notes from partner
 * @returns {Object} { lead, commission, invoice }
 */
const processOutcome = async (lead, outcome, partnerFee, rdTaxYear, notes) => {
    lead.outcome = outcome;
    
    if (outcome === 'won') {
        const category = lead.category;
        
        // Fee validation where required
        if ((category.commissionType === 'percentage' || category.commissionType === 'tiered') && (!partnerFee || partnerFee <= 0)) {
            throw new Error('Partner fee is required for percentage or tiered commissions');
        }

        lead.partnerFee = partnerFee || 0;
        await lead.save();

        // Calculate and create commission
        const totalCommission = calculateCommission(category, lead.partnerFee, rdTaxYear ? Number(rdTaxYear) : null);
        const split = applySplit(totalCommission, lead.introducerId);

        const commission = await Commission.create({
            leadId: lead._id,
            partnerId: lead.assignedPartnerId,
            categoryId: category._id,
            commissionType: category.commissionType,
            commissionValue: totalCommission,
            introducerId: lead.introducerId || null,
            introducerShare: split.introducerShare,
            wisemoveShare: split.wisemoveShare,
            rdTaxYear: rdTaxYear || null,
            notes: notes || 'Outcome: Won',
        });

        // Generate Invoice
        const invoice = await generateInvoice(lead, commission);
        return { lead, commission, invoice };
    }

    // For lost or not_suitable, just save and return lead
    await lead.save();
    return { lead };
};

module.exports = { processOutcome };
