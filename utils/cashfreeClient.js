const configured = () => Boolean(process.env.CASHFREE_APP_ID?.trim() && process.env.CASHFREE_SECRET_KEY?.trim());
async function request(path, method = 'GET', body) {
    if (!configured()) throw new Error('Cashfree sandbox keys are not configured');
    const response = await fetch(`https://sandbox.cashfree.com/pg/${path}`, {
        method,
        headers: {
            'x-client-id': process.env.CASHFREE_APP_ID.trim(),
            'x-client-secret': process.env.CASHFREE_SECRET_KEY.trim(),
            'x-api-version': '2023-08-01',
            'content-type': 'application/json'
        },
        body: body && JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw Object.assign(new Error(`Cashfree sandbox request failed (HTTP ${response.status})`), {
        definitive: [400, 401, 403, 422].includes(response.status)
    });
    return response.json();
}
const matchesOrder = (order, record) => order.order_id === record.receipt &&
    Math.round(Number(order.order_amount) * 100) === record.amountPaise && order.order_currency === 'INR';
module.exports = { configured, request, matchesOrder };
