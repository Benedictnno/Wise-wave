const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    full_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    preferred_contact_method: { 
        type: String, 
        enum: ['phone', 'email', 'either'], 
        required: true 
    },
    home_postcode: { type: String, required: true, trim: true, uppercase: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('User', userSchema);
