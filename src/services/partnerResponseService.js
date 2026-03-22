const Lead = require('../models/Lead');
const Commission = require('../models/Commission');
const CommissionRule = require('../models/CommissionRule');
const Introduction = require('../models/Introduction');
const PartnerResponse = require('../models/PartnerResponse');
const { generateInvoice } = require('./invoiceService');
const { calculateCommission } = require('./commissionService');

/**
 * Processes a partner's outcome submission.
 * Validates the fee for 'won' deals, computes commission based on CommissionRule, updates lead, and generates invoice.
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

        // H-1: Special case for R&D (BS-001) where revenue is triggered later
        if (lead.category.externalId === 'BS-001') {
            lead.partnerFeeTotal = partnerFee || 0;
            await lead.save();
            return { partnerResponse, lead, message: 'Outcome recorded. Please submit revenue details when engagement completes.' };
        }

        // Validations
        if ((rule.type === 'percentage') && (!partnerFee || partnerFee <= 0)) {
            throw new Error('Partner fee is required for percentage commissions');
        }

        lead.partnerFeeTotal = partnerFee || 0;
        await lead.save();

        const totalCommissionAmount = calculateCommission(rule, partnerFee);

        // Create the Commission record (Initial state: unpaid, no split calculated until payment)
        const commission = await Commission.create({
            leadId: lead._id,
            partnerId: lead.assignedPartnerId,
            categoryId: lead.category._id,
            commissionType: rule.type,
            commissionValue: totalCommissionAmount,
            introducerId: lead.introducerId || null,
            introducerShare: 0, // split determined by async applySplit on payment
            wisemoveShare: totalCommissionAmount,
            notes: notes || 'Outcome: Won',
            commissionStatus: 'unpaid'
        });

        // Generate Invoice for the FULL commission value (WiseMove's primary collectable)
        const invoice = await generateInvoice(lead, commission);
        return { partnerResponse, lead, commission, invoice };
    }

    // For lost or not_suitable, just save and return lead
    await lead.save();
    return { partnerResponse, lead };
};

module.exports = { processPartnerResponse };
