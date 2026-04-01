const app = require('./src/server');
const mongoose = require('mongoose');

async function testLeadCreation() {
    try {
        // Wait for server to start binding
        await new Promise(r => setTimeout(r, 1000));

        const Category = require('./src/models/Category');
        const category = await Category.findOne({ isActive: true });
        if (!category) {
            console.log('No active category found in DB to test with.');
            process.exit(0);
        }

        const payload = {
            firstName: 'Backend',
            lastName: 'Test',
            email: 'test' + Date.now() + '@example.com',
            phone: '07000000000',
            postcode: 'NW1 1AB',
            serviceCategory: category._id.toString(),
            gdprConsent: true,
            company: 'Test Corp',
            urgency: 'high',
            budgetRange: '£1k - £5k',
            preferredContactTime: 'morning'
        };

        console.log('Testing payload:', payload);

        const res = await fetch('http://localhost:5000/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        console.log('Status:', res.status);
        const body = await res.json();
        console.log('Body:', body);
    } catch (err) {
        console.error('Test script error:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

// wait for db connection
mongoose.connection.once('open', testLeadCreation);
