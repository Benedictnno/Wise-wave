const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
    // Legacy fields required by API
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, trim: true },
    preferredContactMethod: { type: String, enum: ['email', 'sms', 'whatsapp'], default: 'email' },
    backupDeliveryMethod: { type: String, enum: ['email', 'sms', 'whatsapp'], default: 'sms' },
    priority: { type: Number, default: 10 },
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },

    // New API Spec mappings (aliased or matched)
    business_name: { type: String, trim: true }, // Keeping for alias compatibility
    contact_name: { type: String, trim: true }, // Keeping for alias compatibility
    office_postcode: { type: String, required: true, trim: true, uppercase: true },
    service_category: { 
        type: String, 
        enum: ['home_property', 'professional_advisory', 'business_services']
    },
    coverage_area: { type: [String], default: [] },
    years_in_business: { type: Number },
    regulatory_status: { type: String },
    professional_memberships: { type: String },
    max_leads_per_month: { type: Number, default: 10 },
    typical_response_time: { type: String },
    active: { type: Boolean, default: true } // Could be synced with status
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// Pre-save to sync legacy and new spec names
partnerSchema.pre('save', function(next) {
    if (this.business_name && !this.companyName) this.companyName = this.business_name;
    if (this.contact_name && !this.contactName) this.contactName = this.contact_name;
    if (this.status === 'inactive') this.active = false;
    next();
});

module.exports = mongoose.model('Partner', partnerSchema);
