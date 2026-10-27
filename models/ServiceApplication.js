const mongoose = require("mongoose");

const serviceApplicationSchema = new mongoose.Schema(
    {
        applicationId: {
            type: String,
            unique: true,
            required: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        citizenName: {
            type: String,
            default: ""
        },

        citizenEmail: {
            type: String,
            default: ""
        },

        citizenPhone: {
            type: String,
            default: ""
        },

        serviceName: {
            type: String,
            required: true
        },

        category: {
            type: String,
            default: ""
        },

        description: {
            type: String,
            default: ""
        },

        address: {
            type: String,
            default: ""
        },

        city: {
            type: String,
            default: ""
        },

        applicationData: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        status: {
            type: String,

            enum: [
                "Pending",
                "Under Review",
                "In Progress",
                "Approved",
                "Rejected",
                "Completed"
            ],

            default: "Pending"
        },

        adminRemark: {
            type: String,
            default: ""
        },

        submittedAt: {
            type: Date,
            default: Date.now
        },

        updatedAt: {
            type: Date,
            default: Date.now
        }
    },

    {
        timestamps: true
    }
);


module.exports = mongoose.model(
    "ServiceApplication",
    serviceApplicationSchema
);