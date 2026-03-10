require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const seed = async () => {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Seed] Connected to MongoDB');

    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'changeme123';

    const existing = await Admin.findOne({ username });
    if (existing) {
        console.log(`[Seed] Admin "${username}" already exists — skipping`);
        await mongoose.disconnect();
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await Admin.create({ username, passwordHash });
    console.log(`[Seed] Admin account created: ${username}`);
    await mongoose.disconnect();
};

seed().catch((err) => {
    console.error('[Seed] Error:', err.message);
    process.exit(1);
});
