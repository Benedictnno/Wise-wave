const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    referenceId: { type: String, unique: true, sparse: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Re-added legacy / required fields for runtime ops
    name: { type: String },
    email: { type: String, lowercase: true },
    phone: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    description: { type: String },
    service_type: { 
        type: String, 
        required: true
    },
    property_postcode: { type: String, trim: true, uppercase: true },
    best_time_to_contact: { 
        type: String, 
        enum: ['morning', 'afternoon', 'evening', 'anytime'], 
        required: true 
    },
    budget_band: { 
        type: String, 
        enum: ['5000_plus', '1000_4999', '500_999', '1_499', 'not_sure'], 
        required: true 
    },
    urgency: { 
        type: String, 
        enum: ['asap', '48_hours', '1_week', '1_2_months', '1_3_months', '3_plus_months', 'researching'], 
        required: true 
    },
    additional_details: { type: String, required: true },
    how_did_you_hear: { 
        type: String, 
        enum: ['estate_agent', 'google', 'social', 'referral', 'other', ''], 
        default: ''
    },

    // Scoring fields
    lead_score: { type: Number },
    lead_category: { 
        type: String, 
        enum: ['premium', 'hot', 'warm', 'cold', 'manual_review'] 
    },
    red_flags: [{ type: String }],

    // Routing fields
    status: { 
        type: String, 
        enum: [
            'new', 'assigned', 'returned', 'reassigned', 'completed',
            'manual_review', 'unassigned',
            'awaiting_partner_payment',  // partner marked as Won; waiting for them to confirm receipt
            'partner_paid'               // partner confirmed they received customer payment
        ],
        default: 'new'
    },
    current_partner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    assignedPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null },
    outcomeToken: { type: String, unique: true, sparse: true },
    outcomeTokenExpiry: { type: Date, default: null },
    revenueToken: { type: String, unique: true, sparse: true },
    outcome: { type: String, enum: ['won', 'lost', 'not_suitable', null], default: null },
    won_date: { type: Date, default: null },
    last_reminder_sent_at: { type: Date, default: null },
    partnerFeeTotal: { type: Number, default: 0 },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    selected_services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    paymentStatus: {
        type: String,
        enum: ['not_invoiced', 'invoiced', 'paid', 'reversed'],
        default: 'not_invoiced',
    },
    adminNotes: { type: String, default: '' },
    introducerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Introducer', default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Indexes per feedback
leadSchema.index({ status: 1, created_at: -1 });
leadSchema.index({ service_type: 1 });
leadSchema.index({ current_partner_id: 1 });

module.exports = mongoose.model('Lead', leadSchema);
