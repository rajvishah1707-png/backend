const express = require("express");
const router = express.Router();

const ServiceApplication = require("../models/ServiceApplication");
const User = require("../models/User");
const Service = require("../models/Service");
const { requirementsFor, validateDocuments } = require("../utils/applicationDocuments");
const { parseFee } = require("../utils/paymentPolicy");
const { guardStatus, guardDelete } = require("../utils/applicationPaymentGuards");

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
                applicationData,
                purpose,
                additionalDetails,
                documents
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


            const service = serviceId ? await Service.findById(serviceId) : null;
            if (!service || service.status !== "active") {
                return res.status(400).json({ success: false, message: "Please select an active city service" });
            }
            const finalServiceName = service.name;
            const documentRequirements = requirementsFor(service);
            const attachments = await validateDocuments(user._id, documentRequirements, documents);


            const application =
                await ServiceApplication.create({
                    applicationId:
                        generateApplicationId(),

                    documentFlowVersion: 1,
                    documentRequirements,
                    documents: attachments,
                    serviceId: service._id,
                    feePaise: parseFee(service.fees),
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

                    applicationData: {
                        ...(applicationData && typeof applicationData === "object" && !Array.isArray(applicationData)
                            ? applicationData : {}),
                        ...(typeof purpose === "string" ? { purpose } : {}),
                        ...(typeof additionalDetails === "string" ? { additionalDetails } : {})
                    },

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

            return res.status(error.status || 500).json({
                success: false,
                message:
                    error.status ? error.message : "Failed to submit application",
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
            const identifier = req.params.id;
            const lookup = /^[a-f0-9]{24}$/i.test(identifier)
                ? { _id: identifier }
                : { applicationId: identifier };
            const application = await ServiceApplication.findOne({
                ...lookup,
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


            await guardStatus(application, status);
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

            return res.status(error.status || 500).json({
                success: false,
                message:
                    (error.status ? error.message : "Failed to update application"),
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


            await guardDelete(req.params.id);
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

            return res.status(error.status || 500).json({
                success: false,
                message:
                    (error.status ? error.message : "Failed to delete application"),
                error:
                    error.message
            });
        }
    }
);


module.exports = router;
