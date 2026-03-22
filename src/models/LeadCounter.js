const mongoose = require('mongoose');

const leadCounterSchema = new mongoose.Schema({
    year: { type: Number, required: true, unique: true },
    count: { type: Number, default: 0 },
});

module.exports = mongoose.model('LeadCounter', leadCounterSchema);
