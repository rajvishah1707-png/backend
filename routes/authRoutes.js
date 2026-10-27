const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const User = require("../models/User");

const router = express.Router();

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

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, profileUploadDir);
    },

    filename: (req, file, cb) => {

        const extensionMap = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp"
        };

        const extension =
            extensionMap[file.mimetype] || ".jpg";

        const uniqueName =
            `profile-${Date.now()}-${crypto
                .randomBytes(8)
                .toString("hex")}${extension}`;

        cb(null, uniqueName);
    }

});


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
    async (req, res) => {

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

                return res.status(400).json({
                    success: false,
                    message:
                        "Name, email, phone and password are required"
                });

            }


            const normalizedEmail =
                email.trim().toLowerCase();


            const existingUser =
                await User.findOne({
                    email: normalizedEmail
                });


            if (existingUser) {

                return res.status(400).json({
                    success: false,
                    message:
                        "An account with this email already exists"
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

                    phone: phone.trim(),

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

                    profileImage: "",

                    role: "citizen",

                    isActive: true,

                    loginCount: 0,

                    lastLogin: null

                });


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
                        "Email and password are required"

                });

            }


            const normalizedEmail =
                email.trim().toLowerCase();


            const user =
                await User.findOne({
                    email: normalizedEmail,
                    role: "citizen"
                });


            if (!user) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid email or password"

                });

            }


            if (
                user.isActive === false
            ) {

                return res.status(403).json({

                    success: false,

                    message:
                        "Your account is inactive. Please contact administrator."

                });

            }


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );


            if (!passwordMatch) {

                return res.status(401).json({

                    success: false,

                    message:
                        "Invalid email or password"

                });

            }


            user.loginCount =
                (user.loginCount || 0) + 1;

            user.lastLogin =
                new Date();

            await user.save();


            const token =
                generateToken(user);


            return res.status(200).json({

                success: true,

                message:
                    "Login successful",

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
                "LOGIN ERROR:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Server error during login"

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
                    fs.unlinkSync(
                        req.file.path
                    );
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

                user.profileImage =
                    getProfileImageUrl(
                        req.file.filename
                    );

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