const mongoose = require('mongoose');

const partnerServiceSchema = new mongoose.Schema({
    partner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
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
    }
});

module.exports = mongoose.model('PartnerService', partnerServiceSchema);
