const crypto = require("crypto");

// Keep these values on the backend only. Requires Node.js 18+.
async function uploadProfilePhoto(file) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Profile photo storage is not configured");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHash("sha256")
        .update(`timestamp=${timestamp}${apiSecret}`).digest("hex");
    const payload = new FormData();
    payload.append("file", new Blob([file.buffer], { type: file.mimetype }), "profile");
    payload.append("api_key", apiKey);
    payload.append("timestamp", timestamp);
    payload.append("signature", signature);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
        { method: "POST", body: payload, signal: AbortSignal.timeout(30000) }
    );
    const result = await response.json();
    if (!response.ok || !result.secure_url) {
        throw new Error("Unable to upload profile photo. Please try again.");
    }
    return result.secure_url;
}

module.exports = { uploadProfilePhoto };
