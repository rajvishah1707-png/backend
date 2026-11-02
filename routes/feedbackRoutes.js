const router = require('express').Router();
const Feedback = require('../models/Feedback');
const auth = require('../middleware/authMiddleware');
router.use(auth);
router.get('/', async (req, res) => {
    try {
        const feedback = await Feedback.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, feedback });
    } catch { res.status(500).json({ success: false, message: 'Unable to load feedback' }); }
});
router.post('/', async (req, res) => {
    const { rating, message } = req.body;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof message !== 'string' || !message.trim() || message.length > 2000) {
        return res.status(400).json({ success: false, message: 'Choose a rating from 1 to 5 and enter feedback up to 2000 characters' });
    }
    try {
        const feedback = await Feedback.create({ userId: req.user._id, rating, message: message.trim() });
        res.status(201).json({ success: true, feedback });
    } catch { res.status(500).json({ success: false, message: 'Unable to submit feedback' }); }
});
module.exports = router;
