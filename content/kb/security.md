# Security

Lambda Digital is built non-custodial from day one — merchant funds, merchant keys.
We never hold or touch merchant crypto at any point.

- **Non-custodial** — funds go directly to the merchant's own wallets.
- **HMAC-signed webhooks** — every webhook is signed with the merchant's per-merchant
  secret; verify the signature before trusting the payload.
- **Hashed API keys** — API keys are bcrypt-hashed before storage; the plain key is shown
  once at creation and never stored or shown again.
- **Idempotent confirmations** — payments confirm exactly once, deduplicated by
  transaction hash; double-delivery of a `payment.confirmed` webhook is not possible.
- **Rate limiting** — all public API endpoints are rate-limited per API key.
- **Outbound-only chain watchers** — the services that watch each blockchain for
  incoming transfers make outbound RPC calls only; no inbound ports are exposed.
