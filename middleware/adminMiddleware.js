const User = require("../models/User");

const adminMiddleware = async (req, res, next) => {
    try {
        const userId =
            req.user?.id ||
            req.user?.userId ||
            req.user?._id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const user = await User.findById(userId).select(
            "_id name email role isActive"
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Admin access required"
            });
        }

        if (user.isActive === false) {
            return res.status(403).json({
                success: false,
                message: "Admin account is inactive"
            });
        }

        req.admin = user;

        next();

    } catch (error) {
        console.error(
            "ADMIN MIDDLEWARE ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error while checking admin access"
        });
    }
};

module.exports = adminMiddleware;