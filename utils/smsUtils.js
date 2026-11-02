const normalizeSmsPhone = (phone) => {
    const trimmedPhone = String(phone).trim();

    if (/^\+[1-9]\d{7,14}$/.test(trimmedPhone)) {
        return trimmedPhone;
    }

    const countryCode = (process.env.SMS_DEFAULT_COUNTRY_CODE || "")
        .replace(/\D/g, "");
    const nationalNumber = trimmedPhone.replace(/\D/g, "").replace(/^0+/, "");

    if (!countryCode || !nationalNumber) {
        throw new Error("Phone number must be E.164 or have SMS_DEFAULT_COUNTRY_CODE configured");
    }

    return `+${countryCode}${nationalNumber}`;
};

const sendSms = async (phone, message) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        throw new Error("Twilio SMS is not configured");
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const body = new URLSearchParams({
        To: normalizeSmsPhone(phone),
        From: fromNumber,
        Body: message
    });

    const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body
        }
    );

    if (!response.ok) {
        throw new Error(`SMS delivery failed with status ${response.status}`);
    }
};

module.exports = { sendSms };