require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wisemove');
        console.log('Connected to DB');
        
        const indexes = await mongoose.connection.db.collection('partners').indexes();
        console.log('Indexes on partners collection:');
        console.log(JSON.stringify(indexes, null, 2));
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
    }
}

test();
