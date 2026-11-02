const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Application = require('../models/ServiceApplication');
const auth = require('../middleware/authMiddleware');
const admin = require('../middleware/adminMiddleware');
const gateway = require('../utils/razorpayClient');
const { parseFee, validSignature, canPay, matchesCaptured, visibleStatus } = require('../utils/paymentPolicy');
const router = express.Router();
const fail = (res, error) => res.status(error.status || 400).json({ success: false, message: error.message });
const validId = id => mongoose.isValidObjectId(id);
const ownQuery = req => req.user.role === 'admin' ? {} : { userId: req.user._id };
async function saveCaptured(record, paid) {
    return Payment.findByIdAndUpdate(record._id, {
        $set: { status: 'Paid', paymentId: paid.id,
            paidAt: record.paidAt || new Date(paid.created_at * 1000), failureMessage: '' },
        $max: { refundedPaise: paid.amount_refunded || 0 }
    }, { new: true });
}
async function reconcile(record) {
    if (!record.orderId) return record;
    const result = await gateway.request(`orders/${encodeURIComponent(record.orderId)}/payments`);
    const paid = (result.items || []).find(item => matchesCaptured(item, record));
    if (paid) {
        // A late failure or duplicate callback must never regress a captured payment.
        return saveCaptured(record, paid);
    }
    if (record.status !== 'Paid' && result.items?.length && result.items.every(item => item.status === 'failed')) {
        return (await Payment.findOneAndUpdate({ _id: record._id, status: { $ne: 'Paid' } },
            { $set: { status: 'Failed', failureMessage: 'The payment attempt failed. You may retry the same order.' } }, { new: true })) || record;
    }
    return record;
}
router.use(auth);
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const filter = ownQuery(req);
        const [applications, total] = await Promise.all([
            Application.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 25).limit(25).lean(),
            Application.countDocuments(filter)
        ]);
        const payments = await Payment.find({ applicationId: { $in: applications.map(a => a._id) } }).lean();
        const rows = applications.map(a => {
            const payment = payments.find(p => String(p.applicationId) === String(a._id));
            return { application: a, payment: payment || null, status: visibleStatus(a, payment), canPay: canPay(a) && payment?.status !== 'Paid' };
        });
        res.json({ success: true, rows, total, page, pageSize: 25, testMode: true,
            configured: Boolean(process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && process.env.RAZORPAY_KEY_SECRET) });
    } catch (error) { fail(res, error); }
});
router.get('/summary', admin, async (req, res) => {
    try {
        const now = new Date();
        // Business day in India, independent of Render's host timezone.
        const indiaDate = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
        const start = new Date(`${indiaDate}T00:00:00+05:30`);
        const [sums, failed, pending] = await Promise.all([
            Payment.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null,
                totalPaise: { $sum: { $subtract: ['$amountPaise', { $ifNull: ['$refundedPaise', 0] }] } },
                todayPaise: { $sum: { $cond: [{ $gte: ['$paidAt', start] }, { $subtract: ['$amountPaise', { $ifNull: ['$refundedPaise', 0] }] }, 0] } },
                paidCount: { $sum: 1 } } }]),
            Payment.countDocuments({ status: 'Failed' }),
            Application.aggregate([{ $match: { status: { $in: ['Approved', 'In Progress'] }, feePaise: { $gt: 0 } } },
                { $lookup: { from: 'payments', localField: '_id', foreignField: 'applicationId', as: 'payment' } },
                { $match: { 'payment.status': { $ne: 'Paid' } } }, { $count: 'count' }])
        ]);
        res.json({ success: true, summary: { totalPaise: 0, todayPaise: 0, paidCount: 0, ...(sums[0] || {}), failed, pending: pending[0]?.count || 0 } });
    } catch (error) { fail(res, error); }
});
router.patch('/applications/:id/fee', admin, async (req, res) => {
    try {
        if (!validId(req.params.id)) throw new Error('Invalid application ID');
        const amount = parseFee(req.body.amount);
        if (amount == null) throw new Error('Enter a fee in rupees with at most two decimal places, or Free');
        const application = await Application.findById(req.params.id);
        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
        if (application.feePaise != null || await Payment.exists({ applicationId: application._id })) {
            return res.status(409).json({ success: false, message: 'The fee is already fixed and cannot be changed' });
        }
        const updated = await Application.findOneAndUpdate({ _id: application._id, feePaise: null }, { $set: { feePaise: amount } }, { new: true });
        if (!updated) throw new Error('Another administrator already set the fee. Refresh the page.');
        res.json({ success: true, application: updated });
    } catch (error) { fail(res, error); }
});
router.post('/orders', async (req, res) => {
    let claim;
    try {
        const { keyId } = gateway.config();
        if (req.user.role !== 'citizen') return res.status(403).json({ success: false, message: 'Citizen account required' });
        if (!validId(req.body.applicationId)) throw new Error('Invalid application ID');
        const application = await Application.findOne({ _id: req.body.applicationId, userId: req.user._id });
        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
        if (!canPay(application)) throw new Error('Payment is available only after approval and when a payable fee is set');
        let record;
        try {
            record = await Payment.findOneAndUpdate({ applicationId: application._id }, { $setOnInsert: {
                applicationId: application._id, userId: req.user._id, amountPaise: application.feePaise,
                applicationReference: application.applicationId, serviceName: application.serviceName,
                citizenName: application.citizenName, citizenEmail: application.citizenEmail,
                receipt: `sc_${crypto.randomBytes(12).toString('hex')}`, status: 'Pending'
            } }, { upsert: true, new: true, setDefaultsOnInsert: true });
        } catch (error) {
            if (error.code !== 11000) throw error;
            record = await Payment.findOne({ applicationId: application._id });
        }
        if (record.orderId) record = await reconcile(record);
        if (record.status === 'Paid') return res.status(409).json({ success: false, message: 'This application is already paid' });
        if (record.orderId) return res.json({ success: true, keyId, order: { id: record.orderId, amount: record.amountPaise, currency: 'INR' } });
        claim = await Payment.findOneAndUpdate({ _id: record._id, status: 'Pending', orderId: { $exists: false } },
            { $set: { status: 'Creating' } }, { new: true });
        if (!claim) return res.status(409).json({ success: false, message: 'An order is being created or needs administrator review. Refresh before trying again.' });
        const order = await gateway.request('orders', 'POST', { amount: claim.amountPaise, currency: 'INR', receipt: claim.receipt,
            notes: { applicationId: String(application._id), paymentRecordId: String(claim._id) } });
        if (!order.id || order.amount !== claim.amountPaise || order.currency !== 'INR') throw new Error('Unexpected payment order response');
        await Payment.updateOne({ _id: claim._id }, { $set: { orderId: order.id, status: 'Created' } });
        res.json({ success: true, keyId, order: { id: order.id, amount: order.amount, currency: order.currency } });
    } catch (error) {
        if (claim) await Payment.updateOne({ _id: claim._id, status: 'Creating' }, { $set: {
            status: error.definitive ? 'Pending' : 'Needs Review', failureMessage: 'Order creation did not finish. Reconcile before creating another order.'
        } }).catch(() => {});
        fail(res, error);
    }
});
router.post('/verify', async (req, res) => {
    try {
        const { secret } = gateway.config();
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (typeof razorpay_order_id !== 'string' || typeof razorpay_payment_id !== 'string') throw new Error('Payment identifiers are required');
        const record = await Payment.findOne({ orderId: razorpay_order_id, ...ownQuery(req) });
        if (!record) return res.status(404).json({ success: false, message: 'Payment order not found' });
        if (!validSignature(`${record.orderId}|${razorpay_payment_id}`, razorpay_signature, secret)) return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        const payment = await gateway.request(`payments/${encodeURIComponent(razorpay_payment_id)}`);
        if (!matchesCaptured(payment, record)) return res.status(409).json({ success: false, message: 'Payment is not captured yet. Use Refresh Payment after a moment.' });
        const updated = await saveCaptured(record, payment);
        res.json({ success: true, payment: updated });
    } catch (error) { fail(res, error); }
});
router.post('/:id/refresh', async (req, res) => {
    try {
        if (!validId(req.params.id)) throw new Error('Invalid payment ID');
        const record = await Payment.findOne({ _id: req.params.id, ...ownQuery(req) });
        if (!record) return res.status(404).json({ success: false, message: 'Payment not found' });
        res.json({ success: true, payment: await reconcile(record) });
    } catch (error) { fail(res, error); }
});
router.post('/:id/recover-order', admin, async (req, res) => {
    try {
        if (!validId(req.params.id) || !/^order_[a-zA-Z0-9]+$/.test(req.body.orderId || '')) throw new Error('Valid payment and provider order IDs are required');
        const record = await Payment.findById(req.params.id);
        if (!record || record.orderId || !['Creating', 'Needs Review'].includes(record.status)) throw new Error('This record does not need order recovery');
        const order = await gateway.request(`orders/${encodeURIComponent(req.body.orderId)}`);
        if (order.receipt !== record.receipt || order.amount !== record.amountPaise || order.currency !== 'INR' || order.notes?.paymentRecordId !== String(record._id)) throw new Error('The order does not match this application');
        const updated = await Payment.findOneAndUpdate({ _id: record._id, orderId: { $exists: false } }, { $set: { orderId: order.id, status: 'Created' } }, { new: true });
        res.json({ success: true, payment: await reconcile(updated) });
    } catch (error) { fail(res, error); }
});
async function webhook(req, res) {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) return res.status(503).json({ success: false, message: 'Webhook not configured' });
        if (!Buffer.isBuffer(req.body) || !validSignature(req.body, req.headers['x-razorpay-signature'], secret)) return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
        const event = JSON.parse(req.body.toString('utf8'));
        const entity = event.payload?.payment?.entity;
        const orderId = entity?.order_id || event.payload?.order?.entity?.id;
        if (event.event === 'refund.processed' && event.payload?.refund?.entity?.payment_id) {
            const record = await Payment.findOne({ paymentId: event.payload.refund.entity.payment_id });
            if (record) await reconcile(record);
        }
        if (orderId && ['payment.captured', 'payment.failed', 'order.paid', 'refund.processed'].includes(event.event)) {
            const record = await Payment.findOne({ orderId });
            if (record) await reconcile(record);
        }
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, message: 'Webhook processing failed; retry delivery' }); }
}
module.exports = { router, webhook, reconcile };
