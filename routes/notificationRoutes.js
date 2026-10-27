const express = require("express");
const router = express.Router();

const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/authMiddleware");


// ==========================================
// GET MY NOTIFICATIONS
// ==========================================
router.get(
    "/",
    authMiddleware,
    async (req, res) => {
        try {

            const userId =
                req.user?.id ||
                req.user?._id ||
                req.user?.userId;

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "User not authenticated"
                });
            }

            const notifications =
                await Notification.find({
                    userId
                })
                .sort({
                    createdAt: -1
                })
                .lean();

            const unreadCount =
                notifications.filter(
                    item => !item.isRead
                ).length;

            res.status(200).json({
                success: true,
                count: notifications.length,
                unreadCount,
                notifications
            });

        } catch (error) {

            console.error(
                "Notification fetch error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to fetch notifications",
                error: error.message
            });
        }
    }
);


// ==========================================
// MARK ONE AS READ
// ==========================================
router.patch(
    "/:id/read",
    authMiddleware,
    async (req, res) => {

        try {

            const userId =
                req.user?.id ||
                req.user?._id ||
                req.user?.userId;

            const notification =
                await Notification.findOneAndUpdate(
                    {
                        _id: req.params.id,
                        userId
                    },
                    {
                        isRead: true
                    },
                    {
                        new: true
                    }
                );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Notification not found"
                });
            }

            res.status(200).json({
                success: true,
                notification
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    "Failed to update notification",
                error: error.message
            });
        }
    }
);


// ==========================================
// MARK ALL AS READ
// ==========================================
router.patch(
    "/read-all",
    authMiddleware,
    async (req, res) => {

        try {

            const userId =
                req.user?.id ||
                req.user?._id ||
                req.user?.userId;

            await Notification.updateMany(
                {
                    userId,
                    isRead: false
                },
                {
                    isRead: true
                }
            );

            res.status(200).json({
                success: true,
                message:
                    "All notifications marked as read"
            });

        } catch (error) {

            res.status(500).json({
                success: false,
                message:
                    "Failed to update notifications"
            });
        }
    }
);


module.exports = router;