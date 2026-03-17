require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../src/models/Admin');
const bcrypt = require('bcryptjs');

async function test() {
    console.log('--- Starting Admin Creation Verification ---');

    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[Info] Connected to MongoDB');

        // 1. Get existing admin credentials from env
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Admin1234!';

        // Ensure the seed admin exists (optional, but good for test robustness)
        let seedAdmin = await Admin.findOne({ username: adminUsername });
        if (!seedAdmin) {
            console.log('[Info] Seed admin not found, creating for test...');
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(adminPassword, salt);
            seedAdmin = await Admin.create({ username: adminUsername, passwordHash });
        }

        // 2. Simulate Login to Get Token
        // Instead of making an actual HTTP request (which requires the server to be running),
        // we can test the logic directly or simulate the API call if we wanted.
        // But for a true "verification", let's try to mock the registration logic and check constraints.

        const testNewAdminName = 'new_admin_' + Date.now();
        const testNewAdminPass = 'Password123!';

        console.log(`\n[1] Testing Registration of ${testNewAdminName}...`);
        
        // Mocking the duplicate check
        const existing = await Admin.findOne({ username: testNewAdminName });
        if (existing) {
            console.error('Test Failed: Username already exists before creation');
            process.exit(1);
        }

        // Mocking creation logic
        const salt = await bcrypt.genSalt(10);
        const passHash = await bcrypt.hash(testNewAdminPass, salt);
        const created = await Admin.create({ username: testNewAdminName, passwordHash: passHash });

        if (created && created.username === testNewAdminName) {
            console.log(`[Success] New admin ${testNewAdminName} created successfully in DB.`);
        } else {
            console.error('[Failure] Admin creation failed.');
        }

        // 3. Testing Duplicate Check
        console.log(`\n[2] Testing Duplicate Registration of ${testNewAdminName}...`);
        try {
            await Admin.create({ username: testNewAdminName, passwordHash: 'somehash' });
            console.error('[Failure] Duplicate admin created!');
        } catch (e) {
            console.log('[Success] Correctly prevented duplicate username.');
        }

        // Cleanup
        await Admin.deleteOne({ username: testNewAdminName });
        console.log('\n[3] Cleanup: Test admin removed.');

    } catch (err) {
        console.error('Verification Error:', err.message);
    } finally {
        await mongoose.connection.close();
        console.log('\n--- Verification Finished ---');
    }
}

test().catch(console.error);
