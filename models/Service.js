const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        category: {
            type: String,
            required: true,
            trim: true
        },

        icon: {
            type: String,
            default: "🏙️"
        },

        eligibility: {
            type: String,
            default: "Available for citizens"
        },

        requiredDocuments: {
            type: [String],
            default: []
        },

        fees: {
            type: String,
            default: "Free"
        },

        processingTime: {
            type: String,
            default: "3-5 working days"
        },

        contact: {
            type: String,
            default: "Municipal Office"
        },

        status: {
            type: String,
            enum: ["active", "inactive"],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Service", serviceSchema);