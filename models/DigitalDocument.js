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

        // File bytes are private and excluded from metadata responses.
        fileData: { type: Buffer, select: false },
        fileStorage: { type: String, enum: ["database", "disk"], default: "disk" },

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
        timestamps: true,
        toJSON: { transform: (doc, value) => { delete value.fileData; return value; } },
        toObject: { transform: (doc, value) => { delete value.fileData; return value; } }
    }
);

module.exports = mongoose.model(
    "DigitalDocument",
    digitalDocumentSchema
);