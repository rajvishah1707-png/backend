const Payment = require('../models/Payment');
const { ensureVerified } = require('./applicationDocuments');
async function guardStatus(application, status) {
    if (['Approved', 'In Progress', 'Completed'].includes(status)) await ensureVerified(application);
    if (status === 'Completed' && application.feePaise !== 0) {
        const paid = await Payment.exists({ applicationId: application._id, status: 'Paid', refundedPaise: 0 });
        if (!paid) throw Object.assign(new Error('Set the application fee and verify payment before completing this service'), { status: 409 });
    }
}
async function guardDelete(id) {
    if (await Payment.exists({ applicationId: id })) throw Object.assign(new Error('Applications with payment records must be retained'), { status: 409 });
}
module.exports = { guardStatus, guardDelete };
