const Lead = require('../models/Lead');
const Commission = require('../models/Commission');
const CommissionRule = require('../models/CommissionRule');
const Introduction = require('../models/Introduction');
const PartnerResponse = require('../models/PartnerResponse');
const { calculateCommission } = require('./commissionService');

/**
 * Processes a partner's outcome submission.
 * For 'won' outcomes, parks the lead at awaiting_partner_payment.
 * Invoice is generated only after the partner confirms customer payment via the confirm-payment endpoint.
 */
const processPartnerResponse = async (lead, outcome, partnerFee, notes) => {
    lead.outcome = outcome;
    
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
        if (!rule) throw new Error('Commission rule not found for this category');

        // Special case: R&D Tax — revenue is reported later via revenue token
        if (lead.category.externalId === 'PA-024' || lead.category.externalId === 'svc_025') {
            lead.partnerFeeTotal = partnerFee || 0;
            const { v4: uuidv4 } = require('uuid');
            lead.revenueToken = lead.revenueToken || uuidv4();
            await lead.save();
            return {
                partnerResponse,
                lead,
                message: 'Outcome recorded. Please submit revenue details using your unique tracking link when engagement completes.'
            };
        }

        if ((rule.type === 'percentage') && (!partnerFee || partnerFee <= 0)) {
            throw new Error('Partner fee is required for percentage commissions');
        }

        // TWO-STEP FLOW: store fee, set status to awaiting payment, do NOT invoice yet
        lead.partnerFeeTotal = partnerFee || 0;
        lead.won_date = new Date();
        lead.status = 'awaiting_partner_payment';
        await lead.save();

        return {
            partnerResponse,
            lead,
            message: 'Outcome recorded. Once you have been paid by the customer, click the confirmation link to generate your invoice.'
        };
    }

    // For lost or not_suitable, just save and return lead
    await lead.save();
    return { partnerResponse, lead };
};

module.exports = { processPartnerResponse };
