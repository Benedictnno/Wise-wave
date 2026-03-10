const Partner = require('../models/Partner');

/**
 * Deterministic lead routing engine.
 * Algorithm: filter by category + postcode + active status, sort by priority ASC, select first.
 *
 * @param {ObjectId} categoryId
 * @param {string} postcode - normalised uppercase postcode
 * @returns {Partner|null}
 */
const findMatchingPartner = async (categoryId, postcode) => {
    const normalised = postcode.toUpperCase().trim();

    const partners = await Partner.find({
        categories: categoryId,
        postcodes: normalised,
        status: 'active',
    }).sort({ priority: 1 });

    if (partners.length === 0) return null;
    return partners[0];
};

module.exports = { findMatchingPartner };
