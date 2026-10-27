const mongoose = require("mongoose");

const digitalDocumentSchema = new mongoose.Schema(
    {
        // Unique document ID
        documentId: {
            type: String,
            unique: true,
            required: true
        },

        // Citizen who uploaded the document
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        // Citizen information
        citizenName: {
            type: String,
            default: ""
        },

        citizenEmail: {
            type: String,
            default: ""
        },

        // Document information
        documentType: {
            type: String,
            required: true
        },

        documentTitle: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            default: "",
            trim: true
        },

        // Uploaded file information
        originalFileName: {
            type: String,
            default: ""
        },

        fileName: {
            type: String,
            default: ""
        },

        filePath: {
            type: String,
            default: ""
        },

        fileType: {
            type: String,
            default: ""
        },

        fileSize: {
            type: Number,
            default: 0
        },

        // Document status
        status: {
            type: String,
            enum: [
                "Pending",
                "Under Review",
                "Verified",
                "Rejected"
            ],
            default: "Pending"
        },

        // Admin review information
        adminRemark: {
            type: String,
            default: ""
        },

        reviewedBy: {
            type: String,
            default: ""
        },

        reviewedAt: {
            type: Date,
            default: null
        },

        // Verification / rejection dates
        verifiedAt: {
            type: Date,
            default: null
        },

        rejectedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model(
    "DigitalDocument",
    digitalDocumentSchema
);