const mongoose = require('mongoose');

const leadEventSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    event_type: { 
        type: String, 
        enum: [
            'created', 'scored', 'routed', 'partner_assigned', 
            'partner_rejected', 'partner_accepted', 'reassigned', 
            'completed', 'manual_review'
        ], 
        required: true 
    },
    event_data: { type: mongoose.Schema.Types.Mixed },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LeadEvent', leadEventSchema);
