const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    service_type: { 
        type: String, 
        required: true,
        enum: [
            'estateAgents', 'lettingsPropertyManagement', 'trades', 'epc', 'floorplans', 
            'surveyors', 'removals', 'cleaning', 'amlKyc', 'homeInsurance', 
            'landlordInsurance', 'auctionServices', 'solicitorsConveyancing', 
            'willsEstatePlanning', 'lifeProtection', 'mortgageBrokerIntro', 'ifaIntro', 
            'commercialPropertyServices', 'hrServices', 'commercialFinance', 
            'businessLoans', 'assetFinance', 'invoiceFinance', 'developmentFinance', 
            'bridgingFinance', 'rndTaxCredits', 'businessCoaching', 'itSupport', 
            'webDesignDigital', 'accountancyBookkeeping', 'businessInsurance', 'ppiSmeInsurance'
        ]
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
        enum: ['asap', '48_hours', '1_week', '1_2_months', '3_plus_months', 'researching'], 
        required: true 
    },
    additional_details: { type: String, required: true },
    how_did_you_hear: { 
        type: String, 
        enum: ['estate_agent', 'google', 'social', 'referral', 'other'], 
        required: true 
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
        enum: ['new', 'assigned', 'returned', 'reassigned', 'completed', 'manual_review'],
        default: 'new'
    },
    current_partner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', default: null }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Lead', leadSchema);
