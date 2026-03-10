const mongoose = require('mongoose');

const categoryRelationshipSchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, unique: true },
    relatedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
});

module.exports = mongoose.model('CategoryRelationship', categoryRelationshipSchema);
