const router = require('express').Router();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Service = require('../models/Service');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const Notification = require('../models/Notification');
router.use(require('../middleware/authMiddleware'), require('../middleware/adminMiddleware'));
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
router.get('/categories', async (req, res) => {
    try {
        const [saved, used] = await Promise.all([Category.find().sort({ name: 1 }).lean(), Service.distinct('category')]);
        const names = [...new Set([...saved.map(x => x.name), ...used])].filter(Boolean).sort();
        res.json({ success: true, categories: names.map(name => ({ name, _id: saved.find(x => x.name === name)?._id || null, inUse: used.includes(name) })) });
    } catch { res.status(500).json({ success: false, message: 'Unable to load categories' }); }
});
router.post('/categories', async (req, res) => {
    if (!text(req.body.name, 80)) return res.status(400).json({ success: false, message: 'Category name is required (maximum 80 characters)' });
    try {
        const name = req.body.name.trim();
        const existing = await Category.findOne({ name });
        if (existing || await Service.exists({ category: name })) return res.status(409).json({ success: false, message: 'Category already exists' });
        const category = await Category.create({ name });
        res.status(201).json({ success: true, category });
    } catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ success: false, message: 'Unable to create category; check for duplicates' }); }
});
router.put('/categories/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !text(req.body.name, 80)) return res.status(400).json({ success: false, message: 'Valid category ID and name are required' });
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        if (await Service.exists({ category: category.name })) return res.status(409).json({ success: false, message: 'Reassign services before renaming a category in use' });
        if (await Service.exists({ category: req.body.name.trim() })) return res.status(409).json({ success: false, message: 'Category name already in use' });
        category.name = req.body.name.trim();
        await category.save();
        res.json({ success: true, category });
    } catch { res.status(409).json({ success: false, message: 'Unable to rename category; check for duplicates' }); }
});
router.delete('/categories/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid category ID' });
    try {
        const category = await Category.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        if (await Service.exists({ category: category.name })) return res.status(409).json({ success: false, message: 'Reassign services before deleting a category in use' });
        await category.deleteOne();
        res.json({ success: true });
    } catch { res.status(500).json({ success: false, message: 'Unable to delete category' }); }
});
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find().populate('userId', 'name email').sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, notifications });
    } catch { res.status(500).json({ success: false, message: 'Unable to load notifications' }); }
});
router.post('/notifications', async (req, res) => {
    const { title, message, userId } = req.body;
    if (!text(title, 150) || !text(message, 2000) || !mongoose.isValidObjectId(userId)) return res.status(400).json({ success: false, message: 'Choose a citizen and enter a title and message' });
    try {
        const citizen = await User.findOne({ _id: userId, role: 'citizen' });
        if (!citizen) return res.status(404).json({ success: false, message: 'Citizen not found' });
        const notification = await Notification.create({ userId, title: title.trim(), message: message.trim(), type: 'General' });
        res.status(201).json({ success: true, notification });
    } catch { res.status(500).json({ success: false, message: 'Unable to create notification' }); }
});
router.get('/feedback', async (req, res) => {
    try {
        const feedback = await Feedback.find().populate('userId', 'name email').sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, feedback });
    } catch { res.status(500).json({ success: false, message: 'Unable to load feedback' }); }
});
router.patch('/feedback/:id', async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id) || !text(req.body.adminReply, 2000)) return res.status(400).json({ success: false, message: 'A reply up to 2000 characters is required' });
    try {
        const feedback = await Feedback.findByIdAndUpdate(req.params.id, { $set: { adminReply: req.body.adminReply.trim(), repliedAt: new Date() } }, { new: true, runValidators: true });
        if (!feedback) return res.status(404).json({ success: false, message: 'Feedback not found' });
        res.json({ success: true, feedback });
    } catch { res.status(500).json({ success: false, message: 'Unable to save reply' }); }
});
module.exports = router;
