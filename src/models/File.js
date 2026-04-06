const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    file_name: { type: String, required: true },
    file_type: { type: String, required: true }, // MIME type
    file_size: { type: Number, required: true }, // bytes
    file_url: { type: String, required: true }, // hosted URL
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', fileSchema);
