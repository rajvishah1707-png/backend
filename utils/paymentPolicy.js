const crypto = require('crypto');
function parseFee(value) {
    const text = String(value ?? '').trim();
    if (/^(free|nil)$/i.test(text)) return 0;
    const numeric = text.replace(/^(?:INR|Rs\.?|₹)\s*/i, '').trim();
    if (numeric.includes(',') && !/^\d{1,3}(?:,\d{2})*,\d{3}(?:\.\d{1,2})?$/.test(numeric)) return null;
    const cleaned = numeric.replace(/,/g, '');
    if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
    const amount = Math.round(Number(cleaned) * 100);
    return Number.isSafeInteger(amount) && amount <= 100000000 ? amount : null;
}
function validSignature(message, signature, secret) {
    if (!secret || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const expected = crypto.createHmac('sha256', secret).update(message).digest();
    return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
function canPay(application) {
    return ['Approved', 'In Progress'].includes(application.status) &&
        Number.isSafeInteger(application.feePaise) && application.feePaise > 0;
}
function matchesCaptured(payment, record) {
    return ['captured', 'refunded'].includes(payment.status) && payment.order_id === record.orderId &&
        payment.amount === record.amountPaise && payment.currency === 'INR';
}
function visibleStatus(application, payment) {
    if (payment) return payment.status;
    if (application.status === 'Rejected') return 'Not Payable';
    if (application.feePaise === 0) return 'Not Required';
    if (application.feePaise == null) return 'Fee Not Set';
    return canPay(application) ? 'Pending' : 'Awaiting Approval';
}
module.exports = { parseFee, validSignature, canPay, matchesCaptured, visibleStatus };
