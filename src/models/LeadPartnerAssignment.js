const mongoose = require('mongoose');

const leadPartnerAssignmentSchema = new mongoose.Schema({
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    partner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    assignment_status: { 
        type: String, 
        enum: ['assigned', 'accepted', 'rejected', 'expired'], 
        required: true 
    },
    rejection_reason: { 
        type: String, 
        enum: ['outside_remit', 'outside_area', 'capacity', 'conflict', 'duplicate', 'other'],
        default: null
    },
    assigned_at: { type: Date, default: Date.now },
    responded_at: { type: Date, default: null }
});

module.exports = mongoose.model('LeadPartnerAssignment', leadPartnerAssignmentSchema);
