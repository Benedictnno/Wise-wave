require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./src/models/Lead');
const Partner = require('./src/models/Partner');
const Category = require('./src/models/Category');
const Invoice = require('./src/models/Invoice');
const { findMatchingPartner } = require('./src/services/routingEngine');
const { processOutcome } = require('./src/services/outcomeService');
const { v4: uuidv4 } = require('uuid');

async function verify() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/wisemove_test');
    
    // Clean up
    await Lead.deleteMany({});
    await Partner.deleteMany({});
    await Category.deleteMany({});
    await Invoice.deleteMany({});
    const Commission = require('./src/models/Commission');
    await Commission.deleteMany({});
    
    try {
        await Partner.collection.dropIndexes();
    } catch (e) {
        // ignore if collection doesn't exist
    }
    
    // Create Category
    const category = await Category.create({
        name: 'Test Category',
        commissionType: 'percentage',
        commissionValue: 10
    });
    
    // Create Partner
    const partner = await Partner.create({
        name: 'Test Partner',
        email: 'partner@test.com',
        phone: '07700123456',
        categories: [category._id],
        postcodes: ['NW1 1AA'],
        priority: 1,
        status: 'active'
    });
    
    // Create Lead (simulating the POST /api/leads endpoint but calling routing direct)
    const lead = await Lead.create({
        name: 'Test User',
        email: 'user@test.com',
        phone: '07700000000',
        postcode: 'NW1 1AA',
        category: category._id
    });
    
    // Routing
    const matchedPartner = await findMatchingPartner(category._id, lead.postcode);
    if (!matchedPartner) throw new Error('Routing failed');
    
    lead.assignedPartnerId = matchedPartner._id;
    lead.status = 'assigned';
    lead.assignedAt = new Date();
    lead.outcomeToken = uuidv4();
    await lead.save();
    
    console.log(`[Test] Lead routed successfully. Token: ${lead.outcomeToken}`);
    
    // Simulate Outcome
    // Load lead again with populated category
    const populatedLead = await Lead.findById(lead._id).populate('category');
    
    const result = await processOutcome(populatedLead, 'won', 1000, null, 'Deal signed!');
    
    console.log(`[Test] Outcome processed. Commission created: ${result.commission._id}`);
    if (result.invoice) {
        console.log(`[Test] Invoice generated: ${result.invoice.invoiceNumber} at ${result.invoice.pdfPath}`);
        
        // Also check admin update status
        const updatedInvoice = await Invoice.findByIdAndUpdate(result.invoice._id, { status: 'paid' }, { returnDocument: 'after' });
        await Commission.findByIdAndUpdate(result.invoice.commissionId, { commissionStatus: 'paid' });
        console.log(`[Test] Invoice status updated to ${updatedInvoice.status}`);
    } else {
        throw new Error('Invoice was not generated!');
    }
    
    console.log('[Test] Verification successful!');
    process.exit(0);
}

verify().catch(e => {
    console.error('[Error]', e);
    process.exit(1);
});
