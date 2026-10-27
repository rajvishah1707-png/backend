const express = require("express");

const router = express.Router();


// ======================================================
// NORMALIZE MESSAGE
// ======================================================

const normalize = (text = "") => {

    return text
        .toLowerCase()
        .trim()
        .replace(/[?!.,]/g, " ")
        .replace(/\s+/g, " ");
};


// ======================================================
// CHECK ANY KEYWORD
// ======================================================

const hasAny = (
    text,
    keywords
) => {

    return keywords.some(
        keyword =>
            text.includes(keyword)
    );
};


// ======================================================
// AI RESPONSE ENGINE
// ======================================================

const getAIResponse = (
    originalMessage
) => {

    const message =
        normalize(
            originalMessage
        );


    // ================================================
    // EMPTY
    // ================================================

    if (!message) {

        return `
Please type your question.

I can help you with:

• City Services
• Service Applications
• Application Status
• Complaints
• Complaint Status
• Payments
• Digital Documents
• Notifications
• Profile & Account
• Password
• Emergency information
        `.trim();
    }


    // ================================================
    // GREETING
    // ================================================

    if (
        hasAny(message, [
            "hello",
            "hi",
            "hey",
            "hii",
            "good morning",
            "good afternoon",
            "good evening",
            "namaste",
            "kem cho",
            "kem chho"
        ])
    ) {

        return `
Hello! 👋

Welcome to the Smart City Citizen Platform.

I can help you with city services, applications, complaints, payments, digital documents, notifications and your citizen account.

What would you like help with?
        `.trim();
    }


    // ================================================
    // COMPLAINT STATUS
    // ================================================

    if (
        hasAny(message, [
            "complaint status",
            "complaint track",
            "track complaint",
            "my complaint",
            "complaints",
            "complaint"
        ])
    ) {

        return `
You can manage your complaints from **My Complaints**.

Steps:

1. Open **My Complaints**.
2. Click **Report Complaint** to submit a new complaint.
3. Enter category, subject and description.
4. Submit the complaint.
5. Your complaint will receive a Complaint ID.
6. You can track its status from the same page.

Available statuses are:

• Pending
• In Progress
• Resolved
• Rejected

If an administrator replies, the response will also appear in your complaint details.
        `.trim();
    }


    // ================================================
    // REPORT / SUBMIT COMPLAINT
    // ================================================

    if (
        hasAny(message, [
            "report issue",
            "report problem",
            "submit complaint",
            "make complaint",
            "file complaint",
            "register complaint",
            "complaint submit",
            "problem report",
            "issue report"
        ])
    ) {

        return `
To submit a civic complaint:

1. Open **My Complaints**.
2. Click **+ Report Complaint**.
3. Select the complaint category.
4. Enter the subject.
5. Describe the problem clearly.
6. Enter the location/address.
7. Select priority.
8. Click **Submit Complaint**.

After submission, you will receive a Complaint ID and the complaint will start with **Pending** status.
        `.trim();
    }


    // ================================================
    // APPLICATION STATUS
    // ================================================

    if (
        hasAny(message, [
            "application status",
            "track application",
            "application track",
            "my application",
            "application pending",
            "application approved",
            "application rejected"
        ])
    ) {

        return `
You can check your government service applications from **My Applications**.

The application status can be:

• Pending
• Approved
• Rejected
• Completed

Open **My Applications** to view your application details and current status.
        `.trim();
    }


    // ================================================
    // APPLY FOR SERVICE
    // ================================================

    if (
        hasAny(message, [
            "how to apply",
            "how can i apply",
            "apply for",
            "apply service",
            "service application",
            "application process",
            "want to apply",
            "need to apply",
            "apply"
        ])
    ) {

        return `
To apply for a city service:

1. Open **City Services**.
2. Select the service you need.
3. Click **Apply Now**.
4. Fill in the required information.
5. Submit the application.
6. You can later track it from **My Applications**.

The exact documents and information required depend on the selected service.
        `.trim();
    }


    // ================================================
    // CITY SERVICES
    // ================================================

    if (
        hasAny(message, [
            "city services",
            "available services",
            "government services",
            "what services",
            "services available",
            "municipal services",
            "civic services"
        ])
    ) {

        return `
Smart City Citizen Platform provides access to different city and government services.

You can open **City Services** to see the available services and apply for the service you need.

Common service areas include:

• Water Supply
• Electricity
• Waste Management
• Public Transport
• Healthcare
• Civic Services
• Other government services
        `.trim();
    }


    // ================================================
    // PAYMENT
    // ================================================

    if (
        hasAny(message, [
            "payment",
            "pay",
            "fees",
            "fee",
            "transaction",
            "receipt",
            "payment receipt",
            "payment status"
        ])
    ) {

        return `
You can manage applicable service payments from the **Payments** section.

You can use it to:

• View payment details
• Check transaction status
• View payment history
• Access payment receipts

If a service does not require payment, no payment will be required for that application.
        `.trim();
    }


    // ================================================
    // DIGITAL DOCUMENTS
    // ================================================

    if (
        hasAny(message, [
            "digital document",
            "documents",
            "certificate",
            "certificate download",
            "download document",
            "document download",
            "digital certificate"
        ])
    ) {

        return `
Your approved digital documents can be accessed from **Digital Documents**.

Open:

**Dashboard → Digital Documents**

Depending on the service, you may find approved certificates, receipts and other important documents there.
        `.trim();
    }


    // ================================================
    // NOTIFICATIONS
    // ================================================

    if (
        hasAny(message, [
            "notification",
            "notifications",
            "announcement",
            "updates",
            "latest update",
            "city update"
        ])
    ) {

        return `
You can check important city announcements and application updates from **Notifications**.

Open:

**Dashboard → Notifications**

Application-related updates can also be reflected in your application status.
        `.trim();
    }


    // ================================================
    // PROFILE
    // ================================================

    if (
        hasAny(message, [
            "profile",
            "account",
            "my account",
            "personal details",
            "change phone",
            "change email",
            "update profile"
        ])
    ) {

        return `
You can manage your citizen account from **Profile**.

From there you can review or update your available account information.

Open:

**Dashboard → Profile**
        `.trim();
    }


    // ================================================
    // PASSWORD
    // ================================================

    if (
        hasAny(message, [
            "forgot password",
            "forget password",
            "password reset",
            "reset password",
            "change password",
            "password"
        ])
    ) {

        return `
If you have forgotten your password, use the password recovery option available on the Login page.

If you are already logged in and want to change your account information, open your **Profile** section.
        `.trim();
    }


    // ================================================
    // EMERGENCY
    // ================================================

    if (
        hasAny(message, [
            "emergency",
            "ambulance",
            "police",
            "fire",
            "urgent"
        ])
    ) {

        return `
For a real emergency, please contact the appropriate official emergency service immediately.

The Smart City platform should not be used as a replacement for emergency services.

For non-emergency civic problems, you can submit a complaint through **My Complaints**.
        `.trim();
    }


    // ================================================
    // AI HELP
    // ================================================

    if (
        hasAny(message, [
            "what can you do",
            "help me",
            "help",
            "how can you help",
            "what can i ask"
        ])
    ) {

        return `
I am the Smart City Citizen Assistant 🤖.

I can help you with:

🏙️ City Services
📄 Service Applications
📊 Application Status
📢 Complaints
💳 Payments
📑 Digital Documents
🔔 Notifications
👤 Profile & Account
🔐 Password help

Try asking something like:

"How can I submit a complaint?"

or

"How do I track my application?"
        `.trim();
    }


    // ================================================
    // THANK YOU
    // ================================================

    if (
        hasAny(message, [
            "thank you",
            "thanks",
            "thank",
            "great",
            "okay thanks",
            "thank u"
        ])
    ) {

        return `
You're welcome! 😊

I'm here whenever you need help with the Smart City Citizen Platform.
        `.trim();
    }


    // ================================================
    // DEFAULT
    // ================================================

    return `
I understand that you are asking about:

"${originalMessage}"

I can currently help with:

• City Services
• Applying for a service
• Application status
• Submitting a complaint
• Complaint status
• Payments
• Digital Documents
• Notifications
• Profile and account
• Password help

Try asking:

"How can I submit a complaint?"

"How can I track my application?"

"How do I apply for a service?"

"Where can I find my documents?"
    `.trim();
};


// ======================================================
// CHAT API
// ======================================================

router.post("/chat", async (req, res) => {

    try {

        const {
            message
        } = req.body;

        if (
            !message ||
            typeof message !== "string"
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Please enter a valid message"
            });
        }

        const reply =
            getAIResponse(message);

        res.json({
            success: true,
            reply,
            timestamp:
                new Date().toISOString()
        });

    } catch (error) {

        console.error(
            "AI chat error:",
            error
        );

        res.status(500).json({
            success: false,
            message:
                "AI Assistant is temporarily unavailable"
        });
    }
});


module.exports = router;