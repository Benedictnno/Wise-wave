require('dotenv').config();
const mongoose = require('mongoose');
const Partner = require('../src/models/Partner');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wisemove');
        console.log('Connected to DB');
        
        const data = {
            companyName: "Test Company",
            contactName: "Test Contact",
            email: "test@example.com",
            phone: "0123456789",
            preferredContactMethod: "email",
            backupDeliveryMethod: "sms",
            priority: 1,
            office_postcode: "SW1A 1AA"
        };
        
        console.log('Attempting to create partner...');
        const partner = await Partner.create(data);
        console.log('Partner created:', partner._id);
        
        await Partner.findByIdAndDelete(partner._id);
        console.log('Cleanup done');
        
    } catch (err) {
        console.error('Error caught:', err);
        console.error('Error message:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

test();
