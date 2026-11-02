function config() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId?.startsWith('rzp_test_') || !secret) {
        const error = new Error('Razorpay Test Mode is not configured. Ask the administrator to configure test keys.');
        error.status = 503;
        throw error;
    }
    return { keyId, secret };
}
async function request(path, method = 'GET', body) {
    const { keyId, secret } = config();
    const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method,
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000)
    });
    const result = await response.json();
    if (!response.ok) {
        const error = new Error('Payment provider request failed. Please try again or contact the administrator.');
        error.definitive = response.status >= 400 && response.status < 500 && response.status !== 429;
        error.status = 502;
        throw error;
    }
    return result;
}
module.exports = { config, request };
