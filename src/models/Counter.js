const mongoose = require('mongoose');

/**
 * Counter model for generating strictly sequential IDs.
 * Used by the invoice engine to produce INV-00001, INV-00002, etc.
 */
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // e.g. 'invoice'
    seq: { type: Number, default: 0 },
});

/**
 * Atomically increments and returns the next sequence number for the given counter name.
 * @param {string} name - Counter identifier (e.g. 'invoice')
 * @returns {Promise<number>}
 */
counterSchema.statics.nextSequence = async function (name) {
    const doc = await this.findByIdAndUpdate(
        name,
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
