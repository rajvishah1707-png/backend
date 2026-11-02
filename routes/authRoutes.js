const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const User = require("../models/User");
const OtpVerification = require("../models/OtpVerification");
const { sendSms } = require("../utils/smsUtils");
const { sendEmail } = require("../utils/emailUtils");

const router = express.Router();
const { uploadProfilePhoto } = require("../utils/profilePhoto");

/* =========================================================
   PROFILE IMAGE UPLOAD SETUP
========================================================= */

const profileUploadDir = path.join(
    __dirname,
    "../uploads/profiles"
);

if (!fs.existsSync(profileUploadDir)) {
    fs.mkdirSync(profileUploadDir, {
        recursive: true
    });
}


/* =========================================================
   MULTER STORAGE
========================================================= */

const storage = multer.memoryStorage();


/* =========================================================
   FILE FILTER
========================================================= */

const fileFilter = (req, file, cb) => {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (
        allowedTypes.includes(
            file.mimetype
        )
    ) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only JPG, PNG and WEBP images are allowed"
            )
        );
    }
};


/* =========================================================
   MULTER CONFIG
========================================================= */

const uploadProfileImage = multer({

    storage,

    fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    }

});


/* =========================================================
   JWT TOKEN FUNCTION
========================================================= */

const generateToken = (user) => {

    return jwt.sign(
        {
            userId: user._id.toString(),
            email: user.email,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    );

};

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_INTERVAL_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const isValidCitizenPhone = (phone) => /^\d{10}$/.test(phone);

const hashOtp = (identifier, purpose, otp) => {
    return crypto
        .createHmac("sha256", process.env.JWT_SECRET)
        .update(`${identifier}:${purpose}:${otp}`)
        .digest("hex");
};

const issueOtp = async (identifier, purpose, message, deliver = sendSms) => {
    const existingOtp = await OtpVerification.findOne({
        phone: identifier,
        purpose
    });
    const now = Date.now();

    if (
        existingOtp &&
        now - existingOtp.updatedAt.getTime() < OTP_RESEND_INTERVAL_MS
    ) {
        return false;
    }

    const otp = crypto.randomInt(100000, 1000000).toString();

    await OtpVerification.findOneAndUpdate(
        { phone: identifier, purpose },
        {
            $set: {
                codeHash: hashOtp(identifier, purpose, otp),
                expiresAt: new Date(now + OTP_TTL_MS),
                attempts: 0
            }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
        await deliver(identifier, message(otp));
    } catch (error) {
        await OtpVerification.deleteOne({ phone: identifier, purpose });
        throw error;
    }

    return true;
};

const consumeOtp = async (identifier, purpose, submittedOtp) => {
    const otpRecord = await OtpVerification.findOneAndUpdate(
        {
            phone: identifier,
            purpose,
            expiresAt: { $gt: new Date() },
            attempts: { $lt: OTP_MAX_ATTEMPTS }
        },
        { $inc: { attempts: 1 } },
        { new: true }
    );

    if (!otpRecord) {
        return false;
    }

    const expectedHash = Buffer.from(otpRecord.codeHash, "hex");
    const submittedHash = Buffer.from(hashOtp(identifier, purpose, submittedOtp), "hex");
    const isValid =
        expectedHash.length === submittedHash.length &&
        crypto.timingSafeEqual(expectedHash, submittedHash);

    if (isValid) {
        await OtpVerification.deleteOne({ _id: otpRecord._id });
    } else if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
        await OtpVerification.deleteOne({ _id: otpRecord._id });
    }

    return isValid;
};

/* =========================================================
   AUTH HELPER
========================================================= */

const getAuthenticatedUser = async (req) => {

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {
        throw new Error(
            "Authentication token is required"
        );
    }

    const token =
        authHeader.startsWith("Bearer ")
            ? authHeader.substring(7)
            : authHeader;

    const decoded =
        jwt.verify(
            token,
            process.env.JWT_SECRET
        );

    const userId =
        decoded.userId ||
        decoded.id ||
        decoded._id;

    if (!userId) {
        throw new Error(
            "Invalid authentication token"
        );
    }

    const user =
        await User.findById(userId);

    if (!user) {
        throw new Error(
            "User not found"
        );
    }

    return user;
};


/* =========================================================
   PROFILE IMAGE URL
========================================================= */

const getProfileImageUrl = (filename) => {

    if (!filename) {
        return "";
    }

    return `/api/auth/profile-image/${filename}`;
};


/* =========================================================
   CITIZEN REGISTER
========================================================= */

router.post(
    "/register",
    uploadProfileImage.single("profileImage"),
    async (req, res) => {

        let uploadedFilePath = req.file?.path || null;

        try {

            const {
                name,
                email,
                phone,
                password,
                address,
                city,
                pincode
            } = req.body;


            if (
                !name ||
                !email ||
                !phone ||
                !password
            ) {
                if (uploadedFilePath) {
                    fs.unlinkSync(uploadedFilePath);
                    uploadedFilePath = null;
                }

                return res.status(400).json({
                    success: false,
                    message:
                        "Name, email, phone and password are required"
                });

            }

            const normalizedPhone = phone.trim();

            if (!isValidCitizenPhone(normalizedPhone)) {
                if (uploadedFilePath) {
                    fs.unlinkSync(uploadedFilePath);
                    uploadedFilePath = null;
                }

                return res.status(400).json({
                    success: false,
                    message: "A valid 10-digit phone number is required"
                });
            }


            const normalizedEmail =
                email.trim().toLowerCase();


            const existingUser =
                await User.findOne({
                    email: normalizedEmail
                });


            if (existingUser) {
                if (uploadedFilePath) {
                    fs.unlinkSync(uploadedFilePath);
                    uploadedFilePath = null;
                }

                return res.status(400).json({
                    success: false,
                    message:
                        "An account with this email already exists"
                });

            }

            const existingPhone =
                await User.findOne({
                    phone: normalizedPhone,
                    role: "citizen"
                });

            if (existingPhone) {
                if (uploadedFilePath) {
                    fs.unlinkSync(uploadedFilePath);
                    uploadedFilePath = null;
                }

                return res.status(400).json({
                    success: false,
                    message: "An account with this phone number already exists"
                });
            }


            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            const user =
                await User.create({

                    name: name.trim(),

                    email: normalizedEmail,

                    phone: normalizedPhone,

                    password: hashedPassword,

                    address:
                        address
                            ? address.trim()
                            : "",

                    city:
                        city
                            ? city.trim()
                            : "",

                    pincode:
                        pincode
                            ? pincode.trim()
                            : "",

                    profileImage: req.file
                        ? await uploadProfilePhoto(req.file)
                        : "",

                    role: "citizen",

                    isActive: true,

                    loginCount: 0,

                    lastLogin: null

                });

            uploadedFilePath = null;

            const token =
                generateToken(user);


            return res.status(201).json({

                success: true,

                message:
                    "Registration successful",

                token,

                user: {

                    id: user._id,

                    name: user.name,

                    email: user.email,

                    phone: user.phone,

                    address: user.address,

                    city: user.city,

                    pincode: user.pincode,

                    profileImage:
                        user.profileImage,

                    role: user.role

                }

            });


        } catch (error) {
            if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
                try {
                    fs.unlinkSync(uploadedFilePath);
                } catch (cleanupError) {
                    console.error("REGISTER PROFILE IMAGE CLEANUP ERROR:", cleanupError);
                }
            }

            console.error(
                "REGISTER ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error during registration"

            });

        }

    }
);


/* =========================================================
   CITIZEN LOGIN
========================================================= */

router.post(
    "/login",
    (req, res) => res.status(410).json({
        success: false,
        message: "Password login is no longer available. Use email and verification code login."
    })
);


/* =========================================================
   LOGIN OTP REQUEST
========================================================= */

router.post(
    "/request-login-otp",
    async (req, res) => {
        try {
            const email =
                typeof req.body.email === "string"
                    ? req.body.email.trim().toLowerCase()
                    : "";
            const password =
                typeof req.body.password === "string"
                    ? req.body.password
                    : "";

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Email and password are required"
                });
            }

            const user = await User.findOne({
                email,
                role: "citizen"
            });

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password"
                });
            }

            if (user.isActive === false) {
                return res.status(403).json({
                    success: false,
                    message: "Your account is inactive. Please contact administrator."
                });
            }

            const otpSent = await issueOtp(
                user.email,
                "login",
                (otp) => `Your Smart City login verification code is ${otp}. It expires in 5 minutes.`,
                sendEmail
            );

            if (!otpSent) {
                return res.status(429).json({
                    success: false,
                    message: "Please wait 60 seconds before requesting another OTP"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Verification code sent to your registered email address"
            });
        } catch (error) {
            console.error("LOGIN OTP REQUEST ERROR:", error.message);

            return res.status(503).json({
                success: false,
                message: "Unable to send a verification code right now"
            });
        }
    }
);


/* =========================================================
   LOGIN OTP VERIFICATION
========================================================= */

router.post(
    "/verify-login-otp",
    async (req, res) => {
        try {
            const email =
                typeof req.body.email === "string"
                    ? req.body.email.trim().toLowerCase()
                    : "";
            const otp =
                typeof req.body.otp === "string"
                    ? req.body.otp.trim()
                    : "";

            if (!email || !/^\d{6}$/.test(otp)) {
                return res.status(400).json({
                    success: false,
                    message: "Email and six-digit verification code are required"
                });
            }

            const user = await User.findOne({
                email,
                role: "citizen"
            });

            if (!user || user.isActive === false) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired verification code"
                });
            }

            const isValidOtp = await consumeOtp(user.email, "login", otp);

            if (!isValidOtp) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid or expired verification code"
                });
            }

            user.loginCount = (user.loginCount || 0) + 1;
            user.lastLogin = new Date();
            await user.save();

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token: generateToken(user),
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    profileImage: user.profileImage,
                    role: user.role,
                    isActive: user.isActive
                }
            });
        } catch (error) {
            console.error("LOGIN OTP VERIFICATION ERROR:", error.message);

            return res.status(500).json({
                success: false,
                message: "Server error while verifying the code"
            });
        }
    }
);


/* =========================================================
   FORGOT PASSWORD OTP REQUEST
========================================================= */

router.post(
    "/forgot-password",
    async (req, res) => {
        try {
            const email =
                typeof req.body.email === "string"
                    ? req.body.email.trim().toLowerCase()
                    : "";

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "A valid email address is required"
                });
            }

            const user = await User.findOne({
                email,
                role: "citizen"
            });

            if (user) {
                await issueOtp(
                    user.email,
                    "password-reset",
                    (otp) => `Your Smart City password reset code is ${otp}. It expires in 5 minutes. Do not share it.`,
                    (recipient, message) =>
                        sendEmail(recipient, message, "Your Smart City password reset code")
                );
            }

            return res.status(200).json({
                success: true,
                message: "If an account exists for this email, a password reset code has been sent"
            });
        } catch (error) {
            console.error("PASSWORD RESET OTP REQUEST ERROR:", error.message);

            return res.status(503).json({
                success: false,
                message: "Unable to send a password reset code right now"
            });
        }
    }
);


/* =========================================================
   RESET PASSWORD WITH OTP
========================================================= */

router.post(
    "/reset-password",
    async (req, res) => {
        try {
            const email =
                typeof req.body.email === "string"
                    ? req.body.email.trim().toLowerCase()
                    : "";
            const otp =
                typeof req.body.otp === "string"
                    ? req.body.otp.trim()
                    : "";
            const newPassword = req.body.newPassword;

            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
                !/^\d{6}$/.test(otp) ||
                typeof newPassword !== "string" ||
                newPassword.length < 8
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Email, six-digit code, and a password of at least 8 characters are required"
                });
            }

            const user = await User.findOne({
                email,
                role: "citizen"
            });

            if (!user || !(await consumeOtp(user.email, "password-reset", otp))) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired password reset code"
                });
            }

            user.password = await bcrypt.hash(newPassword, 10);
            await user.save();

            return res.status(200).json({
                success: true,
                message: "Password reset successfully"
            });
        } catch (error) {
            console.error("PASSWORD RESET ERROR:", error.message);

            return res.status(500).json({
                success: false,
                message: "Server error while resetting password"
            });
        }
    }
);


/* =========================================================
   ADMIN LOGIN
========================================================= */

router.post(
    "/admin-login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;


            if (!email || !password) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Admin email and password are required"

                });

            }


            const normalizedEmail =
                email.trim().toLowerCase();


            const admin =
                await User.findOne({

                    email:
                        normalizedEmail,

                    role: "admin"

                });


            if (!admin) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Admin account not found"

                });

            }


            if (
                admin.isActive === false
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Admin account is inactive"

                });

            }


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    admin.password
                );


            if (!passwordMatch) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid admin email or password"

                });

            }


            admin.loginCount =
                (admin.loginCount || 0) + 1;

            admin.lastLogin =
                new Date();

            await admin.save();


            const token =
                generateToken(admin);


            return res.status(200).json({

                success: true,

                message:
                    "Admin login successful",

                token,

                admin: {

                    id: admin._id,

                    name: admin.name,

                    email: admin.email,

                    role: admin.role,

                    loginCount:
                        admin.loginCount,

                    lastLogin:
                        admin.lastLogin

                },

                user: {

                    id: admin._id,

                    name: admin.name,

                    email: admin.email,

                    role: admin.role,

                    loginCount:
                        admin.loginCount,

                    lastLogin:
                        admin.lastLogin

                }

            });


        } catch (error) {

            console.error(
                "ADMIN LOGIN ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error during admin login"

            });

        }

    }
);


/* =========================================================
   PROFILE IMAGE VIEW
========================================================= */

router.get(
    "/profile-image/:filename",
    async (req, res) => {

        try {

            const filename =
                path.basename(
                    req.params.filename
                );

            const imagePath =
                path.join(
                    profileUploadDir,
                    filename
                );


            if (
                !fs.existsSync(imagePath)
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Profile image not found"

                });

            }


            return res.sendFile(
                imagePath
            );


        } catch (error) {

            console.error(
                "PROFILE IMAGE ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Unable to load profile image"

            });

        }

    }
);


/* =========================================================
   UPDATE CURRENT USER PROFILE
   WITH PROFILE IMAGE
========================================================= */

router.put(
    "/profile",
    uploadProfileImage.single(
        "profileImage"
    ),
    async (req, res) => {

        let uploadedFilePath = null;

        try {

            const user =
                await getAuthenticatedUser(
                    req
                );


            const {
                name,
                phone
            } = req.body;


            if (
                !name ||
                !name.trim()
            ) {

                if (req.file) {
                    // Memory uploads require no file cleanup.
                }

                return res.status(400).json({

                    success: false,

                    message:
                        "Name is required"

                });

            }


            if (req.file) {
                uploadedFilePath =
                    req.file.path;
            }


            const oldProfileImage =
                user.profileImage || "";


            user.name =
                name.trim();


            if (
                phone !== undefined
            ) {

                user.phone =
                    phone.trim();

            }


            if (req.file) {

                user.profileImage = await uploadProfilePhoto(req.file);
            } else if (req.body.removeProfileImage === "true") {
                user.profileImage = "";

            }


            await user.save();


            /*
             * Delete previous profile image
             * only after new image is saved
             */
            if (
                req.file &&
                oldProfileImage
            ) {

                const oldFilename =
                    path.basename(
                        oldProfileImage
                    );

                const oldImagePath =
                    path.join(
                        profileUploadDir,
                        oldFilename
                    );


                if (
                    fs.existsSync(
                        oldImagePath
                    )
                ) {

                    try {

                        fs.unlinkSync(
                            oldImagePath
                        );

                    } catch (deleteError) {

                        console.error(
                            "OLD PROFILE IMAGE DELETE ERROR:",
                            deleteError
                        );

                    }

                }

            }


            return res.status(200).json({

                success: true,

                message:
                    "Profile updated successfully",

                user: {

                    id: user._id,

                    name: user.name,

                    email: user.email,

                    phone: user.phone,

                    address: user.address,

                    city: user.city,

                    pincode: user.pincode,

                    profileImage:
                        user.profileImage,

                    role: user.role,

                    isActive:
                        user.isActive,

                    loginCount:
                        user.loginCount,

                    lastLogin:
                        user.lastLogin

                }

            });


        } catch (error) {

            console.error(
                "PROFILE UPDATE ERROR:",
                error
            );


            /*
             * Delete newly uploaded file
             * if database update fails
             */
            if (
                uploadedFilePath &&
                fs.existsSync(
                    uploadedFilePath
                )
            ) {

                try {

                    fs.unlinkSync(
                        uploadedFilePath
                    );

                } catch (deleteError) {

                    console.error(
                        "UPLOADED FILE CLEANUP ERROR:",
                        deleteError
                    );

                }

            }


            return res.status(500).json({

                success: false,

                message:
                    error.message ||
                    "Unable to update profile"

            });

        }

    }
);


/* =========================================================
   GET CURRENT USER
========================================================= */

router.get(
    "/me",
    async (req, res) => {

        try {

            const user =
                await getAuthenticatedUser(
                    req
                );


            return res.status(200).json({

                success: true,

                user: {

                    id: user._id,

                    name: user.name,

                    email: user.email,

                    phone: user.phone,

                    address: user.address,

                    city: user.city,

                    pincode: user.pincode,

                    profileImage:
                        user.profileImage,

                    role: user.role,

                    isActive:
                        user.isActive,

                    loginCount:
                        user.loginCount,

                    lastLogin:
                        user.lastLogin

                }

            });


        } catch (error) {

            console.error(
                "GET ME ERROR:",
                error
            );

            return res.status(401).json({

                success: false,

                message:
                    "Invalid or expired token"

            });

        }

    }
);


module.exports = router;