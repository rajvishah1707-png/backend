const express = require("express");
const mongoose = require("mongoose");

const Service = require("../models/Service");

const router = express.Router();


// ======================================================
// DEFAULT SERVICES
// ======================================================

const defaultServices = [
    {
        name: "Water Supply",
        description:
            "Apply for new water connection and manage water supply related services.",
        category: "Utilities",
        icon: "💧",
        eligibility: "Residents of the city",
        requiredDocuments: [
            "Identity Proof",
            "Address Proof"
        ],
        fees: "As per municipal rules",
        processingTime: "5-7 working days",
        contact: "Water Department"
    },

    {
        name: "Electricity Service",
        description:
            "Access electricity connection and electricity related civic services.",
        category: "Utilities",
        icon: "⚡",
        eligibility: "City residents",
        requiredDocuments: [
            "Identity Proof",
            "Address Proof"
        ],
        fees: "As per electricity department",
        processingTime: "5-7 working days",
        contact: "Electricity Department"
    },

    {
        name: "Waste Management",
        description:
            "Register waste management and garbage collection related requests.",
        category: "Environment",
        icon: "♻️",
        eligibility: "All citizens",
        requiredDocuments: [
            "Identity Proof"
        ],
        fees: "Free",
        processingTime: "2-3 working days",
        contact: "Waste Management Department"
    },

    {
        name: "Road Services",
        description:
            "Report road problems and request civic road maintenance services.",
        category: "Infrastructure",
        icon: "🛣️",
        eligibility: "All citizens",
        requiredDocuments: [
            "Identity Proof",
            "Location Details"
        ],
        fees: "Free",
        processingTime: "3-7 working days",
        contact: "Road Department"
    },

    {
        name: "Health Services",
        description:
            "Access municipal health services and public health facilities.",
        category: "Healthcare",
        icon: "🏥",
        eligibility: "All citizens",
        requiredDocuments: [
            "Identity Proof"
        ],
        fees: "Free",
        processingTime: "1-3 working days",
        contact: "Health Department"
    },

    {
        name: "Education Services",
        description:
            "Access government education services and related applications.",
        category: "Education",
        icon: "🎓",
        eligibility: "Eligible students and citizens",
        requiredDocuments: [
            "Identity Proof",
            "Educational Documents"
        ],
        fees: "As applicable",
        processingTime: "5-10 working days",
        contact: "Education Department"
    },

    {
        name: "Emergency Services",
        description:
            "Access important emergency and public safety services.",
        category: "Emergency",
        icon: "🚨",
        eligibility: "All citizens",
        requiredDocuments: [],
        fees: "Free",
        processingTime: "Immediate",
        contact: "Emergency Department"
    },

    {
        name: "Government Services",
        description:
            "Access various government and municipal citizen services.",
        category: "Government",
        icon: "🏛️",
        eligibility: "All eligible citizens",
        requiredDocuments: [
            "Identity Proof"
        ],
        fees: "As applicable",
        processingTime: "3-10 working days",
        contact: "Municipal Office"
    }
];


// ======================================================
// SEED DEFAULT SERVICES
// ======================================================

const seedDefaultServices = async () => {

    try {

        const count = await Service.countDocuments();

        if (count === 0) {

            await Service.insertMany(
                defaultServices
            );

            console.log(
                "Default city services inserted successfully."
            );
        }

    } catch (error) {

        console.error(
            "SERVICE SEED ERROR:",
            error.message
        );

    }
};


// ======================================================
// GET ALL SERVICES
// GET /api/services
// ======================================================

router.get("/", async (req, res) => {

    try {

        await seedDefaultServices();

        const {
            search,
            category,
            status
        } = req.query;

        const filter = {};

        if (search) {

            filter.$or = [
                {
                    name: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    description: {
                        $regex: search,
                        $options: "i"
                    }
                },
                {
                    category: {
                        $regex: search,
                        $options: "i"
                    }
                }
            ];
        }


        if (category && category !== "All") {

            filter.category = {
                $regex: `^${category}$`,
                $options: "i"
            };
        }


        if (status) {

            filter.status = status;

        } else {

            // Citizen side should normally
            // see only active services.
            // Admin will request all services
            // using ?status=all.
            filter.status = "active";
        }


        const services = await Service
            .find(filter)
            .sort({
                createdAt: -1
            });


        res.status(200).json({
            success: true,
            count: services.length,
            services
        });

    } catch (error) {

        console.error(
            "GET SERVICES ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch services"
        });

    }

});


// ======================================================
// GET ALL SERVICES FOR ADMIN
// GET /api/services/admin/all
// ======================================================

router.get("/admin/all", async (req, res) => {

    try {

        const services = await Service
            .find({})
            .sort({
                createdAt: -1
            });


        res.status(200).json({
            success: true,
            count: services.length,
            services
        });

    } catch (error) {

        console.error(
            "ADMIN GET SERVICES ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch admin services"
        });

    }

});


// ======================================================
// GET SINGLE SERVICE
// GET /api/services/:id
// ======================================================

router.get("/:id", async (req, res) => {

    try {

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid service ID"
            });

        }


        const service = await Service.findById(
            req.params.id
        );


        if (!service) {

            return res.status(404).json({
                success: false,
                message: "Service not found"
            });

        }


        res.status(200).json({
            success: true,
            service
        });

    } catch (error) {

        console.error(
            "GET SERVICE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to fetch service"
        });

    }

});


// ======================================================
// CREATE SERVICE
// POST /api/services
// ======================================================

router.post("/", async (req, res) => {

    try {

        const {
            name,
            description,
            category,
            icon,
            eligibility,
            requiredDocuments,
            fees,
            processingTime,
            contact,
            status
        } = req.body;


        if (
            !name ||
            !description ||
            !category
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Name, description and category are required"
            });

        }


        const service = new Service({

            name: name.trim(),

            description:
                description.trim(),

            category:
                category.trim(),

            icon:
                icon || "🏙️",

            eligibility:
                eligibility ||
                "Available for citizens",

            requiredDocuments:
                Array.isArray(requiredDocuments)
                    ? requiredDocuments
                    : [],

            fees:
                fees || "Free",

            processingTime:
                processingTime ||
                "3-5 working days",

            contact:
                contact ||
                "Municipal Office",

            status:
                status === "inactive"
                    ? "inactive"
                    : "active"
        });


        await service.save();


        res.status(201).json({
            success: true,
            message:
                "Service created successfully",
            service
        });

    } catch (error) {

        console.error(
            "CREATE SERVICE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to create service"
        });

    }

});


// ======================================================
// UPDATE SERVICE
// PUT /api/services/:id
// ======================================================

router.put("/:id", async (req, res) => {

    try {

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid service ID"
            });

        }


        const {
            name,
            description,
            category,
            icon,
            eligibility,
            requiredDocuments,
            fees,
            processingTime,
            contact,
            status
        } = req.body;


        const service =
            await Service.findById(
                req.params.id
            );


        if (!service) {

            return res.status(404).json({
                success: false,
                message: "Service not found"
            });

        }


        if (name !== undefined)
            service.name = name.trim();

        if (description !== undefined)
            service.description =
                description.trim();

        if (category !== undefined)
            service.category =
                category.trim();

        if (icon !== undefined)
            service.icon = icon;

        if (eligibility !== undefined)
            service.eligibility =
                eligibility;

        if (requiredDocuments !== undefined)
            service.requiredDocuments =
                Array.isArray(requiredDocuments)
                    ? requiredDocuments
                    : [];

        if (fees !== undefined)
            service.fees = fees;

        if (processingTime !== undefined)
            service.processingTime =
                processingTime;

        if (contact !== undefined)
            service.contact = contact;

        if (
            status === "active" ||
            status === "inactive"
        ) {
            service.status = status;
        }


        await service.save();


        res.status(200).json({
            success: true,
            message:
                "Service updated successfully",
            service
        });

    } catch (error) {

        console.error(
            "UPDATE SERVICE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to update service"
        });

    }

});


// ======================================================
// DELETE SERVICE
// DELETE /api/services/:id
// ======================================================

router.delete("/:id", async (req, res) => {

    try {

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.id
            )
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid service ID"
            });

        }


        const service =
            await Service.findById(
                req.params.id
            );


        if (!service) {

            return res.status(404).json({
                success: false,
                message: "Service not found"
            });

        }


        await Service.findByIdAndDelete(
            req.params.id
        );


        res.status(200).json({
            success: true,
            message:
                "Service deleted successfully"
        });

    } catch (error) {

        console.error(
            "DELETE SERVICE ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Failed to delete service"
        });

    }

});


module.exports = router;