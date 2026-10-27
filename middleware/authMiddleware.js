const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authentication token is required"
            });
        }

        const token = authHeader.startsWith("Bearer ")
            ? authHeader.substring(7)
            : authHeader;

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        console.log("DECODED TOKEN:", decoded);

        /*
         * Support different JWT formats
         */
        const userId =
            decoded.userId ||
            decoded.id ||
            decoded._id ||
            decoded.user?.userId ||
            decoded.user?.id ||
            decoded.user?._id;

        if (!userId) {
            console.log(
                "USER ID NOT FOUND IN TOKEN:",
                decoded
            );

            return res.status(401).json({
                success: false,
                message: "User ID not found in token"
            });
        }

        const user = await User.findById(userId);

        if (!user) {
            console.log(
                "MONGODB USER NOT FOUND:",
                userId
            );

            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        req.user = user;

        next();

    } catch (error) {
        console.error(
            "AUTH MIDDLEWARE ERROR:",
            error.message
        );

        return res.status(401).json({
            success: false,
            message: "Invalid or expired authentication token"
        });
    }
};

module.exports = authMiddleware;