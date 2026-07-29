# FAQ

**Do you ever hold or custody merchant funds?**
No. On the Self-custody plan, funds go straight to the merchant's own wallet addresses.
On the Auto-convert plan (coming soon), payments are converted and forwarded automatically
— we're not an intermediary that holds a balance either way.

**Which chains and tokens are supported today?**
BSC, Ethereum, Tron, TON, Polygon, and Arbitrum, for USDT and/or USDC depending on the
chain — see the chains reference. The chains actually offered to a given customer at
checkout depend on which wallet addresses that merchant has registered.

**Do you support Solana?**
Not yet — a Solana watcher is planned but not live.

**How do I know a payment succeeded without polling?**
Register a webhook URL in Dashboard → Settings and listen for the `payment.confirmed`
event — always verify its HMAC signature before trusting the payload.

**What happens if a customer sends less than the expected amount?**
The PaymentIntent status becomes `UNDERPAID` rather than `CONFIRMED`.

**Is there a free plan?**
Yes — the Self-custody plan is 0% fee, always, with no cost to the merchant. It requires
adding your own wallet addresses per chain.

**Can merchants offer subscriptions to their own customers?**
That's a planned option for Auto-convert plan merchants (not available yet) — Lambda
Digital will email the subscribed customer when a payment is due, with a link to pay
within 10 days. It's billed the same as any other Auto-convert payment: the plan's
standard 0.1% fee, not a separate subscription fee.

**How much does the Auto-convert plan cost?**
0.1% of every payment processed on that plan — one-off or subscription, no difference in
fee. The Self-custody plan is 0% always, but requires the merchant to manage their own
wallet addresses per chain instead of a single auto-converting payout address.
