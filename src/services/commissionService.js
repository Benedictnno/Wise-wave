/**
 * Commission calculation service.
 * Commission is never triggered automatically — only when a partner reports a successful deal.
 *
 * Supports:
 *   - percentage: commission = partnerFee * (commissionValue / 100)
 *   - flat:       commission = commissionValue (fixed £ amount)
 *   - tiered:     R&D Tax special logic — Year 1: 20%, Year 2: 10%, Year 3+: 0%
 *
 * Introducer split uses a 4-tier volume table defined in the Introducer model.
 */

const Introducer = require('../models/Introducer');

const RD_TAX_TIERS = { 1: 0.2, 2: 0.1 };

/**
 * Get commission rate for R&D Tax tiered category.
 * @param {number} yearNumber - the year of the deal (1, 2, 3+)
 * @returns {number} rate (e.g. 0.2 for 20%)
 */
const getRDTierRate = (yearNumber) => {
    return RD_TAX_TIERS[yearNumber] ?? 0;
};

/**
 * Calculate total commission amount based on category type.
 * @param {object} category   - Category document
 * @param {number} partnerFee - the fee reported by the partner (only needed for percentage/tiered)
 * @param {number} rdTaxYear  - only required for tiered category
 * @returns {number} total commission in £
 */
const calculateCommission = (category, partnerFee = 0, rdTaxYear = null) => {
    switch (category.commissionType) {
        case 'percentage':
            return partnerFee * (category.commissionValue / 100);

        case 'flat':
            return category.commissionValue;

        case 'tiered': {
            const rate = getRDTierRate(rdTaxYear);
            return partnerFee * rate;
        }

        default:
            return 0;
    }
};

/**
 * Increment the monthly lead counter for an introducer and return the
 * current count (after increment) for tier calculation.
 *
 * Resets the counter if it's been more than 30 days since last reset.
 *
 * @param {ObjectId} introducerId
 * @returns {Promise<number>} updated monthly lead count
 */
const incrementIntroducerMonthlyCount = async (introducerId) => {
    if (!introducerId) return 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const introducer = await Introducer.findById(introducerId);
    if (!introducer) return 0;

    // Reset counter if the 30-day window has elapsed
    if (new Date(introducer.leadsMonthReset) < thirtyDaysAgo) {
        introducer.leadsThisMonth = 1;
        introducer.leadsMonthReset = now;
    } else {
        introducer.leadsThisMonth += 1;
    }

    await introducer.save();
    return introducer.leadsThisMonth;
};

/**
 * Apply the tiered introducer split to a total commission figure.
 *
 * If an introducerId is present, the split percentage is determined by the
 * introducer's monthly lead volume (tiered table). Otherwise 100% goes to WiseMove.
 *
 * @param {number}           totalCommission
 * @param {ObjectId|null}    introducerId
 * @param {number|null}      overridePercent - explicit % override (e.g. from CommissionRule.introducerShare)
 * @returns {{ introducerShare: number, wisemoveShare: number, introducerSharePercent: number }}
 */
const applySplit = async (totalCommission, introducerId, overridePercent = null) => {
    if (!introducerId) {
        return {
            introducerShare: 0,
            wisemoveShare: +totalCommission.toFixed(2),
            introducerSharePercent: 0,
        };
    }

    // Use explicit override if provided (from CommissionRule), otherwise use tiered lookup
    let splitPercent;
    if (overridePercent !== null && overridePercent > 0) {
        splitPercent = overridePercent;
    } else {
        // Look up current monthly count to determine tier (no increment here — counted on lead creation)
        const introducer = await Introducer.findById(introducerId);
        const monthlyCount = introducer ? introducer.leadsThisMonth : 1;
        splitPercent = Introducer.getTieredSplitPercent(monthlyCount);
    }

    const introducerShare = +(totalCommission * (splitPercent / 100)).toFixed(2);
    const wisemoveShare   = +(totalCommission - introducerShare).toFixed(2);
    return { introducerShare, wisemoveShare, introducerSharePercent: splitPercent };
};

module.exports = { calculateCommission, applySplit, getRDTierRate, incrementIntroducerMonthlyCount };
