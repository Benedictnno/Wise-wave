require('dotenv').config();
const mongoose = require('mongoose');
const Partner = require('../src/models/Partner');
const Category = require('../src/models/Category');

async function runTest() {
    console.log('--- Starting Partner Onboard Database Integration Test ---');
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[Info] Connected to MongoDB');

        // Find an active category
        const cat = await Category.findOne({ isActive: true });
        if (!cat) {
            console.error('[Error] No active category found. Run seeds first.');
            process.exit(1);
        }
        console.log(`[Info] Using active category: ${cat.name} (${cat._id})`);

        const testEmail = `test_onboard_${Date.now()}@wisemove.invalid`;
        const testPostcodes = ['SW1A', 'EC1A'];

        console.log('[Info] Simulating partner onboarding payload...');
        const partner = await Partner.create({
            companyName: 'Onboard Test Corp Ltd',
            contactName: 'Jane Test Onboard',
            email: testEmail,
            phone: '07700900123',
            whatsappNumber: '07700900123',
            preferredContactMethod: 'email',
            categories: [cat._id],
            postcodes: testPostcodes,
            priority: 10,
            status: 'active',
            agreementAccepted: true,
            agreementTimestamp: new Date(),
        });

        console.log('[Success] Partner created successfully!');
        console.log('Partner ID:', partner._id);
        console.log('Office Postcode (auto-populated):', partner.office_postcode);

        // Assertions
        if (partner.office_postcode === 'SW1A') {
            console.log('[Assert] OK: office_postcode matches first postcode in array');
        } else {
            console.error(`[Assert] FAILED: office_postcode is ${partner.office_postcode}, expected SW1A`);
        }

        // Clean up
        await Partner.deleteOne({ _id: partner._id });
        console.log('[Info] Cleanup: Test partner removed.');

    } catch (err) {
        console.error('[Error] Test threw exception:', err.message);
        console.error(err.stack);
    } finally {
        await mongoose.connection.close();
        console.log('--- Test Finished ---');
    }
}

runTest();
