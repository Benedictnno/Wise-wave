const Partner = require('../models/Partner');
const PostcodeExclusivity = require('../models/PostcodeExclusivity');

/**
 * 3-Level Postcode extraction for matching.
 * @param {string} postcode - raw postcode e.g. "NW1 1AB"
 * @returns {Object} { area, district, sector }
 */
const extractPostcodeLevels = (postcode) => {
    const p = postcode.toUpperCase().trim();
    // Area: first 1-2 letters (e.g. "NW")
    const area = p.match(/^[A-Z]{1,2}/)?.[0] || '';
    
    // District: outboard removed (e.g. "NW1")
    const districtMatch = p.match(/^[A-Z]{1,2}[0-9][A-Z0-9]?/)?.[0] || '';
    
    // Sector: first char of second part (e.g. "NW1 1")
    const sectorMatch = p.match(/^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9]?/)?.[0] || '';
    
    return { area, district, sector: sectorMatch.trim() };
};

/**
 * Deterministic lead routing engine with tiered matching and exclusivity support.
 * @param {Object} categoryDoc - Mongoose Category document
 * @param {string} postcode - user's postcode
 * @returns {Partner|null}
 */
const findMatchingPartner = async (categoryDoc, postcode) => {
    const normalised = postcode.toUpperCase().trim();
    const levels = extractPostcodeLevels(normalised);
    
    // 1. CHECK EXCLUSIVITY BRANCH (if enabled for this category)
    if (categoryDoc.isExclusivity) {
        // Find if any partner has exclusive ownership at any level
        const exclusiveRecord = await PostcodeExclusivity.findOne({
            categoryId: categoryDoc._id,
            $or: [
                { postcode: levels.sector },
                { postcode: levels.district },
                { postcode: levels.area }
            ]
        }).sort({ level: -1 }); // Priority to Sector, then District, then Area? Match nearest level.
        // Wait! In database, levels are 'Area', 'District', 'Sector'. Let's find specific first.
        
        if (exclusiveRecord) {
            const partner = await Partner.findOne({ _id: exclusiveRecord.partnerId, status: 'active' });
            if (partner) return partner;
        }
    }

    // 2. STANDARD ROUTING BRANCH (Deterministic Priority-Based)
    // Matches at: Full Postcode OR Sector OR District OR Area
    const potentialPartners = await Partner.find({
        categories: categoryDoc._id,
        postcodes: { 
            $in: [normalised, levels.sector, levels.district, levels.area]
        },
        status: 'active',
    }).sort({ priority: 1 });

    if (potentialPartners.length === 0) return null;
    return potentialPartners[0];
};

module.exports = { findMatchingPartner };
