const mongoose = require('mongoose');

const commissionSchema = new mongoose.Schema({
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    commissionType: { type: String, enum: ['fixed', 'percentage', 'tiered'], required: true },
    commissionValue: { type: Number, required: true }, // total calculated commission in £
    commissionStatus: {
        type: String,
        enum: ['unpaid', 'paid', 'reversed'],
        default: 'unpaid',
    },
    introducerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Introducer', default: null },
    introducerShare: { type: Number, default: 0 }, // £ amount
    wisemoveShare: { type: Number, default: 0 },   // £ amount
    rdTaxYear: { type: Number, default: null },     // for tiered R&D tax logic
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

commissionSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Commission', commissionSchema);
