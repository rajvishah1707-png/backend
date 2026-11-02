const sendEmail = async (recipient, message) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME;

    if (!apiKey || !senderEmail || !senderName) {
        throw new Error("Brevo email is not configured");
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            accept: "application/json",
            "api-key": apiKey,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            sender: {
                name: senderName,
                email: senderEmail
            },
            to: [{ email: recipient }],
            subject: "Your Smart City verification code",
            textContent: message
        })
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(
            `Brevo email delivery failed with status ${response.status}${details ? `: ${details}` : ""}`
        );
    }
};

module.exports = { sendEmail };
