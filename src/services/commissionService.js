/**
 * Commission calculation service.
 * Commission is never triggered automatically — only when a partner reports a successful deal.
 *
 * Supports:
 *   - percentage: commission = partnerFee * (commissionValue / 100)
 *   - flat:       commission = commissionValue (fixed £ amount)
 *   - tiered:     R&D Tax special logic — Year 1: 20%, Year 2: 10%, Year 3+: 0%
 */

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
 * @param {object} category - Category document
 * @param {number} partnerFee - the fee reported by the partner (only needed for percentage/tiered)
 * @param {number} rdTaxYear - only required for tiered category
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
 * Apply the introducer split to a total commission figure.
 * If introducerId is present: Uses the provided introducerShare percentage.
 * If no introducer: 100% WiseMove.
 *
 * @param {number} totalCommission
 * @param {ObjectId|null} introducerId
 * @param {number} introducerSharePercent - Percentage that goes to introducer (e.g. 30)
 * @returns {{ introducerShare: number, wisemoveShare: number }}
 */
const applySplit = (totalCommission, introducerId, introducerSharePercent = 30) => {
    if (introducerId && introducerSharePercent > 0) {
        const introducerShare = +(totalCommission * (introducerSharePercent / 100)).toFixed(2);
        const wisemoveShare = +(totalCommission - introducerShare).toFixed(2);
        return { introducerShare, wisemoveShare };
    }
    return { introducerShare: 0, wisemoveShare: +totalCommission.toFixed(2) };
};

module.exports = { calculateCommission, applySplit, getRDTierRate };
