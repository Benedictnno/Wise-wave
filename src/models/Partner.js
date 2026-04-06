const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
    business_name: { type: String, required: true, trim: true },
    website: { type: String, trim: true },
    contact_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    office_postcode: { type: String, required: true, trim: true, uppercase: true },
    service_category: { 
        type: String, 
        enum: ['home_property', 'professional_advisory', 'business_services'], 
        required: true 
    },
    coverage_area: { type: [String], default: [] },
    years_in_business: { type: Number },
    regulatory_status: { type: String },
    professional_memberships: { type: String },
    max_leads_per_month: { type: Number, default: 10 },
    typical_response_time: { type: String },
    active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('Partner', partnerSchema);
