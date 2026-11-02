const mongoose = require("mongoose");

const otpVerificationSchema = new mongoose.Schema(
    {
        phone: {
            type: String,
            required: true
        },
        purpose: {
            type: String,
            enum: ["login", "password-reset"],
            required: true
        },
        codeHash: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        },
        attempts: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

otpVerificationSchema.index(
    { phone: 1, purpose: 1 },
    { unique: true }
);

otpVerificationSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = mongoose.model("OtpVerification", otpVerificationSchema);