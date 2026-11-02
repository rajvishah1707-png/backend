const router = require('express').Router();
const mongoose = require('mongoose');
const Application = require('../models/ServiceApplication');
const Service = require('../models/Service');
const DigitalDocument = require('../models/DigitalDocument');
const { requirementsFor, validateDocuments } = require('../utils/applicationDocuments');
router.use(require('../middleware/authMiddleware'));
const editable = app => ['Pending', 'Under Review', 'Rejected'].includes(app.status);
async function find(req) {
    if (!mongoose.isValidObjectId(req.params.id)) throw Object.assign(new Error('Invalid application ID'), { status: 400 });
    return Application.findOne({ _id: req.params.id, ...(req.user.role === 'admin' ? {} : { userId: req.user._id }) });
}
router.get('/:id/documents', async (req, res) => {
    try {
        const application = await find(req);
        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
        const documents = await DigitalDocument.find({ _id: { $in: (application.documents || []).map(item => item.document) }, userId: application.userId });
        const rows = (application.documents || []).map(item => ({ requirement: item.requirement,
            document: documents.find(doc => String(doc._id) === String(item.document)) || null }));
        let requirements = application.documentRequirements || [];
        if (application.documentFlowVersion !== 1 && application.serviceId) requirements = requirementsFor(await Service.findById(application.serviceId));
        res.json({ success: true, requirements, documents: rows, applicationStatus: application.status,
            legacy: application.documentFlowVersion !== 1, canEdit: req.user.role === 'citizen' && editable(application) });
    } catch (e) { res.status(e.status || 500).json({ success: false, message: e.message }); }
});
router.patch('/:id/documents', async (req, res) => {
    try {
        if (req.user.role !== 'citizen') return res.status(403).json({ success: false, message: 'Only the applicant can replace submitted documents' });
        const application = await find(req);
        if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
        if (!editable(application)) return res.status(409).json({ success: false, message: 'Documents cannot change after approval' });
        let requirements = application.documentRequirements || [];
        if (application.documentFlowVersion !== 1 && application.serviceId) requirements = requirementsFor(await Service.findById(application.serviceId));
        const documents = await validateDocuments(req.user._id, requirements, req.body.documents);
        const updated = await Application.findOneAndUpdate({ _id: application._id, userId: req.user._id, status: application.status, __v: application.__v },
            { $set: { documents, documentRequirements: requirements, documentFlowVersion: 1 }, $inc: { __v: 1 } }, { new: true, runValidators: true });
        if (!updated) return res.status(409).json({ success: false, message: 'Application changed during editing. Refresh before trying again.' });
        res.json({ success: true, message: 'Documents updated. The administrator can review them now.' });
    } catch (e) { res.status(e.status || 500).json({ success: false, message: e.message }); }
});
module.exports = router;
