const mongoose = require('mongoose');
const DigitalDocument = require('../models/DigitalDocument');
const storage = require('./documentStorage');
const fileAvailable = doc => doc.fileStorage === 'database' || storage.available(doc);
const failure = (message, status = 400) => Object.assign(new Error(message), { status });
const requirementsFor = service => [...new Set((service?.requiredDocuments || []).filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()))];
async function validateDocuments(userId, requirements, attachments = []) {
    if (!Array.isArray(attachments) || attachments.length > 20) throw failure('Select at most 20 supporting documents');
    const seen = new Set();
    const normalized = attachments.map(item => {
        if (!item || typeof item.requirement !== 'string' || !item.requirement.trim() || item.requirement.length > 150 || !mongoose.isValidObjectId(item.document)) throw failure('Invalid document selection');
        const requirement = item.requirement.trim();
        if (seen.has(requirement)) throw failure('Select only one document for each requirement');
        if (requirements.length && !requirements.includes(requirement)) throw failure('The service document requirements have changed. Refresh and select the required documents again.');
        seen.add(requirement);
        return { requirement, document: item.document };
    });
    const missing = requirements.filter(name => !seen.has(name));
    if (missing.length) throw failure(`Attach the required documents: ${missing.join(', ')}`);
    if (!normalized.length) return [];
    const ids = [...new Set(normalized.map(x => String(x.document)))];
    const owned = await DigitalDocument.find({ _id: { $in: ids }, userId }).select('_id status fileStorage fileName');
    if (owned.length !== ids.length) throw failure('A selected document is missing or does not belong to your account');
    if (owned.some(item => !fileAvailable(item))) throw failure('A selected file is unavailable. Upload it again before submitting.');
    if (owned.some(item => item.status === 'Rejected')) throw failure('Replace rejected documents before submitting');
    return normalized;
}
async function ensureVerified(application) {
    if (application.documentFlowVersion !== 1) return;
    const attachments = application.documents || [];
    const requirements = application.documentRequirements || [];
    if (requirements.some(name => !attachments.some(item => item.requirement === name))) throw failure('Required application documents are missing', 409);
    const ids = [...new Set(attachments.map(item => String(item.document)))];
    if (!ids.length) return;
    const documents = await DigitalDocument.find({ _id: { $in: ids }, userId: application.userId }).select('_id status fileStorage fileName');
    if (documents.length !== ids.length || documents.some(item => item.status !== 'Verified' || !fileAvailable(item))) throw failure('Verify all attached documents before approving or completing this application', 409);
}
module.exports = { requirementsFor, validateDocuments, ensureVerified };
