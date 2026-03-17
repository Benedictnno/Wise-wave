require('dotenv').config();
const { dispatchNotifications, notifyAdminUnassigned } = require('../src/services/notificationEngine');

async function test() {
    console.log('--- Starting Notification Verification ---');

    const mockLead = {
        _id: '64f1a2b3c4d5e6f7a8b9c0d1',
        name: 'Test Customer',
        phone: '+447700900000',
        email: 'customer@example.com',
        postcode: 'SW1A 1AA',
        description: 'Testing the new Resend and SendPulse integration.',
        outcomeToken: 'test-token-123'
    };

    const mockCategory = { name: 'Test Service' };

    const mockPartner = {
        _id: '64f1a2b3c4d5e6f7a8b9c0d2',
        name: 'Test Partner',
        email: 'partner@example.com',
        phone: '+447700900001',
        whatsappNumber: '+447700900001',
        preferredContactMethod: 'email'
    };

    console.log('\n[1] Testing Email (Resend)...');
    try {
        await dispatchNotifications(mockLead, { ...mockPartner, preferredContactMethod: 'email' }, mockCategory);
    } catch (e) {
        console.error('Email Dispatch Failed:', e.message);
    }

    console.log('\n[2] Testing SMS (SendPulse)...');
    try {
        await dispatchNotifications(mockLead, { ...mockPartner, preferredContactMethod: 'sms' }, mockCategory);
    } catch (e) {
        console.error('SMS Dispatch Failed:', e.message);
    }

    console.log('\n[3] Testing WhatsApp (SendPulse)...');
    try {
        await dispatchNotifications(mockLead, { ...mockPartner, preferredContactMethod: 'whatsapp' }, mockCategory);
    } catch (e) {
        console.error('WhatsApp Dispatch Failed:', e.message);
    }

    console.log('\n[4] Testing Admin Alert (Resend)...');
    try {
        await notifyAdminUnassigned(mockLead);
    } catch (e) {
        console.error('Admin Alert Failed:', e.message);
    }

    console.log('\n--- Verification Script Finished ---');
    console.log('Note: If credentials are missing in .env, skips/warnings are expected.');
}

test().catch(console.error);
