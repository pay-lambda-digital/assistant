# Quick Start

Three steps to accept your first crypto payment with Lambda Digital.

## 1. Create a merchant account

Sign up at λ.digital/login, add your wallet addresses in the dashboard, and copy your API
key from Settings.

## 2. Create a payment intent

```
curl -X POST https://xn--wxa.digital/api/v1/payment-intents \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"amount": "99.97", "currency": "USD", "metadata": {"orderId": "123"}}'
```

Response:

```
{
  "id": "pi_...",
  "checkoutUrl": "https://xn--wxa.digital/checkout/pi_...",
  "expiresAt": "2026-06-26T14:00:00Z"
}
```

## 3. Send the customer to checkout

```
// Popup (recommended)
window.open(checkoutUrl, 'pay', 'width=420,height=700,popup');

// Or redirect
window.location.href = checkoutUrl;
```

## Authentication

All API requests must include your API key as a Bearer token in the `Authorization`
header. API keys are prefixed with `sk_live_`.

```
Authorization: Bearer sk_live_your_api_key
```

Never expose your API key in client-side code — all API calls must be made from your
server. Rotate your key immediately if compromised: Dashboard → Settings → Regenerate API
key.

Rate limit: 30 requests/hour per API key on the free plan.

## Payment Intents

A PaymentIntent represents a payment request. It holds the expected amount and links to
the hosted checkout page where the customer selects a chain and pays.

Create one with `POST /api/v1/payment-intents`:

```
{
  "amount": "99.97",       // required — amount as string
  "currency": "USD",       // required — fiat currency for display
  "metadata": {             // optional — any JSON object
    "orderId": "ord_123",
    "userId": "usr_456"
  }
}
```

Fetch the current state with `GET /api/v1/payment-intents/:id` — poll this if you're not
using webhooks.

PaymentIntent statuses:

- `PENDING` — awaiting payment from the customer
- `CONFIRMED` — payment detected and confirmed on-chain
- `UNDERPAID` — payment received but below the expected amount
- `EXPIRED` — no payment received before expiry

## Hosted Checkout

The checkout page at `/checkout/:id` is a hosted page where the customer selects a chain
and sends payment. It shows a QR code and copyable wallet address, and auto-detects when
a payment arrives on-chain (polling every 15 seconds).

The available chains on checkout are whichever wallet addresses the merchant has
registered — the customer can only pay with chains you've configured.

Embedding options:

```
// Option A — popup window (customer stays on your page)
window.open(checkoutUrl, 'pay', 'width=420,height=700,popup');

// Option B — full redirect
window.location.href = checkoutUrl;
```
