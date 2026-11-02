const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { parseFee, validSignature, canPay, matchesCaptured, visibleStatus } = require('../utils/paymentPolicy');
test('fee parsing never guesses amounts from descriptive text', () => {
    for (const value of ['Free','nil','0','₹0.00']) assert.equal(parseFee(value), 0);
    for (const value of ['250','Rs. 250.00','INR 250','₹250']) assert.equal(parseFee(value), 25000);
    for (const value of ['As applicable','from 250','250 onwards','-1','1.001','','Infinity','1000001','1,2','1,234,56']) assert.equal(parseFee(value), null);
});
test('approval and a positive immutable integer fee are required', () => {
    assert(canPay({ status: 'Approved', feePaise: 100 }));
    assert(canPay({ status: 'In Progress', feePaise: 100 }));
    for (const status of ['Pending','Rejected','Completed','Under Review']) assert(!canPay({ status, feePaise: 100 }));
    for (const feePaise of [null,0,-1,1.1,'100']) assert(!canPay({ status: 'Approved', feePaise }));
});
test('payment signatures require an exact HMAC and reject malformed signatures', () => {
    const signature = crypto.createHmac('sha256','secret').update('order_1|pay_1').digest('hex');
    assert(validSignature('order_1|pay_1', signature, 'secret'));
    assert(!validSignature('order_2|pay_1', signature, 'secret'));
    assert(!validSignature('order_1|pay_1','bad','secret'));
    assert(!validSignature('order_1|pay_1', signature, undefined));
});
test('captured payment must match amount, currency and stored order', () => {
    const record = { amountPaise: 100, orderId: 'order_1' };
    const payment = { amount: 100, currency: 'INR', order_id: 'order_1', status: 'captured' };
    assert(matchesCaptured(payment, record));
    for (const patch of [{ status:'authorized' },{ amount: 1 },{ currency:'USD' },{ order_id:'order_2' }]) assert(!matchesCaptured({ ...payment, ...patch }, record));
});
test('free, unassessed and unapproved fees remain distinct', () => {
    assert.equal(visibleStatus({ feePaise:0 }), 'Not Required');
    assert.equal(visibleStatus({ feePaise:null }), 'Fee Not Set');
    assert.equal(visibleStatus({ status:'Pending', feePaise:100 }), 'Awaiting Approval');
    assert.equal(visibleStatus({ status:'Approved', feePaise:100 }), 'Pending');
    assert.equal(visibleStatus({}, { status:'Paid' }), 'Paid');
});
