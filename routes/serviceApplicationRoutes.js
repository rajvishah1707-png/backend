const express = require("express");
const router = express.Router();

const ServiceApplication = require("../models/ServiceApplication");
const User = require("../models/User");
const Service = require("../models/Service");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");


// =====================================================
// GENERATE APPLICATION ID
// =====================================================

const generateApplicationId = () => {
    const randomNumber =
        Math.floor(1000 + Math.random() * 9000);

    return `APP-${Date.now()}-${randomNumber}`;
};


// =====================================================
// CREATE NEW APPLICATION - CITIZEN
// =====================================================

router.post(
    "/",
    authMiddleware,
    async (req, res) => {
        try {
            const userId = req.user.id;

            const {
                serviceId,
                serviceName,
                category,
                description,
                address,
                city,
                applicationData
            } = req.body;


            if (!serviceName) {
                return res.status(400).json({
                    success: false,
                    message: "Service name is required"
                });
            }


            const user = await User.findById(userId);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "Citizen not found"
                });
            }


            let finalServiceName =
                serviceName;


            // If serviceId is provided,
            // get latest service information

            if (serviceId) {
                try {
                    const service =
                        await Service.findById(
                            serviceId
                        );

                    if (service) {
                        finalServiceName =
                            service.name ||
                            service.serviceName ||
                            serviceName;
                    }

                } catch (error) {
                    console.log(
                        "Service lookup skipped"
                    );
                }
            }


            const application =
                await ServiceApplication.create({
                    applicationId:
                        generateApplicationId(),

                    userId: user._id,

                    citizenName:
                        user.name || "",

                    citizenEmail:
                        user.email || "",

                    citizenPhone:
                        user.phone || "",

                    serviceName:
                        finalServiceName,

                    category:
                        category || "",

                    description:
                        description || "",

                    address:
                        address || user.address || "",

                    city:
                        city || user.city || "",

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


            return res.status(201).json({
                success: true,
                message:
                    "Application submitted successfully",
                application
            });

        } catch (error) {
            console.error(
                "Create application error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to submit application",
                error:
                    error.message
            });
        }
    }
);


// =====================================================
// GET MY APPLICATIONS - CITIZEN
// =====================================================

router.get(
    "/my-applications",
    authMiddleware,
    async (req, res) => {
        try {
            const userId = req.user.id;

            const applications =
                await ServiceApplication.find({
                    userId
                })
                .sort({
                    createdAt: -1
                });


            return res.json({
                success: true,
                count: applications.length,
                applications
            });

        } catch (error) {
            console.error(
                "My applications error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to load applications",
                error:
                    error.message
            });
        }
    }
);


// =====================================================
// GET SINGLE APPLICATION - CITIZEN
// =====================================================

router.get(
    "/:id",
    authMiddleware,
    async (req, res) => {
        try {
            const application =
                await ServiceApplication.findOne({
                    _id: req.params.id,
                    userId: req.user.id
                });


            if (!application) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Application not found"
                });
            }


            return res.json({
                success: true,
                application
            });

        } catch (error) {
            console.error(
                "Get application error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to load application",
                error:
                    error.message
            });
        }
    }
);


// =====================================================
// ADMIN - UPDATE APPLICATION STATUS
// =====================================================

router.patch(
    "/:id/status",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
            const {
                status,
                adminRemark
            } = req.body;


            const allowedStatuses = [
                "Pending",
                "Under Review",
                "In Progress",
                "Approved",
                "Rejected",
                "Completed"
            ];


            if (
                !status ||
                !allowedStatuses.includes(status)
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


            application.status = status;

            if (
                adminRemark !== undefined
            ) {
                application.adminRemark =
                    adminRemark;
            }

            application.updatedAt =
                new Date();


            await application.save();


            return res.json({
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

            return res.status(500).json({
                success: false,
                message:
                    "Failed to update application",
                error:
                    error.message
            });
        }
    }
);


// =====================================================
// ADMIN - DELETE APPLICATION
// =====================================================

router.delete(
    "/:id",
    authMiddleware,
    adminMiddleware,
    async (req, res) => {
        try {
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


            await ServiceApplication.findByIdAndDelete(
                req.params.id
            );


            return res.json({
                success: true,
                message:
                    "Application deleted successfully"
            });

        } catch (error) {
            console.error(
                "Delete application error:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Failed to delete application",
                error:
                    error.message
            });
        }
    }
);


module.exports = router;