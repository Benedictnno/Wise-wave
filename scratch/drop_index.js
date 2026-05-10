require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wisemove');
        console.log('Connected to DB');
        
        console.log('Dropping problematic index...');
        await mongoose.connection.db.collection('partners').dropIndex('categories_1_postcodes_1_status_1_priority_1');
        console.log('Index dropped successfully');
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

test();
