const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const Complaint = require("../models/Complaint");

const authMiddleware =
    require("../middleware/authMiddleware");

/* =========================================================
   UPLOAD DIRECTORY
========================================================= */

const uploadDirectory = path.join(
    __dirname,
    "../uploads/complaints"
);

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}

/* =========================================================
   MULTER STORAGE
========================================================= */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },

    filename: function (req, file, cb) {
        const extension =
            path.extname(file.originalname).toLowerCase();

        const uniqueName =
            "complaint-" +
            Date.now() +
            "-" +
            Math.round(Math.random() * 100000) +
            extension;

        cb(null, uniqueName);
    }
});

/* =========================================================
   IMAGE FILTER
========================================================= */

const imageFilter = function (req, file, cb) {
    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only JPG, JPEG, PNG and WEBP images are allowed."
            )
        );
    }
};

/* =========================================================
   MULTER CONFIG
========================================================= */

const upload = multer({
    storage: storage,

    fileFilter: imageFilter,

    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

const uploadSingleImage = (req, res, next) => {
    upload.single("image")(
        req,
        res,
        function (error) {
            if (error) {
                console.error(
                    "Image upload error:",
                    error
                );

                if (
                    error.code ===
                    "LIMIT_FILE_SIZE"
                ) {
                    return res.status(400).json({
                        success: false,
                        message:
                            "Image size must be less than 5MB."
                    });
                }

                return res.status(400).json({
                    success: false,
                    message:
                        error.message ||
                        "Image upload failed."
                });
            }

            next();
        }
    );
};

/* =========================================================
   HELPER - GET LOGGED IN USER ID
========================================================= */

const getUserId = (req) => {
    return (
        req.user?.id ||
        req.user?._id ||
        req.user?.userId
    );
};

/* =========================================================
   HELPER - CHECK USER ID
========================================================= */

const isValidUserId = (userId) => {
    return (
        userId &&
        mongoose.Types.ObjectId.isValid(userId)
    );
};

/* =========================================================
   GENERATE COMPLAINT ID
========================================================= */

const generateComplaintId = () => {
    return (
        "CMP-" +
        Date.now() +
        "-" +
        Math.floor(
            100 + Math.random() * 900
        )
    );
};

/* =========================================================
   GET ALL MY COMPLAINTS
   GET /api/complaints
========================================================= */

router.get(
    "/",
    authMiddleware,
    async (req, res) => {
        try {
            const userId =
                getUserId(req);

            if (!isValidUserId(userId)) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Unauthorized user"
                });
            }

            const complaints =
                await Complaint.find({
                    userId:
                        new mongoose.Types.ObjectId(
                            userId
                        )
                }).sort({
                    createdAt: -1
                });

            res.status(200).json({
                success: true,
                count:
                    complaints.length,
                complaints
            });

        } catch (error) {
            console.error(
                "Get complaints error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load complaints",
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   GET COMPLAINT STATISTICS
   GET /api/complaints/stats/summary
========================================================= */

router.get(
    "/stats/summary",
    authMiddleware,
    async (req, res) => {
        try {
            const userId =
                getUserId(req);

            if (!isValidUserId(userId)) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Unauthorized user"
                });
            }

            const stats =
                await Complaint.aggregate([
                    {
                        $match: {
                            userId:
                                new mongoose.Types.ObjectId(
                                    userId
                                )
                        }
                    },

                    {
                        $group: {
                            _id: null,

                            total: {
                                $sum: 1
                            },

                            pending: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$status",
                                                "Pending"
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },

                            inProgress: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$status",
                                                "In Progress"
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },

                            resolved: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$status",
                                                "Resolved"
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            },

                            rejected: {
                                $sum: {
                                    $cond: [
                                        {
                                            $eq: [
                                                "$status",
                                                "Rejected"
                                            ]
                                        },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ]);

            const result =
                stats.length > 0
                    ? stats[0]
                    : {
                        total: 0,
                        pending: 0,
                        inProgress: 0,
                        resolved: 0,
                        rejected: 0
                    };

            res.status(200).json({
                success: true,

                stats: {
                    total:
                        result.total || 0,

                    pending:
                        result.pending || 0,

                    inProgress:
                        result.inProgress || 0,

                    resolved:
                        result.resolved || 0,

                    rejected:
                        result.rejected || 0
                }
            });

        } catch (error) {
            console.error(
                "Complaint stats error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load complaint statistics",
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   CREATE COMPLAINT
   POST /api/complaints

   Supports:
   - Text fields
   - Image upload
========================================================= */

router.post(
    "/",
    authMiddleware,
    uploadSingleImage,
    async (req, res) => {
        try {
            const userId =
                getUserId(req);

            console.log(
                "CREATE COMPLAINT USER:",
                userId
            );

            console.log(
                "CREATE COMPLAINT BODY:",
                req.body
            );

            console.log(
                "CREATE COMPLAINT FILE:",
                req.file
            );

            if (!isValidUserId(userId)) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Unauthorized user"
                });
            }

            const {
                citizenName,
                citizenEmail,
                citizenPhone,
                category,
                subject,
                description,
                address,
                city,
                priority
            } = req.body;

            /* ---------------------------------------------
               VALIDATION
            --------------------------------------------- */

            if (
                !category ||
                !category.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Complaint category is required"
                });
            }

            if (
                !subject ||
                subject.trim().length < 3
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Complaint subject must contain at least 3 characters"
                });
            }

            if (
                !description ||
                description.trim().length < 10
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Complaint description must contain at least 10 characters"
                });
            }

            /* ---------------------------------------------
               PRIORITY
            --------------------------------------------- */

            const allowedPriorities = [
                "Low",
                "Medium",
                "High",
                "Urgent"
            ];

            const selectedPriority =
                priority || "Medium";

            if (
                !allowedPriorities.includes(
                    selectedPriority
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid complaint priority",
                    allowedPriorities
                });
            }

            /* ---------------------------------------------
               IMAGE PATH
            --------------------------------------------- */

            let imagePath = "";

            if (req.file) {
                imagePath =
                    "/api/complaints/image/" +
                    req.file.filename;
            }

            /* ---------------------------------------------
               CREATE COMPLAINT
            --------------------------------------------- */

            const complaint =
                new Complaint({
                    complaintId:
                        generateComplaintId(),

                    userId:
                        new mongoose.Types.ObjectId(
                            userId
                        ),

                    citizenName:
                        citizenName
                            ? citizenName.trim()
                            : "",

                    citizenEmail:
                        citizenEmail
                            ? citizenEmail
                                .trim()
                                .toLowerCase()
                            : "",

                    citizenPhone:
                        citizenPhone
                            ? citizenPhone.trim()
                            : "",

                    category:
                        category.trim(),

                    subject:
                        subject.trim(),

                    description:
                        description.trim(),

                    address:
                        address
                            ? address.trim()
                            : "",

                    city:
                        city
                            ? city.trim()
                            : "",

                    priority:
                        selectedPriority,

                    image:
                        imagePath,

                    status:
                        "Pending",

                    adminReply:
                        "",

                    resolvedAt:
                        null
                });

            await complaint.save();

            console.log(
                "COMPLAINT CREATED:",
                complaint._id
            );

            res.status(201).json({
                success: true,

                message:
                    "Complaint submitted successfully",

                complaint
            });

        } catch (error) {
            console.error(
                "Create complaint error:",
                error
            );

            // If database save fails after image upload,
            // remove uploaded image.
            if (req.file) {
                try {
                    const uploadedFile =
                        path.join(
                            uploadDirectory,
                            req.file.filename
                        );

                    if (
                        fs.existsSync(
                            uploadedFile
                        )
                    ) {
                        fs.unlinkSync(
                            uploadedFile
                        );
                    }
                } catch (deleteError) {
                    console.error(
                        "Uploaded image cleanup error:",
                        deleteError
                    );
                }
            }

            res.status(500).json({
                success: false,

                message:
                    "Failed to submit complaint",

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   SERVE COMPLAINT IMAGE
   GET /api/complaints/image/:filename
========================================================= */

router.get(
    "/image/:filename",
    async (req, res) => {
        try {
            const filename =
                path.basename(
                    req.params.filename
                );

            const filePath =
                path.join(
                    uploadDirectory,
                    filename
                );

            if (
                !fs.existsSync(
                    filePath
                )
            ) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Image not found"
                });
            }

            res.sendFile(
                path.resolve(filePath)
            );

        } catch (error) {
            console.error(
                "Complaint image error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Unable to load image"
            });
        }
    }
);

/* =========================================================
   GET MY COMPLAINTS
   GET /api/complaints/my

   MUST COME BEFORE /:id
========================================================= */

router.get(
    "/my",
    authMiddleware,
    async (req, res) => {
        try {
            const userId =
                getUserId(req);

            if (!isValidUserId(userId)) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Unauthorized user"
                });
            }

            const complaints =
                await Complaint.find({
                    userId:
                        new mongoose.Types.ObjectId(
                            userId
                        )
                }).sort({
                    createdAt: -1
                });

            res.status(200).json({
                success: true,
                count:
                    complaints.length,
                complaints
            });

        } catch (error) {
            console.error(
                "Get my complaints error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load complaints",
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   GET SINGLE COMPLAINT
   GET /api/complaints/:id
========================================================= */

router.get(
    "/:id",
    authMiddleware,
    async (req, res) => {
        try {
            const userId =
                getUserId(req);

            if (!isValidUserId(userId)) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Unauthorized user"
                });
            }

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid complaint ID"
                });
            }

            const complaint =
                await Complaint.findOne({
                    _id:
                        req.params.id,

                    userId:
                        new mongoose.Types.ObjectId(
                            userId
                        )
                });

            if (!complaint) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Complaint not found"
                });
            }

            res.status(200).json({
                success: true,
                complaint
            });

        } catch (error) {
            console.error(
                "Get complaint error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load complaint",
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   DELETE MY COMPLAINT
   DELETE /api/complaints/:id

   Only Pending complaints can be deleted.
========================================================= */

router.delete(
    "/:id",
    authMiddleware,
    async (req, res) => {
        try {
            const userId =
                getUserId(req);

            if (!isValidUserId(userId)) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Unauthorized user"
                });
            }

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid complaint ID"
                });
            }

            const complaint =
                await Complaint.findOne({
                    _id:
                        req.params.id,

                    userId:
                        new mongoose.Types.ObjectId(
                            userId
                        )
                });

            if (!complaint) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Complaint not found"
                });
            }

            /* ---------------------------------------------
               ONLY PENDING CAN BE DELETED
            --------------------------------------------- */

            if (
                complaint.status !==
                "Pending"
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Only pending complaints can be deleted"
                });
            }

            /* ---------------------------------------------
               DELETE IMAGE FROM SERVER
            --------------------------------------------- */

            if (complaint.image) {
                const imageFilename =
                    path.basename(
                        complaint.image
                    );

                const imagePath =
                    path.join(
                        uploadDirectory,
                        imageFilename
                    );

                try {
                    if (
                        fs.existsSync(
                            imagePath
                        )
                    ) {
                        fs.unlinkSync(
                            imagePath
                        );
                    }
                } catch (imageDeleteError) {
                    console.error(
                        "Image delete error:",
                        imageDeleteError
                    );
                }
            }

            await Complaint.deleteOne({
                _id:
                    complaint._id
            });

            res.status(200).json({
                success: true,
                message:
                    "Complaint deleted successfully"
            });

        } catch (error) {
            console.error(
                "Delete complaint error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to delete complaint",
                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   EXPORT ROUTER
========================================================= */

module.exports = router;