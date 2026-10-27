const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
    {
        complaintId: {
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

        category: {
            type: String,
            required: true
        },

        subject: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        address: {
            type: String,
            default: ""
        },

        city: {
            type: String,
            default: ""
        },

        priority: {
            type: String,
            enum: [
                "Low",
                "Medium",
                "High",
                "Urgent"
            ],
            default: "Medium"
        },

        // Complaint uploaded image
        image: {
            type: String,
            default: ""
        },

        status: {
            type: String,
            enum: [
                "Pending",
                "In Progress",
                "Resolved",
                "Rejected"
            ],
            default: "Pending"
        },

        adminReply: {
            type: String,
            default: ""
        },

        resolvedAt: {
            type: Date,
            default: null
        }
    },

    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "Complaint",
    complaintSchema
);