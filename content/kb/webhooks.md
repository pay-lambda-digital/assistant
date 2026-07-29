# Webhooks

Webhooks deliver real-time payment notifications to your server. Set your webhook URL in
Dashboard → Settings.

## Event types

- `payment.confirmed` — payment received and confirmed on-chain
- `payment.expired` — payment intent expired without payment

## Payload

```
{
  "event": "payment.confirmed",
  "data": {
    "paymentIntentId": "pi_abc123",
    "txHash": "0xabc...",
    "amount": "99.97",
    "chain": "bsc",
    "token": "USDT",
    "confirmedAt": "2026-06-26T14:05:00Z",
    "metadata": { "orderId": "ord_123" }
  }
}
```

## Verifying signatures

Every webhook request includes an `x-signature` header — an HMAC-SHA256 of the raw
request body, signed with your per-merchant webhook secret. Always verify this before
processing.

```
const crypto = require('crypto');

function verifyWebhook(rawBody, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Retry policy

Failed webhook deliveries are retried 5 times with exponential backoff (immediate → 30s
→ 5m → 30m → 2h). After 5 failures the webhook is marked failed. View delivery logs in
the dashboard.

## Errors

The API uses standard HTTP status codes. Error responses include a JSON body with a
`message` field.

- `400 Bad Request` — invalid request body or missing required fields
- `401 Unauthorized` — missing or invalid API key
- `403 Forbidden` — API key valid but not permitted for this action
- `404 Not Found` — resource does not exist
- `429 Too Many Requests` — rate limit exceeded
- `500 Server Error` — internal error, contact support
