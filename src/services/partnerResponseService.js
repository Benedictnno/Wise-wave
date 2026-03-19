const Lead = require('../models/Lead');
const Commission = require('../models/Commission');
const CommissionRule = require('../models/CommissionRule');
const Introduction = require('../models/Introduction');
const PartnerResponse = require('../models/PartnerResponse');
const { generateInvoice } = require('./invoiceService');
const { applySplit } = require('./commissionService');


/**
 * Processes a partner's outcome submission.
 * Validates the fee for 'won' deals, computes commission based on CommissionRule, updates lead, and generates invoice.
 *
 * @param {Object} lead - Mongoose Lead document populated with category
 * @param {String} outcome - 'won', 'lost', 'not_suitable'
 * @param {Number} partnerFee - Reported fee (required if won and rule requires fee)
 * @param {String} notes - Optional notes from partner
 * @returns {Object} { partnerResponse, lead, commission, invoice }
 */
const processPartnerResponse = async (lead, outcome, partnerFee, notes) => {
    lead.outcome = outcome;
    
    // Attempt to find Introduction
    const introduction = await Introduction.findOne({ leadId: lead._id, partnerId: lead.assignedPartnerId }).sort({ sentAt: -1 });
    let partnerResponse = null;

    if (introduction) {
        partnerResponse = await PartnerResponse.create({
            introductionId: introduction._id,
            status: outcome,
            respondedAt: new Date()
        });
    }
    
    if (outcome === 'won') {
        const rule = await CommissionRule.findOne({ categoryId: lead.category._id });
        if (!rule) {
            throw new Error('Commission rule not found for this category');
        }

        // Fee validation where required
        if ((rule.type === 'percentage' || rule.type === 'split') && (!partnerFee || partnerFee <= 0)) {
            throw new Error('Partner fee is required for percentage or split commissions');
        }

        lead.partnerFee = partnerFee || 0;
        await lead.save();

        let totalCommission = 0;
        if (rule.type === 'fixed') {
            totalCommission = rule.fixedAmount;
        } else if (rule.type === 'percentage') {
            totalCommission = partnerFee * (rule.percentage / 100);
        } else if (rule.type === 'split') {
            totalCommission = partnerFee * (rule.wisemoveShare / 100);
        }

        let introducerShareValue = 0;
        let wisemoveShareValue = totalCommission;

        // Apply tiered introducer split (CommissionRule.introducerShare overrides tier lookup)
        const splitResult = await applySplit(totalCommission, lead.introducerId || null, rule.introducerShare || null);
        introducerShareValue = splitResult.introducerShare;
        wisemoveShareValue = splitResult.wisemoveShare;

        const commission = await Commission.create({
            leadId: lead._id,
            partnerId: lead.assignedPartnerId,
            categoryId: lead.category._id,
            commissionType: rule.type,
            commissionValue: totalCommission,
            introducerId: lead.introducerId || null,
            introducerShare: introducerShareValue,
            wisemoveShare: wisemoveShareValue,
            notes: notes || 'Outcome: Won',
        });

        // Generate Invoice
        const invoice = await generateInvoice(lead, commission);
        return { partnerResponse, lead, commission, invoice };
    }

    // For lost or not_suitable, just save and return lead
    await lead.save();
    return { partnerResponse, lead };
};

module.exports = { processPartnerResponse };
