const mongoose = require('mongoose');
const Partner = require('../src/models/Partner');
const Lead = require('../src/models/Lead');

// Mock data based on updated Partner route
const partnerData = {
    companyName: 'Test Company',
    contactName: 'Test Contact',
    email: 'test@example.com',
    phone: '0123456789',
    categories: [new mongoose.Types.ObjectId()],
    postcodes: ['SW1A 1AA'],
    priority: 1,
    status: 'active',
    agreementAccepted: true,
    agreementTimestamp: new Date()
};

// Mock data based on updated Lead route
const leadData = {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '07700123456',
    postcode: 'SW1A 1AA',
    category: new mongoose.Types.ObjectId(),
    description: 'Looking for a mortgage adviser',
    consentAccepted: true,
    consentTimestamp: new Date(),
    formSource: 'request_service',
    status: 'unassigned'
};

const partner = new Partner(partnerData);
const lead = new Lead(leadData);

partner.validate()
    .then(() => console.log('Partner model validation: SUCCESS'))
    .catch(err => {
        console.error('Partner model validation: FAILED');
        console.error(err.errors);
    });

lead.validate()
    .then(() => console.log('Lead model validation: SUCCESS'))
    .catch(err => {
        console.error('Lead model validation: FAILED');
        console.error(err.errors);
    });
