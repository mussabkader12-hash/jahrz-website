// Creates a Square-hosted checkout link for the given order total.
// Requires these environment variables to be set in the Netlify dashboard
// (Site configuration -> Environment variables) -- never in this file:
//   SQUARE_ACCESS_TOKEN  - your Sandbox (or Production) access token
//   SQUARE_LOCATION_ID   - your Location ID
//   SQUARE_ENV           - "sandbox" or "production" (defaults to sandbox)

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const total = Number(body.total);
    const redirectUrl = typeof body.redirectUrl === 'string' ? body.redirectUrl : undefined;
    const orderLabel = typeof body.orderId === 'string' ? body.orderId : 'JAHRZ order';

    if (!total || total <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid total' }) };
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId = process.env.SQUARE_LOCATION_ID;
    const env = process.env.SQUARE_ENV === 'production' ? 'production' : 'sandbox';

    if (!accessToken || !locationId) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing Square credentials' }) };
    }

    const apiBase = env === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const payload = {
      idempotency_key: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      quick_pay: {
        name: orderLabel,
        price_money: { amount: Math.round(total * 100), currency: 'USD' },
        location_id: locationId
      }
    };
    if (redirectUrl) {
      payload.checkout_options = { redirect_url: redirectUrl };
    }

    const response = await fetch(`${apiBase}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: data }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: data.payment_link.url })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
