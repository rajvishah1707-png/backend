const mongoose = require('mongoose');
module.exports = mongoose.model('Feedback', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    message: { type: String, trim: true, required: true, maxlength: 2000 },
    adminReply: { type: String, default: '', maxlength: 2000 },
    repliedAt: Date
}, { timestamps: true }));
