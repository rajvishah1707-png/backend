const mongoose = require('mongoose');
const schema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceApplication', required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicationReference: String, serviceName: String, citizenName: String, citizenEmail: String,
    amountPaise: { type: Number, required: true, min: 1 },
    provider: { type: String, enum: ['cashfree', 'razorpay'], default: 'razorpay' },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['Pending','Creating','Created','Paid','Failed','Needs Review'], default: 'Pending' },
    orderId: { type: String, unique: true, sparse: true },
    paymentId: { type: String, unique: true, sparse: true },
    paidAt: Date,
    refundedPaise: { type: Number, default: 0 },
    receipt: { type: String, unique: true },
    failureMessage: String
}, { timestamps: true });
module.exports = mongoose.model('Payment', schema);
