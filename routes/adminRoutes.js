const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const router = express.Router();

// ============================================================
// MODELS
// ============================================================

const User = require("../models/User");
const Service = require("../models/Service");
const ServiceApplication = require("../models/ServiceApplication");
const Complaint = require("../models/Complaint");
const Notification = require("../models/Notification");

// ============================================================
// ALLOWED APPLICATION STATUSES
// ============================================================

const allowedStatuses = [
    "Pending",
    "Under Review",
    "In Progress",
    "Approved",
    "Rejected",
    "Completed"
];

// ============================================================
// ALLOWED COMPLAINT STATUSES
// ============================================================

const allowedComplaintStatuses = [
    "Pending",
    "In Progress",
    "Resolved",
    "Rejected"
];

// ============================================================
// ADMIN DASHBOARD LIVE STATS
// GET /api/admin/stats
// ============================================================

router.get("/stats", async (req, res) => {
    try {

        const totalCitizens =
            await User.countDocuments({
                role: "citizen"
            });

        const activeCitizens =
            await User.countDocuments({
                role: "citizen",
                isActive: true
            });

        const inactiveCitizens =
            await User.countDocuments({
                role: "citizen",
                isActive: false
            });

        const totalLoginsResult =
            await User.aggregate([
                {
                    $match: {
                        role: "citizen"
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: {
                                $ifNull: [
                                    "$loginCount",
                                    0
                                ]
                            }
                        }
                    }
                }
            ]);

        const totalLogins =
            totalLoginsResult.length > 0
                ? totalLoginsResult[0].total
                : 0;

        const loggedInCitizens =
            await User.countDocuments({
                role: "citizen",
                loginCount: {
                    $gt: 0
                }
            });

        const totalServices =
            await Service.countDocuments();

        const totalApplications =
            await ServiceApplication.countDocuments();

        const pendingApplications =
            await ServiceApplication.countDocuments({
                status: "Pending"
            });

        const underReviewApplications =
            await ServiceApplication.countDocuments({
                status: "Under Review"
            });

        const inProgressApplications =
            await ServiceApplication.countDocuments({
                status: "In Progress"
            });

        const approvedApplications =
            await ServiceApplication.countDocuments({
                status: "Approved"
            });

        const rejectedApplications =
            await ServiceApplication.countDocuments({
                status: "Rejected"
            });

        const completedApplications =
            await ServiceApplication.countDocuments({
                status: "Completed"
            });

        const totalComplaints =
            await Complaint.countDocuments();

        const pendingComplaints =
            await Complaint.countDocuments({
                status: "Pending"
            });

        const inProgressComplaints =
            await Complaint.countDocuments({
                status: "In Progress"
            });

        const resolvedComplaints =
            await Complaint.countDocuments({
                status: "Resolved"
            });

        const rejectedComplaints =
            await Complaint.countDocuments({
                status: "Rejected"
            });

        res.status(200).json({
            success: true,

            statistics: {

                totalCitizens,
                activeCitizens,
                inactiveCitizens,

                totalLogins,
                loggedInCitizens,

                totalServices,

                totalApplications,
                pendingApplications,
                underReviewApplications,
                inProgressApplications,
                approvedApplications,
                rejectedApplications,
                completedApplications,

                totalComplaints,
                pendingComplaints,
                inProgressComplaints,
                resolvedComplaints,
                rejectedComplaints

            },

            lastUpdated: new Date()
        });

    } catch (error) {

        console.error(
            "Admin dashboard stats error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to load admin dashboard statistics",
            error: error.message
        });
    }
});

// ============================================================
// GET ALL CITIZENS
// GET /api/admin/users
// ============================================================

router.get("/users", async (req, res) => {

    try {

        const users =
            await User.find({
                role: "citizen"
            })
                .select("-password")
                .sort({
                    createdAt: -1
                });

        res.status(200).json({
            success: true,
            count: users.length,
            users
        });

    } catch (error) {

        console.error(
            "Get citizens error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "Failed to fetch citizens",
            error: error.message
        });
    }
});

// ============================================================
// GET SINGLE CITIZEN
// GET /api/admin/users/:id
// ============================================================

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid citizen ID"
                });

            }

            const user =
                await User.findOne({
                    _id: req.params.id,
                    role: "citizen"
                })
                    .select("-password");

            if (!user) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Citizen not found"
                });

            }

            res.status(200).json({
                success: true,
                user
            });

        } catch (error) {

            console.error(
                "Get citizen error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to fetch citizen",
                error: error.message
            });
        }
    }
);

// ============================================================
// CREATE CITIZEN
// POST /api/admin/users
// ============================================================

router.post(
    "/users",
    async (req, res) => {

        try {

            const {
                name,
                email,
                phone,
                address,
                city,
                pincode,
                password
            } = req.body;

            if (
                !name ||
                !email ||
                !phone ||
                !address ||
                !city ||
                !pincode ||
                !password
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "All required fields are required"
                });

            }

            const normalizedEmail =
                email.toLowerCase().trim();

            const existingUser =
                await User.findOne({
                    email: normalizedEmail
                });

            if (existingUser) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Email already registered"
                });

            }

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const user =
                new User({

                    name,

                    email:
                        normalizedEmail,

                    phone,

                    address,

                    city,

                    pincode,

                    password:
                        hashedPassword,

                    role:
                        "citizen",

                    isActive:
                        true,

                    loginCount:
                        0,

                    lastLogin:
                        null

                });

            await user.save();

            const userResponse =
                user.toObject();

            delete userResponse.password;

            res.status(201).json({
                success: true,
                message:
                    "Citizen created successfully",
                user:
                    userResponse
            });

        } catch (error) {

            console.error(
                "Create citizen error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to create citizen",
                error: error.message
            });
        }
    }
);

// ============================================================
// UPDATE CITIZEN
// PUT /api/admin/users/:id
// ============================================================

router.put(
    "/users/:id",
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid citizen ID"
                });

            }

            const {
                name,
                email,
                phone,
                address,
                city,
                pincode,
                password
            } = req.body;

            const user =
                await User.findOne({
                    _id: req.params.id,
                    role: "citizen"
                });

            if (!user) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Citizen not found"
                });

            }

            if (email !== undefined) {

                const normalizedEmail =
                    email.toLowerCase().trim();

                if (
                    normalizedEmail !==
                    user.email
                ) {

                    const emailExists =
                        await User.findOne({
                            email:
                                normalizedEmail,
                            _id: {
                                $ne:
                                    req.params.id
                            }
                        });

                    if (emailExists) {

                        return res.status(400).json({
                            success: false,
                            message:
                                "Email already registered"
                        });

                    }

                    user.email =
                        normalizedEmail;
                }
            }

            if (name !== undefined) {
                user.name = name;
            }

            if (phone !== undefined) {
                user.phone = phone;
            }

            if (address !== undefined) {
                user.address = address;
            }

            if (city !== undefined) {
                user.city = city;
            }

            if (pincode !== undefined) {
                user.pincode = pincode;
            }

            if (
                password !== undefined &&
                password.trim() !== ""
            ) {

                user.password =
                    await bcrypt.hash(
                        password,
                        10
                    );

            }

            await user.save();

            const userResponse =
                user.toObject();

            delete userResponse.password;

            res.status(200).json({
                success: true,
                message:
                    "Citizen updated successfully",
                user:
                    userResponse
            });

        } catch (error) {

            console.error(
                "Update citizen error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update citizen",
                error: error.message
            });
        }
    }
);

// ============================================================
// DELETE CITIZEN
// DELETE /api/admin/users/:id
// ============================================================

router.delete(
    "/users/:id",
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid citizen ID"
                });

            }

            const user =
                await User.findOneAndDelete({
                    _id: req.params.id,
                    role: "citizen"
                });

            if (!user) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Citizen not found"
                });

            }

            res.status(200).json({
                success: true,
                message:
                    "Citizen deleted successfully"
            });

        } catch (error) {

            console.error(
                "Delete citizen error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to delete citizen",
                error: error.message
            });
        }
    }
);

// ============================================================
// ACTIVATE / DEACTIVATE CITIZEN
// PATCH /api/admin/users/:id/status
// ============================================================

router.patch(
    "/users/:id/status",
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid citizen ID"
                });

            }

            const {
                isActive
            } = req.body;

            if (
                typeof isActive !==
                "boolean"
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "isActive must be true or false"
                });

            }

            const user =
                await User.findOne({
                    _id: req.params.id,
                    role: "citizen"
                });

            if (!user) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Citizen not found"
                });

            }

            user.isActive =
                isActive;

            await user.save();

            const userResponse =
                user.toObject();

            delete userResponse.password;

            res.status(200).json({
                success: true,
                message:
                    isActive
                        ? "Citizen activated successfully"
                        : "Citizen deactivated successfully",
                user:
                    userResponse
            });

        } catch (error) {

            console.error(
                "Citizen status error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to update citizen status",
                error: error.message
            });
        }
    }
);

// ============================================================
// GET ALL APPLICATIONS
// GET /api/admin/applications
// ============================================================

router.get(
    "/applications",
    async (req, res) => {

        try {

            const applications =
                await ServiceApplication.find()
                    .populate(
                        "userId",
                        "name email phone address city pincode"
                    )
                    .sort({
                        createdAt: -1
                    });

            res.status(200).json({
                success: true,
                count:
                    applications.length,
                applications
            });

        } catch (error) {

            console.error(
                "Get applications error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to fetch applications",
                error: error.message
            });
        }
    }
);

// ============================================================
// APPLICATION STATISTICS
// GET /api/admin/applications/stats
// ============================================================

router.get(
    "/applications/stats",
    async (req, res) => {

        try {

            const total =
                await ServiceApplication.countDocuments();

            const pending =
                await ServiceApplication.countDocuments({
                    status: "Pending"
                });

            const underReview =
                await ServiceApplication.countDocuments({
                    status: "Under Review"
                });

            const inProgress =
                await ServiceApplication.countDocuments({
                    status: "In Progress"
                });

            const approved =
                await ServiceApplication.countDocuments({
                    status: "Approved"
                });

            const rejected =
                await ServiceApplication.countDocuments({
                    status: "Rejected"
                });

            const completed =
                await ServiceApplication.countDocuments({
                    status: "Completed"
                });

            res.status(200).json({
                success: true,
                total,
                pending,
                underReview,
                inProgress,
                approved,
                rejected,
                completed
            });

        } catch (error) {

            console.error(
                "Application stats error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to fetch application statistics",
                error: error.message
            });
        }
    }
);

// ============================================================
// GET SINGLE APPLICATION
// GET /api/admin/applications/:id
// ============================================================

router.get(
    "/applications/:id",
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid application ID"
                });

            }

            const application =
                await ServiceApplication.findById(
                    req.params.id
                )
                    .populate(
                        "userId",
                        "name email phone address city pincode"
                    );

            if (!application) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Application not found"
                });

            }

            res.status(200).json({
                success: true,
                application
            });

        } catch (error) {

            console.error(
                "Get application error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to fetch application",
                error: error.message
            });
        }
    }
);

// ============================================================
// UPDATE APPLICATION STATUS + ADMIN REMARK
// PATCH /api/admin/applications/:id/status
// ============================================================

router.patch(
    "/applications/:id/status",
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid application ID"
                });

            }

            const {
                status,
                adminRemark
            } = req.body;

            if (
                !status ||
                !allowedStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid application status",
                    allowedStatuses
                });

            }

            const application =
                await ServiceApplication.findById(
                    req.params.id
                );

            if (!application) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Application not found"
                });

            }

            application.status =
                status;

            if (
                adminRemark !== undefined
            ) {

                application.adminRemark =
                    String(
                        adminRemark
                    ).trim();

            }

            application.updatedAt =
                new Date();

            await application.save();


            // ==================================================
            // APPLICATION NOTIFICATION
            // ==================================================

            let notificationTitle = "";
            let notificationMessage = "";

            if (
                status === "Under Review"
            ) {

                notificationTitle =
                    "Application Under Review";

                notificationMessage =
                    `Your application ${
                        application.applicationId ||
                        ""
                    } is now under review by the admin.`;

            } else if (
                status === "In Progress"
            ) {

                notificationTitle =
                    "Application In Progress";

                notificationMessage =
                    `Your application ${
                        application.applicationId ||
                        ""
                    } is currently being processed.`;

            } else if (
                status === "Approved"
            ) {

                notificationTitle =
                    "Application Approved";

                notificationMessage =
                    `Your application ${
                        application.applicationId ||
                        ""
                    } has been approved.`;

            } else if (
                status === "Rejected"
            ) {

                notificationTitle =
                    "Application Rejected";

                notificationMessage =
                    `Your application ${
                        application.applicationId ||
                        ""
                    } has been rejected.`;

            } else if (
                status === "Completed"
            ) {

                notificationTitle =
                    "Application Completed";

                notificationMessage =
                    `Your application ${
                        application.applicationId ||
                        ""
                    } has been completed successfully.`;

            } else if (
                status === "Pending"
            ) {

                notificationTitle =
                    "Application Status Updated";

                notificationMessage =
                    `Your application ${
                        application.applicationId ||
                        ""
                    } is currently pending.`;

            }


            if (
                notificationTitle &&
                application.userId
            ) {

                await Notification.create({

                    userId:
                        application.userId,

                    title:
                        notificationTitle,

                    message:
                        notificationMessage,

                    type:
                        "Application",

                    referenceId:
                        application._id.toString()

                });

            }


            res.status(200).json({
                success: true,
                message:
                    "Application status updated successfully",
                application
            });

        } catch (error) {

            console.error(
                "Update application status error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Server error while updating application status",
                error: error.message
            });
        }
    }
);

// ============================================================
// DELETE APPLICATION
// DELETE /api/admin/applications/:id
// ============================================================

router.delete(
    "/applications/:id",
    async (req, res) => {

        try {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.params.id
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid application ID"
                });

            }

            const application =
                await ServiceApplication.findByIdAndDelete(
                    req.params.id
                );

            if (!application) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Application not found"
                });

            }

            res.status(200).json({
                success: true,
                message:
                    "Application deleted successfully"
            });

        } catch (error) {

            console.error(
                "Delete application error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to delete application",
                error: error.message
            });
        }
    }
);

// ============================================================
// CREATE APPLICATION FROM ADMIN
// POST /api/admin/applications
// ============================================================

router.post(
    "/applications",
    async (req, res) => {

        try {

            const {
                userId,
                citizenName,
                citizenEmail,
                citizenPhone,
                serviceName,
                category,
                description,
                address,
                city,
                applicationData
            } = req.body;

            if (
                !userId ||
                !serviceName
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "userId and serviceName are required"
                });

            }

            if (
                !mongoose.Types.ObjectId.isValid(
                    userId
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid user ID"
                });

            }

            const citizen =
                await User.findOne({
                    _id: userId,
                    role: "citizen"
                });

            if (!citizen) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Citizen not found"
                });

            }

            const applicationId =
                `APP-${Date.now()}-${Math.floor(
                    1000 +
                    Math.random() * 9000
                )}`;

            const application =
                new ServiceApplication({

                    applicationId,

                    userId,

                    citizenName:
                        citizenName ||
                        citizen.name ||
                        "",

                    citizenEmail:
                        citizenEmail ||
                        citizen.email ||
                        "",

                    citizenPhone:
                        citizenPhone ||
                        citizen.phone ||
                        "",

                    serviceName,

                    category:
                        category || "",

                    description:
                        description || "",

                    address:
                        address ||
                        citizen.address ||
                        "",

                    city:
                        city ||
                        citizen.city ||
                        "",

                    applicationData:
                        applicationData || {},

                    status:
                        "Pending",

                    adminRemark:
                        "",

                    submittedAt:
                        new Date(),

                    updatedAt:
                        new Date()

                });

            await application.save();

            res.status(201).json({
                success: true,
                message:
                    "Application created successfully",
                application
            });

        } catch (error) {

            console.error(
                "Create application error:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to create application",
                error: error.message
            });
        }
    }
);

// ============================================================
// ADMIN COMPLAINT SUMMARY
// GET /api/admin/complaints/stats
// ============================================================

router.get(
    "/complaints/stats",
    async (req, res) => {

        try {

            const total =
                await Complaint.countDocuments();

            const pending =
                await Complaint.countDocuments({
                    status: "Pending"
                });

            const inProgress =
                await Complaint.countDocuments({
                    status: "In Progress"
                });

            const resolved =
                await Complaint.countDocuments({
                    status: "Resolved"
                });

            const rejected =
                await Complaint.countDocuments({
                    status: "Rejected"
                });

            res.status(200).json({

                success: true,

                total,
                pending,
                inProgress,
                resolved,
                rejected,

                stats: {
                    total,
                    pending,
                    inProgress,
                    resolved,
                    rejected
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
                    "Failed to fetch complaint statistics",
                error: error.message
            });
        }
    }
);

// ============================================================
// GET ALL COMPLAINTS - ADMIN
// GET /api/admin/complaints
// ============================================================

router.get(
    "/complaints",
    async (req, res) => {

        try {

            const complaints =
                await Complaint.find({})
                    .populate(
                        "userId",
                        "name email phone address city pincode"
                    )
                    .sort({
                        createdAt: -1
                    })
                    .lean();

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
                    "Failed to fetch complaints",
                error: error.message
            });
        }
    }
);

// ============================================================
// GET SINGLE COMPLAINT - ADMIN
// GET /api/admin/complaints/:id
// ============================================================

router.get(
    "/complaints/:id",
    async (req, res) => {

        try {

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
                await Complaint.findById(
                    req.params.id
                )
                    .populate(
                        "userId",
                        "name email phone address city pincode"
                    )
                    .lean();

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
                    "Failed to fetch complaint",
                error: error.message
            });
        }
    }
);

// ============================================================
// UPDATE COMPLAINT STATUS + ADMIN REPLY
// PATCH /api/admin/complaints/:id/status
// ============================================================

router.patch(
    "/complaints/:id/status",
    async (req, res) => {

        try {

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

            const {
                status,
                adminReply
            } = req.body;

            if (
                !status ||
                !allowedComplaintStatuses.includes(
                    status
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid complaint status",
                    allowedStatuses:
                        allowedComplaintStatuses
                });

            }

            const complaint =
                await Complaint.findById(
                    req.params.id
                );

            if (!complaint) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Complaint not found"
                });

            }

            // ==================================================
            // UPDATE COMPLAINT STATUS
            // ==================================================

            complaint.status =
                status;


            // ==================================================
            // UPDATE ADMIN REPLY
            // ==================================================

            if (
                adminReply !== undefined
            ) {

                complaint.adminReply =
                    String(
                        adminReply
                    ).trim();

            }


            // ==================================================
            // RESOLVED DATE
            // ==================================================

            if (
                status === "Resolved"
            ) {

                complaint.resolvedAt =
                    new Date();

            } else {

                complaint.resolvedAt =
                    null;

            }


            await complaint.save();


            // ==================================================
            // CREATE CITIZEN NOTIFICATION
            // ==================================================

            let notificationTitle = "";
            let notificationMessage = "";


            if (
                status === "In Progress"
            ) {

                notificationTitle =
                    "Complaint Under Process";

                notificationMessage =
                    `Your complaint "${complaint.subject}" has been taken under process by the admin.`;

            }

            else if (
                status === "Resolved"
            ) {

                notificationTitle =
                    "Complaint Resolved";

                notificationMessage =
                    `Your complaint "${complaint.subject}" has been resolved successfully.`;

            }

            else if (
                status === "Rejected"
            ) {

                notificationTitle =
                    "Complaint Rejected";

                notificationMessage =
                    `Your complaint "${complaint.subject}" has been rejected by the admin.`;

            }

            else if (
                status === "Pending"
            ) {

                notificationTitle =
                    "Complaint Status Updated";

                notificationMessage =
                    `Your complaint "${complaint.subject}" is currently pending.`;

            }


            // ==================================================
            // ADD ADMIN REPLY TO NOTIFICATION
            // ==================================================

            if (
                adminReply &&
                String(
                    adminReply
                ).trim() !== ""
            ) {

                notificationMessage +=
                    ` Admin reply: ${String(
                        adminReply
                    ).trim()}`;

            }


            // ==================================================
            // SAVE NOTIFICATION
            // ==================================================

            if (
                notificationTitle &&
                complaint.userId
            ) {

                await Notification.create({

                    userId:
                        complaint.userId,

                    title:
                        notificationTitle,

                    message:
                        notificationMessage,

                    type:
                        "Complaint",

                    referenceId:
                        complaint._id.toString(),

                    isRead:
                        false

                });

            }


            // ==================================================
            // RETURN UPDATED COMPLAINT
            // ==================================================

            const updatedComplaint =
                await Complaint.findById(
                    complaint._id
                )
                    .populate(
                        "userId",
                        "name email phone address city pincode"
                    )
                    .lean();


            res.status(200).json({

                success: true,

                message:
                    "Complaint updated successfully",

                complaint:
                    updatedComplaint

            });

        } catch (error) {

            console.error(
                "Update complaint error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Failed to update complaint",

                error:
                    error.message

            });
        }
    }
);

// ============================================================
// DELETE COMPLAINT
// DELETE /api/admin/complaints/:id
// ============================================================

router.delete(
    "/complaints/:id",
    async (req, res) => {

        try {

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
                await Complaint.findByIdAndDelete(
                    req.params.id
                );

            if (!complaint) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Complaint not found"
                });

            }

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
                error: error.message
            });
        }
    }
);

// ============================================================
// EXPORT ROUTER
// ============================================================

module.exports = router;