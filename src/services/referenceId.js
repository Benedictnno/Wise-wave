const LeadCounter = require('../models/LeadCounter');

/**
 * Generates a sequential reference ID in the format WMC-YYYY-NNNNNN
 * e.g. WMC-2026-000001
 */
const generateReferenceId = async () => {
    const year = new Date().getFullYear();

    // atomically increment count for the current year
    const counter = await LeadCounter.findOneAndUpdate(
        { year },
        { $inc: { count: 1 } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    // pad count to 6 digits
    const paddedCount = String(counter.count).padStart(6, '0');
    return `WMC-${year}-${paddedCount}`;
};

module.exports = { generateReferenceId };
